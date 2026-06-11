import { neon } from '@neondatabase/serverless';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const url = 'https://www.aphis.usda.gov/animals/animal-health/livestock-and-poultry-disease/current-status/us-confirmed-cases-new-world';

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ScrewwormTracker/1.0 (automated monitoring)',
      },
    });

    if (!response.ok) {
      throw new Error(`USDA page returned ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const newCases = [];
    const existingCases = await sql`SELECT date, county, state, species FROM screwworm_cases`;
    const existingSet = new Set(
      existingCases.map(c => `${c.date}|${c.county}|${c.state}|${c.species}`)
    );

    // USDA APHIS pages typically have case data in tables
    $('table').each((_, table) => {
      const headers = [];
      $(table).find('thead th, tr:first-child th, tr:first-child td').each((_, th) => {
        headers.push($(th).text().trim().toLowerCase());
      });

      const hasDateCol = headers.some(h => h.includes('date'));
      const hasStateCol = headers.some(h => h.includes('state') || h.includes('location'));
      if (!hasDateCol && !hasStateCol) return;

      const dateIdx = headers.findIndex(h => h.includes('date'));
      const stateIdx = headers.findIndex(h => h.includes('state') || h.includes('location'));
      const countyIdx = headers.findIndex(h => h.includes('county'));
      const speciesIdx = headers.findIndex(h => h.includes('species') || h.includes('animal') || h.includes('host'));
      const statusIdx = headers.findIndex(h => h.includes('status'));
      const notesIdx = headers.findIndex(h => h.includes('note') || h.includes('comment') || h.includes('detail'));

      $(table).find('tbody tr, tr').each((rowIdx, row) => {
        if (rowIdx === 0 && $(row).find('th').length > 0) return;

        const cells = [];
        $(row).find('td').each((_, td) => {
          cells.push($(td).text().trim());
        });

        if (cells.length < 2) return;

        const dateStr = dateIdx >= 0 ? cells[dateIdx] : '';
        const date = parseUSDADate(dateStr);
        if (!date) return;

        const state = stateIdx >= 0 ? normalizeState(cells[stateIdx]) : '';
        const county = countyIdx >= 0 ? cells[countyIdx].replace(/\s*county\s*/i, '') : '';
        const species = speciesIdx >= 0 ? normalizeSpecies(cells[speciesIdx]) : 'Unknown';
        const status = statusIdx >= 0 ? cells[statusIdx].toLowerCase() : 'active';
        const notes = notesIdx >= 0 ? cells[notesIdx] : '';

        const key = `${date}|${county}|${state}|${species}`;
        if (existingSet.has(key)) return;

        newCases.push({
          date,
          species,
          animal: deriveAnimal(species, notes),
          county,
          state,
          lat: null,
          lng: null,
          status: status.includes('active') ? 'active' : status,
          notes: notes || `Detected via USDA APHIS scraper`,
          source_url: url,
        });
      });
    });

    let inserted = 0;
    for (const c of newCases) {
      await sql`
        INSERT INTO screwworm_cases (date, species, animal, county, state, lat, lng, status, notes, source_url)
        VALUES (${c.date}, ${c.species}, ${c.animal}, ${c.county}, ${c.state}, ${c.lat || 0}, ${c.lng || 0}, ${c.status}, ${c.notes}, ${c.source_url})
      `;
      inserted++;
    }

    if (inserted > 0) {
      await sql`
        INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify(new Date().toISOString())})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `;
    }

    const summary = {
      checkedAt: new Date().toISOString(),
      newCasesFound: inserted,
      totalExisting: existingCases.length,
      newCases: newCases.map(c => `${c.date} - ${c.species} in ${c.county}, ${c.state}`),
    };

    console.log('USDA check complete:', JSON.stringify(summary));
    return res.status(200).json(summary);
  } catch (err) {
    console.error('USDA scraper error:', err);
    return res.status(500).json({ error: 'Scraper failed', message: err.message });
  }
}

function parseUSDADate(str) {
  if (!str) return null;
  // Try ISO format first
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  // Try "Month Day, Year"
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  // Try "MM/DD/YYYY"
  const parts = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (parts) {
    return `${parts[3]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  }
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
    'arkansas': 'AR', 'ar': 'AR',
    'florida': 'FL', 'fl': 'FL',
  };
  const lower = raw.toLowerCase().trim();
  return map[lower] || raw.toUpperCase().trim().slice(0, 2);
}

function normalizeSpecies(raw) {
  const lower = raw.toLowerCase();
  if (lower.includes('bovin') || lower.includes('cattle') || lower.includes('cow') || lower.includes('calf')) return 'Bovine';
  if (lower.includes('canin') || lower.includes('dog')) return 'Canine';
  if (lower.includes('equin') || lower.includes('horse')) return 'Equine';
  if (lower.includes('ovin') || lower.includes('sheep')) return 'Ovine';
  if (lower.includes('caprin') || lower.includes('goat')) return 'Caprine';
  if (lower.includes('porcin') || lower.includes('pig') || lower.includes('swine')) return 'Porcine';
  return raw.trim();
}

function deriveAnimal(species, notes) {
  const lower = (notes || '').toLowerCase();
  if (species === 'Bovine') {
    if (lower.includes('calf')) return 'Calf';
    if (lower.includes('cow')) return 'Cow';
    if (lower.includes('bull') || lower.includes('steer')) return 'Steer';
    return 'Cattle';
  }
  if (species === 'Canine') return 'Dog';
  if (species === 'Equine') return 'Horse';
  if (species === 'Ovine') return 'Sheep';
  if (species === 'Caprine') return 'Goat';
  if (species === 'Porcine') return 'Pig';
  return species;
}
