// The shell: routing, header (timecode + sync), Hevy auto-sync and milestone celebrations.
import { pad, reducedMotion } from "./util.js?v=1";
import { onboarded, profile, setRec, store, syncNow, update } from "./store.js?v=1";
import { $, $$, celebrate, toast } from "./ui.js?v=1";
import { renderSession, renderToday } from "./view-today.js?v=1";
import { renderDailies, renderRushes, renderScope, renderTimeline } from "./view-track.js?v=1";
import { renderCraft, renderOffice, renderProgram, renderScript } from "./view-plan.js?v=1";
import { achievedIds, habitGoals, liftGoals, weightMilestones, weightStatus } from "./goals.js?v=1";
import { pullWeights, pullWorkouts } from "./hevy.js?v=1";

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

function route() {
  const [name, arg] = location.hash.replace(/^#\/?/, "").split("/");
  $$("nav.tabs a").forEach((a) => a.setAttribute("aria-current", a.getAttribute("href") === `#/${name}` ? "page" : "false"));
  if (!onboarded() && name !== "office") { renderToday(view); renderedRev = store.rev; return; }
  if (name === "session") renderSession(view, arg);
  else (ROUTES[name] || renderToday)(view);
  renderedRev = store.rev;
  checkMilestones();
}

function navigate() {
  route();
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
    const changed = Object.keys(workouts).length || Object.keys(weights).some((d) => !store.state.weights[d]);
    if (changed) {
      update((s) => {
        for (const [id, w] of Object.entries(workouts)) {
          const cur = s.hevy.workouts[id];
          if (!cur || (w.updatedAt || 0) >= (cur.updatedAt || 0)) s.hevy.workouts[id] = w;
        }
        // Hevy weigh-ins only fill gaps; never overwrite one logged here.
        for (const [d, v] of Object.entries(weights)) if (!s.weights[d]) s.weights[d] = { kg: v, source: "hevy", updatedAt: 1 };
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
  b.querySelector("span").textContent = s.status === "ok" ? "synced" : s.status === "syncing" ? "syncing" : s.status === "error" ? "sync error" : "local only";
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

// ---------- boot ----------
store.subscribe(() => { drawSync(); maybeRerender(); });
window.addEventListener("hashchange", navigate);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") { syncNow(); hevySyncNow(); if (store.rev === renderedRev) route(); }
});
// Midnight rollover: redraw so "today" moves on.
let lastDay = new Date().toDateString();
setInterval(() => { if (new Date().toDateString() !== lastDay) { lastDay = new Date().toDateString(); route(); } }, 60000);

clock();
drawSync();
route();
syncNow();
hevySyncNow();
window.__cut = { store, setRec }; // handy for debugging in the console
