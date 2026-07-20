import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const envFile = readFileSync('.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2];
}

const sql = neon(process.env.DATABASE_URL);

// Per APHIS July 19 update (as of July 19, 2026):
// 7 cases changed active → inactive: IDs 21-27 (Jun 24–27 cluster)
// 2 new cases added: IDs 40-41 (both July 18, 2026)
const statusUpdates = [21, 22, 23, 24, 25, 26, 27];

const newCases = [
  {
    id: 40,
    date: '2026-07-18',
    species: 'Ovine',
    animal: 'Sheep',
    county: 'Schleicher',
    state: 'TX',
    lat: 30.8578,
    lng: -100.5998,
    status: 'inactive',
    notes: 'First Schleicher County case; sheep; new county',
  },
  {
    id: 41,
    date: '2026-07-18',
    species: 'Bovine',
    animal: 'Cattle',
    county: 'Starr',
    state: 'TX',
    lat: 26.5561,
    lng: -98.7669,
    status: 'active',
    notes: 'First Starr County case; cattle; southern border region',
  },
];

try {
  const before = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active, COUNT(*) FILTER (WHERE status = 'inactive') as inactive FROM screwworm_cases`;
  console.log(`Before: ${before[0].total} total, ${before[0].active} active, ${before[0].inactive} inactive`);

  // Update case statuses active → inactive
  for (const id of statusUpdates) {
    const row = await sql`SELECT id, date, animal, county, status FROM screwworm_cases WHERE id = ${id}`;
    if (row.length === 0) {
      console.error(`Case ${id} not found!`);
      continue;
    }
    const c = row[0];
    const d = typeof c.date === 'string' ? c.date.slice(0, 10) : c.date?.toISOString?.()?.slice(0, 10);
    console.log(`  #${id}: ${d} ${c.animal} in ${c.county} Co. [${c.status}] → inactive`);
    await sql`UPDATE screwworm_cases SET status = 'inactive', updated_at = NOW() WHERE id = ${id}`;
  }

  // Insert new cases
  for (const c of newCases) {
    const exists = await sql`SELECT id FROM screwworm_cases WHERE id = ${c.id}`;
    if (exists.length > 0) {
      await sql`
        UPDATE screwworm_cases
        SET date = ${c.date}, species = ${c.species}, animal = ${c.animal},
            county = ${c.county}, state = ${c.state}, lat = ${c.lat}, lng = ${c.lng},
            status = ${c.status}, notes = ${c.notes}, updated_at = NOW()
        WHERE id = ${c.id}
      `;
      console.log(`Updated case ${c.id}: ${c.animal} in ${c.county} County`);
    } else {
      await sql`
        INSERT INTO screwworm_cases (id, date, species, animal, county, state, lat, lng, status, notes)
        VALUES (${c.id}, ${c.date}, ${c.species}, ${c.animal}, ${c.county}, ${c.state}, ${c.lat}, ${c.lng}, ${c.status}, ${c.notes})
      `;
      console.log(`Inserted case ${c.id}: ${c.animal} in ${c.county} County`);
    }
  }

  await sql`SELECT setval('screwworm_cases_id_seq', (SELECT MAX(id) FROM screwworm_cases))`;

  // Update metadata timestamps
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify('2026-07-19T00:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastChecked', ${JSON.stringify('2026-07-19T09:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log('Updated metadata timestamps to lastUpdated=2026-07-19');

  const after = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active, COUNT(*) FILTER (WHERE status = 'inactive') as inactive FROM screwworm_cases`;
  console.log(`\nAfter: ${after[0].total} total, ${after[0].active} active, ${after[0].inactive} inactive`);

  const allCases = await sql`SELECT id, date, species, animal, county, status FROM screwworm_cases ORDER BY id`;
  console.log('\nAll cases:');
  for (const r of allCases) {
    const d = typeof r.date === 'string' ? r.date.slice(0, 10) : r.date?.toISOString?.()?.slice(0, 10);
    console.log(`  #${r.id}: ${d} ${r.animal} in ${r.county} Co. [${r.status}]`);
  }

  console.log('\nDone!');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
