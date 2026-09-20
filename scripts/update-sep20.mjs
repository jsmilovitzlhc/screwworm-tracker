import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const envFile = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}

const sql = neon(process.env.DATABASE_URL);

// APHIS dashboard sync (data as of Sep 19, 2026) — 50 total / 3 active / 47 inactive.
//
// Corrects the Sep 19 sync, which reclassified eleven June/July Crockett County
// cases as active. The APHIS public Tableau export
// (publicdashboards.dl.usda.gov .../NewWorldScrewwormPublicReporting .../SummaryDashboard.csv)
// reports per-month active/inactive as:
//   June 2026:      30 total,  0 active, 30 inactive
//   July 2026:      14 total,  0 active, 14 inactive
//   August 2026:     4 total,  1 active,  3 inactive
//   September 2026:  2 total,  2 active,  0 inactive
// => 50 total / 3 active / 47 inactive.
//
// The tracker's monthly totals already match APHIS exactly; only the June and
// July active flags are wrong (8 active in June, 3 in July). Reverting those
// eleven leaves the three most recent detections active, matching APHIS:
//   49 (Aug 31, Crockett dog), 50 (Sep 9, Presidio horse), 51 (Sep 17, Grant NM horse).

const DEACTIVATE = [13, 22, 23, 24, 25, 27, 30, 31, 32, 33, 35];
const EXPECTED_ACTIVE = [49, 50, 51];

// APHIS per-month truth, used as a post-update assertion.
const APHIS_BY_MONTH = {
  '2026-06': { total: 30, active: 0, inactive: 30 },
  '2026-07': { total: 14, active: 0, inactive: 14 },
  '2026-08': { total: 4, active: 1, inactive: 3 },
  '2026-09': { total: 2, active: 2, inactive: 0 },
};

// The Sep 19 sync recorded "14 active cases" in this timeline entry.
const TIMELINE_FIX = {
  date: '2026-09-17',
  event:
    'Case 51: horse in Grant County, NM — second equine case; second New Mexico county affected; US total reaches 50 with 3 active cases (49 Crockett dog, 50 Presidio horse, 51 Grant NM horse)',
};

try {
  const before = await sql`SELECT COUNT(*) AS "total", COUNT(*) FILTER (WHERE status = 'active') AS "active" FROM screwworm_cases`;
  console.log(`Before: ${before[0].total} total, ${before[0].active} active`);

  // --- 1. Revert the eleven June/July Crockett cases to inactive ---
  for (const id of DEACTIVATE) {
    const rows = await sql`
      UPDATE screwworm_cases SET status = 'inactive'
      WHERE id = ${id} AND county = 'Crockett' AND date < '2026-08-01'
      RETURNING id, status
    `;
    if (rows.length === 0) {
      console.log(`✗ Case #${id} not found, not Crockett County, or not a June/July case`);
      process.exit(1);
    }
    console.log(`Case #${id} → inactive`);
  }

  // --- 2. Correct the Sep 17 timeline entry ("14 active" → "3 active") ---
  const metaRows = await sql`SELECT value FROM screwworm_metadata WHERE key = 'internationalContext'`;
  if (metaRows.length === 0) {
    console.log('✗ internationalContext metadata row missing');
    process.exit(1);
  }
  const intl = typeof metaRows[0].value === 'string' ? JSON.parse(metaRows[0].value) : metaRows[0].value;
  intl.timeline = intl.timeline || [];
  const idx = intl.timeline.findIndex(e => e.date === TIMELINE_FIX.date);
  if (idx === -1) {
    console.log(`✗ No timeline entry for ${TIMELINE_FIX.date}`);
    process.exit(1);
  }
  intl.timeline[idx] = TIMELINE_FIX;
  await sql`UPDATE screwworm_metadata SET value = ${JSON.stringify(intl)} WHERE key = 'internationalContext'`;
  console.log(`Timeline entry for ${TIMELINE_FIX.date} corrected to 3 active`);

  // --- 3. Timestamps ---
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify('2026-09-20T00:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastChecked', ${JSON.stringify('2026-09-20T09:30:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log('Updated timestamps to lastUpdated=2026-09-20');

  // --- Verify against APHIS ---
  const after = await sql`SELECT COUNT(*) AS "total", COUNT(*) FILTER (WHERE status = 'active') AS "active" FROM screwworm_cases`;
  console.log(`\nAfter: ${after[0].total} total, ${after[0].active} active`);

  if (Number(after[0].total) !== 50 || Number(after[0].active) !== 3) {
    console.log(`✗ Mismatch! Expected 50 total, 3 active — got ${after[0].total} total, ${after[0].active} active`);
    process.exit(1);
  }
  console.log('✓ Counts match APHIS (50 total, 3 active, 47 inactive)');

  const activeRows = await sql`SELECT id, date, county, state, animal FROM screwworm_cases WHERE status = 'active' ORDER BY id`;
  const activeIds = activeRows.map(r => r.id);
  if (JSON.stringify(activeIds) !== JSON.stringify(EXPECTED_ACTIVE)) {
    console.log(`✗ Active ids ${JSON.stringify(activeIds)} != expected ${JSON.stringify(EXPECTED_ACTIVE)}`);
    process.exit(1);
  }
  console.log('Active cases:', JSON.stringify(activeRows));

  const byMonth = await sql`
    SELECT to_char(date, 'YYYY-MM') AS "month",
           COUNT(*) AS "total",
           COUNT(*) FILTER (WHERE status = 'active') AS "active",
           COUNT(*) FILTER (WHERE status = 'inactive') AS "inactive"
    FROM screwworm_cases GROUP BY 1 ORDER BY 1
  `;
  for (const row of byMonth) {
    const want = APHIS_BY_MONTH[row.month];
    if (!want) {
      console.log(`✗ Unexpected month ${row.month} in tracker but not in APHIS export`);
      process.exit(1);
    }
    if (Number(row.total) !== want.total || Number(row.active) !== want.active || Number(row.inactive) !== want.inactive) {
      console.log(`✗ ${row.month}: tracker ${row.total}/${row.active}/${row.inactive} != APHIS ${want.total}/${want.active}/${want.inactive}`);
      process.exit(1);
    }
    console.log(`✓ ${row.month}: ${row.total} total, ${row.active} active, ${row.inactive} inactive`);
  }
  if (byMonth.length !== Object.keys(APHIS_BY_MONTH).length) {
    console.log('✗ Month count mismatch vs APHIS export');
    process.exit(1);
  }

  console.log('\nDone!');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
