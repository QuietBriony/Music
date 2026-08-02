import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = "config/music-host-dom-contract.json";
const read = (path) => readFileSync(resolve(ROOT, path), "utf8");
const manifest = JSON.parse(read(MANIFEST_PATH));

const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
  "meta", "param", "source", "track", "wbr"
]);
const RAW_OR_INERT_TAGS = new Set([
  "iframe", "noembed", "noframes", "noscript", "plaintext", "script", "style",
  "template", "textarea", "title", "xmp"
]);

function sorted(values) {
  return [...values].sort();
}

function assertSortedUnique(values, label) {
  assert.ok(Array.isArray(values), `${label} must be an array`);
  assert.equal(new Set(values).size, values.length, `${label} must not contain duplicates`);
  assert.deepEqual(values, sorted(values), `${label} must stay sorted`);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function findHtmlTagEnd(html, start, label) {
  let quote = "";
  for (let index = start; index < html.length; index += 1) {
    const char = html[index];
    if (quote) {
      if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === ">") return index;
  }
  assert.fail(`${label} has an unterminated HTML tag at offset ${start}`);
}

function parseHtmlAttributes(raw, tagNameEnd, label) {
  const attributes = new Map();
  let index = tagNameEnd;
  while (index < raw.length) {
    while (/\s/.test(raw[index] || "")) index += 1;
    if (index >= raw.length || raw[index] === ">") break;
    if (raw[index] === "/" && raw[index + 1] === ">") break;

    const nameStart = index;
    while (index < raw.length && !/[\s=/>]/.test(raw[index])) index += 1;
    const rawName = raw.slice(nameStart, index);
    assert.ok(rawName, `${label} has a malformed attribute in ${raw}`);
    const name = rawName.toLowerCase();
    assert.ok(!attributes.has(name), `${label} has duplicate attribute ${name}`);
    while (/\s/.test(raw[index] || "")) index += 1;

    let value = "";
    if (raw[index] === "=") {
      index += 1;
      while (/\s/.test(raw[index] || "")) index += 1;
      const quote = raw[index] === '"' || raw[index] === "'" ? raw[index++] : "";
      const valueStart = index;
      if (quote) {
        while (index < raw.length && raw[index] !== quote) index += 1;
        assert.ok(index < raw.length, `${label} has an unterminated ${name} attribute`);
        value = raw.slice(valueStart, index);
        index += 1;
      } else {
        while (index < raw.length && !/[\s>]/.test(raw[index])) index += 1;
        value = raw.slice(valueStart, index);
      }
    }
    attributes.set(name, value);
  }
  return attributes;
}

function parseHtmlTree(html, label) {
  const root = { tag: "#document", attributes: new Map(), parent: null, children: [] };
  const stack = [root];
  const elements = [];
  const lower = html.toLowerCase();
  let cursor = 0;

  while (cursor < html.length) {
    const start = html.indexOf("<", cursor);
    if (start < 0) break;
    if (html.startsWith("<!--", start)) {
      const end = html.indexOf("-->", start + 4);
      assert.ok(end >= 0, `${label} has an unterminated HTML comment`);
      cursor = end + 3;
      continue;
    }
    if (html.startsWith("<!", start) || html.startsWith("<?", start)) {
      cursor = findHtmlTagEnd(html, start, label) + 1;
      continue;
    }

    const close = html.slice(start).match(/^<\s*\/\s*([A-Za-z][\w:-]*)/);
    if (close) {
      const tag = close[1].toLowerCase();
      const end = findHtmlTagEnd(html, start, label);
      let stackIndex = stack.length - 1;
      while (stackIndex > 0 && stack[stackIndex].tag !== tag) stackIndex -= 1;
      assert.ok(stackIndex > 0, `${label} closes unexpected </${tag}>`);
      stack.length = stackIndex;
      cursor = end + 1;
      continue;
    }

    const open = html.slice(start).match(/^<\s*([A-Za-z][\w:-]*)/);
    if (!open) {
      cursor = start + 1;
      continue;
    }
    const tag = open[1].toLowerCase();
    const end = findHtmlTagEnd(html, start, label);
    const raw = html.slice(start, end + 1);
    const attributes = parseHtmlAttributes(raw, open[0].length, label);
    const parent = stack.at(-1);
    const element = { tag, attributes, parent, children: [], start, raw };
    parent.children.push(element);
    elements.push(element);
    const slashClosing = /\/\s*>$/.test(raw);
    assert.ok(!slashClosing || VOID_TAGS.has(tag), `${label} uses invalid self-closing syntax on non-void <${tag}>`);
    const selfClosing = VOID_TAGS.has(tag);

    if (!selfClosing && RAW_OR_INERT_TAGS.has(tag)) {
      const needle = `</${tag}`;
      let closeStart = lower.indexOf(needle, end + 1);
      while (closeStart >= 0 && !/[\t\n\f\r />]/.test(lower[closeStart + needle.length] || "")) {
        closeStart = lower.indexOf(needle, closeStart + needle.length);
      }
      assert.ok(closeStart >= 0, `${label} has an unterminated <${tag}>`);
      if (tag === "script") {
        const rawBody = html.slice(end + 1, closeStart);
        assert.ok(
          !/<\s*script(?=[\t\n\f\r />])/i.test(rawBody),
          `${label} script data must not enter the browser double-escaped state`
        );
      }
      cursor = findHtmlTagEnd(html, closeStart, label) + 1;
      continue;
    }
    if (!selfClosing) stack.push(element);
    cursor = end + 1;
  }

  assert.equal(stack.length, 1, `${label} has unclosed <${stack.at(-1).tag}> markup`);
  const byId = new Map();
  const caseById = new Map();
  for (const element of elements) {
    if (!element.attributes.has("id")) continue;
    const id = element.attributes.get("id");
    assert.ok(id && !/\s/.test(id), `${label} has an empty or whitespace-bearing id`);
    assert.ok(!id.includes("&"), `${label} id attributes must not use character references`);
    assert.ok(!byId.has(id), `${label} has duplicate id #${id}`);
    const folded = id.toLowerCase();
    if (caseById.has(folded) && caseById.get(folded) !== id) {
      assert.fail(`${label} has casefold-colliding ids #${caseById.get(folded)} and #${id}`);
    }
    caseById.set(folded, id);
    byId.set(id, element);
  }
  return { root, elements, byId, caseById };
}

function isDescendantOf(element, ancestor) {
  for (let node = element?.parent; node; node = node.parent) {
    if (node === ancestor) return true;
  }
  return false;
}

function hasAncestorTag(element, tags) {
  for (let node = element?.parent; node; node = node.parent) {
    if (tags.has(node.tag)) return true;
  }
  return false;
}

function hasDisabledFieldsetAncestor(element) {
  for (let node = element?.parent; node; node = node.parent) {
    if (node.tag === "fieldset" && node.attributes.has("disabled")) return true;
  }
  return false;
}

function assertBrowserSafeTree(tree, label) {
  const forbiddenTags = new Set(["frame", "frameset", "math", "plaintext", "svg", "table"]);
  for (const element of tree.elements) {
    assert.ok(
      !forbiddenTags.has(element.tag),
      `${label} forbids browser-state-changing <${element.tag}> markup in contracted hosts`
    );
  }
  const tableChildren = new Map([
    ["table", new Set(["caption", "colgroup", "script", "style", "tbody", "template", "tfoot", "thead"])],
    ["colgroup", new Set(["col", "template"])],
    ["tbody", new Set(["script", "template", "tr"])],
    ["tfoot", new Set(["script", "template", "tr"])],
    ["thead", new Set(["script", "template", "tr"])],
    ["tr", new Set(["script", "td", "template", "th"])],
    ["select", new Set(["hr", "optgroup", "option", "script", "template"])],
    ["optgroup", new Set(["option", "script", "template"])]
  ]);
  for (const element of tree.elements) {
    const allowed = tableChildren.get(element.parent?.tag);
    if (allowed) {
      assert.ok(
        allowed.has(element.tag),
        `${label} has browser-unsafe <${element.tag}> placement directly inside <${element.parent.tag}>`
      );
    }
  }
  const csp = tree.elements.filter((element) => (
    element.tag === "meta" &&
    String(element.attributes.get("http-equiv") || "").toLowerCase() === "content-security-policy"
  ));
  for (const element of tree.elements.filter((entry) => entry.tag === "meta" && entry.attributes.has("http-equiv"))) {
    assert.ok(!element.attributes.get("http-equiv").includes("&"), `${label} meta http-equiv must not use character references`);
    assert.notEqual(
      element.attributes.get("http-equiv").toLowerCase(),
      "refresh",
      `${label} must not navigate away through a meta refresh`
    );
  }
  assert.equal(csp.length, 0, `${label} must not embed a Content-Security-Policy meta that can suppress consumers`);
}

function descendants(element) {
  const output = [];
  const visit = (node) => {
    for (const child of node.children) {
      output.push(child);
      visit(child);
    }
  };
  visit(element);
  return output;
}

function assertElementEntry(element, entry, label) {
  assert.equal(element.tag, entry.tag, `${label} #${entry.id} must be <${entry.tag}>`);
  if (entry.input_type != null) {
    assert.equal(element.attributes.get("type")?.toLowerCase(), entry.input_type, `${label} #${entry.id} input type drift`);
  }
  for (const [name, expected] of Object.entries(entry.attributes || {})) {
    assert.ok(element.attributes.has(name.toLowerCase()), `${label} #${entry.id} must carry ${name}`);
    assert.equal(element.attributes.get(name.toLowerCase()), expected, `${label} #${entry.id} ${name} drift`);
  }
  if (entry.selected_option != null) {
    assert.equal(element.tag, "select", `${label} #${entry.id} selected_option requires <select>`);
    const selected = descendants(element).filter((node) => node.tag === "option" && node.attributes.has("selected"));
    assert.equal(selected.length, 1, `${label} #${entry.id} must have exactly one explicitly selected option`);
    assert.equal(selected[0].attributes.get("value"), entry.selected_option, `${label} #${entry.id} selected option drift`);
  }
}

function canonicalScriptPath(value, hostPath, label) {
  const source = String(value || "");
  assert.ok(!/[\u0000-\u0020\u007f]/.test(source), label + " script src must not contain ASCII whitespace or controls");
  if (/^[A-Za-z][A-Za-z\d+.-]*:/.test(source) || source.startsWith("//")) return null;
  assert.ok(source && !/[&%\\]/.test(source), label + " script src must use an unescaped canonical path");
  const origin = "https://music-contract.invalid";
  const resolved = new URL(source, origin + "/" + hostPath);
  if (resolved.origin !== origin) return null;
  return resolved.pathname.replace(/^\/+/, "");
}

const EXPECTED_CONSUMER_SHAPE = {
  engine: {
    path: "engine.js",
    id_count: 64,
    dynamic_expressions: ["id", "map[k]"],
    helper_callees: ["getSliderValue"],
    helper_scopes: ["getSliderValue:updateFromUI"]
  },
  fm: {
    path: "fm.js",
    id_count: 56,
    dynamic_expressions: ["\"fader_\"+key", "id"],
    helper_callees: ["setRouteDiagnosticText"],
    helper_scopes: ["setRouteDiagnosticText:renderAudioRoutePanel"]
  },
  genre_flavor: {
    path: "audio/genre-flavor.js",
    id_count: 1,
    dynamic_expressions: [],
    helper_callees: [],
    helper_scopes: []
  },
  music_recorder: {
    path: "audio/music-recorder.js",
    id_count: 3,
    dynamic_expressions: [],
    helper_callees: [],
    helper_scopes: []
  }
};

const EXPECTED_FADER_MAPPING = {
  body: "fader_body",
  circle: "fader_circle",
  creation: "fader_creation",
  energy: "fader_energy",
  mind: "fader_mind",
  observer: "fader_observer",
  resource: "fader_resource",
  void: "fader_void",
  wave: "fader_wave"
};

const EXPECTED_ENGINE_BODY_PREDICATES = [
  {
    scope: "hazamaFmRuntimeGenre",
    operator: "!==",
    usage: "undefined_or_early_return_null"
  },
  {
    scope: "setupMediaSessionControls",
    operator: "===",
    usage: "early_return"
  }
];

const EXPECTED_FM_MEMBER_QUERY_SELECTORS = [
  {
    receiver: "btn",
    method: "querySelector",
    selector: ".fm-genre-caption",
    scope: "applyGenrePillCaptions",
    owner_lookup: 'document.querySelector:#fm-genre button[data-genre="${name}"]',
    usage: "guard_return"
  },
  {
    receiver: "group",
    method: "querySelectorAll",
    selector: "button[data-djset]",
    scope: "syncDjSetButtonState",
    owner_lookup: "$:fm-dj-set",
    usage: "for_each"
  },
  {
    receiver: "group",
    method: "querySelectorAll",
    selector: "button[data-energy]",
    scope: "setEnergySelection",
    owner_lookup: "$:fm-energy",
    usage: "for_each"
  },
  {
    receiver: "group",
    method: "querySelectorAll",
    selector: "button[data-genre]",
    scope: "setGenreSelection",
    owner_lookup: "$:fm-genre",
    usage: "for_each"
  }
];

const EXPECTED_FM_MEMBER_CLOSEST_SELECTORS = [
  {
    receiver: "e.target",
    method: "closest",
    selector: "button[data-djset]",
    scope: "bindDjSetButtons",
    owner_lookup: "$:fm-dj-set",
    usage: "click_delegate"
  },
  {
    receiver: "e.target",
    method: "closest",
    selector: "button[data-energy]",
    scope: "bindEnergyPill",
    owner_lookup: "$:fm-energy",
    usage: "click_delegate"
  },
  {
    receiver: "e.target",
    method: "closest",
    selector: "button[data-genre]",
    scope: "bindGenrePill",
    owner_lookup: "$:fm-genre",
    usage: "click_delegate"
  }
];

const EXPECTED_HOST_SHAPE = {
  core: {
    path: "index.html",
    consumers: ["engine", "music_recorder"],
    body_data_page: null,
    required_count: 60,
    optional_count: 5,
    required_sha256: "95f9d0c56cd1bcf8fab9c6b0f3866b2b42172dbec1f7f33488d75ec56e13f0ba",
    optional_sha256: "0893fb8f25b903de2f7f1918ae88ba0422d25a9233c43445146d7fdb4f6b91c4",
    performance_pads: ["drift", "repeat", "punch", "void"],
    range_ids: [
      "auto_cycle", "fader_body", "fader_circle", "fader_creation", "fader_energy",
      "fader_mind", "fader_observer", "fader_resource", "fader_void", "fader_wave",
      "output_level"
    ],
    select_ids: ["auto_arc_mode", "culture_grammar_select"],
    attribute_groups: [],
    attribute_group_selections: [],
    containers: [],
    container_attributes: [],
    entry_defaults: [],
    direct_children: [],
    id_references: ["transport_dock_toggle:aria-controls:transport-dock"]
  },
  fm: {
    path: "fm.html",
    consumers: ["engine", "fm", "genre_flavor", "music_recorder"],
    body_data_page: "fm",
    required_count: 76,
    optional_count: 31,
    required_sha256: "4ecdfcc01ad4b06824b0f707dc63de460bb01326e51e478d2aa49d38afec27f2",
    optional_sha256: "d00c65671b0ade263d91486f56ce3789c1f78ce65d83676751a2acb16f35df0e",
    performance_pads: [],
    range_ids: [
      "auto_cycle", "fader_body", "fader_circle", "fader_creation", "fader_energy",
      "fader_mind", "fader_observer", "fader_resource", "fader_void", "fader_wave",
      "fm-mic-follow-amount", "output_level"
    ],
    select_ids: ["auto_arc_mode", "culture_grammar_select"],
    attribute_groups: [
      "data-djset:fm-dj-set", "data-energy:fm-energy", "data-genre:fm-genre"
    ],
    attribute_group_selections: [
      "data-djset:", "data-energy:mid", "data-genre:any"
    ],
    containers: ["fm-engine-shim"],
    container_attributes: ["fm-engine-shim:aria-hidden=true,hidden="],
    entry_defaults: [
      "auto_arc_mode:selected_option=arc36",
      "auto_toggle:checked=",
      "culture_grammar_select:selected_option=auto"
    ],
    direct_children: ["fm-progress:span:1"],
    id_references: [
      "fm-route:aria-controls:fm-route-panel",
      "fm-trace-panel:aria-labelledby:fm-trace-title"
    ]
  }
};

function manifestMaps(contract) {
  assert.equal(contract.version, 1, "DOM contract manifest version must be 1");
  assert.equal(contract.policy?.runtime_execution, false, "DOM contract must remain text-only");
  assert.ok(Array.isArray(contract.consumers) && contract.consumers.length === 4, "DOM contract must declare four consumers");
  assert.ok(Array.isArray(contract.hosts) && contract.hosts.length === 2, "DOM contract must declare Core and FM hosts");

  const consumerNames = contract.consumers.map((consumer) => consumer.name);
  assertSortedUnique(consumerNames, "consumer names");
  const consumers = new Map();
  for (const consumer of contract.consumers) {
    const expectedShape = EXPECTED_CONSUMER_SHAPE[consumer.name];
    assert.ok(expectedShape, "DOM contract has unknown consumer " + consumer.name);
    assert.equal(consumer.path, expectedShape.path, consumer.name + " source path drift");
    assert.equal(consumer.ids.length, expectedShape.id_count, consumer.name + " consumer ID count drift");
    const calls = consumer.extraction.get_element_by_id || consumer.extraction.dollar_calls;
    assert.ok(calls && calls.literal_call_counts, consumer.name + " must retain per-ID literal counts");
    assert.deepEqual(Object.keys(calls.literal_call_counts), calls.literal_ids, consumer.name + " per-ID count keys drift");
    assert.equal(
      Object.values(calls.literal_call_counts).reduce((sum, count) => sum + count, 0),
      calls.literal_call_count,
      consumer.name + " per-ID count sum drift"
    );
    assert.ok(Array.isArray(calls.dynamic_arguments), consumer.name + " dynamic lookup contract is required");
    assert.deepEqual(
      sorted(calls.dynamic_arguments.map((entry) => entry.expression)),
      expectedShape.dynamic_expressions,
      consumer.name + " dynamic lookup descriptor drift"
    );
    assert.deepEqual(
      sorted((consumer.extraction.literal_helper_calls || []).map((entry) => entry.callee)),
      expectedShape.helper_callees,
      consumer.name + " helper-call descriptor drift"
    );
    assert.deepEqual(
      sorted((consumer.extraction.literal_helper_calls || []).map((entry) => entry.callee + ":" + entry.scope)),
      expectedShape.helper_scopes,
      consumer.name + " helper-call scope descriptor drift"
    );
    assert.ok(consumer.path && !/^[/\\]|\.\./.test(consumer.path), `${consumer.name} path must stay repo-relative`);
    assertSortedUnique(consumer.ids, `${consumer.name} consumer ids`);
    consumers.set(consumer.name, consumer);
  }

  const hostNames = contract.hosts.map((host) => host.name);
  assertSortedUnique(hostNames, "host names");
  const hosts = new Map();
  for (const host of contract.hosts) {
    const expectedShape = EXPECTED_HOST_SHAPE[host.name];
    assert.ok(expectedShape, "DOM contract has unknown host " + host.name);
    assert.equal(host.path, expectedShape.path, host.name + " path drift");
    assert.deepEqual(host.consumers, expectedShape.consumers, host.name + " consumer ownership drift");
    assert.equal(host.body_data_page, expectedShape.body_data_page, host.name + " body data-page policy drift");
    assert.equal(host.required.length, expectedShape.required_count, host.name + " required seam count drift");
    assert.equal(host.optional.length, expectedShape.optional_count, host.name + " optional seam count drift");
    assert.ok(host.path && !/^[/\\]|\.\./.test(host.path), `${host.name} host path must stay repo-relative`);
    assertSortedUnique(host.consumers, `${host.name} consumer names`);
    for (const name of host.consumers) assert.ok(consumers.has(name), `${host.name} references unknown consumer ${name}`);

    const requiredIds = host.required.map((entry) => entry.id);
    const optionalIds = host.optional.map((entry) => entry.id);
    assertSortedUnique(requiredIds, `${host.name} required ids`);
    assertSortedUnique(optionalIds, `${host.name} optional ids`);
    for (const id of requiredIds) assert.ok(!optionalIds.includes(id), `${host.name} classifies #${id} twice`);
    const expectedIds = sorted(new Set(host.consumers.flatMap((name) => consumers.get(name).ids)));
    assert.deepEqual(sorted([...requiredIds, ...optionalIds]), expectedIds, `${host.name} required/optional ids must cover its consumer seams exactly`);
    assert.equal(
      createHash("sha256").update(requiredIds.join("\n")).digest("hex"),
      expectedShape.required_sha256,
      host.name + " required ID classification drift"
    );
    assert.equal(
      createHash("sha256").update(optionalIds.join("\n")).digest("hex"),
      expectedShape.optional_sha256,
      host.name + " optional ID classification drift"
    );

    for (const entry of [...host.required, ...host.optional]) {
      assert.ok(typeof entry.id === "string" && entry.id, `${host.name} entry id is required`);
      assert.ok(/^[a-z][a-z0-9_:-]*$/.test(entry.id), `${host.name} entry #${entry.id} must use exact lowercase seam spelling`);
      assert.ok(typeof entry.tag === "string" && entry.tag === entry.tag.toLowerCase(), `${host.name} #${entry.id} tag must be lowercase`);
      if (entry.input_type != null) assert.equal(entry.tag, "input", `${host.name} #${entry.id} input_type requires input tag`);
      if (entry.selected_option != null) assert.equal(entry.tag, "select", `${host.name} #${entry.id} selected_option requires select tag`);
    }
    for (const entry of host.optional) assert.ok(entry.reason, `${host.name} optional #${entry.id} needs a reason`);
    const structures = host.structures || {};
    assert.deepEqual(
      (structures.performance_pads || []).map((entry) => entry.value),
      expectedShape.performance_pads,
      host.name + " performance-pad contract shape drift"
    );
    assert.deepEqual(
      sorted((structures.range_groups || []).flatMap((group) => group.ids)),
      expectedShape.range_ids,
      host.name + " range contract coverage drift"
    );
    assert.deepEqual(
      sorted((structures.select_options || []).map((entry) => entry.id)),
      expectedShape.select_ids,
      host.name + " select option contract coverage drift"
    );
    assert.deepEqual(
      sorted((structures.attribute_groups || []).map((entry) => entry.attribute + ":" + entry.parent_id)),
      expectedShape.attribute_groups,
      host.name + " attribute group contract shape drift"
    );
    assert.deepEqual(
      (structures.attribute_groups || []).map((entry) => entry.attribute + ":" + (entry.selected_value || "")),
      expectedShape.attribute_group_selections,
      host.name + " attribute group selected defaults drift"
    );
    assert.deepEqual(
      sorted((structures.containers || []).map((entry) => entry.id)),
      expectedShape.containers,
      host.name + " container contract shape drift"
    );
    assert.deepEqual(
      (structures.containers || []).map((entry) => (
        entry.id + ":" + Object.entries(entry.attributes || {})
          .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
          .map(([key, value]) => key + "=" + value)
          .join(",")
      )),
      expectedShape.container_attributes,
      host.name + " container attribute contract drift"
    );
    const entryDefaults = [...host.required, ...host.optional].flatMap((entry) => {
      const values = [];
      if (entry.selected_option != null) values.push(entry.id + ":selected_option=" + entry.selected_option);
      for (const [key, value] of Object.entries(entry.attributes || {}).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)) {
        values.push(entry.id + ":" + key + "=" + value);
      }
      return values;
    }).sort();
    assert.deepEqual(entryDefaults, expectedShape.entry_defaults, host.name + " required seam defaults drift");
    assert.deepEqual(
      sorted((structures.direct_children || []).map((entry) => entry.parent_id + ":" + entry.tag + ":" + entry.count)),
      expectedShape.direct_children,
      host.name + " direct-child contract shape drift"
    );
    assert.deepEqual(
      sorted((structures.id_references || []).map((entry) => entry.source_id + ":" + entry.attribute + ":" + entry.target_id)),
      expectedShape.id_references,
      host.name + " ID-reference contract shape drift"
    );
    hosts.set(host.name, host);
  }
  const engineExtraction = consumers.get("engine").extraction;
  assert.deepEqual(
    engineExtraction.body_data_page_fm_predicates,
    EXPECTED_ENGINE_BODY_PREDICATES,
    "engine body data-page predicate manifest drift"
  );
  assert.equal(engineExtraction.fader_origins?.length, 4, "engine must retain four independent fader origins");
  assert.deepEqual(
    sorted(engineExtraction.fader_origins.map((origin) => (
      origin.scope + ":" + (origin.binding || origin.callee) + ":" + origin.form
    ))),
    sorted([
      "program:SLIDER_BY_UCM:object_values",
      "program:getSliderValue:literal_call_arguments",
      "applyPresetUCM:map:object_values",
      "attachUI:ids:array_values"
    ]),
    "engine fader origin descriptors drift"
  );
  for (const origin of engineExtraction.fader_origins.filter((entry) => entry.form === "object_values")) {
    assert.deepEqual(origin.mapping, EXPECTED_FADER_MAPPING, "engine fader origin canonical mapping drift");
  }
  assert.deepEqual(
    engineExtraction.get_element_by_id.dynamic_arguments.find((entry) => entry.expression === "id")?.scope_domains?.setupTransportDockEscape,
    ["btn_start", "btn_stop"],
    "engine transport inline resolver contract drift"
  );
  const fmExtraction = consumers.get("fm").extraction;
  assert.ok(fmExtraction.dollar_binding, "fm must retain its $ lookup binding contract");
  assert.deepEqual(
    fmExtraction.member_query_selectors,
    EXPECTED_FM_MEMBER_QUERY_SELECTORS,
    "fm member query-selector manifest drift"
  );
  assert.deepEqual(
    fmExtraction.member_closest_selectors,
    EXPECTED_FM_MEMBER_CLOSEST_SELECTORS,
    "fm member closest-selector manifest drift"
  );
  const fmKeySource = fmExtraction.dollar_calls.dynamic_arguments.find((entry) => entry.expanded_ids)?.key_source;
  assert.ok(
    fmKeySource,
    "fm must retain the genre-profile fader key source contract"
  );
  assert.deepEqual(fmKeySource.keys, Object.keys(EXPECTED_FADER_MAPPING), "fm canonical fader key domain drift");
  const fmGenreValues = contract.hosts
    .find((host) => host.name === "fm").structures.attribute_groups
    .find((group) => group.attribute === "data-genre").values;
  assert.deepEqual(
    sorted(fmKeySource.profile_names),
    sorted(fmGenreValues),
    "fm genre profile names must cover the host data-genre domain"
  );
  return { consumers, hosts };
}

function validateHost(host, html, consumers) {
  const label = host.path;
  const tree = parseHtmlTree(html, label);
  assertBrowserSafeTree(tree, label);
  assert.equal(tree.elements.filter((element) => element.tag === "base").length, 0, `${label} must not redefine the document base URL`);
  const body = tree.elements.filter((element) => element.tag === "body");
  assert.equal(body.length, 1, `${label} must have exactly one body`);
  if (host.body_data_page == null) {
    assert.equal(body[0].attributes.has("data-page"), false, `${label} body must not declare data-page`);
  } else {
    assert.equal(body[0].attributes.get("data-page"), host.body_data_page, `${label} body data-page exact-case/value drift`);
  }

  const expectedCase = (id) => {
    const actual = tree.caseById.get(id.toLowerCase());
    if (actual && actual !== id) assert.fail(`${label} id case drift: expected #${id}, found #${actual}`);
  };
  for (const entry of host.required) {
    expectedCase(entry.id);
    const element = tree.byId.get(entry.id);
    assert.ok(element, `${label} missing required #${entry.id}`);
    assert.equal(
      hasAncestorTag(element, new Set(["math", "svg"])),
      false,
      `${label} #${entry.id} must stay in the HTML namespace`
    );
    assert.equal(
      hasAncestorTag(element, new Set(["select"])),
      false,
      `${label} #${entry.id} must not be nested inside a select insertion mode`
    );
    assertElementEntry(element, entry, label);
  }
  for (const entry of host.optional) {
    expectedCase(entry.id);
    const element = tree.byId.get(entry.id);
    if (element) {
      assert.equal(
        hasAncestorTag(element, new Set(["math", "svg"])),
        false,
        `${label} #${entry.id} must stay in the HTML namespace`
      );
      assert.equal(
        hasAncestorTag(element, new Set(["select"])),
        false,
        `${label} #${entry.id} must not be nested inside a select insertion mode`
      );
      assertElementEntry(element, entry, label);
    }
  }

  for (const entry of host.required.filter((item) => item.within)) {
    const element = tree.byId.get(entry.id);
    const container = tree.byId.get(entry.within);
    assert.ok(container, `${label} missing container #${entry.within} for #${entry.id}`);
    assert.ok(isDescendantOf(element, container), `${label} #${entry.id} must stay within #${entry.within}`);
  }

  const structures = host.structures || {};
  const padEntries = structures.performance_pads || [];
  const pads = tree.elements.filter((element) => element.attributes.has("data-performance-pad"));
  assert.deepEqual(
    pads.map((element) => ({ value: element.attributes.get("data-performance-pad"), tag: element.tag })),
    padEntries,
    `${label} performance-pad values/order/tags drift`
  );

  const rangeIds = new Set();
  for (const group of structures.range_groups || []) {
    assert.ok(Array.isArray(group.ids) && group.ids.length, `${label} range group needs ids`);
    assertSortedUnique(group.ids, `${label} range group ids`);
    for (const id of group.ids) {
      assert.ok(!rangeIds.has(id), `${label} range #${id} is classified twice`);
      rangeIds.add(id);
      const element = tree.byId.get(id);
      assert.ok(element, `${label} missing range #${id}`);
      assert.equal(element.tag, "input", `${label} #${id} range must be <input>`);
      assert.equal(element.attributes.get("type")?.toLowerCase(), "range", `${label} #${id} range type drift`);
      assert.equal(element.attributes.get("min"), group.min, `${label} #${id} range min drift`);
      assert.equal(element.attributes.get("max"), group.max, `${label} #${id} range max drift`);
    }
  }
  assert.deepEqual(
    sorted(rangeIds),
    sorted(host.required.filter((entry) => entry.input_type === "range").map((entry) => entry.id)),
    `${label} range groups must cover every required range seam exactly`
  );

  const selectIds = new Set();
  for (const spec of structures.select_options || []) {
    assert.ok(!selectIds.has(spec.id), `${label} select #${spec.id} is classified twice`);
    selectIds.add(spec.id);
    assert.equal(new Set(spec.values).size, spec.values.length, `${label} #${spec.id} option values must be unique`);
    const select = tree.byId.get(spec.id);
    assert.ok(select, `${label} missing select #${spec.id}`);
    assert.equal(select.tag, "select", `${label} #${spec.id} options require <select>`);
    assert.equal(select.attributes.has("multiple"), false, `${label} #${spec.id} must remain a single-select control`);
    assert.equal(select.attributes.has("disabled"), false, `${label} #${spec.id} must remain enabled`);
    assert.ok(
      !select.attributes.has("size") || select.attributes.get("size") === "1",
      `${label} #${spec.id} must remain a collapsed size=1 select`
    );
    assert.equal(
      hasDisabledFieldsetAncestor(select),
      false,
      `${label} #${spec.id} must not inherit disabledness from a fieldset`
    );
    const options = select.children.filter((child) => child.tag === "option");
    assert.deepEqual(options.map((option) => option.attributes.get("value")), spec.values, `${label} #${spec.id} direct option values/order drift`);
    assert.ok(options.every((option) => !option.attributes.has("disabled")), `${label} #${spec.id} options must remain enabled`);
    const explicitlySelected = options.filter((option) => option.attributes.has("selected"));
    assert.ok(explicitlySelected.length <= 1, `${label} #${spec.id} has multiple selected options`);
    const effective = (explicitlySelected[0] || options[0])?.attributes.get("value");
    assert.equal(effective, spec.effective_selected, `${label} #${spec.id} effective selection drift`);
  }

  for (const group of structures.attribute_groups || []) {
    const parent = tree.byId.get(group.parent_id);
    assert.ok(parent, `${label} attribute group ${group.attribute} missing parent #${group.parent_id}`);
    const all = tree.elements.filter((element) => element.attributes.has(group.attribute));
    assert.ok(all.every((element) => isDescendantOf(element, parent)), `${label} ${group.attribute} controls must stay within #${group.parent_id}`);
    assert.deepEqual(all.map((element) => element.attributes.get(group.attribute)), group.values, `${label} ${group.attribute} values/order drift`);
    for (const element of all) assert.equal(element.tag, group.tag, `${label} ${group.attribute} controls must be <${group.tag}>`);
    if (group.selected_value != null) {
      const selected = all.filter((element) => element.attributes.get("aria-pressed") === "true");
      assert.equal(selected.length, 1, `${label} ${group.attribute} must have exactly one aria-pressed=true control`);
      assert.equal(selected[0].attributes.get(group.attribute), group.selected_value, `${label} ${group.attribute} selected value drift`);
      for (const element of all) {
        const expectedPressed = element.attributes.get(group.attribute) === group.selected_value ? "true" : "false";
        assert.equal(
          element.attributes.get("aria-pressed"),
          expectedPressed,
          `${label} ${group.attribute} aria-pressed state drift`
        );
      }
    }
  }

  for (const spec of structures.containers || []) {
    const container = tree.byId.get(spec.id);
    assert.ok(container, `${label} missing structural container #${spec.id}`);
    assert.equal(container.tag, spec.tag, `${label} #${spec.id} container tag drift`);
    for (const [name, value] of Object.entries(spec.attributes || {})) {
      assert.ok(container.attributes.has(name), `${label} #${spec.id} must carry ${name}`);
      assert.equal(container.attributes.get(name), value, `${label} #${spec.id} ${name} drift`);
    }
    assertSortedUnique(spec.descendant_ids, `${label} #${spec.id} descendant ids`);
    const actualIds = descendants(container)
      .filter((element) => element.attributes.has("id"))
      .map((element) => element.attributes.get("id"));
    assert.deepEqual(sorted(actualIds), spec.descendant_ids, `${label} #${spec.id} descendant id seam drift`);
    const withinIds = host.required.filter((entry) => entry.within === spec.id).map((entry) => entry.id);
    assert.deepEqual(sorted(withinIds), spec.descendant_ids, `${label} #${spec.id} manifest within coverage drift`);
  }

  for (const spec of structures.direct_children || []) {
    const parent = tree.byId.get(spec.parent_id);
    assert.ok(parent, `${label} missing direct-child parent #${spec.parent_id}`);
    const count = parent.children.filter((child) => child.tag === spec.tag).length;
    assert.equal(count, spec.count, `${label} #${spec.parent_id} direct <${spec.tag}> child count drift`);
  }

  for (const spec of structures.id_references || []) {
    const source = tree.byId.get(spec.source_id);
    assert.ok(source, `${label} missing id-reference source #${spec.source_id}`);
    assert.equal(source.attributes.get(spec.attribute), spec.target_id, `${label} #${spec.source_id} ${spec.attribute} target drift`);
    assert.ok(tree.byId.has(spec.target_id), `${label} #${spec.source_id} points to missing #${spec.target_id}`);
  }

  const externalScripts = tree.elements.filter((element) => element.tag === "script" && element.attributes.has("src"));
  for (const [consumerName, consumer] of consumers) {
    const matches = externalScripts.filter((element) => (
      canonicalScriptPath(element.attributes.get("src"), host.path, label) === consumer.path
    ));
    const expectedCount = host.consumers.includes(consumerName) ? 1 : 0;
    assert.equal(matches.length, expectedCount, `${label} ${consumer.path} external script count drift`);
    if (matches.length) {
      assert.equal(
        hasAncestorTag(matches[0], new Set(["math", "svg"])),
        false,
        `${label} must load ${consumer.path} as an HTML script`
      );
      const type = String(matches[0].attributes.get("type") || "").toLowerCase();
      assert.ok(!type || type === "text/javascript" || type === "application/javascript", `${label} must load ${consumer.path} as a classic script`);
      assert.ok(matches[0].attributes.has("defer"), `${label} must load ${consumer.path} with defer`);
      assert.equal(matches[0].attributes.has("async"), false, `${label} must not load ${consumer.path} with async`);
      assert.equal(matches[0].attributes.has("nomodule"), false, `${label} must not suppress ${consumer.path} with nomodule`);
      assert.equal(matches[0].attributes.has("integrity"), false, `${label} must not pin ${consumer.path} to an unowned integrity digest`);
      assert.equal(matches[0].attributes.has("language"), false, `${label} must not override ${consumer.path} through legacy language typing`);
    }
  }
  return tree;
}

const REGEX_PREFIX_KEYWORDS = new Set([
  "await", "case", "delete", "else", "in", "instanceof", "new", "return",
  "throw", "typeof", "void", "yield"
]);
const DOM_LOOKUP_MARKER = /(?:\bdocument\b|getElementById|querySelector|\$\s*\()/;

function decodeJavaScriptEscape(source, index) {
  const char = source[index];
  const simple = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", v: "\v", 0: "\0" };
  if (Object.hasOwn(simple, char)) return { value: simple[char], next: index + 1 };
  if (char === "x" && /^[0-9a-f]{2}$/i.test(source.slice(index + 1, index + 3))) {
    return { value: String.fromCharCode(parseInt(source.slice(index + 1, index + 3), 16)), next: index + 3 };
  }
  if (char === "u" && /^[0-9a-f]{4}$/i.test(source.slice(index + 1, index + 5))) {
    return { value: String.fromCharCode(parseInt(source.slice(index + 1, index + 5), 16)), next: index + 5 };
  }
  return { value: char || "", next: index + 1 };
}

function assertNoDomLookupInTemplateInterpolation(value, label, start) {
  assert.ok(
    !DOM_LOOKUP_MARKER.test(value),
    label + " hides a DOM lookup marker inside a template literal at " + start
  );
}

function scanJavaScriptTemplate(source, start, label) {
  const scanQuoted = (index, quote) => {
    index += 1;
    while (index < source.length) {
      if (source[index] === "\\") index += 2;
      else if (source[index] === quote) return index + 1;
      else index += 1;
    }
    assert.fail(label + " has an unterminated string inside a template at " + start);
  };
  const scanTemplate = (templateStart) => {
    let index = templateStart + 1;
    while (index < source.length) {
      const char = source[index];
      if (char === "\\") {
        index += 2;
      } else if (char.charCodeAt(0) === 96) {
        return index + 1;
      } else if (char === "$" && source[index + 1] === "{") {
        index += 2;
        let depth = 1;
        while (index < source.length && depth > 0) {
          const current = source[index];
          if (current === '"' || current === "'") index = scanQuoted(index, current);
          else if (current.charCodeAt(0) === 96) index = scanTemplate(index);
          else if (current === "/" && source[index + 1] === "/") {
            index += 2;
            while (index < source.length && !/[\r\n]/.test(source[index])) index += 1;
          } else if (current === "/" && source[index + 1] === "*") {
            const end = source.indexOf("*/", index + 2);
            assert.ok(end >= 0, label + " has an unterminated template comment at " + start);
            index = end + 2;
          } else {
            if (current === "{") depth += 1;
            else if (current === "}") depth -= 1;
            index += 1;
          }
        }
        assert.equal(depth, 0, label + " has an unterminated template interpolation at " + start);
      } else {
        index += 1;
      }
    }
    assert.fail(label + " has an unterminated template at " + templateStart);
  };
  return scanTemplate(start);
}

function tokenizeJavaScript(source, label) {
  const tokens = [];
  const push = (type, value, start, end) => tokens.push({ type, value, start, end });
  const regexCanStart = () => {
    const previous = tokens.at(-1);
    if (!previous) return true;
    if (["+", "-"].includes(previous.value) && tokens.at(-2)?.value === previous.value) return false;
    if (previous.type === "id") return REGEX_PREFIX_KEYWORDS.has(previous.value);
    if (["string", "template", "number", "regex"].includes(previous.type)) return false;
    return ![")", "]", "}"].includes(previous.value);
  };
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (char === "/" && next === "/") {
      index += 2;
      while (index < source.length && !/[\r\n]/.test(source[index])) index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      const start = index;
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) index += 1;
      assert.ok(index < source.length, `${label} has an unterminated block comment at ${start}`);
      index += 2;
      continue;
    }
    if (char === '"' || char === "'") {
      const quote = char;
      const start = index++;
      let value = "";
      let closed = false;
      while (index < source.length) {
        const current = source[index++];
        if (current === "\\") {
          const decoded = decodeJavaScriptEscape(source, index);
          value += decoded.value;
          index = decoded.next;
        } else if (current === quote) {
          closed = true;
          break;
        } else {
          value += current;
        }
      }
      assert.ok(closed, `${label} has an unterminated string at ${start}`);
      push("string", value, start, index);
      continue;
    }
    if (char === "`") {
      const start = index;
      const end = scanJavaScriptTemplate(source, start, label);
      const value = source.slice(start + 1, end - 1);
      index = end;
      assertNoDomLookupInTemplateInterpolation(value, label, start);
      push("template", value, start, index);
      continue;
    }
    if (char === "/" && regexCanStart()) {
      const start = index++;
      let inClass = false;
      let closed = false;
      while (index < source.length) {
        const current = source[index++];
        if (current === "\\") index += 1;
        else if (current === "[") inClass = true;
        else if (current === "]") inClass = false;
        else if (current === "/" && !inClass) {
          closed = true;
          break;
        } else if (/[\r\n]/.test(current)) break;
      }
      if (closed) {
        while (/[A-Za-z]/.test(source[index] || "")) index += 1;
        const raw = source.slice(start, index);
        assert.ok(!DOM_LOOKUP_MARKER.test(raw), `${label} hides a DOM lookup marker inside a regex at ${start}`);
        push("regex", raw, start, index);
        continue;
      }
      index = start;
    }
    if (/[A-Za-z_$]/.test(char)) {
      const start = index++;
      while (/[\w$]/.test(source[index] || "")) index += 1;
      push("id", source.slice(start, index), start, index);
      continue;
    }
    if (/\d/.test(char)) {
      const start = index++;
      while (/[\w.]/.test(source[index] || "")) index += 1;
      push("number", source.slice(start, index), start, index);
      continue;
    }
    assert.notEqual(char, "\\", `${label} must not use escaped identifiers in code context at ${index}`);
    push("punc", char, index, index + 1);
    index += 1;
  }
  return tokens;
}

function matchingToken(tokens, openIndex, open, close) {
  assert.equal(tokens[openIndex]?.value, open, `expected ${open} token`);
  let depth = 0;
  for (let index = openIndex; index < tokens.length; index += 1) {
    if (tokens[index].value === open) depth += 1;
    else if (tokens[index].value === close) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  assert.fail(`unterminated ${open} token group`);
}

function functionScopes(tokens) {
  const scopes = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].value !== "function") continue;
    let cursor = index + 1;
    if (tokens[cursor]?.value === "*") cursor += 1;
    const name = tokens[cursor]?.type === "id" ? tokens[cursor].value : "<anonymous>";
    while (cursor < tokens.length && tokens[cursor].value !== "(") cursor += 1;
    if (cursor >= tokens.length) continue;
    cursor = matchingToken(tokens, cursor, "(", ")") + 1;
    while (cursor < tokens.length && tokens[cursor].value !== "{") cursor += 1;
    if (cursor >= tokens.length) continue;
    const end = matchingToken(tokens, cursor, "{", "}");
    scopes.push({ name, start: cursor, end });
  }
  return scopes;
}

function scopeAt(tokenIndex, scopes) {
  const matches = scopes.filter((scope) => scope.start < tokenIndex && tokenIndex < scope.end);
  if (!matches.length) return "program";
  matches.sort((a, b) => (a.end - a.start) - (b.end - b.start));
  return matches[0].name;
}

function namedFunctionRange(tokens, name) {
  const matches = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].value !== "function") continue;
    let cursor = index + 1;
    if (tokens[cursor]?.value === "*") cursor += 1;
    if (tokens[cursor]?.value !== name) continue;
    while (cursor < tokens.length && tokens[cursor].value !== "(") cursor += 1;
    assert.ok(cursor < tokens.length, name + " must have a parameter list");
    const parameterOpen = cursor;
    const parameterClose = matchingToken(tokens, cursor, "(", ")");
    cursor = parameterClose + 1;
    while (cursor < tokens.length && tokens[cursor].value !== "{") cursor += 1;
    assert.ok(cursor < tokens.length, name + " must have a body");
    matches.push({
      start: cursor,
      end: matchingToken(tokens, cursor, "{", "}"),
      parameterOpen,
      parameterClose
    });
  }
  assert.equal(matches.length, 1, "source must declare exactly one function " + name);
  return matches[0];
}

function assertNamedFunctionParameters(tokens, name, expected, label) {
  const range = namedFunctionRange(tokens, name);
  assert.deepEqual(
    tokens.slice(range.parameterOpen + 1, range.parameterClose).map((token) => token.value),
    expected,
    label + " " + name + " parameter contract drift"
  );
  return range;
}

function directOwningFunctionScope(tokenIndex, scopes) {
  return scopes
    .filter((scope) => scope.start < tokenIndex && tokenIndex < scope.end)
    .sort((left, right) => (left.end - left.start) - (right.end - right.start))[0] || null;
}

function localDeclarationIndexes(tokens, range, identifier) {
  const indexes = [];
  for (let index = range.start + 1; index < range.end; index += 1) {
    if (["class", "function"].includes(tokens[index].value)) {
      if (tokens[index + 1]?.type === "id" && tokens[index + 1].value === identifier) indexes.push(index + 1);
      continue;
    }
    if (!["const", "let", "var"].includes(tokens[index].value)) continue;
    const next = tokens[index + 1];
    if (next?.type === "id" && next.value === identifier) indexes.push(index + 1);
    if (next?.value === "{" || next?.value === "[") {
      const close = matchingToken(tokens, index + 1, next.value, next.value === "{" ? "}" : "]");
      for (let cursor = index + 2; cursor < close; cursor += 1) {
        if (tokens[cursor].type === "id" && tokens[cursor].value === identifier) indexes.push(cursor);
      }
    }
  }
  return indexes;
}

function assertLocalBinding(tokens, range, identifier, expectedIndexes, label) {
  assert.deepEqual(
    localDeclarationIndexes(tokens, range, identifier),
    expectedIndexes,
    label + " " + identifier + " declaration ownership drift"
  );
  assert.ok(
    !parameterBindings(tokens.slice(range.start + 1, range.end)).includes(identifier),
    label + " shadows " + identifier + " as a nested parameter"
  );
}

function parameterBindings(tokens) {
  const bindings = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].value === "function" || tokens[index].value === "catch") {
      let open = index + 1;
      while (open < tokens.length && tokens[open].value !== "(" && tokens[open].value !== "{") open += 1;
      if (tokens[open]?.value !== "(") continue;
      const close = matchingToken(tokens, open, "(", ")");
      bindings.push(...tokens.slice(open + 1, close).filter((token) => token.type === "id").map((token) => token.value));
      index = open;
      continue;
    }
    if (tokens[index].value === "=" && tokens[index + 1]?.value === ">") {
      const previous = tokens[index - 1];
      if (previous?.type === "id") bindings.push(previous.value);
      else if (previous?.value === ")") {
        let depth = 0;
        let open = index - 1;
        for (; open >= 0; open -= 1) {
          if (tokens[open].value === ")") depth += 1;
          else if (tokens[open].value === "(") {
            depth -= 1;
            if (depth === 0) break;
          }
        }
        if (open >= 0) {
          bindings.push(...tokens.slice(open + 1, index - 1).filter((token) => token.type === "id").map((token) => token.value));
        }
      }
    }
  }
  const controls = new Set(["for", "if", "switch", "while", "with"]);
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].value !== "(") continue;
    const close = matchingToken(tokens, index, "(", ")");
    const before = tokens[index - 1];
    if (tokens[close + 1]?.value !== "{" || before?.type !== "id" || controls.has(before.value)) continue;
    bindings.push(...tokens.slice(index + 1, close).filter((token) => token.type === "id").map((token) => token.value));
    index = close;
  }
  return bindings;
}

function assertNoDynamicCode(tokens, label) {
  const forbidden = tokens.filter((token) => (
    token.value === "eval" || token.value === "Function" || token.value === "constructor"
  ));
  assert.deepEqual(forbidden, [], label + " must not use eval, Function, or constructor-based code generation");
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].type !== "string") continue;
    let cursor = index;
    let combined = tokens[index].value;
    while (tokens[cursor + 1]?.value === "+" && tokens[cursor + 2]?.type === "string") {
      combined += tokens[cursor + 2].value;
      cursor += 2;
    }
    if (cursor > index) {
      assert.ok(
        !["constructor", "eval", "function"].includes(combined.toLowerCase()),
        label + " must not assemble a dynamic-code property name"
      );
    }
  }
  for (let index = 0; index < tokens.length; index += 1) {
    if (!["setInterval", "setTimeout"].includes(tokens[index].value)) continue;
    let cursor = index + 1;
    if (tokens[cursor]?.value === "?" && tokens[cursor + 1]?.value === ".") cursor += 2;
    assert.equal(tokens[cursor]?.value, "(", label + " timer functions must not be aliased or member-rebound");
    const callClose = matchingToken(tokens, cursor, "(", ")");
    let argumentEnd = callClose;
    let round = 0;
    let square = 0;
    let brace = 0;
    for (let argumentCursor = cursor + 1; argumentCursor < callClose; argumentCursor += 1) {
      const value = tokens[argumentCursor].value;
      if (value === "," && round === 0 && square === 0 && brace === 0) {
        argumentEnd = argumentCursor;
        break;
      }
      if (value === "(") round += 1;
      else if (value === ")") round -= 1;
      else if (value === "[") square += 1;
      else if (value === "]") square -= 1;
      else if (value === "{") brace += 1;
      else if (value === "}") brace -= 1;
    }
    const argumentTokens = tokens.slice(cursor + 1, argumentEnd);
    let callable = false;
    if (argumentTokens[0]?.value === "function") {
      callable = true;
    } else if (argumentTokens[0]?.value === "async") {
      if (argumentTokens[1]?.type === "id" && argumentTokens[2]?.value === "=" && argumentTokens[3]?.value === ">") {
        callable = true;
      } else if (argumentTokens[1]?.value === "(") {
        const close = matchingToken(tokens, cursor + 2, "(", ")");
        callable = tokens[close + 1]?.value === "=" && tokens[close + 2]?.value === ">";
      }
    } else if (argumentTokens[0]?.value === "(") {
      const close = matchingToken(tokens, cursor + 1, "(", ")");
      callable = tokens[close + 1]?.value === "=" && tokens[close + 2]?.value === ">";
    } else if (argumentTokens[0]?.type === "id" && argumentTokens[1]?.value === "=" && argumentTokens[2]?.value === ">") {
      callable = true;
    } else if (argumentTokens.length === 1 && argumentTokens[0]?.type === "id") {
      const callback = argumentTokens[0].value;
      const declarations = [];
      for (let declarationIndex = 0; declarationIndex < tokens.length; declarationIndex += 1) {
        if (tokens[declarationIndex].value !== callback) continue;
        if (
          tokens[declarationIndex - 1]?.value === "function" ||
          (tokens[declarationIndex - 1]?.value === "*" && tokens[declarationIndex - 2]?.value === "function")
        ) {
          declarations.push(declarationIndex);
          continue;
        }
        if (tokens[declarationIndex - 1]?.value !== "const" || tokens[declarationIndex + 1]?.value !== "=") continue;
        let initializer = declarationIndex + 2;
        if (tokens[initializer]?.value === "async") initializer += 1;
        if (tokens[initializer]?.value === "function") {
          declarations.push(declarationIndex);
        } else if (tokens[initializer]?.type === "id" && tokens[initializer + 1]?.value === "=" && tokens[initializer + 2]?.value === ">") {
          declarations.push(declarationIndex);
        } else if (tokens[initializer]?.value === "(") {
          const close = matchingToken(tokens, initializer, "(", ")");
          if (tokens[close + 1]?.value === "=" && tokens[close + 2]?.value === ">") declarations.push(declarationIndex);
        }
      }
      assert.equal(declarations.length, 1, label + " timer callback " + callback + " must be one declared function");
      assertNoShadowedIdentifier(tokens, callback, declarations[0], label);
      callable = true;
    }
    assert.ok(callable, label + " timers must use a direct callable callback expression");
  }
  for (let index = 0; index < tokens.length; index += 1) {
    if (!["globalThis", "self", "window"].includes(tokens[index].value)) continue;
    let cursor = index + 1;
    if (tokens[cursor]?.value === "?") cursor += 1;
    if (tokens[cursor]?.value === ".") cursor += 1;
    assert.notEqual(tokens[cursor]?.value, "[", label + " must not use computed global-object access");
  }
}

function assertNoShadowedIdentifier(tokens, identifier, allowedDeclarationIndex, label) {
  const declarations = [];
  for (let index = 1; index < tokens.length; index += 1) {
    if (tokens[index].value !== identifier) continue;
    if (["const", "let", "var", "class", "function"].includes(tokens[index - 1]?.value)) declarations.push(index);
  }
  for (let index = 0; index < tokens.length; index += 1) {
    if (!["const", "let", "var"].includes(tokens[index].value)) continue;
    const opener = tokens[index + 1]?.value;
    if (opener !== "{" && opener !== "[") continue;
    const close = matchingToken(tokens, index + 1, opener, opener === "{" ? "}" : "]");
    for (let cursor = index + 2; cursor < close; cursor += 1) {
      if (tokens[cursor].type === "id" && tokens[cursor].value === identifier) declarations.push(cursor);
    }
  }
  const unexpected = declarations.filter((index) => index !== allowedDeclarationIndex);
  assert.deepEqual(unexpected, [], label + " shadows " + identifier + " with a local declaration");
  assert.ok(!parameterBindings(tokens).includes(identifier), label + " shadows " + identifier + " as a parameter");
}

function accountedGetElementCalls(tokens, scopes, label) {
  assertNoShadowedIdentifier(tokens, "document", -1, label);
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].value !== "document") continue;
    let cursor = index + 1;
    if (tokens[cursor]?.value === "?") {
      cursor += 1;
      if (tokens[cursor]?.value === ".") cursor += 1;
    }
    assert.notEqual(tokens[cursor]?.value, "[", label + " must not use computed document property access");
  }
  const calls = callRecords(tokens, ["document", "getElementById"], scopes);
  const mentions = tokens.filter((token) => token.value === "getElementById").length;
  assert.equal(mentions, calls.length, label + " has computed, aliased, or non-document getElementById access");
  return calls;
}

function callRecords(tokens, calleeParts, scopes) {
  const records = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (calleeParts.length === 1 && tokens[index - 1]?.value === "function") continue;
    if (tokens[index - 1]?.value === ".") continue;
    let cursor = index;
    let matched = true;
    for (let part = 0; part < calleeParts.length; part += 1) {
      if (tokens[cursor]?.type !== "id" || tokens[cursor].value !== calleeParts[part]) {
        matched = false;
        break;
      }
      cursor += 1;
      if (part < calleeParts.length - 1) {
        if (tokens[cursor]?.value !== ".") {
          matched = false;
          break;
        }
        cursor += 1;
      }
    }
    if (!matched) continue;
    if (tokens[cursor]?.value === "?" && tokens[cursor + 1]?.value === ".") cursor += 2;
    if (tokens[cursor]?.value !== "(") continue;
    const close = matchingToken(tokens, cursor, "(", ")");
    const argumentTokens = [];
    let round = 0;
    let square = 0;
    let brace = 0;
    for (let argIndex = cursor + 1; argIndex < close; argIndex += 1) {
      const value = tokens[argIndex].value;
      if (value === "," && round === 0 && square === 0 && brace === 0) break;
      argumentTokens.push(tokens[argIndex]);
      if (value === "(") round += 1;
      else if (value === ")") round -= 1;
      else if (value === "[") square += 1;
      else if (value === "]") square -= 1;
      else if (value === "{") brace += 1;
      else if (value === "}") brace -= 1;
    }
    records.push({ tokenIndex: index, scope: scopeAt(index, scopes), argumentTokens });
  }
  return records;
}

function expressionText(tokens) {
  return tokens.map((token) => (
    token.type === "string" || token.type === "template" ? JSON.stringify(token.value) : token.value
  )).join("");
}

function literalValue(record) {
  return record.argumentTokens.length === 1 && ["string", "template"].includes(record.argumentTokens[0].type)
    ? record.argumentTokens[0].value
    : null;
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] || 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
}

function assertCallMultiset(records, spec, label) {
  const literalValues = records.map(literalValue).filter((value) => value != null);
  assert.equal(literalValues.length, spec.literal_call_count, `${label} literal call count drift`);
  assert.deepEqual(sorted(new Set(literalValues)), spec.literal_ids, `${label} literal ID set drift`);
  if (spec.literal_call_counts) {
    assert.deepEqual(countBy(literalValues), spec.literal_call_counts, `${label} per-ID literal call counts drift`);
  }

  const dynamicRecords = records.filter((record) => literalValue(record) == null);
  const claimed = new Set();
  for (const dynamic of spec.dynamic_arguments || []) {
    const matches = dynamicRecords.filter((record, index) => {
      if (expressionText(record.argumentTokens) !== dynamic.expression) return false;
      claimed.add(index);
      return true;
    });
    assert.equal(matches.length, dynamic.count, `${label} dynamic ${dynamic.expression} count drift`);
    if (dynamic.scopes) {
      assert.deepEqual(matches.map((record) => record.scope), dynamic.scopes, `${label} dynamic ${dynamic.expression} scope drift`);
    }
  }
  assert.equal(claimed.size, dynamicRecords.length, `${label} has an unmanifested dynamic lookup`);
  return {
    literalValues,
    expandedIds: (spec.dynamic_arguments || []).flatMap((dynamic) => dynamic.expanded_ids || [])
  };
}

function selectorRecords(tokens, scopes) {
  return [
    ...callRecords(tokens, ["document", "querySelector"], scopes),
    ...callRecords(tokens, ["document", "querySelectorAll"], scopes)
  ];
}

function selectorRootIds(selectors) {
  const ids = [];
  for (const selector of selectors) {
    for (const match of selector.matchAll(/#([A-Za-z][\w:-]*)/g)) ids.push(match[1]);
  }
  return [...new Set(ids)];
}

function tokenSequenceIndexes(tokens, values) {
  const indexes = [];
  for (let index = 0; index <= tokens.length - values.length; index += 1) {
    if (values.every((value, offset) => tokens[index + offset].value === value)) indexes.push(index);
  }
  return indexes;
}

function countTokenSequence(tokens, values) {
  return tokenSequenceIndexes(tokens, values).length;
}

function singleTokenSequenceIndex(tokens, values, label) {
  const indexes = tokenSequenceIndexes(tokens, values);
  assert.equal(indexes.length, 1, label);
  return indexes[0];
}

function bracedBodyForSequence(tokens, range, values, label) {
  assert.equal(values.at(-1), "{", label + " sequence must end at a body opener");
  const rangeTokens = tokens.slice(range.start, range.end + 1);
  const relative = singleTokenSequenceIndex(rangeTokens, values, label);
  const open = range.start + relative + values.length - 1;
  return { start: open, end: matchingToken(tokens, open, "{", "}") };
}

function assertRecordInsideRange(record, range, label) {
  assert.ok(range.start < record.tokenIndex && record.tokenIndex < range.end, label);
}

function initializerForBinding(tokens, scopes, binding, scopeName, open, label) {
  const matches = [];
  for (let index = 1; index < tokens.length - 2; index += 1) {
    if (tokens[index].type !== "id" || tokens[index].value !== binding) continue;
    if (!["const", "let", "var"].includes(tokens[index - 1]?.value)) continue;
    if (scopeName != null && scopeAt(index, scopes) !== scopeName) continue;
    if (tokens[index + 1]?.value !== "=" || tokens[index + 2]?.value !== open) continue;
    const close = matchingToken(tokens, index + 2, open, open === "{" ? "}" : "]");
    matches.push({ open: index + 2, close });
  }
  assert.equal(matches.length, 1, label + " must declare exactly one " + binding + " " + open + " initializer");
  return matches[0];
}

function objectEntries(tokens, openIndex) {
  const closeIndex = matchingToken(tokens, openIndex, "{", "}");
  const entries = [];
  let index = openIndex + 1;
  while (index < closeIndex) {
    while (tokens[index]?.value === ",") index += 1;
    if (index >= closeIndex) break;
    const keyToken = tokens[index];
    assert.ok(["id", "string", "number"].includes(keyToken?.type), "object contract requires a static property key");
    assert.equal(tokens[index + 1]?.value, ":", "object contract requires key:value properties");
    const valueStart = index + 2;
    assert.ok(valueStart < closeIndex, "object contract property is missing a value");
    const opener = tokens[valueStart]?.value;
    let valueEnd = valueStart;
    if (opener === "{" || opener === "[" || opener === "(") {
      valueEnd = matchingToken(tokens, valueStart, opener, opener === "{" ? "}" : opener === "[" ? "]" : ")");
    } else {
      let round = 0;
      let square = 0;
      let brace = 0;
      while (valueEnd + 1 < closeIndex) {
        const value = tokens[valueEnd + 1].value;
        if (value === "," && round === 0 && square === 0 && brace === 0) break;
        valueEnd += 1;
        if (value === "(") round += 1;
        else if (value === ")") round -= 1;
        else if (value === "[") square += 1;
        else if (value === "]") square -= 1;
        else if (value === "{") brace += 1;
        else if (value === "}") brace -= 1;
      }
    }
    entries.push({ key: keyToken.value, valueStart, valueEnd });
    index = valueEnd + 1;
    if (tokens[index]?.value === ",") index += 1;
  }
  return entries;
}

function staticObjectStringValues(tokens, initializer, label) {
  return objectEntries(tokens, initializer.open).map((entry) => {
    assert.equal(entry.valueStart, entry.valueEnd, label + " values must be single string literals");
    assert.equal(tokens[entry.valueStart].type, "string", label + " values must be string literals");
    return tokens[entry.valueStart].value;
  });
}

function staticObjectStringMap(tokens, initializer, label) {
  return Object.fromEntries(objectEntries(tokens, initializer.open).map((entry) => {
    assert.equal(entry.valueStart, entry.valueEnd, label + " values must be single string literals");
    assert.equal(tokens[entry.valueStart].type, "string", label + " values must be string literals");
    return [entry.key, tokens[entry.valueStart].value];
  }).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
}

function staticObjectKeys(tokens, openIndex) {
  return objectEntries(tokens, openIndex).map((entry) => entry.key);
}

function staticArrayStrings(tokens, initializer, label) {
  const values = [];
  for (let index = initializer.open + 1; index < initializer.close; index += 1) {
    if (tokens[index].value === ",") continue;
    assert.equal(tokens[index].type, "string", label + " must contain only string literals");
    values.push(tokens[index].value);
  }
  return values;
}

function stringArrayForEachDomains(tokens, scopes, scopeName, parameter, label) {
  const domains = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].value !== "[" || scopeAt(index, scopes) !== scopeName) continue;
    const close = matchingToken(tokens, index, "[", "]");
    if (tokens[close + 1]?.value !== "." || tokens[close + 2]?.value !== "forEach" || tokens[close + 3]?.value !== "(") continue;
    const inside = tokens.slice(index + 1, close);
    if (!inside.every((token) => token.type === "string" || token.value === ",")) continue;
    assert.deepEqual(
      tokens.slice(close + 4, close + 9).map((token) => token.value),
      ["(", parameter, ")", "=", ">"],
      label + " " + scopeName + " forEach callback parameter drift"
    );
    const callClose = matchingToken(tokens, close + 3, "(", ")");
    assert.equal(
      countTokenSequence(
        tokens.slice(close + 4, callClose),
        ["document", ".", "getElementById", "(", parameter, ")"]
      ),
      1,
      label + " " + scopeName + " inline domain must feed exactly one document.getElementById lookup"
    );
    domains.push(inside.filter((token) => token.type === "string").map((token) => token.value));
    index = close;
  }
  return domains;
}

function assertLiteralHelperCalls(tokens, scopes, specs, label) {
  const ids = [];
  for (const spec of specs || []) {
    const declarations = tokens
      .map((token, index) => ({ token, index }))
      .filter(({ token, index }) => token.value === spec.callee && tokens[index - 1]?.value === "function")
      .map(({ index }) => index);
    assert.equal(declarations.length, 1, label + " must declare exactly one " + spec.callee + " helper");
    assertNoShadowedIdentifier(tokens, spec.callee, declarations[0], label);
    const records = callRecords(tokens, [spec.callee], scopes);
    const values = records.map(literalValue);
    assert.ok(values.every((value) => value != null), label + " " + spec.callee + " calls must use literal IDs");
    assert.equal(values.length, spec.call_count, label + " " + spec.callee + " call count drift");
    assert.deepEqual(sorted(values), spec.ids, label + " " + spec.callee + " ID multiset drift");
    assert.deepEqual(
      [...new Set(records.map((record) => record.scope))],
      [spec.scope],
      label + " " + spec.callee + " live call scope drift"
    );
    ids.push(...values);
  }
  return ids;
}

function assertSelectorCalls(tokens, scopes, expected, label) {
  const records = selectorRecords(tokens, scopes);
  const selectors = records.map(literalValue);
  assert.ok(selectors.every((value) => value != null), label + " document selectors must stay literal");
  assert.deepEqual(sorted(selectors), expected, label + " document selector multiset drift");
  return selectors;
}

function assertMemberSelectorCalls(tokens, scopes, expected, label) {
  const calleeSpecs = new Map();
  for (const spec of expected || []) {
    const key = spec.receiver + "." + spec.method;
    if (!calleeSpecs.has(key)) calleeSpecs.set(key, spec);
  }
  const actual = [];
  for (const spec of calleeSpecs.values()) {
    const calleeParts = [...spec.receiver.split("."), spec.method];
    const records = callRecords(tokens, calleeParts, scopes);
    for (const record of records) {
      const selector = literalValue(record);
      assert.ok(selector != null, label + " member selectors must stay literal");
      actual.push({
        receiver: spec.receiver,
        method: spec.method,
        selector,
        scope: record.scope,
        record,
        calleeParts
      });
    }
  }
  const keyOf = (entry) => [entry.scope, entry.receiver, entry.method, entry.selector].join("|");
  assert.deepEqual(
    sorted(actual.map(keyOf)),
    sorted((expected || []).map(keyOf)),
    label + " member selector inventory/scope drift"
  );

  for (const spec of expected || []) {
    const matches = actual.filter((entry) => keyOf(entry) === keyOf(spec));
    assert.equal(matches.length, 1, label + " member selector must have one live scoped call");
    const match = matches[0];
    const range = namedFunctionRange(tokens, spec.scope);
    assert.ok(
      range.start < match.record.tokenIndex && match.record.tokenIndex < range.end,
      label + " member selector must stay inside " + spec.scope
    );

    const ownerParts = spec.owner_lookup.split(":");
    const ownerKind = ownerParts.shift();
    const ownerValue = ownerParts.join(":");
    if (ownerKind === "$") {
      const ownerRecords = callRecords(tokens, ["$"], scopes).filter((record) => (
        record.scope === spec.scope && literalValue(record) === ownerValue
      ));
      assert.equal(ownerRecords.length, 1, label + " " + spec.scope + " owner $ lookup drift");
      assert.deepEqual(
        tokens.slice(ownerRecords[0].tokenIndex - 3, ownerRecords[0].tokenIndex).map((token) => token.value),
        ["const", "group", "="],
        label + " " + spec.scope + " owner binding drift"
      );
      assertLocalBinding(
        tokens,
        range,
        "group",
        [ownerRecords[0].tokenIndex - 2],
        label + " " + spec.scope + " member owner"
      );
    } else if (ownerKind === "document.querySelector") {
      const ownerRecords = callRecords(tokens, ["document", "querySelector"], scopes).filter((record) => (
        record.scope === spec.scope && literalValue(record) === ownerValue
      ));
      assert.equal(ownerRecords.length, 1, label + " " + spec.scope + " owner document selector drift");
      assert.deepEqual(
        tokens.slice(ownerRecords[0].tokenIndex - 3, ownerRecords[0].tokenIndex).map((token) => token.value),
        ["const", "btn", "="],
        label + " " + spec.scope + " owner binding drift"
      );
      assertLocalBinding(
        tokens,
        range,
        "btn",
        [ownerRecords[0].tokenIndex - 2],
        label + " " + spec.scope + " member owner"
      );
    } else {
      assert.fail(label + " unsupported member selector owner lookup " + spec.owner_lookup);
    }

    const scopeTokens = tokens.slice(range.start, range.end + 1);
    const calleeValues = spec.receiver.split(".").flatMap((part, index) => index ? [".", part] : [part]);
    calleeValues.push(".", spec.method, "(", spec.selector, ")");
    if (spec.usage === "for_each") {
      assert.equal(
        countTokenSequence(scopeTokens, [...calleeValues, ".", "forEach", "(", "(", "b", ")", "=", ">", "{"]),
        1,
        label + " " + spec.scope + " member selector forEach linkage drift"
      );
    } else if (spec.usage === "guard_return") {
      assert.equal(
        countTokenSequence(scopeTokens, ["if", "(", "!", "btn", "|", "|", ...calleeValues, ")", "return", ";"]),
        1,
        label + " " + spec.scope + " member selector guard linkage drift"
      );
    } else if (spec.usage === "click_delegate") {
      assert.equal(
        countTokenSequence(scopeTokens, [
          "group", ".", "addEventListener", "(", "click", ",", "(", "e", ")", "=", ">", "{",
          "const", "btn", "=", ...calleeValues
        ]),
        1,
        label + " " + spec.scope + " delegated click linkage drift"
      );
    } else {
      assert.fail(label + " unsupported member selector usage " + spec.usage);
    }
  }
  return actual;
}

function bodyDataPageFmPredicates(tokens, scopes) {
  const predicates = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].value !== "document") continue;
    if (tokens[index - 1]?.value === ".") continue;
    let cursor = index + 1;
    let matched = true;
    for (const member of ["body", "dataset", "page"]) {
      while (tokens[cursor]?.value === "?" || tokens[cursor]?.value === ".") cursor += 1;
      if (tokens[cursor]?.value !== member) {
        matched = false;
        break;
      }
      cursor += 1;
    }
    if (!matched) continue;
    const operator = tokens.slice(cursor, cursor + 3).map((token) => token.value).join("");
    const literal = tokens[cursor + 3];
    if (["===", "!=="].includes(operator) && literal?.type === "string" && literal.value === "fm") {
      predicates.push({ operator, scope: scopeAt(index, scopes), tokenIndex: index });
    }
  }
  return predicates;
}

function assertConsumerIds(consumer, ids, label) {
  assert.deepEqual(sorted(new Set(ids)), consumer.ids, label + " source-derived consumer ID coverage drift");
}

function validateEngineSource(consumer, source) {
  const label = consumer.path;
  const tokens = tokenizeJavaScript(source, label);
  assertNoDynamicCode(tokens, label);
  const scopes = functionScopes(tokens);
  const extraction = consumer.extraction;
  const getElementRecords = accountedGetElementCalls(tokens, scopes, label);
  const lookup = assertCallMultiset(
    getElementRecords,
    extraction.get_element_by_id,
    label + " getElementById"
  );
  const helperIds = assertLiteralHelperCalls(tokens, scopes, extraction.literal_helper_calls, label);
  const selectors = assertSelectorCalls(tokens, scopes, extraction.query_selectors, label);
  assert.equal(
    tokens.filter((token) => token.value === "querySelector" || token.value === "querySelectorAll").length,
    selectors.length,
    label + " querySelector access inventory drift"
  );
  const bodyPredicates = bodyDataPageFmPredicates(tokens, scopes);
  assert.equal(bodyPredicates.length, extraction.body_data_page_fm_checks, label + " body data-page=fm check count drift");
  assert.deepEqual(
    countBy(bodyPredicates.map((entry) => entry.operator)),
    extraction.body_data_page_fm_operator_counts,
    label + " body data-page=fm predicate operator drift"
  );
  assert.deepEqual(
    sorted(bodyPredicates.map(({ scope, operator }) => scope + ":" + operator)),
    sorted(extraction.body_data_page_fm_predicates.map(({ scope, operator }) => scope + ":" + operator)),
    label + " body data-page=fm predicate scope drift"
  );
  for (const spec of extraction.body_data_page_fm_predicates) {
    const range = namedFunctionRange(tokens, spec.scope);
    const scopeTokens = tokens.slice(range.start, range.end + 1);
    const predicate = ["document", ".", "body", "?", ".", "dataset", "?", ".", "page", ...spec.operator, "fm"];
    if (spec.usage === "early_return") {
      assert.equal(
        countTokenSequence(scopeTokens, ["if", "(", ...predicate, ")", "return", ";"]),
        1,
        label + " " + spec.scope + " body predicate early-return linkage drift"
      );
    } else if (spec.usage === "undefined_or_early_return_null") {
      assert.equal(
        countTokenSequence(scopeTokens, [
          "if", "(", "typeof", "document", ..."===", "undefined", "|", "|", ...predicate,
          ")", "return", "null", ";"
        ]),
        1,
        label + " " + spec.scope + " body predicate null-return linkage drift"
      );
    } else {
      assert.fail(label + " unsupported body predicate usage " + spec.usage);
    }
  }

  const faderIds = extraction.literal_helper_calls.find((spec) => spec.callee === "getSliderValue").ids;
  for (const id of faderIds) {
    const count = tokens.filter((token) => token.type === "string" && token.value === id).length;
    assert.equal(count, extraction.fader_literal_occurrences_per_id, label + " " + id + " literal origin count drift");
  }
  for (const origin of extraction.fader_origins) {
    let actual;
    if (origin.form === "object_values") {
      const initializer = initializerForBinding(tokens, scopes, origin.binding, origin.scope, "{", label);
      actual = staticObjectStringValues(tokens, initializer, label + " " + origin.binding);
      assert.ok(origin.mapping, label + " " + origin.binding + " must declare an exact key-to-ID mapping");
      assert.deepEqual(
        staticObjectStringMap(tokens, initializer, label + " " + origin.binding),
        origin.mapping,
        label + " " + origin.binding + " key-to-ID mapping drift"
      );
    } else if (origin.form === "array_values") {
      const initializer = initializerForBinding(tokens, scopes, origin.binding, origin.scope, "[", label);
      actual = staticArrayStrings(tokens, initializer, label + " " + origin.binding);
    } else if (origin.form === "literal_call_arguments") {
      const records = callRecords(tokens, [origin.callee], scopes);
      const scopedRecords = origin.scope === "program"
        ? records
        : records.filter((record) => record.scope === origin.scope);
      actual = scopedRecords.map(literalValue);
      assert.ok(actual.every((value) => value != null), label + " " + origin.callee + " fader origin must stay literal");
    } else {
      assert.fail(label + " has unsupported fader origin form " + origin.form);
    }
    assert.deepEqual(sorted(actual), faderIds, label + " " + (origin.binding || origin.callee) + " fader origin drift");
  }

  const getSliderRange = assertNamedFunctionParameters(
    tokens,
    "getSliderValue",
    ["id", ",", "fallback", "=", "50"],
    label
  );
  assertLocalBinding(tokens, getSliderRange, "id", [], label + " getSliderValue parameter");
  assert.equal(
    countTokenSequence(tokens.slice(getSliderRange.start, getSliderRange.end + 1), [
      "const", "el", "=", "document", ".", "getElementById", "(", "id", ")"
    ]),
    1,
    label + " getSliderValue parameter-to-lookup linkage drift"
  );

  const syncSliderRange = assertNamedFunctionParameters(tokens, "syncSliderValue", ["key", ",", "value"], label);
  const syncSliderTokens = tokens.slice(syncSliderRange.start, syncSliderRange.end + 1);
  const syncIdRelative = singleTokenSequenceIndex(
    syncSliderTokens,
    ["const", "id", "=", "SLIDER_BY_UCM", "[", "key", "]"],
    label + " syncSliderValue key-to-ID linkage drift"
  );
  assertLocalBinding(tokens, syncSliderRange, "key", [], label + " syncSliderValue parameter");
  assertLocalBinding(
    tokens,
    syncSliderRange,
    "id",
    [syncSliderRange.start + syncIdRelative + 1],
    label + " syncSliderValue resolver"
  );
  assert.equal(
    countTokenSequence(syncSliderTokens, ["document", ".", "getElementById", "(", "id", ")"]),
    1,
    label + " syncSliderValue ID-to-lookup linkage drift"
  );

  const attachRange = assertNamedFunctionParameters(tokens, "attachUI", [], label);
  const attachLoop = bracedBodyForSequence(
    tokens,
    attachRange,
    ["ids", ".", "forEach", "(", "id", "=", ">", "{"],
    label + " attachUI fader-domain loop linkage drift"
  );
  assert.deepEqual(
    localDeclarationIndexes(tokens, attachLoop, "id"),
    [],
    label + " attachUI loop must not shadow its id parameter"
  );
  const attachLookup = getElementRecords.filter((record) => (
    record.scope === "attachUI" && expressionText(record.argumentTokens) === "id"
  ));
  assert.equal(attachLookup.length, 1, label + " attachUI dynamic lookup drift");
  assertRecordInsideRange(attachLookup[0], attachLoop, label + " attachUI loop must own its dynamic lookup");

  const presetRange = assertNamedFunctionParameters(tokens, "applyPresetUCM", ["preset"], label);
  const presetLoop = bracedBodyForSequence(
    tokens,
    presetRange,
    ["for", "(", "const", "k", "of", "Object", ".", "keys", "(", "map", ")", ")", "{"],
    label + " applyPresetUCM map iteration linkage drift"
  );
  assert.deepEqual(
    localDeclarationIndexes(tokens, presetLoop, "k"),
    [],
    label + " applyPresetUCM loop must not shadow its key parameter"
  );
  const presetLookup = getElementRecords.filter((record) => (
    record.scope === "applyPresetUCM" && expressionText(record.argumentTokens) === "map[k]"
  ));
  assert.equal(presetLookup.length, 1, label + " applyPresetUCM dynamic lookup drift");
  assertRecordInsideRange(presetLookup[0], presetLoop, label + " applyPresetUCM loop must own its dynamic lookup");

  const idDynamic = extraction.get_element_by_id.dynamic_arguments.find((entry) => entry.expression === "id");
  for (const [scopeName, expected] of Object.entries(idDynamic.scope_domains || {})) {
    const domains = stringArrayForEachDomains(tokens, scopes, scopeName, idDynamic.expression, label);
    assert.equal(domains.length, 1, label + " " + scopeName + " must have one inline string forEach domain");
    assert.deepEqual(domains[0], expected, label + " " + scopeName + " inline ID domain drift");
  }

  assertConsumerIds(consumer, [
    ...lookup.literalValues,
    ...helperIds,
    ...selectorRootIds(selectors)
  ], label);
}

function validateFmSource(consumer, source) {
  const label = consumer.path;
  const tokens = tokenizeJavaScript(source, label);
  assertNoDynamicCode(tokens, label);
  const scopes = functionScopes(tokens);
  const extraction = consumer.extraction;
  const binding = extraction.dollar_binding;
  assert.equal(
    binding.target,
    "document.getElementById(" + binding.parameter + ")",
    label + " manifest $ binding target drift"
  );
  const bindingTokens = [
    "const", "$", "=", "(", binding.parameter, ")", "=", ">",
    "document", ".", "getElementById", "(", binding.parameter, ")"
  ];
  const dollarDeclarations = tokens
    .map((token, index) => ({ token, index }))
    .filter(({ token, index }) => token.value === "$" && ["const", "let", "var"].includes(tokens[index - 1]?.value))
    .map(({ index }) => index);
  assert.equal(dollarDeclarations.length, 1, label + " must declare exactly one live $ binding");
  const dollarDeclaration = dollarDeclarations[0];
  assert.deepEqual(
    tokens.slice(dollarDeclaration - 1, dollarDeclaration - 1 + bindingTokens.length).map((token) => token.value),
    bindingTokens,
    label + " live $ binding drift"
  );
  assertNoShadowedIdentifier(tokens, "$", dollarDeclaration, label);
  const directGetElementCalls = accountedGetElementCalls(tokens, scopes, label);
  assert.equal(directGetElementCalls.length, 1, label + " must use direct document.getElementById only in the $ binding");
  const bindingScopes = scopes
    .filter((scope) => scope.start < dollarDeclaration && dollarDeclaration < scope.end)
    .sort((left, right) => (left.end - left.start) - (right.end - right.start));
  assert.ok(bindingScopes.length, label + " $ binding must live inside the host IIFE");
  const bindingScope = bindingScopes[0];

  const dollarRecords = callRecords(tokens, ["$"], scopes);
  assert.ok(
    dollarRecords.every((record) => bindingScope.start < record.tokenIndex && record.tokenIndex < bindingScope.end),
    label + " $ calls must resolve to the single host-IIFE binding"
  );
  const routeTextRange = assertNamedFunctionParameters(
    tokens,
    "setRouteDiagnosticText",
    ["id", ",", "value"],
    label
  );
  assertLocalBinding(tokens, routeTextRange, "id", [], label + " setRouteDiagnosticText parameter");
  assert.equal(
    countTokenSequence(tokens.slice(routeTextRange.start, routeTextRange.end + 1), [
      "const", "el", "=", "$", "(", "id", ")"
    ]),
    1,
    label + " setRouteDiagnosticText parameter-to-lookup linkage drift"
  );
  const lookup = assertCallMultiset(
    dollarRecords,
    extraction.dollar_calls,
    label + " $"
  );
  const helperIds = assertLiteralHelperCalls(tokens, scopes, extraction.literal_helper_calls, label);
  const selectors = assertSelectorCalls(tokens, scopes, extraction.query_selectors, label);
  const memberSelectors = assertMemberSelectorCalls(tokens, scopes, extraction.member_query_selectors, label);
  const closestSelectors = assertMemberSelectorCalls(tokens, scopes, extraction.member_closest_selectors, label);
  assert.equal(
    tokens.filter((token) => token.value === "querySelector" || token.value === "querySelectorAll").length,
    selectors.length + memberSelectors.length,
    label + " querySelector access inventory drift"
  );
  assert.equal(
    tokens.filter((token) => token.value === "closest").length,
    closestSelectors.length,
    label + " closest access inventory drift"
  );
  const faderDynamic = extraction.dollar_calls.dynamic_arguments.find((entry) => entry.expanded_ids);
  const keySource = faderDynamic.key_source;
  const profiles = initializerForBinding(tokens, scopes, keySource.binding, null, "{", label);
  const profileOwner = directOwningFunctionScope(profiles.open, scopes);
  assert.ok(profileOwner, label + " genre profiles must have a live function owner");
  assert.deepEqual(
    { start: profileOwner.start, end: profileOwner.end },
    { start: bindingScope.start, end: bindingScope.end },
    label + " genre profiles must bind directly in the live host IIFE"
  );
  const profileEntries = objectEntries(tokens, profiles.open);
  assert.equal(profileEntries.length, keySource.profile_count, label + " genre profile count drift");
  assert.deepEqual(profileEntries.map((entry) => entry.key), keySource.profile_names, label + " genre profile names/order drift");
  for (const profile of profileEntries) {
    assert.equal(tokens[profile.valueStart]?.value, "{", label + " profile " + profile.key + " must be an object");
    const faders = objectEntries(tokens, profile.valueStart).filter((entry) => entry.key === keySource.nested_property);
    assert.equal(faders.length, 1, label + " profile " + profile.key + " must have one faders object");
    assert.equal(tokens[faders[0].valueStart]?.value, "{", label + " profile " + profile.key + " faders must be an object");
    assert.deepEqual(sorted(staticObjectKeys(tokens, faders[0].valueStart)), keySource.keys, label + " profile " + profile.key + " fader keys drift");
  }
  const applyProfileRange = assertNamedFunctionParameters(
    tokens,
    "applyGenreProfileNow",
    ["name", ",", "options", "=", "{", "}"],
    label
  );
  const applyProfileTokens = tokens.slice(applyProfileRange.start, applyProfileRange.end + 1);
  const liveProfileRelative = singleTokenSequenceIndex(
    applyProfileTokens,
    ["const", "profile", "=", keySource.binding, "[", "name", "]"],
    label + " live genre profile lookup drift"
  );
  assertLocalBinding(
    tokens,
    applyProfileRange,
    "profile",
    [applyProfileRange.start + liveProfileRelative + 1],
    label + " live genre profile"
  );
  const liveKeysRelative = singleTokenSequenceIndex(
    applyProfileTokens,
    ["const", "keys", "=", "Object", ".", "keys", "(", "profile", ".", keySource.nested_property, ")"],
    label + " live profile fader key resolver drift"
  );
  assertLocalBinding(
    tokens,
    applyProfileRange,
    "keys",
    [applyProfileRange.start + liveKeysRelative + 1],
    label + " live profile key resolver"
  );
  const liveFaderLookups = dollarRecords.filter((record) => expressionText(record.argumentTokens) === faderDynamic.expression);
  assert.equal(liveFaderLookups.length, 1, label + " live profile fader lookup count drift");
  const profileLoop = bracedBodyForSequence(
    tokens,
    applyProfileRange,
    ["keys", ".", "forEach", "(", "(", "key", ",", "i", ")", "=", ">", "{"],
    label + " live profile fader loop linkage drift"
  );
  assert.deepEqual(
    localDeclarationIndexes(tokens, profileLoop, "key"),
    [],
    label + " profile loop must not shadow its key parameter"
  );
  assertRecordInsideRange(
    liveFaderLookups[0],
    profileLoop,
    label + " dynamic fader lookup must stay inside the live profile-key loop"
  );
  assert.equal(
    countTokenSequence(tokens.slice(profileLoop.start, profileLoop.end + 1), [
      "slider", ".", "value", "=", "String", "(", "profile", ".", "faders", "[", "key", "]", ")"
    ]),
    1,
    label + " profile-key loop must write the matching fader value"
  );
  assert.deepEqual(
    sorted(keySource.keys.map((key) => "fader_" + key)),
    faderDynamic.expanded_ids,
    label + " manifest fader expansion drift"
  );

  assertConsumerIds(consumer, [
    ...lookup.literalValues,
    ...lookup.expandedIds,
    ...helperIds,
    ...selectorRootIds(selectors)
  ], label);
}

function validateLiteralGetElementSource(consumer, source) {
  const label = consumer.path;
  const tokens = tokenizeJavaScript(source, label);
  assertNoDynamicCode(tokens, label);
  const scopes = functionScopes(tokens);
  const lookup = assertCallMultiset(
    accountedGetElementCalls(tokens, scopes, label),
    consumer.extraction.get_element_by_id,
    label + " getElementById"
  );
  assertConsumerIds(consumer, lookup.literalValues, label);
}

function validateConsumerSource(consumer, source) {
  if (consumer.name === "engine") validateEngineSource(consumer, source);
  else if (consumer.name === "fm") validateFmSource(consumer, source);
  else validateLiteralGetElementSource(consumer, source);
}

class FixtureSetupError extends Error {}

function expectReject(label, expectedPattern, fn) {
  let rejection = null;
  try {
    fn();
  } catch (error) {
    rejection = error;
  }
  assert.ok(rejection, "negative fixture unexpectedly passed: " + label);
  assert.ok(!(rejection instanceof FixtureSetupError), "negative fixture setup failed: " + label + ": " + rejection.message);
  assert.equal(rejection.code, "ERR_ASSERTION", "negative fixture threw a non-contract error: " + label);
  assert.match(String(rejection.message), expectedPattern, "negative fixture rejected at the wrong seam: " + label);
}

function replaceOnce(text, search, replacement, label) {
  const index = text.indexOf(search);
  if (index < 0) throw new FixtureSetupError("fixture anchor missing: " + label);
  return text.slice(0, index) + replacement + text.slice(index + search.length);
}

function replaceRegexOnce(text, pattern, replacement, label) {
  if (!pattern.test(text)) throw new FixtureSetupError("fixture regex anchor missing: " + label);
  pattern.lastIndex = 0;
  return text.replace(pattern, replacement);
}

const { consumers, hosts } = manifestMaps(manifest);
const sourceByConsumer = new Map([...consumers].map(([name, consumer]) => [name, read(consumer.path)]));
const htmlByHost = new Map([...hosts].map(([name, host]) => [name, read(host.path)]));

for (const [name, host] of hosts) validateHost(host, htmlByHost.get(name), consumers);
for (const [name, consumer] of consumers) validateConsumerSource(consumer, sourceByConsumer.get(name));

const NEGATIVE_ERROR_PATTERNS = {
  "manifest consumer coverage": /consumer ID count drift/,
  "manifest required optional overlap": /classifies .* twice/,
  "required missing": /missing required/,
  "duplicate id": /duplicate id/,
  "required id case drift": /id case drift/,
  "required tag drift": /must be <div>/,
  "input type drift": /input type drift/,
  "Core body enters FM mode": /body must not declare data-page/,
  "FM body data-page case drift": /body data-page exact-case\/value drift/,
  "FM shim hidden removed": /must carry hidden/,
  "FM shim child moved outside": /must stay within/,
  "FM attribute group relocated": /controls must stay within/,
  "FM energy multiple selected": /exactly one aria-pressed=true/,
  "optional wrong-case insertion": /id case drift/,
  "progress direct child count": /direct <span> child count drift/,
  "FM stray performance pad": /performance-pad values\/order\/tags drift/,
  "consumer script missing": /external script count drift/,
  "range max drift": /range max drift/,
  "select option domain drift": /option values\/order drift/,
  "member-call lookup compensation": /computed, aliased, or non-document|getElementById|literal call count drift|per-ID literal call counts drift/,
  "template interpolation lookup hiding": /hides a DOM lookup/,
  "engine inline resolver drift": /inline ID domain drift/,
  "FM profile fader key drift": /fader keys drift/,
  "non-void self-closing consumer script": /invalid self-closing syntax/,
  "body predicate operator drift": /predicate operator drift/,
  "inline callback parameter drift": /forEach callback parameter drift/,
  "manifest dollar target drift": /manifest \$ binding target drift/,
  "manifest literal origin scope drift": /fader origin drift/,
  "computed getElementById access": /computed document property|computed, aliased, or non-document/,
  "shadowed document compensation": /shadows document as a parameter/,
  "FM direct getElementById addition": /direct document\.getElementById only/,
  "FM dead dollar binding proof": /exactly one live \$ binding/,
  "engine fader mapping key drift": /key-to-ID mapping drift/,
  "FM profile name drift": /profile names\/order drift/,
  "FM dead resolver compensation": /live profile fader key resolver drift/,
  "document base override": /must not redefine the document base URL/,
  "browser-equivalent duplicate consumer": /external script count drift/,
  "encoded consumer src": /unescaped canonical path/,
  "encoded duplicate id": /character references/,
  "managed consumer async": /must not load .* with async/,
  "managed consumer nomodule": /must not suppress .* with nomodule/,
  "range manifest omission": /cover every required range seam exactly/,
  "unselected aria state omission": /aria-pressed state drift/,
  "undeclared known consumer": /external script count drift/,
  "generic casefold collision": /casefold-colliding ids/,
  "FM member selector drift": /member selector inventory/,
  "raw script close boundary": /unterminated <script>/,
  "foreign namespace control": /forbids browser-state-changing <svg>/,
  "table foster placement": /forbids browser-state-changing <table>/,
  "plaintext host takeover": /forbids browser-state-changing <plaintext>/,
  "script double escape": /double-escaped state/,
  "frameset host takeover": /forbids browser-state-changing <frameset>/,
  "select insertion mode": /must not be nested inside a select insertion mode/,
  "absolute managed consumer": /external script count drift/,
  "network-path managed consumer": /external script count drift/,
  "leading whitespace managed consumer": /ASCII whitespace or controls/,
  "embedded tab managed consumer": /ASCII whitespace or controls/,
  "managed consumer integrity": /unowned integrity digest/,
  "managed consumer language": /legacy language typing/,
  "embedded CSP suppression": /Content-Security-Policy meta/,
  "encoded CSP suppression": /meta http-equiv must not use character references/,
  "meta refresh takeover": /must not navigate away through a meta refresh/,
  "multiple select drift": /single-select control/,
  "disabled option drift": /options must remain enabled/,
  "select size drift": /collapsed size=1 select/,
  "disabled fieldset select": /inherit disabledness from a fieldset/,
  "required optional classification swap": /required ID classification drift|optional ID classification drift/,
  "FM closest selector drift": /member selector inventory/,
  "FM dead member compensation": /member selector inventory/,
  "FM member owner swap": /owner \$ lookup drift/,
  "FM member owner shadow": /group declaration ownership drift/,
  "FM member class shadow": /group declaration ownership drift/,
  "method shorthand document shadow": /shadows document as a parameter/,
  "getSliderValue parameter linkage": /getSliderValue parameter contract drift/,
  "attachUI parameter linkage": /attachUI fader-domain loop linkage drift/,
  "route diagnostic parameter linkage": /setRouteDiagnosticText parameter contract drift/,
  "FM fader loop linkage": /live profile fader loop linkage drift/,
  "FM live profile ownership": /genre profiles must bind directly in the live host IIFE/,
  "FM profile binding shadow": /profile declaration ownership drift/,
  "FM profile class shadow": /profile declaration ownership drift/,
  "eval dynamic code": /must not use eval/,
  "Function dynamic code": /must not use eval/,
  "computed eval dynamic code": /assemble a dynamic-code property name|computed global-object access/,
  "string timeout dynamic code": /timers must use .*callable callback/,
  "string interval dynamic code": /timers must use .*callable callback/,
  "aliased string timer dynamic code": /timer callback delayedDomCode must be one declared function/,
  "comma string timer dynamic code": /timers must use a direct callable callback expression/,
  "conditional string timer dynamic code": /timers must use a direct callable callback expression/,
  "constructor dynamic code": /must not use eval/,
  "computed constructor dynamic code": /must not assemble a dynamic-code property name/,
  "regex division lookup hiding": /literal call count drift|per-ID literal call counts drift/,
  "unicode escaped DOM identifier": /must not use escaped identifiers/,
  "optional computed document access": /computed document property access/,
  "body member compensation": /body data-page=fm check count drift/,
  "manifest canonical fader mapping": /canonical mapping drift/,
  "manifest duplicate dynamic evidence": /dynamic lookup descriptor drift/,
  "manifest duplicate helper evidence": /helper-call descriptor drift/,
  "manifest duplicate fader origin": /fader origin descriptors drift/,
  "manifest checked default omission": /required seam defaults drift/,
  "manifest selected group omission": /attribute group selected defaults drift/,
  "manifest shim attribute omission": /container attribute contract drift/
};
const EXPECTED_NEGATIVE_FIXTURE_COUNT = 101;
const EXPECTED_NEGATIVE_LABELS_SHA256 = "848be5d104622d0cdd41cd58bce2ed461ec220d136c5a0885802cdbe6dd7a598";

let negativeCount = 0;
const exercisedNegativeLabels = new Set();
const reject = (label, fn) => {
  const expectedPattern = NEGATIVE_ERROR_PATTERNS[label];
  if (!expectedPattern) throw new FixtureSetupError("missing expected rejection pattern: " + label);
  if (exercisedNegativeLabels.has(label)) throw new FixtureSetupError("duplicate negative fixture label: " + label);
  expectReject(label, expectedPattern, fn);
  exercisedNegativeLabels.add(label);
  negativeCount += 1;
};
const coreHost = hosts.get("core");
const fmHost = hosts.get("fm");
const coreHtml = htmlByHost.get("core");
const fmHtml = htmlByHost.get("fm");
const engineConsumer = consumers.get("engine");
const fmConsumer = consumers.get("fm");
const engineSource = sourceByConsumer.get("engine");
const fmSource = sourceByConsumer.get("fm");

reject("manifest consumer coverage", () => {
  const drift = cloneJson(manifest);
  drift.consumers.find((item) => item.name === "engine").ids =
    drift.consumers.find((item) => item.name === "engine").ids.filter((id) => id !== "fm-genre");
  manifestMaps(drift);
});
reject("manifest required optional overlap", () => {
  const drift = cloneJson(manifest);
  const core = drift.hosts.find((item) => item.name === "core");
  core.optional[core.optional.length - 1] = { ...core.required[0], reason: "negative fixture" };
  core.optional.sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  manifestMaps(drift);
});
reject("required missing", () => validateHost(
  coreHost,
  replaceOnce(coreHtml, 'id="status-text"', 'data-removed-id="status-text"', "required missing"),
  consumers
));
reject("duplicate id", () => validateHost(
  coreHost,
  replaceOnce(coreHtml, "</body>", '<span id="status-text"></span></body>', "duplicate id"),
  consumers
));
reject("required id case drift", () => validateHost(
  coreHost,
  replaceOnce(coreHtml, 'id="status-text"', 'id="Status-Text"', "required case"),
  consumers
));
reject("required tag drift", () => {
  const drift = cloneJson(coreHost);
  drift.required.find((entry) => entry.id === "btn_start").tag = "div";
  validateHost(drift, coreHtml, consumers);
});
reject("input type drift", () => {
  const drift = cloneJson(coreHost);
  drift.required.find((entry) => entry.id === "fader_energy").input_type = "text";
  validateHost(drift, coreHtml, consumers);
});
reject("Core body enters FM mode", () => validateHost(
  coreHost,
  replaceOnce(coreHtml, "<body", '<body data-page="fm"', "core body data-page"),
  consumers
));
reject("FM body data-page case drift", () => validateHost(
  fmHost,
  replaceOnce(fmHtml, 'data-page="fm"', 'data-page="FM"', "fm body data-page"),
  consumers
));
reject("FM shim hidden removed", () => validateHost(
  fmHost,
  replaceRegexOnce(fmHtml, /(<div id="fm-engine-shim"[^>]*)\shidden(?=[\s>])/, "$1", "shim hidden"),
  consumers
));
reject("FM shim child moved outside", () => {
  let drift = replaceOnce(fmHtml, 'id="fader_energy"', 'id="fader_energy-old"', "shim child rename");
  drift = replaceOnce(drift, "</body>", '<input type="range" min="0" max="100" id="fader_energy"></body>', "shim child inject");
  validateHost(fmHost, drift, consumers);
});
reject("FM attribute group relocated", () => validateHost(
  fmHost,
  replaceOnce(fmHtml, "</body>", '<button data-energy="low"></button></body>', "group relocation"),
  consumers
));
reject("FM energy multiple selected", () => validateHost(
  fmHost,
  replaceOnce(
    fmHtml,
    'data-energy="low" aria-pressed="false"',
    'data-energy="low" aria-pressed="true"',
    "multiple energy selection"
  ),
  consumers
));
reject("optional wrong-case insertion", () => validateHost(
  fmHost,
  replaceOnce(fmHtml, "</body>", '<button id="BTN_REC"></button></body>', "optional case"),
  consumers
));
reject("progress direct child count", () => validateHost(
  fmHost,
  replaceRegexOnce(fmHtml, /(<div id="fm-progress"[^>]*>)/, "$1<span></span>", "progress child"),
  consumers
));
reject("FM stray performance pad", () => validateHost(
  fmHost,
  replaceOnce(fmHtml, "</body>", '<button data-performance-pad="drift"></button></body>', "fm performance pad"),
  consumers
));
reject("consumer script missing", () => validateHost(
  fmHost,
  replaceRegexOnce(
    fmHtml,
    /<script\b[^>]*src=["'][^"']*audio\/genre-flavor\.js[^"']*["'][^>]*>\s*<\/script>/i,
    "",
    "consumer script"
  ),
  consumers
));
reject("range max drift", () => validateHost(
  coreHost,
  replaceRegexOnce(
    coreHtml,
    /(<input\b[^>]*id="fader_energy"[^>]*max=")100(")/i,
    "$110$2",
    "range max"
  ),
  consumers
));
reject("select option domain drift", () => validateHost(
  fmHost,
  replaceOnce(fmHtml, '<option value="earth_reed">', '<option value="earth_drift">', "option domain"),
  consumers
));
reject("non-void self-closing consumer script", () => validateHost(
  coreHost,
  replaceRegexOnce(
    coreHtml,
    /<script(\s+src="engine\.js[^"]*"[^>]*)>\s*<\/script>/i,
    "<script$1 />",
    "self-closing script"
  ),
  consumers
));
reject("body predicate operator drift", () => validateConsumerSource(
  engineConsumer,
  replaceOnce(
    engineSource,
    'document.body?.dataset?.page === "fm"',
    'document.body?.dataset?.page !== "fm"',
    "body predicate operator"
  )
));
reject("inline callback parameter drift", () => validateConsumerSource(
  engineConsumer,
  replaceOnce(
    engineSource,
    '["btn_start", "btn_stop"].forEach((id) =>',
    '["btn_start", "btn_stop"].forEach((wrong) =>',
    "inline callback parameter"
  )
));
reject("manifest dollar target drift", () => {
  const drift = cloneJson(fmConsumer);
  drift.extraction.dollar_binding.target = "document.querySelector(id)";
  validateConsumerSource(drift, fmSource);
});
reject("manifest literal origin scope drift", () => {
  const drift = cloneJson(engineConsumer);
  drift.extraction.fader_origins.find((origin) => origin.form === "literal_call_arguments").scope = "deadScope";
  validateConsumerSource(drift, engineSource);
});
reject("computed getElementById access", () => validateConsumerSource(
  engineConsumer,
  engineSource + '\ndocument["get" + "ElementById"]("rogue-seam");\n'
));
reject("shadowed document compensation", () => {
  const removed = replaceOnce(
    engineSource,
    'document.getElementById("status-text")',
    "null",
    "shadow compensation removal"
  );
  validateConsumerSource(
    engineConsumer,
    removed + '\nfunction proof(document) { return document.getElementById("status-text"); }\n'
  );
});
reject("FM direct getElementById addition", () => validateConsumerSource(
  fmConsumer,
  fmSource + '\ndocument.getElementById("rogue-seam");\n'
));
reject("FM dead dollar binding proof", () => {
  const broken = replaceOnce(
    fmSource,
    "const $ = (id) => document.getElementById(id);",
    "const $ = (id) => null;",
    "live dollar binding"
  );
  validateConsumerSource(
    fmConsumer,
    broken + "\nfunction deadProof() { const $ = (id) => document.getElementById(id); return $; }\n"
  );
});
reject("engine fader mapping key drift", () => validateConsumerSource(
  engineConsumer,
  replaceRegexOnce(
    engineSource,
    /(const SLIDER_BY_UCM\s*=\s*\{\s*)energy:/,
    "$1energy_drift:",
    "engine fader mapping key"
  )
));
reject("FM profile name drift", () => validateConsumerSource(
  fmConsumer,
  replaceRegexOnce(
    fmSource,
    /(const GENRE_PROFILES\s*=\s*\{\s*)any:/,
    "$1any_drift:",
    "FM profile name"
  )
));
reject("FM dead resolver compensation", () => {
  const broken = replaceOnce(
    fmSource,
    "const keys = Object.keys(profile.faders);",
    "const keys = [];",
    "live FM resolver"
  );
  validateConsumerSource(
    fmConsumer,
    broken + "\nfunction deadResolver() { return Object.keys(profile.faders); }\n"
  );
});
reject("document base override", () => validateHost(
  coreHost,
  replaceOnce(coreHtml, "<head>", '<head><base href="/broken/">', "document base"),
  consumers
));
reject("browser-equivalent duplicate consumer", () => validateHost(
  coreHost,
  replaceOnce(
    coreHtml,
    "</body>",
    '<script src="audio/../engine.js?v=shadow" defer></script></body>',
    "canonical duplicate consumer"
  ),
  consumers
));
reject("encoded consumer src", () => validateHost(
  coreHost,
  replaceOnce(
    coreHtml,
    "</body>",
    '<script src="engine&#46;js?v=shadow" defer></script></body>',
    "encoded consumer src"
  ),
  consumers
));
reject("encoded duplicate id", () => validateHost(
  coreHost,
  replaceOnce(coreHtml, "</body>", '<span id="status&#45;text"></span></body>', "encoded id"),
  consumers
));
reject("managed consumer async", () => validateHost(
  fmHost,
  replaceOnce(
    fmHtml,
    'src="audio/genre-flavor.js?v=fm-80" defer',
    'src="audio/genre-flavor.js?v=fm-80" defer async',
    "managed async"
  ),
  consumers
));
reject("managed consumer nomodule", () => validateHost(
  fmHost,
  replaceOnce(
    fmHtml,
    'src="audio/genre-flavor.js?v=fm-80" defer',
    'src="audio/genre-flavor.js?v=fm-80" defer nomodule',
    "managed nomodule"
  ),
  consumers
));
reject("range manifest omission", () => {
  const drift = cloneJson(coreHost);
  const group = drift.structures.range_groups.find((entry) => entry.ids.includes("fader_wave"));
  group.ids = group.ids.filter((id) => id !== "fader_wave");
  validateHost(drift, coreHtml, consumers);
});
reject("unselected aria state omission", () => validateHost(
  fmHost,
  replaceOnce(
    fmHtml,
    'data-energy="low" aria-pressed="false"',
    'data-energy="low"',
    "aria false omission"
  ),
  consumers
));
reject("undeclared known consumer", () => validateHost(
  coreHost,
  replaceOnce(coreHtml, "</body>", '<script src="fm.js?v=shadow" defer></script></body>', "undeclared consumer"),
  consumers
));
reject("generic casefold collision", () => validateHost(
  coreHost,
  replaceOnce(coreHtml, "</body>", '<span id="foo"></span><span id="Foo"></span></body>', "casefold collision"),
  consumers
));

const harmlessHtmlNoise =
  '<!-- <script src="fm.js"></script><div id="status-text"></div> -->' +
  '<script>const fakeMarkup = "<div id=\\"status-text\\"></div>";</script>';
validateHost(coreHost, replaceOnce(coreHtml, "</body>", harmlessHtmlNoise + "</body>", "HTML parser noise"), consumers);
const harmlessSourceNoise =
  '\n// document.getElementById("status-text")\n' +
  'const domLookupText = "document.getElementById(\\"status-text\\")";\n' +
  'const unrelatedRegex = /harmless-source-noise/;\n';
validateConsumerSource(engineConsumer, engineSource + harmlessSourceNoise);

reject("member-call lookup compensation", () => {
  const removed = replaceOnce(
    engineSource,
    'document.getElementById("status-text")',
    "null",
    "member compensation removal"
  );
  validateConsumerSource(engineConsumer, removed + '\nfake.document.getElementById("status-text");\n');
});
reject("template interpolation lookup hiding", () => {
  const tick = String.fromCharCode(96);
  const interpolation = "$" + '{({}).x || document.getElementById("status-text")}';
  validateConsumerSource(engineConsumer, engineSource + "\nconst hiddenLookup = " + tick + interpolation + tick + ";\n");
});
reject("engine inline resolver drift", () => validateConsumerSource(
  engineConsumer,
  replaceOnce(
    engineSource,
    '["btn_start", "btn_stop"]',
    '["btn_start", "btn_rec"]',
    "transport resolver"
  )
));
reject("FM profile fader key drift", () => validateConsumerSource(
  fmConsumer,
  replaceOnce(fmSource, "faders: { energy:", "faders: { energy_drift:", "profile fader key")
));
reject("FM member selector drift", () => validateConsumerSource(
  fmConsumer,
  replaceOnce(
    fmSource,
    'group.querySelectorAll("button[data-energy]")',
    'group.querySelectorAll("button[data-energy-drift]")',
    "FM member selector"
  )
));

reject("raw script close boundary", () => validateHost(
  coreHost,
  replaceOnce(coreHtml, "</body>", "<script></scriptx></body>", "raw script close"),
  consumers
));
reject("foreign namespace control", () => validateHost(
  coreHost,
  replaceRegexOnce(
    coreHtml,
    /(<input\b[^>]*id="fader_energy"[^>]*>)/i,
    "<svg>$1</svg>",
    "foreign namespace control"
  ),
  consumers
));
reject("table foster placement", () => {
  let drift = replaceOnce(
    fmHtml,
    '<div id="fm-engine-shim"',
    '<table><div id="fm-engine-shim"',
    "table foster open"
  );
  drift = replaceRegexOnce(
    drift,
    /(<span id="audio_output_status"><\/span>\s*<\/div>)/,
    "$1</table>",
    "table foster close"
  );
  validateHost(fmHost, drift, consumers);
});
reject("plaintext host takeover", () => validateHost(
  coreHost,
  replaceRegexOnce(
    coreHtml,
    /(<body\b[^>]*>)/i,
    "$1<plaintext></plaintext>",
    "plaintext host takeover"
  ),
  consumers
));
reject("script double escape", () => validateHost(
  coreHost,
  replaceRegexOnce(
    coreHtml,
    /(<body\b[^>]*>)/i,
    "$1<script><!--<script></script>",
    "script double escape"
  ),
  consumers
));
reject("frameset host takeover", () => validateHost(
  coreHost,
  replaceOnce(coreHtml, "</head>", "</head><frameset></frameset>", "frameset host takeover"),
  consumers
));
reject("select insertion mode", () => validateHost(
  coreHost,
  replaceRegexOnce(
    coreHtml,
    /(<button\b[^>]*id="btn_start"[^>]*>[\s\S]*?<\/button>)/i,
    "<select><option>$1</option></select>",
    "select insertion mode"
  ),
  consumers
));
reject("absolute managed consumer", () => validateHost(
  coreHost,
  replaceRegexOnce(
    coreHtml,
    /src="engine\.js([^"]*)"/i,
    'src="https://music-contract.invalid/engine.js$1"',
    "absolute managed consumer"
  ),
  consumers
));
reject("network-path managed consumer", () => validateHost(
  coreHost,
  replaceRegexOnce(
    coreHtml,
    /src="engine\.js([^"]*)"/i,
    'src="//music-contract.invalid/engine.js$1"',
    "network-path managed consumer"
  ),
  consumers
));
reject("leading whitespace managed consumer", () => validateHost(
  coreHost,
  replaceRegexOnce(
    coreHtml,
    /src="engine\.js([^"]*)"/i,
    'src=" https://music-contract.invalid/engine.js$1"',
    "leading whitespace managed consumer"
  ),
  consumers
));
reject("embedded tab managed consumer", () => validateHost(
  coreHost,
  replaceRegexOnce(
    coreHtml,
    /src="engine\.js([^"]*)"/i,
    'src="h\tttps://music-contract.invalid/engine.js$1"',
    "embedded tab managed consumer"
  ),
  consumers
));
reject("managed consumer integrity", () => validateHost(
  coreHost,
  replaceRegexOnce(
    coreHtml,
    /(<script\b[^>]*src="engine\.js[^"]*"[^>]*)(>)/i,
    '$1 integrity="sha256-not-real"$2',
    "managed integrity"
  ),
  consumers
));
reject("managed consumer language", () => validateHost(
  coreHost,
  replaceRegexOnce(
    coreHtml,
    /(<script\b[^>]*src="engine\.js[^"]*"[^>]*)(>)/i,
    '$1 language="vbscript"$2',
    "managed language"
  ),
  consumers
));
reject("embedded CSP suppression", () => validateHost(
  coreHost,
  replaceOnce(
    coreHtml,
    "<head>",
    '<head><meta http-equiv="Content-Security-Policy" content="script-src \'none\'">',
    "embedded CSP"
  ),
  consumers
));
reject("encoded CSP suppression", () => validateHost(
  coreHost,
  replaceOnce(
    coreHtml,
    "<head>",
    '<head><meta http-equiv="content-security&#45;policy" content="script-src \'none\'">',
    "encoded CSP"
  ),
  consumers
));
reject("meta refresh takeover", () => validateHost(
  coreHost,
  replaceOnce(
    coreHtml,
    "<head>",
    '<head><meta http-equiv="refresh" content="0;url=about:blank">',
    "meta refresh"
  ),
  consumers
));
reject("multiple select drift", () => validateHost(
  coreHost,
  replaceOnce(coreHtml, '<select id="auto_arc_mode"', '<select multiple id="auto_arc_mode"', "multiple select"),
  consumers
));
reject("disabled option drift", () => validateHost(
  coreHost,
  replaceOnce(coreHtml, '<option value="live">', '<option value="live" disabled>', "disabled option"),
  consumers
));
reject("select size drift", () => validateHost(
  coreHost,
  replaceOnce(coreHtml, '<select id="auto_arc_mode"', '<select size="2" id="auto_arc_mode"', "select size"),
  consumers
));
reject("disabled fieldset select", () => validateHost(
  coreHost,
  replaceRegexOnce(
    coreHtml,
    /(<select\b[^>]*id="auto_arc_mode"[^>]*>[\s\S]*?<\/select>)/i,
    "<fieldset disabled>$1</fieldset>",
    "disabled fieldset select"
  ),
  consumers
));
reject("required optional classification swap", () => {
  const drift = cloneJson(manifest);
  const host = drift.hosts.find((entry) => entry.name === "core");
  const requiredIndex = host.required.findIndex((entry) => entry.id === "status-text");
  const optionalIndex = host.optional.findIndex((entry) => entry.id === "fm-genre");
  const required = host.required[requiredIndex];
  host.required[requiredIndex] = host.optional[optionalIndex];
  host.optional[optionalIndex] = required;
  host.required.sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  host.optional.sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  manifestMaps(drift);
});
reject("FM closest selector drift", () => validateConsumerSource(
  fmConsumer,
  replaceOnce(
    fmSource,
    'e.target.closest("button[data-energy]")',
    'e.target.closest("button[data-energy-drift]")',
    "FM closest selector"
  )
));
reject("FM dead member compensation", () => {
  const broken = replaceOnce(
    fmSource,
    'btn.querySelector(".fm-genre-caption")',
    "null",
    "FM live member removal"
  );
  validateConsumerSource(
    fmConsumer,
    broken + '\nfunction deadMember(btn) { return btn.querySelector(".fm-genre-caption"); }\n'
  );
});
reject("FM member owner swap", () => {
  let drift = replaceRegexOnce(
    fmSource,
    /(function setEnergySelection[\s\S]*?const group = \$\(")fm-energy("\);)/,
    "$1fm-genre$2",
    "FM energy owner swap"
  );
  drift = replaceRegexOnce(
    drift,
    /(function setGenreSelection[\s\S]*?const group = \$\(")fm-genre("\);)/,
    "$1fm-energy$2",
    "FM genre owner swap"
  );
  validateConsumerSource(fmConsumer, drift);
});
reject("FM member owner shadow", () => validateConsumerSource(
  fmConsumer,
  replaceRegexOnce(
    fmSource,
    /(group\.querySelectorAll\("button\[data-genre\]"\)\.forEach\(\(b\) => \{\s*b\.setAttribute\("aria-pressed", b\.dataset\.genre === name \? "true" : "false"\);\s*\}\);)/,
    '{ const group = document.createElement("div"); $1 }',
    "FM member owner shadow"
  )
));
reject("method shorthand document shadow", () => {
  const removed = replaceOnce(
    engineSource,
    'document.getElementById("voice_status")',
    "null",
    "method shorthand removal"
  );
  validateConsumerSource(
    engineConsumer,
    removed + '\nconst documentShadowProof = { lookup(document) { return document.getElementById("voice_status"); } };\n'
  );
});
reject("getSliderValue parameter linkage", () => validateConsumerSource(
  engineConsumer,
  replaceOnce(
    engineSource,
    "function getSliderValue(id, fallback = 50)",
    "function getSliderValue(wrong, fallback = 50)",
    "getSliderValue parameter"
  )
));
reject("attachUI parameter linkage", () => validateConsumerSource(
  engineConsumer,
  replaceOnce(engineSource, "ids.forEach(id => {", "ids.forEach(wrong => {", "attachUI parameter")
));
reject("route diagnostic parameter linkage", () => validateConsumerSource(
  fmConsumer,
  replaceOnce(
    fmSource,
    "function setRouteDiagnosticText(id, value)",
    "function setRouteDiagnosticText(wrong, value)",
    "route diagnostic parameter"
  )
));
reject("FM fader loop linkage", () => validateConsumerSource(
  fmConsumer,
  replaceOnce(fmSource, "keys.forEach((key, i) => {", "[].forEach((key, i) => {", "FM fader loop")
));
reject("FM live profile ownership", () => {
  let broken = replaceOnce(
    fmSource,
    "const GENRE_PROFILES = {",
    "const GENRE_PROFILES = null;\n  function deadProfiles() {\n    const GENRE_PROFILES = {",
    "FM live profile owner start"
  );
  broken = replaceRegexOnce(
    broken,
    /(\r?\n\s*};)(\r?\n\r?\n\s*let started = false;)/,
    "$1\n    return GENRE_PROFILES;\n  }$2",
    "FM live profile owner end"
  );
  validateConsumerSource(fmConsumer, broken);
});
reject("FM profile binding shadow", () => {
  let broken = replaceOnce(
    fmSource,
    "const keys = Object.keys(profile.faders);",
    "{ const profile = { faders: {} };\n    const keys = Object.keys(profile.faders);",
    "FM profile shadow open"
  );
  broken = replaceRegexOnce(
    broken,
    /(scheduleProfileApply\(seq, \(\) => triggerHazamaFmAcidCue\("genre\.techno", 0\.64\), keys\.length \* 35 \+ 90\);\r?\n\s*}\r?\n)(\s*})/,
    "$1    }\n$2",
    "FM profile shadow close"
  );
  validateConsumerSource(fmConsumer, broken);
});
reject("eval dynamic code", () => validateConsumerSource(
  engineConsumer,
  engineSource + '\neval(\'document.getElementById("rogue-seam")\');\n'
));
reject("Function dynamic code", () => validateConsumerSource(
  fmConsumer,
  fmSource + '\nFunction(\'return document.getElementById("rogue-seam")\')();\n'
));
reject("computed eval dynamic code", () => validateConsumerSource(
  engineConsumer,
  engineSource + '\nwindow["ev" + "al"](\'document.getElementById("rogue-seam")\');\n'
));
reject("string timeout dynamic code", () => validateConsumerSource(
  engineConsumer,
  engineSource + '\nsetTimeout(\'document.getElementById("rogue-seam")\', 0);\n'
));
reject("string interval dynamic code", () => validateConsumerSource(
  engineConsumer,
  engineSource + '\nsetInterval(\'document.getElementById("rogue-seam")\', 1000);\n'
));
reject("aliased string timer dynamic code", () => validateConsumerSource(
  engineConsumer,
  engineSource + '\nconst delayedDomCode = \'document.getElementById("rogue-seam")\'; setTimeout(delayedDomCode, 0);\n'
));
reject("comma string timer dynamic code", () => validateConsumerSource(
  engineConsumer,
  engineSource + '\nsetTimeout((0, \'document.getElementById("rogue-seam")\'), 0);\n'
));
reject("conditional string timer dynamic code", () => validateConsumerSource(
  engineConsumer,
  engineSource + '\nsetTimeout(true ? \'document.getElementById("rogue-seam")\' : (() => {}), 0);\n'
));
reject("constructor dynamic code", () => validateConsumerSource(
  engineConsumer,
  engineSource + '\n(() => {}).constructor(\'document.getElementById("rogue-seam")\')();\n'
));
reject("computed constructor dynamic code", () => validateConsumerSource(
  engineConsumer,
  engineSource + '\n(() => {})["con" + "structor"](\'document.getElementById("rogue-seam")\')();\n'
));
reject("regex division lookup hiding", () => validateConsumerSource(
  engineConsumer,
  engineSource + '\nlet divisionSeed = 1; const hiddenByDivision = divisionSeed++ / document.getElementById("rogue-seam").value / 2;\n'
));
reject("unicode escaped DOM identifier", () => validateConsumerSource(
  engineConsumer,
  engineSource + '\ndocum\\u0065nt.getElementBy\\u0049d("rogue-seam");\n'
));
reject("optional computed document access", () => validateConsumerSource(
  engineConsumer,
  engineSource + '\ndocument?.["get" + "ElementById"]("rogue-seam");\n'
));
reject("body member compensation", () => {
  const broken = replaceOnce(
    engineSource,
    'if (document.body?.dataset?.page === "fm") return;',
    "if (false) return;",
    "body predicate removal"
  );
  validateConsumerSource(
    engineConsumer,
    broken + '\nfalse && fake.document.body?.dataset?.page === "fm";\n'
  );
});
reject("manifest canonical fader mapping", () => {
  const drift = cloneJson(manifest);
  const engine = drift.consumers.find((entry) => entry.name === "engine");
  const origin = engine.extraction.fader_origins.find((entry) => entry.binding === "SLIDER_BY_UCM");
  origin.mapping.wave_drift = origin.mapping.wave;
  delete origin.mapping.wave;
  manifestMaps(drift);
});
reject("manifest duplicate dynamic evidence", () => {
  const drift = cloneJson(manifest);
  const engine = drift.consumers.find((entry) => entry.name === "engine");
  engine.extraction.get_element_by_id.dynamic_arguments.push(
    cloneJson(engine.extraction.get_element_by_id.dynamic_arguments.at(-1))
  );
  manifestMaps(drift);
});
reject("manifest duplicate helper evidence", () => {
  const drift = cloneJson(manifest);
  const engine = drift.consumers.find((entry) => entry.name === "engine");
  engine.extraction.literal_helper_calls.push(cloneJson(engine.extraction.literal_helper_calls[0]));
  manifestMaps(drift);
});
reject("manifest duplicate fader origin", () => {
  const drift = cloneJson(manifest);
  const engine = drift.consumers.find((entry) => entry.name === "engine");
  engine.extraction.fader_origins[3] = cloneJson(engine.extraction.fader_origins[0]);
  manifestMaps(drift);
});
reject("manifest checked default omission", () => {
  const drift = cloneJson(manifest);
  const fm = drift.hosts.find((entry) => entry.name === "fm");
  delete fm.required.find((entry) => entry.id === "auto_toggle").attributes.checked;
  manifestMaps(drift);
});
reject("manifest selected group omission", () => {
  const drift = cloneJson(manifest);
  const fm = drift.hosts.find((entry) => entry.name === "fm");
  delete fm.structures.attribute_groups.find((entry) => entry.attribute === "data-energy").selected_value;
  manifestMaps(drift);
});
reject("manifest shim attribute omission", () => {
  const drift = cloneJson(manifest);
  const fm = drift.hosts.find((entry) => entry.name === "fm");
  delete fm.structures.containers.find((entry) => entry.id === "fm-engine-shim").attributes.hidden;
  manifestMaps(drift);
});
reject("FM member class shadow", () => validateConsumerSource(
  fmConsumer,
  replaceRegexOnce(
    fmSource,
    /(group\.querySelectorAll\("button\[data-genre\]"\)\.forEach\(\(b\) => \{\s*b\.setAttribute\("aria-pressed", b\.dataset\.genre === name \? "true" : "false"\);\s*\}\);)/,
    "{ class group { static querySelectorAll() { return []; } } $1 }",
    "FM member class shadow"
  )
));
reject("FM profile class shadow", () => {
  let broken = replaceOnce(
    fmSource,
    "const keys = Object.keys(profile.faders);",
    "{ class profile {};\n    const keys = Object.keys(profile.faders);",
    "FM profile class shadow open"
  );
  broken = replaceRegexOnce(
    broken,
    /(scheduleProfileApply\(seq, \(\) => triggerHazamaFmAcidCue\("genre\.techno", 0\.64\), keys\.length \* 35 \+ 90\);\r?\n\s*}\r?\n)(\s*})/,
    "$1    }\n$2",
    "FM profile class shadow close"
  );
  validateConsumerSource(fmConsumer, broken);
});

assert.deepEqual(
  sorted(exercisedNegativeLabels),
  sorted(Object.keys(NEGATIVE_ERROR_PATTERNS)),
  "negative fixture suite must exercise every declared rejection seam exactly once"
);
const declaredNegativeLabels = sorted(Object.keys(NEGATIVE_ERROR_PATTERNS));
assert.equal(negativeCount, EXPECTED_NEGATIVE_FIXTURE_COUNT, "negative fixture count drift");
assert.equal(
  createHash("sha256").update(declaredNegativeLabels.join("\n")).digest("hex"),
  EXPECTED_NEGATIVE_LABELS_SHA256,
  "negative fixture label catalog drift"
);

console.log(
  "music-host-dom-contract: PASS (" +
  hosts.size + " hosts, " +
  consumers.size + " consumers, " +
  negativeCount + " negative fixtures)"
);
