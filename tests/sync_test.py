"""Two-device sync test against the real private data repo. Needs CUT_TOKEN (a token with access to the repo).

Device A onboards, logs a weigh-in + photo, syncs. Device B (fresh browser) connects and must see both.
Leaves data.json/photos in the repo; the caller cleans up.
"""
import os
import struct
import sys
import zlib

from playwright.sync_api import sync_playwright

from serve import serve

TOKEN = os.environ["CUT_TOKEN"]
REPO = os.environ.get("CUT_REPO", "tomkeogh98/the-cut-data")
base, httpd = serve()


def png(w=200, h=260):
    raw = b"".join(b"\x00" + bytes((30, 160, 90)) * w for _ in range(h))
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


def connect(page):
    page.goto(base + "/#/office")
    page.wait_for_selector("#syncForm")
    page.fill("#syncForm input[name=repo]", REPO)
    page.fill("#syncForm input[name=token]", TOKEN)
    page.click("#syncForm button.primary")
    page.wait_for_function("() => /Synced|rejected|not found|public|offline|reach/i.test(document.querySelector('#syncMsg')?.textContent || '')", timeout=30000)
    return page.inner_text("#syncMsg")


with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    a = b.new_context().new_page()
    a.goto(base + "/")
    a.wait_for_selector("#cast")
    a.fill("input[name=kg]", "96.8")
    a.check("input[name=sex][value=male]")
    a.click("#cast button[type=submit]")
    a.wait_for_selector(".wrap-overlay")
    a.locator(".wrap-overlay").click(force=True)
    a.goto(base + "/#/rushes")
    a.click("#addPhoto")
    a.set_input_files("#pform input[type=file]", files=[{"name": "f.png", "mimeType": "image/png", "buffer": png()}])
    a.click("#pform button[type=submit]")
    a.wait_for_timeout(800)
    if a.locator(".wrap-overlay").count():
        a.locator(".wrap-overlay").click(force=True)
    msg = connect(a)
    print("device A:", msg)
    a.wait_for_function("() => window.__cut.store.sync.status === 'ok'", timeout=30000)
    uploaded = a.evaluate("() => Object.values(window.__cut.store.state.photos).every(p => p.uploaded)")
    print("photo uploaded:", uploaded)

    bctx = b.new_context()
    bp = bctx.new_page()
    msg = connect(bp)
    print("device B:", msg)
    bp.goto(base + "/#/scope")
    bp.wait_for_selector(".hero-num")
    big = bp.inner_text(".hero-num .big")
    print("device B weight:", big.replace("\n", " "))
    bp.goto(base + "/#/rushes")
    bp.wait_for_selector(".frame img[src^='blob:']", timeout=20000)
    print("device B photo loaded from repo")
    ok = "96.8" in big and uploaded
    b.close()
httpd.shutdown()
sys.exit(0 if ok else 1)
