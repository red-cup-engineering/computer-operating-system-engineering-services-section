export type { Rule } from "./substitution.ts";
export { substitute, iterate, orbit as substitutionOrbit, fixedPointClosure, abelianize } from "./substitution.ts";

export { charPoly as verdierCharPoly, charPolyOver, isPrimitive, perronPoly, perronConvergent, isPisot as isPisotMatrix } from "./spectral.ts";

export type { ColimStructure, VerdierDual } from "./verdier.ts";
export { colimStructure, verdierDual, verdierHolds, stepNInvariant } from "./verdier.ts";

export type { GaugeElement } from "./gauge.ts";
export { FOUR_VALUES, GAUGE, fixedSet, firingPatternSelfDual, inducedPermutation, substitutionRuleSelfDual } from "./gauge.ts";
