export type { Ordinal, ZeroOrdinal, SuccOrdinal, LimitOrdinal } from "./ordinal.ts";
export { zero, succ, limit, isZero, isSucc, isLimit, fin, plusFin, OMEGA, omegaTimes, OMEGA_SQ, toFinite, show } from "./ordinal.ts";

export type { Lattice } from "./iterate.ts";
export { approx, orbit, stabilizingSup } from "./iterate.ts";

export type { Regime, ClosureResult } from "./closure.ts";
export { regimeOfOrdinal, closureOrdinal, leastFixedPoint } from "./closure.ts";

export { reachability, omegaPlusOne, tower, fromBilattice } from "./lattices.ts";
