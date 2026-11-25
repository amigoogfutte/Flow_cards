import asyncio
from playwright.async_api import async_playwright
import os; OUT="/tmp/fc_shots/"; os.makedirs(OUT, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={"width":1300,"height":800}); pg.set_default_timeout(5000)
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("dialog", lambda d: asyncio.ensure_future(d.accept("Lys")))
        await pg.goto("file://" + os.path.dirname(os.path.abspath(__file__)) + "/harness.html"); await pg.wait_for_timeout(300)
        P=lambda s: pg.locator("flow-cards-panel").locator(s)
        await pg.screenshot(path=OUT+"list_grid.png")
        await P(".hy-ti[data-folder=Kontor]").hover(); await P(".hy-ti[data-folder=Kontor] [data-action=new-folder]").click(); await pg.wait_for_timeout(200)
        await P(".hy-ti[data-folder=__all]").click()
        await P(".hy-tile[data-id=f1]").click(button="right"); await P(".hy-menu [data-action=m-move]").click(); await P(".hy-menu [data-action=m-moveto][data-folder='Kontor/Lys']").click(); await pg.wait_for_timeout(200)
        assert await pg.evaluate("panel._flows.find(f=>f.id==='f1').folder")=="Kontor/Lys"
        await P(".hy-tile[data-id=f3]").drag_to(P(".hy-ti[data-fdrop=Notifikationer]")); await pg.wait_for_timeout(200)
        assert await pg.evaluate("panel._flows.find(f=>f.id==='f3').folder")=="Notifikationer"
        await P("[data-action=hy-nav][data-to=devices]").first.click(); await pg.screenshot(path=OUT+"devices.png")
        await P(".hy-tile[data-id=d1]").click(); await pg.wait_for_timeout(50)
        assert "toggle" in await pg.evaluate("JSON.stringify(calls.filter(c=>c.type==='call_service'))")
        await P("[data-action=hy-nav][data-to=flows]").first.click(); await P(".hy-tile[data-id=f5]").click(); await pg.wait_for_timeout(400)
        await pg.screenshot(path=OUT+"editor.png")
        await P("[data-action=cv-addmenu]").click(); await pg.screenshot(path=OUT+"addmenu.png")
        await P(".cv-pop [data-action=cv-add][data-sec=triggers]").click(); await pg.wait_for_timeout(200); await pg.screenshot(path=OUT+"picker_home.png")
        await P(".pk[data-zone='floor:f1']").click(); await P(".pk[data-zone='area:kontor']").click(); await pg.wait_for_timeout(100)
        await P(".pk[data-action=pick-source]").first.click(); await pg.wait_for_timeout(300); await pg.screenshot(path=OUT+"picker_dev.png")
        await P(".pk[data-app=time]").click(); await pg.screenshot(path=OUT+"picker_app.png")
        await P("[data-action=pick-def]").first.click(); await pg.wait_for_timeout(100); await pg.screenshot(path=OUT+"picker_cfg.png")
        await P("[data-action=close-picker]").first.click()
        n0=await pg.evaluate("panel._draft.nodes.length")
        await P("[data-action=cv-addmenu]").click(); await P("[data-action=cv-quick][data-def='logic.all']").click(); await pg.wait_for_timeout(100)
        if await P("[data-action=confirm-card]").count(): await P("[data-action=confirm-card]").click()
        n1=await pg.evaluate("panel._draft.nodes.length"); print("nodes",n0,n1); assert n1==n0+1
        await P("[data-action=cv-undo]").click(); assert await pg.evaluate("panel._draft.nodes.length")==n0
        await P("[data-action=cv-redo]").click(); assert await pg.evaluate("panel._draft.nodes.length")==n1
        await P("[data-action=vars]").click(); await pg.screenshot(path=OUT+"vars.png"); await P("[data-action=vars-close]").click()
        await P("[data-action=cv-setmenu]").click(); await pg.screenshot(path=OUT+"setmenu.png")
        await pg.set_viewport_size({"width":400,"height":800}); await pg.evaluate("panel.narrow=true; panel._render()"); await pg.screenshot(path=OUT+"narrow_ed.png")
        print("ERR",errs); await b.close()
asyncio.run(main())
