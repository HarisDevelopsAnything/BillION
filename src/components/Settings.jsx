import { useMemo, useState } from 'react';
import { useDraft } from '../lib/useDraft.js';
import { clone, download, num, todayISO } from '../lib/util.js';

const CO_FIELDS = [
  ['name', 'Company name'], ['tagline', 'Line under the name'], ['proprietor', 'Proprietor'], ['mobile', 'Mobile'],
  ['gstin', 'GST reg. no.'], ['category', 'Category'], ['bankName', 'Bank A/c name'], ['bankAcc', 'Current A/c no.'],
  ['ifsc', 'IFSC code'], ['branch', 'Bank branch'], ['signName', 'Signature line: "For ..."'],
];
const pick = (s) => clone({ company: s.company, nextInvoice: s.nextInvoice, igstPct: s.igstPct, addIgst: s.addIgst, extraUnitMin: s.extraUnitMin, graceMin: s.graceMin, gstNote: s.gstNote });

export default function Settings({ data, actions, toast }) {
  const saved = useMemo(() => pick(data.settings), [data.settings]);
  const [form, setForm] = useDraft(saved);
  const [busy, setBusy] = useState(false);

  const setCo = (k) => (e) => setForm({ ...form, company: { ...form.company, [k]: e.target.value } });
  const setTop = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save() {
    setBusy(true);
    try {
      // tripTypes come from the latest saved settings so this form never overwrites the Rates screen
      await actions.saveSettings({
        ...data.settings, company: form.company, gstNote: form.gstNote, addIgst: !!form.addIgst,
        nextInvoice: num(form.nextInvoice), igstPct: num(form.igstPct), extraUnitMin: num(form.extraUnitMin) || 60, graceMin: num(form.graceMin),
      });
      toast('Settings saved');
    } catch (e) { toast('Could not save: ' + (e.message || e)); }
    setBusy(false);
  }
  function exportAll() {
    const { settings, vehicles, clients, bills } = data;
    download(new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), settings, vehicles, clients, bills }, null, 1)], { type: 'application/json' }), `TripBilling-data-${todayISO()}.json`);
  }

  return (
    <>
      <div className="card">
        <h2>Company details (printed on every bill)</h2>
        <div className="grid g3">
          {CO_FIELDS.map(([k, label]) => <label key={k}>{label}<input value={form.company[k] || ''} onChange={setCo(k)} /></label>)}
        </div>
      </div>
      <div className="card">
        <h2>Billing rules</h2>
        <div className="grid g3">
          <label>Next invoice number<input type="number" value={form.nextInvoice} onChange={setTop('nextInvoice')} /></label>
          <label>IGST %<input type="number" step="any" value={form.igstPct} onChange={setTop('igstPct')} /></label>
          <label>Extra time is rounded up to
            <select value={form.extraUnitMin} onChange={setTop('extraUnitMin')}><option value="60">whole hour</option><option value="30">half hour</option></select>
          </label>
          <label>Grace minutes (no extra charge if over by this much or less)<input type="number" value={form.graceMin} onChange={setTop('graceMin')} /></label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20 }}>
            <input type="checkbox" style={{ width: 'auto', margin: 0 }} checked={!!form.addIgst} onChange={(e) => setForm({ ...form, addIgst: e.target.checked })} />
            Add IGST to the grand total (off = shown only, as on your current bills)
          </label>
        </div>
        <div style={{ marginTop: 10 }}>
          <label>Note printed at the bottom of the bill<textarea rows="3" value={form.gstNote} onChange={setTop('gstNote')} /></label>
        </div>
        <div style={{ marginTop: 12 }}><button className="btn primary" disabled={busy} onClick={save}>Save settings</button></div>
      </div>
      <div className="card">
        <h2>Data copy</h2>
        <div className="hint">Your bills, clients and rates are stored online in your Supabase database. This downloads a copy of everything as a file, as an extra safety copy.</div>
        <button className="btn" onClick={exportAll}>Download a copy of all data</button>
      </div>
    </>
  );
}
