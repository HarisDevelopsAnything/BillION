import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { configured, supabase } from './lib/supabase.js';
import { useData } from './lib/useData.js';
import { invoiceHTML, invoiceModel } from './lib/invoice.js';
import Login from './components/Login.jsx';
import NewBill from './components/NewBill.jsx';
import PastBills from './components/PastBills.jsx';
import Clients from './components/Clients.jsx';
import Rates from './components/Rates.jsx';
import Settings from './components/Settings.jsx';
import NewRelease from './components/NewRelease.jsx';

const TABS = [['new', 'New bill'], ['bills', 'Past bills'], ['clients', 'Clients'], ['rates', 'Vehicles & rates'], ['settings', 'Settings']];

function TabIcon({ tab }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (tab === 'new') return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
  if (tab === 'bills') return <svg {...common}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 7h6M9 11h6M9 15h4" /></svg>;
  if (tab === 'clients') return <svg {...common}><path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 20v-2a4 4 0 0 0-3-3.87M16 2.13a4 4 0 0 1 0 7.75" /></svg>;
  if (tab === 'rates') return <svg {...common}><path d="M5 17h14l-2-7H7l-2 7ZM7 10l1.5-4h7L17 10M7 17v2M17 17v2M3 17h18" /><circle cx="7" cy="17" r="1" /><circle cx="17" cy="17" r="1" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" /><circle cx="12" cy="12" r="7" /></svg>;
}

export default function App() {
  const [session, setSession] = useState(undefined);
  useLayoutEffect(() => {
    let theme = 'light';
    try {
      theme = localStorage.getItem('billion-theme');
      if (!theme) theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {}
    document.documentElement.dataset.theme = theme;
    if (!configured) { setSession(null); return undefined; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      if (_event === 'SIGNED_IN') {
        window.setTimeout(() => setSession(s), 1450);
      } else {
        setSession(s);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!configured) {
    return (
      <div className="center"><div className="card" style={{ maxWidth: 520, textAlign: 'left' }}>
        <h2>Not connected to Supabase yet</h2>
        <p>Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> (see the README), then rebuild.</p>
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
  const [darkMode, setDarkMode] = useState(() => document.documentElement.dataset.theme === 'dark');
  const desktopNavRef = useRef(null);
  const mobileNavRef = useRef(null);
  const [draft, setDraft] = useState(null);
  const [draftKey, setDraftKey] = useState(0);
  const [toastMsg, setToastMsg] = useState('');
  const [printHtml, setPrintHtml] = useState('');
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const timer = useRef(null);

  const moveNavIndicator = useCallback((nav) => {
    if (!nav) return;
    const active = nav.querySelector('button.on');
    const indicator = nav.querySelector('.nav-indicator');
    if (!active || !indicator) return;
    const navRect = nav.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    indicator.style.left = `${activeRect.left - navRect.left}px`;
    indicator.style.width = `${activeRect.width}px`;
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      moveNavIndicator(desktopNavRef.current);
      moveNavIndicator(mobileNavRef.current);
    });
    const observer = new ResizeObserver(() => {
      moveNavIndicator(desktopNavRef.current);
      moveNavIndicator(mobileNavRef.current);
    });
    if (desktopNavRef.current) observer.observe(desktopNavRef.current);
    if (mobileNavRef.current) observer.observe(mobileNavRef.current);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [tab, moveNavIndicator]);

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
  useEffect(() => {
    if (!signOutOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setSignOutOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [signOutOpen]);

  const confirmSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
  };

  const ready = !data.loading && !data.error && data.settings;
  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    try { localStorage.setItem('billion-theme', next ? 'dark' : 'light'); } catch {}
  };
  return (
    <>
      <div className="app">
        <header className="top">
          <div className="brand">
            <h1>BillION</h1>
            <div className="signed-in">Signed in as <strong>{session.user.email}</strong></div>
          </div>
          <nav ref={desktopNavRef} className="desktop-nav" aria-label="Main navigation" data-active={tab}>
            <span className="nav-indicator" aria-hidden="true" />
            {TABS.map(([k, label]) => (
              <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} aria-current={tab === k ? 'page' : undefined}>
                <TabIcon tab={k} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="who">
            <button className={`theme-toggle${darkMode ? ' dark' : ''}`} type="button" onClick={toggleDarkMode} aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} aria-pressed={darkMode}>
              <span className="theme-icon theme-sun" aria-hidden="true">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="3.5" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" /></svg>
              </span>
              <span className="theme-icon theme-moon" aria-hidden="true">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 15.3A9 9 0 0 1 8.7 4a9 9 0 1 0 11.3 11.3Z" /></svg>
              </span>
            </button>
            <button className="sign-out" onClick={() => setSignOutOpen(true)}>Sign out</button>
          </div>
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
      <nav ref={mobileNavRef} className="mobile-nav" aria-label="Mobile navigation" data-active={tab}>
        <span className="nav-indicator" aria-hidden="true" />
        {TABS.map(([k, label]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} aria-current={tab === k ? 'page' : undefined}>
            <span className="mobile-nav-icon"><TabIcon tab={k} /></span>
            <span className="mobile-nav-label">{k === 'rates' ? 'Rates' : label}</span>
          </button>
        ))}
      </nav>
      <div id="print-area" dangerouslySetInnerHTML={{ __html: printHtml }} />
      <div id="toast" className={toastMsg ? 'on' : ''}>{toastMsg}</div>
      <NewRelease
        version="1.2"
        title="A smoother BillION"
        summary="This update improves the interface and mobile experience across the app."
        features={[
          'Liquid-glass desktop and mobile navigation',
          'Animated and bouncy tab selection',
          'Improved mobile usability with a floating bottom tab bar',
          'Updated BillION branding and sign-in details',
          'Custom blurred sign-out confirmation',
        ]}
        storageScope={session.user.id}
      />
      {signOutOpen && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSignOutOpen(false);
        }}>
          <div className="sign-out-dialog" role="dialog" aria-modal="true" aria-labelledby="sign-out-title" aria-describedby="sign-out-description">
            <div className="dialog-icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 17l5-5-5-5M15 12H3M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              </svg>
            </div>
            <h2 id="sign-out-title">Sign out of BillION?</h2>
            <p id="sign-out-description">You will need to sign in again to access your trips and billing data.</p>
            <div className="dialog-actions">
              <button className="dialog-cancel" type="button" onClick={() => setSignOutOpen(false)}>Cancel</button>
              <button className="dialog-confirm" type="button" onClick={confirmSignOut} disabled={signingOut}>{signingOut ? 'Signing out...' : 'Sign out'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
