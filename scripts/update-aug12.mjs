import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const envFile = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}

const sql = neon(process.env.DATABASE_URL);

// Per USDA APHIS Tableau CSV sync (as of Aug 12, 2026):
// Case #42: Sutton County, TX — Caprine (Goat) — 7/21/2026 — SU:22420:26, SS:9575:26
// Previously active, now shown as Inactive on USDA dashboard.
// Tracker had 45 total / 4 active → should be 45 total / 3 active after fix.

try {
  const before = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM screwworm_cases`;
  console.log(`Before: ${before[0].total} total, ${before[0].active} active`);

  await sql`UPDATE screwworm_cases SET status = 'inactive' WHERE id = 42`;
  console.log(`Case #42 (Sutton County goat, Jul 21, SU:22420:26) → inactive`);

  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify('2026-08-12T00:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastChecked', ${JSON.stringify('2026-08-12T09:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log('Updated metadata timestamps to lastUpdated=2026-08-12');

  const after = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM screwworm_cases`;
  console.log(`\nAfter: ${after[0].total} total, ${after[0].active} active`);

  if (after[0].total == 45 && after[0].active == 3) {
    console.log('✓ Counts match USDA (45 total, 3 active)');
  } else {
    console.log(`✗ Mismatch! Expected 45 total, 3 active`);
  }

  console.log('\nDone!');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
