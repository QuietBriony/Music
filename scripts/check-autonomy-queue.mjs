import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BACKLOG_PATH = "docs/autonomy/BACKLOG.md";
const LEDGER_PATH = "docs/autonomy/SESSION-LEDGER.md";
const read = (path) => readFileSync(resolve(ROOT, path), "utf8");

const ACTIVE_PRIORITIES = new Map([
  ["P0", "P0"],
  ["P1", "P1"],
  ["P2", "P2"],
  ["Icebox", "icebox"]
]);
const REQUIRED_QUEUE_SECTIONS = ["P1", "P2", "Icebox", "Done"];
const QUEUE_SECTION_ORDER = ["P0", ...REQUIRED_QUEUE_SECTIONS];
const REQUIRED_ACTIVE_FIELDS = [
  "priority",
  "repo",
  "scope",
  "agent",
  "human-gate",
  "source",
  "detail"
];
const OPTIONAL_ACTIVE_FIELDS = ["status"];
const CANONICAL_REPOS = ["Music", "chill", "drum-floor", "namima", "openclaw", "stack"];
const CANONICAL_SCOPES = ["docs", "non-engine-code", "runtime", "engine", "cross-repo", "verify"];
const CANONICAL_AGENTS = ["codex", "claude", "either", "human"];
const ACTIVE_FIELD_ORDER = [
  "priority",
  "repo",
  "scope",
  "agent",
  "human-gate",
  "status",
  "source",
  "detail"
];
const LATEST_LEDGER_FIELDS = [
  "agent",
  "goal",
  "repos",
  "implemented",
  "shipped",
  "stack-check",
  "backlog",
  "next",
  "blockers"
];

class FixtureSetupError extends Error {}

function calendarDate(value, label) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  assert.ok(match, `${label} must use YYYY-MM-DD`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  assert.ok(
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day,
    `${label} must be a valid calendar date`
  );
  return value;
}

function splitTopLevel(value, separators) {
  const parts = [];
  let start = 0;
  let asciiDepth = 0;
  let fullwidthDepth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === "(") asciiDepth += 1;
    else if (character === ")" && asciiDepth > 0) asciiDepth -= 1;
    else if (character === "（") fullwidthDepth += 1;
    else if (character === "）" && fullwidthDepth > 0) fullwidthDepth -= 1;
    else if (asciiDepth === 0 && fullwidthDepth === 0 && separators.has(character)) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

function visibleMarkdownLines(text, label) {
  assert.equal(typeof text, "string", `${label} must be text`);
  assert.equal(text.includes("\0"), false, `${label} must not contain NUL`);
  const sourceLines = text.replace(/\r\n?/g, "\n").split("\n");
  const visible = [];
  let fence = null;
  let inComment = false;
  let inPre = false;

  for (let index = 0; index < sourceLines.length; index += 1) {
    const raw = sourceLines[index];

    if (fence) {
      const close = raw.match(/^ {0,3}(`{3,}|~{3,})[\t ]*$/);
      if (close && close[1][0] === fence.character && close[1].length >= fence.length) fence = null;
      continue;
    }
    if (inPre) {
      if (/<\/pre\s*>/i.test(raw)) inPre = false;
      continue;
    }

    let cursor = 0;
    let line = "";
    while (cursor < raw.length) {
      if (inComment) {
        const end = raw.indexOf("-->", cursor);
        if (end < 0) {
          cursor = raw.length;
          continue;
        }
        inComment = false;
        cursor = end + 3;
        continue;
      }
      const start = raw.indexOf("<!--", cursor);
      if (start < 0) {
        line += raw.slice(cursor);
        break;
      }
      line += raw.slice(cursor, start);
      inComment = true;
      cursor = start + 4;
    }

    const openingFence = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    const invalidBacktickInfo = openingFence?.[1][0] === "`" && openingFence[2].includes("`");
    if (openingFence && !invalidBacktickInfo) {
      fence = { character: openingFence[1][0], length: openingFence[1].length };
      continue;
    }
    if (/^ {0,3}<pre(?:[\t >]|$)/i.test(line)) {
      if (!/<\/pre\s*>/i.test(line)) inPre = true;
      continue;
    }
    if (/^(?: {4}|\t)/.test(line) || /^ {0,3}>/.test(line)) continue;
    visible.push({ line: index + 1, text: line });
  }

  assert.equal(fence, null, `${label} has unterminated fenced code`);
  assert.equal(inComment, false, `${label} has unterminated HTML comment`);
  assert.equal(inPre, false, `${label} has unterminated <pre> block`);
  return visible;
}

function headingParts(text) {
  const match = text.match(/^ {0,3}(#{1,6})(?:[\t ]+|$)(.*)$/);
  return match ? { level: match[1].length, body: match[2].trimEnd() } : null;
}

function parseTopLevelFields(lines, label, allowedFields = null) {
  const fields = new Map();
  const order = [];
  let current = null;

  for (const entry of lines) {
    const match = entry.text.match(/^- ([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (match) {
      const key = match[1];
      if (allowedFields) assert.ok(allowedFields.has(key), `${label} has unknown field ${key}`);
      assert.equal(fields.has(key), false, `${label} has duplicate field ${key}`);
      fields.set(key, { line: entry.line, parts: [match[2].trim()] });
      order.push(key);
      current = key;
    } else if (current && /^ {2,3}\S/.test(entry.text)) {
      const continuation = entry.text.trim();
      if (continuation) fields.get(current).parts.push(continuation);
    }
  }

  const values = new Map(
    [...fields].map(([key, value]) => [key, value.parts.filter(Boolean).join(" ").trim()])
  );
  return { fields, order, values };
}

function assertNoShadowFieldBullets(lines, label) {
  for (const entry of lines) {
    const fieldLike = /^ {0,3}[-+*]\s+[A-Za-z][A-Za-z0-9_-]*\s*:/.test(entry.text);
    const canonical = /^- [A-Za-z][A-Za-z0-9_-]*\s*:/.test(entry.text);
    if (fieldLike && !canonical) assert.fail(`${label} has a noncanonical field-like bullet at line ${entry.line}`);
  }
}

function parseBacklog(text) {
  const lines = visibleMarkdownLines(text, BACKLOG_PATH);
  const sections = [];
  const items = [];
  let currentSection = null;
  let currentItem = null;

  const finishItem = (end) => {
    if (!currentItem) return;
    currentItem.body = lines.slice(currentItem.start + 1, end);
    delete currentItem.start;
    currentItem = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const entry = lines[index];
    const heading = headingParts(entry.text);
    if (!heading) {
      const compact = entry.text.match(/^ {0,3}(#{1,6})([^#\s].*)$/);
      const compactBlLike = compact && /^[Bb][Ll](?:$|[^A-Za-z])/.test(compact[2]);
      if (compactBlLike) {
        assert.equal(compact[1].length, 3, `BL item headings must use level 3 (line ${entry.line})`);
        assert.fail(`BL item heading syntax drift at line ${entry.line}`);
      }
      if (currentSection && compact?.[1].length === 3) {
        assert.fail(`queue level-3 heading syntax drift at line ${entry.line}`);
      }
      if (currentSection && !currentItem && entry.text !== "---" && /^-\s/.test(entry.text)) {
        assert.fail(`orphan queue bullet outside an item at line ${entry.line}`);
      }
      continue;
    }

    const blLike = /^[Bb][Ll](?:$|[^A-Za-z])/.test(heading.body);
    if (blLike) assert.equal(heading.level, 3, `BL item headings must use level 3 (line ${entry.line})`);
    if (heading.level <= 3) finishItem(index);

    if (heading.level === 1) currentSection = null;
    if (heading.level === 2) {
      if (QUEUE_SECTION_ORDER.includes(heading.body)) {
        assert.equal(entry.text, `## ${heading.body}`, `queue section ${heading.body} must use a column-zero canonical heading`);
        currentSection = heading.body;
        sections.push({ name: heading.body, line: entry.line });
      } else {
        currentSection = null;
      }
      continue;
    }

    if (heading.level !== 3) continue;
    if (!currentSection && !blLike) continue;
    assert.ok(currentSection, `BL item at line ${entry.line} must belong to an active or Done section`);
    assert.equal(entry.text.startsWith("### "), true, `BL item heading at line ${entry.line} must be column-zero canonical`);

    let match;
    let doneDate = null;
    if (currentSection === "Done") {
      match = entry.text.match(/^### (BL-[0-9]{3}) — (.+?) ✅ (\d{4}-\d{2}-\d{2})(?: \([^()\r\n]+\))?$/);
      assert.ok(match && match[2].trim(), `Done BL item heading drift at line ${entry.line}`);
      doneDate = calendarDate(match[3], `${match[1]} Done date`);
    } else {
      match = entry.text.match(/^### (BL-[0-9]{3}) — (.+)$/);
      assert.ok(match && match[2].trim(), `active BL item heading drift at line ${entry.line}`);
      assert.equal(match[2].includes("✅"), false, `${match[1]} active heading must not carry a completion mark`);
    }
    assert.notEqual(match[1], "BL-000", "BL-000 is reserved for the schema example");
    currentItem = {
      id: match[1],
      title: match[2].trim(),
      section: currentSection,
      line: entry.line,
      doneDate,
      start: index,
      body: []
    };
    items.push(currentItem);
  }
  finishItem(lines.length);

  for (const section of QUEUE_SECTION_ORDER) {
    const count = sections.filter((entry) => entry.name === section).length;
    if (section === "P0") assert.ok(count <= 1, "queue section P0 must appear at most once");
    else assert.equal(count, 1, `queue section ${section} must appear once`);
  }
  let previousRank = -1;
  for (const section of sections) {
    const rank = QUEUE_SECTION_ORDER.indexOf(section.name);
    assert.ok(rank > previousRank, `queue section order drift at ${section.name}`);
    previousRank = rank;
  }

  const byId = new Map();
  for (const item of items) {
    assert.equal(byId.has(item.id), false, `duplicate backlog ID ${item.id}`);
    byId.set(item.id, item);
  }
  assert.ok(items.length > 0, "backlog must contain items");

  const allowedActive = new Set([...REQUIRED_ACTIVE_FIELDS, ...OPTIONAL_ACTIVE_FIELDS]);
  for (const item of items) {
    if (item.section === "Done") {
      const bullets = item.body.filter(
        (entry) => /^- \S/.test(entry.text) && !/^ {0,3}[-+*]\s+status\s*:/i.test(entry.text)
      );
      assert.ok(bullets.length > 0, `${item.id} Done item must contain a nonblank outcome bullet`);
      for (const entry of item.body) {
        const status = entry.text.match(/^ {0,3}[-+*]\s+status\s*:\s*(.*)$/i);
        if (status) {
          assert.equal(/^(?:open|wip)/i.test(status[1].trim()), false, `${item.id} Done item retains an open/wip status`);
        }
      }
      continue;
    }

    const label = `${item.id} active item`;
    const parsed = parseTopLevelFields(item.body, label, allowedActive);
    assertNoShadowFieldBullets(item.body, label);
    for (const field of REQUIRED_ACTIVE_FIELDS) {
      assert.ok(parsed.fields.has(field), `${label} is missing required field ${field}`);
    }
    for (const [field, value] of parsed.values) {
      assert.ok(value, `${label} field ${field} must not be empty`);
    }
    const expectedOrder = ACTIVE_FIELD_ORDER.filter((field) => field !== "status" || parsed.fields.has("status"));
    assert.deepEqual(parsed.order, expectedOrder, `${label} field order drift`);
    assert.equal(parsed.values.get("priority"), ACTIVE_PRIORITIES.get(item.section), `${label} priority must match section ${item.section}`);

    const repo = parsed.values.get("repo");
    const legacyNonCodeStack = /^\(\s*stack\s*\/\s*非コード\s*\)$/.test(repo);
    const canonicalRepo = CANONICAL_REPOS.some((name) => {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`^${escaped}(?:$|\\s*[（(].*[）)]$)`).test(repo);
    });
    assert.ok(legacyNonCodeStack || canonicalRepo, `${label} repo must use one canonical repo plus an optional annotation`);
    const scope = parsed.values.get("scope").replace(/`/g, "");
    const scopeSegments = splitTopLevel(scope, new Set(["/"]));
    for (const segment of scopeSegments) {
      if (!/^[A-Za-z]/.test(segment)) continue;
      assert.ok(
        CANONICAL_SCOPES.some((name) => {
          const token = name === "engine" ? "engine(?:\\.js|-code)?" : name.replace(/-/g, "\\-");
          return new RegExp(`^${token}(?:$|[\\s（(])`, "i").test(segment);
        }),
        `${label} scope must use canonical top-level segments`
      );
    }

    const gateMatch = parsed.values.get("human-gate").match(/^(yes|no)(?:$|\s*（.+）$|\s*\(.+\)$)/);
    assert.ok(gateMatch, `${label} human-gate must be exact yes/no with only an optional parenthetical note`);
    const humanGate = gateMatch[1];
    const status = parsed.values.get("status") || "open";
    assert.notEqual(status, "done", `${label} status done must move to Done`);
    assert.ok(status === "open" || /^wip — \S/.test(status), `${label} status must be open or wip — <detail>`);

    const agent = parsed.values.get("agent").toLowerCase();
    const actorTokens = new Set();
    for (const segment of splitTopLevel(agent, new Set(["|", "+", "→", "/"]))) {
      if (!/^[a-z]/.test(segment)) continue;
      const actor = segment.match(/^(codex|claude|either|human)(?=$|[^a-z])/i)?.[1].toLowerCase();
      assert.ok(actor && CANONICAL_AGENTS.includes(actor), `${label} agent must use canonical top-level actors`);
      actorTokens.add(actor);
    }
    assert.ok(actorTokens.size > 0, `${label} agent must name a canonical actor`);
    const hasHumanActor = actorTokens.has("human");
    if (hasHumanActor) assert.equal(humanGate, "yes", `${label} with a human actor requires human-gate yes`);
    const hasEngineScope = /(^|[^a-z0-9-])engine(?:\.js|-code)?(?=$|[^a-z0-9-])/i.test(scope);
    if (hasEngineScope) assert.equal(humanGate, "yes", `${label} with engine scope requires human-gate yes`);

    if (humanGate === "no" && status !== "open") {
      const claim = status.match(/^wip — ([a-z0-9-]+) (\d{4}-\d{2}-\d{2})$/i);
      assert.ok(claim, `${label} no-gate wip must be a canonical claim`);
      calendarDate(claim[2], `${item.id} claim date`);
      const claimant = claim[1].toLowerCase();
      assert.ok(claimant === "codex" || claimant === "claude", `${label} claimant must be codex or claude`);
      assert.ok(actorTokens.has("either") || actorTokens.has(claimant), `${label} claimant must be allowed by agent`);
    }
  }

  const active = items.filter((item) => item.section !== "Done");
  const done = items.filter((item) => item.section === "Done");
  return { active, done, byId };
}

function blReferences(value) {
  return [...value.matchAll(/\bBL-[0-9]{3}(?![0-9A-Za-z_])/g)].map((match) => match[0]);
}

function assertCanonicalBlReferences(value, label) {
  const canonical = blReferences(value);
  const blLike = [
    ...value.matchAll(/(?:[Bb][Ll]|ＢＬ)(?:[-_\/\s‐‑‒–—―－]+[0-9０-９]+|[0-9０-９]+)/g)
  ].map((match) => match[0]);
  assert.deepEqual(blLike, canonical, `${label} must use only canonical BL-NNN references`);
  return canonical;
}

function containsNoneSentinel(value) {
  return /(^|[^a-z])none(?=$|[^a-z])/i.test(value);
}

function parseLatestLedger(text, backlog) {
  const lines = visibleMarkdownLines(text, LEDGER_PATH);
  const formatIndex = lines.findIndex((entry) => entry.text === "## エントリ形式");
  assert.ok(formatIndex >= 0, "ledger must retain its entry format section");
  const dividerIndex = lines.findIndex((entry, index) => index > formatIndex && entry.text.trim());
  assert.ok(dividerIndex >= 0 && lines[dividerIndex].text === "---", "ledger is missing the intro separator before latest entry");
  const latestIndex = lines.findIndex((entry, index) => index > dividerIndex && entry.text.trim());
  assert.ok(latestIndex >= 0, "ledger latest entry is missing");
  const latestHeading = lines[latestIndex];
  const heading = latestHeading.text.match(
    /^## (\d{4}-\d{2}-\d{2})(?: \([^()\r\n]+\)| \[[^\[\]\r\n]+\])? — (.+)$/
  );
  assert.ok(heading && heading[2].trim(), `ledger latest entry heading drift at line ${latestHeading.line}`);
  calendarDate(heading[1], "ledger latest entry date");

  const history = [];
  for (let index = latestIndex; index < lines.length; index += 1) {
    const parts = headingParts(lines[index].text);
    if (parts?.level !== 2) continue;
    const match = lines[index].text.match(
      /^## (\d{4}-\d{2}-\d{2})(?: \([^()\r\n]+\)| \[[^\[\]\r\n]+\])? — (.+)$/
    );
    assert.ok(match && match[2].trim(), `ledger history entry heading drift at line ${lines[index].line}`);
    calendarDate(match[1], `ledger history date at line ${lines[index].line}`);
    history.push({ date: match[1], line: lines[index].line });
  }
  for (let index = 1; index < history.length; index += 1) {
    assert.ok(
      history[index].date <= history[index - 1].date,
      `ledger entries must be newest-first (line ${history[index].line})`
    );
  }

  let end = lines.length;
  for (let index = latestIndex + 1; index < lines.length; index += 1) {
    if (lines[index].text === "---" || headingParts(lines[index].text)?.level === 2) {
      end = index;
      break;
    }
  }
  const label = "ledger latest entry";
  const latestBody = lines.slice(latestIndex + 1, end);
  const parsed = parseTopLevelFields(latestBody, label, new Set(LATEST_LEDGER_FIELDS));
  assertNoShadowFieldBullets(latestBody, label);
  for (const field of ["agent", "goal", "repos", "stack-check", "backlog", "next", "blockers"]) {
    assert.ok(parsed.fields.has(field), `${label} is missing required field ${field}`);
    assert.ok(parsed.values.get(field), `${label} field ${field} must not be empty`);
  }
  const deliveryFields = ["implemented", "shipped"].filter((field) => parsed.fields.has(field));
  assert.equal(deliveryFields.length, 1, `${label} must contain exactly one of implemented or shipped`);
  assert.ok(parsed.values.get(deliveryFields[0]), `${label} field ${deliveryFields[0]} must not be empty`);
  assert.deepEqual(
    parsed.order,
    ["agent", "goal", "repos", deliveryFields[0], "stack-check", "backlog", "next", "blockers"],
    `${label} field order drift`
  );
  assert.match(
    parsed.values.get("stack-check"),
    /^PASS \d+ \/ FAIL 0 \/ SKIP 0(?:$|[（(])/,
    `${label} stack-check must be one canonical PASS / FAIL 0 / SKIP 0 summary`
  );

  const backlogValue = parsed.values.get("backlog");
  assert.equal(backlogValue !== "none" && containsNoneSentinel(backlogValue), false, `${label} backlog must not mix none with work references`);
  const completedRefs = assertCanonicalBlReferences(backlogValue, `${label} backlog`);
  assert.ok(backlogValue === "none" || completedRefs.length > 0, `${label} backlog must name a canonical BL ID or exact none`);
  for (const id of completedRefs) assert.ok(backlog.byId.has(id), `${label} backlog references unknown ${id}`);
  for (const match of backlogValue.matchAll(/\b(BL-[0-9]{3})\s+Done\b/g)) {
    assert.ok(backlog.done.some((item) => item.id === match[1]), `${label} marks active item ${match[1]} as Done`);
  }

  const next = parsed.values.get("next");
  if (next === "none") return { date: heading[1], next: null };
  assert.equal(containsNoneSentinel(next), false, `${label} next must not mix none with a BL reference`);
  const refs = assertCanonicalBlReferences(next, `${label} next`);
  assert.equal(refs.length, 1, `${label} next must contain exactly one canonical BL ID or exact none`);
  assert.match(next, new RegExp(`^${refs[0]}(?:$|[（(\\t ])`), `${label} next must start with its canonical BL ID`);
  assert.ok(backlog.active.some((item) => item.id === refs[0]), `${label} next must reference an active backlog item (${refs[0]})`);
  return { date: heading[1], next: refs[0] };
}

function validateQueue(backlogText, ledgerText) {
  const backlog = parseBacklog(backlogText);
  const ledger = parseLatestLedger(ledgerText, backlog);
  return { backlog, ledger };
}

function replaceOnce(text, search, replacement, label) {
  const index = text.indexOf(search);
  if (index < 0) throw new FixtureSetupError(`fixture anchor missing: ${label}`);
  if (text.indexOf(search, index + search.length) >= 0) throw new FixtureSetupError(`fixture anchor is not unique: ${label}`);
  return text.slice(0, index) + replacement + text.slice(index + search.length);
}

function mutateItem(text, id, mutation, label) {
  const marker = `### ${id} `;
  const start = text.indexOf(marker);
  if (start < 0) throw new FixtureSetupError(`fixture item missing: ${label}`);
  const candidates = [text.indexOf("\n### ", start + marker.length), text.indexOf("\n## ", start + marker.length)]
    .filter((index) => index >= 0);
  const end = candidates.length ? Math.min(...candidates) : text.length;
  const item = text.slice(start, end);
  const changed = mutation(item);
  if (changed === item) throw new FixtureSetupError(`fixture item did not change: ${label}`);
  return text.slice(0, start) + changed + text.slice(end);
}

function mutateItemField(text, id, field, replacement, label) {
  return mutateItem(text, id, (item) => {
    const lines = item.split("\n");
    const matches = [];
    for (let index = 0; index < lines.length; index += 1) {
      if (new RegExp(`^- ${field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`).test(lines[index])) matches.push(index);
    }
    if (matches.length !== 1) throw new FixtureSetupError(`fixture field count drift: ${label}`);
    if (replacement === null) lines.splice(matches[0], 1);
    else lines.splice(matches[0], 1, ...replacement.split("\n"));
    return lines.join("\n");
  }, label);
}

function mutateLatest(text, mutation, label) {
  const divider = text.indexOf("\n---\n");
  if (divider < 0) throw new FixtureSetupError(`fixture ledger divider missing: ${label}`);
  const start = divider + "\n---\n".length;
  const nextDivider = text.indexOf("\n---\n", start);
  const end = nextDivider >= 0 ? nextDivider : text.length;
  const latest = text.slice(start, end);
  const changed = mutation(latest);
  if (changed === latest) throw new FixtureSetupError(`fixture latest entry did not change: ${label}`);
  return text.slice(0, start) + changed + text.slice(end);
}

function mutateLatestField(text, field, replacement, label) {
  return mutateLatest(text, (latest) => {
    const lines = latest.split("\n");
    const matches = [];
    for (let index = 0; index < lines.length; index += 1) {
      if (new RegExp(`^- ${field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`).test(lines[index])) matches.push(index);
    }
    if (matches.length !== 1) throw new FixtureSetupError(`fixture latest field count drift: ${label}`);
    if (replacement === null) lines.splice(matches[0], 1);
    else lines.splice(matches[0], 1, ...replacement.split("\n"));
    return lines.join("\n");
  }, label);
}

function expectReject(label, expectedPattern, fn) {
  let rejection = null;
  try {
    fn();
  } catch (error) {
    rejection = error;
  }
  assert.ok(rejection, `negative fixture unexpectedly passed: ${label}`);
  assert.ok(!(rejection instanceof FixtureSetupError), `negative fixture setup failed: ${label}: ${rejection.message}`);
  assert.equal(rejection.code, "ERR_ASSERTION", `negative fixture threw a non-contract error: ${label}`);
  assert.match(String(rejection.message), expectedPattern, `negative fixture rejected at the wrong seam: ${label}`);
}

const SYNTHETIC_BACKLOG = [
  "# Backlog — fixture",
  "",
  "## P1",
  "",
  "### BL-001 — Human review",
  "- priority : P1",
  "- repo     : Music",
  "- scope    : verify",
  "- agent    : human",
  "- human-gate: yes（review）",
  "- source   : fixture",
  "- detail   : human-only work",
  "",
  "## P2",
  "",
  "### BL-002 — Agent task",
  "- priority : P2",
  "- repo     : Music",
  "- scope    : docs / verify",
  "- agent    : codex | claude",
  "- human-gate: no",
  "- status   : wip — codex 2026-08-02",
  "- source   : fixture",
  "- detail   : agent-safe work",
  "",
  "## Icebox",
  "",
  "### BL-003 — Parked task",
  "- priority : icebox",
  "- repo     : stack",
  "- scope    : docs",
  "- agent    : either",
  "- human-gate: yes",
  "- source   : fixture",
  "- detail   : later",
  "",
  "## Done",
  "",
  "### BL-004 — Completed work ✅ 2026-08-01",
  "- outcome: shipped fixture"
].join("\n");

const SYNTHETIC_LEDGER = [
  "# Session Ledger — fixture",
  "",
  "## エントリ形式",
  "",
  "~~~",
  "## 2099-01-01 — fenced fake",
  "- next: BL-999",
  "~~~",
  "",
  "---",
  "",
  "## 2026-08-02 — Synthetic latest",
  "- agent      : Codex",
  "- goal       : validate queue",
  "- repos      : Music",
  "- implemented:",
  "  - synthetic output",
  "- stack-check: PASS 1 / FAIL 0 / SKIP 0",
  "- backlog    : BL-004 Done",
  "- next       : BL-002（agent task）",
  "- blockers   : none",
  "",
  "---",
  "",
  "## 2026-08-01 (cont.) — Older entry",
  "- agent: Codex"
].join("\n");

const baseline = validateQueue(read(BACKLOG_PATH), read(LEDGER_PATH));

let positiveCount = 0;
const positive = (backlog, ledger) => {
  validateQueue(backlog, ledger);
  positiveCount += 1;
};
positive(SYNTHETIC_BACKLOG, SYNTHETIC_LEDGER);
positive(SYNTHETIC_BACKLOG.replace(/\n/g, "\r\n"), SYNTHETIC_LEDGER.replace(/\n/g, "\r\n"));
positive(
  mutateItemField(SYNTHETIC_BACKLOG, "BL-002", "status", "- status   : open", "positive explicit open"),
  mutateLatestField(SYNTHETIC_LEDGER, "next", "- next       : none", "positive none")
);
positive(
  replaceOnce(
    SYNTHETIC_BACKLOG,
    "## P1",
    [
      "## P0",
      "",
      "### BL-005 — Urgent task",
      "- priority : P0",
      "- repo     : Music",
      "- scope    : docs",
      "- agent    : either",
      "- human-gate: yes",
      "- source   : fixture",
      "- detail   : urgent",
      "",
      "## P1"
    ].join("\n"),
    "positive P0"
  ),
  SYNTHETIC_LEDGER
);
const HIDDEN_MARKDOWN = [
  "````",
  "```",
  "### BL-002 — fenced duplicate",
  "```",
  "````",
  "~~~",
  "### BL-002 — tilde duplicate",
  "~~~",
  "<!--",
  "### BL-002 — commented duplicate",
  "-->",
  "> ### BL-002 — quoted duplicate",
  "    ### BL-002 — indented duplicate",
  "<pre>",
  "### BL-002 — raw pre duplicate",
  "</pre>"
].join("\n");
positive(
  replaceOnce(SYNTHETIC_BACKLOG, "## P1", `${HIDDEN_MARKDOWN}\n\n## P1`, "positive hidden Markdown"),
  SYNTHETIC_LEDGER
);

const NEGATIVE_FIXTURES = [];
const negative = (label, expected, run) => NEGATIVE_FIXTURES.push({ label, expected, run });

negative("unterminated backtick fence", /unterminated fenced code/, () => validateQueue("```\n" + SYNTHETIC_BACKLOG, SYNTHETIC_LEDGER));
negative("unterminated HTML comment", /unterminated HTML comment/, () => validateQueue("<!--\n" + SYNTHETIC_BACKLOG, SYNTHETIC_LEDGER));
negative("unterminated pre block", /unterminated <pre> block/, () => validateQueue("<pre>\n" + SYNTHETIC_BACKLOG, SYNTHETIC_LEDGER));
negative("duplicate queue section", /queue section P2 must appear once/, () => validateQueue(replaceOnce(SYNTHETIC_BACKLOG, "## Icebox", "## P2\n\n## Icebox", "duplicate section"), SYNTHETIC_LEDGER));
negative("queue section order", /queue section order drift/, () => {
  let drift = replaceOnce(SYNTHETIC_BACKLOG, "## P1", "## TEMP", "section order P1 temp");
  drift = replaceOnce(drift, "## P2", "## P1", "section order P2 to P1");
  drift = replaceOnce(drift, "## TEMP", "## P2", "section order temp to P2");
  validateQueue(drift, SYNTHETIC_LEDGER);
});
negative("item outside queue section", /must belong to an active or Done section/, () => validateQueue(replaceOnce(SYNTHETIC_BACKLOG, "## P1", "## Notes\n\n### BL-005 — Lost task\n\n## P1", "outside section"), SYNTHETIC_LEDGER));
negative("wrong BL heading level", /BL item headings must use level 3/, () => validateQueue(replaceOnce(SYNTHETIC_BACKLOG, "### BL-002 — Agent task", "#### BL-002 — Agent task", "heading level"), SYNTHETIC_LEDGER));
negative("short BL ID", /active BL item heading drift/, () => validateQueue(replaceOnce(SYNTHETIC_BACKLOG, "### BL-002 — Agent task", "### BL-02 — Agent task", "short id"), SYNTHETIC_LEDGER));
negative("long BL ID", /active BL item heading drift/, () => validateQueue(replaceOnce(SYNTHETIC_BACKLOG, "### BL-002 — Agent task", "### BL-0020 — Agent task", "long id"), SYNTHETIC_LEDGER));
negative("lowercase BL ID", /active BL item heading drift/, () => validateQueue(replaceOnce(SYNTHETIC_BACKLOG, "### BL-002 — Agent task", "### bl-002 — Agent task", "lower id"), SYNTHETIC_LEDGER));
negative("nonbreaking BL hyphen", /active BL item heading drift/, () => validateQueue(replaceOnce(SYNTHETIC_BACKLOG, "### BL-002 — Agent task", "### BL‑002 — Agent task", "nonbreaking hyphen"), SYNTHETIC_LEDGER));
negative("fullwidth BL digits", /active BL item heading drift/, () => validateQueue(replaceOnce(SYNTHETIC_BACKLOG, "### BL-002 — Agent task", "### BL-００２ — Agent task", "fullwidth digits"), SYNTHETIC_LEDGER));
negative("reserved BL zero", /BL-000 is reserved/, () => validateQueue(replaceOnce(SYNTHETIC_BACKLOG, "### BL-002 — Agent task", "### BL-000 — Agent task", "reserved zero"), SYNTHETIC_LEDGER));
negative("empty active title", /active BL item heading drift/, () => validateQueue(replaceOnce(SYNTHETIC_BACKLOG, "### BL-002 — Agent task", "### BL-002 — ", "empty title"), SYNTHETIC_LEDGER));
negative("wrong title dash", /active BL item heading drift/, () => validateQueue(replaceOnce(SYNTHETIC_BACKLOG, "### BL-002 — Agent task", "### BL-002 – Agent task", "wrong dash"), SYNTHETIC_LEDGER));
negative("active completion mark", /active heading must not carry a completion mark/, () => validateQueue(replaceOnce(SYNTHETIC_BACKLOG, "### BL-002 — Agent task", "### BL-002 — Agent task ✅ 2026-08-02", "active check"), SYNTHETIC_LEDGER));
negative("duplicate active ID", /duplicate backlog ID BL-002/, () => validateQueue(replaceOnce(SYNTHETIC_BACKLOG, "### BL-003 — Parked task", "### BL-002 — Parked task", "duplicate active"), SYNTHETIC_LEDGER));
negative("duplicate active Done ID", /duplicate backlog ID BL-002/, () => validateQueue(replaceOnce(SYNTHETIC_BACKLOG, "### BL-004 — Completed work", "### BL-002 — Completed work", "duplicate active Done"), SYNTHETIC_LEDGER));
negative("duplicate Done ID", /duplicate backlog ID BL-004/, () => validateQueue(replaceOnce(SYNTHETIC_BACKLOG, "- outcome: shipped fixture", "- outcome: shipped fixture\n\n### BL-004 — Duplicate work ✅ 2026-08-01\n- outcome: duplicate", "duplicate Done"), SYNTHETIC_LEDGER));

for (const field of REQUIRED_ACTIVE_FIELDS) {
  negative(`active missing ${field}`, new RegExp(`missing required field ${field}`), () => validateQueue(mutateItemField(SYNTHETIC_BACKLOG, "BL-002", field, null, `missing ${field}`), SYNTHETIC_LEDGER));
}
negative("active empty field", /field source must not be empty/, () => validateQueue(mutateItemField(SYNTHETIC_BACKLOG, "BL-002", "source", "- source   :", "empty source"), SYNTHETIC_LEDGER));
negative("active duplicate field", /duplicate field agent/, () => validateQueue(mutateItemField(SYNTHETIC_BACKLOG, "BL-002", "agent", "- agent    : codex | claude\n- agent    : codex", "duplicate agent"), SYNTHETIC_LEDGER));
negative("active unknown field", /unknown field human_gate/, () => validateQueue(mutateItemField(SYNTHETIC_BACKLOG, "BL-002", "human-gate", "- human_gate: no", "unknown field"), SYNTHETIC_LEDGER));
negative("active field order", /field order drift/, () => validateQueue(mutateItem(SYNTHETIC_BACKLOG, "BL-002", (item) => item.replace("- scope    : docs / verify\n- agent    : codex | claude", "- agent    : codex | claude\n- scope    : docs / verify"), "field order"), SYNTHETIC_LEDGER));
negative("priority section mismatch", /priority must match section P2/, () => validateQueue(mutateItemField(SYNTHETIC_BACKLOG, "BL-002", "priority", "- priority : P1", "priority mismatch"), SYNTHETIC_LEDGER));
negative("human gate maybe", /human-gate must be exact yes\/no/, () => validateQueue(mutateItemField(SYNTHETIC_BACKLOG, "BL-002", "human-gate", "- human-gate: maybe", "gate maybe"), SYNTHETIC_LEDGER));
negative("human gate yesno", /human-gate must be exact yes\/no/, () => validateQueue(mutateItemField(SYNTHETIC_BACKLOG, "BL-002", "human-gate", "- human-gate: yesno", "gate yesno"), SYNTHETIC_LEDGER));
negative("active done status", /status done must move to Done/, () => validateQueue(mutateItemField(SYNTHETIC_BACKLOG, "BL-002", "status", "- status   : done", "active done"), SYNTHETIC_LEDGER));
negative("active malformed wip status", /status must be open or wip/, () => validateQueue(mutateItemField(SYNTHETIC_BACKLOG, "BL-002", "status", "- status   : wipdone", "wipdone"), SYNTHETIC_LEDGER));
negative("human actor without gate", /human actor requires human-gate yes/, () => validateQueue(mutateItemField(SYNTHETIC_BACKLOG, "BL-002", "agent", "- agent    : human", "human no gate"), SYNTHETIC_LEDGER));
negative("engine scope without gate", /engine scope requires human-gate yes/, () => validateQueue(mutateItemField(SYNTHETIC_BACKLOG, "BL-002", "scope", "- scope    : docs / engine", "engine no gate"), SYNTHETIC_LEDGER));
negative("no-gate informal wip", /no-gate wip must be a canonical claim/, () => validateQueue(mutateItemField(SYNTHETIC_BACKLOG, "BL-002", "status", "- status   : wip — implementation underway", "informal claim"), SYNTHETIC_LEDGER));
negative("no-gate invalid claim date", /claim date must be a valid calendar date/, () => validateQueue(mutateItemField(SYNTHETIC_BACKLOG, "BL-002", "status", "- status   : wip — codex 2026-02-30", "invalid claim date"), SYNTHETIC_LEDGER));
negative("no-gate unauthorized claimant", /claimant must be codex or claude/, () => validateQueue(mutateItemField(SYNTHETIC_BACKLOG, "BL-002", "status", "- status   : wip — human 2026-08-02", "unauthorized claimant"), SYNTHETIC_LEDGER));
negative("Done missing completion mark", /Done BL item heading drift/, () => validateQueue(replaceOnce(SYNTHETIC_BACKLOG, "### BL-004 — Completed work ✅ 2026-08-01", "### BL-004 — Completed work 2026-08-01", "Done check"), SYNTHETIC_LEDGER));
negative("Done invalid calendar date", /Done date must be a valid calendar date/, () => validateQueue(replaceOnce(SYNTHETIC_BACKLOG, "✅ 2026-08-01", "✅ 2026-02-30", "Done date"), SYNTHETIC_LEDGER));
negative("Done missing outcome bullet", /Done item must contain a nonblank outcome bullet/, () => validateQueue(mutateItem(SYNTHETIC_BACKLOG, "BL-004", (item) => item.replace("- outcome: shipped fixture", "shipped fixture"), "Done bullet"), SYNTHETIC_LEDGER));
negative("Done retains wip", /Done item retains an open\/wip status/, () => validateQueue(mutateItem(SYNTHETIC_BACKLOG, "BL-004", (item) => item + "\n- status: wip — codex 2026-08-02", "Done wip"), SYNTHETIC_LEDGER));

negative("ledger intro separator missing", /missing the intro separator/, () => validateQueue(
  SYNTHETIC_BACKLOG,
  replaceOnce(SYNTHETIC_LEDGER, "~~~\n\n---\n\n## 2026-08-02", "~~~\n\n## 2026-08-02", "ledger separator")
));
negative("ledger latest heading malformed", /latest entry heading drift/, () => validateQueue(SYNTHETIC_BACKLOG, mutateLatest(SYNTHETIC_LEDGER, (latest) => latest.replace("## 2026-08-02 — Synthetic latest", "## latest — broken"), "latest heading")));
negative("ledger latest invalid date", /latest entry date must be a valid calendar date/, () => validateQueue(SYNTHETIC_BACKLOG, mutateLatest(SYNTHETIC_LEDGER, (latest) => latest.replace("2026-08-02", "2026-02-30"), "latest date")));
negative("ledger missing next", /missing required field next/, () => validateQueue(SYNTHETIC_BACKLOG, mutateLatestField(SYNTHETIC_LEDGER, "next", null, "missing next")));
negative("ledger empty next", /field next must not be empty/, () => validateQueue(SYNTHETIC_BACKLOG, mutateLatestField(SYNTHETIC_LEDGER, "next", "- next       :", "empty next")));
negative("ledger duplicate next", /duplicate field next/, () => validateQueue(SYNTHETIC_BACKLOG, mutateLatestField(SYNTHETIC_LEDGER, "next", "- next       : BL-002\n- next       : BL-003", "duplicate next")));
negative("ledger nested next", /noncanonical field-like bullet/, () => validateQueue(SYNTHETIC_BACKLOG, mutateLatestField(SYNTHETIC_LEDGER, "next", "  - next     : BL-002", "nested next")));
negative("ledger missing delivery field", /exactly one of implemented or shipped/, () => validateQueue(SYNTHETIC_BACKLOG, mutateLatestField(SYNTHETIC_LEDGER, "implemented", null, "missing delivery")));
negative("ledger both delivery fields", /exactly one of implemented or shipped/, () => validateQueue(SYNTHETIC_BACKLOG, mutateLatestField(SYNTHETIC_LEDGER, "implemented", "- implemented:\n  - synthetic output\n- shipped    : duplicate delivery", "both delivery")));
negative("ledger empty delivery field", /field implemented must not be empty/, () => validateQueue(SYNTHETIC_BACKLOG, mutateLatest(SYNTHETIC_LEDGER, (latest) => latest.replace("  - synthetic output\n", ""), "empty delivery")));
negative("ledger unknown field", /unknown field result/, () => validateQueue(SYNTHETIC_BACKLOG, mutateLatestField(SYNTHETIC_LEDGER, "stack-check", "- result     : PASS", "unknown latest field")));
negative("ledger field order", /field order drift/, () => validateQueue(SYNTHETIC_BACKLOG, mutateLatest(SYNTHETIC_LEDGER, (latest) => latest.replace("- agent      : Codex\n- goal       : validate queue", "- goal       : validate queue\n- agent      : Codex"), "ledger field order")));
negative("ledger duplicate agent", /duplicate field agent/, () => validateQueue(SYNTHETIC_BACKLOG, mutateLatestField(SYNTHETIC_LEDGER, "agent", "- agent      : Codex\n- agent      : Claude", "duplicate latest agent")));
negative("ledger backlog unknown ID", /backlog references unknown BL-999/, () => validateQueue(SYNTHETIC_BACKLOG, mutateLatestField(SYNTHETIC_LEDGER, "backlog", "- backlog    : BL-999 Done", "unknown backlog")));
negative("ledger next unknown ID", /next must reference an active backlog item \(BL-999\)/, () => validateQueue(SYNTHETIC_BACKLOG, mutateLatestField(SYNTHETIC_LEDGER, "next", "- next       : BL-999", "unknown next")));
negative("ledger next Done ID", /next must reference an active backlog item \(BL-004\)/, () => validateQueue(SYNTHETIC_BACKLOG, mutateLatestField(SYNTHETIC_LEDGER, "next", "- next       : BL-004", "Done next")));
negative("ledger next multiple IDs", /next must contain exactly one canonical BL ID/, () => validateQueue(SYNTHETIC_BACKLOG, mutateLatestField(SYNTHETIC_LEDGER, "next", "- next       : BL-002 / BL-003", "multiple next")));
negative("ledger next repeated ID", /next must contain exactly one canonical BL ID/, () => validateQueue(SYNTHETIC_BACKLOG, mutateLatestField(SYNTHETIC_LEDGER, "next", "- next       : BL-002 then BL-002", "repeated next")));
negative("ledger next none-ish", /next must not mix none with a BL reference/, () => validateQueue(SYNTHETIC_BACKLOG, mutateLatestField(SYNTHETIC_LEDGER, "next", "- next       : none-ish", "none-ish")));
negative("ledger next none plus ID", /next must not mix none with a BL reference/, () => validateQueue(SYNTHETIC_BACKLOG, mutateLatestField(SYNTHETIC_LEDGER, "next", "- next       : none（BL-002）", "none plus ID")));
negative("ledger next long ID", /must use only canonical BL-NNN references/, () => validateQueue(SYNTHETIC_BACKLOG, mutateLatestField(SYNTHETIC_LEDGER, "next", "- next       : BL-0020", "long next ID")));
negative("ledger next lowercase ID", /must use only canonical BL-NNN references/, () => validateQueue(SYNTHETIC_BACKLOG, mutateLatestField(SYNTHETIC_LEDGER, "next", "- next       : bl-002", "lower next ID")));
negative("ledger target moved to Done", /next must reference an active backlog item \(BL-002\)/, () => {
  let drift = mutateItem(SYNTHETIC_BACKLOG, "BL-002", () => "", "remove active target");
  drift = replaceOnce(drift, "## Done", "## Done\n\n### BL-002 — Agent task moved ✅ 2026-08-02\n- outcome: moved", "move target Done");
  validateQueue(drift, SYNTHETIC_LEDGER);
});
negative("invalid backtick fence info", /duplicate backlog ID BL-002/, () => validateQueue(
  replaceOnce(
    SYNTHETIC_BACKLOG,
    "## P2\n\n### BL-002",
    "## P2\n\n```bad`info\n### BL-002 — Visible duplicate\n```bad`info\n\n### BL-002",
    "invalid fence info"
  ),
  SYNTHETIC_LEDGER
));
negative("generic queue H3", /active BL item heading drift/, () => validateQueue(
  replaceOnce(SYNTHETIC_BACKLOG, "### BL-002 — Agent task", "### Task 002", "generic H3"),
  SYNTHETIC_LEDGER
));
negative("underscore BL heading", /active BL item heading drift/, () => validateQueue(
  replaceOnce(SYNTHETIC_BACKLOG, "### BL-002 — Agent task", "### BL_002 — Agent task", "underscore heading"),
  SYNTHETIC_LEDGER
));
negative("compact BL heading", /BL item heading syntax drift/, () => validateQueue(
  replaceOnce(SYNTHETIC_BACKLOG, "### BL-002 — Agent task", "###BL-002 — Agent task", "compact heading"),
  SYNTHETIC_LEDGER
));
negative("level two BL heading", /BL item headings must use level 3/, () => validateQueue(
  replaceOnce(SYNTHETIC_BACKLOG, "### BL-002 — Agent task", "## BL-002 — Agent task", "level two heading"),
  SYNTHETIC_LEDGER
));
negative("orphan active fields", /orphan queue bullet outside an item/, () => validateQueue(
  mutateItem(SYNTHETIC_BACKLOG, "BL-002", (item) => item.replace("### BL-002 — Agent task\n", ""), "orphan fields"),
  SYNTHETIC_LEDGER
));
negative("invalid repo", /repo must use one canonical repo/, () => validateQueue(
  mutateItemField(SYNTHETIC_BACKLOG, "BL-002", "repo", "- repo     : GitHub", "invalid repo"),
  SYNTHETIC_LEDGER
));
negative("invalid scope", /scope must use canonical top-level segments/, () => validateQueue(
  mutateItemField(SYNTHETIC_BACKLOG, "BL-002", "scope", "- scope    : moonshot", "invalid scope"),
  SYNTHETIC_LEDGER
));
negative("invalid agent", /agent must use canonical top-level actors/, () => validateQueue(
  mutateItemField(SYNTHETIC_BACKLOG, "BL-002", "agent", "- agent    : hacker", "invalid agent"),
  SYNTHETIC_LEDGER
));
negative("engine.js scope without gate", /engine scope requires human-gate yes/, () => validateQueue(
  mutateItemField(SYNTHETIC_BACKLOG, "BL-002", "scope", "- scope    : docs / engine.js", "engine.js no gate"),
  SYNTHETIC_LEDGER
));
negative("backticked engine.js scope without gate", /engine scope requires human-gate yes/, () => validateQueue(
  mutateItemField(SYNTHETIC_BACKLOG, "BL-002", "scope", "- scope    : docs / `engine.js`", "backticked engine.js"),
  SYNTHETIC_LEDGER
));
negative("annotated engine.js scope without gate", /engine scope requires human-gate yes/, () => validateQueue(
  mutateItemField(SYNTHETIC_BACKLOG, "BL-002", "scope", "- scope    : runtime (engine.js)", "annotated engine.js"),
  SYNTHETIC_LEDGER
));
negative("Windows engine.js scope without gate", /scope must use canonical top-level segments|engine scope requires human-gate yes/, () => validateQueue(
  mutateItemField(SYNTHETIC_BACKLOG, "BL-002", "scope", "- scope    : docs / Music\\engine.js", "Windows engine.js"),
  SYNTHETIC_LEDGER
));
negative("empty field with unindented filler", /field source must not be empty/, () => validateQueue(
  mutateItemField(SYNTHETIC_BACKLOG, "BL-002", "source", "- source   :\nnarrative filler", "empty source filler"),
  SYNTHETIC_LEDGER
));
negative("noncanonical top-level bullet", /noncanonical field-like bullet/, () => validateQueue(
  mutateItem(SYNTHETIC_BACKLOG, "BL-002", (item) => item + "\n-  owner: ghost", "noncanonical bullet"),
  SYNTHETIC_LEDGER
));
negative("either cannot authorize human claimant", /claimant must be codex or claude/, () => {
  let drift = mutateItemField(SYNTHETIC_BACKLOG, "BL-002", "agent", "- agent    : either", "either agent");
  drift = mutateItemField(drift, "BL-002", "status", "- status   : wip — human 2026-08-02", "either human claim");
  validateQueue(drift, SYNTHETIC_LEDGER);
});
negative("Done status is not an outcome", /Done item must contain a nonblank outcome bullet/, () => validateQueue(
  mutateItem(SYNTHETIC_BACKLOG, "BL-004", (item) => item.replace("- outcome: shipped fixture", "- status: done"), "Done status only"),
  SYNTHETIC_LEDGER
));
negative("Done retains wipdone", /Done item retains an open\/wip status/, () => validateQueue(
  mutateItem(SYNTHETIC_BACKLOG, "BL-004", (item) => item + "\n- status: wipdone", "Done wipdone"),
  SYNTHETIC_LEDGER
));
negative("Done retains spaced wip", /Done item retains an open\/wip status/, () => validateQueue(
  mutateItem(SYNTHETIC_BACKLOG, "BL-004", (item) => item + "\n-  status: wip — hidden", "Done spaced wip"),
  SYNTHETIC_LEDGER
));
negative("ledger historical invalid date", /ledger history date .* valid calendar date/, () => validateQueue(
  SYNTHETIC_BACKLOG,
  replaceOnce(SYNTHETIC_LEDGER, "2026-08-01 (cont.)", "2026-02-30 (cont.)", "historical invalid date")
));
negative("ledger history newest-first", /ledger entries must be newest-first/, () => validateQueue(
  SYNTHETIC_BACKLOG,
  replaceOnce(SYNTHETIC_LEDGER, "2026-08-01 (cont.)", "2026-08-03 (cont.)", "historical future date")
));
negative("ledger failing stack result", /stack-check must be one canonical PASS/, () => validateQueue(
  SYNTHETIC_BACKLOG,
  mutateLatestField(SYNTHETIC_LEDGER, "stack-check", "- stack-check: PASS 1 / FAIL 9 / SKIP 0", "failing stack")
));
negative("ledger marks active backlog Done", /marks active item BL-002 as Done/, () => validateQueue(
  SYNTHETIC_BACKLOG,
  mutateLatestField(SYNTHETIC_LEDGER, "backlog", "- backlog    : BL-002 Done", "active marked Done")
));
negative("ledger backlog mixes none", /backlog must not mix none with work references/, () => validateQueue(
  SYNTHETIC_BACKLOG,
  mutateLatestField(SYNTHETIC_LEDGER, "backlog", "- backlog    : none plus BL-004", "backlog none mix")
));
negative("ledger backlog malformed extra ID", /must use only canonical BL-NNN references/, () => validateQueue(
  SYNTHETIC_BACKLOG,
  mutateLatestField(SYNTHETIC_LEDGER, "backlog", "- backlog    : BL-004 Done plus BL-9999", "backlog malformed extra")
));
negative("ledger next malformed extra ID", /must use only canonical BL-NNN references/, () => validateQueue(
  SYNTHETIC_BACKLOG,
  mutateLatestField(SYNTHETIC_LEDGER, "next", "- next       : BL-002（also BL-9999）", "next malformed extra")
));
negative("ledger next lowercase extra ID", /must use only canonical BL-NNN references/, () => validateQueue(
  SYNTHETIC_BACKLOG,
  mutateLatestField(SYNTHETIC_LEDGER, "next", "- next       : BL-002（also bl-003）", "next lowercase extra")
));
negative("ledger next ID plus none", /next must not mix none with a BL reference/, () => validateQueue(
  SYNTHETIC_BACKLOG,
  mutateLatestField(SYNTHETIC_LEDGER, "next", "- next       : BL-002（none）", "next ID plus none")
));
negative("ledger empty next with filler", /field next must not be empty/, () => validateQueue(
  SYNTHETIC_BACKLOG,
  mutateLatestField(SYNTHETIC_LEDGER, "next", "- next       :\nnone", "empty next filler")
));
negative("active one-space filler", /field source must not be empty/, () => validateQueue(
  mutateItemField(SYNTHETIC_BACKLOG, "BL-002", "source", "- source   :\n narrative filler", "one-space source filler"),
  SYNTHETIC_LEDGER
));
negative("active one-space duplicate field", /noncanonical field-like bullet/, () => validateQueue(
  mutateItem(SYNTHETIC_BACKLOG, "BL-002", (item) => item + "\n - agent: human", "one-space active duplicate"),
  SYNTHETIC_LEDGER
));
negative("active star duplicate field", /noncanonical field-like bullet/, () => validateQueue(
  mutateItem(SYNTHETIC_BACKLOG, "BL-002", (item) => item + "\n* agent: human", "star active duplicate"),
  SYNTHETIC_LEDGER
));
negative("ledger one-space filler", /field next must not be empty/, () => validateQueue(
  SYNTHETIC_BACKLOG,
  mutateLatestField(SYNTHETIC_LEDGER, "next", "- next       :\n none", "one-space next filler")
));
negative("ledger one-space duplicate field", /noncanonical field-like bullet/, () => validateQueue(
  SYNTHETIC_BACKLOG,
  mutateLatest(SYNTHETIC_LEDGER, (latest) => latest + "\n - next: BL-003", "one-space latest duplicate")
));
negative("ledger star duplicate field", /noncanonical field-like bullet/, () => validateQueue(
  SYNTHETIC_BACKLOG,
  mutateLatest(SYNTHETIC_LEDGER, (latest) => latest + "\n* next: BL-003", "star latest duplicate")
));
negative("ledger next spaced ID", /must use only canonical BL-NNN references/, () => validateQueue(
  SYNTHETIC_BACKLOG,
  mutateLatestField(SYNTHETIC_LEDGER, "next", "- next       : BL-002（also BL 003）", "spaced next ID")
));
negative("ledger next slash ID", /must use only canonical BL-NNN references/, () => validateQueue(
  SYNTHETIC_BACKLOG,
  mutateLatestField(SYNTHETIC_LEDGER, "next", "- next       : BL-002（also BL/003）", "slash next ID")
));
negative("ledger next fullwidth ID", /must use only canonical BL-NNN references/, () => validateQueue(
  SYNTHETIC_BACKLOG,
  mutateLatestField(SYNTHETIC_LEDGER, "next", "- next       : BL-002（also ＢＬ-００３）", "fullwidth next ID")
));
negative("ledger backlog spaced ID", /must use only canonical BL-NNN references/, () => validateQueue(
  SYNTHETIC_BACKLOG,
  mutateLatestField(SYNTHETIC_LEDGER, "backlog", "- backlog    : BL-004 Done plus BL 003", "spaced backlog ID")
));
negative("engine-code scope without gate", /engine scope requires human-gate yes/, () => validateQueue(
  mutateItemField(SYNTHETIC_BACKLOG, "BL-002", "scope", "- scope    : docs / engine-code", "engine-code no gate"),
  SYNTHETIC_LEDGER
));
negative("unknown trailing scope", /scope must use canonical top-level segments/, () => validateQueue(
  mutateItemField(SYNTHETIC_BACKLOG, "BL-002", "scope", "- scope    : docs / moonshot", "trailing scope"),
  SYNTHETIC_LEDGER
));
negative("unknown trailing repo", /repo must use one canonical repo/, () => validateQueue(
  mutateItemField(SYNTHETIC_BACKLOG, "BL-002", "repo", "- repo     : Music / GitHub", "trailing repo"),
  SYNTHETIC_LEDGER
));
negative("unknown trailing agent", /agent must use canonical top-level actors/, () => validateQueue(
  mutateItemField(SYNTHETIC_BACKLOG, "BL-002", "agent", "- agent    : codex | hacker", "trailing agent"),
  SYNTHETIC_LEDGER
));
negative("human gate contradictory suffix", /human-gate must be exact yes\/no/, () => validateQueue(
  mutateItemField(SYNTHETIC_BACKLOG, "BL-002", "human-gate", "- human-gate: no yes", "contradictory gate"),
  SYNTHETIC_LEDGER
));
negative("ledger contradictory stack result", /stack-check must be one canonical PASS/, () => validateQueue(
  SYNTHETIC_BACKLOG,
  mutateLatestField(
    SYNTHETIC_LEDGER,
    "stack-check",
    "- stack-check: PASS 1 / FAIL 0 / SKIP 0 / FAIL 99 / BAD 99",
    "contradictory stack"
  )
));
negative("Done leading-space wip", /Done item retains an open\/wip status/, () => validateQueue(
  mutateItem(SYNTHETIC_BACKLOG, "BL-004", (item) => item + "\n - status: wip — codex 2026-08-02", "Done leading wip"),
  SYNTHETIC_LEDGER
));

const EXPECTED_NEGATIVE_FIXTURE_COUNT = 113;
const EXPECTED_NEGATIVE_LABELS_SHA256 = "6b2f93b8688e7db60707ea521a1bf4438c96b9b1ad7c61f208332a85266fe958";
const negativeLabels = NEGATIVE_FIXTURES.map((fixture) => fixture.label);
assert.equal(new Set(negativeLabels).size, negativeLabels.length, "negative fixture labels must be unique");
const negativeLabelHash = createHash("sha256").update(negativeLabels.join("\n"), "utf8").digest("hex");
assert.equal(
  `${NEGATIVE_FIXTURES.length}:${negativeLabelHash}`,
  `${EXPECTED_NEGATIVE_FIXTURE_COUNT}:${EXPECTED_NEGATIVE_LABELS_SHA256}`,
  `negative fixture catalog drift (actual ${NEGATIVE_FIXTURES.length}:${negativeLabelHash})`
);
for (const fixture of NEGATIVE_FIXTURES) expectReject(fixture.label, fixture.expected, fixture.run);

console.log(
  `Autonomy queue semantic check passed (${baseline.backlog.active.length} active; ` +
  `${baseline.backlog.done.length} Done; latest next ${baseline.ledger.next || "none"}; ` +
  `${positiveCount} positive controls; ${NEGATIVE_FIXTURES.length} negative fixtures; ` +
  "offline CPU-only; no GPU/audio/model/network execution)"
);
