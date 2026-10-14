// Timeline (tracker), Scope (weight), Rushes (photos) and Dailies (journal).
import { addDays, daysBetween, esc, kg, live, longDate, mondayOf, monthName, parse, prettyDate, shortDate, shortDay, today, uid } from "./util.js?v=2";
import { compressImage, photoURL, profile, putPhoto, setRec, stamp, store, update } from "./store.js?v=2";
import { $, $$, celebrate, context, modal, toast } from "./ui.js?v=2";
import { lineChart, sparkline } from "./chart.js?v=2";
import { projectDate, PHASE_COPY, phaseFor } from "./body.js?v=2";
import { weightMilestones } from "./goals.js?v=2";
import { SESSIONS } from "./program.js?v=2";
import { pushWeight } from "./hevy.js?v=2";
import {
  dayChecks, dayStatus, excuseOn, hevyOn, lockedBy, REASONS, scheduledType, sessionsOn, shiftCheck, shiftFrom, shiftInto,
  slackReport, streak, trainedOn, typeOn, weekSummary,
} from "./schedule.js?v=2";

const STATUS_LABEL = {
  done: "Trained", off: "Not scheduled", missed: "Missed", broken: "Missed (rule broken)", moved: "Moved",
  excused: "Excused", today: "Today", planned: "Planned", pre: "Before day one",
};

// ================= TIMELINE =================
export function renderTimeline(view) {
  const s = store.state, now = today();
  const wk = weekSummary(s, now, now);
  const r = slackReport(s, now);
  const start = s.startDate || now;
  const months = [];
  const cur = parse(now);
  const first = parse(start);
  for (let y = cur.getFullYear(), m = cur.getMonth(); y > first.getFullYear() || (y === first.getFullYear() && m >= first.getMonth()); ) {
    months.push([y, m]);
    if (months.length >= 12) break;
    m--; if (m < 0) { m = 11; y--; }
  }
  view.innerHTML = `
    <section class="page-head">
      <p class="kicker">Timeline · the edit so far</p>
      <h1>Every day, on the timeline.</h1>
      <p class="lede">Green: you trained. Grey: nothing scheduled. Red: scheduled and missed. Tap a day to log it, move it or excuse it.</p>
    </section>
    <section class="stat-row">
      <div class="stat"><span class="label">This week</span><b>${wk.trained}<small>/${wk.required}</small></b><span class="sub">${wk.hit ? "Week in the can ✓" : wk.onTrack ? `${wk.left} session${wk.left === 1 ? "" : "s"} left` : "Behind: move one to the weekend"}</span></div>
      <div class="stat"><span class="label">Streak</span><b>${streak(s, now)}</b><span class="sub">scheduled days trained in a row</span></div>
      <div class="stat"><span class="label">Last 28 days</span><b>${r.missed28}<small> missed</small></b><span class="sub">${r.moved28} moved · ${r.excused28} excused${r.broken28 ? ` · ${r.broken28} rule broken` : ""}</span></div>
      <div class="stat"><span class="label">Slack meter</span>${slackMeter(r.score)}<span class="sub">${r.score < 3 ? "Clean edit" : r.score < 6 ? "Getting patchy" : "Nudge territory"}</span></div>
    </section>
    <ul class="legend" aria-label="Legend">
      <li><i class="st-done"></i>Trained</li><li><i class="st-off"></i>Not scheduled</li><li><i class="st-missed"></i>Missed</li>
      <li><i class="st-broken"></i>Missed after a move</li><li><i class="st-moved"></i>Moved</li><li><i class="st-excused"></i>Excused</li><li><i class="st-planned"></i>Planned</li>
    </ul>
    <div class="months">${months.map(([y, m]) => monthGrid(y, m, now)).join("")}</div>
    <section class="rules card">
      <h2>The rules</h2>
      <ol>
        <li><b>Five a week:</b> four lifts plus run club. Sickness, holidays and emergencies reduce the target; nothing else does.</li>
        <li><b>You can move a session</b> to a free day later in the same week, usually Saturday or Sunday.</li>
        <li><b>If you move a day, you can't skip the next one</b> (weekends aside). It's locked, and missing it counts as breaking the rule.</li>
        <li><b>No back-to-back moves.</b></li>
        <li>Too many misses, moves or excuses and the director leaves you a note (and an email).</li>
      </ol>
    </section>`;
  $$(".day[data-date]", view).forEach((b) => b.addEventListener("click", () => openDayPanel(b.dataset.date)));
}

function slackMeter(score) {
  const n = Math.min(10, score);
  return `<span class="meter" role="img" aria-label="Slack score ${score} of 10">${Array.from({ length: 10 }, (_, i) => `<i class="${i < n ? (n >= 6 ? "hot" : n >= 3 ? "warm" : "on") : ""}"></i>`).join("")}</span>`;
}

function monthGrid(y, m, now) {
  const s = store.state;
  const firstDay = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const days = new Date(y, m + 1, 0).getDate();
  let d = mondayOf(firstDay);
  const rows = [];
  while (d <= `${y}-${String(m + 1).padStart(2, "0")}-${String(days).padStart(2, "0")}`) {
    const cells = [];
    for (let i = 0; i < 7; i++) {
      const dd = addDays(d, i);
      const inMonth = parse(dd).getMonth() === m;
      if (!inMonth) { cells.push(`<span class="day out" aria-hidden="true"></span>`); continue; }
      const st = dayStatus(s, dd, now);
      const type = trainedOn(s, dd) ? typeOn(s, dd) : scheduledType(s, dd);
      const code = shiftFrom(s, dd) ? "→" : type ? SESSIONS[type].code : "";
      const exc = excuseOn(s, dd);
      cells.push(`<button type="button" class="day st-${st}${dd === now ? " is-today" : ""}" data-date="${dd}" aria-label="${prettyDate(dd)}: ${STATUS_LABEL[st]}${type ? `, ${SESSIONS[type].name}` : ""}">
        <span class="dn">${parse(dd).getDate()}</span><span class="dc">${exc ? REASONS[exc.reason]?.mark || "E" : code}</span></button>`);
    }
    const ws = weekSummary(s, d, now);
    const inRange = !s.startDate || addDays(d, 6) >= s.startDate;
    cells.push(`<span class="wk-tally${ws.hit ? " hit" : ""}" title="Sessions this week">${inRange && d <= now ? `${ws.trained}/${ws.required}` : ""}</span>`);
    rows.push(cells.join(""));
    d = addDays(d, 7);
  }
  return `<section class="month">
    <h2>${monthName(m)} <span>${y}</span></h2>
    <div class="grid7"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span><span title="Sessions">#</span>${rows.join("")}</div>
  </section>`;
}

export function openDayPanel(date) {
  const now = today();
  const draw = (dlg) => {
    const s = store.state;
    const st = dayStatus(s, date, now);
    const planned = scheduledType(s, date);
    const manual = sessionsOn(s, date);
    const hevy = hevyOn(s, date);
    const exc = excuseOn(s, date);
    const moved = shiftFrom(s, date);
    const into = shiftInto(s, date);
    const lock = lockedBy(s, date);
    const chk = dayChecks(s, date, profile());
    const shift = planned && !trainedOn(s, date) && !exc ? shiftCheck(s, date, now) : null;
    const types = ["upperA", "lowerA", "run", "upperB", "lowerB"];
    dlg.querySelector(".sheet-body").innerHTML = `
      <p class="kicker">${prettyDate(date)}</p>
      <h2><span class="pill st-${st}">${STATUS_LABEL[st]}</span> ${planned ? esc(SESSIONS[planned].name) : trainedOn(s, date) ? esc(SESSIONS[typeOn(s, date)].name) : "Rest day"}</h2>
      ${into ? `<p class="note">Moved here from ${prettyDate(into[0])}.</p>` : ""}
      ${moved ? `<p class="note">This session was moved to <b>${prettyDate(moved.to)}</b>.</p>` : ""}
      ${lock ? `<p class="note warn">Locked: you moved ${prettyDate(lock)}'s session, so this day can't be skipped.</p>` : ""}
      ${hevy.map((w) => `<div class="hevy-row"><b>Hevy:</b> ${esc(w.title)} · ${w.ex.length} exercises${w.end ? ` · ${Math.round((Date.parse(w.end) - Date.parse(w.start)) / 60000)} min` : ""}</div>`).join("")}
      ${manual.map((m) => `<div class="hevy-row"><b>Logged:</b> ${esc(SESSIONS[m.type]?.name || "Session")} <button class="link" data-undo-session="${m.id}">undo</button></div>`).join("")}
      <div class="actions">
        ${date <= now && !trainedOn(s, date) ? `<div class="act"><h3>Trained?</h3><div class="btns">${types.map((t) => `<button class="btn ${t === (planned || "") ? "primary" : ""}" data-log="${t}">${SESSIONS[t].name}</button>`).join("")}</div></div>` : ""}
        ${shift ? (shift.ok
          ? `<div class="act"><h3>Move this session</h3><div class="btns">${shift.targets.map((t) => `<button class="btn" data-move="${t}">→ ${shortDay(t)} ${shortDate(t)}</button>`).join("")}</div>
             <p class="fine">Heads up: once moved, ${shortDay(addDays(date, 1))} becomes locked${["Sat", "Sun"].includes(shortDay(addDays(date, 1))) ? " (well, it's the weekend, so not this time)" : ""}.</p></div>`
          : `<div class="act"><h3>Move this session</h3><p class="fine">${esc(shift.why)}</p></div>`) : ""}
        ${moved && !trainedOn(s, moved.to) ? `<div class="act"><button class="btn" data-unmove>Undo the move</button></div>` : ""}
        ${(planned || exc) && !trainedOn(s, date) ? `<div class="act"><h3>${exc ? `Excused: ${REASONS[exc.reason].label}` : "Can't train? Excuse it"}</h3>
          ${exc ? `<button class="btn" data-unexcuse>Remove excuse</button>` : `<div class="btns">${Object.entries(REASONS).map(([k, v]) => `<button class="btn" data-excuse="${k}">${v.label}</button>`).join("")}</div><p class="fine">For genuine sickness, holidays and emergencies only. These lower the weekly target; "busy" isn't on the list.</p>`}</div>` : ""}
      </div>
      <h3>The list</h3>
      <ul class="mini-list">${["train", "water", "guitar", "read", "journal", "weigh", "photo"].filter((k) => chk.items[k] !== null).map((k) => `<li class="${chk.items[k] ? "ok" : ""}">${chk.items[k] ? "✓" : "·"} ${({ train: "Training", water: `Water (${(chk.water / 1000).toFixed(2)} L)`, guitar: "Guitar", read: "Read 30 min", journal: "Journal", weigh: "Weigh-in", photo: "Progress photo" })[k]}</li>`).join("")}</ul>
      ${live(s.journal[date]) && s.journal[date].text ? `<blockquote class="quote">${esc(s.journal[date].text)}</blockquote>` : ""}`;
    const body = dlg.querySelector(".sheet-body");
    body.querySelectorAll("[data-log]").forEach((b) => b.addEventListener("click", () => {
      const id = uid();
      update((st2) => { st2.sessions[id] = stamp({ id, date, type: b.dataset.log, source: "manual" }); });
      toast(`${SESSIONS[b.dataset.log].name} logged for ${shortDate(date)}.`);
      draw(dlg); window.dispatchEvent(new Event("cut:refresh"));
    }));
    body.querySelectorAll("[data-undo-session]").forEach((b) => b.addEventListener("click", () => {
      update((st2) => { stamp(Object.assign(st2.sessions[b.dataset.undoSession], { deleted: true })); });
      draw(dlg); window.dispatchEvent(new Event("cut:refresh"));
    }));
    body.querySelectorAll("[data-move]").forEach((b) => b.addEventListener("click", () => {
      setRec("shifts", date, { to: b.dataset.move, deleted: false });
      toast(`Moved to ${prettyDate(b.dataset.move)}. The next weekday is now locked.`);
      draw(dlg); window.dispatchEvent(new Event("cut:refresh"));
    }));
    body.querySelector("[data-unmove]")?.addEventListener("click", () => {
      setRec("shifts", date, { deleted: true });
      draw(dlg); window.dispatchEvent(new Event("cut:refresh"));
    });
    body.querySelectorAll("[data-excuse]").forEach((b) => b.addEventListener("click", () => {
      setRec("excuses", date, { reason: b.dataset.excuse, deleted: false });
      draw(dlg); window.dispatchEvent(new Event("cut:refresh"));
    }));
    body.querySelector("[data-unexcuse]")?.addEventListener("click", () => {
      setRec("excuses", date, { deleted: true });
      draw(dlg); window.dispatchEvent(new Event("cut:refresh"));
    });
  };
  modal(`<div class="sheet-body"></div>`, draw);
}

// ================= SCOPE (weight) =================
export function renderScope(view) {
  const c = context();
  const p = c.profile, ws = c.ws, now = c.now;
  const phase = phaseFor(ws.current, p.goalKg);
  const due = projectDate(ws.current, p.goalKg, ws.rate, now);
  const delta = ws.current != null && ws.start != null ? ws.current - ws.start : null;
  const ms = weightMilestones(ws, now);
  const next = ms.find((m) => !m.done);
  const pct = ws.start != null && ws.current != null && ws.start !== p.goalKg ? Math.max(0, Math.min(100, ((ws.start - ws.current) / (ws.start - p.goalKg)) * 100)) : 0;
  view.innerHTML = `
    <section class="page-head">
      <p class="kicker">Scope · body weight</p>
      <h1>Road to ${p.goalKg} kg.</h1>
      <p class="lede">Weigh in on ${p.weighDays.map((d) => ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"][d]).join(" and ")}: first thing, after the loo, before food or water. The <b>trend</b> line smooths out water-weight noise, so watch that, not the daily number.</p>
    </section>
    <div class="scope-top">
      <section class="hero-num card vf">
        <span class="label">Trend weight</span>
        <b class="big">${kg(ws.current)}<small> kg</small></b>
        <div class="reel" role="img" aria-label="${Math.round(pct)}% of the way from start to goal"><i style="width:${pct}%"></i><span class="reel-a">${kg(ws.start)}</span><span class="reel-b">${p.goalKg}</span></div>
        <dl class="kv">
          <div><dt>Since start</dt><dd>${delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)} kg`}</dd></div>
          <div><dt>To go</dt><dd>${c.togo == null ? "—" : `${c.togo} kg`}</dd></div>
          <div><dt>Rate</dt><dd>${ws.rate == null ? "Need 2 weeks" : `${ws.rate > 0 ? "+" : ""}${ws.rate.toFixed(2)} kg/wk`}</dd></div>
          <div><dt>ETA</dt><dd>${due ? longDate(due) : "—"}</dd></div>
        </dl>
        <p class="fine">Phase: <b>${PHASE_COPY[phase].label}</b>, ${PHASE_COPY[phase].line}.${next ? ` Next milestone: <b>${esc(next.title)}</b>${next.due ? `, around ${shortDate(next.due)}` : ""}.` : ""}</p>
      </section>
      <form class="card log-weight" id="wform">
        <h2>Log a weigh-in</h2>
        <label>Date <input type="date" name="date" value="${now}" max="${now}" required></label>
        <label>Weight (kg) <input type="number" name="kg" step="0.1" min="40" max="250" inputmode="decimal" placeholder="${ws.latest ?? ""}" required></label>
        <button class="btn primary" type="submit">Log it</button>
        ${store.settings.hevyKey ? `<p class="fine">Also saved to Hevy's body measurements.</p>` : ""}
      </form>
    </div>
    <section class="card">
      <h2>The scope <span class="h-sub">weigh-ins (dots) · trend (line) · projection (dashed)</span></h2>
      <div id="wchart"></div>
      <details class="table-view"><summary>Table view</summary>
        <table><thead><tr><th>Date</th><th>Weigh-in</th><th>Trend</th><th></th></tr></thead><tbody>
        ${[...ws.series].reverse().map((r) => `<tr><td>${prettyDate(r.date)}</td><td>${kg(r.kg)}</td><td>${kg(r.trend, 2)}</td><td><button class="link" data-del="${r.date}">delete</button></td></tr>`).join("") || `<tr><td colspan="4">No weigh-ins yet.</td></tr>`}
        </tbody></table>
      </details>
    </section>`;
  const pts = ws.series.map((r) => ({ date: r.date, value: r.kg, trend: r.trend }));
  const chartEl = $("#wchart", view);
  const draw = () => lineChart(chartEl, {
    points: pts, goal: p.goalKg, goalLabel: `FINAL CUT · ${p.goalKg} kg`, unit: "kg", label: "Body weight over time",
    projection: due && ws.current != null && daysBetween(now, due) < 400 ? { date: due, value: p.goalKg } : null,
    empty: "Log your first weigh-in to start the chart.",
  });
  draw();
  new ResizeObserver(() => draw()).observe(chartEl);
  $("#wform", view).addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    logWeight(f.get("date"), Number(f.get("kg")));
  });
  $$("[data-del]", view).forEach((b) => b.addEventListener("click", () => {
    if (!confirm(`Delete the weigh-in for ${prettyDate(b.dataset.del)}?`)) return;
    setRec("weights", b.dataset.del, { deleted: true });
  }));
}

export function logWeight(date, value) {
  if (!(value > 30 && value < 300)) { toast("That weight doesn't look right.", "bad"); return; }
  const prev = context().ws.latest;
  setRec("weights", date, { kg: Math.round(value * 10) / 10, deleted: false, source: "site" });
  const diff = prev != null ? value - prev : null;
  toast(diff == null ? `Logged ${value} kg. The reel starts here.` : `Logged ${value} kg (${diff > 0 ? "+" : ""}${diff.toFixed(1)} vs last). Trend over scale, always.`);
  if (store.settings.hevyKey && store.settings.hevyPushWeights) pushWeight(store.settings.hevyKey, date, value).catch(() => {});
}

// ================= RUSHES (photos) =================
const POSES = ["Front", "Side", "Back", "Flex"];

export function photoDialog(date = today(), onDone) {
  modal(`<div class="sheet-body">
    <p class="kicker">Rushes · progress photo</p>
    <h2>Shoot the rushes.</h2>
    <ul class="tips"><li>Same spot, same light, same time of day (morning, before food).</li><li>Phone at chest height, about 2–3 m away (you're 6′7″, so go landscape-tall or step back).</li><li>Relaxed, not flexed, for Front/Side/Back. Flex is the bonus.</li></ul>
    <form id="pform">
      <label>Date <input type="date" name="date" value="${date}" max="${today()}"></label>
      <fieldset class="poses"><legend>Pose</legend>${POSES.map((p, i) => `<label><input type="radio" name="pose" value="${p}" ${i === 0 ? "checked" : ""}> ${p}</label>`).join("")}</fieldset>
      <label class="file-drop">Choose or take a photo<input type="file" name="file" accept="image/*" required></label>
      <button class="btn primary" type="submit">Add to the reel</button>
      <p class="fine">Photos are shrunk on this device, then stored in your private data repo.</p>
    </form></div>`, (dlg) => {
    dlg.querySelector("#pform").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const file = f.get("file");
      if (!file || !file.size) return;
      const btn = e.target.querySelector("button[type=submit]");
      btn.disabled = true; btn.textContent = "Developing…";
      try {
        const blob = await compressImage(file);
        const d = f.get("date") || today();
        const id = uid();
        const name = `${d}-${String(f.get("pose")).toLowerCase()}-${id}.jpg`;
        await putPhoto(name, blob);
        const first = !Object.values(store.state.photos).some(live);
        setRec("photos", id, { id, date: d, pose: f.get("pose"), name, uploaded: false, deleted: false });
        dlg.close();
        if (first) toast("First frame of the reel. In twelve weeks you'll be glad you took this.");
        else toast("Added to the reel.");
        onDone?.();
      } catch (err) {
        toast(`Couldn't process that image: ${err.message}`, "bad");
        btn.disabled = false; btn.textContent = "Add to the reel";
      }
    });
  });
}

export function renderRushes(view) {
  const photos = Object.values(store.state.photos).filter(live).sort((a, b) => (a.date < b.date ? 1 : -1));
  const byDate = {};
  photos.forEach((p) => (byDate[p.date] ||= []).push(p));
  const poses = POSES.filter((p) => photos.filter((x) => x.pose === p).length >= 2);
  view.innerHTML = `
    <section class="page-head">
      <p class="kicker">Rushes · progress photos</p>
      <h1>The footage doesn't lie.</h1>
      <p class="lede">A photo every ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][profile().photoDay]}. The mirror changes too slowly to notice day to day; the reel shows you what's really happening.</p>
      <button class="btn primary" id="addPhoto">+ Add a photo</button>
    </section>
    ${poses.length ? `<section class="card compare-card">
      <h2>Before / after</h2>
      <div class="pose-tabs" role="tablist">${poses.map((p, i) => `<button role="tab" class="chip${i === 0 ? " on" : ""}" data-pose="${p}">${p}</button>`).join("")}</div>
      <div class="compare" id="compare"><img alt="" id="cmpA"><div class="cmp-b"><img alt="" id="cmpB"></div><span class="cmp-l" id="cmpLa"></span><span class="cmp-r" id="cmpLb"></span>
      <input type="range" min="0" max="100" value="50" aria-label="Slide to compare" id="cmpRange"></div>
    </section>` : ""}
    <section class="contact">
      ${Object.entries(byDate).map(([d, ps]) => `<div class="strip"><h3><span>${longDate(d)}</span><small>Day ${daysBetween(store.state.startDate || d, d) + 1}</small></h3>
        <div class="frames">${ps.map((p) => `<button class="frame" data-photo="${p.id}"><img hidden data-name="${esc(p.name)}" alt="${esc(p.pose)} photo, ${longDate(p.date)}"><span class="grease">${esc(p.pose)}</span></button>`).join("")}</div></div>`).join("")
        || `<div class="empty card"><p class="marker">No footage yet.</p><p>Your first progress photo is the most important one you'll ever take. Go on.</p></div>`}
    </section>`;
  $("#addPhoto", view).addEventListener("click", () => photoDialog(today(), () => renderRushes(view)));
  $$("img[data-name]", view).forEach(async (img) => { const u = await photoURL(img.dataset.name); if (u) { img.src = u; img.hidden = false; } else img.closest(".frame").classList.add("missing"); });
  $$("[data-photo]", view).forEach((b) => b.addEventListener("click", () => openPhoto(b.dataset.photo, () => renderRushes(view))));
  if (poses.length) {
    const setPose = async (pose) => {
      const list = photos.filter((p) => p.pose === pose).sort((a, b) => (a.date < b.date ? -1 : 1));
      const a = list[0], b = list[list.length - 1];
      const ua = await photoURL(a.name), ub = await photoURL(b.name);
      $("#cmpA", view).hidden = !ua; if (ua) $("#cmpA", view).src = ua;
      $("#cmpB", view).hidden = !ub; if (ub) $("#cmpB", view).src = ub;
      $("#cmpLa", view).textContent = shortDate(a.date);
      $("#cmpLb", view).textContent = shortDate(b.date);
    };
    $$("[data-pose]", view).forEach((b) => b.addEventListener("click", () => { $$("[data-pose]", view).forEach((x) => x.classList.toggle("on", x === b)); setPose(b.dataset.pose); }));
    $("#cmpRange", view).addEventListener("input", (e) => $("#compare", view).style.setProperty("--cut", `${e.target.value}%`));
    setPose(poses[0]);
  }
}

function openPhoto(id, after) {
  const p = store.state.photos[id];
  modal(`<div class="sheet-body lightbox"><img id="lb" alt="${esc(p.pose)} photo"><p class="kicker">${esc(p.pose)} · ${longDate(p.date)}</p><button class="link danger" id="delp">Delete photo</button></div>`, async (dlg) => {
    dlg.querySelector("#lb").src = (await photoURL(p.name)) || "";
    dlg.querySelector("#delp").addEventListener("click", () => {
      if (!confirm("Delete this photo from the reel?")) return;
      setRec("photos", id, { deleted: true });
      dlg.close(); after?.();
    });
  });
}

// ================= DAILIES (journal) =================
export function renderDailies(view) {
  const entries = Object.entries(store.state.journal).filter(([, j]) => live(j) && j.text?.trim()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const conf = [...entries].reverse().map(([, j]) => j.confidence).filter(Boolean);
  const energy = [...entries].reverse().map(([, j]) => j.energy).filter(Boolean);
  const avg = (a) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : "—");
  view.innerHTML = `
    <section class="page-head">
      <p class="kicker">Dailies · director's commentary</p>
      <h1>How the days went.</h1>
      <p class="lede">The bit nobody sees, and the bit that tells you the most. Watch the on-camera confidence score climb with the bar.</p>
    </section>
    <section class="stat-row">
      <div class="stat"><span class="label">Entries</span><b>${entries.length}</b></div>
      <div class="stat"><span class="label">Confidence (last 7)</span><b>${avg(conf.slice(-7))}<small>/5</small></b>${sparkline(conf.slice(-20))}</div>
      <div class="stat"><span class="label">Energy (last 7)</span><b>${avg(energy.slice(-7))}<small>/5</small></b>${sparkline(energy.slice(-20))}</div>
    </section>
    <section class="entries">${entries.map(([d, j]) => `
      <article class="entry card">
        <header><span class="tc">${longDate(d)}</span><span class="pill st-${dayStatus(store.state, d)}">${esc(SESSIONS[typeOn(store.state, d)]?.name || "Rest")}</span>
        ${j.confidence ? `<span class="rating" title="On-camera confidence">🎬 ${j.confidence}/5</span>` : ""}${j.energy ? `<span class="rating" title="Energy">⚡ ${j.energy}/5</span>` : ""}</header>
        <p>${esc(j.text).replace(/\n/g, "<br>")}</p>
      </article>`).join("") || `<div class="empty card"><p class="marker">No dailies yet.</p><p>Write tonight's on the Today page. Two lines is plenty.</p></div>`}
    </section>`;
}
