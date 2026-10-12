// allocation.ts — process PLACEMENT and ORDER relations.
//
// Allocation places a process at a modal-world address. The order relation (after) declares
// which processes must settle before this one can advance — the happens-before edges that
// drive the aperiodic advance pass. These are PURE reads/writes over process values.

import type { Process } from "./process.ts";
import { processId } from "./process.ts";
import { logPath } from "../../../../../../../../computer-data-engineering-services-section/services/computer-file-engineering-services-section/services/computer-filepath-engineering-services-section/lib/address.mjs";

// ── order relations ───────────────────────────────────────────────────────────────────────────

export type ProcessOrderFace = {
  id: string;
  after?: OneOrMany<string | { id: string }>;
  next?: OneOrMany<string | { id: string }>;
  successors?: OneOrMany<string | { id: string }>;
};

/** The set of predecessor ids this process waits on. */
export function afterSet(proc: Process | ProcessOrderFace): Set<string> {
  return new Set(idsOf((proc as { after?: OneOrMany<string | { id: string }> }).after));
}

/** The set of successor ids this process hands control to. */
export function successorSet(proc: Process | ProcessOrderFace): Set<string> {
  const face = proc as ProcessOrderFace;
  return new Set(idsOf(face.next ?? face.successors));
}

/** Order a process AFTER a set of predecessors. Returns the process with its after-set extended. */
export function orderProcess(proc: Process, after: readonly (string | Process)[] = []): Process {
  const have = afterSet(proc);
  for (const p of after) have.add(processId(p));
  return Object.freeze({ ...proc, after: [...have].sort() });
}

/** Kripke accessibility: may control pass from `from` to `to`? */
export function accessibleFrom(from: Process | ProcessOrderFace, to: Process | ProcessOrderFace): boolean {
  const fromId = processId(from);
  const toId = processId(to);
  if (!fromId || !toId) return false;
  return afterSet(to).has(fromId) || successorSet(from).has(toId);
}

// ── placement ─────────────────────────────────────────────────────────────────────────────────

export type Allocation = {
  kind: "process.allocation";
  modal: string;
  term: string;
  path: string;
  principal: string;
  accountable: string;
  root: string;
};

/** Place a process at a modal-world typed path. Returns the process annotated with its allocation. */
export function allocateProcess(
  proc: Process,
  world?: { root?: string; memoryRoot?: string; modal?: string; name?: string },
  principal?: string,
  accountable?: string,
): Process & { allocation: Allocation } {
  const id = processId(proc);
  if (!id) throw new TypeError("allocateProcess: process must have a string id");
  const root = world?.root ?? world?.memoryRoot ?? ".";
  const modal = world?.modal ?? world?.name ?? "actual";
  const term = `processes/${modal}/${id}`;
  const path = logPath(root, term);
  return Object.freeze({
    ...proc,
    allocation: Object.freeze({
      kind: "process.allocation",
      modal,
      term,
      path,
      principal: principal ?? (proc as Process & { principal?: string }).principal ?? "",
      accountable: accountable ?? principal ?? (proc as Process & { accountable?: string }).accountable ?? "",
      root,
    }),
  });
}

type OneOrMany<T> = T | Iterable<T>;

function idsOf(value: OneOrMany<string | { id: string }> | undefined): string[] {
  if (value === undefined) return [];
  const list = typeof value === "string" || isIdObject(value) ? [value] : [...value];
  return list.map((item) => (typeof item === "string" ? item : item.id)).filter(Boolean);
}

function isIdObject(value: unknown): value is { id: string } {
  return !!value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string";
}
