import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function fixCaseData() {
  const dataPath = join(__dirname, '..', 'src', 'data', 'cases.json');
  const data = JSON.parse(readFileSync(dataPath, 'utf-8'));

  const existing = await sql`SELECT id, date, county, state, species, lat, lng FROM screwworm_cases ORDER BY id`;
  console.log(`Current database has ${existing.length} cases`);
  for (const c of existing) {
    const d = typeof c.date === 'string' ? c.date.slice(0, 10) : c.date.toISOString().slice(0, 10);
    console.log(`  #${c.id}: ${d} ${c.species} ${c.county}, ${c.state} (${c.lat}, ${c.lng})`);
  }

  console.log('\nClearing existing cases and re-seeding with corrected data...');
  await sql`DELETE FROM screwworm_cases`;

  for (const c of data.confirmedCases) {
    await sql`
      INSERT INTO screwworm_cases (id, date, species, animal, county, state, lat, lng, status, notes)
      VALUES (${c.id}, ${c.date}, ${c.species}, ${c.animal}, ${c.county}, ${c.state}, ${c.lat}, ${c.lng}, ${c.status}, ${c.notes})
    `;
  }
  await sql`SELECT setval('screwworm_cases_id_seq', (SELECT MAX(id) FROM screwworm_cases))`;

  console.log(`\nRe-seeded ${data.confirmedCases.length} cases.`);

  console.log('\nUpdating quarantine zones...');
  await sql`DELETE FROM screwworm_quarantine_zones`;
  for (const q of data.quarantineZones) {
    await sql`
      INSERT INTO screwworm_quarantine_zones (name, state, center_lat, center_lng, radius_miles, established_date, status)
      VALUES (${q.name}, ${q.state}, ${q.center[0]}, ${q.center[1]}, ${q.radiusMiles}, ${q.established}, ${q.active ? 'active' : 'inactive'})
    `;
  }
  console.log(`Re-seeded ${data.quarantineZones.length} quarantine zones.`);

  console.log('\nUpdating metadata...');
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify(data.lastUpdated)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('internationalContext', ${JSON.stringify(data.internationalContext)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('stateResponses', ${JSON.stringify(data.stateResponses)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('speciesBreakdown', ${JSON.stringify(data.speciesBreakdown)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;

  const verify = await sql`SELECT id, date, county, state, species, lat, lng FROM screwworm_cases ORDER BY date, id`;
  console.log(`\nVerification — ${verify.length} cases in database:`);
  for (const c of verify) {
    const d = typeof c.date === 'string' ? c.date.slice(0, 10) : c.date.toISOString().slice(0, 10);
    console.log(`  #${c.id}: ${d} ${c.species} ${c.county}, ${c.state} (${c.lat}, ${c.lng})`);
  }

  console.log('\nDone!');
}

try {
  await fixCaseData();
} catch (err) {
  console.error('Fix failed:', err);
  process.exit(1);
}
