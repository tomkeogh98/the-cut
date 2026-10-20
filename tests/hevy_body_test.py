"""Smart-scale weigh-ins via Apple Health → Hevy: Hevy's body measurement (weight, fat %, lean mass) shows up on Scope by itself."""
import json
import sys
from datetime import date, timedelta

from playwright.sync_api import sync_playwright

from serve import serve

base, httpd = serve()
fails = []
t = date.today()
typed = (t - timedelta(days=3)).isoformat()
state = {"version": 1, "startDate": (t - timedelta(days=30)).isoformat(), "hevy": {"workouts": {}},
         "profile": {"name": "Tom", "heightCm": 200.7, "birthday": "1998-08-04", "sex": "male", "goalKg": 90, "startKg": 97.8,
                     "activity": 1.55, "weighDays": [1, 4], "photoDay": 1, "why": "x", "updatedAt": 1},
         "weights": {typed: {"kg": 83.0, "source": "site", "_f": {"kg": 5}, "updatedAt": 5}}}
MEASURES = [{"date": t.isoformat(), "weight_kg": 82.4, "fat_percent": 18.2, "lean_mass_kg": 67.1},
            {"date": typed, "weight_kg": 99.9, "fat_percent": 18.6, "lean_mass_kg": 67.4}]


def fake_hevy(route):
    cors = {"Access-Control-Allow-Origin": "*"}
    url = route.request.url
    if "/body_measurements" in url:
        return route.fulfill(json={"page": 1, "page_count": 1, "body_measurements": MEASURES}, headers=cors)
    if "/workouts/events" in url:
        return route.fulfill(json={"page": 1, "page_count": 1, "events": []}, headers=cors)
    return route.fulfill(json={}, headers=cors)


with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    ctx = b.new_context(viewport={"width": 375, "height": 812})
    ctx.route("https://api.hevyapp.com/**", fake_hevy)
    ctx.route("https://api.github.com/**", lambda r: r.fulfill(status=404, json={}))
    page = ctx.new_page()
    page.on("pageerror", lambda e: fails.append(f"pageerror: {e}"))
    page.goto(base + "/tests/blank.html")
    page.evaluate("([s, st]) => { localStorage.setItem('cut.state.v1', s); localStorage.setItem('cut.settings.v1', st); }",
                  [json.dumps(state), json.dumps({"hevyKey": "fake-key", "repo": "", "token": ""})])
    page.goto(base + "/#/scope")
    page.wait_for_function(f"() => window.__cut.store.state.weights['{t.isoformat()}']", timeout=8000)
    page.wait_for_timeout(500)
    w = page.evaluate("() => window.__cut.store.state.weights")
    new, old = w.get(t.isoformat()) or {}, w.get(typed) or {}
    if new.get("kg") != 82.4 or new.get("fat") != 18.2 or new.get("lean") != 67.1 or new.get("source") != "hevy":
        fails.append(f"today's Hevy weigh-in: {new}")
    if old.get("kg") != 83.0 or old.get("fat") != 18.6 or old.get("lean") != 67.4:
        fails.append(f"typed weigh-in should keep 83.0 kg and gain fat/lean: {old}")
    for _ in range(6):
        if page.locator(".finish").count():
            page.locator(".finish").first.click(force=True)
            page.wait_for_timeout(150)
    hero = page.inner_text(".hero-num")
    if "18.2%" not in hero or "67.1 kg lean" not in hero or "20.5" not in hero:
        fails.append(f"hero: {hero!r}")
    if "Apple Health → Hevy" not in page.inner_text("#wform"):
        fails.append("weigh-in form doesn't explain where scale weigh-ins come from")
    if page.evaluate("() => document.documentElement.scrollWidth > innerWidth"):
        fails.append("horizontal overflow")
    page.screenshot(path="tests/out/hevy-body-scope.png")
    b.close()
httpd.shutdown()
for f in fails:
    print("FAIL", f)
print(f"hevy body: {len(fails)} failures")
sys.exit(1 if fails else 0)
