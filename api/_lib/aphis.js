// Pulls APHIS's case-level data out of the public Tableau dashboard. The dashboard's .csv export
// only has monthly totals; the per-case rows live in a hidden worksheet named ExportToCSV, which
// comes back in the VizQL bootstrap payload.
const BASE = 'https://publicdashboards.dl.usda.gov';
const WORKBOOK = 'NewWorldScrewwormPublicReporting_17805168329840';
const VIEW_URL = `${BASE}/t/MRP_PUB/views/${WORKBOOK}/SummaryDashboard?:embed=y&:showVizHome=no`;
const VIZQL = `${BASE}/vizql/t/MRP_PUB/w/${WORKBOOK}/v/SummaryDashboard`;
const USER_AGENT = 'ScrewwormTracker/1.0 (automated monitoring)';
const SHEET = 'ExportToCSV';

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
  const page = await fetch(VIEW_URL, { headers: { 'User-Agent': USER_AGENT } });
  if (!page.ok) throw new Error(`APHIS dashboard returned HTTP ${page.status}`);
  const headers = {
    'User-Agent': USER_AGENT,
    'Content-Type': 'application/x-www-form-urlencoded',
    cookie: page.headers.getSetCookie().map((c) => c.split(';')[0]).join('; '),
  };

  const start = await fetch(`${VIZQL}/startSession/viewing?:embed=y&:showVizHome=no`, { method: 'POST', headers });
  if (!start.ok) throw new Error(`startSession returned HTTP ${start.status}`);
  const { sessionid } = await start.json();
  if (!sessionid) throw new Error('startSession returned no session id');

  const size = JSON.stringify({ w: 1200, h: 900 });
  const boot = await fetch(`${VIZQL}/bootstrapSession/sessions/${sessionid}`, {
    method: 'POST',
    headers,
    body: new URLSearchParams({
      sheet_id: SHEET,
      worksheetPortSize: size,
      dashboardPortSize: size,
      clientDimension: size,
      renderMapsClientSide: 'true',
      isBrowserRendering: 'true',
      browserRenderingThreshold: '100',
      formatDataValueLocally: 'false',
      language: 'en',
      locale: 'en_US',
    }),
  });
  if (!boot.ok) throw new Error(`bootstrapSession returned HTTP ${boot.status}`);
  return parseBootstrap(await boot.text()).filter((r) => r.caseType !== 'Fly Trap').map(normalizeRow);
}

// The payload is a series of `<length>;<json>` chunks; the data is in the second one.
export function parseBootstrap(text) {
  const chunks = [];
  for (let i = 0; i < text.length;) {
    const semi = text.indexOf(';', i);
    const len = parseInt(text.slice(i, semi), 10);
    chunks.push(JSON.parse(text.slice(semi + 1, semi + 1 + len)));
    i = semi + 1 + len;
  }
  const models = chunks[1].secondaryInfo.presModelMap;

  const dict = {};
  for (const segment of Object.values(models.dataDictionary.presModelHolder.genDataDictionaryPresModel.dataSegments)) {
    for (const col of segment.dataColumns) (dict[col.dataType] ||= []).push(...col.dataValues);
  }

  const sheet = models.vizData.presModelHolder.genPresModelMapPresModel.presModelMap[SHEET];
  if (!sheet) throw new Error(`Worksheet ${SHEET} is missing from the APHIS payload`);
  const pane = sheet.presModelHolder.genVizDataPresModel.paneColumnsData;

  const columns = {};
  for (const col of pane.vizDataColumns) {
    if (!col.fieldCaption) continue;
    const raw = pane.paneColumnsList[col.paneIndices[0]].vizPaneColumns[col.columnIndices[0]];
    const indices = raw.valueIndices.length ? raw.valueIndices : raw.aliasIndices;
    columns[col.fieldCaption] = indices.map((k) => (k < 0 ? dict.cstring[-k - 1] : dict[col.dataType][k]));
  }

  const wanted = { caseType: 'Case Type', county: 'County', species: 'Species', animalId: 'Animal ID', state: 'State', status: 'Status', date: 'Confirmed Date' };
  for (const name of Object.values(wanted)) {
    if (!columns[name]) throw new Error(`Column "${name}" is missing from the APHIS payload`);
  }
  return columns[wanted.status].map((_, i) => Object.fromEntries(
    Object.entries(wanted).map(([key, name]) => [key, columns[name][i]]),
  ));
}

export function normalizeRow(r) {
  const su = r.animalId.match(/SU:\d+:\d+/)?.[0];
  const ss = r.animalId.match(/SS:\d+:\d+/)?.[0] ?? '';
  const state = STATES[r.state.trim().toLowerCase()];
  const status = r.status.trim().toLowerCase();
  const date = String(r.date).slice(0, 10);
  if (!su) throw new Error(`No APHIS subject id in "${r.animalId}"`);
  if (!state) throw new Error(`Unknown state "${r.state}" on ${su}`);
  if (status !== 'active' && status !== 'inactive') throw new Error(`Unknown status "${r.status}" on ${su}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Bad date "${r.date}" on ${su}`);
  const species = normalizeSpecies(r.species);
  return { su, ss, date, county: r.county.trim(), state, status, species, animal: deriveAnimal(species, r.species) };
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
