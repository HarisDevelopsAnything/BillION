export const clone = (o) => JSON.parse(JSON.stringify(o));
export const num = (x) => { const n = parseFloat(x); return isNaN(n) ? 0 : n; };
export const r2 = (x) => Math.round(x * 100) / 100;
export const blank = (v) => v === '' || v == null;
export const pad = (n) => (n < 10 ? '0' : '') + n;
export const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
export const fmtDate = (iso) => { if (!iso) return ''; const p = String(iso).split('-'); return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : iso; };
export function fmt(n) {
  n = r2(num(n));
  let s = Math.abs(n).toFixed(2);
  if (s.slice(-3) === '.00') s = s.slice(0, -3);
  const parts = s.split('.');
  const i = parts[0];
  const last3 = i.slice(-3);
  let rest = i.slice(0, -3);
  if (rest) rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return (n < 0 ? '-' : '') + (rest ? rest + ',' + last3 : last3) + (parts[1] ? '.' + parts[1] : '');
}
export const plain = (n) => String(r2(num(n)));
export const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const safeName = (s) => String(s || '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);
}
