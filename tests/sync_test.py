"""Multi-device sync test. By default it runs against an in-memory fake of the GitHub contents API
(same sha/409 behaviour), so it never touches your real data. To hit a real *throwaway* repo instead:
CUT_REAL=1 CUT_TOKEN=… CUT_REPO=owner/scratch-repo (never point it at the-cut-data).

Device A: onboards, logs a weigh-in, a photo and 2 L of water, then connects from Settings.
Device B: a fresh laptop. Connects from the first-run screen ("Already using The Cut?"), so it must
          skip onboarding and show A's data; then ticks guitar on the same day.
Device C: a fresh phone (375px). Opens A's setup link (#/pair/…).
Finally everyone must agree: A's weight + photo, and BOTH the water (A) and guitar (B) ticks for today.
Leaves data.json/photos in the repo; the caller cleans up.
"""
import os
import struct
import sys
import zlib
from datetime import date

from playwright.sync_api import sync_playwright

from serve import serve

REAL = os.environ.get("CUT_REAL") == "1"
TOKEN = os.environ["CUT_TOKEN"] if REAL else "github_pat_FAKE_TEST_TOKEN"
REPO = os.environ["CUT_REPO"] if REAL else "tester/fake-cut-data"
if REAL and REPO.endswith("/the-cut-data"):
    sys.exit("Refusing to run against the real data repo.")
TODAY = date.today().isoformat()
base, httpd = serve()
fails = []

# ---------- fake GitHub contents API ----------
FILES = {}  # path -> bytes
writes = {"n": 0, "conflicts": 0}


def sha(data):
    import hashlib
    return hashlib.sha1(data).hexdigest()


def fake_github(route):
    import base64
    import json as js
    req = route.request
    url = req.url.split("?")[0]
    prefix = f"https://api.github.com/repos/{REPO}"
    if req.headers.get("authorization") != f"Bearer {TOKEN}":
        return route.fulfill(status=401, json={"message": "Bad credentials"}, headers={"Access-Control-Allow-Origin": "*"})
    cors = {"Access-Control-Allow-Origin": "*"}
    if url == prefix:
        return route.fulfill(json={"full_name": REPO, "private": True, "permissions": {"push": True}}, headers=cors)
    path = url[len(prefix) + len("/contents/"):]
    from urllib.parse import unquote
    path = unquote(path)
    if req.method == "GET":
        if path not in FILES:
            return route.fulfill(status=404, json={"message": "Not Found"}, headers=cors)
        if "raw" in (req.headers.get("accept") or ""):
            return route.fulfill(body=FILES[path], headers=cors)
        return route.fulfill(json={"sha": sha(FILES[path]), "content": base64.b64encode(FILES[path]).decode()}, headers=cors)
    if req.method == "PUT":
        body = js.loads(req.post_data)
        if path in FILES and body.get("sha") != sha(FILES[path]):
            writes["conflicts"] += 1
            return route.fulfill(status=409, json={"message": "sha mismatch"}, headers=cors)
        if path not in FILES and body.get("sha") and not path.startswith("photos/"):
            return route.fulfill(status=422, json={"message": "sha given for new file"}, headers=cors)
        FILES[path] = base64.b64decode(body["content"])
        writes["n"] += 1
        return route.fulfill(status=201, json={"content": {"sha": sha(FILES[path])}}, headers=cors)
    return route.fulfill(status=405, headers=cors)


def new_context(browser, **kw):
    ctx = browser.new_context(**kw)
    if not REAL:
        ctx.route("https://api.github.com/**", fake_github)
    return ctx


def check(cond, msg):
    print(("ok   " if cond else "FAIL ") + msg)
    if not cond:
        fails.append(msg)


def png(w=200, h=260):
    raw = b"".join(b"\x00" + bytes((30, 160, 90)) * w for _ in range(h))
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


def close_overlays(page):
    for _ in range(3):
        if page.locator(".wrap-overlay").count():
            page.locator(".wrap-overlay").first.click(force=True)


def wait_synced(page):
    page.wait_for_function("() => window.__cut.store.sync.status === 'ok'", timeout=30000)


def state(page):
    return page.evaluate("() => window.__cut.store.state")


with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")

    # ---- device A ----
    a = new_context(b).new_page()
    a.on("pageerror", lambda e: fails.append(f"A pageerror {e}"))
    a.goto(base + "/")
    a.wait_for_selector("#cast")
    a.fill("#cast input[name=kg]", "96.8")
    a.check("input[name=sex][value=male]")
    a.click("#cast button[type=submit]")
    a.wait_for_timeout(300)
    close_overlays(a)
    a.locator("[data-water='2000']").click()
    a.goto(base + "/#/rushes")
    a.click("#addPhoto")
    a.set_input_files("#pform input[type=file]", files=[{"name": "f.png", "mimeType": "image/png", "buffer": png()}])
    a.click("#pform button[type=submit]")
    a.wait_for_timeout(800)
    close_overlays(a)
    a.goto(base + "/#/office")
    a.locator("#devices details summary").first.click()
    a.fill("#connectForm input[name=token]", TOKEN)
    a.fill("#connectForm input[name=repo]", REPO) if a.locator("#connectForm input[name=repo]").is_visible() else None
    a.evaluate(f"() => document.querySelector('#connectForm input[name=repo]').value = {REPO!r}")
    a.click("#connectForm button.primary")
    a.wait_for_function("() => document.querySelector('#copyLink') || /[a-z]/i.test(document.querySelector('#connectMsg')?.textContent.replace('Connecting…', '') || '')", timeout=30000)
    print("A connect:", a.locator("#connectMsg").first.inner_text() if a.locator("#connectMsg").count() else "(card redrawn)")
    a.wait_for_selector("#copyLink", timeout=5000)
    wait_synced(a)
    check(all(ph.get("uploaded") for ph in state(a)["photos"].values()), "A: photo uploaded")
    link = a.evaluate("() => navigator.clipboard ? null : null") or a.evaluate("() => import('/js/store.js?v=3').then(m => m.pairLink())")
    check("#/pair/" in link, "A: setup link generated")
    a.click("#showQr")
    a.wait_for_selector("#qr svg", timeout=15000)
    check(True, "A: QR code rendered")

    # ---- device B: fresh laptop, connects from the first-run screen ----
    bp = new_context(b).new_page()
    bp.on("pageerror", lambda e: fails.append(f"B pageerror {e}"))
    bp.goto(base + "/")
    bp.wait_for_selector(".join #connectForm")
    bp.fill(".join input[name=token]", TOKEN)
    bp.evaluate(f"() => document.querySelector('.join input[name=repo]').value = {REPO!r}")
    bp.click(".join button.primary")
    bp.wait_for_selector(".titlecard .greet", timeout=30000)
    bp.wait_for_selector(".the-list", timeout=30000)
    check(bp.locator("#cast").count() == 0, "B: skipped onboarding after connecting")
    sb = state(bp)
    check(sb["weights"].get(TODAY, {}).get("kg") == 96.8, "B: sees A's weigh-in")
    check(sb["checks"].get(TODAY, {}).get("water") == 2000, "B: sees A's water")
    bp.locator("[data-toggle='guitar']").click()
    bp.wait_for_timeout(2500)  # debounce + push
    wait_synced(bp)

    # ---- device C: phone, opens the setup link ----
    cctx = new_context(b, viewport={"width": 375, "height": 800})
    c = cctx.new_page()
    c.on("pageerror", lambda e: fails.append(f"C pageerror {e}"))
    c.goto(link.replace("https://tomkeogh98.github.io/the-cut/", base + "/").replace(base.replace("127.0.0.1", "localhost"), base))
    c.wait_for_selector(".the-list", timeout=30000)
    check("#/pair/" not in c.url, "C: token removed from the address bar")
    wait_synced(c)
    sc = state(c)
    chk = sc["checks"].get(TODAY, {})
    check(chk.get("water") == 2000 and chk.get("guitar") is True, f"C: has A's water AND B's guitar ({chk.get('water')}, {chk.get('guitar')})")
    c.goto(base + "/#/rushes")
    c.wait_for_selector(".frame img[src^='blob:']", timeout=20000)
    check(True, "C: photo downloaded from the repo")
    c.locator("#moreBtn").click()
    c.wait_for_selector(".more-sheet")
    c.click(".more-sheet a[href='#/craft']")
    c.wait_for_selector(".macro-board")
    check(True, "C: bottom-tab More menu works")

    # ---- back on A: pulls B's guitar tick ----
    a.goto(base + "/#/")
    a.evaluate("() => import('/js/store.js?v=3').then(m => m.syncNow())")
    wait_synced(a)
    check(state(a)["checks"].get(TODAY, {}).get("guitar") is True, "A: picked up B's guitar tick")

    # ---- device D: already onboarded on its own (different start weight), then connects ----
    d = new_context(b).new_page()
    d.goto(base + "/")
    d.wait_for_selector("#cast")
    d.fill("#cast input[name=kg]", "99.0")
    d.check("input[name=sex][value=male]")
    d.click("#cast button[type=submit]")
    d.wait_for_timeout(300)
    close_overlays(d)
    d.goto(link.replace("https://tomkeogh98.github.io/the-cut/", base + "/"))
    d.wait_for_selector(".the-list", timeout=30000)
    wait_synced(d)
    sd = state(d)
    check(sd["profile"]["startKg"] == 96.8, f"D: adopted the shared profile (startKg {sd['profile']['startKg']})")
    check(sd["checks"].get(TODAY, {}).get("guitar") is True, "D: sees today's shared ticks")
    b.close()
httpd.shutdown()
print("FAILURES:" if fails else "ALL GOOD", *fails, sep="\n - " if fails else "")
sys.exit(1 if fails else 0)
