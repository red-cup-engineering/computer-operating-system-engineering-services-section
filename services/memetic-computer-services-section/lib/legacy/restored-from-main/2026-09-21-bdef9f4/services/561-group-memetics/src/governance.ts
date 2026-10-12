// governance.ts — the MemeCharge governance protocol for a process.
//
// A REGIME admits an action with a MemeCharge decision (active=denied, absurd=unsettled,
// stable=contradicted-held, potential=admitted). The STRUCTURATION fold reads a process's
// observable shape to select which regime governs it.
//
// This module authors NO regime content: the substantive regimes stay in the app.
// A regime is the PROTOCOL  admit(ctx) → { value: MemeCharge, ... }  plus the default
// capability gate. The structuration→regime selection is the caller's `regimeSelector`.

import type { MemeCharge } from "./charge.ts";
import type { Process } from "./process.ts";

// ── types ─────────────────────────────────────────────────────────────────────────────────────

export type Structuration = {
  kind: "process.structuration";
  id: string;
  scope: "internal-kin-work" | "external-ship-work" | "unspecified";
  declaredRegime: string;
  after: readonly string[];
  officeField: readonly string[];
  hasWithdrawals: boolean;
};

export type RegimeDecision = {
  value: MemeCharge;
  regime: string;
  jural: "power";
  binding: boolean;
  reason: string;
  [key: string]: unknown;
};

export type Regime = {
  name?: string;
  admit: (ctx: Record<string, unknown>) => { value: MemeCharge; [key: string]: unknown };
};

// ── structuration ──────────────────────────────────────────────────────────────────────────────

/** Read the observable shape of a process — the fields a regime selector folds over. */
export function readStructuration(
  proc: Process | Record<string, unknown>,
  opts: { withdrawals?: readonly unknown[] } = {},
): Structuration {
  const doc = (proc as { doc?: Record<string, unknown> }).doc ?? proc;
  const raw = String((doc as Record<string, unknown>).scope ?? (doc as Record<string, unknown>).governanceScope ?? "").toLowerCase();
  const scope: Structuration["scope"] =
    ["internal", "internal-kin-work", "kin", "kin-work"].includes(raw)
      ? "internal-kin-work"
      : ["external", "external-ship-work", "ship", "ship-work"].includes(raw)
        ? "external-ship-work"
        : "unspecified";

  const d = doc as Record<string, unknown>;
  const withdrawals = opts.withdrawals ?? (d["withdrawals"] as readonly unknown[] | undefined) ?? [];

  return Object.freeze({
    kind: "process.structuration",
    id: String((proc as { id?: unknown }).id ?? d["id"] ?? ""),
    scope,
    declaredRegime: String(d["governanceRegime"] ?? ""),
    after: Object.freeze([...([].concat((proc as Process).after as never[] ?? []).filter(Boolean))]),
    officeField: Object.freeze(
      [...new Set([d["office"], d["createdBy"], ...([].concat(d["offices"] as never[] ?? []))].filter(Boolean))].map(String),
    ),
    hasWithdrawals: ([].concat(withdrawals as never[]).filter(Boolean)).length > 0,
  });
}

// ── regime selection ───────────────────────────────────────────────────────────────────────────

/** Select the regime that governs a process given its structuration and a caller-supplied selector. */
export function selectRegime(
  structuration: Structuration,
  regimeSelector?: (s: Structuration) => string,
  defaultRegime = "capability-gate",
): string {
  if (structuration.declaredRegime) return structuration.declaredRegime;
  if (typeof regimeSelector === "function") {
    const chosen = regimeSelector(structuration);
    if (chosen) return chosen;
  }
  return defaultRegime;
}

// ── admission ─────────────────────────────────────────────────────────────────────────────────

/** Run the named regime's MemeCharge admit rule. A stable contradiction is held, never collapsed. */
export function admitUnder(
  regimes: Record<string, Regime> | undefined,
  regimeName: string,
  ctx: Record<string, unknown>,
): RegimeDecision {
  const regime = regimes?.[regimeName] ?? regimes?.[ctx["defaultRegime"] as string] ?? null;
  const raw = regime?.admit ? regime.admit(ctx) : capabilityGate(ctx);
  const defaults = { jural: "power" as const, binding: true, reason: "" };
  return Object.freeze({
    ...defaults,
    ...raw,
    regime: regime ? (regime.name ?? regimeName) : "capability-gate",
    value: raw.value as MemeCharge,
  });
}

/** Default governance gate: "does the principal hold the capability for this action?" */
export function capabilityGate(ctx: Record<string, unknown>): { value: MemeCharge; jural: "power"; binding: boolean; reason: string } {
  const can = (ctx["can"] as ((p: unknown, a: unknown) => boolean) | undefined) ?? (() => false);
  if (!ctx["principal"]) {
    return { value: "absurd", jural: "power", binding: false, reason: "no principal supplied; authority undecided." };
  }
  const ok = can(ctx["principal"], ctx["action"]);
  return {
    value: ok ? "potential" : "active",
    jural: "power",
    binding: true,
    reason: ok ? `principal holds ${String(ctx["action"])}.` : `principal does not hold ${String(ctx["action"])}.`,
  };
}
