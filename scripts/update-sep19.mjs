import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const envFile = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}

const sql = neon(process.env.DATABASE_URL);

// APHIS dashboard sync (Sep 19, 2026) — 50 total / 14 active.
//
// 1. New case 51: Grant County NM horse, Sep 17 (active) — second equine case
//    of the US outbreak, second New Mexico county affected (after Lea, case 4).
// 2. Active-status correction: APHIS reports 14 active. Eleven Crockett County
//    cases previously carried as inactive are reclassified active:
//      June:  13, 22, 23, 24, 25, 27, 30, 31  (8)
//      July:  32, 33, 35                      (3)
//    Plus already-active 49 (Aug 31 Crockett dog) and 50 (Sep 9 Presidio horse),
//    plus new 51 => 8 + 3 + 1 + 2 = 14 active.
//
// speciesBreakdown is derived at read time in api/cases.js, so no DB change is
// needed for the Equine count (1 -> 2).

const REACTIVATE = [13, 22, 23, 24, 25, 27, 30, 31, 32, 33, 35];

const TIMELINE_EVENT = {
  date: '2026-09-17',
  event:
    'Case 51: horse in Grant County, NM — second equine case; second New Mexico county affected; US total reaches 50 with 14 active cases',
};

try {
  const before = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM screwworm_cases`;
  console.log(`Before: ${before[0].total} total, ${before[0].active} active`);

  const beforeActive = await sql`SELECT id, date, county, animal FROM screwworm_cases WHERE status = 'active' ORDER BY id`;
  console.log('Active before:', JSON.stringify(beforeActive));

  // --- 1. Insert case 51 ---
  const existing51 = await sql`SELECT id FROM screwworm_cases WHERE id = 51`;
  if (existing51.length > 0) {
    console.log('Case 51 already exists — skipping insert');
  } else {
    await sql`
      INSERT INTO screwworm_cases (id, date, species, animal, county, state, lat, lng, status, notes)
      VALUES (51, '2026-09-17', 'Equine', 'Horse', 'Grant', 'NM', 32.7299, -108.2803, 'active',
              'First Grant County case; second New Mexico county affected; second equine (horse) detection of the US outbreak; domestic animal')
    `;
    console.log('Case 51 inserted (Grant County NM horse, Sep 17, active)');
  }

  // --- 2. Reactivate the eleven Crockett County cases ---
  for (const id of REACTIVATE) {
    const rows = await sql`
      UPDATE screwworm_cases SET status = 'active'
      WHERE id = ${id} AND county = 'Crockett'
      RETURNING id, status
    `;
    if (rows.length === 0) {
      console.log(`✗ Case #${id} not found or not in Crockett County`);
      process.exit(1);
    }
    console.log(`Case #${id} → active`);
  }

  // --- 3. Timeline event ---
  const metaRows = await sql`SELECT value FROM screwworm_metadata WHERE key = 'internationalContext'`;
  if (metaRows.length === 0) {
    console.log('✗ internationalContext metadata row missing');
    process.exit(1);
  }
  const intl = typeof metaRows[0].value === 'string' ? JSON.parse(metaRows[0].value) : metaRows[0].value;
  intl.timeline = intl.timeline || [];
  if (intl.timeline.some(e => e.date === TIMELINE_EVENT.date)) {
    console.log(`Timeline already has a ${TIMELINE_EVENT.date} entry — skipping`);
  } else {
    intl.timeline.push(TIMELINE_EVENT);
    intl.timeline.sort((a, b) => a.date.localeCompare(b.date));
    await sql`UPDATE screwworm_metadata SET value = ${JSON.stringify(intl)} WHERE key = 'internationalContext'`;
    console.log(`Timeline event added for ${TIMELINE_EVENT.date}`);
  }

  // --- 4. Timestamps ---
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify('2026-09-19T00:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastChecked', ${JSON.stringify('2026-09-19T09:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log('Updated timestamps to lastUpdated=2026-09-19');

  // --- Verify ---
  const after = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM screwworm_cases`;
  console.log(`\nAfter: ${after[0].total} total, ${after[0].active} active`);

  if (Number(after[0].total) !== 50 || Number(after[0].active) !== 14) {
    console.log(`✗ Mismatch! Expected 50 total, 14 active — got ${after[0].total} total, ${after[0].active} active`);
    process.exit(1);
  }
  console.log('✓ Counts match APHIS (50 total, 14 active)');

  const bySpecies = await sql`SELECT species, COUNT(*) as count FROM screwworm_cases GROUP BY 1 ORDER BY 1`;
  console.log('By species:', JSON.stringify(bySpecies));

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
