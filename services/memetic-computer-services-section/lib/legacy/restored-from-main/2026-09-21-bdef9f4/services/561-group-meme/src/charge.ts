// Charge: the four-valued word — two marks (positive, negative) drawn independently over a
// lossless evidence carrier. The four readings of value [positive, negative] — the FOUR bilattice:
//
//   [F,F] absurd    — no side; no information (⊥)
//   [T,F] potential — positive only; has-potential, not yet active
//   [F,T] active    — negative only; engaged
//   [T,T] stable    — both; told both (⊤, contradiction held, not an error)
//
// Two σ-dual orders run on the pair:
//   knowledge: absurd ↕ stable ("how determined")
//   truth:     active ↔ potential ("which way")
//
// Evidence accumulates all witnesses and is never discarded — every operation grows the carrier,
// so stable (⊤) is reachable and represents genuine contradiction, not malformed data.

/** Charge: the four-valued word of a meme — two independent marks over a lossless evidence carrier. */
export interface Charge {
  readonly value: readonly [boolean, boolean];
  readonly evidence: readonly [readonly unknown[], readonly unknown[]];
}

export const isCharge = (x: unknown): x is Charge => {
  if (typeof x !== "object" || x === null) return false;
  if (!("value" in x) || !("evidence" in x)) return false;
  const { value, evidence } = x as Record<string, unknown>;
  if (!Array.isArray(value) || value.length !== 2) return false;
  if (typeof value[0] !== "boolean" || typeof value[1] !== "boolean") return false;
  if (!Array.isArray(evidence) || evidence.length !== 2) return false;
  if (!Array.isArray(evidence[0]) || !Array.isArray(evidence[1])) return false;
  return true;
};
