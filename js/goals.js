// Milestones: weight steps to the goal, lift targets that adapt to current strength, and habit milestones.
import { addDays, daysBetween, live, today } from "./util.js?v=15";
import { projectDate, weeklyRate, weightSeries, withTrend } from "./body.js?v=15";
import { liftHistory, liftNow } from "./hevy.js?v=15";
import { LIFTS, seasonInfo } from "./program.js?v=15";
import { dayChecks, perfectStreak, trainedOn, weekSummary } from "./schedule.js?v=15";

// ---------- weight ----------
export function weightStatus(state, profile, now = today()) {
  // The journey starts on day one: older weigh-ins (e.g. years of Hevy history) are kept but not part of the trend.
  const raw = weightSeries(state);
  const from = state.startDate || "0000";
  const series = withTrend(raw.filter((p) => p.date >= from));
  const last = series[series.length - 1];
  const start = profile.startKg ?? series[0]?.kg ?? null;
  const current = last?.trend ?? start;
  const rate = weeklyRate(series, 28, now);
  return { series, history: withTrend(raw), before: raw.length - series.length, start, current, latest: last?.kg ?? null, latestDate: last?.date ?? null, rate, goal: profile.goalKg };
}

export function weightMilestones(ws, now = today()) {
  const { start, current, goal, rate } = ws;
  if (start == null) return [];
  const dir = goal < start ? -1 : 1;
  const gap = Math.abs(goal - start);
  const out = [];
  if (gap >= 1) {
    const step = gap > 12 ? 3 : 2;
    for (let k = start + dir * step; dir * (goal - k) > 0.9; k += dir * step) out.push(Math.round(k));
  }
  const half = Math.round((start + goal) / 2 * 2) / 2;
  if (gap >= 6 && !out.includes(Math.round(half))) out.push(half);
  out.sort((a, b) => dir * (a - b));
  const items = out.map((k) => ({ kg: k, title: k === half ? `Halfway: ${k} kg` : `${k} kg on the scale`, final: false }));
  items.push({ kg: goal, title: `FINAL CUT: ${goal} kg`, final: true });
  return items.map((m) => {
    const done = current != null && dir * (current - m.kg) >= -0.05;
    return { ...m, id: `w${m.kg}`, kind: "weight", done, due: done ? null : projectDate(current, m.kg, rate, now),
      desc: m.final ? "The goal you set out for. Trend weight, not a one-off morning." : `${Math.abs(m.kg - start).toFixed(1)} kg ${dir < 0 ? "down" : "up"} from where you started.` };
  });
}

// ---------- lifts ----------
const TIERS = {
  bench: [[40, "First real bench"], [60, "One plate a side"], [80, "80 club"], [100, "Two plates a side"], [120, "Big bench"], [140, "Three plates a side"]],
  squat: [[60, "One plate a side"], [100, "Two plates a side"], [120, "Squat 120"], [140, "Three plates a side"], [160, "Squat 160"], [180, "Four plates a side"]],
  ohp: [[30, "First press"], [40, "Press 40"], [50, "Press 50"], [60, "One plate overhead"], [70, "Press 70"], [80, "Strong press"]],
  deadlift: [[80, "Trap bar 80"], [100, "Trap bar 100"], [140, "Trap bar 140"], [180, "Two × bodyweight"], [200, "Trap bar 200"], [220, "Trap bar 220"]],
  pullup: [[1, "First strict pull-up"], [5, "Five clean"], [8, "Eight clean"], [10, "Double figures"], [12, "Twelve clean"], [15, "Fifteen clean"]],
};
// Expected weekly gains by training age: beginners progress fast, then it slows.
const RATE = { bench: 1.0, squat: 2.0, ohp: 0.5, deadlift: 2.5, pullup: 0.5 };

export function trainingWeeks(state, lift, now = today()) {
  const h = liftHistory(state, lift);
  return h.length ? daysBetween(h[0].date, now) / 7 : 0;
}

export function liftGoals(state, now = today()) {
  return Object.keys(LIFTS).map((lift) => {
    const cur = liftNow(state, lift, now);
    const tiers = TIERS[lift];
    if (!cur) {
      return { lift, name: LIFTS[lift].name, cur: null, tiers: tiers.map(([v, t]) => ({ value: v, title: t, done: false, locked: true })) };
    }
    const age = trainingWeeks(state, lift, now);
    const rate = RATE[lift] * (age < 16 ? 1 : age < 52 ? 0.5 : 0.25);
    const value = lift === "pullup" ? cur.value : Math.round(cur.value * 10) / 10;
    const best = Math.max(...liftHistory(state, lift).map((p) => p.value));
    const rows = tiers.map(([v, t]) => {
      const done = best >= v;
      const due = done ? null : addDays(now, Math.max(2, Math.ceil((v - value) / rate)) * 7);
      return { value: v, title: t, done, due };
    });
    // A near-term "next PR": the next 2.5 kg (or 1 rep) above the current estimate.
    const nextPR = lift === "pullup" ? cur.value + 1 : Math.ceil((value + 0.1) / 2.5) * 2.5;
    return { lift, name: LIFTS[lift].name, cur, value, rate, tiers: rows, nextPR, nextDue: addDays(today(), lift === "pullup" ? 14 : 7) };
  });
}

// A rough level from main lifts relative to bodyweight.
export function level(state, bw, now = today()) {
  const ratios = { bench: 1.0, squat: 1.35, deadlift: 1.6, ohp: 0.65 };
  const scores = Object.entries(ratios).map(([k, r]) => {
    const c = liftNow(state, k, now);
    return c ? c.value / (bw * r) : null;
  }).filter((x) => x != null);
  if (!scores.length) return { key: "rookie", name: "Rookie", line: "No lifts logged yet. Your first few sessions set the baseline every target is built from." };
  const avg = scores.reduce((a, b) => a + b) / scores.length;
  if (avg < 0.7) return { key: "novice", name: "Novice", line: "Fast-gains territory. Add weight or reps almost every session; this is the most fun the bar will ever be." };
  if (avg < 1.0) return { key: "developing", name: "Developing", line: "Progress is slowing to week-to-week. Double progression and good sleep do the heavy lifting now." };
  if (avg < 1.3) return { key: "intermediate", name: "Intermediate", line: "Solid. PRs now come per block, not per week. Trust the phases." };
  return { key: "advanced", name: "Advanced", line: "Proper strong. Small, patient jumps from here." };
}

// ---------- habits ----------
export function habitGoals(state, profile, now = today()) {
  const sessions = new Set();
  for (let d = state.startDate || now; d <= now; d = addDays(d, 1)) if (trainedOn(state, d)) sessions.add(d);
  const photos = Object.values(state.photos || {}).filter(live);
  const journals = Object.values(state.journal || {}).filter((j) => live(j) && j.text?.trim()).length;
  const ps = perfectStreak(state, profile, now);
  let fullWeeks = 0, run = 0, bestRun = 0;
  if (state.startDate) {
    for (let mon = weekSummary(state, state.startDate, now).mon; mon <= now; mon = addDays(mon, 7)) {
      const wk = weekSummary(state, mon, now);
      if (addDays(mon, 6) > now) break;
      if (wk.hit) { fullWeeks++; run++; bestRun = Math.max(bestRun, run); } else run = 0;
    }
  }
  const waterDays = Object.keys(state.checks || {}).filter((d) => dayChecks(state, d, profile).items.water).length;
  const season = state.startDate ? seasonInfo(state.startDate, now) : null;
  const H = [
    ["h-week1", "First week in the can", "Five sessions in one week.", fullWeeks, 1],
    ["h-weeks4", "A month of 5/5", "Four full weeks in a row.", bestRun, 4],
    ["h-s10", "10 sessions", "Ten trips to the gym (or the run club).", sessions.size, 10],
    ["h-s50", "50 sessions", "Fifty sessions logged.", sessions.size, 50],
    ["h-s100", "100 sessions", "A hundred. This is who you are now.", sessions.size, 100],
    ["h-p1", "First perfect day", "Training, 4 L water, guitar, reading and journal, all in one day.", ps.best, 1],
    ["h-p7", "Perfect week", "Seven perfect days in a row.", ps.best, 7],
    ["h-p30", "30-day run", "Thirty perfect days back to back.", ps.best, 30],
    ["h-p75", "75 HARD", "Seventy-five perfect days in a row. The full 75.", ps.best, 75],
    ["h-photo1", "First progress photo", "Day one of the reel.", photos.length, 1],
    ["h-photo12", "A season of rushes", "Twelve progress photos.", photos.length, 12],
    ["h-j30", "30 journal entries", "Thirty days of director's commentary.", journals, 30],
    ["h-water30", "30 days hydrated", "Hit 4 L on 30 days.", waterDays, 30],
    ["h-season1", "Season 1 wrapped", "Twelve weeks of The Cut.", season ? season.absWeek - 1 : 0, 12],
  ];
  return H.map(([id, title, desc, have, need]) => ({ id, kind: "habit", title, desc, have: Math.min(have, need), need, done: have >= need }));
}

// Everything that's done, for detecting new achievements.
export function achievedIds(state, profile, now = today()) {
  const ws = weightStatus(state, profile, now);
  const ids = weightMilestones(ws, now).filter((m) => m.done).map((m) => m.id);
  for (const g of liftGoals(state, now)) for (const t of g.tiers) if (t.done) ids.push(`l-${g.lift}-${t.value}`);
  for (const h of habitGoals(state, profile, now)) if (h.done) ids.push(h.id);
  return ids;
}
