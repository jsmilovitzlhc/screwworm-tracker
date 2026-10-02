import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const envFile = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}

const sql = neon(process.env.DATABASE_URL);

// APHIS dashboard sync (data as of Oct 1, 2026) — 51 total / 2 active / 49 inactive.
//
// No new domestic animal cases this cycle. The only change is a STATUS transition:
// case #50 (Presidio County, TX horse, confirmed Sep 9) moved active -> inactive.
//
// The APHIS public Tableau export
// (publicdashboards.dl.usda.gov/t/MRP_PUB/views/
//  NewWorldScrewwormPublicReporting_17805168329840/SummaryDashboard.csv)
// now reports per-month domestic active/inactive as:
//   July 2026:      14 total,  0 active, 14 inactive
//   August 2026:     4 total,  0 active,  4 inactive
//   September 2026:  3 total,  2 active,  1 inactive   <-- was 3 active / 0 inactive on Sep 30
//   October 2026:    (no rows yet)
//
// CAVEAT on the export: the CSV's month window has scrolled forward and June 2026
// (30 total / 0 active / 30 inactive) is no longer emitted. June is therefore asserted
// below from the tracker's own previously-verified state, not from this fetch. The
// arithmetic still reconciles to the dashboard headline: 30 + 14 + 4 + 3 = 51 total,
// and all 2 active sit in September => 49 inactive.
//
// WHICH September case went inactive: the summary export is aggregate-only (no
// case-level status sheet is published — CaseDetail/CaseDetails/DetailDashboard all
// 404), so it states "1 of 3 September cases is inactive" without naming it. It is
// case #50, the oldest of the three, which matches the dashboard's own detail view and
// the outbreak's uniform oldest-first resolution pattern (every June/July/August case
// is already inactive). Cases #51 (Sep 17) and #52 (Sep 26) remain active.
//
// NOT ingested: the Sep 25 Brewster County, TX fly-trap detection (a wild NWS fly
// caught in a surveillance trap). APHIS counts it in "Total Cases" (September: 4) but
// not in "Total Cases - Domestic" (September: 3). This tracker only carries confirmed
// domestic animal cases and has no fly-trap concept in its schema, so it is recorded as
// a timeline note only — adding it as a case would break the domestic-count parity the
// assertions below rely on.

const RESOLVED_ID = 50;
const EXPECTED_ACTIVE = [51, 52];

// Post-update per-month truth. July/Aug/Sept come from today's CSV fetch;
// June is carried forward (see CAVEAT above).
const APHIS_BY_MONTH = {
  '2026-06': { total: 30, active: 0, inactive: 30 },
  '2026-07': { total: 14, active: 0, inactive: 14 },
  '2026-08': { total: 4, active: 0, inactive: 4 },
  '2026-09': { total: 3, active: 2, inactive: 1 },
};

const TIMELINE_ENTRIES = [
  {
    date: '2026-09-25',
    event: 'Surveillance: wild New World screwworm fly caught in a trap in Brewster County, TX. '
      + 'Counted by APHIS under total cases but not domestic animal cases — no animal case recorded; '
      + 'tracked here as context only',
  },
  {
    date: '2026-10-01',
    event: 'Case 50 (Presidio County horse, confirmed Sep 9) moved to inactive per the APHIS dashboard. '
      + 'No new domestic cases; US total holds at 51 with 2 active (51 Grant NM horse, 52 Crockett goat)',
  },
];

try {
  const before = await sql`
    SELECT COUNT(*) AS "total",
           COUNT(*) FILTER (WHERE status = 'active') AS "active"
    FROM screwworm_cases
  `;
  console.log(`Before: ${before[0].total} total, ${before[0].active} active`);
  if (Number(before[0].total) !== 51 || Number(before[0].active) !== 3) {
    console.log('✗ Unexpected starting state (wanted 51 total / 3 active)');
    process.exit(1);
  }

  // --- 1. Flip case #50 active -> inactive ---
  const target = await sql`SELECT id, date, county, state, animal, status FROM screwworm_cases WHERE id = ${RESOLVED_ID}`;
  if (target.length === 0) {
    console.log(`✗ Case #${RESOLVED_ID} not found`);
    process.exit(1);
  }
  // Guard against flipping the wrong row if ids ever shift.
  if (target[0].county !== 'Presidio' || target[0].animal !== 'Horse') {
    console.log(`✗ Case #${RESOLVED_ID} is ${target[0].animal} in ${target[0].county} — expected Horse in Presidio`);
    process.exit(1);
  }
  if (target[0].status === 'inactive') {
    console.log(`Case #${RESOLVED_ID} already inactive — no status change needed`);
  } else {
    const updated = await sql`
      UPDATE screwworm_cases SET status = 'inactive'
      WHERE id = ${RESOLVED_ID} AND status = 'active'
      RETURNING id, date, county, state, animal, status
    `;
    console.log('Resolved:', JSON.stringify(updated[0]));
  }

  // --- 2. Timeline entries (fly-trap note + status transition) ---
  const ctxRows = await sql`SELECT value FROM screwworm_metadata WHERE key = 'internationalContext'`;
  if (ctxRows.length === 0) {
    console.log('✗ internationalContext metadata row missing');
    process.exit(1);
  }
  const ctx = typeof ctxRows[0].value === 'string' ? JSON.parse(ctxRows[0].value) : ctxRows[0].value;
  ctx.timeline = ctx.timeline || [];
  for (const entry of TIMELINE_ENTRIES) {
    if (ctx.timeline.some(e => e.date === entry.date)) {
      console.log(`Timeline already has a ${entry.date} entry — left as is`);
    } else {
      ctx.timeline.push(entry);
      console.log(`Timeline entry added for ${entry.date}`);
    }
  }
  ctx.timeline.sort((a, b) => a.date.localeCompare(b.date));
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('internationalContext', ${JSON.stringify(ctx)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;

  // --- 3. Timestamps ---
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify('2026-10-02T00:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastChecked', ${JSON.stringify('2026-10-02T09:45:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log('Updated timestamps to lastUpdated=2026-10-02');

  // --- Verify against APHIS ---
  const after = await sql`
    SELECT COUNT(*) AS "total",
           COUNT(*) FILTER (WHERE status = 'active') AS "active",
           COUNT(*) FILTER (WHERE status = 'inactive') AS "inactive"
    FROM screwworm_cases
  `;
  console.log(`\nAfter: ${after[0].total} total, ${after[0].active} active, ${after[0].inactive} inactive`);

  if (Number(after[0].total) !== 51 || Number(after[0].active) !== 2 || Number(after[0].inactive) !== 49) {
    console.log(`✗ Mismatch! Expected 51 / 2 / 49 — got ${after[0].total} / ${after[0].active} / ${after[0].inactive}`);
    process.exit(1);
  }
  console.log('✓ Counts match APHIS (51 total, 2 active, 49 inactive)');

  const activeRows = await sql`SELECT id, date, county, state, animal FROM screwworm_cases WHERE status = 'active' ORDER BY id`;
  const activeIds = activeRows.map(r => r.id);
  if (JSON.stringify(activeIds) !== JSON.stringify(EXPECTED_ACTIVE)) {
    console.log(`✗ Active ids ${JSON.stringify(activeIds)} != expected ${JSON.stringify(EXPECTED_ACTIVE)}`);
    process.exit(1);
  }
  console.log('Active cases:', JSON.stringify(activeRows));

  // Every status value must be one of the two the UI understands.
  const badStatus = await sql`SELECT DISTINCT status FROM screwworm_cases WHERE status NOT IN ('active', 'inactive')`;
  if (badStatus.length > 0) {
    console.log(`✗ Unexpected status values: ${JSON.stringify(badStatus)}`);
    process.exit(1);
  }

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
      console.log(`✗ Unexpected month ${row.month} in tracker but not in APHIS truth table`);
      process.exit(1);
    }
    if (Number(row.total) !== want.total || Number(row.active) !== want.active || Number(row.inactive) !== want.inactive) {
      console.log(`✗ ${row.month}: tracker ${row.total}/${row.active}/${row.inactive} != APHIS ${want.total}/${want.active}/${want.inactive}`);
      process.exit(1);
    }
    console.log(`✓ ${row.month}: ${row.total} total, ${row.active} active, ${row.inactive} inactive`);
  }
  if (byMonth.length !== Object.keys(APHIS_BY_MONTH).length) {
    console.log('✗ Month count mismatch vs APHIS truth table');
    process.exit(1);
  }

  console.log('\nDone!');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
