class Store:
    def __init__(self, hass, v, key): self.data = None
    async def async_load(self): return self.data
    async def async_save(self, d): self.data = d
    def async_delay_save(self, f, delay): self.data = f()
