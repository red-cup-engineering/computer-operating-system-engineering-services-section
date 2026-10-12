// governance.ts — the reading governance protocol for a process.
//
// A REGIME admits an action with a reading decision (active=denied, absurd=unsettled,
// stable=contradicted-held, potential=admitted). The STRUCTURATION fold reads a process's
// observable shape to select which regime governs it.
//
// This module authors NO regime content: the substantive regimes stay in the app.
// A regime is the PROTOCOL  admit(ctx) → { value: reading, ... }  plus the default
// capability gate. The structuration→regime selection is the caller's `regimeSelector`.

// ── types ─────────────────────────────────────────────────────────────────────────────────────

// ── structuration ──────────────────────────────────────────────────────────────────────────────

/** Read the observable shape of a process — the fields a regime selector folds over. */
export function readStructuration(
  proc,
  opts = {},
) {
  const doc = (proc).doc ?? proc;
  const raw = String((doc).scope ?? (doc).governanceScope ?? "").toLowerCase();
  const scope =
    ["internal", "internal-kin-work", "kin", "kin-work"].includes(raw)
      ? "internal-kin-work"
      : ["external", "external-ship-work", "ship", "ship-work"].includes(raw)
        ? "external-ship-work"
        : "unspecified";

  const d = doc;
  const withdrawals = opts.withdrawals ?? (d["withdrawals"]) ?? [];

  return Object.freeze({
    kind: "process.structuration",
    id: String((proc).id ?? d["id"] ?? ""),
    scope,
    declaredRegime: String(d["governanceRegime"] ?? ""),
    after: Object.freeze([...([].concat((proc).after ?? []).filter(Boolean))]),
    officeField: Object.freeze(
      [...new Set([d["office"], d["createdBy"], ...([].concat(d["offices"] ?? []))].filter(Boolean))].map(String),
    ),
    hasWithdrawals: ([].concat(withdrawals).filter(Boolean)).length > 0,
  });
}

// ── regime selection ───────────────────────────────────────────────────────────────────────────

/** Select the regime that governs a process given its structuration and a caller-supplied selector. */
export function selectRegime(
  structuration,
  regimeSelector,
  defaultRegime = "capability-gate",
) {
  if (structuration.declaredRegime) return structuration.declaredRegime;
  if (typeof regimeSelector === "function") {
    const chosen = regimeSelector(structuration);
    if (chosen) return chosen;
  }
  return defaultRegime;
}

// ── admission ─────────────────────────────────────────────────────────────────────────────────

/** Run the named regime's reading admit rule. A stable contradiction is held, never collapsed. */
export function admitUnder(
  regimes,
  regimeName,
  ctx,
) {
  const regime = regimes?.[regimeName] ?? regimes?.[ctx["defaultRegime"]] ?? null;
  const raw = regime?.admit ? regime.admit(ctx) : capabilityGate(ctx);
  const defaults = { jural: "power", binding: true, reason: "" };
  return Object.freeze({
    ...defaults,
    ...raw,
    regime: regime ? (regime.name ?? regimeName) : "capability-gate",
    value: raw.value,
  });
}

/** Default governance gate: "does the principal hold the capability for this action?" */
export function capabilityGate(ctx) {
  const can = (ctx["can"]) ?? (() => false);
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
