import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "custom_components", "flow_cards"))
from datetime import time
import logic as L

def test_state():
    assert L.state_trigger_matches({"to": "on"}, "off", "on")
    assert not L.state_trigger_matches({"to": "on"}, "on", "on")
    assert not L.state_trigger_matches({"to": "on"}, "off", "off")
    assert not L.state_trigger_matches({}, "unavailable", "on")
    assert L.state_trigger_matches({"to": "unavailable"}, "on", "unavailable")
    assert L.state_trigger_matches({}, "off", "on")
    assert L.state_trigger_matches({"from": ["off"], "to": ["on", "playing"]}, "off", "playing")

def test_numeric():
    assert L.numeric_crossed({"above": 20}, "19", "21")
    assert not L.numeric_crossed({"above": 20}, "21", "22")
    assert L.numeric_crossed({"below": "5,5"}, "6", "5")
    assert not L.numeric_crossed({"above": 20}, "x", "unavailable")
    assert L.numeric_crossed({"above": 10, "below": 20}, "25", "15")

def test_event_entity():
    assert L.event_entity_matches({}, "2026-1", "2026-2", "single")
    assert L.event_entity_matches({"event_type": "double"}, "a", "b", "double")
    assert not L.event_entity_matches({"event_type": "double"}, "a", "b", "single")
    assert not L.event_entity_matches({}, "unavailable", "b", "single")
    assert not L.event_entity_matches({}, "a", "unavailable", None)

def test_time():
    assert L.in_time_window(time(22), "21:00", "06:00")
    assert L.in_time_window(time(5), "21:00", "06:00")
    assert not L.in_time_window(time(12), "21:00", "06:00")
    assert L.in_time_window(time(12), "09:00", "17:00")
    assert L.in_time_window(time(12), None, None)
    assert L.weekday_ok(["sat", "sun"], 5) and not L.weekday_ok(["sat"], 0) and L.weekday_ok([], 3)

def test_event_data():
    assert L.event_data_matches({"device_id": "x", "args": {"a": 1}}, {"device_id": "x", "args": {"a": "1", "b": 2}, "z": 1})
    assert not L.event_data_matches({"device_id": "y"}, {"device_id": "x"})

def test_validate():
    f = L.validate_flow({"name": "Test", "triggers": [{"kind": "time", "at": "21:00"}],
        "actions": [{"kind": "service", "service": "light.turn_on", "entity_id": ["light.kontor"]}]})
    assert f["mode"] == "single" and f["triggers"][0]["id"]
    for bad in [{}, {"name": "x", "triggers": [{"kind": "nope"}]},
                {"name": "x", "triggers": [{"kind": "time", "at": "25:00"}]},
                {"name": "x", "actions": [{"kind": "service", "service": "noservice"}]},
                {"name": "x", "triggers": [{"kind": "numeric", "entity_id": "sensor.a"}]}]:
        try:
            L.validate_flow(bad); raise AssertionError(bad)
        except L.FlowValidationError:
            pass

for n, fn in list(globals().items()):
    if n.startswith("test_"): fn(); print("ok", n)
