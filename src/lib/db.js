// All reads/writes to Supabase live here, so the screens never talk to the database directly.
import { supabase } from './supabase.js';
import { DEFAULT_SETTINGS, DEFAULT_VEHICLES } from './defaults.js';
import { blank, clone, num } from './util.js';

/* ---------- vehicle row <-> object ---------- */
const COL = { localPkg: 'local_pkg', localHr: 'local_hr', localKm: 'local_km', airPkg: 'air_pkg', airHr: 'air_hr', airKm: 'air_km', hill: 'hill', outKm: 'out_km', driver: 'driver', dayRent: 'day_rent', fuelCostPerKm: 'fuel_cost_per_km' };
export const RATE_KEYS = Object.keys(COL);

export const vehFromRow = (r) => {
  const v = { id: r.id, name: r.name };
  RATE_KEYS.forEach((k) => { v[k] = r[COL[k]] == null ? '' : Number(r[COL[k]]); });
  return v;
};
const vehToRow = (v) => {
  const r = { name: v.name };
  RATE_KEYS.forEach((k) => { r[COL[k]] = blank(v[k]) ? null : num(v[k]); });
  return r;
};

/* ---------- bill row <-> object ---------- */
const billFromRow = (r) => ({ ...r.data, id: r.id, grandTotal: Number(r.grand_total) });
const billToRow = (b, grand) => {
  const data = { ...b };
  delete data.id; delete data.grandTotal;
  return { invoice_no: String(b.invoiceNo), bill_date: b.date || null, client_name: (b.client && b.client.name) || '', grand_total: grand, data };
};

const must = (res) => { if (res.error) throw new Error(res.error.message || 'Database error'); return res.data; };

function mergeSettings(saved) {
  const base = clone(DEFAULT_SETTINGS);
  const s = saved || {};
  const out = { ...base, ...s };
  out.company = { ...base.company, ...(s.company || {}) };
  out.tripTypes = {
    local: { ...base.tripTypes.local, ...((s.tripTypes || {}).local || {}) },
    airport: { ...base.tripTypes.airport, ...((s.tripTypes || {}).airport || {}) },
    outstation: { ...base.tripTypes.outstation, ...((s.tripTypes || {}).outstation || {}) },
  };
  return out;
}

const inflight = new Map(); // avoids a double first-time setup if the page loads twice at once

export function loadAll(userId) {
  if (inflight.has(userId)) return inflight.get(userId);
  const p = (async () => {
    const [s, v, c, b] = await Promise.all([
      supabase.from('settings').select('data').maybeSingle(),
      supabase.from('vehicles').select('*').order('sort', { ascending: true }).order('created_at', { ascending: true }),
      supabase.from('clients').select('*').order('name', { ascending: true }),
      supabase.from('bills').select('*').order('created_at', { ascending: false }),
    ]);
    const settingsRow = must(s);
    let vehicleRows = must(v);
    const clients = must(c).map((x) => ({ id: x.id, name: x.name, address: x.address || '', gstin: x.gstin || '' }));
    const bills = must(b).map(billFromRow);

    let settings = mergeSettings(settingsRow && settingsRow.data);
    if (!settingsRow) {
      // first login ever: create the settings row and the starter vehicle list
      must(await supabase.from('settings').upsert({ user_id: userId, data: settings }));
      if (!vehicleRows.length) {
        const rows = DEFAULT_VEHICLES.map((veh, i) => ({ ...vehToRow(veh), sort: i + 1 }));
        vehicleRows = must(await supabase.from('vehicles').insert(rows).select());
        vehicleRows.sort((a, z) => a.sort - z.sort);
      }
    }
    return { settings, vehicles: vehicleRows.map(vehFromRow), clients, bills };
  })();
  inflight.set(userId, p);
  p.then(() => inflight.delete(userId), () => inflight.delete(userId));
  return p;
}

export async function saveSettings(userId, settings) {
  must(await supabase.from('settings').upsert({ user_id: userId, data: settings, updated_at: new Date().toISOString() }));
}

export async function insertVehicle(v, sort) {
  return vehFromRow(must(await supabase.from('vehicles').insert({ ...vehToRow(v), sort }).select().single()));
}
export async function updateVehicle(v) {
  must(await supabase.from('vehicles').update(vehToRow(v)).eq('id', v.id));
}
export async function deleteVehicle(id) {
  must(await supabase.from('vehicles').delete().eq('id', id));
}

export async function insertClient(c) {
  const r = must(await supabase.from('clients').insert({ name: c.name, address: c.address || '', gstin: c.gstin || '' }).select().single());
  return { id: r.id, name: r.name, address: r.address || '', gstin: r.gstin || '' };
}
export async function updateClient(id, patch) {
  must(await supabase.from('clients').update(patch).eq('id', id));
}
export async function deleteClient(id) {
  must(await supabase.from('clients').delete().eq('id', id));
}

export async function saveBillRow(bill, grand) {
  const body = billToRow(bill, grand);
  if (bill.id) {
    return billFromRow(must(await supabase.from('bills').update({ ...body, updated_at: new Date().toISOString() }).eq('id', bill.id).select().single()));
  }
  return billFromRow(must(await supabase.from('bills').insert(body).select().single()));
}
export async function deleteBill(id) {
  must(await supabase.from('bills').delete().eq('id', id));
}
