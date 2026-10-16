"""Guitar Hero → The Cut: a lesson finished on Guitar Hero ticks 'Guitar practice' on The Cut's list.

1. Same device: Guitar Hero's saved state (gh.state.v1, shared localStorage on tomkeogh98.github.io) has a lesson today.
2. Other device: only Guitar Hero's sync settings exist; the lesson comes from a (faked) guitar-hero-data repo.
3. Unticking it by hand sticks across a reload.
"""
import json
import os
import sys
from datetime import date

from playwright.sync_api import sync_playwright

from serve import serve

OUT = os.path.join(os.path.dirname(__file__), "out")
state = open(os.path.join(OUT, "state.json")).read()
TODAY = date.today().isoformat()
LESSON = {"id": "abc", "date": TODAY, "title": "Lesson 7: The G chord", "completedAt": 1, "updatedAt": 1}
base, httpd = serve()
fails = []


def check(cond, msg):
    print(("ok   " if cond else "FAIL ") + msg)
    if not cond:
        fails.append(msg)


def fresh_state():
    s = json.loads(state)
    s["checks"].pop(TODAY, None)
    return json.dumps(s)


with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")

    # 1. same device
    pg = b.new_context().new_page()
    pg.on("pageerror", lambda e: fails.append(str(e)))
    pg.goto(base + "/tests/blank.html")
    pg.evaluate("([s, gh]) => { localStorage.setItem('cut.state.v1', s); localStorage.setItem('gh.state.v1', gh); }",
                [fresh_state(), json.dumps({"sessions": {"abc": LESSON}})])
    pg.goto(base + "/#/")
    pg.wait_for_selector(".the-list")
    pg.wait_for_timeout(500)
    item = pg.locator("[data-item=guitar]")
    check("done" in item.get_attribute("class"), "same device: guitar ticked from Guitar Hero's saved lesson")
    check("The G chord" in item.inner_text(), "same device: shows the lesson title")

    # 3. untick sticks
    pg.click("[data-toggle=guitar]")
    pg.wait_for_timeout(200)
    pg.reload()
    pg.wait_for_selector(".the-list")
    pg.wait_for_timeout(500)
    check("done" not in pg.locator("[data-item=guitar]").get_attribute("class"), "manual untick sticks after reload")

    # live: Guitar Hero saves in another tab → ticks without reload
    pg.evaluate("() => { const s = JSON.parse(localStorage.getItem('cut.state.v1')); delete s.checks[new Date().toISOString().slice(0,10)]; localStorage.setItem('cut.state.v1', JSON.stringify(s)); localStorage.removeItem('gh.state.v1'); }")
    pg.reload()
    pg.wait_for_selector(".the-list")
    tab2 = pg.context.new_page()
    tab2.goto(base + "/tests/blank.html")
    tab2.evaluate("gh => localStorage.setItem('gh.state.v1', gh)", json.dumps({"sessions": {"abc": LESSON}}))
    pg.wait_for_timeout(800)
    check("done" in pg.locator("[data-item=guitar]").get_attribute("class"), "Guitar Hero saving in another tab ticks the list live")
    pg.context.close()

    # 2. other device: only Guitar Hero's sync token; lesson comes from the repo
    ctx = b.new_context()
    hits = []

    def fake(route):
        hits.append(route.request.url)
        if "guitar-hero-data" in route.request.url and route.request.headers.get("authorization") == "Bearer github_pat_GH":
            return route.fulfill(json={"sessions": {"abc": LESSON}}, headers={"Access-Control-Allow-Origin": "*"})
        return route.fulfill(status=404, json={}, headers={"Access-Control-Allow-Origin": "*"})

    ctx.route("https://api.github.com/**", fake)
    pg = ctx.new_page()
    pg.goto(base + "/tests/blank.html")
    pg.evaluate("([s, set]) => { localStorage.setItem('cut.state.v1', s); localStorage.setItem('gh.settings.v1', set); }",
                [fresh_state(), json.dumps({"token": "github_pat_GH", "repo": "tomkeogh98/guitar-hero-data"})])
    pg.goto(base + "/#/")
    pg.wait_for_selector(".the-list")
    pg.wait_for_timeout(1200)
    check(any("guitar-hero-data" in h for h in hits), "other device: fetched guitar-hero-data with Guitar Hero's token")
    check("done" in pg.locator("[data-item=guitar]").get_attribute("class"), "other device: guitar ticked from the repo")
    b.close()
httpd.shutdown()
print("FAILURES:" if fails else "ALL GOOD", *fails, sep="\n - " if fails else "")
sys.exit(1 if fails else 0)
