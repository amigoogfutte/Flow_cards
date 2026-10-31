import fs from "fs";
const src = fs.readFileSync(new URL("../custom_components/flow_cards/frontend/flow-cards-panel.js", import.meta.url), "utf8");
const block = src.slice(src.indexOf("/* ---- NODE-RED IMPORT START ---- */"), src.indexOf("/* ---- NODE-RED IMPORT END ---- */"));
const labels = src.slice(src.indexOf("const EVENT_LABELS = {"), src.indexOf("const eventLabel"));
const num = (v) => (v === "" || v === undefined || v === null ? undefined : Number(String(v).replace(",", ".")));
const nodeRedImport = new Function("num", labels + block + "; return nodeRedImport;")(num);
// the user's real "Hjælper" tab (positions added)
const z = "b4f27448.856258";
const flows = [
  { id: z, type: "tab", label: "Hjælper" },
  { id: "9b44", type: "switch", z, property: "payload", propertyType: "msg", rules: [{ t: "eq", v: "Sol Op", vt: "str" }, { t: "eq", v: "Sol Ned", vt: "str" }], checkall: "true", outputs: 2, x: 500, y: 100, wires: [["22de"], ["9bcc"]] },
  { id: "22de", type: "api-call-service", z, name: "Daytime", action: "input_boolean.turn_on", entityId: ["input_boolean.nat"], data: "", dataType: "jsonata", x: 700, y: 60, wires: [[]] },
  { id: "9bcc", type: "api-call-service", z, name: "Nighttime", action: "input_boolean.turn_off", entityId: ["input_boolean.nat"], data: "", dataType: "jsonata", x: 700, y: 140, wires: [[]] },
  { id: "3d81", type: "comment", z, name: "Nat Hjælper", wires: [] },
  { id: "4b5a", type: "sun-event-inject", z, name: "Sol op", event: "sunrise", offset: "0", x: 100, y: 60, wires: [["aa7e"]] },
  { id: "b571", type: "template", z, name: "Notification build", field: "payload", fieldType: "msg", format: "handlebars", syntax: "mustache",
    template: "{\n   \"message\": \"{{{payload}}}\",\n   \"title\": \"Sol = \",\n   \"data\": {\n      \"tag\": \"sunset\",\n      \"color\": \"Yellow\",\n      \"channel\": \"sun\",\n      \"importance\": \"high\",\n      \"ttl\": 0,\n      \"priority\": \"high\"\n   }\n}", output: "str", x: 500, y: 250, wires: [["7d2f"]] },
  { id: "7d2f", type: "api-call-service", z, name: "", action: "notify.mobile_app_jesper_iphone", entityId: [], data: "{{{payload}}}", dataType: "json", domain: "notify", service: "mobile_app_jesper_iphone", x: 700, y: 250, wires: [[]] },
  { id: "758c", type: "sun-event-inject", z, name: "Sol ned", event: "sunset", offset: "0", x: 100, y: 160, wires: [["6440"]] },
  { id: "aa7e", type: "change", z, name: "Dag ON", rules: [{ t: "set", p: "payload", pt: "msg", to: "Sol Op", tot: "str" }], x: 300, y: 60, wires: [["9b44", "b571"]] },
  { id: "6440", type: "change", z, name: "Nat OFF", rules: [{ t: "set", p: "payload", pt: "msg", to: "Sol Ned", tot: "str" }], x: 300, y: 160, wires: [["9b44", "b571"]] },
];
const { flows: out, report } = nodeRedImport(flows, [z]);
const f = out[0];
console.log(f.name, f.mode, "| notes:", report[0].notes);
for (const n of f.nodes) console.log(" ", n.id, n.sec, n.kind, n.service || n.event || "", n.data ? JSON.stringify(n.data).slice(0, 60) : "");
console.log(" edges:", f.edges.map((e) => `${e.from}->${e.to}`).join(", "));
const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exit(1); } };
assert(out.length === 1 && report[0].notes.length === 0, "one flow, nothing to check");
const notifies = f.nodes.filter((n) => n.service === "notify.mobile_app_jesper_iphone");
assert(notifies.length === 2, "two notify cards (Sol Op / Sol Ned)");
assert(notifies.map((n) => n.data.message).sort().join() === "Sol Ned,Sol Op" && notifies[0].data.data.tag === "sunset", "message rendered from template");
const up = f.edges.filter((e) => e.from === "4b5a").map((e) => f.nodes.find((n) => n.id === e.to));
assert(up.some((n) => n.id === "22de") && up.some((n) => n.data && n.data.message === "Sol Op") && up.length === 2, "sunrise -> nat on + notify 'Sol Op'");
const down = f.edges.filter((e) => e.from === "758c").map((e) => f.nodes.find((n) => n.id === e.to));
assert(down.some((n) => n.id === "9bcc") && down.some((n) => n.data && n.data.message === "Sol Ned") && down.length === 2, "sunset -> nat off + notify 'Sol Ned'");
fs.writeFileSync("/tmp/claude-0/-home-claude/d59b04c3-c8a7-582a-98af-82177a99dd32/scratchpad/hjaelper.json", JSON.stringify(out));
console.log("HJÆLPER IMPORT TEST PASSED");
