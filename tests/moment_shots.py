"""Screenshots of the motion moments after they settle: the 'that's a wrap' overlay and Meals/Programme at desktop."""
import os

from playwright.sync_api import sync_playwright

from serve import serve

OUT = os.path.join(os.path.dirname(__file__), "out")
state = open(os.path.join(OUT, "state.json")).read()
base, httpd = serve()
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    pg = b.new_page(viewport={"width": 1440, "height": 900}, color_scheme="dark")
    pg.goto(base + "/tests/blank.html")
    pg.evaluate("s => localStorage.setItem('cut.state.v1', s)", state)
    pg.goto(base + "/#/")
    pg.wait_for_selector(".hero")
    pg.wait_for_timeout(1600)
    pg.screenshot(path=f"{OUT}/moment-hero.png")
    pg.evaluate("() => import('/js/ui.js?v=5').then(m => m.celebrate('Perfect day', 'Training, water, guitar, reading, journal. Every box ticked.'))")
    pg.wait_for_timeout(1400)
    pg.screenshot(path=f"{OUT}/moment-wrap.png")
    pg.keyboard.press("Escape")
    for name in ("craft", "program", "timeline", "scope"):
        pg.goto(f"{base}/#/{name}")
        pg.wait_for_timeout(1200)
        pg.screenshot(path=f"{OUT}/moment-{name}.png")
    b.close()
httpd.shutdown()
print("done")
