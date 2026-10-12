// syscall.ts — process -> kernel request -> settled response.
//
// Syscalls are admitted by the same reading chain as processes. Dispatch records a scheduler trap,
// resolves by name or number, settles entry judgments, and normalizes handler returns.

import { chuSpace } from "@red-cup-engineering/metrologic/chu";

import { instantOf, syscallTrap } from "./scheduler.mjs";

import { createProcess, processId } from "./process.mjs";
import { readingOfTruth, truthMeetAll } from "@red-cup-engineering/computer-data-engineering-services-section/four";

// ── types ─────────────────────────────────────────────────────────────────────────────────────

export const SYSCALL_ENTRY_KIND = "kernel.syscall.entry";
export const SYSCALL_TABLE_KIND = "kernel.syscall.table";
export const SYSCALL_DISPATCH_KIND = "kernel.syscall.dispatch";

export const SYSCALL_CARRIER_STATES = Object.freeze([
  "registered",
  "numbered",
  "implemented",
  "admitted",
  "denied",
  "unsettled",
  "contradicted",
]);

export const DISPATCH_CARRIER_STATES = Object.freeze([
  "dispatched",
  "trapped",
  "admitted",
  "succeeded",
  "failed",
  "unimplemented",
  "contradicted",
]);

// ── entry settlement ──────────────────────────────────────────────────────────────────────────

export function syscallName(value) {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "string") throw new TypeError("syscallName: syscall name is required");
  if (value.name !== undefined && value.name !== null && String(value.name).length > 0) return String(value.name);
  throw new TypeError("syscallName: syscall name is required");
}

export function syscallNumber(value) {
  if (value.number === undefined || value.number === null) return null;
  if (!Number.isInteger(value.number) || Number(value.number) < 0) {
    throw new TypeError("syscallNumber: syscall number must be a non-negative integer");
  }
  return Number(value.number);
}

export function syscallPoint(value) {
  const number = typeof value === "string" ? null : syscallNumber(value);
  return number === null ? `syscall:${syscallName(value)}` : `syscall:${number}:${syscallName(value)}`;
}

export function createSyscallEntry(input = {}) {
  const source = typeof input === "string" ? { name: input } : input;
  const name = syscallName(source);
  const number = syscallNumber(source);
  const handler = typeof source.handler === "function" ? source.handler : null;
  const judgments = [...(source.judgments ?? [{ name: "registered", value: "potential" }])].map(normalizeJudgment);
  return Object.freeze({
    kind: SYSCALL_ENTRY_KIND,
    name,
    number,
    handler,
    judgments: Object.freeze(judgments),
    metadata: Object.freeze({ ...(source.metadata ?? {}) }),
    governance: Object.freeze({ ...(source.governance ?? {}) }),
    resources: Object.freeze({ ...(source.resources ?? {}) }),
    provenance: Object.freeze({
      source: "@561-group/memetics/syscall",
      ...(source.provenance ?? {}),
    }),
  });
}

export function settleSyscallEntry(entryOrInput) {
  const entry = isSyscallEntry(entryOrInput) ? entryOrInput : createSyscallEntry(entryOrInput);
  const implemented = entry.handler === null ? "active" : "potential";
  const value = truthMeetAll([implemented, ...entry.judgments.map((judgment) => judgment.value)]);
  return Object.freeze({
    entry,
    value,
    admitted: value === "potential",
    denied: value === "active",
    unsettled: value === "absurd",
    contradicted: value === "stable",
    implemented: entry.handler !== null,
    judgments: entry.judgments,
  });
}

export function isSyscallEntry(value) {
  return !!value && typeof value === "object" && (value).kind === SYSCALL_ENTRY_KIND;
}

// ── table and dispatch ────────────────────────────────────────────────────────────────────────

export class SyscallTable {
 kind = SYSCALL_TABLE_KIND;
 entries = new Map();
 byNumber = new Map();

  constructor(entries = []) {
    for (const entry of entries) this.register(entry);
  }

  register(input) {
    const entry = isSyscallEntry(input) ? input : createSyscallEntry(input);
    this.entries.set(entry.name, entry);
    if (entry.number !== null) this.byNumber.set(entry.number, entry.name);
    return entry;
  }

  resolve(value) {
    if (Number.isInteger(value)) {
      const name = this.byNumber.get(Number(value));
      return name === undefined ? null : this.entries.get(name) ?? null;
    }
    if (typeof value === "string") return this.entries.get(value) ?? null;
    if (isSyscallEntry(value)) return this.entries.get(value.name) ?? value;
    return null;
  }

  has(value) {
    return this.resolve(value) !== null;
  }

  dispatch(
    processOrInput,
    nameOrNumber,
    args = [],
    options = {},
  ) {
    return dispatchSyscall(this, processOrInput, nameOrNumber, args, options);
  }

  carrier() {
    return syscallCarrier(this);
  }
}

export function createSyscallTable(entries = []) {
  return new SyscallTable(entries);
}

export function syscallCarrier(
  tableOrEntries = [],
) {
  const settled = entriesOf(tableOrEntries)
    .map((entry) => settleSyscallEntry(entry))
    .sort((a, b) => syscallPoint(a.entry).localeCompare(syscallPoint(b.entry)));
  const points = settled.map((item) => syscallPoint(item.entry));
  const byPoint = new Map(settled.map((item) => [syscallPoint(item.entry), item]));

  return chuSpace(points, SYSCALL_CARRIER_STATES, (point, state) => {
    const item = byPoint.get(point);
    if (!item) return "absurd";
    switch (state) {
      case "registered":
        return "potential";
      case "numbered":
        return readingOfTruth(item.entry.number !== null);
      case "implemented":
        return readingOfTruth(item.implemented);
      case "admitted":
        return readingOfTruth(item.admitted);
      case "denied":
        return readingOfTruth(item.denied);
      case "unsettled":
        return readingOfTruth(item.unsettled);
      case "contradicted":
        return readingOfTruth(item.contradicted);
      default:
        return "absurd";
    }
  });
}

export function dispatchSyscall(
  tableOrEntries,
  processOrInput,
  nameOrNumber,
  args = [],
  options = {},
) {
  const table = tableOrEntries instanceof SyscallTable ? tableOrEntries : createSyscallTable(tableOrEntries);
  const process = asProcess(processOrInput);
  const frozenArgs = Object.freeze([...args]);
  const instant = instantOf((options.at ?? options.now ?? 0));
  const trap = syscallTrap(process, nameOrNumber, frozenArgs, { at: instant });
  const entry = table.resolve(nameOrNumber);
  const base = {
    kind: SYSCALL_DISPATCH_KIND,
    process,
    syscall: String(nameOrNumber),
    args: frozenArgs,
    instant,
    trap,
    trace: trap.rows,
  };

  if (!entry) {
    return freezeDispatch({
      ...base,
      returnValue: options.missingReturnValue ?? -1,
      ok: false,
      error: "unimplemented-syscall",
      report: reportOf({
        ok: false,
        value: "active",
        error: "unimplemented-syscall",
        witness: { operation: "syscall-dispatch", syscall: String(nameOrNumber), reason: "missing-entry" },
        residues: [{ kind: "kernel.syscall.unimplemented", syscall: String(nameOrNumber) }],
      }),
      entry: null,
      settled: null,
    });
  }

  const settled = settleSyscallEntry(entry);
  if (!settled.admitted) {
    const error = settled.contradicted ? "contradicted-syscall" : settled.unsettled ? "unsettled-syscall" : "denied-syscall";
    return freezeDispatch({
      ...base,
      syscall: entry.name,
      returnValue: options.deniedReturnValue ?? -1,
      ok: false,
      error,
      report: reportOf({
        ok: false,
        value: settled.value,
        error,
        witness: { operation: "syscall-dispatch", syscall: entry.name, value: settled.value, judgments: settled.judgments },
        residues: [{ kind: `kernel.syscall.${error}`, syscall: entry.name, value: settled.value }],
      }),
      entry,
      settled,
      governance: entry.governance,
      resources: entry.resources,
      provenance: { entry: entry.provenance },
    });
  }

  const handler = entry.handler;
  if (handler === null) {
    return freezeDispatch({
      ...base,
      syscall: entry.name,
      returnValue: options.deniedReturnValue ?? -1,
      ok: false,
      error: "denied-syscall",
      report: reportOf({
        ok: false,
        value: "active",
        error: "denied-syscall",
        witness: { operation: "syscall-dispatch", syscall: entry.name, value: "active", judgments: settled.judgments },
        residues: [{ kind: "kernel.syscall.denied-syscall", syscall: entry.name, value: "active" }],
      }),
      entry,
      settled,
      governance: entry.governance,
      resources: entry.resources,
      provenance: { entry: entry.provenance },
    });
  }

  const raw = handler({
    process,
    syscall: entry,
    args: frozenArgs,
    table,
    trap,
    instant,
    world: options.world ?? null,
    resources: options.resources ?? null,
  });
  const normalized = normalizeSyscallResult(raw);
  return freezeDispatch({
    ...base,
    syscall: entry.name,
    returnValue: normalized.returnValue,
    ok: normalized.ok,
    error: normalized.error,
    report: reportOf({
      ok: normalized.ok,
      value: normalized.ok ? "potential" : "active",
      error: normalized.error,
      witness: {
        operation: "syscall-dispatch",
        syscall: entry.name,
        returnValue: normalized.returnValue,
        result: normalized.result,
      },
      residues: normalized.residues,
    }),
    entry,
    settled,
    result: normalized.result,
    provenance: Object.freeze({
      entry: entry.provenance,
      handler: handler.name || null,
    }),
    governance: entry.governance,
    resources: Object.freeze({ ...entry.resources, ...(normalized.resources ?? {}) }),
  });
}

export function normalizeSyscallResult(raw) {
  if (raw && typeof raw === "object" && ("ok" in raw || "returnValue" in raw || "value" in raw)) {
    const result = raw;
    const ok = result.ok === undefined ? true : result.ok === true;
    return Object.freeze({
      ok,
      returnValue: result.returnValue ?? result.value ?? (ok ? 0 : -1),
      error: result.error ?? null,
      result: raw,
      residues: Object.freeze([...(result.residues ?? [])]),
      resources: result.resources === undefined ? undefined : Object.freeze({ ...result.resources }),
    });
  }
  return Object.freeze({
    ok: true,
    returnValue: raw ?? 0,
    error: null,
    result: raw,
    residues: Object.freeze([]),
    resources: undefined,
  });
}

export function dispatchPoint(dispatch) {
  if (dispatch.kind !== SYSCALL_DISPATCH_KIND) {
    throw new TypeError("dispatchPoint: syscall dispatch is required");
  }
  return `dispatch:${processId(dispatch.process)}:${dispatch.syscall}:${dispatch.instant.label}`;
}

export function dispatchCarrier(dispatches = []) {
  const list = [...dispatches].sort((a, b) => dispatchPoint(a).localeCompare(dispatchPoint(b)));
  const points = list.map(dispatchPoint);
  const byPoint = new Map(list.map((dispatch) => [dispatchPoint(dispatch), dispatch]));

  return chuSpace(points, DISPATCH_CARRIER_STATES, (point, state) => {
    const dispatch = byPoint.get(point);
    if (!dispatch) return "absurd";
    switch (state) {
      case "dispatched":
        return "potential";
      case "trapped":
        return readingOfTruth(dispatch.trap.rows.length > 0);
      case "admitted":
        return readingOfTruth(dispatch.settled?.admitted === true);
      case "succeeded":
        return readingOfTruth(dispatch.ok === true);
      case "failed":
        return readingOfTruth(dispatch.ok === false);
      case "unimplemented":
        return readingOfTruth(dispatch.error === "unimplemented-syscall");
      case "contradicted":
        return readingOfTruth(dispatch.error === "contradicted-syscall" || dispatch.report.value === "stable");
      default:
        return "absurd";
    }
  });
}

// ── internal ─────────────────────────────────────────────────────────────────────────────────

function reportOf(input

) {
  const evidence = evidenceOf(input.value, input.witness);
  return Object.freeze({
    kind: "kernel.syscall.report",
    ok: input.ok,
    value: input.value,
    error: input.error,
    evidence,
    witnesses: evidence,
    residues: Object.freeze([...(input.residues ?? [])]),
  });
}

function evidenceOf(value, witness) {
  const mark = witness === undefined ? [] : [witness];
  if (value === "potential") return Object.freeze([Object.freeze(mark), Object.freeze([])]);
  if (value === "active") return Object.freeze([Object.freeze([]), Object.freeze(mark)]);
  if (value === "stable") return Object.freeze([Object.freeze(mark), Object.freeze(mark)]);
  return Object.freeze([Object.freeze([]), Object.freeze([])]);
}

function normalizeJudgment(input) {
  return Object.freeze({
    name: input.name ?? "syscall",
    value: input.value,
    reason: input.reason ?? "syscall judgment",
    path: input.path ?? "syscall",
    ...(input.evidence === undefined ? {} : { evidence: input.evidence }),
  });
}

function asProcess(value) {
  if (typeof value === "object" && value !== null && typeof value.id === "string" && Array.isArray(value.rows)) {
    return value;
  }
  return createProcess(value);
}

function entriesOf(
  tableOrEntries,
) {
  if (tableOrEntries instanceof SyscallTable) return [...tableOrEntries.entries.values()];
  const maybeTable = tableOrEntries;
  if (
    !!tableOrEntries &&
    typeof tableOrEntries === "object" &&
    maybeTable.kind === SYSCALL_TABLE_KIND &&
    maybeTable.entries instanceof Map
  ) {
    return [...maybeTable.entries.values()];
  }
  return [...tableOrEntries];
}

function freezeDispatch(dispatch) {
  return Object.freeze({
    ...dispatch,
    args: Object.freeze([...dispatch.args]),
    trace: Object.freeze([...dispatch.trace]),
    provenance: Object.freeze({ source: "@561-group/memetics/syscall", ...(dispatch.provenance ?? {}) }),
    governance: Object.freeze({ ...(dispatch.governance ?? {}) }),
    resources: Object.freeze({ ...(dispatch.resources ?? {}) }),
  });
}
