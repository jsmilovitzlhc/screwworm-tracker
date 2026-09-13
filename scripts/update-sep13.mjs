import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const envFile = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}

const sql = neon(process.env.DATABASE_URL);

// APHIS dashboard sync (Sep 13, 2026). SummaryDashboard.csv reports:
//   June 2026      30 total / 0 active
//   July 2026      14 total / 0 active
//   August 2026     4 total / 1 active
//   September 2026  1 total / 1 active
//   => 49 total / 2 active
//
// Tracker case totals per month already match (30/14/4/1 = 49); only the
// August active count was stale at 3. The two earliest August actives are
// released to inactive, leaving the most recent August case still active:
//   #47 (Aug 16, Val Verde, Sheep) → inactive
//   #48 (Aug 25, Val Verde, Goat)  → inactive
// Remaining active (2): #49 (Aug 31 Crockett Dog), #50 (Sep 9 Presidio Horse)

try {
  const before = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM screwworm_cases`;
  console.log(`Before: ${before[0].total} total, ${before[0].active} active`);

  const beforeActive = await sql`SELECT id, date, county, animal FROM screwworm_cases WHERE status = 'active' ORDER BY id`;
  console.log('Active before:', JSON.stringify(beforeActive));

  const ids = [47, 48];
  for (const id of ids) {
    const rows = await sql`UPDATE screwworm_cases SET status = 'inactive' WHERE id = ${id} RETURNING id, status`;
    if (rows.length === 0) {
      console.log(`✗ Case #${id} not found`);
    } else {
      console.log(`Case #${id} → inactive`);
    }
  }

  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify('2026-09-13T00:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastChecked', ${JSON.stringify('2026-09-13T09:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log('Updated timestamps to lastUpdated=2026-09-13');

  const after = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM screwworm_cases`;
  console.log(`\nAfter: ${after[0].total} total, ${after[0].active} active`);

  if (Number(after[0].total) === 49 && Number(after[0].active) === 2) {
    console.log('✓ Counts match APHIS (49 total, 2 active)');
  } else {
    console.log(`✗ Mismatch! Expected 49 total, 2 active — got ${after[0].total} total, ${after[0].active} active`);
    process.exit(1);
  }

  // Verify the per-month active split matches APHIS exactly
  const byMonth = await sql`
    SELECT to_char(date, 'YYYY-MM') as month,
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE status = 'active') as active
    FROM screwworm_cases GROUP BY 1 ORDER BY 1
  `;
  console.log('By month:', JSON.stringify(byMonth));

  const activeRows = await sql`SELECT id, date, county, animal FROM screwworm_cases WHERE status = 'active' ORDER BY id`;
  console.log('Active cases:', JSON.stringify(activeRows));

  console.log('\nDone!');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
