// Dates are handled as local 'YYYY-MM-DD' strings throughout.
export const pad = (n) => String(n).padStart(2, "0");
export const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const today = () => fmt(new Date());
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return fmt(d); };
export const weekday = (s) => parse(s).getDay(); // 0 Sun … 6 Sat
export const mondayOf = (s) => addDays(s, -((weekday(s) + 6) % 7));
export const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
export const isWeekend = (s) => { const w = weekday(s); return w === 0 || w === 6; };

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const dayName = (s) => DAY_NAMES[weekday(s)];
export const shortDay = (s) => DAY_NAMES[weekday(s)].slice(0, 3);
export const monthName = (m) => MONTHS[m];
export const prettyDate = (s) => { const d = parse(s); return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
export const shortDate = (s) => { const d = parse(s); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`; };
export const longDate = (s) => { const d = parse(s); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };

export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const round = (v, step = 1) => Math.round(v / step) * step;
export const kg = (v, dp = 1) => (v == null || Number.isNaN(v) ? "—" : `${Number(v).toFixed(dp)}`);
export const live = (rec) => Boolean(rec) && !rec.deleted;
