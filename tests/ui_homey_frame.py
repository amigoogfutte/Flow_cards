import asyncio, os
from playwright.async_api import async_playwright
H = os.path.dirname(os.path.abspath(__file__))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--allow-file-access-from-files"]); pg = await b.new_page(viewport={"width": 1200, "height": 700}); pg.set_default_timeout(5000)
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("file://" + H + "/harness.html"); await pg.wait_for_timeout(300)
        await pg.evaluate("panel._embed = {path: 'fake_ha.html', id: 'insights', back: 'list'}; panel._view = 'embed'; panel._render()")
        await pg.wait_for_timeout(2500)
        r = await pg.evaluate("""(() => { const fr = panel.shadowRoot.querySelector('.hy-embed iframe'); const m = fr.contentDocument.querySelector('home-assistant').shadowRoot.querySelector('home-assistant-main').shadowRoot;
          const d = m.querySelector('ha-drawer').shadowRoot.querySelector('.mdc-drawer');
          return {drawer: getComputedStyle(d).display, sidebar: getComputedStyle(m.querySelector('ha-sidebar')).display, menu: m.querySelector('ha-menu-button').style.display, ready: fr.classList.contains('ready')}; })()""")
        print(r); assert r["drawer"] == "none" and r["sidebar"] == "none" and r["menu"] == "none" and r["ready"]
        await pg.screenshot(path="/tmp/frame.png")
        print("ERR", errs); await b.close()
asyncio.run(main())
