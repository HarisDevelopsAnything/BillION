import { lineWarnings, tripName, KINDS } from '../lib/billing.js';
import { blank, fmt, fmtDate, num, plain } from '../lib/util.js';

export default function LineCard({ L, i, count, vehicles, settings, calc: r, onChange, onRemove }) {
  const tt = settings.tripTypes;
  const names = vehicles.map((v) => v.name);
  if (L.vehicle && !names.includes(L.vehicle)) names.push(L.vehicle);
  const s = L.snap || {};
  const warnings = lineWarnings(L, vehicles);
  const set = (k) => (e) => onChange(k, e.target.value);
  const toggle = (k) => (e) => onChange(k, e.target.checked);

  // Auto day count from per-trip from/to
  let tripDays = null;
  if (L.tripFrom && L.tripTo) {
    const d1 = new Date(L.tripFrom), d2 = new Date(L.tripTo);
    const diff = Math.round((d2 - d1) / 86400000);
    if (!isNaN(diff) && diff >= 0) tripDays = diff + 1;
  }

  // Effective day rent rate shown in the input (vehicle default or override)
  const effectiveDayRentRate = blank(L.dayRentRate) ? (blank(s.dayRent) ? '' : String(s.dayRent)) : L.dayRentRate;
  const effectiveFuelCost = blank(L.fuelCost)
    ? (blank(s.fuelCostPerKm) ? '' : String(r.defaultFuelCost))
    : L.fuelCost;

  return (
    <div className="line">
      <div className="line-head">
        <b>Trip {i + 1}</b>
        {count > 1 && <button type="button" className="link danger" onClick={onRemove}>Remove this trip</button>}
      </div>

      {/* Row 1: Vehicle, Trip type, Cab no */}
      <div className="grid g4">
        <label>Vehicle
          <select value={L.vehicle} onChange={set('vehicle')}>{names.map((n) => <option key={n} value={n}>{n}</option>)}</select>
        </label>
        <label>Trip type
          <select value={L.type} onChange={set('type')}>{KINDS.map((k) => <option key={k} value={k}>{tripName(k, tt)}</option>)}</select>
        </label>
        <label>Cab no.<input value={L.cabNo} onChange={set('cabNo')} placeholder="TN 11 AK 0000" /></label>
      </div>

      {/* Row 2: Per-trip from/to date range */}
      <div className="grid g4" style={{ marginTop: 10, alignItems: 'end' }}>
        <label>Trip from<input type="date" value={L.tripFrom || ''} onChange={set('tripFrom')} /></label>
        <label>Trip to<input type="date" value={L.tripTo || ''} onChange={set('tripTo')} /></label>
        <div style={{ paddingBottom: 6 }}>
          {tripDays !== null
            ? <span className="small"><b>{tripDays}</b> day{tripDays !== 1 ? 's' : ''}</span>
            : <span className="small muted">— days auto-calculated</span>}
        </div>
      </div>

      {/* Row 3: Day rent toggle */}
      <div style={{ marginTop: 10 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            style={{ width: 'auto', margin: 0 }}
            checked={!!L.useDayRent}
            onChange={toggle('useDayRent')}
          />
          <b>Day rent</b>
          <span className="small muted">(charge a fixed daily rate × number of days)</span>
        </label>
      </div>

      {L.useDayRent ? (
        /* Day-rent mode */
        <div className="grid g4" style={{ marginTop: 10 }}>
          <label>
            Day rent rate (Rs.)
            <input
              type="number"
              step="any"
              value={effectiveDayRentRate}
              placeholder={blank(s.dayRent) ? 'Enter rate' : `Vehicle default: ${s.dayRent}`}
              onChange={set('dayRentRate')}
            />
            {!blank(s.dayRent) && blank(L.dayRentRate) &&
              <span className="small muted">Using vehicle default: Rs.{fmt(s.dayRent)}</span>}
          </label>
          <label>
            Number of days
            <input
              type="number"
              min="1"
              value={L.dayRentDays}
              onChange={set('dayRentDays')}
            />
            {tripDays !== null && num(L.dayRentDays) !== tripDays &&
              <span className="small muted" style={{ color: 'var(--warn)' }}>Trip range = {tripDays} days</span>}
          </label>
          <label>
            Fuel cost (Rs.)
            <input
              type="number"
              step="any"
              value={effectiveFuelCost}
              placeholder={blank(s.fuelCostPerKm) ? 'Enter fuel cost' : `Running km × Rs.${fmt(s.fuelCostPerKm)}`}
              onChange={set('fuelCost')}
            />
            {!blank(s.fuelCostPerKm) && blank(L.fuelCost) &&
              <span className="small muted">Vehicle default: Rs.{fmt(s.fuelCostPerKm)} per km</span>}
          </label>
          <label>Running km<input type="number" inputMode="decimal" value={L.km} onChange={set('km')} /></label>
          <label>Hill trips<input type="number" min="0" value={L.hills} onChange={set('hills')} /></label>
        </div>
      ) : (
        /* Normal mode — no startKm/endKm, just running km */
        <div className="grid" style={{ marginTop: 10 }}>
          <label>Running km<input type="number" inputMode="decimal" value={L.km} onChange={set('km')} /></label>
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
      )}

      {/* Calculation breakdown */}
      <div className="calc">
        {r.usingDayRent ? (
          <>
            Day rent: <b>{r.dayRentDays}</b> day{r.dayRentDays !== 1 ? 's' : ''} × Rs.{fmt(r.dayRentRate)} = Rs.{fmt(r.dayRentCharge)}
            &nbsp;+&nbsp; Fuel cost = Rs.{fmt(r.fuelCost)}
            &nbsp;→&nbsp; <b>Rs.{fmt(r.amount)}</b>
          </>
        ) : L.type === 'outstation' ? (
          <>Billable km <b>{plain(r.billKm)}</b> (minimum {plain(r.minKm)}) x Rs.{fmt(s.outKm)} = Rs.{fmt(r.kmCharge)} &nbsp;+&nbsp; Driver allowance {r.days} x Rs.{fmt(s.driver)} = Rs.{fmt(r.driver)}</>
        ) : (
          <>
            Package Rs.{fmt(r.pkg)} &nbsp;+&nbsp; Extra time {r.extraHrs ? <><b>{plain(r.extraHrs)} hr</b> x Rs.{fmt(s.xHr)} = Rs.{fmt(r.extraHrCharge)}</> : 'none'}
            &nbsp;+&nbsp; Extra km {r.extraKm ? <><b>{plain(r.extraKm)}</b> x Rs.{fmt(s.xKm)} = Rs.{fmt(r.extraKmCharge)}</> : 'none'}
          </>
        )}
        {r.hills ? <> &nbsp;|&nbsp; Hills charge Rs.{fmt(r.hills)} (added separately)</> : null}
        {!r.usingDayRent && <> &nbsp;&rarr;&nbsp; <b>Rs.{fmt(r.amount)}</b></>}
      </div>
      {warnings.length > 0 && <div className="warn">{warnings.map((w) => <div key={w}>{w}</div>)}</div>}
    </div>
  );
}
