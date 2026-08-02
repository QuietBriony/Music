import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(ROOT, path), "utf8");
const manifest = JSON.parse(read("config/external-dependencies.json"));
const catalog = JSON.parse(read("presets/online-samples-catalog.json"));
const machineRegistry = JSON.parse(read("config/music-machines.json"));
const sw = read("sw.js");

const fail = (message) => assert.fail(message);
const presentString = (value, label) => {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.ok(value.trim(), `${label} must not be empty`);
};
const onePositiveSize = (size, label) => {
  assert.equal(typeof size, "object", `${label} must be an object`);
  const values = [size.bytes, size.max_bytes].filter((value) => value !== undefined);
  assert.equal(values.length, 1, `${label} must define exactly one of bytes or max_bytes`);
  assert.ok(Number.isSafeInteger(values[0]) && values[0] > 0, `${label} size must be a positive safe integer`);
};

assert.equal(manifest.schema_version, 1, "external dependency schema_version must be 1");
assert.match(manifest.last_verified, /^\d{4}-\d{2}-\d{2}$/, "last_verified must be YYYY-MM-DD");
assert.ok(Array.isArray(manifest.dependencies) && manifest.dependencies.length > 0, "dependencies must be non-empty");

const policy = manifest.policy;
assert.equal(policy.machine_registry, "config/music-machines.json", "machine registry path drift");
assert.equal(policy.catalog, "presets/online-samples-catalog.json", "catalog path drift");
assert.equal(policy.mutable_branch_urls, "forbidden", "mutable branch URLs must remain forbidden");
assert.equal(policy.model_weight_storage, "repo_external", "model weights must remain repository-external");
assert.equal(policy.model_download, "deny_unless_explicit", "model downloads must remain explicit-only");

const licenseStatuses = new Set(policy.license_statuses);
const revisionStatuses = new Set(policy.revision_statuses);
const integrityStatuses = new Set(policy.integrity_statuses);
const sizeStatuses = new Set(policy.size_statuses);
const machineIds = new Set(Object.keys(machineRegistry.machines));
const capabilityIds = new Set(
  Object.values(machineRegistry.machines).flatMap((machine) => machine.capabilities || [])
);
const dependencyById = new Map();

function assertImmutableUrl(url, label) {
  presentString(url, label);
  assert.doesNotMatch(url, /cdn\.jsdelivr\.net\/gh\/[^\s]+@(?:master|main)(?:\/|$)/i, `${label} uses a mutable jsDelivr branch`);
  assert.doesNotMatch(url, /raw\.githubusercontent\.com\/[^/]+\/[^/]+\/(?:master|main)(?:\/|$)/i, `${label} uses a mutable raw GitHub branch`);
  assert.doesNotMatch(url, /github\.com\/[^/]+\/[^/]+\/(?:blob|tree)\/(?:master|main)(?:\/|$)/i, `${label} uses a mutable GitHub branch`);
  if (/cdn\.jsdelivr\.net\/gh\//i.test(url)) {
    assert.match(url, /@[0-9a-f]{40}(?:\/|$)/i, `${label} GitHub CDN URL must use a 40-character commit SHA`);
  }
}

for (const dependency of manifest.dependencies) {
  const label = `dependency ${dependency.id || "<missing-id>"}`;
  presentString(dependency.id, `${label}.id`);
  assert.match(dependency.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${label}.id must be kebab-case`);
  assert.ok(!dependencyById.has(dependency.id), `duplicate dependency id: ${dependency.id}`);
  dependencyById.set(dependency.id, dependency);
  presentString(dependency.kind, `${label}.kind`);
  assert.ok(Array.isArray(dependency.consumers) && dependency.consumers.length > 0, `${label}.consumers must be non-empty`);
  dependency.consumers.forEach((consumer, index) => presentString(consumer, `${label}.consumers[${index}]`));
  assertImmutableUrl(dependency.source_url, `${label}.source_url`);
  assert.ok(Array.isArray(dependency.runtime_urls), `${label}.runtime_urls must be an array`);
  dependency.runtime_urls.forEach((url, index) => assertImmutableUrl(url, `${label}.runtime_urls[${index}]`));

  assert.equal(typeof dependency.revision, "object", `${label}.revision must be an object`);
  presentString(dependency.revision.type, `${label}.revision.type`);
  presentString(dependency.revision.value, `${label}.revision.value`);
  assert.ok(revisionStatuses.has(dependency.revision.status), `${label}.revision.status is invalid`);
  presentString(dependency.revision.evidence, `${label}.revision.evidence`);

  assert.equal(typeof dependency.integrity, "object", `${label}.integrity must be an object`);
  assert.ok(integrityStatuses.has(dependency.integrity.status), `${label}.integrity.status is invalid`);
  presentString(dependency.integrity.evidence, `${label}.integrity.evidence`);
  if (dependency.integrity.status === "verified") {
    presentString(dependency.integrity.algorithm, `${label}.integrity.algorithm`);
    presentString(dependency.integrity.value, `${label}.integrity.value`);
  }

  assert.equal(typeof dependency.license, "object", `${label}.license must be an object`);
  assert.ok(licenseStatuses.has(dependency.license.status), `${label}.license.status is invalid or missing`);
  presentString(dependency.license.scope, `${label}.license.scope`);
  presentString(dependency.license.evidence, `${label}.license.evidence`);
  if (dependency.license.status === "verified") {
    presentString(dependency.license.spdx, `${label}.license.spdx`);
  }

  onePositiveSize(dependency.expected_size, `${label}.expected_size`);
  assert.ok(sizeStatuses.has(dependency.expected_size.status), `${label}.expected_size.status is invalid`);
  presentString(dependency.expected_size.scope, `${label}.expected_size.scope`);
  presentString(dependency.expected_size.evidence, `${label}.expected_size.evidence`);

  assert.equal(typeof dependency.storage, "object", `${label}.storage must be an object`);
  presentString(dependency.storage.class, `${label}.storage.class`);
  presentString(dependency.storage.target, `${label}.storage.target`);
  assert.equal(typeof dependency.storage.tracked_in_git, "boolean", `${label}.storage.tracked_in_git must be boolean`);

  assert.equal(typeof dependency.execution, "object", `${label}.execution must be an object`);
  presentString(dependency.execution.activation, `${label}.execution.activation`);
  presentString(dependency.execution.download_policy, `${label}.execution.download_policy`);
  assert.ok(Array.isArray(dependency.execution.machines), `${label}.execution.machines must be an array`);
  assert.ok(Array.isArray(dependency.execution.required_capabilities), `${label}.execution.required_capabilities must be an array`);
  for (const machine of dependency.execution.machines) {
    assert.ok(machineIds.has(machine), `${label} references unknown machine ${machine}`);
  }
  for (const capability of dependency.execution.required_capabilities) {
    assert.ok(capabilityIds.has(capability), `${label} references unknown capability ${capability}`);
    if (dependency.execution.machines.length) {
      assert.ok(
        dependency.execution.machines.some((machine) => machineRegistry.machines[machine].capabilities.includes(capability)),
        `${label} capability ${capability} is not supplied by any selected machine`
      );
    }
  }
  presentString(dependency.fallback, `${label}.fallback`);
  assert.equal(typeof dependency.fail_closed, "boolean", `${label}.fail_closed must be boolean`);

  if (dependency.kind === "sample_source") {
    assert.ok(Array.isArray(dependency.asset_families) && dependency.asset_families.length > 0, `${label} needs asset_families`);
    for (const family of dependency.asset_families) {
      presentString(family.id, `${label}.asset_families.id`);
      assert.ok(licenseStatuses.has(family.license_status), `${label} family license_status is invalid or missing`);
      presentString(family.evidence, `${label}.asset_families.evidence`);
      if (family.license_status === "verified") presentString(family.license_spdx, `${label}.asset_families.license_spdx`);
    }
  }

  if (dependency.kind === "repo_external_model") {
    assert.equal(dependency.storage.class, "worker_external_model_cache", `${label} must use external model cache`);
    assert.equal(dependency.storage.tracked_in_git, false, `${label} must not be tracked`);
    assert.equal(dependency.execution.download_policy, "deny_unless_explicit", `${label} must deny implicit downloads`);
    assert.ok(dependency.execution.required_capabilities.includes("worker.gpu"), `${label} must require worker.gpu`);
    assert.equal(dependency.fail_closed, true, `${label} must fail closed`);
  }

  if (dependency.kind === "hosted_api_model") {
    assert.equal(dependency.execution.activation, "explicit_user_action", `${label} must require explicit user action`);
    assert.equal(dependency.execution.data_egress, true, `${label} must declare data egress`);
    assert.equal(dependency.fail_closed, true, `${label} must fail closed`);
  }
}

const swVersion = sw.match(/const VERSION = "(hazama-fm-v\d+)";/)?.[1];
assert.ok(swVersion, "sw.js cache version is missing");
for (const dependency of manifest.dependencies.filter((item) => item.storage.class === "browser_runtime_cache")) {
  assert.equal(dependency.storage.target, `${swVersion}-runtime`, `${dependency.id} runtime cache version drift`);
}

const catalogEntries = [...catalog.kits, ...catalog.instruments];
assert.equal(catalogEntries.length, 21, "online catalog entry count changed; update the manifest review intentionally");
const sampleCdnSource = sw.match(/function isSampleCdn\(url\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(sampleCdnSource, "sw.js isSampleCdn classifier is missing");
const isSampleCdn = Function(`"use strict"; ${sampleCdnSource}; return isSampleCdn;`)();
for (const entry of catalogEntries) {
  presentString(entry.id, "catalog entry id");
  presentString(entry.dependency_id, `catalog ${entry.id}.dependency_id`);
  presentString(entry.license, `catalog ${entry.id}.license`);
  const dependency = dependencyById.get(entry.dependency_id);
  assert.ok(dependency, `catalog ${entry.id} references unknown dependency ${entry.dependency_id}`);
  assert.equal(dependency.kind, "sample_source", `catalog ${entry.id} dependency must be a sample source`);
  assertImmutableUrl(entry.base_url, `catalog ${entry.id}.base_url`);
  assert.ok(
    dependency.runtime_urls.some((root) => entry.base_url === root || entry.base_url.startsWith(`${root}/`)),
    `catalog ${entry.id} base_url is not covered by ${dependency.id}`
  );
  assert.equal(isSampleCdn(new URL(entry.base_url)), true, `catalog ${entry.id} is outside the service-worker sample cache`);
}
for (const dependency of manifest.dependencies.filter((item) => item.kind === "sample_source")) {
  for (const url of dependency.runtime_urls) {
    assert.equal(isSampleCdn(new URL(url)), true, `${dependency.id} runtime URL is outside the service-worker sample cache`);
  }
}

const runtimeBindings = {
  "tonejs-runtime": ["band-room.html", "fm.html", "index.html"],
  "magenta-music-browser": ["audio/ai-fills.js", "band-room.js"],
  "tonejs-midi-browser": ["band-room.js"],
  "magenta-drums-rnn-checkpoint": ["audio/ai-fills.js", "band-room.js"]
};
for (const [dependencyId, consumers] of Object.entries(runtimeBindings)) {
  const dependency = dependencyById.get(dependencyId);
  assert.ok(dependency, `missing runtime dependency ${dependencyId}`);
  for (const consumer of consumers) {
    const source = read(consumer);
    for (const url of dependency.runtime_urls) {
      assert.ok(source.includes(url), `${consumer} must use ${dependencyId} manifest URL ${url}`);
    }
  }
}

const frozenTone = dependencyById.get("tonejs-audio-samples");
assert.equal(frozenTone.runtime_pin_enforced, false, "engine.js legacy Tone URL must not be represented as content-addressed");
assert.ok(frozenTone.consumers.includes("engine.js legacy_frozen"), "engine.js legacy Tone URL exception must stay explicit");

const authoritativeFiles = [
  "config/external-dependencies.json",
  "presets/online-samples-catalog.json",
  "band-room.html",
  "fm.html",
  "index.html",
  "band-room.js",
  "audio/ai-fills.js",
  "docs/SAMPLE-CATALOG-GUIDE.md",
  "docs/FREE-SAMPLES-AND-SYNTHESIS.md",
  "docs/WORKER-GAMING-RUNBOOK.md",
  "docs/MUSIC-PC-DAW-PARITY-RUNBOOK.md",
  "docs/ACE-STEP-WORKFLOW.md",
  "docs/CODEX-HANDOFF.md"
];
let mutableUrls = 0;
for (const path of authoritativeFiles) {
  const urls = read(path).match(/https?:\/\/[^\s"')<>]+/g) || [];
  for (const url of urls) {
    try {
      assertImmutableUrl(url.replace(/[.,;:]$/, ""), `${path} URL`);
    } catch (error) {
      mutableUrls++;
      throw error;
    }
  }
}

const git = spawnSync(
  "git",
  ["-c", `safe.directory=${ROOT.replace(/\\/g, "/")}`, "ls-files", "-z"],
  { cwd: ROOT, encoding: "utf8" }
);
if (git.error || git.status !== 0) fail(`git ls-files failed: ${git.error?.message || git.stderr}`);
const trackedFiles = git.stdout.split("\0").filter(Boolean);
const weightExtensions = new Set(policy.model_weight_extensions);
const trackedWeights = trackedFiles.filter((path) => weightExtensions.has(extname(path).toLowerCase()));
assert.deepEqual(trackedWeights, [], `model weight files must stay untracked: ${trackedWeights.join(", ")}`);
assert.doesNotMatch(sw, /\.(?:ckpt|gguf|onnx|pt|pth|safetensors)(?:[?"']|$)/i, "model weights must not enter the service-worker cache");

const aceRevision = dependencyById.get("ace-step-1-5-code").revision.value;
const aceModelRevision = dependencyById.get("ace-step-v15-turbo-model").revision.value;
assert.ok(read("docs/ACE-STEP-WORKFLOW.md").includes(aceRevision), "ACE-Step workflow must name the pinned code commit");
assert.ok(read("docs/ACE-STEP-WORKFLOW.md").includes(aceModelRevision), "ACE-Step workflow must name the pinned model revision");
assert.ok(read("docs/CODEX-HANDOFF.md").includes(aceRevision), "CODEX handoff must name the pinned ACE-Step code commit");

const workerRunbook = read("docs/WORKER-GAMING-RUNBOOK.md");
for (const [name, version] of [
  ["demucs", "4.0.1"],
  ["librosa", "0.11.0"],
  ["soundfile", "0.13.1"],
  ["imageio-ffmpeg", "0.6.0"],
  ["scipy", "1.17.1"],
  ["numpy", "2.4.6"]
]) {
  assert.ok(workerRunbook.includes(`${name}==${version}`), `worker runbook must pin ${name}==${version}`);
}

const licenseCounts = Object.fromEntries(
  [...licenseStatuses].map((status) => [status, manifest.dependencies.filter((item) => item.license.status === status).length])
);
const modelCount = manifest.dependencies.filter((item) => item.kind === "repo_external_model").length;
console.log(
  `External dependency check passed (${manifest.dependencies.length} dependencies; ${catalogEntries.length} catalog entries; ` +
  `${mutableUrls} mutable URLs; licenses verified/pending/N-A ${licenseCounts.verified}/${licenseCounts.pending}/${licenseCounts.not_applicable}; ` +
  `${modelCount} repo-external models; ${trackedWeights.length} tracked weights; ${swVersion})`
);
