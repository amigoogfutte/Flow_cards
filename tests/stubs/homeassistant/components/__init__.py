import types, sys
for n in ("frontend", "panel_custom", "websocket_api", "http"):
    m = types.ModuleType(f"homeassistant.components.{n}"); sys.modules[m.__name__] = m; globals()[n] = m
http.StaticPathConfig = object
_id = lambda *a, **k: (lambda f: f)
websocket_api.websocket_command = _id
websocket_api.require_admin = lambda f: f
websocket_api.async_response = lambda f: f
