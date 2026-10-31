import asyncio
def async_track_state_change_event(hass, entity_ids, cb):
    def f(ev):
        if ev.data["entity_id"] in entity_ids: cb(ev)
    return hass.bus.async_listen("state_changed", f)
def async_call_later(hass, delay, cb):
    h = asyncio.get_event_loop().call_later(delay, cb, None); return h.cancel
def async_track_time_change(hass, cb, **kw): return lambda: None
def async_track_time_interval(hass, cb, td): return lambda: None
def async_track_sunrise(hass, cb, off): return lambda: None
def async_track_sunset(hass, cb, off): return lambda: None
