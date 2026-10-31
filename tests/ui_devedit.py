import asyncio, json
from playwright.async_api import async_playwright
OUT = "/tmp/claude-0/-home-claude/d59b04c3-c8a7-582a-98af-82177a99dd32/scratchpad/shots/"
ON = {"platform":"device","domain":"mqtt","device_id":"d8","type":"action","subtype":"on","metadata":{}}
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={"width": 1200, "height": 850}); pg.set_default_timeout(5000)
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("file:///home/claude/flow_cards_repo/tests/harness.html"); await pg.wait_for_timeout(300)
        P = lambda s: pg.locator("flow-cards-panel").locator(s)
        await P("[data-action=new]").first.click(); await P("[data-action=new-advanced]").click(); await pg.wait_for_timeout(100)
        await P("[data-action=listen]").first.click(); await pg.wait_for_timeout(400)
        await pg.evaluate(f"(HAEV['trigger|' + JSON.stringify({json.dumps(ON)})] || []).forEach((cb) => cb({{variables: {{}}}}))"); await pg.wait_for_timeout(200)
        await P("[data-action=listen-use][data-i='0']").click(); await pg.wait_for_timeout(150)
        await P("[data-action=listen]").first.click(); await pg.wait_for_timeout(100)
        nid = await pg.evaluate("panel._draft.nodes[0].id")
        await pg.evaluate(f"panel._openPicker('triggers', undefined, '{nid}')"); await pg.wait_for_timeout(300)
        txt = await P(".def.cur").inner_text(); print("current:", txt); assert "Tænd" in txt and "valgt nu" in txt
        await pg.screenshot(path=OUT+"de1.png")
        await P("[data-action=pick-devtrig]", ).filter(has_text="Sluk").click(); await pg.wait_for_timeout(150)
        n = await pg.evaluate("JSON.stringify(panel._draft.nodes.map(n=>({id:n.id,sub:n.config.subtype,label:n.label})))"); print(n)
        n = json.loads(n); assert len(n) == 1 and n[0]["id"] == nid and n[0]["sub"] == "off" and "Sluk" in n[0]["label"]
        # standard flow
        await pg.evaluate(f"panel._draft = {{name:'s', type:'standard', triggers:[{{id:'t1', card:'dev.trigger', kind:'device', label:'x', config:{json.dumps(ON)}, args:{{label:'x', config:{json.dumps(ON)}}}}}], conditions:[], actions:[]}}; panel._render()")
        await pg.evaluate("panel._openPicker('triggers', 0)"); await pg.wait_for_timeout(300)
        await P("[data-action=pick-devtrig]").filter(has_text="Lysstyrke").click(); await pg.wait_for_timeout(150)
        t = await pg.evaluate("JSON.stringify(panel._draft.triggers.map(n=>({id:n.id,sub:n.config.subtype})))"); print(t)
        t = json.loads(t); assert len(t) == 1 and t[0]["id"] == "t1" and t[0]["sub"] == "brightness_move_up"
        print("ERR", errs); await b.close()
asyncio.run(main())
