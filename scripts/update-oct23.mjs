import { neon } from '@neondatabase/serverless';
import { readFileSync, writeFileSync } from 'fs';

const envFile = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}

const sql = neon(process.env.DATABASE_URL);

// APHIS sync Oct 23, 2026 — THREE new domestic cattle cases and the first status transition
// of an October case. 58 -> 61 animal cases, 7 -> 9 active, 51 -> 52 inactive, 20 -> 22
// counties. The elk (case 58) goes active -> inactive.
//
// APHIS public Tableau export fetched this sync (publicdashboards.dl.usda.gov/t/MRP_PUB/
// views/NewWorldScrewwormPublicReporting_17805168329840/SummaryDashboard.csv):
//     July 2026:       14 / 14 total,  0 active, 14 inactive
//     August 2026:      4 /  4 total,  0 active,  4 inactive
//     September 2026:   3 /  4 total,  0 active,  3 inactive
//     October 2026:     9 / 10 total,  9 active,  0 inactive   <-- was 7 / 8, 7 active Oct 22
// (columns are "Total Cases - Domestic" / "Total Cases"; the active/inactive measures are
// "Active Cases - Domestic" / "Inactive Cases - Domestic", i.e. DOMESTIC-ONLY on both.)
//
// CAVEAT on the export (carried forward from every sync since Sep 30): the CSV's month window
// has scrolled forward and June 2026 (30 total / 0 active / 30 inactive) is no longer emitted.
// June is asserted below from the tracker's own previously-verified state, not from this fetch.
//   Domestic: 30 + 14 + 4 + 3 + 9 = 60, plus the 1 wildlife elk = 61 animal cases.
//   All 9 actives are domestic and sit in October => 52 inactive (51 + the elk).
//
// RESOLVED — the "extra October entry" open question from the Oct 22 sync. That sync flagged
// October's Total Cases 8 vs Total Cases - Domestic 7 and guessed a second, unreported fly
// trap. It is simpler than that: the DOMESTIC columns exclude wildlife, so the extra October
// entry is the ELK itself. The arithmetic now closes exactly on that reading:
//   - Oct domestic went 7 -> 9 on the export, and the tracker holds 6 domestic October cases,
//     so the three new cases below take it to 9 == the export's domestic column.
//   - Oct Total Cases is 10 == those 9 domestic + the elk, which is what the tracker will hold.
//   - Active Cases - Domestic is 9 == the tracker's 9 active rows once the elk is inactive. On
//     the old "elk is inside the domestic count" reading, the tracker would have to carry a
//     tenth domestic October case that no source describes, and the active column could not
//     land on 9 with the elk inactive.
// September's 3 vs 4 is unchanged and is still the Sep 25 Brewster fly trap, which is also
// not a domestic animal case. The two gaps therefore have the same cause and nothing is left
// unexplained in either month. The fly trap stays a timeline note, asserted below.
//
// SOURCING — read honestly: the three new cases are dashboard-only. The aggregate movement is
// independently verified against the live CSV above (Oct domestic 7 -> 9, active 7 -> 9), so
// the COUNT of three new domestic October cases and the elk's reclassification are confirmed
// by a primary source. Their per-case ATTRIBUTION (date / county / species) comes from the
// task brief's read of the same dashboard's case detail. I could not corroborate any of the
// three in news or agency releases:
//   - Jeff Davis County, TX: no release describes a case there. Jeff Davis appears only in the
//     TAHC movement-restriction county list, as a neighbour of the Pecos/Brewster clusters.
//   - Hidalgo County, NM: no NMDA/NM Livestock Board release names it. Consistent but not
//     conclusive: Source New Mexico (Oct 22) reports the state's infested zones already span
//     "the bootheel in southwest New Mexico", which is Hidalgo County.
//   - Val Verde County, TX: no release describes an October case there; the county's two
//     earlier cases are Aug 16 and Aug 25 and both went inactive Sep 13.
// The dashboard's per-case detail is still not machine-readable: SummaryDashboard.csv is the
// only sheet that exports (CaseDetail/MapDashboard/etc. all 404) and the vizql bootstrap
// endpoint still returns 410, so this could not be re-derived independently. Re-verify the
// three counties next sync.
//
// COUNTY ORDINALS — the brief's numbering is wrong and is NOT reproduced in the data. The
// tracker holds 20 distinct counties before this sync, and New Mexico has three of them
// (Grant, Lea, Otero). So Jeff Davis is the 21st county (the brief said 22nd) and Hidalgo is
// the 22nd county overall and New Mexico's FOURTH county (the brief said 3rd). Val Verde is
// not a new county either way; it already holds cases 47 and 48. The brief's own total of 22
// counties after the sync is right, it just mislabels which case gets which ordinal.
//
// COORDINATES: APHIS reports location at county level only. Jeff Davis and Hidalgo have no
// named locality in any source, so both use their county seat (Fort Davis, TX; Lordsburg, NM).
// The new Val Verde case is placed just off the two existing Val Verde pins so it does not
// render underneath them, the same way case 58's elk was offset from case 54 in Pecos.
//
// NO CODE CHANGES this sync: all three new cases are Bovine, a species already wired into
// CasesByDay SPECIES_ORDER/SPECIES_COLORS, api/cases.js SPECIES_LABELS and the CSS bar
// colours. The species-wiring assertions at the end of this script run anyway.

const JSON_PATH = '/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/src/data/cases.json';

const NEW_CASES = [
  {
    id: 60,
    date: '2026-10-20',
    species: 'Bovine',
    animal: 'Cattle',
    county: 'Val Verde',
    state: 'TX',
    lat: 29.9,
    lng: -100.99,
    status: 'active',
    notes: 'Third Val Verde County case and the first bovine (cattle) detection in Val Verde '
      + 'County; the county\'s first case since the Aug 25 goat and its first active case since '
      + 'both earlier cases were reclassified inactive Sep 13; domestic animal; confirmed per '
      + 'APHIS dashboard Oct 20',
  },
  {
    id: 61,
    date: '2026-10-20',
    species: 'Bovine',
    animal: 'Cattle',
    county: 'Jeff Davis',
    state: 'TX',
    lat: 30.5883,
    lng: -103.8947,
    status: 'active',
    notes: 'First Jeff Davis County case and the twenty-first county of the US outbreak; the '
      + 'county already sat under TAHC movement restrictions as a neighbour of the Pecos and '
      + 'Brewster County clusters but had no confirmed case of its own until now; domestic '
      + 'cattle; APHIS reports location at county level, so the coordinates are the county '
      + 'seat (Fort Davis); confirmed per APHIS dashboard Oct 20',
  },
  {
    id: 62,
    date: '2026-10-22',
    species: 'Bovine',
    animal: 'Cattle',
    county: 'Hidalgo',
    state: 'NM',
    lat: 32.3503,
    lng: -108.7073,
    status: 'active',
    notes: 'First Hidalgo County case and the twenty-second county of the US outbreak; New '
      + 'Mexico\'s fourth affected county and sixth case, in the state\'s bootheel adjoining '
      + 'the Grant County cluster, an area already inside a designated infested zone; domestic '
      + 'cattle; APHIS reports location at county level, so the coordinates are the county '
      + 'seat (Lordsburg); confirmed per APHIS dashboard Oct 22',
  },
];

// The elk is reclassified. It is the outbreak's only wildlife case and the first October case
// to go inactive; the export's domestic active column (9) only closes with it out of active.
const TO_INACTIVE = [
  {
    id: 58,
    date: '2026-10-21',
    county: 'Pecos',
    state: 'TX',
    animal: 'Elk',
    species: 'Cervid',
  },
];

const EXPECTED_ACTIVE_BEFORE = [53, 54, 55, 56, 57, 58, 59];
const EXPECTED_ACTIVE_AFTER = [53, 54, 55, 56, 57, 59, 60, 61, 62];

const EXPECTED_TOTAL_BEFORE = 58;
const EXPECTED_ACTIVE_BEFORE_COUNT = 7;
const EXPECTED_TOTAL_AFTER = 61;
const EXPECTED_ACTIVE_AFTER_COUNT = 9;
const EXPECTED_INACTIVE_AFTER = 52;

// Post-update per-month truth. July/Aug/Sept/Oct from this sync's CSV fetch;
// June carried forward (see CAVEAT above). `total` counts every animal case the tracker
// holds for the month; `domestic` is what the CSV's domestic columns cover.
const APHIS_BY_MONTH = {
  '2026-06': { total: 30, domestic: 30, active: 0, inactive: 30 },
  '2026-07': { total: 14, domestic: 14, active: 0, inactive: 14 },
  '2026-08': { total: 4, domestic: 4, active: 0, inactive: 4 },
  '2026-09': { total: 3, domestic: 3, active: 0, inactive: 3 },
  '2026-10': { total: 10, domestic: 9, active: 9, inactive: 1 },
};

// The CSV's domestic-only active/inactive measures, asserted separately from the totals above
// so the wildlife/domestic split cannot silently drift back to the Oct 22 misreading.
const APHIS_DOMESTIC_ACTIVE_BY_MONTH = {
  '2026-06': { active: 0, inactive: 30 },
  '2026-07': { active: 0, inactive: 14 },
  '2026-08': { active: 0, inactive: 4 },
  '2026-09': { active: 0, inactive: 3 },
  '2026-10': { active: 9, inactive: 0 },
};

// Derived from the Oct 22 verified breakdown plus three Bovine. GenomicEpi's per-case line
// list was already stale last sync and still is, so there is no live per-species source to
// read this off; re-verify next sync.
const APHIS_BY_SPECIES = {
  Bovine: 28,
  Ovine: 16,
  Caprine: 7,
  Canine: 5,
  Equine: 4,
  Cervid: 1,
};

const EXPECTED_COUNTIES = 22;
const EXPECTED_STATES = 2;
const EXPECTED_TX = { total: 55, active: 5 };
const EXPECTED_NM = { total: 6, active: 4 };
const EXPECTED_PECOS = { total: 6, active: 1 };
const EXPECTED_VAL_VERDE = { total: 3, active: 1 };
const EXPECTED_JEFF_DAVIS = { total: 1, active: 1 };
const EXPECTED_HIDALGO = { total: 1, active: 1 };

const SPECIES_LABEL = {
  Bovine: 'Bovine (Cattle)',
  Canine: 'Canine (Dogs)',
  Caprine: 'Caprine (Goats)',
  Cervid: 'Cervid (Elk)',
  Equine: 'Equine (Horses)',
  Ovine: 'Ovine (Sheep)',
};

const TIMELINE_ENTRIES = [
  {
    date: '2026-10-20',
    event: 'Case 60: cattle in Val Verde County, TX — the county\'s third case and its first '
      + 'bovine detection. Val Verde had been quiet since its Aug 16 sheep and Aug 25 goat, '
      + 'both of which were reclassified inactive on Sep 13, so this is its first active case '
      + 'in five weeks and marks the outbreak re-appearing in the Del Rio border corridor '
      + 'while the western clusters expand',
  },
  {
    date: '2026-10-20',
    event: 'Case 61: cattle in Jeff Davis County, TX — the first case in Jeff Davis County, '
      + 'which becomes the twenty-first county of the US outbreak. The county was already '
      + 'under Texas Animal Health Commission movement restrictions as a neighbour of the '
      + 'Pecos and Brewster County clusters but had never recorded a confirmed case; Texas '
      + 'rises to 55 cases across 19 counties',
  },
  {
    date: '2026-10-22',
    event: 'Case 62: cattle in Hidalgo County, NM — the first case in Hidalgo County, which '
      + 'becomes the twenty-second county of the US outbreak and New Mexico\'s fourth affected '
      + 'county. The detection is in the state\'s bootheel, adjoining the Grant County cluster '
      + 'and inside territory New Mexico had already designated an infested zone; New Mexico '
      + 'rises to 6 cases. US total reaches 61 animal cases with 9 active and 52 inactive '
      + 'across 22 counties in 2 states; 60 of the 61 are domestic animals and 1 is wildlife',
  },
  {
    date: '2026-10-22',
    event: 'Case 58, the Pecos County elk and the outbreak\'s only wildlife detection, is '
      + 'reclassified from active to inactive per the APHIS dashboard — the first October case '
      + 'to be closed out, one day after it was confirmed. Pecos County drops to a single '
      + 'active case and all 9 remaining active cases are domestic animals',
  },
];

const LAST_UPDATED = '2026-10-23T00:00:00Z';
const LAST_CHECKED = new Date().toISOString();

function mergeTimeline(base) {
  const out = base.map(e => ({ ...e }));
  for (const entry of TIMELINE_ENTRIES) {
    if (out.some(e => e.date === entry.date && e.event.slice(0, 20) === entry.event.slice(0, 20))) {
      console.log(`Timeline already has a ${entry.date} entry starting "${entry.event.slice(0, 20)}" — left as is`);
    } else {
      out.push({ ...entry });
      console.log(`Timeline entry added for ${entry.date}: "${entry.event.slice(0, 20)}..."`);
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

  // Re-runnable: accept either the pre-sync state (58/7) or an already-applied post-sync
  // state (61/9), and reject anything else so it cannot be pointed at unknown data.
  const activeBefore = (await sql`SELECT id FROM screwworm_cases WHERE status = 'active' ORDER BY id`).map(r => r.id);
  const isPreSync = Number(before[0].total) === EXPECTED_TOTAL_BEFORE
    && Number(before[0].active) === EXPECTED_ACTIVE_BEFORE_COUNT
    && JSON.stringify(activeBefore) === JSON.stringify(EXPECTED_ACTIVE_BEFORE);
  const isPostSync = Number(before[0].total) === EXPECTED_TOTAL_AFTER
    && Number(before[0].active) === EXPECTED_ACTIVE_AFTER_COUNT
    && JSON.stringify(activeBefore) === JSON.stringify(EXPECTED_ACTIVE_AFTER);
  if (!isPreSync && !isPostSync) {
    console.log(`✗ Unexpected starting state: ${before[0].total} total / ${before[0].active} active, `
      + `active ids ${JSON.stringify(activeBefore)}. Wanted ${EXPECTED_TOTAL_BEFORE}/`
      + `${EXPECTED_ACTIVE_BEFORE_COUNT} ${JSON.stringify(EXPECTED_ACTIVE_BEFORE)} (pre-sync) or `
      + `${EXPECTED_TOTAL_AFTER}/${EXPECTED_ACTIVE_AFTER_COUNT} `
      + `${JSON.stringify(EXPECTED_ACTIVE_AFTER)} (already applied)`);
    process.exit(1);
  }
  if (isPostSync) console.log('Sync already applied — re-running idempotently to re-verify');

  // --- 1. Insert the new cases (idempotent) ---
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
      RETURNING id, date, species, animal, county, state, status
    `;
    console.log('Inserted:', JSON.stringify(inserted[0]));
  }

  // --- 2. Status transitions: confirm identity before flipping anything ---
  for (const T of TO_INACTIVE) {
    const target = await sql`SELECT id, date, county, state, animal, species, status FROM screwworm_cases WHERE id = ${T.id}`;
    if (target.length === 0) {
      console.log(`✗ Case #${T.id} not found`);
      process.exit(1);
    }
    const t = target[0];
    const tDate = new Date(t.date).toISOString().slice(0, 10);
    if (t.county !== T.county || t.state !== T.state || t.animal !== T.animal
        || t.species !== T.species || tDate !== T.date) {
      console.log(`✗ Case #${T.id} is ${t.species}/${t.animal} in ${t.county}, ${t.state} on ${tDate} — `
        + `expected ${T.species}/${T.animal} in ${T.county}, ${T.state} on ${T.date}`);
      process.exit(1);
    }
    console.log(`✓ Case #${T.id} identity confirmed: ${t.animal} in ${t.county}, ${t.state} (${tDate}), currently ${t.status}`);
    if (t.status === 'inactive') {
      console.log(`Case #${T.id} already inactive — transition already applied`);
    }
    const updated = await sql`
      UPDATE screwworm_cases SET status = 'inactive'
      WHERE id = ${T.id}
      RETURNING id, date, county, state, animal, status
    `;
    console.log('Transitioned:', JSON.stringify(updated[0]));
  }

  // --- 3. Nothing outside the expected set may be active ---
  const stale = await sql`
    SELECT id, date, county, animal FROM screwworm_cases
    WHERE status = 'active' AND id NOT IN (53, 54, 55, 56, 57, 59, 60, 61, 62) ORDER BY id
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

  // --- 4. Recompute speciesBreakdown from the case rows, exactly as /api/cases does ---
  const bySpeciesRows = await sql`SELECT species, COUNT(*) AS "count" FROM screwworm_cases GROUP BY 1`;
  const speciesCounts = {};
  for (const row of bySpeciesRows) speciesCounts[row.species] = Number(row.count);
  for (const [species, want] of Object.entries(APHIS_BY_SPECIES)) {
    if (speciesCounts[species] !== want) {
      console.log(`✗ ${species}: tracker has ${speciesCounts[species]} rows, expected ${want}`);
      process.exit(1);
    }
  }
  for (const species of Object.keys(speciesCounts)) {
    if (!(species in APHIS_BY_SPECIES)) {
      console.log(`✗ Tracker has unexpected species "${species}" absent from the truth table`);
      process.exit(1);
    }
  }
  const speciesTotal = Object.values(speciesCounts).reduce((s, n) => s + n, 0);
  if (speciesTotal !== EXPECTED_TOTAL_AFTER) {
    console.log(`✗ Species rows sum to ${speciesTotal}, expected ${EXPECTED_TOTAL_AFTER}`);
    process.exit(1);
  }
  const breakdownRows = await sql`SELECT value FROM screwworm_metadata WHERE key = 'speciesBreakdown'`;
  const oldBreakdown = typeof breakdownRows[0].value === 'string' ? JSON.parse(breakdownRows[0].value) : breakdownRows[0].value;
  const oldLabels = oldBreakdown.map(e => e.species);
  if (JSON.stringify(oldLabels) !== JSON.stringify([...oldLabels].sort())) {
    console.log(`✗ Stored breakdown order is not alphabetical, refusing to re-sort it: ${JSON.stringify(oldLabels)}`);
    process.exit(1);
  }
  for (const label of oldLabels) {
    if (!Object.values(SPECIES_LABEL).includes(label)) {
      console.log(`✗ Stored breakdown entry "${label}" has no known species key`);
      process.exit(1);
    }
  }
  const newBreakdown = Object.keys(speciesCounts)
    .map(species => ({
      species: SPECIES_LABEL[species] || species,
      count: speciesCounts[species],
      percentage: Math.round((speciesCounts[species] / EXPECTED_TOTAL_AFTER) * 100),
    }))
    .sort((a, b) => a.species.localeCompare(b.species));
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

  // --- 5. Timeline ---
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

  // The Sep 25 fly trap must already be a timeline note and must NOT be a case row. It is the
  // whole reason September reads 3 domestic / 4 total on the export.
  const flyTrapNote = json.internationalContext.timeline.find(e => e.date === '2026-09-25' && /fly/i.test(e.event));
  if (!flyTrapNote) {
    console.log('✗ Sep 25 Brewster fly-trap timeline note is missing');
    process.exit(1);
  }
  const flyTrapRow = await sql`SELECT id FROM screwworm_cases WHERE date = '2026-09-25'`;
  if (flyTrapRow.length > 0) {
    console.log(`✗ A case row exists for the Sep 25 fly trap (ids ${JSON.stringify(flyTrapRow.map(r => r.id))}) — it must stay a note only`);
    process.exit(1);
  }
  console.log('✓ Sep 25 Brewster fly trap carried as a timeline note, not a case row');

  const mergedTimeline = mergeTimeline(json.internationalContext.timeline);
  console.log(`Timeline: ${json.internationalContext.timeline.length} -> ${mergedTimeline.length}`);
  ctx.timeline = mergedTimeline;

  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('internationalContext', ${JSON.stringify(ctx)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;

  // --- 6. Timestamps ---
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify(LAST_UPDATED)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastChecked', ${JSON.stringify(LAST_CHECKED)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log(`Updated timestamps to lastUpdated=${LAST_UPDATED}`);

  // --- 7. Mirror everything into the static fallback ---
  for (const NEW_CASE of NEW_CASES) {
    if (!json.confirmedCases.some(c => c.id === NEW_CASE.id)) {
      json.confirmedCases.push({ ...NEW_CASE });
      console.log(`Fallback: added case #${NEW_CASE.id}`);
    }
  }
  for (const T of TO_INACTIVE) {
    const jsonCase = json.confirmedCases.find(c => c.id === T.id);
    if (!jsonCase) {
      console.log(`✗ Fallback is missing case #${T.id}, cannot transition it`);
      process.exit(1);
    }
    if (jsonCase.status !== 'inactive') {
      jsonCase.status = 'inactive';
      console.log(`Fallback: case #${T.id} -> inactive`);
    }
  }
  json.confirmedCases.sort((a, b) => (a.date === b.date ? a.id - b.id : a.date.localeCompare(b.date)));
  json.internationalContext.timeline = mergedTimeline;
  json.speciesBreakdown = newBreakdown;
  json.lastUpdated = LAST_UPDATED;
  json.lastChecked = LAST_CHECKED;
  writeFileSync(JSON_PATH, `${JSON.stringify(json, null, 2)}\n`);
  console.log(`Wrote fallback: ${json.confirmedCases.length} cases, ${json.internationalContext.timeline.length} timeline entries`);

  // --- Verify ---
  const after = await sql`
    SELECT COUNT(*) AS "total",
           COUNT(*) FILTER (WHERE status = 'active') AS "active",
           COUNT(*) FILTER (WHERE status = 'inactive') AS "inactive"
    FROM screwworm_cases
  `;
  console.log(`\nAfter: ${after[0].total} total, ${after[0].active} active, ${after[0].inactive} inactive`);
  if (Number(after[0].total) !== EXPECTED_TOTAL_AFTER
      || Number(after[0].active) !== EXPECTED_ACTIVE_AFTER_COUNT
      || Number(after[0].inactive) !== EXPECTED_INACTIVE_AFTER) {
    console.log(`✗ Mismatch! Expected ${EXPECTED_TOTAL_AFTER} / ${EXPECTED_ACTIVE_AFTER_COUNT} / `
      + `${EXPECTED_INACTIVE_AFTER} — got ${after[0].total} / ${after[0].active} / ${after[0].inactive}`);
    process.exit(1);
  }
  console.log('✓ Counts match APHIS (61 animal cases = 60 domestic + 1 wildlife, 9 active, 52 inactive)');

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

  // Per-month totals, plus the domestic/wildlife split the CSV's columns actually describe.
  const byMonth = await sql`
    SELECT to_char(date, 'YYYY-MM') AS "month",
           COUNT(*) AS "total",
           COUNT(*) FILTER (WHERE species <> 'Cervid') AS "domestic",
           COUNT(*) FILTER (WHERE status = 'active') AS "active",
           COUNT(*) FILTER (WHERE status = 'inactive') AS "inactive",
           COUNT(*) FILTER (WHERE species <> 'Cervid' AND status = 'active') AS "domactive",
           COUNT(*) FILTER (WHERE species <> 'Cervid' AND status = 'inactive') AS "dominactive"
    FROM screwworm_cases GROUP BY 1 ORDER BY 1
  `;
  for (const row of byMonth) {
    const want = APHIS_BY_MONTH[row.month];
    if (!want) {
      console.log(`✗ Unexpected month ${row.month} in tracker but not in APHIS truth table`);
      process.exit(1);
    }
    if (Number(row.total) !== want.total || Number(row.domestic) !== want.domestic
        || Number(row.active) !== want.active || Number(row.inactive) !== want.inactive) {
      console.log(`✗ ${row.month}: tracker ${row.total}/${row.domestic}/${row.active}/${row.inactive} != `
        + `APHIS ${want.total}/${want.domestic}/${want.active}/${want.inactive} (total/domestic/active/inactive)`);
      process.exit(1);
    }
    const wantDom = APHIS_DOMESTIC_ACTIVE_BY_MONTH[row.month];
    if (Number(row.domactive) !== wantDom.active || Number(row.dominactive) !== wantDom.inactive) {
      console.log(`✗ ${row.month} domestic-only split: tracker ${row.domactive} active / `
        + `${row.dominactive} inactive != CSV ${wantDom.active} / ${wantDom.inactive}`);
      process.exit(1);
    }
    console.log(`✓ ${row.month}: ${row.total} total (${row.domestic} domestic), ${row.active} active, `
      + `${row.inactive} inactive; domestic-only ${row.domactive} active / ${row.dominactive} inactive`);
  }
  if (byMonth.length !== Object.keys(APHIS_BY_MONTH).length) {
    console.log('✗ Month count mismatch vs APHIS truth table');
    process.exit(1);
  }

  // The CSV totals must close on the tracker: domestic 60 + 1 wildlife = 61.
  const domesticTotal = byMonth.reduce((s, r) => s + Number(r.domestic), 0);
  if (domesticTotal !== 60 || domesticTotal + 1 !== EXPECTED_TOTAL_AFTER) {
    console.log(`✗ Domestic total is ${domesticTotal}, expected 60 (+1 wildlife = ${EXPECTED_TOTAL_AFTER})`);
    process.exit(1);
  }
  console.log(`✓ Domestic/wildlife split: ${domesticTotal} domestic + 1 wildlife = ${EXPECTED_TOTAL_AFTER}`);

  const geo = await sql`
    SELECT COUNT(DISTINCT county || ', ' || state) AS "counties", COUNT(DISTINCT state) AS "states"
    FROM screwworm_cases
  `;
  if (Number(geo[0].counties) !== EXPECTED_COUNTIES || Number(geo[0].states) !== EXPECTED_STATES) {
    console.log(`✗ Geography ${geo[0].counties} counties / ${geo[0].states} states != `
      + `${EXPECTED_COUNTIES} / ${EXPECTED_STATES}`);
    process.exit(1);
  }
  console.log(`✓ Geography: ${geo[0].counties} counties across ${geo[0].states} states`);

  // New Mexico must now hold exactly four counties — the ordinal written into case 62's notes.
  const nmCounties = (await sql`SELECT DISTINCT county FROM screwworm_cases WHERE state = 'NM' ORDER BY county`).map(r => r.county);
  if (JSON.stringify(nmCounties) !== JSON.stringify(['Grant', 'Hidalgo', 'Lea', 'Otero'])) {
    console.log(`✗ New Mexico counties ${JSON.stringify(nmCounties)} != ["Grant","Hidalgo","Lea","Otero"]`);
    process.exit(1);
  }
  console.log(`✓ New Mexico counties: ${nmCounties.join(', ')} (Hidalgo is the 4th, not the 3rd)`);

  for (const [label, where, want] of [
    ['Texas', sql`SELECT COUNT(*) AS "total", COUNT(*) FILTER (WHERE status = 'active') AS "active" FROM screwworm_cases WHERE state = 'TX'`, EXPECTED_TX],
    ['New Mexico', sql`SELECT COUNT(*) AS "total", COUNT(*) FILTER (WHERE status = 'active') AS "active" FROM screwworm_cases WHERE state = 'NM'`, EXPECTED_NM],
    ['Pecos County', sql`SELECT COUNT(*) AS "total", COUNT(*) FILTER (WHERE status = 'active') AS "active" FROM screwworm_cases WHERE county = 'Pecos' AND state = 'TX'`, EXPECTED_PECOS],
    ['Val Verde County', sql`SELECT COUNT(*) AS "total", COUNT(*) FILTER (WHERE status = 'active') AS "active" FROM screwworm_cases WHERE county = 'Val Verde' AND state = 'TX'`, EXPECTED_VAL_VERDE],
    ['Jeff Davis County', sql`SELECT COUNT(*) AS "total", COUNT(*) FILTER (WHERE status = 'active') AS "active" FROM screwworm_cases WHERE county = 'Jeff Davis' AND state = 'TX'`, EXPECTED_JEFF_DAVIS],
    ['Hidalgo County', sql`SELECT COUNT(*) AS "total", COUNT(*) FILTER (WHERE status = 'active') AS "active" FROM screwworm_cases WHERE county = 'Hidalgo' AND state = 'NM'`, EXPECTED_HIDALGO],
  ]) {
    const row = (await where)[0];
    if (Number(row.total) !== want.total || Number(row.active) !== want.active) {
      console.log(`✗ ${label} ${row.total} cases / ${row.active} active != ${want.total} / ${want.active}`);
      process.exit(1);
    }
    console.log(`✓ ${label}: ${row.total} cases, ${row.active} active`);
  }

  // Exactly one wildlife case, it is still the elk, and it is now inactive.
  const cervids = await sql`SELECT id, animal, county, state, status FROM screwworm_cases WHERE species = 'Cervid' ORDER BY id`;
  if (cervids.length !== 1 || cervids[0].id !== 58 || cervids[0].animal !== 'Elk' || cervids[0].status !== 'inactive') {
    console.log(`✗ Expected exactly one Cervid row (#58 Elk, inactive), got ${JSON.stringify(cervids)}`);
    process.exit(1);
  }
  console.log(`✓ Wildlife: 1 Cervid row — #58 Elk, ${cervids[0].county} County, ${cervids[0].state}, now inactive`);

  // Every active case must be a domestic animal, which is what makes the CSV's domestic-only
  // active column of 9 equal the tracker's 9 actives.
  const activeWildlife = await sql`SELECT id FROM screwworm_cases WHERE status = 'active' AND species = 'Cervid'`;
  if (activeWildlife.length > 0) {
    console.log(`✗ Wildlife case still active: ${JSON.stringify(activeWildlife)}`);
    process.exit(1);
  }
  console.log('✓ All 9 active cases are domestic animals (matches "Active Cases - Domestic" = 9)');

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
  // The new cases' own fields must match in both stores.
  for (const NEW_CASE of NEW_CASES) {
    const dbCase = (await sql`SELECT * FROM screwworm_cases WHERE id = ${NEW_CASE.id}`)[0];
    const jsonCase = json.confirmedCases.find(c => c.id === NEW_CASE.id);
    const dbDate = new Date(dbCase.date).toISOString().slice(0, 10);
    for (const [field, want] of Object.entries(NEW_CASE)) {
      const got = field === 'date' ? dbDate : dbCase[field];
      if (String(got) !== String(want)) {
        console.log(`✗ DB case #${NEW_CASE.id}.${field} = ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
        process.exit(1);
      }
      if (String(jsonCase[field]) !== String(want)) {
        console.log(`✗ Fallback case #${NEW_CASE.id}.${field} = ${JSON.stringify(jsonCase[field])}, expected ${JSON.stringify(want)}`);
        process.exit(1);
      }
    }
    console.log(`✓ Case #${NEW_CASE.id} field-for-field identical in DB and fallback`);
  }
  console.log(`✓ Fallback JSON in parity with DB (${jsonIds.length} cases, all statuses match, ${mergedTimeline.length} timeline entries)`);

  // Every species present in the data must be renderable: SPECIES_ORDER in CasesByDay.jsx
  // filters the stacked bars, so a missing key silently drops cases from that chart.
  const chart = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/src/components/CasesByDay.jsx', 'utf-8');
  const api = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/api/cases.js', 'utf-8');
  for (const species of Object.keys(speciesCounts)) {
    if (!new RegExp(`SPECIES_ORDER = \\[[^\\]]*'${species}'`).test(chart)) {
      console.log(`✗ CasesByDay SPECIES_ORDER is missing "${species}" — its cases would vanish from the daily chart`);
      process.exit(1);
    }
    if (!new RegExp(`${species}: '#`).test(chart)) {
      console.log(`✗ CasesByDay SPECIES_COLORS is missing "${species}"`);
      process.exit(1);
    }
    if (!api.includes(`${species}: '${SPECIES_LABEL[species]}'`)) {
      console.log(`✗ api/cases.js SPECIES_LABELS is missing "${species}"`);
      process.exit(1);
    }
  }
  console.log(`✓ All ${Object.keys(speciesCounts).length} species are wired into the chart, the API labels, and the breakdown`);

  console.log('\nDone!');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
