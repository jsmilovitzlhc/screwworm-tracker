import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const envFile = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}

const sql = neon(process.env.DATABASE_URL);

// APHIS dashboard update (Aug 16, 2026):
// New case #46 (APHIS numbering): Val Verde County, TX — Ovine (Sheep) — confirmed Aug 16, 2026
// Animal ID: SU:24447:26, SS:11131:26. First Val Verde County case.
// US total reaches 46 with 4 active (cases 43, 44, 46, 47).

try {
  const before = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM screwworm_cases`;
  console.log(`Before: ${before[0].total} total, ${before[0].active} active`);

  await sql`
    INSERT INTO screwworm_cases (id, date, species, animal, county, state, lat, lng, status, notes)
    VALUES (
      47,
      '2026-08-16',
      'Ovine',
      'Sheep',
      'Val Verde',
      'TX',
      29.89,
      -100.97,
      'active',
      'First Val Verde County case; domestic sheep; SU:24447:26, SS:11131:26'
    )
    ON CONFLICT (id) DO NOTHING
  `;
  console.log('Case #47 (APHIS #46): Val Verde County sheep → inserted');

  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify('2026-08-16T00:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastChecked', ${JSON.stringify('2026-08-16T09:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log('Updated timestamps to lastUpdated=2026-08-16');

  const after = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM screwworm_cases`;
  console.log(`\nAfter: ${after[0].total} total, ${after[0].active} active`);

  if (after[0].total == 46 && after[0].active == 4) {
    console.log('✓ Counts match APHIS (46 total, 4 active)');
  } else {
    console.log(`✗ Mismatch! Expected 46 total, 4 active`);
  }

  const activeRows = await sql`SELECT id, date, county, animal FROM screwworm_cases WHERE status = 'active' ORDER BY id`;
  console.log('Active cases:', JSON.stringify(activeRows));

  console.log('\nDone!');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
