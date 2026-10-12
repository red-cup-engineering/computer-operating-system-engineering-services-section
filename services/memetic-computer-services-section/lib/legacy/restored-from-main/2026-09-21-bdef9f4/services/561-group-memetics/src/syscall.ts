// syscall.ts — process -> kernel request -> settled response.
//
// Syscalls are admitted by the same MemeCharge chain as processes. Dispatch records a scheduler trap,
// resolves by name or number, settles entry judgments, and normalizes handler returns.

import { createMemeChargeCarrier, foldCharges, type MemeCharge, type MemeChargeCarrier } from "./charge.ts";
import type { KernelInstant, SyscallTrap } from "./scheduler.ts";
import { instantOf, syscallTrap } from "./scheduler.ts";
import type { Judgment, Process, Row } from "./process.ts";
import { createProcess, processId } from "./process.ts";

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
] as const);

export const DISPATCH_CARRIER_STATES = Object.freeze([
  "dispatched",
  "trapped",
  "admitted",
  "succeeded",
  "failed",
  "unimplemented",
  "contradicted",
] as const);

export type SyscallCarrierState = typeof SYSCALL_CARRIER_STATES[number];
export type DispatchCarrierState = typeof DISPATCH_CARRIER_STATES[number];

export type SyscallJudgment = Partial<Omit<Judgment, "value">> & { value: MemeCharge; evidence?: unknown };

export type SyscallHandlerInput = {
  process: Process;
  syscall: SyscallEntry;
  args: readonly unknown[];
  table: SyscallTable;
  trap: SyscallTrap;
  instant: KernelInstant;
  world: unknown;
  resources: unknown;
};

export type SyscallResult = {
  ok?: boolean;
  returnValue?: unknown;
  value?: unknown;
  error?: string | null;
  residues?: Iterable<unknown>;
  resources?: Record<string, unknown>;
};

export type SyscallEntry = {
  kind: typeof SYSCALL_ENTRY_KIND;
  name: string;
  number: number | null;
  handler: null | ((input: SyscallHandlerInput) => unknown);
  judgments: readonly SyscallJudgment[];
  metadata: Readonly<Record<string, unknown>>;
  governance: Readonly<Record<string, unknown>>;
  resources: Readonly<Record<string, unknown>>;
  provenance: Readonly<Record<string, unknown>>;
};

export type SettledSyscallEntry = {
  entry: SyscallEntry;
  value: MemeCharge;
  admitted: boolean;
  denied: boolean;
  unsettled: boolean;
  contradicted: boolean;
  implemented: boolean;
  judgments: readonly SyscallJudgment[];
};

export type SyscallReport = {
  kind: "kernel.syscall.report";
  ok: boolean;
  value: MemeCharge;
  error: string | null;
  charge: Readonly<{
    value: MemeCharge;
    evidence: readonly [readonly unknown[], readonly unknown[]];
  }>;
  evidence: readonly [readonly unknown[], readonly unknown[]];
  witnesses: readonly [readonly unknown[], readonly unknown[]];
  residues: readonly unknown[];
};

export type NormalizedSyscallResult = Readonly<{
  ok: boolean;
  returnValue: unknown;
  error: string | null;
  result: unknown;
  residues: readonly unknown[];
  resources: Readonly<Record<string, unknown>> | undefined;
}>;

export type SyscallDispatch = {
  kind: typeof SYSCALL_DISPATCH_KIND;
  process: Process;
  syscall: string;
  args: readonly unknown[];
  instant: KernelInstant;
  trap: SyscallTrap;
  trace: readonly Row[];
  entry: SyscallEntry | null;
  settled: SettledSyscallEntry | null;
  ok: boolean;
  error: string | null;
  returnValue: unknown;
  report: SyscallReport;
  result?: unknown;
  provenance: Readonly<Record<string, unknown>>;
  governance: Readonly<Record<string, unknown>>;
  resources: Readonly<Record<string, unknown>>;
};

// ── entry settlement ──────────────────────────────────────────────────────────────────────────

export function syscallName(value: string | { name?: unknown }): string {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "string") throw new TypeError("syscallName: syscall name is required");
  if (value.name !== undefined && value.name !== null && String(value.name).length > 0) return String(value.name);
  throw new TypeError("syscallName: syscall name is required");
}

export function syscallNumber(value: { number?: unknown }): number | null {
  if (value.number === undefined || value.number === null) return null;
  if (!Number.isInteger(value.number) || Number(value.number) < 0) {
    throw new TypeError("syscallNumber: syscall number must be a non-negative integer");
  }
  return Number(value.number);
}

export function syscallPoint(value: string | SyscallEntry | { name?: unknown; number?: unknown }): string {
  const number = typeof value === "string" ? null : syscallNumber(value);
  return number === null ? `syscall:${syscallName(value)}` : `syscall:${number}:${syscallName(value)}`;
}

export function createSyscallEntry(input: string | (Partial<SyscallEntry> & Record<string, unknown>) = {}): SyscallEntry {
  const source = typeof input === "string" ? { name: input } : input;
  const name = syscallName(source);
  const number = syscallNumber(source);
  const handler = typeof source.handler === "function" ? source.handler : null;
  const judgments = [...(source.judgments ?? [{ name: "registered", value: "potential" as MemeCharge }])].map(normalizeJudgment);
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

export function settleSyscallEntry(entryOrInput: SyscallEntry | Parameters<typeof createSyscallEntry>[0]): SettledSyscallEntry {
  const entry = isSyscallEntry(entryOrInput) ? entryOrInput : createSyscallEntry(entryOrInput);
  const implemented: MemeCharge = entry.handler === null ? "active" : "potential";
  const value = foldCharges([implemented, ...entry.judgments.map((judgment) => judgment.value)]);
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

export function isSyscallEntry(value: unknown): value is SyscallEntry {
  return !!value && typeof value === "object" && (value as SyscallEntry).kind === SYSCALL_ENTRY_KIND;
}

// ── table and dispatch ────────────────────────────────────────────────────────────────────────

export class SyscallTable {
  readonly kind = SYSCALL_TABLE_KIND;
  readonly entries = new Map<string, SyscallEntry>();
  readonly byNumber = new Map<number, string>();

  constructor(entries: Iterable<SyscallEntry | Parameters<typeof createSyscallEntry>[0]> = []) {
    for (const entry of entries) this.register(entry);
  }

  register(input: SyscallEntry | Parameters<typeof createSyscallEntry>[0]): SyscallEntry {
    const entry = isSyscallEntry(input) ? input : createSyscallEntry(input);
    this.entries.set(entry.name, entry);
    if (entry.number !== null) this.byNumber.set(entry.number, entry.name);
    return entry;
  }

  resolve(value: string | number | SyscallEntry): SyscallEntry | null {
    if (Number.isInteger(value)) {
      const name = this.byNumber.get(Number(value));
      return name === undefined ? null : this.entries.get(name) ?? null;
    }
    if (typeof value === "string") return this.entries.get(value) ?? null;
    if (isSyscallEntry(value)) return this.entries.get(value.name) ?? value;
    return null;
  }

  has(value: string | number | SyscallEntry): boolean {
    return this.resolve(value) !== null;
  }

  dispatch(
    processOrInput: Process | string | Partial<Process>,
    nameOrNumber: string | number,
    args: Iterable<unknown> = [],
    options: Record<string, unknown> = {},
  ): SyscallDispatch {
    return dispatchSyscall(this, processOrInput, nameOrNumber, args, options);
  }

  carrier(): MemeChargeCarrier<SyscallCarrierState> {
    return syscallCarrier(this);
  }
}

export function createSyscallTable(entries: ConstructorParameters<typeof SyscallTable>[0] = []): SyscallTable {
  return new SyscallTable(entries);
}

export function syscallCarrier(
  tableOrEntries: SyscallTable | Iterable<SyscallEntry | Parameters<typeof createSyscallEntry>[0]> = [],
): MemeChargeCarrier<SyscallCarrierState> {
  const settled = entriesOf(tableOrEntries)
    .map((entry) => settleSyscallEntry(entry))
    .sort((a, b) => syscallPoint(a.entry).localeCompare(syscallPoint(b.entry)));
  const points = settled.map((item) => syscallPoint(item.entry));
  const byPoint = new Map(settled.map((item) => [syscallPoint(item.entry), item]));

  return createMemeChargeCarrier(points, SYSCALL_CARRIER_STATES, (point, state) => {
    const item = byPoint.get(point);
    if (!item) return "absurd";
    switch (state) {
      case "registered":
        return "potential";
      case "numbered":
        return chargeOf(item.entry.number !== null);
      case "implemented":
        return chargeOf(item.implemented);
      case "admitted":
        return chargeOf(item.admitted);
      case "denied":
        return chargeOf(item.denied);
      case "unsettled":
        return chargeOf(item.unsettled);
      case "contradicted":
        return chargeOf(item.contradicted);
      default:
        return "absurd";
    }
  });
}

export function dispatchSyscall(
  tableOrEntries: SyscallTable | Iterable<SyscallEntry | Parameters<typeof createSyscallEntry>[0]>,
  processOrInput: Process | string | Partial<Process>,
  nameOrNumber: string | number,
  args: Iterable<unknown> = [],
  options: Record<string, unknown> = {},
): SyscallDispatch {
  const table = tableOrEntries instanceof SyscallTable ? tableOrEntries : createSyscallTable(tableOrEntries);
  const process = asProcess(processOrInput);
  const frozenArgs = Object.freeze([...args]);
  const instant = instantOf((options.at ?? options.now ?? 0) as KernelInstant | number | Partial<KernelInstant>);
  const trap = syscallTrap(process, nameOrNumber, frozenArgs, { at: instant });
  const entry = table.resolve(nameOrNumber);
  const base: Pick<SyscallDispatch, "kind" | "process" | "syscall" | "args" | "instant" | "trap" | "trace"> = {
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

export function normalizeSyscallResult(raw: unknown): NormalizedSyscallResult {
  if (raw && typeof raw === "object" && ("ok" in raw || "returnValue" in raw || "value" in raw)) {
    const result = raw as SyscallResult;
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

export function dispatchPoint(dispatch: SyscallDispatch): string {
  if (dispatch.kind !== SYSCALL_DISPATCH_KIND) {
    throw new TypeError("dispatchPoint: syscall dispatch is required");
  }
  return `dispatch:${processId(dispatch.process)}:${dispatch.syscall}:${dispatch.instant.label}`;
}

export function dispatchCarrier(dispatches: Iterable<SyscallDispatch> = []): MemeChargeCarrier<DispatchCarrierState> {
  const list = [...dispatches].sort((a, b) => dispatchPoint(a).localeCompare(dispatchPoint(b)));
  const points = list.map(dispatchPoint);
  const byPoint = new Map(list.map((dispatch) => [dispatchPoint(dispatch), dispatch]));

  return createMemeChargeCarrier(points, DISPATCH_CARRIER_STATES, (point, state) => {
    const dispatch = byPoint.get(point);
    if (!dispatch) return "absurd";
    switch (state) {
      case "dispatched":
        return "potential";
      case "trapped":
        return chargeOf(dispatch.trap.rows.length > 0);
      case "admitted":
        return chargeOf(dispatch.settled?.admitted === true);
      case "succeeded":
        return chargeOf(dispatch.ok === true);
      case "failed":
        return chargeOf(dispatch.ok === false);
      case "unimplemented":
        return chargeOf(dispatch.error === "unimplemented-syscall");
      case "contradicted":
        return chargeOf(dispatch.error === "contradicted-syscall" || dispatch.report.value === "stable");
      default:
        return "absurd";
    }
  });
}

// ── internal ─────────────────────────────────────────────────────────────────────────────────

function reportOf(input: {
  ok: boolean;
  value: MemeCharge;
  error: string | null;
  witness?: unknown;
  residues?: Iterable<unknown>;
}): SyscallReport {
  const evidence = evidenceOf(input.value, input.witness);
  const charge = Object.freeze({ value: input.value, evidence });
  return Object.freeze({
    kind: "kernel.syscall.report",
    ok: input.ok,
    value: input.value,
    error: input.error,
    charge,
    evidence,
    witnesses: evidence,
    residues: Object.freeze([...(input.residues ?? [])]),
  });
}

function evidenceOf(value: MemeCharge, witness: unknown): readonly [readonly unknown[], readonly unknown[]] {
  const mark = witness === undefined ? [] : [witness];
  if (value === "potential") return Object.freeze([Object.freeze(mark), Object.freeze([])]);
  if (value === "active") return Object.freeze([Object.freeze([]), Object.freeze(mark)]);
  if (value === "stable") return Object.freeze([Object.freeze(mark), Object.freeze(mark)]);
  return Object.freeze([Object.freeze([]), Object.freeze([])]);
}

function normalizeJudgment(input: SyscallJudgment): SyscallJudgment {
  return Object.freeze({
    name: input.name ?? "syscall",
    value: input.value,
    reason: input.reason ?? "syscall judgment",
    path: input.path ?? "syscall",
    ...(input.evidence === undefined ? {} : { evidence: input.evidence }),
  });
}

function asProcess(value: Process | string | Partial<Process>): Process {
  if (typeof value === "object" && value !== null && typeof value.id === "string" && Array.isArray(value.rows)) {
    return value as Process;
  }
  return createProcess(value as string | Partial<Process>);
}

function entriesOf(
  tableOrEntries: SyscallTable | Iterable<SyscallEntry | Parameters<typeof createSyscallEntry>[0]>,
): Array<SyscallEntry | Parameters<typeof createSyscallEntry>[0]> {
  if (tableOrEntries instanceof SyscallTable) return [...tableOrEntries.entries.values()];
  const maybeTable = tableOrEntries as unknown as Partial<SyscallTable>;
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

function chargeOf(value: boolean): MemeCharge {
  return value ? "potential" : "active";
}

function freezeDispatch(dispatch: Omit<SyscallDispatch, "provenance" | "governance" | "resources"> & Partial<Pick<SyscallDispatch, "provenance" | "governance" | "resources">>): SyscallDispatch {
  return Object.freeze({
    ...dispatch,
    args: Object.freeze([...dispatch.args]),
    trace: Object.freeze([...dispatch.trace]),
    provenance: Object.freeze({ source: "@561-group/memetics/syscall", ...(dispatch.provenance ?? {}) }),
    governance: Object.freeze({ ...(dispatch.governance ?? {}) }),
    resources: Object.freeze({ ...(dispatch.resources ?? {}) }),
  });
}
