// Pulls APHIS's case-level data out of the public Tableau dashboard. The dashboard's
// SummaryDashboard .csv only has monthly totals; the per-case rows come from the ExportToCSV
// worksheet, which serves a plain .csv over a normal GET -- no VizQL session needed.
const CSV_URL = 'https://publicdashboards.dl.usda.gov/t/MRP_PUB/views/NewWorldScrewwormPublicReporting_17805168329840/ExportToCSV.csv';
const USER_AGENT = 'ScrewwormTracker/1.0 (automated monitoring)';

const STATES = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO',
  connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID',
  illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA',
  maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
  mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR',
  pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD',
  tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA',
  'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
};

export async function fetchAphisCases() {
  const res = await fetch(CSV_URL, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`APHIS ExportToCSV returned HTTP ${res.status}`);
  return parseCsv(await res.text()).filter((r) => r.caseType !== 'Fly Trap').map(normalizeRow);
}

// APHIS renames these columns from time to time and has already renamed one of them back: the
// subject id shipped as "Animal ID", became a long "... Id Pk", and is "Animal ID" again. Pinning
// a single substring is what broke the cron twice, so every column carries each caption APHIS has
// used and is resolved against all of them.
const WANTED = {
  caseType: ['case type'],
  county: ['county'],
  species: ['species'],
  animalId: ['animal id', 'id pk'],
  state: ['state'],
  status: ['status'],
  date: ['confirmed date'],
};

export function parseCsv(text) {
  const rows = splitCsv(text.replace(/^\uFEFF/, '').trim());
  const header = rows.shift();
  if (!header) throw new Error('APHIS ExportToCSV returned no rows');

  const lower = header.map((h) => h.trim().toLowerCase());
  const index = {};
  for (const [key, needles] of Object.entries(WANTED)) {
    // Exact captions are tried across every candidate before any substring, because
    // "Min. Confirmed Date" also contains "confirmed date" and "Animal Type" contains "animal".
    let at = -1;
    for (const needle of needles) {
      at = lower.indexOf(needle);
      if (at >= 0) break;
    }
    if (at < 0) {
      for (const needle of needles) {
        at = lower.findIndex((h) => h.includes(needle));
        if (at >= 0) break;
      }
    }
    if (at < 0) throw new Error(`Column ${needles.map((n) => `"${n}"`).join(' / ')} is missing from the APHIS csv: ${header.join('|')}`);
    index[key] = at;
  }

  return rows
    .filter((cells) => cells.some((c) => c.trim()))
    .map((cells) => Object.fromEntries(
      Object.entries(index).map(([key, at]) => [key, (cells[at] ?? '').trim()]),
    ));
}

// Minimal RFC-4180 split: the subject-id column is quoted and contains commas.
export function splitCsv(text) {
  const rows = [[]];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { rows.at(-1).push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      rows.at(-1).push(cell);
      cell = '';
      rows.push([]);
    } else cell += ch;
  }
  rows.at(-1).push(cell);
  return rows.filter((r) => r.length > 1 || r[0] !== '');
}

// APHIS writes M/D/YYYY in the csv. Pad it rather than handing it to Date(), which would reread
// it in the runtime's local zone and can land the case a day -- or a month -- off.
export function toIsoDate(raw) {
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const us = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!us) return null;
  const [, m, d, y] = us;
  if (+m < 1 || +m > 12 || +d < 1 || +d > 31) return null;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

export function normalizeRow(r) {
  const su = canonicalId(r.animalId, 'SU');
  const ss = canonicalId(r.animalId, 'SS') ?? '';
  const state = STATES[r.state.trim().toLowerCase()];
  const status = r.status.trim().toLowerCase();
  const date = toIsoDate(String(r.date));
  if (!su) throw new Error(`No APHIS subject id in "${r.animalId}"`);
  if (!state) throw new Error(`Unknown state "${r.state}" on ${su}`);
  if (status !== 'active' && status !== 'inactive') throw new Error(`Unknown status "${r.status}" on ${su}`);
  if (!date) throw new Error(`Bad date "${r.date}" on ${su}`);
  const species = normalizeSpecies(r.species);
  return { su, ss, date, county: r.county.trim(), state, status, species, animal: deriveAnimal(species, r.species) };
}

// APHIS is inconsistent about the separator ("SU:29064:27" vs "SU29063.27"), so both are read and
// stored in the colon form -- otherwise the same case inserts twice when APHIS fixes its formatting.
export function canonicalId(raw, prefix) {
  const m = raw.match(new RegExp(`${prefix}[:.]?(\\d+)[:.](\\d+)`));
  return m ? `${prefix}:${m[1]}:${m[2]}` : null;
}

function normalizeSpecies(raw) {
  const lower = raw.toLowerCase();
  if (/cattle|bovin|cow|calf|bison/.test(lower)) return 'Bovine';
  if (/dog|canin/.test(lower)) return 'Canine';
  if (/goat|caprin/.test(lower)) return 'Caprine';
  if (/horse|equin|donkey|mule/.test(lower)) return 'Equine';
  if (/sheep|ovin/.test(lower)) return 'Ovine';
  if (/\bcat\b|felin/.test(lower)) return 'Feline';
  if (/elk|deer|cervid/.test(lower)) return 'Cervid';
  if (/chicken|turkey|poultry|avian/.test(lower)) return 'Avian';
  if (/pig|swine|hog|porcin/.test(lower)) return 'Porcine';
  return raw.trim();
}

function deriveAnimal(species, raw) {
  const lower = raw.toLowerCase();
  const names = { Canine: 'Dog', Caprine: 'Goat', Equine: 'Horse', Ovine: 'Sheep', Feline: 'Cat', Porcine: 'Pig' };
  if (species === 'Bovine') return lower.includes('calf') ? 'Calf' : 'Cattle';
  if (species === 'Cervid') return lower.includes('deer') ? 'Deer' : 'Elk';
  if (species === 'Avian') return lower.includes('turkey') ? 'Turkey' : 'Chicken';
  return names[species] ?? raw.trim();
}

// What has to change in the DB to match APHIS. Cases are matched on the APHIS subject id. A case
// APHIS stops listing is reported, never deleted: that call is left to a person.
export function diffCases(dbRows, aphisRows) {
  const bySu = new Map(dbRows.filter((r) => r.aphis_id).map((r) => [r.aphis_id, r]));
  const inserts = [];
  const updates = [];
  for (const row of aphisRows) {
    const existing = bySu.get(row.su);
    if (!existing) inserts.push(row);
    else if (existing.status !== row.status || existing.date !== row.date) updates.push({ id: existing.id, ...row });
  }
  const seen = new Set(aphisRows.map((r) => r.su));
  const notInAphis = dbRows.filter((r) => !r.aphis_id || !seen.has(r.aphis_id)).map((r) => r.id);
  return { inserts, updates, notInAphis };
}
