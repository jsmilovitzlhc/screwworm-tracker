import { neon } from '@neondatabase/serverless';
import { readFileSync, writeFileSync } from 'fs';

const envFile = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}

const sql = neon(process.env.DATABASE_URL);
const JSON_PATH = '/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/src/data/cases.json';

// APHIS sync Nov 4, 2026 — the largest single sync of the outbreak.
// 79 -> 99 animal cases, 25 -> 42 active, 54 -> 57 inactive, 27 -> 29 counties, 3 states.
//
// ---------------------------------------------------------------------------------------
// THIS SYNC WAS BUILT FROM THE CASE-LEVEL EXPORT, NOT FROM A BRIEF.
//
// The APHIS Tableau workbook has a hidden worksheet named "ExportToCSV" that holds one row
// per detection with County, State, Species, Status, Confirmed Date and the APHIS subject id
// (SU:nnnnn:27). It was pulled directly out of the VizQL bootstrap payload rather than read
// off the dashboard tiles, so this sync is a full 104-row reconciliation instead of an
// incremental append. 104 rows = 98 domestic animals + 1 wildlife + 5 fly traps, which is
// exactly the dashboard's "99 total cases / 42 active" headline once the 5 trap rows are set
// aside. Fly traps are not animal cases and are not counted in this tracker.
//
// Every one of the tracker's 79 existing cases matched a row in that export 1:1 — first on
// the SU ids recorded in notes for the 15 cases that carry them, then by pairing the rest
// within each (state, county, species) group in date order. The county/species multiset diff
// came back with ZERO extras in the tracker, which is what makes the pairing safe: the
// tracker has never invented a case. That left exactly 20 unmatched export rows, which are
// the new cases below.
//
// WHAT THE DAILY BRIEF GOT WRONG THIS TIME. The brief's headline totals were right (99 / 42 /
// 56 domestic inactive / 1 wildlife inactive / 5 traps, last detection Nov 3), and it
// correctly flagged Zapata TX and Catron NM as new counties and Chicken as a new species. The
// detail was wrong in four ways:
//
//   1. IT PUT THE NEW CASES IN THE WRONG MONTH. The brief listed the new cases as "multiple
//      new cases from Nov 1-3". Only 11 of the 99 animal cases are dated in November, and
//      only 6 of the 20 new rows are dated Nov 1-2. NINE of the 20 are OCTOBER BACKFILLS
//      dated Oct 30 and Oct 31 that were absent from the Nov 2 export, and 5 more are Nov 3.
//      The six Oct 30 rows (cases 81-86) are the single largest backfill of the outbreak.
//
//   2. IT NAMED TWO COUNTIES THAT HAVE NO NEW CASES. The brief listed Dona Ana NM and
//      Hudspeth TX among the counties with new Nov 1-3 cases. The export has no new rows for
//      either. Dona Ana stays at 8 cases and Hudspeth at 3, both unchanged since Nov 2. Dona
//      Ana in fact moves the other way — one of its dogs went inactive (see below).
//
//   3. IT CALLED THE CHICKEN AN ACTIVE CASE BY OMISSION. The Presidio County, TX chicken
//      (case 89) is the outbreak's first avian detection and it is already INACTIVE in the
//      export. Same for the second El Paso dog (case 90). 18 of the 20 new cases are active,
//      not 20.
//
//   4. IT SAID "SOME CASES MAY HAVE MOVED TO INACTIVE". Exactly one did: case 71, the Oct 28
//      Dona Ana County, NM dog. That is the only status change in the whole 99-row export.
//
// THE BRIEF ALSO MISSED NINE DATE ERRORS ALREADY IN THE TRACKER. Reconciling against the
// export surfaced 9 existing cases whose dates disagree with the APHIS confirmed date by one
// day (ids 20, 29, 41, 60, 63, 69, 78, 79, 80). These are corrected below. They are drift
// accumulated from brief-based entry on earlier syncs, not new information, and none of them
// crosses a month boundary, so no monthly total moves. Three of them (78, 79, 80) are the
// "three New Mexico cases in one day" from the Nov 2 sync: the export dates all three Oct 30,
// not Oct 31, so that single-day record belongs to Oct 30 — which is also the day of the six
// backfilled cases below, making Oct 30 the outbreak's largest single day at ELEVEN cases.
//
// THE ARITHMETIC BALANCES THREE WAYS, which is the check this sync exists to enforce:
//   cases:     79 existing + 20 new                      = 99
//   active:    25 existing - 1 reclassified + 18 new      = 42
//   inactive:  54 existing + 1 reclassified + 2 new       = 57
//
// NOT TOUCHED. The known Neon/fallback coordinate drift on ids 21 and 28, and the notes-length
// drift on ids 21, 28, 47 and 48, are pre-existing and deliberately left alone — fixing them
// is a separate decision and the assertions below pin the rest of the parity so they cannot
// spread. quarantineZones is a hand-maintained list and is not extended for Zapata or Catron
// here; that is an editorial call, not a data sync.
//
// NEW GROUND. Three firsts in this batch:
//   - AVIAN. The Presidio chicken is the outbreak's first bird and its eighth species.
//   - ZAPATA COUNTY, TX. The first new South Texas county since Jim Hogg on Jun 26 — more than
//     four months — and the outbreak's southeasternmost active case, on the Rio Grande below
//     Laredo, 300 miles from the far-west cluster that has produced nearly everything since.
//   - CATRON COUNTY, NM. The outbreak's northernmost case by a wide margin, at 33.7N in the
//     Gila high country, roughly 90 miles north of the Grant County cluster and well away from
//     the border corridor.
// ---------------------------------------------------------------------------------------

const NEW_CASES = [
  {
    id: 81,
    date: '2026-10-30',
    species: 'Equine',
    animal: 'Horse',
    county: 'Grant',
    state: 'NM',
    lat: 32.7199,
    lng: -108.2853,
    status: 'active',
    notes:
      "Sixth Grant County case and the SIXTH EQUINE (horse) detection of the US outbreak, the county's THIRD horse after the Sep 17 case that opened the county and the Oct 15 case. BACKFILL: this row was absent from the Nov 2 APHIS export and was found by reconciling the full case-level export, not from any announcement or brief. Confirmed Oct 30 alongside case 82 (a Grant dog), three Luna County cases and an Otero horse — six cases on one day, and with cases 78, 79 and 80 redated to Oct 30 by this same reconciliation, Oct 30 becomes the outbreak's largest single day at ELEVEN cases. Grant now holds 7 cases across FOUR species — 2 cattle, 3 horses, 1 dog and the Oct 28 domestic cat that was the outbreak's first feline — with 6 active; its only closed case is the Sep 17 horse. That ties Grant with Dona Ana, Pecos and Crockett as the outbreak's most species-diverse counties, and no county has produced a fifth species. Horses are the species that carried the outbreak into New Mexico in the first place and the county keeps producing them. Domestic animal; APHIS reports location at county level, so the coordinates are offset slightly from the other Grant cases near the county seat (Silver City) so the pins do not render on top of each other; SU:28412:27, SS:12800:27; confirmed per APHIS dashboard Oct 30",
  },
  {
    id: 82,
    date: '2026-10-30',
    species: 'Canine',
    animal: 'Dog',
    county: 'Grant',
    state: 'NM',
    lat: 32.7499,
    lng: -108.2603,
    status: 'active',
    notes:
      "Seventh Grant County case and GRANT'S FIRST DOG, the twelfth canine detection of the US outbreak. BACKFILL from the full case-level export, absent from the Nov 2 export. This is the case that makes Grant a FOUR-SPECIES county — cattle, horses, a cat and now a dog — tying Dona Ana, Pecos and Crockett at the outbreak's maximum. Companion animals now account for 2 of Grant's 7 cases, and dogs and cats move outside the livestock permit system the APHIS response depends on, which is the same pattern that has made the Dona Ana cluster hard to close: 3 of its 8 cases are dogs. Confirmed Oct 30 with case 81 and the Luna and Otero cases. Domestic animal; APHIS reports location at county level, so the coordinates are offset slightly from the other Grant cases near the county seat (Silver City) so the pins do not render on top of each other; SU:28418:27, SS:12798:27; confirmed per APHIS dashboard Oct 30",
  },
  {
    id: 83,
    date: '2026-10-30',
    species: 'Bovine',
    animal: 'Cattle',
    county: 'Luna',
    state: 'NM',
    lat: 32.2573,
    lng: -107.771,
    status: 'active',
    notes:
      "Third Luna County case and the thirty-ninth bovine (cattle) detection of the US outbreak, the county's THIRD head of cattle after the Oct 26 and Oct 29 cows. BACKFILL from the full case-level export, absent from the Nov 2 export. One of THREE Luna cases confirmed on Oct 30 (with cases 84 and 85), which triples the county in a single day from 2 cases to 5. All 5 Luna cases are active, and Oct 30 delivered three cases each to Luna, Grant and Dona Ana — only Crockett County's four on Jun 24 has ever beaten that in a single county-day. Luna sits between the Hidalgo and Dona Ana clusters on the Mexican border, and with Grant to the north it completes an unbroken line of active counties running the full width of southern New Mexico from the Arizona line to the Texas line. Domestic animal; APHIS reports location at county level, so the coordinates are offset slightly from the other Luna cases near the county seat (Deming) so the pins do not render on top of each other; SU:28414:27, SS:12794:27; confirmed per APHIS dashboard Oct 30",
  },
  {
    id: 84,
    date: '2026-10-30',
    species: 'Canine',
    animal: 'Dog',
    county: 'Luna',
    state: 'NM',
    lat: 32.2915,
    lng: -107.7338,
    status: 'active',
    notes:
      "Fourth Luna County case and LUNA'S FIRST DOG, the eleventh canine detection of the US outbreak. BACKFILL from the full case-level export, absent from the Nov 2 export. Confirmed Oct 30 with cases 83 and 85, the three cases that took Luna from 2 to 5 in one day. This is Luna's second species, and it leaves Hidalgo as the only New Mexico border-corridor county with more than one case that has produced nothing but cattle — Luna, Grant and Dona Ana all now carry companion-animal detections. Dogs are now 14 of the outbreak's 99 animal cases and 7 of the 42 active, and they are the clearest signal that the fly is in the environment rather than moving with livestock shipments, because dogs are not shipped on permits. Domestic animal; APHIS reports location at county level, so the coordinates are offset slightly from the other Luna cases near the county seat (Deming) so the pins do not render on top of each other; SU:28415:27, SS:12795:27; confirmed per APHIS dashboard Oct 30",
  },
  {
    id: 85,
    date: '2026-10-30',
    species: 'Bovine',
    animal: 'Cattle',
    county: 'Luna',
    state: 'NM',
    lat: 32.2744,
    lng: -107.7834,
    status: 'active',
    notes:
      "Fifth Luna County case and the fortieth bovine (cattle) detection of the US outbreak, the county's FOURTH head of cattle. BACKFILL from the full case-level export, absent from the Nov 2 export. The third of three Luna cases confirmed Oct 30, completing the county's jump from 2 cases to 5 in a single day — four cattle and one dog, all five active. Luna is now the outbreak's third-largest active cluster behind Dona Ana (7 active) and Grant (6 active), and the three of them together hold 18 of New Mexico's 26 active cases. New Mexico now carries 26 of the outbreak's 42 active cases from 29 total cases, against Texas's 14 active from 68 — the state with less than half of Texas's caseload holds nearly twice its active burden. Domestic animal; APHIS reports location at county level, so the coordinates are offset slightly from the other Luna cases near the county seat (Deming) so the pins do not render on top of each other; SU:28417:27, SS:12797:27; confirmed per APHIS dashboard Oct 30",
  },
  {
    id: 86,
    date: '2026-10-30',
    species: 'Equine',
    animal: 'Horse',
    county: 'Otero',
    state: 'NM',
    lat: 32.6233,
    lng: -105.3757,
    status: 'active',
    notes:
      "Second Otero County case and the SEVENTH EQUINE (horse) detection of the US outbreak, and OTERO'S FIRST HORSE after the Oct 21 cow that opened the county. BACKFILL from the full case-level export, absent from the Nov 2 export. Confirmed Oct 30 with the Grant pair and the three Luna cases. Otero matters geographically: it is the only New Mexico county in the outbreak that is NOT on the Mexican border, sitting north and east of Dona Ana across the Tularosa Basin, and it is the county that contains Alamogordo and Holloman AFB. A second case there, followed by a third on Nov 3 (case 97, another horse), means the detections are moving inland from the border corridor rather than staying pinned to it. All 3 Otero cases are active. Domestic animal; APHIS reports location at county level, so the coordinates are offset slightly from the Oct 21 case near the county seat (Alamogordo) so the pins do not render on top of each other; SU:28416:27, SS:12796:27; confirmed per APHIS dashboard Oct 30",
  },
  {
    id: 87,
    date: '2026-10-31',
    species: 'Equine',
    animal: 'Horse',
    county: 'Cochise',
    state: 'AZ',
    lat: 31.4598,
    lng: -109.916,
    status: 'active',
    notes:
      "Second Cochise County case and ARIZONA'S SECOND CASE OF THE OUTBREAK, the EIGHTH EQUINE (horse) detection. BACKFILL from the full case-level export, absent from the Nov 2 export. Arizona had held exactly one case — the Oct 28 dog, case 70 — since entering the outbreak three days earlier; this doubles the state and makes Cochise a two-species county with both cases active. Cochise borders Hidalgo County, NM, which added three cattle on Nov 3 (cases 94-96), and the two counties together form the outbreak's western edge on the Mexican border. That a horse and a dog are Arizona's only two cases, with no livestock case yet, is worth noting: neither species moves under livestock permits, so neither was caught by shipment-based surveillance. Domestic animal; APHIS reports location at county level, so the coordinates are offset slightly from the Oct 28 dog near the county seat (Bisbee) so the pins do not render on top of each other; SU:28365:27, SS:12788:27; confirmed per APHIS dashboard Oct 31",
  },
  {
    id: 88,
    date: '2026-10-31',
    species: 'Bovine',
    animal: 'Cattle',
    county: 'Catron',
    state: 'NM',
    lat: 33.7106,
    lng: -108.7589,
    status: 'active',
    notes:
      "FIRST CATRON COUNTY CASE — the outbreak's twenty-eighth county, New Mexico's seventh, and the forty-first bovine (cattle) detection. BACKFILL from the full case-level export, absent from the Nov 2 export; the daily brief flagged Catron as a new county but placed it in the Nov 1-3 window, and the export dates it Oct 31. This is the OUTBREAK'S NORTHERNMOST CASE BY A WIDE MARGIN, at 33.71N in the Gila high country roughly 90 miles north of the Grant County cluster and about 140 miles from the Mexican border — every other New Mexico county in the outbreak except Otero and Lea is on the border itself. Catron is the largest county in New Mexico by area, almost entirely national forest and federal land, and it is cattle country run on open range, which makes both detection and treatment far harder than in the fenced border counties. A case this far north and this far inland is the single most significant geographic development in this sync: it breaks the pattern of a border corridor and suggests either a long-distance livestock movement or fly establishment well north of the quarantine zones. Active. Domestic animal; APHIS reports location at county level, so the coordinates are placed at the county seat (Reserve); SU:28419:27, SS:12799:27; confirmed per APHIS dashboard Oct 31",
  },
  {
    id: 89,
    date: '2026-10-31',
    species: 'Avian',
    animal: 'Chicken',
    county: 'Presidio',
    state: 'TX',
    lat: 29.997,
    lng: -104.2371,
    status: 'inactive',
    notes:
      "THE OUTBREAK'S FIRST AVIAN CASE — a chicken in Presidio County, TX, and the EIGHTH SPECIES of the US outbreak after cattle, sheep, goats, dogs, horses, a cat and the one elk. BACKFILL from the full case-level export, absent from the Nov 2 export. ALREADY INACTIVE on confirmation in the export, which the daily brief did not report; it is one of only two new cases in this batch of 20 that is not active. Third Presidio County case and the county's THIRD SPECIES, after the Sep 9 horse (inactive) and the Oct 28 cow (active). Poultry is a genuinely new exposure route for the response: screwworm larvae need an open wound, and backyard flocks are neither permitted nor inspected the way livestock are, so an avian case is only found if an owner reports it. Presidio sits on the Rio Grande in the Big Bend, directly across from Ojinaga, Chihuahua, and APHIS confirmed a wild fly trap detection in neighbouring Brewster County on Sep 25. Domestic animal; APHIS reports location at county level, so the coordinates are offset slightly from the other two Presidio cases so the pins do not render on top of each other; SU:28390:27, SS:12789:27; confirmed per APHIS dashboard Oct 31",
  },
  {
    id: 90,
    date: '2026-11-01',
    species: 'Canine',
    animal: 'Dog',
    county: 'El Paso',
    state: 'TX',
    lat: 31.666,
    lng: -106.2909,
    status: 'inactive',
    notes:
      "Second El Paso County case and the thirteenth canine detection of the US outbreak, and the FIRST ANIMAL CASE OF NOVEMBER. ALREADY INACTIVE in the export — the second of only two non-active cases in this batch. Both El Paso cases are dogs and neither is a livestock case; the first (case 69, Oct 26) remains active. El Paso County is the outbreak's largest urban exposure by population — roughly 865,000 people in the city of El Paso alone — and it adjoins Ciudad Juarez across the Rio Grande and Dona Ana County, NM to the northwest, which is the outbreak's largest cluster at 8 cases. Two urban dog cases a week apart, with no livestock case in between, is the companion-animal pattern that has driven this phase of the outbreak: dogs are now 13 of 99 cases. Domestic animal; APHIS reports location at county level, so the coordinates are offset slightly from case 69 near the city of El Paso so the pins do not render on top of each other; SU:28422:27, SS:12801:27; confirmed per APHIS dashboard Nov 1",
  },
  {
    id: 91,
    date: '2026-11-02',
    species: 'Bovine',
    animal: 'Cattle',
    county: 'Jeff Davis',
    state: 'TX',
    lat: 30.5997,
    lng: -103.8823,
    status: 'active',
    notes:
      "Second Jeff Davis County case and the forty-second bovine (cattle) detection of the US outbreak. Both Jeff Davis cases are cattle and both are ACTIVE; the first was the Oct 20 cow, so this is the county's first case in thirteen days. APHIS also confirmed a WILD FLY TRAP detection in Jeff Davis County on Oct 29 (SU:28201:27), four days before this cow — the same wild-fly-then-animal-case pairing that preceded detections in Dona Ana and Hudspeth, and the third time that sequence has repeated. Fly-trap detections are counted by APHIS in its total but are not animal cases and are not counted in this tracker. Jeff Davis is the Davis Mountains county at the centre of the far-west Texas corridor, bordered by Presidio, Brewster, Pecos and Hudspeth, all of which have active cases; this corridor now accounts for most of Texas's remaining active burden while the older Hill Country and South Texas clusters stay closed. Domestic animal; APHIS reports location at county level, so the coordinates are offset slightly from the Oct 20 case near the county seat (Fort Davis) so the pins do not render on top of each other; SU:28426:27, SS:12802:27; confirmed per APHIS dashboard Nov 2",
  },
  {
    id: 92,
    date: '2026-11-02',
    species: 'Canine',
    animal: 'Dog',
    county: 'Starr',
    state: 'TX',
    lat: 26.5675,
    lng: -98.7545,
    status: 'active',
    notes:
      "Second Starr County case and the fourteenth canine detection of the US outbreak, and STARR'S FIRST DOG after the Jul 18 cow. This is a SOUTH TEXAS CASE AFTER MORE THAN THREE MONTHS OF SILENCE there: Starr's only previous case was in mid-July, and the Rio Grande Valley counties had produced nothing since while the outbreak ran west. Confirmed the same day as the Zapata County cow (case 93) 60 miles upriver, which is the first new South Texas county since Jim Hogg on Jun 26. Two South Texas cases on one day, after four months, is the second significant geographic development in this sync alongside Catron County, NM: the border corridor is now generating detections at both ends simultaneously. Starr fronts the Rio Grande opposite Ciudad Camargo, Tamaulipas. Active; the Jul 18 cow is inactive. Domestic animal; APHIS reports location at county level, so the coordinates are offset slightly from the Jul 18 case near the county seat (Rio Grande City) so the pins do not render on top of each other; SU:28431:27, SS:12809:27; confirmed per APHIS dashboard Nov 2",
  },
  {
    id: 93,
    date: '2026-11-02',
    species: 'Bovine',
    animal: 'Cattle',
    county: 'Zapata',
    state: 'TX',
    lat: 26.9073,
    lng: -99.2714,
    status: 'active',
    notes:
      "FIRST ZAPATA COUNTY CASE — the outbreak's twenty-ninth county, Texas's twenty-first, and the forty-third bovine (cattle) detection. This is the FIRST NEW SOUTH TEXAS COUNTY SINCE JIM HOGG ON JUN 26, a gap of more than four months, and it is the outbreak's SOUTHEASTERNMOST ACTIVE CASE. Zapata sits on the Rio Grande below Laredo, roughly 300 miles east-southeast of the far-west Texas corridor that has produced nearly every Texas case since August, and it borders Jim Hogg and Starr — which added its own case the same day (case 92). A new county at the southeastern end of the border while Catron County, NM opens the northern end tells the same story from both directions: this is no longer a single advancing front. Zapata is cattle country on the Falcon Reservoir, and the county had been inside no quarantine zone before this case. Active. Domestic animal; APHIS reports location at county level, so the coordinates are placed at the county seat (Zapata); SU:28427:27, SS:12803:27; confirmed per APHIS dashboard Nov 2",
  },
  {
    id: 94,
    date: '2026-11-03',
    species: 'Bovine',
    animal: 'Cattle',
    county: 'Hidalgo',
    state: 'NM',
    lat: 32.3617,
    lng: -108.6949,
    status: 'active',
    notes:
      "Second Hidalgo County, NM case and the forty-fourth bovine (cattle) detection of the US outbreak. This is the row the APHIS dashboard reports as its most recent detection (SU:28516:27). One of THREE Hidalgo cattle confirmed on Nov 3 (with cases 95 and 96) — the county's first cases since the Oct 22 cow that opened it, and a jump from 1 case to 4 in a single day. All 4 Hidalgo cases are cattle and all 4 are ACTIVE, making it the OUTBREAK'S LARGEST SINGLE-SPECIES CLUSTER, ahead of Hudspeth TX and Zavala TX at 3 cattle each. Nov 3 is the most recent detection date on the APHIS dashboard as of this sync. Hidalgo is New Mexico's bootheel, the southwesternmost county in the state, wedged between Arizona and the Mexican border and adjoining Cochise County, AZ, which added Arizona's second case on Oct 31 (case 87). Three cattle on one day in a four-case county, all active, with the neighbouring Arizona county also active, puts the outbreak's western edge in the same shape its eastern edge was in two weeks ago. Domestic animal; APHIS reports location at county level, so the coordinates are offset slightly from the Oct 22 case and the two other Nov 3 cases so the pins do not render on top of each other; SU:28516:27, SS:12818:27; confirmed per APHIS dashboard Nov 3",
  },
  {
    id: 95,
    date: '2026-11-03',
    species: 'Bovine',
    animal: 'Cattle',
    county: 'Hidalgo',
    state: 'NM',
    lat: 32.3389,
    lng: -108.7197,
    status: 'active',
    notes:
      "Third Hidalgo County, NM case and the forty-fifth bovine (cattle) detection of the US outbreak. The second of three Hidalgo cattle confirmed Nov 3, the county's largest single day and the day that took it from 1 case to 4, all cattle and all active. Nov 3 is the most recent detection date on the APHIS dashboard as of this sync, and it carries SEVEN of the outbreak's 99 cases — three here, one Otero horse and three Pecos sheep — which is the second-largest single day of the outbreak behind Oct 30's eleven. Hidalgo's bootheel geography puts it on two international and two state boundaries at once. Domestic animal; APHIS reports location at county level, so the coordinates are offset slightly from the Oct 22 case and the two other Nov 3 cases so the pins do not render on top of each other; SU:28518:27, SS:12816:27; confirmed per APHIS dashboard Nov 3",
  },
  {
    id: 96,
    date: '2026-11-03',
    species: 'Bovine',
    animal: 'Cattle',
    county: 'Hidalgo',
    state: 'NM',
    lat: 32.3617,
    lng: -108.7197,
    status: 'active',
    notes:
      "Fourth Hidalgo County, NM case and the forty-sixth bovine (cattle) detection of the US outbreak — the last of the three Hidalgo cattle confirmed Nov 3, which are the outbreak's most recent cases. The three carry APHIS ids SU:28516:27, SU:28518:27 and SU:28519:27; SU:28517:27 does not appear in the export at all, so there is no fourth Nov 3 Hidalgo row hiding behind a gap in the numbering. Cattle are now 46 of the outbreak's 99 animal cases, 23 of them active. With this batch New Mexico reaches 29 cases across 7 counties and 26 ACTIVE — more than double Texas's 14 active from 68 cases, and up from 5 total cases in mid-October. The New Mexico border corridor from Hidalgo through Luna and Grant to Dona Ana now holds 24 cases, 22 of them active, and every county in it recorded a case within the last five days. Domestic animal; APHIS reports location at county level, so the coordinates are offset slightly from the Oct 22 case and the two other Nov 3 cases so the pins do not render on top of each other; SU:28519:27, SS:12817:27; confirmed per APHIS dashboard Nov 3",
  },
  {
    id: 97,
    date: '2026-11-03',
    species: 'Equine',
    animal: 'Horse',
    county: 'Otero',
    state: 'NM',
    lat: 32.6005,
    lng: -105.4005,
    status: 'active',
    notes:
      "Third Otero County case and the NINTH EQUINE (horse) detection of the US outbreak, the county's SECOND horse in five days after case 86 on Oct 30. All 3 Otero cases are ACTIVE. Horses are now 9 of the outbreak's 99 cases and 7 of the 42 active — the species with the highest active share of any with more than one case. Otero is the only New Mexico county in the outbreak that is not on the Mexican border and not in the southwestern corridor: it sits north and east of Dona Ana across the Tularosa Basin and contains Alamogordo, Holloman AFB and White Sands. Two horses there in five days, both active, is the clearest evidence in this sync that the New Mexico detections are moving inland rather than tracking the border. Domestic animal; APHIS reports location at county level, so the coordinates are offset slightly from the other two Otero cases near the county seat (Alamogordo) so the pins do not render on top of each other; SU:28512:27, SS:12819:27; confirmed per APHIS dashboard Nov 3",
  },
  {
    id: 98,
    date: '2026-11-03',
    species: 'Ovine',
    animal: 'Sheep',
    county: 'Pecos',
    state: 'TX',
    lat: 30.9094,
    lng: -103.4982,
    status: 'active',
    notes:
      "Seventh Pecos County, TX animal case and the eighteenth ovine (sheep) detection of the US outbreak. PECOS REOPENS: the Nov 2 sync closed this county out completely — all 6 animal cases and its Oct 21 elk inactive, the first multi-case county to go fully quiet since Val Verde in September — and three sheep confirmed on Nov 3 (cases 98, 99 and 100) put it back to 3 active. That reversal is the reason a county going quiet cannot be read as a county finished. Pecos is also the county with the longest run in the outbreak, in it since Jun 29, and it is now a FOUR-SPECIES county: cattle, sheep, a dog and the elk. APHIS confirmed a WILD FLY TRAP detection in Pecos County on Oct 29 (SU:28222:27), five days before these sheep — the fourth instance of the wild-fly-then-animal-case sequence, after Dona Ana, Hudspeth and Jeff Davis, and the strongest argument that the far-west Texas corridor is breeding flies locally rather than importing them. Sheep had not been detected anywhere in the outbreak since the Oct 24 Dona Ana ewe. Domestic animal; APHIS reports location at county level, so the coordinates are offset slightly from the six older Pecos cases near the county seat (Fort Stockton) so the pins do not render on top of each other; SU:28458:27, SS:12813:27; confirmed per APHIS dashboard Nov 3",
  },
  {
    id: 99,
    date: '2026-11-03',
    species: 'Ovine',
    animal: 'Sheep',
    county: 'Pecos',
    state: 'TX',
    lat: 30.8694,
    lng: -103.4882,
    status: 'active',
    notes:
      "Eighth Pecos County, TX animal case and the nineteenth ovine (sheep) detection of the US outbreak. The second of three Pecos sheep confirmed Nov 3, the batch that reopened a county the Nov 2 sync had recorded as fully closed. Sheep are now 20 of the outbreak's 99 animal cases, the second-largest species group behind cattle, but only 4 of them are active and three of those four are these Nov 3 Pecos cases — the other 16 are long closed, most of them from the June and July Hill Country clusters in Crockett, Sutton and Terrell. A sheep cluster restarting in far-west Texas four months after the Hill Country one ended is a different event, not a continuation. Domestic animal; APHIS reports location at county level, so the coordinates are offset slightly from the other Pecos cases near the county seat (Fort Stockton) so the pins do not render on top of each other; SU:28459:27, SS:12814:27; confirmed per APHIS dashboard Nov 3",
  },
  {
    id: 100,
    date: '2026-11-03',
    species: 'Ovine',
    animal: 'Sheep',
    county: 'Pecos',
    state: 'TX',
    lat: 30.9044,
    lng: -103.4632,
    status: 'active',
    notes:
      "Ninth Pecos County, TX animal case and the twentieth ovine (sheep) detection of the US outbreak. It carries tracker id 100 but is the NINETY-NINTH record: ids have never been contiguous, because id 15 was never used. 99 records against APHIS's 99 animal cases is the point of this sync — the two counts agree exactly for the first time since the tracker started falling behind. The third of three Pecos sheep confirmed Nov 3. Pecos now holds 9 animal cases, more than any county except Crockett's 13, and unlike Crockett — closed since September, all 13 inactive — Pecos has 3 active. Texas's 14 active cases now sit almost entirely in the far-west corridor: Pecos 3, Hudspeth 3, Jeff Davis 2, Brewster, Presidio, El Paso, Starr, Zapata and Val Verde. The Hill Country and South Texas clusters that opened the outbreak in June are closed apart from the two new South Texas cases in this batch. Domestic animal; APHIS reports location at county level, so the coordinates are offset slightly from the other Pecos cases near the county seat (Fort Stockton) so the pins do not render on top of each other; SU:28460:27, SS:12815:27; confirmed per APHIS dashboard Nov 3",
  },
];

// The only status change in the entire 99-row export.
const RECLASSIFIED = [
  {
    id: 71,
    from: 'active',
    to: 'inactive',
    why:
      "Dona Ana County, NM dog confirmed Oct 28 (SU:28277:27) moved to Inactive per the APHIS case-level export, 7 days after confirmation. This is the FIRST Dona Ana case to close, and it ends the run of the cluster being 100% active since it opened on Oct 24. Dona Ana stays at 8 cases but drops to 7 active, which still leaves it the outbreak's largest active cluster, now only one ahead of Grant County, NM at 6. It is also the only status change anywhere in the 99-row export: no other case moved in either direction.",
  },
];

// Dates that disagreed with the APHIS confirmed date, found by reconciling the full
// case-level export. All nine are one-day corrections and none crosses a month boundary,
// so no monthly total changes. ids 78, 79 and 80 moving Oct 31 -> Oct 30 is what makes
// Oct 30 the outbreak's largest single day at eleven cases.
const DATE_FIXES = [
  { id: 20, from: '2026-06-23', to: '2026-06-24', su: 'SU:20002:26' },
  { id: 29, from: '2026-06-30', to: '2026-06-29', su: 'SU:20584:26' },
  { id: 41, from: '2026-07-17', to: '2026-07-18', su: 'SU:22268:26' },
  { id: 60, from: '2026-10-20', to: '2026-10-21', su: 'SU:28048:27' },
  { id: 63, from: '2026-10-23', to: '2026-10-22', su: 'SU:28176:27' },
  { id: 69, from: '2026-10-27', to: '2026-10-26', su: 'SU:28252:27' },
  { id: 78, from: '2026-10-31', to: '2026-10-30', su: 'SU:28406:27' },
  { id: 79, from: '2026-10-31', to: '2026-10-30', su: 'SU:28410:27' },
  { id: 80, from: '2026-10-31', to: '2026-10-30', su: 'SU:28411:27' },
];

const NEW_TIMELINE = [
  {
    date: '2026-10-30',
    event:
      "THE OUTBREAK'S LARGEST SINGLE DAY — ELEVEN CASES. Six cases confirmed Oct 30 were missing from the tracker entirely and were recovered by reconciling the full APHIS case-level export: a horse and a DOG in Grant County, NM (cases 81 and 82), TWO CATTLE AND A DOG in Luna County, NM (83, 84, 85), and a HORSE in Otero County, NM (86). The same reconciliation redated the three cases previously logged as Oct 31 — the Dona Ana cow and horse and the Grant cow — to Oct 30, which is the APHIS confirmed date for all three. Luna triples in one day from 2 cases to 5 and all 5 are active; Oct 30 delivered three cases each to Luna, Grant and Dona Ana, a county-day total beaten only by Crockett's four on Jun 24. Grant reaches 7 cases across FOUR species — cattle, horses, a dog and the outbreak's first cat — tying Dona Ana, Pecos and Crockett at the outbreak's maximum. Otero's second case is its first horse, and Otero is the only New Mexico county in the outbreak that is not on the Mexican border. All six of these cases are active.",
  },
  {
    date: '2026-10-31',
    event:
      "FIRST AVIAN CASE AND TWO NEW COUNTIES. A CHICKEN in Presidio County, TX (case 89) is the outbreak's FIRST BIRD and its EIGHTH SPECIES, and it was already inactive on confirmation. CATRON COUNTY, NM (case 88, cattle) is the outbreak's twenty-eighth county and its NORTHERNMOST CASE BY A WIDE MARGIN — 33.7N in the Gila high country, roughly 90 miles north of the Grant cluster and 140 miles from the border, on open-range federal land where detection and treatment are far harder than in the fenced border counties. Arizona also doubled: a HORSE in Cochise County (case 87) is only the state's second case, three days after its first, and both are companion or equine animals rather than livestock. All three of these cases were missing from the tracker and were recovered from the case-level export rather than from any announcement.",
  },
  {
    date: '2026-11-03',
    event:
      "99 ANIMAL CASES, 42 ACTIVE — AND THE OUTBREAK OPENS A SECOND FRONT. A full reconciliation against the APHIS case-level export took the tracker from 79 cases to 99 (98 domestic, 1 wildlife) with 42 active and 57 inactive across 29 counties in 3 states, plus 5 fly-trap detections tracked as context only. November has produced 11 animal cases in three days. Three CATTLE in Hidalgo County, NM on Nov 3 (cases 94-96) took that county from 1 case to 4, all active; a second Otero HORSE (97) and THREE SHEEP in Pecos County, TX (98-100) landed the same day — and the Pecos sheep REOPENED a county the previous sync had recorded as completely closed, which is why a quiet county cannot be read as a finished one. Nov 2 brought the first new SOUTH TEXAS county in more than four months, ZAPATA (93), alongside a dog in Starr (92) 60 miles downriver, the Rio Grande Valley's first case since July. With Catron County, NM opening the northern end on Oct 31, the outbreak is now generating detections at both ends of the border simultaneously rather than along one advancing front. New Mexico holds 26 of the 42 active cases from just 29 total, against Texas's 14 active from 68; the New Mexico border corridor from Hidalgo through Luna and Grant to Dona Ana holds 24 cases, 22 of them active, with every county in it recording a case in the last five days. Case 71, a Dona Ana dog, is the only case in the entire export to change status, closing the first of that cluster's eight.",
  },
];

// Independent cross-check targets, taken from the APHIS case-level export (ExportToCSV).
// ANIMAL cases only: the 5 fly-trap rows are excluded, which is why Sep is 3 and not 4 and
// Oct is 37 and not 41.
const APHIS_BY_MONTH = {
  '2026-06': 30,
  '2026-07': 14,
  '2026-08': 4,
  '2026-09': 3,
  '2026-10': 37,
  '2026-11': 11,
};

const EXPECTED = {
  total: 99,
  active: 42,
  inactive: 57,
  counties: 29,
  states: 3,
  domestic: 98,
  wildlife: 1,
  byState: { TX: { total: 68, active: 14 }, NM: { total: 29, active: 26 }, AZ: { total: 2, active: 2 } },
  species: { Avian: 1, Bovine: 46, Canine: 14, Caprine: 7, Cervid: 1, Equine: 9, Feline: 1, Ovine: 20 },
  counts: {
    donaAna: { state: 'NM', county: 'Dona Ana', total: 8, active: 7, species: 4 },
    grant: { state: 'NM', county: 'Grant', total: 7, active: 6, species: 4 },
    luna: { state: 'NM', county: 'Luna', total: 5, active: 5, species: 2 },
    hidalgoNM: { state: 'NM', county: 'Hidalgo', total: 4, active: 4, species: 1 },
    otero: { state: 'NM', county: 'Otero', total: 3, active: 3, species: 2 },
    catron: { state: 'NM', county: 'Catron', total: 1, active: 1, species: 1 },
    pecos: { state: 'TX', county: 'Pecos', total: 9, active: 3, species: 4 },
    zapata: { state: 'TX', county: 'Zapata', total: 1, active: 1, species: 1 },
    presidio: { state: 'TX', county: 'Presidio', total: 3, active: 1, species: 3 },
    elPaso: { state: 'TX', county: 'El Paso', total: 2, active: 1, species: 1 },
    starr: { state: 'TX', county: 'Starr', total: 2, active: 1, species: 2 },
    jeffDavis: { state: 'TX', county: 'Jeff Davis', total: 2, active: 2, species: 1 },
    hudspeth: { state: 'TX', county: 'Hudspeth', total: 3, active: 3, species: 1 },
    cochise: { state: 'AZ', county: 'Cochise', total: 2, active: 2, species: 2 },
    crockett: { state: 'TX', county: 'Crockett', total: 13, active: 0, species: 4 },
  },
};

const SPECIES_LABELS = {
  Avian: 'Avian (Poultry)',
  Bovine: 'Bovine (Cattle)',
  Canine: 'Canine (Dogs)',
  Caprine: 'Caprine (Goats)',
  Cervid: 'Cervid (Elk)',
  Equine: 'Equine (Horses)',
  Feline: 'Feline (Cats)',
  Ovine: 'Ovine (Sheep)',
};

const SPECIES_BREAKDOWN = Object.keys(EXPECTED.species)
  .sort()
  .map((sp) => ({
    species: SPECIES_LABELS[sp],
    count: EXPECTED.species[sp],
    percentage: Math.round((EXPECTED.species[sp] / EXPECTED.total) * 100),
  }));

// Date-stamp rendered as "Last updated" in the UI. Per the convention of every previous sync
// this is the date the dashboard was read, not the newest case date (which is Nov 3). Stored
// as UTC midnight because the UI formats it in UTC — see the Oct 22 fix (commit 1ae4283).
const LAST_UPDATED = '2026-11-04T00:00:00Z';
const LAST_CHECKED = new Date().toISOString();

// With VERIFY_ONLY=1 the mutating steps (1-5) are skipped and only the verification passes
// (6-8) run, so the end state can be re-checked at any time without touching either store.
const VERIFY_ONLY = process.env.VERIFY_ONLY === '1';

function assert(cond, msg) {
  if (!cond) {
    console.error(`\n  ASSERTION FAILED: ${msg}`);
    process.exitCode = 1;
    throw new Error(msg);
  }
  console.log(`  ok  ${msg}`);
}

async function main() {
  const json = JSON.parse(readFileSync(JSON_PATH, 'utf-8'));
  let before = 79;
  if (!VERIFY_ONLY) {
  // ---------------------------------------------------------------- 1. read current state
  before = json.confirmedCases.length;
  assert(before === 79, `fallback starts at 79 cases (found ${before})`);
  assert(
    json.confirmedCases.filter((c) => c.status === 'active').length === 25,
    'fallback starts at 25 active',
  );

  const dbBefore = await sql`
    select count(*)::int n,
           count(*) filter (where status='active')::int act
      from screwworm_cases`;
  assert(dbBefore[0].n === 79, `DB starts at 79 cases (found ${dbBefore[0].n})`);
  assert(dbBefore[0].act === 25, `DB starts at 25 active (found ${dbBefore[0].act})`);

  const tlBefore = json.internationalContext.timeline.length;
  assert(tlBefore === 72, `timeline starts at 72 entries (found ${tlBefore})`);

  // the arithmetic this sync exists to enforce, checked before anything is written
  const newActive = NEW_CASES.filter((c) => c.status === 'active').length;
  const newInactive = NEW_CASES.length - newActive;
  assert(NEW_CASES.length === 20, `batch holds 20 new cases (found ${NEW_CASES.length})`);
  assert(newActive === 18 && newInactive === 2, `batch is 18 active + 2 inactive (found ${newActive} + ${newInactive})`);
  assert(
    25 - RECLASSIFIED.length + newActive === EXPECTED.active,
    `active balances: 25 - ${RECLASSIFIED.length} reclassified + ${newActive} new = ${EXPECTED.active}`,
  );
  assert(
    54 + RECLASSIFIED.length + newInactive === EXPECTED.inactive,
    `inactive balances: 54 + ${RECLASSIFIED.length} + ${newInactive} = ${EXPECTED.inactive}`,
  );
  assert(before + NEW_CASES.length === EXPECTED.total, `total balances: 79 + 20 = ${EXPECTED.total}`);

  // guard: nothing in this batch may already exist, in either store
  for (const c of NEW_CASES) {
    assert(!json.confirmedCases.some((x) => x.id === c.id), `id ${c.id} is not already in the fallback`);
    const dup = await sql`select 1 from screwworm_cases where id=${c.id}`;
    assert(dup.length === 0, `id ${c.id} is not already in the DB`);
  }

  // guard: no two cases may share a pin, old or new
  const coords = new Set(json.confirmedCases.map((c) => `${c.lat},${c.lng}`));
  for (const c of NEW_CASES) {
    assert(!coords.has(`${c.lat},${c.lng}`), `case ${c.id} does not stack on an existing pin`);
    coords.add(`${c.lat},${c.lng}`);
  }

  // ---------------------------------------------------------------- 2. date corrections
  for (const f of DATE_FIXES) {
    const row = json.confirmedCases.find((c) => c.id === f.id);
    assert(!!row, `date-fix id ${f.id} exists in the fallback`);
    assert(row.date === f.from, `id ${f.id} was dated ${f.from} (found ${row.date})`);
    assert(
      f.from.slice(0, 7) === f.to.slice(0, 7),
      `id ${f.id} date fix stays inside ${f.from.slice(0, 7)} so no monthly total moves`,
    );
    row.date = f.to;
    row.notes = `${row.notes}; DATE CORRECTED ${LAST_CHECKED.slice(0, 10)}: ${f.from} -> ${f.to} to match the APHIS confirmed date in the case-level export (${f.su})`;

    const upd = await sql`
      update screwworm_cases
         set date=${f.to}, notes=${row.notes}, updated_at=now()
       where id=${f.id} and date=${f.from}
      returning id`;
    assert(upd.length === 1, `DB redated id ${f.id} ${f.from} -> ${f.to}`);
  }

  // ---------------------------------------------------------------- 3. reclassification
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

  // ---------------------------------------------------------------- 4. insert new cases
  for (const c of NEW_CASES) {
    json.confirmedCases.push(c);
    const ins = await sql`
      insert into screwworm_cases (id, date, species, animal, county, state, lat, lng, status, notes)
      values (${c.id}, ${c.date}, ${c.species}, ${c.animal}, ${c.county}, ${c.state},
              ${c.lat}, ${c.lng}, ${c.status}, ${c.notes})
      returning id`;
    assert(ins.length === 1 && ins[0].id === c.id, `DB inserted case ${c.id} (${c.county}, ${c.state} ${c.animal})`);
  }

  // ---------------------------------------------------------------- 5. metadata
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
  } else {
    console.log('VERIFY_ONLY=1 — skipping steps 1-5, verifying applied state only\n');
  }

  // ---------------------------------------------------------------- 6. verify fallback
  console.log('\n--- end state: fallback ---');
  const cases = json.confirmedCases;
  const active = cases.filter((c) => c.status === 'active');
  assert(cases.length === EXPECTED.total, `fallback holds ${EXPECTED.total} animal cases`);
  assert(active.length === EXPECTED.active, `fallback holds ${EXPECTED.active} active`);
  assert(cases.length - active.length === EXPECTED.inactive, `fallback holds ${EXPECTED.inactive} inactive`);
  assert(
    new Set(cases.map((c) => `${c.state}/${c.county}`)).size === EXPECTED.counties,
    `fallback spans ${EXPECTED.counties} counties`,
  );
  assert(new Set(cases.map((c) => c.state)).size === EXPECTED.states, `fallback spans ${EXPECTED.states} states`);
  assert(new Set(cases.map((c) => c.id)).size === cases.length, 'fallback case ids are unique');
  // ids 12 and 42 — both Sutton County, TX, Jun 12 and Jul 21 — have shared a single pin since
  // long before this sync. It is pinned here, not fixed: the assertion fails if ANY OTHER pair
  // ever stacks, which is what the per-case guard in step 1 protects for new cases.
  const KNOWN_PIN_COLLISION = [12, 42];
  const pinGroups = {};
  for (const c of cases) (pinGroups[`${c.lat},${c.lng}`] ||= []).push(c.id);
  const stacked = Object.values(pinGroups).filter((ids) => ids.length > 1);
  assert(
    stacked.length === 1 && String(stacked[0]) === String(KNOWN_PIN_COLLISION),
    `the only stacked pin is the pre-existing Sutton pair ${KNOWN_PIN_COLLISION} (found ${JSON.stringify(stacked)})`,
  );

  for (const [st, want] of Object.entries(EXPECTED.byState)) {
    const rows = cases.filter((c) => c.state === st);
    assert(rows.length === want.total, `${st} holds ${want.total} cases`);
    assert(rows.filter((c) => c.status === 'active').length === want.active, `${st} holds ${want.active} active`);
  }
  assert(
    Object.values(EXPECTED.byState).reduce((a, s) => a + s.total, 0) === EXPECTED.total,
    'by-state totals sum to the case total',
  );

  for (const [sp, want] of Object.entries(EXPECTED.species)) {
    assert(cases.filter((c) => c.species === sp).length === want, `species ${sp} = ${want}`);
  }
  assert(
    new Set(cases.map((c) => c.species)).size === Object.keys(EXPECTED.species).length,
    `fallback holds exactly ${Object.keys(EXPECTED.species).length} species and no unexpected ones`,
  );
  assert(
    Object.values(EXPECTED.species).reduce((a, b) => a + b, 0) === EXPECTED.total,
    'species counts sum to the case total',
  );

  assert(cases.filter((c) => c.species === 'Cervid').length === EXPECTED.wildlife, 'exactly 1 wildlife case (the elk)');
  assert(cases.length - EXPECTED.wildlife === EXPECTED.domestic, `${EXPECTED.domestic} domestic animal cases`);
  assert(cases.filter((c) => c.species === 'Avian').length === 1, 'exactly 1 avian case (the Presidio chicken)');

  for (const [month, want] of Object.entries(APHIS_BY_MONTH)) {
    assert(cases.filter((c) => c.date.startsWith(month)).length === want, `${month} = ${want} animal cases (APHIS)`);
  }
  assert(
    Object.values(APHIS_BY_MONTH).reduce((a, b) => a + b, 0) === EXPECTED.total,
    'monthly totals sum to the case total',
  );

  for (const [label, want] of Object.entries(EXPECTED.counts)) {
    const rows = cases.filter((c) => c.state === want.state && c.county === want.county);
    assert(rows.length === want.total, `${label} (${want.county}, ${want.state}) holds ${want.total} cases`);
    assert(
      rows.filter((c) => c.status === 'active').length === want.active,
      `${label} holds ${want.active} active`,
    );
    assert(new Set(rows.map((c) => c.species)).size === want.species, `${label} spans ${want.species} species`);
  }

  // the two new counties must be genuinely new and the only new ones
  for (const nc of [['NM', 'Catron'], ['TX', 'Zapata']]) {
    assert(
      cases.filter((c) => c.state === nc[0] && c.county === nc[1]).length === 1,
      `${nc[1]}, ${nc[0]} is a brand-new county with exactly 1 case`,
    );
  }

  // Oct 30 is the outbreak's largest single day, Nov 3 the second largest
  const byDay = {};
  for (const c of cases) byDay[c.date] = (byDay[c.date] || 0) + 1;
  assert(byDay['2026-10-30'] === 11, `Oct 30 holds 11 cases (found ${byDay['2026-10-30']})`);
  assert(byDay['2026-11-03'] === 7, `Nov 3 holds 7 cases (found ${byDay['2026-11-03']})`);
  assert(
    Math.max(...Object.values(byDay)) === 11,
    'Oct 30 is the largest single day of the outbreak',
  );
  assert(
    cases.map((c) => c.date).sort().at(-1) === '2026-11-03',
    'newest case is dated Nov 3, matching the APHIS last-reported detection',
  );

  assert(
    json.internationalContext.timeline.length === 72 + NEW_TIMELINE.length,
    `timeline holds ${72 + NEW_TIMELINE.length} entries`,
  );
  assert(
    json.speciesBreakdown.reduce((a, s) => a + s.count, 0) === EXPECTED.total,
    'speciesBreakdown counts sum to the case total',
  );
  assert(json.speciesBreakdown.length === 8, 'speciesBreakdown holds 8 species rows');
  assert(json.lastUpdated === LAST_UPDATED, `lastUpdated is ${LAST_UPDATED}`);

  // ---------------------------------------------------------------- 7. verify DB
  console.log('\n--- end state: Neon ---');
  const db = await sql`select id, date::text as date, species, animal, county, state, lat, lng, status from screwworm_cases order by id`;
  assert(db.length === EXPECTED.total, `DB holds ${EXPECTED.total} cases`);
  assert(
    db.filter((c) => c.status === 'active').length === EXPECTED.active,
    `DB holds ${EXPECTED.active} active`,
  );
  assert(
    db.filter((c) => c.status === 'inactive').length === EXPECTED.inactive,
    `DB holds ${EXPECTED.inactive} inactive`,
  );
  assert(
    new Set(db.map((c) => `${c.state}/${c.county}`)).size === EXPECTED.counties,
    `DB spans ${EXPECTED.counties} counties`,
  );
  for (const [sp, want] of Object.entries(EXPECTED.species)) {
    assert(db.filter((c) => c.species === sp).length === want, `DB species ${sp} = ${want}`);
  }
  for (const [month, want] of Object.entries(APHIS_BY_MONTH)) {
    assert(db.filter((c) => c.date.startsWith(month)).length === want, `DB ${month} = ${want} cases`);
  }

  // ---------------------------------------------------------------- 8. DB/fallback parity
  console.log('\n--- DB / fallback parity ---');
  const jm = new Map(cases.map((c) => [c.id, c]));
  // ids 21 and 28 carry pre-existing coordinate drift between the two stores. It is pinned
  // here, not fixed: the assertion fails if the drift spreads to any other case.
  const KNOWN_COORD_DRIFT = new Set([21, 28]);
  let drift = 0;
  for (const r of db) {
    const j = jm.get(r.id);
    assert(!!j, `DB id ${r.id} exists in the fallback`);
    for (const k of ['date', 'species', 'animal', 'county', 'state', 'status']) {
      if (String(r[k]) !== String(j[k])) {
        console.error(`    id ${r.id} ${k}: db=${r[k]} json=${j[k]}`);
        drift++;
      }
    }
    if (!KNOWN_COORD_DRIFT.has(r.id)) {
      if (Math.abs(r.lat - j.lat) > 1e-9 || Math.abs(r.lng - j.lng) > 1e-9) {
        console.error(`    id ${r.id} coords: db=${r.lat},${r.lng} json=${j.lat},${j.lng}`);
        drift++;
      }
    }
  }
  assert(drift === 0, 'DB and fallback agree on every case field (ids 21/28 coords excepted)');
  assert(
    cases.every((c) => db.some((r) => r.id === c.id)),
    'every fallback case exists in the DB',
  );

  const metaAfter = await sql`select key, value from screwworm_metadata`;
  const mm = Object.fromEntries(metaAfter.map((m) => [m.key, m.value]));
  assert(
    mm.internationalContext.timeline.length === json.internationalContext.timeline.length,
    `DB timeline matches the fallback at ${json.internationalContext.timeline.length} entries`,
  );
  assert(
    JSON.stringify(mm.internationalContext.timeline) === JSON.stringify(json.internationalContext.timeline),
    'DB and fallback timelines are element-for-element identical',
  );
  assert(
    mm.speciesBreakdown.reduce((a, s) => a + s.count, 0) === EXPECTED.total,
    'DB speciesBreakdown sums to the case total',
  );
  assert(mm.lastUpdated === LAST_UPDATED, `DB lastUpdated is ${LAST_UPDATED}`);

  console.log(`\nDONE  ${before} -> ${cases.length} animal cases, ${active.length} active, ${cases.length - active.length} inactive`);
  console.log(`      ${EXPECTED.counties} counties, ${EXPECTED.states} states, ${Object.keys(EXPECTED.species).length} species`);
  console.log(`      matches APHIS: 99 total (98 domestic + 1 wildlife) / 42 active / 57 inactive`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
