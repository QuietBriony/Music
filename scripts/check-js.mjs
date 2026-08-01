import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";

const SKIP_DIRS = new Set([
  ".git",
  ".wrangler",
  "node_modules",
  "worker-output",
  "captures",
  "__pycache__"
]);

function discoverJavaScript(dir = ".") {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...discoverJavaScript(path));
    else if (entry.isFile() && /\.(?:js|mjs)$/.test(entry.name)) {
      files.push(relative(".", path).replaceAll("\\", "/"));
    }
  }
  return files;
}

const files = discoverJavaScript().sort();

let bad = 0;

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) bad += 1;
}

if (bad) {
  console.error(`JS syntax check failed: ${bad} file(s)`);
  process.exit(1);
}

console.log(`JS syntax check passed: ${files.length} file(s)`);
