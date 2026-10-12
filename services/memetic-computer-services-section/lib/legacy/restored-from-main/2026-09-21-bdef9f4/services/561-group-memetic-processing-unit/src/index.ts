// index.ts — the MPU surface: the word-algebra, the structure-preserving descent and its modal
// calculus, the knowledge-base drive, and the stateful unit.
//
// This barrel carries NO logic and re-exports nothing that belongs to another package. The data
// types are `@561-group/meme`'s — import them from there. The four-valued evidence, graph,
// exact-arithmetic, fixed-point and spectral mathematics are `@lenticule-science/metrologic`'s —
// import the surface you need from its own subpath (`/chu`, `/number`, `/closure`, `/obstruction`,
// `/spectral`, `/verdier`, `/dframe`, `/dgen`). The MPU used to carry a TypeScript copy of all of
// it; the copy is gone, and there is one implementation again.

// the word and its value-algebra
export type { Charge, ChargePair } from "./charge.ts";
export {
  present, isTop, isBottom, negate, conflate,
  joinKnowledge, meetKnowledge, joinTruth, meetTruth, leqKnowledge, compareKnowledge, aggregate,
  bottom, potential,
} from "./charge.ts";

// the descent: MPU-internal types
export type { Potential } from "./descent.ts";
// the descent: the four regimes, the modal calculus, the closure
export {
  articulate, predicate, cohere, posit, commutate, settle, settleTraced, compare, lastValuation,
  raiseKnowledge, lowerKnowledge, raiseTruth, lowerTruth,
  possibilizeKnowledge, necessitateKnowledge, possibilizeTruth, necessitateTruth,
} from "./descent.ts";

// the knowledge-base drive and its projections
export type { Witness, MemeCharge } from "./compose.ts";
export { compose, settleOne, settleOneTraced, positedFrom, memeChargeOf, chargeAt } from "./compose.ts";

// the cone duals: GFP generators for each order
export { brim, adjudicate, presume } from "./cone.ts";

// the void reads: gap, vanish, and the aperiodic monad
export type { PathEdge, PathPotential, GapInterval } from "./void.ts";
export { saturate, transfer, twistor, precipitate, estrange, gap, vanish } from "./void.ts";

// the processing unit
export { Mpu } from "./mpu.ts";
