import { useState } from 'react';
import { invoiceModel } from '../lib/invoice.js';
import { buildXlsx } from '../lib/xlsx.js';
import { download, fmt, fmtDate, safeName } from '../lib/util.js';

/* Build a multi-sheet xlsx zip containing one sheet per bill.
   Since buildXlsx produces one file per bill, we bundle them into a
   browser-side ZIP using the same zipBlob helper embedded here. */
function downloadRange(bills, settings, fromNo, toNo, toast) {
  // Parse range: support numeric or alphanumeric invoice numbers
  const isNum = (s) => /^\d+$/.test(String(s).trim());
  const normalize = (s) => String(s).trim();

  let subset;
  if (fromNo || toNo) {
    const from = normalize(fromNo);
    const to = normalize(toNo);
    if (isNum(from) && isNum(to)) {
      const f = parseInt(from, 10), t = parseInt(to, 10);
      subset = bills.filter((b) => {
        const n = parseInt(String(b.invoiceNo).trim(), 10);
        return !isNaN(n) && n >= f && n <= t;
      });
    } else {
      // lexicographic range
      subset = bills.filter((b) => {
        const n = normalize(b.invoiceNo);
        return (!from || n >= from) && (!to || n <= to);
      });
    }
  } else {
    subset = bills;
  }

  if (!subset.length) { toast('No bills found in that range.'); return; }

  // Sort by invoice number ascending for the download
  const sorted = [...subset].sort((a, b) => {
    const na = parseInt(a.invoiceNo, 10), nb = parseInt(b.invoiceNo, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return String(a.invoiceNo).localeCompare(String(b.invoiceNo));
  });

  if (sorted.length === 1) {
    const b = sorted[0];
    download(buildXlsx(invoiceModel(b, settings)), `Invoice_${safeName(b.invoiceNo)}_${safeName(b.client && b.client.name)}.xlsx`);
    return;
  }

  // Bundle multiple xlsx files into a zip
  // We re-use the zip writer from xlsx.js logic inline:
  const enc = new TextEncoder();
  const CRC_T = (() => {
    const t = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

  const now = new Date();
  const dt = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dd = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  const chunks = [], central = [];
  let offset = 0;

  sorted.forEach((b) => {
    const xlsxBlob = buildXlsx(invoiceModel(b, settings));
    // We need raw bytes from the blob — but we're synchronous here.
    // Instead, collect all blobs and use a Reader approach.
    // We'll resolve this with a collected array approach below.
    b._xlsxBlob = xlsxBlob;
  });

  // Must read blobs async
  Promise.all(sorted.map((b) => b._xlsxBlob.arrayBuffer())).then((buffers) => {
    buffers.forEach((buf, idx) => {
      const b = sorted[idx];
      const fname = `Invoice_${safeName(b.invoiceNo)}_${safeName(b.client && b.client.name)}.xlsx`;
      const name = enc.encode(fname);
      const data = new Uint8Array(buf);
      const crc = crc32(data);

      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, dt, true); lh.setUint16(12, dd, true); lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true);
      lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      chunks.push(new Uint8Array(lh.buffer), name, data);

      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, dt, true); ch.setUint16(14, dd, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
      ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    });

    let csize = 0;
    central.forEach((c) => { csize += c.length; });
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, sorted.length, true); end.setUint16(10, sorted.length, true);
    end.setUint32(12, csize, true); end.setUint32(16, offset, true);

    const zipBlob = new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
    const label = fromNo || toNo ? `Invoices_${safeName(fromNo || 'start')}_to_${safeName(toNo || 'end')}` : 'All_Invoices';
    download(zipBlob, `${label}.zip`);
    toast(`Downloaded ${sorted.length} invoice${sorted.length !== 1 ? 's' : ''} as ZIP.`);
  });
}

export default function PastBills({ data, actions, toast, onOpen, onPrint }) {
  const [q, setQ] = useState('');
  const [fromNo, setFromNo] = useState('');
  const [toNo, setToNo] = useState('');
  const { bills, settings } = data;
  const needle = q.trim().toLowerCase();
  const list = bills.filter((b) => !needle || String(b.invoiceNo).toLowerCase().includes(needle) || ((b.client && b.client.name) || '').toLowerCase().includes(needle));

  async function del(b) {
    if (!window.confirm(`Delete invoice ${b.invoiceNo}? This cannot be undone.`)) return;
    try { await actions.removeBill(b.id); toast(`Deleted invoice ${b.invoiceNo}`); }
    catch (e) { toast('Could not delete: ' + (e.message || e)); }
  }
  const xlsx = (b) => download(buildXlsx(invoiceModel(b, settings)), `Invoice_${safeName(b.invoiceNo)}_${safeName(b.client && b.client.name)}.xlsx`);

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>Past bills</h2>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invoice no. or client"
          style={{ padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 4, minWidth: 240 }} />
      </div>

      {/* Bulk download by invoice number range */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14, padding: '10px 12px', background: 'var(--bg2, #f5f7fa)', borderRadius: 6, border: '1px solid var(--line)' }}>
        <span className="small" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Download range:</span>
        <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          From invoice&nbsp;
          <input
            type="text" value={fromNo} onChange={(e) => setFromNo(e.target.value)}
            placeholder="e.g. 300"
            style={{ width: 80, padding: '5px 7px', border: '1px solid var(--line)', borderRadius: 4, fontSize: '0.9em' }}
          />
        </label>
        <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          To invoice&nbsp;
          <input
            type="text" value={toNo} onChange={(e) => setToNo(e.target.value)}
            placeholder="e.g. 350"
            style={{ width: 80, padding: '5px 7px', border: '1px solid var(--line)', borderRadius: 4, fontSize: '0.9em' }}
          />
        </label>
        <button
          className="btn small"
          onClick={() => downloadRange(bills, settings, fromNo, toNo, toast)}
        >
          ↓ Download as ZIP
        </button>
        <span className="small muted">Leave both blank to download all bills.</span>
      </div>

      <div className="scroll">
        <table className="list">
          <thead><tr><th>Invoice</th><th>Date</th><th>Client</th><th style={{ textAlign: 'right' }}>Grand total (Rs.)</th><th></th></tr></thead>
          <tbody>
            {list.map((b) => (
              <tr key={b.id}>
                <td><b>{b.invoiceNo}</b></td>
                <td>{fmtDate(b.date)}</td>
                <td>{b.client && b.client.name}</td>
                <td style={{ textAlign: 'right' }}>{fmt(b.grandTotal)}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn small" onClick={() => onOpen(b)}>Open</button>{' '}
                  <button className="btn small" onClick={() => xlsx(b)}>Excel</button>{' '}
                  <button className="btn small" onClick={() => onPrint(b)}>Print</button>{' '}
                  <button className="btn small danger" onClick={() => del(b)}>Delete</button>
                </td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan="5" className="muted" style={{ padding: 16 }}>{bills.length ? 'No bills match your search.' : 'No saved bills yet.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
