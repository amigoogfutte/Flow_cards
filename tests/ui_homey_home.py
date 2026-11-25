import asyncio, os
from playwright.async_api import async_playwright
H = os.path.dirname(os.path.abspath(__file__))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={"width": 1300, "height": 800}); pg.set_default_timeout(5000)
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("file://" + H + "/harness.html"); await pg.evaluate("localStorage.clear()"); await pg.reload(); await pg.wait_for_timeout(300)
        P = lambda s: pg.locator("flow-cards-panel").locator(s)
        await P(".hy-tile[data-id=f1]").click(button="right"); await P(".hy-menu [data-action=fav-flow]").click()
        await P("[data-action=hy-nav][data-to=devices]").first.click(); await P(".hy-tile[data-id=d1]").click(button="right"); await P(".hy-menu [data-action=fav-dev]").click()
        await P("[data-action=hy-nav][data-to=home]").first.click(); await pg.wait_for_timeout(200)
        txt = await P(".hm").inner_text(); print(txt.replace("\n", " | ")[:200])
        assert "Overskyet" in txt and await P(".hm .hy-tile").count() == 2 and await P(".hm-p").count() == 2
        await pg.screenshot(path="/tmp/home.png")
        await P(".hm .hy-tile[data-id=f1] [data-action=run]").click(); await pg.wait_for_timeout(100)
        assert await pg.evaluate("calls.filter(c=>c.type.endsWith('/run')).length") == 1
        print("ERR", errs); assert not errs; await b.close()
asyncio.run(main())
