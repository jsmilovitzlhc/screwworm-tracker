import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const envFile = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}

const sql = neon(process.env.DATABASE_URL);

// Per USDA dashboard Aug 5, 2026 — new case detected:
// Case 46: Terrell County, TX — Ovine (Sheep) — Aug 5, 2026 — Active

const newCase = {
  id: 46,
  date: '2026-08-05',
  species: 'Ovine',
  animal: 'Sheep',
  county: 'Terrell',
  state: 'TX',
  lat: 30.22,
  lng: -102.07,
  status: 'active',
  notes: 'Second Terrell County ovine case; domestic sheep; active',
};

try {
  const before = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM screwworm_cases`;
  console.log(`Before: ${before[0].total} total, ${before[0].active} active`);

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

  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify('2026-08-06T00:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastChecked', ${JSON.stringify('2026-08-06T09:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log('Updated metadata timestamps to lastUpdated=2026-08-06');

  const after = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM screwworm_cases`;
  console.log(`\nAfter: ${after[0].total} total, ${after[0].active} active`);

  if (after[0].total == 45 && after[0].active == 5) {
    console.log('✓ Counts match USDA (45 total, 5 active)');
  } else {
    console.log(`✗ Mismatch! Expected 45 total, 5 active`);
  }

  console.log('\nDone!');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
