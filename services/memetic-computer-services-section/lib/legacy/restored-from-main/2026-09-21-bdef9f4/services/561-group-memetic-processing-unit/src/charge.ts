// charge.ts — the MPU's value-algebra over the bilattice charge. The Charge type itself is sourced
// from @561-group/meme; this module owns the operations: the Klein gauge (negate/conflate), the two
// lattice orders (knowledge/truth), and the lossless evidence accumulation.
//
// The four readings of value [positive, negative] — the FOUR bilattice:
//     [F,F] absurd    — no side; no information (⊥)
//     [T,F] potential — positive only; has-potential, not yet active
//     [F,T] active    — negative only; engaged
//     [T,T] stable    — both; told both (⊤, contradiction HELD, not an error)
// Two σ-dual orders: KNOWLEDGE (absurd ↕ stable, "how determined") and TRUTH (active ↔ potential, "which
// way"). `value` is what the Klein gauge reflects; `evidence` only ever ACCUMULATES, never shrinks.
import type { Charge } from "@561-group/meme";
import { union } from "./internal.ts";

export type { Charge };

/** A pair of charges — the argument shape of the binary value-operations. */
export interface ChargePair {
  readonly left: Charge;
  readonly right: Charge;
}

// ── value-reads ──────────────────────────────────────────────────────────────

/** The FOUR-place reading of a charge: its value bits `[pos, neg]`. */
export const present = (charge: Charge): readonly [boolean, boolean] => charge.value;

/** Is a charge valued stable (⊤, told both)? Both value bits set. */
export const isTop = (charge: Charge): boolean => charge.value[0] && charge.value[1];

/** Is a charge valued absurd (⊥, told neither)? Neither value bit set. */
export const isBottom = (charge: Charge): boolean => !charge.value[0] && !charge.value[1];

// ── the gauge (unary involutions) ────────────────────────────────────────────

/** The truth involution: swap positive and negative — value AND evidence together (reverses truth,
 * preserves knowledge). Nothing is discarded; witnesses ride to their new side. */
export const negate = (charge: Charge): Charge => ({
  value: [charge.value[1], charge.value[0]],
  evidence: [charge.evidence[1], charge.evidence[0]],
});

/** The knowledge involution: `[pos, neg] → [¬neg, ¬pos]` (swaps absurd↔stable, fixes active and
 * potential); evidence stays. The one op that can raise a value above its evidence. */
export const conflate = (charge: Charge): Charge => ({
  value: [!charge.value[1], !charge.value[0]],
  evidence: charge.evidence,
});

// ── the lattice (binary, both orders) ────────────────────────────────────────

/** Knowledge-order join (lub in ≤_k): value bits OR'd componentwise; evidence accumulated. */
export const joinKnowledge = ({ left, right }: ChargePair): Charge => ({
  value: [left.value[0] || right.value[0], left.value[1] || right.value[1]],
  evidence: [union(left.evidence[0], right.evidence[0]), union(left.evidence[1], right.evidence[1])],
});

/** Knowledge-order meet (glb in ≤_k): value bits AND'd; evidence still accumulated. */
export const meetKnowledge = ({ left, right }: ChargePair): Charge => ({
  value: [left.value[0] && right.value[0], left.value[1] && right.value[1]],
  evidence: [union(left.evidence[0], right.evidence[0]), union(left.evidence[1], right.evidence[1])],
});

/** Truth-order join (lub in ≤_t): positive OR'd, negative AND'd. */
export const joinTruth = ({ left, right }: ChargePair): Charge => ({
  value: [left.value[0] || right.value[0], left.value[1] && right.value[1]],
  evidence: [union(left.evidence[0], right.evidence[0]), union(left.evidence[1], right.evidence[1])],
});

/** Truth-order meet (glb in ≤_t): positive AND'd, negative OR'd. */
export const meetTruth = ({ left, right }: ChargePair): Charge => ({
  value: [left.value[0] && right.value[0], left.value[1] || right.value[1]],
  evidence: [union(left.evidence[0], right.evidence[0]), union(left.evidence[1], right.evidence[1])],
});

/** The knowledge order ≤_k on the VALUE: information only grows, componentwise. */
export const leqKnowledge = (a: Charge, b: Charge): boolean => {
  const [ap, an] = a.value;
  const [bp, bn] = b.value;
  return (!ap || bp) && (!an || bn);
};

/** The ≤_k witness: returns `right` when `left ≤_k right` (knowledge only grows); throws otherwise. */
export const compareKnowledge = ({ left, right }: ChargePair): Charge => {
  if (!leqKnowledge(left, right)) {
    throw new TypeError("compareKnowledge: no ≤_k witness — left has knowledge not present in right");
  }
  return right;
};

/** Combine evidence from two sources — on the lossless carrier this is joinKnowledge. */
export const aggregate = (pair: ChargePair): Charge => joinKnowledge(pair);

// ── construction ─────────────────────────────────────────────────────────────

/** The absurd word ⊥ [F,F]: neither bit, no witnesses — the fold identity and the never-measured cell. */
export const bottom = (): Charge => ({ value: [false, false], evidence: [[], []] });

/** A potential word [T,F], witnessed on the positive side — what posit measures a fresh cell to. */
export const potential = (witness: unknown): Charge => ({ value: [true, false], evidence: [[witness], []] });
