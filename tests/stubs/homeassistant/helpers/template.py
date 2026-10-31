class Template:
    def __init__(self, t, hass): self.t = t
    def async_render(self, variables=None, parse_result=True):
        return self.t.replace("{{ trigger.description }}", variables["trigger"].get("description", ""))
def result_as_boolean(v): return str(v).lower() in ("true", "1", "yes", "on")
