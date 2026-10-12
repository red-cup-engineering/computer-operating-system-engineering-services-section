// four.ts — FOUR, the Belnap–Ginsberg four-valued bilattice, as a reading of the bilattice floor.
//
//     t   = [true,  false]   true only            bot = [false, false]   neither — no evidence (⊥)
//     f   = [false, true ]   false only           top = [true,  true ]   both — contradiction (⊤)
//
// Every operation is a bilattice morphism applied to the charge coordinate — not a new algebra.
// FOUR is the floor's algebra wearing Belnap's names.
import type { Charge } from "@561-group/meme";
import {
  joinKnowledge, meetKnowledge, joinTruth, meetTruth,
  negate as kernelNegate, conflate as kernelConflate, present,
} from "../charge.ts";

/** One of the four named bilattice values. */
export type Four = "t" | "f" | "bot" | "top";

/** The four named values: T true-only, F false-only, BOT ⊥ neither, TOP ⊤ both. */
export const FOUR = Object.freeze({ T: "t" as Four, F: "f" as Four, BOT: "bot" as Four, TOP: "top" as Four });

/** Display glyphs for the four values (presentation only). */
export const GLYPH = Object.freeze({ t: "t", f: "f", bot: "⊥", top: "⊤" });

const BITS: Record<Four, readonly [boolean, boolean]> = {
  t:   [true,  false],
  f:   [false, true ],
  bot: [false, false],
  top: [true,  true ],
};

const NAMES = Object.keys(BITS) as Four[];

/** Is `v` one of the four named values? */
export function isFour(v: unknown): v is Four {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(BITS, v);
}

/** Assert `v` is a Four and return it, else throw. */
export function asFour(v: unknown): Four {
  if (!isFour(v)) {
    throw new TypeError(`not a FOUR value: ${JSON.stringify(v)} (expected one of ${NAMES.join(", ")})`);
  }
  return v;
}

/** Lift a Four to an evidence-free kernel charge — the charge whose value is this Four's bits. */
export function toCharge(v: Four): Charge {
  const [pos, neg] = BITS[asFour(v)];
  return { value: [pos, neg], evidence: [[], []] };
}

function fourOfBits(pos: boolean, neg: boolean): Four {
  for (const name of NAMES) {
    const [p, n] = BITS[name];
    if (p === pos && n === neg) return name;
  }
  return FOUR.BOT;
}

/** The Four read off a kernel charge — present()'s shadow (value bits, discarding evidence). */
export function fromCharge(charge: Charge): Four {
  const [pos, neg] = present(charge);
  return fourOfBits(pos, neg);
}

const lift1 = (morphism: (c: Charge) => Charge) =>
  (a: Four): Four => fromCharge(morphism(toCharge(asFour(a))));

const lift2 = (morphism: (pair: { left: Charge; right: Charge }) => Charge) =>
  (a: Four, b: Four): Four => fromCharge(morphism({ left: toCharge(asFour(a)), right: toCharge(asFour(b)) }));

/** ¬ — the truth involution: swaps t↔f, fixes ⊥,⊤. */
export const negate = lift1(kernelNegate);
/** − — the knowledge involution: swaps ⊥↔⊤, fixes t,f. */
export const conflate = lift1(kernelConflate);
/** ⊕ — knowledge join (lub in ≤_k); identity is ⊥. */
export const knowledgeJoin = lift2(joinKnowledge);
/** ⊗ — knowledge meet (glb in ≤_k); identity is ⊤. */
export const knowledgeMeet = lift2(meetKnowledge);
/** ∨ — truth join (lub in ≤_t); identity is f. */
export const truthJoin = lift2(joinTruth);
/** ∧ — truth meet (glb in ≤_t); identity is t. */
export const truthMeet = lift2(meetTruth);
