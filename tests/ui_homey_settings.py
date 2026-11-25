import asyncio, os
from playwright.async_api import async_playwright
H = os.path.dirname(os.path.abspath(__file__))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={"width": 1300, "height": 800}); pg.set_default_timeout(5000)
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("file://" + H + "/harness.html"); await pg.wait_for_timeout(300)
        P = lambda s: pg.locator("flow-cards-panel").locator(s)
        await P("[data-action=hy-nav][data-to=settings]").first.click(); await pg.wait_for_timeout(200)
        assert await P(".hy-embed iframe").get_attribute("src") == "/config/general"
        await P(".st-i[data-page=people]").click(); assert await P(".hy-embed iframe").get_attribute("src") == "/config/person"
        await pg.screenshot(path="/tmp/settings.png")
        # background events must not reload the embedded page
        fr = await P(".hy-embed iframe").element_handle()
        await pg.evaluate("panel._onEvent({event: 'run', flow_id: 'f1', run: {id: 'x', status: 'success', start: new Date().toISOString()}})")
        await pg.wait_for_timeout(100)
        assert await fr.evaluate("(n) => n.isConnected")
        await P(".st-i[data-page=flowcards]").click(); await pg.wait_for_timeout(100)
        assert "Version" in await P(".st-page").inner_text()
        await pg.screenshot(path="/tmp/settings2.png")
        await P(".st-page [data-action=hy-dark]").click(); assert await pg.evaluate("panel._ui().dark")
        print("ERR", errs); assert not errs; await b.close()
asyncio.run(main())
