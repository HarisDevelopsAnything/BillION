import { useDraft } from '../lib/useDraft.js';
import { RATE_KEYS } from '../lib/db.js';
import { blank, num } from '../lib/util.js';

const COLS = [
  ['localPkg', 'Local package\n(80 km / 8 hr)'], ['localHr', 'Local extra\nper hour'], ['localKm', 'Local extra\nper km'],
  ['airPkg', 'Airport duty\n(4 hr / 40 km)'], ['airHr', 'Airport extra per hour\n(blank = local)'], ['airKm', 'Airport extra per km\n(blank = local)'],
  ['hill', 'Hills charge'], ['outKm', 'Outstation\nper km'], ['driver', 'Driver allowance\nper day (outstation)'],
];
const lines = (t) => t.split('\n').map((x, i) => <span key={i}>{i > 0 && <br />}{x}</span>);

function normVeh(row) {
  const v = { id: row.id, name: row.name };
  RATE_KEYS.forEach((k) => { v[k] = blank(row[k]) ? '' : num(row[k]); });
  return v;
}

function VehicleRow({ v, onSave, onDelete }) {
  const [row, setRow] = useDraft(v);
  const set = (k) => (e) => setRow({ ...row, [k]: e.target.value });
  const commit = () => {
    if (!String(row.name).trim()) { setRow(v); return; }       // a vehicle must have a name
    const n = normVeh({ ...row, name: row.name.trim() });
    if (JSON.stringify(n) !== JSON.stringify(v)) onSave(n);
  };
  return (
    <tr>
      <td><input style={{ minWidth: 170 }} value={row.name} onChange={set('name')} onBlur={commit} /></td>
      {COLS.map(([k]) => (
        <td key={k} className="num"><input type="number" step="any" value={row[k]} onChange={set(k)} onBlur={commit} /></td>
      ))}
      <td><button className="btn small danger" onClick={() => onDelete(v)}>Delete</button></td>
    </tr>
  );
}

function TripTypes({ settings, onSave }) {
  const [tt, setTt] = useDraft(settings.tripTypes);
  const set = (k, f) => (e) => setTt({ ...tt, [k]: { ...tt[k], [f]: e.target.value } });
  const commit = () => {
    const n = {
      local: { label: tt.local.label, hours: num(tt.local.hours), km: num(tt.local.km) },
      airport: { label: tt.airport.label, hours: num(tt.airport.hours), km: num(tt.airport.km) },
      outstation: { label: tt.outstation.label, kmPerDay: num(tt.outstation.kmPerDay) },
    };
    if (JSON.stringify(n) !== JSON.stringify(settings.tripTypes)) onSave({ ...settings, tripTypes: n });
  };
  const inp = (k, f, type) => <input type={type || 'text'} step="any" value={tt[k][f]} onChange={set(k, f)} onBlur={commit} />;
  return (
    <table className="list">
      <thead><tr><th>Trip type</th><th>Wording printed on bill</th><th>Included hours</th><th>Included km</th><th>Minimum km per day</th></tr></thead>
      <tbody>
        <tr><td>Local</td><td>{inp('local', 'label')}</td><td className="num">{inp('local', 'hours', 'number')}</td><td className="num">{inp('local', 'km', 'number')}</td><td></td></tr>
        <tr><td>Airport duty</td><td>{inp('airport', 'label')}</td><td className="num">{inp('airport', 'hours', 'number')}</td><td className="num">{inp('airport', 'km', 'number')}</td><td></td></tr>
        <tr><td>Outstation</td><td>{inp('outstation', 'label')}</td><td></td><td></td><td className="num">{inp('outstation', 'kmPerDay', 'number')}</td></tr>
      </tbody>
    </table>
  );
}

export default function Rates({ data, actions, toast }) {
  const run = async (fn, okMsg) => {
    try { await fn(); if (okMsg) toast(okMsg); } catch (e) { toast('Could not save: ' + (e.message || e)); }
  };
  const del = (v) => {
    if (window.confirm(`Delete vehicle "${v.name}" from the rate list? Saved bills are not affected.`)) run(() => actions.removeVehicle(v.id), 'Vehicle deleted');
  };
  return (
    <>
      <div className="card">
        <h2>Vehicle types and rates (Rs.)</h2>
        <div className="hint">
          Add a vehicle type, or edit any rate: changes are saved when you click out of a box, and apply to <b>new trips</b> only (saved bills keep the rates they were made with).
          Airport extra per hour / per km: <b>leave blank to use the local rate</b>. Hills charge is added once per hill trip on a bill.
          Outstation is charged per km with a daily minimum, plus driver allowance per day.
        </div>
        <div className="scroll">
          <table className="list">
            <thead><tr><th>Vehicle</th>{COLS.map(([k, t]) => <th key={k}>{lines(t)}</th>)}<th></th></tr></thead>
            <tbody>
              {data.vehicles.map((v) => <VehicleRow key={v.id} v={v} onSave={(n) => run(() => actions.updateVehicle(n), 'Saved')} onDelete={del} />)}
              {!data.vehicles.length && <tr><td colSpan="11" className="muted" style={{ padding: 16 }}>No vehicles yet. Add one below.</td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 10 }}><button className="btn" onClick={() => run(actions.addVehicle)}>+ Add vehicle type</button></div>
      </div>
      <div className="card">
        <h2>Trip types</h2>
        <div className="scroll"><TripTypes settings={data.settings} onSave={(s) => run(() => actions.saveSettings(s), 'Saved')} /></div>
      </div>
    </>
  );
}
