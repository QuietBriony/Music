// stack-check.mjs — music-stack 全体の整合性ゲート集約ランナー
//
// Music repo の root から実行する:
//     node scripts/stack-check.mjs
//
// active repo (Music / chill / drum-floor / namima / openclaw) を走査し、
// 各 repo が既に持つチェックを発見して実行、統一 PASS/FAIL テーブルを出す。
// 自前の検査ロジックは持たない。各 repo の既存チェックを再利用するだけ。
//
// 発見ルール (repo ごと):
//   - scripts/audit.py           → python -X utf8 scripts/audit.py --quiet
//   - scripts/check-*.mjs        → node scripts/check-<...>.mjs
//   - tests/test_*.py            → python -m pytest tests/ -q
//
// 1 つでも FAIL があれば exit 1。pytest 未導入などは SKIP 扱い (BAD ではない)。

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const STACK_ROOT = resolve(SELF_DIR, "..", "..");
const ACTIVE_REPOS = ["Music", "chill", "drum-floor", "namima", "openclaw"];

function run(cmd, args, cwd) {
  return spawnSync(cmd, args, { cwd, encoding: "utf8" });
}

let pytestReady = null;
function hasPytest() {
  if (pytestReady === null) {
    const r = run("python", ["-m", "pytest", "--version"], STACK_ROOT);
    pytestReady = !r.error && r.status === 0;
  }
  return pytestReady;
}

function discoverChecks(repoDir) {
  const checks = [];
  const scriptsDir = join(repoDir, "scripts");
  if (existsSync(join(scriptsDir, "audit.py"))) {
    checks.push({ name: "audit.py", cmd: "python", args: ["-X", "utf8", "scripts/audit.py", "--quiet"] });
  }
  if (existsSync(scriptsDir)) {
    for (const f of readdirSync(scriptsDir).sort()) {
      if (f.startsWith("check-") && f.endsWith(".mjs")) {
        checks.push({ name: f, cmd: process.execPath, args: [join("scripts", f)] });
      }
    }
  }
  const testsDir = join(repoDir, "tests");
  if (existsSync(testsDir) && readdirSync(testsDir).some((f) => f.startsWith("test_") && f.endsWith(".py"))) {
    checks.push({ name: "pytest tests/", cmd: "python", args: ["-m", "pytest", "tests/", "-q"], needsPytest: true });
  }
  return checks;
}

const results = [];

for (const repo of ACTIVE_REPOS) {
  const repoDir = join(STACK_ROOT, repo);
  if (!existsSync(repoDir)) {
    results.push({ repo, check: "(repo)", status: "SKIP", detail: "directory not found" });
    continue;
  }
  const checks = discoverChecks(repoDir);
  if (checks.length === 0) {
    results.push({ repo, check: "(none)", status: "SKIP", detail: "no audit.py / check-*.mjs / tests" });
    continue;
  }
  for (const c of checks) {
    if (c.needsPytest && !hasPytest()) {
      results.push({ repo, check: c.name, status: "SKIP", detail: "pytest not installed" });
      continue;
    }
    const r = run(c.cmd, c.args, repoDir);
    if (r.error) {
      results.push({ repo, check: c.name, status: "SKIP", detail: r.error.code || String(r.error) });
    } else if (r.status === 0) {
      results.push({ repo, check: c.name, status: "PASS", detail: "" });
    } else {
      const tail = `${r.stdout || ""}${r.stderr || ""}`.trim().split(/\r?\n/).slice(-3).join(" / ");
      results.push({ repo, check: c.name, status: "FAIL", detail: tail.slice(0, 240) });
    }
  }
}

const pad = (s, n) => String(s).padEnd(n);
let pass = 0;
let fail = 0;
let skip = 0;
let currentRepo = "";

console.log("\nmusic-stack — stack-check");
console.log("=".repeat(68));
for (const r of results) {
  if (r.repo !== currentRepo) {
    console.log(`\n[${r.repo}]`);
    currentRepo = r.repo;
  }
  if (r.status === "PASS") pass += 1;
  else if (r.status === "FAIL") fail += 1;
  else skip += 1;
  console.log(`  ${pad(r.status, 5)} ${pad(r.check, 30)} ${r.detail}`);
}
console.log(`\n${"=".repeat(68)}`);
console.log(`PASS ${pass}   FAIL ${fail}   SKIP ${skip}`);

if (fail > 0) {
  console.error(`stack-check: ${fail} check(s) FAILED`);
  process.exit(1);
}
console.log("stack-check: 0 BAD");
process.exit(0);
