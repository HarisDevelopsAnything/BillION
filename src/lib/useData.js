import { useCallback, useEffect, useRef, useState } from 'react';
import * as db from './db.js';
import { blank, num } from './util.js';
import { calcBill } from './billing.js';

const byName = (a, z) => a.name.localeCompare(z.name);
const sameName = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

/* Loads everything for the logged-in user and exposes the actions the screens need. */
export function useData(userId) {
  const [state, setState] = useState({ loading: true, error: '', settings: null, vehicles: [], clients: [], bills: [] });
  const ref = useRef(state);
  ref.current = state;

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const d = await db.loadAll(userId);
      setState({ loading: false, error: '', ...d });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e.message || String(e) }));
    }
  }, [userId]);
  useEffect(() => { reload(); }, [reload]);

  const patch = (fn) => setState((s) => ({ ...s, ...fn(s) }));

  const actions = {
    reload,

    async saveSettings(next) {
      await db.saveSettings(userId, next);
      patch(() => ({ settings: next }));
    },

    async addVehicle() {
      const sort = ref.current.vehicles.length + 1;
      const v = await db.insertVehicle(userId, { name: 'NEW VEHICLE' }, sort);
      patch((s) => ({ vehicles: [...s.vehicles, v] }));
    },
    async updateVehicle(v) {
      await db.updateVehicle(v);
      patch((s) => ({ vehicles: s.vehicles.map((x) => (x.id === v.id ? v : x)) }));
    },
    async removeVehicle(id) {
      await db.deleteVehicle(id);
      patch((s) => ({ vehicles: s.vehicles.filter((x) => x.id !== id) }));
    },

    async addClient() {
      const c = await db.insertClient(userId, { name: 'New client', address: '', gstin: '' });
      patch((s) => ({ clients: [...s.clients, c].sort(byName) }));
    },
    async updateClient(id, fields) {
      await db.updateClient(id, fields);
      patch((s) => ({ clients: s.clients.map((x) => (x.id === id ? { ...x, ...fields } : x)).sort(byName) }));
    },
    async removeClient(id) {
      await db.deleteClient(id);
      patch((s) => ({ clients: s.clients.filter((x) => x.id !== id) }));
    },

    /* Saves the bill, remembers the client (new, or updates details typed on the bill) and moves the invoice counter on. */
    async saveBill(bill) {
      const S = ref.current.settings;
      const grand = calcBill(bill, S).grand;
      const cl = { name: bill.client.name.trim(), address: bill.client.address || '', gstin: bill.client.gstin || '' };
      const found = ref.current.clients.find((c) => sameName(c.name, cl.name));
      if (found) {
        const fields = {};
        if (cl.address && cl.address !== found.address) fields.address = cl.address;
        if (cl.gstin && cl.gstin !== found.gstin) fields.gstin = cl.gstin;
        if (Object.keys(fields).length) await actions.updateClient(found.id, fields);
      } else {
        const c = await db.insertClient(userId, cl);
        patch((s) => ({ clients: [...s.clients, c].sort(byName) }));
      }
      const saved = await db.saveBillRow(userId, { ...bill, client: { ...bill.client, name: cl.name } }, grand);
      patch((s) => ({ bills: [saved, ...s.bills.filter((b) => b.id !== saved.id)] }));
      const n = parseInt(bill.invoiceNo, 10);
      if (!isNaN(n) && n >= num(S.nextInvoice)) await actions.saveSettings({ ...ref.current.settings, nextInvoice: n + 1 });
      return saved;
    },
    async removeBill(id) {
      await db.deleteBill(id);
      patch((s) => ({ bills: s.bills.filter((b) => b.id !== id) }));
    },
  };
  return { ...state, actions };
}
