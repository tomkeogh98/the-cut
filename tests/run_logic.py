"""Runs tests/logic.mjs (pure-logic checks) inside headless Chrome and prints its console output."""
import sys

from playwright.sync_api import sync_playwright

from serve import serve

base, httpd = serve()
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    page = b.new_page()
    errors = []
    page.on("console", lambda m: print(m.text))
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(base + "/tests/blank.html")
    try:
        page.evaluate("() => import('/tests/logic.mjs')")
    except Exception as e:  # noqa: BLE001
        errors.append(str(e))
    b.close()
httpd.shutdown()
if errors:
    print("ERRORS:", *errors, sep="\n")
    sys.exit(1)
