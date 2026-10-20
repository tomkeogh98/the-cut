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
        page.wait_for_selector(".renpho-connect", timeout=5000)
        card = page.inner_text(".renpho-connect")
        if "got 82.4 kg · 18.2% fat from renpho" not in card.lower() or "isn't connected" not in card:
            fails.append(f"{name}: connect card {card!r}")
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
        if before != after:
            fails.append(f"{name}: repeat link wrote again")
        page.goto(base + "/#/weigh?kg=Weight&fat=18")
        page.wait_for_selector(".renpho-debug", timeout=4000)
        if "kg=Weight&fat=18" not in page.inner_text(".renpho-debug"):
            fails.append(f"{name}: debug card doesn't show what arrived: {page.inner_text('.renpho-debug')!r}")
        page.goto(base + "/#/office")
        page.wait_for_selector(".renpho")
        if "couldn't read a weight" not in page.inner_text(".renpho") or "kg=Weight" not in page.inner_text(".renpho"):
            fails.append(f"{name}: settings doesn't show the last link")
        page.goto(base + "/#/office")
        page.wait_for_selector(".renpho")
        page.locator(".renpho").screenshot(path=f"tests/out/renpho-card-{name}.png")
        page.goto(base + "/#/scope")
        page.wait_for_timeout(300)
        page.screenshot(path=f"tests/out/renpho-scope-{name}.png", full_page=False)
        ctx.close()
    # A fresh Safari (not connected, never set up) gets the link: plain explanation + paste the setup link → it syncs.
    TOKEN, REPO = "github_pat_FAKE", "tomkeogh98/the-cut-data"
    FILES = {"data.json": json.dumps({**state, "weights": {}}).encode()}

    def fake(route):
        import base64
        import hashlib
        req, cors = route.request, {"Access-Control-Allow-Origin": "*"}
        url = req.url.split("?")[0]
        prefix = f"https://api.github.com/repos/{REPO}"
        sha = lambda d: hashlib.sha1(d).hexdigest()  # noqa: E731
        if req.headers.get("authorization") != f"Bearer {TOKEN}":
            return route.fulfill(status=401, json={"message": "Bad credentials"}, headers=cors)
        if url == prefix:
            return route.fulfill(json={"full_name": REPO, "private": True, "permissions": {"push": True}}, headers=cors)
        path = url[len(prefix) + len("/contents/"):]
        if req.method == "GET":
            if path not in FILES:
                return route.fulfill(status=404, json={"message": "Not Found"}, headers=cors)
            if "raw" in (req.headers.get("accept") or ""):
                return route.fulfill(body=FILES[path], headers=cors)
            return route.fulfill(json={"sha": sha(FILES[path]), "content": base64.b64encode(FILES[path]).decode()}, headers=cors)
        if req.method == "PUT":
            body = json.loads(req.post_data)
            if path in FILES and body.get("sha") != sha(FILES[path]):
                return route.fulfill(status=409, json={"message": "sha mismatch"}, headers=cors)
            FILES[path] = base64.b64decode(body["content"])
            return route.fulfill(status=201, json={"content": {"sha": sha(FILES[path])}}, headers=cors)
        return route.fulfill(status=405, headers=cors)

    import base64 as b64
    setup = f"{base}/#/pair/" + b64.b64encode(json.dumps({"r": REPO, "t": TOKEN}).encode()).decode().rstrip("=")
    ctx = b.new_context(viewport={"width": 375, "height": 812})
    ctx.route("https://api.github.com/**", fake)
    safari = ctx.new_page()
    safari.on("pageerror", lambda e: fails.append(f"safari pageerror: {e}"))
    safari.goto(link)
    safari.wait_for_selector(".renpho-connect", timeout=5000)
    txt = safari.inner_text("#view")
    if "got 82.4 kg · 18.2% fat from renpho" not in txt.lower() or "welcome" in txt.lower():
        fails.append(f"safari: connect card wrong or onboarding shown: {txt[:200]!r}")
    safari.fill("#pasteSetup input[name=link]", "https://example.com/nope")
    safari.click("#pasteSetup button")
    if "isn't a setup link" not in safari.inner_text("#pasteMsg"):
        fails.append("safari: bad link not explained")
    safari.fill("#pasteSetup input[name=link]", setup)
    safari.click("#pasteSetup button")
    safari.wait_for_function("() => location.hash === '#/scope' && window.__cut.store.sync.status === 'ok'", timeout=8000)
    safari.wait_for_timeout(2500)  # let the debounced push land
    remote = json.loads(FILES["data.json"])
    rw = remote.get("weights", {}).get(yday) or {}
    if rw.get("kg") != 82.4 or rw.get("source") != "renpho" or not (remote.get("profile") or {}).get("startKg"):
        fails.append(f"safari: weigh-in didn't reach the repo or profile lost: {rw} / {remote.get('profile')}")
    if "82.4" not in safari.inner_text(".hero-num, #view"):
        fails.append("safari: scope doesn't show the weigh-in after connecting")
    ctx.close()
    b.close()
httpd.shutdown()
for f in fails:
    print("FAIL", f)
print(f"renpho: {len(fails)} failures")
sys.exit(1 if fails else 0)
