import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const envFile = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}

const sql = neon(process.env.DATABASE_URL);

// APHIS dashboard update (Aug 21, 2026):
// - Cases 43 (Brewster cattle, Jul 29) and 44 (Brewster cattle, Jul 30) reclassified inactive
// - Case 47 (Val Verde sheep) date corrected: Aug 16 → Aug 18 (per APHIS "last reported detection Aug 18")
// - US total: 46, active: 2 (cases 46 Terrell + 47 Val Verde)

try {
  const before = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM screwworm_cases`;
  console.log(`Before: ${before[0].total} total, ${before[0].active} active`);

  // Reclassify cases 43 and 44 as inactive
  await sql`UPDATE screwworm_cases SET status = 'inactive' WHERE id IN (43, 44)`;
  console.log('Cases 43 & 44 (Brewster cattle, Jul 29-30) → inactive');

  // Correct case 47 date from Aug 16 to Aug 18
  await sql`UPDATE screwworm_cases SET date = '2026-08-18' WHERE id = 47`;
  console.log('Case 47 (Val Verde sheep) date corrected: 2026-08-16 → 2026-08-18');

  // Update timestamps
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify('2026-08-21T00:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastChecked', ${JSON.stringify('2026-08-21T09:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log('Updated timestamps to lastUpdated=2026-08-21');

  const after = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM screwworm_cases`;
  console.log(`\nAfter: ${after[0].total} total, ${after[0].active} active`);

  if (after[0].total == 46 && after[0].active == 2) {
    console.log('✓ Counts match APHIS (46 total, 2 active)');
  } else {
    console.log(`✗ Mismatch! Expected 46 total, 2 active — got ${after[0].total} total, ${after[0].active} active`);
  }

  const activeRows = await sql`SELECT id, date, county, animal FROM screwworm_cases WHERE status = 'active' ORDER BY id`;
  console.log('Active cases:', JSON.stringify(activeRows));

  console.log('\nDone!');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
