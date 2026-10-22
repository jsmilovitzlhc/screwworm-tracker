import { neon } from '@neondatabase/serverless';
import { readFileSync, writeFileSync } from 'fs';

const envFile = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}

const sql = neon(process.env.DATABASE_URL);

// APHIS sync Oct 22, 2026 — TWO new cases, both confirmed Wed Oct 21, and the first
// non-domestic animal case of the US outbreak. 56 -> 58 animal cases, 5 -> 7 active.
//
// 1. Case 58 — hunter-harvested female ELK, Pecos County, TX. The first detection of New
//    World screwworm in US WILDLIFE. Sourced directly from two official releases:
//      - APHIS: aphis.usda.gov/news/agency-announcements/
//        usda-confirms-first-detection-new-world-screwworm-us-wildlife
//        "the first detection of New World screwworm (NWS) in wildlife in the United States,
//        in an elk in Pecos County, TX. The elk was located on a game ranch and was reported
//        after being harvested by a hunter." TAHC "will modify a previously established
//        infested zone", and USDA + Texas Parks and Wildlife "are conducting additional
//        wildlife surveillance in the area."
//      - TPWD news release Oct 21 (tpwd.texas.gov/newsmedia/releases/?req=20261021a):
//        confirms it is a FEMALE elk and that the sample was identified and confirmed at the
//        ARS Knipling-Bushland U.S. Livestock Insects Research Laboratory in Kerrville.
//
// 2. Case 59 — beef COW, Otero County, NM. A NEW COUNTY (the outbreak's 20th) and New
//    Mexico's 5th case. NOT mentioned in the task brief for this sync; found by reconciling
//    the APHIS dashboard export, which had moved further than the brief described.
//      - KOB 4 (dateline PIÑON, N.M.): "New Mexico officials confirmed a New World screwworm
//        case in an Otero County beef cow and set a 12.4-mile infested zone around the
//        animal", quoting State Veterinarian Dr. Samantha Holeck (NM Livestock Board) and
//        Secretary of Agriculture Jeff Witte.
//      - KVIA Oct 21: "Two new cases of New World screwworm have been confirmed in Otero
//        County, New Mexico, and Texas ... According to the USDA NWS dashboard, both cases
//        were confirmed Wednesday. One of them was found in cattle in Otero County."
//
// APHIS public Tableau export fetched this sync (publicdashboards.dl.usda.gov/t/MRP_PUB/
// views/NewWorldScrewwormPublicReporting_17805168329840/SummaryDashboard.csv):
//     July 2026:       14 / 14 total,  0 active, 14 inactive
//     August 2026:      4 /  4 total,  0 active,  4 inactive
//     September 2026:   3 /  4 total,  0 active,  3 inactive
//     October 2026:     7 /  8 total,  7 active,  0 inactive   <-- was 5 / 5, 5 active Oct 21
// (columns are "Total Cases - Domestic" / "Total Cases")
//
// CAVEAT on the export (carried forward from every sync since Sep 30): the CSV's month window
// has scrolled forward and June 2026 (30 total / 0 active / 30 inactive) is no longer emitted.
// June is asserted below from the tracker's own previously-verified state, not from this fetch.
//   30 + 14 + 4 + 3 + 7 = 58 animal cases; all 7 actives sit in October => 51 inactive.
//
// OPEN QUESTION — October's "Total Cases" is 8 against 7 in the animal-case column, i.e. one
// October entry that is not an animal case. September shows the same 3-vs-4 shape and there
// that extra entry is the Sep 25 Brewster County wild fly trap, so the October extra is most
// likely a second fly trap. NOTHING is written for it: no release I could find describes an
// October fly-trap detection, and the dashboard's own per-case detail is not exportable (only
// SummaryDashboard.csv exists; the vizql bootstrap endpoint returns 410). Flagged rather than
// invented. Revisit next sync.
//
// WHY the elk counts inside the 7: KVIA read the dashboard the same day and saw exactly TWO
// new entries, the Otero cow and the Pecos elk. So October's animal-case column of 7 is the
// tracker's 5 known October cases plus those two, and the independent "seven active cases of
// NWS in New Mexico and Texas" that KVIA attributes to USDA matches 7/7 exactly. The
// alternative reading — that the column excludes wildlife and therefore hides an eighth,
// unreported domestic case — would put actives at 8 and contradict that figure.
//
// GenomicEpi's per-case line list, which previous syncs used as the second source, is STALE
// this cycle: it still reads "Oct 18, 2026 / 56 animal cases / 5 active / 56 domestic /
// 0 wildlife". It therefore CANNOT corroborate this sync, and the per-species totals below
// are derived from the tracker's previously-verified 56-case baseline plus the two sourced
// new cases, NOT read off a current per-species source. Re-verify next sync.
//
// NEW SPECIES: 'Cervid'. This is the sixth species in the outbreak and the first that is not
// livestock or a companion animal. Code changes ship with this sync because three places
// enumerate species explicitly and would otherwise drop or mis-render the elk:
//   - src/components/CasesByDay.jsx  SPECIES_ORDER/SPECIES_COLORS (filter, so it was dropped)
//   - api/cases.js                   SPECIES_LABELS (would render a bare "Cervid")
//   - src/components/SpeciesBreakdown.jsx + src/index.css (bar colour)
// The tracker has no domestic/wildlife column, so "wildlife" is carried in the notes and the
// timeline, the same way the Sep 25 fly trap is carried as a note.

const JSON_PATH = '/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/src/data/cases.json';

const NEW_CASES = [
  {
    id: 58,
    date: '2026-10-21',
    species: 'Cervid',
    animal: 'Elk',
    county: 'Pecos',
    state: 'TX',
    lat: 30.8844,
    lng: -103.4782,
    status: 'active',
    notes: 'First detection of New World screwworm in US wildlife and the sixth Pecos County '
      + 'case; hunter-harvested female elk on a game ranch, confirmed at the ARS '
      + 'Knipling-Bushland lab in Kerrville; TAHC is modifying a previously established '
      + 'infested zone and USDA/TPWD are expanding wildlife surveillance in the area; '
      + 'confirmed per APHIS announcement Oct 21',
  },
  {
    id: 59,
    date: '2026-10-21',
    species: 'Bovine',
    animal: 'Cattle',
    county: 'Otero',
    state: 'NM',
    lat: 32.6119,
    lng: -105.3881,
    status: 'active',
    notes: 'First Otero County case and the twentieth county of the US outbreak; beef cow near '
      + 'Piñon, NM and New Mexico\'s fifth case; the NM Livestock Board set a minimum '
      + '12.4-mile infested zone around the animal; domestic animal; confirmed same day as '
      + 'the Pecos County elk per APHIS dashboard Oct 21',
  },
];

// No status transitions this sync — the export's active/inactive split is unchanged outside
// October, and all 7 October cases are active.
const TO_INACTIVE = [];

const EXPECTED_ACTIVE_BEFORE = [53, 54, 55, 56, 57];
const EXPECTED_ACTIVE_AFTER = [53, 54, 55, 56, 57, 58, 59];

const EXPECTED_TOTAL_BEFORE = 56;
const EXPECTED_TOTAL_AFTER = 58;
const EXPECTED_ACTIVE_AFTER_COUNT = 7;
const EXPECTED_INACTIVE_AFTER = 51;

// Post-update per-month truth. July/Aug/Sept/Oct from this sync's CSV fetch;
// June carried forward (see CAVEAT above).
const APHIS_BY_MONTH = {
  '2026-06': { total: 30, active: 0, inactive: 30 },
  '2026-07': { total: 14, active: 0, inactive: 14 },
  '2026-08': { total: 4, active: 0, inactive: 4 },
  '2026-09': { total: 3, active: 0, inactive: 3 },
  '2026-10': { total: 7, active: 7, inactive: 0 },
};

// Derived (see the GenomicEpi staleness note above), not read off a live per-species source:
// the Oct 21 verified breakdown plus one Bovine (Otero cow) and one Cervid (Pecos elk).
const APHIS_BY_SPECIES = {
  Bovine: 25,
  Ovine: 16,
  Caprine: 7,
  Canine: 5,
  Equine: 4,
  Cervid: 1,
};

const EXPECTED_COUNTIES = 20;
const EXPECTED_STATES = 2;
const EXPECTED_TX = { total: 53, active: 4 };
const EXPECTED_NM = { total: 5, active: 3 };
const EXPECTED_PECOS = { total: 6, active: 2 };
const EXPECTED_OTERO = { total: 1, active: 1 };

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
    date: '2026-10-21',
    event: 'Case 58: hunter-harvested female elk in Pecos County, TX — the first detection of '
      + 'New World screwworm in US wildlife. The hunter reported the animal on a game ranch '
      + 'and the sample was confirmed at the ARS Knipling-Bushland U.S. Livestock Insects '
      + 'Research Laboratory in Kerrville. Cervid becomes the sixth species of the outbreak '
      + 'and the first that is neither livestock nor a companion animal; Pecos County rises '
      + 'to 6 cases and Texas to 53. The Texas Animal Health Commission is modifying a '
      + 'previously established infested zone while USDA and Texas Parks and Wildlife expand '
      + 'wildlife surveillance in the area',
  },
  {
    date: '2026-10-21',
    event: 'Case 59: beef cow in Otero County, NM — the first case in Otero County, which '
      + 'becomes the twentieth county of the US outbreak, confirmed the same day as the Pecos '
      + 'County elk. New Mexico rises to 5 cases and the New Mexico Livestock Board '
      + 'established a minimum 12.4-mile infested zone around the affected animal near Piñon. '
      + 'US total reaches 58 animal cases with 7 active and 51 inactive across 20 counties in '
      + '2 states; 57 of the 58 are domestic animals and 1 is wildlife',
  },
];

const LAST_UPDATED = '2026-10-22T00:00:00Z';
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

  // Re-runnable: accept either the pre-sync state (56/5) or an already-applied post-sync
  // state (58/7), and reject anything else so it cannot be pointed at unknown data.
  const activeBefore = (await sql`SELECT id FROM screwworm_cases WHERE status = 'active' ORDER BY id`).map(r => r.id);
  const isPreSync = Number(before[0].total) === EXPECTED_TOTAL_BEFORE && Number(before[0].active) === 5
    && JSON.stringify(activeBefore) === JSON.stringify(EXPECTED_ACTIVE_BEFORE);
  const isPostSync = Number(before[0].total) === EXPECTED_TOTAL_AFTER
    && Number(before[0].active) === EXPECTED_ACTIVE_AFTER_COUNT
    && JSON.stringify(activeBefore) === JSON.stringify(EXPECTED_ACTIVE_AFTER);
  if (!isPreSync && !isPostSync) {
    console.log(`✗ Unexpected starting state: ${before[0].total} total / ${before[0].active} active, `
      + `active ids ${JSON.stringify(activeBefore)}. Wanted ${EXPECTED_TOTAL_BEFORE}/5 `
      + `${JSON.stringify(EXPECTED_ACTIVE_BEFORE)} (pre-sync) or ${EXPECTED_TOTAL_AFTER}/`
      + `${EXPECTED_ACTIVE_AFTER_COUNT} ${JSON.stringify(EXPECTED_ACTIVE_AFTER)} (already applied)`);
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

  // --- 2. Status transitions (none this sync) ---
  if (TO_INACTIVE.length === 0) {
    console.log('No status transitions this sync — active/inactive split unchanged outside October');
  }

  // --- 3. Nothing outside the expected set may be active ---
  const stale = await sql`
    SELECT id, date, county, animal FROM screwworm_cases
    WHERE status = 'active' AND id NOT IN (53, 54, 55, 56, 57, 58, 59) ORDER BY id
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
  // Cervid is new, so the stored breakdown is one row short of the species present. Rebuild
  // from the species actually in the table. The pre-existing stored order is alphabetical by
  // label, so sorting by label both preserves it and drops 'Cervid (Elk)' into place after
  // 'Caprine (Goats)'. Assert that assumption instead of trusting it.
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

  // The Sep 25 fly trap must already be a timeline note and must NOT be a case row.
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
  console.log('✓ Counts match APHIS (58 animal cases = 57 domestic + 1 wildlife, 7 active, 51 inactive)');

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

  for (const [label, where, want] of [
    ['Texas', sql`SELECT COUNT(*) AS "total", COUNT(*) FILTER (WHERE status = 'active') AS "active" FROM screwworm_cases WHERE state = 'TX'`, EXPECTED_TX],
    ['New Mexico', sql`SELECT COUNT(*) AS "total", COUNT(*) FILTER (WHERE status = 'active') AS "active" FROM screwworm_cases WHERE state = 'NM'`, EXPECTED_NM],
    ['Pecos County', sql`SELECT COUNT(*) AS "total", COUNT(*) FILTER (WHERE status = 'active') AS "active" FROM screwworm_cases WHERE county = 'Pecos' AND state = 'TX'`, EXPECTED_PECOS],
    ['Otero County', sql`SELECT COUNT(*) AS "total", COUNT(*) FILTER (WHERE status = 'active') AS "active" FROM screwworm_cases WHERE county = 'Otero' AND state = 'NM'`, EXPECTED_OTERO],
  ]) {
    const row = (await where)[0];
    if (Number(row.total) !== want.total || Number(row.active) !== want.active) {
      console.log(`✗ ${label} ${row.total} cases / ${row.active} active != ${want.total} / ${want.active}`);
      process.exit(1);
    }
    console.log(`✓ ${label}: ${row.total} cases, ${row.active} active`);
  }

  // Exactly one wildlife case, and it is the elk.
  const cervids = await sql`SELECT id, animal, county, state FROM screwworm_cases WHERE species = 'Cervid' ORDER BY id`;
  if (cervids.length !== 1 || cervids[0].id !== 58 || cervids[0].animal !== 'Elk') {
    console.log(`✗ Expected exactly one Cervid row (#58 Elk), got ${JSON.stringify(cervids)}`);
    process.exit(1);
  }
  console.log(`✓ Wildlife: 1 Cervid row — #58 Elk, ${cervids[0].county} County, ${cervids[0].state}`);

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
