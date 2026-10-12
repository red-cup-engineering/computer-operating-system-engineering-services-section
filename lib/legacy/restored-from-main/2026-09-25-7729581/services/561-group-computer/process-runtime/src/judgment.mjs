// judgment - the ADMISSIBILITY chain the process settle folds through.
//
// THE LAW says a value is a CHARGE [believesTrue, believesFalse] over the four-valued bilattice, and
// a contradiction (stable) is a HELD value, never an error. This module re-derives NONE of that
// bilattice: the four values, their names, the involutions and the four lattice operations are
// @lenticule-science/metrologic/articulation/predicating/positing/bilattice-charge's. A judgment is one of that
// module's charge-value names - `potential` (ready), `active` (denied), `absurd` (unsettled),
// `stable` (contradicted, held).
//
// What is LOCAL to the process layer (L9) is only this:
//
//   * the ADMISSIBILITY chain  stable <= active <= absurd <= potential - a SEPARATE total order (NOT
//     a bilattice order) the process settle folds independent judgments through, "worst obstruction
//     wins": a contradiction is worse than a denial, a denial worse than an unknown, the identity is
//     `potential`. A process whose judgments fold to potential is ready; to active is denied; to
//     absurd is unsettled; to stable is contradicted (held).
//
// Lifted from apps/tools/swarm/src/bilattice.mjs (meetAdmissibility, foldReadiness, isAdmitted) -
// the SWARM-domain names (readiness) generalized to the process layer. The domain (WHICH judgments a
// process raises) STAYS in the app; the FOLD lives here.

import { readingAs } from "@red-cup-engineering/computer-data-engineering-services-section/signcell/cell";

// -- the admissibility order - a SEPARATE total order used to fold independent judgments ---------
// NOT one of the two bilattice orders: the chain  stable <= active <= absurd <= potential. It is a
// chain, hence a lattice; meetAdmissibility is its greatest-lower-bound and `potential` its top (the
// fold identity). This is what a process folds its judgments through to reach a single composite
// verdict (worst-obstruction-wins).
const ADMISSIBILITY_RANK = Object.freeze({ stable: 0, active: 1, absurd: 2, potential: 3 });

export function meetAdmissibility(a, b) {
  return ADMISSIBILITY_RANK[readingAs("knowledge", a)] <= ADMISSIBILITY_RANK[readingAs("knowledge", b)]
    ? readingAs("knowledge", a)
    : readingAs("knowledge", b);
}

// foldJudgments(values) - settle a row of independent judgments to one verdict under the
// admissibility meet (identity `potential`). A process's composite readiness IS this fold over its
// judgments.
export function foldJudgments(values) {
  return values.reduce((acc, v) => meetAdmissibility(acc, v), "potential");
}

// a process is admitted (ready to advance) exactly when its composite settles to `potential`.
export function isAdmitted(v) {
  return readingAs("knowledge", v) === "potential";
}
