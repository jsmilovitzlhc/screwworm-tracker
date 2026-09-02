import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const envFile = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}

const sql = neon(process.env.DATABASE_URL);

// APHIS dashboard update (Sep 2, 2026, data as of Sep 1):
// - Case 49: Crockett County TX dog, Aug 31 (active) — 5th Crockett County case
// - US total: 48, active: 3 (cases 47 Val Verde sheep, 48 Val Verde goat, 49 Crockett dog)

try {
  const before = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM screwworm_cases`;
  console.log(`Before: ${before[0].total} total, ${before[0].active} active`);

  // Insert case 49
  const existing49 = await sql`SELECT id FROM screwworm_cases WHERE id = 49`;
  if (existing49.length > 0) {
    console.log('Case 49 already exists — skipping insert');
  } else {
    await sql`
      INSERT INTO screwworm_cases (id, date, species, animal, county, state, lat, lng, status, notes)
      VALUES (49, '2026-08-31', 'Canine', 'Dog', 'Crockett', 'TX', 30.7025, -101.4278, 'active', 'Fifth Crockett County case; domestic dog; confirmed per APHIS dashboard Sep 1')
    `;
    console.log('Case 49 inserted (Crockett dog, Aug 31, active)');
  }

  // Update timestamps
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify('2026-09-02T00:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastChecked', ${JSON.stringify('2026-09-02T09:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log('Updated timestamps to lastUpdated=2026-09-02');

  const after = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM screwworm_cases`;
  console.log(`\nAfter: ${after[0].total} total, ${after[0].active} active`);

  if (Number(after[0].total) === 48 && Number(after[0].active) === 3) {
    console.log('✓ Counts match APHIS (48 total, 3 active)');
  } else {
    console.log(`✗ Mismatch! Expected 48 total, 3 active — got ${after[0].total} total, ${after[0].active} active`);
  }

  const activeRows = await sql`SELECT id, date, county, animal FROM screwworm_cases WHERE status = 'active' ORDER BY id`;
  console.log('Active cases:', JSON.stringify(activeRows));

  console.log('\nDone!');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
