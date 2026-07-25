import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const envFile = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}

const sql = neon(process.env.DATABASE_URL);

// Per APHIS July 24 dashboard update:
// Case #32 (2026-07-03, Crockett County, TX, Sheep) changed active → inactive
// No new cases — total remains 42; corrects our count to 9 active / 33 inactive

try {
  const before = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active, COUNT(*) FILTER (WHERE status = 'inactive') as inactive FROM screwworm_cases`;
  console.log(`Before: ${before[0].total} total, ${before[0].active} active, ${before[0].inactive} inactive`);

  const row32 = await sql`SELECT id, date, animal, county, status FROM screwworm_cases WHERE id = 32`;
  if (row32.length === 0) {
    console.error('Case #32 not found!');
    process.exit(1);
  }
  const c = row32[0];
  const d = typeof c.date === 'string' ? c.date.slice(0, 10) : c.date?.toISOString?.()?.slice(0, 10);
  console.log(`  #32: ${d} ${c.animal} in ${c.county} Co. [${c.status}] → inactive`);
  await sql`UPDATE screwworm_cases SET status = 'inactive', updated_at = NOW() WHERE id = 32`;

  // Update metadata timestamps
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify('2026-07-25T00:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastChecked', ${JSON.stringify('2026-07-25T09:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log('Updated metadata timestamps to lastUpdated=2026-07-25');

  const after = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active, COUNT(*) FILTER (WHERE status = 'inactive') as inactive FROM screwworm_cases`;
  console.log(`\nAfter: ${after[0].total} total, ${after[0].active} active, ${after[0].inactive} inactive`);

  console.log('\nDone!');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
