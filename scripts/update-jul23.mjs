import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const envFile = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}

const sql = neon(process.env.DATABASE_URL);

// Per APHIS July 23 update: Case #42 — Sutton Co., TX — Caprine (Goat) — Jul 21, 2026 — Active
// SU:22420:26, SS:9575:26 — Third Sutton County case; expanding caprine detections
const newCase = {
  id: 42,
  date: '2026-07-21',
  species: 'Caprine',
  animal: 'Goat',
  county: 'Sutton',
  state: 'TX',
  lat: 30.4994,
  lng: -100.5407,
  status: 'active',
  notes: 'Third Sutton County case; goat; expanding caprine detections in outbreak area; SU:22420:26, SS:9575:26',
};

try {
  const before = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM screwworm_cases`;
  console.log(`Before: ${before[0].total} total, ${before[0].active} active`);

  // Check if case 42 already exists
  const existing = await sql`SELECT id FROM screwworm_cases WHERE id = ${newCase.id}`;
  if (existing.length > 0) {
    console.log(`Case #${newCase.id} already exists, skipping insert`);
  } else {
    await sql`
      INSERT INTO screwworm_cases (id, date, species, animal, county, state, lat, lng, status, notes)
      VALUES (${newCase.id}, ${newCase.date}, ${newCase.species}, ${newCase.animal}, ${newCase.county}, ${newCase.state}, ${newCase.lat}, ${newCase.lng}, ${newCase.status}, ${newCase.notes})
    `;
    console.log(`Inserted case #${newCase.id}: ${newCase.date} ${newCase.animal} in ${newCase.county} Co. [${newCase.status}]`);
  }

  // Update metadata timestamps
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify('2026-07-23T00:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastChecked', ${JSON.stringify('2026-07-23T09:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log('Updated metadata timestamps to lastUpdated=2026-07-23');

  const after = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM screwworm_cases`;
  console.log(`\nAfter: ${after[0].total} total, ${after[0].active} active`);

  console.log('\nDone!');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
