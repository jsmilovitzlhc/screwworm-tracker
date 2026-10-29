import { neon } from '@neondatabase/serverless';
import { readFileSync, writeFileSync } from 'fs';

const envFile = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}

const sql = neon(process.env.DATABASE_URL);

// APHIS sync Oct 29, 2026 — FIVE new domestic cases, TWO brand-new counties, the outbreak's
// THIRD STATE and its SEVENTH SPECIES. 66 -> 71 animal cases, 13 -> 18 active, 53 inactive
// (unchanged), 25 -> 27 counties, 2 -> 3 states.
//
// ---------------------------------------------------------------------------------------
// THE BRIEF FOR THIS SYNC UNDERSTATED IT. It described exactly one new case (the Cochise
// County, AZ dog) and predicted "67 total with at least 14 active across 26 counties in 3
// states". The APHIS dashboard's own case-level export disagrees on every count: five cases
// landed since the Oct 27 sync, not one. The brief's ordinals for the Arizona case are also
// wrong, because a Texas case confirmed a day EARLIER opened a new county first:
//   brief said "the twenty-sixth county"      -> Cochise is the TWENTY-SEVENTH (El Paso is 26th)
//   brief said "sixth canine (dog) detection" -> Cochise is the EIGHTH dog
// Everything else the brief asserted about the Arizona case (first AZ detection, third state,
// canine, Cochise County, Oct 28, active, NVSL Ames confirmation, 20-km infested zone) checks
// out against the APHIS announcement and is carried through below.
//
// The five cases, in confirmed-date then APHIS-reference order, are ids 68-72:
//   68  2026-10-27  Dona Ana, NM   Dog           SU:28251:27  SS:12722:27
//   69  2026-10-27  El Paso, TX    Dog           SU:28252:27  SS:12725:27   <-- new county (26th)
//   70  2026-10-28  Cochise, AZ    Dog           SU:28258:27  SS:12741:27   <-- new county (27th) + NEW STATE
//   71  2026-10-28  Dona Ana, NM   Dog           SU:28277:27  SS:12742:27
//   72  2026-10-28  Grant, NM      Domestic Cat  SU:28278:27  SS:12743:27   <-- NEW SPECIES (Feline)
//
// ---------------------------------------------------------------------------------------
// SOURCES FETCHED THIS SYNC
//
// 1. APHIS public Tableau CASE-LEVEL export — the sheet is named ExportToCSV, not a name any
//    previous sync script recorded (publicdashboards.dl.usda.gov/t/MRP_PUB/views/
//    NewWorldScrewwormPublicReporting_17805168329840/ExportToCSV.csv). 72 rows: 70 Domestic,
//    1 Wildlife & Feral (the Pecos elk), 1 Fly Trap (the Sep 25 Brewster trap, which is NOT an
//    animal case). That leaves 71 animal cases, 18 Active / 53 Inactive, 27 counties, 3 states.
//    Species as APHIS spells them: Cattle 32, Sheep 17, Dog 9, Goats 7, Horse 4, Elk 1,
//    Domestic Cat 1. This export is now the sync's primary source — it is case-level, so unlike
//    the month-rollup CSV it can be diffed row-by-row against the tracker.
//
// 2. APHIS public Tableau SummaryDashboard.csv (the rollup previous syncs used):
//        July 2026:       14 / 14 total,  0 active, 14 inactive
//        August 2026:      4 /  4 total,  0 active,  4 inactive
//        September 2026:   3 /  4 total,  0 active,  3 inactive
//        October 2026:    19 / 20 total, 18 active,  1 inactive   <-- was 14 / 15, 13 active / 1 inactive
//    (columns are "Total Cases - Domestic" / "Total Cases"; active/inactive are DOMESTIC-ONLY.)
//    CAVEAT carried forward from every sync since Sep 30: the CSV's month window has scrolled
//    and June 2026 (30 / 0 / 30) is no longer emitted. June is asserted below from the
//    tracker's own previously-verified state. It also closes exactly against source 1, which
//    DOES still carry June: 30 + 14 + 4 + 3 + 19 = 70 domestic, + 1 wildlife elk = 71.
//    October's 20 total vs 19 domestic is the elk; September's 4 vs 3 is the fly trap.
//
// 3. APHIS announcement, Oct 28 (aphis.usda.gov/news/agency-announcements/
//    usda-confirms-new-world-screwworm-arizona): "confirmed a case of New World screwworm (NWS)
//    in a dog in Cochise County, Arizona. This is the first detection of NWS in Arizona."
//    Confirmed at NVSL, Ames, Iowa. Response: 20-km infested zone, animal movement controls,
//    increased live animal surveillance and trapping, sterile fly releases, targeted outreach.
//
// 4. Border Report, Oct 28 — INDEPENDENT corroboration of both the active count and the
//    five-case shape of this sync: active cases "rose to 18 on Wednesday, with several counties
//    reporting their first case, including the populous El Paso County, Texas", and "the five
//    latest confirmed screwworm cases involved four dogs and a cat". Four dogs and a cat is
//    exactly ids 68-72. 18 active is exactly what source 1 reports. Two independent sources
//    agreeing on 18 active is what rules out the brief's "at least 14".
//
// 5. KVIA / KFOX / Border Report, Oct 28 on the El Paso case: the dog was in Socorro, Texas,
//    per State Rep. Mary Gonzalez; the Texas Animal Health Commission has drawn an infested
//    zone across El Paso County.
//
// 6. ABC15 / KJZZ / KVOA / azfamily, Oct 28-29 on the Arizona case: the dog was on a Cochise
//    County ranch; a local vet found a maggot-infested wound on its back on Oct 26 and NWS was
//    confirmed Oct 28. APHIS has not disclosed the location within the county. Roughly a
//    million sterile flies have been released in the Cochise County area, and other livestock
//    on the ranch are being evaluated. Arizona's planned sterile fly facility is at Douglas,
//    which is in Cochise County.
//
// ---------------------------------------------------------------------------------------
// PRE-EXISTING DATE DRIFT, DELIBERATELY NOT TOUCHED HERE
//
// Diffing the tracker's 66 existing cases against source 1 on (date, species, county, state,
// status) leaves exactly four mismatches, all off-by-one on the date and all pre-dating this
// sync:
//     Medina TX cattle       tracker 2026-06-23  vs  APHIS 2026-06-24
//     Pecos TX dog           tracker 2026-06-30  vs  APHIS 2026-06-29
//     Starr TX cattle        tracker 2026-07-17  vs  APHIS 2026-07-18
//     Val Verde TX cattle    tracker 2026-10-20  vs  APHIS 2026-10-21
// The drift runs in BOTH directions, so it is not a timezone bug; these look like
// press-release dates kept in preference to dashboard dates by earlier syncs. All four stay
// inside their original month, so no monthly, county, state, species or status total below is
// affected. Changing them is a separate decision and is NOT part of this sync — but the
// assertion block at the end pins them so they cannot drift further unnoticed.
//
// ---------------------------------------------------------------------------------------
// CODE CHANGES SHIPPED ALONGSIDE THIS SYNC (the Feline species is new, so this is not optional)
//
//   src/components/CasesByDay.jsx   SPECIES_ORDER + SPECIES_COLORS gain 'Feline'. SPECIES_ORDER
//                                   FILTERS the stacked bars, so without this the cat case
//                                   silently vanishes from the live daily chart.
//   api/cases.js                    SPECIES_LABELS gains Feline -> 'Feline (Cats)'.
//   src/components/SpeciesBreakdown.jsx  fillClass() fell through to 'canine' for anything it
//                                   did not recognise, so Feline (and Equine) rendered in the
//                                   dog colour. Both now have their own branch.
//   src/index.css                   .species-bar-fill.feline / .equine bar colours.
//   src/layouts/layouts.css         .bb-species-fill.feline bar colour.
//   api/cron/check-usda.js          normalizeSpecies() would have stored APHIS's raw
//                                   'Domestic Cat' string as the species on the next cron run,
//                                   splitting the breakdown. Now maps to Feline/Cat, with a
//                                   word-boundary test so 'Cattle' can never reach it.
// The species-wiring assertions at the end of this script verify all of the above against the
// species actually present in the data.

const JSON_PATH = '/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/src/data/cases.json';

const NEW_CASES = [
  {
    id: 68,
    date: '2026-10-27',
    species: 'Canine',
    animal: 'Dog',
    county: 'Dona Ana',
    state: 'NM',
    lat: 32.3327,
    lng: -106.7483,
    status: 'active',
    notes: 'Third Dona Ana County case and New Mexico\'s tenth case; the sixth canine (dog) '
      + 'detection of the US outbreak and the first dog in Dona Ana, after the county\'s cattle '
      + 'and sheep cases on Oct 24 — so all three of the county\'s cases came inside four days '
      + 'and Dona Ana now spans livestock and companion animals; one of five cases confirmed '
      + 'across Oct 27-28, a cluster Border Report summarised as "four dogs and a cat" and the '
      + 'largest two-day run of the outbreak since the June Zavala cluster; domestic animal; '
      + 'APHIS reports location at county level, so the coordinates are offset slightly from the '
      + 'other Dona Ana cases near the county seat (Las Cruces) so the pins do not render on top '
      + 'of each other; SU:28251:27, SS:12722:27; confirmed per APHIS dashboard Oct 27',
  },
  {
    id: 69,
    date: '2026-10-27',
    species: 'Canine',
    animal: 'Dog',
    county: 'El Paso',
    state: 'TX',
    lat: 31.6546,
    lng: -106.3033,
    status: 'active',
    notes: 'First El Paso County case and the TWENTY-SIXTH county of the US outbreak; Texas\'s '
      + 'twentieth affected county and fifty-eighth case, and the seventh canine (dog) detection '
      + 'overall; by far the most populous county the outbreak has reached — about 870,000 '
      + 'people — and the first case in a major metropolitan area rather than ranch country, '
      + 'which is why the Texas Animal Health Commission drew the infested zone across the whole '
      + 'of El Paso County; the dog was in Socorro, Texas per State Rep. Mary Gonzalez, so unlike '
      + 'most cases in this dataset the coordinates are the reported community rather than the '
      + 'county seat; El Paso County wraps the western tip of Texas between Dona Ana County, NM '
      + '(4 cases, all active) and Ciudad Juarez, so this detection joins the Texas and New '
      + 'Mexico clusters into one continuous band along the Rio Grande; domestic animal; '
      + 'SU:28252:27, SS:12725:27; confirmed per APHIS dashboard Oct 27',
  },
  {
    id: 70,
    date: '2026-10-28',
    species: 'Canine',
    animal: 'Dog',
    county: 'Cochise',
    state: 'AZ',
    lat: 31.4484,
    lng: -109.9284,
    status: 'active',
    notes: 'First Cochise County case and the first detection of New World screwworm in ARIZONA '
      + '— the TWENTY-SEVENTH county and the THIRD STATE of the US outbreak, after Texas and New '
      + 'Mexico, and the first new state since New Mexico\'s Lea County dog on Jun 7; the eighth '
      + 'canine (dog) detection overall; the dog was on a Cochise County ranch, where a local '
      + 'veterinarian found a maggot-infested wound on its back on Oct 26, and samples were '
      + 'tested and confirmed at the APHIS National Veterinary Services Laboratories in Ames, '
      + 'Iowa on Oct 28; APHIS and the Arizona Department of Agriculture are running a joint '
      + 'response under the APHIS NWS Response Playbook: a 20-km infested zone around the '
      + 'detection, animal movement controls for that area, increased live animal surveillance '
      + 'and trapping, sterile fly releases (roughly a million flies released in the Cochise '
      + 'County area) and targeted outreach to producers, veterinarians and communities, with '
      + 'other livestock on the ranch being evaluated; Cochise County borders Hidalgo County, NM '
      + '(1 active case) to the east, so Arizona\'s first detection is contiguous with the '
      + 'existing southwestern New Mexico cluster rather than a long-range jump; Cochise also '
      + 'holds the Douglas port of entry — the FIRST crossing USDA reopened to Mexican cattle '
      + 'imports under the phased reopening, ahead of Santa Teresa, NM and Columbus, NM — and is '
      + 'the planned site of Arizona\'s sterile fly facility; APHIS has not disclosed the '
      + 'location within the county, so the coordinates are the county seat (Bisbee); '
      + 'SU:28258:27, SS:12741:27; confirmed per APHIS dashboard and APHIS announcement Oct 28',
  },
  {
    id: 71,
    date: '2026-10-28',
    species: 'Canine',
    animal: 'Dog',
    county: 'Dona Ana',
    state: 'NM',
    lat: 32.2943,
    lng: -106.7948,
    status: 'active',
    notes: 'Fourth Dona Ana County case and New Mexico\'s eleventh case; the ninth canine (dog) '
      + 'detection of the US outbreak and the county\'s second dog on consecutive days, after '
      + 'case 68 on Oct 27; Dona Ana is now the outbreak\'s LARGEST ACTIVE cluster, with 4 cases '
      + 'all active across cattle, sheep and two dogs, all confirmed inside five days — more '
      + 'active cases than any other county, though Crockett County, TX is still the largest '
      + 'cluster by total cases at 13, all of them long since closed; '
      + 'and Las Cruces sits inside the resulting infested zone; domestic animal; APHIS reports '
      + 'location at county level, so the coordinates are offset slightly from the other Dona Ana '
      + 'cases near the county seat (Las Cruces) so the pins do not render on top of each other; '
      + 'SU:28277:27, SS:12742:27; confirmed per APHIS dashboard Oct 28',
  },
  {
    id: 72,
    date: '2026-10-28',
    species: 'Feline',
    animal: 'Cat',
    county: 'Grant',
    state: 'NM',
    lat: 32.7249,
    lng: -108.2653,
    status: 'active',
    notes: 'FIRST FELINE (CAT) DETECTION OF THE US OUTBREAK — a domestic cat, and the seventh '
      + 'species the outbreak has infected after cattle, sheep, goats, dogs, horses and one elk; '
      + 'APHIS records the species as "Domestic Cat"; fourth Grant County case and New Mexico\'s '
      + 'twelfth case, which makes Grant the state\'s joint-largest cluster alongside Dona Ana at '
      + '4 cases each; Grant\'s cases now run horse (Sep 17, inactive), cattle and horse (Oct 15, '
      + 'both active) and this cat, so 3 of its 4 are active; a cat is a second companion-animal '
      + 'species after dogs and, like the dog cases, it points to the fly being established in '
      + 'the local environment rather than moving with livestock shipments — cats are not '
      + 'transported under livestock permits and are not covered by the movement controls the '
      + 'response relies on; one of five cases confirmed across Oct 27-28, the cluster Border '
      + 'Report summarised as "four dogs and a cat"; domestic animal; APHIS reports location at '
      + 'county level, so the coordinates are offset slightly from the other Grant cases near the '
      + 'county seat (Silver City) so the pins do not render on top of each other; SU:28278:27, '
      + 'SS:12743:27; confirmed per APHIS dashboard Oct 28',
  },
];

// No status transitions this sync. Source 1 reports 18 active while the tracker holds 13 and
// this script adds exactly 5 active cases, which is only possible if nothing was closed out.
// Inactive holds at 53 on both sides. Both are asserted below.
const TO_INACTIVE = [];

const NEW_IDS = NEW_CASES.map(c => c.id);

const EXPECTED_ACTIVE_BEFORE = [54, 55, 56, 57, 59, 60, 61, 62, 63, 64, 65, 66, 67];
const EXPECTED_ACTIVE_AFTER = [...EXPECTED_ACTIVE_BEFORE, 68, 69, 70, 71, 72];

const EXPECTED_TOTAL_BEFORE = 66;
const EXPECTED_ACTIVE_BEFORE_COUNT = 13;
const EXPECTED_TOTAL_AFTER = 71;
const EXPECTED_ACTIVE_AFTER_COUNT = 18;
const EXPECTED_INACTIVE_AFTER = 53;
const EXPECTED_DOMESTIC_AFTER = 70;

// Post-update per-month truth. July/Aug/Sept/Oct from this sync's rollup CSV AND from the
// case-level export; June from the case-level export and the tracker's prior state (see CAVEAT).
const APHIS_BY_MONTH = {
  '2026-06': { total: 30, domestic: 30, active: 0, inactive: 30 },
  '2026-07': { total: 14, domestic: 14, active: 0, inactive: 14 },
  '2026-08': { total: 4, domestic: 4, active: 0, inactive: 4 },
  '2026-09': { total: 3, domestic: 3, active: 0, inactive: 3 },
  '2026-10': { total: 20, domestic: 19, active: 18, inactive: 2 },
};

// The rollup CSV's domestic-only active/inactive measures, asserted separately from the totals
// so the wildlife/domestic split cannot silently drift back to the Oct 22 misreading.
// October's two inactive rows are case 53 (domestic) and the elk (wildlife), so the
// domestic-only inactive column is 1 while the all-species inactive count is 2.
const APHIS_DOMESTIC_ACTIVE_BY_MONTH = {
  '2026-06': { active: 0, inactive: 30 },
  '2026-07': { active: 0, inactive: 14 },
  '2026-08': { active: 0, inactive: 4 },
  '2026-09': { active: 0, inactive: 3 },
  '2026-10': { active: 18, inactive: 1 },
};

// Species truth from the case-level export, translated from APHIS's labels into the tracker's
// Linnaean keys. Dog 5 -> 9 and the new Feline row are this sync's only changes.
const APHIS_BY_SPECIES = {
  Bovine: 32,
  Ovine: 17,
  Canine: 9,
  Caprine: 7,
  Equine: 4,
  Cervid: 1,
  Feline: 1,
};

// How APHIS spells each species in the export, so the mapping itself is documented and pinned.
const APHIS_SPECIES_LABEL = {
  Bovine: 'Cattle',
  Ovine: 'Sheep',
  Canine: 'Dog',
  Caprine: 'Goats',
  Equine: 'Horse',
  Cervid: 'Elk',
  Feline: 'Domestic Cat',
};

const EXPECTED_COUNTIES = 27;
const EXPECTED_STATES = 3;

const EXPECTED_TX = { total: 58, active: 7 };
const EXPECTED_NM = { total: 12, active: 10 };
const EXPECTED_AZ = { total: 1, active: 1 };

const EXPECTED_COUNTY_TOTALS = [
  ['El Paso', 'TX', { total: 1, active: 1 }],
  ['Cochise', 'AZ', { total: 1, active: 1 }],
  ['Dona Ana', 'NM', { total: 4, active: 4 }],
  ['Grant', 'NM', { total: 4, active: 3 }],
  ['Luna', 'NM', { total: 1, active: 1 }],
  ['Hidalgo', 'NM', { total: 1, active: 1 }],
  ['Otero', 'NM', { total: 1, active: 1 }],
  ['Lea', 'NM', { total: 1, active: 0 }],
  ['Hudspeth', 'TX', { total: 2, active: 2 }],
];

const EXPECTED_TX_COUNTY_COUNT = 20;
const EXPECTED_NM_COUNTY_LIST = ['Dona Ana', 'Grant', 'Hidalgo', 'Lea', 'Luna', 'Otero'];
const EXPECTED_AZ_COUNTY_LIST = ['Cochise'];
const EXPECTED_STATE_LIST = ['AZ', 'NM', 'TX'];

// Active split after this sync: 7 TX / 10 NM / 1 AZ = 18.
const EXPECTED_ACTIVE_SPLIT = { TX: 7, NM: 10, AZ: 1 };

// County bounding boxes for the new/!moved pins.
//   Cochise County, AZ:  ~31.33N (Mexican border) to 32.52N, -110.46W to -109.05W
//   El Paso County, TX:  ~31.39N to 32.00N, -106.63W to -105.99W
//   Dona Ana County, NM: ~31.78N to 32.79N, -107.30W to -106.30W
//   Grant County, NM:    ~32.00N to 33.21N, -109.05W to -107.71W
const COUNTY_BOX = {
  68: { name: 'Dona Ana County, NM', latMin: 31.78, latMax: 32.79, lngMin: -107.30, lngMax: -106.30 },
  69: { name: 'El Paso County, TX', latMin: 31.39, latMax: 32.00, lngMin: -106.63, lngMax: -105.99 },
  70: { name: 'Cochise County, AZ', latMin: 31.33, latMax: 32.52, lngMin: -110.46, lngMax: -109.05 },
  71: { name: 'Dona Ana County, NM', latMin: 31.78, latMax: 32.79, lngMin: -107.30, lngMax: -106.30 },
  72: { name: 'Grant County, NM', latMin: 32.00, latMax: 33.21, lngMin: -109.05, lngMax: -107.71 },
};

// The highest APHIS refs already in the dataset, both on case 67 (Luna, Oct 26). Every new ref
// must exceed these; a lower number would mean a stale or transposed ref.
const PRIOR_MAX_REF = { SU: 28227, SS: 12716 };
const NEW_REFS = {
  68: { SU: 28251, SS: 12722 },
  69: { SU: 28252, SS: 12725 },
  70: { SU: 28258, SS: 12741 },
  71: { SU: 28277, SS: 12742 },
  72: { SU: 28278, SS: 12743 },
};

// The four pre-existing off-by-one dates documented above. Pinned so they cannot drift further.
const KNOWN_DATE_DRIFT = [
  { county: 'Medina', state: 'TX', species: 'Bovine', tracker: '2026-06-23', aphis: '2026-06-24' },
  { county: 'Pecos', state: 'TX', species: 'Canine', tracker: '2026-06-30', aphis: '2026-06-29' },
  { county: 'Starr', state: 'TX', species: 'Bovine', tracker: '2026-07-17', aphis: '2026-07-18' },
  { county: 'Val Verde', state: 'TX', species: 'Bovine', tracker: '2026-10-20', aphis: '2026-10-21' },
];

const SPECIES_LABEL = {
  Bovine: 'Bovine (Cattle)',
  Canine: 'Canine (Dogs)',
  Caprine: 'Caprine (Goats)',
  Cervid: 'Cervid (Elk)',
  Equine: 'Equine (Horses)',
  Feline: 'Feline (Cats)',
  Ovine: 'Ovine (Sheep)',
};

const TIMELINE_ENTRIES = [
  {
    date: '2026-10-27',
    event: 'Cases 68 and 69: a dog in Dona Ana County, NM and a dog in El Paso County, TX. El '
      + 'Paso is the first case in the county and the twenty-sixth county of the US outbreak — '
      + 'Texas\'s twentieth affected county, its fifty-eighth case, and by far the most populous '
      + 'county the outbreak has reached at about 870,000 people. It is the first detection in a '
      + 'major metropolitan area rather than ranch country, and the Texas Animal Health '
      + 'Commission responded by drawing an infested zone across the whole of El Paso County; the '
      + 'dog was in Socorro, Texas. Because El Paso County wraps the western tip of Texas between '
      + 'Dona Ana County, NM and Ciudad Juarez, the Texas and New Mexico clusters are now one '
      + 'continuous band along the Rio Grande. The Dona Ana dog is the county\'s third case in '
      + 'four days, after cattle and sheep on Oct 24, and New Mexico\'s tenth case. Both are '
      + 'dogs, the outbreak\'s sixth and seventh canine detections',
  },
  {
    date: '2026-10-28',
    event: 'ARIZONA BECOMES THE THIRD STATE. Case 70: a dog on a ranch in Cochise County, AZ — '
      + 'the first detection of New World screwworm in Arizona, the twenty-seventh county of the '
      + 'US outbreak, and the first new state since New Mexico\'s Lea County dog on Jun 7. A '
      + 'local veterinarian found a maggot-infested wound on the dog\'s back on Oct 26 and APHIS '
      + 'confirmed the sample at the National Veterinary Services Laboratories in Ames, Iowa. '
      + 'APHIS and the Arizona Department of Agriculture opened a joint response under the APHIS '
      + 'NWS Response Playbook: a 20-km infested zone around the detection, animal movement '
      + 'controls, increased live animal surveillance and trapping, sterile fly releases — about '
      + 'a million flies in the Cochise County area — and targeted outreach. Cochise borders '
      + 'Hidalgo County, NM, so Arizona\'s first case is contiguous with the southwestern New '
      + 'Mexico cluster rather than a long-range jump; it also holds the Douglas port of entry, '
      + 'the first crossing USDA reopened to Mexican cattle, and the planned site of Arizona\'s '
      + 'sterile fly facility. Two more New Mexico cases landed the same day: case 71, a second '
      + 'Dona Ana dog on consecutive days, and case 72, a DOMESTIC CAT in Grant County — the '
      + 'outbreak\'s FIRST FELINE DETECTION and its seventh species after cattle, sheep, goats, '
      + 'dogs, horses and one elk. Cats move outside the livestock permit system the response '
      + 'depends on, so like the dog cases the detection points to the fly being established '
      + 'locally rather than travelling with shipments. Five cases were confirmed across Oct '
      + '27-28 — four dogs and a cat, the outbreak\'s largest two-day run since June. US total '
      + 'reaches 71 animal cases with 18 active and 53 inactive across 27 counties in 3 states; '
      + '70 of the 71 are domestic animals and 1 is wildlife. New Mexico leads on active cases '
      + 'with 10 of the 18, from 12 cases across 6 counties, against Texas\'s 7 active from 58 '
      + 'cases and Arizona\'s 1',
  },
];

const ARIZONA_RESPONSE = {
  state: 'Arizona',
  actions: [
    '20-km infested zone established around the Cochise County detection (APHIS NWS Response Playbook)',
    'Animal movement controls within the infested zone',
    'Increased live animal surveillance and fly trapping',
    'Sterile fly releases — roughly 1 million flies released in the Cochise County area',
    'Targeted outreach to local producers, veterinarians, and communities',
    'Joint APHIS / Arizona Department of Agriculture response; remaining livestock on the index ranch under evaluation',
    'Sterile fly production facility planned for Douglas, Cochise County',
    'Report suspected animal cases to Arizona Dept. of Agriculture (602-542-4293); infested wildlife to AZ Game and Fish (623-236-7201)',
  ],
};

// New Mexico's stored response still described a single Lea County quarantine zone from June,
// which has been stale since the state's cluster spread to six counties. Refreshed here.
const NEW_MEXICO_RESPONSE = {
  state: 'New Mexico',
  actions: [
    'Infested zones across the southwestern border counties — Hidalgo, Luna, Grant, Dona Ana — plus Otero and the original Lea County zone',
    'Las Cruces falls inside the Dona Ana County infested zone',
    'Animal movement controls and permitting within infested zones',
    'Enhanced surveillance at livestock markets and expanded fly trapping',
    'Coordination with TX, AZ, and federal authorities',
    'Public advisory to ranchers and pet owners on wound monitoring (ScrewwormNM.org)',
  ],
};

// REPAIR, found while asserting DB/fallback parity this sync: the Neon
// screwworm_quarantine_zones table holds 9 zones but the static fallback holds 10. The DB is
// missing the Jim Hogg / Starr / Zapata County Zone (established Jun 26, 2026), and because
// /api/cases serves zones from the DB, PRODUCTION HAS BEEN RENDERING 9 OF THE 10 ZONES. This is
// the same class of DB/fallback drift the Oct 6 sync repaired in the timeline. The zone is
// re-inserted from the fallback record below, which is the only surviving copy.
const MISSING_ZONE = {
  name: 'Jim Hogg / Starr / Zapata County Zone',
  state: 'TX',
  centerLat: 27.0435,
  centerLng: -98.6932,
  radiusMiles: 15,
  established: '2026-06-26',
  status: 'active',
};

const LAST_UPDATED = '2026-10-29T00:00:00Z';
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
  console.log('✓ This script\'s own truth table is internally consistent');

  // Each new case must be dated on or after the previous one, and ids must follow that order.
  for (let i = 1; i < NEW_CASES.length; i += 1) {
    if (NEW_CASES[i].date < NEW_CASES[i - 1].date) {
      fail(`NEW_CASES is not in date order at id ${NEW_CASES[i].id}`);
    }
    if (NEW_CASES[i].id !== NEW_CASES[i - 1].id + 1) {
      fail(`NEW_CASES ids are not contiguous at id ${NEW_CASES[i].id}`);
    }
  }
  // Within the same confirmed date, the ids must follow the APHIS reference order.
  for (let i = 1; i < NEW_CASES.length; i += 1) {
    const a = NEW_CASES[i - 1];
    const b = NEW_CASES[i];
    if (a.date === b.date && NEW_REFS[b.id].SU <= NEW_REFS[a.id].SU) {
      fail(`Same-day cases ${a.id}/${b.id} are not ordered by their APHIS SU reference`);
    }
  }
  console.log('✓ New cases are ordered by confirmed date, then by APHIS reference');

  const before = await sql`
    SELECT COUNT(*) AS "total",
           COUNT(*) FILTER (WHERE status = 'active') AS "active",
           COUNT(*) FILTER (WHERE status = 'inactive') AS "inactive"
    FROM screwworm_cases
  `;
  console.log(`Before: ${before[0].total} total, ${before[0].active} active, ${before[0].inactive} inactive`);

  // Re-runnable: accept either the pre-sync state (66/13) or an already-applied post-sync
  // state (71/18), and reject anything else so it cannot be pointed at unknown data.
  const activeBefore = (await sql`SELECT id FROM screwworm_cases WHERE status = 'active' ORDER BY id`).map(r => r.id);
  const isPreSync = Number(before[0].total) === EXPECTED_TOTAL_BEFORE
    && Number(before[0].active) === EXPECTED_ACTIVE_BEFORE_COUNT
    && JSON.stringify(activeBefore) === JSON.stringify(EXPECTED_ACTIVE_BEFORE);
  const isPostSync = Number(before[0].total) === EXPECTED_TOTAL_AFTER
    && Number(before[0].active) === EXPECTED_ACTIVE_AFTER_COUNT
    && JSON.stringify(activeBefore) === JSON.stringify(EXPECTED_ACTIVE_AFTER);
  if (!isPreSync && !isPostSync) {
    fail(`Unexpected starting state: ${before[0].total} total / ${before[0].active} active, `
      + `active ids ${JSON.stringify(activeBefore)}. Wanted ${EXPECTED_TOTAL_BEFORE}/`
      + `${EXPECTED_ACTIVE_BEFORE_COUNT} (pre-sync) or ${EXPECTED_TOTAL_AFTER}/`
      + `${EXPECTED_ACTIVE_AFTER_COUNT} (already applied)`);
  }
  if (isPostSync) console.log('Sync already applied — re-running idempotently to re-verify');

  // El Paso and Cochise must be genuinely new counties, and Arizona a genuinely new state.
  // A pre-existing row would make every ordinal in the notes and the timeline wrong.
  for (const [county, state] of [['El Paso', 'TX'], ['Cochise', 'AZ']]) {
    const pre = await sql`
      SELECT id FROM screwworm_cases WHERE county = ${county} AND state = ${state}
        AND id <> ALL(${NEW_IDS})
    `;
    if (pre.length > 0) {
      fail(`${county} County, ${state} already has pre-existing case(s) ${JSON.stringify(pre.map(r => r.id))} `
        + '— it is not a new county and the ordinals in this script are wrong');
    }
    console.log(`✓ ${county} County, ${state} has no pre-existing case — genuinely a new county`);
  }
  const preAZ = await sql`SELECT id FROM screwworm_cases WHERE state = 'AZ' AND id <> ALL(${NEW_IDS})`;
  if (preAZ.length > 0) fail(`Arizona already has case(s) ${JSON.stringify(preAZ.map(r => r.id))} — it is not a new state`);
  console.log('✓ Arizona has no pre-existing case — genuinely the outbreak\'s third state');

  // Feline must be a genuinely new species, or "first feline detection" is wrong.
  const preFeline = await sql`SELECT id FROM screwworm_cases WHERE species = 'Feline' AND id <> ALL(${NEW_IDS})`;
  if (preFeline.length > 0) fail(`Feline cases already exist: ${JSON.stringify(preFeline.map(r => r.id))}`);
  console.log('✓ No pre-existing Feline case — genuinely the outbreak\'s first cat');

  // Dona Ana and Grant must already exist, or their ordinals ("third", "fourth") are wrong.
  for (const [county, want] of [['Dona Ana', 2], ['Grant', 3]]) {
    const n = Number((await sql`
      SELECT COUNT(*) AS "n" FROM screwworm_cases
      WHERE county = ${county} AND state = 'NM' AND id <> ALL(${NEW_IDS})
    `)[0].n);
    if (n !== want) fail(`${county} County, NM holds ${n} pre-existing cases, expected ${want}`);
    console.log(`✓ ${county} County, NM holds ${n} pre-existing cases — the ordinals in the notes are correct`);
  }

  // Ids 68-72 must be free and must follow the current maximum. Id 15 is absent from this
  // dataset by design (a retracted case), so "count + 1" is NOT the next id — max + 1 is.
  const maxId = Number((await sql`SELECT MAX(id) AS "m" FROM screwworm_cases WHERE id <> ALL(${NEW_IDS})`)[0].m);
  if (maxId !== EXPECTED_TOTAL_BEFORE + 1) {
    fail(`Highest existing id is ${maxId}, expected 67 — ids 68-72 are not the next ids`);
  }
  console.log('✓ Ids 68-72 follow the current maximum (67); id 15 remains absent by design');

  // Every new APHIS ref must advance past the highest refs already in the dataset.
  const allNotes = (await sql`SELECT notes FROM screwworm_cases WHERE id <> ALL(${NEW_IDS})`).map(r => r.notes).join(' ');
  for (const prefix of ['SU', 'SS']) {
    const seen = [...allNotes.matchAll(new RegExp(`${prefix}:(\\d+):(\\d+)`, 'g'))].map(m => Number(m[1]));
    const maxSeen = Math.max(...seen);
    if (maxSeen !== PRIOR_MAX_REF[prefix]) {
      fail(`Highest existing ${prefix} ref is ${maxSeen}, expected ${PRIOR_MAX_REF[prefix]}`);
    }
    let prev = maxSeen;
    for (const id of NEW_IDS) {
      if (NEW_REFS[id][prefix] <= prev) {
        fail(`${prefix} ref ${NEW_REFS[id][prefix]} on case ${id} does not advance past ${prev} `
          + '— likely a stale or transposed ref');
      }
      prev = NEW_REFS[id][prefix];
    }
    console.log(`✓ ${prefix} refs ${NEW_IDS.map(id => NEW_REFS[id][prefix]).join(' < ')} all advance past the prior maximum ${maxSeen}`);
  }
  // Every ref in the notes this script writes must match NEW_REFS exactly.
  for (const c of NEW_CASES) {
    for (const prefix of ['SU', 'SS']) {
      const m = c.notes.match(new RegExp(`${prefix}:(\\d+):27`));
      if (!m || Number(m[1]) !== NEW_REFS[c.id][prefix]) {
        fail(`Case ${c.id} notes carry ${prefix} ref ${m ? m[1] : 'none'}, expected ${NEW_REFS[c.id][prefix]}`);
      }
    }
  }
  console.log('✓ Every new case\'s notes carry the APHIS refs this script asserts');

  // --- 1. Insert the new cases (idempotent) ---
  for (const NEW_CASE of NEW_CASES) {
    const existing = await sql`SELECT id FROM screwworm_cases WHERE id = ${NEW_CASE.id}`;
    // Upsert rather than skip. These five rows are wholly owned by this script, so a re-run
    // after an edit to the notes or coordinates should converge, instead of leaving a stale row
    // that then fails the field-by-field DB/fallback parity check further down.
    const inserted = await sql`
      INSERT INTO screwworm_cases (id, date, species, animal, county, state, lat, lng, status, notes)
      VALUES (${NEW_CASE.id}, ${NEW_CASE.date}, ${NEW_CASE.species}, ${NEW_CASE.animal},
              ${NEW_CASE.county}, ${NEW_CASE.state}, ${NEW_CASE.lat}, ${NEW_CASE.lng},
              ${NEW_CASE.status}, ${NEW_CASE.notes})
      ON CONFLICT (id) DO UPDATE SET
        date = EXCLUDED.date, species = EXCLUDED.species, animal = EXCLUDED.animal,
        county = EXCLUDED.county, state = EXCLUDED.state, lat = EXCLUDED.lat,
        lng = EXCLUDED.lng, status = EXCLUDED.status, notes = EXCLUDED.notes
      RETURNING id, date, species, animal, county, state, status
    `;
    console.log(`${existing.length > 0 ? 'Updated' : 'Inserted'}:`, JSON.stringify(inserted[0]));
  }

  // --- 2. Status transitions: none this sync, but prove it rather than assume it ---
  if (TO_INACTIVE.length > 0) fail('TO_INACTIVE is non-empty but this sync is declared transition-free');
  console.log('✓ No status transitions this sync (active 13 -> 18 while adding 5 cases; inactive holds at 53)');

  // --- 3. Nothing outside the expected set may be active ---
  const stale = await sql`
    SELECT id, date, county, animal FROM screwworm_cases
    WHERE status = 'active' AND id <> ALL(${EXPECTED_ACTIVE_AFTER}) ORDER BY id
  `;
  if (stale.length > 0) fail(`Unexpected active cases: ${JSON.stringify(stale)}`);
  for (const id of EXPECTED_ACTIVE_AFTER) {
    const row = (await sql`SELECT id, county, animal, status FROM screwworm_cases WHERE id = ${id}`)[0];
    if (!row || row.status !== 'active') {
      fail(`Case #${id} is ${row ? row.status : 'missing'} — expected active`);
    }
  }
  console.log(`✓ Exactly the expected ${EXPECTED_ACTIVE_AFTER.length} cases are active`);

  // Case 53 must still be October's single domestic inactive row — the rollup CSV holds that
  // column at 1, so a second domestic October closure would mean this sync missed something.
  const case53 = (await sql`SELECT id, status FROM screwworm_cases WHERE id = 53`)[0];
  if (!case53 || case53.status !== 'inactive') {
    fail(`Case #53 is ${case53 ? case53.status : 'missing'} — expected inactive`);
  }
  const octDomInactive = await sql`
    SELECT id, county, animal FROM screwworm_cases
    WHERE status = 'inactive' AND species <> 'Cervid' AND to_char(date, 'YYYY-MM') = '2026-10' ORDER BY id
  `;
  if (octDomInactive.length !== 1 || octDomInactive[0].id !== 53) {
    fail(`Expected exactly one domestic inactive October case (#53), got ${JSON.stringify(octDomInactive)}`);
  }
  console.log('✓ Case #53 is still October\'s only domestic inactive row (matches "Inactive Cases - Domestic" = 1)');

  // --- 4. Recompute speciesBreakdown from the case rows, exactly as /api/cases does ---
  const bySpeciesRows = await sql`SELECT species, COUNT(*) AS "count" FROM screwworm_cases GROUP BY 1`;
  const speciesCounts = {};
  for (const row of bySpeciesRows) speciesCounts[row.species] = Number(row.count);
  for (const [species, want] of Object.entries(APHIS_BY_SPECIES)) {
    if (speciesCounts[species] !== want) {
      fail(`${species} (APHIS "${APHIS_SPECIES_LABEL[species]}"): tracker has ${speciesCounts[species]} rows, expected ${want}`);
    }
  }
  for (const species of Object.keys(speciesCounts)) {
    if (!(species in APHIS_BY_SPECIES)) fail(`Tracker has unexpected species "${species}" absent from the truth table`);
  }
  const speciesTotal = Object.values(speciesCounts).reduce((s, n) => s + n, 0);
  if (speciesTotal !== EXPECTED_TOTAL_AFTER) fail(`Species rows sum to ${speciesTotal}, expected ${EXPECTED_TOTAL_AFTER}`);
  console.log(`✓ All ${Object.keys(speciesCounts).length} species match the APHIS case-level export`);

  const breakdownRows = await sql`SELECT value FROM screwworm_metadata WHERE key = 'speciesBreakdown'`;
  const oldBreakdown = typeof breakdownRows[0].value === 'string' ? JSON.parse(breakdownRows[0].value) : breakdownRows[0].value;
  const oldLabels = oldBreakdown.map(e => e.species);
  if (JSON.stringify(oldLabels) !== JSON.stringify([...oldLabels].sort())) {
    fail(`Stored breakdown order is not alphabetical, refusing to re-sort it: ${JSON.stringify(oldLabels)}`);
  }
  for (const label of oldLabels) {
    if (!Object.values(SPECIES_LABEL).includes(label)) fail(`Stored breakdown entry "${label}" has no known species key`);
  }
  const newBreakdown = Object.keys(speciesCounts)
    .map(species => ({
      species: SPECIES_LABEL[species] || species,
      count: speciesCounts[species],
      percentage: Math.round((speciesCounts[species] / EXPECTED_TOTAL_AFTER) * 100),
    }))
    .sort((a, b) => a.species.localeCompare(b.species));
  if (newBreakdown.length !== Object.keys(APHIS_BY_SPECIES).length) fail('Breakdown is missing a species row');
  // The new breakdown must be the old one plus exactly the Feline row.
  const addedLabels = newBreakdown.map(e => e.species).filter(l => !oldLabels.includes(l));
  const felineAlreadyStored = oldLabels.includes('Feline (Cats)');
  const wantAdded = felineAlreadyStored ? [] : ['Feline (Cats)'];
  if (JSON.stringify(addedLabels) !== JSON.stringify(wantAdded)) {
    fail(`Breakdown gained ${JSON.stringify(addedLabels)}, expected ${JSON.stringify(wantAdded)}`);
  }
  // Either way the finished breakdown must carry Feline, and must carry nothing else new.
  if (!newBreakdown.some(e => e.species === 'Feline (Cats)')) fail('Breakdown is missing the Feline row');
  const droppedLabels = oldLabels.filter(l => !newBreakdown.some(e => e.species === l));
  if (droppedLabels.length > 0) fail(`Breakdown would drop ${JSON.stringify(droppedLabels)}`);
  const newBreakdownTotal = newBreakdown.reduce((s, b) => s + b.count, 0);
  if (newBreakdownTotal !== EXPECTED_TOTAL_AFTER) fail(`New breakdown sums to ${newBreakdownTotal}`);
  console.log('speciesBreakdown:', JSON.stringify(newBreakdown));
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('speciesBreakdown', ${JSON.stringify(newBreakdown)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;

  // --- 5. Timeline ---
  const ctxRows = await sql`SELECT value FROM screwworm_metadata WHERE key = 'internationalContext'`;
  if (ctxRows.length === 0) fail('internationalContext metadata row missing');
  const ctx = typeof ctxRows[0].value === 'string' ? JSON.parse(ctxRows[0].value) : ctxRows[0].value;

  const json = JSON.parse(readFileSync(JSON_PATH, 'utf-8'));

  // Guard the DB/fallback timeline drift that the Oct 6 sync repaired — if the DB has dates the
  // JSON lacks, writing the JSON-derived union back would silently drop them.
  const dbDates = new Set((ctx.timeline || []).map(e => e.date));
  const jsonDates = new Set(json.internationalContext.timeline.map(e => e.date));
  const dbOnly = [...dbDates].filter(d => !jsonDates.has(d));
  if (dbOnly.length > 0) fail(`DB timeline has dates absent from JSON (would be lost): ${JSON.stringify(dbOnly)}`);
  if ((ctx.timeline || []).length !== json.internationalContext.timeline.length) {
    fail(`Timeline length drift: DB ${(ctx.timeline || []).length} vs JSON ${json.internationalContext.timeline.length}`);
  }

  // The Sep 25 fly trap must stay a timeline note and must NOT be a case row. It is the whole
  // reason September reads 3 domestic / 4 total on the rollup export, and the reason the
  // case-level export's 72 rows are only 71 animal cases.
  const flyTrapNote = json.internationalContext.timeline.find(e => e.date === '2026-09-25' && /fly/i.test(e.event));
  if (!flyTrapNote) fail('Sep 25 Brewster fly-trap timeline note is missing');
  const flyTrapRow = await sql`SELECT id FROM screwworm_cases WHERE date = '2026-09-25'`;
  if (flyTrapRow.length > 0) {
    fail(`A case row exists for the Sep 25 fly trap (ids ${JSON.stringify(flyTrapRow.map(r => r.id))}) — it must stay a note only`);
  }
  console.log('✓ Sep 25 Brewster fly trap carried as a timeline note, not a case row');

  const mergedTimeline = mergeTimeline(json.internationalContext.timeline);
  console.log(`Timeline: ${json.internationalContext.timeline.length} -> ${mergedTimeline.length}`);
  ctx.timeline = mergedTimeline;

  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('internationalContext', ${JSON.stringify(ctx)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;

  // --- 6. State responses: add Arizona, refresh the stale New Mexico entry ---
  const srRows = await sql`SELECT value FROM screwworm_metadata WHERE key = 'stateResponses'`;
  if (srRows.length === 0) fail('stateResponses metadata row missing');
  const storedResponses = typeof srRows[0].value === 'string' ? JSON.parse(srRows[0].value) : srRows[0].value;
  if (JSON.stringify(storedResponses.map(r => r.state)) !== JSON.stringify(json.stateResponses.map(r => r.state))) {
    fail('stateResponses diverge between DB and fallback before this sync');
  }
  const texasResponse = storedResponses.find(r => r.state === 'Texas');
  const federalResponse = storedResponses.find(r => r.state === 'Federal (USDA/APHIS)');
  if (!texasResponse || !federalResponse) fail('Texas or Federal stateResponses entry missing');
  // Texas's zone list predates El Paso; add it rather than rewriting the entry.
  const texasActions = texasResponse.actions.map(a => (
    a.startsWith('Quarantine zones in') && !a.includes('El Paso')
      ? `${a}; infested zone across El Paso County (added Oct 27, 2026)`
      : a
  ));
  if (!texasActions.some(a => a.includes('El Paso'))) fail('Failed to record El Paso in the Texas response');
  // Order: Texas, New Mexico, Arizona (by date of first case), then Federal.
  const newResponses = [
    { ...texasResponse, actions: texasActions },
    NEW_MEXICO_RESPONSE,
    ARIZONA_RESPONSE,
    federalResponse,
  ];
  if (!newResponses.some(r => r.state === 'Arizona')) fail('Arizona response entry missing');
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('stateResponses', ${JSON.stringify(newResponses)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log(`✓ stateResponses: ${newResponses.map(r => r.state).join(', ')}`);

  // --- 7. Repair the missing quarantine zone (idempotent) ---
  const zoneBefore = await sql`SELECT id FROM screwworm_quarantine_zones WHERE name = ${MISSING_ZONE.name}`;
  if (zoneBefore.length > 0) {
    console.log(`Quarantine zone "${MISSING_ZONE.name}" already present — no repair needed`);
  } else {
    // Only repair it if the fallback really is the one carrying it, so this cannot invent a zone.
    const fallbackZone = json.quarantineZones.find(z => z.name === MISSING_ZONE.name);
    if (!fallbackZone) fail(`Fallback JSON has no "${MISSING_ZONE.name}" to restore from`);
    if (fallbackZone.center[0] !== MISSING_ZONE.centerLat || fallbackZone.center[1] !== MISSING_ZONE.centerLng
        || fallbackZone.radiusMiles !== MISSING_ZONE.radiusMiles
        || fallbackZone.established !== MISSING_ZONE.established
        || fallbackZone.active !== (MISSING_ZONE.status === 'active')) {
      fail(`Fallback zone "${MISSING_ZONE.name}" does not match MISSING_ZONE: ${JSON.stringify(fallbackZone)}`);
    }
    const restored = await sql`
      INSERT INTO screwworm_quarantine_zones (name, state, center_lat, center_lng, radius_miles, established_date, status)
      VALUES (${MISSING_ZONE.name}, ${MISSING_ZONE.state}, ${MISSING_ZONE.centerLat}, ${MISSING_ZONE.centerLng},
              ${MISSING_ZONE.radiusMiles}, ${MISSING_ZONE.established}, ${MISSING_ZONE.status})
      RETURNING id, name, state, established_date
    `;
    console.log('Repaired missing quarantine zone:', JSON.stringify(restored[0]));
  }

  // --- 8. Timestamps ---
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify(LAST_UPDATED)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastChecked', ${JSON.stringify(LAST_CHECKED)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log(`Updated timestamps to lastUpdated=${LAST_UPDATED}`);

  // --- 9. Mirror everything into the static fallback ---
  for (const NEW_CASE of NEW_CASES) {
    const at = json.confirmedCases.findIndex(c => c.id === NEW_CASE.id);
    if (at === -1) {
      json.confirmedCases.push({ ...NEW_CASE });
      console.log(`Fallback: added case #${NEW_CASE.id}`);
    } else {
      json.confirmedCases[at] = { ...NEW_CASE };
      console.log(`Fallback: refreshed case #${NEW_CASE.id}`);
    }
  }
  json.confirmedCases.sort((a, b) => (a.date === b.date ? a.id - b.id : a.date.localeCompare(b.date)));
  json.internationalContext.timeline = mergedTimeline;
  json.speciesBreakdown = newBreakdown;
  json.stateResponses = newResponses;
  json.lastUpdated = LAST_UPDATED;
  json.lastChecked = LAST_CHECKED;
  writeFileSync(JSON_PATH, `${JSON.stringify(json, null, 2)}\n`);
  console.log(`Wrote fallback: ${json.confirmedCases.length} cases, ${json.internationalContext.timeline.length} timeline entries`);

  // ================================ VERIFY ================================
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
    fail(`Mismatch! Expected ${EXPECTED_TOTAL_AFTER} / ${EXPECTED_ACTIVE_AFTER_COUNT} / ${EXPECTED_INACTIVE_AFTER}`);
  }
  console.log('✓ Counts match APHIS (71 animal cases = 70 domestic + 1 wildlife, 18 active, 53 inactive)');

  const activeRows = await sql`SELECT id, date, county, state, animal FROM screwworm_cases WHERE status = 'active' ORDER BY id`;
  if (JSON.stringify(activeRows.map(r => r.id)) !== JSON.stringify(EXPECTED_ACTIVE_AFTER)) {
    fail(`Active ids ${JSON.stringify(activeRows.map(r => r.id))} != expected ${JSON.stringify(EXPECTED_ACTIVE_AFTER)}`);
  }

  const badStatus = await sql`SELECT DISTINCT status FROM screwworm_cases WHERE status NOT IN ('active', 'inactive')`;
  if (badStatus.length > 0) fail(`Unexpected status values: ${JSON.stringify(badStatus)}`);

  // Per-month totals, plus the domestic/wildlife split the rollup CSV's columns describe.
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
    if (!want) fail(`Unexpected month ${row.month} in tracker but not in APHIS truth table`);
    if (Number(row.total) !== want.total || Number(row.domestic) !== want.domestic
        || Number(row.active) !== want.active || Number(row.inactive) !== want.inactive) {
      fail(`${row.month}: tracker ${row.total}/${row.domestic}/${row.active}/${row.inactive} != `
        + `APHIS ${want.total}/${want.domestic}/${want.active}/${want.inactive} (total/domestic/active/inactive)`);
    }
    const wantDom = APHIS_DOMESTIC_ACTIVE_BY_MONTH[row.month];
    if (Number(row.domactive) !== wantDom.active || Number(row.dominactive) !== wantDom.inactive) {
      fail(`${row.month} domestic-only split: tracker ${row.domactive} active / ${row.dominactive} inactive `
        + `!= CSV ${wantDom.active} / ${wantDom.inactive}`);
    }
    console.log(`✓ ${row.month}: ${row.total} total (${row.domestic} domestic), ${row.active} active, `
      + `${row.inactive} inactive; domestic-only ${row.domactive} active / ${row.dominactive} inactive`);
  }
  if (byMonth.length !== Object.keys(APHIS_BY_MONTH).length) fail('Month count mismatch vs APHIS truth table');

  const domesticTotal = byMonth.reduce((s, r) => s + Number(r.domestic), 0);
  if (domesticTotal !== EXPECTED_DOMESTIC_AFTER || domesticTotal + 1 !== EXPECTED_TOTAL_AFTER) {
    fail(`Domestic total is ${domesticTotal}, expected ${EXPECTED_DOMESTIC_AFTER} (+1 wildlife = ${EXPECTED_TOTAL_AFTER})`);
  }
  console.log(`✓ Domestic/wildlife split: ${domesticTotal} domestic + 1 wildlife = ${EXPECTED_TOTAL_AFTER}`);

  const geo = await sql`
    SELECT COUNT(DISTINCT county || ', ' || state) AS "counties", COUNT(DISTINCT state) AS "states"
    FROM screwworm_cases
  `;
  if (Number(geo[0].counties) !== EXPECTED_COUNTIES || Number(geo[0].states) !== EXPECTED_STATES) {
    fail(`Geography ${geo[0].counties} counties / ${geo[0].states} states != ${EXPECTED_COUNTIES} / ${EXPECTED_STATES}`);
  }
  console.log(`✓ Geography: ${geo[0].counties} counties across ${geo[0].states} states`);

  const stateList = (await sql`SELECT DISTINCT state FROM screwworm_cases ORDER BY state`).map(r => r.state);
  if (JSON.stringify(stateList) !== JSON.stringify(EXPECTED_STATE_LIST)) {
    fail(`States ${JSON.stringify(stateList)} != ${JSON.stringify(EXPECTED_STATE_LIST)}`);
  }
  console.log(`✓ States: ${stateList.join(', ')} — Arizona is the third`);

  const txCounties = (await sql`SELECT DISTINCT county FROM screwworm_cases WHERE state = 'TX' ORDER BY county`).map(r => r.county);
  if (txCounties.length !== EXPECTED_TX_COUNTY_COUNT || !txCounties.includes('El Paso')) {
    fail(`Texas has ${txCounties.length} counties, expected ${EXPECTED_TX_COUNTY_COUNT} including El Paso: ${JSON.stringify(txCounties)}`);
  }
  console.log(`✓ Texas counties: ${txCounties.length} (El Paso is the 20th)`);

  const nmCounties = (await sql`SELECT DISTINCT county FROM screwworm_cases WHERE state = 'NM' ORDER BY county`).map(r => r.county);
  if (JSON.stringify(nmCounties) !== JSON.stringify(EXPECTED_NM_COUNTY_LIST)) {
    fail(`New Mexico counties ${JSON.stringify(nmCounties)} != ${JSON.stringify(EXPECTED_NM_COUNTY_LIST)}`);
  }
  console.log(`✓ New Mexico counties: ${nmCounties.join(', ')} (unchanged this sync)`);

  const azCounties = (await sql`SELECT DISTINCT county FROM screwworm_cases WHERE state = 'AZ' ORDER BY county`).map(r => r.county);
  if (JSON.stringify(azCounties) !== JSON.stringify(EXPECTED_AZ_COUNTY_LIST)) {
    fail(`Arizona counties ${JSON.stringify(azCounties)} != ${JSON.stringify(EXPECTED_AZ_COUNTY_LIST)}`);
  }
  console.log(`✓ Arizona counties: ${azCounties.join(', ')}`);

  if (txCounties.length + nmCounties.length + azCounties.length !== EXPECTED_COUNTIES) {
    fail(`${txCounties.length} TX + ${nmCounties.length} NM + ${azCounties.length} AZ != ${EXPECTED_COUNTIES} counties`);
  }
  console.log(`✓ ${txCounties.length} TX + ${nmCounties.length} NM + ${azCounties.length} AZ = ${EXPECTED_COUNTIES} counties`);

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

  // New Mexico must still lead Texas on active cases — a claim written into the timeline entry.
  if (!(EXPECTED_NM.active > EXPECTED_TX.active)) {
    fail(`Timeline claims New Mexico leads Texas on active cases, but NM ${EXPECTED_NM.active} !> TX ${EXPECTED_TX.active}`);
  }
  console.log(`✓ New Mexico ${EXPECTED_NM.active} active > Texas ${EXPECTED_TX.active} active`);

  // Case 71 claims Dona Ana is the outbreak's largest ACTIVE cluster, outright. That is NOT the
  // largest cluster by TOTAL cases — Crockett County, TX still holds 13, all long closed — so the
  // two measures are asserted separately and the notes state both.
  const byActive = await sql`
    SELECT county, state, COUNT(*) FILTER (WHERE status = 'active') AS "a" FROM screwworm_cases
    GROUP BY 1, 2 ORDER BY "a" DESC, county
  `;
  if (`${byActive[0].county}, ${byActive[0].state}` !== 'Dona Ana, NM' || Number(byActive[0].a) !== 4) {
    fail(`Expected Dona Ana, NM to lead on active cases with 4, got ${byActive[0].county}, `
      + `${byActive[0].state} with ${byActive[0].a}`);
  }
  if (Number(byActive[1].a) >= Number(byActive[0].a)) {
    fail(`Dona Ana does not lead active cases outright — ${byActive[1].county}, ${byActive[1].state} also has `
      + `${byActive[1].a}, so "largest active cluster" in case 71's notes is wrong`);
  }
  console.log(`✓ Dona Ana, NM leads active cases outright with ${byActive[0].a} `
    + `(next is ${byActive[1].county}, ${byActive[1].state} with ${byActive[1].a})`);

  const byTotal = await sql`
    SELECT county, state, COUNT(*) AS "n" FROM screwworm_cases GROUP BY 1, 2 ORDER BY "n" DESC, county
  `;
  if (`${byTotal[0].county}, ${byTotal[0].state}` !== 'Crockett, TX' || Number(byTotal[0].n) !== 13) {
    fail(`Case 71's notes name Crockett, TX the largest cluster by total cases at 13, but the data says `
      + `${byTotal[0].county}, ${byTotal[0].state} with ${byTotal[0].n}`);
  }
  const crockettActive = Number((await sql`
    SELECT COUNT(*) FILTER (WHERE status = 'active') AS "a" FROM screwworm_cases
    WHERE county = 'Crockett' AND state = 'TX'
  `)[0].a);
  if (crockettActive !== 0) {
    fail(`Case 71's notes say Crockett's 13 cases are all closed, but ${crockettActive} are active`);
  }
  console.log(`✓ Crockett, TX is still the largest cluster by total cases (${byTotal[0].n}, all inactive)`);

  // Case 72 claims Grant is joint-largest WITHIN NEW MEXICO alongside Dona Ana, at 4 each.
  const nmByTotal = await sql`
    SELECT county, COUNT(*) AS "n" FROM screwworm_cases WHERE state = 'NM' GROUP BY 1 ORDER BY "n" DESC, county
  `;
  const nmTop = nmByTotal.filter(r => Number(r.n) === Number(nmByTotal[0].n)).map(r => r.county);
  if (Number(nmByTotal[0].n) !== 4 || JSON.stringify(nmTop) !== JSON.stringify(['Dona Ana', 'Grant'])) {
    fail(`Expected Dona Ana and Grant joint-largest in New Mexico at 4 each, got ${JSON.stringify(nmByTotal)}`);
  }
  console.log(`✓ Dona Ana and Grant are joint-largest in New Mexico at ${nmByTotal[0].n} cases each`);

  // Exactly one wildlife case, it is still the elk, and it is still inactive.
  const cervids = await sql`SELECT id, animal, county, state, status FROM screwworm_cases WHERE species = 'Cervid' ORDER BY id`;
  if (cervids.length !== 1 || cervids[0].id !== 58 || cervids[0].animal !== 'Elk' || cervids[0].status !== 'inactive') {
    fail(`Expected exactly one Cervid row (#58 Elk, inactive), got ${JSON.stringify(cervids)}`);
  }
  console.log(`✓ Wildlife: 1 Cervid row — #58 Elk, ${cervids[0].county} County, ${cervids[0].state}, inactive`);

  // Exactly one feline case, it is the Grant County cat, and it is active.
  const felines = await sql`SELECT id, animal, county, state, status FROM screwworm_cases WHERE species = 'Feline' ORDER BY id`;
  if (felines.length !== 1 || felines[0].id !== 72 || felines[0].animal !== 'Cat'
      || felines[0].county !== 'Grant' || felines[0].status !== 'active') {
    fail(`Expected exactly one Feline row (#72 Cat, Grant NM, active), got ${JSON.stringify(felines)}`);
  }
  console.log('✓ Feline: 1 row — #72 Cat, Grant County, NM, active (the outbreak\'s first cat)');

  // Every active case must be a domestic animal, which is what makes the rollup CSV's
  // domestic-only active column of 18 equal the tracker's 18 actives.
  const activeWildlife = await sql`SELECT id FROM screwworm_cases WHERE status = 'active' AND species = 'Cervid'`;
  if (activeWildlife.length > 0) fail(`Wildlife case still active: ${JSON.stringify(activeWildlife)}`);
  console.log('✓ All 18 active cases are domestic animals (matches "Active Cases - Domestic" = 18)');

  const nonOctActive = await sql`SELECT id, date FROM screwworm_cases WHERE status = 'active' AND to_char(date, 'YYYY-MM') <> '2026-10'`;
  if (nonOctActive.length > 0) fail(`Active case outside October: ${JSON.stringify(nonOctActive)}`);
  const activeSplit = await sql`SELECT state, COUNT(*) AS "n" FROM screwworm_cases WHERE status = 'active' GROUP BY 1 ORDER BY 1`;
  const splitMap = Object.fromEntries(activeSplit.map(r => [r.state, Number(r.n)]));
  if (JSON.stringify(splitMap) !== JSON.stringify(EXPECTED_ACTIVE_SPLIT)
      && JSON.stringify(splitMap) !== JSON.stringify({ AZ: 1, NM: 10, TX: 7 })) {
    fail(`Active split ${JSON.stringify(splitMap)} != ${JSON.stringify(EXPECTED_ACTIVE_SPLIT)}`);
  }
  console.log(`✓ All 18 actives are October detections, split ${JSON.stringify(splitMap)}`);

  // The dog ordinals written into the notes must match the data: cases 68/69/70/71 are the
  // 6th/7th/8th/9th canine detections in confirmed-date then APHIS-reference order.
  const dogRows = await sql`SELECT id, date FROM screwworm_cases WHERE species = 'Canine' ORDER BY date, id`;
  const dogOrder = dogRows.map(r => r.id);
  for (const [id, ordinal] of [[68, 6], [69, 7], [70, 8], [71, 9]]) {
    if (dogOrder.indexOf(id) + 1 !== ordinal) {
      fail(`Case #${id} is dog number ${dogOrder.indexOf(id) + 1}, but its notes claim ${ordinal} `
        + `(dog order: ${JSON.stringify(dogOrder)})`);
    }
  }
  if (dogOrder.length !== APHIS_BY_SPECIES.Canine) fail(`${dogOrder.length} dogs, expected ${APHIS_BY_SPECIES.Canine}`);
  console.log(`✓ Dog ordinals check out: ${dogOrder.length} dogs, cases 68/69/70/71 are the 6th/7th/8th/9th`);

  // The county ordinals must match too: El Paso 26th, Cochise 27th, by first-case date.
  const countyFirsts = await sql`
    SELECT county, state, MIN(date) AS "first", MIN(id) AS "firstid" FROM screwworm_cases
    GROUP BY 1, 2 ORDER BY MIN(date), MIN(id)
  `;
  const countyOrder = countyFirsts.map(r => `${r.county}, ${r.state}`);
  for (const [name, ordinal] of [['El Paso, TX', 26], ['Cochise, AZ', 27]]) {
    if (countyOrder.indexOf(name) + 1 !== ordinal) {
      fail(`${name} is county number ${countyOrder.indexOf(name) + 1}, but the notes claim ${ordinal}`);
    }
    console.log(`✓ ${name} is the ${ordinal}th county of the outbreak`);
  }
  if (countyOrder.length !== EXPECTED_COUNTIES) fail(`${countyOrder.length} counties in the ordering`);

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

  // Fallback JSON must agree with the DB on ids, status, and breakdown.
  const dbRows = await sql`SELECT id, status FROM screwworm_cases ORDER BY id`;
  const dbIds = dbRows.map(r => r.id);
  const jsonIds = [...json.confirmedCases.map(c => c.id)].sort((a, b) => a - b);
  if (JSON.stringify(dbIds) !== JSON.stringify(jsonIds)) fail('Fallback JSON ids diverge from DB ids');
  const statusDrift = dbRows.filter(r => json.confirmedCases.find(c => c.id === r.id).status !== r.status);
  if (statusDrift.length > 0) fail(`Fallback JSON status diverges from DB for ids: ${JSON.stringify(statusDrift.map(r => r.id))}`);
  // Compare field-by-field: the metadata column is jsonb, which reorders object keys on write,
  // so a raw JSON.stringify comparison fails on key order even when the values agree.
  if (json.speciesBreakdown.length !== stored.length) {
    fail(`Fallback breakdown has ${json.speciesBreakdown.length} rows, DB has ${stored.length}`);
  }
  for (const entry of json.speciesBreakdown) {
    const dbEntry = stored.find(s => s.species === entry.species);
    if (!dbEntry || dbEntry.count !== entry.count || dbEntry.percentage !== entry.percentage) {
      fail(`Fallback breakdown diverges from DB for "${entry.species}": ${JSON.stringify(entry)} vs ${JSON.stringify(dbEntry)}`);
    }
  }
  // stateResponses parity, including the new Arizona entry.
  const srAfter = await sql`SELECT value FROM screwworm_metadata WHERE key = 'stateResponses'`;
  const srStored = typeof srAfter[0].value === 'string' ? JSON.parse(srAfter[0].value) : srAfter[0].value;
  if (JSON.stringify(srStored.map(r => r.state)) !== JSON.stringify(json.stateResponses.map(r => r.state))) {
    fail('stateResponses states diverge between DB and fallback');
  }
  for (const entry of json.stateResponses) {
    const dbEntry = srStored.find(r => r.state === entry.state);
    if (!dbEntry || JSON.stringify(dbEntry.actions) !== JSON.stringify(entry.actions)) {
      fail(`stateResponses actions diverge for "${entry.state}"`);
    }
  }
  const azEntry = json.stateResponses.find(r => r.state === 'Arizona');
  if (!azEntry || !azEntry.actions.some(a => a.includes('20-km'))) {
    fail('Arizona stateResponses entry missing or does not mention the 20-km infested zone');
  }
  console.log(`✓ stateResponses in parity across DB and fallback: ${srStored.map(r => r.state).join(', ')}`);

  // Every new case's own fields must match in both stores.
  for (const NEW_CASE of NEW_CASES) {
    const dbCase = (await sql`SELECT * FROM screwworm_cases WHERE id = ${NEW_CASE.id}`)[0];
    const jsonCase = json.confirmedCases.find(c => c.id === NEW_CASE.id);
    const dbDate = new Date(dbCase.date).toISOString().slice(0, 10);
    for (const [field, want] of Object.entries(NEW_CASE)) {
      const got = field === 'date' ? dbDate : dbCase[field];
      if (String(got) !== String(want)) {
        fail(`DB case #${NEW_CASE.id}.${field} = ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
      }
      if (String(jsonCase[field]) !== String(want)) {
        fail(`Fallback case #${NEW_CASE.id}.${field} = ${JSON.stringify(jsonCase[field])}, expected ${JSON.stringify(want)}`);
      }
    }
    console.log(`✓ Case #${NEW_CASE.id} field-for-field identical in DB and fallback`);
  }

  if (json.lastUpdated !== LAST_UPDATED) fail(`Fallback lastUpdated is ${json.lastUpdated}, expected ${LAST_UPDATED}`);
  const dbLastUpdated = (await sql`SELECT value FROM screwworm_metadata WHERE key = 'lastUpdated'`)[0].value;
  const dbLastUpdatedStr = typeof dbLastUpdated === 'string' ? dbLastUpdated.replace(/^"|"$/g, '') : dbLastUpdated;
  if (dbLastUpdatedStr !== LAST_UPDATED) fail(`DB lastUpdated is ${JSON.stringify(dbLastUpdatedStr)}, expected ${LAST_UPDATED}`);
  console.log(`✓ lastUpdated = ${LAST_UPDATED} in both DB and fallback`);
  console.log(`✓ Fallback JSON in parity with DB (${jsonIds.length} cases, all statuses match, ${mergedTimeline.length} timeline entries)`);

  // Each new pin must sit inside its county's bounding box and must not collide with another.
  for (const NEW_CASE of NEW_CASES) {
    const box = COUNTY_BOX[NEW_CASE.id];
    const row = (await sql`SELECT lat, lng FROM screwworm_cases WHERE id = ${NEW_CASE.id}`)[0];
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    if (lat < box.latMin || lat > box.latMax || lng < box.lngMin || lng > box.lngMax) {
      fail(`Case #${NEW_CASE.id} coordinates (${lat}, ${lng}) fall outside ${box.name} ${JSON.stringify(box)}`);
    }
    const collide = await sql`
      SELECT id, county, state FROM screwworm_cases WHERE id <> ${NEW_CASE.id} AND lat = ${row.lat} AND lng = ${row.lng}
    `;
    if (collide.length > 0) fail(`Case #${NEW_CASE.id} shares coordinates with ${JSON.stringify(collide)} — pins would overlap`);
    console.log(`✓ Case #${NEW_CASE.id} (${lat}, ${lng}) sits inside ${box.name}, no overlapping pin`);
  }
  // One pre-existing overlap: cases 12 and 42 are both Sutton County, TX and both sit exactly on
  // the county seat (Sonora) rather than being offset the way later same-county pairs are, so
  // their two pins stack. Both are inactive. Re-offsetting historical cases is out of scope for
  // this sync, so the pair is pinned as a known exception — any OTHER duplicate still fails.
  const KNOWN_COINCIDENT_PINS = [[12, 42]];
  const dupCoords = await sql`
    SELECT lat, lng, array_agg(id ORDER BY id) AS "ids" FROM screwworm_cases
    GROUP BY 1, 2 HAVING COUNT(*) > 1
  `;
  const unexpectedDups = dupCoords.filter(d => !KNOWN_COINCIDENT_PINS
    .some(known => JSON.stringify(known) === JSON.stringify(d.ids.map(Number))));
  if (unexpectedDups.length > 0) {
    fail(`Unexpected duplicate coordinates: ${JSON.stringify(unexpectedDups)}`);
  }
  for (const known of KNOWN_COINCIDENT_PINS) {
    if (!dupCoords.some(d => JSON.stringify(d.ids.map(Number)) === JSON.stringify(known))) {
      fail(`Known coincident pin pair ${JSON.stringify(known)} no longer shares coordinates — `
        + 'it was fixed elsewhere and should be removed from KNOWN_COINCIDENT_PINS');
    }
  }
  console.log(`✓ All ${EXPECTED_TOTAL_AFTER} pins distinct except the known pre-existing Sutton `
    + `County pair ${JSON.stringify(KNOWN_COINCIDENT_PINS[0])} (both inactive)`);

  // The four pre-existing off-by-one dates are pinned, not fixed, by this sync.
  for (const drift of KNOWN_DATE_DRIFT) {
    const rows = await sql`
      SELECT id, to_char(date, 'YYYY-MM-DD') AS "d" FROM screwworm_cases
      WHERE county = ${drift.county} AND state = ${drift.state} AND species = ${drift.species}
        AND to_char(date, 'YYYY-MM-DD') = ${drift.tracker}
    `;
    if (rows.length !== 1) {
      fail(`Expected exactly one ${drift.county} ${drift.species} row on ${drift.tracker} (known drift vs `
        + `APHIS ${drift.aphis}), got ${JSON.stringify(rows)} — the drift set has changed and needs re-reviewing`);
    }
    if (drift.tracker.slice(0, 7) !== drift.aphis.slice(0, 7)) {
      fail(`Known drift for ${drift.county} crosses a month boundary, so the monthly totals above are wrong`);
    }
  }
  console.log(`✓ All ${KNOWN_DATE_DRIFT.length} known pre-existing date drifts are unchanged and stay inside their month`);

  // Quarantine zones and trade impacts are untouched by this sync.
  const dbZones = await sql`
    SELECT name, state, center_lat, center_lng, radius_miles,
           to_char(established_date, 'YYYY-MM-DD') AS "established", status
    FROM screwworm_quarantine_zones ORDER BY name
  `;
  if (dbZones.length !== json.quarantineZones.length) {
    fail(`quarantineZones drift: DB ${dbZones.length} vs fallback ${json.quarantineZones.length}`);
  }
  for (const want of [...json.quarantineZones].sort((a, b) => a.name.localeCompare(b.name))) {
    const got = dbZones.find(z => z.name === want.name);
    if (!got) fail(`quarantineZones: DB is missing "${want.name}"`);
    if (got.state !== want.state || Number(got.center_lat) !== want.center[0]
        || Number(got.center_lng) !== want.center[1] || Number(got.radius_miles) !== want.radiusMiles
        || got.established !== want.established || (got.status === 'active') !== want.active) {
      fail(`quarantineZones: "${want.name}" differs between DB ${JSON.stringify(got)} and fallback ${JSON.stringify(want)}`);
    }
  }
  const zoneCount = dbZones.length;
  if (zoneCount !== 10) fail(`Expected 10 quarantine zones after the repair, got ${zoneCount}`);
  const tradeCount = Number((await sql`SELECT COUNT(*) AS "n" FROM screwworm_trade_impacts`)[0].n);
  if (tradeCount !== json.tradeImpacts.length) {
    fail(`tradeImpacts drift: DB ${tradeCount} vs fallback ${json.tradeImpacts.length}`);
  }
  console.log(`✓ quarantineZones (${zoneCount}) and tradeImpacts (${tradeCount}) untouched and in parity`);

  // Every species present in the data must be renderable. SPECIES_ORDER in CasesByDay.jsx
  // FILTERS the stacked bars, so a missing key silently drops cases from that chart — which is
  // exactly the risk the new Feline species introduced.
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
    // Each label must resolve to its own CSS class in SpeciesBreakdown, not fall through to canine.
    const cls = species.toLowerCase() === 'bovine' ? 'cattle' : species.toLowerCase();
    if (species !== 'Canine' && !breakdownJsx.includes(`return '${cls}'`)) {
      fail(`SpeciesBreakdown fillClass has no branch for "${species}" — it would render in the canine colour`);
    }
    if (species !== 'Canine' && !indexCss.includes(`.species-bar-fill.${cls} {`)) {
      fail(`index.css has no .species-bar-fill.${cls} rule for "${species}"`);
    }
  }
  // The cron normaliser must map APHIS's own spelling of every species to the tracker's key.
  for (const [key, aphisLabel] of Object.entries(APHIS_SPECIES_LABEL)) {
    if (!(key in speciesCounts)) continue;
    const token = aphisLabel.toLowerCase().replace(/^domestic /, '').replace(/s$/, '');
    if (!cron.includes(`'${key}'`)) {
      fail(`api/cron/check-usda.js cannot produce species "${key}" — the next cron run would store APHIS's raw "${aphisLabel}"`);
    }
    if (!new RegExp(`${token}`).test(cron)) {
      fail(`api/cron/check-usda.js does not recognise APHIS's label "${aphisLabel}" for ${key}`);
    }
  }
  console.log(`✓ All ${Object.keys(speciesCounts).length} species are wired into the chart, the API labels, the `
    + 'breakdown classes, the CSS, and the cron normaliser');

  console.log('\nDone!');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
