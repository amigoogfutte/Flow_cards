"""Test stub: device triggers fire on a bus event 'fake_device' with matching device_id/subtype."""
async def async_validate_trigger_config(hass, configs):
    for c in configs:
        if c.get("device_id") == "bad":
            raise ValueError("ukendt enhed")
    return configs

async def async_initialize_triggers(hass, configs, action, domain, name, log_cb, *a, **kw):
    removers = []
    for c in configs:
        def _ev(ev, c=c):
            if ev.data.get("device_id") == c["device_id"] and ev.data.get("subtype") == c.get("subtype"):
                hass.async_create_background_task(action({"trigger": {"platform": "device", **ev.data}}, None))
        removers.append(hass.bus.async_listen("fake_device", _ev))
    def _remove():
        for r in removers:
            r()
    return _remove
