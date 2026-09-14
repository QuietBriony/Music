// Explicit, bounded DATA import. No upstream source code or model executable.
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";

const revision = "631ada7f1e074581ac986e91c7e68ad7074fedb1";
const url = `https://raw.githubusercontent.com/Apolotary/fly-lab/${revision}/data/locomotor_circuit.json`;
const target = new URL("../experiments/listening-loop/v1/circuit.json", import.meta.url);
const bytes = 1076374;
const hash = "8f76d94034dcf802453e3a0a8ed5342d122e57d37e2bb5ea28da66de0856f5d6";
function verify(buffer) {
  if (buffer.length !== bytes || createHash("sha256").update(buffer).digest("hex") !== hash) {
    throw new Error("Circuit size/hash mismatch; nothing written");
  }
  const data = JSON.parse(buffer);
  if (data.neurons.length !== 1045 || data.edges.length !== 17224 ||
      data.rawSynapseCounts.length !== data.edges.length || data.provenance.license !== "CC-BY-4.0") {
    throw new Error("Circuit schema mismatch; nothing written");
  }
  for (const edge of data.edges) {
    if (edge.length !== 3 || !edge.every(Number.isFinite) ||
        !edge.slice(0, 2).every((i) => Number.isInteger(i) && i >= 0 && i < 1045)) {
      throw new Error("Invalid connection; nothing written");
    }
  }
}
let existing;
try { existing = await readFile(target); } catch (error) { if (error.code !== "ENOENT") throw error; }
if (existing) {
  verify(existing);
  console.log("Existing circuit verified; no write.");
} else {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000), redirect: "error" });
  if (!response.ok) throw new Error(`Circuit HTTP ${response.status}`);
  const chunks = [];
  let received = 0;
  for await (const chunk of response.body) {
    received += chunk.length;
    if (received > bytes) { throw new Error("Circuit exceeded size budget; nothing written"); }
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  verify(buffer);
  await mkdir(new URL(".", target), { recursive: true });
  await writeFile(target, buffer, { flag: "wx" });
  console.log(`Imported DATA only: ${bytes} bytes; sha256 ${hash}`);
}
