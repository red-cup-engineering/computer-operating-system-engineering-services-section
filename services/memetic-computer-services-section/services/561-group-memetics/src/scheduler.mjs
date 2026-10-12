// scheduler.ts — many processes settling together: the aperiodic advance pass.
//
// A process is a concurrent STRATEGY. settleProcesses is the PARALLEL composition: each process
// settles to its own fixed point independently (receptivity), and the order edges are the only
// coupling (orderProcess / accessibleFrom). advanceProcesses partitions the settled board by the
// composite reading AND the order relation. No clock: the pass is order-driven.
//
// Composition axioms that make this well-defined without a clock:
//   receptivity       — a process reacts only to settled predecessors
//   innocence         — it settles from its own trace, not the scheduler's path
//   symmetry-invariance — the board is invariant under reordering independent processes

import { composeAndReopen } from "@red-cup-engineering/signgraph/paths";
import { chuSpace } from "@red-cup-engineering/metrologic/chu";

import { createProcess, settleProcess, processId, readProcessValue } from "./process.mjs";
import { afterSet } from "./allocation.mjs";
import { readStructuration, selectRegime } from "./governance.mjs";
import { readingOfTruth } from "@red-cup-engineering/computer-data-engineering-services-section/four";

export const KERNEL_INSTANT_KIND = "kernel.scheduler.instant";
export const SCHEDULED_PROCESS_KIND = "kernel.scheduler.process";
export const SCHEDULE_DECISION_KIND = "kernel.scheduler.decision";
export const SYSCALL_TRAP_KIND = "kernel.scheduler.syscall-trap";

export const TIME_CARRIER_STATES = Object.freeze([
  "finite",
  "limit",
  "past",
  "current",
  "future",
  "wall-clock",
]);

export const SCHEDULE_CARRIER_STATES = Object.freeze([
  "scheduled",
  "due",
  "runnable",
  "blocked",
  "sleeping",
  "contradicted",
]);

export function createKernelInstant(input = {}) {
  const source = typeof input === "number" ? { tick: input } : input;
  const tick = finiteTick(source.tick ?? numericOrdinal(source.ordinal) ?? 0);
  const ordinal = source.ordinal ?? tick;
  const label = source.label ?? String(tick);
  return Object.freeze({
    kind: KERNEL_INSTANT_KIND,
    ordinal,
    tick,
    label,
    wallTime: source.wallTime ?? null,
    witness: Object.freeze({
      source: "@561-group/memetics/scheduler",
      rule: "aperiodic-kernel-instant",
      ...(source.witness ?? {}),
    }),
  });
}

export function instantOf(value) {
  return isKernelInstant(value) ? value : createKernelInstant(value);
}

export function compareInstants(left, right) {
  const a = instantOf(left);
  const b = instantOf(right);
  if (a.tick !== b.tick) return a.tick < b.tick ? -1 : 1;
  return a.label.localeCompare(b.label);
}

export const instantPoint = (instant) =>
  `instant:${instantOf(instant).label}`;

export class KernelClock {
  instant;

  constructor(input = 0) {
    this.instant = instantOf(input);
  }

  now() {
    return this.instant;
  }

  tick(options = {}) {
    const requestedStep = options.step;
    const step = typeof requestedStep === "number" && Number.isInteger(requestedStep) && requestedStep > 0 ? requestedStep : 1;
    const witness = options.witness === undefined ? this.instant.witness : options.witness;
    this.instant = createKernelInstant({
      tick: this.instant.tick + step,
      ordinal: this.instant.tick + step,
      wallTime: options.wallTime ?? this.instant.wallTime,
      witness,
    });
    return this.instant;
  }

  at(input = 0) {
    this.instant = instantOf(input);
    return this.instant;
  }

  carrier(instants = [this.instant]) {
    return timeCarrier(instants, this.instant);
  }
}

export function timeCarrier(
  instants = [],
  now = 0,
) {
  const current = instantOf(now);
  const list = [...instants].map(instantOf).sort(compareInstants);
  const points = list.map(instantPoint);
  const byPoint = new Map(list.map((instant) => [instantPoint(instant), instant]));
  return chuSpace(points, TIME_CARRIER_STATES, (point, state) => {
    const instant = byPoint.get(point);
    if (!instant) return "absurd";
    const cmp = compareInstants(instant, current);
    switch (state) {
      case "finite":
        return readingOfTruth(Number.isFinite(instant.tick));
      case "limit":
        return readingOfTruth(!Number.isFinite(instant.tick));
      case "past":
        return readingOfTruth(cmp < 0);
      case "current":
        return readingOfTruth(cmp === 0);
      case "future":
        return readingOfTruth(cmp > 0);
      case "wall-clock":
        return readingOfTruth(instant.wallTime !== null);
    }
  });
}

export function scheduleProcess(
  processOrInput,
  options = {},
) {
  const process = asProcess(processOrInput);
  const source = process;
  const notBefore = (options.notBefore ?? source.notBefore ?? 0);
  return Object.freeze({
    kind: SCHEDULED_PROCESS_KIND,
    process,
    notBefore: instantOf(notBefore),
    quantum: integerOr(options.quantum ?? source.quantum, 1),
    priority: integerOr(options.priority ?? source.priority, 0),
    syscall: options.syscall ?? source.syscall ?? null,
  });
}

export function scheduleItemOf(value) {
  return isScheduledProcess(value) ? value : scheduleProcess(value);
}

export function schedulePoint(value) {
  return `process:${processId(scheduleItemOf(value).process)}`;
}

export function scheduleCarrier(
  items = [],
  now = 0,
  options = {},
) {
  const current = instantOf(now);
  const completed = new Set([...(options.completed ?? [])].map(String));
  const decisionOptions = options.judge === undefined
    ? { world: options.world }
    : { world: options.world, judge: options.judge };
  const decisions = [...items]
    .map((item) => scheduleDecision(item, current, completed, decisionOptions))
    .sort((a, b) => compareScheduled(a.item, b.item));
  const points = decisions.map((decision) => schedulePoint(decision.item));
  const byPoint = new Map(decisions.map((decision) => [schedulePoint(decision.item), decision]));

  return chuSpace(points, SCHEDULE_CARRIER_STATES, (point, state) => {
    const decision = byPoint.get(point);
    if (!decision) return "absurd";
    switch (state) {
      case "scheduled":
        return "potential";
      case "due":
        return readingOfTruth(decision.due);
      case "runnable":
        return readingOfTruth(decision.runnable);
      case "blocked":
        return readingOfTruth(decision.blocked);
      case "sleeping":
        return readingOfTruth(decision.sleeping);
      case "contradicted":
        return readingOfTruth(decision.contradicted);
    }
  });
}

export function scheduleDecision(
  itemOrInput,
  now = 0,
  completed = new Set(),
  options = {},
) {
  const item = scheduleItemOf(itemOrInput);
  const current = instantOf(now);
  const settleOpts = options.judge === undefined ? {} : { judge: options.judge };
  const settled = settleProcess(options.world ?? null, item.process, settleOpts);
  const due = compareInstants(item.notBefore, current) <= 0;
  const predecessorsReady = [...afterSet(item.process)].every((id) => completed.has(String(id)));
  const contradicted = settled.contradicted;
  const runnable = due && predecessorsReady && settled.ready;
  return Object.freeze({
    kind: SCHEDULE_DECISION_KIND,
    item,
    process: item.process,
    settled,
    now: current,
    due,
    sleeping: !due,
    predecessorsReady,
    contradicted,
    blocked: !runnable && !contradicted && due,
    runnable,
  });
}

export function scheduleProcesses(
  items = [],
  options

 = {},
) {
  const now = instantOf(options.now ?? 0);
  const completed = new Set([...(options.completed ?? [])].map(String));
  const decisionOptions = options.judge === undefined
    ? { world: options.world }
    : { world: options.world, judge: options.judge };
  const decisions = items
    .map((item) => scheduleDecision(item, now, completed, decisionOptions))
    .sort((a, b) => compareScheduled(a.item, b.item));
  const runnable = decisions.filter((decision) => decision.runnable);
  const requestedLimit = options.limit;
  const limit = typeof requestedLimit === "number" && Number.isInteger(requestedLimit) && requestedLimit >= 0 ? requestedLimit : runnable.length;
  return Object.freeze({
    kind: "kernel.scheduler.run-queue",
    now,
    runnable: Object.freeze(runnable.slice(0, limit)),
    sleeping: Object.freeze(decisions.filter((decision) => decision.sleeping)),
    blocked: Object.freeze(decisions.filter((decision) => decision.blocked)),
    contradicted: Object.freeze(decisions.filter((decision) => decision.contradicted)),
    decisions: Object.freeze(decisions),
  });
}

export function syscallTrap(
  processOrInput,
  syscall,
  args = [],
  options = {},
) {
  const process = asProcess(processOrInput);
  const instant = instantOf(options.at ?? options.now ?? 0);
  const name = String(syscall ?? "");
  const t = instant.label;
  const frozenArgs = Object.freeze([...args]);
  const rows = Object.freeze([
    Object.freeze({ e: process.id, a: "syscall", v: name, t }),
    Object.freeze({ e: process.id, a: "syscall-ordinal", v: instant.label, t }),
    Object.freeze({ e: process.id, a: "syscall-args", v: frozenArgs, t }),
  ]);
  return Object.freeze({
    kind: SYSCALL_TRAP_KIND,
    process,
    syscall: name,
    args: frozenArgs,
    instant,
    rows,
  });
}

// ── settle a set ──────────────────────────────────────────────────────────────────────────────

/** Settle a set of processes, each to its own fixed point. Records the governing regime. */
export function settleProcesses(
  world,
  procs,
  regimeSelector,
  opts = {},
) {
  return procs.map((proc) => {
    const p = isSettled(proc) ? proc.process : proc;
    const settled = settleProcess(world, p, opts);
    const structuration = readStructuration(p);
    const regime = selectRegime(structuration, regimeSelector, opts.defaultRegime);
    return Object.freeze({ ...settled, structuration, regime });
  });
}

// ── advance pass ─────────────────────────────────────────────────────────────────────────────

/** One aperiodic advance pass over a world's processes. No clock: order-driven.
 *
 * Partitions:
 *   dispatched   — potential (t) and every predecessor already settled-ready
 *   blocked      — potential but a predecessor is still pending, or active (f)
 *   contradicted — stable (⊤): held contradiction, surfaced on its own
 *   settled      — the whole board (audit)
 */
export function advanceProcesses(
  world,
  regimeSelector,
  opts = {},
) {
  const procs = worldProcesses(world, opts);
  const settled = settleProcesses(world, procs, regimeSelector, opts);
  const ready = readySet(settled);

  const dispatched = [];
  const blocked = [];
  const contradicted = [];

  for (const s of settled) {
    const v = s.value;
    if (v === "stable") { contradicted.push(s); continue; }
    const preds = afterSet(s.process);
    const predecessorsReady = [...preds].every((p) => ready.has(p));
    if (v === "potential" && predecessorsReady) dispatched.push(s);
    else blocked.push(s);
  }

  return Object.freeze({
    kind: "process.advance",
    dispatched: Object.freeze(dispatched),
    settled: Object.freeze(settled),
    blocked: Object.freeze(blocked),
    contradicted: Object.freeze(contradicted),
    counts: Object.freeze({
      dispatched: dispatched.length,
      blocked: blocked.length,
      contradicted: contradicted.length,
      settled: settled.length,
    }),
  });
}

// ── residue ──────────────────────────────────────────────────────────────────────────────────

/** The processes that did NOT reach a settled-ready fixed point this pass (value ⊥ or ⊤).
 * These re-enter the next advance pass; nothing is discarded. */
export function precipitateUnsettled(procs) {
  const residue = procs.filter((s) => s.value === "absurd" || s.value === "stable");
  const kernelResidue = precipitateOrderResidue(residue);
  const voidReading = Object.freeze(residue.map(voidReadingOf));
  return Object.freeze({
    kind: "process.precipitate",
    residue: Object.freeze(residue),
    unsettled: Object.freeze(residue.filter((s) => s.value === "absurd")),
    contradicted: Object.freeze(residue.filter((s) => s.value === "stable")),
    kernelResidue: Object.freeze(kernelResidue.map((seq) => Object.freeze([...seq]))),
    void: voidReading,
    gap: voidReading,
  });
}

function precipitateOrderResidue(residue) {
  const apex = [];
  for (const settled of residue) {
    for (const predecessor of afterSet(settled.process)) {
      apex.push({ subject: predecessor, predicate: "before", object: processId(settled.process) });
    }
  }
  try {
    return composeAndReopen(apex).residue;
  } catch {
    return [];
  }
}

function voidReadingOf(settled) {
  const cells = voidCellsOf(settled);
  return Object.freeze({
    id: processId(settled.process),
    value: settled.value,
    settled: Object.freeze(cells),
  });
}

function voidCellsOf(settled) {
  const claims = settled.residue?.cells ?? settled.claims ?? readProcessValue(settled).claims;
  return Object.freeze(claims
    .filter((claim) => claim.value === "absurd" || claim.value === "stable" || settled.unsettled)
    .map(voidCellOf));
}

function voidCellOf(claim) {
  return Object.freeze({
    predicate: claim.claim,
    object: claim.object,
    value: claim.value,
    witnesses: Object.freeze([...claim.witnesses]),
  });
}

// ── evidence conservation ─────────────────────────────────────────────────────────────────────

/** Audit that a fold conserved the evidence of its inputs: evidence is linear, never dropped. */
export function conserveEvidence(
  before,
  after,
) {
  const beforeIds = collectEvidence(before);
  const afterIds = collectEvidence(after);
  const missing = [...beforeIds].filter((id) => !afterIds.has(id));
  return Object.freeze({
    kind: "process.conservation",
    conserved: missing.length === 0,
    missing: Object.freeze(missing),
    before: beforeIds.size,
    after: afterIds.size,
  });
}

// ── internal ─────────────────────────────────────────────────────────────────────────────────

function isSettled(p) {
  return (p).kind === "process.settled";
}

function readySet(settled) {
  return new Set(settled.filter((s) => s.value === "potential").map((s) => processId(s.process)));
}

function worldProcesses(world, opts) {
  if (opts.procs) return opts.procs;
  if (Array.isArray(world?.processList)) return world.processList;
  const reg = world?.processes;
  if (!reg) return [];
  if (reg instanceof Map) return [...(reg).values()];
  if (Array.isArray(reg)) return reg;
  return Object.values(reg);
}

function asProcess(value) {
  if (typeof value === "object" && value !== null && typeof value.id === "string" && Array.isArray(value.rows)) {
    return value;
  }
  return createProcess(value);
}

function isKernelInstant(value) {
  return !!value && typeof value === "object" && (value).kind === KERNEL_INSTANT_KIND;
}

function isScheduledProcess(value) {
  return !!value && typeof value === "object" && (value).kind === SCHEDULED_PROCESS_KIND;
}

function finiteTick(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.trunc(value));
  return 0;
}

function numericOrdinal(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function integerOr(value, fallback) {
  return Number.isInteger(value) ? Number(value) : fallback;
}

function compareScheduled(left, right) {
  const byTime = compareInstants(left.notBefore, right.notBefore);
  if (byTime !== 0) return byTime;
  if (left.priority !== right.priority) return right.priority - left.priority;
  return processId(left.process).localeCompare(processId(right.process));
}

function collectEvidence(x) {
  const ids = new Set();
  const visit = (node) => {
    if (!node) return;
    if (Array.isArray(node)) { for (const n of node) visit(n); return; }
    if (typeof node !== "object") return;
    const n = node;
    if (n["rows"]) visit(n["rows"]);
    if (n["process"]) visit(n["process"]);
    if (n["section"]) {
      const s = n["section"];
      for (const c of [...s.affirmed, ...s.denied, ...s.contradicted]) absorb(c, ids);
    }
  };
  visit(x);
  return ids;
}

function absorb(cell, ids) {
  if (!cell) return;
  const c = cell;
  if (c["claim"]) ids.add(`${String(c["claim"])}:${JSON.stringify(c["object"])}`);
}
