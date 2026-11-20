// Asserts the csv parser still finds every column under each caption APHIS has shipped.
//
// The subject-id column has been renamed twice -- "Animal ID" -> "... Animal Id Pk" -> "Animal ID"
// -- and each rename silently killed the 4-hourly cron, because a missing column throws before any
// row is read. Both captions are pinned here so the next rename is caught by this script and not by
// the tracker quietly falling days behind.
import assert from 'node:assert/strict';
import { parseCsv, canonicalId, toIsoDate } from '../api/_lib/aphis.js';

const ROW = '"Texas, MEDINA, SU:29121:27, SS:13002:27",Domestic,Domestic,11/18/2026,Medina,Cattle,Texas,Active,11/18/2026,';
const HEADERS = {
  'Animal ID (pre-Nov-2026 and current)':
    'Animal ID,Animal Type,Case Type,Confirmed Date,County,Species,State,Status,Min. Confirmed Date,Blank',
  'Animal Id Pk (the Nov 19 2026 rename)':
    'SCREWWORM Animal Id Pk,Animal Type,Case Type,Confirmed Date,County,Species,State,Status,Min. Confirmed Date,Blank',
};

for (const [label, header] of Object.entries(HEADERS)) {
  const [row] = parseCsv(`${header}\n${ROW}`);
  assert.equal(row.animalId, 'Texas, MEDINA, SU:29121:27, SS:13002:27', `${label}: animalId`);
  assert.equal(row.caseType, 'Domestic', `${label}: caseType`);
  // "Confirmed Date", not the "Min. Confirmed Date" that also contains the needle.
  assert.equal(row.date, '11/18/2026', `${label}: date`);
  assert.equal(row.county, 'Medina', `${label}: county`);
  assert.equal(row.species, 'Cattle', `${label}: species`);
  assert.equal(row.state, 'Texas', `${label}: state`);
  assert.equal(row.status, 'Active', `${label}: status`);
  console.log(`ok  ${label}`);
}

// Both id separators APHIS has used have to canonicalise to the colon form, or one case inserts twice.
assert.equal(canonicalId('Texas, MEDINA, SU:29121:27', 'SU'), 'SU:29121:27');
assert.equal(canonicalId('Texas, MEDINA, SU29063.27', 'SU'), 'SU:29063:27');
console.log('ok  subject id canonicalises from both separators');

// M/D/YYYY must not go through Date(), which would reread it in the local zone.
assert.equal(toIsoDate('11/18/2026'), '2026-11-18');
assert.equal(toIsoDate('1/5/2026'), '2026-01-05');
assert.equal(toIsoDate('2026-11-18'), '2026-11-18');
console.log('ok  dates parse without a timezone shift');

// A caption APHIS has never used must still fail loudly rather than silently mismatching a column.
assert.throws(
  () => parseCsv(`Subject,Animal Type,Case Type,Confirmed Date,County,Species,State,Status\n${ROW}`),
  /Column "animal id" \/ "id pk" is missing/,
);
console.log('ok  an unknown caption throws');
console.log('\nall column checks passed');
