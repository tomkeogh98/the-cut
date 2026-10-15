// Tiny SVG line chart: raw points + a trend line, an optional goal line and projection,
// with a snapping crosshair + tooltip (pointer and arrow keys).
import { daysBetween, esc, parse, shortDate } from "./util.js?v=3";

const NS = "http://www.w3.org/2000/svg";

export function lineChart(host, opts) {
  const { points, goal = null, goalLabel = "", projection = null, unit = "kg", dp = 1, rawLabel = "Weigh-in", trendLabel = "Trend" } = opts;
  host.innerHTML = "";
  host.classList.add("chart");
  if (!points.length) { host.innerHTML = `<p class="chart-empty">${esc(opts.empty || "No data yet.")}</p>`; return; }

  const W = Math.max(280, host.clientWidth || 600);
  const H = opts.height || Math.round(Math.min(420, Math.max(220, W * 0.42)));
  const m = { t: 18, r: 18, b: 30, l: 44 };
  const first = points[0].date;
  const lastDate = projection ? projection.date : points[points.length - 1].date;
  const span = Math.max(7, daysBetween(first, lastDate));
  const vals = points.flatMap((p) => [p.value, p.trend].filter((v) => v != null));
  if (goal != null) vals.push(goal);
  if (projection) vals.push(projection.value);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = Math.max(0.6, (hi - lo) * 0.12);
  lo -= pad; hi += pad;
  const x = (d) => m.l + (daysBetween(first, d) / span) * (W - m.l - m.r);
  const y = (v) => m.t + (1 - (v - lo) / (hi - lo)) * (H - m.t - m.b);

  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("width", W);
  svg.setAttribute("height", H);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", opts.label || "Chart");
  const el = (tag, attrs, parent = svg) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); parent.appendChild(e); return e; };

  // grid + y ticks
  const step = niceStep((hi - lo) / 4);
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
    el("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: "c-grid" });
    const t = el("text", { x: m.l - 8, y: y(v) + 4, class: "c-tick", "text-anchor": "end" });
    t.textContent = Number(v.toFixed(step < 1 ? 1 : 0));
  }
  // x ticks: ~5 dates
  const n = Math.min(5, Math.max(2, Math.floor(W / 140)));
  for (let i = 0; i <= n; i++) {
    const d = addDaysLocal(first, Math.round((span * i) / n));
    const t = el("text", { x: x(d), y: H - 8, class: "c-tick", "text-anchor": i === 0 ? "start" : i === n ? "end" : "middle" });
    t.textContent = shortDate(d);
  }
  // goal line
  if (goal != null) {
    el("line", { x1: m.l, x2: W - m.r, y1: y(goal), y2: y(goal), class: "c-goal" });
    const t = el("text", { x: m.l + 6, y: y(goal) - 6, class: "c-goal-label", "text-anchor": "start" });
    t.textContent = goalLabel || `${goal} ${unit}`;
  }
  // projection
  const lastP = points[points.length - 1];
  if (projection) {
    el("line", { x1: x(lastP.date), y1: y(lastP.trend ?? lastP.value), x2: x(projection.date), y2: y(projection.value), class: "c-proj" });
    el("circle", { cx: x(projection.date), cy: y(projection.value), r: 4, class: "c-proj-dot" });
  }
  // trend line
  if (points.some((p) => p.trend != null)) {
    const d = points.filter((p) => p.trend != null).map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.trend).toFixed(1)}`).join("");
    el("path", { d, class: "c-trend" });
  }
  // raw points
  for (const p of points) if (p.value != null) el("circle", { cx: x(p.date), cy: y(p.value), r: points.length > 60 ? 3 : 4, class: "c-dot" });
  // end label on the trend
  const endV = lastP.trend ?? lastP.value;
  el("circle", { cx: x(lastP.date), cy: y(endV), r: 5, class: "c-end" });

  // crosshair
  const cross = el("line", { x1: 0, x2: 0, y1: m.t, y2: H - m.b, class: "c-cross", visibility: "hidden" });
  const focusDot = el("circle", { cx: 0, cy: 0, r: 6, class: "c-focus", visibility: "hidden" });
  const tip = document.createElement("div");
  tip.className = "c-tip";
  tip.hidden = true;
  host.append(svg, tip);

  let idx = points.length - 1;
  const show = (i) => {
    idx = Math.max(0, Math.min(points.length - 1, i));
    const p = points[idx];
    const px = x(p.date), py = y(p.trend ?? p.value);
    cross.setAttribute("x1", px); cross.setAttribute("x2", px); cross.setAttribute("visibility", "visible");
    focusDot.setAttribute("cx", px); focusDot.setAttribute("cy", py); focusDot.setAttribute("visibility", "visible");
    tip.hidden = false;
    tip.replaceChildren();
    const head = document.createElement("div"); head.className = "c-tip-date"; head.textContent = shortDate(p.date) + " " + parse(p.date).getFullYear();
    tip.append(head);
    const row = (label, v, cls) => {
      const r = document.createElement("div"); r.className = "c-tip-row";
      const k = document.createElement("i"); k.className = cls;
      const b = document.createElement("b"); b.textContent = `${v.toFixed(dp)} ${unit}`;
      const s = document.createElement("span"); s.textContent = label;
      r.append(k, b, s); tip.append(r);
    };
    if (p.value != null) row(rawLabel, p.value, "k-dot");
    if (p.trend != null) row(trendLabel, p.trend, "k-line");
    const scale = svg.getBoundingClientRect().width / W || 1;
    const left = px * scale;
    tip.style.left = `${Math.min(Math.max(left, 70), host.clientWidth - 70)}px`;
    tip.style.top = `${Math.max(0, py * scale - 70)}px`;
  };
  const hide = () => { cross.setAttribute("visibility", "hidden"); focusDot.setAttribute("visibility", "hidden"); tip.hidden = true; };
  svg.addEventListener("pointermove", (e) => {
    const r = svg.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    let best = 0, bd = Infinity;
    points.forEach((p, i) => { const d = Math.abs(x(p.date) - sx); if (d < bd) { bd = d; best = i; } });
    show(best);
  });
  svg.addEventListener("pointerleave", hide);
  host.tabIndex = 0;
  host.addEventListener("focus", () => show(idx));
  host.addEventListener("blur", hide);
  host.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); show(idx - 1); }
    if (e.key === "ArrowRight") { e.preventDefault(); show(idx + 1); }
  });
}

function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
}
function addDaysLocal(s, n) { const d = parse(s); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

// Inline sparkline for stat tiles.
export function sparkline(values, w = 120, h = 32) {
  if (values.length < 2) return "";
  const lo = Math.min(...values), hi = Math.max(...values), r = hi - lo || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * (w - 4) + 2).toFixed(1)},${(h - 2 - ((v - lo) / r) * (h - 4)).toFixed(1)}`);
  const [lx, ly] = pts[pts.length - 1].split(",");
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline points="${pts.join(" ")}"/><circle cx="${lx}" cy="${ly}" r="3"/></svg>`;
}
