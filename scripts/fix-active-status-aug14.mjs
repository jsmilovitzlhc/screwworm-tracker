import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const envFile = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}

const sql = neon(process.env.DATABASE_URL);

// Per APHIS correction (Aug 13, 2026):
// APHIS shows 45 total / 3 ACTIVE. Tracker had 45 total / 9 active.
// 6 cases were incorrectly marked active (by the Aug 13 fix) — reverting to inactive:
//   #16: Jun 22, Terrell County, Goat  (APHIS case #15)
//   #17: Jun 23, Terrell County, Cattle (APHIS case #16)
//   #18: Jun 23, Terrell County, Cattle (APHIS case #17)
//   #19: Jun 23, Terrell County, Cattle (APHIS case #18)
//   #34: Jul 9,  Brewster County, Cattle (APHIS case #33)
//   #36: Jul 13, Brewster County, Cattle (APHIS case #35)
// Remaining active (3): #43 (Jul 29 Brewster Cattle), #44 (Jul 30 Brewster Cattle), #46 (Aug 5 Terrell Sheep)

try {
  const before = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM screwworm_cases`;
  console.log(`Before: ${before[0].total} total, ${before[0].active} active`);

  const ids = [16, 17, 18, 19, 34, 36];
  for (const id of ids) {
    await sql`UPDATE screwworm_cases SET status = 'inactive' WHERE id = ${id}`;
    console.log(`Case #${id} → inactive`);
  }

  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastChecked', ${JSON.stringify('2026-08-14T09:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify('2026-08-14T00:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log('Updated timestamps');

  const after = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM screwworm_cases`;
  console.log(`\nAfter: ${after[0].total} total, ${after[0].active} active`);

  if (after[0].total == 45 && after[0].active == 3) {
    console.log('✓ Counts match APHIS (45 total, 3 active)');
  } else {
    console.log(`✗ Mismatch! Expected 45 total, 3 active`);
  }

  const activeRows = await sql`SELECT id, date, county, animal FROM screwworm_cases WHERE status = 'active' ORDER BY id`;
  console.log('Active cases:', JSON.stringify(activeRows));

  console.log('\nDone!');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
