// Today (the call sheet), the session page, and first-run onboarding (the casting sheet).
import { addDays, esc, kg, live, mondayOf, prettyDate, shortDate, shortDay, today, uid } from "./util.js?v=1";
import { onboarded, profile, setRec, stamp, store, update } from "./store.js?v=1";
import { $, $$, celebrate, context, nudgeText, toast } from "./ui.js?v=1";
import { pickGreeting } from "./greetings.js?v=1";
import { buildsOn, plannedType, seasonInfo, SESSIONS, setsFor } from "./program.js?v=1";
import {
  buildFrom, dayChecks, dayStatus, excuseOn, hevyOn, lockedBy, nudgeCheck, previousDay, scheduledType, shiftFrom, shiftInto,
  trainedOn, typeOn, WATER_GOAL, weekSummary,
} from "./schedule.js?v=1";
import { lastPerformance } from "./hevy.js?v=1";
import { ACTIVITY, cmToFtIn, DEFAULT_PROFILE, targets } from "./body.js?v=1";
import { logWeight, openDayPanel, photoDialog } from "./view-track.js?v=1";

let greeting = null; // one greeting per page load, so ticking boxes doesn't reshuffle it

export function renderToday(view) {
  if (!onboarded()) return renderCasting(view);
  const c = context();
  const s = store.state, now = c.now, p = c.profile;
  greeting ||= pickGreeting(c);
  const nudge = nudgeCheck(s, now);
  const chk = dayChecks(s, now, p);
  const prev = previousDay(s, now);
  const moved = shiftFrom(s, now);
  const into = shiftInto(s, now);
  const lock = lockedBy(s, now);
  const type = c.type;
  const sess = SESSIONS[type];
  const wk = weekSummary(s, now, now);
  const t = targets(p, c.ws.current, now);
  const season = c.season;

  view.innerHTML = `
    <section class="titlecard">
      <div class="clapper" aria-hidden="true"></div>
      <div class="slate">
        <dl class="slate-fields">
          <div><dt>Prod.</dt><dd>The Cut</dd></div>
          <div><dt>Season</dt><dd>${String(season.season).padStart(2, "0")}</dd></div>
          <div><dt>Ep.</dt><dd>${c.ep}</dd></div>
          <div><dt>Scene</dt><dd>${esc(sess.code)}</dd></div>
          <div><dt>Date</dt><dd>${shortDate(now)}</dd></div>
        </dl>
        <h1 class="greet">${esc(greeting.h)}</h1>
        <p class="greet-sub">${esc(greeting.s)}</p>
      </div>
    </section>

    ${nudge ? `<aside class="directors-note" role="note">
      <p class="dn-head">Director's note</p>
      <p class="dn-body">${esc(nudgeText(nudge))}</p>
      <p class="dn-why"><span>Remember why we started:</span> “${esc(p.why)}”</p>
    </aside>` : ""}

    <div class="today-grid">
      <section class="brief card">
        <h2 class="sec"><span>Call sheet</span> <small>${prettyDate(now)} · Week ${season.week}/12 · ${esc(season.phase.name)}</small></h2>
        <div class="brief-cols">
          <div class="b-col">
            <p class="b-label">Previously</p>
            <p>${previouslyText(prev)}</p>
          </div>
          <div class="b-col b-today">
            <p class="b-label">Today</p>
            ${moved ? `<p><b>Today's ${esc(SESSIONS[plannedType(now)].name)} was moved to ${prettyDate(moved.to)}.</b> Keep the list going.</p>` : ""}
            <p class="b-session"><span class="code">${esc(sess.code)}</span> ${esc(sess.name)}<small>${esc(sess.tag)}</small></p>
            <p>${type === "rest" ? esc(sess.focus[0].toUpperCase() + sess.focus.slice(1)) + "." : `About ${esc(sess.focus)}.`} ${type !== "rest" && type !== "run" ? `Effort: ${esc(season.phase.rir)}.` : ""}</p>
            ${into ? `<p class="note">Moved here from ${prettyDate(into[0])}.</p>` : ""}
            ${lock ? `<p class="note warn">Locked in: you moved yesterday's session, so today can't be skipped.</p>` : ""}
          </div>
          <div class="b-col">
            <p class="b-label">How it builds</p>
            <p>${esc(buildsOn(buildFrom(prev, type), type))}</p>
          </div>
        </div>
        <p class="camera"><span>On camera:</span> ${esc(sess.camera)}</p>
        ${sess.exercises.length ? hevyAims(sess, season) : ""}
        ${sess.notes ? `<ul class="notes">${sess.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
        ${sess.exercises.length ? `<a class="btn" href="#/session/${type}">Open the full ${esc(sess.name)} plan →</a>` : ""}
      </section>

      <aside class="side">
        <section class="card week">
          <h2 class="sec"><span>This week</span> <small>${wk.trained}/${wk.required}</small></h2>
          <div class="week-strip">${Array.from({ length: 7 }, (_, i) => {
            const d = addDays(mondayOf(now), i);
            const st = dayStatus(s, d, now);
            const ty = trainedOn(s, d) ? typeOn(s, d) : scheduledType(s, d);
            return `<button class="wd st-${st}${d === now ? " is-today" : ""}" data-date="${d}" aria-label="${prettyDate(d)}: ${st}"><span>${shortDay(d)[0]}</span><b>${shiftFrom(s, d) ? "→" : ty ? SESSIONS[ty].code : "·"}</b></button>`;
          }).join("")}</div>
        </section>
        <section class="stats-mini">
          <div><span class="label">Streak</span><b>${c.streak}</b></div>
          <div><span class="label">Perfect days</span><b>${c.perfect}<small>/75</small></b></div>
          <div><span class="label">${c.ws.current != null && c.ws.current > p.goalKg ? "To lose" : "To go"}</span><b>${c.togo ?? "—"}<small> kg</small></b></div>
          <div><span class="label">Fuel</span><b>${t.kcal}<small> kcal</small></b></div>
        </section>
      </aside>
    </div>

    <section class="the-list card">
      <h2 class="sec"><span>The list</span> <small>${chk.done}/${chk.core.length} done${chk.perfect ? " · PERFECT DAY" : ""}</small></h2>
      <div class="items">
        ${chk.items.train !== null ? item("train", chk.items.train, "Train", trainLine(s, now, type), trainedOn(s, now) ? "" : `<button class="btn primary" data-act="logtrain">Mark ${esc(sess.name)} done</button> <button class="btn ghost" data-act="cant">Can't today?</button>`) : item("train", true, "Rest day", "Nothing scheduled. An easy walk counts as bonus footage.", "")}
        ${item("water", chk.items.water, "4 L water", `${(chk.water / 1000).toFixed(2)} L of 4 L`, `<div class="water" role="group" aria-label="Water: tap a glass">${Array.from({ length: WATER_GOAL / 250 }, (_, i) => `<button class="glass${(i + 1) * 250 <= chk.water ? " full" : ""}" data-water="${(i + 1) * 250}" aria-label="${((i + 1) * 0.25).toFixed(2)} litres"></button>`).join("")}</div>`)}
        ${item("guitar", chk.items.guitar, "Guitar practice", "Today's lesson lives on Guitar Hero.", `<a class="btn ghost" href="https://tomkeogh98.github.io/guitar-hero/" target="_blank" rel="noopener">Open Guitar Hero ↗</a>`, true)}
        ${item("read", chk.items.read, "Read 30 minutes", "Before bed, phone in the other room.", readTimerHTML(), true)}
        ${item("journal", chk.items.journal, "Journal", "Two lines on how the day went. It's below.", `<a class="btn ghost" href="#journal-box" data-act="tojournal">Write it ↓</a>`)}
        ${chk.items.weigh !== null ? item("weigh", chk.items.weigh, "Weigh-in", chk.items.weigh ? `${kg(s.weights[now].kg)} kg logged` : "Morning, after the loo, before food.", chk.items.weigh ? "" : `<form class="inline-weigh"><input type="number" step="0.1" min="40" max="250" inputmode="decimal" placeholder="kg" aria-label="Weight in kg" required><button class="btn primary">Log</button></form>`) : ""}
        ${chk.items.photo !== null ? item("photo", chk.items.photo, "Progress photo", "Front, side, back. Same spot, same light.", `<button class="btn ghost" data-act="photo">Shoot rushes</button>`) : ""}
      </div>
    </section>

    <section class="journal card" id="journal-box">
      <h2 class="sec"><span>Dailies</span> <small>How did today go?</small></h2>
      ${journalForm(now)}
    </section>`;

  wireToday(view, now, sess);
}

function previouslyText(prev) {
  const s = store.state;
  const when = prev.gap === 1 ? "Yesterday" : `Last session, ${prettyDate(prev.date).split(" ")[0]}`;
  if (prev.trained) {
    const w = hevyOn(s, prev.date)[0];
    const name = SESSIONS[prev.type]?.name || "Training";
    let detail = "";
    if (w) {
      const mins = w.end ? Math.round((Date.parse(w.end) - Date.parse(w.start)) / 60000) : null;
      const sets = w.ex.reduce((a, e) => a + e.sets.filter((x) => x[2] !== "warmup").length, 0);
      const vol = Math.round(w.ex.reduce((a, e) => a + e.sets.reduce((b, x) => b + (x[0] || 0) * (x[1] || 0), 0), 0));
      detail = ` Hevy logged ${w.ex.length} exercises, ${sets} working sets${vol ? `, ${vol.toLocaleString()} kg moved` : ""}${mins ? ` in ${mins} min` : ""}.`;
    }
    const j = s.journal[prev.date];
    const quote = live(j) && j.text ? ` You wrote: “${esc(j.text.slice(0, 120))}${j.text.length > 120 ? "…" : ""}”` : "";
    return `${when}: <b>${esc(name)}</b>, ${esc(SESSIONS[prev.type]?.tag.toLowerCase() || "")} ✓.${detail}${quote}`;
  }
  if (s.startDate && prev.date < s.startDate) return "Nothing yet: this is the first frame of the film. Everything from here gets compared to today.";
  if (prev.excused) return `Yesterday was excused (${esc(prev.excused)}). If you're back on your feet, ease back in today.`;
  if (prev.missed) return `${when}'s <b>${esc(SESSIONS[prev.type]?.name || "session")}</b> didn't make the cut. No guilt: today's job isn't making it up, it's getting back on script.`;
  return `${when} was a rest day. Recovery is part of the work.`;
}

function trainLine(s, now, type) {
  if (trainedOn(s, now)) return hevyOn(s, now).length ? `Done ✓ (synced from Hevy: ${esc(hevyOn(s, now)[0].title)})` : "Done ✓";
  const exc = excuseOn(s, now);
  if (exc) return `Excused today (${exc.reason}). Look after yourself.`;
  return type === "run" ? "Oxford Run Club, 18:45. Log it when you're back." : `${SESSIONS[type].name}. Log it in Hevy and it'll tick itself, or tap below.`;
}

function item(key, done, title, sub, controls, toggle = false) {
  return `<div class="item${done ? " done" : ""}" data-item="${key}">
    ${toggle ? `<button class="tick" data-toggle="${key}" aria-pressed="${done}" aria-label="${esc(title)}: ${done ? "done" : "not done"}"></button>` : `<span class="tick" aria-hidden="true"></span>`}
    <div class="i-body"><p class="i-title">${esc(title)}</p><p class="i-sub">${sub}</p>${controls ? `<div class="i-ctl">${controls}</div>` : ""}</div>
  </div>`;
}

function hevyAims(sess, season) {
  const rows = sess.exercises.slice(0, 4).map((ex) => {
    const lp = lastPerformance(store.state, ex);
    return `<li><b>${esc(ex.name)}</b> <span class="sr">${setsFor(ex, season.phase)} × ${ex.reps[0]}–${ex.reps[1]}</span>
      ${lp ? `<span class="last">Last (${shortDate(lp.date)}): ${esc(lp.sets.join(", "))}</span><span class="aim">→ ${esc(lp.aim)}</span>` : `<span class="last">No history yet. Find a weight you could lift for ${ex.reps[1] + 3} reps and stop at ${ex.reps[1]}.</span>`}</li>`;
  });
  return `<div class="aims"><p class="b-label">Today's targets ${store.state.hevy && Object.keys(store.state.hevy.workouts).length ? "<small>(from Hevy)</small>" : ""}</p><ul>${rows.join("")}</ul></div>`;
}

// ---------- read timer (survives reloads) ----------
const TIMER_KEY = "cut.readTimer";
function readTimerHTML() {
  let end = 0;
  try { end = Number(localStorage.getItem(TIMER_KEY)) || 0; } catch { /* ignore */ }
  const running = end > Date.now();
  return `<button class="btn ghost" data-act="readtimer">${running ? "Stop timer" : "Start 30-min timer"}</button> <span class="timer tc" data-timer>${running ? fmtLeft(end - Date.now()) : "30:00"}</span>`;
}
const fmtLeft = (ms) => { const sec = Math.max(0, Math.round(ms / 1000)); return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`; };
let timerTick = null;
function runTimer(view) {
  clearInterval(timerTick);
  timerTick = setInterval(() => {
    let end = 0;
    try { end = Number(localStorage.getItem(TIMER_KEY)) || 0; } catch { /* ignore */ }
    const el = $("[data-timer]", view);
    if (!end) { clearInterval(timerTick); return; }
    if (el) el.textContent = fmtLeft(end - Date.now());
    if (end <= Date.now()) {
      clearInterval(timerTick);
      try { localStorage.removeItem(TIMER_KEY); } catch { /* ignore */ }
      setCheck(today(), { read: true });
      toast("30 minutes read. Chapter closed, lights out. 📖");
    }
  }, 1000);
}

function setCheck(date, patch) {
  setRec("checks", date, patch);
  maybePerfect(date);
}

function maybePerfect(date) {
  const chk = dayChecks(store.state, date, profile());
  const key = `perfect-${date}`;
  if (chk.perfect && !store.state.milestones[key]) {
    setRec("milestones", key, { date });
    celebrate("Perfect day", "Training, water, guitar, reading, journal. Every box ticked.");
  }
}

function journalForm(date) {
  const j = store.state.journal[date] || {};
  const rate = (name, label, val) => `<fieldset class="rate"><legend>${label}</legend>${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="${name}" value="${n}" ${Number(val) === n ? "checked" : ""}><span>${n}</span></label>`).join("")}</fieldset>`;
  return `<form id="jform">
    <label class="j-text"><span class="sr-only">Journal entry</span><textarea name="text" rows="5" placeholder="What went well? What was hard? How did you feel on camera or around people today?">${esc(live(j) ? j.text || "" : "")}</textarea></label>
    <div class="j-rates">${rate("energy", "Energy", j.energy)}${rate("confidence", "On-camera confidence", j.confidence)}</div>
    <div class="j-actions"><button class="btn primary" type="submit">Save today's dailies</button><button class="btn ghost" type="button" data-act="photo">+ Progress photo</button>${live(j) && j.text ? `<span class="fine">Saved ${new Date(j.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>` : ""}</div>
  </form>`;
}

function wireToday(view, now, sess) {
  const refresh = () => renderToday(view);
  $$(".wd[data-date]", view).forEach((b) => b.addEventListener("click", () => openDayPanel(b.dataset.date)));
  $$("[data-water]", view).forEach((b) => b.addEventListener("click", () => {
    const cur = store.state.checks[now]?.water || 0;
    const v = Number(b.dataset.water);
    setCheck(now, { water: cur === v ? v - 250 : v });
    if (v === WATER_GOAL && cur !== v) toast("4 litres. Hydrated and camera-ready. 💧");
  }));
  $$("[data-toggle]", view).forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.toggle;
    setCheck(now, { [k]: !store.state.checks[now]?.[k] });
  }));
  $('[data-act="logtrain"]', view)?.addEventListener("click", () => {
    const id = uid();
    update((s) => { s.sessions[id] = stamp({ id, date: now, type: context().type === "rest" ? "upperA" : context().type, source: "manual" }); });
    toast(`${sess.name}: in the can. 🎬`);
    maybePerfect(now);
  });
  $('[data-act="cant"]', view)?.addEventListener("click", () => openDayPanel(now));
  $$('[data-act="photo"]', view).forEach((b) => b.addEventListener("click", () => photoDialog(now, refresh)));
  $('[data-act="tojournal"]', view)?.addEventListener("click", (e) => { e.preventDefault(); $("#journal-box textarea", view).focus(); });
  $(".inline-weigh", view)?.addEventListener("submit", (e) => { e.preventDefault(); logWeight(now, Number(e.target.querySelector("input").value)); });
  $('[data-act="readtimer"]', view)?.addEventListener("click", () => {
    let end = 0;
    try { end = Number(localStorage.getItem(TIMER_KEY)) || 0; } catch { /* ignore */ }
    try {
      if (end > Date.now()) localStorage.removeItem(TIMER_KEY);
      else localStorage.setItem(TIMER_KEY, String(Date.now() + 30 * 60 * 1000));
    } catch { /* ignore */ }
    refresh();
  });
  runTimer(view);
  $("#jform", view).addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const text = String(f.get("text") || "").trim();
    if (!text) { toast("Write at least a line first."); return; }
    setRec("journal", now, { text, energy: Number(f.get("energy")) || null, confidence: Number(f.get("confidence")) || null, deleted: false });
    toast("Dailies saved. That's a wrap on today.");
    maybePerfect(now);
  });
}

// ---------- the session page ----------
export function renderSession(view, type) {
  const sess = SESSIONS[type];
  if (!sess) { view.innerHTML = `<p class="card">No such session.</p>`; return; }
  const season = seasonInfo(store.state.startDate || today(), today());
  view.innerHTML = `
    <section class="page-head">
      <p class="kicker">Scene ${esc(sess.code)} · ${esc(season.phase.name)} · week ${season.week}/12</p>
      <h1>${esc(sess.name)}: ${esc(sess.tag)}.</h1>
      <p class="lede">${esc(sess.camera)}</p>
    </section>
    <section class="card phase-box"><p><b>This block:</b> ${esc(season.phase.brief)}</p><p><b>Effort:</b> ${esc(season.phase.rir)}. <b>Progression:</b> ${esc(season.phase.progress)}</p>
      <p><b>Warm-up:</b> 5 minutes easy on the bike or rower, then ramp up on your first lift: empty bar × 10, ~50% × 6, ~70% × 3, ~85% × 1. Then go to work.</p></section>
    <ol class="exercises">${sess.exercises.map((ex, i) => {
      const lp = lastPerformance(store.state, ex);
      return `<li class="ex card${ex.main ? " main" : ""}">
        <div class="ex-num">${String(i + 1).padStart(2, "0")}</div>
        <div class="ex-body">
          <h2>${esc(ex.name)}${ex.main ? ` <span class="pill">main lift</span>` : ""}</h2>
          <p class="ex-rx"><b>${setsFor(ex, season.phase)} × ${ex.reps[0]}–${ex.reps[1]}</b> · rest ${ex.rest >= 120 ? `${ex.rest / 60} min` : `${ex.rest}s`}</p>
          <p>${esc(ex.cue)}</p>
          ${lp ? `<p class="last">Last time (${shortDate(lp.date)}): ${esc(lp.sets.join(", "))} <span class="aim">→ ${esc(lp.aim)}</span></p>` : ""}
          <p class="hevy-name">In Hevy: ${esc(ex.hevy[0])}</p>
        </div></li>`;
    }).join("")}</ol>
    ${sess.notes ? `<ul class="notes card">${sess.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
    <p><a class="btn" href="#/">← Back to today</a> <a class="btn ghost" href="#/program">Whole programme</a></p>`;
}

// ---------- first run: the casting sheet ----------
function renderCasting(view) {
  const p = profile();
  view.innerHTML = `
    <section class="titlecard casting">
      <div class="clapper" aria-hidden="true"></div>
      <div class="slate">
        <p class="kicker">Casting sheet · before day one</p>
        <h1 class="greet">Welcome to The Cut, ${esc(p.name)}.</h1>
        <p class="greet-sub">A few details and we roll camera. These set your calories, your targets and your road to ${p.goalKg} kg.</p>
      </div>
    </section>
    <form class="card casting-form" id="cast">
      <div class="cast-grid">
        <label>Height <input name="height" value="${p.heightCm}" type="number" step="0.1" min="120" max="240" required> <span class="fine">cm (${cmToFtIn(p.heightCm)})</span></label>
        <label>Birthday <input name="birthday" type="date" value="${p.birthday}" required></label>
        <label>Today's weight <input name="kg" type="number" step="0.1" min="40" max="250" inputmode="decimal" placeholder="e.g. 96.4" required autofocus> <span class="fine">kg, ideally this morning</span></label>
        <label>Goal weight <input name="goal" type="number" step="0.5" min="50" max="200" value="${p.goalKg}" required> <span class="fine">kg</span></label>
        <fieldset><legend>Sex <span class="fine">(only used in the BMR equation)</span></legend>
          <label class="inline"><input type="radio" name="sex" value="male" required> Male</label>
          <label class="inline"><input type="radio" name="sex" value="female"> Female</label></fieldset>
        <label>Activity <select name="activity">${ACTIVITY.map((a) => `<option value="${a.value}" ${a.value === p.activity ? "selected" : ""}>${esc(a.label)}</option>`).join("")}</select></label>
      </div>
      <label class="why">Why are you doing this? <span class="fine">(The director reminds you of this when you start slacking.)</span>
        <textarea name="why" rows="3">${esc(p.why)}</textarea></label>
      <button class="btn primary big" type="submit">Roll camera →</button>
    </form>`;
  $("#cast", view).addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const startKg = Math.round(Number(f.get("kg")) * 10) / 10;
    const now = today();
    update((s) => {
      s.startDate ||= now;
      s.profile = stamp({ ...DEFAULT_PROFILE, ...(s.profile || {}), heightCm: Number(f.get("height")), birthday: f.get("birthday"), sex: f.get("sex"),
        goalKg: Number(f.get("goal")), activity: Number(f.get("activity")), why: String(f.get("why") || DEFAULT_PROFILE.why).trim(), startKg });
      s.weights[now] = stamp({ kg: startKg, source: "site" });
    });
    greeting = null;
    celebrate("Day one. Scene one.", `${startKg} kg → ${f.get("goal")} kg. Let's make a film worth watching.`);
    location.hash = "#/";
    renderToday(view);
  });
}

export const resetGreeting = () => { greeting = null; };
