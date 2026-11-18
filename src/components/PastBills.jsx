import { useState } from 'react';
import { invoiceModel } from '../lib/invoice.js';
import { buildXlsx } from '../lib/xlsx.js';
import { download, fmt, fmtDate, safeName } from '../lib/util.js';

export default function PastBills({ data, actions, toast, onOpen, onPrint }) {
  const [q, setQ] = useState('');
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
