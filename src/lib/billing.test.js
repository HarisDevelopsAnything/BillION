// Run with:  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, DEFAULT_VEHICLES } from './defaults.js';
import { applyLineChange, blankBill, calcBill, calcLine, makeSnap, rupeesInWords } from './billing.js';
import { invoiceModel, invoiceHTML } from './invoice.js';
import { buildXlsx } from './xlsx.js';

const S = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
const V = JSON.parse(JSON.stringify(DEFAULT_VEHICLES));
const crysta = V.find((v) => v.name === 'INNOVA CRYSTA');
const line = (over) => {
  const L = { date: '2026-09-03', vehicle: 'INNOVA CRYSTA', type: 'local', cabNo: '', startKm: '', endKm: '', km: '', startT: '', endT: '', runT: '', days: '1', hills: '0', ...over };
  L.snap = makeSnap(L.type, crysta, S.tripTypes);
  return L;
};

test('sample invoice: two Crysta airport trips + Rs.160 toll = Rs.4,368', () => {
  const b = blankBill(S, V);
  b.lines = [line({ type: 'airport', km: '63', runT: '2:35' }), line({ type: 'airport', date: '2026-09-06', km: '65', runT: '3:30' })];
  b.toll = '160';
  const c = calcBill(b, S);
  assert.deepEqual(c.lines.map((l) => l.amount), [2083, 2125]);
  assert.equal(c.total, 4208);
  assert.equal(c.igst, 210.4);
  assert.equal(c.grand, 4368);
  assert.equal(rupeesInWords(c.grand), 'Rupees Four thousand three hundred and sixty eight only');
});

test('local trip: extra km and extra hours both charged, hours round up', () => {
  const r = calcLine(line({ km: '100', runT: '9:20' }), S);
  assert.equal(r.extraHrs, 2);
  assert.equal(r.amount, 3400 + 2 * 250 + 20 * 21);
});

test('airport extra hr / km follow the local rates', () => {
  const r = calcLine(line({ type: 'airport', km: '50', runT: '5:10' }), S);
  assert.equal(r.amount, 1600 + 2 * 250 + 10 * 21);
});

test('outstation: daily minimum km, driver allowance per day', () => {
  assert.equal(calcLine(line({ type: 'outstation', days: '2', km: '500' }), S).amount, 600 * 21 + 800);
  assert.equal(calcLine(line({ type: 'outstation', days: '2', km: '700' }), S).amount, 700 * 21 + 800);
});

test('hills charge is separate, per hill trip', () => {
  assert.equal(calcLine(line({ km: '80', runT: '8:00', hills: '2' }), S).hills, 2000);
});

test('half-hour rounding and grace minutes', () => {
  assert.equal(calcLine(line({ km: '80', runT: '9:10' }), { ...S, extraUnitMin: 30 }).extraHrs, 1.5);
  assert.equal(calcLine(line({ km: '80', runT: '8:10' }), { ...S, graceMin: 15 }).extraHrs, 0);
  assert.equal(calcLine(line({ km: '80', runT: '8:20' }), { ...S, graceMin: 15 }).extraHrs, 1);
});

test('rates are copied into the trip, so a later rate change does not alter it', () => {
  const L = line({ km: '100', runT: '8:00' });
  const before = calcLine(L, S).amount;
  crysta.localPkg = 9999;
  assert.equal(calcLine(L, S).amount, before);
  crysta.localPkg = 3400;
});

test('typing start/end km and times fills km run and time run', () => {
  let L = line({});
  L = applyLineChange(L, 'startKm', '293711', V, S);
  L = applyLineChange(L, 'endKm', '293774', V, S);
  L = applyLineChange(L, 'startT', '06:00', V, S);
  L = applyLineChange(L, 'endT', '08:35', V, S);
  assert.equal(L.km, '63');
  assert.equal(L.runT, '2:35');
});

test('amount in words', () => {
  assert.equal(rupeesInWords(4068), 'Rupees Four thousand and sixty eight only');
  assert.equal(rupeesInWords(123456), 'Rupees One lakh twenty three thousand four hundred and fifty six only');
  assert.equal(rupeesInWords(10000000), 'Rupees One crore only');
  assert.equal(rupeesInWords(4368.5), 'Rupees Four thousand three hundred and sixty eight and fifty paise only');
});

test('invoice model, printed HTML and .xlsx are produced', async () => {
  const b = blankBill(S, V);
  b.client = { name: 'Test Client', address: '12 Road', gstin: '27ABC' };
  b.lines = [line({ type: 'airport', km: '63', runT: '2:35' }), line({ type: 'outstation', days: '2', km: '520' })];
  const m = invoiceModel(b, S);
  assert.equal(m.grand, 2083 + 13400 + 0);
  assert.match(invoiceHTML(m), /TAX INVOICE/);
  const blob = buildXlsx(m);
  const head = new Uint8Array(await blob.arrayBuffer()).slice(0, 2);
  assert.equal(String.fromCharCode(head[0], head[1]), 'PK');
});
