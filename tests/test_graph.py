import asyncio, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [os.path.join(HERE, "stubs"), os.path.join(HERE, "..", "custom_components")]
from homeassistant.core import HomeAssistant
from flow_cards.engine import FlowManager
from flow_cards.logic import validate_flow, FlowValidationError

N = lambda id, sec, **k: {"id": id, "sec": sec, "x": 0, "y": 0, **k}
E = lambda a, b, port="out": {"from": a, "to": b, "port": port}

async def main():
    hass = HomeAssistant()
    hass.states.set("light.kontor", "off"); hass.states.set("event.knap", "t0", {"event_type": "x"})
    m = FlowManager(hass); await m.async_load()
    svc = lambda: [(c[0], (c[2] or {}).get("entity_id")) for c in hass.services.calls]

    # validation: dangling edges dropped, edge into trigger rejected, bad port rejected
    v = validate_flow({"name": "v", "type": "advanced", "nodes": [N("t", "triggers", kind="manual"), N("a", "actions", kind="log", message="x")],
                       "edges": [E("t", "a"), E("t", "zzz"), E("t", "a")]})
    assert len(v["edges"]) == 1
    for bad in [[E("a", "t")], [E("t", "a", "true")]]:
        try: validate_flow({"name": "v", "type": "advanced", "nodes": v["nodes"], "edges": bad}); raise AssertionError(bad)
        except FlowValidationError: pass

    # graph: knap -> cond(light on?) --true--> A ; --false--> B -> C ; B also -> ALL ; C -> ALL ; ALL -> D
    hass.services.fail.add("light.bad")
    f = await m.async_save_flow({"name": "Graf", "type": "advanced", "nodes": [
        N("t1", "triggers", kind="event_entity", entity_id=["event.knap"]),
        N("t2", "triggers", kind="manual"),
        N("c", "conditions", kind="state", entity_id=["light.kontor"], state=["on"]),
        N("A", "actions", kind="service", service="light.turn_off", entity_id=["light.a"]),
        N("B", "actions", kind="service", service="light.turn_on", entity_id=["light.b"]),
        N("C", "actions", kind="delay", seconds=0.05),
        N("all", "logic", kind="all"),
        N("D", "actions", kind="service", service="light.turn_on", entity_id=["light.d"]),
        N("note", "logic", kind="note", text="hej"),
    ], "edges": [E("t1", "c"), E("c", "A", "true"), E("c", "B", "false"), E("B", "C"), E("B", "all"), E("C", "all"), E("all", "D")]})
    fid = f["id"]
    hass.states.set("event.knap", "t1", {"event_type": "x"}); await asyncio.sleep(0.2)
    r = m.history[fid][0]
    print("run1", r["status"], svc(), [(s["card_id"], s["status"]) for s in r["steps"]])
    assert r["status"] == "success" and svc() == [("light.turn_on", ["light.b"]), ("light.turn_on", ["light.d"])]
    assert [s["card_id"] for s in r["steps"]][0] == "t1"
    # manual run starts only from the manual trigger (t2 has no wires -> nothing happens but success)
    hass.services.calls.clear()
    m.async_fire(fid, {"description": "m"}, manual=True); await asyncio.sleep(0.05)
    assert m.history[fid][0]["status"] == "success" and not svc()
    # manual run from a given node
    hass.states.set("light.kontor", "on")
    m.async_fire(fid, {"node_id": "t1"}, manual=True); await asyncio.sleep(0.05)
    assert svc() == [("light.turn_off", ["light.a"])], svc()

    # error port + error without port + any + stop
    hass.services.calls.clear()
    g = await m.async_save_flow({"name": "Fejl", "type": "advanced", "nodes": [
        N("t", "triggers", kind="manual"),
        N("bad", "actions", kind="service", service="light.turn_on", entity_id=["light.bad"]),
        N("fix", "actions", kind="service", service="light.turn_on", entity_id=["light.fix"]),
        N("bad2", "actions", kind="service", service="light.turn_on", entity_id=["light.bad"]),
        N("any", "logic", kind="any"),
        N("once", "actions", kind="service", service="light.turn_on", entity_id=["light.once"]),
        N("stop", "actions", kind="stop"),
        N("slow", "actions", kind="delay", seconds=0.3),
        N("never", "actions", kind="service", service="light.turn_on", entity_id=["light.never"]),
    ], "edges": [E("t", "bad"), E("bad", "fix", "error"), E("t", "any"), E("fix", "any"), E("any", "once"),
                 E("t", "bad2")]})
    m.async_fire(g["id"], {}, manual=True); await asyncio.sleep(0.1)
    r = m.history[g["id"]][0]; print("run2", r["status"], r["error"], svc())
    assert r["status"] == "error" and "utilgængelig" in r["error"]
    assert sorted(svc()) == [("light.turn_on", ["light.fix"]), ("light.turn_on", ["light.once"])]
    # stop cancels sibling branches
    hass.services.calls.clear()
    h = await m.async_save_flow({"name": "Stop", "type": "advanced", "nodes": [
        N("t", "triggers", kind="manual"), N("slow", "actions", kind="delay", seconds=0.3),
        N("never", "actions", kind="service", service="light.turn_on", entity_id=["light.never"]),
        N("d", "actions", kind="delay", seconds=0.05), N("stop", "actions", kind="stop")],
        "edges": [E("t", "slow"), E("slow", "never"), E("t", "d"), E("d", "stop")]})
    m.async_fire(h["id"], {}, manual=True); await asyncio.sleep(0.5)
    r = m.history[h["id"]][0]; print("run3", r["status"], svc())
    assert r["status"] == "success" and not svc()
    # loop protection
    k = await m.async_save_flow({"name": "Løkke", "type": "advanced", "nodes": [
        N("t", "triggers", kind="manual"), N("a", "actions", kind="log", message="x"), N("b", "actions", kind="log", message="y")],
        "edges": [E("t", "a"), E("a", "b"), E("b", "a")]})
    m.async_fire(k["id"], {}, manual=True); await asyncio.sleep(0.3)
    r = m.history[k["id"]][0]; print("run4", r["status"], r["error"])
    assert r["status"] == "error" and "løkke" in r["error"]
    # restart mode cancels whole graph
    hass.services.calls.clear()
    q = await m.async_save_flow({"name": "Restart", "type": "advanced", "mode": "restart", "nodes": [
        N("t", "triggers", kind="manual"), N("w", "actions", kind="delay", seconds=0.2),
        N("x", "actions", kind="service", service="light.turn_on", entity_id=["light.x"])], "edges": [E("t", "w"), E("w", "x")]})
    m.async_fire(q["id"], {}, manual=True); await asyncio.sleep(0.05); m.async_fire(q["id"], {}, manual=True); await asyncio.sleep(0.3)
    print("run5", [x["status"] for x in m.history[q["id"]]], svc())
    assert [x["status"] for x in m.history[q["id"]]] == ["success", "cancelled"] and svc() == [("light.turn_on", ["light.x"])]
    await m.async_unload(); print("ALL GRAPH TESTS PASSED")
asyncio.run(main())
