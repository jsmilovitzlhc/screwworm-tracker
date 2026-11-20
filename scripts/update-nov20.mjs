// APHIS sync Nov 20 2026. Brings screwworm_cases in line with the ExportToCSV worksheet and
// reports the arithmetic so the totals can be checked against the dashboard by hand.
//
// Note on counts: APHIS's csv carries 158 rows, but 7 of those are Case Type "Fly Trap" -- adult
// fly detections, not infested animals. The tracker plots animal cases, so the comparable APHIS
// figure is 151 (73 active). Do not reconcile the tracker against the raw 158.
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { fetchAphisCases, diffCases } from '../api/_lib/aphis.js';

const COUNTIES = JSON.parse(readFileSync(new URL('../api/_lib/us-counties.json', import.meta.url), 'utf-8'));
const SOURCE_URL = 'https://www.aphis.usda.gov/animals/animal-health/livestock-and-poultry-disease/stop-screwworm/current-status/confirmed';
const APPLY = process.argv.includes('--apply');

const sql = neon(process.env.DATABASE_URL);

const aphis = await fetchAphisCases();
const before = await sql`select id, date::text as date, status, aphis_id, county, state from screwworm_cases`;
const { inserts, updates, notInAphis } = diffCases(before, aphis);

const activeBefore = before.filter((r) => r.status === 'active').length;
const activeAphis = aphis.filter((r) => r.status === 'active').length;
const flips = updates.filter((u) => {
  const was = before.find((r) => r.id === u.id);
  return was.status !== u.status;
});
const toInactive = flips.filter((u) => u.status === 'inactive').length;
const toActive = flips.filter((u) => u.status === 'active').length;
const newActive = inserts.filter((r) => r.status === 'active').length;

console.log(`APHIS animal cases: ${aphis.length} (${activeAphis} active)`);
console.log(`tracker before:     ${before.length} (${activeBefore} active)`);
console.log(`inserts ${inserts.length} | updates ${updates.length} | not in APHIS ${notInAphis.length}`);
for (const r of inserts) console.log(`  + ${r.date} ${r.county}, ${r.state} ${r.animal} ${r.su} ${r.status}`);
for (const u of updates) {
  const was = before.find((r) => r.id === u.id);
  const bits = [];
  if (was.status !== u.status) bits.push(`status ${was.status}->${u.status}`);
  if (was.date !== u.date) bits.push(`date ${was.date}->${u.date}`);
  console.log(`  ~ id${u.id} ${was.county}, ${was.state} ${bits.join(' ')}`);
}

// Active has to balance, or the sync has lost or invented a case.
const expectedActive = activeBefore + newActive + toActive - toInactive;
if (expectedActive !== activeAphis) {
  throw new Error(`active count will not balance: ${activeBefore} + ${newActive} + ${toActive} - ${toInactive} = ${expectedActive}, APHIS says ${activeAphis}`);
}
if (before.length + inserts.length !== aphis.length) {
  throw new Error(`total will not match: ${before.length} + ${inserts.length} != ${aphis.length}`);
}
console.log(`balance ok: ${activeBefore} + ${newActive} - ${toInactive} = ${activeAphis} active, ${aphis.length} total`);

if (!APPLY) {
  console.log('\ndry run -- pass --apply to write');
  process.exit(0);
}

const located = inserts.map((row) => ({ row, coords: getCoords(row.county, row.state) }));
const missing = located.filter((l) => !l.coords);
if (missing.length) throw new Error(`no county coordinates for ${missing.map((l) => `${l.row.county}, ${l.row.state}`).join('; ')}`);

const now = new Date().toISOString();
await sql.transaction([
  ...updates.map((u) => sql`update screwworm_cases set status=${u.status}, date=${u.date}, updated_at=now() where id=${u.id}`),
  ...located.map(({ row, coords }) => sql`
    insert into screwworm_cases (date, species, animal, county, state, lat, lng, status, notes, source_url, aphis_id)
    values (${row.date}, ${row.species}, ${row.animal}, ${row.county}, ${row.state}, ${coords.lat}, ${coords.lng}, ${row.status},
            ${`Added automatically from the APHIS case-level data; confirmed ${row.date}. APHIS reports location at county level, so the pin is approximate; ${row.su}${row.ss ? `, ${row.ss}` : ''}.`},
            ${SOURCE_URL}, ${row.su})`),
  sql`insert into screwworm_metadata (key, value) values ('lastUpdated', ${JSON.stringify(now)}::jsonb)
    on conflict (key) do update set value = excluded.value`,
  sql`insert into screwworm_metadata (key, value) values ('lastChecked', ${JSON.stringify(now)}::jsonb)
    on conflict (key) do update set value = excluded.value`,
]);

const after = await sql`select count(*)::int n, count(*) filter (where status='active')::int act from screwworm_cases`;
console.log(`\nwrote: ${after[0].n} cases / ${after[0].act} active`);
if (after[0].n !== aphis.length || after[0].act !== activeAphis) {
  throw new Error(`post-write check failed: db has ${after[0].n}/${after[0].act}, APHIS has ${aphis.length}/${activeAphis}`);
}
console.log('post-write check ok -- db matches APHIS');

function getCoords(county, state) {
  const name = county.normalize('NFKD').replace(/[^a-zA-Z]/g, '').toLowerCase();
  const base = COUNTIES[`${state}|${name}`];
  if (!base) return null;
  const jitter = () => (Math.random() - 0.5) * 0.06;
  return { lat: base[0] + jitter(), lng: base[1] + jitter() };
}
