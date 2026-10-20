// Hevy integration: pull workouts + body weight from the Hevy API (needs Hevy Pro),
// push the programme as routines, or import Hevy's CSV export. The API allows browser calls (CORS *).
import { fmt, live } from "./util.js?v=11";
import { LIFTS, SESSIONS } from "./program.js?v=11";

const BASE = "https://api.hevyapp.com/v1";
export const cleanKey = (v) => String(v || "").toLowerCase().replace(/[^0-9a-f-]/g, "");

async function call(key, path, opts = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...opts,
      headers: { "api-key": key, Accept: "application/json", ...(opts.body ? { "Content-Type": "application/json" } : {}), ...(opts.headers || {}) },
    });
  } catch {
    throw new Error(navigator.onLine === false ? "You're offline, so Hevy can't be reached right now." : "Couldn't reach Hevy. Check your connection or any content blocker.");
  }
  if (res.status === 401) throw new Error("Hevy rejected the API key. Copy it again from hevy.com → Settings → Developer (needs Hevy Pro).");
  if (res.status === 429) throw new Error("Hevy says slow down (rate limit). Try again in a minute.");
  return res;
}
async function json(res) {
  if (!res.ok) {
    let msg = res.statusText;
    try { const b = await res.json(); msg = b.error || msg; } catch { /* not JSON */ }
    throw new Error(`Hevy: ${msg} (${res.status})`);
  }
  return res.status === 204 ? null : res.json().catch(() => null);
}

export async function testKey(key) {
  const res = await call(key, "/user/info");
  const body = await json(res);
  return body?.data?.name || body?.name || "your Hevy account";
}

// ---------- workouts ----------
export function compact(w) {
  const start = new Date(w.start_time);
  return {
    id: w.id,
    title: w.title || "Workout",
    date: fmt(start),
    start: w.start_time,
    end: w.end_time,
    updatedAt: Date.parse(w.updated_at || w.end_time || w.start_time) || Date.now(),
    ex: (w.exercises || []).map((e) => ({
      t: e.title,
      sets: (e.sets || []).map((s) => [s.weight_kg ?? null, s.reps ?? null, s.type || "normal", s.distance_meters ?? null, s.duration_seconds ?? null]),
    })),
  };
}

// Incremental sync via the events feed. Returns { workouts: {id: compact|tombstone}, since }.
export async function pullWorkouts(key, since) {
  const out = {};
  const stamp = new Date().toISOString();
  let page = 1, pages = 1;
  do {
    const q = new URLSearchParams({ page, pageSize: 10, since: since || "1970-01-01T00:00:00Z" });
    const res = await call(key, `/workouts/events?${q}`);
    if (res.status === 404) break; // no pages
    const body = await json(res);
    pages = body.page_count || 1;
    for (const ev of body.events || []) {
      if (ev.type === "deleted") out[ev.id] = { id: ev.id, deleted: true, updatedAt: Date.parse(ev.deleted_at) || Date.now() };
      else if (ev.workout) out[ev.workout.id] = compact(ev.workout);
    }
    page++;
  } while (page <= pages && page <= 60);
  return { workouts: out, since: stamp };
}

export async function pullWeights(key) {
  const out = {};
  let page = 1, pages = 1;
  do {
    const res = await call(key, `/body_measurements?page=${page}&pageSize=10`);
    if (res.status === 404) break;
    const body = await json(res);
    pages = body.page_count || 1;
    for (const m of body.body_measurements || []) if (m.weight_kg) out[m.date] = Number(m.weight_kg);
    page++;
  } while (page <= pages && page <= 30);
  return out;
}

// Create a weigh-in in Hevy. Never overwrites: Hevy's PUT nulls every other measurement on that date.
export async function pushWeight(key, date, weightKg) {
  const res = await call(key, "/body_measurements", { method: "POST", body: JSON.stringify({ date, weight_kg: weightKg }) });
  if (res.status === 409) return "exists";
  await json(res);
  return "created";
}

// ---------- routines ----------
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

async function allTemplates(key) {
  const list = [];
  let page = 1, pages = 1;
  do {
    const body = await json(await call(key, `/exercise_templates?page=${page}&pageSize=100`));
    pages = body.page_count || 1;
    list.push(...(body.exercise_templates || []));
    page++;
  } while (page <= pages && page <= 20);
  return list;
}

async function listAll(key, path, field) {
  const list = [];
  let page = 1, pages = 1;
  do {
    const res = await call(key, `${path}?page=${page}&pageSize=10`);
    if (res.status === 404) break;
    const body = await json(res);
    pages = body.page_count || 1;
    list.push(...(body[field] || []));
    page++;
  } while (page <= pages && page <= 30);
  return list;
}

export function findTemplate(templates, names) {
  const byTitle = new Map(templates.map((t) => [norm(t.title), t]));
  for (const n of names) { const t = byTitle.get(norm(n)); if (t) return t; }
  // fall back to the closest title that contains every word of the first name
  const words = norm(names[0]).split(" ");
  return templates.find((t) => words.every((w) => norm(t.title).includes(w))) || null;
}

// Creates (or updates) a "The Cut" folder with one routine per lifting session. Calls onStep(msg) as it goes.
export async function pushRoutines(key, onStep = () => {}) {
  onStep("Fetching Hevy's exercise library…");
  const templates = await allTemplates(key);
  onStep("Looking for a 'The Cut' folder…");
  const folders = await listAll(key, "/routine_folders", "routine_folders");
  let folder = folders.find((f) => f.title === "The Cut");
  if (!folder) {
    const body = await json(await call(key, "/routine_folders", { method: "POST", body: JSON.stringify({ routine_folder: { title: "The Cut" } }) }));
    folder = body.routine_folder || body;
  }
  const existing = await listAll(key, "/routines", "routines");
  const report = [];
  for (const type of ["upperA", "lowerA", "upperB", "lowerB"]) {
    const s = SESSIONS[type];
    const title = `${s.name} · ${s.tag}`;
    const missing = [];
    const exercises = [];
    for (const ex of s.exercises) {
      const t = findTemplate(templates, ex.hevy);
      if (!t) { missing.push(ex.name); continue; }
      exercises.push({
        exercise_template_id: t.id,
        superset_id: null,
        rest_seconds: ex.rest,
        notes: ex.cue,
        sets: Array.from({ length: ex.sets }, () => ({ type: "normal", weight_kg: null, reps: null, rep_range: { start: ex.reps[0], end: ex.reps[1] } })),
      });
    }
    const routine = { title, notes: `${s.focus}. Built by The Cut.`, exercises };
    const found = existing.find((r) => r.title === title);
    onStep(`${found ? "Updating" : "Creating"} ${s.name}…`);
    if (found) await json(await call(key, `/routines/${found.id}`, { method: "PUT", body: JSON.stringify({ routine }) }));
    else await json(await call(key, "/routines", { method: "POST", body: JSON.stringify({ routine: { ...routine, folder_id: folder.id } }) }));
    report.push({ name: s.name, count: exercises.length, missing, updated: Boolean(found) });
  }
  return report;
}

// ---------- CSV import (Hevy → Settings → Export & Import Data → Export workouts) ----------
function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x !== ""));
}

const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
function parseHevyDate(s) {
  const m = /^(\d{1,2}) (\w{3}) (\d{4}),? (\d{1,2}):(\d{2})/.exec(s.trim());
  if (m) return new Date(+m[3], MON[m[2].toLowerCase()], +m[1], +m[4], +m[5]);
  const d = new Date(s);
  return Number.isNaN(+d) ? null : d;
}

export function importCSV(text) {
  const rows = parseCSV(text.replace(/^﻿/, ""));
  const head = rows.shift()?.map((h) => h.trim().toLowerCase());
  if (!head || !head.includes("exercise_title") || !head.includes("start_time")) throw new Error("That doesn't look like a Hevy workout export (no exercise_title / start_time columns).");
  const col = (r, n) => r[head.indexOf(n)];
  const lbs = head.includes("weight_lbs") && !head.includes("weight_kg");
  const out = {};
  for (const r of rows) {
    const startRaw = col(r, "start_time");
    const start = parseHevyDate(startRaw || "");
    if (!start) continue;
    const id = `csv-${start.getTime()}`;
    const w = out[id] ||= { id, title: col(r, "title") || "Workout", date: fmt(start), start: start.toISOString(), end: null, updatedAt: start.getTime(), ex: [] };
    const name = col(r, "exercise_title");
    let ex = w.ex.find((e) => e.t === name);
    if (!ex) { ex = { t: name, sets: [] }; w.ex.push(ex); }
    const wt = parseFloat(lbs ? col(r, "weight_lbs") : col(r, "weight_kg"));
    const kgV = Number.isNaN(wt) ? null : Math.round((lbs ? wt * 0.453592 : wt) * 100) / 100;
    const reps = parseInt(col(r, "reps"), 10);
    ex.sets.push([kgV, Number.isNaN(reps) ? null : reps, col(r, "set_type") || "normal", null, null]);
  }
  return out;
}

// ---------- reading lifts back out ----------
const LIFT_MATCH = {
  bench: /^bench press \(barbell\)$/i,
  squat: /^(squat \(barbell\)|back squat|safety bar squat|full squat)/i,
  ohp: /^(overhead press \(barbell\)|standing military press|military press)/i,
  deadlift: /(trap bar deadlift|deadlift \(trap bar\))/i,
  pullup: /^(pull up|chin up)(?! \(assisted\))/i,
};
export const epley = (w, r) => (r <= 1 ? w : w * (1 + r / 30));
const working = (s) => s[2] !== "warmup" && s[1] > 0;

// Best e1RM (or best reps for pull-ups) per workout date, oldest first.
export function liftHistory(state, lift) {
  const re = LIFT_MATCH[lift];
  const pts = [];
  for (const w of Object.values(state.hevy?.workouts || {})) {
    if (!live(w)) continue;
    let best = null;
    for (const e of w.ex || []) {
      if (!re.test(e.t)) continue;
      for (const s of e.sets.filter(working)) {
        if (lift === "pullup") {
          const v = s[1];
          if (!best || v > best.value) best = { value: v, kg: s[0] || 0, reps: s[1] };
        } else if (s[0] > 0 && s[1] <= 12) {
          const v = epley(s[0], s[1]);
          if (!best || v > best.value) best = { value: v, kg: s[0], reps: s[1] };
        }
      }
    }
    if (best) pts.push({ date: w.date, ...best });
  }
  return pts.sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function liftNow(state, lift, now) {
  const h = liftHistory(state, lift);
  if (!h.length) return null;
  const recent = h.filter((p) => p.date >= addDaysStr(now, -42));
  const pool = recent.length ? recent : h;
  const best = pool.reduce((a, b) => (b.value > a.value ? b : a));
  return { ...best, first: h[0], sessions: h.length, unit: LIFTS[lift].unit };
}
function addDaysStr(s, n) { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return fmt(d); }

// The last time an exercise from the programme was done, and what to aim for next (double progression).
export function lastPerformance(state, ex) {
  const names = new Set(ex.hevy.map(norm));
  const ws = Object.values(state.hevy?.workouts || {}).filter(live).sort((a, b) => (a.start < b.start ? 1 : -1));
  for (const w of ws) {
    const e = (w.ex || []).find((x) => names.has(norm(x.t)));
    if (!e) continue;
    const sets = e.sets.filter(working);
    if (!sets.length) continue;
    const top = Math.max(...sets.map((s) => s[0] || 0));
    const atTop = sets.filter((s) => (s[0] || 0) === top);
    const allTop = atTop.length >= ex.sets && atTop.every((s) => s[1] >= ex.reps[1]);
    const lower = /squat|deadlift|leg|lunge|calf|romanian/i.test(ex.name);
    const db = /dumbbell|lateral|curl/i.test(ex.name);
    const step = db ? 2 : lower ? 5 : 2.5;
    let aim;
    if (!top) aim = `Beat ${Math.max(...sets.map((s) => s[1]))} reps`;
    else if (allTop) aim = `Go up to ${top + step} kg × ${ex.reps[0]}+`;
    else {
      const minReps = Math.min(...atTop.map((s) => s[1]));
      aim = `${top} kg: get ${Math.min(minReps + 1, ex.reps[1])}+ reps on every set`;
    }
    return { date: w.date, sets: sets.map((s) => (s[0] ? `${s[0]}×${s[1]}` : `${s[1]}`)), top, aim };
  }
  return null;
}
