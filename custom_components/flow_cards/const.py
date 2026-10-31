"""Constants for Flow Cards."""

DOMAIN = "flow_cards"
VERSION = "0.2.0"

STORAGE_VERSION = 1
STORAGE_KEY_FLOWS = f"{DOMAIN}.flows"
STORAGE_KEY_HISTORY = f"{DOMAIN}.history"

PANEL_URL_PATH = "flows"
PANEL_TITLE = "Flows"
PANEL_ICON = "mdi:graph-outline"
PANEL_ELEMENT = "flow-cards-panel"
STATIC_URL = "/flow_cards_static"

HISTORY_PER_FLOW = 30
MAX_STEPS_PER_RUN = 200
MAX_FLOW_DEPTH = 5  # how deep "run another flow" may nest

MODES = ("single", "restart", "parallel")
