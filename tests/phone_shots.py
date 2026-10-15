"""Viewport-sized (not full-page) iPhone screenshots of key phone screens, using the smoke test's saved state."""
import os

from playwright.sync_api import sync_playwright

from serve import serve

OUT = os.path.join(os.path.dirname(__file__), "out")
state = open(os.path.join(OUT, "state.json")).read()
base, httpd = serve()
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    for scheme in ("light", "dark"):
        ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, color_scheme=scheme, has_touch=True, is_mobile=True)
        pg = ctx.new_page()
        pg.goto(base + "/tests/blank.html")
        pg.evaluate("s => localStorage.setItem('cut.state.v1', s)", state)
        pg.goto(base + "/#/")
        pg.wait_for_selector(".the-list")
        pg.wait_for_timeout(400)
        for _ in range(3):
            if pg.locator(".wrap-overlay").count():
                pg.locator(".wrap-overlay").first.click(force=True)
        pg.screenshot(path=f"{OUT}/phone-{scheme}-1-today.png")
        pg.locator(".the-list").scroll_into_view_if_needed()
        pg.evaluate("() => window.scrollBy(0, -70)")
        pg.screenshot(path=f"{OUT}/phone-{scheme}-2-list.png")
        pg.click("#moreBtn")
        pg.wait_for_selector(".more-sheet")
        pg.screenshot(path=f"{OUT}/phone-{scheme}-3-more.png")
        pg.click(".more-sheet a[href='#/office']")
        pg.wait_for_selector("#devices")
        pg.screenshot(path=f"{OUT}/phone-{scheme}-4-settings.png")
        pg.goto(base + "/#/timeline")
        pg.wait_for_selector(".month")
        pg.locator(".day.st-done").first.click()
        pg.wait_for_selector("dialog[open]")
        pg.screenshot(path=f"{OUT}/phone-{scheme}-5-daysheet.png")
        ctx.close()
    b.close()
httpd.shutdown()
print("done")
