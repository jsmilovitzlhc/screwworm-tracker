import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { fetchAphisCases } from '../api/_lib/aphis.js';

// One-time migration for the automated sync. Usage: node scripts/add-aphis-id.mjs /path/to/.env.local
//
// Gives every case its APHIS subject id so the cron can match on it. Notes can't be trusted for
// this because they also cite other cases' ids, so a note's id only counts when county, species
// and date agree. Also repairs the id sequence, which was left behind by explicit-id inserts and
// would otherwise make the cron's inserts collide.
for (const line of readFileSync(process.argv[2], 'utf-8').split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}
const sql = neon(process.env.DATABASE_URL);

const db = await sql`select id, date::text date, species, county, state, status, notes from screwworm_cases order by date, id`;
const pool = await fetchAphisCases();
const group = (r) => `${r.state}|${r.county}|${r.species}`;
const take = (row, test) => {
  const i = pool.findIndex((p) => group(p) === group(row) && test(p));
  return i < 0 ? null : pool.splice(i, 1)[0];
};

const paired = new Map();
for (const row of db) {
  const cited = row.notes?.match(/SU:\d+:\d+/g) ?? [];
  const hit = take(row, (p) => p.date === row.date && cited.includes(p.su));
  if (hit) paired.set(row.id, hit);
}
for (const test of [
  (row) => (p) => p.date === row.date && p.status === row.status,
  (row) => (p) => p.date === row.date,
  () => () => true,
]) {
  for (const row of db) {
    if (paired.has(row.id)) continue;
    const hit = take(row, test(row));
    if (hit) paired.set(row.id, hit);
  }
}

const unmatched = db.filter((r) => !paired.has(r.id)).map((r) => r.id);
const differs = db.filter((r) => paired.has(r.id) && (paired.get(r.id).date !== r.date || paired.get(r.id).status !== r.status));
console.log(`cases ${db.length}, paired ${paired.size}, APHIS rows left for the cron to add ${pool.length}`, pool.map((p) => p.su));
console.log('differs from APHIS (the cron will update):', differs.map((r) => [r.id, r.date, r.status, paired.get(r.id).su, paired.get(r.id).date, paired.get(r.id).status]));
if (unmatched.length) throw new Error(`Tracker cases with no APHIS row: ${unmatched}`);

await sql.transaction([
  sql`alter table screwworm_cases add column if not exists aphis_id text`,
  sql`create unique index if not exists screwworm_cases_aphis_id on screwworm_cases (aphis_id)`,
  ...[...paired].map(([id, p]) => sql`update screwworm_cases set aphis_id=${p.su} where id=${id}`),
  sql`select setval('screwworm_cases_id_seq', (select max(id) from screwworm_cases))`,
]);

const [after] = await sql`select count(*)::int n, count(aphis_id)::int with_id, count(distinct aphis_id)::int uniq, (select last_value from screwworm_cases_id_seq)::int seq, max(id)::int max_id from screwworm_cases`;
console.log(after);
if (after.with_id !== after.n || after.uniq !== after.n || after.seq !== after.max_id) throw new Error('Migration end state is wrong');
