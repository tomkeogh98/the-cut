// The rules: which days are scheduled, what counts as done, moves, excuses, and the slacking check.
// scripts/nudge.py in the-cut-data mirrors dayStatus/weekSummary/nudgeCheck. Keep them in sync.
import { addDays, daysBetween, isWeekend, live, mondayOf, today, weekday } from "./util.js?v=7";
import { plannedType, SESSIONS } from "./program.js?v=7";

export const REASONS = {
  sick: { label: "Sick", mark: "S" },
  holiday: { label: "Holiday", mark: "H" },
  emergency: { label: "Emergency", mark: "E" },
};
export const WEEKLY_MIN = 5;
export const WATER_GOAL = 4000;

// ---------- what happened on a day ----------
export const hevyOn = (state, date) => Object.values(state.hevy?.workouts || {}).filter((w) => live(w) && w.date === date);
export const sessionsOn = (state, date) => Object.values(state.sessions || {}).filter((s) => live(s) && s.date === date);
export const trainedOn = (state, date) => sessionsOn(state, date).length > 0 || hevyOn(state, date).length > 0;
export const excuseOn = (state, date) => (live(state.excuses?.[date]) ? state.excuses[date] : null);
export const shiftFrom = (state, date) => (live(state.shifts?.[date]) ? state.shifts[date] : null);
export const shiftInto = (state, date) => Object.entries(state.shifts || {}).find(([, s]) => live(s) && s.to === date) || null;

// The session type planned for a date, after moves. null when nothing's planned (moved away or weekend).
export function scheduledType(state, date) {
  if (shiftFrom(state, date)) return null;
  const into = shiftInto(state, date);
  if (into) return plannedType(into[0]);
  const t = plannedType(date);
  return t === "rest" ? null : t;
}
export const isScheduled = (state, date) => scheduledType(state, date) != null;

// The type of training actually done (or planned) on a date.
export function typeOn(state, date) {
  const s = sessionsOn(state, date)[0];
  if (s?.type) return s.type;
  const w = hevyOn(state, date)[0];
  if (w) return matchType(w.title) || scheduledType(state, date) || "upperA";
  return scheduledType(state, date) || "rest";
}

export function matchType(title = "") {
  const t = title.toLowerCase();
  if (/upper\s*a\b/.test(t)) return "upperA";
  if (/upper\s*b\b/.test(t)) return "upperB";
  if (/lower\s*a\b/.test(t)) return "lowerA";
  if (/lower\s*b\b/.test(t)) return "lowerB";
  if (/run/.test(t)) return "run";
  return null;
}

// A weekday straight after a moved session is locked: it can't be skipped (weekends are exempt).
export function lockedBy(state, date) {
  if (isWeekend(date)) return null;
  const prev = addDays(date, -1);
  return !isWeekend(prev) && shiftFrom(state, prev) ? prev : null;
}

// done (green) · off (grey) · missed (red) · broken (red, rule broken) · moved · excused · today · planned · pre
export function dayStatus(state, date, now = today()) {
  if (state.startDate && date < state.startDate) return "pre";
  if (trainedOn(state, date)) return "done";
  if (excuseOn(state, date)) return "excused";
  if (shiftFrom(state, date)) return "moved";
  if (!isScheduled(state, date)) return "off";
  if (date < now) return lockedBy(state, date) ? "broken" : "missed";
  if (date === now) return "today";
  return "planned";
}

export function weekSummary(state, anyDate, now = today()) {
  const mon = mondayOf(anyDate);
  let trained = 0, excused = 0, left = 0, beforeStart = 0, moved = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i);
    const st = dayStatus(state, d, now);
    if (st === "done") trained++;
    else if (st === "excused") excused++;
    else if (st === "today" || st === "planned") left++;
    else if (st === "pre" && isScheduled(state, d)) beforeStart++; // first week is pro-rated
    if (shiftFrom(state, d)) moved++;
  }
  const required = Math.max(0, WEEKLY_MIN - excused - beforeStart);
  return { mon, trained, excused, moved, required, left, onTrack: trained + left >= required, hit: trained >= required };
}

// Consecutive scheduled days trained, counting back. Off, moved and excused days don't break it.
export function streak(state, now = today()) {
  let n = 0;
  for (let d = now, guard = 0; guard < 1000; d = addDays(d, -1), guard++) {
    const st = dayStatus(state, d, now);
    if (st === "pre") break;
    if (st === "done") n++;
    else if (st === "missed" || st === "broken") break;
  }
  return n;
}

// ---------- moving a session ----------
// Moves stay inside the Mon–Sun week, today or later, onto a free day. No back-to-back moves.
export function shiftCheck(state, from, now = today()) {
  if (from < now) return { ok: false, why: "That day's already been and gone." };
  if (!isScheduled(state, from) || shiftInto(state, from)) return { ok: false, why: "Nothing to move: there's no session planned that day (or it's already a moved session)." };
  if (trainedOn(state, from)) return { ok: false, why: "You've already trained that day." };
  const prev = addDays(from, -1), next = addDays(from, 1);
  if (!isWeekend(from) && !isWeekend(prev) && shiftFrom(state, prev)) return { ok: false, why: "You moved the day before, so this one's locked. If you move a day, the next one can't be skipped." };
  if (!isWeekend(next) && shiftFrom(state, next)) return { ok: false, why: "The next day's session is already moved. Two moves in a row isn't allowed." };
  const targets = shiftTargets(state, from, now);
  if (!targets.length) return { ok: false, why: "There's no free day left this week to move it to." };
  return { ok: true, targets };
}

export function shiftTargets(state, from, now = today()) {
  const mon = mondayOf(from);
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i);
    if (d === from || d < now) continue;
    if (!isScheduled(state, d) && !shiftFrom(state, d) && !trainedOn(state, d) && !excuseOn(state, d)) out.push(d);
  }
  return out;
}

// ---------- the daily checklist (75-Hard style) ----------
export function dayChecks(state, date, profile) {
  const c = state.checks?.[date] || {};
  const sched = isScheduled(state, date) || trainedOn(state, date);
  const items = {
    train: sched ? trainedOn(state, date) || Boolean(excuseOn(state, date)) : null, // null = not needed today
    water: (c.water || 0) >= WATER_GOAL,
    guitar: Boolean(c.guitar),
    read: Boolean(c.read),
    journal: live(state.journal?.[date]) && Boolean(state.journal[date].text?.trim()),
    weigh: profile.weighDays.includes(weekday(date)) ? live(state.weights?.[date]) : null,
    photo: weekday(date) === profile.photoDay ? Object.values(state.photos || {}).some((p) => live(p) && p.date === date) : null,
  };
  const core = ["train", "water", "guitar", "read", "journal"].filter((k) => items[k] !== null);
  const done = core.filter((k) => items[k]).length;
  return { items, water: c.water || 0, core, done, perfect: done === core.length };
}

export function perfectStreak(state, profile, now = today()) {
  let n = 0, best = 0, run = 0;
  const start = state.startDate || now;
  for (let d = start; d <= now; d = addDays(d, 1)) {
    const p = dayChecks(state, d, profile).perfect;
    if (p) { run++; best = Math.max(best, run); } else if (d !== now) run = 0;
  }
  n = run;
  return { current: n, best };
}

// ---------- slacking check (mirrored in scripts/nudge.py) ----------
export function slackReport(state, now = today()) {
  const r = { missed14: 0, missed28: 0, broken28: 0, moved28: 0, excused28: 0 };
  for (let i = 1; i <= 28; i++) {
    const d = addDays(now, -i);
    const st = dayStatus(state, d, now);
    if (st === "missed" || st === "broken") { r.missed28++; if (i <= 14) r.missed14++; }
    if (st === "broken") r.broken28++;
    if (st === "excused") r.excused28++;
    if (shiftFrom(state, d)) r.moved28++;
  }
  r.score = r.missed28 * 2 + r.broken28 * 3 + r.moved28 + r.excused28;
  return r;
}

export function nudgeCheck(state, now = today()) {
  if (!state.startDate) return null;
  const r = slackReport(state, now);
  const wk = weekSummary(state, now, now);
  if (r.broken28 >= 1) return { kind: "broken", count: r.broken28, report: r };
  if (r.missed14 >= 2) return { kind: "missed", count: r.missed14, report: r };
  if (r.score >= 6) return { kind: "pattern", count: r.score, report: r };
  if (r.moved28 >= 3) return { kind: "moves", count: r.moved28, report: r };
  if (r.excused28 >= 4) return { kind: "excuses", count: r.excused28, report: r };
  if (!wk.onTrack && daysBetween(state.startDate, now) >= 3) return { kind: "behind", count: wk.required - wk.trained, report: r };
  return null;
}

// What happened before `date`: yesterday if it was trained, missed or excused; otherwise the last
// session in the previous 3 days (so Monday looks back to Friday), else a rest day.
export function previousDay(state, date) {
  const y = addDays(date, -1);
  if (trainedOn(state, y)) return { date: y, type: typeOn(state, y), trained: true, gap: 1 };
  const st = dayStatus(state, y, date);
  if (st === "missed" || st === "broken") return { date: y, type: scheduledType(state, y), trained: false, missed: true, gap: 1 };
  if (st === "excused") return { date: y, type: "rest", trained: false, excused: excuseOn(state, y).reason, gap: 1 };
  for (let i = 2; i <= 3; i++) {
    const d = addDays(date, -i);
    if (trainedOn(state, d)) return { date: d, type: typeOn(state, d), trained: true, gap: i };
  }
  return { date: y, type: "rest", trained: false, gap: 1 };
}

// Which "how it builds" transition to use: missed/excused days count as rest, and a rest day
// two or more days after the last session is just another rest day.
export const buildFrom = (prev, todayType) => (!prev.trained || (prev.gap > 1 && todayType === "rest") ? "rest" : prev.type);

export const sessionLabel = (type) => SESSIONS[type]?.name || "Rest";
