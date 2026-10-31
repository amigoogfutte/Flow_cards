import asyncio, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [os.path.join(HERE, "stubs"), os.path.join(HERE, "..", "custom_components")]
from homeassistant.core import HomeAssistant
from flow_cards.engine import FlowManager

async def main():
    hass = HomeAssistant()
    hass.states.set("sensor.bat", "50")
    m = FlowManager(hass); await m.async_load()
    act = [{"kind": "service", "service": "light.turn_on", "entity_id": ["light.x"]}]
    # numeric below 30 for 0.2 s; values wobbling inside the range must NOT cancel the timer
    f = await m.async_save_flow({"name": "Batteri", "triggers": [{"kind": "numeric", "entity_id": ["sensor.bat"], "below": 30, "for": 0.2}], "actions": act})
    hass.states.set("sensor.bat", "25"); await asyncio.sleep(0.05); hass.states.set("sensor.bat", "24"); await asyncio.sleep(0.25)
    assert len(m.history.get(f["id"], [])) == 1, m.history
    hass.states.set("sensor.bat", "60"); hass.states.set("sensor.bat", "20"); await asyncio.sleep(0.05); hass.states.set("sensor.bat", "40"); await asyncio.sleep(0.25)
    assert len(m.history[f["id"]]) == 1, "leaving the range cancels"
    print("numeric for OK")
    # device trigger
    g = await m.async_save_flow({"name": "Puk", "triggers": [{"kind": "device", "label": "Ikea puk: toggle", "config": {"platform": "device", "domain": "mqtt", "device_id": "puk", "type": "action", "subtype": "toggle", "metadata": {}}}], "actions": act})
    await asyncio.sleep(0.01)
    hass.bus.fire("fake_device", {"device_id": "puk", "subtype": "on"}); hass.bus.fire("fake_device", {"device_id": "puk", "subtype": "toggle"}); await asyncio.sleep(0.05)
    runs = m.history[g["id"]]; assert len(runs) == 1 and runs[0]["trigger"] == "Ikea puk: toggle" and runs[0]["status"] == "success", runs
    await m.async_set_enabled(g["id"], False); hass.bus.fire("fake_device", {"device_id": "puk", "subtype": "toggle"}); await asyncio.sleep(0.05)
    assert len(m.history[g["id"]]) == 1, "disabled flow must not fire"
    h = await m.async_save_flow({"name": "Dårlig", "triggers": [{"kind": "device", "config": {"domain": "mqtt", "device_id": "bad"}}], "actions": act})
    await asyncio.sleep(0.01)
    assert "kunne ikke aktiveres" in (m.flow_status(h["id"])["arm_error"] or ""), m.flow_status(h["id"])
    print("device trigger OK")
    await m.async_unload(); print("ALL NEW TRIGGER TESTS PASSED")
asyncio.run(main())
