import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [typedText, setTypedText] = useState('');
  const [loginStatus, setLoginStatus] = useState('idle');
  const [slideOut, setSlideOut] = useState(false);
  const statusTimerRef = useRef(null);
  const slideTimerRef = useRef(null);

  useEffect(() => () => {
    window.clearTimeout(statusTimerRef.current);
    window.clearTimeout(slideTimerRef.current);
  }, []);

  useEffect(() => {
    const useCases = [
      'Create trip bills in seconds',
      'Manage clients and vehicles',
      'Track rates and trip details',
      'Print and export invoices',
    ];
    if (window.matchMedia('(max-width: 760px), (prefers-reduced-motion: reduce)').matches) {
      setTypedText(useCases[0]);
      return undefined;
    }

    let textIndex = 0;
    let characterIndex = 0;
    let removing = false;
    let timer;

    const tick = () => {
      const current = useCases[textIndex];
      if (!removing) {
        characterIndex += 1;
        setTypedText(current.slice(0, characterIndex));
        if (characterIndex === current.length) {
          removing = true;
          timer = window.setTimeout(tick, 1500);
          return;
        }
        timer = window.setTimeout(tick, 58);
      } else {
        characterIndex -= 1;
        setTypedText(current.slice(0, characterIndex));
        if (characterIndex === 0) {
          removing = false;
          textIndex = (textIndex + 1) % useCases.length;
          timer = window.setTimeout(tick, 240);
          return;
        }
        timer = window.setTimeout(tick, 32);
      }
    };

    timer = window.setTimeout(tick, 300);
    return () => window.clearTimeout(timer);
  }, []);

  async function submit(e) {
    e.preventDefault();
    window.clearTimeout(statusTimerRef.current);
    window.clearTimeout(slideTimerRef.current);
    setBusy(true); setError(''); setLoginStatus('idle');
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (err) {
      setError(err.message === 'Invalid login credentials' ? 'Wrong email or password.' : err.message);
      setLoginStatus('error');
      setBusy(false);
      statusTimerRef.current = window.setTimeout(() => setLoginStatus('idle'), 1800);
      return;
    }
    setLoginStatus('success');
    setBusy(false);
    slideTimerRef.current = window.setTimeout(() => setSlideOut(true), 450);
  }

  return (
    <div className={`login login-${loginStatus}${slideOut ? ' login-sliding' : ''}`}>
      <div className="panel" id="login-left-panel">
        <div className="login-brand">
          <h1>BillION</h1>
          <div className="login-brand-subtitle">Bill In One Note</div>
          <p>by <strong>Maruthi Travels</strong></p>
        </div>
        <div className="login-form-wrap">
          <div className="login-heading">Welcome back</div>
          <div className="login-subheading">Sign in to continue</div>
          <form onSubmit={submit}>
            <label>Email
              <input type="email" autoComplete="username" value={email} onChange={(e) => { setEmail(e.target.value); setLoginStatus('idle'); }} required />
            </label>
            <label>Password
              <input type="password" autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setLoginStatus('idle'); }} required />
            </label>
            {error && <div className="err">{error}</div>}
            <button className="login-submit" type="submit" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
          </form>
        </div>
      </div>
      <div className="panel" id="login-right-panel" aria-live="polite">
        <span className="login-status-gradient login-status-error" aria-hidden="true" />
        <span className="login-status-gradient login-status-success" aria-hidden="true" />
        <div className="login-use-case">
          <span className={`login-use-case-label login-status-label ${loginStatus !== 'idle' ? 'hidden' : ''}`}>With BillION, you can</span>
          <div className={`typewriter ${loginStatus !== 'idle' ? 'hidden' : ''}`}><span>{typedText}</span><span className="typewriter-cursor" aria-hidden="true" /></div>
          {loginStatus !== 'idle' && (
            <div className={`login-status-text visible ${loginStatus}`}>
              {loginStatus === 'error' ? 'Login Failed' : 'Login Success'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
