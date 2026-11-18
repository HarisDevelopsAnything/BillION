import { num, r2, blank, pad, plain, todayISO } from './util.js';

export const KINDS = ['local', 'airport', 'outstation'];

export function tripName(k, tt) {
  const t = tt[k];
  if (k === 'local') return `Local (${t.km} km / ${t.hours} hr)`;
  if (k === 'airport') return `Airport duty (${t.hours} hr / ${t.km} km)`;
  return `Outstation (${t.kmPerDay} km per day)`;
}

/* Copy of the rates a trip is billed with, so later rate edits never change a saved bill. */
export function makeSnap(type, vehicle, tt) {
  const v = vehicle || {};
  const t = tt[type] || {};
  let s;
  if (type === 'airport') {
    s = {
      pkg: num(v.airPkg),
      xHr: blank(v.airHr) ? num(v.localHr) : num(v.airHr),   // blank = same as local
      xKm: blank(v.airKm) ? num(v.localKm) : num(v.airKm),
      incHrs: t.hours, incKm: t.km,
    };
  } else if (type === 'outstation') {
    s = { outKm: num(v.outKm), driver: num(v.driver), kmPerDay: t.kmPerDay };
  } else {
    s = { pkg: num(v.localPkg), xHr: num(v.localHr), xKm: num(v.localKm), incHrs: t.hours, incKm: t.km };
  }
  s.hill = num(v.hill);
  return s;
}

export function parseRun(s) {
  s = String(s == null ? '' : s).trim();
  if (!s) return 0;
  const m = s.match(/^(\d+):(\d{1,2})$/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  return Math.round(num(s) * 60); // plain number = decimal hours
}
export const fmtRun = (min) => Math.floor(min / 60) + ':' + pad(min % 60);

export function calcLine(L, S) {
  const s = L.snap || {};
  const r = { kind: L.type, pkg: 0, runMin: 0, extraHrs: 0, extraHrCharge: 0, extraKm: 0, extraKmCharge: 0, amount: 0, hills: 0 };
  const km = num(L.km);
  if (L.type === 'outstation') {
    r.days = Math.max(1, Math.round(num(L.days)) || 1);
    r.minKm = num(s.kmPerDay) * r.days;
    r.billKm = Math.max(km, r.minKm);
    r.kmCharge = r2(r.billKm * num(s.outKm));
    r.driver = r2(r.days * num(s.driver));
    r.amount = r2(r.kmCharge + r.driver);
  } else {
    r.pkg = num(s.pkg);
    r.runMin = parseRun(L.runT);
    const extra = r.runMin - num(s.incHrs) * 60;
    if (extra > num(S.graceMin)) {
      const unit = num(S.extraUnitMin) || 60;
      r.extraHrs = (Math.ceil(extra / unit) * unit) / 60;
    }
    r.extraHrCharge = r2(r.extraHrs * num(s.xHr));
    r.extraKm = Math.max(0, km - num(s.incKm));
    r.extraKmCharge = r2(r.extraKm * num(s.xKm));
    r.amount = r2(r.pkg + r.extraHrCharge + r.extraKmCharge);
  }
  r.hills = r2(num(L.hills) * num(s.hill));
  return r;
}

export function calcBill(b, S) {
  const lines = b.lines.map((L) => calcLine(L, S));
  let prog = 0, out = 0, hills = 0;
  lines.forEach((r) => { if (r.kind === 'outstation') out += r.amount; else prog += r.amount; hills += r.hills; });
  prog = r2(prog); out = r2(out); hills = r2(hills);
  const total = r2(prog + out + hills);
  // Other state: one IGST line. Same state: the same GST split equally into CGST and SGST.
  const taxType = b.taxType || S.defaultTaxType || 'igst';
  const rate = num(S.igstPct);
  let igst = 0, cgst = 0, sgst = 0;
  if (taxType === 'cgst_sgst') { cgst = r2((total * rate) / 200); sgst = cgst; }
  else igst = r2((total * rate) / 100);
  const tax = r2(igst + cgst + sgst);
  const grand = r2(total + num(b.toll) + num(b.permit) + (S.addIgst ? tax : 0));
  return { lines, prog, out, hills, total, taxType, igst, cgst, sgst, tax, grand };
}

/* A gentle hint if the GST numbers suggest the other tax type (first two digits of a GSTIN = state code). */
export function stateHint(S, b) {
  const a = String((S.company && S.company.gstin) || '').trim().slice(0, 2);
  const c = String((b.client && b.client.gstin) || '').trim().slice(0, 2);
  if (!/^\d{2}$/.test(a) || !/^\d{2}$/.test(c)) return '';
  const type = b.taxType || S.defaultTaxType || 'igst';
  if (a === c && type !== 'cgst_sgst') return `The client's GST number starts with ${c}, the same state as yours, so CGST + SGST usually applies.`;
  if (a !== c && type === 'cgst_sgst') return `The client's GST number starts with ${c}, a different state from yours (${a}), so IGST usually applies.`;
  return '';
}

/* ---------- amount in words (Indian system) ---------- */
const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const two = (n) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''));
function wordsInt(n) {
  if (n === 0) return 'zero';
  const parts = [];
  [[10000000, 'crore'], [100000, 'lakh'], [1000, 'thousand']].forEach(([u, name]) => {
    const q = Math.floor(n / u);
    if (q) { parts.push(wordsInt(q) + ' ' + name); n %= u; }
  });
  if (n) {
    const h = Math.floor(n / 100), rem = n % 100;
    let str;
    if (h) str = ONES[h] + ' hundred' + (rem ? ' and ' + two(rem) : '');
    else str = (parts.length ? 'and ' : '') + two(rem);
    parts.push(str);
  }
  return parts.join(' ');
}
export function rupeesInWords(amount) {
  amount = r2(amount);
  const rs = Math.floor(amount + 1e-9);
  const p = Math.round((amount - rs) * 100);
  let w = wordsInt(rs);
  if (p) w += ' and ' + two(p) + ' paise';
  return 'Rupees ' + w.charAt(0).toUpperCase() + w.slice(1) + ' only';
}

/* ---------- bills and lines ---------- */
export function blankLine(prev, vehicles, settings) {
  const vehicle = prev ? prev.vehicle : (vehicles[0] ? vehicles[0].name : '');
  const type = prev ? prev.type : 'local';
  const L = {
    date: prev ? prev.date : todayISO(), vehicle, type, cabNo: '',
    startKm: '', endKm: '', km: '', startT: '', endT: '', runT: '', days: '1', hills: '0',
  };
  L.snap = makeSnap(type, vehicles.find((v) => v.name === vehicle), settings.tripTypes);
  return L;
}
export function blankBill(settings, vehicles) {
  return {
    id: null, invoiceNo: String(settings.nextInvoice), date: todayISO(), taxType: settings.defaultTaxType || 'igst',
    client: { name: '', address: '', gstin: '' },
    guest: '', places: '', engaged: '', toll: '', permit: '',
    lines: [blankLine(null, vehicles, settings)],
  };
}
/* Returns a new line with one field changed, plus the auto-filled fields that follow from it. */
export function applyLineChange(L, key, value, vehicles, settings) {
  const n = { ...L, [key]: value };
  if (key === 'vehicle' || key === 'type') {
    n.snap = makeSnap(n.type, vehicles.find((v) => v.name === n.vehicle), settings.tripTypes);
  }
  if (key === 'startKm' || key === 'endKm') {
    if (!blank(n.startKm) && !blank(n.endKm) && num(n.endKm) >= num(n.startKm)) n.km = plain(num(n.endKm) - num(n.startKm));
  }
  if (key === 'startT' || key === 'endT') {
    if (n.startT && n.endT) {
      const a = n.startT.split(':'), b = n.endT.split(':');
      let mins = parseInt(b[0], 10) * 60 + parseInt(b[1], 10) - (parseInt(a[0], 10) * 60 + parseInt(a[1], 10));
      if (mins < 0) mins += 1440;
      n.runT = fmtRun(mins);
    }
  }
  return n;
}
export function lineWarnings(L, vehicles) {
  const w = [];
  const s = L.snap || {};
  if (!L.vehicle || !vehicles.some((v) => v.name === L.vehicle)) w.push('Vehicle not found in Rates.');
  if (L.type === 'outstation') { if (!num(s.outKm)) w.push('Outstation per-km rate is 0. Set it in Rates.'); }
  else if (!num(s.pkg)) w.push('Package price is 0. Set it in Rates.');
  if (blank(L.km)) w.push('Km run not entered.');
  if (!blank(L.startKm) && !blank(L.endKm) && num(L.endKm) < num(L.startKm)) w.push('End km is less than start km.');
  if (L.type !== 'outstation' && !L.runT) w.push('Time run not entered, so no extra-hour charge is added.');
  return w;
}
export function billWarnings(b) {
  const e = [];
  if (!String(b.invoiceNo || '').trim()) e.push('Enter an invoice number.');
  if (!b.client || !String(b.client.name || '').trim()) e.push('Enter the client name.');
  if (!b.lines.length) e.push('Add at least one trip.');
  return e;
}
