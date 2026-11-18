import { calcBill, rupeesInWords } from './billing.js';
import { esc, fmt, fmtDate, num, plain } from './util.js';

/* One model feeds both the printed bill and the Excel file. */
export function invoiceModel(b, S) {
  const C = S.company;
  const calc = calcBill(b, S);
  const prog = [], out = [], segs = [], cabs = [], dates = [];
  b.lines.forEach((L, i) => {
    const r = calc.lines[i];
    const s = L.snap || {};
    if (L.vehicle && !segs.includes(L.vehicle)) segs.push(L.vehicle);
    if (L.cabNo && !cabs.includes(L.cabNo)) cabs.push(L.cabNo);
    if (L.tripFrom && !dates.includes(L.tripFrom)) dates.push(L.tripFrom);
    if (L.tripTo && !dates.includes(L.tripTo)) dates.push(L.tripTo);

    // Build date text: show trip from-to range if available, else just the trip date
    let dateText;
    if (L.tripFrom && L.tripTo) {
      // compute days
      const d1 = new Date(L.tripFrom), d2 = new Date(L.tripTo);
      const diff = Math.round((d2 - d1) / 86400000);
      const days = !isNaN(diff) && diff >= 0 ? diff + 1 : null;
      dateText = fmtDate(L.tripFrom) + ' – ' + fmtDate(L.tripTo) +
        (days !== null ? '\n(' + days + ' day' + (days !== 1 ? 's' : '') + ')' : '');
    } else if (L.tripFrom) {
      dateText = fmtDate(L.tripFrom);
    } else {
      dateText = fmtDate(b.date);
    }
    if (L.vehicle) dateText += '\n' + L.vehicle + (L.cabNo ? ' ' + L.cabNo : '');

    if (L.type === 'outstation' && !r.usingDayRent) {
      out.push({ dateText, label: r.days + ' day(s) / ' + plain(r.billKm) + ' km', rate: num(s.outKm), charge: r.kmCharge, driver: r.driver, amount: r.amount });
    } else if (r.usingDayRent) {
      // Day-rent trips go into the prog table with a clear label
      prog.push({
        dateText,
        label: 'DAY RENT — ' + r.dayRentDays + ' day' + (r.dayRentDays !== 1 ? 's' : '') + ' × Rs.' + fmt(r.dayRentRate),
        extraKmText: 'FUEL COST = Rs.' + fmt(r.fuelCost),
        pkg: r.dayRentCharge, extraHr: 0, amount: r.amount,
      });
    } else {
      prog.push({
        dateText, label: S.tripTypes[L.type].label, pkg: r.pkg, extraHr: r.extraHrCharge,
        extraKmText: r.extraKm > 0 ? plain(r.extraKm) + 'X' + plain(s.xKm) + '=' + plain(r.extraKmCharge) : '',
        amount: r.amount,
      });
    }
  });
  dates.sort();
  const rate = num(S.igstPct);
  const suffix = S.addIgst ? '' : ' (reverse charge, not added)';
  const taxLines = calc.taxType === 'cgst_sgst'
    ? [{ key: 'cgst', label: 'CGST ' + plain(rate / 2) + '%' + suffix, amount: calc.cgst }, { key: 'sgst', label: 'SGST ' + plain(rate / 2) + '%' + suffix, amount: calc.sgst }]
    : [{ key: 'igst', label: 'IGST ' + plain(rate) + '%' + suffix, amount: calc.igst }];

  return {
    C, invoiceNo: b.invoiceNo, date: fmtDate(b.date), client: b.client || {}, guest: b.guest || '',
    engaged: b.engaged || dates.map(fmtDate).join('&'), places: b.places || '',
    segment: segs.join(', '), cabNos: cabs.join(' & '),
    prog, out, hills: calc.hills, total: calc.total, taxType: calc.taxType, rate, taxLines, taxAdded: !!S.addIgst,
    toll: num(b.toll), permit: num(b.permit), grand: calc.grand, words: rupeesInWords(calc.grand),
    note: S.gstNote, outKmPerDay: S.tripTypes.outstation.kmPerDay,
    attachmentUrl: b.attachmentUrl || '',
  };
}

const nl = (s) => esc(s).replace(/\n/g, '<br>');

export function invoiceHTML(m) {
  const C = m.C;
  let h = '<div class="inv"><table>';
  // Header: company name, tagline, proprietor, address, email
  h += `<tr><td class="t" colspan="6"><div class="co">${esc(C.name)}</div><div>${esc(C.tagline)}</div>`;
  if (C.proprietor) h += `<div class="b" style="margin:2px 0 0">${esc(C.proprietor)}</div>`;
  if (C.address) h += `<div style="font-size:0.95em">${esc(C.address)}</div>`;
  if (C.email) h += `<div style="font-size:0.95em">${esc(C.email)}</div>`;
  h += `<div class="b" style="margin:4px 0 6px">TAX INVOICE</div></td></tr>`;

  const info = (l1, v1, l2, v2) => `<tr><td>${l1}</td><td colspan="2" class="b">${nl(v1)}</td><td>${l2}</td><td colspan="2" class="b">${nl(v2)}</td></tr>`;
  h += `<tr><td>Invoice No</td><td colspan="2" class="b">${esc(m.invoiceNo)}</td><td>Date</td><td colspan="2" class="b">${esc(m.date)}</td></tr>`;
  h += info('Mobile', C.mobile, 'Name of Client', m.client.name);
  h += info('GST reg No', C.gstin, 'Address', m.client.address);
  h += info('Category', C.category, 'GST No. of client', m.client.gstin);
  h += info('Bank A/c Name', C.bankName, 'Engaged from', m.engaged);
  h += info('current A/c No', C.bankAcc, 'Places of visit', m.places);
  h += info('IFSC code', C.ifsc, 'Cab segment', m.segment);
  h += info('Branch', C.branch, 'Cab Reg. no', m.cabNos);
  h += `<tr><td>Guest</td><td colspan="5" class="b">${esc(m.guest)}</td></tr>`;
  h += '<tr><td colspan="6" class="note">Note : kindly refer Tripsheet for details on Running kms., and opening &amp; closing time</td></tr>';
  h += '<tr><th colspan="5">Description</th><th>Bill amount</th></tr>';
  h += '<tr><th>Programme date / CAB DETAILS</th><th>Hours package</th><th>charges (Rs.)</th><th>CHARGES FOR EXTRA Hrs.</th><th>Extra kms.,</th><th></th></tr>';
  m.prog.forEach((p) => {
    h += `<tr><td>${nl(p.dateText)}</td><td>${esc(p.label)}</td><td class="r">${fmt(p.pkg)}</td><td class="r">${fmt(p.extraHr)}</td><td>${esc(p.extraKmText)}</td><td class="r b">${fmt(p.amount)}</td></tr>`;
  });
  if (m.out.length) {
    h += `<tr><th>Programme date</th><th>Out station (for ${esc(m.outKmPerDay)} kms. per day)</th><th>Charges per km. (Rs.)</th><th>Charges (Rs.)</th><th>Driver allowance (Rs.)</th><th>Bill amount</th></tr>`;
    m.out.forEach((o) => {
      h += `<tr><td>${nl(o.dateText)}</td><td>${esc(o.label)}</td><td class="r">${fmt(o.rate)}</td><td class="r">${fmt(o.charge)}</td><td class="r">${fmt(o.driver)}</td><td class="r b">${fmt(o.amount)}</td></tr>`;
    });
    h += `<tr><td colspan="6" class="note">Out station tariff per day ${esc(m.outKmPerDay)} km. fixed</td></tr>`;
  }
  const tot = (label, val, bold) => `<tr><td colspan="5" class="r${bold ? ' b' : ''}">${label}</td><td class="r${bold ? ' b' : ''}">${fmt(val)}</td></tr>`;
  h += tot('HILLS CHARGE', m.hills);
  h += tot('Total', m.total, true);
  m.taxLines.forEach((t) => { h += tot(t.label, t.amount); });
  h += tot('Toll &amp; Parking', m.toll);
  h += tot('Other state permit', m.permit);
  h += tot('Grand Total', m.grand, true);
  h += `<tr><td colspan="6" class="b">Rs.${fmt(m.grand)}/- (${esc(m.words)})</td></tr>`;
  h += `<tr><td colspan="6" class="note">${esc(m.note)}</td></tr>`;
  h += `<tr><td colspan="3" class="nb"></td><td colspan="3" class="nb c" style="padding-top:24px"><div class="b">For ${esc(C.signName)}</div><div style="height:34px"></div><div class="b">Proprietor</div></td></tr>`;
  // Footer: computer generated disclaimer
  h += `<tr><td colspan="6" class="note c" style="border-top:1px solid #bbb;padding-top:6px;font-style:italic">This is a computer generated bill. Signature is not required.</td></tr>`;
  h += '</table></div>';
  return h;
}
