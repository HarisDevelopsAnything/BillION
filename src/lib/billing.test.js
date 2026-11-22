// Run with:  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, DEFAULT_VEHICLES } from './defaults.js';
import { applyLineChange, blankBill, calcBill, calcLine, formatTime12, makeSnap, parseTime12, rupeesInWords, stateHint } from './billing.js';
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

test('day rent includes editable fuel cost defaulted from vehicle fuel cost per km', () => {
  crysta.dayRent = 3000;
  crysta.fuelCostPerKm = 12;
  const L = line({ useDayRent: true, dayRentDays: '3', km: '100', fuelCost: '' });
  const r = calcLine(L, S);
  assert.equal(r.defaultFuelCost, 1200);
  assert.equal(r.fuelCost, 1200);
  assert.equal(r.amount, 10200);

  const overridden = calcLine(line({ useDayRent: true, dayRentDays: '3', km: '100', fuelCost: '1500' }), S);
  assert.equal(overridden.amount, 10500);
  crysta.dayRent = '';
  crysta.fuelCostPerKm = '';
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

test('time values convert between 24-hour storage and 12-hour display', () => {
  assert.equal(formatTime12('00:05'), '12:05 AM');
  assert.equal(formatTime12('12:30'), '12:30 PM');
  assert.equal(formatTime12('21:20'), '9:20 PM');
  assert.equal(parseTime12('12:05 AM'), '00:05');
  assert.equal(parseTime12('12:30 PM'), '12:30');
  assert.equal(parseTime12('9:20 PM'), '21:20');
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

test('printed and Excel models show extra hour rate calculation', () => {
  const b = blankBill(S, V);
  b.lines = [line({ km: '100', runT: '9:20' })];
  const m = invoiceModel(b, S);
  assert.equal(m.prog[0].extraHrText, '2X250=500');
  assert.match(invoiceHTML(m), />2X250=500</);
});

const sampleBill = (taxType) => {
  const b = blankBill(S, V);
  b.lines = [line({ type: 'airport', km: '63', runT: '2:35' }), line({ type: 'airport', date: '2026-09-06', km: '65', runT: '3:30' })];
  b.toll = '160';
  if (taxType) b.taxType = taxType;
  return b;
};

test('other state: one IGST line (default)', () => {
  const c = calcBill(sampleBill(), S);
  assert.equal(c.taxType, 'igst');
  assert.deepEqual([c.igst, c.cgst, c.sgst, c.tax], [210.4, 0, 0, 210.4]);
});

test('same state: GST rate split equally into CGST and SGST', () => {
  const c = calcBill(sampleBill('cgst_sgst'), S);
  assert.deepEqual([c.igst, c.cgst, c.sgst, c.tax], [0, 105.2, 105.2, 210.4]);
  assert.equal(c.grand, 4368); // tax is shown, not added (reverse charge), same as IGST
});

test('when GST is added to the bill, IGST and CGST+SGST give the same grand total', () => {
  const on = { ...S, addIgst: true };
  assert.equal(calcBill(sampleBill('igst'), on).grand, 4578.4);
  assert.equal(calcBill(sampleBill('cgst_sgst'), on).grand, 4578.4);
});

test('new bills start with the default tax type from settings; old bills without one stay IGST', () => {
  assert.equal(blankBill({ ...S, defaultTaxType: 'cgst_sgst' }, V).taxType, 'cgst_sgst');
  const old = sampleBill(); delete old.taxType;
  assert.equal(calcBill(old, S).taxType, 'igst');
});

test('printed bill lists CGST and SGST (or IGST) with the right labels', () => {
  const same = invoiceHTML(invoiceModel(sampleBill('cgst_sgst'), S));
  assert.match(same, />CGST 2\.5%/); assert.match(same, />SGST 2\.5%/); assert.doesNotMatch(same, />IGST 5%/);
  const inter = invoiceHTML(invoiceModel(sampleBill('igst'), S));
  assert.match(inter, />IGST 5%/); assert.doesNotMatch(inter, />CGST 2\.5%/);
});

test('state-code hint appears only when GST numbers disagree with the chosen tax type', () => {
  const S2 = { ...S, company: { ...S.company, gstin: '33ABCDE1234F1Z5' } };
  const b = sampleBill('igst'); b.client = { name: 'X', address: '', gstin: '33XYZ' };
  assert.match(stateHint(S2, b), /same state/);
  b.taxType = 'cgst_sgst'; assert.equal(stateHint(S2, b), '');
  b.client.gstin = '27XYZ'; assert.match(stateHint(S2, b), /different state/);
  b.client.gstin = ''; assert.equal(stateHint(S2, b), '');
});
