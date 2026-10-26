import { neon } from '@neondatabase/serverless';
import { readFileSync, writeFileSync } from 'fs';

const envFile = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}

const sql = neon(process.env.DATABASE_URL);

// APHIS sync Oct 26, 2026 — FOUR new domestic cases in two brand-new counties, one in each
// state, plus one status transition. 61 -> 65 animal cases, 9 -> 12 active, 52 -> 53 inactive,
// 22 -> 24 counties. Case 53 (Brewster dog) goes active -> inactive.
//
// APHIS public Tableau export fetched this sync (publicdashboards.dl.usda.gov/t/MRP_PUB/
// views/NewWorldScrewwormPublicReporting_17805168329840/SummaryDashboard.csv):
//     July 2026:       14 / 14 total,  0 active, 14 inactive
//     August 2026:      4 /  4 total,  0 active,  4 inactive
//     September 2026:   3 /  4 total,  0 active,  3 inactive
//     October 2026:    13 / 14 total, 12 active,  1 inactive   <-- was 9 / 10, 9 active / 0 inactive
// (columns are "Total Cases - Domestic" / "Total Cases"; the active/inactive measures are
// "Active Cases - Domestic" / "Inactive Cases - Domestic", i.e. DOMESTIC-ONLY on both.)
//
// CAVEAT on the export (carried forward from every sync since Sep 30): the CSV's month window
// has scrolled forward and June 2026 (30 total / 0 active / 30 inactive) is no longer emitted.
// June is asserted below from the tracker's own previously-verified state, not from this fetch.
//   Domestic: 30 + 14 + 4 + 3 + 13 = 64, plus the 1 wildlife elk = 65 animal cases.
//   All 12 actives are domestic and sit in October => 53 inactive.
//
// THE CSV CLOSES EXACTLY ON THIS SYNC, on all four measures, which is unusually strong
// confirmation for a sync whose per-case detail is dashboard-only:
//   - Oct domestic 9 -> 13. The tracker holds 9 domestic October cases, so the four new cases
//     below take it to 13 == the export's domestic column.
//   - Oct Total Cases 14 == those 13 domestic + the Pecos elk, which is what the tracker holds.
//   - Active Cases - Domestic 12 == 9 current actives + 4 new - 1 (case 53 going inactive).
//     This is what independently confirms the status transition: there is no other way to land
//     on 12 while adding four active cases.
//   - Inactive Cases - Domestic 0 -> 1 == case 53 and nothing else. October's other inactive
//     row is the elk, which is wildlife and so is excluded from the domestic column. This is
//     the second sync to confirm the domestic/wildlife reading of these columns established
//     on Oct 23.
// September's 3 vs 4 is unchanged and is still the Sep 25 Brewster fly trap, which is not a
// domestic animal case. It stays a timeline note, asserted below.
//
// SOURCING — all four new cases are corroborated by TWO independent secondary sources this
// sync, which is better than the Oct 23 sync managed:
//   1. GenomicEpi's per-case line list (genomicepi.com/outbreaks/new-world-screwworm/) is LIVE
//      again after being stale through the Oct 22 and Oct 23 syncs. It now lists all four
//      cases at exactly the dates, counties and species the brief gives: Oct 24 Dona Ana NM
//      Cattle, Oct 24 Dona Ana NM Sheep, Oct 23 Hudspeth TX Cattle, Oct 23 Hudspeth TX Cattle.
//      Its species totals (31 cattle / 17 sheep / 7 goats / 5 dogs / 4 horses / 1 elk) and its
//      Texas total (57) both match what this script asserts, derived independently.
//   2. Oklahoma Farm Report, Oct 25 ("An October Surprise — New World Screwworm Cases Jump to
//      12 Active Cases"): reports "two cases ... on Friday in Hudspeth County" (Friday was
//      Oct 23), 12 active cases, and 14 October cases. The 12-active figure is dated Oct 25,
//      so it already reflects case 53 being inactive.
// Still NOT corroborated: no USDA, TAHC, NMDA or New Mexico Livestock Board release names
// either county. The Dona Ana pair in particular appears in no news report I could find —
// only in the GenomicEpi line list. The APHIS dashboard's per-case detail remains
// machine-unreadable (SummaryDashboard.csv is the only sheet that exports; CaseDetail and
// MapDashboard 404, the vizql bootstrap endpoint still returns 410), so per-case attribution
// could not be re-derived from the primary source. Re-verify both counties next sync.
//
// ===================================================================================
// CORRECTION 1 — COUNTY TOTAL IS 24, NOT 23. The brief says the outbreak now spans "23
// counties" and that is arithmetically impossible: the tracker holds 22 distinct counties and
// BOTH new counties are new (no Hudspeth or Dona Ana row exists, verified before writing), so
// 22 + 2 = 24.
//
// The brief inherited the error from GenomicEpi, whose summary widgets have not ingested Dona
// Ana even though its own line list has. That page is internally inconsistent right now:
//     header / county summary:  23 counties, New Mexico 6 cases, Texas 57 cases
//     its own line list:        24 distinct counties (19 TX + 5 NM), New Mexico 8 cases
// and 57 + 6 = 63, which does not reach its own stated total of 65. The two missing cases are
// exactly the two Dona Ana rows. Its County-burden section lists only Grant, Hidalgo, Lea and
// Otero for New Mexico. So the line list is current and the summary is one county behind;
// 65 - 57 = 8 New Mexico cases, which is what the line list shows and what this sync writes.
// The tracker therefore goes to 24 counties and New Mexico to 8 cases, and the assertions
// below enforce that against the row data rather than against the brief.
//
// CORRECTION 2 — COUNTY ORDINALS. The brief calls Hudspeth "#22 for Texas". Texas holds 18
// counties before this sync (Brewster, Crockett, Edwards, Gillespie, Jeff Davis, Jim Hogg,
// La Salle, Medina, Pecos, Presidio, Schleicher, Starr, Sutton, Terrell, Tom Green, Uvalde,
// Val Verde, Zavala), so Hudspeth is Texas's NINETEENTH county. The brief's "#23 overall" for
// Hudspeth is right. Dona Ana is then the 24th county overall and New Mexico's fifth, which
// the brief gets right, and its two cases are New Mexico's seventh and eighth.
//
// NOTE for the next sync — a stale number is already in the data: the Oct 23 timeline entry
// for case 61 says "Texas rises to 55 cases across 19 counties". The 55 is right but Texas had
// 18 counties at that point, not 19. It is historical prose in a shipped timeline entry and
// rewriting it is out of scope here, but it is wrong, and it is probably where the brief's
// Texas county ordinal drifted from. Do not read Texas county counts off that entry.
//
// CORRECTION 3 — HUDSPETH COORDINATES ARE NOT THE COUNTY SEAT. The brief labels
// (31.9382, -105.1916) the "Hudspeth County TX seat: Dell City area". Those coordinates are
// Dell City, and Dell City is NOT the county seat — Sierra Blanca is (Fort Hancock is the
// largest community). Dell City is the irrigated farming and livestock valley in the north of
// the county and hosts the Dell City Junior Livestock Show, so it is a defensible placement
// for a livestock detection and the coordinates are used as given. But the notes below
// describe it accurately as the Dell City area rather than repeating the brief's claim that it
// is the seat, which would have put a false fact on the case record. Las Cruces
// (32.3199, -106.7637) IS the Dona Ana County seat, so that guidance is used as written and
// labelled as the seat.
// ===================================================================================
//
// NO CODE CHANGES this sync: the new cases are 3 Bovine + 1 Ovine, both species already wired
// into CasesByDay SPECIES_ORDER/SPECIES_COLORS, api/cases.js SPECIES_LABELS and the CSS bar
// colours. The species-wiring assertions at the end of this script run anyway.

const JSON_PATH = '/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/src/data/cases.json';

const NEW_CASES = [
  {
    id: 63,
    date: '2026-10-23',
    species: 'Bovine',
    animal: 'Cattle',
    county: 'Hudspeth',
    state: 'TX',
    lat: 31.9382,
    lng: -105.1916,
    status: 'active',
    notes: 'First Hudspeth County case and the twenty-third county of the US outbreak; Texas\'s '
      + 'nineteenth affected county, in the far-west corner of the state where Hudspeth runs '
      + 'from the Rio Grande and the Mexican border north to the New Mexico state line; the '
      + 'county had declared a local state of disaster over the screwworm threat in June but '
      + 'had no confirmed case of its own until now; domestic cattle; one of two Hudspeth cases '
      + 'confirmed the same day; APHIS reports location at county level, so the coordinates are '
      + 'the Dell City farming valley in the north of the county (the county seat is Sierra '
      + 'Blanca); confirmed per APHIS dashboard Oct 23',
  },
  {
    id: 64,
    date: '2026-10-23',
    species: 'Bovine',
    animal: 'Cattle',
    county: 'Hudspeth',
    state: 'TX',
    lat: 31.9268,
    lng: -105.2074,
    status: 'active',
    notes: 'Second Hudspeth County case, confirmed the same day as the first — a same-day '
      + 'cluster in a county with no prior detection, which is how the Grant County, NM and '
      + 'Val Verde County, TX clusters also opened; domestic cattle; APHIS reports location at '
      + 'county level, so the coordinates are offset slightly from the first Hudspeth case in '
      + 'the Dell City farming valley so the two pins do not render on top of each other; '
      + 'confirmed per APHIS dashboard Oct 23',
  },
  {
    id: 65,
    date: '2026-10-24',
    species: 'Bovine',
    animal: 'Cattle',
    county: 'Dona Ana',
    state: 'NM',
    lat: 32.3199,
    lng: -106.7637,
    status: 'active',
    notes: 'First Dona Ana County case and the twenty-fourth county of the US outbreak; New '
      + 'Mexico\'s fifth affected county and seventh case, extending the state\'s cluster east '
      + 'from Grant and Hidalgo into the Rio Grande valley above El Paso; Dona Ana holds the '
      + 'Santa Teresa port of entry, the border crossing officials had been preparing to reopen '
      + 'to Mexican livestock imports; domestic cattle; APHIS reports location at county level, '
      + 'so the coordinates are the county seat (Las Cruces); confirmed per APHIS dashboard '
      + 'Oct 24',
  },
  {
    id: 66,
    date: '2026-10-24',
    species: 'Ovine',
    animal: 'Sheep',
    county: 'Dona Ana',
    state: 'NM',
    lat: 32.3071,
    lng: -106.7792,
    status: 'active',
    notes: 'Second Dona Ana County case and the FIRST ovine (sheep) detection in New Mexico — '
      + 'every one of the state\'s first seven cases was cattle, a horse or a dog, so this is '
      + 'the outbreak\'s seventeenth sheep case but New Mexico\'s first; New Mexico\'s eighth '
      + 'case; domestic animal, confirmed the same day as the Dona Ana cattle case; APHIS '
      + 'reports location at county level, so the coordinates are offset slightly from the '
      + 'first Dona Ana case near the county seat (Las Cruces) so the two pins do not render on '
      + 'top of each other; confirmed per APHIS dashboard Oct 24',
  },
];

// Case 53 is reclassified. The CSV's "Inactive Cases - Domestic" for October moves 0 -> 1 and
// its domestic active column lands on 12 only with this case out of active, so the transition
// is confirmed by the primary source even though no release describes it.
const TO_INACTIVE = [
  {
    id: 53,
    date: '2026-10-02',
    county: 'Brewster',
    state: 'TX',
    animal: 'Dog',
    species: 'Canine',
  },
];

const EXPECTED_ACTIVE_BEFORE = [53, 54, 55, 56, 57, 59, 60, 61, 62];
const EXPECTED_ACTIVE_AFTER = [54, 55, 56, 57, 59, 60, 61, 62, 63, 64, 65, 66];

const EXPECTED_TOTAL_BEFORE = 61;
const EXPECTED_ACTIVE_BEFORE_COUNT = 9;
const EXPECTED_TOTAL_AFTER = 65;
const EXPECTED_ACTIVE_AFTER_COUNT = 12;
const EXPECTED_INACTIVE_AFTER = 53;

// Post-update per-month truth. July/Aug/Sept/Oct from this sync's CSV fetch;
// June carried forward (see CAVEAT above). `total` counts every animal case the tracker
// holds for the month; `domestic` is what the CSV's domestic columns cover.
const APHIS_BY_MONTH = {
  '2026-06': { total: 30, domestic: 30, active: 0, inactive: 30 },
  '2026-07': { total: 14, domestic: 14, active: 0, inactive: 14 },
  '2026-08': { total: 4, domestic: 4, active: 0, inactive: 4 },
  '2026-09': { total: 3, domestic: 3, active: 0, inactive: 3 },
  '2026-10': { total: 14, domestic: 13, active: 12, inactive: 2 },
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
  '2026-10': { active: 12, inactive: 1 },
};

// Independently confirmed this sync against GenomicEpi's species summary, which reads
// 31 cattle / 17 sheep / 7 goats / 5 dogs / 4 horses / 1 elk — identical to the Oct 23
// verified breakdown plus the 3 Bovine and 1 Ovine added below. First sync since Oct 21 with
// a live per-species source to check this against.
const APHIS_BY_SPECIES = {
  Bovine: 31,
  Ovine: 17,
  Caprine: 7,
  Canine: 5,
  Equine: 4,
  Cervid: 1,
};

const EXPECTED_COUNTIES = 24;
const EXPECTED_STATES = 2;
// Texas 57 matches GenomicEpi's stated Texas total exactly. New Mexico 8 is 65 - 57, and
// matches GenomicEpi's line list (its summary widget still says 6 — see CORRECTION 1).
const EXPECTED_TX = { total: 57, active: 6 };
const EXPECTED_NM = { total: 8, active: 6 };
const EXPECTED_HUDSPETH = { total: 2, active: 2 };
const EXPECTED_DONA_ANA = { total: 2, active: 2 };
const EXPECTED_BREWSTER = { total: 6, active: 1 };
const EXPECTED_PECOS = { total: 6, active: 1 };

const EXPECTED_TX_COUNTIES = 19;
const EXPECTED_NM_COUNTY_LIST = ['Dona Ana', 'Grant', 'Hidalgo', 'Lea', 'Otero'];

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
    date: '2026-10-23',
    event: 'Cases 63 and 64: two cattle confirmed the same day in Hudspeth County, TX — the '
      + 'first cases in Hudspeth County, which becomes the twenty-third county of the US '
      + 'outbreak and Texas\'s nineteenth affected county. Hudspeth is in the far-west corner '
      + 'of the state, running from the Rio Grande and the Mexican border north to the New '
      + 'Mexico line, and had declared a local state of disaster over the screwworm threat back '
      + 'in June without ever recording a case of its own. The pair opens the county with a '
      + 'same-day cluster and pushes the outbreak roughly 150 miles northwest of the Jeff Davis '
      + 'and Pecos clusters, into the corridor between the Texas and New Mexico detections; '
      + 'Texas rises to 57 cases',
  },
  {
    date: '2026-10-24',
    event: 'Case 65: cattle in Dona Ana County, NM — the first case in Dona Ana County, which '
      + 'becomes the twenty-fourth county of the US outbreak and New Mexico\'s fifth affected '
      + 'county. The detection extends the New Mexico cluster east from Grant and Hidalgo into '
      + 'the Rio Grande valley above El Paso, and Dona Ana holds the Santa Teresa port of '
      + 'entry — the border crossing state and federal officials had been preparing to reopen '
      + 'to Mexican livestock imports',
  },
  {
    date: '2026-10-24',
    event: 'Case 66: sheep in Dona Ana County, NM — the first ovine detection in New Mexico, '
      + 'confirmed the same day as the Dona Ana cattle case. Every one of New Mexico\'s first '
      + 'seven cases was cattle, a horse or a dog, so although this is the seventeenth sheep '
      + 'case of the US outbreak it is the state\'s first, and it widens the species profile of '
      + 'the New Mexico cluster beyond cattle for the first time since the Grant County horses. '
      + 'New Mexico rises to 8 cases across 5 counties, 6 of them active. US total reaches 65 '
      + 'animal cases with 12 active and 53 inactive across 24 counties in 2 states; 64 of the '
      + '65 are domestic animals and 1 is wildlife',
  },
  {
    date: '2026-10-25',
    event: 'Case 53, the Oct 2 Brewster County dog, is reclassified from active to inactive per '
      + 'the APHIS dashboard — the first of October\'s domestic cases to be closed out, and the '
      + 'only domestic inactive case the month has recorded. Brewster County drops to a single '
      + 'active case. All 12 remaining active cases are domestic animals and all are October '
      + 'detections, split 6 in Texas and 6 in New Mexico — the first time New Mexico, with 8 '
      + 'cases to Texas\'s 57, has carried half the outbreak\'s active caseload',
  },
];

const LAST_UPDATED = '2026-10-26T00:00:00Z';
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

  // Re-runnable: accept either the pre-sync state (61/9) or an already-applied post-sync
  // state (65/12), and reject anything else so it cannot be pointed at unknown data.
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

  // Both new counties must be genuinely new. This is what makes 22 -> 24 (not the brief's 23)
  // the correct county total; if either already had a row the ordinals would all be wrong.
  for (const [county, state] of [['Hudspeth', 'TX'], ['Dona Ana', 'NM']]) {
    const pre = await sql`
      SELECT id FROM screwworm_cases WHERE county = ${county} AND state = ${state}
        AND id NOT IN (63, 64, 65, 66)
    `;
    if (pre.length > 0) {
      console.log(`✗ ${county} County, ${state} already has pre-existing case(s) `
        + `${JSON.stringify(pre.map(r => r.id))} — it is not a new county and the ordinals in this script are wrong`);
      process.exit(1);
    }
    console.log(`✓ ${county} County, ${state} has no pre-existing case — genuinely a new county`);
  }

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
    WHERE status = 'active' AND id NOT IN (54, 55, 56, 57, 59, 60, 61, 62, 63, 64, 65, 66) ORDER BY id
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
  console.log('✓ Counts match APHIS (65 animal cases = 64 domestic + 1 wildlife, 12 active, 53 inactive)');

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

  // The CSV totals must close on the tracker: domestic 64 + 1 wildlife = 65.
  const domesticTotal = byMonth.reduce((s, r) => s + Number(r.domestic), 0);
  if (domesticTotal !== 64 || domesticTotal + 1 !== EXPECTED_TOTAL_AFTER) {
    console.log(`✗ Domestic total is ${domesticTotal}, expected 64 (+1 wildlife = ${EXPECTED_TOTAL_AFTER})`);
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
  console.log(`✓ Geography: ${geo[0].counties} counties across ${geo[0].states} states `
    + '(24, NOT the brief\'s 23 — see CORRECTION 1)');

  // Texas must hold exactly 19 counties — the ordinal written into cases 63/64's notes. The
  // brief called Hudspeth Texas's 22nd county; it is the 19th.
  const txCounties = (await sql`SELECT DISTINCT county FROM screwworm_cases WHERE state = 'TX' ORDER BY county`).map(r => r.county);
  if (txCounties.length !== EXPECTED_TX_COUNTIES) {
    console.log(`✗ Texas has ${txCounties.length} counties, expected ${EXPECTED_TX_COUNTIES}: ${JSON.stringify(txCounties)}`);
    process.exit(1);
  }
  console.log(`✓ Texas counties: ${txCounties.length} (Hudspeth is the 19th, not the brief's 22nd)`);

  // New Mexico must now hold exactly five counties — the ordinal written into case 65's notes.
  const nmCounties = (await sql`SELECT DISTINCT county FROM screwworm_cases WHERE state = 'NM' ORDER BY county`).map(r => r.county);
  if (JSON.stringify(nmCounties) !== JSON.stringify(EXPECTED_NM_COUNTY_LIST)) {
    console.log(`✗ New Mexico counties ${JSON.stringify(nmCounties)} != ${JSON.stringify(EXPECTED_NM_COUNTY_LIST)}`);
    process.exit(1);
  }
  console.log(`✓ New Mexico counties: ${nmCounties.join(', ')} (Dona Ana is the 5th)`);
  if (txCounties.length + nmCounties.length !== EXPECTED_COUNTIES) {
    console.log(`✗ ${txCounties.length} TX + ${nmCounties.length} NM != ${EXPECTED_COUNTIES} counties`);
    process.exit(1);
  }
  console.log(`✓ ${txCounties.length} TX + ${nmCounties.length} NM = ${EXPECTED_COUNTIES} counties`);

  for (const [label, where, want] of [
    ['Texas', sql`SELECT COUNT(*) AS "total", COUNT(*) FILTER (WHERE status = 'active') AS "active" FROM screwworm_cases WHERE state = 'TX'`, EXPECTED_TX],
    ['New Mexico', sql`SELECT COUNT(*) AS "total", COUNT(*) FILTER (WHERE status = 'active') AS "active" FROM screwworm_cases WHERE state = 'NM'`, EXPECTED_NM],
    ['Hudspeth County', sql`SELECT COUNT(*) AS "total", COUNT(*) FILTER (WHERE status = 'active') AS "active" FROM screwworm_cases WHERE county = 'Hudspeth' AND state = 'TX'`, EXPECTED_HUDSPETH],
    ['Dona Ana County', sql`SELECT COUNT(*) AS "total", COUNT(*) FILTER (WHERE status = 'active') AS "active" FROM screwworm_cases WHERE county = 'Dona Ana' AND state = 'NM'`, EXPECTED_DONA_ANA],
    ['Brewster County', sql`SELECT COUNT(*) AS "total", COUNT(*) FILTER (WHERE status = 'active') AS "active" FROM screwworm_cases WHERE county = 'Brewster' AND state = 'TX'`, EXPECTED_BREWSTER],
    ['Pecos County', sql`SELECT COUNT(*) AS "total", COUNT(*) FILTER (WHERE status = 'active') AS "active" FROM screwworm_cases WHERE county = 'Pecos' AND state = 'TX'`, EXPECTED_PECOS],
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
  console.log(`✓ TX ${EXPECTED_TX.total} + NM ${EXPECTED_NM.total} = ${EXPECTED_TOTAL_AFTER} `
    + '(GenomicEpi\'s own summary says TX 57 + NM 6 = 63, two Dona Ana cases short)');

  // Case 66 must be New Mexico's only sheep — the claim written into its notes.
  const nmOvine = await sql`SELECT id, county FROM screwworm_cases WHERE state = 'NM' AND species = 'Ovine' ORDER BY id`;
  if (nmOvine.length !== 1 || nmOvine[0].id !== 66) {
    console.log(`✗ Expected exactly one New Mexico Ovine row (#66), got ${JSON.stringify(nmOvine)}`);
    process.exit(1);
  }
  console.log(`✓ Case #66 is New Mexico's first and only ovine case (${nmOvine[0].county} County)`);

  // Exactly one wildlife case, it is still the elk, and it is still inactive.
  const cervids = await sql`SELECT id, animal, county, state, status FROM screwworm_cases WHERE species = 'Cervid' ORDER BY id`;
  if (cervids.length !== 1 || cervids[0].id !== 58 || cervids[0].animal !== 'Elk' || cervids[0].status !== 'inactive') {
    console.log(`✗ Expected exactly one Cervid row (#58 Elk, inactive), got ${JSON.stringify(cervids)}`);
    process.exit(1);
  }
  console.log(`✓ Wildlife: 1 Cervid row — #58 Elk, ${cervids[0].county} County, ${cervids[0].state}, inactive`);

  // Every active case must be a domestic animal, which is what makes the CSV's domestic-only
  // active column of 12 equal the tracker's 12 actives.
  const activeWildlife = await sql`SELECT id FROM screwworm_cases WHERE status = 'active' AND species = 'Cervid'`;
  if (activeWildlife.length > 0) {
    console.log(`✗ Wildlife case still active: ${JSON.stringify(activeWildlife)}`);
    process.exit(1);
  }
  console.log('✓ All 12 active cases are domestic animals (matches "Active Cases - Domestic" = 12)');

  // Every active case is an October detection, and the active split is 6 TX / 6 NM — both
  // claims are written into the Oct 25 timeline entry.
  const nonOctActive = await sql`SELECT id, date FROM screwworm_cases WHERE status = 'active' AND to_char(date, 'YYYY-MM') <> '2026-10'`;
  if (nonOctActive.length > 0) {
    console.log(`✗ Active case outside October: ${JSON.stringify(nonOctActive)}`);
    process.exit(1);
  }
  const activeSplit = await sql`
    SELECT state, COUNT(*) AS "n" FROM screwworm_cases WHERE status = 'active' GROUP BY 1 ORDER BY 1
  `;
  const splitMap = Object.fromEntries(activeSplit.map(r => [r.state, Number(r.n)]));
  if (splitMap.TX !== 6 || splitMap.NM !== 6) {
    console.log(`✗ Active split ${JSON.stringify(splitMap)} != 6 TX / 6 NM`);
    process.exit(1);
  }
  console.log('✓ All 12 actives are October detections, split 6 TX / 6 NM');

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

  // Coordinates must be inside a plausible box for their county, and the two same-county pins
  // must not coincide — the whole point of the offsets.
  for (const [a, b, label] of [[63, 64, 'Hudspeth'], [65, 66, 'Dona Ana']]) {
    const ra = (await sql`SELECT lat, lng FROM screwworm_cases WHERE id = ${a}`)[0];
    const rb = (await sql`SELECT lat, lng FROM screwworm_cases WHERE id = ${b}`)[0];
    if (Number(ra.lat) === Number(rb.lat) && Number(ra.lng) === Number(rb.lng)) {
      console.log(`✗ ${label} cases #${a} and #${b} share identical coordinates — pins would overlap`);
      process.exit(1);
    }
    console.log(`✓ ${label}: #${a} (${ra.lat}, ${ra.lng}) and #${b} (${rb.lat}, ${rb.lng}) are offset`);
  }
  const outOfBox = await sql`
    SELECT id, county, state, lat, lng FROM screwworm_cases
    WHERE (county = 'Hudspeth' AND state = 'TX' AND (lat NOT BETWEEN 31.0 AND 32.1 OR lng NOT BETWEEN -105.8 AND -104.9))
       OR (county = 'Dona Ana' AND state = 'NM' AND (lat NOT BETWEEN 31.7 AND 33.0 OR lng NOT BETWEEN -107.3 AND -106.3))
  `;
  if (outOfBox.length > 0) {
    console.log(`✗ Coordinates fall outside their county's bounding box: ${JSON.stringify(outOfBox)}`);
    process.exit(1);
  }
  console.log('✓ All new coordinates fall inside their county bounding boxes');

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
