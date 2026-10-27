import { neon } from '@neondatabase/serverless';
import { readFileSync, writeFileSync } from 'fs';

const envFile = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}

const sql = neon(process.env.DATABASE_URL);

// APHIS sync Oct 27, 2026 — ONE new domestic case in one brand-new county, no status
// transitions. 65 -> 66 animal cases, 12 -> 13 active, 53 inactive (unchanged), 24 -> 25
// counties. New Mexico goes 8 -> 9 cases, 5 -> 6 counties, 6 -> 7 active.
//
// APHIS public Tableau export fetched this sync (publicdashboards.dl.usda.gov/t/MRP_PUB/
// views/NewWorldScrewwormPublicReporting_17805168329840/SummaryDashboard.csv):
//     July 2026:       14 / 14 total,  0 active, 14 inactive
//     August 2026:      4 /  4 total,  0 active,  4 inactive
//     September 2026:   3 /  4 total,  0 active,  3 inactive
//     October 2026:    14 / 15 total, 13 active,  1 inactive   <-- was 13 / 14, 12 active / 1 inactive
// (columns are "Total Cases - Domestic" / "Total Cases"; the active/inactive measures are
// "Active Cases - Domestic" / "Inactive Cases - Domestic", i.e. DOMESTIC-ONLY on both.)
//
// CAVEAT on the export (carried forward from every sync since Sep 30): the CSV's month window
// has scrolled forward and June 2026 (30 total / 0 active / 30 inactive) is no longer emitted.
// June is asserted below from the tracker's own previously-verified state, not from this fetch.
//   Domestic: 30 + 14 + 4 + 3 + 14 = 65, plus the 1 wildlife elk = 66 animal cases.
//   All 13 actives are domestic and sit in October => 53 inactive.
//
// THE CSV CLOSES EXACTLY ON THIS SYNC, on all four measures, and it closes on a sync that adds
// exactly one case and flips nothing — which is what makes this the cleanest sync in weeks:
//   - Oct domestic 13 -> 14. The tracker holds 13 domestic October cases, so the single new
//     case below takes it to 14 == the export's domestic column.
//   - Oct Total Cases 14 -> 15 == those 14 domestic + the Pecos elk, which is what the
//     tracker holds. The +1 appears in BOTH the domestic and the all-species column, so the
//     new case is domestic, not wildlife.
//   - Active Cases - Domestic 12 -> 13 == 12 current actives + 1 new, with nothing closed out.
//     There is no arithmetic here that admits a status transition: adding one active case and
//     landing on 13 means every existing active case is still active.
//   - Inactive Cases - Domestic holds at 1 == case 53 (the Oct 2 Brewster dog, closed out last
//     sync) and nothing else. October's other inactive row is the elk, which is wildlife and
//     so is excluded from the domestic column. Third consecutive sync confirming the
//     domestic/wildlife reading of these columns established on Oct 23.
// September's 3 vs 4 is unchanged and is still the Sep 25 Brewster fly trap, which is not a
// domestic animal case. It stays a timeline note, asserted below.
//
// The brief's own breakdown (domestic 65 total / 13 active / 52 inactive; wildlife 1 total /
// 0 active / 1 inactive) is consistent with the CSV on every figure: domestic inactive 52 is
// 53 total inactive minus the wildlife elk, and 65 + 1 = 66.
//
// SOURCING — the primary source confirms the COUNT; one secondary source confirms the COUNTY
// AND THE DATE; nothing yet corroborates the species.
//   1. Border Report, Oct 26 ("Columbus resumes Mexican cattle imports as Santa Teresa
//      increases crossings", carried by WAVY / KGET / abc27): "New Mexico currently has seven
//      active New World Screwworm cases. One was reported on Monday in Luna County, where the
//      Columbus Stockyard is located." Monday was Oct 26, so this independently confirms both
//      the county and the confirmation date. Its "seven active" for New Mexico is EXACTLY what
//      this sync produces (6 current NM actives + 1), which is a second, independent check on
//      the state-level active count.
//      Its next sentence — "The other three are located in Dona Ana, Grant, and Hidalgo
//      Counties" — does not reconcile with its own "seven" and is simply loose: it names three
//      counties holding six actives (Grant 2, Hidalgo 1, Dona Ana 2 is five, and it omits
//      Otero entirely). The tracker's seven NM actives are Grant 2, Otero 1, Hidalgo 1,
//      Dona Ana 2, Luna 1. The article undercounts its own list; it does not contradict the
//      dashboard, and the assertions below enforce the row data rather than the prose.
//   2. GenomicEpi's per-case line list (genomicepi.com/outbreaks/new-world-screwworm/) has
//      CAUGHT UP to the tracker's pre-sync state and now reads 65 cases / 24 counties /
//      TX 57 / NM 8 with species 31 cattle / 17 sheep / 7 goats / 5 dogs / 4 horses / 1 elk —
//      identical to what the tracker holds before this sync, including the two Dona Ana rows
//      its summary widgets were missing last sync (see the Oct 26 script's CORRECTION 1, now
//      resolved upstream). It has NOT yet ingested the Luna case, so it corroborates the
//      starting state rather than the new row. That is still worth having: it is the first
//      sync in a week where an independent per-case source agrees with the tracker exactly.
//   SPECIES NOT CORROBORATED: no secondary source names the animal. Bovine/Cattle comes from
//   the APHIS dashboard via the brief alone. No USDA, NMDA or New Mexico Livestock Board
//   release names Luna County at all. The dashboard's per-case detail remains
//   machine-unreadable (SummaryDashboard.csv is the only sheet that exports; CaseDetail and
//   MapDashboard 404, the vizql bootstrap endpoint still returns 410), so per-case species
//   could not be re-derived from the primary source. Re-verify the species next sync.
//
// ===================================================================================
// VERIFICATION OF THE BRIEF — every ordinal and geographic claim checked, ALL CORRECT.
// This is the first sync since Oct 19 that needed no corrections, so the checks are recorded
// here explicitly rather than as fixes:
//
//   "twenty-fifth county of the US outbreak"  — tracker holds 24 distinct counties and Luna
//       has no pre-existing row (asserted below), so 24 + 1 = 25. CORRECT.
//   "New Mexico's sixth affected county"      — NM holds Dona Ana, Grant, Hidalgo, Lea, Otero
//       = 5; Luna is the 6th. CORRECT.
//   "New Mexico's ninth case"                 — NM holds 8 rows; this is the 9th. CORRECT.
//   "Grant County ... 3 cases since Sept"     — cases 51 (Sep 17), 55 and 56 (both Oct 15).
//       CORRECT, and 2 of the 3 are still active.
//   "Dona Ana County (2 cases since Oct 24)"  — cases 65 and 66, both Oct 24. CORRECT.
//   "Luna sits between Grant and Dona Ana"    — Luna is bordered by Grant and Hidalgo to the
//       west, Dona Ana to the east, Sierra to the northeast, and Chihuahua, Mexico to the
//       south. CORRECT, and load-bearing: Luna is the county that closes the gap between the
//       Grant/Hidalgo cluster and the Dona Ana cluster.
//   "county seat Deming"                      — Deming is the county seat and Luna's only
//       city. CORRECT (contrast the Oct 26 brief, which mislabelled Dell City as the Hudspeth
//       seat and had to be corrected).
//   coordinates (32.2687, -107.7586)          — this is greater Deming, about a mile north of
//       the Wikipedia city centroid (32.2514, -107.7500) and well inside the county. Used as
//       given, and the notes describe them as the county seat, which is accurate. Bounding-box
//       assertion below.
//
// APHIS REFS — first FY2027 refs in the dataset. Every existing ref ends in :26 and every one
// belongs to a Jul-Sep 2026 case (SU:21744:26 through SU:26079:26 / SS:12230:26, case 50,
// Sep 9). The new refs end in :27, which is consistent with a federal fiscal-year suffix:
// FY2027 opened Oct 1, 2026. Both sequences also advance monotonically at a plausible rate
// from the Sep 9 case — SU 26079 -> 28227 and SS 12230 -> 12716 over 47 days — so the refs are
// internally consistent with the established series. Asserted below. They are stored in the
// notes text, which is where this dataset has always carried them (10 cases do).
//
// OUT OF SCOPE, FLAGGED FOR LATER: stateResponses and quarantineZones are stale for New
// Mexico. stateResponses lists only "Emergency quarantine zone in Lea County" and
// quarantineZones holds a single NM entry ("Lea County Zone") even though New Mexico now has
// six affected counties and its active caseload is concentrated in the southwest, nowhere
// near Lea. Reporting around this case notes designated areas extending into Luna County with
// a surveillance zone reaching toward Columbus. Updating those two structures needs its own
// sourcing pass and is not part of this data sync.
// ===================================================================================
//
// NO CODE CHANGES this sync: the new case is Bovine, already wired into CasesByDay
// SPECIES_ORDER/SPECIES_COLORS, api/cases.js SPECIES_LABELS and the CSS bar colours. The
// species-wiring assertions at the end of this script run anyway.

const JSON_PATH = '/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/src/data/cases.json';

const NEW_CASES = [
  {
    id: 67,
    date: '2026-10-26',
    species: 'Bovine',
    animal: 'Cattle',
    county: 'Luna',
    state: 'NM',
    lat: 32.2687,
    lng: -107.7586,
    status: 'active',
    notes: 'First Luna County case and the twenty-fifth county of the US outbreak; New '
      + 'Mexico\'s sixth affected county and ninth case; domestic cattle, the thirty-second '
      + 'bovine case of the US outbreak; Luna closes the gap in the southwestern New Mexico '
      + 'cluster, sitting directly between Grant County to the west (3 cases since Sep 17, 2 '
      + 'still active) and Dona Ana County to the east (2 cases on Oct 24), so the state\'s '
      + 'detections now run unbroken along the Mexican border from Hidalgo through Luna to '
      + 'Dona Ana; Luna also holds the Columbus port of entry, which USDA reopened to Mexican '
      + 'cattle imports the same day this case was confirmed — the third crossing restored '
      + 'under the phased reopening, after Douglas, AZ and Santa Teresa, NM; APHIS reports '
      + 'location at county level, so the coordinates are the county seat (Deming), about 32 '
      + 'miles north of Columbus and the border; SU:28227:27, SS:12716:27; confirmed per APHIS '
      + 'dashboard Oct 26',
  },
];

// No status transitions this sync. The CSV's domestic active column moves 12 -> 13 while one
// case is added, which is only possible if nothing was closed out, and its domestic inactive
// column holds at 1 (case 53 and nothing else). Both are asserted below.
const TO_INACTIVE = [];

const EXPECTED_ACTIVE_BEFORE = [54, 55, 56, 57, 59, 60, 61, 62, 63, 64, 65, 66];
const EXPECTED_ACTIVE_AFTER = [54, 55, 56, 57, 59, 60, 61, 62, 63, 64, 65, 66, 67];

const EXPECTED_TOTAL_BEFORE = 65;
const EXPECTED_ACTIVE_BEFORE_COUNT = 12;
const EXPECTED_TOTAL_AFTER = 66;
const EXPECTED_ACTIVE_AFTER_COUNT = 13;
const EXPECTED_INACTIVE_AFTER = 53;
const EXPECTED_DOMESTIC_AFTER = 65;

// Post-update per-month truth. July/Aug/Sept/Oct from this sync's CSV fetch;
// June carried forward (see CAVEAT above). `total` counts every animal case the tracker
// holds for the month; `domestic` is what the CSV's domestic columns cover.
const APHIS_BY_MONTH = {
  '2026-06': { total: 30, domestic: 30, active: 0, inactive: 30 },
  '2026-07': { total: 14, domestic: 14, active: 0, inactive: 14 },
  '2026-08': { total: 4, domestic: 4, active: 0, inactive: 4 },
  '2026-09': { total: 3, domestic: 3, active: 0, inactive: 3 },
  '2026-10': { total: 15, domestic: 14, active: 13, inactive: 2 },
};

// The CSV's domestic-only active/inactive measures, asserted separately from the totals above
// so the wildlife/domestic split cannot silently drift back to the Oct 22 misreading.
// October's two inactive rows are case 53 (domestic) and the elk (wildlife), so the
// domestic-only inactive column is 1 while the all-species inactive count is 2.
const APHIS_DOMESTIC_ACTIVE_BY_MONTH = {
  '2026-06': { active: 0, inactive: 30 },
  '2026-07': { active: 0, inactive: 14 },
  '2026-08': { active: 0, inactive: 4 },
  '2026-09': { active: 0, inactive: 3 },
  '2026-10': { active: 13, inactive: 1 },
};

// GenomicEpi's species summary reads 31/17/7/5/4/1 for the tracker's PRE-sync state, which is
// exactly what the tracker holds before this script runs. Bovine 31 -> 32 is the one change.
const APHIS_BY_SPECIES = {
  Bovine: 32,
  Ovine: 17,
  Caprine: 7,
  Canine: 5,
  Equine: 4,
  Cervid: 1,
};

const EXPECTED_COUNTIES = 25;
const EXPECTED_STATES = 2;
// Texas is untouched this sync. New Mexico's 7 actives match Border Report's "seven active"
// figure, published Oct 26, independently of the dashboard.
const EXPECTED_TX = { total: 57, active: 6 };
const EXPECTED_NM = { total: 9, active: 7 };
const EXPECTED_LUNA = { total: 1, active: 1 };
const EXPECTED_GRANT = { total: 3, active: 2 };
const EXPECTED_DONA_ANA = { total: 2, active: 2 };
const EXPECTED_HIDALGO = { total: 1, active: 1 };
const EXPECTED_OTERO = { total: 1, active: 1 };

const EXPECTED_TX_COUNTIES = 19;
const EXPECTED_NM_COUNTY_LIST = ['Dona Ana', 'Grant', 'Hidalgo', 'Lea', 'Luna', 'Otero'];

// Luna County, NM: roughly 31.78N (the Mexican border) to 32.52N, and -108.25W to -107.18W.
const LUNA_BOX = { latMin: 31.7, latMax: 32.6, lngMin: -108.3, lngMax: -107.1 };

// The highest APHIS refs already in the dataset, both on case 50 (Presidio, Sep 9). The new
// refs must exceed these; a lower number would mean the brief transposed a stale ref.
const PRIOR_MAX_REF = { SU: 26079, SS: 12230 };
const NEW_REFS = { SU: 28227, SS: 12716 };

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
    date: '2026-10-26',
    event: 'Case 67: cattle in Luna County, NM — the first case in Luna County, which becomes '
      + 'the twenty-fifth county of the US outbreak and New Mexico\'s sixth affected county. '
      + 'Luna closes the gap in the southwestern New Mexico cluster: it is bordered by Grant '
      + 'and Hidalgo to the west and Dona Ana to the east, so with this detection New Mexico\'s '
      + 'cases run unbroken along the Mexican border from Hidalgo through Luna to Dona Ana. The '
      + 'case was confirmed the same day USDA reopened the Columbus port of entry, in Luna '
      + 'County, to Mexican cattle imports — the third crossing restored under the phased '
      + 'reopening after Douglas, AZ and Santa Teresa, NM, and a route that normally carries a '
      + 'large share of the Mexican cattle entering the US. New Mexico rises to 9 cases across '
      + '6 counties, 7 of them active, which puts the state ahead of Texas on active cases for '
      + 'the first time in the outbreak — Texas holds 57 cases but only 6 active. US total '
      + 'reaches 66 animal cases with 13 active and 53 inactive across 25 counties in 2 '
      + 'states; 65 of the 66 are domestic animals and 1 is wildlife',
  },
];

const LAST_UPDATED = '2026-10-27T00:00:00Z';
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

  // Re-runnable: accept either the pre-sync state (65/12) or an already-applied post-sync
  // state (66/13), and reject anything else so it cannot be pointed at unknown data.
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

  // Luna must be a genuinely new county. This is what makes 24 -> 25 the correct county total
  // and what makes "New Mexico's sixth affected county" true; a pre-existing row would make
  // every ordinal in the notes and the timeline entry wrong.
  for (const [county, state] of [['Luna', 'NM']]) {
    const pre = await sql`
      SELECT id FROM screwworm_cases WHERE county = ${county} AND state = ${state}
        AND id NOT IN (67)
    `;
    if (pre.length > 0) {
      console.log(`✗ ${county} County, ${state} already has pre-existing case(s) `
        + `${JSON.stringify(pre.map(r => r.id))} — it is not a new county and the ordinals in this script are wrong`);
      process.exit(1);
    }
    console.log(`✓ ${county} County, ${state} has no pre-existing case — genuinely a new county`);
  }

  // Id 67 must be free and must be the next id after the current maximum. Id 15 is absent
  // from this dataset by design (a retracted case), so "count + 1" is NOT the next id —
  // max + 1 is, which is what the brief asked for.
  const maxId = Number((await sql`SELECT MAX(id) AS "m" FROM screwworm_cases WHERE id <> 67`)[0].m);
  if (maxId !== 66) {
    console.log(`✗ Highest existing id is ${maxId}, expected 66 — id 67 is not the next id`);
    process.exit(1);
  }
  console.log('✓ Id 67 is the next id after the current maximum (66); id 15 remains absent by design');

  // The new APHIS refs must advance past the highest refs already in the dataset.
  const allNotes = (await sql`SELECT notes FROM screwworm_cases`).map(r => r.notes).join(' ');
  for (const prefix of ['SU', 'SS']) {
    const seen = [...allNotes.matchAll(new RegExp(`${prefix}:(\\d+):(\\d+)`, 'g'))]
      .filter(m => Number(m[1]) !== NEW_REFS[prefix])
      .map(m => Number(m[1]));
    const maxSeen = Math.max(...seen);
    if (maxSeen !== PRIOR_MAX_REF[prefix]) {
      console.log(`✗ Highest existing ${prefix} ref is ${maxSeen}, expected ${PRIOR_MAX_REF[prefix]}`);
      process.exit(1);
    }
    if (NEW_REFS[prefix] <= maxSeen) {
      console.log(`✗ New ${prefix} ref ${NEW_REFS[prefix]} does not advance past ${maxSeen} — likely a stale or transposed ref`);
      process.exit(1);
    }
    console.log(`✓ ${prefix} ref ${NEW_REFS[prefix]} advances past the prior maximum ${maxSeen}`);
  }
  // Every pre-existing ref is FY2026 and every pre-existing ref belongs to a Jul-Sep case;
  // the new refs are the dataset's first FY2027 refs.
  const priorFY = new Set([...allNotes.matchAll(/(?:SU|SS):\d+:(\d+)/g)].map(m => m[1]));
  if (!(priorFY.size === 1 && priorFY.has('26')) && !(priorFY.size === 2 && priorFY.has('26') && priorFY.has('27'))) {
    console.log(`✗ Unexpected fiscal-year suffixes in existing refs: ${JSON.stringify([...priorFY])}`);
    process.exit(1);
  }
  console.log('✓ Refs SU:28227:27 / SS:12716:27 are the dataset\'s first FY2027 refs (FY2027 opened Oct 1, 2026)');

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

  // --- 2. Status transitions: none this sync, but prove it rather than assume it ---
  if (TO_INACTIVE.length > 0) {
    console.log('✗ TO_INACTIVE is non-empty but this sync is declared transition-free');
    process.exit(1);
  }
  console.log('✓ No status transitions this sync (CSV domestic active 12 -> 13 while adding one case)');

  // --- 3. Nothing outside the expected set may be active ---
  const stale = await sql`
    SELECT id, date, county, animal FROM screwworm_cases
    WHERE status = 'active' AND id NOT IN (54, 55, 56, 57, 59, 60, 61, 62, 63, 64, 65, 66, 67) ORDER BY id
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
  // Case 53 must still be the single domestic inactive October row — the CSV holds that
  // column at 1, so a second domestic October closure would mean the brief missed something.
  const case53 = (await sql`SELECT id, status FROM screwworm_cases WHERE id = 53`)[0];
  if (!case53 || case53.status !== 'inactive') {
    console.log(`✗ Case #53 is ${case53 ? case53.status : 'missing'} — expected inactive (carried from the Oct 26 sync)`);
    process.exit(1);
  }
  const octDomInactive = await sql`
    SELECT id, county, animal FROM screwworm_cases
    WHERE status = 'inactive' AND species <> 'Cervid' AND to_char(date, 'YYYY-MM') = '2026-10' ORDER BY id
  `;
  if (octDomInactive.length !== 1 || octDomInactive[0].id !== 53) {
    console.log(`✗ Expected exactly one domestic inactive October case (#53), got ${JSON.stringify(octDomInactive)}`);
    process.exit(1);
  }
  console.log('✓ Case #53 is still October\'s only domestic inactive row (matches "Inactive Cases - Domestic" = 1)');

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
  console.log('✓ Counts match APHIS (66 animal cases = 65 domestic + 1 wildlife, 13 active, 53 inactive)');

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

  // The CSV totals must close on the tracker: domestic 65 + 1 wildlife = 66.
  const domesticTotal = byMonth.reduce((s, r) => s + Number(r.domestic), 0);
  if (domesticTotal !== EXPECTED_DOMESTIC_AFTER || domesticTotal + 1 !== EXPECTED_TOTAL_AFTER) {
    console.log(`✗ Domestic total is ${domesticTotal}, expected ${EXPECTED_DOMESTIC_AFTER} (+1 wildlife = ${EXPECTED_TOTAL_AFTER})`);
    process.exit(1);
  }
  console.log(`✓ Domestic/wildlife split: ${domesticTotal} domestic + 1 wildlife = ${EXPECTED_TOTAL_AFTER} `
    + '(brief says domestic 65 / wildlife 1 — closes exactly)');

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

  // Texas is untouched this sync and must still hold exactly 19 counties.
  const txCounties = (await sql`SELECT DISTINCT county FROM screwworm_cases WHERE state = 'TX' ORDER BY county`).map(r => r.county);
  if (txCounties.length !== EXPECTED_TX_COUNTIES) {
    console.log(`✗ Texas has ${txCounties.length} counties, expected ${EXPECTED_TX_COUNTIES}: ${JSON.stringify(txCounties)}`);
    process.exit(1);
  }
  console.log(`✓ Texas counties: ${txCounties.length} (unchanged this sync)`);

  // New Mexico must now hold exactly six counties — the ordinal written into case 67's notes.
  const nmCounties = (await sql`SELECT DISTINCT county FROM screwworm_cases WHERE state = 'NM' ORDER BY county`).map(r => r.county);
  if (JSON.stringify(nmCounties) !== JSON.stringify(EXPECTED_NM_COUNTY_LIST)) {
    console.log(`✗ New Mexico counties ${JSON.stringify(nmCounties)} != ${JSON.stringify(EXPECTED_NM_COUNTY_LIST)}`);
    process.exit(1);
  }
  console.log(`✓ New Mexico counties: ${nmCounties.join(', ')} (Luna is the 6th)`);
  if (txCounties.length + nmCounties.length !== EXPECTED_COUNTIES) {
    console.log(`✗ ${txCounties.length} TX + ${nmCounties.length} NM != ${EXPECTED_COUNTIES} counties`);
    process.exit(1);
  }
  console.log(`✓ ${txCounties.length} TX + ${nmCounties.length} NM = ${EXPECTED_COUNTIES} counties`);

  for (const [label, where, want] of [
    ['Texas', sql`SELECT COUNT(*) AS "total", COUNT(*) FILTER (WHERE status = 'active') AS "active" FROM screwworm_cases WHERE state = 'TX'`, EXPECTED_TX],
    ['New Mexico', sql`SELECT COUNT(*) AS "total", COUNT(*) FILTER (WHERE status = 'active') AS "active" FROM screwworm_cases WHERE state = 'NM'`, EXPECTED_NM],
    ['Luna County', sql`SELECT COUNT(*) AS "total", COUNT(*) FILTER (WHERE status = 'active') AS "active" FROM screwworm_cases WHERE county = 'Luna' AND state = 'NM'`, EXPECTED_LUNA],
    ['Grant County', sql`SELECT COUNT(*) AS "total", COUNT(*) FILTER (WHERE status = 'active') AS "active" FROM screwworm_cases WHERE county = 'Grant' AND state = 'NM'`, EXPECTED_GRANT],
    ['Dona Ana County', sql`SELECT COUNT(*) AS "total", COUNT(*) FILTER (WHERE status = 'active') AS "active" FROM screwworm_cases WHERE county = 'Dona Ana' AND state = 'NM'`, EXPECTED_DONA_ANA],
    ['Hidalgo County', sql`SELECT COUNT(*) AS "total", COUNT(*) FILTER (WHERE status = 'active') AS "active" FROM screwworm_cases WHERE county = 'Hidalgo' AND state = 'NM'`, EXPECTED_HIDALGO],
    ['Otero County', sql`SELECT COUNT(*) AS "total", COUNT(*) FILTER (WHERE status = 'active') AS "active" FROM screwworm_cases WHERE county = 'Otero' AND state = 'NM'`, EXPECTED_OTERO],
  ]) {
    const row = (await where)[0];
    if (Number(row.total) !== want.total || Number(row.active) !== want.active) {
      console.log(`✗ ${label} ${row.total} cases / ${row.active} active != ${want.total} / ${want.active}`);
      process.exit(1);
    }
    console.log(`✓ ${label}: ${row.total} cases, ${row.active} active`);
  }
  if (EXPECTED_TX.total + EXPECTED_NM.total !== EXPECTED_TOTAL_AFTER) {
    console.log(`✗ TX ${EXPECTED_TX.total} + NM ${EXPECTED_NM.total} != ${EXPECTED_TOTAL_AFTER}`);
    process.exit(1);
  }
  console.log(`✓ TX ${EXPECTED_TX.total} + NM ${EXPECTED_NM.total} = ${EXPECTED_TOTAL_AFTER}`);

  // New Mexico's active count must be 7 — Border Report's independently published figure, and
  // the claim written into the timeline entry that NM now leads Texas on active cases.
  if (EXPECTED_NM.active !== 7) {
    console.log(`✗ EXPECTED_NM.active is ${EXPECTED_NM.active}, but Border Report reports 7 NM actives`);
    process.exit(1);
  }
  if (EXPECTED_NM.active <= EXPECTED_TX.active) {
    console.log(`✗ Timeline entry claims New Mexico now leads Texas on active cases, but NM `
      + `${EXPECTED_NM.active} !> TX ${EXPECTED_TX.active}`);
    process.exit(1);
  }
  console.log(`✓ New Mexico ${EXPECTED_NM.active} active > Texas ${EXPECTED_TX.active} active `
    + '(matches Border Report\'s "seven active" for NM, Oct 26)');

  // Luna, Hidalgo and Dona Ana are all border counties, and Luna adjoins both of the others —
  // which is what makes the "unbroken along the Mexican border" claim in the notes true.
  const borderChain = await sql`
    SELECT county, COUNT(*) AS "n" FROM screwworm_cases
    WHERE state = 'NM' AND county IN ('Hidalgo', 'Luna', 'Dona Ana') GROUP BY 1 ORDER BY 1
  `;
  if (borderChain.length !== 3) {
    console.log(`✗ Expected cases in all three NM border counties (Hidalgo, Luna, Dona Ana), got ${JSON.stringify(borderChain)}`);
    process.exit(1);
  }
  console.log(`✓ All three NM border counties hold cases: ${borderChain.map(r => `${r.county} ${r.n}`).join(', ')}`);

  // Exactly one wildlife case, it is still the elk, and it is still inactive.
  const cervids = await sql`SELECT id, animal, county, state, status FROM screwworm_cases WHERE species = 'Cervid' ORDER BY id`;
  if (cervids.length !== 1 || cervids[0].id !== 58 || cervids[0].animal !== 'Elk' || cervids[0].status !== 'inactive') {
    console.log(`✗ Expected exactly one Cervid row (#58 Elk, inactive), got ${JSON.stringify(cervids)}`);
    process.exit(1);
  }
  console.log(`✓ Wildlife: 1 Cervid row — #58 Elk, ${cervids[0].county} County, ${cervids[0].state}, inactive`);

  // Every active case must be a domestic animal, which is what makes the CSV's domestic-only
  // active column of 13 equal the tracker's 13 actives.
  const activeWildlife = await sql`SELECT id FROM screwworm_cases WHERE status = 'active' AND species = 'Cervid'`;
  if (activeWildlife.length > 0) {
    console.log(`✗ Wildlife case still active: ${JSON.stringify(activeWildlife)}`);
    process.exit(1);
  }
  console.log('✓ All 13 active cases are domestic animals (matches "Active Cases - Domestic" = 13)');

  // Every active case is an October detection, and the active split is 6 TX / 7 NM.
  const nonOctActive = await sql`SELECT id, date FROM screwworm_cases WHERE status = 'active' AND to_char(date, 'YYYY-MM') <> '2026-10'`;
  if (nonOctActive.length > 0) {
    console.log(`✗ Active case outside October: ${JSON.stringify(nonOctActive)}`);
    process.exit(1);
  }
  const activeSplit = await sql`
    SELECT state, COUNT(*) AS "n" FROM screwworm_cases WHERE status = 'active' GROUP BY 1 ORDER BY 1
  `;
  const splitMap = Object.fromEntries(activeSplit.map(r => [r.state, Number(r.n)]));
  if (splitMap.TX !== 6 || splitMap.NM !== 7) {
    console.log(`✗ Active split ${JSON.stringify(splitMap)} != 6 TX / 7 NM`);
    process.exit(1);
  }
  console.log('✓ All 13 actives are October detections, split 6 TX / 7 NM');

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
  // The new case's own fields must match in both stores.
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
  if (json.lastUpdated !== LAST_UPDATED) {
    console.log(`✗ Fallback lastUpdated is ${json.lastUpdated}, expected ${LAST_UPDATED}`);
    process.exit(1);
  }
  const dbLastUpdated = (await sql`SELECT value FROM screwworm_metadata WHERE key = 'lastUpdated'`)[0].value;
  const dbLastUpdatedStr = typeof dbLastUpdated === 'string' ? dbLastUpdated.replace(/^"|"$/g, '') : dbLastUpdated;
  if (dbLastUpdatedStr !== LAST_UPDATED) {
    console.log(`✗ DB lastUpdated is ${JSON.stringify(dbLastUpdatedStr)}, expected ${LAST_UPDATED}`);
    process.exit(1);
  }
  console.log(`✓ lastUpdated = ${LAST_UPDATED} in both DB and fallback`);
  console.log(`✓ Fallback JSON in parity with DB (${jsonIds.length} cases, all statuses match, ${mergedTimeline.length} timeline entries)`);

  // The new coordinates must sit inside Luna County and must not collide with any other pin.
  const luna = (await sql`SELECT lat, lng FROM screwworm_cases WHERE id = 67`)[0];
  if (Number(luna.lat) < LUNA_BOX.latMin || Number(luna.lat) > LUNA_BOX.latMax
      || Number(luna.lng) < LUNA_BOX.lngMin || Number(luna.lng) > LUNA_BOX.lngMax) {
    console.log(`✗ Case #67 coordinates (${luna.lat}, ${luna.lng}) fall outside Luna County's bounding box `
      + `${JSON.stringify(LUNA_BOX)}`);
    process.exit(1);
  }
  console.log(`✓ Case #67 coordinates (${luna.lat}, ${luna.lng}) fall inside Luna County (county seat Deming)`);
  const collide = await sql`
    SELECT id, county, state FROM screwworm_cases
    WHERE id <> 67 AND lat = ${luna.lat} AND lng = ${luna.lng}
  `;
  if (collide.length > 0) {
    console.log(`✗ Case #67 shares coordinates with ${JSON.stringify(collide)} — pins would overlap`);
    process.exit(1);
  }
  console.log('✓ Case #67 coordinates are unique — no overlapping pins');

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
