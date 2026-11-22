import { useState } from 'react';
import { invoiceModel } from '../lib/invoice.js';
import { buildXlsx } from '../lib/xlsx.js';
import { download, fmt, fmtDate, safeName } from '../lib/util.js';
import { attachmentName, createZip } from '../lib/zip.js';

/* Build a multi-sheet xlsx zip containing one sheet per bill.
   Since buildXlsx produces one file per bill, we bundle them into a
   browser-side ZIP using the same zipBlob helper embedded here. */
async function downloadRange(bills, settings, fromNo, toNo, toast) {
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
    if (!b.attachmentUrl) {
      download(buildXlsx(invoiceModel(b, settings)), `Invoice_${safeName(b.invoiceNo)}_${safeName(b.client && b.client.name)}.xlsx`);
      return;
    }
    await downloadBillWithAttachments(b, settings, toast);
    return;
  }
  try {
    const files = [];
    for (const b of sorted) {
      const folder = `Invoice_${safeName(b.invoiceNo)}_${safeName(b.client && b.client.name)}`;
      files.push({
        name: `${folder}/${folder}.xlsx`,
        data: buildXlsx(invoiceModel(b, settings)),
      });
      if (b.attachmentUrl) {
        const response = await fetch(b.attachmentUrl);
        if (!response.ok) throw new Error(`Could not download attachment for invoice ${b.invoiceNo} (${response.status}).`);
        files.push({
          name: `${folder}/${attachmentName(b.attachmentUrl)}`,
          data: await response.blob(),
        });
      }
    }
    const zipBlob = await createZip(files);
    const label = fromNo || toNo ? `Invoices_${safeName(fromNo || 'start')}_to_${safeName(toNo || 'end')}` : 'All_Invoices';
    download(zipBlob, `${label}.zip`);
    toast(`Downloaded ${sorted.length} invoice${sorted.length !== 1 ? 's' : ''} as ZIP.`);
  } catch (e) {
    toast('Could not download ZIP: ' + (e.message || e));
  }
}

async function downloadBillWithAttachments(b, settings, toast) {
  if (!b.attachmentUrl) return;
  try {
    const response = await fetch(b.attachmentUrl);
    if (!response.ok) throw new Error(`Could not download attachment (${response.status}).`);
    const folder = `Invoice_${safeName(b.invoiceNo)}_${safeName(b.client && b.client.name)}`;
    const zip = await createZip([
      { name: `${folder}/${folder}.xlsx`, data: buildXlsx(invoiceModel(b, settings)) },
      { name: `${folder}/${attachmentName(b.attachmentUrl)}`, data: await response.blob() },
    ]);
    download(zip, `${folder}_with_attachments.zip`);
    toast(`Downloaded invoice ${b.invoiceNo} with attachments`);
  } catch (e) {
    toast('Could not download ZIP: ' + (e.message || e));
  }
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
  const zipWithAttachments = (b) => downloadBillWithAttachments(b, settings, toast);

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>Past bills</h2>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invoice no. or client"
          style={{ padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 4, minWidth: 240 }} />
      </div>

      {/* Bulk download by invoice number range */}
      <div className="download-range">
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
                  {b.attachmentUrl && (
                    <button className="btn small" onClick={() => zipWithAttachments(b)}>ZIP + attachment</button>
                  )}{' '}
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
