import { useState } from 'react';
import { supabase } from '../lib/supabase.js';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (err) setError(err.message === 'Invalid login credentials' ? 'Wrong email or password.' : err.message);
    setBusy(false);
  }

  return (
    <div className="login">
      <div className="card">
        <h1>Trip Billing</h1>
        <div className="muted small">Sign in to continue</div>
        <form onSubmit={submit}>
          <label>Email
            <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>Password
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <div className="err">{error}</div>}
          <div style={{ marginTop: 16 }}>
            <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
