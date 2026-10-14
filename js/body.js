// Body maths: age, BMR, calorie & macro targets, weight trend and projections.
import { addDays, daysBetween, live, parse, today } from "./util.js?v=2";

export const DEFAULT_PROFILE = {
  name: "Tom",
  heightCm: 200.7, // 6 ft 7 in
  birthday: "1998-08-04",
  sex: "", // asked on first run; only used by the BMR formula
  goalKg: 90,
  startKg: null,
  activity: 1.55, // 4 lifts + run club
  weighDays: [1, 4], // Monday and Thursday mornings
  photoDay: 1, // Monday
  why: "To build a strong, aesthetic physique so I look better on camera and come across more confident when I talk, and to carry that confidence into my social life too.",
};

export const ACTIVITY = [
  { value: 1.375, label: "Light: training, otherwise sitting most of the day" },
  { value: 1.55, label: "Moderate: 4 lifts + a run, on my feet a bit" },
  { value: 1.725, label: "High: training plus an active job or lots of walking" },
];

export function age(birthday, on = today()) {
  const b = parse(birthday), d = parse(on);
  let a = d.getFullYear() - b.getFullYear();
  if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) a--;
  return a;
}
export const isBirthday = (birthday, on = today()) => birthday.slice(5) === on.slice(5);

export const cmToFtIn = (cm) => { const inches = Math.round(cm / 2.54); return `${Math.floor(inches / 12)}′${inches % 12}″`; };

// Mifflin–St Jeor: the most accurate of the common equations for non-athletes.
export function bmr({ weightKg, heightCm, ageYears, sex }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return Math.round(base + (sex === "female" ? -161 : 5));
}

// The phase follows the scale: above goal → cut, below → lean gain, close → recomp.
export function phaseFor(currentKg, goalKg) {
  if (currentKg == null) return "unknown";
  if (currentKg > goalKg + 1) return "cut";
  if (currentKg < goalKg - 1) return "gain";
  return "recomp";
}

export const PHASE_COPY = {
  cut: { label: "Cut", line: "a steady deficit of about 0.5 kg a week, so the fat goes and the muscle stays", kcal: -500 },
  gain: { label: "Lean gain", line: "a small surplus of about 0.25 kg a week, so most of what the scale adds is muscle", kcal: 300 },
  recomp: { label: "Recomp", line: "maintenance calories and high protein, building muscle while you hold around 90 kg", kcal: 0 },
  unknown: { label: "Set-up", line: "log a weigh-in to set your calories", kcal: 0 },
};

export function targets(profile, currentKg, on = today()) {
  const weightKg = currentKg ?? profile.startKg ?? profile.goalKg;
  const ageYears = age(profile.birthday, on);
  const b = bmr({ weightKg, heightCm: profile.heightCm, ageYears, sex: profile.sex });
  const tdee = Math.round(b * profile.activity);
  const phase = phaseFor(currentKg ?? profile.startKg, profile.goalKg);
  const kcal = Math.round((tdee + PHASE_COPY[phase].kcal) / 10) * 10;
  // Protein ~2 g per kg of goal weight; fat ~0.8 g per kg of body weight; carbs fill the rest.
  const protein = Math.round(2 * profile.goalKg);
  const fat = Math.round(0.8 * weightKg);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { weightKg, ageYears, bmr: b, tdee, phase, kcal, protein, fat, carbs };
}

export const bmi = (kgV, cm) => kgV / ((cm / 100) ** 2);

// ---------- weight series ----------
export function weightSeries(state) {
  return Object.entries(state.weights || {})
    .filter(([, w]) => live(w) && w.kg > 0)
    .map(([date, w]) => ({ date, kg: Number(w.kg) }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

// Exponentially-weighted trend that smooths out day-to-day water-weight noise.
export function withTrend(series) {
  let t = null, prev = null;
  return series.map((p) => {
    if (t == null) t = p.kg;
    else {
      const gap = Math.max(1, daysBetween(prev, p.date));
      t += (1 - Math.pow(0.85, gap)) * (p.kg - t);
    }
    prev = p.date;
    return { ...p, trend: Math.round(t * 100) / 100 };
  });
}

// kg per week from a least-squares fit of the last `days` of weigh-ins (needs ≥3 points spanning ≥7 days).
export function weeklyRate(series, days = 28, now = today()) {
  const pts = series.filter((p) => daysBetween(p.date, now) <= days);
  if (pts.length < 3 || daysBetween(pts[0].date, pts[pts.length - 1].date) < 7) return null;
  const xs = pts.map((p) => daysBetween(pts[0].date, p.date)), ys = pts.map((p) => p.kg);
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  let num = 0, den = 0;
  xs.forEach((x, i) => { num += (x - mx) * (ys[i] - my); den += (x - mx) ** 2; });
  return den ? (num / den) * 7 : null;
}

// When will the trend reach `targetKg`? Uses the real rate if it's heading the right way, else the plan rate.
export function projectDate(currentKg, targetKg, rate, now = today()) {
  if (currentKg == null) return null;
  const diff = targetKg - currentKg;
  if (Math.abs(diff) < 0.05) return now;
  const plan = diff > 0 ? 0.25 : -0.5;
  const r = rate != null && Math.sign(rate) === Math.sign(diff) && Math.abs(rate) >= 0.05 ? rate : plan;
  return addDays(now, Math.ceil((diff / r) * 7));
}
