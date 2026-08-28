import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const envFile = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}

const sql = neon(process.env.DATABASE_URL);

// APHIS dashboard update (Aug 28, 2026, data as of Aug 27):
// - Case 46 (Terrell sheep, Aug 5) reclassified inactive
// - Case 47 (Val Verde sheep) date corrected: Aug 18 → Aug 16
// - Case 48 (Val Verde goat, Aug 25) notes updated to "domestic goat; new case per APHIS dashboard Aug 27"
// - US total: 47, active: 2 (cases 47 Val Verde sheep Aug 16, 48 Val Verde goat Aug 25)

try {
  const before = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM screwworm_cases`;
  console.log(`Before: ${before[0].total} total, ${before[0].active} active`);

  // Case 46 (Terrell sheep, Aug 5) → inactive
  await sql`UPDATE screwworm_cases SET status = 'inactive', notes = 'Second Terrell County ovine case; domestic sheep; reclassified inactive Aug 28' WHERE id = 46`;
  console.log('Case 46 (Terrell sheep, Aug 5) → inactive');

  // Correct case 47 date from Aug 18 to Aug 16
  await sql`UPDATE screwworm_cases SET date = '2026-08-16' WHERE id = 47`;
  console.log('Case 47 (Val Verde sheep) date corrected: 2026-08-18 → 2026-08-16');

  // Add case 48 if not already present, or update notes
  const existing48 = await sql`SELECT id FROM screwworm_cases WHERE id = 48`;
  if (existing48.length > 0) {
    await sql`UPDATE screwworm_cases SET notes = 'Second Val Verde County case; domestic goat; new case per APHIS dashboard Aug 27' WHERE id = 48`;
    console.log('Case 48 notes updated');
  } else {
    await sql`
      INSERT INTO screwworm_cases (id, date, species, animal, county, state, lat, lng, status, notes)
      VALUES (48, '2026-08-25', 'Caprine', 'Goat', 'Val Verde', 'TX', 29.88, -100.96, 'active', 'Second Val Verde County case; domestic goat; new case per APHIS dashboard Aug 27')
    `;
    console.log('Case 48 inserted (Val Verde goat, Aug 25)');
  }

  // Update timestamps
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify('2026-08-28T00:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastChecked', ${JSON.stringify('2026-08-28T09:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log('Updated timestamps to lastUpdated=2026-08-28');

  const after = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM screwworm_cases`;
  console.log(`\nAfter: ${after[0].total} total, ${after[0].active} active`);

  if (Number(after[0].total) === 47 && Number(after[0].active) === 2) {
    console.log('✓ Counts match APHIS (47 total, 2 active)');
  } else {
    console.log(`✗ Mismatch! Expected 47 total, 2 active — got ${after[0].total} total, ${after[0].active} active`);
  }

  const activeRows = await sql`SELECT id, date, county, animal FROM screwworm_cases WHERE status = 'active' ORDER BY id`;
  console.log('Active cases:', JSON.stringify(activeRows));

  console.log('\nDone!');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
