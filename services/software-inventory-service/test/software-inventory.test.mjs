import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { parseOperatorArguments, runOperator } from "../scripts/inventory-software.mjs";
import {
  commitSoftwareInventory,
  inventorySoftware,
  normalizeSystemdInventory,
  softwareInventoryJson,
  validateSoftwareInventoryJson,
} from "../src/software-inventory.mjs";

const ROOT_BINDING = { source: "urn:test:source", owner: "urn:test:owner", classification: "owned-source" };
const SYSTEMD_BINDING = { source: "urn:test:machine", owner: "urn:test:owner", classification: "owned-source", aliases: ["local"] };

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "software-inventory-"));
  await mkdir(join(root, "service", "data", "records", "systemd-unit-records"), { recursive: true });
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "@example/root", version: "0.0.1", private: true }));
  await writeFile(join(root, "service", "package.json"), JSON.stringify({ name: "@example/consumer", version: "1.2.3" }));
  await writeFile(join(root, "service", "data", "records", "systemd-unit-records", "example.service"), "[Service]\nExecStart=/bin/true\n");
  return root;
}

test("orphan gitlinks are defects and do not abort software inventory", async () => {
  const root = await fixture();
  const result = await inventorySoftware({
    root,
    rootBinding: ROOT_BINDING,
    gitmodulesText: "[submodule \"declared\"]\n\tpath = declared\n\turl = ./declared\n",
    gitlinksText: "160000 0123456789012345678901234567890123456789 0\torphan\n",
    systemdInventory: { host: "local", units: [{ unit: "example.service", active: "active" }], timers: [] },
    systemdSourceBinding: SYSTEMD_BINDING,
  });
  assert.equal(result.kind, "SoftwareInventory");
  assert.deepEqual(result.defects.map(({ kind }) => kind).sort(), ["declared-submodule-without-gitlink", "orphan-gitlink"]);
  assert.equal(result.observation.gitlinks, 1);
  assert.equal(result.observation.deploymentUnits, 1);
  assert.match(result.addressedBundle.token, /^ni:\/\/\/sha-256;/u);
  assert.equal(result.addressedBundle.token, result.addressedBundle.carrierNiUri);
  assert.match(result.chart.text, /records-live-unit/u);
});

test("live Git observation stays inside the receiver-supplied territory", async () => {
  const repository = await mkdtemp(join(tmpdir(), "software-inventory-git-scope-"));
  const territory = join(repository, "territory");
  await mkdir(territory);
  await writeFile(join(territory, "package.json"), JSON.stringify({ name: "@example/territory", version: "0.0.1" }));
  execFileSync("git", ["-C", repository, "init", "--quiet"]);
  execFileSync("git", ["-C", repository, "add", "territory/package.json"]);
  execFileSync("git", ["-C", repository, "update-index", "--add", "--cacheinfo", "160000,0123456789012345678901234567890123456789,outside-territory"]);
  const result = await inventorySoftware({ root: territory, rootBinding: ROOT_BINDING });
  assert.equal(result.observation.gitlinks, 0);
  assert.equal(result.defects.some(({ kind }) => kind === "orphan-gitlink"), false);
});

test("systemd input and every derived carrier are deterministic under input ordering", async () => {
  const root = await fixture();
  const firstInventory = { host: "local", units: [{ unit: "z.service", active: "inactive" }, { unit: "a.service", active: "active" }], timers: [{ unit: "z.timer", next: 5 }] };
  const secondInventory = { host: "local", units: [...firstInventory.units].reverse(), timers: [...firstInventory.timers] };
  assert.deepEqual(normalizeSystemdInventory(firstInventory), normalizeSystemdInventory(secondInventory));
  const options = { root, rootBinding: ROOT_BINDING, gitmodulesText: "", gitlinksText: "", systemdInventory: firstInventory, systemdSourceBinding: SYSTEMD_BINDING };
  const first = await inventorySoftware(options);
  const second = await inventorySoftware({ ...options, systemdInventory: secondInventory });
  assert.equal(first.addressedBundle.token, second.addressedBundle.token);
  assert.equal(first.chart.niUri, second.chart.niUri);
  assert.deepEqual(first.catalog, second.catalog);
});

test("supplier aliases over identical snapshots share one receiver projection while raw device rows remain addressed", async () => {
  const root = await fixture();
  const rows = {
    units: [
      { unit: "dev-loop0.device", active: "active", opaqueSupplierField: "preserved" },
      { unit: "example.service", active: "active" },
    ],
    timers: [{ unit: "example.timer", next: 7 }],
  };
  const result = await inventorySoftware({
    root,
    rootBinding: ROOT_BINDING,
    gitmodulesText: "",
    gitlinksText: "",
    systemdInventories: [{ host: "alias-b", sourceBinding: SYSTEMD_BINDING, ...rows }, { host: "alias-a", sourceBinding: SYSTEMD_BINDING, ...rows }],
  });
  const inventories = result.catalog.filter(({ kind }) => kind === "systemd-inventory");
  const receivers = result.catalog.filter(({ kind }) => kind === "systemd-unit");
  assert.equal(inventories.length, 2);
  assert.equal(new Set(inventories.map(({ value }) => value.inventoryFingerprint)).size, 1);
  assert.equal(inventories[0].value.observedRows.units[0].opaqueSupplierField, "preserved");
  assert.deepEqual(receivers.map(({ value }) => value.name).sort(), ["example.service", "example.timer"]);
  assert.deepEqual(receivers[0].value.observedThrough, ["alias-a", "alias-b"]);
  assert.equal(result.observation.systemdObservedRows, 6);
  assert.equal(result.observation.systemdReceiverUnits, 2);
});

test("repository-shaped presence never invents source ownership", async () => {
  const root = await fixture();
  const result = await inventorySoftware({ root, gitmodulesText: "", gitlinksText: "", systemdInventory: { host: "unobserved", units: [], timers: [] } });
  assert.deepEqual(result.rootBinding, { classification: "unclassified", owner: null, source: null });
  assert.equal(result.defects.some(({ kind }) => kind === "unclassified-observation-root"), true);
  assert.equal(result.catalog.some(({ kind }) => kind === "observation-source-binding"), true);
  assert.equal(result.defects.some(({ kind }) => kind === "unbound-systemd-source"), true);
});

test("omitting systemd performs no synthetic host observation", async () => {
  const root = await fixture();
  const result = await inventorySoftware({ root, rootBinding: ROOT_BINDING, gitmodulesText: "", gitlinksText: "" });
  assert.equal(result.observation.systemdInventories, 0);
  assert.equal(result.catalog.some(({ kind }) => kind === "systemd-inventory"), false);
  assert.equal(result.defects.some(({ kind }) => kind === "unbound-systemd-source"), false);
});

test("operator requires explicit source binding and emits the selected receiver format", async () => {
  assert.throws(() => parseOperatorArguments(["--root", "/tmp"]), /usage:/u);
  const root = await fixture();
  const chunks = [];
  const args = ["--root", root, "--source", "urn:test:source", "--owner", "urn:test:owner", "--classification", "owned-source", "--format", "dot"];
  const parsed = parseOperatorArguments(args);
  assert.equal(parsed.format, "dot");
  await runOperator(args, { stdout: { write: (chunk) => chunks.push(chunk) } });
  assert.match(chunks.join(""), /^digraph software_inventory \{/u);
});

test("ordinary non-package source is content-addressed and changes the inventory carrier", async () => {
  const root = await fixture();
  const options = { root, rootBinding: ROOT_BINDING, gitmodulesText: "", gitlinksText: "", systemdInventory: { host: "local", units: [], timers: [] }, systemdSourceBinding: SYSTEMD_BINDING };
  await writeFile(join(root, "service", "ordinary-source.mjs"), "export const value = 1;\n");
  const first = await inventorySoftware(options);
  const firstEntry = first.catalog.find(({ kind, key }) => kind === "filesystem-entry" && key === "service/ordinary-source.mjs");
  assert.match(firstEntry.rawAddress, /^ni:\/\/\/sha-256;/u);
  assert.equal(firstEntry.value.territory, "source-candidate");
  assert.equal(first.graph.nodes.some(({ id }) => id === firstEntry.semanticToken), true);
  await writeFile(join(root, "service", "ordinary-source.mjs"), "export const value = 2;\n");
  const second = await inventorySoftware(options);
  assert.notEqual(first.addressedBundle.token, second.addressedBundle.token);
  assert.notEqual(firstEntry.rawAddress, second.catalog.find(({ kind, key }) => kind === "filesystem-entry" && key === "service/ordinary-source.mjs").rawAddress);
});

test("large territories reduce through bounded commitments without a deep SEN aggregate", () => {
  const catalog = Array.from({ length: 12_000 }, (_, index) => ({
    kind: "filesystem-entry",
    key: `src/generated/${String(index).padStart(5, "0")}.mjs`,
    valueAddress: `ni:///sha-256;${"A".repeat(42)}E`,
    semanticToken: `urn:test:entry:${index}`,
  }));
  const graph = {
    nodes: catalog.map((entry) => ({ id: entry.semanticToken, kind: entry.kind, label: entry.key })),
    edges: catalog.slice(1).map((entry, index) => ({ from: catalog[index].semanticToken, to: entry.semanticToken, relation: "next" })),
  };
  const body = {
    kind: "SoftwareInventory",
    version: 1,
    schema: "urn:red-cup-engineering:schema:software-inventory:1",
    root: "/large-territory",
    rootBinding: ROOT_BINDING,
    observation: { files: catalog.length },
    defects: [],
    catalog,
    graph,
    chart: { mediaType: "text/vnd.graphviz", bytes: 0, niUri: "ni:///sha-256;AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAE", text: "" },
  };
  const first = commitSoftwareInventory(body);
  assert.equal(first.commitment.catalog.count, 12_000);
  assert.ok(first.commitment.catalog.depth < 16);
  const changed = structuredClone(body);
  changed.catalog[11_999].semanticToken = "urn:test:changed";
  assert.notEqual(first.addressedBundle.token, commitSoftwareInventory(changed).addressedBundle.token);
});

test("receiver JSON validates against the published inventory schema", async () => {
  const root = await fixture();
  const result = await inventorySoftware({ root, rootBinding: ROOT_BINDING, gitmodulesText: "", gitlinksText: "" });
  const receiver = softwareInventoryJson(result);
  assert.equal(validateSoftwareInventoryJson(receiver).ok, true);
  receiver.kind = "LegacyEstateBundle";
  assert.equal(validateSoftwareInventoryJson(receiver).ok, false);
  await assert.rejects(() => inventorySoftware({ root, rootBinding: { ...ROOT_BINDING, classification: "invented" } }), /schema validation/u);
});
