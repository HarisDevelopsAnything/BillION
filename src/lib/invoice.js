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
    if (L.date && !dates.includes(L.date)) dates.push(L.date);
    const dateText = fmtDate(L.date) + (L.vehicle ? '\n' + L.vehicle + (L.cabNo ? ' ' + L.cabNo : '') : '');
    if (L.type === 'outstation') {
      out.push({ dateText, label: r.days + ' day(s) / ' + plain(r.billKm) + ' km', rate: num(s.outKm), charge: r.kmCharge, driver: r.driver, amount: r.amount });
    } else {
      prog.push({
        dateText, label: S.tripTypes[L.type].label, pkg: r.pkg, extraHr: r.extraHrCharge,
        extraKmText: r.extraKm > 0 ? plain(r.extraKm) + 'X' + plain(s.xKm) + '=' + plain(r.extraKmCharge) : '',
        amount: r.amount,
      });
    }
  });
  dates.sort();
  return {
    C, invoiceNo: b.invoiceNo, date: fmtDate(b.date), client: b.client || {}, guest: b.guest || '',
    engaged: b.engaged || dates.map(fmtDate).join('&'), places: b.places || '',
    segment: segs.join(', '), cabNos: cabs.join(' & '),
    prog, out, hills: calc.hills, total: calc.total, igstPct: num(S.igstPct), igst: calc.igst, igstAdded: !!S.addIgst,
    toll: num(b.toll), permit: num(b.permit), grand: calc.grand, words: rupeesInWords(calc.grand),
    note: S.gstNote, outKmPerDay: S.tripTypes.outstation.kmPerDay,
  };
}

const nl = (s) => esc(s).replace(/\n/g, '<br>');

export function invoiceHTML(m) {
  const C = m.C;
  let h = '<div class="inv"><table>';
  h += `<tr><td class="t" colspan="6"><div class="co">${esc(C.name)}</div><div>${esc(C.tagline)}</div><div class="b" style="margin:4px 0 6px">TAX INVOICE</div></td></tr>`;
  const info = (l1, v1, l2, v2) => `<tr><td>${l1}</td><td colspan="2" class="b">${nl(v1)}</td><td>${l2}</td><td colspan="2" class="b">${nl(v2)}</td></tr>`;
  h += `<tr><td>Invoice No</td><td colspan="2" class="b">${esc(m.invoiceNo)}</td><td>Date</td><td colspan="2" class="b">${esc(m.date)}</td></tr>`;
  h += info('Proprietor', C.proprietor, 'Name of Client', m.client.name);
  h += info('Mobile', C.mobile, 'Address', m.client.address);
  h += info('GST reg No', C.gstin, 'GST No. of client', m.client.gstin);
  h += info('Category', C.category, 'Engaged from', m.engaged);
  h += info('Bank A/c Name', C.bankName, 'Places of visit', m.places);
  h += info('current A/c No', C.bankAcc, 'Cab segment', m.segment);
  h += info('IFSC code', C.ifsc, 'cab Reg. no', m.cabNos);
  h += info('Branch', C.branch, '', '');
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
  h += tot('IGST ' + plain(m.igstPct) + '%' + (m.igstAdded ? '' : ' (reverse charge, not added)'), m.igst);
  h += tot('Toll &amp; Parking', m.toll);
  h += tot('Other state permit', m.permit);
  h += tot('Grand Total', m.grand, true);
  h += `<tr><td colspan="6" class="b">Rs.${fmt(m.grand)}/- (${esc(m.words)})</td></tr>`;
  h += `<tr><td colspan="6" class="note">${esc(m.note)}</td></tr>`;
  h += `<tr><td colspan="3" class="nb"></td><td colspan="3" class="nb c" style="padding-top:24px"><div class="b">For ${esc(C.signName)}</div><div style="height:34px"></div><div class="b">Proprietor</div></td></tr>`;
  h += '</table></div>';
  return h;
}
