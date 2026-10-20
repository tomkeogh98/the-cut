// Guitar Hero → "Guitar practice" on the list.
// Both sites live on tomkeogh98.github.io, so they share localStorage: lessons finished on this device
// are read straight from Guitar Hero's saved state, and lessons from other devices come from the
// guitar-hero-data repo using Guitar Hero's own sync token (or The Cut's, if it has access).
import { addDays, live, today } from "./util.js?v=12";
import { setRec, store } from "./store.js?v=12";

const GH_STATE = "gh.state.v1";
const GH_SETTINGS = "gh.settings.v1";
const DEFAULT_REPO = "tomkeogh98/guitar-hero-data";
const clean = (v) => String(v || "").replace(/[^\x21-\x7e]/g, "");

let remote = { sessions: {}, at: 0, ok: false, error: "" };

function readLocal(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; }
}

export function guitarOn(date) {
  const local = readLocal(GH_STATE)?.sessions || {};
  const all = { ...remote.sessions, ...local };
  return Object.values(all).filter((s) => live(s) && s.date === date);
}

export const guitarStatus = () => ({ local: Boolean(readLocal(GH_STATE)), remoteOk: remote.ok, error: remote.error });

// Fetch Guitar Hero's synced data (at most every 5 minutes unless forced).
export async function pullGuitar(force = false) {
  if (!force && Date.now() - remote.at < 5 * 60 * 1000) return remote.ok;
  const ghs = readLocal(GH_SETTINGS) || {};
  const repo = clean(ghs.repo) || DEFAULT_REPO;
  const tokens = [...new Set([clean(ghs.token), clean(store.settings.token)].filter(Boolean))];
  remote.at = Date.now();
  for (const token of tokens) {
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/contents/data.json?t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.raw", "X-GitHub-Api-Version": "2022-11-28" },
      });
      if (res.ok) {
        const data = await res.json();
        remote = { sessions: data.sessions || {}, at: Date.now(), ok: true, error: "" };
        return true;
      }
      remote.error = res.status === 401 || res.status === 403 || res.status === 404 ? "no-access" : `HTTP ${res.status}`;
    } catch {
      remote.error = "offline";
    }
  }
  if (!tokens.length) remote.error = "no-token";
  remote.ok = false;
  return false;
}

// Tick "Guitar practice" for any recent day with a Guitar Hero lesson, unless you unticked it yourself.
export function applyGuitar(now = today()) {
  let changed = false;
  for (let i = 0; i < 7; i++) {
    const d = addDays(now, -i);
    if (store.state.startDate && d < store.state.startDate) continue;
    const c = store.state.checks[d] || {};
    if (c.guitar || c.guitarOff || !guitarOn(d).length) continue;
    setRec("checks", d, { guitar: true, guitarFrom: "guitar-hero" });
    changed = true;
  }
  return changed;
}

export async function syncGuitar(force = false) {
  applyGuitar(); // this device's lessons, instantly
  await pullGuitar(force);
  applyGuitar(); // plus other devices'
}
