import { readFileSync, realpathSync } from "node:fs";
import { readFile, readlink } from "node:fs/promises";
import { basename, relative, resolve, sep } from "node:path";

import { observeDiskPackages } from "@red-cup-engineering/disk-package-observation-app";
import { observeGitSubmodules } from "@red-cup-engineering/computer-code-development-engine/git/observation";
import {
  compareSubmodules,
  parseGitlinks,
  parseGitmodules,
} from "@red-cup-engineering/git-services-section/gitmodules";
import { createGraph, toDot } from "@red-cup-engineering/metrologic/models/graphs/directed-multigraph";
import { admitSchema } from "@red-cup-engineering/json-schema-services-section/admit-schema";
import { validateSchemaInstance } from "@red-cup-engineering/json-schema-services-section/validate-schema-instance";
import { makeNiUri } from "@red-cup-engineering/uri-services-section/ni-uri";
import { discoverPackages } from "@red-cup-engineering/npm-package-tree-discovery-service";
import { walkPosixPaths } from "@red-cup-engineering/computer-filepath-engineering-services-section/walk-posix-paths";
import { jsonToTerm } from "@red-cup-engineering/computer-data-engineering-services-section/semiotic-expression-notation/json-codec";
import { inferTy } from "@red-cup-engineering/computer-data-engineering-services-section/semiotic-expression-notation/typing";
import {
  EMPTY_WITNESS_ROOT,
} from "@red-cup-engineering/computer-content-address-engineering-services-section/semantic-content-identity";
import {
  identifyNormalizedSemanticContent,
} from "@red-cup-engineering/computer-code-engineering-services-section/semiotic-expression-notation/runtime";
import { observeUnitInventory } from "@red-cup-engineering/systemd-unit-inventory-observation-service";
import { runSystemctl } from "@red-cup-engineering/systemd-unit-inventory-observation-service/run-systemctl";

const UNIT_SUFFIX = /\.(?:service|socket|target|timer|path|mount)$/u;
const ROOT_CLASSIFICATIONS = new Set(["owned-source", "off-tree-owned", "vendor", "cache", "release", "archive", "recovery", "unclassified"]);
const compare = (left, right) => left.localeCompare(right, "en");
const slash = (value) => value.split(sep).join("/");
const loadSchema = (name) => admitSchema({ schema: JSON.parse(readFileSync(new URL(`../schemas/${name}`, import.meta.url), "utf8")) }).schema;
export const SOFTWARE_INVENTORY_OPTIONS_SCHEMA = loadSchema("software-inventory-options.schema.json");
export const SOFTWARE_INVENTORY_SCHEMA = loadSchema("software-inventory.schema.json");

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort(compare).map((key) => [key, canonicalJson(value[key])]));
  }
  return value;
}

function addressSemanticJson(value) {
  const normalized = canonicalJson(value);
  const term = jsonToTerm(normalized);
  const semanticType = inferTy([], term);
  if (semanticType === null) throw new TypeError("inventory record did not earn an inferable SEN type");
  const identified = identifyNormalizedSemanticContent({
    objectKind: "software-inventory.semantic-json",
    semanticType,
    term,
    witnessRoot: EMPTY_WITNESS_ROOT,
  });
  return Object.freeze({
    token: identified.token,
    carrierNiUri: makeNiUri(identified.bytes),
    mediaType: "application/sen+cbor",
    bytes: identified.bytes,
    semanticType,
  });
}

function jsonCarrier(value) {
  const normalized = canonicalJson(value);
  const bytes = Buffer.from(JSON.stringify(normalized), "utf8");
  return Object.freeze({ normalized, bytes, niUri: makeNiUri(bytes) });
}

function addressJsonCarrier(kind, value) {
  const carrier = jsonCarrier(value);
  const semantic = addressSemanticJson({ kind, mediaType: "application/json", carrier: carrier.niUri, bytes: carrier.bytes.length });
  return Object.freeze({ ...carrier, semantic });
}

function commitSequence(kind, values) {
  const leafWidth = 64;
  let level = [];
  for (let index = 0; index < values.length; index += leafWidth) {
    const items = values.slice(index, index + leafWidth);
    const carrier = addressJsonCarrier(`${kind}.leaf-values`, items);
    level.push(Object.freeze({
      token: addressSemanticJson({ kind: `${kind}.leaf`, start: index, count: items.length, valuesCarrier: carrier.niUri }).token,
      count: items.length,
    }));
  }
  if (level.length === 0) return Object.freeze({ token: addressSemanticJson({ kind: `${kind}.empty`, count: 0 }).token, count: 0, depth: 0 });
  let depth = 0;
  while (level.length > 1) {
    const next = [];
    for (let index = 0; index < level.length; index += 2) {
      const left = level[index];
      const right = level[index + 1] ?? null;
      const count = left.count + (right?.count ?? 0);
      next.push(Object.freeze({
        token: addressSemanticJson({ kind: `${kind}.branch`, depth, left: left.token, right: right?.token ?? null, count }).token,
        count,
      }));
    }
    level = next;
    depth += 1;
  }
  return Object.freeze({ token: level[0].token, count: level[0].count, depth });
}

function normalizedUnit(row, kind) {
  const name = row?.unit ?? row?.name ?? row?.id ?? row?.timer ?? null;
  return canonicalJson({
    kind,
    name,
    active: row?.active ?? null,
    load: row?.load ?? null,
    sub: row?.sub ?? null,
    description: row?.description ?? null,
    next: row?.next ?? null,
    left: row?.left ?? null,
    last: row?.last ?? null,
    passed: row?.passed ?? null,
    activates: row?.activates ?? null,
  });
}

export function normalizeSystemdInventory(inventory = { host: "unobserved", units: [], timers: [] }) {
  if (typeof inventory?.host !== "string" || !Array.isArray(inventory?.units) || !Array.isArray(inventory?.timers)) {
    throw new TypeError("systemd inventory must contain host, units, and timers");
  }
  const sorter = (left, right) => compare(`${left.name ?? ""}\0${JSON.stringify(left)}`, `${right.name ?? ""}\0${JSON.stringify(right)}`);
  return Object.freeze({
    host: inventory.host,
    units: Object.freeze(inventory.units.map((row) => normalizedUnit(row, "unit")).sort(sorter)),
    timers: Object.freeze(inventory.timers.map((row) => normalizedUnit(row, "timer")).sort(sorter)),
  });
}

function catalogEntry(kind, key, value, rawAddress = undefined) {
  const carrier = addressJsonCarrier("software-inventory.catalog-value", value);
  const semantic = addressSemanticJson({ kind, key, valueCarrier: carrier.niUri });
  return Object.freeze({
    kind,
    key,
    value: carrier.normalized,
    valueAddress: carrier.niUri,
    semanticToken: semantic.token,
    semanticCarrier: semantic.carrierNiUri,
    ...(rawAddress === undefined ? {} : { rawAddress }),
  });
}

export function commitSoftwareInventory(body) {
  if (body?.kind !== "SoftwareInventory" || !Array.isArray(body.catalog) || !Array.isArray(body.defects) || !Array.isArray(body.graph?.nodes) || !Array.isArray(body.graph?.edges)) {
    throw new TypeError("software inventory commitment requires catalog, defects, and graph sequences");
  }
  const catalog = commitSequence("software-inventory.catalog", body.catalog);
  const defects = commitSequence("software-inventory.defects", body.defects);
  const graphNodes = commitSequence("software-inventory.graph-nodes", body.graph.nodes);
  const graphEdges = commitSequence("software-inventory.graph-edges", body.graph.edges);
  const headerCarrier = addressJsonCarrier("software-inventory.header", {
    kind: body.kind,
    version: body.version,
    schema: body.schema,
    root: body.root,
    rootBinding: body.rootBinding,
    observation: body.observation,
    chart: { mediaType: body.chart.mediaType, bytes: body.chart.bytes, niUri: body.chart.niUri },
  });
  const commitment = Object.freeze({
    kind: "SoftwareInventoryCommitment",
    version: 1,
    header: headerCarrier.niUri,
    catalog,
    defects,
    graphNodes,
    graphEdges,
  });
  return Object.freeze({ commitment, addressedBundle: addressSemanticJson(commitment) });
}

function pathTerritory(path) {
  const framed = `/${path}/`;
  if (/\/(?:legacy|archive|_archive)\//u.test(framed)) return "archive";
  if (/\/(?:\.tmp|recovery)\//u.test(framed)) return "recovery";
  if (/\/(?:dist|release|releases)\//u.test(framed)) return "release";
  if (/\/(?:node_modules|vendor)\//u.test(framed)) return "vendor";
  if (/\/(?:\.cache|\.pnpm-store)\//u.test(framed)) return "cache";
  return "source-candidate";
}

/**
 * The territory's submodule facts: parsed from supplied `.gitmodules` and staged-entry text, or
 * observed through the code-development engine, whose worktree may enclose the territory, and kept
 * to the declarations and gitlinks inside it, their paths relative to it.
 */
function readGitFacts(root, supplied = {}) {
  const defects = [];
  let modules = [];
  let gitlinks = [];
  if (supplied.gitmodulesText !== undefined || supplied.gitlinksText !== undefined) {
    modules = parseGitmodules(supplied.gitmodulesText ?? "");
    gitlinks = parseGitlinks(supplied.gitlinksText ?? "");
  } else {
    try {
      const territory = realpathSync(root);
      const observed = observeGitSubmodules({ repository: territory });
      const inside = (entries) => entries.flatMap((entry) => {
        const path = slash(relative(territory, resolve(observed.repository, entry.path)));
        return path === "" || path === ".." || path.startsWith("../") ? [] : [{ ...entry, path }];
      });
      modules = inside(observed.declarations);
      gitlinks = inside(observed.gitlinks);
    } catch (error) {
      defects.push({ kind: "gitlink-observation-failure", detail: error.message });
    }
  }
  const { declarationsWithoutGitlink, gitlinksWithoutDeclaration } = compareSubmodules(modules, gitlinks);
  for (const entry of gitlinksWithoutDeclaration) defects.push({ kind: "orphan-gitlink", path: entry.path, commit: entry.commit });
  for (const entry of declarationsWithoutGitlink) defects.push({ kind: "declared-submodule-without-gitlink", path: entry.path, url: entry.url });
  return { modules, gitlinks, defects };
}

export function renderSoftwareInventoryDot(graph) {
  const carrier = createGraph({
    nodes: graph.nodes.map(({ id, kind, label }) => ({ id, data: { kind, label } })),
    edges: graph.edges.map(({ from, to, relation }) => ({ from, to, kind: relation })),
  });
  return toDot(carrier, {
    label: "software_inventory",
    rankdir: "LR",
    nodeLabel: (node) => `${node.data.kind}: ${node.data.label}`,
    edgeLabel: (edge) => edge.kind,
  });
}

function deriveGraph(rootAddress, catalog) {
  const nodes = [{ id: rootAddress, kind: "inventory-root", label: "observed root" }];
  const edges = [];
  for (const entry of catalog) {
    nodes.push({ id: entry.semanticToken, kind: entry.kind, label: entry.key });
    edges.push({ from: rootAddress, to: entry.semanticToken, relation: "contains-observation" });
  }
  const deploymentByName = new Map(catalog.filter((entry) => entry.kind === "deployment-unit").map((entry) => [basename(entry.key), entry.semanticToken]));
  for (const entry of catalog.filter((candidate) => candidate.kind === "systemd-unit")) {
    const deployment = deploymentByName.get(entry.value.name);
    if (deployment !== undefined) edges.push({ from: deployment, to: entry.semanticToken, relation: "records-live-unit" });
  }
  const unitsByFingerprint = Map.groupBy(catalog.filter((entry) => entry.kind === "systemd-unit"), (entry) => entry.value.inventoryFingerprint);
  for (const inventory of catalog.filter((entry) => entry.kind === "systemd-inventory")) {
    for (const unit of unitsByFingerprint.get(inventory.value.inventoryFingerprint) ?? []) {
      edges.push({ from: inventory.semanticToken, to: unit.semanticToken, relation: "inventory-snapshot-projects" });
    }
  }
  nodes.sort((left, right) => compare(left.id, right.id));
  edges.sort((left, right) => compare(`${left.from}\0${left.to}\0${left.relation}`, `${right.from}\0${right.to}\0${right.relation}`));
  return Object.freeze({ nodes: Object.freeze(nodes), edges: Object.freeze(edges) });
}

export async function inventorySoftware(options = {}) {
  const optionsVerdict = validateSchemaInstance({ instance: options, schema: SOFTWARE_INVENTORY_OPTIONS_SCHEMA });
  if (!optionsVerdict.ok) throw new TypeError(`software inventory options failed schema validation: ${JSON.stringify(optionsVerdict.errors)}`);
  const {
  root,
  rootBinding,
  excludes = [".git", "node_modules", ".pnpm-store"],
  digestFiles = true,
  gitmodulesText,
  gitlinksText,
  systemdInventory,
  systemdInventories,
  systemdSourceBinding,
  systemdHost,
  } = options;
  if (typeof root !== "string" || root.length === 0) throw new TypeError("root is required");
  if (typeof digestFiles !== "boolean") throw new TypeError("digestFiles must be a boolean");
  const absoluteRoot = resolve(root);
  const binding = canonicalJson({
    source: rootBinding?.source ?? null,
    owner: rootBinding?.owner ?? null,
    classification: rootBinding?.classification ?? "unclassified",
  });
  if (!(binding.source === null || typeof binding.source === "string") || !(binding.owner === null || typeof binding.owner === "string") || !ROOT_CLASSIFICATIONS.has(binding.classification)) {
    throw new TypeError("rootBinding must use string-or-null source and owner plus a recognized classification");
  }
  const [walk, diskPackages, npmDiscovery, git] = await Promise.all([
    walkPosixPaths({ root: absoluteRoot, excludes, digest: digestFiles }),
    observeDiskPackages({ root: absoluteRoot, excludes }),
    discoverPackages({ root: absoluteRoot, ignoreDirectoryNames: excludes }),
    readGitFacts(absoluteRoot, { gitmodulesText, gitlinksText }),
  ]);
  if (systemdInventory !== undefined && systemdInventories !== undefined) throw new TypeError("supply systemdInventory or systemdInventories, not both");
  const observedSystemd = systemdInventories
    ?? (systemdInventory !== undefined
      ? [systemdInventory]
      : systemdHost !== undefined
        ? [observeUnitInventory(systemdHost, { run: runSystemctl })]
        : []);
  if (!Array.isArray(observedSystemd)) throw new TypeError("systemdInventories must be an array");
  const systemd = observedSystemd.map((inventory) => {
    const normalized = normalizeSystemdInventory(inventory);
    const stableRows = (rows) => rows.map(canonicalJson).sort((left, right) => compare(JSON.stringify(left), JSON.stringify(right)));
    const observedRows = { units: stableRows(inventory.units), timers: stableRows(inventory.timers) };
    const snapshotCarrier = addressJsonCarrier("systemd-user-inventory-snapshot", observedRows);
    const inventoryFingerprint = addressSemanticJson({ kind: "systemd-user-inventory-snapshot-commitment", carrier: snapshotCarrier.niUri }).token;
    const suppliedBinding = inventory.sourceBinding ?? systemdSourceBinding ?? null;
    const sourceBinding = suppliedBinding === null ? null : canonicalJson({
      source: suppliedBinding.source ?? null,
      owner: suppliedBinding.owner ?? null,
      classification: suppliedBinding.classification ?? "unclassified",
      aliases: [...(suppliedBinding.aliases ?? [])].sort(compare),
    });
    if (sourceBinding !== null && (!(typeof sourceBinding.source === "string" && sourceBinding.source) || !(sourceBinding.owner === null || typeof sourceBinding.owner === "string") || !ROOT_CLASSIFICATIONS.has(sourceBinding.classification) || sourceBinding.aliases.some((alias) => typeof alias !== "string" || !alias))) {
      throw new TypeError("systemd source binding must carry a source, string-or-null owner, recognized classification, and string aliases");
    }
    return { ...normalized, observedRows, inventoryFingerprint, sourceBinding };
  }).sort((left, right) => compare(`${left.inventoryFingerprint}\0${left.host}`, `${right.inventoryFingerprint}\0${right.host}`));
  const catalog = [];
  catalog.push(catalogEntry("observation-source-binding", absoluteRoot, { root: absoluteRoot, ...binding }));
  catalog.push(catalogEntry("filesystem-observation", absoluteRoot, {
    root: absoluteRoot,
    entries: walk.files.length,
    directories: walk.directories,
    excluded: walk.excluded,
    exclusionPatterns: [...excludes].sort(compare),
    digested: digestFiles,
  }));
  for (const pattern of [...excludes].sort(compare)) catalog.push(catalogEntry("filesystem-exclusion-policy", pattern, { pattern, matchedRoots: null }));
  for (const entry of walk.files) {
    let rawAddress;
    if (digestFiles) {
      const bytes = entry.kind === "symlink"
        ? Buffer.from(await readlink(resolve(absoluteRoot, entry.path)), "utf8")
        : await readFile(resolve(absoluteRoot, entry.path));
      rawAddress = makeNiUri(bytes);
    }
    catalog.push(catalogEntry("filesystem-entry", entry.path, { ...entry, territory: pathTerritory(entry.path) }, rawAddress));
  }
  for (const entry of diskPackages.packages) catalog.push(catalogEntry("npm-package", `${entry.name}@${entry.version}:${entry.path}`, entry));
  for (const entry of npmDiscovery.found) catalog.push(catalogEntry("npm-release-candidate", `${entry.name}@${entry.version}:${slash(relative(absoluteRoot, entry.directory)) || "."}`, { ...entry, directory: slash(relative(absoluteRoot, entry.directory)) || "." }));
  for (const entry of git.modules) catalog.push(catalogEntry("gitmodule", entry.path, entry));
  for (const entry of git.gitlinks) catalog.push(catalogEntry("gitlink", entry.path, entry));
  for (const inventory of systemd) {
    catalog.push(catalogEntry("systemd-inventory", inventory.host, {
      host: inventory.host,
      inventoryFingerprint: inventory.inventoryFingerprint,
      sourceBinding: inventory.sourceBinding,
      observedRows: inventory.observedRows,
    }));
  }
  const receiverUnits = new Map();
  for (const inventory of systemd) {
    for (const entry of [...inventory.units, ...inventory.timers]) {
      if (typeof entry.name !== "string" || !/\.(?:service|timer)$/u.test(entry.name)) continue;
      const key = `${inventory.inventoryFingerprint}:${entry.kind}:${entry.name}`;
      const current = receiverUnits.get(key) ?? { inventoryFingerprint: inventory.inventoryFingerprint, observedThrough: [], ...entry };
      current.observedThrough.push(inventory.host);
      current.observedThrough.sort(compare);
      receiverUnits.set(key, current);
    }
  }
  for (const [key, entry] of [...receiverUnits].sort(([left], [right]) => compare(left, right))) catalog.push(catalogEntry("systemd-unit", key, entry));
  const deploymentPaths = walk.files.filter((entry) => entry.kind === "file" && UNIT_SUFFIX.test(entry.path) && entry.path.includes("data/records/systemd-unit-records/"));
  for (const entry of deploymentPaths) {
    const bytes = await readFile(resolve(absoluteRoot, entry.path));
    catalog.push(catalogEntry("deployment-unit", entry.path, { bytes: bytes.length }, makeNiUri(bytes)));
  }
  const defects = [
    ...(binding.classification === "unclassified" ? [{ kind: "unclassified-observation-root", path: absoluteRoot }] : []),
    ...(!digestFiles ? [{ kind: "undigested-filesystem-observation", path: absoluteRoot }] : []),
    ...systemd.filter((inventory) => inventory.sourceBinding === null).map((inventory) => ({ kind: "unbound-systemd-source", observedThrough: inventory.host, inventoryFingerprint: inventory.inventoryFingerprint })),
    ...diskPackages.defects.map((entry) => ({ kind: "disk-package-defect", ...entry })),
    ...npmDiscovery.collisions.map((entry) => ({ kind: "npm-release-collision", ...entry })),
    ...git.defects,
  ].map(canonicalJson).sort((left, right) => compare(JSON.stringify(left), JSON.stringify(right)));
  catalog.sort((left, right) => compare(`${left.kind}\0${left.key}\0${left.semanticToken}`, `${right.kind}\0${right.key}\0${right.semanticToken}`));
  const rootCommitment = addressSemanticJson({ kind: "software-inventory-root", root: absoluteRoot, binding });
  const graph = deriveGraph(rootCommitment.token, catalog);
  const dot = renderSoftwareInventoryDot(graph);
  const body = canonicalJson({
    kind: "SoftwareInventory",
    version: 1,
    schema: SOFTWARE_INVENTORY_SCHEMA.$id,
    root: absoluteRoot,
    rootBinding: binding,
    observation: {
      files: walk.files.length,
      directories: walk.directories,
      excluded: walk.excluded,
      diskPackages: diskPackages.packages.length,
      releaseCandidates: npmDiscovery.found.length,
      gitmodules: git.modules.length,
      gitlinks: git.gitlinks.length,
      systemdInventories: systemd.length,
      systemdObservedRows: systemd.reduce((count, inventory) => count + inventory.units.length + inventory.timers.length, 0),
      systemdReceiverUnits: receiverUnits.size,
      deploymentUnits: deploymentPaths.length,
    },
    defects,
    catalog,
    graph,
    chart: { mediaType: "text/vnd.graphviz", bytes: Buffer.byteLength(dot), niUri: makeNiUri(Buffer.from(dot, "utf8")), text: dot },
  });
  const { commitment, addressedBundle } = commitSoftwareInventory(body);
  const result = Object.freeze({ ...body, commitment, addressedBundle });
  const outputVerdict = validateSoftwareInventoryJson(softwareInventoryJson(result));
  if (!outputVerdict.ok) throw new TypeError(`software inventory output failed schema validation: ${JSON.stringify(outputVerdict.errors)}`);
  return result;
}

export function softwareInventoryJson(inventory) {
  const normalize = (value) => {
    if (ArrayBuffer.isView(value)) return { base64: Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString("base64") };
    if (Array.isArray(value)) return value.map(normalize);
    if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, normalize(child)]));
    return value;
  };
  return normalize(inventory);
}

export function validateSoftwareInventoryJson(inventory) {
  return validateSchemaInstance({ instance: inventory, schema: SOFTWARE_INVENTORY_SCHEMA });
}
