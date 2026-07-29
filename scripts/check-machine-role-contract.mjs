import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("config/music-machines.json", "utf8"));
const machineScript = readFileSync("scripts/music-machine.ps1", "utf8");
const setupScript = readFileSync("scripts/setup-new-pc.ps1", "utf8");
const workerWrapper = readFileSync("scripts/invoke-worker-sonar-ni.ps1", "utf8");
const pipeline = readFileSync("scripts/worker-gaming-pipeline.py", "utf8");
const agents = readFileSync("AGENTS.md", "utf8");
const registry = readFileSync("docs/PC-REGISTRY.md", "utf8");
const setupDoc = readFileSync("docs/NEW-PC-SETUP.md", "utf8");
const workerRunbook = readFileSync("docs/WORKER-GAMING-RUNBOOK.md", "utf8");

assert.equal(manifest.schema_version, 1);
assert.equal(manifest.identity_policy.mode, "fail-closed");
assert.deepEqual(
  manifest.identity_policy.required_keys,
  ["music.machineName", "music.machineHost"]
);
assert.deepEqual(
  Object.keys(manifest.machines).sort(),
  ["chouta-surface", "studioPC", "worker-gaming"]
);

const studioCapabilities = manifest.machines.studioPC.capabilities;
const workerCapabilities = manifest.machines["worker-gaming"].capabilities;
assert(studioCapabilities.includes("studio.audio"));
assert(studioCapabilities.includes("hardware.inspect"));
assert(!studioCapabilities.includes("worker.batch"));
assert(workerCapabilities.includes("worker.batch"));
assert(workerCapabilities.includes("worker.gpu"));
assert(workerCapabilities.includes("worker.daw-reference"));

assert.match(machineScript, /music\.machineName/);
assert.match(machineScript, /music\.machineHost/);
assert.match(machineScript, /OrdinalIgnoreCase/);
assert.match(machineScript, /RequireMachine/);
assert.match(machineScript, /RequireCapability/);
assert.match(setupScript, /Parameter\(Mandatory = \$true\)/);
assert.match(setupScript, /ValidateSet\("chouta-surface", "studioPC", "worker-gaming"\)/);
assert.match(setupScript, /music-machine\.ps1 -SetMachine \$MachineName/);

assert.match(workerWrapper, /RequireMachine "worker-gaming"/);
assert.match(workerWrapper, /RequireCapability "worker\.daw-reference"/);
assert.match(pipeline, /"sonar-ni-reference": "worker\.daw-reference"/);
assert.match(pipeline, /"sonar-ni-reference": "worker-gaming"/);
assert.match(pipeline, /"separate": "worker\.batch"/);
assert.match(pipeline, /args\.machine_identity = _assert_machine_command\(args\.command\)/);
assert.match(pipeline, /"machine_identity": args\.machine_identity/);

for (const doc of [agents, registry, setupDoc, workerRunbook]) {
  assert.match(doc, /music-machine\.ps1/);
}
assert.doesNotMatch(registry, /未設定でも OK/);
assert.doesNotMatch(setupDoc, /primary PC は無印で OK/);
assert.match(workerRunbook, /machineName=worker-gaming/);
assert.match(workerRunbook, /worker\.daw-reference/);

console.log("Machine role contract check passed");
