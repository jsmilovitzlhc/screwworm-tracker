import { neon } from '@neondatabase/serverless';

const TABLEAU_CSV_URL = 'https://publicdashboards.dl.usda.gov/t/MRP_PUB/views/NewWorldScrewwormPublicReporting_17805168329840/SummaryDashboard.csv';

const COUNTY_COORDS = {
  'Zavala|TX': { lat: 28.8656, lng: -99.7604 },
  'La Salle|TX': { lat: 28.3458, lng: -98.9180 },
  'Andrews|TX': { lat: 32.3187, lng: -102.5460 },
  'Lea|NM': { lat: 32.7926, lng: -103.1568 },
  'Gillespie|TX': { lat: 30.2752, lng: -98.8720 },
  'Edwards|TX': { lat: 29.9827, lng: -100.2056 },
  'Uvalde|TX': { lat: 29.2097, lng: -99.7862 },
  'Webb|TX': { lat: 27.7606, lng: -99.3318 },
  'Dimmit|TX': { lat: 28.4225, lng: -99.7567 },
  'Maverick|TX': { lat: 28.7431, lng: -100.3141 },
  'Val Verde|TX': { lat: 29.8930, lng: -101.1544 },
  'Kinney|TX': { lat: 29.3516, lng: -100.4183 },
  'Frio|TX': { lat: 28.8677, lng: -99.1096 },
  'Kerr|TX': { lat: 30.0603, lng: -99.3521 },
  'Kimble|TX': { lat: 30.4854, lng: -99.7489 },
  'Sutton|TX': { lat: 30.4994, lng: -100.5407 },
  'Tom Green|TX': { lat: 31.3978, lng: -100.4611 },
  'Coke|TX': { lat: 31.8876, lng: -100.5275 },
  'Schleicher|TX': { lat: 30.8963, lng: -100.5385 },
};

export default async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const results = { tableau: null, announcements: null };

    // Primary: USDA Tableau dashboard CSV export
    try {
      const csvResult = await fetchTableauCSV(sql);
      results.tableau = csvResult;
    } catch (err) {
      console.error('Tableau CSV fetch failed:', err.message);
      results.tableau = { error: err.message };
    }

    // Secondary: USDA APHIS news announcements
    try {
      const newsResult = await fetchUSDANews(sql);
      results.announcements = newsResult;
    } catch (err) {
      console.error('USDA news fetch failed:', err.message);
      results.announcements = { error: err.message };
    }

    const totalInserted = (results.tableau?.inserted || 0) + (results.announcements?.inserted || 0);

    if (totalInserted > 0) {
      await sql`
        INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify(new Date().toISOString())})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `;
    }

    const summary = {
      checkedAt: new Date().toISOString(),
      totalInserted,
      results,
    };

    console.log('USDA check complete:', JSON.stringify(summary));
    return res.status(200).json(summary);
  } catch (err) {
    console.error('USDA scraper error:', err);
    return res.status(500).json({ error: 'Scraper failed', message: err.message });
  }
}

async function fetchTableauCSV(sql) {
  const response = await fetch(TABLEAU_CSV_URL, {
    headers: { 'User-Agent': 'ScrewwormTracker/1.0 (automated monitoring)' },
  });

  if (!response.ok) {
    throw new Error(`Tableau CSV returned ${response.status}`);
  }

  const csv = await response.text();
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return { inserted: 0, rows: 0 };

  const headers = lines[0].replace(/\r/g, '').split(',').map(h => h.trim().toLowerCase());
  const dateIdx = headers.findIndex(h => h.includes('date'));
  const countyIdx = headers.findIndex(h => h.includes('county'));
  const speciesIdx = headers.findIndex(h => h.includes('species'));
  const stateIdx = headers.findIndex(h => h.includes('state'));

  if (dateIdx < 0 || countyIdx < 0 || speciesIdx < 0 || stateIdx < 0) {
    throw new Error('CSV missing expected columns: ' + headers.join(', '));
  }

  const existingCases = await sql`SELECT date, county, state, species FROM screwworm_cases`;
  const existingSet = new Set(
    existingCases.map(c => {
      const d = typeof c.date === 'string' ? c.date.slice(0, 10) : c.date.toISOString().slice(0, 10);
      return `${d}|${c.county}|${c.state}|${c.species}`;
    })
  );

  let inserted = 0;
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].replace(/\r/g, '').split(',').map(c => c.trim());
    if (cells.length < 4) continue;

    const rawDate = cells[dateIdx];
    const date = parseDate(rawDate);
    if (!date) continue;

    const county = cells[countyIdx];
    const rawSpecies = cells[speciesIdx];
    const state = normalizeState(cells[stateIdx]);
    const species = normalizeSpecies(rawSpecies);
    const animal = deriveAnimal(species, rawSpecies);

    const key = `${date}|${county}|${state}|${species}`;
    if (existingSet.has(key)) continue;

    const coords = getCoords(county, state);
    if (!coords) continue;

    await sql`
      INSERT INTO screwworm_cases (date, species, animal, county, state, lat, lng, status, notes, source_url)
      VALUES (${date}, ${species}, ${animal}, ${county}, ${state}, ${coords.lat}, ${coords.lng}, 'active', ${'Detected via USDA dashboard'}, ${TABLEAU_CSV_URL})
    `;
    existingSet.add(key);
    inserted++;
  }

  return { inserted, rows: lines.length - 1 };
}

async function fetchUSDANews(sql) {
  const url = 'https://www.aphis.usda.gov/news/agency-announcements';
  const response = await fetch(url, {
    headers: { 'User-Agent': 'ScrewwormTracker/1.0 (automated monitoring)' },
  });

  if (!response.ok) return { inserted: 0, error: `HTTP ${response.status}` };

  const html = await response.text();

  const screwwormLinks = [];
  const linkRegex = /href="([^"]*screwworm[^"]*)"/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1].startsWith('http') ? match[1] : `https://www.aphis.usda.gov${match[1]}`;
    if (!screwwormLinks.includes(href)) screwwormLinks.push(href);
  }

  return { inserted: 0, linksFound: screwwormLinks.length, links: screwwormLinks.slice(0, 5) };
}

function parseDate(str) {
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const mdyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    return `${mdyMatch[3]}-${mdyMatch[1].padStart(2, '0')}-${mdyMatch[2].padStart(2, '0')}`;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function normalizeState(raw) {
  const map = {
    'texas': 'TX', 'tx': 'TX',
    'new mexico': 'NM', 'nm': 'NM',
    'arizona': 'AZ', 'az': 'AZ',
    'california': 'CA', 'ca': 'CA',
    'oklahoma': 'OK', 'ok': 'OK',
    'louisiana': 'LA', 'la': 'LA',
    'florida': 'FL', 'fl': 'FL',
  };
  const lower = raw.toLowerCase().trim();
  return map[lower] || raw.toUpperCase().trim().slice(0, 2);
}

function normalizeSpecies(raw) {
  const lower = raw.toLowerCase();
  if (lower.includes('cattle') || lower.includes('bovin') || lower.includes('cow') || lower.includes('calf')) return 'Bovine';
  if (lower.includes('dog') || lower.includes('canin')) return 'Canine';
  if (lower.includes('goat') || lower.includes('caprin')) return 'Caprine';
  if (lower.includes('horse') || lower.includes('equin')) return 'Equine';
  if (lower.includes('sheep') || lower.includes('ovin')) return 'Ovine';
  if (lower.includes('pig') || lower.includes('swine') || lower.includes('porcin')) return 'Porcine';
  return raw.trim();
}

function deriveAnimal(species, rawSpecies) {
  const lower = (rawSpecies || '').toLowerCase();
  if (species === 'Bovine') {
    if (lower.includes('calf')) return 'Calf';
    if (lower.includes('cow')) return 'Cow';
    return 'Cattle';
  }
  if (species === 'Canine') return 'Dog';
  if (species === 'Caprine') return 'Goat';
  if (species === 'Equine') return 'Horse';
  if (species === 'Ovine') return 'Sheep';
  if (species === 'Porcine') return 'Pig';
  return species;
}

function getCoords(county, state) {
  const key = `${county}|${state}`;
  if (COUNTY_COORDS[key]) {
    const base = COUNTY_COORDS[key];
    const jitter = (Math.random() - 0.5) * 0.02;
    return { lat: base.lat + jitter, lng: base.lng + jitter };
  }
  console.warn(`Missing coordinates for ${county}, ${state} — skipping insertion to avoid bad geocoding`);
  return null;
}
