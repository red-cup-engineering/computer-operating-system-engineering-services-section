// scheduler.ts — many processes settling together: the aperiodic advance pass.
//
// A process is a concurrent STRATEGY. settleProcesses is the PARALLEL composition: each process
// settles to its own fixed point independently (receptivity), and the order edges are the only
// coupling (orderProcess / accessibleFrom). advanceProcesses partitions the settled board by the
// composite MemeCharge AND the order relation. No clock: the pass is order-driven.
//
// Composition axioms that make this well-defined without a clock:
//   receptivity       — a process reacts only to settled predecessors
//   innocence         — it settles from its own trace, not the scheduler's path
//   symmetry-invariance — the board is invariant under reordering independent processes

import { precipitate, type PathEdge } from "@561-group/memetic-processing-unit";
import { createMemeChargeCarrier, type MemeCharge, type MemeChargeCarrier } from "./charge.ts";
import type { Process, SettledProcess, Judge, Row, Section, ReadinessClaim } from "./process.ts";
import { createProcess, settleProcess, processId, readProcessValue } from "./process.ts";
import { afterSet } from "./allocation.ts";
import { readStructuration, selectRegime, type Structuration } from "./governance.ts";

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
] as const);
export type TimeCarrierState = typeof TIME_CARRIER_STATES[number];

export const SCHEDULE_CARRIER_STATES = Object.freeze([
  "scheduled",
  "due",
  "runnable",
  "blocked",
  "sleeping",
  "contradicted",
] as const);
export type ScheduleCarrierState = typeof SCHEDULE_CARRIER_STATES[number];

export type KernelInstant = {
  kind: typeof KERNEL_INSTANT_KIND;
  ordinal: unknown;
  tick: number;
  label: string;
  wallTime: string | null;
  witness: Readonly<Record<string, unknown>>;
};

export type ScheduledProcess = {
  kind: typeof SCHEDULED_PROCESS_KIND;
  process: Process;
  notBefore: KernelInstant;
  quantum: number;
  priority: number;
  syscall: unknown;
};

export type ScheduleDecision = {
  kind: typeof SCHEDULE_DECISION_KIND;
  item: ScheduledProcess;
  process: Process;
  settled: SettledProcess;
  now: KernelInstant;
  due: boolean;
  sleeping: boolean;
  predecessorsReady: boolean;
  contradicted: boolean;
  blocked: boolean;
  runnable: boolean;
};

export type RunQueue = {
  kind: "kernel.scheduler.run-queue";
  now: KernelInstant;
  runnable: readonly ScheduleDecision[];
  sleeping: readonly ScheduleDecision[];
  blocked: readonly ScheduleDecision[];
  contradicted: readonly ScheduleDecision[];
  decisions: readonly ScheduleDecision[];
};

export type SyscallTrap = {
  kind: typeof SYSCALL_TRAP_KIND;
  process: Process;
  syscall: string;
  args: readonly unknown[];
  instant: KernelInstant;
  rows: readonly Row[];
};

export function createKernelInstant(input: number | Partial<KernelInstant> = {}): KernelInstant {
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

export function instantOf(value: KernelInstant | number | Partial<KernelInstant>): KernelInstant {
  return isKernelInstant(value) ? value : createKernelInstant(value);
}

export function compareInstants(left: KernelInstant | number | Partial<KernelInstant>, right: KernelInstant | number | Partial<KernelInstant>): number {
  const a = instantOf(left);
  const b = instantOf(right);
  if (a.tick !== b.tick) return a.tick < b.tick ? -1 : 1;
  return a.label.localeCompare(b.label);
}

export const instantPoint = (instant: KernelInstant | number | Partial<KernelInstant>): string =>
  `instant:${instantOf(instant).label}`;

export class KernelClock {
  instant: KernelInstant;

  constructor(input: KernelInstant | number | Partial<KernelInstant> = 0) {
    this.instant = instantOf(input);
  }

  now(): KernelInstant {
    return this.instant;
  }

  tick(options: { step?: number; wallTime?: string | null; witness?: Record<string, unknown> } = {}): KernelInstant {
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

  at(input: KernelInstant | number | Partial<KernelInstant> = 0): KernelInstant {
    this.instant = instantOf(input);
    return this.instant;
  }

  carrier(instants: Iterable<KernelInstant | number | Partial<KernelInstant>> = [this.instant]): MemeChargeCarrier<TimeCarrierState> {
    return timeCarrier(instants, this.instant);
  }
}

export function timeCarrier(
  instants: Iterable<KernelInstant | number | Partial<KernelInstant>> = [],
  now: KernelInstant | number | Partial<KernelInstant> = 0,
): MemeChargeCarrier<TimeCarrierState> {
  const current = instantOf(now);
  const list = [...instants].map(instantOf).sort(compareInstants);
  const points = list.map(instantPoint);
  const byPoint = new Map(list.map((instant) => [instantPoint(instant), instant]));
  return createMemeChargeCarrier(points, TIME_CARRIER_STATES, (point, state) => {
    const instant = byPoint.get(point);
    if (!instant) return "absurd";
    const cmp = compareInstants(instant, current);
    switch (state) {
      case "finite":
        return chargeOf(Number.isFinite(instant.tick));
      case "limit":
        return chargeOf(!Number.isFinite(instant.tick));
      case "past":
        return chargeOf(cmp < 0);
      case "current":
        return chargeOf(cmp === 0);
      case "future":
        return chargeOf(cmp > 0);
      case "wall-clock":
        return chargeOf(instant.wallTime !== null);
    }
  });
}

export function scheduleProcess(
  processOrInput: Process | string | Partial<Process>,
  options: { notBefore?: KernelInstant | number | Partial<KernelInstant>; quantum?: number; priority?: number; syscall?: unknown } = {},
): ScheduledProcess {
  const process = asProcess(processOrInput);
  const source = process as Process & { notBefore?: unknown; quantum?: unknown; priority?: unknown; syscall?: unknown };
  const notBefore = (options.notBefore ?? source.notBefore ?? 0) as KernelInstant | number | Partial<KernelInstant>;
  return Object.freeze({
    kind: SCHEDULED_PROCESS_KIND,
    process,
    notBefore: instantOf(notBefore),
    quantum: integerOr(options.quantum ?? source.quantum, 1),
    priority: integerOr(options.priority ?? source.priority, 0),
    syscall: options.syscall ?? source.syscall ?? null,
  });
}

export function scheduleItemOf(value: ScheduledProcess | Process | string | Partial<Process>): ScheduledProcess {
  return isScheduledProcess(value) ? value : scheduleProcess(value);
}

export function schedulePoint(value: ScheduledProcess | Process | string | Partial<Process>): string {
  return `process:${processId(scheduleItemOf(value).process)}`;
}

export function scheduleCarrier(
  items: Iterable<ScheduledProcess | Process | string | Partial<Process>> = [],
  now: KernelInstant | number | Partial<KernelInstant> = 0,
  options: { completed?: Iterable<unknown>; world?: unknown; judge?: Judge } = {},
): MemeChargeCarrier<ScheduleCarrierState> {
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

  return createMemeChargeCarrier(points, SCHEDULE_CARRIER_STATES, (point, state) => {
    const decision = byPoint.get(point);
    if (!decision) return "absurd";
    switch (state) {
      case "scheduled":
        return "potential";
      case "due":
        return chargeOf(decision.due);
      case "runnable":
        return chargeOf(decision.runnable);
      case "blocked":
        return chargeOf(decision.blocked);
      case "sleeping":
        return chargeOf(decision.sleeping);
      case "contradicted":
        return chargeOf(decision.contradicted);
    }
  });
}

export function scheduleDecision(
  itemOrInput: ScheduledProcess | Process | string | Partial<Process>,
  now: KernelInstant | number | Partial<KernelInstant> = 0,
  completed: Set<string> = new Set(),
  options: { world?: unknown; judge?: Judge } = {},
): ScheduleDecision {
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
  items: readonly (ScheduledProcess | Process | string | Partial<Process>)[] = [],
  options: {
    now?: KernelInstant | number | Partial<KernelInstant>;
    completed?: Iterable<unknown>;
    limit?: number;
    world?: unknown;
    judge?: Judge;
  } = {},
): RunQueue {
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
  processOrInput: Process | string | Partial<Process>,
  syscall: unknown,
  args: Iterable<unknown> = [],
  options: { at?: KernelInstant | number | Partial<KernelInstant>; now?: KernelInstant | number | Partial<KernelInstant> } = {},
): SyscallTrap {
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
  world: unknown,
  procs: readonly (Process | SettledProcess)[],
  regimeSelector?: (s: Structuration) => string,
  opts: { judge?: Judge; defaultRegime?: string } = {},
): ReadonlyArray<SettledProcess & { structuration: Structuration; regime: string }> {
  return procs.map((proc) => {
    const p = isSettled(proc) ? proc.process : proc;
    const settled = settleProcess(world, p, opts);
    const structuration = readStructuration(p);
    const regime = selectRegime(structuration, regimeSelector, opts.defaultRegime);
    return Object.freeze({ ...settled, structuration, regime });
  });
}

// ── advance pass ─────────────────────────────────────────────────────────────────────────────

export type AdvanceResult = {
  kind: "process.advance";
  dispatched: ReadonlyArray<SettledProcess & { structuration: Structuration; regime: string }>;
  settled: ReadonlyArray<SettledProcess & { structuration: Structuration; regime: string }>;
  blocked: ReadonlyArray<SettledProcess & { structuration: Structuration; regime: string }>;
  contradicted: ReadonlyArray<SettledProcess & { structuration: Structuration; regime: string }>;
  counts: Readonly<Record<"dispatched" | "blocked" | "contradicted" | "settled", number>>;
};

/** One aperiodic advance pass over a world's processes. No clock: order-driven.
 *
 * Partitions:
 *   dispatched   — potential (t) and every predecessor already settled-ready
 *   blocked      — potential but a predecessor is still pending, or active (f)
 *   contradicted — stable (⊤): held contradiction, surfaced on its own
 *   settled      — the whole board (audit)
 */
export function advanceProcesses(
  world: { processes?: unknown; processList?: readonly Process[] },
  regimeSelector?: (s: Structuration) => string,
  opts: { procs?: readonly Process[]; defaultRegime?: string; judge?: Judge } = {},
): AdvanceResult {
  const procs = worldProcesses(world, opts);
  const settled = settleProcesses(world, procs, regimeSelector, opts);
  const ready = readySet(settled);

  type Row = (typeof settled)[number];
  const dispatched: Row[] = [];
  const blocked: Row[] = [];
  const contradicted: Row[] = [];

  for (const s of settled) {
    const v: MemeCharge = s.value;
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

export type PrecipitateResult = {
  kind: "process.precipitate";
  residue: readonly SettledProcess[];
  unsettled: readonly SettledProcess[];
  contradicted: readonly SettledProcess[];
  kernelResidue: readonly (readonly unknown[])[];
  void: readonly PrecipitatedVoidReading[];
  gap: readonly PrecipitatedVoidReading[];
};

export type PrecipitatedVoidCell = {
  predicate: unknown;
  object: unknown;
  value: MemeCharge;
  witnesses: readonly unknown[];
};

export type PrecipitatedVoidReading = {
  id: string;
  value: MemeCharge;
  settled: readonly PrecipitatedVoidCell[];
};

/** The processes that did NOT reach a settled-ready fixed point this pass (value ⊥ or ⊤).
 * These re-enter the next advance pass; nothing is discarded. */
export function precipitateUnsettled(procs: readonly SettledProcess[]): PrecipitateResult {
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

function precipitateOrderResidue(residue: readonly SettledProcess[]): readonly (readonly unknown[])[] {
  const apex: PathEdge[] = [];
  for (const settled of residue) {
    for (const predecessor of afterSet(settled.process)) {
      apex.push({ subject: predecessor, predicate: "before", object: processId(settled.process) });
    }
  }
  try {
    return precipitate({ apex }).residue;
  } catch {
    return [];
  }
}

function voidReadingOf(settled: SettledProcess): PrecipitatedVoidReading {
  const cells = voidCellsOf(settled);
  return Object.freeze({
    id: processId(settled.process),
    value: settled.value,
    settled: Object.freeze(cells),
  });
}

function voidCellsOf(settled: SettledProcess): readonly PrecipitatedVoidCell[] {
  const claims = settled.residue?.cells ?? settled.claims ?? readProcessValue(settled).claims;
  return Object.freeze(claims
    .filter((claim) => claim.value === "absurd" || claim.value === "stable" || settled.unsettled)
    .map(voidCellOf));
}

function voidCellOf(claim: ReadinessClaim): PrecipitatedVoidCell {
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
  before: unknown,
  after: unknown,
): { kind: "process.conservation"; conserved: boolean; missing: readonly string[]; before: number; after: number } {
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

function isSettled(p: Process | SettledProcess): p is SettledProcess {
  return (p as SettledProcess).kind === "process.settled";
}

function readySet(settled: ReadonlyArray<SettledProcess>): Set<string> {
  return new Set(settled.filter((s) => s.value === "potential").map((s) => processId(s.process)));
}

function worldProcesses(world: { processes?: unknown; processList?: readonly Process[] }, opts: { procs?: readonly Process[] }): readonly Process[] {
  if (opts.procs) return opts.procs;
  if (Array.isArray(world?.processList)) return world.processList;
  const reg = world?.processes;
  if (!reg) return [];
  if (reg instanceof Map) return [...(reg as Map<string, Process>).values()];
  if (Array.isArray(reg)) return reg;
  return Object.values(reg as Record<string, Process>);
}

function asProcess(value: Process | string | Partial<Process>): Process {
  if (typeof value === "object" && value !== null && typeof value.id === "string" && Array.isArray(value.rows)) {
    return value as Process;
  }
  return createProcess(value as string | Partial<Process>);
}

function isKernelInstant(value: unknown): value is KernelInstant {
  return !!value && typeof value === "object" && (value as KernelInstant).kind === KERNEL_INSTANT_KIND;
}

function isScheduledProcess(value: unknown): value is ScheduledProcess {
  return !!value && typeof value === "object" && (value as ScheduledProcess).kind === SCHEDULED_PROCESS_KIND;
}

function finiteTick(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.trunc(value));
  return 0;
}

function numericOrdinal(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function integerOr(value: unknown, fallback: number): number {
  return Number.isInteger(value) ? Number(value) : fallback;
}

function chargeOf(value: boolean): MemeCharge {
  return value ? "potential" : "active";
}

function compareScheduled(left: ScheduledProcess, right: ScheduledProcess): number {
  const byTime = compareInstants(left.notBefore, right.notBefore);
  if (byTime !== 0) return byTime;
  if (left.priority !== right.priority) return right.priority - left.priority;
  return processId(left.process).localeCompare(processId(right.process));
}

function collectEvidence(x: unknown): Set<string> {
  const ids = new Set<string>();
  const visit = (node: unknown): void => {
    if (!node) return;
    if (Array.isArray(node)) { for (const n of node) visit(n); return; }
    if (typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    if (n["rows"]) visit(n["rows"]);
    if (n["process"]) visit(n["process"]);
    if (n["section"]) {
      const s = n["section"] as Section;
      for (const c of [...s.affirmed, ...s.denied, ...s.contradicted]) absorb(c, ids);
    }
  };
  visit(x);
  return ids;
}

function absorb(cell: unknown, ids: Set<string>): void {
  if (!cell) return;
  const c = cell as Record<string, unknown>;
  if (c["claim"]) ids.add(`${String(c["claim"])}:${JSON.stringify(c["object"])}`);
}
