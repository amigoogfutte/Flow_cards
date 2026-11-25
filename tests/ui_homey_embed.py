import asyncio, os
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={"width":1300,"height":800}); pg.set_default_timeout(5000)
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("file://" + os.path.dirname(os.path.abspath(__file__)) + "/harness.html"); await pg.wait_for_timeout(300)
        P=lambda s: pg.locator("flow-cards-panel").locator(s)
        await P("[data-action=hy-nav][data-to=insights]").first.click(); await pg.wait_for_timeout(200)
        print("iframe:", await P("iframe").get_attribute("src")); await pg.screenshot(path="/tmp/embed.png")
        await P(".hy-ebar [data-action=embed-back]").click(); print("view:", await pg.evaluate("panel._view"))
        await P("[data-action=hy-nav][data-to=devices]").first.click(); await P("[data-action=hy-nav][data-to=settings]").first.click()
        await P(".hy-ebar [data-action=embed-back]").click(); print("view:", await pg.evaluate("panel._view"))
        print("ERR",errs); await b.close()
asyncio.run(main())
