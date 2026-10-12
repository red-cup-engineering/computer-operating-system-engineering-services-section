// charges — Horsetail's value model. Every Horsetail value is a CHARGE: a four-valued `value = [pos, neg]`
// over a lossless `evidence` carrier (the math kernel's charge). Truthiness is four-valued — t, f,
// ⊥ (no evidence), ⊤ (contradiction, HELD) — and ⊤ is a BINDABLE value, never an error. The two
// and/or families are the kernel's σ-dual orders: knowledge (⊗/⊕) and truth (∧/∨). `(not x)` is the
// truth involution `negate`; `(conflate x)` the knowledge involution.
//
// This re-derives NOTHING. It re-reads the math kernel's charge algebra (via the chu/four naming) and
// the lossless evidence carrier (joinKnowledge etc.), and adds only Horsetail's bindings: which scalars
// project to which charge, and the charge<->FOUR-name codec the reader/printer use. math never imports
// computer; computer imports math by name.

import {
  joinKnowledge, meetKnowledge, joinTruth, meetTruth,
  negate as kNegate, conflate as kConflate, present, isTop, aggregate,
} from "@lenticule-science/metrologic/bilattice/charge";
import { fromCharge, toCharge as fourToCharge, FOUR, GLYPH } from "@lenticule-science/metrologic/chu/four";

export { FOUR, GLYPH, isTop, present };

// The four charge points as full charges (evidence-free), built from the kernel via chu/four.
export const T = Object.freeze(fourToCharge(FOUR.T));
export const F = Object.freeze(fourToCharge(FOUR.F));
export const BOT = Object.freeze(fourToCharge(FOUR.BOT));
export const TOP = Object.freeze(fourToCharge(FOUR.TOP));

// A charge witnessed by a token on its positive (true) side — the unit of "I affirm this".
export const affirmCharge = (witness) => ({ value: [true, false], evidence: [[witness], []] });
// …and on its negative (false) side — "I deny this" (the converse predication's charge).
export const denyCharge = (witness) => ({ value: [false, true], evidence: [[], [witness]] });

// fourName(charge) -> "t" | "f" | "bot" | "top" — the FOUR reading of a charge (value bits only).
export const fourName = (charge) => fromCharge(charge);
// glyph(charge) -> the display glyph (t / f / ⊥ / ⊤). Presentation only.
export const glyph = (charge) => GLYPH[fourName(charge)];

// ── the two σ-dual and/or families (the kernel's two lattice orders) ─────────────────────────────
// knowledge ⊕/⊗ ("how determined"): k-or = join (lub in ≤_k), k-and = meet (glb in ≤_k).
export const kOr = (a, b) => joinKnowledge({ left: a, right: b });
export const kAnd = (a, b) => meetKnowledge({ left: a, right: b });
// truth ∨/∧ ("which way"): or = truth-join, and = truth-meet. σ-dual to the knowledge pair.
export const tOr = (a, b) => joinTruth({ left: a, right: b });
export const tAnd = (a, b) => meetTruth({ left: a, right: b });

// the involutions (the Klein gauge): negate = truth flip (t<->f), conflate = knowledge flip (⊥<->⊤).
export const negate = (a) => kNegate(a);
export const conflate = (a) => kConflate(a);
// evidence aggregation — combine the witnesses of two sources (joinKnowledge by another name).
export const combine = (a, b) => aggregate({ left: a, right: b });

// n-ary folds with the right identities (so `(and)` and `(k-or)` etc. are well-defined empty calls).
export const foldWith = (op, identity, xs) => xs.reduce((acc, x) => op(acc, x), identity);
export const kOrAll = (xs) => foldWith(kOr, BOT, xs);   // ⊥ is the ⊕-identity
export const kAndAll = (xs) => foldWith(kAnd, TOP, xs); // ⊤ is the ⊗-identity
export const tOrAll = (xs) => foldWith(tOr, F, xs);     // f is the ∨-identity
export const tAndAll = (xs) => foldWith(tAnd, T, xs);   // t is the ∧-identity

// the four-valued predicates a settler branches on (NO implicit boolean cast — these are explicit).
export const isTrue = (c) => { const [p, n] = present(c); return p && !n; };
export const isFalse = (c) => { const [p, n] = present(c); return !p && n; };
export const isBottom = (c) => { const [p, n] = present(c); return !p && !n; };
export const isTopValue = (c) => isTop(c);

// boolean(charge) -> the truth-projection to a JS boolean, EXPLICIT and lossy. t -> true, everything
// else (f, ⊥, ⊤) -> false. The honest "collapse to a scalar at the edge where you must act".
export const boolean = (c) => isTrue(c);

// isCharge — duck-type a kernel charge { value:[bool,bool], evidence:[[],[]] }.
export const isCharge = (x) =>
  x !== null && typeof x === "object" && Array.isArray(x.value) && x.value.length === 2 &&
  Array.isArray(x.evidence) && x.evidence.length === 2;
