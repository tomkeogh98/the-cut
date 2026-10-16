// State lives in localStorage (works offline) and syncs to data.json in a private GitHub repo.
// Progress photos are cached in IndexedDB and uploaded to photos/ in the same repo.
import { today } from "./util.js?v=5";
import { DEFAULT_PROFILE } from "./body.js?v=5";

const STATE_KEY = "cut.state.v1";
const SETTINGS_KEY = "cut.settings.v1";
const DEFAULT_REPO = "tomkeogh98/the-cut-data";
const MAPS = ["sessions", "excuses", "shifts", "checks", "weights", "journal", "photos", "milestones", "meals"];

const blank = () => ({ version: 1, startDate: null, profile: null, hevy: { workouts: {} }, ...Object.fromEntries(MAPS.map((k) => [k, {}])) });

function readJSON(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

const listeners = new Set();
export const store = {
  state: normalise(readJSON(STATE_KEY, {})),
  settings: Object.assign({ token: "", repo: DEFAULT_REPO, hevyKey: "", hevySince: "", hevyLast: null, hevyPushWeights: true }, readJSON(SETTINGS_KEY, {})),
  rev: 0, // bumps whenever the data changes, so views know to redraw
  sync: { status: "off", message: "", lastSynced: null },
  hevySync: { status: "off", message: "" },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  emit() { listeners.forEach((fn) => fn()); },
};

function normalise(s) {
  const out = Object.assign(blank(), s || {});
  for (const k of MAPS) out[k] ||= {};
  out.hevy ||= { workouts: {} };
  out.hevy.workouts ||= {};
  return out;
}

adoptShared();

export const profile = () =>({ ...DEFAULT_PROFILE, ...(store.state.profile || {}) });
export const onboarded = () => Boolean(store.state.profile?.sex && store.state.profile?.startKg);

export function update(mutator) {
  mutator(store.state);
  store.rev++;
  if (!writeJSON(STATE_KEY, store.state)) console.warn("Couldn't save locally (storage full?)");
  store.emit();
  scheduleSync();
}
export function stamp(rec) { return Object.assign(rec, { updatedAt: Date.now() }); }
// Every field written through setRec gets its own timestamp (_f), so two devices editing the same
// record (e.g. water on the phone, guitar on the laptop, same day) merge instead of overwriting.
export function setRec(map, key, rec) {
  update((s) => {
    const now = Date.now();
    const cur = s[map][key] || {};
    const _f = { ...(cur._f || {}) };
    for (const k of Object.keys(rec)) _f[k] = now;
    s[map][key] = { ...cur, ...rec, _f, updatedAt: now };
  });
}

// The Hevy key travels with the (private) data so every device can pull from Hevy.
export function setHevyKey(key) {
  saveSettings({ hevyKey: key, hevyKeyAt: Date.now() });
  update((s) => { s.shared = { ...(s.shared || {}), hevyKey: key, updatedAt: store.settings.hevyKeyAt }; });
}
function adoptShared() {
  const sh = store.state.shared;
  if (sh && (sh.updatedAt || 0) > (store.settings.hevyKeyAt || 0) && sh.hevyKey !== store.settings.hevyKey) {
    Object.assign(store.settings, { hevyKey: sh.hevyKey || "", hevyKeyAt: sh.updatedAt, hevySince: "" });
    writeJSON(SETTINGS_KEY, store.settings);
  } else if (store.settings.hevyKey && !sh?.hevyKey) {
    store.state.shared = { hevyKey: store.settings.hevyKey, updatedAt: store.settings.hevyKeyAt || 1 };
  }
}

// Tokens and repo names are plain ASCII; pasting (especially on phones) can drag in
// spaces, line breaks or invisible characters that break the request.
const clean = (v) => String(v).replace(/[^\x21-\x7e]/g, "");

export function saveSettings(patch) {
  if ("token" in patch) patch.token = clean(patch.token);
  if ("repo" in patch) patch.repo = clean(patch.repo).replace(/^https:\/\/github\.com\//, "").replace(/\.git$|\/$/g, "");
  Object.assign(store.settings, patch);
  writeJSON(SETTINGS_KEY, store.settings);
  store.emit();
}

// ---------- merge (last write wins per record, tombstones for deletes) ----------
const META = new Set(["_f", "updatedAt"]);
export function mergeRec(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (!a._f && !b._f) return (b.updatedAt || 0) > (a.updatedAt || 0) ? b : a;
  const out = {}, _f = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (META.has(k)) continue;
    const ta = a._f?.[k] ?? (k in a ? a.updatedAt || 0 : -1);
    const tb = b._f?.[k] ?? (k in b ? b.updatedAt || 0 : -1);
    const win = tb > ta ? b : a;
    if (k in win) out[k] = win[k];
    _f[k] = Math.max(ta, tb);
  }
  return { ...out, _f, updatedAt: Math.max(a.updatedAt || 0, b.updatedAt || 0) };
}
function mergeMap(a = {}, b = {}) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = mergeRec(out[k], v);
  return out;
}
export function merge(local, remote) {
  if (!remote) return local;
  remote = normalise(remote);
  const starts = [local.startDate, remote.startDate].filter(Boolean).sort();
  const lp = local.profile, rp = remote.profile;
  const ls = local.shared, rs = remote.shared;
  const out = {
    version: 1,
    startDate: starts[0] || null,
    profile: !lp ? rp : !rp ? lp : (rp.updatedAt || 0) > (lp.updatedAt || 0) ? rp : lp,
    shared: !ls ? rs || null : !rs ? ls : (rs.updatedAt || 0) > (ls.updatedAt || 0) ? rs : ls,
    hevy: { workouts: mergeMap(local.hevy?.workouts, remote.hevy?.workouts) },
  };
  for (const k of MAPS) out[k] = mergeMap(local[k], remote[k]);
  return out;
}

// ---------- IndexedDB for photos ----------
let dbPromise;
function db() {
  dbPromise ||= new Promise((resolve, reject) => {
    const req = indexedDB.open("the-cut", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("photos");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
async function idb(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction("photos", mode);
    const req = fn(tx.objectStore("photos"));
    tx.oncomplete = () => resolve(req && req.result);
    tx.onerror = () => reject(tx.error);
  });
}
export const putPhoto = (name, blob) => idb("readwrite", (s) => s.put(blob, name));
const getLocalPhoto = (name) => idb("readonly", (s) => s.get(name)).catch(() => null);

const urlCache = new Map();
export async function photoURL(name) {
  if (urlCache.has(name)) return urlCache.get(name);
  let blob = await getLocalPhoto(name);
  if (!blob && configured()) {
    const res = await gh(`contents/photos/${encodeURIComponent(name)}`, { headers: { Accept: "application/vnd.github.raw" } }).catch(() => null);
    if (res?.ok) { blob = await res.blob(); await putPhoto(name, blob).catch(() => {}); }
  }
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(name, url);
  return url;
}

// Shrink to 1440px on the long edge, JPEG ~82%: about 200–400 KB per photo.
export async function compressImage(file, max = 1440) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
  let w, h, src;
  if (bmp) { w = bmp.width; h = bmp.height; src = bmp; }
  else {
    src = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = URL.createObjectURL(file); });
    w = src.naturalWidth; h = src.naturalHeight;
  }
  const s = Math.min(1, max / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * s); c.height = Math.round(h * s);
  c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
  return new Promise((resolve) => c.toBlob((b) => resolve(b), "image/jpeg", 0.82));
}

// ---------- GitHub sync ----------
export const configured = () => Boolean(store.settings.token && store.settings.repo);

async function gh(path, opts = {}) {
  const url = `https://api.github.com/repos/${store.settings.repo}${path ? `/${path}` : ""}`;
  try {
    return await fetch(url, {
      ...opts,
      headers: {
        Authorization: `Bearer ${store.settings.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        Accept: "application/vnd.github+json",
        ...(opts.headers || {}),
      },
    });
  } catch {
    throw new Error(navigator.onLine === false
      ? "You're offline. Changes are saved on this device and will sync when you're back online"
      : "Couldn't reach GitHub. Check your connection, or turn off any content blocker for this site");
  }
}

const toB64 = (bytes) => {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const fromB64Text = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0)));

let remoteSha = null;

async function pull() {
  const res = await gh(`contents/data.json?t=${Date.now()}`);
  if (res.status === 404) { remoteSha = null; return null; }
  if (!res.ok) throw new Error(await errText(res));
  const body = await res.json();
  remoteSha = body.sha;
  // Files over 1 MB come back without inline content; fetch the raw blob instead.
  if (!body.content && body.git_url) {
    const raw = await gh(`contents/data.json?t=${Date.now()}`, { headers: { Accept: "application/vnd.github.raw" } });
    if (!raw.ok) throw new Error(await errText(raw));
    return JSON.parse(await raw.text());
  }
  return JSON.parse(fromB64Text(body.content));
}

async function push(data) {
  const res = await gh("contents/data.json", {
    method: "PUT",
    body: JSON.stringify({
      message: `The Cut update ${new Date().toISOString()}`,
      content: toB64(new TextEncoder().encode(JSON.stringify(data))),
      ...(remoteSha ? { sha: remoteSha } : {}),
    }),
  });
  if (res.status === 409 || res.status === 422) return false; // someone else wrote first
  if (!res.ok) throw new Error(await errText(res));
  remoteSha = (await res.json()).content.sha;
  return true;
}

async function errText(res) {
  if (res.status === 401) return "GitHub rejected the token (expired or wrong?)";
  if (res.status === 403) return "The token doesn't have write access to the data repo";
  if (res.status === 404) return "Data repo not found. Check the name and the token's repo access";
  try { return (await res.json()).message || res.statusText; } catch { return res.statusText; }
}

async function uploadPendingPhotos() {
  for (const p of Object.values(store.state.photos)) {
    if (!p || p.uploaded || p.deleted) continue;
    const blob = await getLocalPhoto(p.name);
    if (!blob) continue;
    const content = toB64(new Uint8Array(await blob.arrayBuffer()));
    const res = await gh(`contents/photos/${encodeURIComponent(p.name)}`, {
      method: "PUT",
      body: JSON.stringify({ message: `Progress photo ${p.name}`, content }),
    });
    if (res.ok || res.status === 422) { p.uploaded = true; stamp(p); } // 422: already exists
    else throw new Error(`Photo upload failed: ${await errText(res)}`);
  }
}

let syncing = null, timer = null, again = false;
function scheduleSync() {
  if (!configured()) return;
  clearTimeout(timer);
  timer = setTimeout(() => syncNow(), 1500);
}

export function syncNow() {
  if (!configured()) { store.sync = { status: "off", message: "Not connected", lastSynced: null }; store.emit(); return Promise.resolve(); }
  if (syncing) { again = true; return syncing; }
  store.sync = { ...store.sync, status: "syncing", message: "Syncing…" };
  store.emit();
  syncing = (async () => {
    try {
      await uploadPendingPhotos();
      for (let attempt = 0; attempt < 3; attempt++) {
        const remote = await pull();
        // A device joining an existing setup defers to the shared profile rather than its own first-run one.
        if (store.settings.joining && remote?.profile && store.state.profile) store.state.profile.updatedAt = 0;
        const merged = merge(store.state, remote);
        if (store.settings.joining) saveSettings({ joining: false });
        if (JSON.stringify(merged) !== JSON.stringify(store.state)) store.rev++;
        store.state = merged;
        adoptShared();
        writeJSON(STATE_KEY, merged);
        if (JSON.stringify(remote) === JSON.stringify(merged)) break;
        if (await push(merged)) break;
      }
      store.sync = { status: "ok", message: "Synced", lastSynced: new Date() };
    } catch (e) {
      store.sync = { status: "error", message: e.message || String(e), lastSynced: store.sync.lastSynced };
    } finally {
      syncing = null;
      store.emit();
      if (again) { again = false; scheduleSync(); }
    }
  })();
  return syncing;
}

export async function testConnection() {
  const res = await gh("");
  if (!res.ok) throw new Error(await errText(res));
  const repo = await res.json();
  if (!repo.private) throw new Error("That repo is public! Your weigh-ins, journal and progress photos would be visible to anyone. Use a private repo.");
  if (!repo.permissions?.push) throw new Error("The token can read the repo but not write to it. Give it Contents: Read and write.");
  return repo.full_name;
}

// ---------- backup ----------
export function exportJSON() {
  return new Blob([JSON.stringify(store.state, null, 2)], { type: "application/json" });
}
export function importJSON(text) {
  const data = JSON.parse(text);
  if (!data || typeof data.sessions !== "object" || typeof data.weights !== "object") throw new Error("That doesn't look like a The Cut backup.");
  update((s) => Object.assign(s, merge(s, data)));
}

// ---------- pairing another device ----------
// The link carries the repo + token in the URL fragment (#…), which browsers never send to a server.
export function pairLink() {
  const code = btoa(JSON.stringify({ r: store.settings.repo, t: store.settings.token })).replace(/=+$/, "");
  return `${location.origin}${location.pathname}#/pair/${code}`;
}
export function readPairCode(code) {
  try {
    const { r, t } = JSON.parse(atob(decodeURIComponent(code)));
    return r && t ? { repo: r, token: t } : null;
  } catch { return null; }
}
// Connect this device: save, check the repo, then pull everything down.
export async function connectDevice(repo, token) {
  saveSettings({ repo, token, joining: !configuredBefore() });
  const name = await testConnection();
  await syncNow();
  if (store.sync.status === "error") throw new Error(store.sync.message);
  return name;
}
const configuredBefore = () => Boolean(store.sync.lastSynced);

export function ensureStart() {
  if (!store.state.startDate) update((s) => { s.startDate = today(); });
}
