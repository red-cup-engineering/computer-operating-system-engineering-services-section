// seed-systemd-services — seeds one machine's desired-vs-observed systemd --user service state
// into world.eavt: constitutes each service located-in its machine, asserts the record's desired
// "running", and appends observed "stopped" wherever the live read disagrees — the two claims
// fold to a held ⊤ exactly where desired and observed diverge. Run: node scripts/seed-systemd-
// services.mjs [recordPath] [tracePath] (defaults below; overridable by argv or env vars).

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { constitute } from "@red-cup-engineering/eavt-services-section/constitute-entity";
import { appendEavtRow } from "@red-cup-engineering/eavt-services-section/append-eavt-row";
import { readEavtEntries } from "@red-cup-engineering/eavt-services-section/read-eavt-entries";
import { entities } from "@red-cup-engineering/eavt-services-section/list-entities";
import { foldEavtEvidence } from "@red-cup-engineering/eavt-services-section/fold-eavt-evidence";
import { supersedeEavtRows } from "@red-cup-engineering/eavt-services-section/supersede-eavt-rows";
import { observeUnitInventory } from "@red-cup-engineering/systemd-unit-inventory-observation-service";
import { runSystemctl } from "@red-cup-engineering/systemd-unit-inventory-observation-service/run-systemctl";

// Repo root: walk up from this file until a directory holding .git is found — no hardcoded
// absolute path, so this script works from any checkout location. The same tiny utility as
// FeltOS's scripts/seed-world.mjs carries (each mjs script under this repo's ad hoc
// convention of walking to its own repo root rather than sharing one dependency for it).
function findRepoRoot(startDir) {
  let dir = startDir;
  for (;;) {
    if (existsSync(path.join(dir, ".git"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error("seed-systemd-services: could not find repo root (no .git above " + startDir + ")");
    dir = parent;
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = findRepoRoot(__dirname);

const DEFAULT_RECORD_PATH = path.join(
  repoRoot,
  "lib/emsenn/services/561-group/services/561-group-services-section/data/records/2026-08-31-bare-cedar-fog-desired-services.json",
);
// The world trace is DEPLOY's (computer-deployment-engine's), not this script's own app
// root's — LAGOON is the one seat licensed to hold world state; this script only seeds it.
const DEFAULT_TRACE_PATH = path.join(
  repoRoot,
  "lib/emsenn/services/561-group/services/engineering-services-section/services/computer-engineering-services-section/services/computer-systems-engineering-services-section/services/computer-operating-system-services-section/apps/computer-deployment-engine/data/state/world-state/world.eavt",
);

const recordPath = process.argv[2] || process.env.SEED_SYSTEMD_SERVICES_RECORD_PATH || DEFAULT_RECORD_PATH;
const tracePath = process.argv[3] || process.env.LAGOON_WORLD_TRACE_PATH || DEFAULT_TRACE_PATH;

/**
 * Reads a {machine, services: [{name}, ...]} desired-services record off disk.
 *
 * @param {string} p Path to the JSON record.
 * @returns {object} The parsed record.
 * @throws {TypeError} When the record has no "services" array.
 */
function loadRecord(p) {
  const record = JSON.parse(readFileSync(p, "utf8"));
  if (!Array.isArray(record.services)) throw new TypeError(`seed-systemd-services: record at ${p} has no "services" array`);
  return record;
}

/**
 * An entity's genesis "constituted" cell object, mirroring FeltOS Flatfile's world attributes.
 *
 * @param {string} address Entity address to fold.
 * @param {Array<object>} rows EAVT rows already in hand.
 * @returns {object|undefined} The genesis row's attributes object, or undefined.
 */
function attributesOf(address, rows) {
  return foldEavtEvidence({ subject: address, rows }).fiber.find((c) => c.predicate === "constituted")?.object;
}

/**
 * The already-constituted entity addresses on disk, generalizing seed-world.mjs's own
 * existingGenesisAddresses technique to a plain scan for a==="constituted" rows.
 *
 * @param {Array<object>} rows EAVT rows already in hand.
 * @returns {Set<string>} The set of already-constituted addresses.
 */
function existingGenesisAddresses(rows) {
  const addresses = new Set();
  for (const row of rows) if (row.a === "constituted") addresses.add(row.e);
  return addresses;
}

/**
 * Finds a machine entity's address by its "name" attribute.
 *
 * @param {Array<object>} rows EAVT rows already in hand.
 * @param {string} machineName The machine's own "name" attribute to match.
 * @returns {string} The matched machine's address.
 * @throws {Error} When no constituted machine with that name exists on disk.
 */
function findMachineAddress(rows, machineName) {
  const address = entities(rows).find((a) => attributesOf(a, rows)?.name === machineName);
  if (address === undefined) {
    throw new Error(`seed-systemd-services: no constituted machine named ${JSON.stringify(machineName)} on disk at ${tracePath} — run seed-world.mjs first`);
  }
  return address;
}

/**
 * Whether a live systemd unit inventory reports one unit as actually running.
 *
 * @param {object} inventory An observeUnitInventory({host: "local"}) result.
 * @param {string} unitName The unit's own name field to match.
 * @returns {boolean} True iff a matching unit exists and its active state is "active".
 */
function isLiveUnitRunning(inventory, unitName) {
  const unit = inventory.units.find((u) => u.unit === unitName);
  return unit !== undefined && unit.active === "active";
}

/**
 * A plain dedupe check over rows already read — no re-derivation of any address or digest.
 *
 * @param {Array<object>} rows EAVT rows already in hand.
 * @param {string} e Subject to match.
 * @param {string} a Predicate to match.
 * @param {*} v Object to match.
 * @returns {boolean} True iff an identical {e,a,v} row (any t) is already present.
 */
function hasRow(rows, e, a, v) {
  return rows.some((r) => r.e === e && r.a === a && r.v === v);
}

/**
 * The entity's current "stopped" claim via the shipped functional read-lens (supersede): the
 * max-t "stopped" row for THIS entity alone. supersede's own latest-t bookkeeping is keyed by
 * predicate name only (not by entity), so it is fed only this entity's own rows — feeding it the
 * whole trace would silently collapse every OTHER entity's "stopped" history down to a single
 * global latest row, which is wrong.
 *
 * @param {Array<object>} rows EAVT rows already in hand.
 * @param {string} address The entity to check.
 * @returns {object|undefined} The latest "stopped" row for this entity, or undefined if the
 *   predicate was never asserted for it.
 */
export function currentStoppedClaim(rows, address) {
  const entityStoppedRows = rows.filter((r) => r.e === address && r.a === "stopped");
  return supersedeEavtRows({ rows: entityStoppedRows, functionalAttributes: ["stopped"] }).rows[0];
}

/**
 * Seeds one machine's desired-vs-observed systemd --user service state into an on-disk EAVT
 * trace: idempotent, since every append is preceded by a read-back dedupe check.
 *
 * @param {string} recordPath Path to the {machine, services} desired-services JSON record.
 * @param {string} tracePath Path to the on-disk EAVT trace to seed (created if missing).
 * @returns {Array<{kind: string, skipped: boolean, detail: string}>} One entry per row
 *   considered, in order: has-converse, then per service constituted/located-in/running=yes/
 *   stopped — the last always present, skipped when the live read agrees with the entity's
 *   current "stopped" claim (per currentStoppedClaim), otherwise a fresh "stopped"="yes" row
 *   (newly down) or a v:null retraction tombstone (newly running again, superseding the stale
 *   "stopped" claim).
 * @throws {TypeError} When the record's measuredAt or services shape is not usable.
 * @throws {Error} When the record's machine has no constituted entity on disk yet.
 */
export function seed(recordPath, tracePath) {
  const record = loadRecord(recordPath);
  mkdirSync(path.dirname(tracePath), { recursive: true });

  const baseT = Date.parse(record.measuredAt);
  if (Number.isNaN(baseT)) {
    throw new TypeError(`seed-systemd-services: record.measuredAt is not a parseable date: ${JSON.stringify(record.measuredAt)}`);
  }

  let rows = existsSync(tracePath) ? readEavtEntries({ path: tracePath }) : [];
  const machineAddress = findMachineAddress(rows, record.machine);
  const already = existingGenesisAddresses(rows);

  const converseDeclaration = { e: "running", a: "has-converse", v: "stopped", t: baseT };
  const results = [];
  if (hasRow(rows, converseDeclaration.e, converseDeclaration.a, converseDeclaration.v)) {
    results.push({ kind: "has-converse", skipped: true, detail: "running/stopped" });
  } else {
    appendEavtRow({ path: tracePath, row: converseDeclaration });
    rows = [...rows, converseDeclaration];
    results.push({ kind: "has-converse", skipped: false, detail: "running/stopped" });
  }

  const inventory = observeUnitInventory("local", { run: runSystemctl });

  record.services.forEach((entry, index) => {
    const t = baseT + index;
    const { address, genesis: genesisRow } = constitute({ kind: "systemd-service", attributes: { name: entry.name, machine: record.machine }, t });

    if (already.has(address)) {
      results.push({ kind: "constituted", skipped: true, detail: address });
    } else {
      appendEavtRow({ path: tracePath, row: genesisRow });
      rows = [...rows, genesisRow];
      already.add(address);
      results.push({ kind: "constituted", skipped: false, detail: address });
    }

    if (hasRow(rows, address, "located-in", machineAddress)) {
      results.push({ kind: "located-in", skipped: true, detail: entry.name });
    } else {
      const row = { e: address, a: "located-in", v: machineAddress, t };
      appendEavtRow({ path: tracePath, row });
      rows = [...rows, row];
      results.push({ kind: "located-in", skipped: false, detail: entry.name });
    }

    if (hasRow(rows, address, "running", "yes")) {
      results.push({ kind: "running=yes", skipped: true, detail: entry.name });
    } else {
      const row = { e: address, a: "running", v: "yes", t };
      appendEavtRow({ path: tracePath, row });
      rows = [...rows, row];
      results.push({ kind: "running=yes", skipped: false, detail: entry.name });
    }

    const nowStopped = !isLiveUnitRunning(inventory, entry.name);
    const claim = currentStoppedClaim(rows, address);
    const currentlyAssertedStopped = claim !== undefined && claim.v !== null;

    if (nowStopped === currentlyAssertedStopped) {
      results.push({ kind: "stopped", skipped: true, detail: `${entry.name} (unchanged: ${nowStopped ? "stopped" : "running"})` });
    } else if (nowStopped) {
      // fresh testimony: newly stopped. Real wall-clock t, NOT the record's deterministic baseT — a
      // repeated observation is a new fact in time, not a re-derivation of the same one (the
      // architecture's own doctrine: "wall-clock time enters only as testimony").
      const row = { e: address, a: "stopped", v: "yes", t: Date.now() };
      appendEavtRow({ path: tracePath, row });
      rows = [...rows, row];
      results.push({ kind: "stopped", skipped: false, detail: `${entry.name} (now stopped)` });
    } else {
      // fresh testimony: running again. SUPERSEDE the stale "stopped" claim via the shipped
      // retraction tombstone (v: null) — fold's own already-tested retraction handling then excludes
      // every earlier "stopped" row from evidence, so the ⊤ this produced settles.
      const row = { e: address, a: "stopped", v: null, t: Date.now() };
      appendEavtRow({ path: tracePath, row });
      rows = [...rows, row];
      results.push({ kind: "stopped", skipped: false, detail: `${entry.name} (now running — stale stopped claim retracted)` });
    }
  });

  return results;
}

// Only run when invoked directly (so tests or other scripts can import `seed` without side effects).
if (import.meta.url === `file://${process.argv[1]}`) {
  const results = seed(recordPath, tracePath);
  for (const { kind, skipped, detail } of results) {
    console.log(`${skipped ? "skip (already present)" : "appended"}: ${kind} ${detail}`);
  }
}
