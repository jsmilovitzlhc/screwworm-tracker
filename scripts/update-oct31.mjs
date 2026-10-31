import { neon } from '@neondatabase/serverless';
import { readFileSync, writeFileSync } from 'fs';

const envFile = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}

const sql = neon(process.env.DATABASE_URL);

// APHIS sync Oct 31, 2026 — ONE new domestic case, a dog. 74 -> 75 animal cases,
// 21 -> 22 active, 53 inactive (unchanged), 27 counties (unchanged), 3 states (unchanged).
//
// ---------------------------------------------------------------------------------------
// THE BRIEF FOR THIS SYNC IS CORRECT ON THE CASE — the first sync in three where that is true.
// The two previous syncs both understated the count (Oct 29: brief said 1, export held 5;
// Oct 30: brief said 1, export held 3), so this script still diffs the full case-level export
// row-by-row rather than trusting the brief. The diff this time leaves exactly one unmatched
// row, and it is the brief's row:
//
//   76  2026-10-30  Dona Ana, NM  Dog  SU:28348:27  SS:12774:27
//
// Every claim the brief made about it is confirmed against the export and the data, and each
// one is asserted at the end of this script: Dona Ana's sixth case, New Mexico's fifteenth, the
// tenth canine detection of the outbreak, the county's third dog in four days (after case 68 on
// Oct 27 and case 71 on Oct 28 — both ids verified), Dona Ana at 6 cases all active and still
// the outbreak's largest active cluster, and an end state of 75 animal cases / 22 active.
//
// ONE THING THE BRIEF GOT WRONG, and it is the fly-trap aside, not the case. The brief says
// "a wild fly trap detection was confirmed in Luna County, NM on Oct 28". The APHIS export says
// DONA ANA County, confirmed date Oct 29:
//     New Mexico, DONA ANA, SU:28266:27, SS:12757:27   10/29/2026   Fly   Inactive   Fly Trap
// Wrong county and wrong date. It is still genuinely new — yesterday's export carried one fly
// trap row (Brewster, TX, Sep 25) and today's carries two — so the row appeared in the export
// after the Oct 30 sync despite its Oct 29 confirmed date. It is also the FIRST wild fly
// detection in New Mexico, and it lands in the same county as the new dog case.
//
// This tracker records animal cases, not fly-trap detections, so NEITHER fly trap row is
// inserted — that exclusion is what keeps the tracker's September total at 3 against the APHIS
// rollup's 4, and it now keeps October at 24 against the rollup's total of 25. The exclusion is
// asserted below (no tracker row may carry the species "Fly"), so a future sync cannot quietly
// pull one in and double-count a county.
//
// ---------------------------------------------------------------------------------------
// SOURCES
//
// 1. APHIS public Tableau CASE-LEVEL export (publicdashboards.dl.usda.gov/t/MRP_PUB/views/
//    NewWorldScrewwormPublicReporting_17805168329840/ExportToCSV.csv), fetched Oct 31 05:35 ET.
//    77 rows: 74 Domestic, 1 Wildlife & Feral (the Oct 21 Pecos elk), 2 Fly Trap (Brewster
//    Sep 25 and the new Dona Ana Oct 29 — wild fly detections, not animal cases, deliberately
//    not in this tracker). 75 animal rows, 22 Active, 53 Inactive. Diffed row-by-row against
//    all 74 tracker cases on (date, county, state, species, status); the row above is the only
//    one with no tracker match. Both fly-trap rows are Inactive, so all 22 actives in the
//    export are animal cases and the tracker's 22 is the same 22.
//
// 2. APHIS public Tableau SummaryDashboard.csv rollup, fetched in the same minute. It is an
//    INDEPENDENT aggregation of the same data and it agrees with the case-level export on
//    every month still inside its window:
//        Jul 2026   0 active / 14 inactive domestic,  14 domestic,  14 total
//        Aug 2026   0 active /  4 inactive domestic,   4 domestic,   4 total
//        Sep 2026   0 active /  3 inactive domestic,   3 domestic,   4 total  (+1 fly trap)
//        Oct 2026  22 active /  1 inactive domestic,  23 domestic,  25 total  (+1 wildlife, +1 fly trap)
//    22 active for October, and no actives in any other month, is what independently confirms
//    the 22 active this script lands on. October's total of 25 against 23 domestic is now a
//    GAP OF TWO, not one: the elk and the new fly trap. The tracker carries the elk and not the
//    fly trap, which is exactly why APHIS_BY_MONTH below puts October at 24.
//    CAVEAT carried forward from every sync since Sep 30: the rollup's month window has
//    scrolled, so June (30 cases, all inactive) has dropped out of it. June is still asserted
//    below from the case-level export, which does still carry it.
//
// 3. No press corroboration exists for this case yet. New Mexico coverage has been running two
//    to three days behind the dashboard for the whole Dona Ana cluster, so source 1 is the
//    basis here, as it was for the Oct 28-29 cases. The standing ScrewwormNM.org advisory and
//    the 12.4-mile Las Cruces infested zone already cover this detection's footprint, so no
//    state-response text needs refreshing this sync.
//
// ---------------------------------------------------------------------------------------
// WHAT THIS CASE MEANS FOR THE SHAPE OF THE OUTBREAK
//
// Dona Ana now holds 6 cases, all active, across FOUR species — 2 cattle, 1 sheep, 3 dogs — in
// seven days. It is the outbreak's largest active cluster by a factor of two (next is Grant, NM
// at 3) and New Mexico's largest cluster by total cases. Three of its six cases are dogs, and
// dogs do not move through the livestock permit system the response is built around, so a third
// canine detection in four days in one county is the clearest signal yet that the fly is
// breeding locally there rather than arriving with shipments. The Dona Ana fly-trap detection
// noted above, in the same county two days earlier, is independent evidence of the same thing.
// New Mexico now holds 13 of the outbreak's 22 active cases against Texas's 8 and Arizona's 1 —
// more than both combined, from a state that had 5 cases in total a fortnight ago.
//
// ---------------------------------------------------------------------------------------
// PRE-EXISTING DRIFT, DELIBERATELY NOT TOUCHED HERE
//
// Diffing the tracker's 74 existing cases against source 1 leaves exactly four mismatches, all
// off-by-one on the date and all pre-dating this sync (unchanged from the last two syncs):
//     Medina TX cattle       tracker 2026-06-23  vs  APHIS 2026-06-24
//     Pecos TX dog           tracker 2026-06-30  vs  APHIS 2026-06-29
//     Starr TX cattle        tracker 2026-07-17  vs  APHIS 2026-07-18
//     Val Verde TX cattle    tracker 2026-10-20  vs  APHIS 2026-10-21
// The drift runs in BOTH directions, so it is not a timezone bug. All four stay inside their
// original month, so no monthly, county, state, species or status total below is affected.
// Four tracker rows also record the APHIS species "Cattle" as "Calf" (ids 1, 2, 3, 6) and one
// records "Goats" as "Goat" (id 42); same situation — cosmetic, in-species, not this sync's
// business. The DB/fallback coordinate drift on ids 21 and 28, and the stacked Sutton pin on
// ids 12 and 42, are likewise pinned and not fixed. Changing any of it is a separate decision.
// The assertions pin all of it so it cannot drift further unnoticed.
//
// The documented id-ordering artifact on Oct 28 (case 73 carries a lower APHIS reference than
// cases 71 and 72 despite a higher id, because it was a backfill) is re-asserted here too.
//
// No code changes ship with this sync: Canine is long since wired through the chart, the API
// labels, the breakdown classes, the CSS and the cron normaliser. The species-wiring assertions
// at the end re-verify that anyway.

const JSON_PATH = '/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/src/data/cases.json';

const NEW_CASES = [
  {
    id: 76,
    date: '2026-10-30',
    species: 'Canine',
    animal: 'Dog',
    county: 'Dona Ana',
    state: 'NM',
    lat: 32.3513,
    lng: -106.7415,
    status: 'active',
    notes: 'Sixth Dona Ana County case and New Mexico\'s fifteenth case; the TENTH CANINE (dog) '
      + 'detection of the US outbreak and the county\'s THIRD DOG IN FOUR DAYS, after the Oct 27 dog '
      + '(case 68) and the Oct 28 dog (case 71). Dona Ana remains the outbreak\'s LARGEST ACTIVE '
      + 'CLUSTER and widens its lead to a factor of two: 6 cases, all active, across three '
      + 'species — 2 cattle, 1 sheep and 3 dogs — against Grant County, NM at 3 active. It is also '
      + 'New Mexico\'s largest cluster by total cases, ahead of Grant at 4; Crockett County, TX is '
      + 'still the largest cluster by total cases overall at 13, though all 13 are long since '
      + 'closed. All six Dona Ana cases landed inside seven days: two on Oct 24, a two-day gap '
      + 'across Oct 25 and Oct 26, then one each on Oct 27, Oct 28, Oct 29 and Oct 30 — a four-day '
      + 'unbroken run. Half the cluster is now dogs, and dogs move outside the livestock permit '
      + 'system the response depends on, so a third canine detection in four days in one county '
      + 'points to the fly breeding locally rather than arriving with shipments; APHIS also '
      + 'confirmed a WILD FLY TRAP detection in Dona Ana County on Oct 29 (SU:28266:27), the first '
      + 'in New Mexico, which is independent evidence of the same thing — fly-trap detections are '
      + 'not animal cases and are not counted in this tracker. Las Cruces and the New Mexico State '
      + 'University campus both fall inside the resulting 12.4-mile infested zone. New Mexico now '
      + 'holds 13 of the outbreak\'s 22 active cases, more than Texas (8) and Arizona (1) combined. '
      + 'Domestic animal; APHIS reports location at county level, so the coordinates are offset '
      + 'slightly from the other five Dona Ana cases near the county seat (Las Cruces) so the pins '
      + 'do not render on top of each other; SU:28348:27, SS:12774:27; confirmed per APHIS '
      + 'dashboard Oct 30',
  },
];

const NEW_IDS = NEW_CASES.map(c => c.id);
const NEW_REFS = {
  76: { SU: 28348, SS: 12774 },
};

const TIMELINE_ENTRIES = [
  {
    date: '2026-10-30',
    event: 'Case 76: a dog in Dona Ana County, NM — the county\'s sixth case in seven days and its '
      + 'THIRD DOG IN FOUR DAYS, after the dogs of Oct 27 and Oct 28, and the tenth canine detection '
      + 'of the US outbreak. Dona Ana now holds 6 cases, all active, across three species (2 cattle, '
      + '1 sheep, 3 dogs), which doubles its lead as the outbreak\'s largest active cluster over '
      + 'Grant County, NM at 3. Half the cluster is dogs, which move outside the livestock permit '
      + 'system the response is built around; APHIS also confirmed the first WILD FLY TRAP detection '
      + 'in New Mexico in the same county on Oct 29, so both lines of evidence now point to the fly '
      + 'breeding locally around Las Cruces rather than arriving with shipments. The outbreak reaches '
      + '75 animal cases with 22 active and 53 inactive across 27 counties in 3 states; 74 of the 75 '
      + 'are domestic animals and 1 is wildlife. New Mexico holds 13 of the 22 actives from 15 cases '
      + 'across 6 counties — more than Texas (8 active from 59 cases) and Arizona (1) combined.',
  },
];

const LAST_UPDATED = '2026-10-31T00:00:00Z';
const LAST_CHECKED = new Date().toISOString();

// ---- The truth table this sync asserts, from sources 1 and 2 ----
const EXPECTED_TOTAL_BEFORE = 74;
const EXPECTED_TOTAL_AFTER = 75;
const EXPECTED_ACTIVE_BEFORE_COUNT = 21;
const EXPECTED_ACTIVE_AFTER_COUNT = 22;
const EXPECTED_INACTIVE_AFTER = 53;
const EXPECTED_COUNTIES = 27;

const EXPECTED_TX = { total: 59, active: 8 };
const EXPECTED_NM = { total: 15, active: 13 };
const EXPECTED_AZ = { total: 1, active: 1 };
const EXPECTED_ACTIVE_SPLIT = { AZ: 1, NM: 13, TX: 8 };

const EXPECTED_TX_COUNTY_COUNT = 20;
const EXPECTED_NM_COUNTY_LIST = ['Dona Ana', 'Grant', 'Hidalgo', 'Lea', 'Luna', 'Otero'];
const EXPECTED_AZ_COUNTY_LIST = ['Cochise'];

const APHIS_BY_SPECIES = { Bovine: 35, Canine: 10, Caprine: 7, Cervid: 1, Equine: 4, Feline: 1, Ovine: 17 };
const SPECIES_LABEL = {
  Bovine: 'Bovine (Cattle)', Canine: 'Canine (Dogs)', Caprine: 'Caprine (Goats)',
  Cervid: 'Cervid (Elk)', Equine: 'Equine (Horses)', Feline: 'Feline (Cats)', Ovine: 'Ovine (Sheep)',
};
const APHIS_SPECIES_LABEL = {
  Bovine: 'Cattle', Canine: 'Dog', Caprine: 'Goats', Cervid: 'Elk',
  Equine: 'Horse', Feline: 'Domestic Cat', Ovine: 'Sheep',
};

// Tracker months. These EXCLUDE both fly-trap rows (Brewster Sep 25 and Dona Ana Oct 29), which
// are wild fly detections and not animal cases. That exclusion is the whole of the difference
// from source 2's September total of 4, and one of the two differences from its October total
// of 25 (the other being the Pecos elk, which the tracker DOES carry).
const APHIS_BY_MONTH = {
  '2026-06': { total: 30, active: 0 },
  '2026-07': { total: 14, active: 0 },
  '2026-08': { total: 4, active: 0 },
  '2026-09': { total: 3, active: 0 },
  '2026-10': { total: 24, active: 22 },
};

// County totals this sync touches or whose notes make a claim about them.
const EXPECTED_COUNTY_TOTALS = [
  ['Dona Ana', 'NM', { total: 6, active: 6 }],
  ['Grant', 'NM', { total: 4, active: 3 }],
  ['Luna', 'NM', { total: 2, active: 2 }],
  ['Crockett', 'TX', { total: 13, active: 0 }],
  ['Presidio', 'TX', { total: 2, active: 1 }],
  ['El Paso', 'TX', { total: 1, active: 1 }],
  ['Cochise', 'AZ', { total: 1, active: 1 }],
];

// Dona Ana's species split, which the notes and the timeline entry both state outright.
const EXPECTED_DONA_SPLIT = { Bovine: 2, Canine: 3, Ovine: 1 };

// Pre-existing drift, pinned so it cannot get worse (see the header note).
const KNOWN_DATE_DRIFT = [
  [20, '2026-06-23'], [29, '2026-06-30'], [41, '2026-07-17'], [60, '2026-10-20'],
];
const KNOWN_ANIMAL_DRIFT = [[1, 'Calf'], [2, 'Calf'], [3, 'Calf'], [6, 'Calf'], [42, 'Goat']];

// Pre-existing DB/fallback coordinate drift, carried forward unchanged from the Oct 30 sync.
// Neither value is knowable as "right" from APHIS data (county-level reporting), both cases are
// long inactive, and /api/cases serves coordinates from the DB so production is self-consistent.
// Pinned, not fixed.
const KNOWN_COORD_DRIFT = {
  21: { db: [29.987810885824565, -100.20048911417544], json: [29.9427, -100.2356] },
  28: { db: [29.21291626177021, -99.78298373822979], json: [29.2129, -99.783] },
};

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

function fail(msg) {
  console.log(`✗ ${msg}`);
  process.exit(1);
}

try {
  // ---- Internal consistency of this script's own truth table, before touching the DB ----
  if (Object.values(APHIS_BY_SPECIES).reduce((s, n) => s + n, 0) !== EXPECTED_TOTAL_AFTER) {
    fail('APHIS_BY_SPECIES does not sum to EXPECTED_TOTAL_AFTER');
  }
  if (EXPECTED_TX.total + EXPECTED_NM.total + EXPECTED_AZ.total !== EXPECTED_TOTAL_AFTER) {
    fail('TX + NM + AZ totals do not sum to EXPECTED_TOTAL_AFTER');
  }
  if (EXPECTED_TX.active + EXPECTED_NM.active + EXPECTED_AZ.active !== EXPECTED_ACTIVE_AFTER_COUNT) {
    fail('TX + NM + AZ actives do not sum to EXPECTED_ACTIVE_AFTER_COUNT');
  }
  if (EXPECTED_TOTAL_BEFORE + NEW_CASES.length !== EXPECTED_TOTAL_AFTER) {
    fail(`${EXPECTED_TOTAL_BEFORE} + ${NEW_CASES.length} new != ${EXPECTED_TOTAL_AFTER}`);
  }
  if (EXPECTED_ACTIVE_BEFORE_COUNT + NEW_CASES.length !== EXPECTED_ACTIVE_AFTER_COUNT) {
    fail('Active count does not advance by exactly the number of new cases');
  }
  if (EXPECTED_ACTIVE_AFTER_COUNT + EXPECTED_INACTIVE_AFTER !== EXPECTED_TOTAL_AFTER) {
    fail('active + inactive != total');
  }
  if (EXPECTED_TX_COUNTY_COUNT + EXPECTED_NM_COUNTY_LIST.length + EXPECTED_AZ_COUNTY_LIST.length !== EXPECTED_COUNTIES) {
    fail('TX + NM + AZ county counts do not sum to EXPECTED_COUNTIES');
  }
  const monthTotal = Object.values(APHIS_BY_MONTH).reduce((s, m) => s + m.total, 0);
  if (monthTotal !== EXPECTED_TOTAL_AFTER) fail(`APHIS_BY_MONTH totals sum to ${monthTotal}`);
  const monthActive = Object.values(APHIS_BY_MONTH).reduce((s, m) => s + m.active, 0);
  if (monthActive !== EXPECTED_ACTIVE_AFTER_COUNT) fail(`APHIS_BY_MONTH actives sum to ${monthActive}`);
  if (Object.values(EXPECTED_ACTIVE_SPLIT).reduce((s, n) => s + n, 0) !== EXPECTED_ACTIVE_AFTER_COUNT) {
    fail('EXPECTED_ACTIVE_SPLIT does not sum to EXPECTED_ACTIVE_AFTER_COUNT');
  }
  // The notes and timeline both claim NM holds more actives than TX and AZ combined.
  if (!(EXPECTED_ACTIVE_SPLIT.NM > EXPECTED_ACTIVE_SPLIT.TX + EXPECTED_ACTIVE_SPLIT.AZ)) {
    fail('The truth table does not support the "NM > TX + AZ" claim in the notes');
  }
  // Dona Ana's claimed split must sum to its claimed total and hold 3 dogs.
  const donaClaimTotal = Object.values(EXPECTED_DONA_SPLIT).reduce((s, n) => s + n, 0);
  const donaExpected = EXPECTED_COUNTY_TOTALS.find(([c, s]) => c === 'Dona Ana' && s === 'NM')[2];
  if (donaClaimTotal !== donaExpected.total) fail(`EXPECTED_DONA_SPLIT sums to ${donaClaimTotal}, not ${donaExpected.total}`);
  if (EXPECTED_DONA_SPLIT.Canine !== 3) fail('The notes claim three Dona Ana dogs');
  // The notes and the timeline entry both state Dona Ana's species count in words. An earlier
  // draft of this script said "four species" against a three-species split; this assertion is
  // what caught it, so it checks the prose against the split rather than trusting either.
  const DONA_SPECIES_WORD = 'three';
  if (Object.keys(EXPECTED_DONA_SPLIT).length !== 3) {
    fail(`EXPECTED_DONA_SPLIT holds ${Object.keys(EXPECTED_DONA_SPLIT).length} species but the prose says "${DONA_SPECIES_WORD}"`);
  }
  for (const [label, text] of [['case 76 notes', NEW_CASES[0].notes], ['the Oct 30 timeline entry', TIMELINE_ENTRIES[0].event]]) {
    const m = text.match(/across (\w+) species|spanning (\w+) species|(\w+) species \(/);
    if (!m) fail(`${label} no longer states Dona Ana's species count, so it cannot be checked`);
    const word = m[1] || m[2] || m[3];
    if (word !== DONA_SPECIES_WORD) fail(`${label} says "${word} species", but the split has ${Object.keys(EXPECTED_DONA_SPLIT).length}`);
  }
  console.log(`✓ Both prose blocks say "${DONA_SPECIES_WORD} species", matching the ${Object.keys(EXPECTED_DONA_SPLIT).length}-species Dona Ana split`);
  if (new Set(NEW_IDS).size !== NEW_IDS.length) fail('Duplicate id in NEW_CASES');
  // The one new case this sync adds is an active dog, which is what makes active advance by 1
  // and Canine advance by 1.
  if (NEW_CASES.some(c => c.species !== 'Canine' || c.animal !== 'Dog' || c.status !== 'active')) {
    fail('This sync asserts its only new case is an active Canine/Dog');
  }
  console.log('✓ This script\'s own truth table is internally consistent');

  // Each new case's notes must actually carry the APHIS references attributed to it.
  for (const c of NEW_CASES) {
    const { SU, SS } = NEW_REFS[c.id];
    if (!c.notes.includes(`SU:${SU}:27`) || !c.notes.includes(`SS:${SS}:27`)) {
      fail(`Case ${c.id} notes do not carry SU:${SU}:27 / SS:${SS}:27`);
    }
  }
  console.log('✓ Every new case carries its APHIS reference pair in the notes');

  // This script is re-runnable: if a previous run already inserted the case, the pre-insert
  // assertions below describe a state that no longer exists, so they are skipped and every
  // post-insert assertion still runs as a full re-verification.
  const presentIds = (await sql`SELECT id FROM screwworm_cases WHERE id = ANY(${NEW_IDS}) ORDER BY id`).map(r => r.id);
  if (presentIds.length !== 0 && presentIds.length !== NEW_IDS.length) {
    fail(`Partially applied: ids ${JSON.stringify(presentIds)} exist but ${JSON.stringify(NEW_IDS)} were expected together`);
  }
  const ALREADY_APPLIED = presentIds.length === NEW_IDS.length;
  if (ALREADY_APPLIED) console.log('This sync is already applied — re-running as verification only');

  const before = await sql`
    SELECT COUNT(*) AS "total",
           COUNT(*) FILTER (WHERE status = 'active') AS "active",
           COUNT(*) FILTER (WHERE status = 'inactive') AS "inactive"
    FROM screwworm_cases
  `;
  const totalBefore = Number(before[0].total);
  const activeBeforeN = Number(before[0].active);
  console.log(`DB before: ${totalBefore} cases, ${activeBeforeN} active, ${before[0].inactive} inactive`);
  const wantTotalBefore = ALREADY_APPLIED ? EXPECTED_TOTAL_AFTER : EXPECTED_TOTAL_BEFORE;
  const wantActiveBefore = ALREADY_APPLIED ? EXPECTED_ACTIVE_AFTER_COUNT : EXPECTED_ACTIVE_BEFORE_COUNT;
  if (totalBefore !== wantTotalBefore) fail(`Expected ${wantTotalBefore} cases before, found ${totalBefore}`);
  if (activeBeforeN !== wantActiveBefore) fail(`Expected ${wantActiveBefore} active before, found ${activeBeforeN}`);
  if (Number(before[0].inactive) !== EXPECTED_INACTIVE_AFTER) {
    fail(`Expected ${EXPECTED_INACTIVE_AFTER} inactive before (this sync adds no inactive cases), found ${before[0].inactive}`);
  }

  const activeBefore = (await sql`SELECT id FROM screwworm_cases WHERE status = 'active' ORDER BY id`)
    .map(r => r.id).filter(id => !NEW_IDS.includes(id));

  const maxId = Number((await sql`SELECT MAX(id) AS "m" FROM screwworm_cases WHERE id <> ALL(${NEW_IDS})`)[0].m);
  // (excludes this sync's own ids, so it reads the same on a first run and a re-run)
  if (maxId !== Math.min(...NEW_IDS) - 1) {
    fail(`Highest existing id is ${maxId}, so the new ids should start at ${maxId + 1}, not ${Math.min(...NEW_IDS)}`);
  }
  console.log(`✓ New id ${NEW_IDS.join('/')} follows the highest existing id (${maxId})`);

  // No pre-existing row may already claim this sync's APHIS references. This also catches the
  // Dona Ana FLY TRAP reference (SU:28266:27) being pulled in by mistake, since no tracker row
  // may carry it either.
  const allNotes = (await sql`SELECT notes FROM screwworm_cases WHERE id <> ALL(${NEW_IDS})`).map(r => r.notes).join(' ');
  for (const [id, { SU, SS }] of Object.entries(NEW_REFS)) {
    if (allNotes.includes(`SU:${SU}:27`)) fail(`SU:${SU}:27 (case ${id}) is already recorded on another case`);
    if (allNotes.includes(`SS:${SS}:27`)) fail(`SS:${SS}:27 (case ${id}) is already recorded on another case`);
  }
  console.log('✓ None of this sync\'s APHIS references are already in the data');

  // ---- Pre-insert shape assertions (skipped on a re-run, where the state has moved on) ----
  if (ALREADY_APPLIED) {
    console.log('… skipping pre-insert shape assertions (already applied)');
  } else {
    // Dona Ana must already hold exactly 5 cases, all active, as 2 cattle / 1 sheep / 2 dogs —
    // which is what makes this case the sixth and the third dog.
    const donaBefore = await sql`
      SELECT species, COUNT(*) AS "n", COUNT(*) FILTER (WHERE status = 'active') AS "a"
      FROM screwworm_cases WHERE county = 'Dona Ana' AND state = 'NM' AND id <> ALL(${NEW_IDS}) GROUP BY 1 ORDER BY 1
    `;
    const donaMap = Object.fromEntries(donaBefore.map(r => [r.species, Number(r.n)]));
    if (JSON.stringify(donaMap) !== JSON.stringify({ Bovine: 2, Canine: 2, Ovine: 1 })) {
      fail(`Case 76's notes imply Dona Ana held 2 cattle / 2 dogs / 1 sheep before this sync, got ${JSON.stringify(donaMap)}`);
    }
    if (donaBefore.some(r => Number(r.a) !== Number(r.n))) fail('A pre-existing Dona Ana case is not active');
    console.log('✓ Dona Ana held 5 cases before this sync — 2 Bovine, 1 Ovine, 2 Canine, all active');

    // The two earlier Dona Ana dogs the notes name by id must be exactly cases 68 (Oct 27) and
    // 71 (Oct 28). This is the brief's own claim and it is the one worth pinning hardest.
    const donaDogsBefore = (await sql`
      SELECT id, to_char(date, 'YYYY-MM-DD') AS "d" FROM screwworm_cases
      WHERE county = 'Dona Ana' AND state = 'NM' AND species = 'Canine' AND id <> ALL(${NEW_IDS}) ORDER BY date, id
    `).map(r => [r.id, r.d]);
    const wantDogsBefore = [[68, '2026-10-27'], [71, '2026-10-28']];
    if (JSON.stringify(donaDogsBefore) !== JSON.stringify(wantDogsBefore)) {
      fail(`Case 76's notes name cases 68 (Oct 27) and 71 (Oct 28) as the earlier Dona Ana dogs, got ${JSON.stringify(donaDogsBefore)}`);
    }
    console.log('✓ The earlier Dona Ana dogs are cases 68 (Oct 27) and 71 (Oct 28), as the notes say');

    // Canine must stand at 9 before this sync, making the new case the tenth.
    const canineBefore = Number((await sql`
      SELECT COUNT(*) AS "n" FROM screwworm_cases WHERE species = 'Canine' AND id <> ALL(${NEW_IDS})
    `)[0].n);
    if (canineBefore !== APHIS_BY_SPECIES.Canine - 1) {
      fail(`Case 76's notes call it the tenth canine, but there are ${canineBefore} canines before it`);
    }
    console.log(`✓ ${canineBefore} canine cases before this sync, so case 76 is the tenth`);
  }

  // ---- 1. Insert the new cases ----
  for (const NEW_CASE of NEW_CASES) {
    const existing = await sql`SELECT id FROM screwworm_cases WHERE id = ${NEW_CASE.id}`;
    if (existing.length > 0) {
      console.log(`Case ${NEW_CASE.id} already exists — skipping insert`);
      continue;
    }
    const inserted = await sql`
      INSERT INTO screwworm_cases (id, date, species, animal, county, state, lat, lng, status, notes)
      VALUES (${NEW_CASE.id}, ${NEW_CASE.date}, ${NEW_CASE.species}, ${NEW_CASE.animal}, ${NEW_CASE.county},
              ${NEW_CASE.state}, ${NEW_CASE.lat}, ${NEW_CASE.lng}, ${NEW_CASE.status}, ${NEW_CASE.notes})
      RETURNING id
    `;
    console.log(`Case ${inserted[0].id} inserted: ${NEW_CASE.date} ${NEW_CASE.animal}, ${NEW_CASE.county} County, ${NEW_CASE.state}`);
  }

  // ---- 2. No existing case may have changed status ----
  const activeNow = (await sql`SELECT id FROM screwworm_cases WHERE status = 'active' ORDER BY id`).map(r => r.id);
  const wantActive = [...activeBefore, ...NEW_IDS].sort((a, b) => a - b);  // activeBefore excludes NEW_IDS
  if (JSON.stringify(activeNow) !== JSON.stringify(wantActive)) {
    const gained = activeNow.filter(id => !wantActive.includes(id));
    const lost = wantActive.filter(id => !activeNow.includes(id));
    fail(`Active set changed unexpectedly — gained ${JSON.stringify(gained)}, lost ${JSON.stringify(lost)}`);
  }
  console.log(`✓ Active set is exactly the previous ${activeBefore.length} plus id ${NEW_IDS.join('/')}`);

  // ---- 3. Species breakdown ----
  const bySpeciesRows = await sql`SELECT species, COUNT(*) AS "count" FROM screwworm_cases GROUP BY 1`;
  const speciesCounts = Object.fromEntries(bySpeciesRows.map(r => [r.species, Number(r.count)]));
  // Fly-trap detections are NOT animal cases and must never appear as tracker rows.
  if ('Fly' in speciesCounts) fail('A fly-trap detection has been inserted as an animal case');
  for (const species of Object.keys(speciesCounts)) {
    if (!(species in APHIS_BY_SPECIES)) fail(`Tracker has unexpected species "${species}" absent from the truth table`);
    if (speciesCounts[species] !== APHIS_BY_SPECIES[species]) {
      fail(`${species}: DB has ${speciesCounts[species]}, APHIS export has ${APHIS_BY_SPECIES[species]}`);
    }
  }
  if (Object.keys(speciesCounts).length !== Object.keys(APHIS_BY_SPECIES).length) {
    fail('A species in the truth table has no rows in the DB');
  }
  console.log(`✓ All ${Object.keys(speciesCounts).length} species match the APHIS case-level export`);

  const breakdownRows = await sql`SELECT value FROM screwworm_metadata WHERE key = 'speciesBreakdown'`;
  const oldBreakdown = typeof breakdownRows[0].value === 'string' ? JSON.parse(breakdownRows[0].value) : breakdownRows[0].value;
  const oldLabels = oldBreakdown.map(e => e.species);
  if (JSON.stringify(oldLabels) !== JSON.stringify([...oldLabels].sort())) {
    fail(`Stored breakdown order is not alphabetical, refusing to re-sort it: ${JSON.stringify(oldLabels)}`);
  }
  const newBreakdown = Object.keys(speciesCounts)
    .map(species => ({
      species: SPECIES_LABEL[species] || species,
      count: speciesCounts[species],
      percentage: Math.round((speciesCounts[species] / EXPECTED_TOTAL_AFTER) * 100),
    }))
    .sort((a, b) => a.species.localeCompare(b.species));
  // This sync introduces no species, so the label set must be byte-identical to the stored one.
  if (JSON.stringify(newBreakdown.map(e => e.species)) !== JSON.stringify(oldLabels)) {
    fail(`Breakdown labels changed: ${JSON.stringify(oldLabels)} -> ${JSON.stringify(newBreakdown.map(e => e.species))}`);
  }
  // Only Canine may move, by exactly 1 on the count. The denominator moves from 74 to 75, and it
  // happens that only Canine's rounded percentage moves too (12% -> 13%); every other species
  // rounds to the same figure on both denominators, so any other percentage move is a bug.
  for (const entry of newBreakdown) {
    const old = oldBreakdown.find(e => e.species === entry.species);
    const isCanine = entry.species === 'Canine (Dogs)';
    const wantCount = (isCanine && !ALREADY_APPLIED) ? 1 : 0;
    const wantPct = (isCanine && !ALREADY_APPLIED) ? 1 : 0;
    if (entry.count - old.count !== wantCount) {
      fail(`${entry.species} count moved by ${entry.count - old.count}, expected ${wantCount}`);
    }
    if (entry.percentage - old.percentage !== wantPct) {
      fail(`${entry.species} percentage moved by ${entry.percentage - old.percentage}, expected ${wantPct}`);
    }
  }
  const newBreakdownTotal = newBreakdown.reduce((s, b) => s + b.count, 0);
  if (newBreakdownTotal !== EXPECTED_TOTAL_AFTER) fail(`New breakdown sums to ${newBreakdownTotal}`);
  console.log('speciesBreakdown:', JSON.stringify(newBreakdown));
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('speciesBreakdown', ${JSON.stringify(newBreakdown)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;

  // ---- 4. Timeline ----
  const ctxRows = await sql`SELECT value FROM screwworm_metadata WHERE key = 'internationalContext'`;
  if (ctxRows.length === 0) fail('internationalContext metadata row missing');
  const ctx = typeof ctxRows[0].value === 'string' ? JSON.parse(ctxRows[0].value) : ctxRows[0].value;
  const tlBefore = ctx.timeline.length;
  ctx.timeline = mergeTimeline(ctx.timeline);
  const wantTlGrowth = ALREADY_APPLIED ? 0 : TIMELINE_ENTRIES.length;
  if (ctx.timeline.length !== tlBefore + wantTlGrowth) {
    fail(`Timeline went ${tlBefore} -> ${ctx.timeline.length}, expected +${wantTlGrowth}`);
  }
  // Either way the finished timeline must carry this sync's entry, exactly once.
  for (const entry of TIMELINE_ENTRIES) {
    const hits = ctx.timeline.filter(e => e.date === entry.date && e.event === entry.event);
    if (hits.length !== 1) fail(`Timeline holds ${hits.length} copies of this sync's ${entry.date} entry`);
  }
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('internationalContext', ${JSON.stringify(ctx)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log(`✓ Timeline: ${tlBefore} -> ${ctx.timeline.length} entries`);

  // ---- 5. State responses: NOT touched this sync ----
  // The New Mexico entry already names the Dona Ana infested zone, Las Cruces inside it, and the
  // ScrewwormNM.org advisory, which is the whole regulatory footprint of this case. Read back and
  // asserted unchanged rather than rewritten.
  const srRows = await sql`SELECT value FROM screwworm_metadata WHERE key = 'stateResponses'`;
  const newResponses = typeof srRows[0].value === 'string' ? JSON.parse(srRows[0].value) : srRows[0].value;
  if (JSON.stringify(newResponses.map(r => r.state)) !== JSON.stringify(['Texas', 'New Mexico', 'Arizona', 'Federal (USDA/APHIS)'])) {
    fail(`stateResponses state list is not the expected four: ${JSON.stringify(newResponses.map(r => r.state))}`);
  }
  const nmResponse = newResponses.find(r => r.state === 'New Mexico');
  if (!nmResponse.actions.some(a => a.includes('Dona Ana'))) fail('New Mexico response no longer names Dona Ana');
  if (!nmResponse.actions.some(a => a.includes('Las Cruces'))) fail('New Mexico response no longer names Las Cruces');
  console.log('✓ State responses left unchanged (New Mexico entry already covers this case\'s footprint)');

  // ---- 6. Metadata timestamps ----
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify(LAST_UPDATED)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastChecked', ${JSON.stringify(LAST_CHECKED)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log(`✓ lastUpdated = ${LAST_UPDATED}`);

  // ---- 7. Static fallback JSON ----
  const json = JSON.parse(readFileSync(JSON_PATH, 'utf-8'));
  for (const NEW_CASE of NEW_CASES) {
    if (json.confirmedCases.some(c => c.id === NEW_CASE.id)) {
      console.log(`Fallback JSON already has case ${NEW_CASE.id} — left as is`);
    } else {
      json.confirmedCases.push({ ...NEW_CASE });
    }
  }
  json.confirmedCases.sort((a, b) => (a.date === b.date ? a.id - b.id : a.date.localeCompare(b.date)));
  json.speciesBreakdown = newBreakdown;
  json.internationalContext.timeline = mergeTimeline(json.internationalContext.timeline);
  json.stateResponses = newResponses;
  json.lastUpdated = LAST_UPDATED;
  json.lastChecked = LAST_CHECKED;
  writeFileSync(JSON_PATH, `${JSON.stringify(json, null, 2)}\n`);
  console.log(`✓ Fallback JSON written: ${json.confirmedCases.length} cases`);

  // =========================== VERIFICATION ===========================
  const after = await sql`
    SELECT COUNT(*) AS "total",
           COUNT(*) FILTER (WHERE status = 'active') AS "active",
           COUNT(*) FILTER (WHERE status = 'inactive') AS "inactive"
    FROM screwworm_cases
  `;
  if (Number(after[0].total) !== EXPECTED_TOTAL_AFTER) fail(`${after[0].total} cases != ${EXPECTED_TOTAL_AFTER}`);
  if (Number(after[0].active) !== EXPECTED_ACTIVE_AFTER_COUNT) fail(`${after[0].active} active != ${EXPECTED_ACTIVE_AFTER_COUNT}`);
  if (Number(after[0].inactive) !== EXPECTED_INACTIVE_AFTER) fail(`${after[0].inactive} inactive != ${EXPECTED_INACTIVE_AFTER}`);
  console.log(`✓ DB after: ${after[0].total} cases, ${after[0].active} active, ${after[0].inactive} inactive`);

  const badStatus = await sql`SELECT DISTINCT status FROM screwworm_cases WHERE status NOT IN ('active', 'inactive')`;
  if (badStatus.length > 0) fail(`Unexpected status values: ${JSON.stringify(badStatus)}`);

  const byMonth = await sql`
    SELECT to_char(date, 'YYYY-MM') AS "month", COUNT(*) AS "total",
           COUNT(*) FILTER (WHERE status = 'active') AS "active"
    FROM screwworm_cases GROUP BY 1 ORDER BY 1
  `;
  if (byMonth.length !== Object.keys(APHIS_BY_MONTH).length) fail(`${byMonth.length} months in the DB`);
  for (const row of byMonth) {
    const want = APHIS_BY_MONTH[row.month];
    if (!want) fail(`Unexpected month ${row.month}`);
    if (Number(row.total) !== want.total || Number(row.active) !== want.active) {
      fail(`${row.month}: ${row.total} cases / ${row.active} active != ${want.total} / ${want.active}`);
    }
    console.log(`✓ ${row.month}: ${row.total} cases, ${row.active} active`);
  }

  const geo = await sql`SELECT id FROM screwworm_cases WHERE lat IS NULL OR lng IS NULL`;
  if (geo.length > 0) fail(`Cases missing coordinates: ${JSON.stringify(geo.map(r => r.id))}`);
  // No two cases may share a pin, which is the whole point of the coordinate offsets — with the
  // one KNOWN PRE-EXISTING EXCEPTION: ids 12 (Jun 12 sheep) and 42 (Jul 21 goat) are both Sutton
  // County, TX, both inactive, and both sit on the county seat (Sonora) at 30.4994, -100.5407, so
  // they render as a single stacked pin. Pinned here so it cannot spread, not fixed.
  const KNOWN_DUP_PIN = [12, 42];
  const dupPins = await sql`
    SELECT lat, lng, COUNT(*) AS "n", array_agg(id ORDER BY id) AS "ids"
    FROM screwworm_cases GROUP BY 1, 2 HAVING COUNT(*) > 1
  `;
  if (dupPins.length !== 1 || JSON.stringify(dupPins[0].ids.map(Number)) !== JSON.stringify(KNOWN_DUP_PIN)) {
    fail(`Coordinate collisions changed — expected only the known Sutton pair ${JSON.stringify(KNOWN_DUP_PIN)}, `
      + `got ${JSON.stringify(dupPins.map(r => r.ids))}`);
  }
  for (const c of NEW_CASES) {
    const hit = await sql`SELECT id FROM screwworm_cases WHERE lat = ${c.lat} AND lng = ${c.lng}`;
    if (hit.length !== 1 || hit[0].id !== c.id) {
      fail(`Case ${c.id}'s coordinates are shared with ${JSON.stringify(hit.map(r => r.id))}`);
    }
  }
  console.log('✓ Every case has distinct coordinates, except the known pre-existing Sutton pair (12, 42)');

  // All six Dona Ana pins must be separated by enough to render individually. The closest pair
  // after this sync is 76 and 74, about 0.86 miles apart.
  const donaPins = await sql`
    SELECT id, lat, lng FROM screwworm_cases WHERE county = 'Dona Ana' AND state = 'NM' ORDER BY id
  `;
  if (donaPins.length !== 6) fail(`Expected 6 Dona Ana pins, got ${donaPins.length}`);
  let closest = Infinity;
  let closestPair = null;
  for (let i = 0; i < donaPins.length; i += 1) {
    for (let j = i + 1; j < donaPins.length; j += 1) {
      const dLat = (Number(donaPins[i].lat) - Number(donaPins[j].lat)) * 69;
      const dLng = (Number(donaPins[i].lng) - Number(donaPins[j].lng)) * 69 * Math.cos(32.35 * Math.PI / 180);
      const miles = Math.sqrt(dLat * dLat + dLng * dLng);
      if (miles < closest) { closest = miles; closestPair = [donaPins[i].id, donaPins[j].id]; }
    }
  }
  if (closest < 0.5) fail(`Dona Ana pins ${closestPair.join('/')} are only ${closest.toFixed(2)} miles apart — they will stack`);
  console.log(`✓ All 6 Dona Ana pins render separately (closest pair ${closestPair.join('/')} at ${closest.toFixed(2)} miles)`);

  const stateList = (await sql`SELECT DISTINCT state FROM screwworm_cases ORDER BY state`).map(r => r.state);
  if (JSON.stringify(stateList) !== JSON.stringify(['AZ', 'NM', 'TX'])) fail(`States ${JSON.stringify(stateList)}`);
  console.log(`✓ States: ${stateList.join(', ')}`);

  const txCounties = (await sql`SELECT DISTINCT county FROM screwworm_cases WHERE state = 'TX' ORDER BY county`).map(r => r.county);
  const nmCounties = (await sql`SELECT DISTINCT county FROM screwworm_cases WHERE state = 'NM' ORDER BY county`).map(r => r.county);
  const azCounties = (await sql`SELECT DISTINCT county FROM screwworm_cases WHERE state = 'AZ' ORDER BY county`).map(r => r.county);
  if (txCounties.length !== EXPECTED_TX_COUNTY_COUNT) fail(`${txCounties.length} TX counties != ${EXPECTED_TX_COUNTY_COUNT}`);
  if (JSON.stringify(nmCounties) !== JSON.stringify(EXPECTED_NM_COUNTY_LIST)) fail(`NM counties ${JSON.stringify(nmCounties)}`);
  if (JSON.stringify(azCounties) !== JSON.stringify(EXPECTED_AZ_COUNTY_LIST)) fail(`AZ counties ${JSON.stringify(azCounties)}`);
  if (txCounties.length + nmCounties.length + azCounties.length !== EXPECTED_COUNTIES) {
    fail(`${txCounties.length} + ${nmCounties.length} + ${azCounties.length} != ${EXPECTED_COUNTIES} counties`);
  }
  console.log(`✓ ${txCounties.length} TX + ${nmCounties.length} NM + ${azCounties.length} AZ = ${EXPECTED_COUNTIES} counties (unchanged by this sync)`);

  for (const [label, state, want] of [['Texas', 'TX', EXPECTED_TX], ['New Mexico', 'NM', EXPECTED_NM], ['Arizona', 'AZ', EXPECTED_AZ]]) {
    const row = (await sql`
      SELECT COUNT(*) AS "total", COUNT(*) FILTER (WHERE status = 'active') AS "active"
      FROM screwworm_cases WHERE state = ${state}
    `)[0];
    if (Number(row.total) !== want.total || Number(row.active) !== want.active) {
      fail(`${label} ${row.total} cases / ${row.active} active != ${want.total} / ${want.active}`);
    }
    console.log(`✓ ${label}: ${row.total} cases, ${row.active} active`);
  }

  for (const [county, state, want] of EXPECTED_COUNTY_TOTALS) {
    const row = (await sql`
      SELECT COUNT(*) AS "total", COUNT(*) FILTER (WHERE status = 'active') AS "active"
      FROM screwworm_cases WHERE county = ${county} AND state = ${state}
    `)[0];
    if (Number(row.total) !== want.total || Number(row.active) !== want.active) {
      fail(`${county} County, ${state}: ${row.total} cases / ${row.active} active != ${want.total} / ${want.active}`);
    }
    console.log(`✓ ${county} County, ${state}: ${row.total} cases, ${row.active} active`);
  }

  // Case 76's notes: Dona Ana spans three species, 2 cattle / 1 sheep / 3 dogs.
  const donaSplit = Object.fromEntries((await sql`
    SELECT species, COUNT(*) AS "n" FROM screwworm_cases
    WHERE county = 'Dona Ana' AND state = 'NM' GROUP BY 1 ORDER BY 1
  `).map(r => [r.species, Number(r.n)]));
  if (JSON.stringify(donaSplit) !== JSON.stringify(EXPECTED_DONA_SPLIT)) {
    fail(`Dona Ana split ${JSON.stringify(donaSplit)} != ${JSON.stringify(EXPECTED_DONA_SPLIT)}`);
  }
  if (Object.keys(donaSplit).length !== Object.keys(EXPECTED_DONA_SPLIT).length) {
    fail(`Dona Ana spans ${Object.keys(donaSplit).length} species in the DB, prose says ${DONA_SPECIES_WORD}`);
  }
  console.log(`✓ Dona Ana spans ${Object.keys(donaSplit).length} species: ${JSON.stringify(donaSplit)}`);

  // Case 76's notes: Dona Ana is the largest ACTIVE cluster, outright, and now leads by 2x.
  const byActive = await sql`
    SELECT county, state, COUNT(*) FILTER (WHERE status = 'active') AS "a" FROM screwworm_cases
    GROUP BY 1, 2 ORDER BY "a" DESC, county
  `;
  if (`${byActive[0].county}, ${byActive[0].state}` !== 'Dona Ana, NM' || Number(byActive[0].a) !== 6) {
    fail(`Expected Dona Ana, NM to lead on active cases with 6, got ${byActive[0].county}, ${byActive[0].state} with ${byActive[0].a}`);
  }
  if (Number(byActive[1].a) >= Number(byActive[0].a)) {
    fail(`Dona Ana does not lead active cases outright — ${byActive[1].county}, ${byActive[1].state} also has ${byActive[1].a}`);
  }
  if (`${byActive[1].county}, ${byActive[1].state}` !== 'Grant, NM' || Number(byActive[1].a) !== 3) {
    fail(`The notes put Grant, NM second on actives at 3, got ${byActive[1].county}, ${byActive[1].state} with ${byActive[1].a}`);
  }
  if (Number(byActive[0].a) !== 2 * Number(byActive[1].a)) {
    fail(`The notes claim Dona Ana leads by a factor of two: ${byActive[0].a} vs ${byActive[1].a}`);
  }
  console.log(`✓ Dona Ana, NM leads active cases outright with ${byActive[0].a}, exactly twice Grant, NM's ${byActive[1].a}`);

  // Case 76's notes: Crockett, TX is still the largest cluster by TOTAL cases, all closed.
  const byTotal = await sql`SELECT county, state, COUNT(*) AS "n", COUNT(*) FILTER (WHERE status = 'active') AS "a" FROM screwworm_cases GROUP BY 1, 2 ORDER BY "n" DESC, county`;
  if (`${byTotal[0].county}, ${byTotal[0].state}` !== 'Crockett, TX' || Number(byTotal[0].n) !== 13) {
    fail(`Expected Crockett, TX largest by total at 13, got ${byTotal[0].county}, ${byTotal[0].state} with ${byTotal[0].n}`);
  }
  if (Number(byTotal[0].a) !== 0) fail(`The notes say all 13 Crockett cases are closed, but ${byTotal[0].a} are active`);
  console.log(`✓ Crockett, TX is still the largest cluster by total cases (${byTotal[0].n}, all inactive)`);

  // Case 76's notes: Dona Ana leads New Mexico by total cases, outright, ahead of Grant at 4.
  const nmByTotal = await sql`
    SELECT county, COUNT(*) AS "n" FROM screwworm_cases WHERE state = 'NM' GROUP BY 1 ORDER BY "n" DESC, county
  `;
  if (nmByTotal[0].county !== 'Dona Ana' || Number(nmByTotal[0].n) !== 6) {
    fail(`Expected Dona Ana to lead New Mexico with 6 total, got ${JSON.stringify(nmByTotal.slice(0, 2))}`);
  }
  if (nmByTotal[1].county !== 'Grant' || Number(nmByTotal[1].n) !== 4) {
    fail(`The notes put Grant second in New Mexico at 4, got ${nmByTotal[1].county} with ${nmByTotal[1].n}`);
  }
  console.log(`✓ Dona Ana leads New Mexico at ${nmByTotal[0].n} total, ahead of Grant at ${nmByTotal[1].n}`);

  // Case 76's notes: the Dona Ana date pattern — Oct 24 x2, gap on Oct 25 AND Oct 26, then one
  // each on Oct 27, 28, 29, 30. Six cases inside seven days, with a four-day unbroken run.
  const donaDates = (await sql`
    SELECT to_char(date, 'YYYY-MM-DD') AS "d", COUNT(*) AS "n" FROM screwworm_cases
    WHERE county = 'Dona Ana' AND state = 'NM' GROUP BY 1 ORDER BY 1
  `).map(r => [r.d, Number(r.n)]);
  const wantDona = [['2026-10-24', 2], ['2026-10-27', 1], ['2026-10-28', 1], ['2026-10-29', 1], ['2026-10-30', 1]];
  if (JSON.stringify(donaDates) !== JSON.stringify(wantDona)) {
    fail(`Dona Ana case dates ${JSON.stringify(donaDates)} != ${JSON.stringify(wantDona)}`);
  }
  for (const gap of ['2026-10-25', '2026-10-26']) {
    if (donaDates.some(([d]) => d === gap)) fail(`Dona Ana has a case on ${gap}; the notes say Oct 25-26 is a two-day gap`);
  }
  const donaSpanDays = (new Date(donaDates[donaDates.length - 1][0]) - new Date(donaDates[0][0])) / 86400000 + 1;
  if (donaSpanDays !== 7) fail(`The notes say six Dona Ana cases inside seven days, the span is ${donaSpanDays}`);
  console.log(`✓ Dona Ana: 6 cases across ${donaSpanDays} days — Oct 24 (x2), gap Oct 25-26, then Oct 27/28/29/30`);

  // Case 76's notes: the county's three dogs are cases 68 (Oct 27), 71 (Oct 28) and 76 (Oct 30) —
  // the third dog in a four-day window.
  const donaDogs = (await sql`
    SELECT id, to_char(date, 'YYYY-MM-DD') AS "d" FROM screwworm_cases
    WHERE county = 'Dona Ana' AND state = 'NM' AND species = 'Canine' ORDER BY date, id
  `).map(r => [r.id, r.d]);
  const wantDonaDogs = [[68, '2026-10-27'], [71, '2026-10-28'], [76, '2026-10-30']];
  if (JSON.stringify(donaDogs) !== JSON.stringify(wantDonaDogs)) {
    fail(`Dona Ana dogs ${JSON.stringify(donaDogs)} != ${JSON.stringify(wantDonaDogs)}`);
  }
  const dogWindow = (new Date(donaDogs[2][1]) - new Date(donaDogs[0][1])) / 86400000 + 1;
  if (dogWindow !== 4) fail(`The notes say three dogs in four days, the window is ${dogWindow} days`);
  console.log(`✓ Dona Ana's three dogs are cases 68/71/76 across ${dogWindow} days — case 76 is the third`);

  // Every active case must be a domestic animal, which is what makes the rollup CSV's
  // domestic-only active column of 22 equal the tracker's 22 actives.
  const activeWildlife = await sql`SELECT id FROM screwworm_cases WHERE status = 'active' AND species = 'Cervid'`;
  if (activeWildlife.length > 0) fail(`Wildlife case still active: ${JSON.stringify(activeWildlife)}`);
  console.log(`✓ All ${EXPECTED_ACTIVE_AFTER_COUNT} active cases are domestic animals (matches "Active Cases - Domestic" = 22)`);

  const nonOctActive = await sql`SELECT id, date FROM screwworm_cases WHERE status = 'active' AND to_char(date, 'YYYY-MM') <> '2026-10'`;
  if (nonOctActive.length > 0) fail(`Active case outside October: ${JSON.stringify(nonOctActive)}`);
  const activeSplit = await sql`SELECT state, COUNT(*) AS "n" FROM screwworm_cases WHERE status = 'active' GROUP BY 1 ORDER BY 1`;
  const splitMap = Object.fromEntries(activeSplit.map(r => [r.state, Number(r.n)]));
  if (JSON.stringify(splitMap) !== JSON.stringify(EXPECTED_ACTIVE_SPLIT)) {
    fail(`Active split ${JSON.stringify(splitMap)} != ${JSON.stringify(EXPECTED_ACTIVE_SPLIT)}`);
  }
  console.log(`✓ All ${EXPECTED_ACTIVE_AFTER_COUNT} actives are October detections, split ${JSON.stringify(splitMap)}`);
  // Case 76's notes claim New Mexico holds more actives than Texas and Arizona combined.
  if (!(splitMap.NM > splitMap.TX + splitMap.AZ)) {
    fail(`Case 76's notes claim NM > TX + AZ on actives, but ${splitMap.NM} !> ${splitMap.TX} + ${splitMap.AZ}`);
  }
  console.log(`✓ New Mexico ${splitMap.NM} actives > Texas ${splitMap.TX} + Arizona ${splitMap.AZ} combined`);

  // Canine ordinal written into the notes: case 76 is the 10th dog detection.
  const canineOrder = (await sql`SELECT id FROM screwworm_cases WHERE species = 'Canine' ORDER BY date, id`).map(r => r.id);
  if (canineOrder.indexOf(76) + 1 !== 10) {
    fail(`Case #76 is dog number ${canineOrder.indexOf(76) + 1}, but its notes claim the tenth`);
  }
  if (canineOrder.length !== APHIS_BY_SPECIES.Canine) fail(`${canineOrder.length} dogs, expected ${APHIS_BY_SPECIES.Canine}`);
  console.log(`✓ Canine ordinal checks out: ${canineOrder.length} dogs, case 76 is the tenth`);

  // State-level ordinal: case 76 is New Mexico's 15th case.
  const nmOrder = (await sql`SELECT id FROM screwworm_cases WHERE state = 'NM' ORDER BY date, id`).map(r => r.id);
  if (nmOrder.indexOf(76) + 1 !== 15) {
    fail(`Case #76 is NM case number ${nmOrder.indexOf(76) + 1}, but its notes claim the fifteenth`);
  }
  console.log('✓ Case #76 is New Mexico\'s fifteenth case');

  // Within-county ordinal: case 76 is Dona Ana's 6th.
  const donaOrder = (await sql`
    SELECT id FROM screwworm_cases WHERE county = 'Dona Ana' AND state = 'NM' ORDER BY date, id
  `).map(r => r.id);
  if (donaOrder.indexOf(76) + 1 !== 6) {
    fail(`Case #76 is Dona Ana case number ${donaOrder.indexOf(76) + 1}, but its notes claim the sixth`);
  }
  console.log('✓ Case #76 is the sixth Dona Ana County case');

  // The documented id-ordering artifact from the Oct 30 sync: case 73 has a LOWER APHIS
  // reference than 71 and 72 despite a higher id. Re-asserted so it stays known.
  const oct28 = await sql`SELECT id, notes FROM screwworm_cases WHERE date = '2026-10-28' ORDER BY id`;
  if (oct28.length !== 4 || JSON.stringify(oct28.map(r => r.id)) !== JSON.stringify([70, 71, 72, 73])) {
    fail(`Expected Oct 28 to hold ids 70-73, got ${JSON.stringify(oct28.map(r => r.id))}`);
  }
  // Reference serials restart each APHIS year, so sort on (year, serial), not the serial alone:
  // June's rows carry :26 suffixes with serials as low as 17953, October's carry :27.
  // A row's notes may cite MORE THAN ONE reference — case 76 cites its own SU:28348:27 and also
  // the Dona Ana fly-trap SU:28266:27 as context — so take the highest reference in each row and
  // assert separately that for case 76 that is its own.
  const suKey = (serial, year) => Number(year) * 1e8 + Number(serial);
  const suOf = (n) => {
    const all = [...String(n).matchAll(/SU:(\d+):(\d+)/g)].map(m => suKey(m[1], m[2]));
    return all.length ? Math.max(...all) : null;
  };
  const su73 = suOf(oct28.find(r => r.id === 73).notes);
  const su71 = suOf(oct28.find(r => r.id === 71).notes);
  if (!(su73 < su71)) fail(`The documented backfill artifact is gone: SU of 73 (${su73}) is no longer below that of 71 (${su71})`);
  console.log('✓ Documented backfill artifact intact: case 73\'s APHIS reference sits below case 71\'s');

  // Case 76's notes cite two references. The higher must be its own, and the lower must be the
  // Dona Ana fly-trap row — which is cited as context only and must never become a tracker case.
  const notes76 = (await sql`SELECT notes FROM screwworm_cases WHERE id = 76`)[0].notes;
  const refs76 = [...notes76.matchAll(/SU:(\d+):(\d+)/g)].map(m => suKey(m[1], m[2])).sort((a, b) => b - a);
  if (refs76.length !== 2) fail(`Case 76's notes cite ${refs76.length} APHIS references, expected 2 (its own and the fly trap's)`);
  if (refs76[0] !== suKey(28348, 27)) fail('Case 76\'s highest cited reference is not its own SU:28348:27');
  if (refs76[1] !== suKey(28266, 27)) fail('Case 76\'s lower cited reference is not the Dona Ana fly trap SU:28266:27');
  console.log('✓ Case 76 cites its own SU:28348:27 plus the Dona Ana fly-trap SU:28266:27 as context, and its own is the higher');

  // Case 76's own APHIS reference must be the highest in the data, since it is the newest case.
  // That is what says this sync is a straight append and NOT a backfill like case 73 was.
  const allSu = (await sql`SELECT id, notes FROM screwworm_cases`)
    .map(r => [r.id, suOf(r.notes)]).filter(([, su]) => su !== null)
    .sort((a, b) => b[1] - a[1]);
  if (allSu[0][0] !== 76) fail(`Case 76 should carry the highest APHIS reference, but case ${allSu[0][0]} does`);
  console.log(`✓ Case 76 carries the highest APHIS reference of all ${allSu.length} referenced cases — a straight append, no backfill artifact this sync`);

  // Pre-existing drift must not have moved.
  for (const [id, date] of KNOWN_DATE_DRIFT) {
    const row = (await sql`SELECT to_char(date, 'YYYY-MM-DD') AS "d" FROM screwworm_cases WHERE id = ${id}`)[0];
    if (row.d !== date) fail(`Known date drift on id ${id} changed: ${row.d} != ${date}`);
  }
  for (const [id, animal] of KNOWN_ANIMAL_DRIFT) {
    const row = (await sql`SELECT animal FROM screwworm_cases WHERE id = ${id}`)[0];
    if (row.animal !== animal) fail(`Known animal-label drift on id ${id} changed: ${row.animal} != ${animal}`);
  }
  console.log('✓ Pre-existing date and animal-label drift is unchanged (4 dates, 5 labels)');

  // The stored breakdown must equal what /api/cases will compute from the rows.
  const storedRows = await sql`SELECT value FROM screwworm_metadata WHERE key = 'speciesBreakdown'`;
  const stored = typeof storedRows[0].value === 'string' ? JSON.parse(storedRows[0].value) : storedRows[0].value;
  for (const row of bySpeciesRows) {
    const label = SPECIES_LABEL[row.species] || row.species;
    const entry = stored.find(s => s.species === label);
    if (!entry) fail(`Species ${row.species} has no breakdown entry`);
    const wantPct = Math.round((Number(row.count) / EXPECTED_TOTAL_AFTER) * 100);
    if (entry.count !== Number(row.count) || entry.percentage !== wantPct) {
      fail(`${label}: rows say ${row.count} (${wantPct}%), breakdown says ${entry.count} (${entry.percentage}%)`);
    }
    console.log(`✓ ${label}: ${entry.count} (${entry.percentage}%) [APHIS "${APHIS_SPECIES_LABEL[row.species]}"]`);
  }

  // ---- DB / fallback parity ----
  const dbRows = await sql`SELECT id, status, to_char(date, 'YYYY-MM-DD') AS "d", county, state, species, animal, lat, lng FROM screwworm_cases ORDER BY id`;
  const dbIds = dbRows.map(r => r.id);
  const jsonIds = [...json.confirmedCases.map(c => c.id)].sort((a, b) => a - b);
  if (JSON.stringify(dbIds) !== JSON.stringify(jsonIds)) fail('Fallback JSON ids diverge from DB ids');
  for (const r of dbRows) {
    const c = json.confirmedCases.find(x => x.id === r.id);
    for (const [f, dbv, jsonv] of [['status', r.status, c.status], ['date', r.d, c.date], ['county', r.county, c.county],
      ['state', r.state, c.state], ['species', r.species, c.species], ['animal', r.animal, c.animal]]) {
      if (dbv !== jsonv) fail(`Fallback JSON diverges from DB on id ${r.id} ${f}: ${jsonv} vs ${dbv}`);
    }
    const known = KNOWN_COORD_DRIFT[r.id];
    if (known) {
      // Pinned pre-existing drift: both sides must still hold exactly the recorded values.
      if (Number(r.lat) !== known.db[0] || Number(r.lng) !== known.db[1]) {
        fail(`Known coordinate drift on id ${r.id} moved in the DB: ${r.lat}, ${r.lng} != ${known.db.join(', ')}`);
      }
      if (Number(c.lat) !== known.json[0] || Number(c.lng) !== known.json[1]) {
        fail(`Known coordinate drift on id ${r.id} moved in the fallback: ${c.lat}, ${c.lng} != ${known.json.join(', ')}`);
      }
    } else if (Number(r.lat) !== Number(c.lat) || Number(r.lng) !== Number(c.lng)) {
      fail(`Fallback JSON diverges from DB on id ${r.id} coordinates: `
        + `${c.lat}, ${c.lng} vs ${r.lat}, ${r.lng} (not one of the known pairs ${Object.keys(KNOWN_COORD_DRIFT).join('/')})`);
    }
  }
  console.log(`✓ Fallback JSON matches the DB field-for-field on all ${dbIds.length} cases `
    + `(coordinates exact on ${dbIds.length - Object.keys(KNOWN_COORD_DRIFT).length}, `
    + `${Object.keys(KNOWN_COORD_DRIFT).length} pinned as known pre-existing drift: ids ${Object.keys(KNOWN_COORD_DRIFT).join(', ')})`);

  if (json.speciesBreakdown.length !== stored.length) fail('Fallback breakdown row count differs from DB');
  for (const entry of json.speciesBreakdown) {
    const dbEntry = stored.find(s => s.species === entry.species);
    if (!dbEntry || dbEntry.count !== entry.count || dbEntry.percentage !== entry.percentage) {
      fail(`Fallback breakdown diverges from DB for "${entry.species}"`);
    }
  }
  const srAfter = await sql`SELECT value FROM screwworm_metadata WHERE key = 'stateResponses'`;
  const srStored = typeof srAfter[0].value === 'string' ? JSON.parse(srAfter[0].value) : srAfter[0].value;
  for (const entry of json.stateResponses) {
    const dbEntry = srStored.find(r => r.state === entry.state);
    if (!dbEntry || JSON.stringify(dbEntry.actions) !== JSON.stringify(entry.actions)) {
      fail(`stateResponses diverge between DB and fallback for ${entry.state}`);
    }
  }
  const ctxAfter = await sql`SELECT value FROM screwworm_metadata WHERE key = 'internationalContext'`;
  const ctxStored = typeof ctxAfter[0].value === 'string' ? JSON.parse(ctxAfter[0].value) : ctxAfter[0].value;
  if (ctxStored.timeline.length !== json.internationalContext.timeline.length) {
    fail(`Timeline length diverges: DB ${ctxStored.timeline.length} vs fallback ${json.internationalContext.timeline.length}`);
  }
  for (let i = 0; i < ctxStored.timeline.length; i += 1) {
    if (ctxStored.timeline[i].date !== json.internationalContext.timeline[i].date
        || ctxStored.timeline[i].event !== json.internationalContext.timeline[i].event) {
      fail(`Timeline entry ${i} (${ctxStored.timeline[i].date}) diverges between DB and fallback`);
    }
  }
  console.log(`✓ Timeline, breakdown and state responses are in DB/fallback parity (${ctxStored.timeline.length} timeline entries)`);

  const zoneCount = Number((await sql`SELECT COUNT(*) AS "n" FROM screwworm_quarantine_zones`)[0].n);
  if (zoneCount !== json.quarantineZones.length) {
    fail(`Zones diverge: DB ${zoneCount} vs fallback ${json.quarantineZones.length}`);
  }
  console.log(`✓ Quarantine zones in parity: ${zoneCount}`);

  const luRow = (await sql`SELECT value FROM screwworm_metadata WHERE key = 'lastUpdated'`)[0];
  // The metadata column is jsonb and the driver already parses it, so a stored JSON string comes
  // back as a plain JS string. Only re-parse when it is still quoted JSON text.
  const lu = (typeof luRow.value === 'string' && luRow.value.startsWith('"'))
    ? JSON.parse(luRow.value) : luRow.value;
  if (lu !== LAST_UPDATED) fail(`DB lastUpdated is ${lu}, expected ${LAST_UPDATED}`);
  if (json.lastUpdated !== LAST_UPDATED) fail(`Fallback lastUpdated is ${json.lastUpdated}, expected ${LAST_UPDATED}`);
  console.log(`✓ lastUpdated is ${LAST_UPDATED} in both the DB and the fallback`);

  // Each new case must be readable back out of the DB exactly as written.
  for (const NEW_CASE of NEW_CASES) {
    const row = (await sql`
      SELECT id, to_char(date, 'YYYY-MM-DD') AS "d", species, animal, county, state, lat, lng, status, notes
      FROM screwworm_cases WHERE id = ${NEW_CASE.id}
    `)[0];
    for (const [f, want, got] of [['date', NEW_CASE.date, row.d], ['species', NEW_CASE.species, row.species],
      ['animal', NEW_CASE.animal, row.animal], ['county', NEW_CASE.county, row.county],
      ['state', NEW_CASE.state, row.state], ['status', NEW_CASE.status, row.status],
      ['lat', NEW_CASE.lat, Number(row.lat)], ['lng', NEW_CASE.lng, Number(row.lng)],
      ['notes', NEW_CASE.notes, row.notes]]) {
      if (want !== got) fail(`Case ${NEW_CASE.id} ${f}: wrote ${want}, DB has ${got}`);
    }
    const jsonCase = json.confirmedCases.find(c => c.id === NEW_CASE.id);
    if (jsonCase.notes !== NEW_CASE.notes) fail(`Case ${NEW_CASE.id} notes differ in the fallback`);
    console.log(`✓ Case ${NEW_CASE.id} round-trips: ${row.d} ${row.animal}, ${row.county} County, ${row.state}, ${row.status}`);
  }

  // ---- Species wiring (no new species this sync, but re-verified) ----
  const chart = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/src/components/CasesByDay.jsx', 'utf-8');
  const api = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/api/cases.js', 'utf-8');
  const indexCss = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/src/index.css', 'utf-8');
  const breakdownJsx = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/src/components/SpeciesBreakdown.jsx', 'utf-8');
  const cron = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/api/cron/check-usda.js', 'utf-8');
  for (const species of Object.keys(speciesCounts)) {
    if (!new RegExp(`SPECIES_ORDER = \\[[^\\]]*'${species}'`).test(chart)) {
      fail(`CasesByDay SPECIES_ORDER is missing "${species}" — its cases would vanish from the daily chart`);
    }
    if (!new RegExp(`${species}: '#`).test(chart)) fail(`CasesByDay SPECIES_COLORS is missing "${species}"`);
    if (!api.includes(`${species}: '${SPECIES_LABEL[species]}'`)) fail(`api/cases.js SPECIES_LABELS is missing "${species}"`);
    const cls = species.toLowerCase() === 'bovine' ? 'cattle' : species.toLowerCase();
    if (species !== 'Canine' && !breakdownJsx.includes(`return '${cls}'`)) {
      fail(`SpeciesBreakdown fillClass has no branch for "${species}"`);
    }
    if (species !== 'Canine' && !indexCss.includes(`.species-bar-fill.${cls} {`)) {
      fail(`index.css has no .species-bar-fill.${cls} rule for "${species}"`);
    }
  }
  for (const [key, aphisLabel] of Object.entries(APHIS_SPECIES_LABEL)) {
    if (!(key in speciesCounts)) continue;
    const token = aphisLabel.toLowerCase().replace(/^domestic /, '').replace(/s$/, '');
    if (!cron.includes(`'${key}'`)) fail(`api/cron/check-usda.js cannot produce species "${key}"`);
    if (!new RegExp(`${token}`).test(cron)) fail(`api/cron/check-usda.js does not recognise APHIS's label "${aphisLabel}"`);
  }
  console.log(`✓ All ${Object.keys(speciesCounts).length} species are wired into the chart, the API labels, the `
    + 'breakdown classes, the CSS, and the cron normaliser');

  console.log('\nDone!');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
