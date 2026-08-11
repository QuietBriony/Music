import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE_PATH = "docs/CHROME-COMPUTER-USE-BASELINE.md";
const read = (path) => readFileSync(resolve(ROOT, path), "utf8");
const baseline = read(BASELINE_PATH);

for (const marker of [
  "# Chrome Computer Use Baseline",
  "`worker-gaming`",
  "`chouta-surface`",
  "`ユーザー 2`",
  "`Profile 1`",
  "`https://quietbriony.github.io`",
  "site-specific allow",
  "Allow once",
  "tabs.finalize",
  "2026-08-11",
  "not verified in this task"
]) {
  assert.ok(baseline.includes(marker), `${BASELINE_PATH} is missing marker: ${marker}`);
}

assert.doesNotMatch(
  baseline,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  `${BASELINE_PATH} must not contain a full email address`
);
for (const forbidden of [
  "extensionInstanceId",
  "Allow for all sites",
  "\\User Data\\Profile 1",
  "chrome://version"
]) {
  assert.equal(baseline.includes(forbidden), false, `${BASELINE_PATH} contains forbidden detail: ${forbidden}`);
}

for (const path of [
  "README.md",
  "docs/NEW-PC-SETUP.md",
  "docs/PC-REGISTRY.md",
  "docs/WORKER-GAMING-RUNBOOK.md",
  "docs/runtime-browser-listening-checklist.md"
]) {
  assert.ok(read(path).includes("CHROME-COMPUTER-USE-BASELINE.md"), `${path} must link ${BASELINE_PATH}`);
}

console.log("Chrome Computer Use docs check passed (WorkerPC snapshot + cross-PC parity + secret boundary)");
