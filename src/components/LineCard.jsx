import { lineWarnings, tripName, KINDS } from '../lib/billing.js';
import { fmt, plain } from '../lib/util.js';

export default function LineCard({ L, i, count, vehicles, settings, calc: r, onChange, onRemove }) {
  const tt = settings.tripTypes;
  const names = vehicles.map((v) => v.name);
  if (L.vehicle && !names.includes(L.vehicle)) names.push(L.vehicle);
  const s = L.snap || {};
  const warnings = lineWarnings(L, vehicles);
  const set = (k) => (e) => onChange(k, e.target.value);

  return (
    <div className="line">
      <div className="line-head">
        <b>Trip {i + 1}</b>
        {count > 1 && <button type="button" className="link danger" onClick={onRemove}>Remove this trip</button>}
      </div>
      <div className="grid g4">
        <label>Date<input type="date" value={L.date} onChange={set('date')} /></label>
        <label>Vehicle
          <select value={L.vehicle} onChange={set('vehicle')}>{names.map((n) => <option key={n} value={n}>{n}</option>)}</select>
        </label>
        <label>Trip type
          <select value={L.type} onChange={set('type')}>{KINDS.map((k) => <option key={k} value={k}>{tripName(k, tt)}</option>)}</select>
        </label>
        <label>Cab no.<input value={L.cabNo} onChange={set('cabNo')} placeholder="TN 11 AK 0000" /></label>
      </div>
      <div className="grid" style={{ marginTop: 10 }}>
        <label>Start km<input type="number" inputMode="decimal" value={L.startKm} onChange={set('startKm')} /></label>
        <label>End km<input type="number" inputMode="decimal" value={L.endKm} onChange={set('endKm')} /></label>
        <label>Km run<input type="number" inputMode="decimal" value={L.km} onChange={set('km')} /></label>
        {L.type === 'outstation' ? (
          <label>Days<input type="number" min="1" value={L.days} onChange={set('days')} /></label>
        ) : (
          <>
            <label>Start time<input type="time" value={L.startT} onChange={set('startT')} /></label>
            <label>End time<input type="time" value={L.endT} onChange={set('endT')} /></label>
            <label>Time run (h:mm)<input value={L.runT} onChange={set('runT')} placeholder="e.g. 9:20" /></label>
          </>
        )}
        <label>Hill trips<input type="number" min="0" value={L.hills} onChange={set('hills')} /></label>
      </div>
      <div className="calc">
        {L.type === 'outstation' ? (
          <>Billable km <b>{plain(r.billKm)}</b> (minimum {plain(r.minKm)}) x Rs.{fmt(s.outKm)} = Rs.{fmt(r.kmCharge)} &nbsp;+&nbsp; Driver allowance {r.days} x Rs.{fmt(s.driver)} = Rs.{fmt(r.driver)}</>
        ) : (
          <>
            Package Rs.{fmt(r.pkg)} &nbsp;+&nbsp; Extra time {r.extraHrs ? <><b>{plain(r.extraHrs)} hr</b> x Rs.{fmt(s.xHr)} = Rs.{fmt(r.extraHrCharge)}</> : 'none'}
            &nbsp;+&nbsp; Extra km {r.extraKm ? <><b>{plain(r.extraKm)}</b> x Rs.{fmt(s.xKm)} = Rs.{fmt(r.extraKmCharge)}</> : 'none'}
          </>
        )}
        {r.hills ? <> &nbsp;|&nbsp; Hills charge Rs.{fmt(r.hills)} (added separately)</> : null}
        &nbsp;&rarr;&nbsp; <b>Rs.{fmt(r.amount)}</b>
      </div>
      {warnings.length > 0 && <div className="warn">{warnings.map((w) => <div key={w}>{w}</div>)}</div>}
    </div>
  );
}
