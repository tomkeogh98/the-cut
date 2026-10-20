"""The Renpho Shortcut link: #/weigh?kg=…&unit=…&fat=…&lean=…&at=… logs a weigh-in, once, and shows it on Scope."""
import json
import sys
from datetime import date, timedelta

from playwright.sync_api import sync_playwright

from serve import serve

base, httpd = serve()
fails = []
today = date.today()
yday = (today - timedelta(days=1)).isoformat()
state = {"version": 1, "startDate": (today - timedelta(days=30)).isoformat(), "hevy": {"workouts": {}},
         "profile": {"name": "Tom", "heightCm": 200.7, "birthday": "1998-08-04", "sex": "male", "goalKg": 90, "startKg": 97.8,
                     "activity": 1.55, "weighDays": [1, 4], "photoDay": 1, "why": "x", "updatedAt": 1},
         "weights": {(today - timedelta(days=8)).isoformat(): {"kg": 84.0, "source": "site", "updatedAt": 1}}}
link = f"{base}/#/weigh?kg=12.97&unit=st&fat=0.182&lean=10.566&at={yday}T07:31:02%2B01:00"

with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    for name, vp in (("phone", {"width": 375, "height": 812}), ("laptop", {"width": 1440, "height": 900})):
        ctx = b.new_context(viewport=vp)
        ctx.route("https://api.github.com/**", lambda r: r.fulfill(status=404, json={}))
        page = ctx.new_page()
        page.on("pageerror", lambda e: fails.append(f"pageerror: {e}"))
        page.goto(base + "/tests/blank.html")
        page.evaluate("s => localStorage.setItem('cut.state.v1', s)", json.dumps(state))
        page.goto(link)
        page.wait_for_selector(".toast", timeout=5000)
        toast = page.inner_text(".toast")
        if "Renpho weigh-in logged: 82.4 kg · 18.2% fat" not in toast or "isn't synced" not in toast:
            fails.append(f"{name}: toast {toast!r}")
        if not page.url.endswith("#/scope"):
            fails.append(f"{name}: url {page.url}")
        rec = page.evaluate(f"() => JSON.parse(localStorage.getItem('cut.state.v1')).weights['{yday}']")
        if not rec or rec.get("kg") != 82.4 or rec.get("fat") != 18.2 or rec.get("lean") != 67.1 or rec.get("source") != "renpho":
            fails.append(f"{name}: record {rec}")
        hero = page.inner_text(".hero-num")
        if "18.2%" not in hero or "67.1 kg lean" not in hero or "20.5" not in hero:  # BMI 82.4 / 2.007²
            fails.append(f"{name}: hero {hero!r}")
        page.click(".table-view summary")
        if "18.2%" not in page.inner_text(".table-view"):
            fails.append(f"{name}: table missing body fat")
        overflow = page.evaluate("() => document.documentElement.scrollWidth > innerWidth")
        if overflow:
            fails.append(f"{name}: horizontal overflow on Scope")
        # Re-opening Renpho without weighing re-sends the same sample: no new write
        before = page.evaluate(f"() => JSON.parse(localStorage.getItem('cut.state.v1')).weights['{yday}'].updatedAt")
        page.goto(base + "/#/")
        page.goto(link)
        page.wait_for_timeout(600)
        after = page.evaluate(f"() => JSON.parse(localStorage.getItem('cut.state.v1')).weights['{yday}'].updatedAt")
        if before != after or "Already logged" not in page.inner_text(".toast-wrap, body"):
            fails.append(f"{name}: repeat link wrote again or no 'Already logged'")
        page.goto(base + "/#/weigh?fat=18")
        page.wait_for_timeout(400)
        if "no weight" not in page.inner_text("body"):
            fails.append(f"{name}: junk link not rejected")
        page.goto(base + "/#/office")
        page.wait_for_selector(".renpho")
        page.locator(".renpho").screenshot(path=f"tests/out/renpho-card-{name}.png")
        page.goto(base + "/#/scope")
        page.wait_for_timeout(300)
        page.screenshot(path=f"tests/out/renpho-scope-{name}.png", full_page=False)
        ctx.close()
    b.close()
httpd.shutdown()
for f in fails:
    print("FAIL", f)
print(f"renpho: {len(fails)} failures")
sys.exit(1 if fails else 0)
