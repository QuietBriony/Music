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
// 1 つでも FAIL があれば exit 1。pytest 未導入などは SKIP と表示するが、通常の
// integrity gate では partial success を許さず exit 1。診断時だけ --allow-skip。
//
// Worktree-aware (2026-05-27〜):
//   - 「Music」repo の check は **本スクリプトの親 dir** (= script が居る Music
//     worktree) を見る。canonical `<STACK_ROOT>/Music` と同じパスなら従来と同
//     じ挙動、`git worktree add Music-<topic>` で切った sibling worktree から
//     起動した場合は **その worktree の Music** をチェックする。
//   - sister repo (chill / drum-floor / namima / openclaw) は引き続き
//     `<STACK_ROOT>/<name>` を見る。sister は worktree 並走を想定していない。
//   - 並走 worktree (例: Band Room session の WIP) が canonical Music に居て
//     audit drift していても、別 worktree の clean state からは false FAIL に
//     ならない。
//
// Optional:
//   --deploy-health         GitHub Pages の公開 URL が 200 を返すかも確認する
//   --music-from <path>     Music repo のパスを明示指定 (worktree-aware の上書き、
//                           絶対パスでも script の cwd 相対でも可)
//   --check-timeout-ms N    audit/Node deadline (default 120000ms)
//   --pytest-timeout-ms N   pytest deadline (default 600000ms)
//                          integers 1000..1800000ms; never unbounded
//   --allow-skip            診断時のみ SKIP を許可する。通常 gate は fail-closed

import { performance } from "node:perf_hooks";
import { runCheck, checkResult, pytestProbeResult, timeoutOptions, PROBE_TIMEOUT_MS } from "./lib/stack-check-process.mjs";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PARENT = resolve(SELF_DIR, "..");
const STACK_ROOT = resolve(SELF_DIR, "..", "..");

// --music-from <path> を解釈 (canonical Music を明示指定したい時の override)
const musicFromIdx = process.argv.indexOf("--music-from");
const MUSIC_FROM_ARG = musicFromIdx >= 0 && musicFromIdx + 1 < process.argv.length
  ? process.argv[musicFromIdx + 1]
  : null;
const MUSIC_DIR = MUSIC_FROM_ARG
  ? resolve(process.cwd(), MUSIC_FROM_ARG)
  : SCRIPT_PARENT;

const ACTIVE_REPOS = ["Music", "chill", "drum-floor", "namima", "openclaw"];
const CHECK_DEPLOY_HEALTH = process.argv.includes("--deploy-health");
const ALLOW_SKIP = process.argv.includes("--allow-skip");

// Worktree 検出: SCRIPT_PARENT が canonical <STACK_ROOT>/Music と物理的に
// 別パスなら sibling worktree から起動された (例: <STACK_ROOT>/Music-bl023)
const CANONICAL_MUSIC = join(STACK_ROOT, "Music");
const IS_SIBLING_WORKTREE = resolve(MUSIC_DIR) !== resolve(CANONICAL_MUSIC);
const DEPLOY_TARGETS = {
  Music: "https://quietbriony.github.io/Music/",
  chill: "https://quietbriony.github.io/chill/",
  "drum-floor": "https://quietbriony.github.io/drum-floor/",
  namima: "https://quietbriony.github.io/namima/",
  openclaw: "https://quietbriony.github.io/openclaw/"
};

let limits;
try { limits = timeoutOptions(process.argv.slice(2)); }
catch (error) { console.error(`stack-check: ${error.message}`); process.exit(1); }

async function checkedProcess(repo, name, cmd, args, cwd, timeoutMs, classify = checkResult) {
  console.log(`[start] ${repo} / ${name} limit=${timeoutMs}ms`);
  const result = await runCheck(cmd, args, cwd, timeoutMs);
  const classified = classify(result, timeoutMs);
  console.log(`[end] ${repo} / ${name} ${classified.status} elapsed=${result.elapsedMs}ms`);
  return { result, classified };
}

let pytestReady = null;
async function hasPytest() {
  if (pytestReady === null) {
    const { classified } = await checkedProcess("prerequisite", "pytest --version", "python", ["-m", "pytest", "--version"], STACK_ROOT, PROBE_TIMEOUT_MS, pytestProbeResult);
    pytestReady = classified;
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

async function deployHealthResult(repo) {
  const url = DEPLOY_TARGETS[repo];
  if (!url) return { repo, check: "deploy 200", status: "SKIP", detail: "deploy URL not configured" };
  if (typeof fetch !== "function" || typeof AbortController !== "function") {
    return { repo, check: "deploy 200", status: "SKIP", detail: "fetch unavailable in this Node runtime" };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (response.status === 200) {
      return { repo, check: "deploy 200", status: "PASS", detail: url };
    }
    return { repo, check: "deploy 200", status: "FAIL", detail: `${url} HTTP ${response.status}` };
  } catch (error) {
    const name = error?.name || "FetchError";
    return { repo, check: "deploy 200", status: "FAIL", detail: `${url} ${name}` };
  } finally {
    clearTimeout(timeout);
  }
}

const results = [];
console.log("\nmusic-stack — stack-check");
if (IS_SIBLING_WORKTREE) {
  console.log(`(worktree-aware: Music = ${MUSIC_DIR}, sister repos = ${STACK_ROOT})`);
}
console.log("=".repeat(68));

repos: for (const repo of ACTIVE_REPOS) {
  // Music は worktree-aware (SCRIPT_PARENT または --music-from で指定された path)、
  // sister 4 repo は <STACK_ROOT>/<name>。
  const repoDir = repo === "Music" ? MUSIC_DIR : join(STACK_ROOT, repo);
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
    if (c.needsPytest) {
      const ready = await hasPytest();
      if (ready.status !== "PASS") {
        results.push({ repo, check: c.name, ...ready });
        if (ready.stop) break repos;
        continue;
      }
    }
    const timeoutMs = c.needsPytest ? limits.pytest : limits.check;
    const { classified } = await checkedProcess(repo, c.name, c.cmd, c.args, repoDir, timeoutMs);
    results.push({ repo, check: c.name, ...classified });
    if (classified.stop) {
      console.error("stack-check: process-tree cleanup uncertain; remaining checks were not started");
      break repos;
    }
  }
  if (CHECK_DEPLOY_HEALTH) {
    console.log(`[start] ${repo} / deploy 200 limit=12000ms`);
    const began = performance.now();
    const result = await deployHealthResult(repo);
    results.push(result);
    console.log(`[end] ${repo} / deploy 200 ${result.status} elapsed=${Math.round(performance.now() - began)}ms`);
  }
}

const pad = (s, n) => String(s).padEnd(n);
let pass = 0;
let fail = 0;
let skip = 0;
let currentRepo = "";

console.log("\n" + "=".repeat(68));
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
if (skip > 0 && !ALLOW_SKIP) {
  console.error(`stack-check: ${skip} required check(s) SKIPPED; refusing a partial integrity gate`);
  console.error("stack-check: use --allow-skip only for an explicit diagnostic run");
  process.exit(1);
}
if (skip > 0) {
  console.log(`stack-check: 0 BAD (${skip} SKIP explicitly allowed)`);
  process.exit(0);
}
console.log("stack-check: 0 BAD");
process.exit(0);
