// Minimal .xlsx writer (no dependencies). Builds the same invoice layout as the printed bill.
import { fmt, plain } from './util.js';

const CRC_T = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(u8) {
  let c = 0xffffffff;
  for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zipBlob(files) {
  const enc = new TextEncoder();
  const chunks = [], central = [];
  let offset = 0;
  const now = new Date();
  const dt = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dd = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  files.forEach((f) => {
    const name = enc.encode(f.name), data = enc.encode(f.text), crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, dt, true); lh.setUint16(12, dd, true); lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true);
    lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    chunks.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, dt, true); ch.setUint16(14, dd, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
    ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + data.length;
  });
  let csize = 0;
  central.forEach((c) => { csize += c.length; });
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, csize, true); end.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

const xe = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="5">' +
  '<font><sz val="10"/><name val="Arial"/></font>' +
  '<font><b/><sz val="10"/><name val="Arial"/></font>' +
  '<font><b/><sz val="16"/><name val="Arial"/></font>' +
  '<font><b/><sz val="12"/><name val="Arial"/></font>' +
  '<font><i/><sz val="9"/><name val="Arial"/></font>' +
  '</fonts>' +
  '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFE7ECF7"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
  '<border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="12">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center"/></xf>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center"/></xf>' +
  '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center"/></xf>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf>' +
  '<xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center"/></xf>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

/* m = invoiceModel(...) */
export function buildXlsx(m) {
  const C = m.C;
  const cells = {}, merges = [], heights = {};
  let rowMax = 0;
  const ref = (r, c) => String.fromCharCode(64 + c) + r;
  const put = (r, c, v, s, f) => { cells[r + ',' + c] = { r, c, v, s: s || 0, f }; if (r > rowMax) rowMax = r; };
  const span = (r, c1, c2, v, s, f) => {
    put(r, c1, v, s, f);
    for (let c = c1 + 1; c <= c2; c++) put(r, c, '', s);
    if (c2 > c1) merges.push(ref(r, c1) + ':' + ref(r, c2));
  };
  const asNum = (x) => (/^\d+(\.\d+)?$/.test(String(x)) ? Number(x) : x);

  let r = 1;
  span(r, 1, 6, C.name, 1); heights[r] = 24; r++;
  span(r, 1, 6, C.tagline, 2); r++;
  span(r, 1, 6, 'TAX INVOICE', 3); r++;
  const info = (l1, v1, l2, v2, ht) => {
    put(r, 1, l1, 4); span(r, 2, 3, asNum(v1), 5); put(r, 4, l2, 4); span(r, 5, 6, asNum(v2), 5);
    if (ht) heights[r] = ht;
    r++;
  };
  info('Invoice No', m.invoiceNo, 'Date', m.date);
  info('Proprietor', C.proprietor, 'Name of Client', m.client.name || '', 30);
  info('Mobile', C.mobile, 'Address', m.client.address || '', 42);
  info('GST reg No', C.gstin, 'GST No. of client', m.client.gstin || '');
  info('Category', C.category, 'Engaged from', m.engaged, 30);
  info('Bank A/c Name', C.bankName, 'Places of visit', m.places, 30);
  info('current A/c No', C.bankAcc, 'Cab segment', m.segment, 30);
  info('IFSC code', C.ifsc, 'cab Reg. no', m.cabNos, 30);
  info('Branch', C.branch, '', '');
  put(r, 1, 'Guest', 4); span(r, 2, 6, m.guest, 5); r++;
  span(r, 1, 6, 'Note : kindly refer Tripsheet for details on Running kms., and opening & closing time', 9); r++;
  span(r, 1, 5, 'Description', 6); put(r, 6, 'Bill amount', 6); r++;
  ['Programme date / CAB DETAILS', 'Hours package', 'charges (Rs.)', 'CHARGES FOR EXTRA Hrs.', 'Extra kms.,', ''].forEach((t, i) => put(r, i + 1, t, 6));
  heights[r] = 30; r++;
  const progFirst = r;
  m.prog.forEach((p) => {
    put(r, 1, p.dateText, 4); put(r, 2, p.label, 4); put(r, 3, p.pkg, 7); put(r, 4, p.extraHrText, 4); put(r, 5, p.extraKmText, 4); put(r, 6, p.amount, 8);
    heights[r] = 28; r++;
  });
  const progLast = r - 1;
  let outFirst = 0, outLast = 0;
  if (m.out.length) {
    ['Programme date', 'Out station (for ' + m.outKmPerDay + ' kms. per day)', 'Charges per km. (Rs.)', 'Charges (Rs.)', 'Driver allowance (Rs.)', 'Bill amount'].forEach((t, i) => put(r, i + 1, t, 6));
    heights[r] = 30; r++;
    outFirst = r;
    m.out.forEach((o) => {
      put(r, 1, o.dateText, 4); put(r, 2, o.label, 4); put(r, 3, o.rate, 7); put(r, 4, o.charge, 7); put(r, 5, o.driver, 7);
      put(r, 6, o.amount, 8, 'D' + r + '+E' + r); heights[r] = 28; r++;
    });
    outLast = r - 1;
    span(r, 1, 6, 'Out station tariff per day ' + m.outKmPerDay + ' km. fixed', 9); r++;
  }
  const label = (t, s) => span(r, 1, 5, t, s || 10);
  const rHills = r; label('HILLS CHARGE'); put(r, 6, m.hills, 7); r++;
  const rTotal = r; label('Total');
  const parts = [];
  if (progLast >= progFirst) parts.push('SUM(F' + progFirst + ':F' + progLast + ')');
  if (outFirst && outLast >= outFirst) parts.push('SUM(F' + outFirst + ':F' + outLast + ')');
  parts.push('F' + rHills);
  put(r, 6, m.total, 8, parts.join('+')); r++;
  const taxRows = [];
  m.taxLines.forEach((t) => {
    taxRows.push(r); label(t.label);
    // IGST = total x rate; CGST and SGST are each half the rate
    put(r, 6, t.amount, 7, 'ROUND(F' + rTotal + '*' + plain(m.rate) + (t.key === 'igst' ? '/100' : '/200') + ',2)'); r++;
  });
  const rToll = r; label('Toll & Parking'); put(r, 6, m.toll, 7); r++;
  const rPerm = r; label('Other state permit'); put(r, 6, m.permit, 7); r++;
  label('Grand Total'); put(r, 6, m.grand, 8, 'F' + rTotal + '+F' + rToll + '+F' + rPerm + (m.taxAdded ? taxRows.map((x) => '+F' + x).join('') : '')); r++;
  span(r, 1, 6, 'Rs.' + fmt(m.grand) + '/- (' + m.words + ')', 5); heights[r] = 22; r++;
  span(r, 1, 6, m.note, 9); heights[r] = 52; r++;
  r++;
  span(r, 4, 6, 'For ' + C.signName, 11); r += 3;
  span(r, 4, 6, 'Proprietor', 11);

  let rows = '';
  for (let i = 1; i <= rowMax; i++) {
    let rc = '';
    for (let c = 1; c <= 6; c++) {
      const cell = cells[i + ',' + c];
      if (!cell) continue;
      const a = ref(i, c), v = cell.v, st = ' s="' + cell.s + '"';
      if (cell.f) rc += '<c r="' + a + '"' + st + '><f>' + xe(cell.f) + '</f><v>' + v + '</v></c>';
      else if (typeof v === 'number') rc += '<c r="' + a + '"' + st + '><v>' + v + '</v></c>';
      else if (v === '' || v == null) rc += '<c r="' + a + '"' + st + '/>';
      else rc += '<c r="' + a + '"' + st + ' t="inlineStr"><is><t xml:space="preserve">' + xe(v) + '</t></is></c>';
    }
    rows += '<row r="' + i + '"' + (heights[i] ? ' ht="' + heights[i] + '" customHeight="1"' : '') + '>' + rc + '</row>';
  }
  const sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView showGridLines="0" workbookViewId="0"/></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    '<cols><col min="1" max="1" width="26" customWidth="1"/><col min="2" max="2" width="24" customWidth="1"/><col min="3" max="3" width="14" customWidth="1"/>' +
    '<col min="4" max="4" width="22" customWidth="1"/><col min="5" max="5" width="24" customWidth="1"/><col min="6" max="6" width="16" customWidth="1"/></cols>' +
    '<sheetData>' + rows + '</sheetData>' +
    '<mergeCells count="' + merges.length + '">' + merges.map((x) => '<mergeCell ref="' + x + '"/>').join('') + '</mergeCells>' +
    '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>' +
    '<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/></worksheet>';
  const NS = 'http://schemas.openxmlformats.org/';
  return zipBlob([
    { name: '[Content_Types].xml', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="' + NS + 'package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
    { name: '_rels/.rels', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="' + NS + 'package/2006/relationships"><Relationship Id="rId1" Type="' + NS + 'officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="' + NS + 'spreadsheetml/2006/main" xmlns:r="' + NS + 'officeDocument/2006/relationships"><sheets><sheet name="Invoice" sheetId="1" r:id="rId1"/></sheets><calcPr fullCalcOnLoad="1"/></workbook>' },
    { name: 'xl/_rels/workbook.xml.rels', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="' + NS + 'package/2006/relationships"><Relationship Id="rId1" Type="' + NS + 'officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="' + NS + 'officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { name: 'xl/styles.xml', text: STYLES },
    { name: 'xl/worksheets/sheet1.xml', text: sheet },
  ]);
}
