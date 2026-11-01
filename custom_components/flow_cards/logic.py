"""Pure logic for Flow Cards (no Home Assistant imports, so it can be unit tested)."""

from __future__ import annotations

from datetime import time
import re
import uuid
from typing import Any

WEEKDAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
UNAVAILABLE = ("unavailable", "unknown", None)

TRIGGER_KINDS = {"state", "numeric", "event_entity", "time", "interval", "sun", "event", "start", "manual", "device"}
CONDITION_KINDS = {"state", "numeric", "time", "sun", "template"}
ACTION_KINDS = {"service", "delay", "notify", "flow_run", "flow_enable", "log", "stop"}
LOGIC_KINDS = {"all", "any", "note"}
PORTS = {
    "triggers": ("out",),
    "conditions": ("true", "false"),
    "actions": ("out", "error"),
    "logic": ("out",),
}


class FlowValidationError(ValueError):
    """Raised when a flow definition is invalid."""


# ---------------------------------------------------------------- helpers

def new_id() -> str:
    return uuid.uuid4().hex[:12]


def to_number(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        return float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        return None


def as_list(value: Any) -> list:
    if value is None or value == "":
        return []
    if isinstance(value, (list, tuple, set)):
        return [v for v in value if v not in (None, "")]
    return [value]


def parse_time(value: Any) -> time | None:
    if not value:
        return None
    m = re.fullmatch(r"\s*(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*", str(value))
    if not m:
        return None
    h, mi, s = int(m[1]), int(m[2]), int(m[3] or 0)
    if h > 23 or mi > 59 or s > 59:
        return None
    return time(h, mi, s)


def weekday_ok(weekdays: Any, weekday_index: int) -> bool:
    """weekday_index: 0 = Monday."""
    days = as_list(weekdays)
    return not days or WEEKDAYS[weekday_index] in days


def in_time_window(now: time, after: Any, before: Any) -> bool:
    a, b = parse_time(after), parse_time(before)
    if a is None and b is None:
        return True
    if a is None:
        return now < b
    if b is None:
        return now >= a
    if a <= b:
        return a <= now < b
    return now >= a or now < b  # window passes midnight, e.g. 21:00 - 06:00


def in_range(value: float | None, above: Any, below: Any) -> bool:
    if value is None:
        return False
    lo, hi = to_number(above), to_number(below)
    if lo is not None and not value > lo:
        return False
    if hi is not None and not value < hi:
        return False
    return lo is not None or hi is not None


# ---------------------------------------------------------------- triggers

def state_trigger_matches(card: dict, old: Any, new: Any) -> bool:
    """old/new are the compared values (state or attribute), as strings or raw."""
    if old == new:
        return False
    to = as_list(card.get("to"))
    frm = as_list(card.get("from"))
    asked = {str(v) for v in to + frm}
    if not card.get("attribute"):
        # ignore devices dropping in/out unless the card explicitly asks for it
        for value in (old, new):
            if value in UNAVAILABLE and str(value) not in asked:
                return False
    if to and str(new) not in [str(v) for v in to]:
        return False
    if frm and str(old) not in [str(v) for v in frm]:
        return False
    return True


def numeric_crossed(card: dict, old: Any, new: Any) -> bool:
    """True when the value moves INTO the range (like HA numeric_state)."""
    if old in UNAVAILABLE or new in UNAVAILABLE:
        return False  # a sensor coming back online is not a crossing
    new_v = to_number(new)
    if not in_range(new_v, card.get("above"), card.get("below")):
        return False
    old_v = to_number(old)
    return not in_range(old_v, card.get("above"), card.get("below"))


def event_entity_matches(card: dict, old_state: Any, new_state: Any, event_type: Any) -> bool:
    """Event entities change state (a timestamp) on every press."""
    if new_state in UNAVAILABLE or old_state == new_state:
        return False
    if old_state in ("unavailable", None):
        return False  # entity just came back, not a press
    wanted = as_list(card.get("event_type"))
    return not wanted or str(event_type) in [str(w) for w in wanted]


def event_data_matches(expected: Any, actual: dict) -> bool:
    if not expected:
        return True
    if not isinstance(expected, dict) or not isinstance(actual, dict):
        return False
    for key, val in expected.items():
        if key not in actual:
            return False
        if isinstance(val, dict):
            if not event_data_matches(val, actual[key]):
                return False
        elif str(actual[key]) != str(val):
            return False
    return True


# ---------------------------------------------------------------- conditions

def state_condition(card: dict, value: Any) -> bool:
    wanted = [str(v) for v in as_list(card.get("state"))]
    return bool(wanted) and str(value) in wanted


def numeric_condition(card: dict, value: Any) -> bool:
    return in_range(to_number(value), card.get("above"), card.get("below"))


def time_condition(card: dict, now: time, weekday_index: int) -> bool:
    return weekday_ok(card.get("weekdays"), weekday_index) and in_time_window(
        now, card.get("after"), card.get("before")
    )


def combine(results: list[bool], mode: str) -> bool:
    if not results:
        return True
    return any(results) if mode == "any" else all(results)


# ---------------------------------------------------------------- validation

def _clean_card(card: Any, kinds: set, section: str) -> dict:
    if not isinstance(card, dict):
        raise FlowValidationError(f"{section}: kort skal være et objekt")
    kind = card.get("kind")
    if kind not in kinds:
        raise FlowValidationError(f"{section}: ukendt korttype '{kind}'")
    out = {k: v for k, v in card.items() if not str(k).startswith("_")}
    out["id"] = str(card.get("id") or new_id())
    return out


def _require(card: dict, *keys: str) -> None:
    for key in keys:
        if card.get(key) in (None, "", []):
            raise FlowValidationError(f"Kortet '{card.get('kind')}' mangler '{key}'")


def _check_trigger(c: dict) -> None:
    k = c["kind"]
    if k in ("state", "numeric", "event_entity"):
        _require(c, "entity_id")
    if k == "numeric" and to_number(c.get("above")) is None and to_number(c.get("below")) is None:
        raise FlowValidationError("Talkort skal have 'over' eller 'under'")
    if k == "time" and parse_time(c.get("at")) is None:
        raise FlowValidationError("Tidskort skal have et gyldigt klokkeslæt (TT:MM)")
    if k == "interval" and (to_number(c.get("minutes")) or 0) < 1:
        raise FlowValidationError("Interval skal være mindst 1 minut")
    if k == "sun" and c.get("event") not in ("sunrise", "sunset"):
        raise FlowValidationError("Solkort skal være solopgang eller solnedgang")
    if k == "event":
        _require(c, "event_type")
    if k == "device":
        cfg = c.get("config")
        if not isinstance(cfg, dict) or not cfg.get("device_id") or not cfg.get("domain"):
            raise FlowValidationError("Enhedskortet mangler enhed")


def _check_condition(c: dict) -> None:
    k = c["kind"]
    if k in ("state", "numeric"):
        _require(c, "entity_id")
    if k == "state":
        _require(c, "state")
    if k == "template":
        _require(c, "template")
    if k == "sun" and c.get("is") not in ("below_horizon", "above_horizon"):
        raise FlowValidationError("Solbetingelse skal være 'oppe' eller 'nede'")


def _check_action(c: dict) -> None:
    k = c["kind"]
    if k == "service":
        _require(c, "service")
        if "." not in str(c["service"]):
            raise FlowValidationError(f"Ugyldig tjeneste '{c['service']}'")
    if k == "notify":
        _require(c, "service", "message")
    if k == "delay" and (to_number(c.get("seconds")) or 0) <= 0:
        raise FlowValidationError("Vent skal være mere end 0 sekunder")
    if k in ("flow_run", "flow_enable"):
        _require(c, "flow_id")


SECTION_RULES = {
    "triggers": (TRIGGER_KINDS, "NÅR", _check_trigger),
    "conditions": (CONDITION_KINDS, "OG", _check_condition),
    "actions": (ACTION_KINDS, "SÅ", _check_action),
    "logic": (LOGIC_KINDS, "Logik", lambda c: None),
}


def _validate_graph(raw: dict) -> tuple[list[dict], list[dict]]:
    nodes: list[dict] = []
    seen: set[str] = set()
    for n in raw.get("nodes") or []:
        sec = n.get("sec") if isinstance(n, dict) else None
        if sec not in SECTION_RULES:
            raise FlowValidationError(f"Ukendt korttype i lærredet: '{sec}'")
        kinds, label, check = SECTION_RULES[sec]
        node = _clean_card(n, kinds, label)
        if node["id"] in seen:
            node["id"] = new_id()
        seen.add(node["id"])
        check(node)
        node["sec"] = sec
        node["x"] = round(to_number(n.get("x")) or 0.0, 1)
        node["y"] = round(to_number(n.get("y")) or 0.0, 1)
        nodes.append(node)
    by_id = {n["id"]: n for n in nodes}
    edges: list[dict] = []
    keys: set[tuple] = set()
    for e in raw.get("edges") or []:
        if not isinstance(e, dict):
            continue
        frm, to, port = str(e.get("from")), str(e.get("to")), e.get("port") or "out"
        if frm not in by_id or to not in by_id or frm == to:
            continue  # dangling wire to a deleted card: drop it silently
        if port not in PORTS[by_id[frm]["sec"]]:
            raise FlowValidationError(f"Ugyldig udgang '{port}'")
        if by_id[to]["sec"] == "triggers" or by_id[to].get("kind") == "note" or by_id[frm].get("kind") == "note":
            raise FlowValidationError("Ledninger kan ikke gå ind i et NÅR-kort eller en note")
        key = (frm, port, to)
        if key not in keys:
            keys.add(key)
            edges.append({"from": frm, "port": port, "to": to})
    return nodes, edges


def validate_flow(raw: Any) -> dict:
    if not isinstance(raw, dict):
        raise FlowValidationError("Flow skal være et objekt")
    name = str(raw.get("name") or "").strip()
    if not name:
        raise FlowValidationError("Flowet skal have et navn")
    mode = raw.get("mode") or "single"
    if mode not in ("single", "restart", "parallel"):
        raise FlowValidationError(f"Ukendt tilstand '{mode}'")
    cond_mode = raw.get("condition_mode") or "all"
    if cond_mode not in ("all", "any"):
        raise FlowValidationError(f"Ukendt betingelsestype '{cond_mode}'")
    flow_type = raw.get("type") or "standard"
    if flow_type not in ("standard", "advanced"):
        raise FlowValidationError(f"Ukendt flowtype '{flow_type}'")

    base = {
        "id": str(raw.get("id") or new_id()),
        "name": name,
        "type": flow_type,
        "folder": str(raw.get("folder") or "").strip(),
        "enabled": bool(raw.get("enabled", True)),
        "mode": mode,
        "condition_mode": cond_mode,
        "description": str(raw.get("description") or ""),
        "triggers": [], "conditions": [], "actions": [], "else_actions": [],
        "nodes": [], "edges": [],
    }
    if flow_type == "advanced":
        base["nodes"], base["edges"] = _validate_graph(raw)
        return base

    for sec, key in (("triggers", "triggers"), ("conditions", "conditions"),
                     ("actions", "actions"), ("actions", "else_actions")):
        kinds, label, check = SECTION_RULES[sec]
        cards = [_clean_card(c, kinds, "ELLERS" if key == "else_actions" else label)
                 for c in raw.get(key) or []]
        for c in cards:
            check(c)
        base[key] = cards
    return base
