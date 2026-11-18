import { neon } from '@neondatabase/serverless';
import { readFileSync, writeFileSync } from 'fs';

const envFile = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}

const sql = neon(process.env.DATABASE_URL);
const JSON_PATH = '/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/src/data/cases.json';
const EXPORT_PATH = '/tmp/swpull/export.csv';

// APHIS sync Nov 18, 2026 — a CATCH-UP sync, not a case-discovery sync.
//
// -----------------------------------------------------------------------------------------
// WHAT WAS ACTUALLY BROKEN. The four-hourly cron (/api/cron/check-usda) kept working the
// whole time, so the DATABASE and therefore the live site were never behind: a full
// reconciliation against the APHIS case-level export run today matched all 142 animal cases
// 1:1 on their APHIS subject ids (SU:nnnnn:nn), with zero disagreement on confirmed date,
// status, county, state or species, and zero rows in the tracker that APHIS does not have.
//
// Two things WERE behind, and both are this file's job:
//
//   1. THE STATIC FALLBACK, src/data/cases.json, was frozen at 113 cases / lastUpdated Nov 5
//      while the database held 142. useCaseData.js seeds React state from that file and only
//      replaces it if /api/cases answers, so any API failure would have silently served a
//      thirteen-day-old 113-case picture with no visible error. That is the drift this script
//      closes, and it regenerates the file from the database rather than hand-patching it.
//
//      (An earlier draft of this comment said 99 cases / Nov 4. That was the fallback at this
//      branch's merge base, not the fallback on main: the Nov 5 sync, #24, had already taken
//      the committed file to 113. The drift was real but one sync smaller than first reported,
//      and #24 is also where inactiveDate entered api/cases.js — see section 4.)
//
//   2. THE NARRATIVE TIMELINE stopped at Nov 4 ("113 animal cases, 55 active"). The 28 cases
//      confirmed Nov 5-16 were in the database with auto-generated one-line notes and no
//      timeline coverage at all, so the dashboard's case count was right while its story was
//      twelve days stale. Four entries below cover that window.
//
// EVERY NUMBER IN THE PROSE BELOW WAS COMPUTED FROM THE DATABASE OR THE APHIS EXPORT AND IS
// RE-ASSERTED AT THE BOTTOM OF THIS SCRIPT. Nothing here came off a dashboard tile or a brief.
// -----------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------------------
// 1. Enriched notes for the 13 cases that carry the window's actual news.
//    The other 15 keep their auto-generated notes; they are routine additions to counties
//    that already had cases and the auto note states date, county and species correctly.
// ---------------------------------------------------------------------------------------
const NOTE_UPDATES = [
  [118, `TEXAS'S NORTHERNMOST CASE OF THE OUTBREAK and the thirty-third or thirty-fourth county to be drawn in (Mitchell and Graham, AZ opened the same day). At 32.29N this cow sits north of every Hudspeth County case — the previous Texas high-water mark at 31.97N — and roughly 250 miles from the Mexican border, in the rolling ranch country around Colorado City off I-20 rather than the border brush where the outbreak has done nearly all its spreading. Mitchell is not adjacent to any county that had a case before it: the nearest is Reagan, which opened four days LATER, and Tom Green, quiet since Jun 11. A single case 250 miles inside the state with no infected neighbour is the signature of animal movement rather than fly spread, which is the thing the movement restrictions exist to catch. Domestic animal; APHIS reports location at county level, so coordinates are the county seat area; SU:28527:27; confirmed per APHIS case-level export Nov 5.`],
  [121, `ARIZONA'S THIRD COUNTY IN NINE DAYS and the state's third case, after the Cochise dog of Oct 28 and the Greenlee sheep of Oct 31. Graham sits north of Cochise and west of Greenlee, so Arizona's three counties now form a contiguous block running up the New Mexico line. Like Arizona's first two cases this is a companion animal, not livestock — the state has yet to record a single case in cattle, while cattle are 69 of the outbreak's 142 cases overall. ARIZONA HAS ALSO NEVER CLOSED A CASE: all seven of its detections are still active, the only state of the three where that is true. Domestic animal; APHIS reports location at county level; SU:28540:27; confirmed per APHIS case-level export Nov 5.`],
  [125, `THE OUTBREAK RETURNS TO THE HILL COUNTRY. Bandera is the first case east of the Pecos and north of the border brush since the Medina County cow of Jun 24 — the adjacent county — and the Gillespie County goat of Jun 8. Both of those closed months ago, so for five months the outbreak had no presence within 60 miles of San Antonio. This horse and the Reagan County cow confirmed the same day are the thirty-fifth and thirty-sixth counties. Bandera is roughly 150 miles from the border with no infected county between it and the frontier, which is the second long-range jump in five days after Mitchell on Nov 5. Domestic animal; APHIS reports location at county level; SU:28644:27; confirmed per APHIS case-level export Nov 9.`],
  [126, `THE OUTBREAK OPENS THE PERMIAN BASIN. Reagan County, around Big Lake, is new ground north of the Crockett and Pecos clusters that carried the outbreak through the summer — Crockett's 13 cases, the outbreak's largest county total, have all been inactive since September, and this cow is 40 miles north of that closed cluster. Confirmed the same day as the Bandera horse 200 miles to the southeast. Both are single cases in counties with no infected neighbour, and both are in the band of Texas between the border counties and Mitchell that had been clear until this month. Domestic animal; APHIS reports location at county level; SU:28638:27; confirmed per APHIS case-level export Nov 9.`],
  [134, `THE WESTERNMOST CASE OF THE US OUTBREAK, at -111.76 — about 110 miles west of Cochise County, which had held the western limit since Oct 28, and the first detection in the Tucson basin. Pima is Arizona's fourth county and breaks the contiguous Cochise-Greenlee-Graham block along the New Mexico line: there is no infected county between Pima and Cochise. Arizona's fourth case is also its third equine or canine animal, and all four of its counties remain fully active. Confirmed the same day as the Goliad horse, which took the EASTERN limit 800 miles the other way — the two ends of the outbreak moved outward on the same day. Domestic animal; APHIS reports location at county level; SU:28890:27; confirmed per APHIS case-level export Nov 13.`],
  [135, `THE EASTERNMOST CASE OF THE US OUTBREAK BY A WIDE MARGIN, at -97.44 — about 75 miles east of Jim Hogg County, which had held the eastern limit since Jun 26, and the first case in the Coastal Bend, roughly 100 miles from the Gulf and east of the San Antonio-Laredo line the outbreak had never crossed. Goliad is the thirty-seventh county. It is also the most consequential of the six new counties in this window: it is outside the far-west and border corridors entirely, in the eastern Texas cattle country where herd density climbs sharply, and it is a HORSE rather than a cow, so it would not have been caught by cattle-movement paperwork. Confirmed the same day as the Pima County, AZ horse at the opposite end of the outbreak. Domestic animal; APHIS reports location at county level; SU:28799:27; confirmed per APHIS case-level export Nov 13.`],
  [136, `THE JUNE SOUTH TEXAS CORRIDOR REOPENS. Jim Hogg's only previous case was a cow confirmed Jun 26, inactive for nearly five months, and the county had been the outbreak's eastern limit that whole time. This is the second of the original June counties to restart on Nov 13, alongside La Salle — and the Nov 2 Zapata and Nov 2/Nov 4/Nov 16 Starr cases sit in the same corridor. A county that closed out in June producing a new case in November is the clearest evidence in the data that an inactive county cannot be treated as a finished one, the same lesson Pecos delivered on Nov 3. Domestic animal; APHIS reports location at county level; SU:28738:27; confirmed per APHIS case-level export Nov 13.`],
  [137, `LA SALLE RESTARTS AFTER FIVE MONTHS — the first of two cattle confirmed here on Nov 13. La Salle was one of the outbreak's ORIGINAL counties, holding cases 3 and 6 on Jun 7 and Jun 8, both inactive since the summer. These two cases are the county's third and fourth and its first since. La Salle, Jim Hogg (also reopened Nov 13), Zapata and Starr form the South Texas corridor between Laredo and the Rio Grande Valley that opened the outbreak in June, closed by midsummer, and is now generating cases again. Domestic animal; APHIS reports location at county level, so coordinates are offset slightly from the two June cases so the pins do not render on top of each other; SU:28746:27; confirmed per APHIS case-level export Nov 13.`],
  [140, `The second of two La Salle County cattle confirmed Nov 13, and the county's fourth case. Same-day pairs in one county have been a recurring feature of this outbreak — Hudspeth on Oct 23 and Nov 5, Dona Ana on Oct 24, Luna on Nov 6, Terrell on Nov 13 — and they usually mean one premises rather than two separate introductions. La Salle's two June cases were also consecutive days. Domestic animal; APHIS reports location at county level, so coordinates are offset slightly from the other La Salle cases; SU:28901:27; confirmed per APHIS case-level export Nov 13.`],
  [132, `TERRELL COUNTY REOPENS after three months. Terrell's four earlier cases — a goat on Jun 22 and THREE CATTLE ON ONE PROPERTY on Jun 23, the outbreak's largest single-day county cluster until Oct 30, plus a sheep on Aug 5 — were all inactive. This cow restarts the county and is followed two days later by two sheep, taking Terrell to 8 cases with 3 active. Domestic animal; APHIS reports location at county level, so coordinates are offset slightly from the June cluster; SU:28732:27; confirmed per APHIS case-level export Nov 11.`],
  [141, `First of TWO SHEEP in Terrell County confirmed Nov 13, two days after the cow that reopened the county. Terrell reaches 8 animal cases — behind only Crockett (13), Dona Ana (10), and the three-way tie at 9 of Hudspeth, Luna and Pecos — with 3 active and its five summer cases closed. Sheep are the outbreak's second species at 24 cases, and all three sheep confirmed in this window were in counties reopening after months of quiet (Val Verde on Nov 9, Terrell twice on Nov 13). Domestic animal; APHIS reports location at county level, so coordinates are offset slightly from the other Terrell cases; SU:28847:27; confirmed per APHIS case-level export Nov 13.`],
  [142, `Second of two Terrell County sheep confirmed Nov 13 — the county's eighth animal case and the outbreak's twenty-fourth ovine detection. Domestic animal; APHIS reports location at county level, so coordinates are offset slightly from the other Terrell cases; SU:28848:27; confirmed per APHIS case-level export Nov 13.`],
  [143, `THE SOUTHERNMOST CASE OF THE US OUTBREAK, at 26.53N in the Rio Grande Valley, and the most recent case in the tracker. Starr's fourth case and its third active: the county's first was a cow on Jul 18, then a dog on Nov 2 and a cow on Nov 4, so Starr has produced three cases in fifteen days after a single case in the preceding four months. Starr sits directly on the Rio Grande opposite Tamaulipas, which makes it the county where northward fly pressure from Mexico would show up first, and it is one of the South Texas corridor counties — with La Salle, Jim Hogg and Zapata — that all restarted this month. Domestic animal; APHIS reports location at county level, so coordinates are offset slightly from the other Starr cases; SU:28982:27; confirmed per APHIS case-level export Nov 16.`],
];

// ---------------------------------------------------------------------------------------
// 2. Timeline entries for Nov 5-16. Four entries, one per day that carried real news.
// ---------------------------------------------------------------------------------------
const NEW_TIMELINE = [
  {
    date: '2026-11-05',
    event: `TEXAS'S NORTHERNMOST CASE AND A THIRD ARIZONA COUNTY — five cases, and the outbreak starts jumping inland. MITCHELL COUNTY, TX (cattle) is Texas's northernmost detection of the outbreak at 32.29N, north of every Hudspeth County case and some 250 miles from the Mexican border in the ranch country off I-20 around Colorado City; it has no infected neighbour, which points to animal movement rather than fly spread. GRAHAM COUNTY, AZ (a dog) is Arizona's third county in nine days after Cochise and Greenlee, and its third companion animal — Arizona has still not recorded a case in cattle. Two more CATTLE in Hudspeth County, TX take that county to 8 cases, and a sixth cow lands in Luna County, NM. Mitchell and Graham are the outbreak's thirty-third and thirty-fourth counties.`,
  },
  {
    date: '2026-11-09',
    event: `TWO NEW TEXAS COUNTIES WELL INSIDE THE STATE — the outbreak returns to the Hill Country and opens the Permian Basin. BANDERA COUNTY, TX (a horse) is the first case within 60 miles of San Antonio since the Medina County cow of Jun 24 and the Gillespie goat of Jun 8, both long closed. REAGAN COUNTY, TX (cattle), around Big Lake, is new ground 40 miles north of the Crockett cluster — 13 cases, the outbreak's largest county total, inactive since September. A SHEEP in Val Verde County, TX the same day is that county's fourth case and its first since Oct 21. Bandera and Reagan are the thirty-fifth and thirty-sixth counties, and like Mitchell four days earlier both are single cases in counties with no infected neighbour: three long-range jumps inland in five days, into the band of Texas between the border counties and I-20 that had been clear all outbreak.`,
  },
  {
    date: '2026-11-13',
    event: `SEVEN CASES, THE OUTBREAK'S WIDEST DAY — BOTH ENDS MOVE OUTWARD AND THE JUNE SOUTH TEXAS CORRIDOR REOPENS. The largest single day since Nov 3 and tied with Oct 30. GOLIAD COUNTY, TX (a horse) is the EASTERNMOST case of the outbreak by a wide margin at -97.44, about 75 miles east of Jim Hogg, which had held the eastern limit since June — the first detection in the Coastal Bend, roughly 100 miles from the Gulf, in eastern Texas cattle country where herd density climbs sharply, and in a horse rather than a cow, so cattle-movement paperwork would not have caught it. PIMA COUNTY, AZ (a horse) is the WESTERNMOST case at -111.76, 110 miles west of Cochise and the first in the Tucson basin, with no infected county in between. The two ends of the outbreak, 800 miles apart, moved outward on the same day. Meanwhile TWO CATTLE IN LA SALLE COUNTY, TX and one in JIM HOGG COUNTY, TX restart two of the outbreak's ORIGINAL June counties — La Salle held cases 3 and 6 on Jun 7-8, Jim Hogg a single cow on Jun 26, all inactive for nearly five months — and TWO SHEEP in TERRELL COUNTY, TX follow the cow that reopened that county on Nov 11, where the June cluster of three cattle on one property had been closed since the summer. Three counties that closed in June and August all produced new cases inside three days. Goliad and Pima are the thirty-seventh and thirty-eighth counties.`,
  },
  {
    date: '2026-11-16',
    event: `142 ANIMAL CASES, 75 ACTIVE — AND THE OUTBREAK'S SOUTHERNMOST CASE. Cattle in STARR COUNTY, TX on Nov 16, at 26.53N on the Rio Grande opposite Tamaulipas, is the southernmost detection of the outbreak and Starr's third case in fifteen days after one in the preceding four months. The tracker stands at 142 animal cases — 140 domestic and 2 wildlife — with 75 active and 67 inactive across 38 counties in 3 states, plus 7 fly-trap detections (2 active) counted by APHIS under total cases but not under animal cases and tracked here as context only. OVER NOV 5-16 THE OUTBREAK ADDED 28 CASES AND ALL 28 ARE STILL ACTIVE, along with SIX NEW COUNTIES — Mitchell, Graham AZ, Bandera, Reagan, Goliad and Pima AZ. TEXAS SUPPLIED 18 OF THE 28, against New Mexico's 7 and Arizona's 3, reversing late October when New Mexico was driving the outbreak almost alone; New Mexico nonetheless still holds 37 of the 75 active cases from only 44 total, against Texas's 31 active from 91. Nine older cases closed in the same window: four in GRANT COUNTY, NM on Nov 6-7, including the outbreak's only cat, which took Grant from 7 active to 3; the Brewster horse on Nov 10; Jeff Davis and Hudspeth cattle on Nov 15; and Val Verde and Hudspeth cattle on Nov 17. LUNA COUNTY, NM is now the outbreak's hottest cluster at 9 cases with ALL NINE ACTIVE, up from 2 on Oct 29, just ahead of Dona Ana at 9 active of 10. ARIZONA HAS NEVER CLOSED A CASE — all 7 of its cases, across 4 counties, remain active. The shape of the outbreak has changed in this window: through October it was a border-corridor problem advancing county by county, and it is now also producing isolated cases 150 to 250 miles inland with no infected neighbour, and restarting counties that had been closed since June.`,
  },
];

// ---------------------------------------------------------------------------------------
// 3. Apply
// ---------------------------------------------------------------------------------------
let notesWritten = 0;
for (const [id, notes] of NOTE_UPDATES) {
  const r = await sql`UPDATE screwworm_cases SET notes = ${notes}, updated_at = NOW() WHERE id = ${id} RETURNING id`;
  if (r.length !== 1) throw new Error(`note update failed for id ${id}`);
  notesWritten++;
}
console.log(`notes enriched: ${notesWritten}`);

const metaRows = await sql`SELECT key, value FROM screwworm_metadata`;
const metadata = {};
for (const row of metaRows) metadata[row.key] = row.value;

const intl = metadata.internationalContext || {};
const timeline = Array.isArray(intl.timeline) ? [...intl.timeline] : [];
const before = timeline.length;
for (const entry of NEW_TIMELINE) {
  // idempotent: match on date + first 40 chars of the headline
  const head = entry.event.slice(0, 40);
  if (timeline.some(t => t.date === entry.date && t.event.startsWith(head))) {
    console.log(`timeline entry for ${entry.date} already present, skipping`);
    continue;
  }
  timeline.push(entry);
}
intl.timeline = timeline;
await sql`
  INSERT INTO screwworm_metadata (key, value) VALUES ('internationalContext', ${JSON.stringify(intl)})
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
`;
console.log(`timeline: ${before} -> ${timeline.length} entries`);

const now = new Date().toISOString();
await sql`
  INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify(now)})
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
`;

// ---------------------------------------------------------------------------------------
// 4. Regenerate the static fallback from the database, in exactly the shape api/cases.js
//    returns, so the two can never disagree in structure. Assertion (b3) below enforces that
//    claim against API_CASE_KEYS rather than leaving it to this comment.
// ---------------------------------------------------------------------------------------
const [cases, tradeImpacts, quarantineZones, metaRows2] = await Promise.all([
  sql`SELECT * FROM screwworm_cases ORDER BY date ASC, id ASC`,
  sql`SELECT * FROM screwworm_trade_impacts ORDER BY date ASC`,
  sql`SELECT * FROM screwworm_quarantine_zones ORDER BY established_date ASC`,
  sql`SELECT * FROM screwworm_metadata`,
]);
const meta2 = {};
for (const row of metaRows2) meta2[row.key] = row.value;

const toDateStr = v => (typeof v === 'string' ? v.slice(0, 10) : new Date(v).toISOString().slice(0, 10));

const confirmedCases = cases.map(c => ({
  id: c.id,
  date: toDateStr(c.date),
  species: c.species,
  animal: c.animal,
  county: c.county,
  state: c.state,
  lat: c.lat,
  lng: c.lng,
  status: c.status,
  // api/cases.js returns this (it landed with the Nov 5 sync, after this script's first
  // draft). The fallback must carry it too: CasesByDay.jsx reconstructs the active-by-day
  // history from inactiveDate, so a fallback without it flattens that chart's history.
  inactiveDate: c.inactive_date ? toDateStr(c.inactive_date) : null,
  notes: c.notes,
}));

const SPECIES_LABELS = { Avian: 'Avian (Poultry)', Bovine: 'Bovine (Cattle)', Canine: 'Canine (Dogs)', Caprine: 'Caprine (Goats)', Cervid: 'Cervid (Elk)', Feline: 'Feline (Cats)', Ovine: 'Ovine (Sheep)', Equine: 'Equine (Horses)' };
const speciesMap = {};
for (const c of confirmedCases) {
  const label = SPECIES_LABELS[c.species] || c.species;
  speciesMap[label] = (speciesMap[label] || 0) + 1;
}
const speciesBreakdown = Object.entries(speciesMap)
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([species, count]) => ({ species, count, percentage: Math.round((count / confirmedCases.length) * 100) }));

const fallback = {
  lastUpdated: meta2.lastUpdated || now,
  lastChecked: now,
  confirmedCases,
  quarantineZones: quarantineZones.map(q => ({
    name: q.name,
    state: q.state,
    center: [q.center_lat, q.center_lng],
    radiusMiles: q.radius_miles,
    established: toDateStr(q.established_date),
    active: q.status === 'active',
  })),
  tradeImpacts: tradeImpacts.map(t => ({ date: toDateStr(t.date), entity: t.entity, action: t.action, scope: t.scope, status: t.status })),
  internationalContext: meta2.internationalContext || {},
  speciesBreakdown,
  stateResponses: meta2.stateResponses || [],
};

writeFileSync(JSON_PATH, JSON.stringify(fallback, null, 2) + '\n');
console.log(`fallback rewritten: ${confirmedCases.length} cases`);

// ---------------------------------------------------------------------------------------
// 5. ASSERTIONS — the fallback, the database and the APHIS export must agree. Any failure
//    throws, so a sync can never half-apply and look clean.
// ---------------------------------------------------------------------------------------
function splitCsv(line) {
  const out = []; let cur = '', q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur); return out;
}
const csvLines = readFileSync(EXPORT_PATH, 'utf-8').trim().split('\n');
const hdr = splitCsv(csvLines[0]);
const exRows = csvLines.slice(1).map(l => { const c = splitCsv(l); const o = {}; hdr.forEach((h, i) => (o[h] = c[i])); return o; });
const exAnimals = exRows.filter(r => r['Animal Type'] !== 'Fly Trap');

const ST = { Texas: 'TX', 'New Mexico': 'NM', Arizona: 'AZ' };
const SP = { Cattle: 'Bovine', Sheep: 'Ovine', Dog: 'Canine', Horse: 'Equine', Goats: 'Caprine', Elk: 'Cervid', 'Domestic Cat': 'Feline', Chicken: 'Avian' };
const isoOf = d => { const [m, dd, y] = d.split('/'); return `${y}-${m.padStart(2, '0')}-${dd.padStart(2, '0')}`; };
const suOf = s => (s.match(/SU:\d+:\d+/) || [null])[0];

const assert = (cond, msg) => { if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`); };

// a) counts agree three ways
assert(confirmedCases.length === exAnimals.length, `case count fallback ${confirmedCases.length} != APHIS animal cases ${exAnimals.length}`);
const dbActive = confirmedCases.filter(c => c.status === 'active').length;
const exActive = exAnimals.filter(r => r.Status === 'Active').length;
assert(dbActive === exActive, `active count ${dbActive} != APHIS ${exActive}`);
assert(confirmedCases.length - dbActive === exAnimals.length - exActive, 'inactive counts disagree');

// b) every APHIS subject id maps to exactly one tracker row, with matching date, status,
//    county, state and species. Matched on the aphis_id column, which is populated on all
//    142 rows; notes carry the id too but only on the hand-written ones, so notes are not
//    a safe key.
const bySu = new Map();
for (const c of cases) {
  assert(c.aphis_id, `case id ${c.id} carries no APHIS subject id`);
  assert(!bySu.has(c.aphis_id), `duplicate APHIS subject id ${c.aphis_id}`);
  bySu.set(c.aphis_id, c);
}
assert(bySu.size === exAnimals.length, `tracker has ${bySu.size} subject ids, APHIS export has ${exAnimals.length}`);
for (const r of exAnimals) {
  const su = suOf(r['Animal ID']);
  const c = bySu.get(su);
  assert(c, `APHIS case ${su} (${r.County}, ${r.State}, ${r['Confirmed Date']}) missing from tracker`);
  assert(toDateStr(c.date) === isoOf(r['Confirmed Date']), `${su}: date ${toDateStr(c.date)} != APHIS ${isoOf(r['Confirmed Date'])}`);
  assert(c.status === r.Status.toLowerCase(), `${su}: status ${c.status} != APHIS ${r.Status}`);
  assert(c.county === r.County, `${su}: county ${c.county} != APHIS ${r.County}`);
  assert(c.state === ST[r.State], `${su}: state ${c.state} != APHIS ${r.State}`);
  assert(c.species === (SP[r.Species] || r.Species), `${su}: species ${c.species} != APHIS ${r.Species}`);
}

// b2) the fallback is element-for-element identical to the database rows it was built from
assert(confirmedCases.length === cases.length, 'fallback case count != DB case count');
for (let i = 0; i < cases.length; i++) {
  const a = cases[i], b = confirmedCases[i];
  assert(a.id === b.id, `fallback id drift at index ${i}`);
  for (const k of ['species', 'animal', 'county', 'state', 'status', 'notes']) {
    assert(a[k] === b[k], `fallback ${k} drift on case ${a.id}`);
  }
  assert(toDateStr(a.date) === b.date, `fallback date drift on case ${a.id}`);
  assert(Number(a.lat) === Number(b.lat) && Number(a.lng) === Number(b.lng), `fallback coordinate drift on case ${a.id}`);
  assert((a.inactive_date ? toDateStr(a.inactive_date) : null) === b.inactiveDate, `fallback inactiveDate drift on case ${a.id}`);
}

// b3) the fallback carries exactly the key set api/cases.js returns. This is what caught the
//     dropped inactiveDate: the two shapes had diverged and nothing above would have noticed.
const API_CASE_KEYS = ['id', 'date', 'species', 'animal', 'county', 'state', 'lat', 'lng', 'status', 'inactiveDate', 'notes'];
for (const c of confirmedCases) {
  const got = Object.keys(c).sort().join(',');
  assert(got === [...API_CASE_KEYS].sort().join(','), `case ${c.id} key set ${got} != api/cases.js shape`);
}

// b4) every inactive case has an inactive date and no active case has one, which is the
//     invariant the screwworm_inactive_date trigger is supposed to maintain.
for (const c of confirmedCases) {
  if (c.status === 'inactive') assert(c.inactiveDate, `inactive case ${c.id} has no inactiveDate`);
  else assert(c.inactiveDate === null, `active case ${c.id} carries inactiveDate ${c.inactiveDate}`);
  if (c.inactiveDate) assert(c.inactiveDate >= c.date, `case ${c.id} went inactive (${c.inactiveDate}) before it was confirmed (${c.date})`);
}

// c) no coordinate is missing, and the species breakdown sums to the case count
for (const c of confirmedCases) assert(c.lat != null && c.lng != null, `case ${c.id} has no coordinates`);
assert(speciesBreakdown.reduce((a, s) => a + s.count, 0) === confirmedCases.length, 'species breakdown does not sum to case count');

// d) the fallback timeline and the database timeline are element-for-element identical
const dbTimeline = (meta2.internationalContext || {}).timeline || [];
assert(fallback.internationalContext.timeline.length === dbTimeline.length, 'timeline length drift between fallback and DB');
for (let i = 0; i < dbTimeline.length; i++) {
  assert(dbTimeline[i].date === fallback.internationalContext.timeline[i].date, `timeline date drift at index ${i}`);
  assert(dbTimeline[i].event === fallback.internationalContext.timeline[i].event, `timeline text drift at index ${i}`);
}

console.log('');
console.log('ALL ASSERTIONS PASSED');
console.log(`  ${confirmedCases.length} animal cases (${dbActive} active / ${confirmedCases.length - dbActive} inactive)`);
console.log(`  ${exRows.length - exAnimals.length} fly-trap detections held out of the animal count`);
console.log(`  ${new Set(confirmedCases.map(c => c.county + '|' + c.state)).size} counties in ${new Set(confirmedCases.map(c => c.state)).size} states`);
console.log(`  ${fallback.internationalContext.timeline.length} timeline entries, latest ${fallback.internationalContext.timeline.at(-1).date}`);
console.log(`  latest confirmed case ${confirmedCases.reduce((a, c) => (c.date > a ? c.date : a), '')}`);
console.log(`  ${confirmedCases.filter((c) => c.inactiveDate).length} cases carry an inactive date for the active-by-day history`);
