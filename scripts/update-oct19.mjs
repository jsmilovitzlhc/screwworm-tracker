import { neon } from '@neondatabase/serverless';
import { readFileSync, writeFileSync } from 'fs';

const envFile = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}

const sql = neon(process.env.DATABASE_URL);

// APHIS dashboard sync (data as of Oct 15, 2026) — 55 domestic animal cases / 4 active / 51 inactive.
//
// THREE new domestic cases plus one status transition. Both halves are confirmed by two
// independent sources fetched this sync.
//
//  1. APHIS public Tableau export (publicdashboards.dl.usda.gov/t/MRP_PUB/views/
//     NewWorldScrewwormPublicReporting_17805168329840/SummaryDashboard.csv):
//       July 2026:      14 domestic / 14 total,  0 active, 14 inactive
//       August 2026:     4 domestic /  4 total,  0 active,  4 inactive
//       September 2026:  3 domestic /  4 total,  0 active,  3 inactive   <-- was 1 active / 2 inactive Oct 8
//       October 2026:    4 domestic /  4 total,  4 active,  0 inactive   <-- was 1 domestic / 1 active Oct 8
//     October gains 3 domestic cases, all active. September drops to 0 active.
//
//     WHICH September case flipped is NOT an inference this time: the tracker had exactly one
//     active September case left (#52, Crockett County goat, Sep 26 — #50 and #51 went inactive
//     in the Oct 1 and Oct 8 transitions). September moving 1 active -> 0 active can only be #52.
//
//  2. GenomicEpi's per-case line list (genomicepi.com/outbreaks/new-world-screwworm/), which
//     resolves status and location at case granularity, names all four changes directly:
//       Oct 15, 2026  New Mexico  Grant    Domestic  Cattle  Active
//       Oct 15, 2026  New Mexico  Grant    Domestic  Horse   Active
//       Oct 10, 2026  Texas       Pecos    Domestic  Cattle  Active
//       Sep 26, 2026  Texas       Crockett Domestic  Goats   INACTIVE
//     and its headline reads 55 animal cases / 4 active, 19 counties / 2 states, 55 domestic /
//     0 wildlife, 1 fly trap, latest confirmation Oct 15. Its species totals are Cattle 24,
//     Sheep 16, Goats 7, Dogs 5, Horse 3 — which is this tracker's breakdown plus the two new
//     cattle and one new horse.
//
// CAVEAT on the export (carried forward from every sync since Sep 30): the CSV's month window
// has scrolled forward and June 2026 (30 total / 0 active / 30 inactive) is no longer emitted.
// June is asserted below from the tracker's own previously-verified state, not from this fetch.
// The arithmetic reconciles to the dashboard headline:
//   30 + 14 + 4 + 3 + 4 = 55 domestic; all 4 actives sit in October => 51 inactive.
//
// The 53-vs-52 style reconciliation still holds and is unchanged: APHIS's "total cases" exceeds
// "domestic" by exactly 1 in September because of the Sep 25 Brewster County wild fly-trap
// detection. October's total (4) equals its domestic count (4), so no new fly trap this cycle.
// The fly trap stays a timeline note, not a case row, to preserve domestic-count parity.
//
// Both new Grant County, NM cases are same-day (Oct 15) detections in a county the outbreak
// had already reached (case #51, Sep 17). No new county and no new state: county count holds
// at 19 and states at 2, matching GenomicEpi. New Mexico rises 2 -> 4 cases, 0 -> 2 active.
//
// speciesBreakdown IS recomputed this sync (unlike status-only syncs): Bovine 22 -> 24 and
// Equine 2 -> 3 against a new total of 55. Note /api/cases derives speciesBreakdown from the
// case rows at request time, so the metadata row and the fallback JSON must both be written to
// agree with what the API will compute, or the DB-backed and fallback renders will disagree.

const JSON_PATH = '/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/src/data/cases.json';

const NEW_CASES = [
  {
    id: 54,
    date: '2026-10-10',
    species: 'Bovine',
    animal: 'Cattle',
    county: 'Pecos',
    state: 'TX',
    lat: 30.8944,
    lng: -103.4882,
    status: 'active',
    notes: 'Fifth Pecos County case and the first bovine (cattle) detection in Pecos County; '
      + 'domestic animal; confirmed per APHIS dashboard (October 2026: 4 domestic cases, 4 active)',
  },
  {
    id: 55,
    date: '2026-10-15',
    species: 'Bovine',
    animal: 'Cattle',
    county: 'Grant',
    state: 'NM',
    lat: 32.7349,
    lng: -108.2753,
    status: 'active',
    notes: 'Second Grant County case; first bovine (cattle) detection in New Mexico; domestic '
      + 'animal; confirmed per APHIS dashboard Oct 15 alongside case 56 in the same county',
  },
  {
    id: 56,
    date: '2026-10-15',
    species: 'Equine',
    animal: 'Horse',
    county: 'Grant',
    state: 'NM',
    lat: 32.7399,
    lng: -108.2903,
    status: 'active',
    notes: 'Third Grant County case; third equine (horse) detection of the US outbreak and the '
      + 'second in New Mexico; domestic animal; same-day Grant County detection with case 55',
  },
];

// The status transition this sync applies.
const TO_INACTIVE = {
  id: 52,
  county: 'Crockett',
  state: 'TX',
  animal: 'Goat',
  date: '2026-09-26',
};

const EXPECTED_ACTIVE_BEFORE = [52, 53];
const EXPECTED_ACTIVE_AFTER = [53, 54, 55, 56];

const EXPECTED_TOTAL_BEFORE = 52;
const EXPECTED_TOTAL_AFTER = 55;
const EXPECTED_INACTIVE_AFTER = 51;

// Post-update per-month truth. July/Aug/Sept/Oct from this sync's CSV fetch;
// June carried forward (see CAVEAT above).
const APHIS_BY_MONTH = {
  '2026-06': { total: 30, active: 0, inactive: 30 },
  '2026-07': { total: 14, active: 0, inactive: 14 },
  '2026-08': { total: 4, active: 0, inactive: 4 },
  '2026-09': { total: 3, active: 0, inactive: 3 },
  '2026-10': { total: 4, active: 4, inactive: 0 },
};

// GenomicEpi per-species line-list totals as of Oct 15, 2026.
const APHIS_BY_SPECIES = {
  Bovine: 24,
  Ovine: 16,
  Caprine: 7,
  Canine: 5,
  Equine: 3,
};

const SPECIES_LABEL = {
  Bovine: 'Bovine (Cattle)',
  Canine: 'Canine (Dogs)',
  Caprine: 'Caprine (Goats)',
  Equine: 'Equine (Horses)',
  Ovine: 'Ovine (Sheep)',
};

const TIMELINE_ENTRIES = [
  {
    date: '2026-10-10',
    event: 'Case 54: cattle in Pecos County, TX — fifth Pecos County case and the first bovine '
      + 'detection in that county, which had previously recorded only sheep and a dog. US total '
      + 'reaches 53 domestic animal cases',
  },
  {
    date: '2026-10-15',
    event: 'Cases 55 and 56: cattle and a horse confirmed the same day in Grant County, NM — the '
      + 'first bovine case in New Mexico and the third equine detection of the US outbreak. New '
      + 'Mexico rises to 4 cases (Lea dog, Grant horse Sep 17, Grant cattle Oct 15, Grant horse '
      + 'Oct 15) with 2 active. US total reaches 55 domestic animal cases; no new county or '
      + 'state, holding at 19 counties across 2 states',
  },
  {
    date: '2026-10-19',
    event: 'Case 52 (Crockett County, TX goat, confirmed Sep 26) moved to inactive per the APHIS '
      + 'dashboard, clearing September of active cases — all 4 remaining active cases are now '
      + 'October detections (53 Brewster dog, 54 Pecos cattle, 55 Grant cattle, 56 Grant horse). '
      + 'US total stands at 55 domestic animal cases with 4 active and 51 inactive',
  },
];

const LAST_UPDATED = '2026-10-19T00:00:00Z';
const LAST_CHECKED = new Date().toISOString();

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

  // The script is re-runnable: accept either the pre-sync state (52/2) or an already-applied
  // post-sync state (55/4), and reject anything else so it cannot be pointed at unknown data.
  const activeBefore = (await sql`SELECT id FROM screwworm_cases WHERE status = 'active' ORDER BY id`).map(r => r.id);
  const isPreSync = Number(before[0].total) === EXPECTED_TOTAL_BEFORE && Number(before[0].active) === 2
    && JSON.stringify(activeBefore) === JSON.stringify(EXPECTED_ACTIVE_BEFORE);
  const isPostSync = Number(before[0].total) === EXPECTED_TOTAL_AFTER && Number(before[0].active) === 4
    && JSON.stringify(activeBefore) === JSON.stringify(EXPECTED_ACTIVE_AFTER);
  if (!isPreSync && !isPostSync) {
    console.log(`✗ Unexpected starting state: ${before[0].total} total / ${before[0].active} active, `
      + `active ids ${JSON.stringify(activeBefore)}. Wanted ${EXPECTED_TOTAL_BEFORE}/2 `
      + `${JSON.stringify(EXPECTED_ACTIVE_BEFORE)} (pre-sync) or ${EXPECTED_TOTAL_AFTER}/4 `
      + `${JSON.stringify(EXPECTED_ACTIVE_AFTER)} (already applied)`);
    process.exit(1);
  }
  if (isPostSync) console.log('Sync already applied — re-running idempotently to re-verify');

  // --- 1. Insert the three new cases (idempotent) ---
  for (const NEW_CASE of NEW_CASES) {
    const existing = await sql`SELECT id, date, county, state, animal, status FROM screwworm_cases WHERE id = ${NEW_CASE.id}`;
    if (existing.length > 0) {
      console.log(`Case #${NEW_CASE.id} already present — skipping insert: ${JSON.stringify(existing[0])}`);
      continue;
    }
    const inserted = await sql`
      INSERT INTO screwworm_cases (id, date, species, animal, county, state, lat, lng, status, notes)
      VALUES (${NEW_CASE.id}, ${NEW_CASE.date}, ${NEW_CASE.species}, ${NEW_CASE.animal},
              ${NEW_CASE.county}, ${NEW_CASE.state}, ${NEW_CASE.lat}, ${NEW_CASE.lng},
              ${NEW_CASE.status}, ${NEW_CASE.notes})
      RETURNING id, date, county, state, animal, status
    `;
    console.log('Inserted:', JSON.stringify(inserted[0]));
  }

  // --- 2. Verify #52 is the row we think it is before touching its status ---
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
  console.log(`✓ Case #${TO_INACTIVE.id} identity confirmed: ${t.animal} in ${t.county}, ${t.state} (${tDate}), currently ${t.status}`);
  if (t.status === 'inactive') {
    console.log(`Case #${TO_INACTIVE.id} already inactive — transition already applied`);
  }

  // --- 3. Apply the status transition ---
  const updated = await sql`
    UPDATE screwworm_cases SET status = 'inactive'
    WHERE id = ${TO_INACTIVE.id}
    RETURNING id, date, county, state, animal, status
  `;
  console.log('Transitioned:', JSON.stringify(updated[0]));

  // --- 4. Nothing outside the expected set may be active ---
  const stale = await sql`
    SELECT id, date, county, animal FROM screwworm_cases
    WHERE status = 'active' AND id NOT IN (53, 54, 55, 56) ORDER BY id
  `;
  if (stale.length > 0) {
    console.log(`✗ Unexpected active cases: ${JSON.stringify(stale)}`);
    process.exit(1);
  }
  for (const id of EXPECTED_ACTIVE_AFTER) {
    const row = (await sql`SELECT id, county, animal, status FROM screwworm_cases WHERE id = ${id}`)[0];
    if (!row || row.status !== 'active') {
      console.log(`✗ Case #${id} is ${row ? row.status : 'missing'} — expected active`);
      process.exit(1);
    }
    console.log(`✓ Case #${id} (${row.county} ${row.animal}) active`);
  }

  // --- 5. Recompute speciesBreakdown from the case rows, exactly as /api/cases does ---
  const bySpeciesRows = await sql`SELECT species, COUNT(*) AS "count" FROM screwworm_cases GROUP BY 1`;
  const speciesCounts = {};
  for (const row of bySpeciesRows) speciesCounts[row.species] = Number(row.count);
  for (const [species, want] of Object.entries(APHIS_BY_SPECIES)) {
    if (speciesCounts[species] !== want) {
      console.log(`✗ ${species}: tracker has ${speciesCounts[species]} rows, APHIS/GenomicEpi says ${want}`);
      process.exit(1);
    }
  }
  const speciesTotal = Object.values(speciesCounts).reduce((s, n) => s + n, 0);
  if (speciesTotal !== EXPECTED_TOTAL_AFTER) {
    console.log(`✗ Species rows sum to ${speciesTotal}, expected ${EXPECTED_TOTAL_AFTER}`);
    process.exit(1);
  }
  // Preserve the existing display order of the breakdown rather than re-sorting it.
  const breakdownRows = await sql`SELECT value FROM screwworm_metadata WHERE key = 'speciesBreakdown'`;
  const oldBreakdown = typeof breakdownRows[0].value === 'string' ? JSON.parse(breakdownRows[0].value) : breakdownRows[0].value;
  const newBreakdown = oldBreakdown.map((entry) => {
    const species = Object.keys(SPECIES_LABEL).find(k => SPECIES_LABEL[k] === entry.species);
    if (!species) {
      console.log(`✗ Breakdown entry "${entry.species}" has no known species key`);
      process.exit(1);
    }
    const count = speciesCounts[species];
    return { species: entry.species, count, percentage: Math.round((count / EXPECTED_TOTAL_AFTER) * 100) };
  });
  if (newBreakdown.length !== Object.keys(APHIS_BY_SPECIES).length) {
    console.log('✗ Breakdown is missing a species row');
    process.exit(1);
  }
  const newBreakdownTotal = newBreakdown.reduce((s, b) => s + b.count, 0);
  if (newBreakdownTotal !== EXPECTED_TOTAL_AFTER) {
    console.log(`✗ New breakdown sums to ${newBreakdownTotal}, expected ${EXPECTED_TOTAL_AFTER}`);
    process.exit(1);
  }
  console.log('speciesBreakdown:', JSON.stringify(newBreakdown));
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('speciesBreakdown', ${JSON.stringify(newBreakdown)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;

  // --- 6. Timeline ---
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

  // --- 7. Timestamps ---
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify(LAST_UPDATED)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastChecked', ${JSON.stringify(LAST_CHECKED)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log(`Updated timestamps to lastUpdated=${LAST_UPDATED}`);

  // --- 8. Mirror everything into the static fallback ---
  for (const NEW_CASE of NEW_CASES) {
    if (!json.confirmedCases.some(c => c.id === NEW_CASE.id)) {
      json.confirmedCases.push({ ...NEW_CASE });
      console.log(`Fallback: added case #${NEW_CASE.id}`);
    }
  }
  json.confirmedCases.sort((a, b) => (a.date === b.date ? a.id - b.id : a.date.localeCompare(b.date)));
  const jsonTarget = json.confirmedCases.find(c => c.id === TO_INACTIVE.id);
  if (!jsonTarget) {
    console.log(`✗ Case #${TO_INACTIVE.id} missing from fallback JSON`);
    process.exit(1);
  }
  jsonTarget.status = 'inactive';
  json.internationalContext.timeline = mergedTimeline;
  json.speciesBreakdown = newBreakdown;
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
  if (Number(after[0].total) !== EXPECTED_TOTAL_AFTER || Number(after[0].active) !== 4
      || Number(after[0].inactive) !== EXPECTED_INACTIVE_AFTER) {
    console.log(`✗ Mismatch! Expected ${EXPECTED_TOTAL_AFTER} / 4 / ${EXPECTED_INACTIVE_AFTER} — `
      + `got ${after[0].total} / ${after[0].active} / ${after[0].inactive}`);
    process.exit(1);
  }
  console.log('✓ Counts match APHIS (55 domestic, 4 active, 51 inactive; 56 total incl. fly trap)');

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

  // Geography must match GenomicEpi: 19 counties, 2 states, NM at 4 cases / 2 active.
  const geo = await sql`
    SELECT COUNT(DISTINCT county || ', ' || state) AS "counties", COUNT(DISTINCT state) AS "states"
    FROM screwworm_cases
  `;
  if (Number(geo[0].counties) !== 19 || Number(geo[0].states) !== 2) {
    console.log(`✗ Geography ${geo[0].counties} counties / ${geo[0].states} states != 19 / 2`);
    process.exit(1);
  }
  console.log(`✓ Geography: ${geo[0].counties} counties across ${geo[0].states} states`);

  const nm = await sql`
    SELECT COUNT(*) AS "total", COUNT(*) FILTER (WHERE status = 'active') AS "active"
    FROM screwworm_cases WHERE state = 'NM'
  `;
  if (Number(nm[0].total) !== 4 || Number(nm[0].active) !== 2) {
    console.log(`✗ New Mexico ${nm[0].total} cases / ${nm[0].active} active != 4 / 2`);
    process.exit(1);
  }
  console.log(`✓ New Mexico: ${nm[0].total} cases, ${nm[0].active} active`);

  // The stored breakdown must equal what /api/cases will compute from the rows.
  const storedRows = await sql`SELECT value FROM screwworm_metadata WHERE key = 'speciesBreakdown'`;
  const stored = typeof storedRows[0].value === 'string' ? JSON.parse(storedRows[0].value) : storedRows[0].value;
  for (const row of bySpeciesRows) {
    const label = SPECIES_LABEL[row.species] || row.species;
    const entry = stored.find(s => s.species === label);
    if (!entry) {
      console.log(`✗ Species ${row.species} has no breakdown entry`);
      process.exit(1);
    }
    const wantPct = Math.round((Number(row.count) / EXPECTED_TOTAL_AFTER) * 100);
    if (entry.count !== Number(row.count) || entry.percentage !== wantPct) {
      console.log(`✗ ${label}: rows say ${row.count} (${wantPct}%), breakdown says ${entry.count} (${entry.percentage}%)`);
      process.exit(1);
    }
    console.log(`✓ ${label}: ${entry.count} (${entry.percentage}%)`);
  }

  // Fallback JSON must agree with the DB on ids, status, and breakdown.
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
  // Compare field-by-field: the metadata column is jsonb, which reorders object keys on
  // write, so a raw JSON.stringify comparison fails on key order even when the values agree.
  if (json.speciesBreakdown.length !== stored.length) {
    console.log(`✗ Fallback breakdown has ${json.speciesBreakdown.length} rows, DB has ${stored.length}`);
    process.exit(1);
  }
  for (const entry of json.speciesBreakdown) {
    const dbEntry = stored.find(s => s.species === entry.species);
    if (!dbEntry || dbEntry.count !== entry.count || dbEntry.percentage !== entry.percentage) {
      console.log(`✗ Fallback breakdown diverges from DB for "${entry.species}": `
        + `${JSON.stringify(entry)} vs ${JSON.stringify(dbEntry)}`);
      process.exit(1);
    }
  }
  console.log(`✓ Fallback JSON in parity with DB (${jsonIds.length} cases, all statuses match, ${mergedTimeline.length} timeline entries)`);

  console.log('\nDone!');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
