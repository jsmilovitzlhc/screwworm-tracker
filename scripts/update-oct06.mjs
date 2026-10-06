import { neon } from '@neondatabase/serverless';
import { readFileSync, writeFileSync } from 'fs';

const envFile = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}

const sql = neon(process.env.DATABASE_URL);

// APHIS dashboard sync (data as of Oct 6, 2026) — 52 domestic animal cases / 3 active / 49 inactive.
//
// ONE new domestic animal case: #53, a dog in Brewster County, TX, confirmed Oct 2.
// Corroborated three ways: the APHIS public Tableau export (October 2026 row: 1 domestic,
// 1 active), Houston Public Media (Oct 4), and the GenomicEpi tracker (updated Oct 2).
// TAHC's Third Modified Executive Director Order for Brewster and Pecos Counties (Oct 3)
// is consistent with a fresh Brewster detection.
//
// ON THE "53rd CASE": APHIS's 53 headline is NOT 53 animal cases. The live export
// (publicdashboards.dl.usda.gov/t/MRP_PUB/views/
//  NewWorldScrewwormPublicReporting_17805168329840/SummaryDashboard.csv) reports:
//   July 2026:      14 domestic / 14 total,  0 active, 14 inactive
//   August 2026:     4 domestic /  4 total,  0 active,  4 inactive
//   September 2026:  3 domestic /  4 total,  2 active,  1 inactive   <-- total EXCEEDS domestic by 1
//   October 2026:    1 domestic /  1 total,  1 active,  0 inactive
// The September row is the whole answer: the extra unit in "Total Cases" is the Sep 25
// Brewster County fly-trap detection (a wild NWS fly in a surveillance trap), which APHIS
// counts under total cases but not under domestic animal cases. So:
//   53 total = 52 domestic animal cases + 1 wild fly-trap detection
// There is no un-ingested 53rd animal case. The fly trap is already carried here as a
// Sep 25 timeline note (added in the Oct 2 sync); promoting it to a case row would break
// domestic-count parity with APHIS. "51 in Texas" likewise only reconciles if the fly trap
// is counted: 49 existing TX cases + the new dog + the fly trap = 51.
//
// CAVEAT on the export: the CSV's month window has scrolled forward and June 2026
// (30 total / 0 active / 30 inactive) is no longer emitted. June is asserted below from the
// tracker's own previously-verified state, not from this fetch — the same caveat the Sep 30
// and Oct 2 syncs carried. The arithmetic reconciles to the dashboard headline:
// 30 + 14 + 4 + 3 + 1 = 52 domestic, all 3 active in Sept/Oct => 49 inactive.
//
// CANINE NUMBERING: this is the FIFTH canine case of the US outbreak, not the fourth.
// Prior dogs: #4 Lea NM (Jun 7), #29 Pecos TX (Jun 30), #37 Sutton TX (Jul 13),
// #49 Crockett TX (Aug 31). It is the fourth canine case *in Texas*, which is the likely
// origin of the "4th canine" framing in press coverage.
//
// TIMELINE DRIFT REPAIR: the Neon timeline had only 30 entries while src/data/cases.json
// carried 47, so production (which reads the DB) rendered a thinner history than the static
// fallback. The DB set was a clean subset — no DB-only dates — except that two entries
// (2026-06-27 Case 27, 2026-06-30 Cases 30-31) had strictly richer wording in the DB.
// This sync reconciles both stores to the union: all 47 JSON entries, with those two
// upgraded to the DB's fuller text, plus the new Oct 2 and Oct 6 entries.

const JSON_PATH = '/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/src/data/cases.json';

const NEW_CASE = {
  id: 53,
  date: '2026-10-02',
  species: 'Canine',
  animal: 'Dog',
  county: 'Brewster',
  state: 'TX',
  lat: 29.85,
  lng: -103.18,
  status: 'active',
  notes: 'Fifth Brewster County case; fifth canine (dog) detection of the US outbreak and '
    + 'fourth in Texas; confirmed per APHIS dashboard (October 2026: 1 domestic case, 1 active) '
    + 'and Houston Public Media Oct 4',
};

const EXPECTED_ACTIVE = [51, 52, 53];

// Post-update per-month truth. July/Aug/Sept/Oct from today's CSV fetch;
// June carried forward (see CAVEAT above).
const APHIS_BY_MONTH = {
  '2026-06': { total: 30, active: 0, inactive: 30 },
  '2026-07': { total: 14, active: 0, inactive: 14 },
  '2026-08': { total: 4, active: 0, inactive: 4 },
  '2026-09': { total: 3, active: 2, inactive: 1 },
  '2026-10': { total: 1, active: 1, inactive: 0 },
};

// Entries whose DB wording is strictly richer than the JSON wording; the union keeps these.
const RICHER_FROM_DB = [
  {
    date: '2026-06-27',
    match: 'Case 27:',
    event: 'Case 27: cattle in Crockett County — US total reaches 27 with 21 active and 6 inactive',
  },
  {
    date: '2026-06-30',
    match: 'Cases 30–31:',
    event: 'Cases 30–31: two sheep in Crockett County, TX — US total reaches 31 with 22 active across 13 counties',
  },
];

const TIMELINE_ENTRIES = [
  {
    date: '2026-10-02',
    event: 'Case 53: dog in Brewster County, TX — fifth Brewster County case and fifth canine '
      + 'detection of the US outbreak (fourth in Texas); US total reaches 52 domestic animal cases '
      + 'with 3 active (51 Grant NM horse, 52 Crockett goat, 53 Brewster dog)',
  },
  {
    date: '2026-10-06',
    event: 'APHIS reconciliation: the dashboard\'s 53 headline is 52 domestic animal cases plus the '
      + 'Sep 25 Brewster County fly-trap detection, which APHIS counts under total cases but not '
      + 'under domestic animal cases. No un-ingested animal case; tracker at 52 with 3 active',
  },
];

const SPECIES_BREAKDOWN = (() => {
  const counts = [
    ['Bovine (Cattle)', 22],
    ['Canine (Dogs)', 5],
    ['Caprine (Goats)', 7],
    ['Equine (Horses)', 2],
    ['Ovine (Sheep)', 16],
  ];
  const total = counts.reduce((s, [, n]) => s + n, 0);
  if (total !== 52) throw new Error(`speciesBreakdown sums to ${total}, expected 52`);
  return counts.map(([species, count]) => ({
    species,
    count,
    percentage: Math.round((count / total) * 100),
  }));
})();

function mergeTimeline(base) {
  const out = base.map(e => ({ ...e }));
  for (const fix of RICHER_FROM_DB) {
    const hit = out.find(e => e.date === fix.date && e.event.startsWith(fix.match));
    if (!hit) throw new Error(`Timeline repair target not found: ${fix.date} ${fix.match}`);
    hit.event = fix.event;
  }
  for (const entry of TIMELINE_ENTRIES) {
    if (out.some(e => e.date === entry.date && e.event.slice(0, 20) === entry.event.slice(0, 20))) {
      console.log(`Timeline already has a ${entry.date} entry — left as is`);
    } else {
      out.push({ ...entry });
      console.log(`Timeline entry added for ${entry.date}`);
    }
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

try {
  const before = await sql`
    SELECT COUNT(*) AS "total",
           COUNT(*) FILTER (WHERE status = 'active') AS "active"
    FROM screwworm_cases
  `;
  console.log(`Before: ${before[0].total} total, ${before[0].active} active`);
  if (Number(before[0].total) !== 51 || Number(before[0].active) !== 2) {
    console.log('✗ Unexpected starting state (wanted 51 total / 2 active)');
    process.exit(1);
  }

  // --- 1. Insert case #53 ---
  const clash = await sql`SELECT id FROM screwworm_cases WHERE id = ${NEW_CASE.id}`;
  if (clash.length > 0) {
    console.log(`Case #${NEW_CASE.id} already present — skipping insert`);
  } else {
    const dupe = await sql`
      SELECT id FROM screwworm_cases
      WHERE date = ${NEW_CASE.date} AND county = ${NEW_CASE.county} AND animal = ${NEW_CASE.animal}
    `;
    if (dupe.length > 0) {
      console.log(`✗ A ${NEW_CASE.date} ${NEW_CASE.county} ${NEW_CASE.animal} already exists as #${dupe[0].id}`);
      process.exit(1);
    }
    const inserted = await sql`
      INSERT INTO screwworm_cases (id, date, species, animal, county, state, lat, lng, status, notes)
      VALUES (${NEW_CASE.id}, ${NEW_CASE.date}, ${NEW_CASE.species}, ${NEW_CASE.animal},
              ${NEW_CASE.county}, ${NEW_CASE.state}, ${NEW_CASE.lat}, ${NEW_CASE.lng},
              ${NEW_CASE.status}, ${NEW_CASE.notes})
      RETURNING id, date, county, state, animal, status
    `;
    console.log('Inserted:', JSON.stringify(inserted[0]));
  }

  // --- 2. Confirm the three expected active cases, and only those ---
  const stale = await sql`
    SELECT id, date, county, animal FROM screwworm_cases
    WHERE status = 'active' AND id NOT IN (51, 52, 53) ORDER BY id
  `;
  if (stale.length > 0) {
    console.log(`✗ Unexpected active cases: ${JSON.stringify(stale)}`);
    process.exit(1);
  }
  // Case #50 (Presidio horse) should already be inactive from the Oct 1 transition.
  const c50 = await sql`SELECT id, county, animal, status FROM screwworm_cases WHERE id = 50`;
  if (c50[0].county !== 'Presidio' || c50[0].animal !== 'Horse') {
    console.log(`✗ Case #50 is ${c50[0].animal} in ${c50[0].county} — expected Horse in Presidio`);
    process.exit(1);
  }
  if (c50[0].status !== 'inactive') {
    console.log(`✗ Case #50 is ${c50[0].status} — Oct 1 timeline says it should be inactive`);
    process.exit(1);
  }
  console.log('✓ Case #50 (Presidio horse) correctly inactive');

  // --- 3. Timeline: new events + drift repair ---
  const ctxRows = await sql`SELECT value FROM screwworm_metadata WHERE key = 'internationalContext'`;
  if (ctxRows.length === 0) {
    console.log('✗ internationalContext metadata row missing');
    process.exit(1);
  }
  const ctx = typeof ctxRows[0].value === 'string' ? JSON.parse(ctxRows[0].value) : ctxRows[0].value;

  const json = JSON.parse(readFileSync(JSON_PATH, 'utf-8'));
  const dbDates = new Set((ctx.timeline || []).map(e => e.date));
  const jsonDates = new Set(json.internationalContext.timeline.map(e => e.date));
  const dbOnly = [...dbDates].filter(d => !jsonDates.has(d));
  if (dbOnly.length > 0) {
    console.log(`✗ DB timeline has dates absent from JSON (would be lost): ${JSON.stringify(dbOnly)}`);
    process.exit(1);
  }

  const mergedTimeline = mergeTimeline(json.internationalContext.timeline);
  console.log(`Timeline: DB had ${(ctx.timeline || []).length}, JSON had ${json.internationalContext.timeline.length}, merged to ${mergedTimeline.length}`);
  ctx.timeline = mergedTimeline;

  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('internationalContext', ${JSON.stringify(ctx)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;

  // --- 4. Species breakdown (Canine 4 -> 5, denominator 51 -> 52) ---
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('speciesBreakdown', ${JSON.stringify(SPECIES_BREAKDOWN)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log('speciesBreakdown:', JSON.stringify(SPECIES_BREAKDOWN));

  // --- 5. Timestamps ---
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify('2026-10-06T00:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastChecked', ${JSON.stringify('2026-10-06T09:45:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log('Updated timestamps to lastUpdated=2026-10-06');

  // --- 6. Mirror everything into the static fallback ---
  if (!json.confirmedCases.some(c => c.id === NEW_CASE.id)) {
    json.confirmedCases.push({ ...NEW_CASE });
  }
  json.internationalContext.timeline = mergedTimeline;
  json.speciesBreakdown = SPECIES_BREAKDOWN;
  json.lastUpdated = '2026-10-06T00:00:00Z';
  json.lastChecked = '2026-10-06T09:45:00Z';
  writeFileSync(JSON_PATH, `${JSON.stringify(json, null, 2)}\n`);
  console.log(`Wrote fallback: ${json.confirmedCases.length} cases, ${json.internationalContext.timeline.length} timeline entries`);

  // --- Verify against APHIS ---
  const after = await sql`
    SELECT COUNT(*) AS "total",
           COUNT(*) FILTER (WHERE status = 'active') AS "active",
           COUNT(*) FILTER (WHERE status = 'inactive') AS "inactive"
    FROM screwworm_cases
  `;
  console.log(`\nAfter: ${after[0].total} total, ${after[0].active} active, ${after[0].inactive} inactive`);
  if (Number(after[0].total) !== 52 || Number(after[0].active) !== 3 || Number(after[0].inactive) !== 49) {
    console.log(`✗ Mismatch! Expected 52 / 3 / 49 — got ${after[0].total} / ${after[0].active} / ${after[0].inactive}`);
    process.exit(1);
  }
  console.log('✓ Counts match APHIS (52 domestic, 3 active, 49 inactive; 53 total incl. fly trap)');

  const activeRows = await sql`SELECT id, date, county, state, animal FROM screwworm_cases WHERE status = 'active' ORDER BY id`;
  const activeIds = activeRows.map(r => r.id);
  if (JSON.stringify(activeIds) !== JSON.stringify(EXPECTED_ACTIVE)) {
    console.log(`✗ Active ids ${JSON.stringify(activeIds)} != expected ${JSON.stringify(EXPECTED_ACTIVE)}`);
    process.exit(1);
  }
  console.log('Active cases:', JSON.stringify(activeRows));

  const badStatus = await sql`SELECT DISTINCT status FROM screwworm_cases WHERE status NOT IN ('active', 'inactive')`;
  if (badStatus.length > 0) {
    console.log(`✗ Unexpected status values: ${JSON.stringify(badStatus)}`);
    process.exit(1);
  }

  const byMonth = await sql`
    SELECT to_char(date, 'YYYY-MM') AS "month",
           COUNT(*) AS "total",
           COUNT(*) FILTER (WHERE status = 'active') AS "active",
           COUNT(*) FILTER (WHERE status = 'inactive') AS "inactive"
    FROM screwworm_cases GROUP BY 1 ORDER BY 1
  `;
  for (const row of byMonth) {
    const want = APHIS_BY_MONTH[row.month];
    if (!want) {
      console.log(`✗ Unexpected month ${row.month} in tracker but not in APHIS truth table`);
      process.exit(1);
    }
    if (Number(row.total) !== want.total || Number(row.active) !== want.active || Number(row.inactive) !== want.inactive) {
      console.log(`✗ ${row.month}: tracker ${row.total}/${row.active}/${row.inactive} != APHIS ${want.total}/${want.active}/${want.inactive}`);
      process.exit(1);
    }
    console.log(`✓ ${row.month}: ${row.total} total, ${row.active} active, ${row.inactive} inactive`);
  }
  if (byMonth.length !== Object.keys(APHIS_BY_MONTH).length) {
    console.log('✗ Month count mismatch vs APHIS truth table');
    process.exit(1);
  }

  // Species breakdown must agree with the actual case rows.
  const SPECIES_LABEL = {
    Bovine: 'Bovine (Cattle)',
    Canine: 'Canine (Dogs)',
    Caprine: 'Caprine (Goats)',
    Equine: 'Equine (Horses)',
    Ovine: 'Ovine (Sheep)',
  };
  const bySpecies = await sql`SELECT species, COUNT(*) AS "count" FROM screwworm_cases GROUP BY 1 ORDER BY 1`;
  for (const row of bySpecies) {
    const want = SPECIES_BREAKDOWN.find(s => s.species === SPECIES_LABEL[row.species]);
    if (!want) {
      console.log(`✗ Species ${row.species} has no breakdown entry`);
      process.exit(1);
    }
    if (Number(row.count) !== want.count) {
      console.log(`✗ ${row.species}: ${row.count} rows != breakdown ${want.count}`);
      process.exit(1);
    }
    console.log(`✓ ${want.species}: ${want.count} (${want.percentage}%)`);
  }

  // Fallback JSON must agree with the DB.
  const dbIds = (await sql`SELECT id FROM screwworm_cases ORDER BY id`).map(r => r.id);
  const jsonIds = [...json.confirmedCases.map(c => c.id)].sort((a, b) => a - b);
  if (JSON.stringify(dbIds) !== JSON.stringify(jsonIds)) {
    console.log('✗ Fallback JSON ids diverge from DB ids');
    process.exit(1);
  }
  console.log(`✓ Fallback JSON in parity with DB (${jsonIds.length} cases, ${mergedTimeline.length} timeline entries)`);

  console.log('\nDone!');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
