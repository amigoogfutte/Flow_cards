/* Flow Cards – Homey-style WHEN / AND / THEN flows for Home Assistant. */
const FC_VERSION = "0.3.0";
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
    // Avanceret
    { id: "adv.state", app: "advanced", cat: "t",
      text: (a) => `${pill(ename(a.entity_id))} ændrer tilstand${a.from ? ` fra ${pill(a.from)}` : ""}${a.to ? ` til ${pill(a.to)}` : ""}${num(a.minutes) ? ` i ${pill(`${a.minutes} min`)}` : ""}`,
      fields: [{ key: "entity_id", label: "Entitet", type: "entity", required: true }, { key: "from", label: "Fra tilstand (valgfri)", type: "text" },
        { key: "to", label: "Til tilstand (valgfri)", type: "text" }, { key: "attribute", label: "Attribut (valgfri)", type: "text" },
        { key: "minutes", label: "I mindst (minutter, valgfri)", type: "number", min: 0 }],
      build: (a) => ({ kind: "state", entity_id: [a.entity_id], from: a.from || undefined, to: a.to || undefined, attribute: a.attribute || undefined, for: num(a.minutes) ? num(a.minutes) * 60 : undefined }) },
    { id: "adv.numeric", app: "advanced", cat: "t",
      text: (a) => `${pill(ename(a.entity_id))}${a.attribute ? ` (${esc(a.attribute)})` : ""} bliver${a.above !== undefined && a.above !== "" ? ` over ${pill(a.above)}` : ""}${a.below !== undefined && a.below !== "" ? ` under ${pill(a.below)}` : ""}`,
      fields: [{ key: "entity_id", label: "Entitet", type: "entity", required: true }, { key: "above", label: "Over", type: "number" }, { key: "below", label: "Under", type: "number" }, { key: "attribute", label: "Attribut (valgfri)", type: "text" }],
      build: (a) => ({ kind: "numeric", entity_id: [a.entity_id], above: num(a.above), below: num(a.below), attribute: a.attribute || undefined }) },
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
    T("above", (a) => `Bliver over ${pill(`${a.above}${unit}`)}`, (a) => ({ kind: "numeric", above: num(a.above) }), aboveF);
    T("below", (a) => `Bliver under ${pill(`${a.below}${unit}`)}`, (a) => ({ kind: "numeric", below: num(a.below) }), belowF);
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
        const rules = n.rules || [];
        const setPayload = rules.find((r) => r.t === "set" && r.p === "payload" && r.pt === "msg");
        if (setPayload && rules.length === 1) {
          const v = nrConst(setPayload.to, setPayload.tot);
          return allOuts({ ...ctx, payload: v, entity: v === undefined ? ctx.entity : undefined });
        }
        return allOuts(rules.some((r) => r.p === "payload") ? { ...ctx, payload: undefined, entity: undefined } : ctx);
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
        const raw = String(n.data || "").trim();
        if (raw) {
          try { data = JSON.parse(raw); if (typeof data !== "object" || Array.isArray(data)) throw new Error(); }
          catch (e) { data = {}; tabReport.notes.push(`${n.name || service}: data "${raw.slice(0, 40)}" er udeladt (JSONata)`); }
        }
        const cid = add({ id: n.id, sec: "actions", kind: "service", card: "adv.service", service, entity_id: ents, data,
          args: { service, entity_id: ents[0] || "", data: Object.keys(data).length ? JSON.stringify(data) : "" }, ...pos(n) }, n);
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
        note(n, "enheds-trigger: vælg den tilsvarende knap eller sensor som NÅR-kort");
      } else if (["server-events", "poll-state", "ha-webhook", "ha-time", "zone", "ha-tag", "ha-sentence", "http in", "mqtt in"].includes(t)) {
        note(n, "denne type start kan ikke oversættes endnu");
      }
    }

    /* anything left that does real work but was never converted becomes a note, so nothing silently disappears */
    const touched = new Set(Object.values(origin));
    const NR_CONFIG = /config|^server$|^tab$|^subflow$|^global-config$|^ha-entity-config$|connection/;
    for (const n of tabNodes) {
      if (n.d || touched.has(n.id) || NR_DROP.has(n.type) || NR_PASS.has(n.type) || NR_CONFIG.test(n.type)) continue;
      if (["change", "switch", "link out", "inject", "sun-event-inject", "server-state-changed", "trigger-state", "trigger", "delay", "api-current-state"].includes(n.type)) continue;
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
    this.shadowRoot.addEventListener("wheel", (e) => this._cvWheel(e), { passive: false });
    this.shadowRoot.addEventListener("keydown", (e) => {
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

  _topBar(inner) {
    return `<div class="top">${this._narrow ? `<button class="icon-btn" data-action="menu" title="Menu"><ha-icon icon="mdi:menu"></ha-icon></button>` : ""}${inner}</div>`;
  }

  _render() {
    this._pending = false;
    if (!this._loaded) return;
    this._stashDraft();
    const body = this._view !== "edit" ? this._renderList() : this._draft.type === "advanced" ? this._renderCanvas() : this._renderEditor();
    const modal = this._picker ? this._renderPicker() : this._historyFor ? this._renderHistory() : this._newChooser ? this._renderNewChooser() : this._nr ? this._renderNodeRed() : "";
    const toast = this._toastMsg ? `<div class="toast ${this._toastMsg.error ? "error" : ""}">${esc(this._toastMsg.msg)}</div>` : "";
    const scroll = this.shadowRoot.querySelector(".content");
    const top = scroll ? scroll.scrollTop : 0;
    this.shadowRoot.innerHTML = `<style>${STYLE}</style><div class="${this._narrow ? "narrow" : ""}" style="min-height:100vh;background:var(--fc-bg)">${body}${modal}${toast}</div>`;
    const sc = this.shadowRoot.querySelector(".content");
    if (sc && this._keepScroll) sc.scrollTop = top;
    this._keepScroll = false;
    if (this._view === "edit" && this._draft && this._draft.type === "advanced") this._afterCanvasRender();
  }

  _filteredFlows() {
    const q = this._search.trim().toLowerCase();
    return this._flows
      .filter((f) => this._folder === "__all" || (this._folder === "__none" ? !f.folder : f.folder === this._folder))
      .filter((f) => !q || f.name.toLowerCase().includes(q) || this._flowSummary(f).toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "da"));
  }

  _renderList() {
    const flows = this._filteredFlows();
    const count = (fn) => this._flows.filter(fn).length;
    const folderBtn = (id, label, icon, n, tools = "") =>
      `<div role="button" tabindex="0" class="f ${this._folder === id ? "sel" : ""}" data-action="folder" data-folder="${esc(id)}"><ha-icon icon="${icon}"></ha-icon><span>${esc(label)}</span><span class="n">${n}</span>${tools}</div>`;
    const side = `<div class="side">
      ${folderBtn("__all", "Alle flows", "mdi:folder-multiple-outline", this._flows.length)}
      ${folderBtn("__none", "Uden mappe", "mdi:folder-outline", count((f) => !f.folder))}
      <div class="sub">Mapper</div>
      ${this._folders.map((fo) => folderBtn(fo, fo, "mdi:folder", count((f) => f.folder === fo),
        `<span class="tools"><button data-action="rename-folder" data-folder="${esc(fo)}" title="Omdøb"><ha-icon icon="mdi:pencil" style="--mdc-icon-size:16px"></ha-icon></button><button data-action="delete-folder" data-folder="${esc(fo)}" title="Slet mappe"><ha-icon icon="mdi:delete-outline" style="--mdc-icon-size:16px"></ha-icon></button></span>`)).join("")}
      <button class="f" data-action="new-folder" style="color:var(--fc-muted)"><ha-icon icon="mdi:folder-plus-outline"></ha-icon><span>Ny mappe</span></button>
    </div>`;
    const rows = flows.map((f) => {
      const s = f.status || {};
      const lr = s.last_run;
      const dot = s.running ? "running" : lr ? (lr.status === "error" ? "error" : "ok") : "";
      const err = s.arm_error || (lr && lr.status === "error" && s.last_error ? `Fejl ${this._when(s.last_error.start)}: ${s.last_error.error}` : "");
      return `<div class="row ${f.enabled ? "" : "off"}" data-action="open" data-id="${f.id}">
        <span class="dot ${dot}" title="${esc(lr ? lr.status : "Ikke kørt endnu")}"></span>
        <div class="info"><div class="name">${esc(f.name)}</div><div class="sum">${esc(this._flowSummary(f))}</div>${err ? `<div class="err">${esc(err)}</div>` : ""}</div>
        ${f.folder && this._folder === "__all" ? `<span class="chip hide-sm">${esc(f.folder)}</span>` : ""}
        <span class="when">${lr ? esc(this._when(lr.start)) : "Ikke kørt"}</span>
        <button class="icon-btn" data-action="run" data-id="${f.id}" title="Kør nu"><ha-icon icon="mdi:play"></ha-icon></button>
        <button class="icon-btn hide-sm" data-action="history" data-id="${f.id}" title="Historik"><ha-icon icon="mdi:history"></ha-icon></button>
        <button class="icon-btn hide-sm" data-action="duplicate" data-id="${f.id}" title="Dupliker"><ha-icon icon="mdi:content-copy"></ha-icon></button>
        <button class="switch ${f.enabled ? "on" : ""}" data-action="toggle" data-id="${f.id}" title="${f.enabled ? "Slå fra" : "Slå til"}"></button>
      </div>`;
    }).join("");
    const folderSelect = `<select class="folder-select" data-field="folder-select">
      <option value="__all" ${this._folder === "__all" ? "selected" : ""}>Alle flows</option>
      <option value="__none" ${this._folder === "__none" ? "selected" : ""}>Uden mappe</option>
      ${this._folders.map((fo) => `<option value="${esc(fo)}" ${this._folder === fo ? "selected" : ""}>${esc(fo)}</option>`).join("")}</select>`;
    const empty = this._flows.length
      ? `<div class="empty"><p>Ingen flows her.</p></div>`
      : `<div class="empty"><ha-icon icon="mdi:graph-outline"></ha-icon><p><b>Ingen flows endnu</b></p><p>Et flow består af kort: <b>NÅR</b> noget sker, <b>OG</b> betingelserne passer, <b>SÅ</b> gør Home Assistant noget.</p><button class="btn primary" data-action="new">Opret dit første flow</button></div>`;
    return `${this._topBar(`<h1>Flows</h1><div class="grow"></div><button class="btn ghost" data-action="nr-open" title="Hent flows fra Node-RED"><ha-icon icon="mdi:import"></ha-icon><span class="hide-sm">Importér fra Node-RED</span></button><button class="btn primary" data-action="new"><ha-icon icon="mdi:plus"></ha-icon><span class="hide-sm">Nyt flow</span></button>`)}
      <div class="layout">${side}<div class="main">${folderSelect}
        ${(() => { const st = this._readStash(); return st ? `<div class="stash"><ha-icon icon="mdi:content-save-alert-outline"></ha-icon><span>Du har ikke-gemte ændringer i <b>${esc(st.draft.name || "et flow")}</b> fra ${esc(this._when(new Date(st.at).toISOString()))}.</span><span class="grow"></span><button class="btn primary" data-action="restore-draft">Fortsæt redigering</button><button class="btn ghost" data-action="discard-draft">Kassér</button></div>` : ""; })()}
        <input class="search" type="search" placeholder="Søg i flows…" data-field="search" value="${esc(this._search)}">
        <div class="list">${rows || empty}</div></div></div>`;
  }

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
        const badge = b ? `<span class="badge ${b.status}" title="${esc(b.error || b.text || b.status)}">${b.status === "error" ? "!" : b.status === "false" ? "✕" : b.status === "skipped" || b.status === "cancelled" ? "–" : "✓"}</span>` : "";
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
        <label>Mappe <select data-field="draft-folder"><option value="">Ingen</option>${this._folders.map((fo) => `<option ${f.folder === fo ? "selected" : ""}>${esc(fo)}</option>`).join("")}</select></label>
        <label>Ved ny udløsning <select data-field="draft-mode">${MODES.map(([k, l]) => `<option value="${k}" ${f.mode === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <span class="grow"></span>
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
        groups.set(key, { key, name: dev ? dev.name_by_user || dev.name || eid : st.attributes.friendly_name || eid, area: area ? area.name : "", entities: [], icon: this._entityIcon(eid) });
      }
      groups.get(key).entities.push(eid);
    }
    let list = [...groups.values()];
    if (q) list = list.filter((g) => `${g.name} ${g.area} ${g.entities.join(" ")} ${g.entities.map((e) => this._entityName(e)).join(" ")}`.toLowerCase().includes(q));
    list.sort((a, b) => (!a.area - !b.area) || a.area.localeCompare(b.area, "da") || a.name.localeCompare(b.name, "da"));
    return list;
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
        const sub = g.entities.length > 1 ? `${g.entities.length} entiteter` : g.entities[0];
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
        groups = p.source.entities.map((eid) => ({ name: this._entityName(eid), eid, defs: entityDefs(eid, this._hass.states[eid]).filter((d) => d.cat === cat && !d.hidden) })).filter((g) => g.defs.length);
      }
      content = groups.map((g) => `${groups.length > 1 || g.eid && g.name !== title ? `<div class="sub">${esc(g.name)}</div>` : ""}<div class="defs">${g.defs.map((d) => {
        let txt; try { txt = d.text(Object.fromEntries((d.fields || []).map((fl) => [fl.key, fl.type === "select" || fl.type === "number" || fl.type === "range" ? fl.default ?? "" : ""]))); } catch (e) { txt = d.id; }
        return `<button class="def" style="${color}" data-action="pick-def" data-def="${esc(d.id)}" data-eid="${esc(g.eid || "")}">${txt}</button>`;
      }).join("")}</div>`).join("");
    } else if (p.step === "config") {
      back = p.editIdx === undefined && p.section !== "logic";
      const def = p.def;
      title = p.eid ? this._entityName(p.eid) : (APPS.find((a) => a.id === def.app) || {}).name || "Kort";
      let preview; try { preview = def.text(p.args); } catch (e) { preview = ""; }
      content = `${p.error ? `<div class="error-box">${esc(p.error)}</div>` : ""}<div class="preview" style="${color}" data-preview>${preview}</div>
        ${(def.fields || []).map((fl) => this._renderField(fl, p.args[fl.key])).join("")}
        ${cat === "a" ? `<label class="check field"><input type="checkbox" data-field="card-disabled" ${p.disabled ? "checked" : ""}>Slå kortet fra (springes over)</label>` : ""}`;
      footer = `<footer><button class="btn ghost" data-action="close-picker">Annullér</button><button class="btn primary" data-action="confirm-card">${p.editIdx === undefined ? "Tilføj" : "Gem kort"}</button></footer>`;
    }
    return `<div class="scrim" data-action="scrim"><div class="modal" role="dialog">
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

  _openPicker(section, editIdx, nodeId) {
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

  _chooseDef(def, eid) {
    const p = this._picker;
    const args = {};
    for (const fl of def.fields || []) if (fl.default !== undefined) args[fl.key] = clone(fl.default);
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
    const flow = id && this._flows.find((f) => f.id === id);
    switch (a) {
      case "menu":
        this.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true })); break;
      case "folder":
        this._folder = el.dataset.folder; this._render(); break;
      case "new-folder": {
        const name = (window.prompt("Navn på den nye mappe") || "").trim();
        if (!name) return;
        if (!this._folders.includes(name)) await this._ws({ type: `${WS}/folders`, folders: [...this._folders, name] });
        this._folders = [...new Set([...this._folders, name])];
        this._folder = name; this._render(); break;
      }
      case "rename-folder": {
        const old = el.dataset.folder;
        const name = (window.prompt("Nyt navn på mappen", old) || "").trim();
        if (!name || name === old) return;
        for (const f of this._flows.filter((x) => x.folder === old)) await this._ws({ type: `${WS}/save`, flow: { ...f, folder: name } });
        await this._ws({ type: `${WS}/folders`, folders: this._folders.map((x) => (x === old ? name : x)) });
        await this._load(); this._folder = name; this._render(); break;
      }
      case "delete-folder": {
        const fo = el.dataset.folder;
        if (!window.confirm(`Slet mappen "${fo}"? Flowene i den flyttes til "Uden mappe".`)) return;
        await this._ws({ type: `${WS}/folders`, folders: this._folders.filter((x) => x !== fo) });
        await this._load(); this._folder = "__all"; this._render(); break;
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
        this._toast("Flowet kører – se markeringerne på kortene"); this._render(); break;
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
        Object.assign(this._picker, { step: "cards", source: { type: "app", id: el.dataset.app } }); this._render(); break;
      case "pick-source": {
        const g = this._sources(catOf(this._picker.section)).find((x) => x.key === el.dataset.key);
        if (!g) return;
        if (g.entities.length === 1) {
          const defs = entityDefs(g.entities[0], this._hass.states[g.entities[0]]).filter((d) => d.cat === catOf(this._picker.section) && !d.hidden);
          Object.assign(this._picker, { step: "cards", source: { type: "device", name: g.name, entities: g.entities } });
          if (defs.length === 1) { this._chooseDef(defs[0], g.entities[0]); return; }
        } else {
          Object.assign(this._picker, { step: "cards", source: { type: "device", name: g.name, entities: g.entities } });
        }
        this._render(); break;
      }
      case "pick-def": {
        const eid = el.dataset.eid || null;
        const def = eid ? entityDefs(eid, this._hass.states[eid]).find((d) => d.id === el.dataset.def) : appDefs(this._ctx()).find((d) => d.id === el.dataset.def);
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
    if (field === "search") { this._search = t.value; this._renderListOnly(); return; }
    if (field === "new-name") { this._newOpts.name = t.value; return; }
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
    if (field === "new-folder") {
      this._newOpts.folder = t.value; this._render();
      if (t.value === "__new") setTimeout(() => { const n = this.shadowRoot.querySelector("[data-field=new-folder-name]"); if (n) n.focus(); }, 0);
      return;
    }
    if (field === "draft-folder") { this._draft.folder = t.value; this._markDirty(); return; }
    if (field === "draft-mode") { this._draft.mode = t.value; this._markDirty(); return; }
    if (field === "picker-unavail") { this._picker.showUnavailable = t.checked; this._render(); return; }
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

  _renderListOnly() {
    const list = this.shadowRoot.querySelector(".list");
    if (!list) return;
    const s = this.shadowRoot.querySelector("[data-field=search]");
    const pos = s ? s.selectionStart : 0;
    this._render();
    const s2 = this.shadowRoot.querySelector("[data-field=search]");
    if (s2) { s2.focus(); s2.setSelectionRange(pos, pos); }
  }

  /* ---------------- drag & drop between/within columns */

  _onDragStart(e) {
    const card = e.composedPath().find((n) => n.classList && n.classList.contains("card"));
    if (!card) return;
    this._drag = { sec: card.dataset.sec, idx: Number(card.dataset.idx) };
    card.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", "card");
  }
  _onDragOver(e) {
    if (!this._drag) return;
    const col = e.composedPath().find((n) => n.dataset && n.dataset.drop);
    if (!col) return;
    const ok = catOf(col.dataset.drop) === catOf(this._drag.sec);
    if (ok) e.preventDefault();
  }
  _onDrop(e) {
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
    nr.busy = true; nr.step = "importing"; this._render();
    const { flows, report } = nodeRedImport(nr.all, ids);
    const created = [];
    const failed = [];
    for (const f of flows) {
      const tabId = f._nrTab; delete f._nrTab;
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
          <span class="t"><b>${esc(t.label)}</b><span class="s">${t.nodes} noder → ${t.flows} ${t.flows === 1 ? "flow" : "flows"}${t.notes ? ` · ${t.notes} at tjekke` : ""}${t.disabled ? " · slået fra i Node-RED" : ""}${t.already ? " · allerede importeret" : ""}</span></span></button>`).join("")}</div>`;
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
    const folderOpts = `<option value="">Ingen mappe</option>${this._folders.map((fo) => `<option value="${esc(fo)}" ${o.folder === fo ? "selected" : ""}>${esc(fo)}</option>`).join("")}<option value="__new" ${o.folder === "__new" ? "selected" : ""}>+ Ny mappe…</option>`;
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
      const badge = b ? `<span class="badge ${b.status}" title="${esc(b.error || b.text || b.status)}">${b.status === "error" ? "!" : b.status === "false" ? "✕" : b.status === "skipped" || b.status === "cancelled" ? "–" : "✓"}</span>` : "";
      const inPin = n.sec !== "triggers" && n.kind !== "note" ? `<span class="pin in" data-in="${n.id}"></span>` : "";
      const outs = this._ports(n).map(([port, top]) => `<span class="pin out ${port}" data-pin="${port}" data-node="${n.id}" style="top:${top}px" title="${{ out: "Udgang", true: "Hvis sand", false: "Hvis falsk", error: "Hvis fejl" }[port]}">${{ true: "✓", false: "✕", error: "!" }[port] || ""}</span>`).join("");
      const tools = `${n.sec === "triggers" ? `<button data-action="node-run" data-node="${n.id}" title="Test fra dette kort"><ha-icon icon="mdi:play" style="--mdc-icon-size:16px"></ha-icon></button>` : ""}
        ${n.sec === "conditions" ? `<button class="not ${n.invert ? "" : "off"}" data-action="node-invert" data-node="${n.id}">IKKE</button>` : ""}
        <button data-action="node-dup" data-node="${n.id}" title="Dupliker"><ha-icon icon="mdi:content-copy" style="--mdc-icon-size:15px"></ha-icon></button>
        <button data-action="node-del" data-node="${n.id}" title="Fjern"><ha-icon icon="mdi:close" style="--mdc-icon-size:16px"></ha-icon></button>`;
      const body = n.sec === "logic" ? (appDefs(this._ctx()).find((d) => d.id === n.card) || { text: () => esc(n.kind) }).text(n.args || {}) : this._cardText(n, n.sec);
      const conn = this._connect && this._connect.node !== n.id && inPin ? "target" : "";
      return `<div class="node ${sec.cls} ${n.kind === "note" ? "note" : ""} ${n.disabled ? "disabled" : ""} ${conn} ${this._connect && this._connect.node === n.id ? "source" : ""}" data-nid="${n.id}" style="left:${n.x}px;top:${n.y}px;min-height:${this._nodeH(n)}px">
        ${badge}${inPin}<div class="nhead"><ha-icon icon="${esc(src.icon)}" style="--mdc-icon-size:16px"></ha-icon><span class="src">${esc(src.name)}</span>${tools}</div>
        <div class="nbody">${n.invert ? `<b class="notlbl">Ikke:</b> ` : ""}${body}</div>${outs}</div>`;
    }).join("");
    const empty = f.nodes.length ? "" : `<div class="cv-empty"><ha-icon icon="mdi:vector-polyline"></ha-icon><p><b>Tomt lærred</b></p><p>Start med et <b>NÅR</b>-kort. Træk derefter fra den runde udgang på et kort over til det næste kort, eller tryk på udgangen og så på kortet.</p></div>`;
    const banner = this._connect ? `<div class="cv-banner">Tryk på det kort, ledningen skal gå til <button class="btn ghost" data-action="cv-cancel">Annullér</button></div>` : "";
    const zoomPct = Math.round(tf.z * 100);
    return `${this._topBar(`<button class="icon-btn" data-action="back" title="Tilbage"><ha-icon icon="mdi:arrow-left"></ha-icon></button>
        <input class="name-input" data-field="name" value="${esc(f.name)}" placeholder="Navn på flow">
        <button class="switch ${f.enabled ? "on" : ""}" data-action="draft-toggle" title="${f.enabled ? "Flowet er slået til" : "Flowet er slået fra"}"></button>
        <button class="btn ghost" data-action="test" title="Gem og kør flowet nu"><ha-icon icon="mdi:play"></ha-icon><span class="hide-sm">Test</span></button>
        <span class="chip unsaved" ${this._dirty ? "" : "hidden"}>Ikke gemt</span>
        <button class="btn primary" data-action="save" ${this._dirty || !f.id ? "" : "disabled"}><ha-icon icon="mdi:content-save"></ha-icon><span class="hide-sm">Gem</span></button>`)}
      <div class="cv-tools">
        <button class="tb when" data-action="cv-add" data-sec="triggers"><ha-icon icon="mdi:plus"></ha-icon>NÅR</button>
        <button class="tb and" data-action="cv-add" data-sec="conditions"><ha-icon icon="mdi:plus"></ha-icon>OG</button>
        <button class="tb then" data-action="cv-add" data-sec="actions"><ha-icon icon="mdi:plus"></ha-icon>SÅ</button>
        <button class="tb logic" data-action="cv-add" data-sec="logic"><ha-icon icon="mdi:plus"></ha-icon>Logik</button>
        <span class="grow"></span>
        <select data-field="draft-folder" title="Mappe"><option value="">Ingen mappe</option>${this._folders.map((fo) => `<option ${f.folder === fo ? "selected" : ""}>${esc(fo)}</option>`).join("")}</select>
        <select data-field="draft-mode" title="Ved ny udløsning">${MODES.map(([k, l]) => `<option value="${k}" ${f.mode === k ? "selected" : ""}>${l}</option>`).join("")}</select>
        ${f.id ? `<button class="icon-btn" data-action="history" data-id="${f.id}" title="Historik"><ha-icon icon="mdi:history"></ha-icon></button><button class="icon-btn danger" data-action="delete-flow" title="Slet flow"><ha-icon icon="mdi:delete-outline"></ha-icon></button>` : ""}
      </div>
      <div class="canvas" data-canvas>
        <div class="world" style="transform:translate(${tf.x}px,${tf.y}px) scale(${tf.z})">
          <svg class="wires" width="1" height="1"></svg>${nodes}
        </div>${empty}${banner}
        <div class="cv-zoom"><button data-action="cv-zoom" data-dir="-1" title="Zoom ud">−</button><span>${zoomPct}%</span><button data-action="cv-zoom" data-dir="1" title="Zoom ind">+</button><button data-action="cv-fit" title="Tilpas"><ha-icon icon="mdi:fit-to-screen-outline" style="--mdc-icon-size:18px"></ha-icon></button></div>
      </div>`;
  }

  _afterCanvasRender() {
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
    if (this._drag) { this._drag = null; this._render(); }
  }
}

if (!customElements.get("flow-cards-panel")) customElements.define("flow-cards-panel", FlowCardsPanel);
window.__FLOW_CARDS_VERSION__ = FC_VERSION;
