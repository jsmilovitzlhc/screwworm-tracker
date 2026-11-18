import { neon } from '@neondatabase/serverless';
import { readFileSync, writeFileSync } from 'fs';

const envFile = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}
const sql = neon(process.env.DATABASE_URL);
const JSON_PATH = '/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/src/data/cases.json';

// Texas infested-zone list refresh, Nov 18 2026.
//
// The dashboard's Texas panel carried a 14-county infested-zone list sourced from TAHC on
// Oct 29. TAHC's notice page (tahc.texas.gov/emergency/nws.html) now lists 32 counties, and
// the Executive Director Orders behind the additions are dated Nov 5 through Nov 16 — so the
// panel was 18 counties short on a dashboard whose case count was correct.
//
// Taken verbatim from the TAHC notice, which is the legal source for the zone; the case data
// cannot be used to derive it. THE ZONE IS WIDER THAN THE CASE MAP, and in both directions:
// 10 zone counties have no confirmed animal case in the tracker, because TAHC draws buffers
// around detections rather than county-by-county on confirmed cases, while 3 counties that
// had cases in June (Gillespie, Uvalde, Tom Green) are no longer in the zone at all. Anyone
// reading the case map as the movement-restriction map is wrong in both directions, which is
// the reason this panel matters. The buffer list below is COMPUTED from the case table rather
// than hardcoded — a hand-written list of 7 was wrong on the first attempt.
const TAHC_COUNTIES = [
  'Bandera', 'Brewster', 'Brooks', 'Crockett', 'Culberson', 'Dimmit', 'Edwards', 'El Paso',
  'Fisher', 'Frio', 'Goliad', 'Hidalgo', 'Hudspeth', 'Irion', 'Jeff Davis', 'Jim Hogg',
  'La Salle', 'Medina', 'Mitchell', 'Nolan', 'Pecos', 'Presidio', 'Reagan', 'Reeves',
  'Schleicher', 'Scurry', 'Starr', 'Sutton', 'Terrell', 'Val Verde', 'Zapata', 'Zavala',
];
const ZONE_LINE = `Infested zones with animal movement restrictions currently in parts of ${TAHC_COUNTIES.length} counties: ${TAHC_COUNTIES.join(', ')} (TAHC notice, Nov 16, 2026)`;
const casedTx = new Set((await sql`SELECT DISTINCT county FROM screwworm_cases WHERE state = 'TX'`).map(r => r.county));
const bufferOnly = TAHC_COUNTIES.filter(c => !casedTx.has(c));
const casedNotZoned = [...casedTx].filter(c => !TAHC_COUNTIES.includes(c)).sort();
const BUFFER_LINE = `The infested zone does not match the confirmed-case map in either direction: ${bufferOnly.length} zone counties have no confirmed animal case (${bufferOnly.join(', ')}) because TAHC buffers around detections, while ${casedNotZoned.join(', ')} had cases in June and are no longer zoned`;

const rows = await sql`SELECT value FROM screwworm_metadata WHERE key = 'stateResponses'`;
if (rows.length !== 1) throw new Error('stateResponses metadata row not found');
const stateResponses = rows[0].value;

const texas = stateResponses.find(s => s.state === 'Texas');
if (!texas) throw new Error('Texas entry not found in stateResponses');

const idx = texas.actions.findIndex(a => a.startsWith('Infested zones with animal movement restrictions'));
if (idx < 0) throw new Error('infested-zone line not found in Texas actions');
const previous = texas.actions[idx];
texas.actions[idx] = ZONE_LINE;
const bIdx = texas.actions.findIndex(a => a.startsWith('The infested zone'));
if (bIdx >= 0) texas.actions[bIdx] = BUFFER_LINE;
else texas.actions.splice(idx + 1, 0, BUFFER_LINE);

await sql`
  INSERT INTO screwworm_metadata (key, value) VALUES ('stateResponses', ${JSON.stringify(stateResponses)})
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
`;

// keep the fallback in step
const fallback = JSON.parse(readFileSync(JSON_PATH, 'utf-8'));
fallback.stateResponses = stateResponses;
fallback.lastChecked = new Date().toISOString();
writeFileSync(JSON_PATH, JSON.stringify(fallback, null, 2) + '\n');

// assertions
const check = (await sql`SELECT value FROM screwworm_metadata WHERE key = 'stateResponses'`)[0].value;
const checkTx = check.find(s => s.state === 'Texas');
if (checkTx.actions[idx] !== ZONE_LINE) throw new Error('ASSERTION FAILED: DB zone line did not persist');
if (JSON.stringify(fallback.stateResponses) !== JSON.stringify(check)) throw new Error('ASSERTION FAILED: fallback stateResponses != DB stateResponses');
const zoneNoCase = bufferOnly, caseNoZone = casedNotZoned;

console.log('BEFORE:', previous);
console.log('AFTER :', ZONE_LINE);
console.log('');
console.log(`zone counties: ${TAHC_COUNTIES.length} (was 14)`);
console.log(`in zone, no confirmed case (${zoneNoCase.length}): ${zoneNoCase.join(', ')}`);
console.log(`has case, not in zone (${caseNoZone.length}): ${caseNoZone.join(', ')}`);
console.log('ASSERTIONS PASSED');
