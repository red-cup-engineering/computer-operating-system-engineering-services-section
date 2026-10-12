// process.ts — the aperiodic process model.
//
// A process is a working-system that settles to a FIXED POINT in aperiodic time. There is NO clock.
// Settling is Knaster–Tarski: iterate the load→settle spine, monotonically accumulating rows under
// the bilattice knowledge order, until the section stops moving. A process value is the truth meet
// of its judgments (their conjunction, Obsmetrologia meetTList).
//
// A process has:
//   id    — the entity its trace folds on (the MPU subject)
//   rows  — its append-only datom trace (working state)
//   judge — a pure strategy (proc, world) → Iterable<{name, value: reading, reason?, path?}>
//
// This module is PURE: it imports only the MPU (for folding) and the data layer's truth meet.
// It bakes in NO domain: which judgments a process raises is the caller's, passed as `judge`.

import { knowledgeReading } from "@red-cup-engineering/signcell/cell";
import { KnowledgeBase } from "@red-cup-engineering/signcraft/knowledge-base";
import { at, chuSpace } from "@red-cup-engineering/metrologic/chu";
import { readingOfTruth, truthMeetAll, truthMeetReading, isTruthTop } from "@red-cup-engineering/computer-data-engineering-services-section/four";

// ── types ────────────────────────────────────────────────────────────────────────────────────────

/** A datom: a single fact asserted (or retracted) about an entity at a time. */

/** A process judgment: one reading verdict with provenance. */

/** A process's judge strategy: maps (process, world) to an iterable of judgments. */

/** A process: its id, append-only trace, judge strategy, and order/dispatch faces. */

/** The section of a process: cells bucketed by their settled reading. */

/** A folded process: the process plus its settled section. */

/** A settled process: the folded process plus its composite reading. */

export const PROCESS_CARRIER_STATES = Object.freeze([
  "present",
  "admitted",
  "denied",
  "unsettled",
  "contradicted",
]);

// ── core operations ──────────────────────────────────────────────────────────────────────────────

let nextId = 1;

/** Create a process. Provides a stable auto-increment id if none given. */
export function createProcess(input) {
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
export function processId(proc) {
  if (typeof proc === "string") return proc;
  if ("id" in proc) return proc.id;
  return proc.process.id;
}

export function processPoint(processOrId) {
  const id = processId(processOrId);
  if (!id) throw new TypeError("processPoint: process id is required");
  return `process:${id}`;
}

export function idOfProcessPoint(point) {
  return point.startsWith("process:") ? point.slice(8) : null;
}

export function judgmentState(name) {
  if (typeof name !== "string" || name.length === 0) {
    throw new TypeError("judgmentState: judgment name is required");
  }
  return `judgment:${name}`;
}

export function nameOfJudgmentState(state) {
  return state.startsWith("judgment:") ? state.slice(9) : null;
}

/** Fold a process's trace through a knowledge base and return its settled section. */
export function foldProcess(proc) {
  const kb = new KnowledgeBase();
  for (const row of proc.rows) {
    if (String(row.e) !== proc.id) continue;
    if (row.op === "retract") kb.deny(row.e, row.a, row.v);
    else kb.articulate(row.e, row.a, row.v);
  }

  const claims = kb.claimsFor(proc.id).map((told) => ({ claim: told.predicate, object: told.object, reading: knowledgeReading(told) }));
  const affirmed = [];
  const denied = [];
  const contradicted = [];

  for (const c of claims) {
    if (c.reading === "potential") affirmed.push({ claim: c.claim, object: c.object });
    else if (c.reading === "active") denied.push({ claim: c.claim, object: c.object });
    else if (c.reading === "stable") contradicted.push({ claim: c.claim, object: c.object });
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
  world,
  proc,
  opts

 = {},
) {
  const resolved = resolveProc(world, proc);
  const derive = opts.derive ?? null;
  const maxFolds = opts.maxFolds ?? 1024;

  let current = resolved;
  let section = { affirmed: [], denied: [], contradicted: [] };
  let prevKey = null;
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
        reading: "absurd",
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
  const value = truthMeetAll(judgments.map((j) => j.value));

  return {
    kind: "process.settled",
    process: current,
    section,
    value,
    quiesced: true,
    judgments,
    ready: isTruthTop(value),
    denied: value === "active",
    contradicted: value === "stable",
    unsettled: value === "absurd",
  };
}

/** Read the settled value and its buckets off an already-settled (or raw) process. */
export function readProcessValue(
  proc,
  opts = {},
)

 {
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
  processes = [],
  opts = {},
) {
  const settled = normalizeProcessList(processes)
    .map((process) => (isSettled(process) ? process : settleProcess(opts.world ?? null, process, opts)));
  const points = settled.map((process) => processPoint(process));
  const judgmentStates = [
    ...new Set(settled.flatMap((process) => process.judgments.map((judgment) => judgmentState(judgment.name)))),
  ].sort();
  const states = Object.freeze([...PROCESS_CARRIER_STATES, ...judgmentStates]);
  const byId = new Map(settled.map((process) => [processId(process), process]));

  return chuSpace(points, states, (point, state) => {
    const id = idOfProcessPoint(point);
    const process = id === null ? null : byId.get(id);
    if (!process) return "absurd";
    const judgmentName = nameOfJudgmentState(state);
    if (judgmentName !== null) return foldNamedJudgment(process.judgments, judgmentName);
    switch (state) {
      case "present":
        return "potential";
      case "admitted":
        return readingOfTruth(process.ready);
      case "denied":
        return readingOfTruth(process.denied);
      case "unsettled":
        return readingOfTruth(process.unsettled);
      case "contradicted":
        return readingOfTruth(process.contradicted);
      default:
        return "absurd";
    }
  });
}

export function processProjection(
  processOrInput,
  opts = {},
)

 {
  const settled = isSettled(processOrInput) ? processOrInput : settleProcess(opts.world ?? null, processOrInput, opts);
  const carrier = processCarrier([settled]);
  const point = processPoint(settled);
  return Object.freeze({
    id: processId(settled),
    point,
    value: settled.value,
    judgmentCount: settled.judgments.length,
    present: at(carrier, point, "present") === "potential",
    admitted: at(carrier, point, "admitted") === "potential",
    denied: at(carrier, point, "denied") === "potential",
    unsettled: at(carrier, point, "unsettled") === "potential",
    contradicted: at(carrier, point, "contradicted") === "potential",
  });
}

// ── internal helpers ─────────────────────────────────────────────────────────────────────────────

function isSettled(x) {
  return (x).kind === "process.settled";
}

function normalizeProcessList(
  processes,
) {
  if (typeof processes === "string" || isProcessLike(processes) || isSettled(processes)) return [processes];
  return [...processes];
}

function isProcessLike(value) {
  return !!value && typeof value === "object" && typeof (value).id === "string" && Array.isArray((value).rows);
}

function foldNamedJudgment(judgments, name) {
  const values = judgments.filter((judgment) => judgment.name === name).map((judgment) => judgment.value);
  return values.length ? truthMeetAll(values) : "absurd";
}

function resolveProc(world, proc) {
  if (typeof proc === "object") return proc;
  const reg = (world)?.processes;
  if (reg instanceof Map) { const p = reg.get(proc); if (p) return p; }
  else if (reg && typeof reg === "object") {
    const p = (reg)[proc];
    if (p) return p;
  }
  return { id: proc, rows: [] };
}

function readJudgments(proc, world, opts) {
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

function sectionJudgment(proc) {
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

function sectionKey(s) {
  const cells = (tag, list) =>
    list.map((c) => `${tag}:${String(c.claim)}=${JSON.stringify(c.object)}`).sort();
  return JSON.stringify([...cells("a", s.affirmed), ...cells("d", s.denied), ...cells("c", s.contradicted)]);
}

function readinessCone(claims) {
  return Object.freeze({
    kind: "process.readiness-cone",
    points: Object.freeze(claims.map((claim) => claim.point)),
    states: Object.freeze([...new Set(claims.flatMap((claim) => claim.witnesses))]),
    claims: Object.freeze([...claims]),
  });
}

function readinessClaims(id, rows, section) {
  return Object.freeze([
    ...section.affirmed.map((cell) => readinessClaim(id, rows, cell, "potential")),
    ...section.denied.map((cell) => readinessClaim(id, rows, cell, "active")),
    ...section.contradicted.map((cell) => readinessClaim(id, rows, cell, "stable")),
  ]);
}

function readinessClaim(
  id,
  rows,
  cell,
  value,
) {
  return Object.freeze({
    point: readinessPoint(id, cell.claim, cell.object),
    claim: cell.claim,
    object: cell.object,
    value,
    witnesses: Object.freeze(witnessesForCell(id, rows, cell)),
  });
}

function readinessPoint(id, claim, object) {
  return `process:${id}:cell:${String(claim)}=${JSON.stringify(object)}`;
}

function witnessesForCell(
  id,
  rows,
  cell,
) {
  return rows
    .filter((row) => String(row.e) === id && sameCell(row.a, cell.claim) && sameCell(row.v, cell.object))
    .map((row) => row.t);
}

function sameCell(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

// ── ProcessRuntime — a simple in-memory process registry ────────────────────────────────────────

export class ProcessRuntime {
  processes = new Map();

  constructor(processes = []) {
    for (const process of processes) this.spawn(process);
  }

  spawn(input) {
    const proc = createProcess(input);
    this.processes.set(proc.id, proc);
    return proc;
  }

  get(id) {
    return this.processes.get(id) ?? null;
  }

  settle(
    proc,
    opts,
  ) {
    if (typeof proc === "string") {
      const registered = this.get(proc);
      if (!registered) throw new TypeError(`ProcessRuntime.settle: unknown process ${proc}`);
      return settleProcess(this, registered, opts ?? {});
    }
    return settleProcess(this, proc, opts ?? {});
  }

  update(proc) {
    this.processes.set(proc.id, proc);
  }

  carrier() {
    return processCarrier(this.processes.values(), { world: this });
  }

  projection(processOrId) {
    return processProjection(this.settle(processOrId), { world: this });
  }

  // The truth meet of two readings: the conjunction judgments settle under.
  static truthMeet = truthMeetReading;
}

export const processRuntime = new ProcessRuntime();
