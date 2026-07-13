import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const envFile = readFileSync('.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2];
}

const sql = neon(process.env.DATABASE_URL);

// Per APHIS July 12 update: 4 cases changed from active → inactive
// IDs 7 (Jun 9, Edwards, Cattle), 8 (Jun 11, Edwards, Cattle),
// 9 (Jun 11, Edwards, Goat), 13 (Jun 20, Crockett, Sheep)
const statusUpdates = [7, 8, 9, 13];

try {
  const before = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active, COUNT(*) FILTER (WHERE status = 'inactive') as inactive FROM screwworm_cases`;
  console.log(`Before: ${before[0].total} total, ${before[0].active} active, ${before[0].inactive} inactive`);

  // Update case statuses
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

  // Update metadata timestamps
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify('2026-07-12T00:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastChecked', ${JSON.stringify('2026-07-13T05:30:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log('Updated metadata timestamps to lastUpdated=2026-07-12, lastChecked=2026-07-13');

  // Final verification
  const after = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active, COUNT(*) FILTER (WHERE status = 'inactive') as inactive FROM screwworm_cases`;
  console.log(`\nAfter: ${after[0].total} total, ${after[0].active} active, ${after[0].inactive} inactive`);

  const allCases = await sql`SELECT id, date, species, animal, county, status FROM screwworm_cases ORDER BY id`;
  console.log('\nAll cases:');
  for (const r of allCases) {
    const d = typeof r.date === 'string' ? r.date.slice(0, 10) : r.date?.toISOString?.()?.slice(0, 10);
    console.log(`  #${r.id}: ${d} ${r.animal} in ${r.county} Co. [${r.status}]`);
  }

  console.log('\nDone!');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
