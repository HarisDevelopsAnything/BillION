import { useMemo, useRef, useState } from 'react';
import LineCard from './LineCard.jsx';
import { applyLineChange, billWarnings, blankBill, blankLine, calcBill, rupeesInWords, stateHint } from '../lib/billing.js';
import { invoiceModel } from '../lib/invoice.js';
import { buildXlsx } from '../lib/xlsx.js';
import { blank, clone, download, fmt, num, plain, safeName } from '../lib/util.js';
import { attachmentName, createZip } from '../lib/zip.js';
import { supabase } from '../lib/supabase.js';
import SaveSuccess from './SaveSuccess.jsx';

export default function NewBill({ initial, data, actions, toast, onPrint, onNew }) {
  const { settings, vehicles, clients, bills } = data;
  const [bill, setBill] = useState(() => {
    if (!initial) return blankBill(settings, vehicles);
    const restored = clone(initial);
    restored.attachmentUrl = restored.attachmentUrl || restored.data?.attachmentUrl || '';
    return restored;
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(initial ? `Editing saved bill ${initial.invoiceNo}.` : '');
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(null);
  const lastFill = useRef(null);
  const calc = useMemo(() => calcBill(bill, settings), [bill, settings]);

  const setField = (k) => (e) => setBill((b) => ({ ...b, [k]: e.target.value }));

  function setClientField(k, v) {
    const client = { ...(bill.client || { name: '', address: '', gstin: '' }), [k]: v };
    if (k === 'name' && v.trim()) {
      const c = clients.find((x) => x.name.trim().toLowerCase() === v.trim().toLowerCase());
      const untouched = (!client.address && !client.gstin) ||
        (lastFill.current && client.address === lastFill.current.address && client.gstin === lastFill.current.gstin);
      if (c && untouched) {
        client.address = c.address || ''; client.gstin = c.gstin || '';
        lastFill.current = { address: client.address, gstin: client.gstin };
      }
    }
    setBill({ ...bill, client });
  }

  const changeLine = (i) => (key, value) =>
    setBill((b) => ({ ...b, lines: b.lines.map((L, j) => (j === i ? applyLineChange(L, key, value, vehicles, settings) : L)) }));
  const addLine = () => setBill((b) => ({ ...b, lines: [...b.lines, blankLine(b.lines[b.lines.length - 1], vehicles, settings)] }));
  const removeLine = (i) => {
    if (window.confirm(`Remove trip ${i + 1}?`)) setBill((b) => ({ ...b, lines: b.lines.filter((_, j) => j !== i) }));
  };

  async function uploadAttachment(billId) {
    if (!attachmentFile) return bill.attachmentUrl || '';
    setUploading(true);
    try {
      if (!supabase) throw new Error('Supabase is not configured.');
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) throw new Error('You must be signed in to upload an attachment.');
      const ext = attachmentFile.name.split('.').pop().toLowerCase();
      if (!['zip', 'pdf'].includes(ext)) throw new Error('Only ZIP and PDF attachments are supported.');
      const path = `${authData.user.id}/${billId}.${ext}`;
      const contentType = ext === 'pdf' ? 'application/pdf' : 'application/zip';
      const { error } = await supabase.storage.from('bill-attachments').upload(path, attachmentFile, {
        upsert: true,
        contentType,
      });
      if (error) {
        if (/bucket.*not found/i.test(error.message)) {
          throw new Error('Attachment storage bucket is missing. Run supabase/schema.sql in the Supabase SQL Editor, then try again.');
        }
        throw new Error(error.message);
      }
      const { data: urlData } = supabase.storage.from('bill-attachments').getPublicUrl(path);
      return urlData.publicUrl;
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    const errs = billWarnings(bill);
    if (errs.length) { toast(errs[0]); return null; }
    if (!bill.id && bills.some((b) => String(b.invoiceNo) === String(bill.invoiceNo)) &&
        !window.confirm(`Invoice number ${bill.invoiceNo} already exists. Save anyway as a second bill with the same number?`)) return null;
    setBusy(true);
    try {
      const savedFirst = await actions.saveBill(bill);
      if (attachmentFile) {
        const attachmentUrl = await uploadAttachment(savedFirst.id);
        const updated = await actions.saveBill({ ...savedFirst, attachmentUrl });
        setBill(clone(updated));
        const t = new Date();
        setMsg(`Saved invoice ${updated.invoiceNo} at ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}.`);
        toast(`Saved invoice ${updated.invoiceNo}`);
        setAttachmentFile(null);
        setSaveSuccess(updated.invoiceNo);
        return updated;
      }
      setBill(clone(savedFirst));
      const t = new Date();
      setMsg(`Saved invoice ${savedFirst.invoiceNo} at ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}.`);
      toast(`Saved invoice ${savedFirst.invoiceNo}`);
      setSaveSuccess(savedFirst.invoiceNo);
      return savedFirst;
    } catch (e) {
      toast('Could not save: ' + (e.message || e));
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function saveAndExcel() {
    const saved = await save();
    if (saved) download(buildXlsx(invoiceModel(saved, settings)), `Invoice_${safeName(saved.invoiceNo)}_${safeName(saved.client.name)}.xlsx`);
  }
  async function saveAndZip() {
    const saved = await save();
    if (!saved) return;
    if (!saved.attachmentUrl) {
      download(buildXlsx(invoiceModel(saved, settings)), `Invoice_${safeName(saved.invoiceNo)}_${safeName(saved.client.name)}.xlsx`);
      return;
    }
    try {
      setBusy(true);
      const response = await fetch(saved.attachmentUrl);
      if (!response.ok) throw new Error(`Could not download attachment (${response.status}).`);
      const billName = `Invoice_${safeName(saved.invoiceNo)}_${safeName(saved.client.name)}.xlsx`;
      const zip = await createZip([
        { name: billName, data: buildXlsx(invoiceModel(saved, settings)) },
        { name: attachmentName(saved.attachmentUrl), data: await response.blob() },
      ]);
      download(zip, `Invoice_${safeName(saved.invoiceNo)}_${safeName(saved.client.name)}_with_attachments.zip`);
      toast(`Downloaded invoice ${saved.invoiceNo} with attachments`);
    } catch (e) {
      toast('Could not download ZIP: ' + (e.message || e));
    } finally {
      setBusy(false);
    }
  }
  async function saveAndPrint() {
    const saved = await save();
    if (saved) onPrint(saved);
  }
  function startNew() {
    if (!bill.id && bill.lines.some((L) => !blank(L.km)) && !window.confirm('The current bill is not saved. Discard it and start a new one?')) return;
    onNew();
  }

  const client = bill.client || { name: '', address: '', gstin: '' };
  const rate = num(settings.igstPct);
  const taxRows = calc.taxType === 'cgst_sgst'
    ? [['CGST ' + plain(rate / 2) + '%', calc.cgst], ['SGST ' + plain(rate / 2) + '%', calc.sgst]]
    : [['IGST ' + plain(rate) + '%', calc.igst]];
  const hint = stateHint(settings, bill);
  const setTax = (t) => setBill((b) => ({ ...b, taxType: t }));
  return (
    <>
    <SaveSuccess open={Boolean(saveSuccess)} invoiceNo={saveSuccess} onDone={() => setSaveSuccess(null)} />
    <div className="cols">
      <div>
        <div className="card">
          <h2>Bill details</h2>
          <div className="grid g3">
            <label>Invoice no.<input value={bill.invoiceNo} onChange={setField('invoiceNo')} /></label>
            <label>Invoice date<input type="date" value={bill.date} onChange={setField('date')} /></label>
            <label>Client name
              <input list="clientDL" autoComplete="off" value={client.name} onChange={(e) => setClientField('name', e.target.value)} placeholder="type a name, or pick a saved client" />
              <datalist id="clientDL">{clients.map((c) => <option key={c.id} value={c.name} />)}</datalist>
            </label>
          </div>
          <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', margin: '10px 0' }}>
            <label>Client address<input value={client.address} onChange={(e) => setClientField('address', e.target.value)} /></label>
            <label>Client GST no.<input value={client.gstin} onChange={(e) => setClientField('gstin', e.target.value)} /></label>
          </div>
          <div className="taxrow">
            <span className="lbl">Tax on this bill</span>
            <div className="seg" role="group" aria-label="Tax type">
              <button type="button" className={calc.taxType === 'igst' ? 'on' : ''} onClick={() => setTax('igst')}>Other state (IGST)</button>
              <button type="button" className={calc.taxType === 'cgst_sgst' ? 'on' : ''} onClick={() => setTax('cgst_sgst')}>Same state (CGST + SGST)</button>
            </div>
            {hint && <span className="small" style={{ color: 'var(--warn)' }}>{hint}</span>}
          </div>
          <div className="grid g3">
            <label>Guest name<input value={bill.guest} onChange={setField('guest')} placeholder="e.g. Dr. Veerapandian" /></label>
            <label>Places of visit<input value={bill.places} onChange={setField('places')} placeholder="e.g. Madurai Airport Transfer" /></label>
            <label>Engaged from (optional)<input value={bill.engaged} onChange={setField('engaged')} placeholder="auto from trip dates" /></label>
          </div>
          {/* File attachment */}
          <div style={{ marginTop: 12 }}>
            <label style={{ display: 'block' }}>
              Attach trip sheets / tolls / misc bills (PDF or ZIP, optional)
              <input
                type="file"
                accept=".pdf,application/pdf,.zip,application/zip,application/x-zip-compressed"
                style={{ display: 'block', marginTop: 4 }}
                onChange={(e) => setAttachmentFile(e.target.files[0] || null)}
              />
            </label>
            {bill.attachmentUrl && !attachmentFile && (
              <div className="small" style={{ marginTop: 4 }}>
                Current attachment: <a href={bill.attachmentUrl} target="_blank" rel="noreferrer">
                  Download {bill.attachmentUrl.toLowerCase().endsWith('.pdf') ? 'PDF' : 'attachment'}
                </a>
                {' '}<button className="link danger small" type="button" onClick={() => setBill((b) => ({ ...b, attachmentUrl: '' }))}>Remove</button>
              </div>
            )}
            {attachmentFile && <div className="small muted" style={{ marginTop: 4 }}>Selected: {attachmentFile.name} — will be uploaded on save.</div>}
          </div>
        </div>

        {bill.lines.map((L, i) => (
          <LineCard key={i} L={L} i={i} count={bill.lines.length} vehicles={vehicles} settings={settings}
            calc={calc.lines[i]} onChange={changeLine(i)} onRemove={() => removeLine(i)} />
        ))}
        <button className="btn" type="button" onClick={addLine}>+ Add another trip</button>
      </div>

      <div className="sticky">
        <div className="card sum">
          <h2>Bill summary</h2>
          <table>
            <tbody>
              <tr><td>Trips total</td><td>Rs. {fmt(calc.prog)}</td></tr>
              {calc.out > 0 && <tr><td>Outstation total</td><td>Rs. {fmt(calc.out)}</td></tr>}
              <tr><td>Hills charge</td><td>Rs. {fmt(calc.hills)}</td></tr>
              <tr><td><b>Total</b></td><td style={{ fontWeight: 700 }}>Rs. {fmt(calc.total)}</td></tr>
              {taxRows.map(([label, amt]) => (
                <tr className="muted" key={label}><td>{label}{settings.addIgst ? '' : ' (shown, not added)'}</td><td>Rs. {fmt(amt)}</td></tr>
              ))}
              <tr><td>Toll &amp; Parking</td><td><input type="number" value={bill.toll} onChange={setField('toll')} /></td></tr>
              <tr><td>Other state permit</td><td><input type="number" value={bill.permit} onChange={setField('permit')} /></td></tr>
              <tr className="grand"><td>Grand total</td><td>Rs. {fmt(calc.grand)}</td></tr>
            </tbody>
          </table>
          <div className="words">{rupeesInWords(calc.grand)}</div>
          <div className="row">
            <button className="btn primary" type="button" disabled={busy || uploading} onClick={save}>Save bill</button>
            <button className="btn" type="button" disabled={busy || uploading} onClick={saveAndExcel}>Save + Excel</button>
            {(attachmentFile || bill.attachmentUrl) && (
              <button className="btn" type="button" disabled={busy || uploading} onClick={saveAndZip}>Save + ZIP</button>
            )}
            <button className="btn" type="button" disabled={busy || uploading} onClick={saveAndPrint}>Save + Print / PDF</button>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn small" type="button" onClick={startNew}>Start a new blank bill</button>
          </div>
          <div className="small muted" style={{ marginTop: 8 }}>{uploading ? 'Uploading attachment...' : msg}</div>
        </div>
      </div>
    </div>
    </>
  );
}
