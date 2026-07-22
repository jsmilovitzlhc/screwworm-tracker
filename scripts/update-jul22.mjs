import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const envFile = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}

const sql = neon(process.env.DATABASE_URL);

// Per APHIS July 22 update:
// 3 cases changed active → inactive: IDs 28, 30, 31
// 1 date fix: ID 41 date corrected from 2026-07-18 to 2026-07-17
const statusUpdates = [28, 30, 31];
const dateFix = { id: 41, date: '2026-07-17' };

try {
  const before = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active, COUNT(*) FILTER (WHERE status = 'inactive') as inactive FROM screwworm_cases`;
  console.log(`Before: ${before[0].total} total, ${before[0].active} active, ${before[0].inactive} inactive`);

  for (const id of statusUpdates) {
    const row = await sql`SELECT id, date, animal, county, status FROM screwworm_cases WHERE id = ${id}`;
    if (row.length === 0) {
      console.error(`Case ${id} not found!`);
      continue;
    }
    const c = row[0];
    const d = typeof c.date === 'string' ? c.date.slice(0, 10) : c.date?.toISOString?.()?.slice(0, 10);
    console.log(`  #${id}: ${d} ${c.animal} in ${c.county} Co. [${c.status}] → inactive`);
    await sql`UPDATE screwworm_cases SET status = 'inactive', updated_at = NOW() WHERE id = ${id}`;
  }

  // Fix ID 41 date
  const row41 = await sql`SELECT id, date, animal, county FROM screwworm_cases WHERE id = ${dateFix.id}`;
  if (row41.length > 0) {
    const c = row41[0];
    const d = typeof c.date === 'string' ? c.date.slice(0, 10) : c.date?.toISOString?.()?.slice(0, 10);
    console.log(`  #${dateFix.id}: date ${d} → ${dateFix.date} (${c.animal} in ${c.county} Co.)`);
    await sql`UPDATE screwworm_cases SET date = ${dateFix.date}, updated_at = NOW() WHERE id = ${dateFix.id}`;
  } else {
    console.error(`Case ${dateFix.id} not found!`);
  }

  // Update metadata timestamps
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify('2026-07-22T00:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastChecked', ${JSON.stringify('2026-07-22T09:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log('Updated metadata timestamps to lastUpdated=2026-07-22');

  const after = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active, COUNT(*) FILTER (WHERE status = 'inactive') as inactive FROM screwworm_cases`;
  console.log(`\nAfter: ${after[0].total} total, ${after[0].active} active, ${after[0].inactive} inactive`);

  console.log('\nDone!');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
