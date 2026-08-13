import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const envFile = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}

const sql = neon(process.env.DATABASE_URL);

// Per APHIS correction (Aug 13, 2026):
// APHIS shows 45 total / 9 active. Tracker had 45 total / 3 active.
// 6 cases were incorrectly marked inactive — fixing to active:
//   #16: Jun 22, Terrell County, Goat
//   #17: Jun 23, Terrell County, Cattle
//   #18: Jun 23, Terrell County, Cattle
//   #19: Jun 23, Terrell County, Cattle
//   #34: Jul 9, Brewster County, Cattle
//   #36: Jul 13, Brewster County, Cattle

try {
  const before = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM screwworm_cases`;
  console.log(`Before: ${before[0].total} total, ${before[0].active} active`);

  const ids = [16, 17, 18, 19, 34, 36];
  for (const id of ids) {
    await sql`UPDATE screwworm_cases SET status = 'active' WHERE id = ${id}`;
    console.log(`Case #${id} → active`);
  }

  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastChecked', ${JSON.stringify('2026-08-13T09:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log('Updated lastChecked timestamp');

  const after = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM screwworm_cases`;
  console.log(`\nAfter: ${after[0].total} total, ${after[0].active} active`);

  if (after[0].total == 45 && after[0].active == 9) {
    console.log('✓ Counts match APHIS (45 total, 9 active)');
  } else {
    console.log(`✗ Mismatch! Expected 45 total, 9 active`);
  }

  console.log('\nDone!');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
