// Shared view helpers: the "now" context, dialogs, toasts, celebrations and nudge copy.
import { addDays, daysBetween, esc, pickRandom, reducedMotion, today, weekday } from "./util.js?v=3";
import { profile, store } from "./store.js?v=3";
import { weightStatus } from "./goals.js?v=3";
import { seasonInfo, SESSIONS } from "./program.js?v=3";
import { dayStatus, perfectStreak, scheduledType, streak, trainedOn, typeOn } from "./schedule.js?v=3";
import { isBirthday, age } from "./body.js?v=3";

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function context(now = today()) {
  const s = store.state, p = profile();
  const ws = weightStatus(s, p, now);
  const season = seasonInfo(s.startDate || now, now);
  const type = trainedOn(s, now) ? typeOn(s, now) : scheduledType(s, now) || "rest";
  const yStatus = dayStatus(s, addDays(now, -1), now);
  const togo = ws.current != null ? Math.round(Math.abs(ws.current - p.goalKg) * 10) / 10 : null;
  const ep = s.startDate ? daysBetween(s.startDate, now) + 1 : 1;
  return {
    now, profile: p, ws, season, type, session: SESSIONS[type],
    name: p.name, hour: new Date().getHours(), weekday: weekday(now),
    streak: streak(s, now), perfect: perfectStreak(s, p, now).current,
    togo, goal: p.goalKg, week: season.week, phase: season.phase.name, phaseKey: season.phase.key,
    ep: String(ep).padStart(2, "0"), dayNumber: ep,
    missedYesterday: yStatus === "missed" || yStatus === "broken",
    weighDay: p.weighDays.includes(weekday(now)), photoDay: weekday(now) === p.photoDay,
    birthday: isBirthday(p.birthday, now), age: age(p.birthday, now),
  };
}

// ---------- toast ----------
let toastTimer;
export function toast(msg, kind = "") {
  let t = $("#toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.setAttribute("role", "status"); document.body.append(t); }
  t.textContent = msg;
  t.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
}

// ---------- dialog ----------
export function modal(html, onMount) {
  const d = document.createElement("dialog");
  d.className = "sheet";
  d.innerHTML = `<button class="x" type="button" aria-label="Close" data-close>✕</button>${html}`;
  document.body.append(d);
  d.addEventListener("close", () => d.remove());
  d.addEventListener("click", (e) => { if (e.target === d || e.target.closest("[data-close]")) d.close(); });
  d.showModal();
  onMount?.(d);
  return d;
}

// ---------- "that's a wrap" ----------
export function celebrate(title, sub = "") {
  document.querySelectorAll(".wrap-overlay").forEach((x) => x.remove()); // one celebration at a time
  const o = document.createElement("div");
  o.className = "wrap-overlay";
  o.setAttribute("role", "alert");
  o.innerHTML = `
    <div class="clap" aria-hidden="true"><div class="clap-top"></div><div class="clap-body"><span>THE CUT</span><span>MILESTONE</span></div></div>
    <p class="wrap-title">${esc(title)}</p>
    ${sub ? `<p class="wrap-sub">${esc(sub)}</p>` : ""}
    <p class="wrap-hint">That's a wrap · tap to continue</p>`;
  if (!reducedMotion()) {
    for (let i = 0; i < 70; i++) {
      const c = document.createElement("i");
      c.className = "confetti";
      c.style.left = `${Math.random() * 100}%`;
      c.style.animationDelay = `${Math.random() * 0.6}s`;
      c.style.animationDuration = `${1.6 + Math.random() * 1.6}s`;
      c.style.setProperty("--r", `${Math.random() * 720 - 360}deg`);
      c.dataset.k = String(i % 4);
      o.append(c);
    }
  }
  const close = () => o.remove();
  o.addEventListener("click", close);
  document.addEventListener("keydown", function k(e) { if (e.key === "Escape" || e.key === "Enter") { close(); document.removeEventListener("keydown", k); } });
  document.body.append(o);
  setTimeout(close, 7000);
}

// ---------- nudges: warm, never guilt-tripping, and always about the why ----------
const NUDGES = {
  broken: [
    "You moved a session, then skipped the day after. That's the one rule we set to stop moves turning into skips. No drama, just get back on the floor today.",
    "A move followed by a skip: that's how 'busy week' quietly becomes 'stopped going'. Let's not write that scene. Next session, no excuses.",
  ],
  missed: [
    "{n} missed sessions in the last fortnight. One is life. Two is the start of a habit, and not the one we're building.",
    "The gym's been missing you ({n} missed in two weeks). Today's session doesn't have to be perfect. It just has to happen.",
  ],
  pattern: [
    "Misses, moves and excuses are stacking up lately. Individually they're fine; together they look like drifting. Let's tighten the next week up.",
    "Looking at the last four weeks, the footage is getting patchy. Nothing's lost yet, but now's the moment to recommit.",
  ],
  moves: [
    "{n} moved sessions in four weeks. Moving is allowed, but if the schedule keeps moving, maybe the schedule needs a rethink. Or maybe it just needs you to show up.",
    "That's {n} moves recently. The plan works because it's boring and predictable. Let's keep the next week exactly as scheduled.",
  ],
  excuses: [
    "{n} excused days in four weeks. If you're genuinely ill or away, look after yourself. If it's more 'meh' than 'sick', a light session beats none.",
    "Plenty of excused days lately ({n}). Real ones are fine. Just be honest with yourself about which ones were real.",
  ],
  behind: [
    "This week's looking light: {n} more session(s) to hit five. Move one to the weekend from the Timeline if you need to.",
    "Five a week is the deal, and you're {n} short. There's still time to make this week count.",
  ],
};
export function nudgeText(n) {
  return pickRandom(NUDGES[n.kind]).replace("{n}", n.count);
}

export const why = () => profile().why;
export const syncBadge = () => store.sync;
