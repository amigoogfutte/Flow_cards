import asyncio, os
from playwright.async_api import async_playwright
H = os.path.dirname(os.path.abspath(__file__))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={"width": 1300, "height": 800}); pg.set_default_timeout(5000)
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("file://" + H + "/harness.html"); await pg.evaluate("localStorage.clear()"); await pg.reload(); await pg.wait_for_timeout(300)
        P = lambda s: pg.locator("flow-cards-panel").locator(s)
        await P("[data-action=hy-nav][data-to=insights]").first.click(); await pg.wait_for_timeout(200)
        await pg.screenshot(path="/tmp/ins_empty.png")
        await P(".ins-i[data-eid='sensor.kontor_temperatur']").click(); await pg.wait_for_timeout(300)
        assert await P(".ins-svg path").count() >= 1
        await P(".ins-i[data-eid='binary_sensor.loft_sensor_kontor']").drag_to(P(".ins-card").first); await pg.wait_for_timeout(300)
        n = await pg.evaluate("panel._ins.charts[0].series.length"); print("series in chart:", n); assert n == 2
        await P(".ins-i[data-eid='light.kontor']").drag_to(P(".ins-dropzone")); await pg.wait_for_timeout(300)
        assert await pg.evaluate("panel._ins.charts.length") == 2
        await P("[data-action=ins-range-open]").click(); await P("[data-action=ins-range][data-range='24h']").click(); await pg.wait_for_timeout(300)
        box = await P(".ins-svg").first.bounding_box(); await pg.mouse.move(box["x"] + box["width"] * 0.6, box["y"] + 60); await pg.wait_for_timeout(100)
        print("tip:", (await P(".ins-tip").first.inner_text()).replace("\n", " | "))
        await pg.screenshot(path="/tmp/ins.png")
        await P("[data-action=ins-range-open]").click(); await P("[data-action=ins-range][data-range='yesterday']").click(); await pg.wait_for_timeout(300)
        await P("[data-action=ins-target]").first.click(); await P(".ins-i[data-eid='sensor.vaskemaskine_power']").click(); await pg.wait_for_timeout(300)
        assert await pg.evaluate("panel._ins.charts[0].series.length") == 3
        await P(".ins-i[data-eid='light.kontor']").click(); assert await pg.evaluate("panel._ins.charts.length") == 1
        await pg.screenshot(path="/tmp/ins2.png")
        await P("[data-action=ins-close-all]").click(); assert await pg.evaluate("panel._ins.charts.length") == 0
        print("ERR", errs); assert not errs; await b.close()
asyncio.run(main())
