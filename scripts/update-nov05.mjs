import { neon } from '@neondatabase/serverless';
import { readFileSync, writeFileSync } from 'fs';

// Usage: node scripts/update-nov05.mjs /path/to/.env.local   (from `vercel env pull`)
for (const line of readFileSync(process.argv[2], 'utf-8').split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}

const sql = neon(process.env.DATABASE_URL);
const JSON_PATH = new URL('../src/data/cases.json', import.meta.url);

// APHIS sync Nov 5, 2026, from the case-level ExportToCSV worksheet (118 rows = 111 domestic +
// 2 wildlife + 5 fly traps). 99 -> 113 animal cases, 42 -> 55 active, 57 -> 58 inactive,
// 29 -> 32 counties. No existing case changed status or date; 14 rows were simply missing.
//
// This sync also adds inactive_date so the "Active Cases by Day" chart can show history. The
// chart used to apply each case's CURRENT status to every past day, so any case that had since
// gone inactive vanished from the summer bars. APHIS publishes no inactive date, so it is rebuilt
// from the git history of cases.json: the first sync of the case's final inactive run. Two
// commits later reverted as wrong (Aug 13, Sep 19) are excluded. A case that was never seen active
// gets its confirmation date, which keeps it out of the active count entirely. Dates are therefore
// only as fine-grained as the sync cadence.
//
// A trigger maintains inactive_date from here on, so future syncs only need to set status.

const LAST_UPDATED = '2026-11-05T00:00:00Z';
const LAST_CHECKED = '2026-11-05T19:45:00.000Z';
const EXPECTED = { total: 113, active: 55, inactive: 58, counties: 32, states: 3 };

const INACTIVE_DATES = {
  1: '2026-07-02', 2: '2026-07-02', 3: '2026-06-29', 4: '2026-06-26', 5: '2026-06-29',
  6: '2026-07-01', 7: '2026-07-13', 8: '2026-07-13', 9: '2026-07-13', 10: '2026-07-09',
  11: '2026-07-09', 12: '2026-06-12', 13: '2026-07-13', 14: '2026-07-14', 16: '2026-07-16',
  17: '2026-07-16', 18: '2026-07-16', 19: '2026-07-16', 20: '2026-07-16', 21: '2026-07-20',
  22: '2026-07-20', 23: '2026-07-20', 24: '2026-07-20', 25: '2026-07-20', 26: '2026-07-20',
  27: '2026-07-20', 28: '2026-07-22', 29: '2026-06-29', 30: '2026-07-22', 31: '2026-07-22',
  32: '2026-07-25', 33: '2026-08-03', 34: '2026-08-03', 35: '2026-08-03', 36: '2026-08-04',
  37: '2026-08-05', 38: '2026-08-05', 39: '2026-08-05', 40: '2026-07-18', 41: '2026-08-11',
  42: '2026-08-12', 43: '2026-08-22', 44: '2026-08-22', 45: '2026-07-31', 46: '2026-08-28',
  47: '2026-09-13', 48: '2026-09-13', 49: '2026-09-23', 50: '2026-10-02', 51: '2026-10-08',
  52: '2026-10-19', 53: '2026-10-26', 54: '2026-11-02', 58: '2026-10-23', 71: '2026-11-04',
  89: '2026-10-31', 90: '2026-11-01',
};

const c = (id, date, species, animal, county, state, lat, lng, status, su, ss, lead) => ({
  id, date, species, animal, county, state, lat, lng, status,
  ...(status === 'inactive' ? { inactiveDate: date } : {}),
  notes: `${lead} APHIS reports location at county level, so the pin is approximate; ${su}, ${ss}; confirmed per APHIS dashboard ${date}.`,
});

const NEW_CASES = [
  c(101, '2026-11-03', 'Ovine', 'Sheep', 'Greenlee', 'AZ', 33.0566, -109.302, 'active', 'SU:28469:27', 'SS:12827:27', "First Greenlee County case and Arizona's second county after Cochise."),
  c(102, '2026-11-03', 'Bovine', 'Cattle', 'Dona Ana', 'NM', 32.3769, -106.7187, 'active', 'SU:28470:27', 'SS:12825:27', 'Ninth Dona Ana County case.'),
  c(103, '2026-11-03', 'Canine', 'Dog', 'Dona Ana', 'NM', 32.2687, -106.8218, 'active', 'SU:28530:27', 'SS:12828:27', 'Tenth Dona Ana County case.'),
  c(104, '2026-11-03', 'Bovine', 'Cattle', 'Grant', 'NM', 32.7549, -108.2553, 'active', 'SU:28529:27', 'SS:12826:27', 'Eighth Grant County case.'),
  c(105, '2026-11-03', 'Canine', 'Dog', 'Hidalgo', 'NM', 32.3389, -108.6949, 'active', 'SU:28468:27', 'SS:12824:27', "Fifth Hidalgo County case and the county's first dog."),
  c(106, '2026-11-03', 'Equine', 'Horse', 'Sierra', 'NM', 33.1284, -107.2528, 'active', 'SU:28466:27', 'SS:12823:27', 'First Sierra County case.'),
  c(107, '2026-11-03', 'Equine', 'Horse', 'Hudspeth', 'TX', 31.9559, -105.1688, 'active', 'SU:28471:27', 'SS:12832:27', "Fourth Hudspeth County case and the county's first horse."),
  c(108, '2026-11-03', 'Bovine', 'Cattle', 'Hudspeth', 'TX', 31.9154, -105.2188, 'active', 'SU:28513:27', 'SS:12831:27', 'Fifth Hudspeth County case.'),
  c(109, '2026-11-03', 'Bovine', 'Cattle', 'Hudspeth', 'TX', 31.9673, -105.1574, 'active', 'SU:28514:27', 'SS:12830:27', 'Sixth Hudspeth County case.'),
  c(110, '2026-11-04', 'Equine', 'Horse', 'Greenlee', 'AZ', 33.0452, -109.2906, 'active', 'SU:28539:27', 'SS:12842:27', 'Second Greenlee County case.'),
  c(111, '2026-11-04', 'Equine', 'Horse', 'Eddy', 'NM', 32.4207, -104.2288, 'active', 'SU:28536:27', 'SS:12838:27', 'First Eddy County case.'),
  c(112, '2026-11-04', 'Bovine', 'Cattle', 'Otero', 'NM', 32.6347, -105.3633, 'active', 'SU:28535:27', 'SS:12837:27', 'Fourth Otero County case.'),
  c(113, '2026-11-04', 'Cervid', 'Elk', 'Jeff Davis', 'TX', 30.6111, -103.8699, 'inactive', 'SU:28524:27', 'SS:12841:27', 'Third Jeff Davis County case and the second wildlife detection of the US outbreak; already inactive in the APHIS export.'),
  c(114, '2026-11-04', 'Bovine', 'Cattle', 'Starr', 'TX', 26.5789, -98.7421, 'active', 'SU:28517:27', 'SS:12840:27', 'Third Starr County case.'),
];

const NEW_TIMELINE = [
  {
    date: '2026-11-04',
    event: '113 animal cases, 55 active. APHIS case-level data adds 14 cases confirmed Nov 3-4, for 111 domestic and 2 wildlife cases across 32 counties in 3 states, plus 5 fly-trap detections not counted as animal cases. Greenlee County, AZ, and Eddy and Sierra counties, NM, report their first cases.',
  },
];

const LABELS = { Avian: 'Avian (Poultry)', Bovine: 'Bovine (Cattle)', Canine: 'Canine (Dogs)', Caprine: 'Caprine (Goats)', Cervid: 'Cervid (Elk)', Equine: 'Equine (Horses)', Feline: 'Feline (Cats)', Ovine: 'Ovine (Sheep)' };
const WANT_SPECIES = { Avian: 1, Bovine: 52, Canine: 16, Caprine: 7, Cervid: 2, Equine: 13, Feline: 1, Ovine: 21 };

function assert(ok, msg) {
  if (!ok) throw new Error(`ASSERT FAILED: ${msg}`);
  console.log(`  ok  ${msg}`);
}

const json = JSON.parse(readFileSync(JSON_PATH, 'utf-8'));
const [before] = await sql`select count(*)::int n, count(*) filter (where status='active')::int act from screwworm_cases`;
assert(before.n === 99 && before.act === 42, 'DB starts at 99 cases / 42 active');
assert(json.confirmedCases.length === 99, 'fallback starts at 99 cases');

const inactive = json.confirmedCases.filter((x) => x.status === 'inactive');
assert(inactive.length === 57 && inactive.every((x) => INACTIVE_DATES[x.id]), 'every inactive case has an inactive date');
assert(Object.keys(INACTIVE_DATES).length === 57, 'no inactive date is left over');
const pins = new Set(json.confirmedCases.map((x) => `${x.lat},${x.lng}`));
for (const n of NEW_CASES) {
  assert(!pins.has(`${n.lat},${n.lng}`), `case ${n.id} does not stack on an existing pin`);
  pins.add(`${n.lat},${n.lng}`);
}

for (const x of inactive) x.inactiveDate = INACTIVE_DATES[x.id];
json.confirmedCases.push(...NEW_CASES);
const total = json.confirmedCases.length;
const speciesBreakdown = Object.keys(LABELS).map((sp) => {
  const count = json.confirmedCases.filter((x) => x.species === sp).length;
  assert(count === WANT_SPECIES[sp], `${sp} = ${WANT_SPECIES[sp]}`);
  return { species: LABELS[sp], count, percentage: Math.round((count / total) * 100) };
});
json.speciesBreakdown = speciesBreakdown;
json.internationalContext.timeline.push(...NEW_TIMELINE);
json.lastUpdated = LAST_UPDATED;
json.lastChecked = LAST_CHECKED;

// All DB writes commit together or not at all.
await sql.transaction([
  sql`alter table screwworm_cases add column if not exists inactive_date date`,
  sql`create or replace function screwworm_set_inactive_date() returns trigger as $fn$
      begin
        if new.status = 'active' then
          new.inactive_date := null;
        elsif new.inactive_date is null then
          new.inactive_date := case when tg_op = 'INSERT' then new.date else current_date end;
        end if;
        return new;
      end;
      $fn$ language plpgsql`,
  sql`drop trigger if exists screwworm_inactive_date on screwworm_cases`,
  sql`create trigger screwworm_inactive_date before insert or update of status on screwworm_cases
      for each row execute function screwworm_set_inactive_date()`,
  ...inactive.map((x) => sql`update screwworm_cases set inactive_date=${x.inactiveDate} where id=${x.id} and status='inactive'`),
  ...NEW_CASES.map((n) => sql`
    insert into screwworm_cases (id, date, species, animal, county, state, lat, lng, status, notes)
    values (${n.id}, ${n.date}, ${n.species}, ${n.animal}, ${n.county}, ${n.state}, ${n.lat}, ${n.lng}, ${n.status}, ${n.notes})`),
  sql`update screwworm_metadata set value=${JSON.stringify(speciesBreakdown)}::jsonb where key='speciesBreakdown'`,
  sql`update screwworm_metadata set value=${JSON.stringify(json.internationalContext)}::jsonb where key='internationalContext'`,
  sql`update screwworm_metadata set value=${JSON.stringify(LAST_UPDATED)}::jsonb where key='lastUpdated'`,
  sql`update screwworm_metadata set value=${JSON.stringify(LAST_CHECKED)}::jsonb where key='lastChecked'`,
]);
writeFileSync(JSON_PATH, `${JSON.stringify(json, null, 2)}\n`);

console.log('\n--- end state ---');
const db = await sql`select id, date::text date, species, county, state, status, inactive_date::text inactive_date from screwworm_cases order by id`;
for (const [name, rows, key] of [['fallback', json.confirmedCases, 'inactiveDate'], ['DB', db, 'inactive_date']]) {
  const act = rows.filter((x) => x.status === 'active').length;
  assert(rows.length === EXPECTED.total, `${name} holds ${EXPECTED.total} cases`);
  assert(act === EXPECTED.active, `${name} holds ${EXPECTED.active} active`);
  assert(rows.length - act === EXPECTED.inactive, `${name} holds ${EXPECTED.inactive} inactive`);
  assert(new Set(rows.map((x) => `${x.state}/${x.county}`)).size === EXPECTED.counties, `${name} spans ${EXPECTED.counties} counties`);
  assert(new Set(rows.map((x) => x.state)).size === EXPECTED.states, `${name} spans ${EXPECTED.states} states`);
  assert(rows.every((x) => (x.status === 'inactive') === Boolean(x[key])), `${name}: inactive date set on inactive cases only`);
  assert(rows.every((x) => !x[key] || x[key] >= x.date), `${name}: no inactive date precedes confirmation`);
}
const jm = new Map(json.confirmedCases.map((x) => [x.id, x]));
assert(db.every((r) => { const j = jm.get(r.id); return j && j.date === r.date && j.status === r.status && (j.inactiveDate ?? null) === r.inactive_date; }), 'DB and fallback agree on date, status and inactive date');
