import { useCallback, useEffect, useRef, useState } from 'react';
import { configured, supabase } from './lib/supabase.js';
import { useData } from './lib/useData.js';
import { invoiceHTML, invoiceModel } from './lib/invoice.js';
import Login from './components/Login.jsx';
import NewBill from './components/NewBill.jsx';
import PastBills from './components/PastBills.jsx';
import Clients from './components/Clients.jsx';
import Rates from './components/Rates.jsx';
import Settings from './components/Settings.jsx';

const TABS = [['new', 'New bill'], ['bills', 'Past bills'], ['clients', 'Clients'], ['rates', 'Vehicles & rates'], ['settings', 'Settings']];

export default function App() {
  const [session, setSession] = useState(undefined);
  useEffect(() => {
    if (!configured) { setSession(null); return undefined; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!configured) {
    return (
      <div className="center"><div className="card" style={{ maxWidth: 520, textAlign: 'left' }}>
        <h2>Not connected to Supabase yet</h2>
        <p>Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (see the README), then rebuild.</p>
      </div></div>
    );
  }
  if (session === undefined) return <div className="center muted">Loading...</div>;
  if (!session) return <Login />;
  return <Main session={session} />;
}

function Main({ session }) {
  const data = useData(session.user.id);
  const [tab, setTab] = useState('new');
  const [draft, setDraft] = useState(null);
  const [draftKey, setDraftKey] = useState(0);
  const [toastMsg, setToastMsg] = useState('');
  const [printHtml, setPrintHtml] = useState('');
  const timer = useRef(null);

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastMsg(''), 2600);
  }, []);

  // Printing: put the invoice into the hidden print area, switch the page to print mode, open the print dialog.
  useEffect(() => {
    if (!printHtml) return undefined;
    document.body.classList.add('printing');
    const done = () => { document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    const t = setTimeout(() => window.print(), 80);
    return () => clearTimeout(t);
  }, [printHtml]);
  const onPrint = (bill) => { setPrintHtml(''); setTimeout(() => setPrintHtml(invoiceHTML(invoiceModel(bill, data.settings))), 0); };

  const openBill = (b) => { setDraft(b); setDraftKey((k) => k + 1); setTab('new'); };
  const newBill = () => { setDraft(null); setDraftKey((k) => k + 1); };

  const ready = !data.loading && !data.error && data.settings;
  return (
    <>
      <div className="app">
        <header className="top">
          <h1>Trip Billing</h1>
          <nav>{TABS.map(([k, label]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>)}</nav>
          <div className="who"><span>{session.user.email}</span><button className="btn" onClick={() => supabase.auth.signOut()}>Sign out</button></div>
        </header>
        <main>
          {data.loading && <div className="center muted">Loading your data...</div>}
          {data.error && (
            <div className="card">
              <h2>Could not load data</h2>
              <p className="err">{data.error}</p>
              <p className="small muted">If this is the first run, make sure you ran <code>supabase/schema.sql</code> in the Supabase SQL editor.</p>
              <button className="btn" onClick={data.actions.reload}>Try again</button>
            </div>
          )}
          {ready && (
            <>
              {/* kept mounted (just hidden) so a half-typed bill survives switching tabs */}
              <div style={{ display: tab === 'new' ? 'block' : 'none' }}>
                <NewBill key={draftKey} initial={draft} data={data} actions={data.actions} toast={toast} onPrint={onPrint} onNew={newBill} />
              </div>
              {tab === 'bills' && <PastBills data={data} actions={data.actions} toast={toast} onOpen={openBill} onPrint={onPrint} />}
              {tab === 'clients' && <Clients data={data} actions={data.actions} toast={toast} />}
              {tab === 'rates' && <Rates data={data} actions={data.actions} toast={toast} />}
              {tab === 'settings' && <Settings data={data} actions={data.actions} toast={toast} />}
            </>
          )}
        </main>
      </div>
      <div id="print-area" dangerouslySetInnerHTML={{ __html: printHtml }} />
      <div id="toast" className={toastMsg ? 'on' : ''}>{toastMsg}</div>
    </>
  );
}
