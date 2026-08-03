import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const envFile = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}

const sql = neon(process.env.DATABASE_URL);

// Per APHIS Aug 3 update:
// - Case #45: Pecos Co., TX — Ovine (Sheep) — Jul 31, 2026 — Inactive; SU:23271:26, SS:10099:26
// - Cases 33, 34, 35 reclassified from Active → Inactive
//   #33: Crockett, Cattle, 7/7/2026 (SU:21326:26)
//   #34: Brewster, Cattle, 7/9/2026 (SU:21452:26)
//   #35: Crockett, Goats, 7/10/2026 (SU:21603:26)

const newCase = {
  id: 45,
  date: '2026-07-31',
  species: 'Ovine',
  animal: 'Sheep',
  county: 'Pecos',
  state: 'TX',
  lat: 30.8894,
  lng: -103.4732,
  status: 'inactive',
  notes: 'Sixth Pecos County case; sheep; SU:23271:26, SS:10099:26',
};

try {
  const before = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM screwworm_cases`;
  console.log(`Before: ${before[0].total} total, ${before[0].active} active`);

  // Insert case #45
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

  // Update cases 33, 34, 35 to inactive
  for (const caseId of [33, 34, 35]) {
    const result = await sql`UPDATE screwworm_cases SET status = 'inactive' WHERE id = ${caseId} AND status = 'active'`;
    console.log(`Case #${caseId} → inactive (rows updated: ${result.length ?? result.count ?? '?'})`);
  }

  // Update metadata timestamps
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify('2026-08-03T00:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastChecked', ${JSON.stringify('2026-08-03T09:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log('Updated metadata timestamps to lastUpdated=2026-08-03');

  const after = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM screwworm_cases`;
  console.log(`\nAfter: ${after[0].total} total, ${after[0].active} active`);

  console.log('\nDone!');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
