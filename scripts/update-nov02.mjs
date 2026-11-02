import { neon } from '@neondatabase/serverless';
import { readFileSync, writeFileSync } from 'fs';

const envFile = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}

const sql = neon(process.env.DATABASE_URL);

// APHIS sync Nov 2, 2026 — FOUR new domestic cases and ONE reclassification.
// 75 -> 79 animal cases, 22 -> 25 active, 53 -> 54 inactive, 27 counties (unchanged),
// 3 states (unchanged).
//
// ---------------------------------------------------------------------------------------
// THE BRIEF FOR THIS SYNC GOT THE HEADLINE RIGHT AND THE DETAIL WRONG.
//
// Its totals check out exactly: 79 animal cases (78 domestic + 1 wildlife), 25 active
// domestic, 53 inactive domestic, 5 fly trap detections. Every one of those is confirmed
// against the case-level export below. But three of its specifics do not survive the diff:
//
//   1. WRONG COUNTY on the horse. The brief says "Oct 31 — Grant County, NM — Horse".
//      The export says DONA ANA:
//          New Mexico, DONA ANA, SU:28410:27, SS:12786:27   10/31/2026  Horse  Active
//      Grant's Oct 31 case is the CATTLE (SU:28411:27), which the brief also lists. So the
//      brief effectively reported two Grant cases and missed that one of them is Dona Ana's.
//      This matters beyond bookkeeping: it is Dona Ana's FIRST horse and its FOURTH species,
//      and it is what takes that county to 8 cases.
//
//   2. THE UNIDENTIFIED FOURTH CASE is Hudspeth County, TX — not New Mexico at all. The brief
//      guessed "potentially 1 more case from Oct 30/31 not yet identified". The diff names it:
//          Texas, HUDSPETH, SU:28349:27, SS:12780:27   10/30/2026  Cattle  Active
//      It carries an Oct 30 confirmed date but was absent from yesterday's export, so it is a
//      backfill — the same pattern as the Presidio case on Oct 28.
//
//   3. THE BRIEF MISSED A RECLASSIFICATION ENTIRELY. It asks whether any active case has gone
//      inactive; one has, and it is not in the brief's list:
//          id 54, Pecos County, TX cattle, Oct 10 (SU:27720:27)   active -> Inactive
//      This is the arithmetic that makes the brief's own numbers work. Four new cases, all
//      Active, against 22 existing actives would give 26, not the 25 the brief and the export
//      both report. 22 + 4 - 1 = 25. Had this script trusted the brief's case list and skipped
//      the status diff, it would have shipped 26 active and silently disagreed with APHIS.
//
// This is the third sync in five where the brief's case list was wrong, so the method stands:
// diff the full case-level export row-by-row on (date, county, state, species) AND on status,
// and trust the export. The diff leaves exactly four unmatched export rows and exactly one
// status mismatch, which is what this script ships.
//
// ---------------------------------------------------------------------------------------
// SOURCES
//
// 1. APHIS public Tableau CASE-LEVEL export (publicdashboards.dl.usda.gov/t/MRP_PUB/views/
//    NewWorldScrewwormPublicReporting_17805168329840/ExportToCSV.csv), fetched Nov 2 05:36 ET.
//    84 rows: 78 Domestic, 1 Wildlife & Feral (the Oct 21 Pecos elk), 5 Fly Trap. That makes
//    79 animal rows, 25 Active, 54 Inactive. All 5 fly-trap rows are Inactive, so all 25
//    actives in the export are animal cases and the tracker's 25 is the same 25.
//    Diffed row-by-row against all 75 tracker cases on (date +/-1 day, county, state, species)
//    and then on status: 4 export rows unmatched, 1 matched pair disagreeing on status.
//
// 2. APHIS public Tableau SummaryDashboard.csv rollup, fetched in the same minute. It is an
//    INDEPENDENT aggregation of the same data and it agrees with the case-level export on
//    every month still inside its window:
//        Aug 2026   0 active /  4 inactive domestic,   4 domestic,   4 total
//        Sep 2026   0 active /  3 inactive domestic,   3 domestic,   4 total  (+1 fly trap)
//        Oct 2026  25 active /  2 inactive domestic,  27 domestic,  32 total  (+1 wildlife, +4 fly trap)
//    25 active for October, and no actives in any other month, is what independently confirms
//    the 25 active this script lands on — and it also independently confirms the Pecos
//    reclassification, because October's inactive domestic count goes 1 -> 2 and the two rows
//    are the Oct 2 Brewster dog and the Oct 10 Pecos cow.
//    October's total of 32 against 27 domestic is a GAP OF FIVE: the elk and four fly traps.
//    The tracker carries the elk and no fly traps, which is why APHIS_BY_MONTH puts October
//    at 28.
//    CAVEAT, now worse than previous syncs: the rollup's month window has scrolled again and
//    JULY has now dropped out of it alongside June. Both months are still asserted below from
//    the case-level export, which does still carry them (June 30, July 14).
//
// 3. FIVE FLY TRAP DETECTIONS, up from two at the last sync — the brief's count of 5 is right.
//    Three are new in this export, all with an Oct 29 confirmed date, all in Texas:
//        Texas, HUDSPETH,   SU:28253:27, SS:12784:27   10/29/2026  Fly  Inactive
//        Texas, JEFF DAVIS, SU:28201:27, SS:12782:27   10/29/2026  Fly  Inactive
//        Texas, PECOS,      SU:28222:27, SS:12783:27   10/29/2026  Fly  Inactive
//    joining Brewster (Sep 25) and Dona Ana (Oct 29). Like the Dona Ana trap last sync, these
//    appeared in the export after their confirmed date had passed.
//    This tracker records animal cases, not fly-trap detections, so NONE of the five is
//    inserted — that exclusion is what keeps the tracker's September total at 3 against the
//    rollup's 4, and October at 28 against the rollup's 32. The exclusion is asserted below
//    (no tracker row may carry the species "Fly"), so a future sync cannot quietly pull one in
//    and double-count a county.
//    WORTH NOTING ON ITS OWN: the Hudspeth trap and the new Hudspeth cow are the same county
//    two days apart, which is the same pairing of wild-fly and animal evidence that showed up
//    in Dona Ana last sync. Jeff Davis and Pecos both already have animal cases too. All four
//    trap counties outside Brewster now have animal cases in the same county.
//
// 4. No press corroboration exists for any of these four cases. Searched Nov 2: New Mexico
//    coverage is still running two to three days behind the dashboard (the latest NMDA
//    announcements found cover the Oct 27 Dona Ana pair), and nothing covers the far-west
//    Texas counties for Oct 30. Source 1 is the basis here, as it was for the Oct 28-31 cases.
//    The standing ScrewwormNM.org advisory and the 12.4-mile Las Cruces infested zone already
//    cover the Dona Ana detections' footprint, and TAHC's infested-zone list already names
//    Hudspeth (it has been on it since the Oct 23 pair), so no state-response text needs
//    refreshing this sync.
//
// ---------------------------------------------------------------------------------------
// WHAT THESE CASES MEAN FOR THE SHAPE OF THE OUTBREAK
//
// Dona Ana now holds 8 cases in eight days, all active, across FOUR species — 3 cattle,
// 1 sheep, 3 dogs, 1 horse. It is the outbreak's largest active cluster by a wide margin
// (next is Grant, NM at 4 active) and New Mexico's largest cluster by total cases. Crockett
// County, TX is still the largest cluster by total cases overall at 13, though all 13 are long
// since closed.
//
// New Mexico now holds 16 of the outbreak's 25 active cases against Texas's 8 and Arizona's 1
// — nearly twice both combined — from 18 total cases, while Texas has 60 total cases and only
// 8 active. A fortnight ago New Mexico had 5 cases in total.
//
// Hudspeth is the counterweight to the New Mexico story: its third case, plus a wild fly in the
// same county two days earlier, says the far-west Texas corridor between the Big Bend cluster
// and the New Mexico line is still generating detections rather than closing out.
//
// The Pecos reclassification closes that county out completely — all 6 of its animal cases and
// its elk are now inactive, and Pecos had been in the outbreak since Jun 29. It is the first
// multi-case county to go fully quiet since Val Verde in September.
//
// ---------------------------------------------------------------------------------------
// PRE-EXISTING DRIFT, DELIBERATELY NOT TOUCHED HERE
//
// Diffing the tracker's 75 existing cases against source 1 leaves exactly four mismatches, all
// off-by-one on the date and all pre-dating this sync (unchanged from the last three syncs):
//     Medina TX cattle       tracker 2026-06-23  vs  APHIS 2026-06-24
//     Pecos TX dog           tracker 2026-06-30  vs  APHIS 2026-06-29
//     Starr TX cattle        tracker 2026-07-17  vs  APHIS 2026-07-18
//     Val Verde TX cattle    tracker 2026-10-20  vs  APHIS 2026-10-21
// The drift runs in BOTH directions, so it is not a timezone bug. All four stay inside their
// original month, so no monthly, county, state, species or status total below is affected.
// Four tracker rows also record the APHIS species "Cattle" as "Calf" (ids 1, 2, 3, 6), one
// records "Goats" as "Goat" (id 42), and one records "Domestic Cat" as "Cat" (id 72); same
// situation — cosmetic, in-species, not this sync's business. The DB/fallback coordinate drift
// on ids 21 and 28, and the stacked Sutton pin on ids 12 and 42, are likewise pinned and not
// fixed. Changing any of it is a separate decision. The assertions pin all of it so it cannot
// drift further unnoticed.
//
// The documented id-ordering artifact on Oct 28 (case 73 carries a lower APHIS reference than
// cases 71 and 72 despite a higher id, because it was a backfill) is re-asserted here too, and
// case 77 below is the same kind of artifact: an Oct 30 case with an id above the Oct 31 cases
// is impossible, so it is ordered first among this batch and its date is asserted explicitly.
//
// No code changes ship with this sync. Both species in this batch are long since wired:
// Bovine through the chart, API labels, breakdown classes, CSS and cron normaliser, and Equine
// likewise since the Sep 9 Presidio horse. The species-wiring assertions at the end re-verify
// that anyway.

const JSON_PATH = '/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/src/data/cases.json';

const NEW_CASES = [
  {
    id: 77,
    date: '2026-10-30',
    species: 'Bovine',
    animal: 'Cattle',
    county: 'Hudspeth',
    state: 'TX',
    lat: 31.9445,
    lng: -105.1802,
    status: 'active',
    notes:
      "Third Hudspeth County case and Texas's sixtieth case; the thirty-sixth bovine (cattle) detection of the US outbreak. All three Hudspeth cases are cattle and all three are active: the county opened with a same-day pair on Oct 23 (cases 63 and 64) and this is its first case since, a week later. This case was ABSENT FROM THE DAILY BRIEF, which guessed at an unidentified fourth case somewhere in New Mexico on Oct 30 or 31; it was found by diffing the APHIS case-level export, and it is in far-west Texas. It carries an Oct 30 confirmed date but was not in the Oct 31 export, so it is a backfill, the same pattern as the Presidio case (73) on Oct 28 — which is why its id sits below the Oct 31 cases in this batch. APHIS also confirmed a WILD FLY TRAP detection in Hudspeth County on Oct 29 (SU:28253:27), two days before this cow, one of three new Texas fly traps in this export alongside Jeff Davis and Pecos; fly-trap detections are not animal cases and are not counted in this tracker. That pairing of a wild fly and an animal case in the same county within days is the same signal that showed up in Dona Ana last sync, and it points to the fly breeding locally in the far-west corridor rather than arriving with shipments. Hudspeth runs from the Rio Grande and the Mexican border north to the New Mexico line, and it sits in the gap between the Jeff Davis and Pecos clusters to the southeast and the Dona Ana cluster to the northwest, so this corridor is still generating detections while Texas's older clusters close out. The county has been on the TAHC infested-zone list since the Oct 23 pair. Domestic animal; APHIS reports location at county level, so the coordinates are offset slightly from the two Oct 23 cases so the pins do not render on top of each other; SU:28349:27, SS:12780:27; confirmed per APHIS dashboard Oct 30",
  },
  {
    id: 78,
    date: '2026-10-31',
    species: 'Bovine',
    animal: 'Cattle',
    county: 'Dona Ana',
    state: 'NM',
    lat: 32.3641,
    lng: -106.7301,
    status: 'active',
    notes:
      "Seventh Dona Ana County case and New Mexico's sixteenth case; the thirty-seventh bovine (cattle) detection of the US outbreak and the county's THIRD head of cattle, after the Oct 24 cow and the Oct 29 cow. Confirmed the same day as the Dona Ana horse (case 79) and the Grant County cow (case 80) — three New Mexico cases in one day, the state's largest single-day total of the outbreak. Dona Ana remains the outbreak's LARGEST ACTIVE CLUSTER: with case 79 it reaches 8 cases, all active, in eight days. Las Cruces and the New Mexico State University campus both fall inside the resulting 12.4-mile infested zone. Domestic animal; APHIS reports location at county level, so the coordinates are offset slightly from the other Dona Ana cases near the county seat (Las Cruces) so the pins do not render on top of each other; SU:28406:27, SS:12785:27; confirmed per APHIS dashboard Oct 31",
  },
  {
    id: 79,
    date: '2026-10-31',
    species: 'Equine',
    animal: 'Horse',
    county: 'Dona Ana',
    state: 'NM',
    lat: 32.2815,
    lng: -106.8104,
    status: 'active',
    notes:
      "Eighth Dona Ana County case and New Mexico's seventeenth case; the FIFTH EQUINE (horse) detection of the US outbreak and DONA ANA'S FIRST HORSE, which makes it the county's FOURTH SPECIES after cattle, sheep and dogs. The daily brief placed this horse in GRANT County; the APHIS case-level export puts it in DONA ANA (SU:28410:27), and Grant's Oct 31 case is the cow recorded here as case 80. Dona Ana now holds 8 cases in eight days, ALL ACTIVE, across four species — 3 cattle, 1 sheep, 3 dogs, 1 horse — which is the outbreak's largest active cluster by a wide margin over Grant County, NM at 4 active, and New Mexico's largest cluster by total cases; Crockett County, TX is still the largest cluster by total cases overall at 13, though all 13 are long since closed. A fourth species in one county inside eight days is the point: the cluster now spans livestock, companion animals and equines, and three of the eight are dogs, which move outside the livestock permit system the response depends on. Together with the WILD FLY TRAP detection APHIS confirmed in this same county on Oct 29 (SU:28266:27), the evidence that the fly is breeding locally around Las Cruces rather than arriving with shipments keeps accumulating. Horses are also the species that carried the outbreak into New Mexico in the first place — the Sep 17 Grant County horse was the state's second case — and the other three equine detections were Presidio TX (Sep 9, inactive), Grant NM (Oct 15, active) and Brewster TX (Oct 18, active). Las Cruces and the New Mexico State University campus both fall inside the 12.4-mile infested zone. Domestic animal; APHIS reports location at county level, so the coordinates are offset slightly from the other Dona Ana cases near the county seat (Las Cruces) so the pins do not render on top of each other; SU:28410:27, SS:12786:27; confirmed per APHIS dashboard Oct 31",
  },
  {
    id: 80,
    date: '2026-10-31',
    species: 'Bovine',
    animal: 'Cattle',
    county: 'Grant',
    state: 'NM',
    lat: 32.7449,
    lng: -108.2703,
    status: 'active',
    notes:
      "Fifth Grant County case and New Mexico's eighteenth case; the thirty-eighth bovine (cattle) detection of the US outbreak and the county's SECOND head of cattle, after the Oct 15 calf. Grant now holds 5 cases across four species — 2 cattle, 2 horses and the Oct 28 domestic cat that was the outbreak's first feline detection — with 4 active; its only inactive case is the Sep 17 horse that was New Mexico's second case of the outbreak and the detection that opened the county. That makes Grant the second-largest active cluster of the outbreak behind Dona Ana, and the two of them, either side of Luna County, account for 12 of New Mexico's 16 active cases. Confirmed the same day as the two Dona Ana cases (78 and 79) — three New Mexico cases in one day, the state's largest single-day total of the outbreak. New Mexico now holds 16 of the outbreak's 25 active cases, nearly twice Texas (8) and Arizona (1) combined, from 18 total cases against Texas's 60. Grant sits in the southwestern cluster that runs unbroken along the Mexican border from Hidalgo through Luna to Dona Ana, and it borders Cochise County, AZ, where the outbreak's only Arizona case was confirmed Oct 28. Domestic animal; APHIS reports location at county level, so the coordinates are offset slightly from the other Grant cases near the county seat (Silver City) so the pins do not render on top of each other; SU:28411:27, SS:12787:27; confirmed per APHIS dashboard Oct 31",
  },
];

// The single status change this sync. Found by the status diff, absent from the brief.
const RECLASSIFIED = [
  {
    id: 54,
    from: 'active',
    to: 'inactive',
    why: 'Pecos County, TX cattle confirmed Oct 10 (SU:27720:27) moved to Inactive per the APHIS case-level export, 21 days after confirmation, matching the outbreak\'s typical resolution window. This closes Pecos County out completely: all 6 of its animal cases and its Oct 21 elk are now inactive, and the county had been in the outbreak since Jun 29. It is the first multi-case county to go fully quiet since Val Verde in September.',
  },
];

const NEW_TIMELINE = [
  {
    date: '2026-10-30',
    event:
      "Case 77: cattle in Hudspeth County, TX — the county's third case and Texas's sixtieth, the thirty-sixth bovine detection of the outbreak. All three Hudspeth cases are cattle and all three are active; the county opened with a same-day pair on Oct 23 and this is its first case since. Picked up from the APHIS case-level export rather than any announcement, and absent from the daily brief, which had guessed at an unidentified fourth case in New Mexico. APHIS also confirmed a wild fly trap detection in Hudspeth County on Oct 29, two days before this cow — one of three new Texas fly traps in this export, alongside Jeff Davis and Pecos, taking the outbreak to 5 trap detections; fly-trap detections are counted by APHIS under total cases but not under animal cases, and are tracked here as context only. A wild fly and an animal case in the same county within days is the same pairing that appeared in Dona Ana two days earlier, and it says the far-west Texas corridor between the Big Bend cluster and the New Mexico line is still generating detections rather than closing out.",
  },
  {
    date: '2026-10-31',
    event:
      "THREE NEW MEXICO CASES IN ONE DAY — the state's largest single-day total of the outbreak. Cases 78 and 79: cattle and a HORSE in Dona Ana County, NM, and case 80: cattle in Grant County, NM. The Dona Ana horse is the fifth equine detection of the US outbreak and the county's FIRST, making Dona Ana a FOUR-SPECIES cluster — 3 cattle, 1 sheep, 3 dogs, 1 horse — at 8 cases in eight days, all active, far ahead of Grant at 4 active. Grant's cow is its fifth case and second head of cattle, leaving it 4 active with only the Sep 17 horse closed; between them the two counties hold 12 of New Mexico's 16 active cases. Separately, case 54 — the Oct 10 Pecos County, TX cow — is reclassified from active to inactive, which closes Pecos out completely: all 6 of its animal cases and its elk are now inactive, the first multi-case county to go fully quiet since Val Verde in September. The outbreak reaches 79 animal cases with 25 active and 54 inactive across 27 counties in 3 states; 78 of the 79 are domestic animals and 1 is wildlife. New Mexico now holds 16 of the 25 actives from 18 cases across 6 counties — nearly twice Texas (8 active from 60 cases) and Arizona (1) combined — from a state that had 5 cases in total a fortnight ago.",
  },
];

// Independent cross-check targets, from the APHIS case-level export (source 1). These are
// ANIMAL cases only: fly-trap rows are excluded, which is why Sep is 3 against the rollup's 4
// and Oct is 28 against the rollup's 32.
const APHIS_BY_MONTH = { '2026-06': 30, '2026-07': 14, '2026-08': 4, '2026-09': 3, '2026-10': 28 };

const EXPECTED = {
  total: 79,
  active: 25,
  inactive: 54,
  counties: 27,
  states: 3,
  domestic: 78,
  wildlife: 1,
  byState: { TX: { total: 60, active: 8 }, NM: { total: 18, active: 16 }, AZ: { total: 1, active: 1 } },
  species: { Bovine: 38, Canine: 10, Caprine: 7, Cervid: 1, Equine: 5, Feline: 1, Ovine: 17 },
  donaAna: { total: 8, active: 8, species: 4 },
  grant: { total: 5, active: 4 },
  hudspeth: { total: 3, active: 3 },
  pecos: { total: 6, active: 0 },
};

const SPECIES_BREAKDOWN = [
  { species: 'Bovine (Cattle)', count: 38, percentage: Math.round((38 / 79) * 100) },
  { species: 'Canine (Dogs)', count: 10, percentage: Math.round((10 / 79) * 100) },
  { species: 'Caprine (Goats)', count: 7, percentage: Math.round((7 / 79) * 100) },
  { species: 'Cervid (Elk)', count: 1, percentage: Math.round((1 / 79) * 100) },
  { species: 'Equine (Horses)', count: 5, percentage: Math.round((5 / 79) * 100) },
  { species: 'Feline (Cats)', count: 1, percentage: Math.round((1 / 79) * 100) },
  { species: 'Ovine (Sheep)', count: 17, percentage: Math.round((17 / 79) * 100) },
];

// Date-stamp rendered as "Last updated" in the UI. Per the convention of every previous sync
// this is the date the dashboard was read, not the newest case date (which is Oct 31). Stored
// as UTC midnight because the UI formats it in UTC — see the Oct 22 fix (commit 1ae4283).
const LAST_UPDATED = '2026-11-02T00:00:00Z';
const LAST_CHECKED = new Date().toISOString();

function assert(cond, msg) {
  if (!cond) {
    console.error(`\n  ASSERTION FAILED: ${msg}`);
    process.exitCode = 1;
    throw new Error(msg);
  }
  console.log(`  ok  ${msg}`);
}

async function main() {
  // ---------------------------------------------------------------- 1. read current state
  const json = JSON.parse(readFileSync(JSON_PATH, 'utf-8'));
  const before = json.confirmedCases.length;
  assert(before === 75, `fallback starts at 75 cases (found ${before})`);

  const dbBefore = await sql`select count(*)::int n, count(*) filter (where status='active')::int act from screwworm_cases`;
  assert(dbBefore[0].n === 75, `DB starts at 75 cases (found ${dbBefore[0].n})`);
  assert(dbBefore[0].act === 22, `DB starts at 22 active (found ${dbBefore[0].act})`);
  assert(
    json.confirmedCases.filter((c) => c.status === 'active').length === 22,
    'fallback starts at 22 active',
  );

  // guard: nothing in this batch may already exist
  for (const c of NEW_CASES) {
    assert(!json.confirmedCases.some((x) => x.id === c.id), `id ${c.id} is not already in the fallback`);
    const dup = await sql`select 1 from screwworm_cases where id=${c.id}`;
    assert(dup.length === 0, `id ${c.id} is not already in the DB`);
  }

  // ---------------------------------------------------------------- 2. apply reclassification
  for (const r of RECLASSIFIED) {
    const row = json.confirmedCases.find((c) => c.id === r.id);
    assert(!!row, `reclassified id ${r.id} exists in the fallback`);
    assert(row.status === r.from, `id ${r.id} was '${r.from}' before this sync (found '${row.status}')`);
    row.status = r.to;
    row.notes = `${row.notes}; STATUS UPDATE ${LAST_CHECKED.slice(0, 10)}: moved to ${r.to} — ${r.why}`;

    const upd = await sql`
      update screwworm_cases
         set status=${r.to}, notes=${row.notes}, updated_at=now()
       where id=${r.id} and status=${r.from}
      returning id`;
    assert(upd.length === 1, `DB reclassified id ${r.id} ${r.from} -> ${r.to}`);
  }

  // ---------------------------------------------------------------- 3. insert new cases
  for (const c of NEW_CASES) {
    json.confirmedCases.push(c);
    const ins = await sql`
      insert into screwworm_cases (id, date, species, animal, county, state, lat, lng, status, notes)
      values (${c.id}, ${c.date}, ${c.species}, ${c.animal}, ${c.county}, ${c.state},
              ${c.lat}, ${c.lng}, ${c.status}, ${c.notes})
      returning id`;
    assert(ins.length === 1 && ins[0].id === c.id, `DB inserted case ${c.id} (${c.county}, ${c.state} ${c.animal})`);
  }

  // ---------------------------------------------------------------- 4. metadata
  json.confirmedCases.sort((a, b) => a.id - b.id);
  json.speciesBreakdown = SPECIES_BREAKDOWN;
  json.internationalContext.timeline.push(...NEW_TIMELINE);
  json.lastUpdated = LAST_UPDATED;
  json.lastChecked = LAST_CHECKED;

  await sql`update screwworm_metadata set value=${JSON.stringify(SPECIES_BREAKDOWN)}::jsonb where key='speciesBreakdown'`;
  await sql`update screwworm_metadata set value=${JSON.stringify(json.internationalContext)}::jsonb where key='internationalContext'`;
  await sql`update screwworm_metadata set value=${JSON.stringify(LAST_UPDATED)}::jsonb where key='lastUpdated'`;
  await sql`update screwworm_metadata set value=${JSON.stringify(LAST_CHECKED)}::jsonb where key='lastChecked'`;

  writeFileSync(JSON_PATH, `${JSON.stringify(json, null, 2)}\n`);

  // ---------------------------------------------------------------- 5. verify end state
  console.log('\n--- end state: fallback ---');
  const cases = json.confirmedCases;
  const active = cases.filter((c) => c.status === 'active');
  assert(cases.length === EXPECTED.total, `fallback holds ${EXPECTED.total} animal cases`);
  assert(active.length === EXPECTED.active, `fallback holds ${EXPECTED.active} active`);
  assert(cases.length - active.length === EXPECTED.inactive, `fallback holds ${EXPECTED.inactive} inactive`);
  assert(
    new Set(cases.map((c) => `${c.county}|${c.state}`)).size === EXPECTED.counties,
    `fallback spans ${EXPECTED.counties} counties`,
  );
  assert(new Set(cases.map((c) => c.state)).size === EXPECTED.states, `fallback spans ${EXPECTED.states} states`);

  // every active case must be an October detection — this is what the rollup independently says
  assert(
    active.every((c) => c.date.startsWith('2026-10')),
    'every active case is an October detection (matches the SummaryDashboard rollup)',
  );

  for (const [st, want] of Object.entries(EXPECTED.byState)) {
    const rows = cases.filter((c) => c.state === st);
    assert(rows.length === want.total, `${st} holds ${want.total} cases`);
    assert(rows.filter((c) => c.status === 'active').length === want.active, `${st} holds ${want.active} active`);
  }

  for (const [sp, want] of Object.entries(EXPECTED.species)) {
    assert(cases.filter((c) => c.species === sp).length === want, `species ${sp} = ${want}`);
  }
  assert(
    Object.values(EXPECTED.species).reduce((a, b) => a + b, 0) === EXPECTED.total,
    `species counts sum to ${EXPECTED.total}`,
  );

  // fly-trap exclusion — the invariant that keeps APHIS's total and ours reconcilable
  assert(
    !cases.some((c) => c.species === 'Fly' || c.animal === 'Fly'),
    'no fly-trap row has leaked into the tracker (all 5 excluded)',
  );
  assert(cases.filter((c) => c.species === 'Cervid').length === EXPECTED.wildlife, 'exactly 1 wildlife case (the elk)');
  assert(cases.length - EXPECTED.wildlife === EXPECTED.domestic, `${EXPECTED.domestic} domestic animal cases`);

  // monthly totals against the case-level export
  for (const [month, want] of Object.entries(APHIS_BY_MONTH)) {
    assert(cases.filter((c) => c.date.startsWith(month)).length === want, `${month} = ${want} animal cases (APHIS)`);
  }

  // county-level claims made in the notes above
  const donaAna = cases.filter((c) => c.county === 'Dona Ana');
  assert(donaAna.length === EXPECTED.donaAna.total, `Dona Ana holds ${EXPECTED.donaAna.total} cases`);
  assert(
    donaAna.filter((c) => c.status === 'active').length === EXPECTED.donaAna.active,
    `all ${EXPECTED.donaAna.active} Dona Ana cases are active`,
  );
  assert(
    new Set(donaAna.map((c) => c.species)).size === EXPECTED.donaAna.species,
    `Dona Ana spans ${EXPECTED.donaAna.species} species`,
  );
  assert(donaAna.filter((c) => c.animal === 'Horse').length === 1, "Dona Ana's horse is its first and only");
  assert(donaAna.filter((c) => c.animal === 'Cattle').length === 3, 'Dona Ana holds 3 cattle');
  assert(donaAna.filter((c) => c.animal === 'Dog').length === 3, 'Dona Ana holds 3 dogs');

  const grant = cases.filter((c) => c.county === 'Grant');
  assert(grant.length === EXPECTED.grant.total, `Grant holds ${EXPECTED.grant.total} cases`);
  assert(
    grant.filter((c) => c.status === 'active').length === EXPECTED.grant.active,
    `Grant holds ${EXPECTED.grant.active} active`,
  );
  assert(
    grant.filter((c) => c.status === 'inactive').length === 1 &&
      grant.find((c) => c.status === 'inactive').date === '2026-09-17',
    "Grant's only inactive case is the Sep 17 horse",
  );

  const hudspeth = cases.filter((c) => c.county === 'Hudspeth');
  assert(hudspeth.length === EXPECTED.hudspeth.total, `Hudspeth holds ${EXPECTED.hudspeth.total} cases`);
  assert(
    hudspeth.every((c) => c.status === 'active' && c.animal === 'Cattle'),
    'all 3 Hudspeth cases are active cattle',
  );

  const pecos = cases.filter((c) => c.county === 'Pecos');
  assert(pecos.length === EXPECTED.pecos.total, `Pecos holds ${EXPECTED.pecos.total} animal cases`);
  assert(
    pecos.filter((c) => c.status === 'active').length === EXPECTED.pecos.active,
    'Pecos County is now fully closed out — 0 active',
  );

  // Dona Ana is the largest active cluster, strictly
  const activeByCounty = {};
  for (const c of active) activeByCounty[`${c.county}|${c.state}`] = (activeByCounty[`${c.county}|${c.state}`] || 0) + 1;
  const ranked = Object.entries(activeByCounty).sort((a, b) => b[1] - a[1]);
  assert(ranked[0][0] === 'Dona Ana|NM' && ranked[0][1] === 8, 'Dona Ana, NM is the largest active cluster at 8');
  assert(ranked[1][1] === 4, 'the second-largest active cluster holds 4 (Grant, NM)');

  // New Mexico carries more actives than TX + AZ combined
  const nmActive = active.filter((c) => c.state === 'NM').length;
  const otherActive = active.length - nmActive;
  assert(nmActive === 16 && otherActive === 9, 'New Mexico holds 16 of 25 actives against 9 for TX+AZ');

  // ids: unique, and the backfill ordering artifact is intentional
  assert(new Set(cases.map((c) => c.id)).size === cases.length, 'all case ids are unique');
  assert(cases.find((c) => c.id === 77).date === '2026-10-30', 'case 77 is the Oct 30 Hudspeth backfill (id > date order)');
  assert(cases.find((c) => c.id === 73).date === '2026-10-28', 'case 73 is still the Oct 28 Presidio backfill');

  // coordinates: nothing stacked among the cases this sync touches
  const haversine = (a, b) => {
    const R = 3958.8;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const la1 = (a.lat * Math.PI) / 180;
    const la2 = (b.lat * Math.PI) / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(h));
  };
  for (const c of NEW_CASES) {
    const peers = cases.filter((x) => x.county === c.county && x.state === c.state && x.id !== c.id);
    const nearest = Math.min(...peers.map((p) => haversine(c, p)));
    assert(nearest > 0.25, `case ${c.id} pin is >0.25mi from its nearest county peer (${nearest.toFixed(2)}mi)`);
  }

  // pre-existing drift, pinned so it cannot widen unnoticed
  const DRIFT = { 20: '2026-06-23', 29: '2026-06-30', 41: '2026-07-17', 60: '2026-10-20' };
  for (const [id, date] of Object.entries(DRIFT)) {
    assert(cases.find((c) => c.id === +id).date === date, `pinned date drift on id ${id} unchanged (${date})`);
  }
  assert(
    [1, 2, 3, 6].every((id) => cases.find((c) => c.id === id).animal === 'Calf'),
    'pinned Calf/Cattle naming on ids 1,2,3,6 unchanged',
  );
  assert(cases.find((c) => c.id === 42).animal === 'Goat', 'pinned Goat/Goats naming on id 42 unchanged');
  assert(cases.find((c) => c.id === 72).animal === 'Cat', 'pinned Cat/Domestic Cat naming on id 72 unchanged');

  // species wiring — no new species this sync, but re-verify the whole set is wired
  const chart = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/src/components/CasesByDay.jsx', 'utf-8');
  const api = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/api/cases.js', 'utf-8');
  for (const sp of Object.keys(EXPECTED.species)) {
    assert(chart.includes(`${sp}:`) || chart.includes(`'${sp}'`), `species ${sp} is wired into the day chart`);
    assert(api.includes(`${sp}:`), `species ${sp} is wired into the API labels`);
  }

  // timeline parity, per the standing requirement
  assert(json.internationalContext.timeline.length === 72, 'timeline holds 72 entries (70 + 2)');

  console.log('\n--- end state: database ---');
  const dbAfter = await sql`
    select count(*)::int n,
           count(*) filter (where status='active')::int act,
           count(distinct (county, state))::int counties,
           count(distinct state)::int states,
           max(id)::int mx
      from screwworm_cases`;
  assert(dbAfter[0].n === EXPECTED.total, `DB holds ${EXPECTED.total} cases`);
  assert(dbAfter[0].act === EXPECTED.active, `DB holds ${EXPECTED.active} active`);
  assert(dbAfter[0].counties === EXPECTED.counties, `DB spans ${EXPECTED.counties} counties`);
  assert(dbAfter[0].states === EXPECTED.states, `DB spans ${EXPECTED.states} states`);
  assert(dbAfter[0].mx === 80, 'DB max id is 80');

  // DB/fallback parity on every field the UI reads, which is the drift this tracker has
  // been bitten by before
  const dbRows = await sql`select id, to_char(date,'YYYY-MM-DD') as date, species, animal, county, state, lat, lng, status from screwworm_cases order by id`;
  assert(dbRows.length === cases.length, 'DB and fallback hold the same number of cases');
  let coordDrift = 0;
  for (const d of dbRows) {
    const f = cases.find((c) => c.id === d.id);
    assert(!!f, `fallback has a row for DB id ${d.id}`);
    for (const k of ['date', 'species', 'animal', 'county', 'state', 'status']) {
      assert(d[k] === f[k], `id ${d.id} agrees on ${k} (${d[k]})`);
    }
    if (Math.abs(d.lat - f.lat) > 1e-9 || Math.abs(d.lng - f.lng) > 1e-9) coordDrift++;
  }
  // ids 21 and 28 are the known, pinned coordinate drift — it must not grow
  assert(coordDrift === 2, `exactly 2 rows carry the pinned coordinate drift (found ${coordDrift})`);

  const spRow = await sql`select value from screwworm_metadata where key='speciesBreakdown'`;
  assert(
    JSON.stringify(spRow[0].value.map((r) => [r.species, r.count]).sort()) ===
      JSON.stringify(SPECIES_BREAKDOWN.map((r) => [r.species, r.count]).sort()),
    'DB speciesBreakdown matches the fallback',
  );
  const tlRow = await sql`select value from screwworm_metadata where key='internationalContext'`;
  assert(tlRow[0].value.timeline.length === 72, 'DB timeline holds 72 entries');
  assert(
    JSON.stringify(tlRow[0].value.timeline) === JSON.stringify(json.internationalContext.timeline),
    'DB timeline is element-for-element identical to the fallback',
  );

  console.log(`\nAPHIS sync Nov 2 complete — ${EXPECTED.total} animal cases / ${EXPECTED.active} active / ${EXPECTED.inactive} inactive / ${EXPECTED.counties} counties / ${EXPECTED.states} states`);
  console.log(`  +4 cases (77 Hudspeth TX cattle Oct 30, 78 Dona Ana NM cattle, 79 Dona Ana NM HORSE, 80 Grant NM cattle, all Oct 31)`);
  console.log(`  ~1 reclassified (54 Pecos TX cattle active -> inactive; Pecos now fully closed out)`);
  console.log(`  5 APHIS fly-trap detections deliberately excluded`);
}

main().catch((e) => {
  console.error('\nSYNC FAILED:', e.message);
  process.exit(1);
});
