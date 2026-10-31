"""Websocket API used by the Flows panel."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError

from .const import DOMAIN, VERSION
from .logic import FlowValidationError


def _manager(hass: HomeAssistant):
    return hass.data[DOMAIN]["manager"]


@callback
def async_register(hass: HomeAssistant) -> None:
    for handler in (
        ws_list, ws_save, ws_delete, ws_enable, ws_run, ws_history, ws_clear_history,
        ws_folders, ws_subscribe,
    ):
        websocket_api.async_register_command(hass, handler)


def _guard(connection, msg_id: int, err: Exception) -> None:
    if isinstance(err, (FlowValidationError, HomeAssistantError)):
        connection.send_error(msg_id, "invalid", str(err))
    else:
        connection.send_error(msg_id, "unknown_error", str(err))


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/list"})
@callback
def ws_list(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    m = _manager(hass)
    connection.send_result(
        msg["id"], {"flows": m.list_flows(), "folders": m.folders, "version": VERSION}
    )


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/save", vol.Required("flow"): dict}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_save(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    try:
        flow = await _manager(hass).async_save_flow(msg["flow"])
    except Exception as err:  # noqa: BLE001
        _guard(connection, msg["id"], err)
        return
    connection.send_result(msg["id"], flow)


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/delete", vol.Required("flow_id"): str}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_delete(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    try:
        await _manager(hass).async_delete_flow(msg["flow_id"])
    except Exception as err:  # noqa: BLE001
        _guard(connection, msg["id"], err)
        return
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/enable",
        vol.Required("flow_id"): str,
        vol.Required("enabled"): bool,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_enable(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    try:
        await _manager(hass).async_set_enabled(msg["flow_id"], msg["enabled"])
    except Exception as err:  # noqa: BLE001
        _guard(connection, msg["id"], err)
        return
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/run",
        vol.Required("flow_id"): str,
        vol.Optional("skip_conditions", default=False): bool,
        vol.Optional("node_id"): str,
    }
)
@websocket_api.require_admin
@callback
def ws_run(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    m = _manager(hass)
    if msg["flow_id"] not in m.flows:
        connection.send_error(msg["id"], "not_found", "Flowet findes ikke")
        return
    info = {"kind": "manual", "description": "Startet manuelt"}
    if msg.get("node_id"):
        info["node_id"] = msg["node_id"]
    run_id = m.async_fire(
        msg["flow_id"], info,
        manual=True, skip_conditions=msg["skip_conditions"],
    )
    connection.send_result(msg["id"], {"run_id": run_id})


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/history", vol.Required("flow_id"): str}
)
@callback
def ws_history(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    connection.send_result(msg["id"], {"runs": _manager(hass).history.get(msg["flow_id"], [])})


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/clear_history", vol.Required("flow_id"): str}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_clear_history(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    await _manager(hass).async_clear_history(msg["flow_id"])
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/folders", vol.Required("folders"): [str]}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_folders(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    await _manager(hass).async_set_folders(msg["folders"])
    connection.send_result(msg["id"])


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/subscribe"})
@callback
def ws_subscribe(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    msg_id = msg["id"]

    @callback
    def _forward(message: dict) -> None:
        connection.send_message(websocket_api.event_message(msg_id, message))

    connection.subscriptions[msg_id] = _manager(hass).async_subscribe(_forward)
    connection.send_result(msg_id)
