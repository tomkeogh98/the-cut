"""Finds which elements stick out past the viewport on a page (debug helper)."""
import sys

from playwright.sync_api import sync_playwright

from serve import serve

route = sys.argv[1] if len(sys.argv) > 1 else ""
width = int(sys.argv[2]) if len(sys.argv) > 2 else 1024
state = open(sys.argv[3]).read() if len(sys.argv) > 3 else None
base, httpd = serve()
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    pg = b.new_page(viewport={"width": width, "height": 900})
    pg.on("console", lambda m: print("console", m.type, m.text, m.location.get("url")) if m.type == "error" else None)
    pg.goto(base + "/tests/blank.html")
    if state:
        pg.evaluate("s => localStorage.setItem('cut.state.v1', s)", state)
    pg.goto(f"{base}/#/{route}")
    pg.wait_for_timeout(600)
    print(pg.evaluate("""() => {
      const W = window.innerWidth, out = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.right > W + 1 && r.width) out.push(`${el.tagName.toLowerCase()}.${el.className} right=${Math.round(r.right)} w=${Math.round(r.width)}`);
      }
      return [document.documentElement.scrollWidth, W, out.slice(0, 15)];
    }"""))
    b.close()
httpd.shutdown()
