import fs from "fs";
const src = fs.readFileSync(new URL("../custom_components/flow_cards/frontend/flow-cards-panel.js", import.meta.url), "utf8");
const block = src.slice(src.indexOf("/* ---- NODE-RED IMPORT START ---- */"), src.indexOf("/* ---- NODE-RED IMPORT END ---- */"));
const num = (v) => (v === "" || v === undefined || v === null ? undefined : Number(String(v).replace(",", ".")));
const labels = src.slice(src.indexOf("const EVENT_LABELS = {"), src.indexOf("const eventLabel"));
const nodeRedImport = new Function("num", labels + block + "; return nodeRedImport;")(num);
const W = (...ids) => [ids];
const flows = [
  { id: "T1", type: "tab", label: "Hjælper" }, { id: "T2", type: "tab", label: "Lys" }, { id: "T3", type: "tab", label: "Tom" },
  // Hjælper: sun -> change(Sol Op) -> switch -> turn_on / turn_off
  { id: "sun", z: "T1", type: "sun-event-inject", name: "Sol op", event: "sunrise", offset: "0", x: 100, y: 100, wires: [["chg"]] },
  { id: "chg", z: "T1", type: "change", rules: [{ t: "set", p: "payload", pt: "msg", to: "Sol Op", tot: "str" }], x: 250, y: 100, wires: [["sw"]] },
  { id: "sw", z: "T1", type: "switch", property: "payload", propertyType: "msg", rules: [{ t: "eq", v: "Sol Op", vt: "str" }, { t: "eq", v: "Sol Ned", vt: "str" }], checkall: "true", x: 400, y: 100, wires: [["on"], ["off"]] },
  { id: "on", z: "T1", type: "api-call-service", name: "Daytime", action: "input_boolean.turn_on", entityId: ["input_boolean.nat"], data: "", dataType: "jsonata", x: 550, y: 80, wires: [[]] },
  { id: "off", z: "T1", type: "api-call-service", name: "Night", action: "input_boolean.turn_off", entityId: ["input_boolean.nat"], data: "", x: 550, y: 140, wires: [[]] },
  { id: "dbg", z: "T1", type: "debug", wires: [] },
  // Lys chain A: knap -> current state (no halt) -> switch on/off -> services
  { id: "btn", z: "T2", type: "server-state-changed", name: "Knap Jesper", entities: { entity: ["event.kontor_knap_1"] }, ifState: "", x: 100, y: 100, wires: [["cs"]] },
  { id: "cs", z: "T2", type: "api-current-state", entity_id: "light.kontor", halt_if: "", x: 250, y: 100, wires: [["sw2"]] },
  { id: "sw2", z: "T2", type: "switch", property: "payload", propertyType: "msg", rules: [{ t: "eq", v: "on", vt: "str" }, { t: "else" }], checkall: "true", x: 400, y: 100, wires: [["loff"], ["lon"]] },
  { id: "loff", z: "T2", type: "api-call-service", name: "Sluk", action: "light.turn_off", entityId: ["light.kontor"], x: 550, y: 80, wires: [[]] },
  { id: "lon", z: "T2", type: "api-call-service", name: "Tænd 75", action: "light.turn_on", entityId: ["light.kontor"], data: "{\"brightness_pct\": 75}", dataType: "json", x: 550, y: 140, wires: [[]] },
  // Lys chain B: motion -> weekday -> time range -> trigger 3 min (on/off) -> switch -> services
  { id: "pir", z: "T2", type: "server-state-changed", name: "Loft sensor", entities: { entity: ["binary_sensor.loft"] }, ifState: "on", ifStateOperator: "is", outputs: 2, x: 100, y: 400, wires: [["wd"], []] },
  { id: "wd", z: "T2", type: "weekday-gate", weekdays: ["1", "2", "3", "4", "5"], x: 220, y: 400, wires: [["trs"]] },
  { id: "trs", z: "T2", type: "time-range-switch", startTime: "21:00", endTime: "6:00", x: 340, y: 400, wires: [["trg"], []] },
  { id: "trg", z: "T2", type: "trigger", op1: "on", op2: "off", op1type: "str", op2type: "str", duration: "3", units: "min", extend: true, x: 460, y: 400, wires: [["sw3"]] },
  { id: "sw3", z: "T2", type: "switch", property: "payload", propertyType: "msg", rules: [{ t: "eq", v: "on", vt: "str" }, { t: "eq", v: "off", vt: "str" }], x: 580, y: 400, wires: [["gon"], ["goff"]] },
  { id: "gon", z: "T2", type: "api-call-service", action: "light.turn_on", entityId: ["light.gulv"], data: "{\"brightness_pct\": 10}", dataType: "json", x: 700, y: 380, wires: [[]] },
  { id: "goff", z: "T2", type: "api-call-service", action: "light.turn_off", entityId: ["light.gulv"], x: 700, y: 420, wires: [[]] },
  // Lys chain C: device trigger + function + cron inject
  { id: "dev", z: "T2", type: "ha-device", deviceType: "trigger", name: "Ikea puk", x: 100, y: 700, wires: [["fn"]] },
  { id: "fn", z: "T2", type: "function", name: "beregn", x: 250, y: 700, wires: [["gon"]] },
  { id: "cron", z: "T2", type: "inject", name: "Morgen", crontab: "30 06 * * 1-5", repeat: "", payload: "", payloadType: "date", x: 100, y: 900, wires: [["lon"]] },
  { id: "puk", z: "T2", type: "ha-device", deviceType: "trigger", name: "Ikea puk", event: { platform: "device", domain: "mqtt", device_id: "55ec", type: "action", subtype: "toggle", metadata: {} }, x: 100, y: 1100, wires: [["lon"]] },
  { id: "bat", z: "T2", type: "server-state-changed", name: "Batteri lavt", entities: { entity: ["sensor.puk_battery"] }, ifState: "30", ifStateOperator: "lt", for: "10", forUnits: "minutes", x: 100, y: 1300, wires: [["goff"]] },
  { id: "offl", z: "T3", type: "server-state-changed", name: "Offline", entities: { entity: ["light.a", "light.b", "light.c", "switch.d", "sensor.e"] }, ifState: "unavailable", ifStateOperator: "is", for: "10", forUnits: "minutes", x: 100, y: 100, wires: [["note1"]] },
  { id: "note1", z: "T3", type: "api-call-service", action: "notify.mobile_app_jesper_iphone", data: "{\"message\": \"offline\"}", dataType: "json", x: 300, y: 100, wires: [[]] },
  { id: "dis", z: "T2", type: "trigger-state", d: true, entities: { entity: ["light.x"] }, wires: [[], [], []] },
];
const { flows: out, report } = nodeRedImport(flows, ["T1", "T2", "T3"]);
const show = (f) => ({ name: f.name, folder: f.folder, mode: f.mode, nodes: f.nodes.map((n) => `${n.id}:${n.sec}/${n.kind}${n.to ? "=" + n.to : ""}${n.state ? "[" + n.state + "]" + (n.invert ? "!" : "") : ""}${n.seconds ? " " + n.seconds + "s" : ""}${n.service ? " " + n.service : ""}`), edges: f.edges.map((e) => `${e.from}-${e.port}->${e.to}`) });
console.log(JSON.stringify(out.map(show), null, 1));
console.log(JSON.stringify(report, null, 1));
const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exit(1); } };
const h = out.find((f) => f.folder === "Hjælper");
assert(h && h.edges.length === 1 && h.edges[0].from === "sun" && h.edges[0].to === "on", "sun -> change -> switch resolved statically to turn_on only");
const a = out.find((f) => f.nodes.some((n) => n.id === "btn~0"));
assert(a.nodes.find((n) => n.id === "btn~0").kind === "event_entity", "event entity trigger");
assert(a.edges.some((e) => e.from.startsWith("sw2~light.kontor~0") && e.to === "loff") && a.edges.some((e) => e.from.startsWith("sw2~light.kontor~1") && e.to === "lon"), "switch on entity state -> conditions");
assert(a.nodes.find((n) => n.id === "lon").data.brightness_pct === 75, "json data kept");
const b = out.find((f) => f.nodes.some((n) => n.id === "pir~0"));
assert(b.mode === "restart" && a.mode === "parallel", "extend trigger => restart only for that chain");
assert(b.edges.some((e) => e.from === "trs" && e.port === "true" && e.to === "gon") && b.edges.some((e) => e.from === "trs" && e.port === "true" && e.to === "trg~delay") && b.edges.some((e) => e.from === "trg~delay" && e.to === "goff"), "trigger node -> on now, off after delay");
assert(b.nodes.find((n) => n.id === "trg~delay").seconds === 180, "3 min");
assert(b.nodes.find((n) => n.id === "pir~0").to === "on", "ifState => to");
const c = out.find((f) => f.nodes.some((n) => n.id === "cron"));
assert(c && c.nodes.find((n) => n.id === "cron").at === "06:30" && c.nodes.find((n) => n.id === "cron").weekdays.join() === "mon,tue,wed,thu,fri", "cron");
assert(out.every((f) => f.edges.every((e) => !e.to.startsWith("note-"))), "no edges into notes");
assert(!out.some((f) => f.nodes.some((n) => n.id.startsWith("dis"))), "disabled node skipped");
const pukF = out.find((f) => f.nodes.some((n) => n.id === "puk"));
const pk = pukF.nodes.find((n) => n.id === "puk");
assert(pk.kind === "device" && pk.config.subtype === "toggle" && pk.config.device_id === "55ec" && pk.label.includes("Skift"), "ha-device -> device trigger");
const bt = out.flatMap((f) => f.nodes).find((n) => n.id === "bat~0");
assert(bt.kind === "numeric" && bt.below === 30 && bt.for === 600, "lt + for -> numeric below with duration");
const of = out.flatMap((f) => f.nodes).find((n) => n.id === "offl~all");
assert(of && of.entity_id.length === 5 && of.to === "unavailable" && of.for === 600, "many entities -> one card");
fs.writeFileSync("/tmp/claude-0/-home-claude/d59b04c3-c8a7-582a-98af-82177a99dd32/scratchpad/nr_out.json", JSON.stringify(out));
console.log("NODE-RED IMPORT TESTS PASSED");
