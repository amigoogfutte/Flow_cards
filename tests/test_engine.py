import asyncio, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [os.path.join(HERE, "stubs"), os.path.join(HERE, "..", "custom_components")]
from homeassistant.core import HomeAssistant
from flow_cards.engine import FlowManager

async def main():
    hass = HomeAssistant()
    hass.states.set("light.kontor", "off"); hass.states.set("binary_sensor.pir", "off")
    hass.states.set("event.knap", "t0", {"event_type": "initial_press"})
    m = FlowManager(hass); await m.async_load()
    events = []; m.async_subscribe(events.append)
    f = await m.async_save_flow({"name": "Knap", "mode": "restart",
        "triggers": [{"kind": "event_entity", "entity_id": ["event.knap"], "event_type": ["short_release"]}],
        "conditions": [{"kind": "state", "entity_id": ["light.kontor"], "state": ["on"], "invert": True}],
        "actions": [{"kind": "service", "service": "light.turn_on", "entity_id": ["light.kontor"], "data": {"brightness_pct": 10}},
                    {"kind": "delay", "seconds": 0.2},
                    {"kind": "service", "service": "light.turn_off", "entity_id": ["light.kontor"]}],
        "else_actions": [{"kind": "notify", "service": "persistent_notification", "message": "Else: {{ trigger.description }}"}]})
    fid = f["id"]
    hass.states.set("event.knap", "t1", {"event_type": "initial_press"})   # wrong type -> no run
    await asyncio.sleep(0.05); assert not m.history.get(fid), m.history
    hass.states.set("event.knap", "t2", {"event_type": "short_release"})   # run (then)
    await asyncio.sleep(0.05)
    hass.states.set("event.knap", "t3", {"event_type": "short_release"})   # restart cancels first
    await asyncio.sleep(0.4)
    runs = m.history[fid]
    print([(r["status"], r["branch"]) for r in runs])
    assert runs[0]["status"] == "success" and runs[1]["status"] == "cancelled"
    assert [c[0] for c in hass.services.calls] == ["light.turn_on", "light.turn_on", "light.turn_off"], hass.services.calls
    # else branch
    hass.states.set("light.kontor", "on"); hass.services.calls.clear()
    hass.states.set("event.knap", "t4", {"event_type": "short_release"}); await asyncio.sleep(0.05)
    assert m.history[fid][0]["branch"] == "else" and hass.services.calls[0][0] == "persistent_notification.create", hass.services.calls
    print("else msg:", hass.services.calls[0][1])
    # error recorded + for-duration + single mode skip
    hass.services.fail.add("light.bad")
    g = await m.async_save_flow({"name": "PIR", "triggers": [{"kind": "state", "entity_id": ["binary_sensor.pir"], "to": "off", "for": 0.15}],
        "actions": [{"kind": "service", "service": "light.turn_off", "entity_id": ["light.bad"]}, {"kind": "delay", "seconds": 0.3}]})
    hass.states.set("binary_sensor.pir", "on"); hass.states.set("binary_sensor.pir", "off")
    await asyncio.sleep(0.05); hass.states.set("binary_sensor.pir", "on")   # cancels pending 'for'
    await asyncio.sleep(0.2); assert not m.history.get(g["id"])
    hass.states.set("binary_sensor.pir", "off"); await asyncio.sleep(0.25)
    r = m.history[g["id"]][0]; print("pir:", r["status"], r["error"], r["trigger"])
    assert r["status"] == "error" and "utilgængelig" in r["error"]
    st = m.flow_status(g["id"]); assert st["last_error"]
    # manual run, single mode skip, disable
    h = await m.async_save_flow({"name": "Lang", "actions": [{"kind": "delay", "seconds": 0.2}]})
    m.async_fire(h["id"], {"description": "a"}, manual=True); m.async_fire(h["id"], {"description": "b"}, manual=True)
    await asyncio.sleep(0.3); print("single:", [x["status"] for x in m.history[h["id"]]])
    assert [x["status"] for x in m.history[h["id"]]] == ["skipped", "success"]
    await m.async_set_enabled(fid, False); n = len(m.history[fid])
    hass.states.set("event.knap", "t5", {"event_type": "short_release"}); await asyncio.sleep(0.05)
    assert len(m.history[fid]) == n
    # flow_run chain + stop
    k = await m.async_save_flow({"name": "Kæde", "actions": [{"kind": "flow_run", "flow_id": h["id"]}, {"kind": "stop"}, {"kind": "log", "message": "aldrig"}]})
    m.async_fire(k["id"], {}, manual=True); await asyncio.sleep(0.3)
    assert m.history[k["id"]][0]["status"] == "success" and len(m.history[k["id"]][0]["steps"]) == 2
    assert m.history[h["id"]][0]["trigger"].startswith("Startet af")
    await m.async_delete_flow(k["id"]); await m.async_unload()
    print("events sent:", len(events)); print("ALL ENGINE TESTS PASSED")
asyncio.run(main())
