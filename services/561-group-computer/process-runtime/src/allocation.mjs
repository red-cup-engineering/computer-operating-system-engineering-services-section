// allocation — ALLOCATION places a process at a modal-world typed-path, and the process ACCESSIBILITY
// + ORDER relations that say which process a process may pass control to and which must settle first.
//
// ARCHITECTURE CONTRACT (L9 process): allocation = placing a process at a modal-world typed-path.
// A "modal world" is a possible-world the process inhabits; the process's address in that world is a
// TYPED-PATH (the typed-filepath-addressing-system codec). accessibleFrom is the Kripke accessibility
// relation between processes (the "next" a process may reach); orderProcess is the happens-before
// (a process's `after` set, the dependencies that must settle first). Both are PURE reads/writes over
// the process value; they touch no disk. Lifted from apps/tools/swarm/src/dispatch.mjs (the
// selection/ordering of next work) and the work dependsOn → readiness edge — the ORDER structure,
// generalized off swarm's work-kind taxonomy (which stays in swarm).

import { address } from "@red-cup-engineering/computer/typed-filepath-addressing-system/addressing";
import { processSubject } from "./process.mjs";

// allocateProcess(proc, world, principal, accountable) — place a process at a typed-path in a modal
// world. The principal is the office/agent ON WHOSE BEHALF the process runs (the delegate); the
// accountable is the office that ANSWERS for it (H^0-invariant under delegation-chain extension — the
// kyriarchical accountability the corpus names). The allocation is a NEW face on the process, not a
// mutation of the world: it returns the process annotated with { allocation }, where the address is
// the process's term addressed under the modal world's root at the process EAVT (jsonl) type.
//
// `world` supplies the modal-world root: world.root (a filesystem root) and an optional world.modal
// name (the possible-world label). The typed-path is address(root, term, "jsonl") — the same EAVT
// address the term-memory system writes to, so a process is allocated exactly where its trace lives.
export function allocateProcess(proc, world, principal, accountable) {
  const id = processSubject(proc);
  if (typeof id !== "string" || !id) throw new TypeError("allocateProcess: process must have a string id");
  const root = world?.root ?? world?.memoryRoot ?? ".";
  const modal = world?.modal ?? world?.name ?? "actual";
  const term = `processes/${modal}/${id}`;
  const path = address(root, term, "jsonl");
  return Object.freeze({
    ...proc,
    allocation: Object.freeze({
      kind: "process.allocation",
      modal,                         // the modal world this placement is in
      term,                          // the term that names the process in that world
      path,                          // the typed-path (EAVT/jsonl address) the process is placed at
      principal: principal ?? proc?.principal ?? "",      // on whose behalf (the delegate)
      accountable: accountable ?? proc?.accountable ?? principal ?? "", // who answers (H^0-invariant)
      root,
    }),
  });
}

// accessibleFrom(proc, next) — the Kripke accessibility relation: may control pass from `proc` to
// `next`? Control is accessible exactly when `next` declares `proc` among its `after` (so `proc` is a
// predecessor `next` is waiting on) OR `proc` declares `next` as a successor it hands off to. A
// process with no order relations is terminal — nothing is accessible from it. This is a PURE read
// over the two processes' order faces; it settles nothing.
export function accessibleFrom(proc, next) {
  const from = processSubject(proc);
  const to = processSubject(next);
  if (!from || !to) return false;
  const nextAfter = afterSet(next);
  const procNext = successorSet(proc);
  return nextAfter.has(from) || procNext.has(to);
}

// orderProcess(proc, after[]) — order a process AFTER a set of predecessor processes: the happens-
// before edges this process waits on. Returns the process with its `after` set extended (deduped,
// append-only in spirit — we union, never drop). The settle layer reads this: a process is not ready
// until every predecessor in `after` has settled (precipitateProcesses enforces it). PURE.
export function orderProcess(proc, after = []) {
  const have = afterSet(proc);
  const ids = [].concat(after ?? []).map((p) => processSubject(p) ?? p).filter(Boolean);
  for (const id of ids) have.add(id);
  return Object.freeze({ ...proc, after: [...have].sort() });
}

// afterSet / successorSet — read the order faces off a process. `after` is the predecessors; `next`
// (or `successors`) is the successors a process hands control to. Tolerant of single-value or array.
export function afterSet(proc) {
  return new Set([].concat(proc?.after ?? []).map((p) => processSubject(p) ?? p).filter(Boolean));
}

export function successorSet(proc) {
  return new Set([].concat(proc?.next ?? proc?.successors ?? []).map((p) => processSubject(p) ?? p).filter(Boolean));
}
