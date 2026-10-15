"""End-to-end smoke test in headless Chrome.

Onboards a fresh user, seeds ~6 weeks of realistic history (weigh-ins, Hevy workouts, misses, a move,
an excuse, journals), clicks through every feature, then screenshots every page at 375/1024/1440/1920
in light and dark mode, failing on console errors or horizontal overflow.

    ~/Library/Caches/claude-playwright/venv/bin/python tests/smoke.py [base_url]
"""
import json
import math
import os
import random
import struct
import sys
import zlib
from datetime import date, datetime, timedelta

from playwright.sync_api import sync_playwright

from serve import serve

OUT = os.path.join(os.path.dirname(__file__), "out")
os.makedirs(OUT, exist_ok=True)
random.seed(4)

if len(sys.argv) > 1:
    BASE, httpd = sys.argv[1].rstrip("/"), None
else:
    BASE, httpd = serve()

TODAY = date.today()
START = TODAY - timedelta(days=TODAY.weekday()) - timedelta(weeks=6)  # a Monday six weeks back
TYPES = {0: "upperA", 1: "lowerA", 2: "run", 3: "upperB", 4: "lowerB"}


def iso(d):
    return d.isoformat()


def png(w=300, h=400, rgb=(200, 120, 60)):
    raw = b"".join(b"\x00" + bytes(rgb) * w for _ in range(h))
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


def hevy_workout(d, kind, week):
    start = datetime(d.year, d.month, d.day, 18, 5)
    def ex(title, kg, reps, sets=3):
        return {"t": title, "sets": [[round(kg * 0.5), 10, "warmup", None, None]] + [[kg, reps - (1 if i == sets - 1 and week % 2 else 0), "normal", None, None] for i in range(sets)]}
    lifts = {
        "upperA": [ex("Bench Press (Barbell)", 70 + 2.5 * week, 8), ex("Chest Supported Incline Row (Dumbbell)", 26 + week, 10), ex("Lateral Raise (Dumbbell)", 10, 15)],
        "lowerA": [ex("Squat (Barbell)", 80 + 5 * week, 6), ex("Romanian Deadlift (Barbell)", 70 + 5 * week, 8), ex("Standing Calf Raise (Machine)", 60, 12, 4)],
        "upperB": [ex("Overhead Press (Barbell)", 40 + 1.25 * week, 7), {"t": "Pull Up", "sets": [[None, 5 + week // 2, "normal", None, None]] * 3}, ex("Incline Bench Press (Dumbbell)", 26, 10)],
        "lowerB": [ex("Trap Bar Deadlift", 110 + 7.5 * week, 5), ex("Leg Press (Machine)", 140 + 10 * week, 10), ex("Seated Calf Raise", 40, 15)],
    }[kind]
    title = {"upperA": "Upper A · Chest & back thickness", "lowerA": "Lower A · Quads & the squat", "upperB": "Upper B · Shoulders & V-taper", "lowerB": "Lower B · Hinge & posterior chain"}[kind]
    wid = f"seed-{iso(d)}"
    return wid, {"id": wid, "title": title, "date": iso(d), "start": start.isoformat() + "Z", "end": (start + timedelta(minutes=62)).isoformat() + "Z", "updatedAt": 1, "ex": lifts}


def seed():
    s = {"version": 1, "startDate": iso(START), "profile": None, "hevy": {"workouts": {}},
         "sessions": {}, "excuses": {}, "shifts": {}, "checks": {}, "weights": {}, "journal": {}, "photos": {}, "milestones": {}, "meals": {}}
    s["profile"] = {"name": "Tom", "heightCm": 200.7, "birthday": "1998-08-04", "sex": "male", "goalKg": 90, "startKg": 97.8, "activity": 1.55,
                    "weighDays": [1, 4], "photoDay": 1, "why": "To look better on camera and come across more confident when I talk, on camera and off it.", "updatedAt": 1}
    missed = {START + timedelta(days=8), START + timedelta(days=22)}
    moved_from = START + timedelta(days=17)  # a Thursday, moved to Saturday
    excused = START + timedelta(days=29)  # sick
    d = START
    kg = 97.8
    week = 0
    while d < TODAY:
        wd = d.weekday()
        week = (d - START).days // 7
        if wd in TYPES and d not in missed and d != moved_from and d != excused:
            t = TYPES[wd]
            if t == "run":
                s["sessions"][f"run-{iso(d)}"] = {"id": f"run-{iso(d)}", "date": iso(d), "type": "run", "source": "manual", "updatedAt": 1}
            else:
                wid, w = hevy_workout(d, t, week)
                s["hevy"]["workouts"][wid] = w
        if d == moved_from + timedelta(days=2):
            wid, w = hevy_workout(d, "upperB", week)
            s["hevy"]["workouts"][wid] = w
        kg -= 0.07
        if wd in (0, 3) or random.random() < 0.3:
            s["weights"][iso(d)] = {"kg": round(kg + math.sin(d.toordinal()) * 0.35, 1), "updatedAt": 1}
        s["checks"][iso(d)] = {"water": random.choice([3000, 3500, 4000, 4000, 4000]), "guitar": random.random() > 0.2, "read": random.random() > 0.25, "updatedAt": 1}
        if random.random() > 0.3:
            s["journal"][iso(d)] = {"text": random.choice(["Felt strong on bench today, filmed two videos after and felt more relaxed talking to camera.",
                                                              "Tired from work but got it done. Legs are cooked.",
                                                              "Great run club, chatted to a couple of new people. Felt easy.",
                                                              "Bit flat today. Did the list anyway."]),
                                    "energy": random.randint(2, 5), "confidence": random.randint(2, 5), "updatedAt": 1}
        d += timedelta(days=1)
    s["shifts"][iso(moved_from)] = {"to": iso(moved_from + timedelta(days=2)), "updatedAt": 1}
    s["excuses"][iso(excused)] = {"reason": "sick", "updatedAt": 1}
    # mark seeded milestones as already celebrated so the test isn't spammed by overlays
    return s


errors = []


def watch(page):
    # The bad-token check deliberately gets a 401 from GitHub; anything else is a real error.
    page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text} @ {m.location.get('url')}")
            if m.type == "error" and "api.github.com" not in (m.location.get("url") or "") and "favicon" not in (m.location.get("url") or "") else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))


def close_overlays(page):
    for _ in range(4):
        if page.locator(".wrap-overlay").count():
            page.locator(".wrap-overlay").first.click(force=True)
            page.wait_for_timeout(100)


def overflow(page):
    return page.evaluate("() => document.documentElement.scrollWidth > window.innerWidth + 1")


with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")

    # ---------- 1. fresh visit → onboarding ----------
    ctx = b.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    watch(page)
    page.goto(BASE + "/")
    page.wait_for_selector("#cast")
    assert "welcome to the cut" in page.inner_text("h1").lower(), "onboarding title missing"
    page.fill("input[name=kg]", "97.4")
    page.check("input[name=sex][value=male]")
    page.click("#cast button[type=submit]")
    page.wait_for_selector(".wrap-overlay")
    page.screenshot(path=f"{OUT}/onboard-celebrate.png")
    close_overlays(page)
    page.wait_for_selector(".titlecard .greet")
    print("greeting:", page.inner_text(".greet"), "|", page.inner_text(".greet-sub"))
    page.screenshot(path=f"{OUT}/day-one.png", full_page=True)

    # water + toggles + journal
    page.locator("[data-water='1000']").click()
    page.locator("[data-toggle='guitar']").click()
    page.fill("#jform textarea", "First day. Weighed in, set things up.")
    page.locator("#jform input[name=confidence][value='3']").check(force=True)
    page.click("#jform button[type=submit]")
    page.wait_for_timeout(300)
    state = page.evaluate("() => JSON.parse(localStorage.getItem('cut.state.v1'))")
    t = TODAY.isoformat()
    assert state["checks"][t]["water"] == 1000, state["checks"]
    assert state["checks"][t]["guitar"] is True
    assert state["journal"][t]["text"].startswith("First day")
    assert state["weights"][t]["kg"] == 97.4
    print("onboarding + list + journal OK")

    # ---------- 2. seeded history ----------
    seeded = seed()
    page.evaluate("s => { localStorage.setItem('cut.state.v1', JSON.stringify(s)); localStorage.removeItem('cut.greet.recent'); }", seeded)
    page.reload()
    page.wait_for_selector(".titlecard")
    close_overlays(page)
    page.wait_for_timeout(200)
    close_overlays(page)
    brief = page.inner_text(".brief")
    print("BRIEF:\n", brief[:900])
    assert "Previously" in brief.upper() or "PREVIOUSLY" in brief
    nudge = page.locator(".directors-note").count()
    print("nudge shown:", bool(nudge))

    # timeline: statuses present
    page.goto(BASE + "/#/timeline")
    page.wait_for_selector(".month")
    counts = page.evaluate("() => ['done','missed','moved','excused','off','broken'].map(k => [k, document.querySelectorAll('.day.st-' + k).length])")
    print("timeline:", counts)
    c = dict(counts)
    assert c["done"] > 20 and c["missed"] >= 2 and c["moved"] == 1 and c["excused"] == 1 and c["off"] > 5, counts
    # open a future planned weekday and try to move it
    future = page.locator(".day.st-planned, .day.st-today").first
    if future.count():
        future.click()
        page.wait_for_selector("dialog.sheet[open]")
        txt = page.inner_text("dialog.sheet")
        print("day panel:", txt.replace("\n", " | ")[:300])
        mv = page.locator("dialog [data-move]")
        if mv.count():
            mv.first.click()
            page.wait_for_timeout(200)
            assert "moved to" in page.inner_text("dialog.sheet").lower()
            page.click("dialog [data-unmove]")
        page.click("dialog [data-close]")

    # scope: chart + log weight
    page.goto(BASE + "/#/scope")
    page.wait_for_selector("#wchart svg")
    page.fill("#wform input[name=kg]", "95.1")
    page.click("#wform button[type=submit]")
    page.wait_for_timeout(300)
    page.hover("#wchart svg", position={"x": 300, "y": 100})
    page.wait_for_timeout(100)
    assert page.locator(".c-tip").is_visible(), "chart tooltip should show on hover"
    page.screenshot(path=f"{OUT}/scope-hover.png")

    # rushes: upload a photo
    page.goto(BASE + "/#/rushes")
    page.click("#addPhoto")
    page.set_input_files("#pform input[type=file]", files=[{"name": "front.png", "mimeType": "image/png", "buffer": png()}])
    page.click("#pform button[type=submit]")
    page.wait_for_timeout(800)
    close_overlays(page)
    page.click("#addPhoto")
    page.check("#pform input[value=Front]", force=True)
    page.set_input_files("#pform input[type=file]", files=[{"name": "front2.png", "mimeType": "image/png", "buffer": png(rgb=(60, 120, 200))}])
    page.click("#pform button[type=submit]")
    page.wait_for_timeout(800)
    close_overlays(page)
    page.goto(BASE + "/#/timeline")
    page.goto(BASE + "/#/rushes")
    page.wait_for_selector(".frame img[src^='blob:']")
    assert page.locator("#compare").count() == 1, "compare slider should appear with 2 front photos"

    # goals, meals, programme, journal, settings
    page.goto(BASE + "/#/script")
    page.wait_for_selector(".screenplay")
    print("level:", page.inner_text(".level-name"), "| lifts:", page.locator(".tiers").count())
    page.goto(BASE + "/#/craft")
    page.wait_for_selector(".meal")
    before = page.inner_text(".meal-cards .meal h3")
    page.locator("[data-shuffle]").first.click()
    page.wait_for_timeout(200)
    assert page.inner_text(".meal-cards .meal h3") != before, "shuffle should change breakfast"
    print("macro board:", page.inner_text(".macro-board .kv").replace("\n", " "))
    page.goto(BASE + "/#/program")
    page.wait_for_selector("#hevy")
    page.set_input_files("#csv", files=[{"name": "workouts.csv", "mimeType": "text/csv", "buffer": (
        '"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"\n'
        f'"Extra","{TODAY.day} {TODAY.strftime("%b %Y")}, 07:00","{TODAY.day} {TODAY.strftime("%b %Y")}, 08:00","","Bench Press (Barbell)","","","0","normal","90","5","","",""\n').encode()}])
    page.wait_for_timeout(300)
    page.goto(BASE + "/#/session/upperA")
    page.wait_for_selector(".exercises")
    page.goto(BASE + "/#/dailies")
    page.wait_for_selector(".entry")
    page.goto(BASE + "/#/office")
    page.wait_for_selector("#prof")
    assert page.locator("#syncBanner").is_visible(), "unsynced device should show the banner"
    page.locator("#devices details summary").first.click()
    page.fill("#connectForm input[name=token]", " github_pat_bad​ token \n")
    page.click("#connectForm button.primary")
    page.wait_for_function("() => !/Connecting/.test(document.querySelector('#connectMsg').textContent)", timeout=15000)
    print("bad token message:", page.inner_text("#connectMsg"))
    saved = page.evaluate("() => JSON.parse(localStorage.getItem('cut.settings.v1')).token")
    assert saved == "github_pat_badtoken", saved
    page.evaluate("() => { const s = JSON.parse(localStorage.getItem('cut.settings.v1')); s.token=''; localStorage.setItem('cut.settings.v1', JSON.stringify(s)); }")
    final_state = page.evaluate("() => localStorage.getItem('cut.state.v1')")
    with open(f"{OUT}/state.json", "w") as f:
        f.write(final_state)

    # slacking: wipe the last 10 days of training → the director's note should appear on Today
    page.evaluate("""() => {
      const s = JSON.parse(localStorage.getItem('cut.state.v1'));
      const cut = new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10);
      for (const [id, w] of Object.entries(s.hevy.workouts)) if (w.date >= cut) delete s.hevy.workouts[id];
      for (const [id, x] of Object.entries(s.sessions)) if (x.date >= cut) delete s.sessions[id];
      localStorage.setItem('cut.state.v1', JSON.stringify(s));
    }""")
    page.goto(BASE + "/#/")
    page.reload()
    page.wait_for_selector(".titlecard")
    close_overlays(page)
    assert page.locator(".directors-note").count() == 1, "slacking should trigger the director's note"
    print("NUDGE:", page.inner_text(".directors-note").replace("\n", " "))
    page.locator(".directors-note").screenshot(path=f"{OUT}/nudge.png")
    ctx.close()

    # ---------- 3. screenshots, every page × width × theme ----------
    pages = ["", "timeline", "scope", "rushes", "script", "craft", "program", "dailies", "office", "session/lowerB"]
    for scheme in ("light", "dark"):
        for w in (375, 1024, 1440, 1920):
            ctx = b.new_context(viewport={"width": w, "height": 900}, color_scheme=scheme, device_scale_factor=1)
            pg = ctx.new_page()
            watch(pg)
            pg.goto(BASE + "/tests/blank.html")
            pg.evaluate("s => localStorage.setItem('cut.state.v1', s)", final_state)
            for name in pages:
                pg.goto(f"{BASE}/#/{name}")
                pg.wait_for_selector("main#view > *")
                pg.wait_for_timeout(250)
                close_overlays(pg)
                if overflow(pg):
                    errors.append(f"horizontal overflow: {name or 'today'} @ {w} {scheme}")
                if w in (375, 1440) or name == "":
                    pg.screenshot(path=f"{OUT}/{scheme}-{w}-{(name or 'today').replace('/', '-')}.png", full_page=True)
            ctx.close()
    b.close()

if httpd:
    httpd.shutdown()
if errors:
    print("FAILURES:")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print("ALL GOOD")
