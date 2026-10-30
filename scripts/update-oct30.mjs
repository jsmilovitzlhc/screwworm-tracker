import { neon } from '@neondatabase/serverless';
import { readFileSync, writeFileSync } from 'fs';

const envFile = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}

const sql = neon(process.env.DATABASE_URL);

// APHIS sync Oct 30, 2026 — THREE new domestic cases, all cattle. 71 -> 74 animal cases,
// 18 -> 21 active, 53 inactive (unchanged), 27 counties (unchanged), 3 states (unchanged).
//
// ---------------------------------------------------------------------------------------
// THE BRIEF FOR THIS SYNC UNDERSTATED IT, FOR THE SECOND SYNC RUNNING. It described exactly
// one new case (the Oct 29 Dona Ana cow) and predicted "72 total, 19 active". The APHIS
// dashboard's own case-level export shows THREE cases the tracker was missing, not one:
//
//   73  2026-10-28  Presidio, TX   Cattle  SU:28275:27  SS:12744:27   <-- absent from the brief
//   74  2026-10-29  Dona Ana, NM   Cattle  SU:28285:27  SS:12752:27   <-- the brief's case
//   75  2026-10-29  Luna, NM       Cattle  SU:28286:27  SS:12753:27   <-- absent from the brief
//
// So the end state is 74 / 21 active, not 72 / 19. The Oct 29 sync hit the same failure mode
// (brief said one case, export held five), which is why this script diffs the full export
// rather than trusting the brief's counts.
//
// The brief also made one factual claim about Dona Ana that is WRONG and is NOT carried into
// the notes below. It said the county "has had a confirmed case every day since Oct 24 except
// Oct 25". Dona Ana's five cases fall on Oct 24 (x2), Oct 27, Oct 28 and Oct 29 — so the gap
// is TWO days, Oct 25 AND Oct 26, and the unbroken run is the three days Oct 27-29. (Oct 26's
// New Mexico case was Luna, case 67, not Dona Ana.) The assertion block at the end pins the
// corrected version against the data.
//
// Everything else the brief asserted about the Dona Ana case — date, species, county, state,
// status, type, both APHIS references, fifth Dona Ana case, New Mexico's thirteenth, largest
// active cluster at 5 with a 2 cattle / 1 sheep / 2 dogs split — checks out and is kept.
//
// ---------------------------------------------------------------------------------------
// SOURCES
//
// 1. APHIS public Tableau CASE-LEVEL export (publicdashboards.dl.usda.gov/t/MRP_PUB/views/
//    NewWorldScrewwormPublicReporting_17805168329840/ExportToCSV.csv). 75 rows: 73 Domestic,
//    1 Wildlife & Feral (the Pecos elk), 1 Fly Trap (Brewster, Sep 25 — a wild fly detection,
//    not an animal case, and deliberately not in this tracker). 74 animal rows, 21 Active,
//    53 Inactive. Diffed row-by-row against all 71 tracker cases on (date, county, state,
//    species, status); the three rows above are the only ones with no tracker match.
//
// 2. APHIS public Tableau SummaryDashboard.csv rollup, fetched in the same minute. It is an
//    INDEPENDENT aggregation of the same data, and it agrees with the case-level export on
//    every month still inside its window:
//        Jul 2026   0 active / 14 inactive domestic,  14 domestic,  14 total
//        Aug 2026   0 active /  4 inactive domestic,   4 domestic,   4 total
//        Sep 2026   0 active /  3 inactive domestic,   3 domestic,   4 total  (+1 fly trap)
//        Oct 2026  21 active /  1 inactive domestic,  22 domestic,  23 total  (+1 wildlife)
//    21 active for October, and no actives in any other month, is what independently confirms
//    the 21 active this script lands on — and rules out the brief's 19.
//    CAVEAT carried forward from every sync since Sep 30: the rollup's month window has
//    scrolled, so June (30 cases, all inactive) has dropped out of it. June is still asserted
//    below from the case-level export, which does still carry it.
//
// 3. Texas Animal Health Commission NWS page (tahc.texas.gov/emergency/nws.html) —
//    CORROBORATION for the Presidio case, which no press report had picked up yet. TAHC
//    issued a "Modified Executive Director Order - Jeff Davis and Presidio Counties" dated
//    10/29, the day after the Oct 28 detection; the previous Presidio order was 07/30. A
//    modified order on the day after a new detection in those counties is exactly the
//    regulatory footprint a new Presidio case leaves. Presidio also remains on TAHC's list of
//    counties under active movement restrictions.
//
// 4. Albuquerque Journal, "New World screwworm cases confirmed at NMSU, Dona Ana County" —
//    confirms the EARLIER Dona Ana pair (Oct 24, cases 65/66: a sheep on the NMSU campus and
//    a cow off campus) and the Oct 26 Luna cattle case (case 67), plus the 12.4-mile infested
//    zone around Las Cruces. It does NOT cover the Oct 29 cases; New Mexico press is running
//    two to three days behind the dashboard, which is why source 1 is the basis here.
//
// 5. TAHC current infested-zone county list, used to refresh the stale Texas response entry
//    (see TEXAS_RESPONSE below): Brewster, Crockett, Edwards, El Paso, Hudspeth, Jeff Davis,
//    Pecos, Presidio, Schleicher, Starr, Sutton, Terrell, Val Verde, Zapata.
//
// ---------------------------------------------------------------------------------------
// ID ORDERING NOTE
//
// Case 73 (Presidio, Oct 28, SU:28275:27) is a BACKFILL: its APHIS reference is lower than
// those of cases 71 (SU:28277:27) and 72 (SU:28278:27), which the Oct 29 sync already took on
// the same confirmed date. Ids in this tracker are append-only — renumbering would break every
// id reference in the notes, the timeline and the quarantine records — so 73 keeps the next
// free id and the Oct 28 cases render in id order (70, 71, 72, 73) rather than APHIS reference
// order. /api/cases sorts by date then id, so this only affects the within-day ordering of
// three cases on one day. It is asserted explicitly at the end so it stays a known, documented
// artifact rather than drifting into a silent inconsistency.
//
// ---------------------------------------------------------------------------------------
// PRE-EXISTING DATE DRIFT, DELIBERATELY NOT TOUCHED HERE
//
// Diffing the tracker's 71 existing cases against source 1 leaves exactly four mismatches, all
// off-by-one on the date and all pre-dating this sync (unchanged from the Oct 29 sync's note):
//     Medina TX cattle       tracker 2026-06-23  vs  APHIS 2026-06-24
//     Pecos TX dog           tracker 2026-06-30  vs  APHIS 2026-06-29
//     Starr TX cattle        tracker 2026-07-17  vs  APHIS 2026-07-18
//     Val Verde TX cattle    tracker 2026-10-20  vs  APHIS 2026-10-21
// The drift runs in BOTH directions, so it is not a timezone bug. All four stay inside their
// original month, so no monthly, county, state, species or status total below is affected.
// Four tracker rows also record the APHIS species "Cattle" as "Calf" (ids 1, 2, 3, 6) and one
// records "Goats" as "Goat" (id 42); same situation — cosmetic, in-species, not this sync's
// business. Changing any of it is a separate decision. The assertions pin all of it so it
// cannot drift further unnoticed.
//
// No code changes ship with this sync: every species, county and state involved is already
// wired through the chart, the API labels, the breakdown classes, the CSS and the cron
// normaliser. The species-wiring assertions at the end re-verify that anyway.

const JSON_PATH = '/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/src/data/cases.json';

const NEW_CASES = [
  {
    id: 73,
    date: '2026-10-28',
    species: 'Bovine',
    animal: 'Cattle',
    county: 'Presidio',
    state: 'TX',
    lat: 29.9742,
    lng: -104.2617,
    status: 'active',
    notes: 'Second Presidio County case and Texas\'s fifty-ninth case; the thirty-third bovine '
      + '(cattle) detection of the US outbreak; this case was absent from the daily brief and was '
      + 'found by diffing the APHIS case-level export, which is also why it carries a later id '
      + 'than the Oct 28 cases the previous sync recorded despite a lower APHIS reference. '
      + 'Presidio\'s only earlier case was the Sep 9 ranch horse — the FIRST EQUINE case of the US '
      + 'outbreak — which has since gone inactive, so this is the county\'s first active case in '
      + 'seven weeks and its first in livestock. Presidio is the Big Bend border county on the Rio '
      + 'Grande opposite Ojinaga, Chihuahua, and it sits between Brewster County to the east (6 '
      + 'cases, 1 active) and Jeff Davis County to the north (1 active), so this detection fills in '
      + 'the middle of the Big Bend cluster rather than opening new ground — no new county, the '
      + 'outbreak stays at 27. The Texas Animal Health Commission issued a modified Executive '
      + 'Director Order for Jeff Davis and Presidio Counties on Oct 29, the day after confirmation, '
      + 'and both counties remain under animal movement restrictions. Texas\'s active count rises '
      + 'from 7 to 8 with this case; domestic animal; APHIS reports location at county level, so '
      + 'the coordinates are offset slightly from the Sep 9 horse case near the city of Presidio so '
      + 'the pins do not render on top of each other; SU:28275:27, SS:12744:27; confirmed per APHIS '
      + 'dashboard Oct 28',
  },
  {
    id: 74,
    date: '2026-10-29',
    species: 'Bovine',
    animal: 'Cattle',
    county: 'Dona Ana',
    state: 'NM',
    lat: 32.3455,
    lng: -106.7529,
    status: 'active',
    notes: 'Fifth Dona Ana County case and New Mexico\'s thirteenth case; the thirty-fourth bovine '
      + '(cattle) detection of the US outbreak and the county\'s second head of cattle, after the '
      + 'Oct 24 cow. Dona Ana is now the outbreak\'s LARGEST ACTIVE CLUSTER outright, with 5 cases '
      + 'all active — 2 cattle, 1 sheep and 2 dogs — and it also passes Grant County to become New '
      + 'Mexico\'s largest cluster by total cases; Crockett County, TX is still the largest cluster '
      + 'by total cases overall at 13, though all 13 are long since closed. All five Dona Ana cases '
      + 'landed inside six days: two on Oct 24, then a two-day gap across Oct 25 and Oct 26, then '
      + 'one each on Oct 27, Oct 28 and Oct 29 — a three-day unbroken run. The county spans '
      + 'livestock and companion animals, and Las Cruces and the New Mexico State University campus '
      + 'both fall inside the resulting 12.4-mile infested zone; domestic animal; APHIS reports '
      + 'location at county level, so the coordinates are offset slightly from the other Dona Ana '
      + 'cases near the county seat (Las Cruces) so the pins do not render on top of each other; '
      + 'SU:28285:27, SS:12752:27; confirmed per APHIS dashboard Oct 29',
  },
  {
    id: 75,
    date: '2026-10-29',
    species: 'Bovine',
    animal: 'Cattle',
    county: 'Luna',
    state: 'NM',
    lat: 32.2801,
    lng: -107.7462,
    status: 'active',
    notes: 'Second Luna County case and New Mexico\'s fourteenth case; the thirty-fifth bovine '
      + '(cattle) detection of the US outbreak; this case was absent from the daily brief and was '
      + 'found by diffing the APHIS case-level export. Both of Luna\'s cases are cattle and both are '
      + 'active, three days apart — the county\'s first was Oct 26, which opened Luna as the '
      + 'twenty-fifth county of the outbreak. Luna sits directly between Grant County to the '
      + 'northwest (4 cases, 3 active) and Dona Ana County to the east (5 cases, all active), so New '
      + 'Mexico\'s detections still run unbroken along the Mexican border from Hidalgo through Luna '
      + 'to Dona Ana, and the two counties either side of Luna are now the state\'s two largest '
      + 'clusters. Luna also holds the Columbus port of entry, the third crossing USDA restored to '
      + 'Mexican cattle imports under the phased reopening, after Douglas, AZ and Santa Teresa, NM; '
      + 'this second case comes three days after that reopening. Confirmed the same day as the Dona '
      + 'Ana cow, taking New Mexico to 12 of the outbreak\'s 21 active cases — more than Texas (8) '
      + 'and Arizona (1) combined; domestic animal; APHIS reports location at county level, so the '
      + 'coordinates are offset slightly from the Oct 26 case near the county seat (Deming), about '
      + '32 miles north of Columbus and the border; SU:28286:27, SS:12753:27; confirmed per APHIS '
      + 'dashboard Oct 29',
  },
];

const NEW_IDS = NEW_CASES.map(c => c.id);
const NEW_REFS = {
  73: { SU: 28275, SS: 12744 },
  74: { SU: 28285, SS: 12752 },
  75: { SU: 28286, SS: 12753 },
};

const TIMELINE_ENTRIES = [
  {
    date: '2026-10-28',
    event: 'Case 73: cattle in Presidio County, TX — the county\'s second case and its first in livestock, '
      + 'after the Sep 9 ranch horse that was the outbreak\'s first equine detection. Picked up from the '
      + 'APHIS case-level export rather than any announcement; the Texas Animal Health Commission issued a '
      + 'modified Executive Director Order for Jeff Davis and Presidio Counties the following day. Presidio '
      + 'sits between Brewster and Jeff Davis on the Rio Grande, so the Big Bend cluster fills in rather '
      + 'than spreading — the outbreak stays at 27 counties in 3 states.',
  },
  {
    date: '2026-10-29',
    event: 'Cases 74 and 75: cattle in Dona Ana County, NM and cattle in Luna County, NM. Dona Ana\'s fifth '
      + 'case makes it the outbreak\'s largest active cluster outright — 5 cases, all active, across 2 '
      + 'cattle, 1 sheep and 2 dogs — and New Mexico\'s largest cluster by total cases, passing Grant. Luna '
      + 'takes its second case three days after its first. The outbreak reaches 74 animal cases with 21 '
      + 'active, and New Mexico now holds 12 of those 21 actives, more than Texas (8) and Arizona (1) '
      + 'combined, having had just 5 cases in total two weeks earlier.',
  },
];

// The stored Texas response still listed only the June-era quarantine counties plus El Paso, which
// has been stale for weeks — it omitted Brewster, Crockett, Hudspeth, Jeff Davis, Pecos, Presidio,
// Starr, Terrell and Zapata. Refreshed from TAHC's own current restricted-county list (source 5),
// which is also where this sync's Presidio corroboration comes from.
const TEXAS_RESPONSE = {
  state: 'Texas',
  actions: [
    'Governor Abbott disaster declaration covering all 254 Texas counties',
    'Infested zones with animal movement restrictions currently in parts of Brewster, Crockett, Edwards, El Paso, Hudspeth, Jeff Davis, Pecos, Presidio, Schleicher, Starr, Sutton, Terrell, Val Verde and Zapata counties (TAHC, Oct 29, 2026)',
    'Warm-blooded animals may not leave an infested zone without TAHC authorization; inspection and an NWS Movement/Treatment certificate required',
    'Mandatory livestock inspections within 150mi of cases',
    'Sterile fly release program activated (USDA/APHIS) from Moore Air Base, Edinburg',
    'Interstate movement permits required for all livestock',
    'NWS Certified Inspector Program launched with Texas A&M AgriLife',
  ],
};

const LAST_UPDATED = '2026-10-30T00:00:00Z';
const LAST_CHECKED = new Date().toISOString();

// ---- The truth table this sync asserts, from sources 1 and 2 ----
const EXPECTED_TOTAL_BEFORE = 71;
const EXPECTED_TOTAL_AFTER = 74;
const EXPECTED_ACTIVE_BEFORE_COUNT = 18;
const EXPECTED_ACTIVE_AFTER_COUNT = 21;
const EXPECTED_INACTIVE_AFTER = 53;
const EXPECTED_COUNTIES = 27;

const EXPECTED_TX = { total: 59, active: 8 };
const EXPECTED_NM = { total: 14, active: 12 };
const EXPECTED_AZ = { total: 1, active: 1 };
const EXPECTED_ACTIVE_SPLIT = { AZ: 1, NM: 12, TX: 8 };

const EXPECTED_TX_COUNTY_COUNT = 20;
const EXPECTED_NM_COUNTY_LIST = ['Dona Ana', 'Grant', 'Hidalgo', 'Lea', 'Luna', 'Otero'];
const EXPECTED_AZ_COUNTY_LIST = ['Cochise'];

const APHIS_BY_SPECIES = { Bovine: 35, Canine: 9, Caprine: 7, Cervid: 1, Equine: 4, Feline: 1, Ovine: 17 };
const SPECIES_LABEL = {
  Bovine: 'Bovine (Cattle)', Canine: 'Canine (Dogs)', Caprine: 'Caprine (Goats)',
  Cervid: 'Cervid (Elk)', Equine: 'Equine (Horses)', Feline: 'Feline (Cats)', Ovine: 'Ovine (Sheep)',
};
const APHIS_SPECIES_LABEL = {
  Bovine: 'Cattle', Canine: 'Dog', Caprine: 'Goats', Cervid: 'Elk',
  Equine: 'Horse', Feline: 'Domestic Cat', Ovine: 'Sheep',
};

// Tracker months. These EXCLUDE the Sep 25 Brewster fly-trap row, which is a wild fly detection
// and not an animal case; that is the whole of the difference from source 2's Sep total of 4.
const APHIS_BY_MONTH = {
  '2026-06': { total: 30, active: 0 },
  '2026-07': { total: 14, active: 0 },
  '2026-08': { total: 4, active: 0 },
  '2026-09': { total: 3, active: 0 },
  '2026-10': { total: 23, active: 21 },
};

// County totals this sync touches or whose notes make a claim about them.
const EXPECTED_COUNTY_TOTALS = [
  ['Presidio', 'TX', { total: 2, active: 1 }],
  ['Dona Ana', 'NM', { total: 5, active: 5 }],
  ['Luna', 'NM', { total: 2, active: 2 }],
  ['Grant', 'NM', { total: 4, active: 3 }],
  ['Brewster', 'TX', { total: 6, active: 1 }],
  ['Jeff Davis', 'TX', { total: 1, active: 1 }],
  ['Crockett', 'TX', { total: 13, active: 0 }],
];

// Pre-existing drift, pinned so it cannot get worse (see the header note).
const KNOWN_DATE_DRIFT = [
  [20, '2026-06-23'], [29, '2026-06-30'], [41, '2026-07-17'], [60, '2026-10-20'],
];
const KNOWN_ANIMAL_DRIFT = [[1, 'Calf'], [2, 'Calf'], [3, 'Calf'], [6, 'Calf'], [42, 'Goat']];

// PRE-EXISTING DB/FALLBACK COORDINATE DRIFT, found by this sync's new field-for-field parity
// check (earlier syncs only compared ids, status and the breakdown, so they never looked at
// coordinates). Exactly two of the 74 cases disagree between the Neon rows and the static
// fallback, and they are the only two DB rows carrying float noise rather than a 4-decimal
// county coordinate — they look like the residue of an old de-overlap pass:
//     id 21  Edwards TX   DB 29.987810885824565, -100.20048911417544  vs  fallback 29.9427, -100.2356  (3.7 mi apart)
//     id 28  Uvalde TX    DB 29.21291626177021,  -99.78298373822979   vs  fallback 29.2129,  -99.783    (same point, extra precision)
// Both are June/July Texas cases, both long inactive, and APHIS only reports location at county
// level anyway, so 3.7 miles inside Edwards County changes nothing a reader would act on.
// /api/cases serves coordinates from the DB, so production is self-consistent; the divergence
// only surfaces if the DB is unreachable and the fallback renders. Which of the two values is
// "right" is not knowable from APHIS data, so this sync does NOT guess — it pins both pairs so
// they cannot drift further and so the next sync inherits them as known items.
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
  if (new Set(NEW_IDS).size !== NEW_IDS.length) fail('Duplicate id in NEW_CASES');
  // Every new case this sync adds is active cattle, which is what makes active advance by 3
  // and Bovine advance by 3.
  if (NEW_CASES.some(c => c.species !== 'Bovine' || c.animal !== 'Cattle' || c.status !== 'active')) {
    fail('This sync asserts all three new cases are active Bovine/Cattle');
  }
  console.log('✓ This script\'s own truth table is internally consistent');

  for (let i = 1; i < NEW_CASES.length; i += 1) {
    if (NEW_CASES[i].date < NEW_CASES[i - 1].date) fail(`NEW_CASES is not in date order at id ${NEW_CASES[i].id}`);
    if (NEW_CASES[i].id !== NEW_CASES[i - 1].id + 1) fail(`NEW_CASES ids are not contiguous at id ${NEW_CASES[i].id}`);
  }
  for (let i = 1; i < NEW_CASES.length; i += 1) {
    const a = NEW_CASES[i - 1];
    const b = NEW_CASES[i];
    if (a.date === b.date && NEW_REFS[b.id].SU <= NEW_REFS[a.id].SU) {
      fail(`Same-day cases ${a.id}/${b.id} are not ordered by their APHIS SU reference`);
    }
  }
  console.log('✓ New cases are ordered by confirmed date, then by APHIS reference');

  // Each new case's notes must actually carry the APHIS references attributed to it.
  for (const c of NEW_CASES) {
    const { SU, SS } = NEW_REFS[c.id];
    if (!c.notes.includes(`SU:${SU}:27`) || !c.notes.includes(`SS:${SS}:27`)) {
      fail(`Case ${c.id} notes do not carry SU:${SU}:27 / SS:${SS}:27`);
    }
  }
  console.log('✓ Every new case carries its APHIS reference pair in the notes');

  // This script is re-runnable: if a previous run already inserted the three cases, the
  // pre-insert assertions below describe a state that no longer exists, so they are skipped and
  // every post-insert assertion still runs as a full re-verification.
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
  console.log(`✓ New ids ${NEW_IDS.join('/')} follow the highest existing id (${maxId})`);

  // No pre-existing row may already claim one of this sync's APHIS references.
  const allNotes = (await sql`SELECT notes FROM screwworm_cases WHERE id <> ALL(${NEW_IDS})`).map(r => r.notes).join(' ');
  for (const [id, { SU, SS }] of Object.entries(NEW_REFS)) {
    if (allNotes.includes(`SU:${SU}:27`)) fail(`SU:${SU}:27 (case ${id}) is already recorded on another case`);
    if (allNotes.includes(`SS:${SS}:27`)) fail(`SS:${SS}:27 (case ${id}) is already recorded on another case`);
  }
  console.log('✓ None of this sync\'s APHIS references are already in the data');

  // ---- Pre-insert shape assertions (skipped on a re-run, where the state has moved on) ----
  if (ALREADY_APPLIED) console.log('… skipping pre-insert shape assertions (already applied)');

  // Presidio must already exist as a county (so the county count does NOT move), and its only
  // case must be the Sep 9 equine, inactive — both claims case 73's notes make.
  const presidioBefore = ALREADY_APPLIED ? null : await sql`
    SELECT id, to_char(date, 'YYYY-MM-DD') AS "date", species, animal, status
    FROM screwworm_cases WHERE county = 'Presidio' AND state = 'TX' AND id <> ALL(${NEW_IDS}) ORDER BY id
  `;
  if (!ALREADY_APPLIED) {
    if (presidioBefore.length !== 1 || presidioBefore[0].date !== '2026-09-09'
        || presidioBefore[0].species !== 'Equine' || presidioBefore[0].status !== 'inactive') {
      fail(`Case 73's notes claim Presidio's only earlier case is the inactive Sep 9 horse, got ${JSON.stringify(presidioBefore)}`);
    }
    console.log(`✓ Presidio had exactly 1 earlier case — #${presidioBefore[0].id}, Sep 9 Equine, inactive (so no new county)`);

    // Luna must already have exactly one case, the Oct 26 cattle — case 75's notes say so.
    const lunaBefore = await sql`
      SELECT id, to_char(date, 'YYYY-MM-DD') AS "date", species, status
      FROM screwworm_cases WHERE county = 'Luna' AND state = 'NM' AND id <> ALL(${NEW_IDS}) ORDER BY id
    `;
    if (lunaBefore.length !== 1 || lunaBefore[0].date !== '2026-10-26'
        || lunaBefore[0].species !== 'Bovine' || lunaBefore[0].status !== 'active') {
      fail(`Case 75's notes claim Luna's only earlier case is the active Oct 26 cattle, got ${JSON.stringify(lunaBefore)}`);
    }
    console.log(`✓ Luna had exactly 1 earlier case — #${lunaBefore[0].id}, Oct 26 Bovine, active`);

    // Dona Ana must already have exactly 4, all active, as 1 cattle / 1 sheep / 2 dogs.
    const donaBefore = await sql`
      SELECT species, COUNT(*) AS "n", COUNT(*) FILTER (WHERE status = 'active') AS "a"
      FROM screwworm_cases WHERE county = 'Dona Ana' AND state = 'NM' AND id <> ALL(${NEW_IDS}) GROUP BY 1 ORDER BY 1
    `;
    const donaMap = Object.fromEntries(donaBefore.map(r => [r.species, Number(r.n)]));
    if (JSON.stringify(donaMap) !== JSON.stringify({ Bovine: 1, Canine: 2, Ovine: 1 })) {
      fail(`Case 74's notes imply Dona Ana held 1 cattle / 2 dogs / 1 sheep before this sync, got ${JSON.stringify(donaMap)}`);
    }
    if (donaBefore.some(r => Number(r.a) !== Number(r.n))) fail('A pre-existing Dona Ana case is not active');
    console.log('✓ Dona Ana held 4 cases before this sync — 1 Bovine, 1 Ovine, 2 Canine, all active');
  }

  // The Sep 9 Presidio horse must still be the outbreak's FIRST equine case, as case 73's notes
  // say. True before and after the inserts, so this runs either way.
  const equines = await sql`
    SELECT id, to_char(date, 'YYYY-MM-DD') AS "date" FROM screwworm_cases WHERE species = 'Equine' ORDER BY date, id
  `;
  if (equines[0].id !== 50 || equines[0].date !== '2026-09-09') {
    fail(`Case 73's notes call the Sep 9 Presidio horse (#50) the first equine case, but #${equines[0].id} (${equines[0].date}) is first`);
  }
  console.log(`✓ The Presidio horse (#${equines[0].id}) is still the outbreak's first equine case`);

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
  console.log(`✓ Active set is exactly the previous ${activeBefore.length} plus ids ${NEW_IDS.join('/')}`);

  // ---- 3. Species breakdown ----
  const bySpeciesRows = await sql`SELECT species, COUNT(*) AS "count" FROM screwworm_cases GROUP BY 1`;
  const speciesCounts = Object.fromEntries(bySpeciesRows.map(r => [r.species, Number(r.count)]));
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
  // Only Bovine may move, and it must move by exactly 3.
  for (const entry of newBreakdown) {
    const old = oldBreakdown.find(e => e.species === entry.species);
    const delta = entry.count - old.count;
    const want = (entry.species === 'Bovine (Cattle)' && !ALREADY_APPLIED) ? 3 : 0;
    if (delta !== want) fail(`${entry.species} moved by ${delta}, expected ${want}`);
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
  // Either way the finished timeline must carry both of this sync's entries, exactly once each.
  for (const entry of TIMELINE_ENTRIES) {
    const hits = ctx.timeline.filter(e => e.date === entry.date && e.event === entry.event);
    if (hits.length !== 1) fail(`Timeline holds ${hits.length} copies of this sync's ${entry.date} entry`);
  }
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('internationalContext', ${JSON.stringify(ctx)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log(`✓ Timeline: ${tlBefore} -> ${ctx.timeline.length} entries`);

  // ---- 5. State responses (refresh the stale Texas entry) ----
  const srRows = await sql`SELECT value FROM screwworm_metadata WHERE key = 'stateResponses'`;
  const srOld = typeof srRows[0].value === 'string' ? JSON.parse(srRows[0].value) : srRows[0].value;
  const newResponses = srOld.map(r => (r.state === 'Texas' ? TEXAS_RESPONSE : r));
  if (!newResponses.some(r => r.state === 'Texas')) fail('Texas response entry vanished');
  if (JSON.stringify(newResponses.map(r => r.state)) !== JSON.stringify(srOld.map(r => r.state))) {
    fail('stateResponses state list changed');
  }
  if (!newResponses.find(r => r.state === 'Texas').actions.some(a => a.includes('Presidio'))) {
    fail('Refreshed Texas response does not mention Presidio');
  }
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('stateResponses', ${JSON.stringify(newResponses)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log('✓ Texas response refreshed from the TAHC restricted-county list');

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
  // No two cases may share a pin, which is the whole point of the coordinate offsets — with one
  // KNOWN PRE-EXISTING EXCEPTION found while asserting this: ids 12 (Jun 12 sheep) and 42 (Jul 21
  // goat) are both Sutton County, TX, both inactive, and both sit on the county seat (Sonora) at
  // 30.4994, -100.5407, so they render as a single stacked pin and one of the two is invisible on
  // the map. That predates this sync and is left alone here; it is pinned so it cannot spread, and
  // so the next sync inherits it as a known item rather than a surprise.
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
  if (!txCounties.includes('Presidio')) fail('Presidio missing from the TX county list');

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

  // Case 74's notes: Dona Ana is the largest ACTIVE cluster, outright.
  const byActive = await sql`
    SELECT county, state, COUNT(*) FILTER (WHERE status = 'active') AS "a" FROM screwworm_cases
    GROUP BY 1, 2 ORDER BY "a" DESC, county
  `;
  if (`${byActive[0].county}, ${byActive[0].state}` !== 'Dona Ana, NM' || Number(byActive[0].a) !== 5) {
    fail(`Expected Dona Ana, NM to lead on active cases with 5, got ${byActive[0].county}, ${byActive[0].state} with ${byActive[0].a}`);
  }
  if (Number(byActive[1].a) >= Number(byActive[0].a)) {
    fail(`Dona Ana does not lead active cases outright — ${byActive[1].county}, ${byActive[1].state} also has ${byActive[1].a}`);
  }
  console.log(`✓ Dona Ana, NM leads active cases outright with ${byActive[0].a} (next is ${byActive[1].county}, ${byActive[1].state} with ${byActive[1].a})`);

  // Case 74's notes: Crockett, TX is still the largest cluster by TOTAL cases, all closed.
  const byTotal = await sql`SELECT county, state, COUNT(*) AS "n" FROM screwworm_cases GROUP BY 1, 2 ORDER BY "n" DESC, county`;
  if (`${byTotal[0].county}, ${byTotal[0].state}` !== 'Crockett, TX' || Number(byTotal[0].n) !== 13) {
    fail(`Expected Crockett, TX largest by total at 13, got ${byTotal[0].county}, ${byTotal[0].state} with ${byTotal[0].n}`);
  }
  console.log(`✓ Crockett, TX is still the largest cluster by total cases (${byTotal[0].n}, all inactive)`);

  // Case 74's notes: Dona Ana has PASSED Grant to lead New Mexico by total cases, outright.
  const nmByTotal = await sql`
    SELECT county, COUNT(*) AS "n" FROM screwworm_cases WHERE state = 'NM' GROUP BY 1 ORDER BY "n" DESC, county
  `;
  if (nmByTotal[0].county !== 'Dona Ana' || Number(nmByTotal[0].n) !== 5) {
    fail(`Expected Dona Ana to lead New Mexico with 5 total, got ${JSON.stringify(nmByTotal.slice(0, 2))}`);
  }
  if (Number(nmByTotal[1].n) >= Number(nmByTotal[0].n)) {
    fail(`Dona Ana does not lead New Mexico outright — ${nmByTotal[1].county} also has ${nmByTotal[1].n}`);
  }
  if (nmByTotal[1].county !== 'Grant' || Number(nmByTotal[1].n) !== 4) {
    fail(`Case 75's notes put Grant second in New Mexico at 4, got ${nmByTotal[1].county} with ${nmByTotal[1].n}`);
  }
  console.log(`✓ Dona Ana leads New Mexico at ${nmByTotal[0].n} total, ahead of Grant at ${nmByTotal[1].n}`);

  // Case 74's notes: the corrected Dona Ana date pattern — Oct 24 x2, gap on Oct 25 AND Oct 26,
  // then Oct 27, 28, 29. This is the claim the brief got wrong.
  const donaDates = (await sql`
    SELECT to_char(date, 'YYYY-MM-DD') AS "d", COUNT(*) AS "n" FROM screwworm_cases
    WHERE county = 'Dona Ana' AND state = 'NM' GROUP BY 1 ORDER BY 1
  `).map(r => [r.d, Number(r.n)]);
  const wantDona = [['2026-10-24', 2], ['2026-10-27', 1], ['2026-10-28', 1], ['2026-10-29', 1]];
  if (JSON.stringify(donaDates) !== JSON.stringify(wantDona)) {
    fail(`Dona Ana case dates ${JSON.stringify(donaDates)} != ${JSON.stringify(wantDona)}`);
  }
  for (const gap of ['2026-10-25', '2026-10-26']) {
    if (donaDates.some(([d]) => d === gap)) fail(`Dona Ana has a case on ${gap}; the notes say Oct 25-26 is a two-day gap`);
  }
  console.log('✓ Dona Ana dates: Oct 24 (x2), no case Oct 25 or Oct 26, then Oct 27/28/29 — the brief\'s "except Oct 25" was wrong');
  // And Oct 26's New Mexico case was Luna, which is what the brief mistook for Dona Ana.
  const oct26 = await sql`SELECT id, county, state FROM screwworm_cases WHERE date = '2026-10-26'`;
  if (oct26.length !== 1 || oct26[0].county !== 'Luna') fail(`Expected Oct 26 to be the single Luna case, got ${JSON.stringify(oct26)}`);
  console.log(`✓ Oct 26's only case is #${oct26[0].id}, Luna County, NM`);

  // Case 75's notes: Luna's two cases are both cattle, both active, three days apart.
  const lunaAfter = await sql`
    SELECT id, to_char(date, 'YYYY-MM-DD') AS "d", species, status FROM screwworm_cases
    WHERE county = 'Luna' AND state = 'NM' ORDER BY date, id
  `;
  if (lunaAfter.length !== 2 || lunaAfter.some(r => r.species !== 'Bovine' || r.status !== 'active')) {
    fail(`Case 75's notes say both Luna cases are active cattle, got ${JSON.stringify(lunaAfter)}`);
  }
  const lunaGap = (new Date(lunaAfter[1].d) - new Date(lunaAfter[0].d)) / 86400000;
  if (lunaGap !== 3) fail(`Case 75's notes say Luna's two cases are three days apart, data says ${lunaGap}`);
  console.log(`✓ Luna: 2 active cattle cases, ${lunaAfter[0].d} and ${lunaAfter[1].d} (${lunaGap} days apart)`);

  // Case 73's notes: Presidio is now active, and Brewster/Jeff Davis flank it as described.
  const presidioAfter = await sql`
    SELECT COUNT(*) FILTER (WHERE status = 'active') AS "a" FROM screwworm_cases WHERE county = 'Presidio' AND state = 'TX'
  `;
  if (Number(presidioAfter[0].a) !== 1) fail(`Presidio should have exactly 1 active case, has ${presidioAfter[0].a}`);
  console.log('✓ Presidio has 1 active case — its first since the Sep 9 horse went inactive');

  // Every active case must be a domestic animal, which is what makes the rollup CSV's
  // domestic-only active column of 21 equal the tracker's 21 actives.
  const activeWildlife = await sql`SELECT id FROM screwworm_cases WHERE status = 'active' AND species = 'Cervid'`;
  if (activeWildlife.length > 0) fail(`Wildlife case still active: ${JSON.stringify(activeWildlife)}`);
  console.log(`✓ All ${EXPECTED_ACTIVE_AFTER_COUNT} active cases are domestic animals (matches "Active Cases - Domestic" = 21)`);

  const nonOctActive = await sql`SELECT id, date FROM screwworm_cases WHERE status = 'active' AND to_char(date, 'YYYY-MM') <> '2026-10'`;
  if (nonOctActive.length > 0) fail(`Active case outside October: ${JSON.stringify(nonOctActive)}`);
  const activeSplit = await sql`SELECT state, COUNT(*) AS "n" FROM screwworm_cases WHERE status = 'active' GROUP BY 1 ORDER BY 1`;
  const splitMap = Object.fromEntries(activeSplit.map(r => [r.state, Number(r.n)]));
  if (JSON.stringify(splitMap) !== JSON.stringify(EXPECTED_ACTIVE_SPLIT)) {
    fail(`Active split ${JSON.stringify(splitMap)} != ${JSON.stringify(EXPECTED_ACTIVE_SPLIT)}`);
  }
  console.log(`✓ All ${EXPECTED_ACTIVE_AFTER_COUNT} actives are October detections, split ${JSON.stringify(splitMap)}`);
  // Case 75's notes claim New Mexico now holds more actives than Texas and Arizona combined.
  if (!(splitMap.NM > splitMap.TX + splitMap.AZ)) {
    fail(`Case 75's notes claim NM > TX + AZ on actives, but ${splitMap.NM} !> ${splitMap.TX} + ${splitMap.AZ}`);
  }
  console.log(`✓ New Mexico ${splitMap.NM} actives > Texas ${splitMap.TX} + Arizona ${splitMap.AZ} combined`);

  // Bovine ordinals written into the notes: 73/74/75 are the 33rd/34th/35th cattle detections.
  const bovineRows = await sql`SELECT id FROM screwworm_cases WHERE species = 'Bovine' ORDER BY date, id`;
  const bovineOrder = bovineRows.map(r => r.id);
  for (const [id, ordinal] of [[73, 33], [74, 34], [75, 35]]) {
    if (bovineOrder.indexOf(id) + 1 !== ordinal) {
      fail(`Case #${id} is cattle number ${bovineOrder.indexOf(id) + 1}, but its notes claim ${ordinal}`);
    }
  }
  if (bovineOrder.length !== APHIS_BY_SPECIES.Bovine) fail(`${bovineOrder.length} cattle, expected ${APHIS_BY_SPECIES.Bovine}`);
  console.log(`✓ Cattle ordinals check out: ${bovineOrder.length} cattle, cases 73/74/75 are the 33rd/34th/35th`);

  // State-level ordinals: 73 is Texas's 59th, 74 is New Mexico's 13th, 75 New Mexico's 14th.
  for (const [state, pairs] of [['TX', [[73, 59]]], ['NM', [[74, 13], [75, 14]]]]) {
    const order = (await sql`SELECT id FROM screwworm_cases WHERE state = ${state} ORDER BY date, id`).map(r => r.id);
    for (const [id, ordinal] of pairs) {
      if (order.indexOf(id) + 1 !== ordinal) {
        fail(`Case #${id} is ${state} case number ${order.indexOf(id) + 1}, but its notes claim ${ordinal}`);
      }
      console.log(`✓ Case #${id} is ${state}'s ${ordinal}th case`);
    }
  }

  // Within-county ordinals the notes claim: Presidio 2nd, Dona Ana 5th, Luna 2nd.
  for (const [id, county, state, ordinal] of [[73, 'Presidio', 'TX', 2], [74, 'Dona Ana', 'NM', 5], [75, 'Luna', 'NM', 2]]) {
    const order = (await sql`
      SELECT id FROM screwworm_cases WHERE county = ${county} AND state = ${state} ORDER BY date, id
    `).map(r => r.id);
    if (order.indexOf(id) + 1 !== ordinal) {
      fail(`Case #${id} is ${county} case number ${order.indexOf(id) + 1}, but its notes claim ${ordinal}`);
    }
    console.log(`✓ Case #${id} is the ${ordinal}${ordinal === 2 ? 'nd' : 'th'} ${county} County case`);
  }

  // The documented id-ordering artifact: case 73 has a LOWER APHIS reference than 71 and 72
  // despite a higher id. Asserted so it stays known rather than silently drifting.
  const oct28 = await sql`SELECT id, notes FROM screwworm_cases WHERE date = '2026-10-28' ORDER BY id`;
  if (oct28.length !== 4 || JSON.stringify(oct28.map(r => r.id)) !== JSON.stringify([70, 71, 72, 73])) {
    fail(`Expected Oct 28 to hold ids 70-73, got ${JSON.stringify(oct28.map(r => r.id))}`);
  }
  const suOf = n => Number(String(n).match(/SU:(\d+):27/)[1]);
  const su73 = suOf(oct28.find(r => r.id === 73).notes);
  const su71 = suOf(oct28.find(r => r.id === 71).notes);
  if (!(su73 < su71)) fail(`The documented backfill artifact is gone: SU of 73 (${su73}) is no longer below that of 71 (${su71})`);
  console.log(`✓ Documented backfill artifact intact: case 73 carries SU:${su73}:27, below case 71's SU:${su71}:27`);

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
