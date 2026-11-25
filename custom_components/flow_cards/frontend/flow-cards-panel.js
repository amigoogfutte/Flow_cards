/* Flow Cards – Homey-style WHEN / AND / THEN flows for Home Assistant. */
const FC_VERSION = "0.6.3";
const WS = "flow_cards";

const WEEKDAYS = [["mon", "man"], ["tue", "tir"], ["wed", "ons"], ["thu", "tor"], ["fri", "fre"], ["sat", "lør"], ["sun", "søn"]];
const SECTIONS = {
  triggers: { label: "Når…", short: "NÅR", cls: "when", add: "Tilføj kort", hint: "Hvad starter flowet?" },
  conditions: { label: "Og…", short: "OG", cls: "and", add: "Tilføj kort", hint: "Betingelser (valgfrit)" },
  actions: { label: "Så…", short: "SÅ", cls: "then", add: "Tilføj kort", hint: "Hvad skal der ske?" },
  else_actions: { label: "Ellers…", short: "ELLERS", cls: "else", add: "Tilføj kort", hint: "Hvis betingelserne ikke er opfyldt" },
  logic: { label: "Logik", short: "LOGIK", cls: "logic", add: "Tilføj logik", hint: "" },
};
const catOf = (sec) => (sec === "triggers" ? "t" : sec === "conditions" ? "c" : sec === "logic" ? "l" : "a");
const MODES = [["single", "Ignorér nye, mens det kører"], ["restart", "Genstart ved ny udløsning"], ["parallel", "Kør parallelt"]];

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clone = (o) => JSON.parse(JSON.stringify(o));
const uid = () => Math.random().toString(16).slice(2, 14);
const pill = (v) => `<span class="pill">${esc(v === undefined || v === "" ? "…" : v)}</span>`;
const stripHtml = (h) => h.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const days = (list) => {
  const l = list || [];
  if (!l.length || l.length === 7) return "alle dage";
  if (l.length === 5 && !l.includes("sat") && !l.includes("sun")) return "hverdage";
  if (l.length === 2 && l.includes("sat") && l.includes("sun")) return "weekend";
  return WEEKDAYS.filter(([k]) => l.includes(k)).map(([, v]) => v).join(", ");
};
const num = (v) => (v === "" || v === undefined || v === null ? undefined : Number(String(v).replace(",", ".")));
const parseJson = (txt, label) => {
  if (!txt || !String(txt).trim()) return {};
  try {
    const v = JSON.parse(txt);
    if (typeof v !== "object" || Array.isArray(v)) throw new Error();
    return v;
  } catch (e) {
    throw new Error(`${label} skal være gyldig JSON, f.eks. {"brightness_pct": 50}`);
  }
};

const DOMAIN_ICONS = {
  light: "mdi:lightbulb", switch: "mdi:toggle-switch", binary_sensor: "mdi:radiobox-marked", sensor: "mdi:eye",
  event: "mdi:gesture-tap-button", button: "mdi:gesture-tap-button", input_button: "mdi:gesture-tap-button",
  cover: "mdi:blinds", climate: "mdi:thermostat", media_player: "mdi:cast", lock: "mdi:lock", person: "mdi:account",
  device_tracker: "mdi:map-marker", scene: "mdi:palette", script: "mdi:script-text", automation: "mdi:robot",
  input_boolean: "mdi:toggle-switch-outline", input_number: "mdi:ray-vertex", number: "mdi:ray-vertex",
  input_select: "mdi:format-list-bulleted", select: "mdi:format-list-bulleted", input_text: "mdi:form-textbox",
  text: "mdi:form-textbox", fan: "mdi:fan", vacuum: "mdi:robot-vacuum", notify: "mdi:message-text",
  sun: "mdi:white-balance-sunny", siren: "mdi:bullhorn", humidifier: "mdi:air-humidifier", remote: "mdi:remote",
  input_datetime: "mdi:calendar-clock", weather: "mdi:weather-partly-cloudy", calendar: "mdi:calendar",
  camera: "mdi:cctv", update: "mdi:package-up", timer: "mdi:timer-outline", counter: "mdi:counter", zone: "mdi:map-marker-radius",
};

const APPS = [
  { id: "time", name: "Dato & tid", icon: "mdi:clock-outline" },
  { id: "sun", name: "Sol", icon: "mdi:weather-sunset" },
  { id: "logic", name: "Logik", icon: "mdi:code-braces" },
  { id: "notify", name: "Notifikationer", icon: "mdi:message-badge-outline" },
  { id: "flows", name: "Flows", icon: "mdi:graph-outline" },
  { id: "events", name: "Hændelser", icon: "mdi:lightning-bolt-outline" },
  { id: "system", name: "Home Assistant", icon: "mdi:home-assistant" },
  { id: "advanced", name: "Avanceret", icon: "mdi:tune-variant" },
];

const EVENT_LABELS = {
  initial_press: "Trykkes ned", short_release: "Kort tryk", press: "Trykkes", pressed: "Trykkes", single: "Enkelt tryk",
  double: "Dobbelt-tryk", double_press: "Dobbelt-tryk", triple: "Tredobbelt tryk", triple_press: "Tredobbelt tryk",
  quadruple: "Firdobbelt tryk", quadruple_press: "Firdobbelt tryk", long_press: "Langt tryk", long: "Langt tryk",
  hold: "Holdes inde", repeat: "Holdes inde (gentages)", long_release: "Slippes efter langt tryk", release: "Slippes",
  rotate_left: "Drejes til venstre", rotate_right: "Drejes til højre", shake: "Rystes", tap: "Bankes på",
  on: "Tænd", off: "Sluk", toggle: "Skift", brightness_move_up: "Lysstyrke op (hold)", brightness_move_down: "Lysstyrke ned (hold)",
  brightness_stop: "Lysstyrke stop", brightness_up_click: "Lysstyrke op (klik)", brightness_down_click: "Lysstyrke ned (klik)",
  arrow_left_click: "Pil venstre", arrow_right_click: "Pil højre", button_short_press: "Kort tryk", button_long_press: "Langt tryk",
  button_double_press: "Dobbelt-tryk", button_triple_press: "Tredobbelt tryk", remote_button_short_press: "Kort tryk",
  remote_button_long_press: "Langt tryk", remote_button_double_press: "Dobbelt-tryk", remote_button_short_release: "Slippes",
  remote_button_long_release: "Slippes efter langt tryk",
};
// Zigbee2MQTT only tells Home Assistant about a button's press types after each has been used once.
// For the usual click family we offer the missing ones too; MQTT waits for them to show up.
const PRESS_FAMILY = ["single", "double", "triple", "quadruple", "hold", "release", "long"];
const devTrigVariants = (own) => {
  const have = new Set(own.map((t) => `${t.domain}|${t.type}|${t.subtype}`));
  const out = [];
  for (const t of own) {
    if (t.domain !== "mqtt" || typeof t.subtype !== "string") continue;
    const m = t.subtype.match(new RegExp(`^(.*?)(${PRESS_FAMILY.join("|")})(.*)$`));
    if (!m) continue;
    for (const kind of PRESS_FAMILY) {
      const sub = `${m[1]}${kind}${m[3]}`;
      const key = `${t.domain}|${t.type}|${sub}`;
      if (have.has(key)) continue;
      have.add(key);
      const c = { ...t, subtype: sub };
      if (typeof t.discovery_id === "string") {
        const i = t.discovery_id.lastIndexOf(t.subtype);
        c.discovery_id = i >= 0 ? t.discovery_id.slice(0, i) + sub + t.discovery_id.slice(i + t.subtype.length) : `${t.discovery_id}_${sub}`;
      }
      out.push(c);
    }
  }
  return out;
};
const eventLabel = (t, short) => {
  const base = EVENT_LABELS[t] || String(t).replace(/_/g, " ");
  return short ? base : `${base.charAt(0).toUpperCase()}${base.slice(1)}${EVENT_LABELS[t] ? "" : ""}`;
};
const ON_OFF = ["light", "switch", "fan", "input_boolean", "siren", "humidifier", "remote"];
const MOTION = ["motion", "occupancy", "presence", "moving"];
const OPENING = ["door", "window", "opening", "garage_door"];
const DURATION_UNITS = [["s", "sekunder"], ["min", "minutter"], ["h", "timer"]];
const UNIT_FACTOR = { s: 1, min: 60, h: 3600 };
const unitShort = { s: "sek", min: "min", h: "t" };

/* ------------------------------------------------------------------ card catalog */

function appDefs(ctx) {
  const fname = (id) => (id ? (ctx.flows.find((f) => f.id === id) || {}).name || "(slettet flow)" : "");
  const ename = (e) => ctx.entityName(e);
  return [
    // Dato & tid
    { id: "time.at", app: "time", cat: "t", text: (a) => `Klokken er ${pill(a.at)}${a.weekdays && a.weekdays.length ? ` på ${pill(days(a.weekdays))}` : ""}`,
      fields: [{ key: "at", label: "Klokkeslæt", type: "time", required: true }, { key: "weekdays", label: "Ugedage (ingen valgt = alle)", type: "weekdays" }],
      build: (a) => ({ kind: "time", at: a.at, weekdays: a.weekdays || [] }) },
    { id: "time.interval", app: "time", cat: "t", text: (a) => `Hvert ${pill(a.minutes)}. minut`,
      fields: [{ key: "minutes", label: "Minutter", type: "number", min: 1, required: true, default: 5 }],
      build: (a) => ({ kind: "interval", minutes: num(a.minutes) }) },
    { id: "time.between", app: "time", cat: "c", text: (a) => `Tiden er mellem ${pill(a.after)} og ${pill(a.before)}`,
      fields: [{ key: "after", label: "Fra", type: "time", required: true, default: "21:00" }, { key: "before", label: "Til", type: "time", required: true, default: "06:00" }],
      build: (a) => ({ kind: "time", after: a.after, before: a.before }) },
    { id: "time.days", app: "time", cat: "c", text: (a) => `Det er ${pill(days(a.weekdays))}`,
      fields: [{ key: "weekdays", label: "Ugedage", type: "weekdays", required: true, default: ["mon", "tue", "wed", "thu", "fri"] }],
      build: (a) => ({ kind: "time", weekdays: a.weekdays }) },
    // Sol
    { id: "sun.sunset", app: "sun", cat: "t",
      text: (a) => `Solen går ned${num(a.offset) ? ` ${pill(`${Math.abs(num(a.offset))} min ${num(a.offset) < 0 ? "før" : "efter"}`)}` : ""}`,
      fields: [{ key: "offset", label: "Forskydning i minutter (negativ = før solnedgang, positiv = efter)", type: "number", default: 0 }],
      build: (a) => ({ kind: "sun", event: "sunset", offset: num(a.offset) || 0 }) },
    { id: "sun.sunrise", app: "sun", cat: "t",
      text: (a) => `Solen står op${num(a.offset) ? ` ${pill(`${Math.abs(num(a.offset))} min ${num(a.offset) < 0 ? "før" : "efter"}`)}` : ""}`,
      fields: [{ key: "offset", label: "Forskydning i minutter (negativ = før solopgang, positiv = efter)", type: "number", default: 0 }],
      build: (a) => ({ kind: "sun", event: "sunrise", offset: num(a.offset) || 0 }) },
    { id: "sun.event", app: "sun", cat: "t", hidden: true,
      text: (a) => `${a.event === "sunrise" ? "Solen står op" : "Solen går ned"}${num(a.offset) ? ` ${pill(`${num(a.offset) > 0 ? "+" : ""}${num(a.offset)} min`)}` : ""}`,
      fields: [{ key: "event", label: "Hændelse", type: "select", options: [["sunset", "Solnedgang"], ["sunrise", "Solopgang"]], default: "sunset" },
        { key: "offset", label: "Forskydning i minutter (negativ = før)", type: "number", default: 0 }],
      build: (a) => ({ kind: "sun", event: a.event, offset: num(a.offset) || 0 }) },
    { id: "sun.down", app: "sun", cat: "c", text: () => "Solen er nede", build: () => ({ kind: "sun", is: "below_horizon" }) },
    { id: "sun.up", app: "sun", cat: "c", text: () => "Solen er oppe", build: () => ({ kind: "sun", is: "above_horizon" }) },
    // Logik
    { id: "logic.delay", app: "logic", cat: "a", text: (a) => `Vent ${pill(`${a.value ?? ""} ${unitShort[a.unit || "s"]}`)}`,
      fields: [{ key: "value", label: "Varighed", type: "number", min: 0, required: true, default: 3 }, { key: "unit", label: "Enhed", type: "select", options: DURATION_UNITS, default: "min" }],
      build: (a) => ({ kind: "delay", seconds: num(a.value) * UNIT_FACTOR[a.unit || "s"] }) },
    { id: "logic.template", app: "logic", cat: "c", text: (a) => `Skabelonen ${pill((a.template || "").slice(0, 40))} er sand`,
      fields: [{ key: "template", label: "Jinja-skabelon", type: "textarea", required: true, placeholder: "{{ states('sensor.temperatur') | float(0) > 20 }}" }],
      build: (a) => ({ kind: "template", template: a.template }) },
    { id: "logic.log", app: "logic", cat: "a", text: (a) => `Skriv i loggen: ${pill(a.message)}`,
      fields: [{ key: "message", label: "Besked (skabeloner er tilladt)", type: "text", required: true },
        { key: "level", label: "Niveau", type: "select", options: [["info", "Info"], ["warning", "Advarsel"], ["error", "Fejl"]], default: "info" }],
      build: (a) => ({ kind: "log", message: a.message, level: a.level || "info" }) },
    { id: "logic.stop", app: "logic", cat: "a", text: () => "Stop flowet her", build: () => ({ kind: "stop" }) },
    // Notifikationer
    { id: "notify.send", app: "notify", cat: "a", text: (a) => `Send ${pill(a.message)} til ${pill(ctx.notifyName(a.service))}`,
      fields: [{ key: "service", label: "Modtager", type: "notify", required: true },
        { key: "title", label: "Titel (valgfri)", type: "text" },
        { key: "message", label: "Besked (skabeloner er tilladt, f.eks. {{ trigger.description }})", type: "textarea", required: true }],
      build: (a) => ({ kind: "notify", service: a.service, title: a.title || "", message: a.message }) },
    // Flows
    { id: "flows.run", app: "flows", cat: "a", text: (a) => `Start flowet ${pill(fname(a.flow_id))}`,
      fields: [{ key: "flow_id", label: "Flow", type: "flow", required: true }, { key: "skip_conditions", label: "Spring flowets OG-kort over", type: "toggle" }],
      build: (a) => ({ kind: "flow_run", flow_id: a.flow_id, skip_conditions: !!a.skip_conditions }) },
    { id: "flows.enable_on", app: "flows", cat: "a", text: (a) => `Slå flowet ${pill(fname(a.flow_id))} til`,
      fields: [{ key: "flow_id", label: "Flow", type: "flow", required: true }],
      build: (a) => ({ kind: "flow_enable", flow_id: a.flow_id, enabled: true }) },
    { id: "flows.enable_off", app: "flows", cat: "a", text: (a) => `Slå flowet ${pill(fname(a.flow_id))} fra`,
      fields: [{ key: "flow_id", label: "Flow", type: "flow", required: true }],
      build: (a) => ({ kind: "flow_enable", flow_id: a.flow_id, enabled: false }) },
    { id: "flows.enable", app: "flows", cat: "a", hidden: true, text: (a) => `Slå flowet ${pill(fname(a.flow_id))} ${a.enabled === "off" ? "fra" : "til"}`,
      fields: [{ key: "flow_id", label: "Flow", type: "flow", required: true }, { key: "enabled", label: "Handling", type: "select", options: [["on", "Slå til"], ["off", "Slå fra"]], default: "on" }],
      build: (a) => ({ kind: "flow_enable", flow_id: a.flow_id, enabled: a.enabled !== "off" }) },
    // Hændelser
    { id: "events.event", app: "events", cat: "t",
      text: (a) => `Hændelsen ${pill(a.event_type)} sker${a.event_data && a.event_data.trim() && a.event_data.trim() !== "{}" ? ` med ${pill(a.event_data.replace(/\s+/g, " "))}` : ""}`,
      fields: [{ key: "event_type", label: "Hændelsestype", type: "text", required: true, list: ["zha_event", "deconz_event", "tag_scanned", "mobile_app_notification_action", "ios.action_fired", "call_service", "state_changed"] },
        { key: "event_data", label: "Skal indeholde data (JSON, valgfrit)", type: "json", placeholder: '{"command": "on"}' }],
      build: (a) => ({ kind: "event", event_type: a.event_type.trim(), event_data: parseJson(a.event_data, "Data") }) },
    // System
    { id: "system.start", app: "system", cat: "t", text: () => "Home Assistant starter", build: () => ({ kind: "start" }) },
    { id: "system.manual", app: "flows", cat: "t", text: () => "Flowet startes manuelt", build: () => ({ kind: "manual" }) },
    // Logik-kort til avancerede flows
    { id: "logic.all", app: "logic", cat: "l", text: () => "Fortsæt, når <b>alle</b> input er modtaget", build: () => ({ kind: "all" }) },
    { id: "logic.any", app: "logic", cat: "l", text: () => "Fortsæt ved det <b>første</b> input", build: () => ({ kind: "any" }) },
    { id: "logic.note", app: "logic", cat: "l", text: (a) => esc(a.text || "Note"),
      fields: [{ key: "text", label: "Note", type: "textarea", required: true }], build: (a) => ({ kind: "note", text: a.text }) },
    // Enheder (HA device triggers, e.g. Zigbee buttons)
    { id: "dev.trigger", app: "device", cat: "t", hidden: true, text: (a) => esc(a.label || "Enhedshændelse"),
      build: (a) => ({ kind: "device", label: a.full || a.label, config: a.config }) },
    // Avanceret
    { id: "adv.state", app: "advanced", cat: "t",
      text: (a) => { const l = Array.isArray(a.entity_id) ? a.entity_id : a.entity_id ? [a.entity_id] : []; return `${pill(l.length ? ename(l[0]) : "")}${l.length > 1 ? ` ${pill(`+${l.length - 1} flere`)}` : ""} ændrer tilstand${a.from ? ` fra ${pill(a.from)}` : ""}${a.to ? ` til ${pill(a.to)}` : ""}${num(a.minutes) ? ` i ${pill(`${a.minutes} min`)}` : ""}`; },
      fields: [{ key: "entity_id", label: "Entiteter (én eller flere)", type: "entities", required: true }, { key: "from", label: "Fra tilstand (valgfri)", type: "text" },
        { key: "to", label: "Til tilstand (valgfri)", type: "text" }, { key: "attribute", label: "Attribut (valgfri)", type: "text" },
        { key: "minutes", label: "I mindst (minutter, valgfri)", type: "number", min: 0 }],
      build: (a) => ({ kind: "state", entity_id: Array.isArray(a.entity_id) ? a.entity_id : [a.entity_id], from: a.from || undefined, to: a.to || undefined, attribute: a.attribute || undefined, for: num(a.minutes) ? num(a.minutes) * 60 : undefined }) },
    { id: "adv.numeric", app: "advanced", cat: "t",
      text: (a) => `${pill(ename(a.entity_id))}${a.attribute ? ` (${esc(a.attribute)})` : ""} bliver${a.above !== undefined && a.above !== "" ? ` over ${pill(a.above)}` : ""}${a.below !== undefined && a.below !== "" ? ` under ${pill(a.below)}` : ""}${num(a.minutes) ? ` i ${pill(`${a.minutes} min`)}` : ""}`,
      fields: [{ key: "entity_id", label: "Entitet", type: "entity", required: true }, { key: "above", label: "Over", type: "number" }, { key: "below", label: "Under", type: "number" }, { key: "attribute", label: "Attribut (valgfri)", type: "text" }, { key: "minutes", label: "I mindst (minutter, valgfri)", type: "number", min: 0 }],
      build: (a) => ({ kind: "numeric", entity_id: [a.entity_id], above: num(a.above), below: num(a.below), attribute: a.attribute || undefined, for: num(a.minutes) ? num(a.minutes) * 60 : undefined }) },
    { id: "adv.state_c", app: "advanced", cat: "c", text: (a) => `${pill(ename(a.entity_id))} er ${pill(a.state)}`,
      fields: [{ key: "entity_id", label: "Entitet", type: "entity", required: true }, { key: "state", label: "Tilstand (flere adskilt med komma)", type: "text", required: true }, { key: "attribute", label: "Attribut (valgfri)", type: "text" }],
      build: (a) => ({ kind: "state", entity_id: [a.entity_id], state: a.state.split(",").map((s) => s.trim()).filter(Boolean), attribute: a.attribute || undefined }) },
    { id: "adv.numeric_c", app: "advanced", cat: "c",
      text: (a) => `${pill(ename(a.entity_id))} er${a.above !== undefined && a.above !== "" ? ` over ${pill(a.above)}` : ""}${a.below !== undefined && a.below !== "" ? ` under ${pill(a.below)}` : ""}`,
      fields: [{ key: "entity_id", label: "Entitet", type: "entity", required: true }, { key: "above", label: "Over", type: "number" }, { key: "below", label: "Under", type: "number" }, { key: "attribute", label: "Attribut (valgfri)", type: "text" }],
      build: (a) => ({ kind: "numeric", entity_id: [a.entity_id], above: num(a.above), below: num(a.below), attribute: a.attribute || undefined }) },
    { id: "adv.service", app: "advanced", cat: "a", text: (a) => `Kald ${pill(a.service)}${a.entity_id ? ` på ${pill(ename(a.entity_id))}` : ""}`,
      fields: [{ key: "service", label: "Tjeneste", type: "service", required: true }, { key: "entity_id", label: "Entitet (valgfri)", type: "entity" },
        { key: "data", label: "Data (JSON, skabeloner er tilladt)", type: "json", placeholder: '{"brightness_pct": 50}' }],
      build: (a) => ({ kind: "service", service: a.service.trim(), entity_id: a.entity_id ? [a.entity_id] : [], data: parseJson(a.data, "Data") }) },
  ];
}

function entityDefs(eid, st) {
  const d = eid.split(".")[0];
  const at = (st && st.attributes) || {};
  const dc = at.device_class;
  const unit = at.unit_of_measurement ? ` ${at.unit_of_measurement}` : "";
  const isNum = st && !isNaN(parseFloat(st.state)) && isFinite(st.state) && (at.unit_of_measurement || at.state_class);
  const defs = [];
  const T = (key, text, build, fields) => defs.push({ id: `e.${key}`, cat: "t", text, build, fields });
  const C = (key, text, build, fields) => defs.push({ id: `e.${key}`, cat: "c", text, build, fields });
  const A = (key, text, build, fields) => defs.push({ id: `e.${key}`, cat: "a", text, build, fields });
  const svc = (service, data) => () => ({ kind: "service", service, data: data || {} });
  const forField = [{ key: "minutes", label: "Minutter", type: "number", min: 0, required: true, default: 5 }];
  const toState = (to, a) => ({ kind: "state", to, for: num(a && a.minutes) ? num(a.minutes) * 60 : undefined });
  const aboveF = [{ key: "above", label: `Værdi${unit}`, type: "number", required: true }];
  const belowF = [{ key: "below", label: `Værdi${unit}`, type: "number", required: true }];

  // ---- triggers
  if (ON_OFF.includes(d)) {
    T("on", () => "Tændes", () => toState("on"));
    T("off", () => "Slukkes", () => toState("off"));
    T("on_for", (a) => `Har været tændt i ${pill(`${a.minutes} min`)}`, (a) => toState("on", a), forField);
    T("off_for", (a) => `Har været slukket i ${pill(`${a.minutes} min`)}`, (a) => toState("off", a), forField);
  } else if (d === "binary_sensor") {
    const [on, off, onFor] = MOTION.includes(dc) ? ["Registrerer bevægelse", "Stopper med at registrere bevægelse", "Ingen bevægelse i"]
      : OPENING.includes(dc) ? ["Åbnes", "Lukkes", "Har været lukket i"] : ["Aktiveres", "Deaktiveres", "Har været deaktiveret i"];
    T("on", () => on, () => toState("on"));
    T("off", () => off, () => toState("off"));
    T("off_for", (a) => `${onFor} ${pill(`${a.minutes} min`)}`, (a) => toState("off", a), forField);
    T("on_for", (a) => `${on.includes("bevægelse") ? "Har registreret bevægelse" : "Har været aktiv"} i ${pill(`${a.minutes} min`)}`, (a) => toState("on", a), forField);
  } else if (d === "event") {
    const types = at.event_types || [];
    for (const t of types) {
      T(`press_${t}`, () => eventLabel(t), () => ({ kind: "event_entity", event_type: [t] }));
    }
    T("press_any", () => (types.length ? "Trykkes på en hvilken som helst måde" : "Trykkes"), () => ({ kind: "event_entity", event_type: [] }));
    T("press", (a) => (a.event_type ? `Trykkes: ${pill(eventLabel(a.event_type, true))}` : "Trykkes (alle typer)"),
      (a) => ({ kind: "event_entity", event_type: a.event_type ? [a.event_type] : [] }),
      [{ key: "event_type", label: "Type", type: "select", options: [["", "Alle typer"], ...types.map((t) => [t, eventLabel(t, true)])], default: types[0] || "" }]);
    defs[defs.length - 1].hidden = true;
  } else if (d === "button" || d === "input_button") {
    T("press", () => "Trykkes", () => ({ kind: "event_entity" }));
  } else if (d === "cover") {
    T("open", () => "Åbnes", () => toState("open"));
    T("closed", () => "Lukkes", () => toState("closed"));
  } else if (d === "lock") {
    T("locked", () => "Låses", () => toState("locked"));
    T("unlocked", () => "Låses op", () => toState("unlocked"));
  } else if (d === "person" || d === "device_tracker") {
    T("home", () => "Kommer hjem", () => toState("home"));
    T("leave", () => "Tager hjemmefra", () => ({ kind: "state", from: "home" }));
  } else if (d === "media_player") {
    T("play", () => "Begynder at afspille", () => toState("playing"));
    T("stop", () => "Stopper med at afspille", () => ({ kind: "state", from: "playing" }));
    T("on", () => "Tændes", () => ({ kind: "state", from: "off" }));
    T("off", () => "Slukkes", () => toState("off"));
  } else if (d === "vacuum") {
    T("clean", () => "Begynder at gøre rent", () => toState("cleaning"));
    T("docked", () => "Er tilbage i dock", () => toState("docked"));
  } else if (d === "climate") {
    T("t_above", (a) => `Temperaturen bliver over ${pill(`${a.above}°`)}`, (a) => ({ kind: "numeric", attribute: "current_temperature", above: num(a.above) }), aboveF);
    T("t_below", (a) => `Temperaturen bliver under ${pill(`${a.below}°`)}`, (a) => ({ kind: "numeric", attribute: "current_temperature", below: num(a.below) }), belowF);
  }
  if (isNum) {
    const forF = { key: "minutes", label: "Og har været det i mindst (minutter, valgfri)", type: "number", min: 0 };
    const forTxt = (a) => (num(a.minutes) ? ` i ${pill(`${a.minutes} min`)}` : "");
    const forVal = (a) => (num(a.minutes) ? num(a.minutes) * 60 : undefined);
    T("above", (a) => `Bliver over ${pill(`${a.above}${unit}`)}${forTxt(a)}`, (a) => ({ kind: "numeric", above: num(a.above), for: forVal(a) }), [...aboveF, forF]);
    T("below", (a) => `Bliver under ${pill(`${a.below}${unit}`)}${forTxt(a)}`, (a) => ({ kind: "numeric", below: num(a.below), for: forVal(a) }), [...belowF, forF]);
  }
  if (!["event", "button", "input_button"].includes(d)) {
    T("to", (a) => `Tilstanden ændres til ${pill(a.to)}`, (a) => ({ kind: "state", to: a.to }), [{ key: "to", label: "Tilstand", type: "text", required: true, default: st ? st.state : "" }]);
    T("change", () => "Tilstanden ændres", () => ({ kind: "state" }));
  }

  // ---- conditions
  if (ON_OFF.includes(d)) C("is_on", () => "Er tændt", () => ({ kind: "state", state: ["on"] }));
  else if (d === "binary_sensor") C("is_on", () => (MOTION.includes(dc) ? "Registrerer bevægelse" : OPENING.includes(dc) ? "Er åben" : "Er aktiv"), () => ({ kind: "state", state: ["on"] }));
  else if (d === "cover") C("is_open", () => "Er åben", () => ({ kind: "state", state: ["open", "opening"] }));
  else if (d === "lock") C("is_locked", () => "Er låst", () => ({ kind: "state", state: ["locked"] }));
  else if (d === "person" || d === "device_tracker") C("is_home", () => "Er hjemme", () => ({ kind: "state", state: ["home"] }));
  else if (d === "media_player") C("is_playing", () => "Afspiller", () => ({ kind: "state", state: ["playing"] }));
  else if (d === "climate") {
    C("t_above", (a) => `Temperaturen er over ${pill(`${a.above}°`)}`, (a) => ({ kind: "numeric", attribute: "current_temperature", above: num(a.above) }), aboveF);
    C("t_below", (a) => `Temperaturen er under ${pill(`${a.below}°`)}`, (a) => ({ kind: "numeric", attribute: "current_temperature", below: num(a.below) }), belowF);
  }
  if (isNum) {
    C("above", (a) => `Er over ${pill(`${a.above}${unit}`)}`, (a) => ({ kind: "numeric", above: num(a.above) }), aboveF);
    C("below", (a) => `Er under ${pill(`${a.below}${unit}`)}`, (a) => ({ kind: "numeric", below: num(a.below) }), belowF);
  }
  if (!["event", "button", "input_button", "scene", "script"].includes(d)) {
    C("state", (a) => `Tilstanden er ${pill(a.state)}`, (a) => ({ kind: "state", state: String(a.state).split(",").map((s) => s.trim()).filter(Boolean) }),
      [{ key: "state", label: "Tilstand (flere adskilt med komma)", type: "text", required: true, default: st ? st.state : "" }]);
  }

  // ---- actions
  if (d === "light") {
    A("on", () => "Tænd", svc("light.turn_on"));
    A("off", () => "Sluk", svc("light.turn_off"));
    A("toggle", () => "Skift tændt/slukket", svc("light.toggle"));
    A("dim", (a) => `Sæt lysstyrke til ${pill(`${a.pct} %`)}${num(a.transition) ? ` over ${pill(`${a.transition} sek`)}` : ""}`,
      (a) => ({ kind: "service", service: "light.turn_on", data: { brightness_pct: num(a.pct), ...(num(a.transition) ? { transition: num(a.transition) } : {}) } }),
      [{ key: "pct", label: "Lysstyrke (%)", type: "range", min: 1, max: 100, required: true, default: 50 }, { key: "transition", label: "Overgang i sekunder (valgfri)", type: "number", min: 0 }]);
    A("brighter", (a) => `Gør lysere med ${pill(`${a.pct} %`)}`, (a) => ({ kind: "service", service: "light.turn_on", data: { brightness_step_pct: num(a.pct) } }),
      [{ key: "pct", label: "Hvor meget lysere (%)", type: "range", min: 1, max: 100, required: true, default: 10 }]);
    A("darker", (a) => `Gør mørkere med ${pill(`${a.pct} %`)}`, (a) => ({ kind: "service", service: "light.turn_on", data: { brightness_step_pct: -num(a.pct) } }),
      [{ key: "pct", label: "Hvor meget mørkere (%)", type: "range", min: 1, max: 100, required: true, default: 10 }]);
    if ((at.supported_color_modes || []).some((m) => ["color_temp", "hs", "xy", "rgb", "rgbw", "rgbww"].includes(m))) {
      A("ct", (a) => `Sæt farvetemperatur til ${pill(`${a.kelvin} K`)}`, (a) => ({ kind: "service", service: "light.turn_on", data: { color_temp_kelvin: num(a.kelvin) } }),
        [{ key: "kelvin", label: "Kelvin", type: "range", min: at.min_color_temp_kelvin || 2000, max: at.max_color_temp_kelvin || 6500, required: true, default: 2700 }]);
    }
  } else if (ON_OFF.includes(d)) {
    A("on", () => "Tænd", svc(`${d}.turn_on`));
    A("off", () => "Sluk", svc(`${d}.turn_off`));
    A("toggle", () => "Skift tændt/slukket", svc(`${d}.toggle`));
  } else if (d === "automation") {
    A("trigger", () => "Kør automationen", svc("automation.trigger"));
    A("on", () => "Slå til", svc("automation.turn_on"));
    A("off", () => "Slå fra", svc("automation.turn_off"));
  } else if (d === "cover") {
    A("open", () => "Åbn", svc("cover.open_cover"));
    A("close", () => "Luk", svc("cover.close_cover"));
    A("stop", () => "Stop", svc("cover.stop_cover"));
    A("pos", (a) => `Sæt position til ${pill(`${a.pos} %`)}`, (a) => ({ kind: "service", service: "cover.set_cover_position", data: { position: num(a.pos) } }),
      [{ key: "pos", label: "Position (%)", type: "range", min: 0, max: 100, required: true, default: 50 }]);
  } else if (d === "climate") {
    A("temp", (a) => `Sæt temperatur til ${pill(`${a.temp}°`)}`, (a) => ({ kind: "service", service: "climate.set_temperature", data: { temperature: num(a.temp) } }),
      [{ key: "temp", label: "Temperatur", type: "number", required: true, default: 21 }]);
    if ((at.hvac_modes || []).length) {
      A("mode", (a) => `Sæt tilstand til ${pill(a.mode)}`, (a) => ({ kind: "service", service: "climate.set_hvac_mode", data: { hvac_mode: a.mode } }),
        [{ key: "mode", label: "Tilstand", type: "select", options: at.hvac_modes.map((m) => [m, m]), required: true, default: at.hvac_modes[0] }]);
    }
  } else if (d === "media_player") {
    A("play", () => "Afspil", svc("media_player.media_play"));
    A("pause", () => "Pause", svc("media_player.media_pause"));
    A("vol", (a) => `Sæt lydstyrke til ${pill(`${a.vol} %`)}`, (a) => ({ kind: "service", service: "media_player.volume_set", data: { volume_level: num(a.vol) / 100 } }),
      [{ key: "vol", label: "Lydstyrke (%)", type: "range", min: 0, max: 100, required: true, default: 30 }]);
    A("on", () => "Tænd", svc("media_player.turn_on"));
    A("off", () => "Sluk", svc("media_player.turn_off"));
    A("say", (a) => `Sig ${pill(a.message)}`, (a) => ({ kind: "service", service: "tts.speak", target_entity_id: [a.tts], data: { media_player_entity_id: eid, message: a.message } }),
      [{ key: "message", label: "Tekst (skabeloner er tilladt)", type: "textarea", required: true }, { key: "tts", label: "Stemme", type: "tts", required: true }]);
  } else if (d === "lock") {
    A("lock", () => "Lås", svc("lock.lock"));
    A("unlock", () => "Lås op", svc("lock.unlock"));
  } else if (d === "scene") {
    A("on", () => "Aktivér scenen", svc("scene.turn_on"));
  } else if (d === "script") {
    A("run", () => "Kør scriptet", svc("script.turn_on"));
  } else if (d === "input_number" || d === "number") {
    A("set", (a) => `Sæt til ${pill(a.value)}`, (a) => ({ kind: "service", service: `${d}.set_value`, data: { value: num(a.value) } }),
      [{ key: "value", label: "Værdi", type: "number", required: true, default: st ? st.state : "" }]);
  } else if (d === "input_select" || d === "select") {
    A("select", (a) => `Vælg ${pill(a.option)}`, (a) => ({ kind: "service", service: `${d}.select_option`, data: { option: a.option } }),
      [{ key: "option", label: "Valg", type: "select", options: (at.options || []).map((o) => [o, o]), required: true, default: (at.options || [])[0] }]);
  } else if (d === "input_text" || d === "text") {
    A("set", (a) => `Sæt teksten til ${pill(a.value)}`, (a) => ({ kind: "service", service: `${d}.set_value`, data: { value: a.value } }),
      [{ key: "value", label: "Tekst (skabeloner er tilladt)", type: "text", required: true }]);
  } else if (d === "button" || d === "input_button") {
    A("press", () => "Tryk", svc(`${d}.press`));
  } else if (d === "vacuum") {
    A("start", () => "Start rengøring", svc("vacuum.start"));
    A("home", () => "Send hjem", svc("vacuum.return_to_base"));
  } else if (d === "notify") {
    A("send", (a) => `Send ${pill(a.message)}`, (a) => ({ kind: "notify", service: eid, title: a.title || "", message: a.message }),
      [{ key: "title", label: "Titel (valgfri)", type: "text" }, { key: "message", label: "Besked (skabeloner er tilladt)", type: "textarea", required: true }]);
  }
  return defs;
}

/* ---- NODE-RED IMPORT START ---- */
/* Converts Node-RED (node-red-contrib-home-assistant-websocket) tabs into advanced flows. */
const NR_DROP = new Set(["debug", "comment", "group", "catch", "status", "complete"]);
const NR_PASS = new Set(["link in", "junction", "rbe", "filter"]);
const NR_SUN = { sunrise: "sunrise", sunriseEnd: "sunrise", dawn: "sunrise", nauticalDawn: "sunrise", goldenHourEnd: "sunrise",
  sunset: "sunset", sunsetStart: "sunset", dusk: "sunset", nauticalDusk: "sunset", goldenHour: "sunset", night: "sunset" };
const NR_DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const NR_EVENTLIKE = ["event", "button", "input_button", "scene"];
const nrUnits = (v, u) => num(v) * ({ milliseconds: 0.001, ms: 0.001, seconds: 1, s: 1, minutes: 60, min: 60, hours: 3600, hour: 3600, h: 3600, days: 86400, day: 86400 }[u] ?? 1);
const nrTime = (v) => (/^\d{1,2}:\d{2}$/.test(String(v || "").trim()) ? String(v).trim().padStart(5, "0") : null);
const nrConst = (v, t) => (t === "str" ? String(v ?? "") : t === "num" ? num(v) : t === "bool" ? String(v) === "true" : undefined);

/* Render a Node-RED mustache template as far as it is known when importing.
   Known msg values are inserted; values that only exist at runtime become Home Assistant templates. Returns null if impossible. */
function nrMustache(str, ctx) {
  let bad = false;
  const val = (expr) => {
    const e = expr.trim();
    if (e === "payload") {
      if (ctx.payload !== undefined) return typeof ctx.payload === "object" ? JSON.stringify(ctx.payload) : String(ctx.payload);
      if (ctx.entity) return `{{ states('${ctx.entity}') }}`;
      bad = true; return "";
    }
    let m = /^data\.(new_state|old_state)\.(.+)$/.exec(e);
    if (m) return `{{ trigger.${m[1] === "new_state" ? "to_state" : "from_state"}.${m[2]} }}`;
    if (e === "data.entity_id" || e === "topic" && ctx.topic === undefined && ctx.entity) return "{{ trigger.entity_id }}";
    const key = e.replace(/^msg\./, "");
    if (ctx.msg && ctx.msg[key] !== undefined) return String(ctx.msg[key]);
    if (key === "topic" && ctx.topic !== undefined) return String(ctx.topic);
    bad = true; return "";
  };
  const out = String(str).replace(/\{\{\{([^}]+)\}\}\}|\{\{([^}]+)\}\}/g, (_, a, b) => val(a || b));
  return bad ? null : out;
}
const nrHash = (str) => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0; return h.toString(36); };

function nrEntities(n) {
  const e = n.entities && Array.isArray(n.entities.entity) ? n.entities.entity : [];
  if (e.length) return e.filter(Boolean);
  if (n.entityidfilter && (!n.entityidfiltertype || n.entityidfiltertype === "exact")) return String(n.entityidfilter).split(",").map((x) => x.trim()).filter(Boolean);
  if (n.entityid) return [n.entityid];
  return [];
}

function nodeRedImport(all, tabIds) {
  const byId = new Map(all.map((n) => [n.id, n]));
  const flows = [];
  const report = [];
  for (const tabId of tabIds) {
    const tab = byId.get(tabId);
    if (!tab) continue;
    const tabNodes = all.filter((n) => n.z === tabId);
    const nodes = [];        // flow-cards nodes
    const edges = [];
    const origin = {};       // fc node id -> node-red id (for grouping)
    const notes = [];
    const fcById = new Map();
    const restartIds = new Set();
    const tabReport = { tab: tab.label || tabId, flows: 0, cards: 0, notes: [], skipped: 0 };
    const pos = (n, dx = 0, dy = 0) => ({ x: Math.round((num(n.x) || 0) * 1.5 + dx), y: Math.round((num(n.y) || 0) * 1.7 + dy) });
    const add = (fc, nr) => { if (!fcById.has(fc.id)) { nodes.push(fc); fcById.set(fc.id, fc); origin[fc.id] = nr.id; } return fc.id; };
    const note = (n, why) => {
      const id = `note-${n.id}`;
      if (!fcById.has(id)) {
        const label = n.name ? `“${n.name}”` : "";
        add({ id, sec: "logic", kind: "note", card: "logic.note", text: "", args: { text: `Node-RED ${n.type} ${label}: ${why}` }, ...pos(n) }, n);
        notes.push(id);
        tabReport.notes.push(`${n.type}${n.name ? ` (${n.name})` : ""}: ${why}`);
      }
      return [];
    };
    const stateCond = (id, entity, states, invert, n, dy) => add({ id, sec: "conditions", kind: "state", card: "adv.state_c", entity_id: [entity], state: states.map(String),
      args: { entity_id: entity, state: states.join(", ") }, ...(invert ? { invert: true } : {}), ...pos(n, 0, dy) }, n);

    /* resolve: which flow-cards nodes does a message sent into node-red node `id` reach? */
    const resolve = (id, ctx, depth = 0) => {
      const n = byId.get(id);
      if (!n || n.d || depth > 40) return [];
      const outs = (i, c = ctx) => (n.wires && n.wires[i] ? n.wires[i].flatMap((t) => resolve(t, c, depth + 1)) : []);
      const allOuts = (c = ctx) => (n.wires || []).flatMap((_, i) => outs(i, c));
      const t = n.type;
      if (NR_DROP.has(t)) return [];
      if (NR_PASS.has(t)) return allOuts();
      if (t === "link out") {
        if (n.mode === "return") return [];
        return (n.links || []).flatMap((l) => resolve(l, ctx, depth + 1));
      }
      if (t === "change") {
        const c = { ...ctx, msg: { ...(ctx.msg || {}) } };
        for (const rule of n.rules || []) {
          if (rule.pt !== "msg") continue;              // flow/global context is not carried over
          const isPayload = rule.p === "payload" || rule.to === "payload";
          if (rule.t === "set") {
            const v = nrConst(rule.to, rule.tot);
            if (rule.p === "payload") { c.payload = v; c.entity = undefined; }
            else if (rule.p === "topic") { c.topic = v; c.msg.topic = v; }
            else c.msg[rule.p] = v;
          } else if (isPayload) { c.payload = undefined; c.entity = undefined; }
          else delete c.msg[rule.p];
        }
        return allOuts(c);
      }
      if (t === "template") {
        if ((n.fieldType || "msg") !== "msg" || (n.field || "payload") !== "payload" || (n.syntax && n.syntax !== "mustache")) return note(n, "skabelonen skriver til andet end msg.payload");
        const out = nrMustache(n.template || "", ctx);
        if (out === null) return note(n, "skabelonen bruger værdier, der først kendes, når flowet kører");
        let payload = out;
        if (n.output === "json") { try { payload = JSON.parse(out); } catch (e) { return note(n, "skabelonen giver ikke gyldig JSON"); } }
        return allOuts({ ...ctx, payload, entity: undefined });
      }
      if (t === "switch") {
        const rules = n.rules || [];
        if (n.property !== "payload" || n.propertyType !== "msg") return note(n, "skifter på andet end msg.payload");
        const firstOnly = String(n.checkall) === "false";
        if (ctx.payload !== undefined) {
          const hits = [];
          for (let i = 0; i < rules.length; i++) {
            const r = rules[i]; const v = nrConst(r.v, r.vt);
            const ok = r.t === "eq" ? String(ctx.payload) === String(v) : r.t === "neq" ? String(ctx.payload) !== String(v)
              : r.t === "else" ? !hits.length : r.t === "true" ? ctx.payload === true || ctx.payload === "true" : r.t === "false" ? ctx.payload === false || ctx.payload === "false" : null;
            if (ok === null) return note(n, `regel "${r.t}" kan ikke oversættes`);
            if (ok) { hits.push(i); if (firstOnly) break; }
          }
          return hits.flatMap((i) => outs(i, ctx));
        }
        if (ctx.entity && rules.every((r) => ["eq", "neq", "else"].includes(r.t))) {
          const eqs = rules.filter((r) => r.t === "eq").map((r) => String(r.v));
          return rules.flatMap((r, i) => {
            const cid = `${n.id}~${ctx.entity}~${i}`;
            if (!fcById.has(cid)) {
              const states = r.t === "else" ? eqs : [String(r.v)];
              stateCond(cid, ctx.entity, states.length ? states : [""], r.t !== "eq", n, i * 120);
              outs(i, { entity: ctx.entity }).forEach((to) => edges.push({ from: cid, port: "true", to }));
            }
            return [cid];
          });
        }
        return note(n, "afhænger af en værdi, der ikke kendes på forhånd");
      }
      if (t === "api-current-state") {
        const e = n.entity_id || (nrEntities(n)[0]);
        if (!e) return note(n, "ingen entitet");
        if (n.halt_if === "" || n.halt_if === undefined) return allOuts({ entity: e, payload: undefined });
        if (!["is", "is_not"].includes(n.halt_if_compare || "is")) return note(n, `sammenligning "${n.halt_if_compare}" kan ikke oversættes`);
        const cid = stateCond(n.id, e, [String(n.halt_if)], n.halt_if_compare === "is_not", n, 0);
        wire(n, cid, (i) => (i === 0 ? "true" : "false"), { entity: e });
        return [cid];
      }
      if (t === "time-range-switch") {
        const a = nrTime(n.startTime), b = nrTime(n.endTime);
        let cid;
        if (a && b) cid = add({ id: n.id, sec: "conditions", kind: "time", card: "time.between", after: a, before: b, args: { after: a, before: b }, ...pos(n) }, n);
        else if (NR_SUN[n.startTime] === "sunset" && NR_SUN[n.endTime] === "sunrise") cid = add({ id: n.id, sec: "conditions", kind: "sun", card: "sun.down", is: "below_horizon", args: {}, ...pos(n) }, n);
        else if (NR_SUN[n.startTime] === "sunrise" && NR_SUN[n.endTime] === "sunset") cid = add({ id: n.id, sec: "conditions", kind: "sun", card: "sun.up", is: "above_horizon", args: {}, ...pos(n) }, n);
        else return note(n, `tidsrum ${n.startTime}–${n.endTime} kan ikke oversættes`);
        wire(n, cid, (i) => (i === 0 ? "true" : "false"), ctx);
        return [cid];
      }
      if (t === "weekday-gate") {
        const days = (n.weekdays || []).map((d) => NR_DAYS[Number(d)]).filter(Boolean);
        if (!days.length) return note(n, "ingen ugedage valgt");
        const cid = add({ id: n.id, sec: "conditions", kind: "time", card: "time.days", weekdays: days, args: { weekdays: days }, ...pos(n) }, n);
        wire(n, cid, () => "true", ctx);
        return [cid];
      }
      if (t === "delay") {
        if (n.pauseType !== "delay" && n.pauseType !== "delayv") return allOuts();
        const sec = nrUnits(n.timeout, n.timeoutUnits);
        if (!(sec > 0)) return allOuts();
        const cid = add({ id: n.id, sec: "actions", kind: "delay", card: "logic.delay", seconds: sec, args: { value: sec, unit: "s" }, ...pos(n) }, n);
        wire(n, cid, () => "out", ctx);
        return [cid];
      }
      if (t === "trigger") {
        const sec = nrUnits(Math.abs(num(n.duration) || 0), n.units === "ms" ? "ms" : n.units === "s" ? "s" : n.units === "min" ? "min" : n.units === "hr" ? "h" : n.units);
        if (n.extend) restartIds.add(n.id);
        const first = n.op1type === "nul" ? [] : outs(0, { ...ctx, payload: n.op1type === "pay" ? ctx.payload : nrConst(n.op1, n.op1type) });
        if (n.op2type === "nul" || !(sec > 0) || num(n.duration) < 0) return first;
        const did = `${n.id}~delay`;
        if (!fcById.has(did)) {
          add({ id: did, sec: "actions", kind: "delay", card: "logic.delay", seconds: sec, args: { value: sec, unit: "s" }, ...pos(n, 0, 110) }, n);
          outs(0, { ...ctx, payload: n.op2type === "pay" || n.op2type === "payl" ? ctx.payload : nrConst(n.op2, n.op2type) })
            .forEach((to) => edges.push({ from: did, port: "out", to }));
        }
        return [...first, did];
      }
      if (t === "api-call-service") {
        const service = n.action || (n.domain && n.service ? `${n.domain}.${n.service}` : "");
        if (!service.includes(".") || /[{}]/.test(service)) return note(n, "tjenesten er dynamisk");
        let ents = Array.isArray(n.entityId) ? n.entityId : n.entityId ? String(n.entityId).split(",") : [];
        ents = ents.map((x) => String(x).trim()).filter((x) => x && !/[{}]/.test(x));
        let data = {};
        let raw = String(n.data || "").trim();
        let dynamic = false;
        if (raw && /\{\{/.test(raw) && n.dataType !== "jsonata") {
          const m = nrMustache(raw, ctx);
          if (m === null) return note(n, "data bruger værdier, der først kendes, når flowet kører");
          raw = m; dynamic = true;
        }
        if (raw) {
          try { data = JSON.parse(raw); if (typeof data !== "object" || Array.isArray(data)) throw new Error(); }
          catch (e) { data = {}; tabReport.notes.push(`${n.name || service}: data "${raw.slice(0, 40)}" er udeladt (JSONata)`); }
        }
        const cid0 = dynamic ? `${n.id}~${nrHash(JSON.stringify(data))}` : n.id;
        const variants = dynamic ? nodes.filter((x) => origin[x.id] === n.id && x.id !== cid0).length : 0;
        if (fcById.has(cid0)) return [cid0];
        const cid = add({ id: cid0, sec: "actions", kind: "service", card: "adv.service", service, entity_id: ents, data,
          args: { service, entity_id: ents[0] || "", data: Object.keys(data).length ? JSON.stringify(data) : "" }, ...pos(n, 0, variants * 120) }, n);
        wire(n, cid, () => "out", {});
        return [cid];
      }
      return note(n, "kan ikke oversættes automatisk");
    };

    /* wire every output of a converted node-red node to whatever it reaches */
    const wired = new Set();
    function wire(n, fcId, portOf, ctx) {
      const key = `${fcId}`;
      if (wired.has(key)) return;
      wired.add(key);
      (n.wires || []).forEach((targets, i) => {
        const port = portOf(i);
        if (!port) return;
        targets.flatMap((t) => resolve(t, ctx)).forEach((to) => edges.push({ from: fcId, port, to }));
      });
    }

    /* triggers */
    for (const n of tabNodes) {
      if (n.d) continue;
      const t = n.type;
      const mk = (fc, ctx, outputs = [0], k = 0) => {
        const id = add({ ...fc, sec: "triggers", ...pos(n, 0, k * 120) }, n);
        outputs.forEach((o) => (n.wires && n.wires[o] ? n.wires[o] : []).flatMap((x) => resolve(x, ctx)).forEach((to) => edges.push({ from: id, port: "out", to })));
      };
      if (t === "server-state-changed" || t === "trigger-state") {
        const ents = nrEntities(n);
        if (!ents.length) { note(n, "bruger mønster/regex i stedet for faste entiteter"); continue; }
        const forS = n.for && num(n.for) > 0 ? nrUnits(n.for, n.forUnits || "minutes") : 0;
        const opNum = { lt: "below", lte: "below", gt: "above", gte: "above" }[n.ifStateOperator];
        if (t === "server-state-changed" && n.ifState !== "" && n.ifState !== undefined && opNum && num(n.ifState) !== undefined && !isNaN(num(n.ifState))) {
          ents.forEach((e, k) => mk({ id: `${n.id}~${k}`, kind: "numeric", card: "adv.numeric", entity_id: [e], [opNum]: num(n.ifState), ...(forS ? { for: forS } : {}),
            args: { entity_id: e, [opNum]: num(n.ifState), ...(forS ? { minutes: Math.round((forS / 60) * 100) / 100 } : {}) } }, { entity: e }, [0], k));
          if (n.wires && n.wires[1] && n.wires[1].length) tabReport.notes.push(`${n.name || ents[0]}: "ellers"-udgangen er ikke overført`);
          continue;
        }
        if (t === "server-state-changed" && ents.length > 3 && !ents.some((e) => NR_EVENTLIKE.includes(e.split(".")[0]))) {
          const to = n.ifState && (n.ifStateOperator || "is") === "is" ? String(n.ifState) : undefined;
          mk({ id: `${n.id}~all`, kind: "state", card: "adv.state", entity_id: ents, ...(to ? { to } : {}), ...(forS ? { for: forS } : {}),
            args: { entity_id: ents, ...(to ? { to } : {}), ...(forS ? { minutes: Math.round((forS / 60) * 100) / 100 } : {}) } }, {}, [0]);
          continue;
        }
        ents.forEach((e, k) => {
          const dom = e.split(".")[0];
          if (NR_EVENTLIKE.includes(dom)) {
            mk({ id: `${n.id}~${k}`, kind: "event_entity", card: "e.press_any", entity_id: [e], event_type: [], args: {} }, { entity: e }, [0], k);
            return;
          }
          if (t === "trigger-state") {
            mk({ id: `${n.id}~${k}`, kind: "state", card: "adv.state", entity_id: [e], args: { entity_id: e } }, { entity: e }, [0], k);
            (n.customOutputs || []).forEach((co, j) => {
              if (co.comparatorPropertyValue === "new_state.state" && co.comparatorType === "is") {
                mk({ id: `${n.id}~${k}~c${j}`, kind: "state", card: "adv.state", entity_id: [e], to: String(co.comparatorValue), args: { entity_id: e, to: String(co.comparatorValue) } },
                  { entity: e, payload: String(co.comparatorValue) }, [2 + j], k + j + 1);
              }
            });
            if ((n.constraints || []).length) tabReport.notes.push(`${n.name || e}: betingelser i trigger-state er ikke overført`);
            return;
          }
          const to = n.ifState && (n.ifStateOperator || "is") === "is" ? String(n.ifState) : undefined;
          const base = { kind: "state", card: "adv.state", entity_id: [e], ...(to ? { to } : {}), ...(forS ? { for: forS } : {}),
            args: { entity_id: e, ...(to ? { to } : {}), ...(forS ? { minutes: Math.round((forS / 60) * 100) / 100 } : {}) } };
          mk({ id: `${n.id}~${k}`, ...base }, { entity: e, payload: to }, [0], k);
          if (to && n.wires && n.wires[1] && n.wires[1].length) {
            const tid = `${n.id}~${k}~else`;
            mk({ id: tid, kind: "state", card: "adv.state", entity_id: [e], args: { entity_id: e } }, { entity: e }, [], k + 1);
            const cid = stateCond(`${tid}~c`, e, [to], true, n, (k + 1) * 120 + 60);
            edges.push({ from: tid, port: "out", to: cid });
            n.wires[1].flatMap((x) => resolve(x, { entity: e })).forEach((dst) => edges.push({ from: cid, port: "true", to: dst }));
          }
          if (n.ifState && !to) tabReport.notes.push(`${n.name || e}: "hvis tilstand ${n.ifStateOperator} ${n.ifState}" er ikke overført`);
        });
      } else if (t === "inject") {
        const ctx = { payload: nrConst(n.payload, n.payloadType) };
        const cron = String(n.crontab || "").trim().split(/\s+/);
        if (cron.length >= 5 && /^\d+$/.test(cron[0]) && /^\d+$/.test(cron[1])) {
          const at = `${cron[1].padStart(2, "0")}:${cron[0].padStart(2, "0")}`;
          const days = cron[4] === "*" ? [] : cron[4].split(",").flatMap((d) => (d.includes("-") ? (() => { const [a, b] = d.split("-").map(Number); return Array.from({ length: b - a + 1 }, (_, i) => a + i); })() : [Number(d)])).map((d) => NR_DAYS[d % 7]).filter(Boolean);
          mk({ id: n.id, kind: "time", card: "time.at", at, weekdays: days, args: { at, weekdays: days } }, ctx);
        } else if (num(n.repeat) > 0) {
          const minutes = Math.max(1, Math.round(num(n.repeat) / 60));
          mk({ id: n.id, kind: "interval", card: "time.interval", minutes, args: { minutes } }, ctx);
          if (num(n.repeat) < 60) tabReport.notes.push(`${n.name || "inject"}: gentagelse hvert ${n.repeat}. sekund er sat til hvert minut`);
        } else if (n.once) {
          mk({ id: n.id, kind: "start", card: "system.start", args: {} }, ctx);
        } else if (cron[0]) {
          note(n, `tidsplanen "${n.crontab}" kan ikke oversættes`);
        } else {
          mk({ id: n.id, kind: "manual", card: "system.manual", args: {} }, ctx);
        }
      } else if (t === "sun-event-inject") {
        const ev = NR_SUN[n.event];
        if (!ev) { note(n, `solhændelsen "${n.event}" kendes ikke`); continue; }
        const offset = Math.round(num(n.offset) || 0);
        mk({ id: n.id, kind: "sun", card: `sun.${ev}`, event: ev, offset, args: { offset } }, {});
        if (ev !== n.event) tabReport.notes.push(`${n.name || n.event}: "${n.event}" er sat til ${ev === "sunset" ? "solnedgang" : "solopgang"}`);
      } else if (t === "ha-device" && n.deviceType === "trigger") {
        const ev = n.event || {};
        if (!ev.device_id || !ev.domain) { note(n, "enheds-trigger uden enhed"); continue; }
        const sub = ev.subtype ? EVENT_LABELS[ev.subtype] || String(ev.subtype).replace(/_/g, " ") : "";
        const label = ev.type === "action" && sub ? `Sender “${sub}”` : [String(ev.type || "").replace(/_/g, " "), sub].filter(Boolean).join(": ");
        const config = { platform: "device", ...ev };
        mk({ id: n.id, kind: "device", card: "dev.trigger", label: n.name ? `${n.name}: ${label}` : label, config, args: { label, full: n.name ? `${n.name}: ${label}` : label, config } }, {});
      } else if (["server-events", "poll-state", "ha-webhook", "ha-time", "zone", "ha-tag", "ha-sentence", "http in", "mqtt in"].includes(t)) {
        note(n, "denne type start kan ikke oversættes endnu");
      }
    }

    /* anything left that does real work but was never converted becomes a note, so nothing silently disappears */
    const touched = new Set(Object.values(origin));
    const NR_CONFIG = /config|^server$|^tab$|^subflow$|^global-config$|^ha-entity-config$|connection/;
    for (const n of tabNodes) {
      if (n.d || touched.has(n.id) || NR_DROP.has(n.type) || NR_PASS.has(n.type) || NR_CONFIG.test(n.type)) continue;
      if (["change", "switch", "template", "link out", "inject", "sun-event-inject", "server-state-changed", "trigger-state", "trigger", "delay", "api-current-state"].includes(n.type)) continue;
      note(n, "kan ikke oversættes automatisk");
    }

    /* group into independent chains (node-red wiring + link nodes) */
    const parent = {};
    const find = (x) => (parent[x] === undefined || parent[x] === x ? (parent[x] = x) : (parent[x] = find(parent[x])));
    const union = (a, b) => { parent[find(a)] = find(b); };
    for (const n of tabNodes) {
      (n.wires || []).flat().forEach((t) => byId.has(t) && union(n.id, t));
      if (n.type === "link out") (n.links || []).forEach((l) => byId.has(l) && byId.get(l).z === tabId && union(n.id, l));
    }
    const groups = new Map();
    for (const fc of nodes) {
      const key = find(origin[fc.id]);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(fc);
    }
    const sorted = [...groups.values()].sort((a, b) => Math.min(...a.map((x) => x.y)) - Math.min(...b.map((x) => x.y)));
    const multi = sorted.filter((g) => g.some((x) => x.sec === "triggers")).length > 1;
    sorted.forEach((group, gi) => {
      const ids = new Set(group.map((x) => x.id));
      const triggers = group.filter((x) => x.sec === "triggers");
      if (!triggers.length) { tabReport.skipped += group.filter((x) => x.kind !== "note").length; return; }
      const minX = Math.min(...group.map((x) => x.x)), minY = Math.min(...group.map((x) => x.y));
      const gNodes = group.map((x) => ({ ...x, x: x.x - minX + 40, y: x.y - minY + 40 }));
      const seen = new Set();
      const gEdges = edges.filter((e) => ids.has(e.from) && ids.has(e.to) && !notes.includes(e.to)).filter((e) => {
        const k = `${e.from}|${e.port}|${e.to}`; if (seen.has(k)) return false; seen.add(k); return true;
      });
      const firstNr = byId.get(origin[triggers[0].id]);
      const label = (firstNr && firstNr.name) || "";
      flows.push({
        type: "advanced",
        name: multi ? `${tab.label}: ${label || `kæde ${gi + 1}`}` : tab.label || "Node-RED",
        folder: tab.label || "Node-RED",
        enabled: false,
        mode: group.some((x) => restartIds.has(origin[x.id])) ? "restart" : "parallel",
        condition_mode: "all",
        description: `Importeret fra Node-RED-fanen "${tab.label}"`,
        triggers: [], conditions: [], actions: [], else_actions: [],
        nodes: gNodes, edges: gEdges,
        _nrTab: tabId,
      });
      tabReport.flows += 1;
      tabReport.cards += gNodes.filter((x) => x.kind !== "note").length;
    });
    report.push(tabReport);
  }
  return { flows, report };
}
/* ---- NODE-RED IMPORT END ---- */

/* Convert a standard (column) flow into an advanced (canvas) flow. */
function toAdvanced(f) {
  const nodes = [];
  const edges = [];
  const W = 320;
  const put = (card, sec, col, row) => { const n = { ...clone(card), sec, x: 40 + col * W, y: 40 + row * 140 }; nodes.push(n); return n; };
  const trig = f.triggers.map((c, i) => put(c, "triggers", 0, i));
  const conds = f.conditions.map((c, i) => put(c, "conditions", 1 + i, 0));
  const startCol = 1 + conds.length;
  const acts = f.actions.map((c, i) => put(c, "actions", startCol + i, 0));
  const els = f.else_actions.map((c, i) => put(c, "actions", startCol + i, 2));
  const chain = (list) => list.forEach((n, i) => i && edges.push({ from: list[i - 1].id, port: "out", to: n.id }));
  chain(acts); chain(els);
  const firstAfter = conds.length ? conds[0] : acts[0];
  if (firstAfter) trig.forEach((t) => edges.push({ from: t.id, port: "out", to: firstAfter.id }));
  if (conds.length) {
    const any = f.condition_mode === "any";
    conds.forEach((c, i) => {
      const next = conds[i + 1];
      if (any) {
        if (acts[0]) edges.push({ from: c.id, port: "true", to: acts[0].id });
        if (next) edges.push({ from: c.id, port: "false", to: next.id });
        else if (els[0]) edges.push({ from: c.id, port: "false", to: els[0].id });
      } else {
        if (next) edges.push({ from: c.id, port: "true", to: next.id });
        else if (acts[0]) edges.push({ from: c.id, port: "true", to: acts[0].id });
        if (els[0]) edges.push({ from: c.id, port: "false", to: els[0].id });
      }
    });
  }
  return { ...clone(f), type: "advanced", nodes, edges, triggers: [], conditions: [], actions: [], else_actions: [] };
}

/* ------------------------------------------------------------------ styles */

const fLeaf = (p) => String(p).split("/").pop();
const fLabel = (p) => String(p).split("/").join(" › ");
const HY_RAIL = [["home", "mdi:home", "Hjem", "/"], ["devices", "mdi:view-grid", "Enheder", null], ["flows", "mdi:shuffle-variant", "Flows", null],
  ["insights", "mdi:chart-bar", "Indsigt", "/history"], ["script", "mdi:code-tags", "Script", "/config/script/dashboard"], ["settings", "mdi:cog", "Indstil.", "/config"]];
const D_ORDER = ["light", "switch", "fan", "cover", "lock", "climate", "media_player", "vacuum", "humidifier", "water_heater", "valve", "siren", "input_boolean", "remote", "alarm_control_panel", "camera", "binary_sensor", "event", "sensor", "button", "number", "select"];
const dPrio = (eid) => { const i = D_ORDER.indexOf(eid.split(".")[0]); return i < 0 ? 99 : i; };
const DEV_STATE = { on: "Tændt", off: "Slukket", open: "Åben", closed: "Lukket", opening: "Åbner", closing: "Lukker", locked: "Låst", unlocked: "Ulåst", playing: "Afspiller", paused: "Pause", idle: "Inaktiv", standby: "Standby", home: "Hjemme", not_home: "Ude", unknown: "Ukendt", heat: "Varme", cool: "Køl", auto: "Auto", cleaning: "Gør rent", docked: "I dock", returning: "På vej hjem" };
const DEV_OFF = new Set(["off", "closed", "idle", "standby", "paused", "docked", "not_home", "unknown"]);
const DEV_TOGGLE = new Set(["light", "switch", "fan", "input_boolean", "siren", "humidifier", "remote", "media_player", "climate", "water_heater", "vacuum", "valve"]);
const APP_COLORS = { time: "#e5281e", sun: "#ff9f0a", logic: "#28a745", notify: "#1f4e79", flows: "#34c759", events: "#ffcc00", system: "#0a84ff", advanced: "#8e8e93" };
const STYLE = `
:host{display:block;min-height:100%;--fc-when:#3b6fd8;--fc-and:#d4891a;--fc-then:#1f9d6b;--fc-else:#c8553d;
  --fc-bg:var(--primary-background-color,#f3f4f6);--fc-card:var(--card-background-color,#fff);--fc-text:var(--primary-text-color,#1f2328);
  --fc-muted:var(--secondary-text-color,#6b7280);--fc-line:var(--divider-color,rgba(0,0,0,.12));--fc-accent:var(--primary-color,#03a9f4);
  --fc-ok:#1f9d6b;--fc-err:#d0423b;--fc-warn:#d4891a;color:var(--fc-text);background:var(--fc-bg);font-family:var(--paper-font-body1_-_font-family,inherit);}
*{box-sizing:border-box}
button{font:inherit;color:inherit;cursor:pointer;border:0;background:none}
input,select,textarea{font:inherit;color:var(--fc-text);background:var(--fc-card);border:1px solid var(--fc-line);border-radius:8px;padding:8px 10px;width:100%}
textarea{min-height:80px;resize:vertical}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px}
ha-icon{--mdc-icon-size:20px;display:inline-flex}
.top{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:8px;height:56px;padding:0 12px;background:var(--app-header-background-color,var(--fc-card));color:var(--app-header-text-color,var(--fc-text));border-bottom:1px solid var(--fc-line)}
.top h1{font-size:20px;font-weight:500;margin:0 8px 0 4px;white-space:nowrap}
.top .grow{flex:1;min-width:0}
.icon-btn{width:40px;height:40px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex:none}
.icon-btn:hover{background:rgba(127,127,127,.15)}
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:999px;font-weight:500;white-space:nowrap}
.btn.primary{background:var(--fc-accent);color:var(--text-primary-color,#fff)}
.btn.ghost{border:1px solid var(--fc-line)}
.btn.danger{color:var(--fc-err)}
.btn:disabled{opacity:.5;cursor:default}
.layout{display:flex;min-height:calc(100% - 56px)}
.side{width:230px;flex:none;padding:12px 8px;border-right:1px solid var(--fc-line)}
.side .f{cursor:pointer;display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;border-radius:10px;text-align:left}
.side .f.sel{background:rgba(127,127,127,.15);font-weight:600}
.side .f .n{margin-left:auto;color:var(--fc-muted);font-size:12px}
.side .f .tools{display:none;margin-left:4px}
.side .f:hover .tools{display:inline-flex}
.side .f.sel .tools{display:inline-flex}
.side .tools button{padding:2px;color:var(--fc-muted)}
.main{flex:1;min-width:0;padding:16px;max-width:1100px}
.search{max-width:360px}
.list{display:flex;flex-direction:column;gap:8px;margin-top:12px}
.row{display:flex;align-items:center;gap:12px;background:var(--fc-card);border-radius:14px;padding:12px 14px;box-shadow:var(--ha-card-box-shadow,0 1px 2px rgba(0,0,0,.08));cursor:pointer}
.row.off{opacity:.55}
.row .dot{width:10px;height:10px;border-radius:50%;background:var(--fc-line);flex:none}
.row .dot.ok{background:var(--fc-ok)}.row .dot.error{background:var(--fc-err)}.row .dot.running{background:var(--fc-accent);animation:pulse 1s infinite}
@keyframes pulse{50%{opacity:.3}}
.row .info{flex:1;min-width:0}
.row .name{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.row .sum{color:var(--fc-muted);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.row .err{color:var(--fc-err);font-size:12px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.row .when{color:var(--fc-muted);font-size:12px;white-space:nowrap}
.chip{font-size:11px;padding:2px 8px;border-radius:999px;background:rgba(127,127,127,.15);color:var(--fc-muted);white-space:nowrap}
.switch{position:relative;width:38px;height:22px;flex:none;border-radius:999px;background:var(--fc-line);transition:.15s}
.switch::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:.15s;box-shadow:0 1px 2px rgba(0,0,0,.3)}
.switch.on{background:var(--fc-accent)}.switch.on::after{left:19px}
.empty{text-align:center;color:var(--fc-muted);padding:48px 16px}
.empty ha-icon{--mdc-icon-size:48px;opacity:.5}
/* editor */
.name-input{font-size:18px;font-weight:500;border-color:transparent;background:transparent;color:inherit;flex:1 1 auto;min-width:60px;max-width:560px;margin-right:auto}
.notlbl{color:var(--fc-and)}
.name-input:hover,.name-input:focus{border-color:var(--fc-line);background:var(--fc-card);color:var(--fc-text)}
.meta{display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding:12px 16px 0}
.meta label{display:flex;align-items:center;gap:8px;color:var(--fc-muted);font-size:13px}
.meta select{width:auto}
.board{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;padding:16px;align-items:start}
.col{background:rgba(127,127,127,.07);border-radius:16px;padding:12px;min-height:140px}
.col h2{display:flex;align-items:center;gap:8px;margin:2px 4px 10px;font-size:15px;font-weight:700}
.col h2 .bar{width:6px;height:18px;border-radius:3px;background:var(--c)}
.col h2 .hint{font-weight:400;color:var(--fc-muted);font-size:12px;margin-left:auto}
.col.when{--c:var(--fc-when)}.col.and{--c:var(--fc-and)}.col.then{--c:var(--fc-then)}.col.else{--c:var(--fc-else)}
.stack{display:flex;flex-direction:column;gap:10px}
.then-wrap{display:flex;flex-direction:column;gap:16px}
.card{position:relative;background:var(--fc-card);border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.12);border-top:4px solid var(--c);cursor:pointer;transition:transform .1s}
.card:hover{transform:translateY(-1px)}
.card.dragging{opacity:.4}
.card.disabled{opacity:.5}
.card .head{display:flex;align-items:center;gap:8px;padding:8px 10px 0;color:var(--c);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.02em}
.card .head .src{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card .head button{color:var(--fc-muted);padding:2px;border-radius:6px;display:inline-flex}
.card .head button:hover{background:rgba(127,127,127,.15)}
.card .body{padding:6px 12px 12px;font-size:15px;line-height:1.6}
.card .not{background:var(--fc-and);color:#fff;border-radius:6px;padding:0 6px;font-size:11px;font-weight:700;text-transform:none}
.card .not.off{background:transparent;color:var(--fc-muted);border:1px dashed var(--fc-line)}
.pill{display:inline-block;padding:0 8px;border-radius:999px;background:color-mix(in srgb,var(--c,#888) 16%,transparent);color:var(--fc-text);font-weight:600;line-height:1.5;max-width:100%;overflow:hidden;text-overflow:ellipsis;vertical-align:bottom;white-space:nowrap}
.badge{position:absolute;top:-8px;right:-6px;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:700;box-shadow:0 1px 3px rgba(0,0,0,.3)}
.badge.success,.badge.true{background:var(--fc-ok)}.badge.error{background:var(--fc-err)}.badge.false{background:var(--fc-muted)}.badge.cancelled,.badge.skipped{background:var(--fc-warn)}
.add{width:100%;padding:12px;border:2px dashed var(--fc-line);border-radius:12px;color:var(--fc-muted);display:flex;align-items:center;justify-content:center;gap:6px}
.add:hover{border-color:var(--c);color:var(--c)}
.andmode{display:flex;gap:4px;margin:0 4px 10px;font-size:12px}
.andmode button{padding:3px 10px;border-radius:999px;border:1px solid var(--fc-line);color:var(--fc-muted)}
.andmode button.sel{background:var(--fc-and);color:#fff;border-color:var(--fc-and)}
.lastrun{margin:0 16px;padding:10px 14px;border-radius:12px;background:var(--fc-card);display:flex;gap:10px;align-items:center;font-size:13px}
.lastrun.error{border-left:4px solid var(--fc-err)}
.lastrun.success{border-left:4px solid var(--fc-ok)}
/* modal */
.scrim{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:20;display:flex;align-items:center;justify-content:center;padding:16px}
.modal{background:var(--fc-card);border-radius:20px;width:min(620px,100%);max-height:min(760px,100%);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.35)}
.modal.wide{width:min(820px,100%)}
.modal header{display:flex;align-items:center;gap:8px;padding:14px 16px;border-bottom:1px solid var(--fc-line)}
.modal header h3{margin:0;font-size:17px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.modal .content{padding:16px;overflow:auto;flex:1}
.modal footer{display:flex;justify-content:flex-end;gap:8px;padding:12px 16px;border-top:1px solid var(--fc-line)}
.apps{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-bottom:18px}
.app{display:flex;flex-direction:column;align-items:center;gap:8px;padding:14px 8px;border-radius:14px;background:rgba(127,127,127,.08);text-align:center;font-size:13px}
.app:hover{background:rgba(127,127,127,.16)}
.app .ic{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:var(--c);color:#fff}
.app .ic ha-icon{--mdc-icon-size:24px}
.sub{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--fc-muted);margin:14px 2px 8px}
.devs{display:flex;flex-direction:column}
.dev{display:flex;align-items:center;gap:12px;padding:10px 8px;border-radius:10px;text-align:left;width:100%}
.dev:hover{background:rgba(127,127,127,.1)}
.dev .ic{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:rgba(127,127,127,.12);flex:none}
.dev .t{flex:1;min-width:0}.dev .t div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dev .t .s{font-size:12px;color:var(--fc-muted)}
.defs{display:flex;flex-direction:column;gap:8px}
.def.cur{outline:2px solid var(--fc-accent,#ff8a00);outline-offset:-2px}
.def .curtag{font-size:11px;opacity:.75;margin-left:6px}
.node .lin{font-size:11px;color:var(--fc-muted);margin-top:4px;line-height:1.3}
.node .lin.warn{color:var(--error-color,#db4437)}
.swap{margin-bottom:12px}.swap .sub{margin:0 2px 6px}
.swap-row{display:flex;flex-wrap:wrap;gap:6px}
.swap-def{border-radius:999px;border:1px solid var(--fc-line);border-left:4px solid var(--c);padding:6px 12px;font-size:13px;text-align:left}
.swap-def.cur{outline:2px solid var(--fc-accent,#ff8a00);outline-offset:-2px;font-weight:600}
.def .unseen{font-size:11px;opacity:.6;margin-left:6px;font-style:italic}
p.dthint{font-size:12px;color:var(--fc-muted);margin:8px 4px 4px;line-height:1.4}
.def{border-radius:12px;border:1px solid var(--fc-line);border-left:4px solid var(--c);padding:12px 14px;text-align:left;width:100%;font-size:15px}
.def:hover{background:rgba(127,127,127,.08)}
.field{margin-bottom:14px}
.field>label{display:block;font-size:13px;color:var(--fc-muted);margin-bottom:6px}
.wd{display:flex;flex-wrap:wrap;gap:6px}
.wd button{padding:6px 10px;border-radius:999px;border:1px solid var(--fc-line)}
.wd button.sel{background:var(--fc-accent);color:#fff;border-color:var(--fc-accent)}
.rangewrap{display:flex;align-items:center;gap:12px}.rangewrap input[type=range]{flex:1;padding:0;border:0;background:none}
.rangewrap output{min-width:48px;text-align:right;font-weight:600}
.check{display:flex;align-items:center;gap:10px;cursor:pointer}.check input{width:auto}
.preview{border-radius:12px;padding:12px 14px;background:rgba(127,127,127,.08);border-left:4px solid var(--c);margin-bottom:16px;font-size:15px;line-height:1.6}
.error-box{background:color-mix(in srgb,var(--fc-err) 12%,transparent);color:var(--fc-err);padding:10px 12px;border-radius:10px;margin-bottom:12px;font-size:14px}
.runs details{border:1px solid var(--fc-line);border-radius:12px;margin-bottom:8px;overflow:hidden}
.runs summary{display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;list-style:none}
.runs summary::-webkit-details-marker{display:none}
.runs .st{font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;color:#fff;background:var(--fc-muted);white-space:nowrap}
.runs .st.success{background:var(--fc-ok)}.runs .st.error{background:var(--fc-err)}.runs .st.running{background:var(--fc-accent)}.runs .st.cancelled,.runs .st.skipped{background:var(--fc-warn)}
.runs .tr{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:14px}
.runs .tm{font-size:12px;color:var(--fc-muted);white-space:nowrap}
.steps{padding:4px 12px 12px;display:flex;flex-direction:column;gap:6px}
.step{display:flex;gap:10px;font-size:13px;align-items:flex-start}
.step .sec{font-size:10px;font-weight:700;color:#fff;border-radius:4px;padding:1px 5px;flex:none;margin-top:2px}
.step .sec.conditions{background:var(--fc-and)}.step .sec.actions{background:var(--fc-then)}.step .sec.else_actions{background:var(--fc-else)}
.step .msg{flex:1;min-width:0;word-break:break-word}
.step .msg .e{color:var(--fc-err)}
.step .ms{color:var(--fc-muted);font-size:11px;white-space:nowrap}
.nr-tabs{display:flex;flex-direction:column;gap:6px;margin-top:12px}
.nr-tab{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;border:1px solid var(--fc-line);text-align:left;width:100%}
.nr-tab.sel{border-color:var(--fc-accent);background:color-mix(in srgb,var(--fc-accent) 10%,transparent)}
.nr-tab:disabled{opacity:.45;cursor:default}
.nr-tab .box{width:22px;height:22px;border-radius:6px;border:2px solid var(--fc-line);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;flex:none}
.nr-tab.sel .box{background:var(--fc-accent);border-color:var(--fc-accent)}
.nr-tab .t{display:flex;flex-direction:column}.nr-tab .s{font-size:12px;color:var(--fc-muted)}
.nr-notes{margin:0;padding-left:20px;font-size:13px;line-height:1.6;color:var(--fc-muted)}
.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
.ents{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px}
.ent{display:inline-flex;align-items:center;gap:6px;padding:4px 6px 4px 10px;border-radius:999px;background:rgba(127,127,127,.14);font-size:13px}
.ent small{color:var(--fc-muted)}.ent button{width:20px;height:20px;border-radius:50%;font-size:11px}.ent button:hover{background:rgba(127,127,127,.25)}
.ver{font-size:11px;color:var(--fc-muted);white-space:nowrap;padding:2px 8px;border-radius:999px;border:1px solid var(--fc-line);flex:none}
.ver.warn{color:#fff;background:var(--fc-warn);border-color:var(--fc-warn)}
@media (max-width:600px){.ver:not(.warn){display:none}}
.tb.listen{background:#4b5563}.tb.listen.on,.btn.on{background:var(--fc-err);color:#fff;border-color:var(--fc-err)}
.listen-box{position:fixed;left:16px;bottom:16px;z-index:15;width:min(380px,calc(100vw - 32px));max-height:60vh;overflow:auto;background:var(--fc-card);border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.35);padding:10px 12px}
.listen-box .lh{display:flex;align-items:center;gap:8px;margin-bottom:6px}.listen-box .grow{flex:1}
.listen-box .ls{font-size:11px;color:var(--fc-muted);margin:-4px 2px 6px}
.listen-box .lp{color:var(--fc-muted);font-size:13px;margin:4px 2px 8px}
.pulse{width:10px;height:10px;border-radius:50%;background:var(--fc-err);animation:pulse 1s infinite}
.heard{display:flex;align-items:center;gap:10px;padding:8px 4px;border-top:1px solid var(--fc-line)}
.heard .ic{width:34px;height:34px;border-radius:10px;background:rgba(127,127,127,.12);display:flex;align-items:center;justify-content:center;flex:none}
.heard .t{flex:1;min-width:0;display:flex;flex-direction:column;font-size:13px}.heard .t span{color:var(--fc-muted)}
.heard .btn{padding:6px 12px}
.chip.unsaved{background:var(--fc-warn);color:#fff;font-weight:600}
.chip[hidden]{display:none}
.stash{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:12px;padding:10px 14px;border-radius:12px;background:color-mix(in srgb,var(--fc-warn) 16%,var(--fc-card));border-left:4px solid var(--fc-warn)}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#323232;color:#fff;padding:10px 18px;border-radius:10px;z-index:30;font-size:14px;max-width:90vw;box-shadow:0 4px 14px rgba(0,0,0,.3)}
.toast.error{background:var(--fc-err)}
.narrow .side{display:none}
.folder-select{display:none}
.narrow .folder-select{display:block;margin-bottom:10px}
/* canvas */
:host{--fc-logic:#7c5cc4}
.col.logic,.node.logic{--c:var(--fc-logic)}
.node.when{--c:var(--fc-when)}.node.and{--c:var(--fc-and)}.node.then{--c:var(--fc-then)}
.choices{display:flex;flex-direction:column;gap:10px}
.choice{display:flex;gap:14px;align-items:center;text-align:left;padding:14px;border-radius:14px;border:1px solid var(--fc-line);width:100%}
.choice:hover{background:rgba(127,127,127,.08)}
.choice .ic{width:44px;height:44px;border-radius:12px;background:var(--fc-accent);color:#fff;display:flex;align-items:center;justify-content:center;flex:none}
.choice .s{color:var(--fc-muted);font-size:13px}
.cv-tools{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--fc-line);background:var(--fc-card)}
.cv-tools select{width:auto;max-width:200px;padding:6px 8px;font-size:13px}
.tb{display:inline-flex;align-items:center;gap:4px;padding:6px 12px 6px 8px;border-radius:999px;color:#fff;font-weight:600;font-size:13px}
.tb ha-icon{--mdc-icon-size:16px}
.tb.when{background:var(--fc-when)}.tb.and{background:var(--fc-and)}.tb.then{background:var(--fc-then)}.tb.logic{background:var(--fc-logic)}
.icon-btn.danger{color:var(--fc-err)}
.canvas{position:relative;height:calc(100vh - 56px - 52px);min-height:420px;overflow:hidden;touch-action:none;cursor:grab;
  background-color:var(--fc-bg);background-image:radial-gradient(circle,rgba(127,127,127,.28) 1px,transparent 1.2px);background-size:22px 22px}
.world{position:absolute;left:0;top:0;transform-origin:0 0}
svg.wires{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}
svg.wires path{fill:none}
svg.wires .hit{stroke:transparent;stroke-width:18;pointer-events:stroke;cursor:pointer}
svg.wires .wire{stroke:#8a94a6;stroke-width:3;pointer-events:none}
svg.wires .wire.true{stroke:var(--fc-ok)}svg.wires .wire.false{stroke:var(--fc-err)}svg.wires .wire.error{stroke:var(--fc-warn);stroke-dasharray:6 5}
svg.wires .wire.sel{stroke-width:5;filter:drop-shadow(0 0 3px var(--fc-accent))}
svg.wires .wire.temp{stroke-dasharray:4 4}
.wire-del{position:absolute;transform:translate(-50%,-50%);width:28px;height:28px;border-radius:50%;background:var(--fc-err);color:#fff;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,.3);z-index:3}
.node{position:absolute;width:250px;background:var(--fc-card);border-radius:12px;box-shadow:0 2px 6px rgba(0,0,0,.18);border-top:4px solid var(--c);cursor:pointer;user-select:none;-webkit-user-select:none}
.node.disabled{opacity:.5}
.node.source{outline:3px solid var(--fc-accent)}
.node.target{outline:2px dashed var(--fc-accent);outline-offset:3px}
.node.note{background:#fff6c2;color:#3b3300;border-top-color:#e6c200}
.node .nhead{display:flex;align-items:center;gap:6px;padding:7px 10px 0;color:var(--c);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.02em}
.node.note .nhead{color:#8a7300}
.node .nhead .src{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.node .nhead button{color:var(--fc-muted);padding:2px;border-radius:6px;display:inline-flex}
.node .nhead button:hover{background:rgba(127,127,127,.15)}
.node .nbody{padding:4px 14px 12px 12px;font-size:14px;line-height:1.55}
.node.note .nbody{white-space:pre-wrap}
.node .not{background:var(--fc-and);color:#fff;border-radius:6px;padding:0 6px!important;font-size:10px;font-weight:700}
.node .not.off{background:transparent;color:var(--fc-muted);border:1px dashed var(--fc-line)}
.pin{position:absolute;width:18px;height:18px;border-radius:50%;border:3px solid var(--fc-card);box-shadow:0 0 0 1px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#fff;transform:translate(-50%,-50%)}
.pin::after{content:"";position:absolute;inset:-12px}
.pin.in{left:0;top:30px;background:#8a94a6}
.pin.out{left:100%;background:var(--c);cursor:crosshair}
.pin.out.true{background:var(--fc-ok)}.pin.out.false{background:var(--fc-err)}.pin.out.error{background:var(--fc-warn);width:16px;height:16px}
.cv-empty{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);text-align:center;color:var(--fc-muted);max-width:340px;pointer-events:none}
.cv-empty ha-icon{--mdc-icon-size:44px;opacity:.5}
.cv-banner{position:absolute;left:50%;top:12px;transform:translateX(-50%);background:var(--fc-accent);color:#fff;padding:6px 6px 6px 14px;border-radius:999px;display:flex;align-items:center;gap:10px;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,.25);white-space:nowrap}
.cv-banner .btn{color:#fff;border-color:rgba(255,255,255,.6);padding:4px 10px}
.cv-zoom{position:absolute;right:12px;bottom:12px;display:flex;align-items:center;gap:2px;background:var(--fc-card);border-radius:999px;box-shadow:0 1px 4px rgba(0,0,0,.2);padding:3px}
.cv-zoom button{width:32px;height:32px;border-radius:50%;font-size:18px;display:inline-flex;align-items:center;justify-content:center}
.cv-zoom button:hover{background:rgba(127,127,127,.15)}
.cv-zoom span{font-size:12px;min-width:40px;text-align:center;color:var(--fc-muted)}
.step .sec.triggers{background:var(--fc-when)}.step .sec.logic{background:var(--fc-logic)}
@media (max-width:600px){.cv-tools select{max-width:130px}.canvas{height:calc(100vh - 56px - 92px)}}
@media (max-width:980px){.board{grid-template-columns:1fr}}
@media (max-width:600px){.top .btn{padding:8px 10px}.top{gap:4px;padding:0 6px}.main{padding:12px}.row .when{display:none}.top h1{font-size:18px}.hide-sm{display:none}}
/* ---------- Homey-style shell */
.hy{--h-bg:#f2f2f7;--h-panel:#fff;--h-tile:#fff;--h-off:#ececf0;--h-text:#1c1c1e;--h-muted:#8e8e93;--h-line:#e5e5ea;--h-blue:#0a84ff;--h-red:#e0251b;--h-hover:#f2f2f7;--h-selbg:#e8f2ff;
  display:flex;height:100vh;overflow:hidden;background:var(--h-bg);color:var(--h-text);font-family:Roboto,"Helvetica Neue",Arial,sans-serif;font-size:13px}
.hy.dark{--h-bg:#111113;--h-panel:#1c1c1e;--h-tile:#2c2c2e;--h-off:#232325;--h-text:#f2f2f7;--h-muted:#8e8e93;--h-line:#2f2f33;--h-hover:#2a2a2d;--h-selbg:#15304f}
.hy ha-icon{--mdc-icon-size:18px}
.hy-nav{width:232px;flex:none;background:var(--h-panel);border-radius:0 0 12px 0;display:flex;flex-direction:column;box-shadow:0 1px 3px rgba(0,0,0,.06);margin-bottom:12px}
.hy-head{display:flex;align-items:center;gap:10px;height:42px;padding:0 10px 0 9px;flex:none}
.hy-head h1{flex:1;margin:0;font-size:17px;font-weight:600;letter-spacing:-.01em}
.hy-logo{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(135deg,#0a84ff,#5e5ce6)}
.hy-plus{width:22px;height:22px;border-radius:50%;background:var(--h-blue);color:#fff;display:inline-flex;align-items:center;justify-content:center;flex:none;box-shadow:0 1px 3px rgba(10,132,255,.4)}
.hy-plus ha-icon{--mdc-icon-size:16px}
.hy-navbody{flex:1;min-height:0;display:flex}
.hy-rail{width:46px;flex:none;display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 0 10px;border-right:1px solid var(--h-line)}
.hy-rail .grow{flex:1}
.hy-ri{display:flex;flex-direction:column;align-items:center;gap:2px;color:var(--h-muted);width:44px}
.hy-ri .b{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center}
.hy-ri .b ha-icon{--mdc-icon-size:20px}
.hy-ri .l{font-size:8.5px;line-height:1.1;text-align:center}
.hy-ri:hover .b{background:var(--h-hover)}
.hy-ri.sel{color:var(--h-blue)}.hy-ri.sel .b{background:var(--h-selbg)}
.hy-avatar{width:26px;height:26px;border-radius:50%;background:#ffcc00;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:4px}
.hy-tree{flex:1;min-width:0;overflow:auto;padding:8px 6px}
.hy-ti{display:flex;align-items:center;gap:7px;width:100%;min-height:27px;padding:3px 6px 3px calc(8px + var(--d,0) * 13px);border-radius:7px;cursor:pointer;text-align:left;color:var(--h-text);font-size:12px;border:1px solid transparent}
.hy-ti ha-icon{--mdc-icon-size:14px;flex:none}
.hy-ti .lb{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hy-ti .n{color:var(--h-muted);font-size:10.5px}
.hy-ti:hover{background:var(--h-hover)}
.hy-ti.sel{color:var(--h-blue);font-weight:600}
.hy-ti.add{color:var(--h-muted)}
.hy-ti.drop{border-color:var(--h-blue);background:var(--h-selbg)}
.hy-ti .tools{display:none;gap:0}.hy-ti:hover .tools{display:inline-flex}.hy-ti:hover .n{display:none}
.hy-ti .tools button{padding:2px;color:var(--h-muted);border-radius:4px;display:inline-flex}.hy-ti .tools button:hover{color:var(--h-blue)}
.hy-ti .tools ha-icon{--mdc-icon-size:14px}
.hy-main{flex:1;min-width:0;overflow:auto;padding:0 32px 32px}
.hy-mtop{display:none}
.hy-toolbar{display:flex;align-items:center;gap:10px;height:40px;position:sticky;top:0;z-index:4;background:var(--h-bg)}
.hy-toolbar .grow{flex:1}
.hy-seg{display:flex;background:var(--h-panel);border-radius:0 0 12px 12px;padding:2px 8px 4px;gap:2px;box-shadow:0 1px 3px rgba(0,0,0,.06);margin-top:-4px;padding-top:6px}
.hy-seg button,.hy-round{width:28px;height:26px;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;color:var(--h-muted)}
.hy-seg button.sel{color:var(--h-blue)}
.hy-seg ha-icon,.hy-round ha-icon{--mdc-icon-size:16px}
.hy-round{width:28px;height:28px;border-radius:50%;background:var(--h-panel);box-shadow:0 1px 3px rgba(0,0,0,.08);margin-top:-2px}
.hy-search{width:240px;max-width:40vw;height:30px;border-radius:999px;border:1px solid var(--h-line);background:var(--h-panel);color:var(--h-text);padding:4px 14px;font-size:12px}
.hy .ver{font-size:10px}
.hy-msel{display:none}
.hy-sec{margin-top:16px}
.hy-sec h2{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700;margin:0 0 10px}
.hy-sec h2 .hb{width:28px;height:28px;border-radius:7px;background:var(--h-off);display:flex;align-items:center;justify-content:center}
.hy-sec h2 .hb ha-icon{--mdc-icon-size:16px}
.hy-sec h2 .cnt{font-weight:400;color:var(--h-muted);font-size:12px}
.hy-tiles{display:flex;flex-wrap:wrap;gap:10px}
.hy-tiles.list{flex-direction:column;gap:6px;max-width:900px}
.hy-tile{position:relative;width:80px;height:80px;border-radius:7px;background:var(--h-tile);box-shadow:0 1px 3px rgba(0,0,0,.1);padding:6px;display:flex;flex-direction:column;cursor:pointer;user-select:none;-webkit-user-select:none;transition:transform .08s}
.hy-tile:hover{transform:translateY(-1px);box-shadow:0 3px 8px rgba(0,0,0,.12)}
.hy-tile.off{background:var(--h-off);box-shadow:0 1px 2px rgba(0,0,0,.06)}
.hy-tile .ic{flex:none;height:30px;display:flex;align-items:flex-start;color:var(--h-text)}
.hy-tile .ic ha-icon{--mdc-icon-size:26px}
.hy-tile.off .ic{opacity:.75}
.hy-tile .nm{margin-top:auto;font-size:9.5px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hy-tile .st,.hy-row .st{font-size:8.5px;color:var(--h-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:2px;margin-top:2px}
.hy .st.err{color:var(--h-red)}.hy .st.run{color:var(--h-blue)}
.hy .st ha-icon{--mdc-icon-size:10px}
.hy-play{position:absolute;top:6px;right:6px;width:20px;height:20px;border-radius:50%;background:rgba(127,127,127,.18);display:flex;align-items:center;justify-content:center;color:var(--h-text)}
.hy-play:hover{background:var(--h-blue);color:#fff}
.hy-play ha-icon{--mdc-icon-size:14px}
.hy-tile.big{width:150px;height:126px;padding:10px}
.hy-tile.big .ic ha-icon{--mdc-icon-size:32px}
.hy-tile.big .nm{font-size:12.5px;font-weight:500;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.hy-tile.big .sb{font-size:10px;color:var(--h-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.hy-tile.big .st{font-size:10px}
.hy-tile.big .hy-play{top:10px;right:10px;width:26px;height:26px}
.hy-tile.dragging,.hy-row.dragging{opacity:.4}
.hy-row{display:flex;align-items:center;gap:12px;background:var(--h-tile);border-radius:8px;padding:8px 10px;box-shadow:0 1px 2px rgba(0,0,0,.08);cursor:pointer}
.hy-row.off{background:var(--h-off)}
.hy-row .ic{width:30px;height:30px;display:flex;align-items:center;justify-content:center}.hy-row .ic ha-icon{--mdc-icon-size:22px}
.hy-row .t{flex:1;min-width:0;display:flex;flex-direction:column}.hy-row .t b{font-weight:500;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hy-row .t .s{font-size:11px;color:var(--h-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hy-row .st{font-size:11px;margin:0;min-width:80px;justify-content:flex-end}
.hy-row .hy-play{position:static;width:26px;height:26px}
.hy-dots{width:26px;height:26px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:var(--h-muted)}.hy-dots:hover{background:var(--h-hover)}
.hy .empty{color:var(--h-muted)}
.hy .stash{margin-top:12px}
.hy-layer{position:fixed;inset:0;z-index:24}
.hy-menu{position:fixed;z-index:25;min-width:210px;max-width:280px;max-height:70vh;overflow:auto;background:#fff;color:#1c1c1e;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.2);padding:6px;font-size:13px;font-family:Roboto,"Helvetica Neue",Arial,sans-serif}
.hy-menu.dark{background:#2c2c2e;color:#f2f2f7}
.hy-menu .mi{display:flex;align-items:center;gap:10px;width:100%;padding:7px 12px;border-radius:8px;text-align:left}
.hy-menu .mi ha-icon{--mdc-icon-size:17px;opacity:.75}
.hy-menu .mi:hover{background:rgba(127,127,127,.14)}
.hy-menu .mi.danger{color:#e0251b}.hy-menu .mi.cur{color:#0a84ff;font-weight:600}
.hy-menu .mh.t{padding:6px 12px 8px;font-weight:600;font-size:12px;color:#8e8e93;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hy-menu .mi.back{font-weight:600}
.hy-menu .sep{height:1px;background:rgba(127,127,127,.2);margin:5px 8px}
.hy.narrow .hy-nav{display:none}
.hy.narrow .hy-main{padding:0 12px 24px}
.hy.narrow .hy-mtop{display:flex;align-items:center;gap:6px;height:52px;margin:0 -12px;padding:0 8px;background:var(--h-panel);position:sticky;top:0;z-index:5}
.hy.narrow .hy-mtop h1{font-size:18px;margin:0 4px;font-weight:600}.hy.narrow .hy-mtop .grow{flex:1}
.hy.narrow .hy-mtop .hy-ri{width:36px}.hy.narrow .hy-plus{width:30px;height:30px}
.hy.narrow .hy-toolbar{top:52px}
.hy.narrow .hy-msel{display:block;margin:8px 0 0;border-radius:10px;background:var(--h-panel);color:var(--h-text);border-color:var(--h-line)}
.hy.narrow .hy-tiles:not(.list){display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr))}
.hy.narrow .hy-tile{width:auto;height:96px}.hy.narrow .hy-tile.big{height:130px}
.hy.narrow .hy-tiles.big{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
/* ---------- Homey-style editor */
.hy-main.cv{padding:0;position:relative;overflow:hidden}
.canvas.hyc{height:100vh;background-color:var(--h-bg);background-image:linear-gradient(rgba(0,0,0,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.05) 1px,transparent 1px);background-size:16px 16px}
.hy.dark .canvas.hyc{background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)}
.hy .node{border-top:0;border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,.13);background:var(--h-tile);color:var(--h-text);padding-left:46px}
.hy .node .nic{position:absolute;left:8px;top:15px;width:30px;height:30px;border-radius:50%;background:var(--c);color:#fff;display:flex;align-items:center;justify-content:center}
.hy .node .nic ha-icon{--mdc-icon-size:17px}
.hy .node .nhead{color:var(--h-muted);text-transform:none;font-weight:400;font-size:10px;letter-spacing:0;padding:7px 8px 0 0}
.hy .node .nbody{padding:1px 12px 10px 0;font-size:13px;line-height:1.45}
.hy .node .nhead button{opacity:0;transition:opacity .1s}.hy .node:hover .nhead button,.hy .node .nhead .not:not(.off){opacity:1}
.hy .node .pill{background:none;padding:0;font-weight:600;color:inherit}
.hy .node.note{background:#fff3a6;color:#4a4000;padding-left:0;box-shadow:0 1px 4px rgba(0,0,0,.1)}
.hy .node.note .nhead{padding-left:12px;color:#8a7a10}.hy .node.note .nbody{padding-left:12px}
.hy .pin{width:10px;height:10px;border:2px solid var(--h-tile);box-shadow:0 0 0 1px rgba(0,0,0,.08);font-size:0}
.hy .pin.in{background:#aeaeb2}
.hy .pin.out,.hy .pin.out.true{background:#0a84ff}.hy .pin.out.false{background:#ff9f0a}.hy .pin.out.error{background:#ff453a;width:10px;height:10px}
.hy svg.wires .wire{stroke:#0a84ff;stroke-width:2}.hy svg.wires .wire.true{stroke:#0a84ff}.hy svg.wires .wire.false{stroke:#ff9f0a}.hy svg.wires .wire.error{stroke:#ff453a}
.hy .cv-zoom{background:var(--h-panel);color:var(--h-text)}
.hy .cv-empty{color:var(--h-muted)}
.cv-float{position:absolute;top:10px;display:flex;align-items:center;gap:8px;z-index:6;flex-wrap:wrap}
.cv-float.l{left:16px}.cv-float.r{right:16px}
.pw{position:relative;display:inline-flex}
.pl{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 13px;border-radius:999px;background:var(--h-panel);color:var(--h-text);box-shadow:0 1px 3px rgba(0,0,0,.14);font-size:12.5px;border:0}
.pl ha-icon{--mdc-icon-size:16px}
.pl:disabled{color:var(--h-muted);cursor:default}
.pl.act{color:var(--h-blue);font-weight:600}
.pl.blue{background:linear-gradient(#3b93ff,#0a6cff);color:#fff;font-weight:600}
.pl.rec{background:var(--h-red);color:#fff}
.pl.duo{padding:0 4px;gap:0}.pl.duo button{width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%}.pl.duo button:disabled{opacity:.3;cursor:default}
.pl.duo i{width:1px;height:16px;background:var(--h-line)}
.pl.round{width:30px;padding:0;justify-content:center}
.pl.name{width:230px;font-weight:600;font-size:13px}
.cv-float .switch{box-shadow:0 1px 3px rgba(0,0,0,.14)}
.hy .switch.on{background:var(--h-blue)}
.cv-pop{position:absolute;top:38px;left:0;z-index:25;background:var(--h-panel);color:var(--h-text);border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.2);padding:6px;min-width:170px;display:flex;flex-direction:column}
.cv-pop.set{left:auto;right:0;min-width:250px}
.cv-pop button{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:8px;text-align:left;font-size:13px;color:var(--h-text)}
.cv-pop button:hover{background:var(--h-hover)}.cv-pop button.danger{color:var(--h-red)}
.cv-pop button ha-icon{--mdc-icon-size:17px;opacity:.75}
.cv-pop .sep{height:1px;background:var(--h-line);margin:5px 8px}
.cv-pop label{display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--h-muted);padding:6px 8px}
.cv-pop select{background:var(--h-panel);color:var(--h-text);border-color:var(--h-line);padding:6px 8px;font-size:13px}
.cv-pop .muted{color:var(--h-muted);font-size:12px;padding:6px 12px}
.hy .chip.unsaved{box-shadow:0 1px 3px rgba(0,0,0,.14)}
.hy .cv-banner{top:52px}
.hy-filter{display:flex;align-items:center;gap:6px;border:1px solid var(--h-line);border-radius:999px;padding:3px 10px;margin:2px 2px 10px;color:var(--h-muted)}
.hy-filter input{border:0;padding:3px 0;background:transparent;font-size:12px;color:var(--h-text)}
.hy-filter ha-icon{--mdc-icon-size:15px}
.hy-ti.grp{cursor:default}.hy-ti.grp:hover{background:none}
.hy-ti .bul{width:4px;height:4px;border-radius:50%;background:var(--h-muted);margin:0 4px;flex:none}
.hy-ti.dim{opacity:.55}
@media (max-width:700px){.cv-float.r{top:48px;left:16px;right:auto}.pl.name{width:150px}.pl span{display:none}.pl.blue span,.pl.act span{display:inline}}
/* ---------- Homey-style card picker */
.hpick,.hym{background:#fff;color:#1c1c1e;--fc-card:#fff;--fc-text:#1c1c1e;--fc-muted:#8e8e93;--fc-line:#e5e5ea}
.hpick{width:min(1000px,100%);height:min(680px,100%);max-height:none;border-radius:12px}
.hpick header,.hym header{background:#f2f2f7;border-bottom:1px solid #e5e5ea;padding:8px 12px 8px 16px}
.hpick header h3{flex:none;width:200px;font-weight:500;font-size:15px}
.hsearch{flex:1;max-width:300px;margin:0 auto;display:flex;align-items:center;gap:6px;background:#fff;border:1px solid #d1d1d6;border-radius:6px;padding:0 10px;color:#8e8e93}
.hsearch input{border:0;padding:6px 0;font-size:13px;background:transparent;color:#1c1c1e}
.hsearch ha-icon{--mdc-icon-size:16px}
.hpick .cols{flex:1;min-height:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}
.hpick .cols>div{overflow:auto;padding:6px 10px 14px;border-right:1px solid #e5e5ea}
.hpick .cols>div:last-child{border-right:0}
.hpick .sub{text-transform:none;letter-spacing:0;font-weight:500;font-size:11px;color:#8e8e93;margin:10px 6px 4px}
.pk{display:flex;align-items:center;gap:9px;width:100%;padding:4px 6px;border-radius:7px;text-align:left;font-size:13px;color:#1c1c1e}
.pk:hover,.pk.sel{background:#f2f2f7}.pk.sel{color:#0a84ff}
.pk .pc{width:24px;height:24px;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;flex:none}.pk .pc ha-icon{--mdc-icon-size:14px}
.pk .pn{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pk .chev{--mdc-icon-size:18px;color:#aeaeb2}.pk.sel .chev{color:#0a84ff}
.pk.back{font-weight:600;margin-top:4px}
.hpick .defs{gap:8px}
.hpick .def{background:#fff;border:0;border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,.15);font-size:13px;padding:9px 12px;color:#1c1c1e;line-height:1.5}
.hpick .def:hover{box-shadow:0 2px 8px rgba(0,0,0,.2);background:#fff}
.hpick .def .pill{background:none;border:1px solid #d1d1d6;font-weight:400;font-size:11px;padding:0 6px;color:#636366}
.hpick .empty{padding:20px;color:#8e8e93}
.hpick .unav{font-size:12px;color:#8e8e93;margin:14px 6px 0}
.hpick .dthint{color:#8e8e93}
.vrow{display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid #e5e5ea}
.vt{flex:1;min-width:0;display:flex;flex-direction:column}.vt small{color:#8e8e93;font-size:11px}
.vval{padding:4px 10px;border-radius:999px;background:#f2f2f7;font-size:13px}
@media (max-width:760px){.hpick .cols{display:block;overflow:auto}.hpick .cols>div{border-right:0;border-bottom:1px solid #e5e5ea;overflow:visible}.hpick .cols>div:empty{display:none}.hpick header h3{width:auto}}
.badge.fresh{animation:pop .6s ease-out 2}@keyframes pop{0%{transform:scale(.2);opacity:0}60%{transform:scale(1.35);opacity:1}100%{transform:scale(1)}}
.hy-main.emb{padding:0;overflow:hidden}
.hy-embed{display:flex;flex-direction:column;height:100vh}
.hy-ebar{display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--h-bg)}
.hy-ebar .grow{flex:1}.hy-ebar b{font-size:14px}
.hy-embed iframe{flex:1;width:100%;border:0;background:var(--h-panel)}
.hy.narrow .hy-ebar .pl span{display:inline}
.hy.railonly .hy-nav{width:58px}.hy.railonly .hy-tree{display:none}.hy.railonly .hy-head h1,.hy.railonly .hy-head .hy-plus{display:none}.hy.railonly .hy-rail{border-right:0}
.hy-embed iframe{opacity:0;transition:opacity .15s}.hy-embed iframe.ready{opacity:1}
`;

/* ------------------------------------------------------------------ panel */

class FlowCardsPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._flows = [];
    this._folders = [];
    this._folder = "__all";
    this._search = "";
    this._view = "list";
    this._draft = null;
    this._dirty = false;
    this._picker = null;
    this._historyFor = null;
    this._runs = {};
    this._latestRun = {};
    this._loaded = false;
    this._narrow = false;
    this._pending = false;
    this.shadowRoot.addEventListener("click", (e) => this._onClick(e));
    this.shadowRoot.addEventListener("input", (e) => this._onInput(e));
    this.shadowRoot.addEventListener("change", (e) => this._onChange(e));
    this.shadowRoot.addEventListener("focusout", () => setTimeout(() => this._pending && this._render(), 0));
    this.shadowRoot.addEventListener("dragstart", (e) => this._onDragStart(e));
    this.shadowRoot.addEventListener("dragover", (e) => this._onDragOver(e));
    this.shadowRoot.addEventListener("drop", (e) => this._onDrop(e));
    this.shadowRoot.addEventListener("dragend", () => this._dragEnd());
    this.shadowRoot.addEventListener("pointerdown", (e) => this._cvDown(e));
    this.shadowRoot.addEventListener("pointermove", (e) => this._cvMove(e));
    this.shadowRoot.addEventListener("pointerup", (e) => this._cvUp(e));
    this.shadowRoot.addEventListener("pointercancel", (e) => this._cvUp(e, true));
    this.shadowRoot.addEventListener("contextmenu", (e) => this._hyContext(e));
    this.shadowRoot.addEventListener("pointerdown", (e) => this._hyLongDown(e));
    this.shadowRoot.addEventListener("pointermove", (e) => this._hyLongMove(e));
    this.shadowRoot.addEventListener("pointerup", () => this._hyLongUp());
    this.shadowRoot.addEventListener("wheel", (e) => this._cvWheel(e), { passive: false });
    this.shadowRoot.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && (this._vars || this._addMenu || this._setMenu)) { this._vars = false; this._addMenu = false; this._setMenu = false; this._render(); return; }
      if (e.key === "Escape" && (this._picker || this._historyFor || this._newChooser || this._connect || (this._nr && !this._nr.busy))) { this._picker = null; this._historyFor = null; this._newChooser = false; this._connect = null; if (this._nr && !this._nr.busy) this._nr = null; this._render(); }
    });
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) this._init();
  }
  get hass() { return this._hass; }
  set narrow(v) { const c = this._narrow !== !!v; this._narrow = !!v; if (c && this._loaded) this._render(); }
  set panel(v) { this._panel = v; }

  connectedCallback() {
    this._beforeUnload = this._beforeUnload || ((e) => { if (this._dirty && this._view === "edit") { this._stashDraft(); e.preventDefault(); e.returnValue = ""; } });
    window.addEventListener("beforeunload", this._beforeUnload);
    if (this._hass && this._loaded) this._render();
  }
  disconnectedCallback() {
    this._stopListen();
    if (this._beforeUnload) window.removeEventListener("beforeunload", this._beforeUnload);
    this._stashDraft();
    if (this._unsub) { this._unsub.then((u) => u && u()).catch(() => {}); this._unsub = null; }
    this._wasDisconnected = true;
  }

  async _init() {
    this._renderShell("Indlæser flows…");
    try {
      await this._load();
      this._subscribe();
    } catch (err) {
      this._renderShell(`Kunne ikke hente flows: ${esc(err.message || err)}. Er integrationen Flow Cards sat op?`);
      return;
    }
    this._loaded = true;
    this._render();
  }

  _subscribe() {
    this._unsub = this._hass.connection.subscribeMessage((msg) => this._onEvent(msg), { type: `${WS}/subscribe` });
  }

  async _load() {
    const res = await this._hass.callWS({ type: `${WS}/list` });
    this._flows = res.flows || [];
    this._folders = res.folders || [];
    this._serverVersion = res.version || null;
  }

  _onEvent(msg) {
    if (msg.event === "flows_changed") {
      clearTimeout(this._reloadT);
      this._reloadT = setTimeout(async () => { await this._load(); this._safeRender(); }, 150);
      return;
    }
    if (msg.event === "run") {
      const run = msg.run;
      this._latestRun[msg.flow_id] = run;
      const list = this._runs[msg.flow_id];
      if (list) {
        const i = list.findIndex((r) => r.id === run.id);
        if (i >= 0) list[i] = run; else list.unshift(run);
      }
      if (this._view === "edit" && this._draft && this._draft.id === msg.flow_id && run.status !== "running" && this._lastToastRun !== run.id) {
        this._lastToastRun = run.id;
        const t = new Date(run.end || run.start).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const ok = run.status === "success";
        this._toast(ok ? `✓ Kørt kl. ${t} – alle kort gik igennem` : `Kørt kl. ${t}: ${run.error || run.status}`, !ok);
      }
      const f = this._flows.find((x) => x.id === msg.flow_id);
      if (f) {
        f.status = f.status || {};
        f.status.last_run = { id: run.id, start: run.start, status: run.status, trigger: run.trigger, branch: run.branch };
        if (run.status === "error") f.status.last_error = { start: run.start, error: run.error };
        f.status.running = run.status === "running" ? Math.max(1, f.status.running || 0) : 0;
      }
      this._safeRender();
    }
  }

  _safeRender() {
    if (this._ptr) { this._pending = true; return; }
    const a = this.shadowRoot.activeElement;
    if (a && ["INPUT", "TEXTAREA", "SELECT"].includes(a.tagName)) { this._pending = true; return; }
    this._render();
  }

  /* ---------------- helpers that need hass */

  _ctx() {
    return {
      flows: this._flows,
      entityName: (e) => this._entityName(e),
      notifyName: (s) => this._notifyName(s),
    };
  }
  _entityName(e) {
    if (!e) return "";
    const st = this._hass.states[e];
    return (st && st.attributes.friendly_name) || e;
  }
  _entityIcon(e) {
    const st = this._hass.states[e];
    return (st && st.attributes.icon) || DOMAIN_ICONS[e.split(".")[0]] || "mdi:shape";
  }
  _notifyTargets() {
    const out = [["persistent_notification", "Notifikation i Home Assistant"]];
    for (const s of Object.keys((this._hass.services || {}).notify || {})) {
      if (["send_message", "persistent_notification"].includes(s)) continue;
      out.push([`notify.${s}`, s.replace(/^mobile_app_/, "").replace(/_/g, " ")]);
    }
    for (const e of Object.keys(this._hass.states)) if (e.startsWith("notify.")) out.push([e, this._entityName(e)]);
    return out;
  }
  _notifyName(s) {
    if (!s) return "";
    const t = this._notifyTargets().find(([k]) => k === s);
    return t ? t[1] : s;
  }
  _findDef(card, sec) {
    if (!card || !card.card) return null;
    const cat = catOf(sec);
    if (card.card.startsWith("e.")) {
      const eid = (card.entity_id || [])[0];
      if (!eid) return null;
      return entityDefs(eid, this._hass.states[eid]).find((d) => d.id === card.card && d.cat === cat) || null;
    }
    return appDefs(this._ctx()).find((d) => d.id === card.card && d.cat === cat) || null;
  }
  _cardText(card, sec) {
    const def = this._findDef(card, sec);
    if (def) { try { return def.text(card.args || {}); } catch (e) { /* fallthrough */ } }
    return `${esc(card.kind)} ${pill("ukendt kort")}`;
  }
  _cardSource(card, sec) {
    if (card.card === "dev.trigger") {
      const d = (this._hass.devices || {})[(card.config || {}).device_id];
      return { name: d ? d.name_by_user || d.name : "Enhed", icon: "mdi:gesture-tap-button" };
    }
    if (card.card && card.card.startsWith("e.")) {
      const eid = (card.entity_id || [])[0];
      return { name: this._entityName(eid), icon: this._entityIcon(eid || "x.x") };
    }
    const def = this._findDef(card, sec);
    const app = APPS.find((a) => def && a.id === def.app);
    return app ? { name: app.name, icon: app.icon } : { name: card.kind, icon: "mdi:help-circle-outline" };
  }
  _flowSummary(f) {
    const trig = f.type === "advanced" ? (f.nodes || []).filter((n) => n.sec === "triggers") : f.triggers;
    const t = trig[0];
    if (!t) return "Ingen NÅR-kort · kun manuel start";
    const src = this._cardSource(t, "triggers");
    const txt = stripHtml(this._cardText(t, "triggers"));
    return `Når ${src.name}: ${txt}${trig.length > 1 ? ` (+${trig.length - 1})` : ""}`;
  }
  _when(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return "lige nu";
    if (diff < 3600) return `for ${Math.floor(diff / 60)} min siden`;
    const time = d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
    if (d.toDateString() === now.toDateString()) return `i dag ${time}`;
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return `i går ${time}`;
    return `${d.toLocaleDateString("da-DK", { day: "numeric", month: "short" })} ${time}`;
  }
  _toast(msg, error = false) {
    this._toastMsg = { msg, error };
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => { this._toastMsg = null; this._safeRender(); }, error ? 6000 : 2500);
    this._safeRender();
  }
  async _ws(msg) {
    try { return await this._hass.callWS(msg); } catch (err) { this._toast(err.message || String(err), true); throw err; }
  }

  /* ---------------- rendering */

  _renderShell(text) {
    this.shadowRoot.innerHTML = `<style>${STYLE}</style>${this._topBar(`<h1>Flows</h1>`)}<div class="empty"><p>${text}</p></div>`;
  }

  _versionChip() {
    const sv = this._serverVersion;
    const cmp = (a, b) => { const x = String(a).split(".").map(Number), y = String(b).split(".").map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
    if (sv && cmp(sv, FC_VERSION) > 0) return `<span class="ver warn" title="Home Assistant kører ${esc(sv)}, men siden viser ${FC_VERSION}">v${FC_VERSION} · tryk Ctrl+F5 for v${esc(sv)}</span>`;
    if (sv && cmp(sv, FC_VERSION) < 0) return `<span class="ver warn" title="Filerne er opdateret til ${FC_VERSION}, men Home Assistant kører stadig ${esc(sv)}">v${FC_VERSION} · genstart HA (kører v${esc(sv)})</span>`;
    return `<span class="ver" title="Flow Cards version">v${FC_VERSION}</span>`;
  }

  _topBar(inner) {
    return `<div class="top">${this._narrow ? `<button class="icon-btn" data-action="menu" title="Menu"><ha-icon icon="mdi:menu"></ha-icon></button>` : ""}${inner}${this._loaded || this._serverVersion ? this._versionChip() : ""}</div>`;
  }

  _render() {
    this._pending = false;
    if (!this._loaded) return;
    this._snapshot();
    this._stashDraft();
    const body = this._view === "embed" ? this._renderEmbed() : this._view === "devices" ? this._renderDevices() : this._view !== "edit" ? this._renderList() : this._draft.type === "advanced" ? this._renderCanvas() : this._renderEditor();
    const listen = this._listen && this._view === "edit" && !this._picker ? this._renderListen() : "";
    const modal = this._vars ? this._renderVars() : this._picker ? this._renderPicker() : this._historyFor ? this._renderHistory() : this._newChooser ? this._renderNewChooser() : this._nr ? this._renderNodeRed() : "";
    const menu = this._menu && this._view !== "edit" ? this._renderMenu() : "";
    const toast = this._toastMsg ? `<div class="toast ${this._toastMsg.error ? "error" : ""}">${esc(this._toastMsg.msg)}</div>` : "";
    const scroll = this.shadowRoot.querySelector(".content");
    const top = scroll ? scroll.scrollTop : 0;
    this.shadowRoot.innerHTML = `<style>${STYLE}</style><div class="${this._narrow ? "narrow" : ""}" style="min-height:100vh;background:var(--fc-bg)">${body}${listen}${modal}${menu}${toast}</div>`;
    const sc = this.shadowRoot.querySelector(".content");
    if (sc && this._keepScroll) sc.scrollTop = top;
    this._keepScroll = false;
    if (this._view === "embed") this._tameFrame();
    if (this._view === "edit" && this._draft && this._draft.type === "advanced") this._afterCanvasRender();
    else if (this._view === "edit" && this._draft) { const lr = this._latestRun[this._draft.id]; if (lr && lr.status !== "running") setTimeout(() => { this._seenRun = lr.id + lr.status; }, 0); }
  }

  _filteredFlows() {
    const q = this._search.trim().toLowerCase();
    return this._flows
      .filter((f) => this._folder === "__all" || (this._folder === "__none" ? !f.folder : f.folder === this._folder))
      .filter((f) => !q || f.name.toLowerCase().includes(q) || this._flowSummary(f).toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "da"));
  }

  /* ================================================================ Homey-style shell (lists) */

  _ui() {
    if (!this._uiPrefs) { try { this._uiPrefs = JSON.parse(localStorage.getItem("flow_cards_ui") || "{}"); } catch (e) { this._uiPrefs = {}; } }
    return this._uiPrefs;
  }
  _setUi(k, v) { this._ui()[k] = v; try { localStorage.setItem("flow_cards_ui", JSON.stringify(this._uiPrefs)); } catch (e) { /* ignore */ } }

  _folderTree() {
    const all = new Set();
    for (const fo of [...this._folders, ...this._flows.map((f) => f.folder).filter(Boolean)]) {
      const parts = fo.split("/").filter(Boolean);
      for (let i = 1; i <= parts.length; i++) all.add(parts.slice(0, i).join("/"));
    }
    const cmp = (a, b) => { const x = a.split("/"), y = b.split("/"); for (let i = 0; i < Math.min(x.length, y.length); i++) { const c = x[i].localeCompare(y[i], "da"); if (c) return c; } return x.length - y.length; };
    return [...all].sort(cmp).map((p) => ({ path: p, depth: p.split("/").length - 1, leaf: fLeaf(p) }));
  }
  _inFolder(f, sel) {
    if (sel === "__all") return true;
    if (sel === "__none") return !f.folder;
    return f.folder === sel || (f.folder || "").startsWith(`${sel}/`);
  }

  _hyShell({ title, plus, plusTitle, tree, main, active, mainCls = "" }) {
    const u = this._ui();
    const initials = ((this._hass.user && this._hass.user.name) || "HA").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    const rail = HY_RAIL.map(([id, icon, label, path]) => `<button class="hy-ri ${active === id ? "sel" : ""}" data-action="hy-nav" data-to="${id}" ${path ? `data-path="${path}"` : ""} title="${label}"><span class="b"><ha-icon icon="${icon}"></ha-icon></span><span class="l">${label}</span></button>`).join("");
    const mtop = `<div class="hy-mtop"><button class="icon-btn" data-action="menu" title="Menu"><ha-icon icon="mdi:menu"></ha-icon></button><h1>${esc(title)}</h1><span class="grow"></span>
      <button class="hy-ri sm ${active === "devices" ? "sel" : ""}" data-action="hy-nav" data-to="devices" title="Enheder"><span class="b"><ha-icon icon="mdi:view-grid"></ha-icon></span></button>
      <button class="hy-ri sm ${active === "flows" ? "sel" : ""}" data-action="hy-nav" data-to="flows" title="Flows"><span class="b"><ha-icon icon="mdi:shuffle-variant"></ha-icon></span></button>
      ${plus ? `<button class="hy-plus" data-action="${plus}" title="${esc(plusTitle)}"><ha-icon icon="mdi:plus"></ha-icon></button>` : ""}</div>`;
    return `<div class="hy ${u.dark ? "dark" : ""} ${this._narrow ? "narrow" : ""} ${mainCls === "emb" ? "railonly" : ""}">
      <aside class="hy-nav">
        <div class="hy-head"><span class="hy-logo"><ha-icon icon="mdi:graph-outline"></ha-icon></span><h1>${esc(title)}</h1>${plus ? `<button class="hy-plus" data-action="${plus}" title="${esc(plusTitle)}"><ha-icon icon="mdi:plus"></ha-icon></button>` : ""}</div>
        <div class="hy-navbody">
          <nav class="hy-rail">${rail}<span class="grow"></span>
            <button class="hy-ri" data-action="hy-search" title="Søg"><span class="b"><ha-icon icon="mdi:magnify"></ha-icon></span></button>
            <span class="hy-avatar" title="${esc((this._hass.user && this._hass.user.name) || "")}">${esc(initials)}</span></nav>
          <div class="hy-tree">${tree}</div>
        </div>
      </aside>
      <main class="hy-main ${mainCls}">${mainCls ? "" : mtop}${main}</main>
    </div>`;
  }

  _hyToolbar(searchField, searchVal, placeholder) {
    const mode = this._ui().mode || "grid";
    const seg = [["list", "mdi:format-list-bulleted", "Liste"], ["grid", "mdi:dots-grid", "Små fliser"], ["big", "mdi:view-grid-outline", "Store fliser"]]
      .map(([m, ic, t]) => `<button class="${mode === m ? "sel" : ""}" data-action="hy-mode" data-mode="${m}" title="${t}"><ha-icon icon="${ic}"></ha-icon></button>`).join("");
    const showSearch = this._hySearch || searchVal;
    return `<div class="hy-toolbar"><div class="hy-seg">${seg}</div><button class="hy-round" data-action="hy-more" title="Flere valg"><ha-icon icon="mdi:dots-horizontal"></ha-icon></button>
      ${showSearch ? `<input class="hy-search" type="search" data-field="${searchField}" value="${esc(searchVal)}" placeholder="${esc(placeholder)}">` : ""}
      <span class="grow"></span>${this._view === "list" ? this._versionChip() : ""}</div>`;
  }

  _hyTile({ id, icon, name, status, scls = "", off = false, play = null, action, menu, drag = false, sub = "" }) {
    const mode = this._ui().mode || "grid";
    const playBtn = play ? `<button class="hy-play" data-action="${play}" data-id="${esc(id)}" title="Kør nu"><ha-icon icon="mdi:play"></ha-icon></button>` : "";
    const st = `<span class="st ${scls}">${scls === "err" ? `<ha-icon icon="mdi:alert"></ha-icon>` : ""}${esc(status)}</span>`;
    const attrs = `data-action="${action}" data-id="${esc(id)}" data-menu="${menu}" ${drag ? `draggable="true" data-drag-flow="${esc(id)}"` : ""}`;
    if (mode === "list") {
      return `<div class="hy-row ${off ? "off" : ""}" ${attrs}><span class="ic"><ha-icon icon="${icon}"></ha-icon></span><span class="t"><b>${esc(name)}</b>${sub ? `<span class="s">${esc(sub)}</span>` : ""}</span>${st}${playBtn}<button class="hy-dots" data-action="hy-menu" data-kind="${menu}" data-id="${esc(id)}" title="Valg"><ha-icon icon="mdi:dots-horizontal"></ha-icon></button></div>`;
    }
    return `<div class="hy-tile ${mode} ${off ? "off" : ""}" ${attrs} title="${esc(name)}"><span class="ic"><ha-icon icon="${icon}"></ha-icon></span>${playBtn}
      <span class="nm">${esc(name)}</span>${mode === "big" && sub ? `<span class="sb">${esc(sub)}</span>` : ""}${st}</div>`;
  }

  _hySection(icon, title, tiles, extra = "") {
    const mode = this._ui().mode || "grid";
    return `<section class="hy-sec"><h2><span class="hb"><ha-icon icon="${icon}"></ha-icon></span>${esc(title)}${extra}</h2><div class="hy-tiles ${mode}">${tiles}</div></section>`;
  }

  _flowStatus(f) {
    const s = f.status || {};
    const lr = s.last_run;
    if (s.arm_error) return ["Fejl", "err"];
    if (!f.enabled) return ["Slået fra", ""];
    if (s.running) return ["Kører…", "run"];
    if (lr && lr.status === "error") return ["Fejl", "err"];
    return [lr ? this._when(lr.start) : "Ikke kørt", ""];
  }

  _renderList() {
    const q = this._search.trim().toLowerCase();
    const sel = this._folder;
    const tree = this._folderTree();
    if (sel !== "__all" && sel !== "__none" && !tree.some((t) => t.path === sel)) this._folder = "__all";
    const count = (p) => this._flows.filter((f) => this._inFolder(f, p)).length;
    const row = (id, label, icon, depth, tools = "", drop = null) => `<div role="button" tabindex="0" class="hy-ti ${this._folder === id ? "sel" : ""}" style="--d:${depth}" data-action="folder" data-folder="${esc(id)}" ${drop !== null ? `data-fdrop="${esc(drop)}"` : ""}><ha-icon icon="${icon}"></ha-icon><span class="lb">${esc(label)}</span><span class="n">${count(id)}</span>${tools}</div>`;
    const tools = (p) => `<span class="tools"><button data-action="new-folder" data-parent="${esc(p)}" title="Ny undermappe"><ha-icon icon="mdi:folder-plus-outline"></ha-icon></button><button data-action="rename-folder" data-folder="${esc(p)}" title="Omdøb"><ha-icon icon="mdi:pencil"></ha-icon></button><button data-action="delete-folder" data-folder="${esc(p)}" title="Slet mappe"><ha-icon icon="mdi:delete-outline"></ha-icon></button></span>`;
    const treeHtml = `${row("__all", "Alle flows", "mdi:shuffle-variant", 0)}
      ${row("__none", "Uden mappe", "mdi:folder-outline", 1, "", "")}
      ${tree.map((t) => row(t.path, t.leaf, "mdi:folder", t.depth + 1, tools(t.path), t.path)).join("")}
      <button class="hy-ti add" style="--d:1" data-action="new-folder" data-parent=""><ha-icon icon="mdi:folder-plus-outline"></ha-icon><span class="lb">Ny mappe</span></button>`;

    const flows = this._flows.filter((f) => this._inFolder(f, this._folder))
      .filter((f) => !q || f.name.toLowerCase().includes(q) || this._flowSummary(f).toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "da"));
    const groups = new Map([["", []], ...tree.map((t) => [t.path, []])]);
    for (const f of flows) { const k = f.folder || ""; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(f); }
    const tile = (f) => { const [status, scls] = this._flowStatus(f);
      return this._hyTile({ id: f.id, icon: f.type === "advanced" ? "mdi:vector-polyline" : "mdi:shuffle-variant", name: f.name, status, scls, off: !f.enabled, play: "run", action: "open", menu: "flow", drag: true, sub: this._flowSummary(f) }); };
    let secs = "";
    for (const [k, list] of groups) {
      if (!list.length) continue;
      const title = k ? fLabel(this._folder !== "__all" && this._folder !== "__none" && k.startsWith(`${this._folder}/`) ? k : k) : "Uden mappe";
      secs += this._hySection(k ? "mdi:folder" : "mdi:shuffle-variant", title, list.map(tile).join(""), `<span class="cnt">${list.length}</span>`);
    }
    const stash = (() => { const st = this._readStash(); return st ? `<div class="stash"><ha-icon icon="mdi:content-save-alert-outline"></ha-icon><span>Du har ikke-gemte ændringer i <b>${esc(st.draft.name || "et flow")}</b> fra ${esc(this._when(new Date(st.at).toISOString()))}.</span><span class="grow"></span><button class="btn primary" data-action="restore-draft">Fortsæt redigering</button><button class="btn ghost" data-action="discard-draft">Kassér</button></div>` : ""; })();
    const empty = this._flows.length
      ? `<div class="empty"><p>${q ? "Ingen flows matcher søgningen." : "Ingen flows i denne mappe."}</p></div>`
      : `<div class="empty"><ha-icon icon="mdi:graph-outline"></ha-icon><p><b>Ingen flows endnu</b></p><p>Et flow består af kort: <b>NÅR</b> noget sker, <b>OG</b> betingelserne passer, <b>SÅ</b> gør Home Assistant noget.</p><button class="btn primary" data-action="new">Opret dit første flow</button></div>`;
    const msel = `<select class="hy-msel" data-field="folder-select"><option value="__all" ${sel === "__all" ? "selected" : ""}>Alle flows</option><option value="__none" ${sel === "__none" ? "selected" : ""}>Uden mappe</option>${tree.map((t) => `<option value="${esc(t.path)}" ${sel === t.path ? "selected" : ""}>${"  ".repeat(t.depth)}${esc(t.leaf)}</option>`).join("")}</select>`;
    const main = `${this._hyToolbar("search", this._search, "Søg i flows…")}${msel}${stash}<div class="list">${secs || empty}</div>`;
    return this._hyShell({ title: "Flows", plus: "new", plusTitle: "Nyt flow", tree: treeHtml, main, active: "flows" });
  }

  /* ---------------- devices (Homey "Enheder") */

  _deviceModel() {
    const h = this._hass;
    const devs = h.devices || {}, ents = h.entities || {}, areas = h.areas || {}, floors = h.floors || {};
    const byDev = {};
    for (const [eid, e] of Object.entries(ents)) {
      if (!e || !e.device_id || e.hidden || e.entity_category || !h.states[eid]) continue;
      (byDev[e.device_id] = byDev[e.device_id] || []).push(eid);
    }
    const out = [];
    for (const [id, d] of Object.entries(devs)) {
      const list = byDev[id];
      if (!list || d.disabled_by || d.entry_type === "service") continue;
      const primary = [...list].sort((a, b) => dPrio(a) - dPrio(b))[0];
      const area = d.area_id || (ents[primary] && ents[primary].area_id) || "";
      out.push({ id, name: d.name_by_user || d.name || primary, area, primary, ents: list });
    }
    const fl = Object.entries(floors).map(([id, f]) => ({ id, name: f.name || id, level: f.level, icon: f.icon }))
      .sort((a, b) => (b.level ?? -99) - (a.level ?? -99) || a.name.localeCompare(b.name, "da"));
    const ar = Object.entries(areas).map(([id, a]) => ({ id, name: a.name || id, floor: a.floor_id && floors[a.floor_id] ? a.floor_id : "", icon: a.icon }))
      .sort((a, b) => a.name.localeCompare(b.name, "da"));
    return { devices: out, floors: fl, areas: ar };
  }

  _devState(eid) {
    const st = this._hass.states[eid];
    if (!st) return ["Ukendt", "", true];
    const s = st.state, dom = eid.split(".")[0], a = st.attributes || {};
    if (s === "unavailable") return ["Utilgængelig", "err", false];
    if (dom === "light" && s === "on" && a.brightness) return [`Tændt · ${Math.round((a.brightness / 255) * 100)}%`, "", false];
    if (dom === "climate" && a.current_temperature !== undefined) return [`${a.current_temperature}° · ${DEV_STATE[s] || s}`, "", s === "off"];
    if (["sensor", "number", "input_number"].includes(dom)) return [`${s}${a.unit_of_measurement ? ` ${a.unit_of_measurement}` : ""}`, "", false];
    if (dom === "event") return [a.event_type ? eventLabel(a.event_type, true) : "Knap", "", false];
    if (dom === "binary_sensor") return [s === "on" ? "Aktiv" : "Inaktiv", "", s !== "on"];
    return [DEV_STATE[s] || s, "", DEV_OFF.has(s)];
  }

  _renderDevices() {
    const m = this._deviceModel();
    const sel = this._area || "__all";
    const q = (this._dsearch || "").trim().toLowerCase();
    const nOf = (pred) => m.devices.filter(pred).length;
    const areaPred = (id) => (d) => d.area === id;
    const floorPred = (fid) => (d) => m.areas.some((a) => a.id === d.area && a.floor === fid);
    const row = (id, label, icon, depth, n) => `<div role="button" tabindex="0" class="hy-ti ${sel === id ? "sel" : ""}" style="--d:${depth}" data-action="area" data-area="${esc(id)}"><ha-icon icon="${icon}"></ha-icon><span class="lb">${esc(label)}</span><span class="n">${n}</span></div>`;
    let tree = row("__all", "Hjem", "mdi:home", 0, m.devices.length);
    for (const f of m.floors) {
      tree += row(`floor:${f.id}`, f.name, f.icon || "mdi:home-floor-1", 1, nOf(floorPred(f.id)));
      for (const a of m.areas.filter((x) => x.floor === f.id)) tree += row(`area:${a.id}`, a.name, a.icon || "mdi:texture-box", 2, nOf(areaPred(a.id)));
    }
    for (const a of m.areas.filter((x) => !x.floor)) tree += row(`area:${a.id}`, a.name, a.icon || "mdi:texture-box", 1, nOf(areaPred(a.id)));
    const unassigned = nOf((d) => !d.area || !m.areas.some((a) => a.id === d.area));
    if (unassigned) tree += row("area:", "Uden rum", "mdi:help-box-outline", 1, unassigned);

    let areaList = m.areas;
    if (sel.startsWith("floor:")) areaList = m.areas.filter((a) => a.floor === sel.slice(6));
    else if (sel.startsWith("area:")) areaList = m.areas.filter((a) => a.id === sel.slice(5));
    const sections = areaList.map((a) => ({ icon: a.icon || "mdi:texture-box", name: a.name, list: m.devices.filter(areaPred(a.id)) }));
    if (sel === "__all" || sel === "area:") sections.push({ icon: "mdi:help-box-outline", name: "Uden rum", list: m.devices.filter((d) => !d.area || !m.areas.some((a) => a.id === d.area)) });
    let secs = "";
    for (const s of sections) {
      const list = s.list.filter((d) => !q || d.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name, "da"));
      if (!list.length) continue;
      secs += this._hySection(s.icon, s.name, list.map((d) => {
        const [status, scls, off] = this._devState(d.primary);
        return this._hyTile({ id: d.id, icon: this._entityIcon(d.primary), name: d.name, status, scls, off, action: "dev-tap", menu: "device", sub: this._entityName(d.primary) });
      }).join(""));
    }
    const msel = `<select class="hy-msel" data-field="area-select">${[["__all", "Hjem"], ...m.floors.flatMap((f) => [[`floor:${f.id}`, f.name], ...m.areas.filter((a) => a.floor === f.id).map((a) => [`area:${a.id}`, `  ${a.name}`])]), ...m.areas.filter((a) => !a.floor).map((a) => [`area:${a.id}`, a.name])]
      .map(([v, l]) => `<option value="${esc(v)}" ${sel === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
    const main = `${this._hyToolbar("dsearch", this._dsearch || "", "Søg i enheder…")}${msel}<div class="list">${secs || `<div class="empty"><p>${q ? "Ingen enheder matcher søgningen." : "Ingen enheder her."}</p></div>`}</div>`;
    return this._hyShell({ title: "Enheder", plus: null, tree, main, active: "devices" });
  }

  _devPrimary(id) { const d = this._deviceModel().devices.find((x) => x.id === id); return d ? d.primary : null; }
  _moreInfo(entityId) { this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true })); }
  async _devToggle(id) {
    const eid = this._devPrimary(id);
    if (!eid) return;
    const dom = eid.split(".")[0];
    const s = (this._hass.states[eid] || {}).state;
    if (s === "unavailable") { this._toast("Enheden er utilgængelig", true); return; }
    let call = null;
    if (dom === "lock") call = ["lock", s === "locked" ? "unlock" : "lock"];
    else if (dom === "cover") call = ["cover", "toggle"];
    else if (dom === "scene") call = ["scene", "turn_on"];
    else if (["button", "input_button"].includes(dom)) call = [dom, "press"];
    else if (DEV_TOGGLE.has(dom)) call = ["homeassistant", "toggle"];
    if (!call) { this._moreInfo(eid); return; }
    if (dom === "lock" && s === "locked" && !window.confirm(`Lås "${this._entityName(eid)}" op?`)) return;
    try { await this._hass.callService(call[0], call[1], { entity_id: eid }); } catch (err) { this._toast(err.message || String(err), true); }
  }

  /* ---------------- context menu */

  _openMenu(kind, id, x, y) {
    this._menu = { kind, id, x, y, step: "main" };
    this._render();
    const m = this.shadowRoot.querySelector(".hy-menu");
    if (!m) return;
    const r = m.getBoundingClientRect();
    if (r.right > window.innerWidth - 8) m.style.left = `${Math.max(8, window.innerWidth - r.width - 8)}px`;
    if (r.bottom > window.innerHeight - 8) m.style.top = `${Math.max(8, window.innerHeight - r.height - 8)}px`;
  }

  _renderMenu() {
    const m = this._menu;
    const it = (action, icon, label, extra = "", cls = "") => `<button class="mi ${cls}" data-action="${action}" ${extra}><ha-icon icon="${icon}"></ha-icon><span>${label}</span></button>`;
    let items = "";
    if (m.kind === "flow") {
      const f = this._flows.find((x) => x.id === m.id);
      if (!f) { this._menu = null; return ""; }
      const d = `data-id="${esc(f.id)}"`;
      if (m.step === "move") {
        items = `<div class="mh"><button class="mi back" data-action="m-back"><ha-icon icon="mdi:chevron-left"></ha-icon><span>Flyt til mappe</span></button></div>
          ${it("m-moveto", f.folder ? "mdi:folder-outline" : "mdi:check", "Uden mappe", `${d} data-folder=""`, f.folder ? "" : "cur")}
          ${this._folderTree().map((t) => it("m-moveto", f.folder === t.path ? "mdi:check" : "mdi:folder", esc(t.leaf), `${d} data-folder="${esc(t.path)}" style="padding-left:${12 + t.depth * 14}px"`, f.folder === t.path ? "cur" : "")).join("")}`;
      } else {
        items = `<div class="mh t">${esc(f.name)}</div>
          ${it("open", "mdi:pencil", "Rediger", d)}${it("run", "mdi:play", "Kør nu", d)}${it("history", "mdi:history", "Historik", d)}
          ${it("duplicate", "mdi:content-copy", "Dupliker", d)}${it("m-move", "mdi:folder-move-outline", "Flyt til mappe…", d)}
          ${it("toggle", f.enabled ? "mdi:pause-circle-outline" : "mdi:play-circle-outline", f.enabled ? "Slå fra" : "Slå til", d)}
          <div class="sep"></div>${it("m-delete", "mdi:delete-outline", "Slet", d, "danger")}`;
      }
    } else if (m.kind === "device") {
      const d = (this._hass.devices || {})[m.id] || {};
      const eid = this._devPrimary(m.id);
      items = `<div class="mh t">${esc(d.name_by_user || d.name || "")}</div>
        ${it("dev-tap", "mdi:toggle-switch-outline", "Tænd/sluk", `data-id="${esc(m.id)}"`)}
        ${eid ? it("dev-info", "mdi:information-outline", "Vis detaljer", `data-eid="${esc(eid)}"`) : ""}
        ${it("hy-goto", "mdi:cog-outline", "Enhedsindstillinger", `data-path="/config/devices/device/${esc(m.id)}"`)}`;
    } else {
      const u = this._ui();
      items = this._view === "devices"
        ? `${it("hy-goto", "mdi:plus", "Tilføj enhed", `data-path="/config/integrations/dashboard"`)}${it("hy-goto", "mdi:texture-box", "Rum og etager", `data-path="/config/areas/dashboard"`)}`
        : `${it("new", "mdi:plus", "Nyt flow")}${it("new-folder", "mdi:folder-plus-outline", "Ny mappe", `data-parent=""`)}${it("nr-open", "mdi:import", "Importér fra Node-RED")}`;
      items += `${it("hy-search", "mdi:magnify", "Søg")}<div class="sep"></div>${it("hy-dark", u.dark ? "mdi:white-balance-sunny" : "mdi:weather-night", u.dark ? "Lyst tema" : "Mørkt tema")}`;
    }
    return `<div class="hy-layer" data-action="menu-close"></div><div class="hy-menu ${this._ui().dark ? "dark" : ""}" style="left:${m.x}px;top:${m.y}px">${items}</div>`;
  }

  async _hyClick(a, el, e) {
    const id = el.dataset.id;
    switch (a) {
      case "hy-nav": {
        const to = el.dataset.to;
        if (this._view === "edit") { if (!this._confirmLeave()) return true; this._stopListen(); this._clearStash(); this._draft = null; this._dirty = false; }
        if (el.dataset.path) { this._embed = { path: el.dataset.path, id: to, back: this._view === "devices" ? "devices" : "list" }; this._view = "embed"; this._render(); return true; }
        this._view = to === "devices" ? "devices" : "list"; this._hySearch = false; this._render(); return true;
      }
      case "embed-back": this._view = (this._embed && this._embed.back) || "list"; this._embed = null; this._render(); return true;
      case "embed-open": { const path = this._embed.path; this._view = this._embed.back || "list"; this._embed = null; this._navigate(path); return true;
      }
      case "hy-goto": this._menu = null; this._navigate(el.dataset.path); return true;
      case "hy-mode": this._setUi("mode", el.dataset.mode); this._render(); return true;
      case "hy-dark": this._menu = null; this._setUi("dark", !this._ui().dark); this._render(); return true;
      case "hy-search":
        this._menu = null; this._hySearch = true; this._render();
        setTimeout(() => { const s = this.shadowRoot.querySelector(".hy-search"); if (s) s.focus(); }, 0); return true;
      case "hy-more": { const r = el.getBoundingClientRect(); this._openMenu("more", null, r.left, r.bottom + 6); return true; }
      case "hy-menu": { const r = el.getBoundingClientRect(); this._openMenu(el.dataset.kind, id, r.right - 220, r.bottom + 4); return true; }
      case "menu-close": this._menu = null; this._render(); return true;
      case "m-back": this._menu.step = "main"; this._render(); return true;
      case "m-move": this._menu.step = "move"; this._render(); return true;
      case "m-moveto": { this._menu = null; await this._moveFlow(id, el.dataset.folder); return true; }
      case "m-delete": {
        this._menu = null;
        const f = this._flows.find((x) => x.id === id);
        if (!f || !window.confirm(`Slet flowet "${f.name}"? Det kan ikke fortrydes.`)) { this._render(); return true; }
        await this._ws({ type: `${WS}/delete`, flow_id: id });
        this._flows = this._flows.filter((x) => x.id !== id); this._render(); this._toast("Flowet er slettet"); return true;
      }
      case "area": this._area = el.dataset.area; this._render(); return true;
      case "dev-tap": this._menu = null; this._render(); await this._devToggle(id); return true;
      case "dev-info": this._menu = null; this._render(); this._moreInfo(el.dataset.eid); return true;
      default: return this._hyClick2(a, el, e);
    }
  }

  _snapshot() {
    if (this._view !== "edit" || !this._draft) { this._snapFor = null; this._undo = []; this._redo = []; return; }
    const key = this._draft.id || "__new";
    if (this._snapFor !== key) { this._snapFor = key; this._undo = []; this._redo = []; this._snap = JSON.stringify(this._draft); return; }
    if (this._ptr) return;
    const cur = JSON.stringify(this._draft);
    if (cur !== this._snap) { this._undo.push(this._snap); if (this._undo.length > 80) this._undo.shift(); this._redo = []; this._snap = cur; }
  }

  async _hyClick2(a, el) {
    switch (a) {
      case "cv-addmenu": this._addMenu = !this._addMenu; this._render(); return true;
      case "cv-setmenu": this._setMenu = !this._setMenu; this._render(); return true;
      case "cv-close-pop": this._render(); return true;
      case "cv-undo": case "cv-redo": {
        const from = a === "cv-undo" ? this._undo : this._redo;
        const to = a === "cv-undo" ? this._redo : this._undo;
        if (!from || !from.length) return true;
        to.push(JSON.stringify(this._draft));
        const prev = from.pop();
        this._draft = JSON.parse(prev); this._snap = prev; this._connect = null;
        this._markDirty(); this._render(); return true;
      }
      case "cv-quick": {
        const def = appDefs(this._ctx()).find((d) => d.id === el.dataset.def);
        if (!def) return true;
        this._connect = null;
        this._openPicker(el.dataset.sec);
        this._chooseDef(def, null);
        return true;
      }
      case "vars": this._vars = true; this._render(); return true;
      case "vars-close": this._vars = false; this._render(); return true;
      case "var-toggle":
        try { await this._hass.callService("input_boolean", "toggle", { entity_id: el.dataset.eid }); } catch (err) { this._toast(err.message || String(err), true); }
        setTimeout(() => this._safeRender(), 300); return true;
      case "var-press":
        try { await this._hass.callService("input_button", "press", { entity_id: el.dataset.eid }); this._toast("Trykket"); } catch (err) { this._toast(err.message || String(err), true); }
        return true;
      case "var-info": this._moreInfo(el.dataset.eid); return true;
      case "hy-open": {
        const f = this._flows.find((x) => x.id === el.dataset.id);
        if (!f || (this._draft && this._draft.id === f.id)) return true;
        if (!this._confirmLeave()) return true;
        this._stopListen(); this._clearStash();
        this._draft = clone(f); this._tf = null; this._dirty = false; this._view = "edit"; this._render(); return true;
      }
      default: return false;
    }
  }

  _renderEmbed() {
    const e = this._embed;
    const label = (HY_RAIL.find((r) => r[0] === e.id) || [0, 0, "Home Assistant"])[2];
    const backTo = e.back === "devices" ? "Enheder" : "Flows";
    const main = `<div class="hy-embed"><div class="hy-ebar"><button class="pl act" data-action="embed-back"><ha-icon icon="mdi:arrow-left"></ha-icon><span>Tilbage til ${backTo}</span></button>
        <b>${esc(label)}</b><span class="grow"></span><button class="pl" data-action="embed-open" title="Åbn som almindelig side i Home Assistant"><ha-icon icon="mdi:open-in-new"></ha-icon><span>Åbn som side</span></button></div>
        <iframe src="${esc(e.path)}" title="${esc(label)}"></iframe></div>`;
    return this._hyShell({ title: label, plus: null, tree: "", main, active: e.id, mainCls: "emb" });
  }

  // the embedded page is Home Assistant itself: hide its own sidebar so only one menu is shown
  _tameFrame() {
    const fr = this.shadowRoot.querySelector(".hy-embed iframe");
    if (!fr || fr._tamed) return;
    fr._tamed = true;
    const css = (root, id, text) => { if (root && !root.getElementById(id)) { const st = document.createElement("style"); st.id = id; st.textContent = text; root.appendChild(st); } };
    let tries = 0;
    const tick = () => {
      tries += 1;
      let done = false;
      try {
        const doc = fr.contentDocument;
        const ha = doc && doc.querySelector("home-assistant");
        const main = ha && ha.shadowRoot && ha.shadowRoot.querySelector("home-assistant-main");
        const mroot = main && main.shadowRoot;
        const drawer = mroot && mroot.querySelector("ha-drawer");
        if (drawer && drawer.shadowRoot) {
          css(mroot, "fc-hide", "ha-sidebar{display:none!important}ha-drawer{--mdc-drawer-width:0px!important}");
          css(drawer.shadowRoot, "fc-hide", ".mdc-drawer{display:none!important}.mdc-drawer-app-content{margin-left:0!important;margin-right:0!important;padding-left:0!important}");
          // the hamburger button would only open the hidden menu
          const panel = mroot.querySelector("partial-panel-resolver");
          const deep = (root) => { if (!root) return; root.querySelectorAll("ha-menu-button").forEach((b) => { b.style.display = "none"; }); root.querySelectorAll("*").forEach((n) => n.shadowRoot && deep(n.shadowRoot)); };
          if (panel) deep(panel.shadowRoot || panel);
          fr.classList.add("ready");
          done = tries > 12;
        }
      } catch (err) { done = true; fr.classList.add("ready"); }
      if (!done && tries < 40) setTimeout(tick, 250); else fr.classList.add("ready");
    };
    fr.addEventListener("load", () => setTimeout(tick, 100));
  }

  _navigate(path) {
    history.pushState(null, "", path);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
  }

  async _moveFlow(id, folder) {
    const f = this._flows.find((x) => x.id === id);
    if (!f || (f.folder || "") === (folder || "")) { this._render(); return; }
    const copy = { ...f, folder: folder || "" }; delete copy.status;
    f.folder = folder || ""; this._render();
    await this._ws({ type: `${WS}/save`, flow: copy });
    this._toast(folder ? `Flyttet til "${fLabel(folder)}"` : "Flyttet til Uden mappe");
  }

  _hyContext(e) {
    if (this._view === "edit") return;
    const t = e.composedPath().find((n) => n.dataset && n.dataset.menu);
    if (!t) return;
    e.preventDefault();
    this._openMenu(t.dataset.menu, t.dataset.id, e.clientX, e.clientY);
  }
  _hyLongDown(e) {
    if (this._view === "edit" || e.pointerType === "mouse") return;
    const t = e.composedPath().find((n) => n.dataset && n.dataset.menu);
    if (!t) return;
    clearTimeout(this._lpT);
    const x = e.clientX, y = e.clientY;
    this._lpAt = [x, y];
    this._lpT = setTimeout(() => { this._suppressClick = true; this._openMenu(t.dataset.menu, t.dataset.id, x, y); }, 550);
  }
  _hyLongMove(e) { if (this._lpT && this._lpAt && Math.hypot(e.clientX - this._lpAt[0], e.clientY - this._lpAt[1]) > 10) { clearTimeout(this._lpT); this._lpT = null; } }
  _hyLongUp() { clearTimeout(this._lpT); this._lpT = null; }


  _renderEditor() {
    const f = this._draft;
    const run = this._latestRun[f.id];
    const badges = {};
    if (run) for (const s of run.steps || []) badges[s.card_id] = s;
    const col = (sec) => {
      const meta = SECTIONS[sec];
      const cards = f[sec].map((c, i) => {
        const src = this._cardSource(c, sec);
        const b = badges[c.id];
        const badge = b ? `<span class="badge ${b.status} ${run && this._seenRun !== run.id + run.status ? "fresh" : ""}" title="${esc(b.error || b.text || b.status)}">${b.status === "error" ? "!" : b.status === "false" ? "✕" : b.status === "skipped" || b.status === "cancelled" ? "–" : "✓"}</span>` : "";
        const not = sec === "conditions" ? `<button class="not ${c.invert ? "" : "off"}" data-action="invert" data-sec="${sec}" data-idx="${i}" title="Vend betingelsen om">IKKE</button>` : "";
        return `<div class="card ${c.disabled ? "disabled" : ""}" draggable="true" data-action="edit-card" data-sec="${sec}" data-idx="${i}">
          ${badge}<div class="head"><ha-icon icon="${esc(src.icon)}" style="--mdc-icon-size:16px"></ha-icon><span class="src">${esc(src.name)}</span>${not}
          <button data-action="dup-card" data-sec="${sec}" data-idx="${i}" title="Dupliker kort"><ha-icon icon="mdi:content-copy" style="--mdc-icon-size:16px"></ha-icon></button>
          <button data-action="del-card" data-sec="${sec}" data-idx="${i}" title="Fjern kort"><ha-icon icon="mdi:close" style="--mdc-icon-size:16px"></ha-icon></button></div>
          <div class="body">${c.invert ? `<b class="notlbl">Ikke:</b> ` : ""}${this._cardText(c, sec)}</div></div>`;
      }).join("");
      const andmode = sec === "conditions" && f.conditions.length > 1
        ? `<div class="andmode"><button class="${f.condition_mode !== "any" ? "sel" : ""}" data-action="cmode" data-mode="all">Alle skal passe</button><button class="${f.condition_mode === "any" ? "sel" : ""}" data-action="cmode" data-mode="any">Én skal passe</button></div>` : "";
      return `<div class="col ${meta.cls}" data-drop="${sec}"><h2><span class="bar"></span>${meta.label}<span class="hint">${meta.hint}</span></h2>${andmode}
        <div class="stack">${cards}<button class="add" data-action="add-card" data-sec="${sec}"><ha-icon icon="mdi:plus"></ha-icon>${meta.add}</button></div></div>`;
    };
    const lr = run && run.status !== "running"
      ? `<div class="lastrun ${run.status}"><ha-icon icon="${run.status === "success" ? "mdi:check-circle" : run.status === "error" ? "mdi:alert-circle" : "mdi:information"}"></ha-icon>
          <span><b>Seneste kørsel ${esc(this._when(run.start))}:</b> ${esc(this._statusText(run))}${run.error ? ` – ${esc(run.error)}` : ""}</span>
          <span class="grow"></span><button class="btn ghost" data-action="history" data-id="${f.id}">Historik</button></div>` : "";
    return `${this._topBar(`<button class="icon-btn" data-action="back" title="Tilbage"><ha-icon icon="mdi:arrow-left"></ha-icon></button>
        <input class="name-input" data-field="name" value="${esc(f.name)}" placeholder="Navn på flow">
        <button class="switch ${f.enabled ? "on" : ""}" data-action="draft-toggle" title="${f.enabled ? "Flowet er slået til" : "Flowet er slået fra"}"></button>
        <button class="btn ghost" data-action="test" title="Gem og kør flowet nu"><ha-icon icon="mdi:play"></ha-icon><span class="hide-sm">Test</span></button>
        <span class="chip unsaved" ${this._dirty ? "" : "hidden"}>Ikke gemt</span>
        <button class="btn primary" data-action="save" ${this._dirty || !f.id ? "" : "disabled"}><ha-icon icon="mdi:content-save"></ha-icon><span class="hide-sm">Gem</span></button>`)}
      <div class="meta">
        <label>Mappe <select data-field="draft-folder"><option value="">Ingen</option>${this._folderTree().map((t) => `<option value="${esc(t.path)}" ${f.folder === t.path ? "selected" : ""}>${esc(fLabel(t.path))}</option>`).join("")}</select></label>
        <label>Ved ny udløsning <select data-field="draft-mode">${MODES.map(([k, l]) => `<option value="${k}" ${f.mode === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <span class="grow"></span>
        <button class="btn ghost ${this._listen ? "on" : ""}" data-action="listen" title="Tryk på en knap, tænd noget eller sæt noget i stikket – så foreslår Flows et NÅR-kort"><ha-icon icon="mdi:ear-hearing"></ha-icon><span class="hide-sm">${this._listen ? "Lytter…" : "Lyt"}</span></button>
        <button class="btn ghost" data-action="to-advanced" title="Lav flowet om til et avanceret flow med frit lærred"><ha-icon icon="mdi:vector-polyline"></ha-icon><span class="hide-sm">Gør avanceret</span></button>
        ${f.id ? `<button class="btn danger" data-action="delete-flow"><ha-icon icon="mdi:delete-outline"></ha-icon><span class="hide-sm">Slet flow</span></button>` : ""}
      </div>
      ${lr ? `<div style="height:12px"></div>${lr}` : ""}
      <div class="board">${col("triggers")}${col("conditions")}<div class="then-wrap">${col("actions")}${f.conditions.length ? col("else_actions") : ""}</div></div>`;
  }

  _statusText(run) {
    return { success: run.branch === "else" ? "Kørte ELLERS-kortene" : "Gennemført", error: "Fejlede", false: "Betingelserne passede ikke", cancelled: "Afbrudt", skipped: "Sprunget over", running: "Kører…" }[run.status] || run.status;
  }

  /* ---------------- picker */

  _sources(cat) {
    const h = this._hass;
    const reg = h.entities || {};
    const devs = h.devices || {};
    const areas = h.areas || {};
    const groups = new Map();
    const q = (this._picker.search || "").trim().toLowerCase();
    for (const [eid, st] of Object.entries(h.states)) {
      const r = reg[eid] || {};
      if (r.hidden || r.entity_category) continue;
      if (!this._picker.showUnavailable && st.state === "unavailable") continue;
      if (!entityDefs(eid, st).some((d) => d.cat === cat)) continue;
      const dev = r.device_id && devs[r.device_id];
      const key = dev ? `d:${r.device_id}` : `e:${eid}`;
      const area = areas[r.area_id || (dev && dev.area_id)];
      if (!groups.has(key)) {
        groups.set(key, { key, name: dev ? dev.name_by_user || dev.name || eid : st.attributes.friendly_name || eid, area: area ? area.name : "", areaId: area ? r.area_id || (dev && dev.area_id) : "", entities: [], icon: this._entityIcon(eid) });
      }
      groups.get(key).entities.push(eid);
    }
    if (cat === "t") {
      for (const [id, dev] of Object.entries(devs)) {
        if (groups.has(`d:${id}`) || dev.entry_type === "service" || dev.disabled_by) continue;
        const area = areas[dev.area_id];
        groups.set(`d:${id}`, { key: `d:${id}`, name: dev.name_by_user || dev.name || id, area: area ? area.name : "", areaId: area ? dev.area_id : "", entities: [], icon: "mdi:devices" });
      }
    }
    for (const g of groups.values()) if (g.key.startsWith("d:")) g.deviceId = g.key.slice(2);
    let list = [...groups.values()];
    if (q) list = list.filter((g) => `${g.name} ${g.area} ${g.entities.join(" ")} ${g.entities.map((e) => this._entityName(e)).join(" ")}`.toLowerCase().includes(q));
    list.sort((a, b) => (!a.area - !b.area) || a.area.localeCompare(b.area, "da") || a.name.localeCompare(b.name, "da"));
    return list;
  }

  _renderPicker3(p, cardsContent) {
    const cat = catOf(p.section);
    const ctx = this._ctx();
    const apps = APPS.filter((a) => appDefs(ctx).some((d) => d.app === a.id && d.cat === cat && !d.hidden));
    const appSel = p.source && p.source.type === "app" ? p.source.id : null;
    const zone = p.zone || "home";
    const item = (action, attrs, icon, bg, label, sel) => `<button class="pk ${sel ? "sel" : ""}" data-action="${action}" ${attrs}><span class="pc" style="background:${bg}"><ha-icon icon="${esc(icon)}"></ha-icon></span><span class="pn">${esc(label)}</span><ha-icon class="chev" icon="mdi:chevron-right"></ha-icon></button>`;
    const left = `<div class="sub">Zoner</div>${item("pick-zone", 'data-zone="home"', "mdi:home", "#0a84ff", "Hjem", !appSel)}
      <div class="sub">System</div>${apps.map((a) => item("pick-app", `data-app="${a.id}"`, a.icon, APP_COLORS[a.id] || "#5e5ce6", a.name, appSel === a.id)).join("")}`;
    let mid = "";
    let third = "";
    if (appSel) {
      mid = `<div class="sub">Kort</div>${cardsContent}`;
    } else {
      const src = this._sources(cat);
      const areas = this._hass.areas || {}, floors = this._hass.floors || {};
      const devItem = (g) => item("pick-source", `data-key="${esc(g.key)}"`, g.icon, "#0a84ff", g.name, p.srcKey === g.key);
      const zitem = (z, icon, label) => item("pick-zone", `data-zone="${esc(z)}"`, icon, "#48484a", label, false);
      const floorOf = (aid) => { const fid = (areas[aid] || {}).floor_id; return fid && floors[fid] ? fid : ""; };
      const areaList = Object.entries(areas).sort((x, y) => (x[1].name || "").localeCompare(y[1].name || "", "da"));
      if (p.search) {
        mid = `<div class="sub">Resultater</div>${src.slice(0, 200).map(devItem).join("") || `<div class="empty">Intet fundet</div>`}`;
      } else {
        let zones = [], devs = [], crumb = "";
        if (zone === "home") {
          const fl = Object.entries(floors).sort((x, y) => (y[1].level ?? -99) - (x[1].level ?? -99) || (x[1].name || "").localeCompare(y[1].name || "", "da"));
          zones = [...fl.map(([id, f]) => zitem(`floor:${id}`, f.icon || "mdi:home-floor-1", f.name || id)), ...areaList.filter(([id]) => !floorOf(id)).map(([id, a]) => zitem(`area:${id}`, a.icon || "mdi:texture-box", a.name || id))];
          devs = src.filter((g) => !g.areaId || !areas[g.areaId]);
        } else if (zone.startsWith("floor:")) {
          const fid = zone.slice(6);
          crumb = `<button class="pk back" data-action="pick-zone" data-zone="home"><ha-icon icon="mdi:chevron-left"></ha-icon><span class="pn">${esc((floors[fid] || {}).name || "")}</span></button>`;
          zones = areaList.filter(([id]) => floorOf(id) === fid).map(([id, a]) => zitem(`area:${id}`, a.icon || "mdi:texture-box", a.name || id));
        } else {
          const aid = zone.slice(5);
          const fid = floorOf(aid);
          crumb = `<button class="pk back" data-action="pick-zone" data-zone="${fid ? `floor:${esc(fid)}` : "home"}"><ha-icon icon="mdi:chevron-left"></ha-icon><span class="pn">${esc((areas[aid] || {}).name || "")}</span></button>`;
          devs = src.filter((g) => g.areaId === aid);
        }
        mid = `${crumb}${zones.length ? `<div class="sub">Zoner</div>${zones.join("")}` : ""}${devs.length ? `<div class="sub">Enheder</div>${devs.map(devItem).join("")}` : ""}` || `<div class="empty">Ingen enheder her</div>`;
      }
      mid += `<label class="check unav"><input type="checkbox" data-field="picker-unavail" ${p.showUnavailable ? "checked" : ""}>Vis utilgængelige</label>`;
      if (p.step === "cards" && p.source && p.source.type === "device") third = `<div class="sub">${esc(p.source.name)}</div>${cardsContent}`;
    }
    return `<div class="scrim" data-action="scrim"><div class="modal hpick" role="dialog"><header><h3>${{ t: "Når…", c: "Og…", a: "Så…" }[cat]}</h3>
      <div class="hsearch"><ha-icon icon="mdi:magnify"></ha-icon><input type="search" data-field="picker-search" placeholder="Søg…" value="${esc(p.search || "")}" autofocus></div>
      <button class="icon-btn" data-action="close-picker"><ha-icon icon="mdi:close"></ha-icon></button></header>
      <div class="cols"><div>${left}</div><div>${mid}</div><div>${third}</div></div></div></div>`;
  }

  _renderPicker() {
    const p = this._picker;
    const meta = SECTIONS[p.section];
    const cat = catOf(p.section);
    const color = `--c:var(--fc-${meta.cls})`;
    let title = `Vælg et ${meta.short}-kort`;
    let content = "";
    let footer = "";
    let back = false;

    if (p.step === "source") {
      const apps = APPS.filter((a) => appDefs(this._ctx()).some((d) => d.app === a.id && d.cat === cat && !d.hidden));
      const sources = this._sources(cat);
      const shown = sources.slice(0, 250);
      let lastArea = null;
      const devHtml = shown.map((g) => {
        const head = g.area !== lastArea ? `<div class="sub">${esc(g.area || "Uden område")}</div>` : "";
        lastArea = g.area;
        const sub = g.entities.length > 1 ? `${g.entities.length} entiteter` : g.entities[0] || "Enhed";
        return `${head}<button class="dev" data-action="pick-source" data-key="${esc(g.key)}"><span class="ic"><ha-icon icon="${esc(g.icon)}"></ha-icon></span><span class="t"><div>${esc(g.name)}</div><div class="s">${esc(sub)}</div></span><ha-icon icon="mdi:chevron-right"></ha-icon></button>`;
      }).join("");
      content = `${p.search ? "" : `<div class="apps">${apps.map((a) => `<button class="app" data-action="pick-app" data-app="${a.id}" style="${color}"><span class="ic"><ha-icon icon="${a.icon}"></ha-icon></span>${esc(a.name)}</button>`).join("")}</div>`}
        <div style="display:flex;gap:10px;align-items:center"><input type="search" placeholder="Søg efter enhed, område eller entitet…" data-field="picker-search" value="${esc(p.search || "")}" autofocus>
        <label class="check" style="white-space:nowrap;font-size:13px;color:var(--fc-muted)"><input type="checkbox" data-field="picker-unavail" ${p.showUnavailable ? "checked" : ""}>Vis utilgængelige</label></div>
        <div class="devs">${devHtml || `<div class="empty">Ingen enheder fundet</div>`}${sources.length > shown.length ? `<div class="empty">… og ${sources.length - shown.length} flere. Søg for at finde dem.</div>` : ""}</div>`;
    } else if (p.step === "cards") {
      back = p.section !== "logic";
      let groups = [];
      if (p.source.type === "app") {
        const app = APPS.find((a) => a.id === p.source.id);
        title = app.name;
        groups = [{ name: "", defs: appDefs(this._ctx()).filter((d) => d.app === app.id && d.cat === cat && !d.hidden), eid: null }];
      } else {
        title = p.source.name;
        if (p.source.deviceId && cat === "t") {
          const dt = p.devTriggers;
          const devHtml = dt === undefined ? `<div class="empty" style="padding:16px">Henter enhedens knapper og hændelser…</div>`
            : dt.length ? `<div class="sub">${p.current ? "Vælg en anden knap eller hændelse" : "Enhedens knapper og hændelser"}</div><div class="defs">${dt.map((t, i) => { const cur = p.current && p.current === JSON.stringify(t.config); return `<button class="def${cur ? " cur" : ""}" style="${color}" data-action="pick-devtrig" data-i="${i}">${esc(t.label)}${t.unseen ? ` <span class="unseen">ikke brugt endnu</span>` : ""}${cur ? ` <span class="curtag">valgt nu</span>` : ""}</button>`; }).join("")}</div>${dt.some((t) => t.unseen) ? `<p class="dthint">“Ikke brugt endnu”: knappen har aldrig sendt den slags tryk, så Home Assistant kender det ikke endnu. Du kan godt vælge det – første gang du trykker sådan på knappen, lærer Home Assistant det, og fra næste tryk virker flowet.</p>` : ""}` : "";
          p._devHtml = devHtml;
        } else p._devHtml = "";
        groups = p.source.entities.map((eid) => ({ name: this._entityName(eid), eid, defs: entityDefs(eid, this._hass.states[eid]).filter((d) => d.cat === cat && !d.hidden) })).filter((g) => g.defs.length);
      }
      content = (p.source && p.source.type === "device" ? p._devHtml || "" : "") + (p.source && p.source.type === "device" && !groups.length && p.devTriggers && !p.devTriggers.length ? `<div class="empty">Denne enhed har ingen kort for dette afsnit.</div>` : "") + groups.map((g) => `${groups.length > 1 || g.eid && g.name !== title ? `<div class="sub">${esc(g.name)}</div>` : ""}<div class="defs">${g.defs.map((d) => {
        let txt; try { txt = d.text(Object.fromEntries((d.fields || []).map((fl) => [fl.key, fl.type === "select" || fl.type === "number" || fl.type === "range" ? fl.default ?? "" : ""]))); } catch (e) { txt = d.id; }
        return `<button class="def" style="${color}" data-action="pick-def" data-def="${esc(d.id)}" data-eid="${esc(g.eid || "")}">${txt}</button>`;
      }).join("")}</div>`).join("");
    } else if (p.step === "config") {
      back = p.editIdx === undefined && p.section !== "logic";
      const def = p.def;
      title = p.eid ? this._entityName(p.eid) : (APPS.find((a) => a.id === def.app) || {}).name || "Kort";
      let preview; try { preview = def.text(p.args); } catch (e) { preview = ""; }
      // editing: offer the card's siblings (sunrise <-> sunset, on <-> off, ...) so the choice can be changed
      let swap = "";
      if (p.editIdx !== undefined) {
        const sib = (p.eid ? entityDefs(p.eid, this._hass.states[p.eid]) : appDefs(this._ctx()).filter((d) => d.app === def.app)).filter((d) => d.cat === cat && !d.hidden);
        if (sib.length > 1) {
          swap = `<div class="swap"><div class="sub">Skift til et andet kort</div><div class="swap-row">${sib.map((d) => {
            let txt; try { txt = d.text(this._swapArgs(d, p.args)); } catch (e) { txt = d.id; }
            return `<button class="swap-def${d.id === def.id ? " cur" : ""}" style="${color}" data-action="swap-def" data-def="${esc(d.id)}">${txt}</button>`;
          }).join("")}</div></div>`;
        }
      }
      content = `${p.error ? `<div class="error-box">${esc(p.error)}</div>` : ""}${swap}<div class="preview" style="${color}" data-preview>${preview}</div>
        ${(def.fields || []).map((fl) => this._renderField(fl, p.args[fl.key])).join("")}
        ${cat === "a" ? `<label class="check field"><input type="checkbox" data-field="card-disabled" ${p.disabled ? "checked" : ""}>Slå kortet fra (springes over)</label>` : ""}`;
      footer = `<footer><button class="btn ghost" data-action="close-picker">Annullér</button><button class="btn primary" data-action="confirm-card">${p.editIdx === undefined ? "Tilføj" : "Gem kort"}</button></footer>`;
    }
    if (p.section !== "logic" && (p.step === "source" || p.step === "cards")) return this._renderPicker3(p, content);
    return `<div class="scrim" data-action="scrim"><div class="modal hym" role="dialog">
      <header>${back ? `<button class="icon-btn" data-action="picker-back"><ha-icon icon="mdi:arrow-left"></ha-icon></button>` : `<span class="bar" style="width:6px;height:20px;border-radius:3px;background:var(--fc-${meta.cls})"></span>`}
      <h3>${esc(title)}</h3><button class="icon-btn" data-action="close-picker"><ha-icon icon="mdi:close"></ha-icon></button></header>
      <div class="content">${content}</div>${footer}</div></div>`;
  }

  _renderField(fl, value) {
    const v = value ?? "";
    const id = `f-${fl.key}`;
    const lab = `<label for="${id}">${esc(fl.label)}${fl.required ? " *" : ""}</label>`;
    const attrs = `id="${id}" data-arg="${fl.key}" ${fl.placeholder ? `placeholder="${esc(fl.placeholder)}"` : ""}`;
    let input = "";
    switch (fl.type) {
      case "number":
        input = `<input type="number" step="any" ${fl.min !== undefined ? `min="${fl.min}"` : ""} ${attrs} value="${esc(v)}">`; break;
      case "range":
        input = `<div class="rangewrap"><input type="range" min="${fl.min}" max="${fl.max}" ${attrs} value="${esc(v)}"><output>${esc(v)}</output></div>`; break;
      case "time":
        input = `<input type="time" ${attrs} value="${esc(String(v).slice(0, 5))}">`; break;
      case "textarea":
        input = `<textarea ${attrs}>${esc(v)}</textarea>`; break;
      case "json":
        input = `<textarea class="mono" ${attrs}>${esc(v)}</textarea>`; break;
      case "toggle":
        return `<label class="check field"><input type="checkbox" data-arg="${fl.key}" ${v ? "checked" : ""}>${esc(fl.label)}</label>`;
      case "select":
        input = `<select ${attrs}>${fl.options.map(([k, l]) => `<option value="${esc(k)}" ${String(v) === String(k) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`; break;
      case "weekdays":
        input = `<div class="wd">${WEEKDAYS.map(([k, l]) => `<button type="button" class="${(v || []).includes(k) ? "sel" : ""}" data-action="wd" data-key="${fl.key}" data-day="${k}">${l}</button>`).join("")}</div>`; break;
      case "notify":
        input = `<select ${attrs}><option value="">Vælg…</option>${this._notifyTargets().map(([k, l]) => `<option value="${esc(k)}" ${v === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`; break;
      case "flow":
        input = `<select ${attrs}><option value="">Vælg flow…</option>${this._flows.filter((f) => f.id !== this._draft.id).map((f) => `<option value="${f.id}" ${v === f.id ? "selected" : ""}>${esc(f.name)}</option>`).join("")}</select>`; break;
      case "entities": {
        const list = Array.isArray(v) ? v : v ? [v] : [];
        const opts = Object.keys(this._hass.states).sort().map((e) => `<option value="${esc(e)}">${esc(this._entityName(e))}</option>`).join("");
        input = `<div class="ents">${list.map((e, i) => `<span class="ent">${esc(this._entityName(e))} <small>${esc(e)}</small><button type="button" data-action="ent-del" data-key="${fl.key}" data-i="${i}" title="Fjern">✕</button></span>`).join("")}</div>
          <input id="${id}" data-ent-add="${fl.key}" list="dl-${fl.key}" placeholder="Søg og vælg en entitet for at tilføje…"><datalist id="dl-${fl.key}">${opts}</datalist>`;
        break;
      }
      case "tts": {
        const ttsList = Object.keys(this._hass.states).filter((e) => e.startsWith("tts.")).sort((a, b) => (b.includes("cloud") - a.includes("cloud")));
        input = ttsList.length
          ? `<select ${attrs}>${ttsList.map((e) => `<option value="${esc(e)}" ${v === e ? "selected" : ""}>${esc(this._entityName(e))}</option>`).join("")}</select>`
          : `<div class="error-box">Der er ingen tekst-til-tale-tjeneste i Home Assistant. Tilføj f.eks. Google Translate under Enheder og tjenester.</div>`;
        break;
      }
      case "entity": {
        const opts = Object.keys(this._hass.states).sort().map((e) => `<option value="${esc(e)}">${esc(this._entityName(e))}</option>`).join("");
        input = `<input ${attrs} list="dl-${fl.key}" value="${esc(v)}" placeholder="light.kontor"><datalist id="dl-${fl.key}">${opts}</datalist>`; break;
      }
      case "service": {
        const opts = [];
        for (const [dom, svcs] of Object.entries(this._hass.services || {})) for (const s of Object.keys(svcs)) opts.push(`${dom}.${s}`);
        input = `<input ${attrs} class="mono" list="dl-${fl.key}" value="${esc(v)}" placeholder="light.turn_on"><datalist id="dl-${fl.key}">${opts.sort().map((o) => `<option value="${esc(o)}">`).join("")}</datalist>`; break;
      }
      default: {
        const list = fl.list ? `<datalist id="dl-${fl.key}">${fl.list.map((o) => `<option value="${esc(o)}">`).join("")}</datalist>` : "";
        input = `<input type="text" ${attrs} ${fl.list ? `list="dl-${fl.key}"` : ""} value="${esc(v)}">${list}`;
      }
    }
    return `<div class="field">${lab}${input}</div>`;
  }

  async _loadDeviceTriggers(deviceId) {
    const p = this._picker;
    let list = [];
    try {
      const trigs = await this._hass.callWS({ type: "device_automation/trigger/list", device_id: deviceId });
      const own = (trigs || []).filter((t) => !t.entity_id);   // entity-based ones are already offered as entity cards
      const domains = [...new Set(own.map((t) => t.domain))];
      let res = {};
      try {
        const tr = await this._hass.callWS({ type: "frontend/get_translations", language: this._hass.language || "en", category: "device_automation", integration: domains });
        res = (tr && tr.resources) || {};
      } catch (e) { /* translations are optional */ }
      list = own.map((t) => ({ config: t, label: this._devTrigLabel(t, res) }));
      for (const t of devTrigVariants(own)) list.push({ config: t, label: this._devTrigLabel(t, res), unseen: true });
    } catch (err) {
      list = [];
    }
    if (this._picker === p) { p.devTriggers = list; this._render(); }
  }

  _devTrigLabel(t, res) {
    const sub = t.subtype ? EVENT_LABELS[t.subtype] || res[`component.${t.domain}.device_automation.trigger_subtype.${t.subtype}`] || String(t.subtype).replace(/_/g, " ") : "";
    if (t.type === "action" && sub) return `Sender “${sub}”`;
    const tpl = res[`component.${t.domain}.device_automation.trigger_type.${t.type}`];
    if (tpl) return tpl.replace(/\{subtype\}/g, sub).replace(/"/g, "");
    const typ = EVENT_LABELS[t.type] || String(t.type).replace(/_/g, " ");
    return sub ? `${typ}: ${sub}` : typ;
  }

  _openPicker(section, editIdx, nodeId) {
    const devCard = nodeId ? this._draft.nodes.find((n) => n.id === nodeId) : editIdx !== undefined && section !== "logic" ? (this._draft[section] || [])[editIdx] : null;
    if (devCard && devCard.card === "dev.trigger" && (devCard.config || {}).device_id) {
      // a device button: show all of the device's buttons/events so another one can be picked
      const deviceId = devCard.config.device_id;
      const d = (this._hass.devices || {})[deviceId] || {};
      const entities = Object.values(this._hass.entities || {}).filter((e) => e.device_id === deviceId && !e.hidden && !e.entity_category && this._hass.states[e.entity_id]).map((e) => e.entity_id);
      this._picker = { section: nodeId ? devCard.sec : section, step: "cards", source: { type: "device", name: d.name_by_user || d.name || "Enhed", entities, deviceId },
        editIdx: nodeId ? -1 : editIdx, nodeId: nodeId || undefined, disabled: !!devCard.disabled, current: JSON.stringify(devCard.config) };
      this._loadDeviceTriggers(deviceId);
      this._render();
      return;
    }
    if (nodeId) {
      const card = this._draft.nodes.find((n) => n.id === nodeId);
      const def = card && this._findDef(card, card.sec);
      if (!def) { this._toast("Kortet kan ikke redigeres (enheden findes måske ikke længere). Fjern det og tilføj et nyt.", true); return; }
      this._picker = { section: card.sec, step: "config", def, eid: card.card.startsWith("e.") ? card.entity_id[0] : null, args: clone(card.args || {}), editIdx: -1, nodeId, disabled: !!card.disabled };
    } else if (section === "logic") {
      this._picker = { section, step: "cards", source: { type: "app", id: "logic" }, search: "" };
    } else if (editIdx !== undefined) {
      const card = this._draft[section][editIdx];
      const def = this._findDef(card, section);
      if (!def) { this._toast("Kortet kan ikke redigeres (enheden findes måske ikke længere). Fjern det og tilføj et nyt.", true); return; }
      this._picker = { section, step: "config", def, eid: card.card.startsWith("e.") ? card.entity_id[0] : null, args: clone(card.args || {}), editIdx, disabled: !!card.disabled };
    } else {
      this._picker = { section, step: "source", search: "", showUnavailable: false };
    }
    this._render();
  }

  // which cards feed an ALL/ANY node, and can they actually arrive in the same run?
  _logicInputsHtml(n) {
    const nodes = this._draft.nodes || [], edges = this._draft.edges || [];
    const byId = Object.fromEntries(nodes.map((x) => [x.id, x]));
    const ins = [...new Set(edges.filter((e) => e.to === n.id && byId[e.from]).map((e) => e.from))];
    if (!ins.length) return `<div class="lin warn">Ingen input endnu – træk pile fra de kort, der skal vente på hinanden, ind i venstre side af dette kort.</div>`;
    const name = (id) => { const c = byId[id]; const t = c.sec === "logic" ? c.kind : stripHtml(this._cardText(c, c.sec)); return t.length > 28 ? `${t.slice(0, 27)}…` : t; };
    let html = `<div class="lin">${n.kind === "all" ? "Venter på" : "Første af"} ${ins.length}: ${ins.map((id) => esc(name(id))).join(" · ")}</div>`;
    if (n.kind === "all" && ins.length > 1) {
      const trigOf = (id) => { const out = new Set(), seen = new Set(), st = [id];
        while (st.length) { const x = st.pop(); if (seen.has(x)) continue; seen.add(x); const c = byId[x]; if (!c) continue;
          if (c.sec === "triggers") { out.add(x); continue; } edges.filter((e) => e.to === x).forEach((e) => st.push(e.from)); }
        return out; };
      const sets = ins.map(trigOf);
      const common = [...sets[0]].filter((t) => sets.every((s) => s.has(t)));
      if (!common.length) html += `<div class="lin warn">Inputtene starter fra forskellige NÅR-kort. Et flow kører for ét NÅR ad gangen, så de når aldrig frem samtidig – brug “Fortsæt ved det første input” eller lad dem starte fra samme NÅR.</div>`;
    }
    return html;
  }

  _swapArgs(def, old) {
    const args = {};
    for (const fl of def.fields || []) {
      if (old && old[fl.key] !== undefined && old[fl.key] !== "") args[fl.key] = clone(old[fl.key]);
      else if (fl.default !== undefined) args[fl.key] = clone(fl.default);
      else if (fl.type === "select" || fl.type === "number" || fl.type === "range") args[fl.key] = "";
    }
    return args;
  }

  _chooseDef(def, eid, preset) {
    const p = this._picker;
    const args = {};
    for (const fl of def.fields || []) if (fl.default !== undefined) args[fl.key] = clone(fl.default);
    for (const fl of def.fields || []) {
      if (fl.type === "tts" && args[fl.key] === undefined) {
        const t = Object.keys(this._hass.states).filter((e) => e.startsWith("tts.")).sort((a, b) => (b.includes("cloud") - a.includes("cloud")))[0];
        if (t) args[fl.key] = t;
      }
    }
    if (preset) Object.assign(args, preset);
    if (!(def.fields || []).length) {
      p.def = def; p.eid = eid; p.args = args;
      this._confirmCard();
      return;
    }
    Object.assign(p, { step: "config", def, eid, args, error: null, disabled: false });
    this._render();
  }

  _confirmCard() {
    const p = this._picker;
    const def = p.def;
    for (const fl of def.fields || []) {
      const v = p.args[fl.key];
      if (fl.required && (v === undefined || v === "" || v === null || (Array.isArray(v) && !v.length))) {
        p.error = `Udfyld "${fl.label}"`;
        this._render();
        return;
      }
    }
    let built;
    try { built = def.build(p.args); } catch (err) { p.error = err.message; this._render(); return; }
    for (const k of Object.keys(built)) if (built[k] === undefined) delete built[k];
    if (this._draft.type === "advanced") {
      const nodes = this._draft.nodes;
      const old = p.nodeId ? nodes.find((n) => n.id === p.nodeId) : null;
      const pos = old ? { x: old.x, y: old.y } : this._newNodePos();
      const node = { id: old ? old.id : uid(), sec: p.section, card: def.id, args: clone(p.args), ...built, ...pos };
      if (old && old.invert) node.invert = true;
      if (p.eid) node.entity_id = [p.eid];
      if (p.disabled) node.disabled = true;
      if (old) nodes[nodes.indexOf(old)] = node; else nodes.push(node);
      this._picker = null;
      this._dirty = true;
      this._render();
      return;
    }
    const list = this._draft[p.section];
    const old = p.editIdx !== undefined ? list[p.editIdx] : null;
    const card = { id: old ? old.id : uid(), card: def.id, args: clone(p.args), ...built };
    if (p.eid) card.entity_id = [p.eid];
    if (p.disabled) card.disabled = true;
    if (old) list[p.editIdx] = card; else list.push(card);
    this._picker = null;
    this._dirty = true;
    this._render();
  }

  /* ---------------- history */

  _renderHistory() {
    const f = this._flows.find((x) => x.id === this._historyFor) || this._draft;
    const runs = this._runs[this._historyFor];
    const secLabel = { triggers: "NÅR", conditions: "OG", actions: "SÅ", else_actions: "ELLERS", logic: "LOGIK" };
    const cardById = {};
    if (f) for (const sec of ["conditions", "actions", "else_actions"]) for (const c of f[sec] || []) cardById[c.id] = [c, sec];
    if (f) for (const n of f.nodes || []) cardById[n.id] = [n, n.sec];
    const body = !runs ? `<div class="empty">Henter…</div>` : !runs.length ? `<div class="empty">Flowet har ikke kørt endnu.</div>` : `<div class="runs">${runs.map((r, i) => `
      <details ${i === 0 ? "open" : ""}><summary><span class="st ${r.status}">${esc(this._statusText(r))}</span><span class="tr">${esc(r.trigger || "")}</span><span class="tm">${esc(this._when(r.start))}</span></summary>
      <div class="steps">${r.error ? `<div class="error-box" style="margin:0">${esc(r.error)}</div>` : ""}${(r.steps || []).map((s) => {
        const [c, csec] = cardById[s.card_id] || [];
        const label = c ? stripHtml(this._cardText(c, csec)) : s.kind;
        const src = c ? this._cardSource(c, csec).name : "";
        return `<div class="step"><span class="sec ${s.section}">${secLabel[s.section] || ""}</span><span class="msg">${s.status === "error" ? "❌" : s.status === "false" ? "✕" : s.status === "skipped" || s.status === "cancelled" ? "–" : "✓"} <b>${esc(src)}</b> ${esc(label)}${s.text ? `<br><span style="color:var(--fc-muted)">${esc(s.text)}</span>` : ""}${s.error ? `<br><span class="e">${esc(s.error)}</span>` : ""}</span><span class="ms">${s.ms !== null && s.ms !== undefined ? `${s.ms} ms` : ""}</span></div>`;
      }).join("") || `<div class="step" style="color:var(--fc-muted)">Ingen trin</div>`}</div></details>`).join("")}</div>`;
    return `<div class="scrim" data-action="scrim"><div class="modal wide"><header><ha-icon icon="mdi:history"></ha-icon><h3>Historik · ${esc(f ? f.name : "")}</h3>
      <button class="btn ghost" data-action="clear-history">Ryd</button><button class="icon-btn" data-action="close-history"><ha-icon icon="mdi:close"></ha-icon></button></header>
      <div class="content">${body}</div></div></div>`;
  }

  async _openHistory(id) {
    this._historyFor = id;
    this._render();
    const res = await this._ws({ type: `${WS}/history`, flow_id: id });
    this._runs[id] = res.runs || [];
    this._render();
  }

  /* ---------------- events */

  _confirmLeave() {
    return !this._dirty || window.confirm("Du har ændringer, der ikke er gemt. Vil du kassere dem?");
  }

  async _saveDraft() {
    const d = this._draft;
    if (!d.name.trim()) { this._toast("Giv flowet et navn", true); return null; }
    const res = await this._ws({ type: `${WS}/save`, flow: d });
    this._draft = clone(res);
    this._dirty = false;
    this._clearStash();
    const i = this._flows.findIndex((f) => f.id === res.id);
    if (i >= 0) this._flows[i] = res; else this._flows.push(res);
    if (res.folder && !this._folders.includes(res.folder)) this._folders.push(res.folder);
    return res;
  }

  async _onClick(e) {
    const el = e.composedPath().find((n) => n.dataset && n.dataset.action);
    if (!el) return;
    const a = el.dataset.action;
    const id = el.dataset.id;
    if (a === "scrim") {
      if (e.composedPath()[0] === el) { this._picker = null; this._historyFor = null; this._newChooser = false; if (this._nr && !this._nr.busy) this._nr = null; this._render(); }
      return;
    }
    e.stopPropagation();
    if (this._suppressClick) { this._suppressClick = false; return; }
    if (this._menu && !["m-move", "m-back", "hy-menu", "hy-more"].includes(a)) { this._menu = null; if (a === "menu-close") { this._render(); return; } }
    if (a !== "cv-addmenu") this._addMenu = false;
    if (a !== "cv-setmenu") this._setMenu = false;
    if (await this._hyClick(a, el, e)) return;
    const flow = id && this._flows.find((f) => f.id === id);
    switch (a) {
      case "menu":
        this.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true })); break;
      case "folder":
        this._folder = el.dataset.folder; this._render(); break;
      case "new-folder": {
        const parent = el.dataset.parent || "";
        const leaf = (window.prompt(parent ? `Navn på ny undermappe i "${fLabel(parent)}"` : "Navn på den nye mappe") || "").trim().replace(/^\/+|\/+$/g, "");
        if (!leaf) return;
        const name = parent ? `${parent}/${leaf}` : leaf;
        if (!this._folders.includes(name)) await this._ws({ type: `${WS}/folders`, folders: [...this._folders, name] });
        this._folders = [...new Set([...this._folders, name])];
        this._folder = name; this._view = "list"; this._render(); break;
      }
      case "rename-folder": {
        const old = el.dataset.folder;
        const parent = old.includes("/") ? old.slice(0, old.lastIndexOf("/") + 1) : "";
        const leaf = (window.prompt("Nyt navn på mappen", fLeaf(old)) || "").trim().replace(/^\/+|\/+$/g, "");
        const name = parent + leaf;
        if (!leaf || name === old) return;
        const re = (x) => (x === old ? name : x && x.startsWith(`${old}/`) ? name + x.slice(old.length) : x);
        for (const f of this._flows.filter((x) => re(x.folder) !== x.folder)) { const c = { ...f, folder: re(f.folder) }; delete c.status; await this._ws({ type: `${WS}/save`, flow: c }); }
        const known = new Set(this._folderTree().map((t) => t.path));
        await this._ws({ type: `${WS}/folders`, folders: [...new Set([...this._folders, ...known].map(re))] });
        await this._load(); this._folder = name; this._render(); break;
      }
      case "delete-folder": {
        const fo = el.dataset.folder;
        const parent = fo.includes("/") ? fo.slice(0, fo.lastIndexOf("/")) : "";
        const inside = (x) => x === fo || (x || "").startsWith(`${fo}/`);
        const n = this._flows.filter((f) => inside(f.folder)).length;
        if (!window.confirm(`Slet mappen "${fLabel(fo)}"${this._folderTree().some((t) => t.path.startsWith(`${fo}/`)) ? " og dens undermapper" : ""}?${n ? ` ${n} flow${n === 1 ? "" : "s"} flyttes til "${parent ? fLabel(parent) : "Uden mappe"}".` : ""}`)) return;
        for (const f of this._flows.filter((x) => inside(x.folder))) { const c = { ...f, folder: parent }; delete c.status; await this._ws({ type: `${WS}/save`, flow: c }); }
        await this._ws({ type: `${WS}/folders`, folders: this._folders.filter((x) => !inside(x)) });
        await this._load(); this._folder = parent || "__all"; this._render(); break;
      }
      case "new":
        this._newOpts = { name: "", folder: ["__all", "__none"].includes(this._folder) ? "" : this._folder, newFolder: "" };
        this._newChooser = true; this._render();
        setTimeout(() => { const n = this.shadowRoot.querySelector("[data-field=new-name]"); if (n) n.focus(); }, 0);
        break;
      case "new-advanced":
        this._newChooser = false;
        this._draft = { type: "advanced", name: this._newName("Nyt avanceret flow"), folder: this._newFolder(), enabled: true, mode: "single", condition_mode: "all", triggers: [], conditions: [], actions: [], else_actions: [], nodes: [], edges: [] };
        this._tf = null; this._dirty = true; this._view = "edit"; this._render(); break;
      case "close-new":
        this._newChooser = false; this._render(); break;
      case "new-standard":
        this._newChooser = false;
        this._draft = { name: this._newName("Nyt flow"), folder: this._newFolder(), enabled: true, mode: "single", condition_mode: "all", triggers: [], conditions: [], actions: [], else_actions: [] };
        this._dirty = true; this._view = "edit"; this._render();
        setTimeout(() => { const n = this.shadowRoot.querySelector("[data-field=name]"); if (n) { n.focus(); n.select(); } }, 0);
        break;
      case "open":
        this._draft = clone(flow); this._tf = null; this._dirty = false; this._view = "edit"; this._render(); break;
      case "run":
        await this._ws({ type: `${WS}/run`, flow_id: id }); this._toast(`Startede "${flow.name}"`); break;
      case "toggle":
        flow.enabled = !flow.enabled; this._render();
        await this._ws({ type: `${WS}/enable`, flow_id: id, enabled: flow.enabled }); break;
      case "duplicate": {
        const copy = clone(flow); delete copy.id; delete copy.status; copy.name = `${flow.name} (kopi)`;
        if (copy.type !== "advanced") for (const sec of ["triggers", "conditions", "actions", "else_actions"]) for (const c of copy[sec]) c.id = uid();
        await this._ws({ type: `${WS}/save`, flow: copy }); await this._load(); this._render(); this._toast("Flowet blev duplikeret"); break;
      }
      case "history":
        this._openHistory(id); break;
      case "close-history":
        this._historyFor = null; this._render(); break;
      case "clear-history":
        await this._ws({ type: `${WS}/clear_history`, flow_id: this._historyFor });
        this._runs[this._historyFor] = []; delete this._latestRun[this._historyFor]; this._render(); break;
      case "back":
        if (!this._confirmLeave()) return;
        this._stopListen();
        this._clearStash();
        this._view = "list"; this._draft = null; this._dirty = false; this._render(); break;
      case "restore-draft": {
        const st = this._readStash();
        if (!st) return;
        this._draft = st.draft; this._tf = null; this._dirty = true; this._view = "edit"; this._render(); break;
      }
      case "discard-draft":
        if (!window.confirm("Kassér de ikke-gemte ændringer?")) return;
        this._clearStash(); this._render(); break;
      case "save":
        if (await this._saveDraft()) { this._toast("Flowet er gemt"); this._render(); }
        break;
      case "test": {
        const saved = this._dirty || !this._draft.id ? await this._saveDraft() : this._draft;
        if (!saved) return;
        await this._ws({ type: `${WS}/run`, flow_id: saved.id });
        this._toast("Flowet kører…"); this._render(); break;
      }
      case "delete-flow":
        if (!window.confirm(`Slet flowet "${this._draft.name}"? Det kan ikke fortrydes.`)) return;
        await this._ws({ type: `${WS}/delete`, flow_id: this._draft.id });
        this._flows = this._flows.filter((f) => f.id !== this._draft.id);
        this._clearStash();
        this._view = "list"; this._draft = null; this._dirty = false; this._render(); break;
      case "draft-toggle":
        this._draft.enabled = !this._draft.enabled; this._dirty = true; this._render(); break;
      case "cmode":
        this._draft.condition_mode = el.dataset.mode; this._dirty = true; this._render(); break;
      case "add-card":
        this._openPicker(el.dataset.sec); break;
      case "edit-card":
        this._openPicker(el.dataset.sec, Number(el.dataset.idx)); break;
      case "del-card":
        this._draft[el.dataset.sec].splice(Number(el.dataset.idx), 1); this._dirty = true; this._render(); break;
      case "dup-card": {
        const list = this._draft[el.dataset.sec]; const i = Number(el.dataset.idx);
        list.splice(i + 1, 0, { ...clone(list[i]), id: uid() }); this._dirty = true; this._render(); break;
      }
      case "invert": {
        const c = this._draft[el.dataset.sec][Number(el.dataset.idx)];
        c.invert = !c.invert; this._dirty = true; this._render(); break;
      }
      case "close-picker":
        this._picker = null; this._render(); break;
      case "picker-back": {
        const p = this._picker;
        if (p.step === "config" && p.source) p.step = "cards"; else { p.step = "source"; p.source = null; }
        p.error = null; this._render(); break;
      }
      case "pick-app":
        Object.assign(this._picker, { step: "cards", source: { type: "app", id: el.dataset.app }, srcKey: null }); this._render(); break;
      case "pick-zone":
        Object.assign(this._picker, { step: "source", source: null, srcKey: null, zone: el.dataset.zone }); this._render(); break;
      case "pick-source": {
        const g = this._sources(catOf(this._picker.section)).find((x) => x.key === el.dataset.key);
        if (!g) return;
        this._picker.srcKey = g.key;
        if (g.entities.length === 1 && !(g.deviceId && catOf(this._picker.section) === "t")) {
          const defs = entityDefs(g.entities[0], this._hass.states[g.entities[0]]).filter((d) => d.cat === catOf(this._picker.section) && !d.hidden);
          Object.assign(this._picker, { step: "cards", source: { type: "device", name: g.name, entities: g.entities } });
          if (defs.length === 1) { this._chooseDef(defs[0], g.entities[0]); return; }
        } else {
          Object.assign(this._picker, { step: "cards", source: { type: "device", name: g.name, entities: g.entities, deviceId: g.deviceId } });
          if (g.deviceId && catOf(this._picker.section) === "t") this._loadDeviceTriggers(g.deviceId);
        }
        this._render(); break;
      }
      case "pick-def": {
        const eid = el.dataset.eid || null;
        const cat = catOf(this._picker.section);
        const def = (eid ? entityDefs(eid, this._hass.states[eid]) : appDefs(this._ctx())).find((d) => d.id === el.dataset.def && d.cat === cat);
        if (def) this._chooseDef(def, eid);
        break;
      }
      case "wd": {
        const p = this._picker; const k = el.dataset.key; const day = el.dataset.day;
        const cur = new Set(p.args[k] || []);
        if (cur.has(day)) cur.delete(day); else cur.add(day);
        p.args[k] = WEEKDAYS.map(([d]) => d).filter((d) => cur.has(d));
        this._keepScroll = true; this._render(); break;
      }
      case "confirm-card":
        this._confirmCard(); break;
      case "listen":
        if (this._listen) this._stopListen(); else this._startListen();
        this._render(); break;
      case "listen-use": this._useHeard(Number(el.dataset.i)); break;
      case "listen-clear": this._listen.items = []; this._render(); break;
      case "ent-del": {
        const p = this._picker; const k = el.dataset.key;
        const l = Array.isArray(p.args[k]) ? p.args[k] : p.args[k] ? [p.args[k]] : [];
        l.splice(Number(el.dataset.i), 1); p.args[k] = l; this._keepScroll = true; this._render(); break;
      }
      case "swap-def": {
        const p = this._picker;
        const cat = catOf(p.section);
        const def = (p.eid ? entityDefs(p.eid, this._hass.states[p.eid]) : appDefs(this._ctx())).find((d) => d.id === el.dataset.def && d.cat === cat);
        if (!def || def.id === p.def.id) break;
        const args = this._swapArgs(def, p.args);
        for (const k of Object.keys(args)) if (args[k] === "" && !(def.fields || []).find((f) => f.key === k && f.default === "")) delete args[k];
        Object.assign(p, { def, args, error: null });
        this._keepScroll = true; this._render(); break;
      }
      case "pick-devtrig": {
        const p = this._picker;
        const t = (p.devTriggers || [])[Number(el.dataset.i)];
        const def = appDefs(this._ctx()).find((d) => d.id === "dev.trigger");
        if (t && def) this._chooseDef(def, null, { label: t.label, full: `${p.source.name}: ${t.label}`, config: t.config });
        break;
      }
      case "nr-open": this._nrOpen(); break;
      case "nr-close": if (!this._nr || !this._nr.busy) { this._nr = null; this._render(); } break;
      case "nr-paste-mode": this._nr = { step: "paste", paste: "" }; this._render(); break;
      case "nr-parse": this._nrParse(); break;
      case "nr-toggle": {
        const t = el.dataset.tab; const sel = this._nr.selected;
        if (sel.has(t)) sel.delete(t); else sel.add(t);
        this._keepScroll = true; this._render(); break;
      }
      case "nr-import": this._nrImport(); break;
      case "nr-switch": this._nrSwitch(true); break;
      case "nr-revert": this._nrSwitch(false); break;
      case "to-advanced":
        if (!window.confirm("Lav flowet om til et avanceret flow? Det kan ikke laves tilbage igen.")) return;
        this._draft = toAdvanced(this._draft); this._tf = null; this._dirty = true; this._render(); break;
      default:
        this._canvasClick(a, el);
    }
  }

  _onInput(e) {
    const t = e.composedPath()[0];
    const field = t.dataset && t.dataset.field;
    if (field === "search") { this._search = t.value; this._renderListOnly(field); return; }
    if (field === "dsearch") { this._dsearch = t.value; this._renderListOnly(field); return; }
    if (field === "tree-filter") { this._treeQ = t.value; this._renderListOnly(field); return; }
    if (field === "new-name") { this._newOpts.name = t.value; return; }
    if (t.dataset && t.dataset.entAdd && this._picker && (e.inputType === "insertReplacementText" || !e.inputType) && this._hass.states[t.value.trim()]) {
      this._onChange(e); return;
    }
    if (field === "nr-paste") { this._nr.paste = t.value; return; }
    if (field === "new-folder-name") { this._newOpts.newFolder = t.value; return; }
    if (field === "name") { this._draft.name = t.value; this._markDirty(); return; }
    if (field === "picker-search") {
      this._picker.search = t.value;
      clearTimeout(this._searchT);
      this._searchT = setTimeout(() => {
        this._render();
        const s = this.shadowRoot.querySelector("[data-field=picker-search]");
        if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
      }, 120);
      return;
    }
    if (t.dataset && t.dataset.arg && this._picker) {
      this._picker.args[t.dataset.arg] = t.type === "checkbox" ? t.checked : t.value;
      if (t.type === "range") { const o = t.parentElement.querySelector("output"); if (o) o.textContent = t.value; }
      this._updatePreview();
    }
  }

  _onChange(e) {
    const t = e.composedPath()[0];
    const field = t.dataset && t.dataset.field;
    if (field === "folder-select") { this._folder = t.value; this._render(); return; }
    if (field === "area-select") { this._area = t.value; this._render(); return; }
    if (field === "new-folder") {
      this._newOpts.folder = t.value; this._render();
      if (t.value === "__new") setTimeout(() => { const n = this.shadowRoot.querySelector("[data-field=new-folder-name]"); if (n) n.focus(); }, 0);
      return;
    }
    if (field === "draft-folder") { this._draft.folder = t.value; this._markDirty(); return; }
    if (field === "draft-mode") { this._draft.mode = t.value; this._markDirty(); return; }
    if (field === "picker-unavail") { this._picker.showUnavailable = t.checked; this._render(); return; }
    if (t.dataset && t.dataset.entAdd && this._picker) {
      const k = t.dataset.entAdd; const val = t.value.trim();
      if (!this._hass.states[val]) return;
      const l = Array.isArray(this._picker.args[k]) ? this._picker.args[k] : this._picker.args[k] ? [this._picker.args[k]] : [];
      if (!l.includes(val)) l.push(val);
      this._picker.args[k] = l; this._keepScroll = true; this._render();
      setTimeout(() => { const n = this.shadowRoot.querySelector(`[data-ent-add="${k}"]`); if (n) n.focus(); }, 0);
      return;
    }
    if (field === "card-disabled") { this._picker.disabled = t.checked; return; }
    if (t.dataset && t.dataset.arg && this._picker) {
      this._picker.args[t.dataset.arg] = t.type === "checkbox" ? t.checked : t.value;
      this._updatePreview();
    }
  }

  _markDirty() {
    this._dirty = true;
    const b = this.shadowRoot.querySelector("[data-action=save]");
    if (b) b.disabled = false;
    const c = this.shadowRoot.querySelector(".chip.unsaved");
    if (c) c.hidden = false;
    this._stashDraft();
  }

  /* ---- unsaved work survives navigation, reloads and restarts (per browser) */
  _stashDraft() {
    if (this._view !== "edit" || !this._dirty || !this._draft) return;
    const d = this._draft;
    const empty = !(d.nodes || []).length && !["triggers", "conditions", "actions", "else_actions"].some((k) => (d[k] || []).length);
    if (!d.id && empty) return;
    try { localStorage.setItem("flow_cards_draft", JSON.stringify({ at: Date.now(), draft: this._draft })); } catch (e) { /* storage unavailable */ }
  }
  _clearStash() { try { localStorage.removeItem("flow_cards_draft"); } catch (e) { /* ignore */ } }
  _readStash() {
    try { const v = JSON.parse(localStorage.getItem("flow_cards_draft") || "null"); return v && v.draft ? v : null; } catch (e) { return null; }
  }

  _updatePreview() {
    const el = this.shadowRoot.querySelector("[data-preview]");
    if (!el || !this._picker || !this._picker.def) return;
    try { el.innerHTML = this._picker.def.text(this._picker.args); } catch (err) { /* ignore */ }
  }

  _renderListOnly(field = "search") {
    const s = this.shadowRoot.querySelector(`[data-field=${field}]`);
    const pos = s ? s.selectionStart : 0;
    this._render();
    const s2 = this.shadowRoot.querySelector(`[data-field=${field}]`);
    if (s2) { s2.focus(); s2.setSelectionRange(pos, pos); }
  }

  /* ---------------- drag & drop between/within columns */

  _onDragStart(e) {
    const fl = e.composedPath().find((n) => n.dataset && n.dataset.dragFlow);
    if (fl) { this._fdrag = fl.dataset.dragFlow; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", "flow"); fl.classList.add("dragging"); return; }
    const card = e.composedPath().find((n) => n.classList && n.classList.contains("card"));
    if (!card) return;
    this._drag = { sec: card.dataset.sec, idx: Number(card.dataset.idx) };
    card.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", "card");
  }
  _onDragOver(e) {
    if (this._fdrag) {
      const t = e.composedPath().find((n) => n.dataset && n.dataset.fdrop !== undefined);
      this.shadowRoot.querySelectorAll(".hy-ti.drop").forEach((n) => n !== t && n.classList.remove("drop"));
      if (t) { e.preventDefault(); t.classList.add("drop"); }
      return;
    }
    if (!this._drag) return;
    const col = e.composedPath().find((n) => n.dataset && n.dataset.drop);
    if (!col) return;
    const ok = catOf(col.dataset.drop) === catOf(this._drag.sec);
    if (ok) e.preventDefault();
  }
  _onDrop(e) {
    if (this._fdrag) {
      const t = e.composedPath().find((n) => n.dataset && n.dataset.fdrop !== undefined);
      const id = this._fdrag; this._fdrag = null;
      if (t) { e.preventDefault(); this._moveFlow(id, t.dataset.fdrop); } else this._render();
      return;
    }
    if (!this._drag) return;
    const path = e.composedPath();
    const col = path.find((n) => n.dataset && n.dataset.drop);
    if (!col || catOf(col.dataset.drop) !== catOf(this._drag.sec)) return;
    e.preventDefault();
    const target = path.find((n) => n.classList && n.classList.contains("card"));
    const toSec = col.dataset.drop;
    const from = this._draft[this._drag.sec];
    const [card] = from.splice(this._drag.idx, 1);
    const to = this._draft[toSec];
    let idx = to.length;
    if (target && target.dataset.sec === toSec) {
      idx = Number(target.dataset.idx);
      const r = target.getBoundingClientRect();
      if (e.clientY > r.top + r.height / 2) idx += 1;
      if (toSec === this._drag.sec && this._drag.idx < idx) idx -= 1;
    }
    to.splice(idx, 0, card);
    this._drag = null;
    this._dirty = true;
    this._render();
  }
  /* ================================================================ listen: "do something, get a card" */

  _startListen() {
    const conn = this._hass.connection;
    this._listen = { items: [], unsubs: [], started: Date.now() };
    const L = this._listen;
    const sub = (type, cb) => L.unsubs.push(conn.subscribeEvents(cb, type));
    sub("state_changed", (ev) => this._heardState(ev.data || {}));
    for (const t of ["zha_event", "deconz_event"]) sub(t, (ev) => this._heardEvent(t, ev.data || {}));
    this._listenDevices(L);
  }

  /* Buttons that only exist as device triggers (e.g. Zigbee2MQTT remotes without an action entity):
     subscribe to each device trigger directly, like Home Assistant automations do. */
  async _listenDevices(L) {
    const devs = Object.entries(this._hass.devices || {}).filter(([, d]) => d.entry_type !== "service" && !d.disabled_by).map(([id]) => id);
    this._devTrigCache = this._devTrigCache || {};
    L.preparing = true;
    L.buttons = 0;
    const work = async () => {
      while (devs.length && this._listen === L) {
        const id = devs.shift();
        let trigs = this._devTrigCache[id];
        if (!trigs) {
          try { trigs = await this._hass.callWS({ type: "device_automation/trigger/list", device_id: id }); } catch (e) { trigs = []; }
          this._devTrigCache[id] = trigs || [];
        }
        for (const t of (trigs || []).filter((x) => !x.entity_id)) {
          if (this._listen !== L) return;
          const d = this._hass.devices[id] || {};
          const name = d.name_by_user || d.name || "Enhed";
          const label = this._devTrigLabel(t, {});
          const item = { key: `dev|${JSON.stringify(t)}`, eid: null, name, text: label, icon: "mdi:gesture-tap-button", def: "dev.trigger", args: { label, full: `${name}: ${label}`, config: t } };
          L.buttons += 1;
          L.unsubs.push(this._hass.connection.subscribeMessage(() => this._heard(item), { type: "subscribe_trigger", trigger: t }).catch(() => null));
        }
      }
    };
    await Promise.all(Array.from({ length: 8 }, work));
    if (this._listen === L) { L.preparing = false; this._safeRender(); }
  }


  _stopListen() {
    if (!this._listen) return;
    for (const u of this._listen.unsubs) Promise.resolve(u).then((f) => f && f()).catch(() => {});
    this._listen = null;
  }

  _heard(item) {
    const L = this._listen;
    if (!L) return;
    const i = L.items.findIndex((x) => x.key === item.key);
    if (i >= 0) L.items.splice(i, 1);
    L.items.unshift({ ...item, at: Date.now() });
    L.items.length = Math.min(L.items.length, 8);
    clearTimeout(this._listenT);
    this._listenT = setTimeout(() => this._safeRender(), 150);
  }

  _heardState(d) {
    const eid = d.entity_id || "";
    const o = d.old_state, n = d.new_state;
    if (!n || !o) return;
    const dom = eid.split(".")[0];
    const reg = (this._hass.entities || {})[eid] || {};
    if (reg.hidden || reg.entity_category) return;
    const bad = ["unavailable", "unknown"];
    const name = (n.attributes && n.attributes.friendly_name) || eid;
    const st = this._hass.states[eid] || n;
    if (dom === "event") {
      if (bad.includes(n.state) || o.state === n.state) return;
      const t = n.attributes.event_type;
      const types = n.attributes.event_types || [];
      this._heard({ key: `${eid}|${t}`, eid, name, text: t ? eventLabel(t) : "Trykket", icon: "mdi:gesture-tap-button", def: types.includes(t) ? `e.press_${t}` : "e.press_any", args: {} });
      return;
    }
    if (dom === "button" || dom === "input_button") {
      if (bad.includes(n.state) || o.state === n.state) return;
      this._heard({ key: eid, eid, name, text: "Trykket", icon: "mdi:gesture-tap-button", def: "e.press", args: {} });
      return;
    }
    if (o.state === n.state || bad.includes(n.state) || bad.includes(o.state)) return;
    if (["sensor"].includes(dom)) {
      const dc = n.attributes.device_class;
      if (!["power", "current", "apparent_power"].includes(dc)) return;
      const a = Number(o.state), b = Number(n.state);
      if (!isFinite(a) || !isFinite(b)) return;
      const unit = n.attributes.unit_of_measurement || "";
      const min = dc === "current" ? 0.05 : 5;
      if (Math.abs(b - a) < min || Math.abs(b - a) < Math.max(Math.abs(a), Math.abs(b)) * 0.5) return;
      const mid = Math.round(((a + b) / 2) * (dc === "current" ? 100 : 1)) / (dc === "current" ? 100 : 1);
      const up = b > a;
      this._heard({ key: `${eid}|${up}`, eid, name, icon: "mdi:flash", text: `${up ? "Steg" : "Faldt"} fra ${a} til ${b} ${unit}`,
        def: up ? "e.above" : "e.below", args: up ? { above: mid } : { below: mid } });
      return;
    }
    if (["sun", "weather", "update", "zone", "automation", "script", "device_tracker", "calendar", "todo", "image", "camera", "number", "text", "input_text", "input_number", "input_datetime", "time", "date", "tts", "stt", "conversation", "sensor", "select"].includes(dom)) return;
    const defs = entityDefs(eid, st);
    const pick = (id) => defs.find((x) => x.id === id && x.cat === "t");
    let def = null; let args = {};
    if (ON_OFF.includes(dom) || dom === "binary_sensor") def = pick(n.state === "on" ? "e.on" : n.state === "off" ? "e.off" : "");
    else if (dom === "cover") def = pick(n.state === "open" ? "e.open" : n.state === "closed" ? "e.closed" : "");
    else if (dom === "lock") def = pick(n.state === "locked" ? "e.locked" : n.state === "unlocked" ? "e.unlocked" : "");
    else if (dom === "person") def = pick(n.state === "home" ? "e.home" : o.state === "home" ? "e.leave" : "");
    else if (dom === "media_player") def = pick(n.state === "playing" ? "e.play" : o.state === "playing" ? "e.stop" : "");
    if (!def) { def = pick("e.to"); args = { to: n.state }; }
    if (!def) return;
    let text; try { text = stripHtml(def.text(args)); } catch (e) { text = n.state; }
    this._heard({ key: `${eid}|${def.id}`, eid, name, text, icon: this._entityIcon(eid), def: def.id, args });
  }

  _heardEvent(type, data) {
    const dev = (this._hass.devices || {})[data.device_id];
    const name = dev ? dev.name_by_user || dev.name : data.device_ieee || data.unique_id || type;
    const what = data.command || data.event || data.id || "hændelse";
    const match = {};
    if (data.device_id) match.device_id = data.device_id;
    if (data.command) match.command = data.command;
    if (data.event !== undefined) match.event = data.event;
    this._heard({ key: `${type}|${JSON.stringify(match)}`, eid: null, name, icon: "mdi:remote", text: `Sender “${eventLabel(String(what))}”`,
      def: "events.event", args: { event_type: type, event_data: JSON.stringify(match) } });
  }

  _useHeard(i) {
    const L = this._listen;
    const h = L && L.items[i];
    if (!h) return;
    const defs = h.eid ? entityDefs(h.eid, this._hass.states[h.eid]) : appDefs(this._ctx());
    const def = defs.find((d) => d.id === h.def && d.cat === "t");
    if (!def) { this._toast("Kortet kunne ikke laves", true); return; }
    const args = {};
    for (const fl of def.fields || []) if (fl.default !== undefined) args[fl.key] = clone(fl.default);
    Object.assign(args, h.args);
    this._picker = { section: "triggers", step: "config", def, eid: h.eid, args, disabled: false };
    this._confirmCard();
    this._toast(`Tilføjet: ${h.name} – ${h.text}`);
  }

  _renderListen() {
    const L = this._listen;
    const ago = (t) => { const s = Math.round((Date.now() - t) / 1000); return s < 5 ? "lige nu" : s < 60 ? `${s} sek siden` : `${Math.round(s / 60)} min siden`; };
    const rows = L.items.map((h, i) => `<div class="heard"><span class="ic"><ha-icon icon="${esc(h.icon)}"></ha-icon></span>
      <span class="t"><b>${esc(h.name)}</b><span>${esc(h.text)} · ${ago(h.at)}</span></span>
      <button class="btn primary" data-action="listen-use" data-i="${i}">Brug</button></div>`).join("");
    const left = Math.max(16, Math.round(this.getBoundingClientRect().left) + 16);
    const status = L.preparing ? "Finder knapper og fjernbetjeninger…" : `Lytter efter alle enheder${L.buttons ? ` og ${L.buttons} knap-hændelser` : ""}`;
    return `<div class="listen-box" style="left:${left}px"><div class="lh"><span class="pulse"></span><b>Lytter…</b><span class="grow"></span>${L.items.length ? `<button class="btn ghost" data-action="listen-clear">Ryd</button>` : ""}<button class="icon-btn" data-action="listen" title="Stop"><ha-icon icon="mdi:close"></ha-icon></button></div>
      <div class="ls">${esc(status)}</div>
      ${rows || `<p class="lp">Tryk på en knap, tænd eller sluk noget, åbn en dør – eller sæt noget i et stik med strømmåler. Det dukker op her, og du kan bruge det som NÅR-kort.</p>`}</div>`;
  }

  /* ================================================================ Node-RED import */

  async _nrApi(method, path, body) {
    if (!this._nrBase) {
      const sup = (endpoint, m = "get") => this._hass.callWS({ type: "supervisor/api", endpoint, method: m });
      const addons = await sup("/addons");
      const list = (addons && addons.addons) || [];
      const a = list.find((x) => /(^|_)nodered$/.test(x.slug)) || list.find((x) => /node-?red/i.test(x.name || ""));
      if (!a) throw new Error("Node-RED-appen blev ikke fundet");
      const info = await sup(`/addons/${a.slug}/info`);
      if (info.state && info.state !== "started") throw new Error("Node-RED kører ikke lige nu");
      if (!info.ingress_url) throw new Error("Node-RED har ikke ingress slået til");
      const sess = await sup("/ingress/session", "post");
      document.cookie = `ingress_session=${sess.session};path=/api/hassio_ingress/;SameSite=Strict${location.protocol === "https:" ? ";Secure" : ""}`;
      this._nrBase = info.ingress_url.replace(/\/$/, "");
    }
    const headers = { "Node-RED-API-Version": "v2" };
    if (body) { headers["Content-Type"] = "application/json"; headers["Node-RED-Deployment-Type"] = "flows"; }
    const res = await fetch(`${this._nrBase}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, credentials: "same-origin" });
    if (!res.ok) { this._nrBase = null; throw new Error(`Node-RED svarede med fejl ${res.status}`); }
    const txt = await res.text();
    return txt ? JSON.parse(txt) : {};
  }

  async _nrOpen() {
    this._nr = { step: "loading", busy: true };
    this._render();
    try {
      const res = await this._nrApi("GET", "/flows");
      this._nrLoaded(Array.isArray(res) ? res : res.flows || [], true);
    } catch (err) {
      this._nr = { step: "paste", paste: "", error: `Kunne ikke hente direkte fra Node-RED (${err.message || err}). Du kan indsætte en eksport i stedet.` };
      this._render();
    }
  }

  _nrParse() {
    try {
      const v = JSON.parse(this._nr.paste || "");
      const arr = Array.isArray(v) ? v : v && Array.isArray(v.flows) ? v.flows : null;
      if (!arr || !arr.length) throw new Error();
      this._nrLoaded(arr, false);
    } catch (e) {
      this._nr.error = "Det indsatte er ikke en gyldig Node-RED-eksport (JSON).";
      this._render();
    }
  }

  _nrLoaded(all, auto) {
    const tabs = all.filter((n) => n.type === "tab");
    const imported = new Set(this._flows.map((f) => (/^Importeret fra Node-RED-fanen "(.*)"$/.exec(f.description || "") || [])[1]).filter(Boolean));
    const info = tabs.map((t) => {
      const { flows, report } = nodeRedImport(all, [t.id]);
      return { id: t.id, label: t.label || t.id, disabled: !!t.disabled, nodes: all.filter((n) => n.z === t.id).length, flows: flows.length, notes: report[0].notes.length, already: imported.has(t.label) };
    });
    const selected = new Set(info.filter((t) => !t.disabled && t.flows && !t.already).map((t) => t.id));
    this._nr = { step: "pick", all, auto, tabs: info, selected };
    this._render();
  }

  async _nrImport() {
    const nr = this._nr;
    const ids = [...nr.selected];
    if (!ids.length) { this._toast("Vælg mindst én fane", true); return; }
    const labels = new Set(nr.tabs.filter((t) => nr.selected.has(t.id)).map((t) => t.label));
    const old = this._flows.filter((f) => { const m = /^Importeret fra Node-RED-fanen "(.*)"$/.exec(f.description || ""); return m && labels.has(m[1]); });
    if (old.length && !window.confirm(`${old.length} ${old.length === 1 ? "flow" : "flows"} fra en tidligere import af de valgte faner bliver erstattet. Fortsæt?`)) return;
    nr.busy = true; nr.step = "importing"; this._render();
    const liveTabs = new Set(old.filter((f) => f.enabled).map((f) => /^Importeret fra Node-RED-fanen "(.*)"$/.exec(f.description)[1]));
    for (const f of old) {
      try { await this._hass.callWS({ type: `${WS}/delete`, flow_id: f.id }); } catch (e) { /* already gone */ }
    }
    const { flows, report } = nodeRedImport(nr.all, ids);
    const created = [];
    const failed = [];
    for (const f of flows) {
      const tabId = f._nrTab; delete f._nrTab;
      if (liveTabs.has(f.folder)) f.enabled = true;   // tab was already switched over: keep it running here
      try {
        const res = await this._hass.callWS({ type: `${WS}/save`, flow: f });
        created.push({ id: res.id, name: res.name, tab: tabId });
      } catch (err) { failed.push(`${f.name}: ${err.message || err}`); }
    }
    await this._load();
    this._nr = { step: "done", auto: nr.auto, report, created, failed, tabs: ids, switched: false };
    this._render();
  }

  async _nrSwitch(on) {
    const nr = this._nr;
    const n = nr.tabs.length;
    const q = on ? `Slå ${n} ${n === 1 ? "fane" : "faner"} fra i Node-RED og de importerede flows til her?` : "Slå fanerne til igen i Node-RED og de importerede flows fra her?";
    if (!window.confirm(q)) return;
    nr.busy = true; this._render();
    try {
      const cur = await this._nrApi("GET", "/flows");
      const flows = Array.isArray(cur) ? cur : cur.flows;
      for (const node of flows) if (node.type === "tab" && nr.tabs.includes(node.id)) node.disabled = on;
      await this._nrApi("POST", "/flows", Array.isArray(cur) ? flows : { rev: cur.rev, flows });
      for (const c of nr.created) await this._hass.callWS({ type: `${WS}/enable`, flow_id: c.id, enabled: on });
      await this._load();
      nr.switched = on;
      this._toast(on ? "Skiftet over: Node-RED-fanerne er slået fra, og flowene kører her" : "Node-RED-fanerne er slået til igen");
    } catch (err) {
      this._toast(`Kunne ikke ændre Node-RED: ${err.message || err}`, true);
    }
    nr.busy = false; this._render();
  }

  _renderNodeRed() {
    const nr = this._nr;
    let body = "";
    let foot = "";
    if (nr.step === "loading" || nr.step === "importing") {
      body = `<div class="empty"><ha-icon icon="mdi:loading" class="spin"></ha-icon><p>${nr.step === "loading" ? "Henter flows fra Node-RED…" : "Opretter flows…"}</p></div>`;
    } else if (nr.step === "paste") {
      body = `${nr.error ? `<div class="error-box">${esc(nr.error)}</div>` : ""}
        <p>I Node-RED: <b>☰ menu → Export → All flows → JSON → Copy to clipboard</b>. Indsæt det herunder.</p>
        <textarea class="mono" style="min-height:200px" data-field="nr-paste" placeholder='[{"id": "...", "type": "tab", ...}]'>${esc(nr.paste || "")}</textarea>`;
      foot = `<button class="btn ghost" data-action="nr-close">Annullér</button><button class="btn primary" data-action="nr-parse">Fortsæt</button>`;
    } else if (nr.step === "pick") {
      body = `<p>Hver fane bliver en mappe. Hver selvstændig kæde i fanen bliver et <b>avanceret flow</b>. Flowene oprettes <b>slået fra</b>, så intet kører dobbelt.</p>
        <div class="nr-tabs">${nr.tabs.map((t) => `<button class="nr-tab ${nr.selected.has(t.id) ? "sel" : ""}" data-action="nr-toggle" data-tab="${esc(t.id)}" ${t.flows ? "" : "disabled"}>
          <span class="box">${nr.selected.has(t.id) ? "✓" : ""}</span>
          <span class="t"><b>${esc(t.label)}</b><span class="s">${t.nodes} noder → ${t.flows} ${t.flows === 1 ? "flow" : "flows"}${t.notes ? ` · ${t.notes} at tjekke` : ""}${t.disabled ? " · slået fra i Node-RED" : ""}${t.already ? " · allerede importeret (vælg for at erstatte)" : ""}</span></span></button>`).join("")}</div>`;
      foot = `<button class="btn ghost" data-action="nr-close">Annullér</button><button class="btn primary" data-action="nr-import" ${nr.selected.size ? "" : "disabled"}>Importér ${nr.selected.size} ${nr.selected.size === 1 ? "fane" : "faner"}</button>`;
    } else if (nr.step === "done") {
      const notes = nr.report.flatMap((r) => r.notes.map((x) => `<li><b>${esc(r.tab)}:</b> ${esc(x)}</li>`));
      body = `<div class="lastrun success"><ha-icon icon="mdi:check-circle"></ha-icon><span><b>${nr.created.length} flows oprettet</b> i ${nr.report.length} ${nr.report.length === 1 ? "mappe" : "mapper"}. De er slået fra indtil videre.</span></div>
        ${nr.failed.length ? `<div class="error-box" style="margin-top:12px">${nr.failed.map(esc).join("<br>")}</div>` : ""}
        ${notes.length ? `<div class="sub">Skal tjekkes (vist som gule noter på lærredet)</div><ul class="nr-notes">${notes.join("")}</ul>` : ""}
        <div class="sub">Næste skridt</div>
        <p>Åbn flowene og se dem igennem. Når de ser rigtige ud, flytter <b>Skift over</b> styringen hertil: fanerne slås fra i Node-RED, og flowene slås til her. Det kan fortrydes med samme knap.</p>
        ${nr.auto ? "" : "<p>Du indsatte en eksport, så fanerne skal slås fra i Node-RED i hånden: dobbeltklik på fanen → <b>Disabled</b> → Deploy.</p>"}`;
      foot = `<button class="btn ghost" data-action="nr-close">Luk</button>${nr.auto ? (nr.switched
        ? `<button class="btn ghost" data-action="nr-revert" ${nr.busy ? "disabled" : ""}>Fortryd: tilbage til Node-RED</button>`
        : `<button class="btn primary" data-action="nr-switch" ${nr.busy || !nr.created.length ? "disabled" : ""}>Skift over</button>`) : ""}`;
    }
    return `<div class="scrim" data-action="scrim"><div class="modal wide"><header><ha-icon icon="mdi:import"></ha-icon><h3>Importér fra Node-RED</h3>${nr.busy ? "" : `<button class="icon-btn" data-action="nr-close"><ha-icon icon="mdi:close"></ha-icon></button>`}</header>
      <div class="content">${body}</div>${foot ? `<footer>${nr.step === "pick" && nr.auto ? `<button class="btn ghost" data-action="nr-paste-mode" style="margin-right:auto">Indsæt eksport i stedet</button>` : ""}${foot}</footer>` : ""}</div></div>`;
  }

  /* ================================================================ advanced flows (canvas) */

  _newName(fallback) { return ((this._newOpts && this._newOpts.name) || "").trim() || fallback; }
  _newFolder() {
    const o = this._newOpts || {};
    if (o.folder === "__new") {
      const name = (o.newFolder || "").trim();
      if (name && !this._folders.includes(name)) this._folders = [...this._folders, name];
      return name;
    }
    return o.folder || "";
  }

  _renderNewChooser() {
    const opt = (action, icon, title, text) => `<button class="choice" data-action="${action}"><span class="ic"><ha-icon icon="${icon}"></ha-icon></span><span><b>${title}</b><br><span class="s">${text}</span></span></button>`;
    const o = this._newOpts;
    const folderOpts = `<option value="">Ingen mappe</option>${this._folderTree().map((t) => `<option value="${esc(t.path)}" ${o.folder === t.path ? "selected" : ""}>${esc(fLabel(t.path))}</option>`).join("")}<option value="__new" ${o.folder === "__new" ? "selected" : ""}>+ Ny mappe…</option>`;
    return `<div class="scrim" data-action="scrim"><div class="modal"><header><h3>Nyt flow</h3><button class="icon-btn" data-action="close-new"><ha-icon icon="mdi:close"></ha-icon></button></header>
      <div class="content">
        <div class="field"><label for="nf-name">Navn</label><input id="nf-name" data-field="new-name" value="${esc(o.name)}" placeholder="F.eks. Kontor: lys ved knaptryk" autofocus></div>
        <div class="field"><label for="nf-folder">Mappe</label><select id="nf-folder" data-field="new-folder">${folderOpts}</select></div>
        ${o.folder === "__new" ? `<div class="field"><label for="nf-newfolder">Navn på ny mappe</label><input id="nf-newfolder" data-field="new-folder-name" value="${esc(o.newFolder)}" placeholder="F.eks. Gardiner"></div>` : ""}
        <div class="sub">Vælg type</div>
        <div class="choices">
        ${opt("new-standard", "mdi:view-column-outline", "Flow", "Enkelt flow med kolonnerne NÅR, OG, SÅ og ELLERS.")}
        ${opt("new-advanced", "mdi:vector-polyline", "Avanceret flow", "Frit lærred: placér kort og forbind dem med ledninger. Flere grene, ✓/✗-udgange, fejlhåndtering og logikkort.")}
      </div></div></div></div>`;
  }

  _nodeH(n) { return n.sec === "logic" && n.kind === "note" ? 90 : 96; }

  _ports(n) {
    if (n.sec === "triggers") return [["out", 30]];
    if (n.sec === "conditions") return [["true", 30], ["false", 66]];
    if (n.sec === "actions") return [["out", 30], ["error", 66]];
    if (n.kind === "note") return [];
    return [["out", 30]];
  }

  _renderCanvas() {
    const f = this._draft;
    const run = this._latestRun[f.id];
    const badges = {};
    if (run) for (const st of run.steps || []) badges[st.card_id] = st;
    const tf = this._tf || { x: 40, y: 40, z: 1 };
    const nodes = f.nodes.map((n) => {
      const sec = SECTIONS[n.sec] || SECTIONS.logic;
      const src = n.sec === "logic" ? { name: n.kind === "note" ? "Note" : n.kind === "all" ? "Alle" : "Én af", icon: n.kind === "note" ? "mdi:note-text-outline" : n.kind === "all" ? "mdi:set-all" : "mdi:call-split" } : this._cardSource(n, n.sec);
      const b = badges[n.id];
      const badge = b ? `<span class="badge ${b.status} ${run && this._seenRun !== run.id + run.status ? "fresh" : ""}" title="${esc(b.error || b.text || b.status)}">${b.status === "error" ? "!" : b.status === "false" ? "✕" : b.status === "skipped" || b.status === "cancelled" ? "–" : "✓"}</span>` : "";
      const inPin = n.sec !== "triggers" && n.kind !== "note" ? `<span class="pin in" data-in="${n.id}"></span>` : "";
      const outs = this._ports(n).map(([port, top]) => `<span class="pin out ${port}" data-pin="${port}" data-node="${n.id}" style="top:${top}px" title="${{ out: "Udgang", true: "Hvis sand", false: "Hvis falsk", error: "Hvis fejl" }[port]}">${{ true: "✓", false: "✕", error: "!" }[port] || ""}</span>`).join("");
      const tools = `${n.sec === "triggers" ? `<button data-action="node-run" data-node="${n.id}" title="Test fra dette kort"><ha-icon icon="mdi:play" style="--mdc-icon-size:16px"></ha-icon></button>` : ""}
        ${n.sec === "conditions" ? `<button class="not ${n.invert ? "" : "off"}" data-action="node-invert" data-node="${n.id}">IKKE</button>` : ""}
        <button data-action="node-dup" data-node="${n.id}" title="Dupliker"><ha-icon icon="mdi:content-copy" style="--mdc-icon-size:15px"></ha-icon></button>
        <button data-action="node-del" data-node="${n.id}" title="Fjern"><ha-icon icon="mdi:close" style="--mdc-icon-size:16px"></ha-icon></button>`;
      let body = n.sec === "logic" ? (appDefs(this._ctx()).find((d) => d.id === n.card) || { text: () => esc(n.kind) }).text(n.args || {}) : this._cardText(n, n.sec);
      if (n.sec === "logic" && (n.kind === "all" || n.kind === "any")) body += this._logicInputsHtml(n);
      const conn = this._connect && this._connect.node !== n.id && inPin ? "target" : "";
      return `<div class="node ${sec.cls} ${n.kind === "note" ? "note" : ""} ${n.disabled ? "disabled" : ""} ${conn} ${this._connect && this._connect.node === n.id ? "source" : ""}" data-nid="${n.id}" style="left:${n.x}px;top:${n.y}px;min-height:${this._nodeH(n)}px">
        ${badge}${inPin}${n.kind === "note" ? "" : `<span class="nic"><ha-icon icon="${esc(src.icon)}"></ha-icon></span>`}<div class="nhead"><span class="src">${esc(src.name)}</span>${tools}</div>
        <div class="nbody">${n.invert ? `<b class="notlbl">Ikke:</b> ` : ""}${body}</div>${outs}</div>`;
    }).join("");
    const empty = f.nodes.length ? "" : `<div class="cv-empty"><ha-icon icon="mdi:vector-polyline"></ha-icon><p><b>Tomt lærred</b></p><p>Start med et <b>NÅR</b>-kort. Træk derefter fra den runde udgang på et kort over til det næste kort, eller tryk på udgangen og så på kortet.</p></div>`;
    const banner = this._connect ? `<div class="cv-banner">Tryk på det kort, ledningen skal gå til <button class="btn ghost" data-action="cv-cancel">Annullér</button></div>` : "";
    const zoomPct = Math.round(tf.z * 100);
    const addMenu = this._addMenu ? `<div class="hy-layer" data-action="cv-close-pop"></div><div class="cv-pop add">
        <button data-action="cv-add" data-sec="triggers">Når…</button><button data-action="cv-add" data-sec="conditions">Og…</button><button data-action="cv-add" data-sec="actions">Så…</button><div class="sep"></div>
        <button data-action="cv-quick" data-def="logic.delay" data-sec="actions">Vent</button><button data-action="cv-quick" data-def="logic.all" data-sec="logic">Alle</button><button data-action="cv-quick" data-def="logic.any" data-sec="logic">Én af</button><div class="sep"></div>
        <button data-action="cv-quick" data-def="logic.note" data-sec="logic">Note</button></div>` : "";
    const setMenu = this._setMenu ? `<div class="hy-layer" data-action="cv-close-pop"></div><div class="cv-pop set">
        <label>Mappe<select data-field="draft-folder"><option value="">Ingen mappe</option>${this._folderTree().map((t) => `<option value="${esc(t.path)}" ${f.folder === t.path ? "selected" : ""}>${esc(fLabel(t.path))}</option>`).join("")}</select></label>
        <label>Ved ny udløsning<select data-field="draft-mode">${MODES.map(([k, l]) => `<option value="${k}" ${f.mode === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <div class="sep"></div>
        ${f.id ? `<button data-action="history" data-id="${f.id}"><ha-icon icon="mdi:history"></ha-icon>Historik</button><button data-action="duplicate" data-id="${f.id}"><ha-icon icon="mdi:content-copy"></ha-icon>Dupliker</button><button class="danger" data-action="delete-flow"><ha-icon icon="mdi:delete-outline"></ha-icon>Slet flow</button>` : `<span class="muted">Gem flowet for flere valg</span>`}</div>` : "";
    const canSave = this._dirty || !f.id;
    const fl = `<div class="cv-float l">
        ${this._narrow ? `<button class="pl" data-action="back" title="Tilbage"><ha-icon icon="mdi:arrow-left"></ha-icon></button>` : ""}
        <button class="pl ${canSave ? "act" : ""}" data-action="save" ${canSave ? "" : "disabled"} title="Gem"><ha-icon icon="mdi:check"></ha-icon><span>Gem</span></button>
        <span class="pl duo"><button data-action="cv-undo" ${(this._undo || []).length ? "" : "disabled"} title="Fortryd"><ha-icon icon="mdi:undo"></ha-icon></button><i></i><button data-action="cv-redo" ${(this._redo || []).length ? "" : "disabled"} title="Gentag"><ha-icon icon="mdi:redo"></ha-icon></button></span>
        <button class="pl" data-action="vars" title="Hjælpere i Home Assistant"><ha-icon icon="mdi:variable"></ha-icon><span>Variabler</span></button>
        <span class="pw"><button class="pl blue" data-action="cv-addmenu"><ha-icon icon="mdi:plus"></ha-icon><span>Tilføj</span></button>${addMenu}</span>
        <button class="pl ${this._listen ? "rec" : ""}" data-action="listen" title="Tryk på en knap, tænd noget eller sæt noget i stikket – så foreslår Flows et Når-kort"><ha-icon icon="mdi:ear-hearing"></ha-icon><span>${this._listen ? "Lytter…" : "Lyt"}</span></button>
</div>
      <div class="cv-float r">
        <input class="pl name" data-field="name" value="${esc(f.name)}" placeholder="Navn på flow">
        <button class="switch ${f.enabled ? "on" : ""}" data-action="draft-toggle" title="${f.enabled ? "Flowet er slået til" : "Flowet er slået fra"}"></button>
        <span class="chip unsaved" ${this._dirty ? "" : "hidden"}>Ikke gemt</span>
        <button class="pl" data-action="test" title="Gem og kør flowet nu"><ha-icon icon="mdi:play"></ha-icon><span>Test</span></button>
        <span class="pw"><button class="pl round" data-action="cv-setmenu" title="Flere valg"><ha-icon icon="mdi:dots-horizontal"></ha-icon></button>${setMenu}</span></div>`;
    const canvas = `<div class="canvas hyc" data-canvas>
        <div class="world" style="transform:translate(${tf.x}px,${tf.y}px) scale(${tf.z})">
          <svg class="wires" width="1" height="1"></svg>${nodes}
        </div>${empty}${banner}${fl}
        <div class="cv-zoom"><button data-action="cv-zoom" data-dir="-1" title="Zoom ud">−</button><span>${zoomPct}%</span><button data-action="cv-zoom" data-dir="1" title="Zoom ind">+</button><button data-action="cv-fit" title="Tilpas"><ha-icon icon="mdi:fit-to-screen-outline" style="--mdc-icon-size:18px"></ha-icon></button></div>
      </div>`;
    return this._hyShell({ title: "Flow", plus: "new", plusTitle: "Nyt flow", tree: this._editorTree(), main: canvas, active: "flows", mainCls: "cv" });
  }

  _editorTree() {
    const q = (this._treeQ || "").trim().toLowerCase();
    const cur = this._draft && this._draft.id;
    const groups = [["", "Mine flows"], ...this._folderTree().map((t) => [t.path, t.leaf, t.depth])];
    let html = `<div class="hy-filter"><ha-icon icon="mdi:magnify"></ha-icon><input type="search" data-field="tree-filter" placeholder="Filtrér…" value="${esc(this._treeQ || "")}"></div>`;
    for (const [path, label, depth = 0] of groups) {
      const list = this._flows.filter((f) => (f.folder || "") === path && (!q || f.name.toLowerCase().includes(q))).sort((a, b) => a.name.localeCompare(b.name, "da"));
      if (q && !list.length) continue;
      html += `<div class="hy-ti grp" style="--d:${depth}"><span class="bul"></span><span class="lb">${esc(label)}</span></div>`;
      html += list.map((f) => `<div role="button" class="hy-ti ${f.id === cur ? "sel" : ""} ${f.enabled ? "" : "dim"}" style="--d:${depth + 1}" data-action="hy-open" data-id="${f.id}"><ha-icon icon="${f.type === "advanced" ? "mdi:vector-polyline" : "mdi:shuffle-variant"}"></ha-icon><span class="lb">${esc(f.name)}</span></div>`).join("");
    }
    if (this._draft && !this._draft.id) html += `<div class="hy-ti sel" style="--d:1"><ha-icon icon="mdi:vector-polyline"></ha-icon><span class="lb">${esc(this._draft.name || "Nyt flow")}</span></div>`;
    return html;
  }

  _renderVars() {
    const doms = ["input_boolean", "input_number", "input_text", "input_select", "input_datetime", "input_button", "counter", "timer"];
    const list = Object.values(this._hass.states).filter((st) => doms.includes(st.entity_id.split(".")[0])).sort((a, b) => this._entityName(a.entity_id).localeCompare(this._entityName(b.entity_id), "da"));
    const label = { input_boolean: "Ja/nej", input_number: "Tal", input_text: "Tekst", input_select: "Valg", input_datetime: "Dato/tid", input_button: "Knap", counter: "Tæller", timer: "Timer" };
    const rows = list.map((st) => {
      const eid = st.entity_id, dom = eid.split(".")[0];
      const ctl = dom === "input_boolean" ? `<button class="switch ${st.state === "on" ? "on" : ""}" data-action="var-toggle" data-eid="${eid}"></button>`
        : dom === "input_button" ? `<button class="btn ghost" data-action="var-press" data-eid="${eid}">Tryk</button>`
        : `<button class="vval" data-action="var-info" data-eid="${eid}">${esc(st.state)}${st.attributes.unit_of_measurement ? ` ${esc(st.attributes.unit_of_measurement)}` : ""}</button>`;
      return `<div class="vrow"><span class="vt"><b>${esc(this._entityName(eid))}</b><small>${label[dom]} · ${esc(eid)}</small></span>${ctl}</div>`;
    }).join("");
    return `<div class="scrim" data-action="scrim"><div class="modal hym"><header><h3>Variabler</h3><button class="btn ghost" data-action="hy-goto" data-path="/config/helpers"><ha-icon icon="mdi:plus"></ha-icon>Ny variabel</button><button class="icon-btn" data-action="vars-close"><ha-icon icon="mdi:close"></ha-icon></button></header>
      <div class="content"><p class="dthint" style="margin:0 0 10px">Variabler er hjælpere i Home Assistant. Brug dem i kort som "${esc("Hvis … er tændt")}" eller "Sæt … til".</p>${rows || `<div class="empty">Ingen hjælpere endnu</div>`}</div></div></div>`;
  }

  _afterCanvasRender() {
    const lr = this._draft && this._latestRun[this._draft.id];
    if (lr && lr.status !== "running") setTimeout(() => { this._seenRun = lr.id + lr.status; }, 0);
    if (!this._tf) { this._tf = { x: 40, y: 40, z: 1 }; if (this._draft.nodes.length) { this._fit(); return; } }
    this._drawWires();
  }

  _canvasEl() { return this.shadowRoot.querySelector("[data-canvas]"); }

  _applyTf() {
    const w = this.shadowRoot.querySelector(".world");
    if (w) w.style.transform = `translate(${this._tf.x}px,${this._tf.y}px) scale(${this._tf.z})`;
    const z = this.shadowRoot.querySelector(".cv-zoom span");
    if (z) z.textContent = `${Math.round(this._tf.z * 100)}%`;
  }

  _nodeBox(n) {
    const el = this.shadowRoot.querySelector(`[data-nid="${n.id}"]`);
    return { x: n.x, y: n.y, w: el ? el.offsetWidth : 250, h: el ? el.offsetHeight : this._nodeH(n) };
  }

  _pinPos(nodeId, port) {
    const n = this._draft.nodes.find((x) => x.id === nodeId);
    if (!n) return null;
    const b = this._nodeBox(n);
    if (port === "in") return { x: b.x, y: b.y + 30 };
    const pp = this._ports(n).find(([p]) => p === port);
    return { x: b.x + b.w, y: b.y + (pp ? pp[1] : 30) };
  }

  _bez(a, b) {
    const dx = Math.max(50, Math.abs(b.x - a.x) / 2);
    return { d: `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`,
      mid: { x: 0.125 * a.x + 0.375 * (a.x + dx) + 0.375 * (b.x - dx) + 0.125 * b.x, y: 0.5 * a.y + 0.5 * b.y } };
  }

  _drawWires(temp) {
    const svg = this.shadowRoot.querySelector("svg.wires");
    if (!svg) return;
    let html = "";
    let delBtn = "";
    this._draft.edges.forEach((e, i) => {
      const a = this._pinPos(e.from, e.port);
      const b = this._pinPos(e.to, "in");
      if (!a || !b) return;
      const { d, mid } = this._bez(a, b);
      const sel = this._selEdge === i;
      html += `<path class="hit" data-edge="${i}" d="${d}"/><path class="wire ${e.port} ${sel ? "sel" : ""}" d="${d}"/>`;
      if (sel) delBtn = `<button class="wire-del" data-action="edge-del" data-edge="${i}" style="left:${mid.x}px;top:${mid.y}px" title="Fjern ledning">✕</button>`;
    });
    if (temp) html += `<path class="wire temp ${temp.port}" d="${this._bez(temp.a, temp.b).d}"/>`;
    svg.innerHTML = html;
    const old = this.shadowRoot.querySelector(".wire-del");
    if (old) old.remove();
    if (delBtn) svg.insertAdjacentHTML("afterend", delBtn);
  }

  _toWorld(clientX, clientY) {
    const r = this._canvasEl().getBoundingClientRect();
    return { x: (clientX - r.left - this._tf.x) / this._tf.z, y: (clientY - r.top - this._tf.y) / this._tf.z };
  }

  _newNodePos() {
    const cv = this._canvasEl();
    const r = cv ? cv.getBoundingClientRect() : { left: 0, top: 0, width: 800, height: 600 };
    const tf = this._tf || { x: 40, y: 40, z: 1 };
    const c = { x: (r.width / 2 - tf.x) / tf.z - 125, y: (r.height / 2 - tf.y) / tf.z - 48 };
    const boxes = this._draft.nodes.map((n) => this._nodeBox(n));
    const free = (x, y) => !boxes.some((bx) => x < bx.x + bx.w + 20 && x + 250 + 20 > bx.x && y < bx.y + bx.h + 20 && y + 100 + 20 > bx.y);
    for (let ring = 0; ring < 12; ring++) {
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const x = Math.round(c.x + dx * ring * 140), y = Math.round(c.y + dy * ring * 120);
        if (free(x, y)) return { x, y };
      }
    }
    return { x: Math.round(c.x), y: Math.round(c.y) };
  }

  _zoomAt(factor, cx, cy) {
    const cv = this._canvasEl();
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    const px = cx === undefined ? r.width / 2 : cx - r.left;
    const py = cy === undefined ? r.height / 2 : cy - r.top;
    const z = Math.min(2, Math.max(0.25, this._tf.z * factor));
    const k = z / this._tf.z;
    this._tf = { z, x: px - (px - this._tf.x) * k, y: py - (py - this._tf.y) * k };
    this._applyTf();
  }

  _fit() {
    const cv = this._canvasEl();
    const nodes = this._draft.nodes;
    if (!cv || !nodes.length) { this._tf = { x: 40, y: 40, z: 1 }; this._applyTf(); this._drawWires(); return; }
    const boxes = nodes.map((n) => this._nodeBox(n));
    const minX = Math.min(...boxes.map((b) => b.x)), minY = Math.min(...boxes.map((b) => b.y));
    const maxX = Math.max(...boxes.map((b) => b.x + b.w)), maxY = Math.max(...boxes.map((b) => b.y + b.h));
    const r = cv.getBoundingClientRect();
    const pad = 40;
    const minZ = r.width < 700 ? 0.55 : 0.25;
    const z = Math.min(1.2, Math.max(minZ, Math.min((r.width - pad * 2) / (maxX - minX || 1), (r.height - pad * 2 - 40) / (maxY - minY || 1))));
    const fitsX = (maxX - minX) * z <= r.width - pad;
    this._tf = { z, x: fitsX ? (r.width - (maxX - minX) * z) / 2 - minX * z : 20 - minX * z, y: pad - minY * z };
    this._applyTf();
    this._drawWires();
  }

  _addEdge(from, port, to) {
    const f = this._draft;
    const src = f.nodes.find((n) => n.id === from);
    const dst = f.nodes.find((n) => n.id === to);
    if (!src || !dst || from === to) return false;
    if (dst.sec === "triggers" || dst.kind === "note") { this._toast("Ledninger kan ikke gå ind i et NÅR-kort eller en note", true); return false; }
    if (f.edges.some((e) => e.from === from && e.port === port && e.to === to)) return false;
    f.edges.push({ from, port, to });
    this._dirty = true;
    return true;
  }

  _canvasClick(a, el) {
    const f = this._draft;
    if (!f || f.type !== "advanced") return false;
    const id = el.dataset.node;
    switch (a) {
      case "cv-add": this._connect = null; this._openPicker(el.dataset.sec); return true;
      case "cv-zoom": this._zoomAt(el.dataset.dir === "1" ? 1.2 : 1 / 1.2); return true;
      case "cv-fit": this._fit(); return true;
      case "cv-cancel": this._connect = null; this._render(); return true;
      case "node-del":
        f.nodes = f.nodes.filter((n) => n.id !== id);
        f.edges = f.edges.filter((e) => e.from !== id && e.to !== id);
        this._selEdge = null; this._dirty = true; this._render(); return true;
      case "node-dup": {
        const n = f.nodes.find((x) => x.id === id);
        f.nodes.push({ ...clone(n), id: uid(), x: n.x + 30, y: n.y + 30 });
        this._dirty = true; this._render(); return true;
      }
      case "node-invert": {
        const n = f.nodes.find((x) => x.id === id);
        n.invert = !n.invert; this._dirty = true; this._render(); return true;
      }
      case "node-run":
        (async () => {
          const saved = this._dirty || !f.id ? await this._saveDraft() : f;
          if (!saved) return;
          await this._ws({ type: `${WS}/run`, flow_id: saved.id, node_id: id });
          this._toast("Flowet kører fra dette kort"); this._render();
        })();
        return true;
      case "edge-del":
        f.edges.splice(Number(el.dataset.edge), 1);
        this._selEdge = null; this._dirty = true; this._drawWires(); this._markDirty(); return true;
      default:
        return false;
    }
  }

  /* ---- pointer handling: pan, move cards, draw wires, pinch-zoom */

  _cvDown(e) {
    const cv = this._canvasEl();
    if (!cv || this._picker || this._historyFor) return;
    const path = e.composedPath();
    if (!path.includes(cv)) return;
    if (path.find((n) => n.tagName === "BUTTON" || n.tagName === "SELECT" || n.tagName === "INPUT")) return;
    this._pointers = this._pointers || new Map();
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (this._pointers.size === 2) {
      const [p1, p2] = [...this._pointers.values()];
      this._ptr = { type: "pinch", dist: Math.hypot(p1.x - p2.x, p1.y - p2.y), z: this._tf.z, moved: true };
      return;
    }
    const pin = path.find((n) => n.dataset && n.dataset.pin);
    const hit = path.find((n) => n.dataset && n.dataset.edge !== undefined && n.tagName === "path");
    const node = path.find((n) => n.dataset && n.dataset.nid);
    const base = { sx: e.clientX, sy: e.clientY, moved: false };
    if (pin) this._ptr = { ...base, type: "wire", node: pin.dataset.node, port: pin.dataset.pin };
    else if (hit) this._ptr = { ...base, type: "edge", edge: Number(hit.dataset.edge) };
    else if (node) {
      const n = this._draft.nodes.find((x) => x.id === node.dataset.nid);
      this._ptr = { ...base, type: "node", id: n.id, ox: n.x, oy: n.y, el: node };
    } else this._ptr = { ...base, type: "pan", ox: this._tf.x, oy: this._tf.y };
    e.preventDefault();
  }

  _cvMove(e) {
    const p = this._ptr;
    if (!p) return;
    if (this._pointers && this._pointers.has(e.pointerId)) this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (p.type === "pinch") {
      const [p1, p2] = [...this._pointers.values()];
      if (!p2) return;
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      this._zoomAt((p.z * d / p.dist) / this._tf.z, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
      return;
    }
    const dx = e.clientX - p.sx, dy = e.clientY - p.sy;
    if (!p.moved && Math.hypot(dx, dy) < 5) return;
    p.moved = true;
    if (p.type === "pan") { this._tf.x = p.ox + dx; this._tf.y = p.oy + dy; this._applyTf(); }
    else if (p.type === "node") {
      const n = this._draft.nodes.find((x) => x.id === p.id);
      n.x = Math.round(p.ox + dx / this._tf.z); n.y = Math.round(p.oy + dy / this._tf.z);
      p.el.style.left = `${n.x}px`; p.el.style.top = `${n.y}px`;
      this._drawWires();
    } else if (p.type === "wire") {
      this._drawWires({ a: this._pinPos(p.node, p.port), b: this._toWorld(e.clientX, e.clientY), port: p.port });
    }
  }

  _cvUp(e, cancelled) {
    if (this._pointers) this._pointers.delete(e.pointerId);
    const p = this._ptr;
    if (!p) return;
    if (p.type === "pinch") { if (!this._pointers || !this._pointers.size) this._ptr = null; return; }
    this._ptr = null;
    if (cancelled) { this._render(); return; }
    if (p.type === "node") {
      if (p.moved) { this._markDirty(); this._dirty = true; if (this._pending) this._render(); return; }
      if (this._connect) {
        const c = this._connect; this._connect = null;
        this._addEdge(c.node, c.port, p.id); this._render(); return;
      }
      this._selEdge = null;
      const n = this._draft.nodes.find((x) => x.id === p.id);
      if (n.sec === "logic" && n.kind !== "note") { this._render(); return; }
      this._openPicker(n.sec, undefined, n.id);
      return;
    }
    if (p.type === "wire") {
      if (!p.moved) { this._connect = { node: p.node, port: p.port }; this._render(); return; }
      const target = this.shadowRoot.elementsFromPoint ? this.shadowRoot.elementsFromPoint(e.clientX, e.clientY) : [];
      const nodeEl = target.map((t) => t.closest && t.closest("[data-nid]")).find(Boolean);
      if (nodeEl) this._addEdge(p.node, p.port, nodeEl.dataset.nid);
      this._render();
      return;
    }
    if (p.type === "edge") { this._selEdge = p.edge; this._connect = null; this._drawWires(); return; }
    if (p.type === "pan") {
      if (!p.moved && (this._connect || this._selEdge !== null && this._selEdge !== undefined)) { this._connect = null; this._selEdge = null; this._render(); return; }
      if (this._pending) this._render();
    }
  }

  _cvWheel(e) {
    const cv = this._canvasEl();
    if (!cv || !e.composedPath().includes(cv)) return;
    e.preventDefault();
    if (e.ctrlKey || Math.abs(e.deltaY) > Math.abs(e.deltaX) && !e.shiftKey && e.deltaMode === 1 || e.ctrlKey) {
      this._zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
    } else {
      this._tf.x -= e.deltaX; this._tf.y -= e.deltaY; this._applyTf();
    }
  }

  _dragEnd() {
    if (this._fdrag) { this._fdrag = null; this._render(); return; }
    if (this._drag) { this._drag = null; this._render(); }
  }
}

if (!customElements.get("flow-cards-panel")) customElements.define("flow-cards-panel", FlowCardsPanel);
window.__FLOW_CARDS_VERSION__ = FC_VERSION;
