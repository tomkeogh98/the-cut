// The Script (goals), Craft services (meals), the Programme (+ Hevy) and the Production office (settings).
import { esc, kg, live, longDate, shortDate, today } from "./util.js?v=14";
import { exportJSON, importJSON, profile, saveSettings, setHevyKey, stamp, store, update } from "./store.js?v=14";
import { $, $$, context, toast } from "./ui.js?v=14";
import { habitGoals, level, liftGoals, weightMilestones } from "./goals.js?v=14";
import { ACTIVITY, age, bmi, cmToFtIn, PHASE_COPY, targets } from "./body.js?v=14";
import { dayPlan, MEALS, nextOption, portion, scaleMeal, SLOTS } from "./meals.js?v=14";
import { DEFAULT_WEEK, LIFTS, PHASES, seasonInfo, SESSIONS } from "./program.js?v=14";
import { cleanKey, importCSV, pushRoutines, testKey } from "./hevy.js?v=14";
import { scheduledType } from "./schedule.js?v=14";
import { hevySyncNow } from "./app.js?v=14";
import { devicesCard, wireDevices } from "./devices.js?v=14";

// ================= THE SCRIPT (goals) =================
export function renderScript(view) {
  const c = context();
  const now = c.now, p = c.profile;
  const wms = weightMilestones(c.ws, now);
  const lifts = liftGoals(store.state, now);
  const habits = habitGoals(store.state, p, now);
  const lvl = level(store.state, c.ws.current || p.goalKg, now);
  const nextW = wms.find((m) => !m.done);
  view.innerHTML = `
    <section class="page-head">
      <p class="kicker">The Script · goals & milestones</p>
      <h1>Every scene, written in advance.</h1>
      <p class="lede">Targets rewrite themselves as you get stronger. Lift goals come from your real Hevy numbers; weight goals from your trend and pace.</p>
    </section>
    <section class="card level-card vf">
      <p class="label">Current billing</p>
      <p class="level-name">${esc(lvl.name)}</p>
      <p>${esc(lvl.line)}</p>
      <p class="fine">Season ${c.season.season}, week ${c.season.week}/12 · ${esc(c.season.phase.name)}</p>
    </section>
    <div class="script-grid">
      <section class="screenplay card">
        <p class="slug">INT. BATHROOM SCALE - MORNING</p>
        <p class="action">${esc(p.name.toUpperCase())}, ${age(p.birthday, now)}, ${cmToFtIn(p.heightCm)}, steps on. ${c.ws.current != null ? `The display settles: ${kg(c.ws.current)} kg.` : ""}</p>
        ${nextW ? `<p class="char">DIRECTOR (V.O.)</p><p class="dialogue">Next stop, ${esc(nextW.title.replace("FINAL CUT: ", ""))}. ${nextW.due ? `Around ${longDate(nextW.due)}.` : ""}</p>` : ""}
        <ol class="beats">${wms.map((m) => `<li class="${m.done ? "done" : m === nextW ? "next" : ""}"><span class="b-tick">${m.done ? "✓" : m === nextW ? "▶" : "○"}</span><span class="b-title">${esc(m.title)}</span><span class="b-due">${m.done ? "in the can" : m.due ? `by ${shortDate(m.due)}` : ""}</span><span class="b-desc">${esc(m.desc)}</span></li>`).join("") || `<li>Log a weigh-in to write this scene.</li>`}</ol>
      </section>
      <section class="screenplay card">
        <p class="slug">INT. GYM - EVENING</p>
        <p class="action">The bar is loaded. Every target below is built from what you actually lifted.</p>
        ${lifts.map((g) => liftBlock(g)).join("")}
      </section>
    </div>
    <section class="card">
      <h2 class="sec"><span>Habit milestones</span> <small>${habits.filter((h) => h.done).length}/${habits.length} earned</small></h2>
      <div class="habits">${habits.map((h) => `<div class="habit${h.done ? " done" : ""}"><p class="h-title">${esc(h.title)}</p><p class="fine">${esc(h.desc)}</p>
        <div class="bar" role="img" aria-label="${h.have} of ${h.need}"><i style="width:${(h.have / h.need) * 100}%"></i></div><span class="h-count tc">${h.have}/${h.need}</span></div>`).join("")}</div>
    </section>`;
}

function liftBlock(g) {
  const unit = LIFTS[g.lift].unit;
  if (!g.cur) {
    return `<div class="lift"><p class="char">${esc(g.name.toUpperCase())}</p><p class="dialogue">No footage yet. Log a ${esc(g.name.toLowerCase())} in Hevy and the targets write themselves. First milestone: <b>${esc(g.tiers[0].title)}</b> (${g.tiers[0].value} ${unit}).</p></div>`;
  }
  const next = g.tiers.find((t) => !t.done);
  const shown = g.tiers.filter((t) => !t.done).slice(0, 3);
  const doneN = g.tiers.filter((t) => t.done).length;
  return `<div class="lift">
    <p class="char">${esc(g.name.toUpperCase())} <span class="paren">(${unit === "reps" ? `best ${g.cur.value} reps` : `est. 1RM ${g.value} kg, from ${g.cur.kg}×${g.cur.reps}`})</span></p>
    <p class="dialogue">Next PR: <b>${unit === "reps" ? `${g.nextPR} reps` : `${g.nextPR} kg e1RM`}</b> within ${unit === "reps" ? "2 weeks" : "a week or two"}.${next ? ` Then <b>${esc(next.title)}</b> (${next.value} ${unit}) by ${shortDate(next.due)}.` : " Every tier cleared. Legend."}</p>
    <ul class="tiers">${g.tiers.map((t) => `<li class="${t.done ? "done" : t === next ? "next" : ""}" title="${esc(t.title)}">${t.value}</li>`).join("")}</ul>
    ${shown.length > 1 ? `<p class="fine">${doneN} tier${doneN === 1 ? "" : "s"} cleared · later: ${shown.slice(1).map((t) => `${t.value} ${unit} by ${shortDate(t.due)}`).join(" · ")}</p>` : ""}
  </div>`;
}

// ================= CRAFT SERVICES (meals) =================
export function renderCraft(view) {
  const c = context();
  const p = c.profile, now = c.now;
  const t = targets(p, c.ws.current, now);
  const plan = store.state.meals[now] || {};
  const isRun = scheduledType(store.state, now) === "run";
  const day = dayPlan(now, t.kcal, plan, isRun);
  const tot = day.reduce((a, { meal }) => ({ kcal: a.kcal + meal.kcal, p: a.p + meal.p, c: a.c + meal.c, f: a.f + meal.f }), { kcal: 0, p: 0, c: 0, f: 0 });
  view.innerHTML = `
    <section class="page-head">
      <p class="kicker">Craft services · fuel</p>
      <h1>Feed the lead.</h1>
      <p class="lede">Meals sized for a ${cmToFtIn(p.heightCm)}, ${t.ageYears}-year-old at ${kg(t.weightKg)} kg in a <b>${PHASE_COPY[t.phase].label.toLowerCase()}</b> phase: ${PHASE_COPY[t.phase].line}.</p>
    </section>
    <section class="macro-board card vf">
      <div class="mb-main"><span class="label">Daily target</span><b class="big">${t.kcal.toLocaleString()}<small> kcal</small></b></div>
      <dl class="kv">
        <div><dt>BMR</dt><dd>${t.bmr.toLocaleString()} kcal</dd></div>
        <div><dt>Maintenance</dt><dd>${t.tdee.toLocaleString()} kcal</dd></div>
        <div><dt>Protein</dt><dd>${t.protein} g</dd></div>
        <div><dt>Carbs</dt><dd>${t.carbs} g</dd></div>
        <div><dt>Fat</dt><dd>${t.fat} g</dd></div>
        <div><dt>BMI</dt><dd>${bmi(t.weightKg, p.heightCm).toFixed(1)}</dd></div>
      </dl>
      <p class="fine">BMR from the Mifflin–St Jeor equation × ${p.activity} activity = maintenance, then ${PHASE_COPY[t.phase].kcal > 0 ? "+" : ""}${PHASE_COPY[t.phase].kcal} kcal for the phase. Protein is set at 2 g per kg of goal weight. These are estimates: if the trend isn't moving as planned after 3 weeks, adjust by 150–200 kcal.</p>
    </section>
    <section>
      <h2 class="sec"><span>Today's menu</span> <small>${tot.kcal.toLocaleString()} kcal · ${tot.p} g protein${isRun ? " · run-club night" : ""}</small></h2>
      <div class="meal-cards">${day.map(({ slot, meal }) => mealCard(meal, slot)).join("")}</div>
    </section>
    <section class="card">
      <h2 class="sec"><span>The full menu</span> <small>${MEALS.length} meals</small></h2>
      <div class="pose-tabs">${SLOTS.map((s, i) => `<button class="chip${i === 0 ? " on" : ""}" data-slot="${s.key}">${s.name}</button>`).join("")}</div>
      <div class="meal-cards small" id="menu"></div>
    </section>`;
  const drawMenu = (slot) => {
    const sl = SLOTS.find((s) => s.key === slot);
    $("#menu", view).innerHTML = MEALS.filter((m) => m.slot === slot).map((m) => mealCard(scaleMeal(m, Math.round(t.kcal * sl.share)), sl, true)).join("");
    $$("#menu [data-use]", view).forEach((b) => b.addEventListener("click", () => { setMeal(now, slot, b.dataset.use); renderCraft(view); toast("Swapped into today's menu."); }));
  };
  $$("[data-slot]", view).forEach((b) => b.addEventListener("click", () => { $$("[data-slot]", view).forEach((x) => x.classList.toggle("on", x === b)); drawMenu(b.dataset.slot); }));
  drawMenu("breakfast");
  $$("[data-shuffle]", view).forEach((b) => b.addEventListener("click", () => {
    const [slot, id] = b.dataset.shuffle.split(":");
    setMeal(now, slot, nextOption(slot, id));
    renderCraft(view);
  }));
}

function setMeal(date, slot, id) {
  update((s) => { s.meals[date] = stamp({ ...(s.meals[date] || {}), [slot]: id }); });
}

// Share of calories from protein / carbs / fat, as one stacked bar.
function macroBar(m) {
  const p = m.p * 4, c = m.c * 4, f = m.f * 9, t = p + c + f || 1;
  return `<div class="macro-bar" role="img" aria-label="Calories: ${Math.round((p / t) * 100)}% protein, ${Math.round((c / t) * 100)}% carbs, ${Math.round((f / t) * 100)}% fat"><i class="k-p" style="flex:${p}"></i><i class="k-c" style="flex:${c}"></i><i class="k-f" style="flex:${f}"></i></div>`;
}

function mealCard(meal, slot, browse = false) {
  return `<article class="meal">
    <header><span class="m-slot">${esc(slot.name)}</span><span class="m-time tc">${meal.mins ? `${meal.mins} min` : "0 min"}</span></header>
    <h3>${esc(meal.name)}</h3>
    <p class="m-macros"><b>${meal.kcal}</b> kcal <span><i class="k-p"></i>${meal.p}g P</span> <span><i class="k-c"></i>${meal.c}g C</span> <span><i class="k-f"></i>${meal.f}g F</span></p>
    ${macroBar(meal)}
    <ul class="m-ing">${meal.items.map((it) => `<li>${esc(portion(it))}</li>`).join("")}</ul>
    <p class="m-method">${esc(meal.method)}</p>
    <p class="m-tags">${meal.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</p>
    ${browse ? `<button class="btn ghost" data-use="${meal.id}">Use today</button>` : `<button class="btn ghost" data-shuffle="${slot.key}:${meal.id}">Shuffle ↻</button>`}
  </article>`;
}

// ================= THE PROGRAMME =================
export function renderProgram(view) {
  const season = seasonInfo(store.state.startDate || today(), today());
  const st = store.settings;
  const nWorkouts = Object.values(store.state.hevy.workouts).filter(live).length;
  view.innerHTML = `
    <section class="page-head">
      <p class="kicker">The programme · upper / lower + run club</p>
      <h1>Four lifts. One run. Five days.</h1>
      <p class="lede">Built for a tall frame: long-lever-friendly lifts (trap bar over straight bar, chest-supported rows), lots of shoulder and back work for the V-taper, and enough leg work that the top doesn't outgrow the bottom.</p>
    </section>
    <section class="week-plan">${[1, 2, 3, 4, 5, 6, 0].map((wd) => {
      const t = DEFAULT_WEEK[wd] || "rest";
      const s = SESSIONS[t];
      return `<a class="wp-day${t === "rest" ? " rest" : ""}${wd === new Date().getDay() ? " now" : ""}" ${s.exercises.length ? `href="#/session/${t}"` : ""}><span class="wp-wd">${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][wd]}${wd === new Date().getDay() ? " · today" : ""}</span><b>${esc(s.name)}</b><small>${esc(s.tag)}</small></a>`;
    }).join("")}</section>
    <section class="card">
      <h2 class="sec"><span>Seasons</span> <small>you're in season ${season.season}, week ${season.week}</small></h2>
      <div class="phases">${PHASES.map((ph) => `<div class="phase${ph.key === season.phase.key ? " now" : ""}"><p class="ph-weeks tc">WK ${ph.weeks[0]}${ph.weeks.length > 1 ? `–${ph.weeks[ph.weeks.length - 1]}` : ""}</p><h3>${esc(ph.name)}</h3><p>${esc(ph.brief)}</p><p class="fine">${esc(ph.rir)}</p></div>`).join("")}</div>
    </section>
    <section class="card hevy-card" id="hevy">
      <h2 class="sec"><span>Hevy</span> <small>${st.hevyKey ? `connected · ${nWorkouts} workouts synced${st.hevyLast ? ` · last ${new Date(st.hevyLast).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}` : ""}` : "not connected"}</small></h2>
      <div class="hevy-grid">
        <div>
          <h3>1 · Connect</h3>
          <p>With <b>Hevy Pro</b>, get your API key at <a href="https://hevy.com/settings?developer" target="_blank" rel="noopener">hevy.com → Settings → Developer</a> and paste it here, once: your other synced devices pick it up automatically. Workouts you log in Hevy then tick off training days, fill in "last time" numbers, and drive your lift goals. Weigh-ins sync both ways.</p>
          <form id="hevyForm" class="row-form"><input name="key" type="password" autocomplete="off" placeholder="Hevy API key" value="${esc(st.hevyKey)}" aria-label="Hevy API key"><button class="btn primary">Save & test</button></form>
          ${st.hevyKey ? `<p><button class="btn" id="hevySync">Sync now</button> <label class="inline fine"><input type="checkbox" id="pushW" ${st.hevyPushWeights ? "checked" : ""}> Send weigh-ins to Hevy</label></p>` : ""}
          <p class="fine" id="hevyMsg">${esc(store.hevySync.message || "")}</p>
        </div>
        <div>
          <h3>2 · Send the programme to Hevy</h3>
          <p>Creates a <b>The Cut</b> folder in Hevy with Upper A, Lower A, Upper B and Lower B as routines: rep ranges, rest timers and coaching cues included. Run it again any time to update them.</p>
          <button class="btn" id="pushRoutines" ${st.hevyKey ? "" : "disabled"}>Send routines to Hevy</button>
          <ul class="fine" id="routineLog"></ul>
        </div>
        <div>
          <h3>No Hevy Pro? Import a CSV</h3>
          <p>In the Hevy app: Profile → Settings → Export & Import Data → Export Workouts. AirDrop or save the CSV, then drop it here.</p>
          <label class="file-drop">Choose Hevy CSV<input type="file" id="csv" accept=".csv,text/csv"></label>
        </div>
      </div>
    </section>`;
  $("#hevyForm", view).addEventListener("submit", async (e) => {
    e.preventDefault();
    const key = cleanKey(new FormData(e.target).get("key"));
    if (!key) { setHevyKey(""); renderProgram(view); return; }
    $("#hevyMsg", view).textContent = "Testing…";
    try {
      const who = await testKey(key);
      setHevyKey(key);
      toast(`Connected to Hevy as ${who}.`);
      await hevySyncNow(true);
      renderProgram(view);
    } catch (err) { $("#hevyMsg", view).textContent = err.message; }
  });
  $("#hevySync", view)?.addEventListener("click", async () => { await hevySyncNow(true); renderProgram(view); });
  $("#pushW", view)?.addEventListener("change", (e) => saveSettings({ hevyPushWeights: e.target.checked }));
  $("#pushRoutines", view).addEventListener("click", async (e) => {
    const log = $("#routineLog", view);
    e.target.disabled = true;
    try {
      const report = await pushRoutines(st.hevyKey, (m) => { log.innerHTML = `<li>${esc(m)}</li>`; });
      log.innerHTML = report.map((r) => `<li>${r.updated ? "Updated" : "Created"} <b>${esc(r.name)}</b> (${r.count} exercises)${r.missing.length ? `. Not found in Hevy's library: ${esc(r.missing.join(", "))}; add them by hand.` : ""}</li>`).join("");
      toast("Routines are in Hevy, in the 'The Cut' folder.");
    } catch (err) { log.innerHTML = `<li class="bad">${esc(err.message)}</li>`; }
    e.target.disabled = false;
  });
  $("#csv", view).addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const ws = importCSV(await file.text());
      const n = Object.keys(ws).length;
      update((s) => { for (const [id, w] of Object.entries(ws)) if (!s.hevy.workouts[id]) s.hevy.workouts[id] = w; });
      toast(`Imported ${n} workouts from Hevy.`);
      renderProgram(view);
    } catch (err) { toast(err.message, "bad"); }
  });
}

// ================= PRODUCTION OFFICE (settings) =================
export function renderOffice(view) {
  const p = profile(), st = store.settings;
  view.innerHTML = `
    <section class="page-head">
      <p class="kicker">Production office · settings</p>
      <h1>Behind the scenes.</h1>
    </section>
    <div class="office-grid">
      ${devicesCard(st)}
      <form class="card" id="prof">
        <h2>Profile</h2>
        <label>Height (cm) <input name="heightCm" type="number" step="0.1" value="${p.heightCm}"> <span class="fine">${cmToFtIn(p.heightCm)}</span></label>
        <label>Birthday <input name="birthday" type="date" value="${p.birthday}"> <span class="fine">${age(p.birthday)} years old</span></label>
        <label>Goal weight (kg) <input name="goalKg" type="number" step="0.5" value="${p.goalKg}"></label>
        <label>Starting weight (kg) <input name="startKg" type="number" step="0.1" value="${p.startKg ?? ""}"></label>
        <label>Sex (for BMR) <select name="sex"><option value="male" ${p.sex === "male" ? "selected" : ""}>Male</option><option value="female" ${p.sex === "female" ? "selected" : ""}>Female</option></select></label>
        <label>Activity <select name="activity">${ACTIVITY.map((a) => `<option value="${a.value}" ${a.value === p.activity ? "selected" : ""}>${esc(a.label)}</option>`).join("")}</select></label>
        <fieldset><legend>Weigh-in days</legend>${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => `<label class="inline"><input type="checkbox" name="weighDays" value="${i}" ${p.weighDays.includes(i) ? "checked" : ""}> ${d}</label>`).join("")}</fieldset>
        <label>Progress photo day <select name="photoDay">${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d, i) => `<option value="${i}" ${p.photoDay === i ? "selected" : ""}>${d}</option>`).join("")}</select></label>
        <label>Your why <textarea name="why" rows="4">${esc(p.why)}</textarea></label>
        <button class="btn primary">Save profile</button>
      </form>
      <div>
        <section class="card">
          <h2>Backup</h2>
          <p>Download everything as JSON (photos excluded), or restore from a backup. Restoring merges; it never deletes.</p>
          <button class="btn" id="export">Download backup</button>
          <label class="file-drop">Restore backup<input type="file" id="import" accept="application/json,.json"></label>
        </section>
        <section class="card">
          <h2>Look</h2>
          <div class="pose-tabs">${["auto", "dark", "light"].map((t) => `<button class="chip${(localStorage.getItem("cut.theme") || "auto") === t ? " on" : ""}" data-theme="${t}">${t === "auto" ? "Match device" : t === "dark" ? "Edit suite (dark)" : "Call sheet (light)"}</button>`).join("")}</div>
        </section>
      </div>
    </div>`;
  $("#prof", view).addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    update((s) => {
      s.profile = stamp({ ...p, heightCm: Number(f.get("heightCm")), birthday: f.get("birthday"), goalKg: Number(f.get("goalKg")), startKg: Number(f.get("startKg")) || p.startKg,
        sex: f.get("sex"), activity: Number(f.get("activity")), weighDays: f.getAll("weighDays").map(Number), photoDay: Number(f.get("photoDay")), why: String(f.get("why")).trim() || p.why });
    });
    toast("Profile saved.");
  });
  wireDevices(view, () => renderOffice(view));
  $("#export", view).addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(exportJSON());
    a.download = `the-cut-backup-${today()}.json`;
    a.click();
  });
  $("#import", view).addEventListener("change", async (e) => {
    try { importJSON(await e.target.files[0].text()); toast("Backup merged in."); } catch (err) { toast(err.message, "bad"); }
  });
  $$("[data-theme]", view).forEach((b) => b.addEventListener("click", () => {
    try { localStorage.setItem("cut.theme", b.dataset.theme); } catch { /* ignore */ }
    document.documentElement.dataset.theme = b.dataset.theme === "auto" ? "" : b.dataset.theme;
    if (b.dataset.theme === "auto") delete document.documentElement.dataset.theme;
    $$("[data-theme]", view).forEach((x) => x.classList.toggle("on", x === b));
  }));
}

