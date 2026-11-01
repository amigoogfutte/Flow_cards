"""Flow engine: arms triggers, evaluates conditions and runs actions."""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from datetime import timedelta
import logging
import time as _time
from typing import Any

from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
from homeassistant.core import CALLBACK_TYPE, Context, Event, HomeAssistant, State, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.event import (
    async_call_later,
    async_track_state_change_event,
    async_track_sunrise,
    async_track_sunset,
    async_track_time_change,
    async_track_time_interval,
)
from homeassistant.helpers.storage import Store
from homeassistant.helpers.template import Template, result_as_boolean
import homeassistant.util.dt as dt_util

from . import logic
from .const import (
    HISTORY_PER_FLOW,
    MAX_FLOW_DEPTH,
    MAX_STEPS_PER_RUN,
    STARTUP_QUIET_SECONDS,
    STORAGE_KEY_FLOWS,
    STORAGE_KEY_HISTORY,
    STORAGE_VERSION,
)

_LOGGER = logging.getLogger(__name__)


class _StopFlow(Exception):
    """Raised by the 'stop' action."""


def _value(state: State | None, attribute: str | None) -> Any:
    if state is None:
        return None
    if attribute:
        return state.attributes.get(attribute)
    return state.state


def _name(hass: HomeAssistant, entity_id: str) -> str:
    st = hass.states.get(entity_id)
    if st is not None and st.attributes.get("friendly_name"):
        return str(st.attributes["friendly_name"])
    return entity_id


def _state_dict(state: State | None) -> dict | None:
    if state is None:
        return None
    return {
        "entity_id": state.entity_id,
        "state": state.state,
        "attributes": dict(state.attributes),
        "last_changed": state.last_changed.isoformat(),
    }


class FlowManager:
    """Owns all flows and runs them."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY_FLOWS)
        self._hist_store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY_HISTORY)
        self._backup_store: Store = Store(hass, STORAGE_VERSION, f"{STORAGE_KEY_FLOWS}_backup")
        self._unreadable: dict[str, Any] = {}
        self.flows: dict[str, dict] = {}
        self.folders: list[str] = []
        self.history: dict[str, list[dict]] = {}
        self.arm_errors: dict[str, str] = {}
        self._unsubs: dict[str, list[CALLBACK_TYPE]] = {}
        self._tasks: dict[str, set[asyncio.Task]] = {}
        self._listeners: set[Callable[[dict], None]] = set()
        # While Home Assistant starts, devices come online and states get restored. Those are not
        # real changes, so entity triggers stay quiet until things have settled.
        self._quiet_until: float | None = None
        if not hass.is_running:
            self._quiet_until = float("inf")

            @callback
            def _started(_event: Event) -> None:
                self._quiet_until = _time.monotonic() + STARTUP_QUIET_SECONDS

            hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _started)

    def _settling(self) -> bool:
        if self._quiet_until is None:
            return False
        if _time.monotonic() < self._quiet_until:
            return True
        self._quiet_until = None
        return False

    # ------------------------------------------------------------ lifecycle

    async def async_load(self) -> None:
        data = await self._store.async_load() or {}
        if data.get("flows"):
            # keep a copy of exactly what was on disk before this version touches it
            await self._backup_store.async_save(data)
        self.flows = {}
        self._unreadable = {}
        for key, raw in (data.get("flows") or {}).items():
            try:
                flow = logic.validate_flow(raw)
            except Exception as err:  # noqa: BLE001
                # never drop a flow we cannot read: keep it untouched so it is saved back as-is
                _LOGGER.warning("Flowet '%s' kunne ikke indlæses og er sat på pause: %s",
                                raw.get("name") if isinstance(raw, dict) else key, err)
                self._unreadable[str(key)] = raw
                continue
            self.flows[flow["id"]] = flow
        self.folders = [str(f) for f in data.get("folders") or []]
        hist = await self._hist_store.async_load() or {}
        self.history = {k: v for k, v in (hist.get("history") or {}).items() if k in self.flows}
        # runs that were active when HA stopped
        for runs in self.history.values():
            for run in runs:
                if run.get("status") == "running":
                    run["status"] = "cancelled"
                    run["error"] = "Home Assistant blev genstartet under kørsel"
        for flow in self.flows.values():
            self._arm(flow)

    async def async_unload(self) -> None:
        for flow_id in list(self._unsubs):
            self._disarm(flow_id)
        for tasks in self._tasks.values():
            for task in list(tasks):
                task.cancel()
        self._tasks.clear()
        await self._hist_store.async_save(self._history_data())

    async def _save(self) -> None:
        await self._store.async_save(
            {"flows": {**self._unreadable, **self.flows}, "folders": self.folders}
        )

    def _history_data(self) -> dict:
        return {"history": self.history}

    def _save_history_later(self) -> None:
        self._hist_store.async_delay_save(self._history_data, 5)

    # ------------------------------------------------------------ subscribers

    @callback
    def async_subscribe(self, cb: Callable[[dict], None]) -> CALLBACK_TYPE:
        self._listeners.add(cb)

        @callback
        def _remove() -> None:
            self._listeners.discard(cb)

        return _remove

    @callback
    def _notify(self, message: dict) -> None:
        for cb in list(self._listeners):
            try:
                cb(message)
            except Exception:  # noqa: BLE001
                _LOGGER.exception("Fejl i flow-lytter")

    # ------------------------------------------------------------ CRUD

    def flow_status(self, flow_id: str) -> dict:
        runs = self.history.get(flow_id) or []
        last = runs[0] if runs else None
        last_error = next((r for r in runs if r.get("status") == "error"), None)
        return {
            "running": len(self._tasks.get(flow_id) or ()),
            "last_run": last and {k: last.get(k) for k in ("id", "start", "status", "trigger", "branch")},
            "last_error": last_error and {
                "start": last_error.get("start"),
                "error": last_error.get("error"),
            },
            "arm_error": self.arm_errors.get(flow_id),
            "run_count": len(runs),
        }

    def list_flows(self) -> list[dict]:
        return [{**flow, "status": self.flow_status(fid)} for fid, flow in self.flows.items()]

    async def async_save_flow(self, raw: dict) -> dict:
        flow = logic.validate_flow(raw)
        old = self.flows.get(flow["id"])
        if old is None and raw.get("id"):
            flow["id"] = logic.new_id()  # never trust ids we have not seen
        self._disarm(flow["id"])
        self.flows[flow["id"]] = flow
        if flow["folder"] and flow["folder"] not in self.folders:
            self.folders.append(flow["folder"])
        await self._save()
        self._arm(flow)
        self._notify({"event": "flows_changed"})
        return {**flow, "status": self.flow_status(flow["id"])}

    async def async_delete_flow(self, flow_id: str) -> None:
        if flow_id not in self.flows:
            raise HomeAssistantError("Flowet findes ikke")
        self._disarm(flow_id)
        for task in list(self._tasks.pop(flow_id, ())):
            task.cancel()
        self.flows.pop(flow_id)
        self.history.pop(flow_id, None)
        await self._save()
        self._save_history_later()
        self._notify({"event": "flows_changed"})

    async def async_set_enabled(self, flow_id: str, enabled: bool) -> None:
        flow = self.flows.get(flow_id)
        if flow is None:
            raise HomeAssistantError("Flowet findes ikke")
        flow["enabled"] = bool(enabled)
        self._disarm(flow_id)
        self._arm(flow)
        await self._save()
        self._notify({"event": "flows_changed"})

    async def async_set_folders(self, folders: list[str]) -> None:
        clean: list[str] = []
        for f in folders:
            f = str(f).strip()
            if f and f not in clean:
                clean.append(f)
        self.folders = clean
        for flow in self.flows.values():
            if flow["folder"] and flow["folder"] not in clean:
                flow["folder"] = ""
                self._disarm(flow["id"])
                self._arm(flow)
        await self._save()
        self._notify({"event": "flows_changed"})

    async def async_clear_history(self, flow_id: str) -> None:
        self.history.pop(flow_id, None)
        self._save_history_later()
        self._notify({"event": "flows_changed"})

    # ------------------------------------------------------------ arming

    def _disarm(self, flow_id: str) -> None:
        for unsub in self._unsubs.pop(flow_id, []):
            try:
                unsub()
            except Exception:  # noqa: BLE001
                _LOGGER.debug("Kunne ikke fjerne lytter", exc_info=True)
        self.arm_errors.pop(flow_id, None)

    def _arm(self, flow: dict) -> None:
        flow_id = flow["id"]
        self._unsubs[flow_id] = []
        if not flow.get("enabled", True):
            return
        triggers = (
            [n for n in flow["nodes"] if n.get("sec") == "triggers"]
            if flow.get("type") == "advanced" else flow["triggers"]
        )
        for card in triggers:
            try:
                self._unsubs[flow_id].extend(self._arm_trigger(flow_id, card))
            except Exception as err:  # noqa: BLE001
                _LOGGER.exception("Kunne ikke aktivere NÅR-kort i flow %s", flow.get("name"))
                self.arm_errors[flow_id] = f"NÅR-kort kunne ikke aktiveres: {err}"

    def _arm_trigger(self, flow_id: str, card: dict) -> list[CALLBACK_TYPE]:
        hass = self.hass
        kind = card["kind"]
        node_id = card["id"]
        fire = lambda info: self.async_fire(flow_id, {**info, "node_id": node_id})  # noqa: E731

        if kind == "manual":
            return []

        if kind in ("state", "numeric", "event_entity"):
            entity_ids = logic.as_list(card["entity_id"])
            attribute = card.get("attribute") or None
            for_s = logic.to_number(card.get("for")) or 0
            pending: dict[str, CALLBACK_TYPE] = {}

            def _cancel(entity_id: str) -> None:
                if (h := pending.pop(entity_id, None)) is not None:
                    h()

            @callback
            def _changed(event: Event) -> None:
                entity_id = event.data["entity_id"]
                old: State | None = event.data.get("old_state")
                new: State | None = event.data.get("new_state")
                if old is None or new is None or self._settling():
                    # entity appeared/vanished, or Home Assistant is still starting
                    _cancel(entity_id)
                    return
                old_v, new_v = _value(old, attribute), _value(new, attribute)
                if kind == "state":
                    ok = logic.state_trigger_matches(card, old_v, new_v)
                    desc = f"{_name(hass, entity_id)}: {old_v} → {new_v}"
                elif kind == "numeric":
                    ok = logic.numeric_crossed(card, old_v, new_v)
                    desc = f"{_name(hass, entity_id)} = {new_v}"
                else:
                    ev_type = new.attributes.get("event_type") if new else None
                    ok = logic.event_entity_matches(
                        card, old.state if old else None, new.state if new else None, ev_type
                    )
                    desc = f"{_name(hass, entity_id)}: {ev_type}"
                info = {
                    "kind": kind,
                    "entity_id": entity_id,
                    "from_state": _state_dict(old),
                    "to_state": _state_dict(new),
                    "description": desc,
                }
                if kind == "event_entity" and new is not None:
                    info["event_type"] = new.attributes.get("event_type")
                if not ok:
                    if kind == "state" or (
                        kind == "numeric" and not logic.numeric_condition(card, new_v)
                    ):
                        _cancel(entity_id)
                    return
                if for_s <= 0 or kind == "event_entity":
                    fire(info)
                    return
                _cancel(entity_id)
                target_v = new_v

                @callback
                def _held(_now: Any) -> None:
                    pending.pop(entity_id, None)
                    current = _value(hass.states.get(entity_id), attribute)
                    still = (logic.numeric_condition(card, current) if kind == "numeric"
                             else current == target_v)
                    if still:
                        info["description"] += f" (i {int(for_s)} s)"
                        fire(info)

                pending[entity_id] = async_call_later(hass, for_s, _held)

            unsub = async_track_state_change_event(hass, entity_ids, _changed)

            def _unsub_all() -> None:
                unsub()
                for eid in list(pending):
                    _cancel(eid)

            return [_unsub_all]

        if kind == "time":
            at = logic.parse_time(card["at"])

            @callback
            def _at(now: Any) -> None:
                local = dt_util.as_local(now)
                if logic.weekday_ok(card.get("weekdays"), local.weekday()):
                    fire({"kind": "time", "description": f"Klokken er {at.strftime('%H:%M')}"})

            return [async_track_time_change(hass, _at, hour=at.hour, minute=at.minute, second=at.second)]

        if kind == "interval":
            minutes = logic.to_number(card["minutes"]) or 1

            @callback
            def _tick(_now: Any) -> None:
                fire({"kind": "interval", "description": f"Hvert {minutes:g}. minut"})

            return [async_track_time_interval(hass, _tick, timedelta(minutes=minutes))]

        if kind == "sun":
            offset = timedelta(minutes=logic.to_number(card.get("offset")) or 0)
            label = "Solopgang" if card["event"] == "sunrise" else "Solnedgang"

            @callback
            def _sun() -> None:
                fire({"kind": "sun", "event": card["event"], "description": label})

            tracker = async_track_sunrise if card["event"] == "sunrise" else async_track_sunset
            return [tracker(hass, _sun, offset)]

        if kind == "event":
            expected = card.get("event_data") or {}

            @callback
            def _event(event: Event) -> None:
                if logic.event_data_matches(expected, dict(event.data)):
                    fire({
                        "kind": "event",
                        "event_type": event.event_type,
                        "event_data": dict(event.data),
                        "description": f"Hændelse {event.event_type}",
                    })

            return [hass.bus.async_listen(card["event_type"], _event)]

        if kind == "start":
            if hass.is_running:
                return []
            fired = {"done": False}

            @callback
            def _started(_event: Event) -> None:
                fired["done"] = True
                fire({"kind": "start", "description": "Home Assistant startede"})

            remove = hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _started)

            def _unsub_start() -> None:
                if not fired["done"]:
                    remove()

            return [_unsub_start]

        if kind == "device":
            # any Home Assistant device trigger (Zigbee2MQTT / ZHA / deCONZ buttons, BTHome, ...)
            from homeassistant.helpers.trigger import (  # noqa: PLC0415
                async_initialize_triggers,
                async_validate_trigger_config,
            )

            config = dict(card["config"])
            label = str(card.get("label") or (card.get("args") or {}).get("label") or "Enhed")
            holder: dict[str, Any] = {"unsub": None, "stopped": False}

            async def _action(run_variables: dict | None = None, context: Any = None) -> None:
                trig = (run_variables or {}).get("trigger") or {}
                fire({"kind": "device", "description": label, "data": trig})

            def _log(level: int, msg: str, **_kw: Any) -> None:
                _LOGGER.log(level, "Enhedskort '%s': %s", label, msg)

            async def _setup() -> None:
                try:
                    conf = await async_validate_trigger_config(hass, [config])
                    unsub = await async_initialize_triggers(
                        hass, conf, _action, "flow_cards", f"flow_cards {flow_id}", _log
                    )
                except Exception as err:  # noqa: BLE001
                    _LOGGER.warning("Enhedskort '%s' kunne ikke aktiveres: %s", label, err)
                    self.arm_errors[flow_id] = f"Enhedskortet '{label}' kunne ikke aktiveres: {err}"
                    self._notify({"event": "flows_changed"})
                    return
                if holder["stopped"]:
                    if unsub:
                        unsub()
                    return
                holder["unsub"] = unsub

            hass.async_create_task(_setup())

            def _stop() -> None:
                holder["stopped"] = True
                if holder["unsub"]:
                    holder["unsub"]()

            return [_stop]

        raise HomeAssistantError(f"Ukendt NÅR-kort {kind}")

    # ------------------------------------------------------------ running

    @callback
    def async_fire(
        self, flow_id: str, info: dict, *, depth: int = 0, manual: bool = False,
        skip_conditions: bool = False,
    ) -> str | None:
        flow = self.flows.get(flow_id)
        if flow is None:
            return None
        if not flow.get("enabled", True) and not manual:
            return None
        if depth > MAX_FLOW_DEPTH:
            _LOGGER.warning("Flow %s: for mange flows i kæde, stopper", flow["name"])
            return None
        tasks = self._tasks.setdefault(flow_id, set())
        mode = flow.get("mode", "single")
        if tasks and mode == "single":
            self._record_skipped(flow, info, "Flowet kørte allerede (tilstand: ignorér nye)")
            return None
        if tasks and mode == "restart":
            for task in list(tasks):
                task.cancel()
        run = self._new_run(flow, info, manual)
        if flow.get("type") == "advanced":
            coro = self._execute_graph(flow, run, info, depth, manual)
        else:
            coro = self._execute(flow, run, info, depth, skip_conditions)
        task = self.hass.async_create_background_task(
            coro,
            name=f"flow_cards {flow['name']}",
        )
        tasks.add(task)
        task.add_done_callback(lambda t: tasks.discard(t))
        return run["id"]

    def _new_run(self, flow: dict, info: dict, manual: bool) -> dict:
        run = {
            "id": logic.new_id(),
            "flow_id": flow["id"],
            "start": dt_util.utcnow().isoformat(),
            "end": None,
            "trigger": info.get("description") or ("Startet manuelt" if manual else ""),
            "manual": manual,
            "status": "running",
            "branch": None,
            "error": None,
            "steps": [],
        }
        runs = self.history.setdefault(flow["id"], [])
        runs.insert(0, run)
        del runs[HISTORY_PER_FLOW:]
        self._notify({"event": "run", "flow_id": flow["id"], "run": run})
        return run

    def _record_skipped(self, flow: dict, info: dict, reason: str) -> None:
        run = self._new_run(flow, info, False)
        run.update(status="skipped", end=run["start"], error=reason)
        self._finish(flow, run)

    def _finish(self, flow: dict, run: dict) -> None:
        run["end"] = run["end"] or dt_util.utcnow().isoformat()
        self._save_history_later()
        self._notify({"event": "run", "flow_id": flow["id"], "run": run})

    def _step(self, run: dict, section: str, card: dict, status: str, text: str = "",
              error: str | None = None, started: float | None = None) -> dict:
        step = {
            "section": section,
            "card_id": card.get("id"),
            "kind": card.get("kind"),
            "status": status,
            "text": text,
            "error": error,
            "ms": int((_time.monotonic() - started) * 1000) if started else None,
        }
        if len(run["steps"]) < MAX_STEPS_PER_RUN:
            run["steps"].append(step)
        return step

    async def _execute(self, flow: dict, run: dict, info: dict, depth: int,
                       skip_conditions: bool) -> None:
        variables = {
            "trigger": info,
            "flow": {"id": flow["id"], "name": flow["name"]},
        }
        context = Context()
        try:
            if skip_conditions or not flow["conditions"]:
                passed = True
            else:
                results = []
                for card in flow["conditions"]:
                    started = _time.monotonic()
                    try:
                        ok, text = self._check_condition(card, variables)
                    except Exception as err:  # noqa: BLE001
                        self._step(run, "conditions", card, "error", error=str(err), started=started)
                        raise
                    if card.get("invert"):
                        ok = not ok
                    results.append(ok)
                    self._step(run, "conditions", card, "true" if ok else "false", text, started=started)
                passed = logic.combine(results, flow.get("condition_mode", "all"))
            run["branch"] = "then" if passed else "else"
            actions = flow["actions"] if passed else flow["else_actions"]
            section = "actions" if passed else "else_actions"
            if not passed and not actions:
                run["status"] = "false"
                return
            for card in actions:
                if card.get("disabled"):
                    self._step(run, section, card, "skipped", "Kortet er slået fra")
                    continue
                started = _time.monotonic()
                try:
                    text = await self._run_action(card, variables, context, depth)
                except _StopFlow:
                    self._step(run, section, card, "success", "Flowet stoppet", started=started)
                    break
                except asyncio.CancelledError:
                    self._step(run, section, card, "cancelled", "Afbrudt", started=started)
                    raise
                except Exception as err:  # noqa: BLE001
                    self._step(run, section, card, "error", error=str(err) or type(err).__name__,
                               started=started)
                    raise
                self._step(run, section, card, "success", text, started=started)
                self._notify({"event": "run", "flow_id": flow["id"], "run": run})
            run["status"] = "success"
        except asyncio.CancelledError:
            run["status"] = "cancelled"
            run["error"] = "Genstartet af en ny udløsning" if flow.get("mode") == "restart" else "Afbrudt"
            self._finish(flow, run)
            raise
        except Exception as err:  # noqa: BLE001
            run["status"] = "error"
            run["error"] = str(err) or type(err).__name__
            _LOGGER.warning("Flow '%s' fejlede: %s", flow["name"], run["error"])
        finally:
            if run["status"] != "cancelled":
                self._finish(flow, run)

    # ------------------------------------------------------------ advanced (graph) flows

    def _start_nodes(self, flow: dict, info: dict, manual: bool) -> list[str]:
        triggers = [n for n in flow["nodes"] if n["sec"] == "triggers"]
        if info.get("node_id") and any(n["id"] == info["node_id"] for n in triggers):
            return [info["node_id"]]
        if not manual:
            return []
        manual_nodes = [n["id"] for n in triggers if n["kind"] == "manual"]
        return manual_nodes or [n["id"] for n in triggers]

    async def _run_graph(self, flow: dict, run: dict, info: dict, depth: int,
                         manual: bool) -> None:
        nodes = {n["id"]: n for n in flow["nodes"]}
        outgoing: dict[tuple[str, str], list[str]] = {}
        incoming: dict[str, set[tuple[str, str]]] = {}
        for e in flow["edges"]:
            outgoing.setdefault((e["from"], e["port"]), []).append(e["to"])
            incoming.setdefault(e["to"], set()).add((e["from"], e["port"]))
        variables = {"trigger": info, "flow": {"id": flow["id"], "name": flow["name"]}}
        context = Context()
        state = {"visits": 0, "any_done": set(), "all_seen": {}, "errors": []}
        starts = self._start_nodes(flow, info, manual)
        if not starts:
            raise HomeAssistantError("Flowet har intet NÅR-kort at starte fra")

        async with asyncio.TaskGroup() as tg:

            def follow(node_id: str, port: str) -> None:
                for target in outgoing.get((node_id, port), []):
                    tg.create_task(visit(target, (node_id, port)))

            async def visit(node_id: str, via: tuple[str, str]) -> None:
                state["visits"] += 1
                if state["visits"] > MAX_STEPS_PER_RUN:
                    raise HomeAssistantError(
                        f"Flowet stoppede efter {MAX_STEPS_PER_RUN} kort (er der en løkke?)"
                    )
                node = nodes[node_id]
                sec, kind = node["sec"], node["kind"]
                started = _time.monotonic()
                if sec == "logic":
                    if kind == "any":
                        if node_id in state["any_done"]:
                            return
                        state["any_done"].add(node_id)
                        self._step(run, "logic", node, "success", "Første input modtaget")
                        follow(node_id, "out")
                    elif kind == "all":
                        seen = state["all_seen"].setdefault(node_id, set())
                        seen.add(via)
                        need = len(incoming.get(node_id, ()))
                        if len(seen) < need:
                            return
                        self._step(run, "logic", node, "success", f"Alle {need} input modtaget")
                        follow(node_id, "out")
                    return
                if sec == "conditions":
                    try:
                        ok, text = self._check_condition(node, variables)
                    except Exception as err:  # noqa: BLE001
                        self._step(run, "conditions", node, "error", error=str(err), started=started)
                        state["errors"].append(str(err))
                        return
                    if node.get("invert"):
                        ok = not ok
                    self._step(run, "conditions", node, "true" if ok else "false", text, started=started)
                    self._notify({"event": "run", "flow_id": flow["id"], "run": run})
                    follow(node_id, "true" if ok else "false")
                    return
                # actions
                if node.get("disabled"):
                    self._step(run, "actions", node, "skipped", "Kortet er slået fra")
                    follow(node_id, "out")
                    return
                try:
                    text = await self._run_action(node, variables, context, depth)
                except _StopFlow:
                    self._step(run, "actions", node, "success", "Flowet stoppet", started=started)
                    raise
                except asyncio.CancelledError:
                    self._step(run, "actions", node, "cancelled", "Afbrudt", started=started)
                    raise
                except Exception as err:  # noqa: BLE001
                    msg = str(err) or type(err).__name__
                    self._step(run, "actions", node, "error", error=msg, started=started)
                    if outgoing.get((node_id, "error")):
                        follow(node_id, "error")
                    else:
                        state["errors"].append(msg)
                    return
                self._step(run, "actions", node, "success", text, started=started)
                self._notify({"event": "run", "flow_id": flow["id"], "run": run})
                follow(node_id, "out")

            for sid in starts:
                self._step(run, "triggers", nodes[sid], "success",
                           info.get("description") or "Startet")
                follow(sid, "out")

        if state["errors"]:
            raise HomeAssistantError(state["errors"][0])

    async def _execute_graph(self, flow: dict, run: dict, info: dict, depth: int,
                             manual: bool) -> None:
        try:
            try:
                await self._run_graph(flow, run, info, depth, manual)
            except* _StopFlow:
                pass
            run["status"] = "success"
        except asyncio.CancelledError:
            run["status"] = "cancelled"
            run["error"] = "Genstartet af en ny udløsning" if flow.get("mode") == "restart" else "Afbrudt"
            self._finish(flow, run)
            raise
        except Exception as err:  # noqa: BLE001
            leaf: BaseException = err
            while isinstance(leaf, BaseExceptionGroup) and leaf.exceptions:
                leaf = leaf.exceptions[0]
            run["status"] = "error"
            run["error"] = str(leaf) or type(leaf).__name__
            _LOGGER.warning("Flow '%s' fejlede: %s", flow["name"], run["error"])
        finally:
            if run["status"] != "cancelled":
                self._finish(flow, run)

    # ------------------------------------------------------------ conditions

    def _check_condition(self, card: dict, variables: dict) -> tuple[bool, str]:
        hass = self.hass
        kind = card["kind"]
        if kind in ("state", "numeric"):
            entity_id = logic.as_list(card["entity_id"])[0]
            value = _value(hass.states.get(entity_id), card.get("attribute"))
            ok = (logic.state_condition if kind == "state" else logic.numeric_condition)(card, value)
            return ok, f"{_name(hass, entity_id)} er {value}"
        if kind == "time":
            now = dt_util.now()
            return logic.time_condition(card, now.time(), now.weekday()), f"Klokken er {now:%H:%M}"
        if kind == "sun":
            sun = hass.states.get("sun.sun")
            value = sun.state if sun else None
            return value == card["is"], "Solen er nede" if value == "below_horizon" else "Solen er oppe"
        if kind == "template":
            result = Template(card["template"], hass).async_render(variables, parse_result=False)
            return result_as_boolean(result), f"Skabelon gav '{result}'"
        raise HomeAssistantError(f"Ukendt OG-kort {kind}")

    # ------------------------------------------------------------ actions

    def _render(self, value: Any, variables: dict, native: bool = True) -> Any:
        if isinstance(value, str):
            if "{{" in value or "{%" in value:
                return Template(value, self.hass).async_render(variables, parse_result=native)
            return value
        if isinstance(value, dict):
            return {k: self._render(v, variables, native) for k, v in value.items()}
        if isinstance(value, list):
            return [self._render(v, variables, native) for v in value]
        return value

    async def _call(self, service: str, data: dict, target: dict | None, context: Context) -> None:
        domain, name = service.split(".", 1)
        if not self.hass.services.has_service(domain, name):
            raise HomeAssistantError(f"Tjenesten {service} findes ikke")
        await self.hass.services.async_call(
            domain, name, data, blocking=True, context=context, target=target or None
        )

    async def _run_action(self, card: dict, variables: dict, context: Context, depth: int) -> str:
        kind = card["kind"]
        if kind == "service":
            entity_ids = logic.as_list(
                self._render(card.get("target_entity_id") or card.get("entity_id"), variables)
            )
            target = {"entity_id": entity_ids} if entity_ids else None
            data = self._render(card.get("data") or {}, variables)
            if not isinstance(data, dict):
                raise HomeAssistantError("Data skal være et objekt")
            await self._call(card["service"], data, target, context)
            names = ", ".join(_name(self.hass, e) for e in entity_ids)
            return f"{card['service']}" + (f" → {names}" if names else "")
        if kind == "delay":
            seconds = float(logic.to_number(card["seconds"]) or 0)
            await asyncio.sleep(seconds)
            return f"Ventede {seconds:g} s"
        if kind == "notify":
            message = self._render(card["message"], variables, native=False)
            title = self._render(card.get("title") or "", variables, native=False)
            service = card["service"]
            if service == "persistent_notification":
                data = {"message": message}
                if title:
                    data["title"] = title
                await self._call("persistent_notification.create", data, None, context)
            elif service.startswith("notify.") and self.hass.states.get(service) is not None:
                data = {"message": message}
                if title:
                    data["title"] = title
                await self._call("notify.send_message", data, {"entity_id": [service]}, context)
            else:
                data = {"message": message}
                if title:
                    data["title"] = title
                await self._call(service, data, None, context)
            return f"Sendt: {message}"
        if kind == "flow_run":
            target = self.flows.get(card["flow_id"])
            if target is None:
                raise HomeAssistantError("Flowet der skal startes findes ikke")
            self.async_fire(
                target["id"],
                {"kind": "flow", "description": f"Startet af flowet '{variables['flow']['name']}'",
                 "parent": variables["trigger"]},
                depth=depth + 1, manual=True,
                skip_conditions=bool(card.get("skip_conditions")),
            )
            return f"Startede '{target['name']}'"
        if kind == "flow_enable":
            target = self.flows.get(card["flow_id"])
            if target is None:
                raise HomeAssistantError("Flowet findes ikke")
            enabled = bool(card.get("enabled", True))
            await self.async_set_enabled(target["id"], enabled)
            return f"{'Slog til' if enabled else 'Slog fra'}: '{target['name']}'"
        if kind == "log":
            message = self._render(card.get("message") or "", variables, native=False)
            level = {"info": logging.INFO, "warning": logging.WARNING, "error": logging.ERROR}.get(
                card.get("level") or "info", logging.INFO
            )
            _LOGGER.log(level, "[%s] %s", variables["flow"]["name"], message)
            return str(message)
        if kind == "stop":
            raise _StopFlow
        raise HomeAssistantError(f"Ukendt SÅ-kort {kind}")
