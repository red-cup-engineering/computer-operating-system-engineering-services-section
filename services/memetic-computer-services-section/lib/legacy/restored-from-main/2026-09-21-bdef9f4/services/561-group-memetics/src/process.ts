// process.ts — the aperiodic process model.
//
// A process is a working-system that settles to a FIXED POINT in aperiodic time. There is NO clock.
// Settling is Knaster–Tarski: iterate the load→settle spine, monotonically accumulating rows under
// the bilattice knowledge order, until the section stops moving. A process value is the MemeCharge
// of its judgments through the admissibility chain.
//
// A process has:
//   id    — the entity its trace folds on (the MPU subject)
//   rows  — its append-only datom trace (working state)
//   judge — a pure strategy (proc, world) → Iterable<{name, value: MemeCharge, reason?, path?}>
//
// This module is PURE: it imports only the MPU (for folding) and the charge.ts admissibility chain.
// It bakes in NO domain: which judgments a process raises is the caller's, passed as `judge`.

import { Mpu } from "@561-group/memetic-processing-unit";
import {
  createMemeChargeCarrier,
  foldCharges,
  isAdmitted,
  meetAdmissibility,
  type MemeCharge,
  type MemeChargeCarrier,
} from "./charge.ts";

// ── types ────────────────────────────────────────────────────────────────────────────────────────

/** A datom: a single fact asserted (or retracted) about an entity at a time. */
export type Row = {
  e: string;
  a: unknown;
  v: unknown;
  t: unknown;
  op?: "assert" | "retract";
};

/** A process judgment: one MemeCharge verdict with provenance. */
export type Judgment = {
  name: string;
  value: MemeCharge;
  reason: string;
  path: string;
};

/** A process's judge strategy: maps (process, world) to an iterable of judgments. */
export type Judge = (proc: Process, world: unknown) => Iterable<Partial<Judgment> & { value: MemeCharge }>;

/** A process: its id, append-only trace, judge strategy, and order/dispatch faces. */
export type Process = {
  id: string;
  rows: readonly Row[];
  judge?: Judge;
  after?: readonly string[];
  metadata?: Readonly<Record<string, unknown>>;
};

/** The section of a process: cells bucketed by their settled MemeCharge. */
export type Section = {
  affirmed: ReadonlyArray<{ claim: unknown; object: unknown }>;
  denied: ReadonlyArray<{ claim: unknown; object: unknown }>;
  contradicted: ReadonlyArray<{ claim: unknown; object: unknown }>;
};

export type ReadinessClaim = {
  point: string;
  claim: unknown;
  object: unknown;
  value: MemeCharge;
  witnesses: readonly unknown[];
};

export type ProcessReadinessCone = {
  kind: "process.readiness-cone";
  points: readonly string[];
  states: readonly unknown[];
  claims: readonly ReadinessClaim[];
};

export type ProcessResidue = {
  kind: "process.residue";
  condition: "resource-exhausted";
  cells: readonly ReadinessClaim[];
  witnesses: readonly unknown[];
  cone: ProcessReadinessCone;
};

/** A folded process: the process plus its settled section. */
export type FoldedProcess = {
  process: Process;
  section: Section;
};

/** A settled process: the folded process plus its composite charge. */
export type SettledProcess = FoldedProcess & {
  kind: "process.settled";
  value: MemeCharge;
  quiesced: boolean;
  judgments: readonly Judgment[];
  ready: boolean;
  denied: boolean;
  contradicted: boolean;
  unsettled: boolean;
  fault?: {
    condition: string;
    maxFolds: number;
    charge?: MemeCharge;
    witnesses?: readonly unknown[];
  };
  condition?: string;
  residue?: ProcessResidue;
  cone?: ProcessReadinessCone;
  claims?: readonly ReadinessClaim[];
};

export const PROCESS_CARRIER_STATES = Object.freeze([
  "present",
  "admitted",
  "denied",
  "unsettled",
  "contradicted",
] as const);

export type ProcessCarrierState = typeof PROCESS_CARRIER_STATES[number] | `judgment:${string}`;

// ── core operations ──────────────────────────────────────────────────────────────────────────────

let nextId = 1;

/** Create a process. Provides a stable auto-increment id if none given. */
export function createProcess(input?: string | Partial<Process>): Process {
  if (typeof input === "string") return { id: input, rows: [] };
  const id = input?.id ?? `proc-${nextId++}`;
  return {
    id,
    rows: input?.rows ?? [],
    ...(input?.judge !== undefined ? { judge: input.judge } : {}),
    ...(input?.after !== undefined ? { after: input.after } : {}),
    ...(input?.metadata !== undefined ? { metadata: input.metadata } : {}),
  };
}

/** The id of a process (tolerates string, Process, or SettledProcess). */
export function processId(proc: string | { id: string } | { process: { id: string } }): string {
  if (typeof proc === "string") return proc;
  if ("id" in proc) return proc.id;
  return proc.process.id;
}

export function processPoint(processOrId: string | { id: string } | { process: { id: string } }): string {
  const id = processId(processOrId);
  if (!id) throw new TypeError("processPoint: process id is required");
  return `process:${id}`;
}

export function idOfProcessPoint(point: string): string | null {
  return point.startsWith("process:") ? point.slice(8) : null;
}

export function judgmentState(name: string): `judgment:${string}` {
  if (typeof name !== "string" || name.length === 0) {
    throw new TypeError("judgmentState: judgment name is required");
  }
  return `judgment:${name}`;
}

export function nameOfJudgmentState(state: string): string | null {
  return state.startsWith("judgment:") ? state.slice(9) : null;
}

/** Fold a process's trace through the MPU and return its settled section. */
export function foldProcess(proc: Process): FoldedProcess {
  const mpu = new Mpu();
  for (const row of proc.rows) {
    if (String(row.e) !== proc.id) continue;
    if (row.op === "retract") mpu.deny(row.e, row.a, row.v);
    else mpu.articulate(row.e, row.a, row.v);
  }

  const claims = mpu.claimsFor(proc.id);
  const affirmed: Array<{ claim: unknown; object: unknown }> = [];
  const denied: Array<{ claim: unknown; object: unknown }> = [];
  const contradicted: Array<{ claim: unknown; object: unknown }> = [];

  for (const c of claims) {
    if (c.memeCharge === "potential") affirmed.push({ claim: c.claim, object: c.object });
    else if (c.memeCharge === "active") denied.push({ claim: c.claim, object: c.object });
    else if (c.memeCharge === "stable") contradicted.push({ claim: c.claim, object: c.object });
    // absurd cells are not witnessed — absent from claimsFor, correctly omitted
  }

  return { process: proc, section: { affirmed, denied, contradicted } };
}

/** Settle ONE process to its Knaster–Tarski fixed point. No clock — the iteration is monotone.
 *
 * opts.derive(proc, section, world) may produce new rows to append before the next fold.
 * opts.judge overrides the process's own judge. opts.maxFolds caps the iteration.
 */
export function settleProcess(
  world: unknown,
  proc: Process | string,
  opts: {
    judge?: Judge;
    derive?: (proc: Process, section: Section, world: unknown) => readonly Row[];
    maxFolds?: number;
    allowVacuous?: boolean;
  } = {},
): SettledProcess {
  const resolved = resolveProc(world, proc);
  const derive = opts.derive ?? null;
  const maxFolds = opts.maxFolds ?? 1024;

  let current = resolved;
  let section: Section = { affirmed: [], denied: [], contradicted: [] };
  let prevKey: string | null = null;
  let quiesced = false;

  for (let step = 0; step < maxFolds; step++) {
    const folded = foldProcess(current);
    section = folded.section;
    const key = sectionKey(section);
    if (key === prevKey) { quiesced = true; break; }
    prevKey = key;
    if (!derive) { quiesced = true; break; }
    const next = derive(current, section, world);
    if (next.length === 0) { quiesced = true; break; }
    current = { ...current, rows: [...current.rows, ...next] };
  }

  if (!quiesced) {
    const claims = readinessClaims(current.id, current.rows, section);
    const cone = readinessCone(claims);
    return {
      kind: "process.settled",
      process: current,
      section,
      value: "absurd",
      quiesced: false,
      judgments: [],
      ready: false,
      denied: false,
      contradicted: false,
      unsettled: true,
      condition: "resource-exhausted",
      fault: {
        condition: "resource-exhausted",
        maxFolds,
        charge: "absurd",
        witnesses: cone.states,
      },
      residue: Object.freeze({
        kind: "process.residue",
        condition: "resource-exhausted",
        cells: claims,
        witnesses: cone.states,
        cone,
      }),
      cone,
      claims,
    };
  }

  const judgments = readJudgments(current, world, opts);
  const value = foldCharges(judgments.map((j) => j.value));

  return {
    kind: "process.settled",
    process: current,
    section,
    value,
    quiesced: true,
    judgments,
    ready: isAdmitted(value),
    denied: value === "active",
    contradicted: value === "stable",
    unsettled: value === "absurd",
  };
}

/** Read the settled value and its buckets off an already-settled (or raw) process. */
export function readProcessValue(
  proc: Process | SettledProcess,
  opts: { world?: unknown; judge?: Judge } = {},
): {
  affirmations: ReadonlyArray<{ claim: unknown; object: unknown }>;
  denials: ReadonlyArray<{ claim: unknown; object: unknown }>;
  contradicted: ReadonlyArray<{ claim: unknown; object: unknown }>;
  value: MemeCharge;
  ready: boolean;
  unsettled: boolean;
  cone: ProcessReadinessCone;
  claims: readonly ReadinessClaim[];
} {
  const settled = isSettled(proc) ? proc : settleProcess(opts.world ?? null, proc, opts);
  const claims = settled.claims ?? readinessClaims(settled.process.id, settled.process.rows, settled.section);
  const cone = settled.cone ?? readinessCone(claims);
  return {
    affirmations: settled.section.affirmed,
    denials: settled.section.denied,
    contradicted: settled.section.contradicted,
    value: settled.value,
    ready: settled.ready,
    unsettled: settled.unsettled,
    cone,
    claims,
  };
}

export function processCarrier(
  processes: Iterable<Process | SettledProcess | string> | Process | SettledProcess | string = [],
  opts: { world?: unknown; judge?: Judge } = {},
): MemeChargeCarrier<ProcessCarrierState> {
  const settled = normalizeProcessList(processes)
    .map((process) => (isSettled(process) ? process : settleProcess(opts.world ?? null, process, opts)));
  const points = settled.map((process) => processPoint(process));
  const judgmentStates = [
    ...new Set(settled.flatMap((process) => process.judgments.map((judgment) => judgmentState(judgment.name)))),
  ].sort();
  const states: readonly ProcessCarrierState[] = Object.freeze([...PROCESS_CARRIER_STATES, ...judgmentStates]);
  const byId = new Map(settled.map((process) => [processId(process), process]));

  return createMemeChargeCarrier(points, states, (point, state) => {
    const id = idOfProcessPoint(point);
    const process = id === null ? null : byId.get(id);
    if (!process) return "absurd";
    const judgmentName = nameOfJudgmentState(state);
    if (judgmentName !== null) return foldNamedJudgment(process.judgments, judgmentName);
    switch (state) {
      case "present":
        return "potential";
      case "admitted":
        return chargeOf(process.ready);
      case "denied":
        return chargeOf(process.denied);
      case "unsettled":
        return chargeOf(process.unsettled);
      case "contradicted":
        return chargeOf(process.contradicted);
      default:
        return "absurd";
    }
  });
}

export function processProjection(
  processOrInput: Process | SettledProcess | string,
  opts: { world?: unknown; judge?: Judge } = {},
): Readonly<{
  id: string;
  point: string;
  value: MemeCharge;
  judgmentCount: number;
  present: boolean;
  admitted: boolean;
  denied: boolean;
  unsettled: boolean;
  contradicted: boolean;
}> {
  const settled = isSettled(processOrInput) ? processOrInput : settleProcess(opts.world ?? null, processOrInput, opts);
  const carrier = processCarrier([settled]);
  const point = processPoint(settled);
  return Object.freeze({
    id: processId(settled),
    point,
    value: settled.value,
    judgmentCount: settled.judgments.length,
    present: carrier.at(point, "present") === "potential",
    admitted: carrier.at(point, "admitted") === "potential",
    denied: carrier.at(point, "denied") === "potential",
    unsettled: carrier.at(point, "unsettled") === "potential",
    contradicted: carrier.at(point, "contradicted") === "potential",
  });
}

// ── internal helpers ─────────────────────────────────────────────────────────────────────────────

function isSettled(x: unknown): x is SettledProcess {
  return (x as SettledProcess).kind === "process.settled";
}

function normalizeProcessList(
  processes: Iterable<Process | SettledProcess | string> | Process | SettledProcess | string,
): Array<Process | SettledProcess | string> {
  if (typeof processes === "string" || isProcessLike(processes) || isSettled(processes)) return [processes];
  return [...processes];
}

function isProcessLike(value: unknown): value is Process {
  return !!value && typeof value === "object" && typeof (value as Process).id === "string" && Array.isArray((value as Process).rows);
}

function foldNamedJudgment(judgments: readonly Judgment[], name: string): MemeCharge {
  const values = judgments.filter((judgment) => judgment.name === name).map((judgment) => judgment.value);
  return values.length ? foldCharges(values) : "absurd";
}

function chargeOf(value: boolean): MemeCharge {
  return value ? "potential" : "active";
}

function resolveProc(world: unknown, proc: Process | string): Process {
  if (typeof proc === "object") return proc;
  const reg = (world as { processes?: unknown } | null)?.processes;
  if (reg instanceof Map) { const p = reg.get(proc); if (p) return p as Process; }
  else if (reg && typeof reg === "object") {
    const p = (reg as Record<string, unknown>)[proc];
    if (p) return p as Process;
  }
  return { id: proc, rows: [] };
}

function readJudgments(proc: Process, world: unknown, opts: { judge?: Judge }): readonly Judgment[] {
  const judge = opts.judge ?? proc.judge ?? null;
  if (judge) {
    return [...judge(proc, world)].map((j) => ({
      name: typeof j.name === "string" ? j.name : "judgment",
      value: j.value,
      reason: typeof j.reason === "string" ? j.reason : "",
      path: typeof j.path === "string" ? j.path : "",
    }));
  }
  return [sectionJudgment(proc)];
}

function sectionJudgment(proc: Process): Judgment {
  const { section } = foldProcess(proc);
  if (section.contradicted.length) {
    return { name: "section", value: "stable", reason: `${section.contradicted.length} contradicted cell(s) held`, path: "" };
  }
  if (!section.affirmed.length && section.denied.length) {
    return { name: "section", value: "active", reason: "section denied", path: "" };
  }
  if (!section.affirmed.length && !section.denied.length) {
    return { name: "section", value: "absurd", reason: "section empty (unsettled)", path: "" };
  }
  return { name: "section", value: "potential", reason: "section affirmed", path: "" };
}

function sectionKey(s: Section): string {
  const cells = (tag: string, list: ReadonlyArray<{ claim: unknown; object: unknown }>) =>
    list.map((c) => `${tag}:${String(c.claim)}=${JSON.stringify(c.object)}`).sort();
  return JSON.stringify([...cells("a", s.affirmed), ...cells("d", s.denied), ...cells("c", s.contradicted)]);
}

function readinessCone(claims: readonly ReadinessClaim[]): ProcessReadinessCone {
  return Object.freeze({
    kind: "process.readiness-cone",
    points: Object.freeze(claims.map((claim) => claim.point)),
    states: Object.freeze([...new Set(claims.flatMap((claim) => claim.witnesses))]),
    claims: Object.freeze([...claims]),
  });
}

function readinessClaims(id: string, rows: readonly Row[], section: Section): readonly ReadinessClaim[] {
  return Object.freeze([
    ...section.affirmed.map((cell) => readinessClaim(id, rows, cell, "potential")),
    ...section.denied.map((cell) => readinessClaim(id, rows, cell, "active")),
    ...section.contradicted.map((cell) => readinessClaim(id, rows, cell, "stable")),
  ]);
}

function readinessClaim(
  id: string,
  rows: readonly Row[],
  cell: { claim: unknown; object: unknown },
  value: MemeCharge,
): ReadinessClaim {
  return Object.freeze({
    point: readinessPoint(id, cell.claim, cell.object),
    claim: cell.claim,
    object: cell.object,
    value,
    witnesses: Object.freeze(witnessesForCell(id, rows, cell)),
  });
}

function readinessPoint(id: string, claim: unknown, object: unknown): string {
  return `process:${id}:cell:${String(claim)}=${JSON.stringify(object)}`;
}

function witnessesForCell(
  id: string,
  rows: readonly Row[],
  cell: { claim: unknown; object: unknown },
): unknown[] {
  return rows
    .filter((row) => String(row.e) === id && sameCell(row.a, cell.claim) && sameCell(row.v, cell.object))
    .map((row) => row.t);
}

function sameCell(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

// ── ProcessRuntime — a simple in-memory process registry ────────────────────────────────────────

export class ProcessRuntime {
  processes: Map<string, Process> = new Map();

  constructor(processes: Iterable<string | Partial<Process>> = []) {
    for (const process of processes) this.spawn(process);
  }

  spawn(input?: string | Partial<Process>): Process {
    const proc = createProcess(input);
    this.processes.set(proc.id, proc);
    return proc;
  }

  get(id: string): Process | null {
    return this.processes.get(id) ?? null;
  }

  settle(
    proc: Process | string,
    opts?: { judge?: Judge; derive?: (proc: Process, section: Section, world: unknown) => readonly Row[] },
  ): SettledProcess {
    if (typeof proc === "string") {
      const registered = this.get(proc);
      if (!registered) throw new TypeError(`ProcessRuntime.settle: unknown process ${proc}`);
      return settleProcess(this, registered, opts ?? {});
    }
    return settleProcess(this, proc, opts ?? {});
  }

  update(proc: Process): void {
    this.processes.set(proc.id, proc);
  }

  carrier(): MemeChargeCarrier<ProcessCarrierState> {
    return processCarrier(this.processes.values(), { world: this });
  }

  projection(processOrId: Process | string): ReturnType<typeof processProjection> {
    return processProjection(this.settle(processOrId), { world: this });
  }

  // Folded admissibility meet across two charges — exposed for callers who need it.
  static meetAdmissibility = meetAdmissibility;
}

export const processRuntime = new ProcessRuntime();
