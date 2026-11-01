"""Restart noise must not start flows."""
import asyncio, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [os.path.join(HERE, "stubs"), os.path.join(HERE, "..", "custom_components")]
from homeassistant.core import HomeAssistant
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
import flow_cards.engine as engine_mod
from flow_cards.engine import FlowManager

FLOWS = [
    {"name": "lys", "triggers": [{"kind": "state", "entity_id": ["light.k"], "to": ["on"]}], "conditions": [],
     "actions": [{"kind": "notify", "service": "persistent_notification", "message": "lys"}]},
    {"name": "watt", "triggers": [{"kind": "numeric", "entity_id": ["sensor.w"], "above": 100}], "conditions": [],
     "actions": [{"kind": "notify", "service": "persistent_notification", "message": "watt"}]},
    {"name": "knap", "triggers": [{"kind": "event_entity", "entity_id": ["event.b"]}], "conditions": [],
     "actions": [{"kind": "notify", "service": "persistent_notification", "message": "knap"}]},
]

async def setup(running):
    hass = HomeAssistant(); hass.is_running = running
    m = FlowManager(hass); await m.async_load()
    ids = [(await m.async_save_flow(dict(f)))["id"] for f in FLOWS]
    return hass, m, ids

def runs(m, ids): return [len(m.history.get(i, [])) for i in ids]

async def main():
    # 1) during startup: entities appear and get restored -> nothing runs
    engine_mod.STARTUP_QUIET_SECONDS = 0.2
    hass, m, ids = await setup(running=False)
    hass.states.set("light.k", "unavailable"); hass.states.set("sensor.w", "unavailable"); hass.states.set("event.b", "unavailable")
    hass.states.set("light.k", "on"); hass.states.set("sensor.w", "500"); hass.states.set("event.b", "t1", {"event_type": "press"})
    hass.bus.fire(EVENT_HOMEASSISTANT_STARTED, {})
    hass.states.set("light.k", "off"); hass.states.set("light.k", "on")      # still settling
    await asyncio.sleep(0.05); assert runs(m, ids) == [0, 0, 0], runs(m, ids)
    await asyncio.sleep(0.25)
    hass.states.set("light.k", "off"); hass.states.set("light.k", "on")      # real change after settling
    await asyncio.sleep(0.05); assert runs(m, ids) == [1, 0, 0], runs(m, ids)

    # 2) HA running: a device dropping out and coming back is not a change
    hass, m, ids = await setup(running=True)
    for e, v in (("light.k", "off"), ("sensor.w", "5"), ("event.b", "t0")): hass.states.set(e, v)
    await asyncio.sleep(0.02)
    for e in ("light.k", "sensor.w", "event.b"): hass.states.set(e, "unavailable")
    hass.states.set("light.k", "off"); hass.states.set("sensor.w", "500"); hass.states.set("event.b", "t0", {"event_type": "press"})
    await asyncio.sleep(0.05); assert runs(m, ids) == [0, 0, 0], runs(m, ids)
    # real ones still work
    hass.states.set("light.k", "on"); hass.states.set("sensor.w", "5"); hass.states.set("sensor.w", "600")
    hass.states.set("event.b", "t9", {"event_type": "press"})
    await asyncio.sleep(0.05); assert runs(m, ids) == [1, 1, 1], runs(m, ids)
    print("restart noise ignored")

def test_restart(): asyncio.run(main())
if __name__ == "__main__": asyncio.run(main())
