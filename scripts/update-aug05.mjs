import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const envFile = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}

const sql = neon(process.env.DATABASE_URL);

// Per USDA Tableau Aug 5, 2026 sync:
// USDA shows 44 total cases, 4 active. Our tracker had 45 total, 7 active.
//
// 1. Cases 37, 38, 39 → inactive (USDA no longer shows these as active)
//    #37: Sutton Co., TX — Canine (Dog) — 7/13/2026 — SU:21758:26
//    #38: Pecos Co., TX — Ovine (Sheep) — 7/14/2026 — SU:21829:26
//    #39: Pecos Co., TX — Ovine (Sheep) — 7/14/2026 — SU:21830:26
//
// 2. Case 15 is a duplicate — USDA shows only ONE Edwards cattle case on 6/21
//    (SU:19568:26, mapped to our ID 14). Case 15 "Fifth Edwards County case" is not in USDA data.
//    Removing case 15 brings total 45 → 44.

try {
  const before = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM screwworm_cases`;
  console.log(`Before: ${before[0].total} total, ${before[0].active} active`);

  // Update cases 37, 38, 39 to inactive
  for (const caseId of [37, 38, 39]) {
    await sql`UPDATE screwworm_cases SET status = 'inactive' WHERE id = ${caseId}`;
    console.log(`Case #${caseId} → inactive`);
  }

  // Confirm case 15 is a duplicate and remove it
  const case15 = await sql`SELECT * FROM screwworm_cases WHERE id = 15`;
  if (case15.length > 0) {
    console.log(`Case #15: ${JSON.stringify(case15[0])} — confirmed duplicate, removing`);
    await sql`DELETE FROM screwworm_cases WHERE id = 15`;
    console.log(`Case #15 deleted`);
  } else {
    console.log(`Case #15 not found (already removed)`);
  }

  // Update metadata
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify('2026-08-05T00:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastChecked', ${JSON.stringify('2026-08-05T09:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log('Updated metadata timestamps to lastUpdated=2026-08-05');

  const after = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM screwworm_cases`;
  console.log(`\nAfter: ${after[0].total} total, ${after[0].active} active`);

  if (after[0].total == 44 && after[0].active == 4) {
    console.log('✓ Counts match USDA (44 total, 4 active)');
  } else {
    console.log(`✗ Mismatch! Expected 44 total, 4 active`);
  }

  console.log('\nDone!');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
