import { useDraft } from '../lib/useDraft.js';

function ClientRow({ c, onSave, onDelete }) {
  const [row, setRow] = useDraft(c);
  const set = (k) => (e) => setRow({ ...row, [k]: e.target.value });
  const commit = () => {
    const name = row.name.trim() || c.name;
    const next = { ...row, name };
    if (next.name !== c.name || next.address !== c.address || next.gstin !== c.gstin) onSave(c.id, { name: next.name, address: next.address, gstin: next.gstin });
    else setRow(c);
  };
  return (
    <tr>
      <td><input value={row.name} onChange={set('name')} onBlur={commit} /></td>
      <td><textarea rows="2" value={row.address} onChange={set('address')} onBlur={commit} /></td>
      <td><input value={row.gstin} onChange={set('gstin')} onBlur={commit} /></td>
      <td><button className="btn small danger" onClick={() => onDelete(c)}>Delete</button></td>
    </tr>
  );
}

export default function Clients({ data, actions, toast }) {
  const run = async (fn, okMsg) => {
    try { await fn(); if (okMsg) toast(okMsg); } catch (e) { toast('Could not save: ' + (e.message || e)); }
  };
  const del = (c) => {
    if (window.confirm(`Delete client "${c.name}"? Saved bills keep their own copy of the client details.`)) run(() => actions.removeClient(c.id), 'Client deleted');
  };
  return (
    <div className="card">
      <h2>Clients</h2>
      <div className="hint">Clients are saved automatically when you save a bill. Use this page to correct a name, address or GST number. Changes are saved when you click out of a box.</div>
      <div className="scroll">
        <table className="list">
          <thead><tr><th style={{ width: '26%' }}>Name</th><th>Address</th><th style={{ width: '20%' }}>GST number</th><th style={{ width: 70 }}></th></tr></thead>
          <tbody>
            {data.clients.map((c) => <ClientRow key={c.id} c={c} onSave={(id, f) => run(() => actions.updateClient(id, f))} onDelete={del} />)}
            {!data.clients.length && <tr><td colSpan="4" className="muted" style={{ padding: 16 }}>No clients yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10 }}><button className="btn" onClick={() => run(actions.addClient)}>+ Add client</button></div>
    </div>
  );
}
