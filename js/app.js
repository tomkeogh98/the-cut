// The shell: routing, header (timecode + sync), Hevy auto-sync and milestone celebrations.
import { pad, reducedMotion } from "./util.js?v=13";
import { configured, connectDevice, onboarded, pairLink, profile, readPairCode, setRec, store, syncNow, update } from "./store.js?v=13";
import { $, $$, celebrate, enter, modal, toast } from "./ui.js?v=13";
import { renderSession, renderToday } from "./view-today.js?v=13";
import { renderDailies, renderRushes, renderScope, renderTimeline } from "./view-track.js?v=13";
import { renderCraft, renderOffice, renderProgram, renderScript } from "./view-plan.js?v=13";
import { achievedIds, habitGoals, liftGoals, weightMilestones, weightStatus } from "./goals.js?v=13";
import { pullWeights, pullWorkouts, weighInFromHevy } from "./hevy.js?v=13";
import { applyGuitar, syncGuitar } from "./guitar.js?v=13";

const ROUTES = {
  "": renderToday,
  timeline: renderTimeline,
  scope: renderScope,
  rushes: renderRushes,
  script: renderScript,
  craft: renderCraft,
  program: renderProgram,
  dailies: renderDailies,
  office: renderOffice,
};

const view = $("#view");
let renderedRev = -1, pendingRender = false, quiet = false;

const MORE = ["rushes", "craft", "program", "dailies", "office"];

function route() {
  const [name, arg] = location.hash.replace(/^#\/?/, "").split("/");
  if (name === "pair") { pairDevice(arg); return; }
  $$("nav.tabs a, nav.bottom-tabs a").forEach((a) => a.setAttribute("aria-current", a.getAttribute("href") === `#/${name}` ? "page" : "false"));
  $("#moreBtn")?.setAttribute("aria-current", MORE.includes(name) ? "page" : "false");
  view.dataset.route = name || "today";
  drawBanner();
  // A connected device that hasn't pulled yet shouldn't show the first-run form: wait for the data.
  if (!onboarded() && configured() && !store.sync.lastSynced && store.sync.status !== "error") {
    view.innerHTML = `<section class="card loading"><p class="marker">Pulling your footage…</p><p class="fine">Fetching your data from the private repo.</p></section>`;
    renderedRev = -1;
    return;
  }
  if (!onboarded() && name !== "office") { renderToday(view); renderedRev = store.rev; return; }
  if (name === "session") renderSession(view, arg);
  else (ROUTES[name] || renderToday)(view);
  renderedRev = store.rev;
  checkMilestones();
}

function navigate() {
  route();
  enter(view);
  window.scrollTo(0, 0);
  view.focus({ preventScroll: true });
}

// Redraw when data changes, but never under someone's fingers mid-typing.
function maybeRerender() {
  if (quiet || store.rev === renderedRev) return;
  const a = document.activeElement;
  const typing = a && view.contains(a) && (a.tagName === "TEXTAREA" || (a.tagName === "INPUT" && !["checkbox", "radio", "button", "submit", "range"].includes(a.type)));
  if (typing || document.querySelector("dialog[open]")) { pendingRender = true; return; }
  const y = window.scrollY;
  route();
  window.scrollTo(0, y);
}
document.addEventListener("focusout", () => setTimeout(() => { if (pendingRender) { pendingRender = false; maybeRerender(); } }, 50));
document.addEventListener("close", () => setTimeout(() => { if (pendingRender || store.rev !== renderedRev) { pendingRender = false; maybeRerender(); } }, 0), true);
window.addEventListener("cut:refresh", () => { if (!document.querySelector("dialog[open]")) maybeRerender(); });

// ---------- milestone celebrations ----------
const LABELS = () => {
  const p = profile(), s = store.state, map = {};
  weightMilestones(weightStatus(s, p), undefined).forEach((m) => { map[m.id] = m.title; });
  liftGoals(s).forEach((g) => g.tiers.forEach((t) => { map[`l-${g.lift}-${t.value}`] = `${g.name}: ${t.title}`; }));
  habitGoals(s, p).forEach((h) => { map[h.id] = h.title; });
  return map;
};
function checkMilestones() {
  if (!onboarded()) return;
  const ids = achievedIds(store.state, profile());
  const fresh = ids.filter((id) => !store.state.milestones[id]);
  if (!fresh.length) return;
  const labels = LABELS();
  quiet = true; // milestones don't change what's on screen
  update((s) => { for (const id of fresh) s.milestones[id] = { date: new Date().toISOString().slice(0, 10), updatedAt: Date.now() }; });
  quiet = false;
  renderedRev = store.rev;
  const first = labels[fresh[0]] || "Milestone";
  celebrate(first, fresh.length > 1 ? `+ ${fresh.length - 1} more milestone${fresh.length > 2 ? "s" : ""} in the can.` : "Another scene in the can.");
}

// ---------- Hevy ----------
export async function hevySyncNow(force = false) {
  const st = store.settings;
  if (!st.hevyKey) return;
  if (!force && st.hevyLast && Date.now() - st.hevyLast < 15 * 60 * 1000) return;
  store.hevySync = { status: "syncing", message: "Syncing with Hevy…" };
  try {
    const { workouts, since } = await pullWorkouts(st.hevyKey, st.hevySince);
    const weights = await pullWeights(st.hevyKey).catch(() => ({}));
    const changed = Object.keys(workouts).length || Object.entries(weights).some(([d, m]) => weighInFromHevy(store.state.weights[d], m));
    if (changed) {
      update((s) => {
        for (const [id, w] of Object.entries(workouts)) {
          const cur = s.hevy.workouts[id];
          if (!cur || (w.updatedAt || 0) >= (cur.updatedAt || 0)) s.hevy.workouts[id] = w;
        }
        // Hevy weigh-ins (your scale's, via Apple Health) only fill gaps; never overwrite one logged here.
        for (const [d, m] of Object.entries(weights)) { const rec = weighInFromHevy(s.weights[d], m); if (rec) s.weights[d] = rec; }
      });
    }
    store.settings.hevySince = since;
    store.settings.hevyLast = Date.now();
    try { localStorage.setItem("cut.settings.v1", JSON.stringify(store.settings)); } catch { /* ignore */ }
    const n = Object.values(workouts).filter((w) => !w.deleted).length;
    store.hevySync = { status: "ok", message: n ? `Pulled ${n} workout${n === 1 ? "" : "s"} from Hevy.` : "Hevy is up to date." };
    if (force && n) toast(store.hevySync.message);
  } catch (e) {
    store.hevySync = { status: "error", message: e.message };
    if (force) toast(e.message, "bad");
  }
  store.emit();
}

// ---------- header ----------
function drawSync() {
  const b = $("#sync");
  const s = store.sync;
  b.dataset.status = s.status;
  b.querySelector("span").textContent = s.status === "ok" ? "synced" : s.status === "syncing" ? "syncing" : s.status === "error" ? "sync error" : "not synced";
  b.title = s.message || "Saved on this device only. Set up sync in Settings.";
}
$("#sync").addEventListener("click", () => {
  if (store.sync.status === "off") { location.hash = "#/office"; return; }
  if (store.sync.status === "error") toast(store.sync.message, "bad");
  syncNow();
  hevySyncNow(true);
});

function clock() {
  const el = $("#tc");
  const slow = reducedMotion();
  const tick = () => {
    const d = new Date();
    const ff = pad(Math.floor(d.getMilliseconds() / 40));
    el.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${slow ? "" : `:${ff}`}`;
    if (slow) setTimeout(tick, 1000); else requestAnimationFrame(tick);
  };
  tick();
}

// ---------- theme ----------
try {
  const t = localStorage.getItem("cut.theme");
  if (t === "dark" || t === "light") document.documentElement.dataset.theme = t;
} catch { /* ignore */ }

// ---------- pairing & the "not synced" banner ----------
async function pairDevice(code) {
  // Drop the token from the address bar and history straight away.
  history.replaceState(null, "", `${location.pathname}#/`);
  const p = readPairCode(code || "");
  if (!p) { toast("That setup link looks broken. Make a fresh one in Settings on your other device.", "bad"); route(); return; }
  view.innerHTML = `<section class="card loading"><p class="marker">Connecting this device…</p><p class="fine">Checking the private repo and pulling your data.</p></section>`;
  try {
    await connectDevice(p.repo, p.token);
    toast("This device is connected. Everything's in sync. 🎬");
  } catch (e) {
    toast(e.message, "bad");
  }
  route();
}

function drawBanner() {
  const b = $("#syncBanner");
  const s = store.sync;
  if (!configured()) {
    b.hidden = false;
    b.className = "sync-banner";
    b.innerHTML = `<span><b>This device isn't syncing.</b> Your other laptops and phone can't see what you log here.</span> <a href="#/office">Connect it →</a>`;
  } else if (s.status === "error") {
    b.hidden = false;
    b.className = "sync-banner bad";
    b.innerHTML = `<span><b>Sync problem:</b> ${s.message.replace(/[<>&]/g, "")}</span> <a href="#/office">Fix it →</a>`;
  } else b.hidden = true;
}

// Bottom-tab "More" sheet on phones.
$("#moreBtn")?.addEventListener("click", () => {
  modal(`<div class="sheet-body more-sheet"><p class="kicker">More</p><nav aria-label="More pages">
    <a href="#/rushes"><b>Photos</b><small>rushes · progress pictures</small></a>
    <a href="#/craft"><b>Meals</b><small>craft services · calories & meal cards</small></a>
    <a href="#/program"><b>Programme</b><small>the plan + Hevy</small></a>
    <a href="#/dailies"><b>Journal</b><small>dailies · past entries</small></a>
    <a href="#/office"><b>Settings</b><small>sync, devices, profile</small></a>
  </nav></div>`, (d) => d.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => d.close())));
});

// ---------- boot ----------
store.subscribe(() => { drawSync(); drawBanner(); maybeRerender(); });
// Pull every minute while the site is open, so devices stay in step without a reload.
setInterval(() => { if (document.visibilityState !== "visible") return; if (configured()) syncNow(); syncGuitar(); }, 60000);
window.addEventListener("focus", () => { if (configured()) syncNow(); });
window.addEventListener("hashchange", navigate);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") { syncNow(); hevySyncNow(); syncGuitar(); if (store.rev === renderedRev) route(); }
});
// Midnight rollover: redraw so "today" moves on.
let lastDay = new Date().toDateString();
setInterval(() => { if (new Date().toDateString() !== lastDay) { lastDay = new Date().toDateString(); route(); } }, 60000);

clock();
drawSync();
route();
enter(view);
syncNow();
hevySyncNow();
syncGuitar(true);
// Guitar Hero (same site) saving a lesson in another tab ticks the list straight away.
window.addEventListener("storage", (e) => { if (e.key === "gh.state.v1") applyGuitar(); });
window.__cut = { store, setRec, syncNow, pairLink }; // handy for debugging in the console
