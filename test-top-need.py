"""The forced-choice question offers only what they ticked, and nothing else.

Victor, 2026-11-06: a new question that only selects what was chosen, so the answer forces a real
trade-off instead of being a second shopping list.

Drives the real page in a browser, because none of what matters here is visible to a syntax check:
the options are built at runtime from the ticked boxes, the question hides itself when there is
nothing to choose between, and the submit handler has to withhold the application until it is
answered. The outgoing POST is captured by stubbing window.fetch, so the payload is read as the
sheet would receive it rather than inferred from the code.
"""
import http.server, json, socketserver, sys, threading, functools
from playwright.sync_api import sync_playwright

PORT = 8899
URL = f"http://localhost:{PORT}/early-access.html"

NEEDS = ["Managing client information", "Managing bookings", "Gallery delivery"]

# Track.send posts its own event batches to the SAME Apps Script URL, so a captured body is not
# necessarily the application. Lead payloads are the ones carrying status "applied".
STUB = """() => {
  window.__posted = [];
  window.fetch = async (url, opts) => {
    if (opts && opts.body) { try { window.__posted.push(JSON.parse(opts.body)); } catch (e) {} }
    return { ok: true, status: 200, json: async () => ({ ok: true }), text: async () => "{}" };
  };
}"""


def tick(page, value, on=True):
    box = page.locator(f'input[name="needs"][value="{value}"]')
    if box.is_checked() != on:
        box.click()
    page.wait_for_timeout(120)


def state(page):
    return page.evaluate("""() => {
      const g = document.getElementById('top-need-group');
      const opts = Array.from(document.querySelectorAll('input[name="topNeed"]'));
      return {
        hidden: !!g.hidden,
        label: (document.getElementById('top-need-label').textContent || '').trim(),
        options: opts.map(o => o.value),
        checked: (opts.find(o => o.checked) || {}).value || null,
      };
    }""")


def leads(page):
    """Only the application payloads, not Track's event batches."""
    return [x for x in page.evaluate("() => window.__posted || []")
            if x.get("status") == "applied"]


def fill_required(page):
    page.fill('input[name="firstName"]', "Test")
    page.fill('input[name="lastName"]', "Applicant")
    page.fill('input[name="email"]', "test@example.com")
    page.fill('input[name="phoneNumber"]', "+2348031234567")
    page.fill('input[name="businessName"]', "Test Studio")
    page.select_option('select[name="interestLevel"]', label="Very interested")


def main():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=".")
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(("", PORT), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()

    results = []

    def check(case, ok, **extra):
        results.append({"case": case, "ok": bool(ok), **extra})

    with sync_playwright() as pw:
        b = pw.chromium.launch()
        errs = []

        def open_page(w=1280, h=1000):
            p = b.new_page(viewport={"width": w, "height": h})
            p.on("pageerror", lambda e: errs.append(str(e)[:200]))
            p.on("console", lambda m: errs.append(m.text[:200]) if m.type == "error" else None)
            p.goto(URL, wait_until="domcontentloaded")
            p.evaluate(STUB)
            p.wait_for_timeout(300)
            return p

        p = open_page()

        # Nothing ticked: there is no question to ask.
        check("hidden before anything is ticked", state(p)["hidden"] is True, got=state(p))

        # One ticked: still nothing to choose between.
        tick(p, NEEDS[0])
        check("still hidden with one need ticked", state(p)["hidden"] is True, got=state(p))

        # Two ticked: the question appears, offering exactly those two.
        tick(p, NEEDS[1])
        s = state(p)
        check("appears with two, offering exactly those two",
              s["hidden"] is False and s["options"] == NEEDS[:2], got=s)
        check("label counts what they picked", "You picked 2" in s["label"], text=s["label"])

        # Three ticked: the new one joins.
        tick(p, NEEDS[2])
        s = state(p)
        check("a third tick adds a third option", s["options"] == NEEDS, got=s)
        check("label follows the count", "You picked 3" in s["label"], text=s["label"])

        # Nothing outside what they ticked is ever offered.
        all_needs = p.eval_on_selector_all('input[name="needs"]', "els => els.map(e => e.value)")
        check("offers nothing they did not tick",
              set(state(p)["options"]).issubset(set(NEEDS))
              and len(all_needs) > len(NEEDS), offered=state(p)["options"], total_needs=len(all_needs))

        # Pick one, then untick that very need. The option and the answer must both go.
        p.locator('input[name="topNeed"][value="Managing bookings"]').click()
        p.wait_for_timeout(100)
        check("the pick registers", state(p)["checked"] == "Managing bookings", got=state(p))
        tick(p, "Managing bookings", on=False)
        s = state(p)
        check("unticking the chosen need clears the answer",
              "Managing bookings" not in s["options"] and s["checked"] is None, got=s)

        # A pick that is still valid survives a re-render.
        p.locator(f'input[name="topNeed"][value="{NEEDS[0]}"]').click()
        p.wait_for_timeout(100)
        tick(p, "WhatsApp automation")
        s = state(p)
        check("a still-valid pick survives re-render", s["checked"] == NEEDS[0], got=s)

        # Back down to one: hidden again.
        for v in (NEEDS[2], "WhatsApp automation"):
            tick(p, v, on=False)
        check("hides again when only one need is left", state(p)["hidden"] is True, got=state(p))

        # Submitting with a single need: never asked, but the answer is still recorded.
        fill_required(p)
        p.click("#lead-submit")
        p.wait_for_timeout(1200)
        posted = leads(p)
        check("one need submits, sending that need as the answer",
              len(posted) == 1 and posted[0].get("topNeed") == NEEDS[0],
              sent=len(posted),
              topNeed=(posted[0].get("topNeed") if posted else None),
              needs=(posted[0].get("needs") if posted else None))
        p.close()

        # Two or more needs and no pick: the application must be withheld.
        p = open_page()
        fill_required(p)
        tick(p, NEEDS[0]); tick(p, NEEDS[1])
        p.click("#lead-submit")
        p.wait_for_timeout(1000)
        posted = leads(p)
        status = p.inner_text("#lead-status").strip()
        check("unanswered forced choice blocks the submit",
              len(posted) == 0 and "one thing" in status.lower(), posted=len(posted), status=status)

        # Then answering it lets the application through, with the pick attached.
        p.locator(f'input[name="topNeed"][value="{NEEDS[1]}"]').click()
        p.click("#lead-submit")
        p.wait_for_timeout(1400)
        posted = leads(p)
        check("answering it sends the application with the pick",
              len(posted) == 1 and posted[0].get("topNeed") == NEEDS[1]
              and posted[0].get("needs") == ", ".join(NEEDS[:2]),
              sent=len(posted),
              topNeed=(posted[0].get("topNeed") if posted else None),
              needs=(posted[0].get("needs") if posted else None))
        p.close()

        # PHONE. One column, and the options must be reachable and tappable.
        p = b.new_page(viewport={"width": 390, "height": 844}, has_touch=True)
        p.on("pageerror", lambda e: errs.append(str(e)[:200]))
        p.goto(URL, wait_until="domcontentloaded")
        p.evaluate(STUB)
        p.wait_for_timeout(300)
        tick(p, NEEDS[0]); tick(p, NEEDS[1])
        p.locator('#top-need-options label').first.scroll_into_view_if_needed()
        box = p.locator('#top-need-options label').first.bounding_box()
        cols = p.evaluate("() => getComputedStyle(document.getElementById('top-need-options')).gridTemplateColumns")
        p.locator(f'input[name="topNeed"][value="{NEEDS[1]}"]').click()
        check("phone: one column, inside the screen, tappable",
              box["width"] <= 390 - 16 and box["x"] >= 0
              and len(cols.split()) == 1
              and state(p)["checked"] == NEEDS[1],
              option_width=round(box["width"]), x=round(box["x"]), columns=cols,
              checked=state(p)["checked"])
        p.close()

        bad = [e for e in errs if "favicon" not in e.lower() and "404" not in e]
        check("no console or page errors", not bad, errors=bad[:3])
        b.close()

    srv.shutdown()
    print(json.dumps({"results": results}, indent=2))
    fails = [r for r in results if not r["ok"]]
    print(f"\n{len(results) - len(fails)}/{len(results)} passed")
    for f in fails:
        print(f"  FAIL  {f['case']}")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
