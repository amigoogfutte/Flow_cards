import asyncio
from datetime import datetime, timezone
CALLBACK_TYPE = object
def callback(f): return f
class Context:
    pass
class State:
    def __init__(self, entity_id, state, attributes=None):
        self.entity_id, self.state, self.attributes = entity_id, state, attributes or {}
        self.last_changed = datetime.now(timezone.utc)
class Event:
    def __init__(self, event_type, data): self.event_type, self.data = event_type, data
class States:
    def __init__(self, hass): self.hass, self._s = hass, {}
    def get(self, e): return self._s.get(e)
    def set(self, e, state, attrs=None):
        old = self._s.get(e); new = State(e, state, attrs); self._s[e] = new
        self.hass.bus.fire("state_changed", {"entity_id": e, "old_state": old, "new_state": new})
class Bus:
    def __init__(self): self.l = {}
    def async_listen(self, t, cb):
        self.l.setdefault(t, []).append(cb)
        return lambda: self.l[t].remove(cb)
    def async_listen_once(self, t, cb):
        def w(ev): rm(); cb(ev)
        rm = self.async_listen(t, w); return rm
    def fire(self, t, data):
        for cb in list(self.l.get(t, [])): cb(Event(t, data))
class Services:
    def __init__(self): self.calls = []; self.fail = set()
    def has_service(self, d, s): return d in ("light", "notify", "persistent_notification")
    async def async_call(self, d, s, data, blocking=False, context=None, target=None):
        await asyncio.sleep(0)
        if (target or {}).get("entity_id") and set(target["entity_id"]) & self.fail:
            raise Exception("Enheden er utilgængelig")
        self.calls.append((f"{d}.{s}", data, target))
class HomeAssistant:
    def __init__(self):
        self.bus = Bus(); self.states = States(self); self.services = Services(); self.is_running = True; self.data = {}
    def async_create_background_task(self, coro, name=None, eager_start=True):
        return asyncio.get_event_loop().create_task(coro)
