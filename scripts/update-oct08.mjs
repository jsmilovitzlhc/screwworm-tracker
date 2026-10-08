import { neon } from '@neondatabase/serverless';
import { readFileSync, writeFileSync } from 'fs';

const envFile = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}

const sql = neon(process.env.DATABASE_URL);

// APHIS dashboard sync (data as of Oct 7-8, 2026) — 52 domestic animal cases / 2 active / 50 inactive.
//
// NO new cases this sync. This is a STATUS-ONLY transition: case #51 (Grant County, NM horse,
// confirmed Sep 17) moves active -> inactive. Total stays 52; active 3 -> 2; inactive 49 -> 50.
//
// WHICH case flipped — the APHIS CSV only publishes per-MONTH aggregates, never per-case status,
// so the month deltas alone cannot name the case. Three independent lines of evidence converge
// on #51:
//
//  1. APHIS public Tableau export (publicdashboards.dl.usda.gov/t/MRP_PUB/views/
//     NewWorldScrewwormPublicReporting_17805168329840/SummaryDashboard.csv), fetched this sync:
//       July 2026:      14 domestic / 14 total,  0 active, 14 inactive
//       August 2026:     4 domestic /  4 total,  0 active,  4 inactive
//       September 2026:  3 domestic /  4 total,  1 active,  2 inactive   <-- was 2 active / 1 inactive on Oct 6
//       October 2026:    1 domestic /  1 total,  1 active,  0 inactive
//     September is the only month that moved, so the flip is a September case. The tracker's
//     three September cases are #50 (Sep 9 Presidio horse, already inactive since the Oct 1
//     transition), #51 and #52 — so it is #51 or #52. October still reads 1 active / 0 inactive,
//     which independently confirms #53 (Oct 2 Brewster dog) is untouched.
//
//  2. GenomicEpi's per-case tracker (genomicepi.com/outbreaks/new-world-screwworm/) names it
//     directly: Sep 17 Grant County NM horse = INACTIVE, Sep 26 Crockett goat = ACTIVE,
//     Oct 2 Brewster dog = ACTIVE, totals 52 / 2 active / 50 inactive. This is the only source
//     found that resolves status at case granularity, and it agrees with the CSV aggregate.
//
//  3. Resolution-window precedent. Reconstructing every prior active->inactive transition from
//     this repo's own git history of src/data/cases.json gives a tight mode at 20-22 days from
//     confirmation (#49 = 20d, #50 = 21d, #46 = 22d, and #3/#6/#20/#28/#38/#39/#42 all exactly
//     21d). #51 was confirmed Sep 17, which is exactly 21 days before Oct 8. #52 was confirmed
//     Sep 26 — only 12 days, well short of any observed resolution in the maintained period.
//
// Houston Public Media (Oct 4) still listed all three as active, which dates the transition to
// the Oct 6-8 window and is consistent with APHIS's stated Tuesday/Thursday 5 p.m. ET refresh.
//
// CAVEAT on the export (carried forward from the Sep 30 / Oct 2 / Oct 6 syncs): the CSV's month
// window has scrolled forward and June 2026 (30 total / 0 active / 30 inactive) is no longer
// emitted. June is asserted below from the tracker's own previously-verified state, not from
// this fetch. The arithmetic reconciles to the dashboard headline:
//   30 + 14 + 4 + 3 + 1 = 52 domestic; actives are Sept 1 + Oct 1 = 2 => 50 inactive.
//
// The 53-vs-52 reconciliation from the Oct 6 sync still holds: APHIS's "53 total" headline is
// 52 domestic animal cases + the Sep 25 Brewster County wild fly-trap detection (visible above
// as September's total 4 exceeding domestic 3). The fly trap stays a timeline note, not a case
// row, to preserve domestic-count parity.
//
// speciesBreakdown is intentionally NOT recomputed: an active->inactive status change does not
// move any animal between species. It is re-verified against the case rows at the end anyway.

const JSON_PATH = '/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/src/data/cases.json';

// The status transition this sync applies.
const TO_INACTIVE = {
  id: 51,
  county: 'Grant',
  state: 'NM',
  animal: 'Horse',
  date: '2026-09-17',
};

const EXPECTED_ACTIVE_BEFORE = [51, 52, 53];
const EXPECTED_ACTIVE_AFTER = [52, 53];

// Post-update per-month truth. July/Aug/Sept/Oct from this sync's CSV fetch;
// June carried forward (see CAVEAT above).
const APHIS_BY_MONTH = {
  '2026-06': { total: 30, active: 0, inactive: 30 },
  '2026-07': { total: 14, active: 0, inactive: 14 },
  '2026-08': { total: 4, active: 0, inactive: 4 },
  '2026-09': { total: 3, active: 1, inactive: 2 },
  '2026-10': { total: 1, active: 1, inactive: 0 },
};

const TIMELINE_ENTRIES = [
  {
    date: '2026-10-08',
    event: 'Case 51 (Grant County, NM horse, confirmed Sep 17) moved to inactive per the APHIS '
      + 'dashboard — 21 days after confirmation, matching the outbreak\'s typical resolution '
      + 'window. No new domestic cases; US total holds at 52 domestic animal cases with 2 active '
      + '(52 Crockett goat, 53 Brewster dog). New Mexico has no active cases for the first time '
      + 'since the Grant County detection',
  },
];

const LAST_UPDATED = '2026-10-08T00:00:00Z';
const LAST_CHECKED = '2026-10-08T09:45:00Z';

function mergeTimeline(base) {
  const out = base.map(e => ({ ...e }));
  for (const entry of TIMELINE_ENTRIES) {
    if (out.some(e => e.date === entry.date && e.event.slice(0, 20) === entry.event.slice(0, 20))) {
      console.log(`Timeline already has a ${entry.date} entry — left as is`);
    } else {
      out.push({ ...entry });
      console.log(`Timeline entry added for ${entry.date}`);
    }
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

try {
  const before = await sql`
    SELECT COUNT(*) AS "total",
           COUNT(*) FILTER (WHERE status = 'active') AS "active",
           COUNT(*) FILTER (WHERE status = 'inactive') AS "inactive"
    FROM screwworm_cases
  `;
  console.log(`Before: ${before[0].total} total, ${before[0].active} active, ${before[0].inactive} inactive`);
  if (Number(before[0].total) !== 52 || Number(before[0].active) !== 3) {
    console.log('✗ Unexpected starting state (wanted 52 total / 3 active)');
    process.exit(1);
  }

  const activeBefore = (await sql`SELECT id FROM screwworm_cases WHERE status = 'active' ORDER BY id`).map(r => r.id);
  if (JSON.stringify(activeBefore) !== JSON.stringify(EXPECTED_ACTIVE_BEFORE)) {
    console.log(`✗ Active ids before ${JSON.stringify(activeBefore)} != expected ${JSON.stringify(EXPECTED_ACTIVE_BEFORE)}`);
    process.exit(1);
  }

  // --- 1. Verify #51 is the row we think it is before touching its status ---
  const target = await sql`SELECT id, date, county, state, animal, status FROM screwworm_cases WHERE id = ${TO_INACTIVE.id}`;
  if (target.length === 0) {
    console.log(`✗ Case #${TO_INACTIVE.id} not found`);
    process.exit(1);
  }
  const t = target[0];
  const tDate = new Date(t.date).toISOString().slice(0, 10);
  if (t.county !== TO_INACTIVE.county || t.state !== TO_INACTIVE.state
      || t.animal !== TO_INACTIVE.animal || tDate !== TO_INACTIVE.date) {
    console.log(`✗ Case #${TO_INACTIVE.id} is ${t.animal} in ${t.county}, ${t.state} on ${tDate} — `
      + `expected ${TO_INACTIVE.animal} in ${TO_INACTIVE.county}, ${TO_INACTIVE.state} on ${TO_INACTIVE.date}`);
    process.exit(1);
  }
  if (t.status !== 'active') {
    console.log(`Case #${TO_INACTIVE.id} already ${t.status} — nothing to transition`);
  }
  console.log(`✓ Case #${TO_INACTIVE.id} identity confirmed: ${t.animal} in ${t.county}, ${t.state} (${tDate}), currently ${t.status}`);

  // --- 2. Apply the status transition ---
  const updated = await sql`
    UPDATE screwworm_cases SET status = 'inactive'
    WHERE id = ${TO_INACTIVE.id}
    RETURNING id, date, county, state, animal, status
  `;
  console.log('Transitioned:', JSON.stringify(updated[0]));

  // --- 3. Cases #52 and #53 must remain active and untouched ---
  for (const id of EXPECTED_ACTIVE_AFTER) {
    const row = (await sql`SELECT id, county, animal, status FROM screwworm_cases WHERE id = ${id}`)[0];
    if (!row || row.status !== 'active') {
      console.log(`✗ Case #${id} is ${row ? row.status : 'missing'} — expected active`);
      process.exit(1);
    }
    console.log(`✓ Case #${id} (${row.county} ${row.animal}) still active`);
  }

  // --- 4. Timeline ---
  const ctxRows = await sql`SELECT value FROM screwworm_metadata WHERE key = 'internationalContext'`;
  if (ctxRows.length === 0) {
    console.log('✗ internationalContext metadata row missing');
    process.exit(1);
  }
  const ctx = typeof ctxRows[0].value === 'string' ? JSON.parse(ctxRows[0].value) : ctxRows[0].value;

  const json = JSON.parse(readFileSync(JSON_PATH, 'utf-8'));

  // Guard the DB/fallback timeline drift that the Oct 6 sync repaired — if the DB has dates the
  // JSON lacks, writing the JSON-derived union back would silently drop them.
  const dbDates = new Set((ctx.timeline || []).map(e => e.date));
  const jsonDates = new Set(json.internationalContext.timeline.map(e => e.date));
  const dbOnly = [...dbDates].filter(d => !jsonDates.has(d));
  if (dbOnly.length > 0) {
    console.log(`✗ DB timeline has dates absent from JSON (would be lost): ${JSON.stringify(dbOnly)}`);
    process.exit(1);
  }
  if ((ctx.timeline || []).length !== json.internationalContext.timeline.length) {
    console.log(`✗ Timeline length drift: DB ${(ctx.timeline || []).length} vs JSON ${json.internationalContext.timeline.length}`);
    process.exit(1);
  }

  const mergedTimeline = mergeTimeline(json.internationalContext.timeline);
  console.log(`Timeline: ${json.internationalContext.timeline.length} -> ${mergedTimeline.length}`);
  ctx.timeline = mergedTimeline;

  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('internationalContext', ${JSON.stringify(ctx)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;

  // --- 5. Timestamps ---
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify(LAST_UPDATED)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastChecked', ${JSON.stringify(LAST_CHECKED)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log(`Updated timestamps to lastUpdated=${LAST_UPDATED}`);

  // --- 6. Mirror everything into the static fallback ---
  const jsonTarget = json.confirmedCases.find(c => c.id === TO_INACTIVE.id);
  if (!jsonTarget) {
    console.log(`✗ Case #${TO_INACTIVE.id} missing from fallback JSON`);
    process.exit(1);
  }
  jsonTarget.status = 'inactive';
  json.internationalContext.timeline = mergedTimeline;
  json.lastUpdated = LAST_UPDATED;
  json.lastChecked = LAST_CHECKED;
  writeFileSync(JSON_PATH, `${JSON.stringify(json, null, 2)}\n`);
  console.log(`Wrote fallback: ${json.confirmedCases.length} cases, ${json.internationalContext.timeline.length} timeline entries`);

  // --- Verify against APHIS ---
  const after = await sql`
    SELECT COUNT(*) AS "total",
           COUNT(*) FILTER (WHERE status = 'active') AS "active",
           COUNT(*) FILTER (WHERE status = 'inactive') AS "inactive"
    FROM screwworm_cases
  `;
  console.log(`\nAfter: ${after[0].total} total, ${after[0].active} active, ${after[0].inactive} inactive`);
  if (Number(after[0].total) !== 52 || Number(after[0].active) !== 2 || Number(after[0].inactive) !== 50) {
    console.log(`✗ Mismatch! Expected 52 / 2 / 50 — got ${after[0].total} / ${after[0].active} / ${after[0].inactive}`);
    process.exit(1);
  }
  console.log('✓ Counts match APHIS (52 domestic, 2 active, 50 inactive; 53 total incl. fly trap)');

  const activeRows = await sql`SELECT id, date, county, state, animal FROM screwworm_cases WHERE status = 'active' ORDER BY id`;
  const activeIds = activeRows.map(r => r.id);
  if (JSON.stringify(activeIds) !== JSON.stringify(EXPECTED_ACTIVE_AFTER)) {
    console.log(`✗ Active ids ${JSON.stringify(activeIds)} != expected ${JSON.stringify(EXPECTED_ACTIVE_AFTER)}`);
    process.exit(1);
  }
  console.log('Active cases:', JSON.stringify(activeRows));

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

  // Species breakdown must still agree with the actual case rows (status change must not move it).
  const SPECIES_LABEL = {
    Bovine: 'Bovine (Cattle)',
    Canine: 'Canine (Dogs)',
    Caprine: 'Caprine (Goats)',
    Equine: 'Equine (Horses)',
    Ovine: 'Ovine (Sheep)',
  };
  const breakdownRows = await sql`SELECT value FROM screwworm_metadata WHERE key = 'speciesBreakdown'`;
  const breakdown = typeof breakdownRows[0].value === 'string' ? JSON.parse(breakdownRows[0].value) : breakdownRows[0].value;
  const breakdownTotal = breakdown.reduce((s, b) => s + b.count, 0);
  if (breakdownTotal !== 52) {
    console.log(`✗ speciesBreakdown sums to ${breakdownTotal}, expected 52`);
    process.exit(1);
  }
  const bySpecies = await sql`SELECT species, COUNT(*) AS "count" FROM screwworm_cases GROUP BY 1 ORDER BY 1`;
  for (const row of bySpecies) {
    const want = breakdown.find(s => s.species === SPECIES_LABEL[row.species]);
    if (!want) {
      console.log(`✗ Species ${row.species} has no breakdown entry`);
      process.exit(1);
    }
    if (Number(row.count) !== want.count) {
      console.log(`✗ ${row.species}: ${row.count} rows != breakdown ${want.count}`);
      process.exit(1);
    }
    console.log(`✓ ${want.species}: ${want.count} (${want.percentage}%)`);
  }

  // Fallback JSON must agree with the DB on ids AND on status.
  const dbRows = await sql`SELECT id, status FROM screwworm_cases ORDER BY id`;
  const dbIds = dbRows.map(r => r.id);
  const jsonIds = [...json.confirmedCases.map(c => c.id)].sort((a, b) => a - b);
  if (JSON.stringify(dbIds) !== JSON.stringify(jsonIds)) {
    console.log('✗ Fallback JSON ids diverge from DB ids');
    process.exit(1);
  }
  const statusDrift = dbRows.filter(r => json.confirmedCases.find(c => c.id === r.id).status !== r.status);
  if (statusDrift.length > 0) {
    console.log(`✗ Fallback JSON status diverges from DB for ids: ${JSON.stringify(statusDrift.map(r => r.id))}`);
    process.exit(1);
  }
  console.log(`✓ Fallback JSON in parity with DB (${jsonIds.length} cases, all statuses match, ${mergedTimeline.length} timeline entries)`);

  console.log('\nDone!');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
