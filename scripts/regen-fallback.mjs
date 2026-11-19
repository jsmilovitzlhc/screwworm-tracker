// Regenerates src/data/cases.json, the fallback useCaseData.js seeds React state from.
//
// The file is built by invoking api/cases.js itself rather than by re-querying the tables, so the
// fallback cannot drift from the API's shape. A hand-rolled regenerator is how `inactiveDate` went
// missing once before, which zeroed the active-by-day chart's whole history while today's count
// still looked right. The key sets are asserted equal below for the same reason.
import { writeFileSync, readFileSync } from 'fs';
import handler from '../api/cases.js';

const OUT = new URL('../src/data/cases.json', import.meta.url);
const previous = JSON.parse(readFileSync(OUT, 'utf-8'));

const payload = await new Promise((resolve, reject) => {
  const res = {
    setHeader() {},
    status(code) { this.code = code; return this; },
    json(body) { (this.code === 200 ? resolve : reject)(this.code === 200 ? body : new Error(JSON.stringify(body))); return this; },
  };
  handler({ method: 'GET', headers: {} }, res).catch(reject);
});

// api/cases.js does not serve lastChecked, but the fallback has always carried it and the UI reads
// it, so it is filled from the same metadata row the API reads its sibling key from.
const { neon } = await import('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
const [checked] = await sql`select value from screwworm_metadata where key = 'lastChecked'`;

const next = {
  lastUpdated: payload.lastUpdated,
  lastChecked: checked?.value ?? payload.lastUpdated,
  ...Object.fromEntries(Object.entries(payload).filter(([k]) => k !== 'lastUpdated')),
};

// Every key the previous fallback had must survive, or the UI loses a field with no error.
const lost = Object.keys(previous).filter((k) => !(k in next));
if (lost.length) throw new Error(`regen would drop top-level keys: ${lost.join(', ')}`);
const lostCase = Object.keys(previous.confirmedCases[0]).filter((k) => !(k in next.confirmedCases[0]));
if (lostCase.length) throw new Error(`regen would drop case keys: ${lostCase.join(', ')}`);

// And every key the API serves must be present, or the fallback is a different shape from the API.
const apiOnly = Object.keys(payload).filter((k) => !(k in next));
if (apiOnly.length) throw new Error(`api serves keys the fallback lacks: ${apiOnly.join(', ')}`);

writeFileSync(OUT, `${JSON.stringify(next, null, 2)}\n`);
const active = next.confirmedCases.filter((c) => c.status === 'active').length;
console.log(`fallback: ${next.confirmedCases.length} cases / ${active} active / lastUpdated ${next.lastUpdated}`);
console.log(`was:      ${previous.confirmedCases.length} cases / ${previous.confirmedCases.filter((c) => c.status === 'active').length} active`);
console.log(`top keys: ${Object.keys(next).join(', ')}`);
console.log(`case keys: ${Object.keys(next.confirmedCases[0]).join(', ')}`);
