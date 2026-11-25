import asyncio, os
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={"width":1200,"height":800}); pg.set_default_timeout(5000)
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
        await pg.goto("file://" + os.path.dirname(os.path.abspath(__file__)) + "/harness.html"); await pg.wait_for_timeout(300)
        P=lambda s: pg.locator("flow-cards-panel").locator(s)
        await P(".hy-tile[data-id=f1]").click(); await pg.wait_for_timeout(200)
        await P("[data-action=add-card]").first.click(); await pg.wait_for_timeout(200)
        assert await P(".hpick").count()==1
        await P("[data-action=close-picker]").first.click(); await P("[data-action=back]").first.click()
        await P("[data-action=hy-more]").click(); await P(".hy-menu [data-action=nr-open]").click(); await pg.wait_for_timeout(500)
        print("nr step:", await pg.evaluate("panel._nr && panel._nr.step"))
        await P("[data-action=nr-close]").first.click()
        await P(".hy-tile[data-id=f2] [data-action=run]").click(); await pg.wait_for_timeout(100)
        print("runs:", await pg.evaluate("calls.filter(c=>c.type.endsWith('/run')).length"))
        await P(".hy-ti[data-folder=Gardiner]").hover(); await P(".hy-ti[data-folder=Gardiner] [data-action=delete-folder]").click(); await pg.wait_for_timeout(200)
        print("folders:", await pg.evaluate("panel._folders"), await pg.evaluate("panel._flows.find(f=>f.id==='f3').folder"))
        print("ERR",errs); await b.close()
asyncio.run(main())
