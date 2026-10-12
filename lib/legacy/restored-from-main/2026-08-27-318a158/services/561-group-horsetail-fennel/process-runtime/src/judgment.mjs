// judgment — the FOUR-valued judgment alphabet for the process model, as a reading of the
// math-kernel four-bilattice, PLUS the admissibility chain the process settle folds through.
//
// THE LAW says a value is a CHARGE [believesTrue, believesFalse] over the FOUR bilattice {f,⊥,⊤,t},
// and a contradiction ⊤ is a HELD value, never an error. This module re-derives NONE of the
// bilattice: FOUR, asFour, the involutions and the four lattice operations are @lenticule-science/metrologic/chu/four's,
// named with Belnap's letters. It adds only what is LOCAL to the process layer (L9):
//
//   • the ADMISSIBILITY chain  ⊤ ≤ f ≤ ⊥ ≤ t  — a SEPARATE total order (NOT a bilattice order) the
//     process settle folds independent judgments through, "worst obstruction wins": a contradiction
//     is worse than a denial, a denial worse than an unknown, the identity is t. A process whose
//     judgments fold to t is ready; to f is denied; to ⊥ is unsettled; to ⊤ is contradicted (held).
//
// Lifted from apps/tools/swarm/src/bilattice.mjs (toCharge/fromCharge, meetAdmissibility,
// foldReadiness, isAdmitted) — the SWARM-domain names (readiness) generalized to the process layer.
// The domain (WHICH judgments a process raises) STAYS in the app; the FOLD lives here.

export {
  FOUR,
  isFour,
  asFour,
  negate,
  conflate,
  truthMeet,
  truthJoin,
  knowledgeMeet,
  knowledgeJoin,
} from "@lenticule-science/metrologic/chu/four";

import { FOUR, asFour } from "@lenticule-science/metrologic/chu/four";

// the carrier-tuple view and back — FOUR ≅ [believesTrue, believesFalse] (the kernel charge VALUE),
// as a bare 2-bit pair. This is THE LAW's CHARGE presentation; chu/four carries the full charge with
// its evidence. The 2-bit pair is what a process judgment presents at its boundary.
const PAIR = Object.freeze({ t: [1, 0], f: [0, 1], bot: [0, 0], top: [1, 1] });
const NAMES = Object.freeze(Object.keys(PAIR));

export function toCharge(v) {
  return [...PAIR[asFour(v)]];
}

export function fromCharge([positive, negative]) {
  const pos = positive ? 1 : 0;
  const neg = negative ? 1 : 0;
  for (const name of NAMES) {
    if (PAIR[name][0] === pos && PAIR[name][1] === neg) return name;
  }
  /* unreachable: 2×2 is total */ return FOUR.BOT;
}

// ── the admissibility order — a SEPARATE total order used to fold independent judgments ──────────
// NOT one of the two bilattice orders: the chain  ⊤ ≤ f ≤ ⊥ ≤ t. It is a chain, hence a lattice;
// meetAdmissibility is its greatest-lower-bound and FOUR.T its top (the fold identity). This is what
// a process folds its judgments through to reach a single composite verdict (worst-obstruction-wins).
const ADMISSIBILITY_RANK = Object.freeze({ top: 0, f: 1, bot: 2, t: 3 });

export function meetAdmissibility(a, b) {
  return ADMISSIBILITY_RANK[asFour(a)] <= ADMISSIBILITY_RANK[asFour(b)] ? asFour(a) : asFour(b);
}

// foldJudgments(values) — settle a row of independent FOUR judgments to one verdict under the
// admissibility meet (identity t). A process's composite readiness IS this fold over its judgments.
export function foldJudgments(values) {
  return values.reduce((acc, v) => meetAdmissibility(acc, v), FOUR.T);
}

// a process is admitted (ready to advance) exactly when its composite settles to t.
export function isAdmitted(v) {
  return asFour(v) === FOUR.T;
}
