// allocation.ts — process PLACEMENT and ORDER relations.
//
// Allocation places a process at a modal-world address. The order relation (after) declares
// which processes must settle before this one can advance — the happens-before edges that
// drive the aperiodic advance pass. These are PURE reads/writes over process values.

import { processId } from "./process.mjs";

// ── order relations ───────────────────────────────────────────────────────────────────────────

/** The set of predecessor ids this process waits on. */
export function afterSet(proc) {
  return new Set(idsOf((proc).after));
}

/** The set of successor ids this process hands control to. */
export function successorSet(proc) {
  const face = proc;
  return new Set(idsOf(face.next ?? face.successors));
}

/** Order a process AFTER a set of predecessors. Returns the process with its after-set extended. */
export function orderProcess(proc, after = []) {
  const have = afterSet(proc);
  for (const p of after) have.add(processId(p));
  return Object.freeze({ ...proc, after: [...have].sort() });
}

/** Kripke accessibility: may control pass from `from` to `to`? */
export function accessibleFrom(from, to) {
  const fromId = processId(from);
  const toId = processId(to);
  if (!fromId || !toId) return false;
  return afterSet(to).has(fromId) || successorSet(from).has(toId);
}

// ── placement ─────────────────────────────────────────────────────────────────────────────────
// allocateProcess itself now lives only at @red-cup-engineering/computer's
// process-runtime, which owns process allocation: its accountability fallback
// (accountable, then the process's own recorded accountable, then principal) is
// the law — the H^0 invariant principal.mjs's delegate() documents and tests
// ("accountable is H^0-invariant under chain extension"), which this package's
// former order (accountable, then principal, then the process's own accountable)
// would have silently broken on re-allocation with a new principal and no
// explicit accountable. Consumers here import it directly from that house name
// rather than through this file — see src/index.mjs and process-runtime.test.mjs.

function idsOf(value) {
  if (value === undefined) return [];
  const list = typeof value === "string" || isIdObject(value) ? [value] : [...value];
  return list.map((item) => (typeof item === "string" ? item : item.id)).filter(Boolean);
}

function isIdObject(value) {
  return !!value && typeof value === "object" && typeof (value).id === "string";
}
