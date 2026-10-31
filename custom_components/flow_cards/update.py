"""Update entity: Home Assistant shows new Flow Cards versions under Settings -> Updates."""

from __future__ import annotations

from datetime import timedelta
import json
import logging
from pathlib import Path
from typing import Any

import aiohttp

from homeassistant.components import persistent_notification
from homeassistant.components.update import UpdateEntity, UpdateEntityFeature
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import issue_registry as ir
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import async_track_time_interval

from .const import DOMAIN, REPO, VERSION
from .installer import install_zip

_LOGGER = logging.getLogger(__name__)

MANIFEST_URL = f"https://raw.githubusercontent.com/{REPO}/main/custom_components/flow_cards/manifest.json"
ZIP_URL = f"https://codeload.github.com/{REPO}/zip/refs/heads/main"
CHECK_EVERY = timedelta(hours=3)


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    async_add_entities([FlowCardsUpdate()])


class FlowCardsUpdate(UpdateEntity):
    """Offers the newest Flow Cards from GitHub."""

    _attr_name = "Flow Cards"
    _attr_title = "Flow Cards"
    _attr_unique_id = "flow_cards_update"
    _attr_supported_features = UpdateEntityFeature.INSTALL | UpdateEntityFeature.PROGRESS
    _attr_should_poll = False
    _attr_release_url = f"https://github.com/{REPO}/commits/main"

    def __init__(self) -> None:
        self._attr_installed_version = VERSION
        self._attr_latest_version = VERSION
        self._attr_in_progress = False

    async def async_added_to_hass(self) -> None:
        await self._async_check()
        self.async_on_remove(
            async_track_time_interval(self.hass, self._async_check, CHECK_EVERY)
        )

    async def async_update(self) -> None:
        """Called by homeassistant.update_entity ("tjek nu")."""
        await self._async_fetch()

    async def _async_check(self, _now: Any = None) -> None:
        await self._async_fetch()
        self.async_write_ha_state()

    async def _async_fetch(self) -> None:
        try:
            session = async_get_clientsession(self.hass)
            async with session.get(
                MANIFEST_URL, timeout=aiohttp.ClientTimeout(total=20)
            ) as resp:
                resp.raise_for_status()
                manifest = json.loads(await resp.text())
            latest = str(manifest.get("version") or "")
            if latest:
                self._attr_latest_version = latest
        except Exception as err:  # noqa: BLE001
            _LOGGER.debug("Kunne ikke tjekke for ny Flow Cards-version: %s", err)

    async def async_install(self, version: str | None, backup: bool, **kwargs: Any) -> None:
        self._attr_in_progress = True
        self.async_write_ha_state()
        try:
            session = async_get_clientsession(self.hass)
            async with session.get(ZIP_URL, timeout=aiohttp.ClientTimeout(total=120)) as resp:
                resp.raise_for_status()
                blob = await resp.read()
            new_version = await self.hass.async_add_executor_job(
                install_zip, blob, Path(__file__).parent
            )
        except Exception as err:
            raise HomeAssistantError(f"Opdateringen af Flow Cards mislykkedes: {err}") from err
        finally:
            self._attr_in_progress = False
        self._attr_installed_version = new_version
        self.async_write_ha_state()
        persistent_notification.async_dismiss(self.hass, "flow_cards_restart")
        ir.async_create_issue(
            self.hass,
            DOMAIN,
            "restart_required",
            is_fixable=True,
            is_persistent=False,
            severity=ir.IssueSeverity.WARNING,
            translation_key="restart_required",
            translation_placeholders={"version": new_version},
        )
