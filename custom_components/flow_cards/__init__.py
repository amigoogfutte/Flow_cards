"""Flow Cards: Homey-style WHEN / AND / THEN flows for Home Assistant."""

from __future__ import annotations

from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import issue_registry as ir

from . import websocket
from .const import (
    DOMAIN,
    PANEL_ELEMENT,
    PANEL_ICON,
    PANEL_TITLE,
    PANEL_URL_PATH,
    STATIC_URL,
    VERSION,
)
from .engine import FlowManager

PLATFORMS = ["update"]


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    domain_data = hass.data.setdefault(DOMAIN, {})

    # a fresh start means any pending restart is done
    ir.async_delete_issue(hass, DOMAIN, "restart_required")

    manager = FlowManager(hass)
    await manager.async_load()
    domain_data["manager"] = manager

    if not domain_data.get("registered"):
        # static paths and websocket commands cannot be unregistered, so only once
        await hass.http.async_register_static_paths(
            [StaticPathConfig(STATIC_URL, str(Path(__file__).parent / "frontend"), False)]
        )
        websocket.async_register(hass)
        domain_data["registered"] = True

    await panel_custom.async_register_panel(
        hass,
        webcomponent_name=PANEL_ELEMENT,
        frontend_url_path=PANEL_URL_PATH,
        module_url=f"{STATIC_URL}/flow-cards-panel.js?v={VERSION}",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        require_admin=True,
        config={},
    )
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    if not await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        return False
    frontend.async_remove_panel(hass, PANEL_URL_PATH)
    manager: FlowManager | None = hass.data.get(DOMAIN, {}).pop("manager", None)
    if manager is not None:
        await manager.async_unload()
    return True
