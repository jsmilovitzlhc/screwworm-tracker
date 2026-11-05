import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { fetchAphisCases, diffCases } from '../_lib/aphis.js';

const COUNTIES = JSON.parse(readFileSync(new URL('../_lib/us-counties.json', import.meta.url), 'utf-8'));
const SOURCE_URL = 'https://www.aphis.usda.gov/animals/animal-health/livestock-and-poultry-disease/stop-screwworm/current-status/confirmed';

export default async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const results = { aphis: await syncFromAphis(sql), announcements: null };

    // Secondary: USDA APHIS news announcements
    try {
      results.announcements = await fetchUSDANews(sql);
    } catch (err) {
      console.error('USDA news fetch failed:', err.message);
      results.announcements = { error: err.message };
    }

    const summary = { checkedAt: new Date().toISOString(), results };
    console.log('USDA check complete:', JSON.stringify(summary));
    return res.status(200).json(summary);
  } catch (err) {
    console.error('USDA scraper error:', err);
    return res.status(500).json({ error: 'Scraper failed', message: err.message });
  }
}

async function syncFromAphis(sql) {
  const aphisRows = await fetchAphisCases();
  const dbRows = await sql`select id, date::text as date, status, aphis_id from screwworm_cases`;

  // A short or empty pull means the dashboard changed shape, not that cases disappeared.
  if (aphisRows.length < dbRows.length * 0.9) {
    throw new Error(`APHIS returned ${aphisRows.length} cases but the tracker holds ${dbRows.length}; refusing to sync`);
  }

  const { inserts, updates, notInAphis } = diffCases(dbRows, aphisRows);
  const located = inserts.map((row) => ({ row, coords: getCoords(row.county, row.state) }));
  const skipped = located.filter((l) => !l.coords).map((l) => l.row.su);
  const now = new Date().toISOString();
  const changed = updates.length + located.length - skipped.length > 0;

  // inactive_date is maintained by the screwworm_inactive_date trigger.
  await sql.transaction([
    ...updates.map((u) => sql`update screwworm_cases set status=${u.status}, date=${u.date}, updated_at=now() where id=${u.id}`),
    ...located.filter((l) => l.coords).map(({ row, coords }) => sql`
      insert into screwworm_cases (date, species, animal, county, state, lat, lng, status, notes, source_url, aphis_id)
      values (${row.date}, ${row.species}, ${row.animal}, ${row.county}, ${row.state}, ${coords.lat}, ${coords.lng}, ${row.status},
              ${`Added automatically from the APHIS case-level data; confirmed ${row.date}. APHIS reports location at county level, so the pin is approximate; ${row.su}, ${row.ss}.`},
              ${SOURCE_URL}, ${row.su})`),
    ...(changed ? [sql`insert into screwworm_metadata (key, value) values ('lastUpdated', ${JSON.stringify(now)}::jsonb)
      on conflict (key) do update set value = excluded.value`] : []),
    sql`insert into screwworm_metadata (key, value) values ('lastChecked', ${JSON.stringify(now)}::jsonb)
      on conflict (key) do update set value = excluded.value`,
  ]);

  if (skipped.length) console.error('No county coordinates for', skipped);
  if (notInAphis.length) console.warn('In tracker but not in APHIS data:', notInAphis);
  return { aphisCases: aphisRows.length, inserted: located.length - skipped.length, updated: updates.length, skipped, notInAphis };
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

function getCoords(county, state) {
  const name = county.normalize('NFKD').replace(/[^a-zA-Z]/g, '').toLowerCase();
  const base = COUNTIES[`${state}|${name}`];
  if (!base) return null;
  // Small offset so cases in one county don't stack on one pin.
  const jitter = () => (Math.random() - 0.5) * 0.06;
  return { lat: base[0] + jitter(), lng: base[1] + jitter() };
}
