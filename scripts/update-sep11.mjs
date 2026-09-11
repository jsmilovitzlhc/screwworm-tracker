import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const envFile = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}

const sql = neon(process.env.DATABASE_URL);

// APHIS dashboard update (Sep 11, 2026, data as of Sep 10):
// - Case 50: Presidio County TX horse, Sep 9 (active) — first Presidio County case,
//   first equine detection of the US outbreak (APHIS SU:26079:26 / SS:12230:26)
// - US total: 49, active: 4 (cases 47 Val Verde sheep, 48 Val Verde goat,
//   49 Crockett dog, 50 Presidio horse)

try {
  const before = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM screwworm_cases`;
  console.log(`Before: ${before[0].total} total, ${before[0].active} active`);

  // Insert case 50
  const existing50 = await sql`SELECT id FROM screwworm_cases WHERE id = 50`;
  if (existing50.length > 0) {
    console.log('Case 50 already exists — skipping insert');
  } else {
    await sql`
      INSERT INTO screwworm_cases (id, date, species, animal, county, state, lat, lng, status, notes)
      VALUES (50, '2026-09-09', 'Equine', 'Horse', 'Presidio', 'TX', 29.9856, -104.2494, 'active', 'First Presidio County case; first equine (horse) detection of the US outbreak; APHIS SU:26079:26 / SS:12230:26')
    `;
    console.log('Case 50 inserted (Presidio horse, Sep 9, active)');
  }

  // Update timestamps
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify('2026-09-11T00:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastChecked', ${JSON.stringify('2026-09-11T09:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log('Updated timestamps to lastUpdated=2026-09-11');

  const after = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM screwworm_cases`;
  console.log(`\nAfter: ${after[0].total} total, ${after[0].active} active`);

  if (Number(after[0].total) === 49 && Number(after[0].active) === 4) {
    console.log('✓ Counts match APHIS (49 total, 4 active)');
  } else {
    console.log(`✗ Mismatch! Expected 49 total, 4 active — got ${after[0].total} total, ${after[0].active} active`);
  }

  const activeRows = await sql`SELECT id, date, county, animal FROM screwworm_cases WHERE status = 'active' ORDER BY id`;
  console.log('Active cases:', JSON.stringify(activeRows));

  console.log('\nDone!');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
