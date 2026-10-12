// orbits.ts — the composed-duality (strong-MLD) orbit type of a settling.
//
// D_val = bilattice negation (t↔f, fixes ⊤,⊥). A settling is self-dual under the composed duality D
// iff every firing is a ⊤- or ⊥-firing (none truth-only or falsity-only). This is exactly
// firing-pattern self-duality under negation (negation's fixed set = {⊤,⊥}).

import type { Four } from "../chu/index.ts";
import { GAUGE, firingPatternSelfDual, type GaugeElement } from "../verdier/gauge.ts";

export type OrbitType = "self-dual" | "truth-only orbit" | "falsity-only orbit" | "exchange-mixed" | "mixed";

export interface OrbitClassification {
  firingCounts: Record<string, number>;
  orbitType: OrbitType;
  orbitSize: 1 | 2 | "variable";
  selfDual: boolean;
  negated: Four[];
}

export function classifyOrbitType(values: Four[]): OrbitClassification {
  const counts: Record<string, number> = { "truth-only": 0, "falsity-only": 0, top: 0, bot: 0 };
  for (const v of values) counts[v === "t" ? "truth-only" : v === "f" ? "falsity-only" : v]!++;
  const { "truth-only": nT, "falsity-only": nF, top: nTop, bot: nBot } = counts;

  let orbitType: OrbitType, orbitSize: 1 | 2 | "variable";
  if (nT === 0 && nF === 0) { orbitType = "self-dual"; orbitSize = 1; }
  else if (nTop === 0 && nBot === 0) {
    orbitSize = 2;
    orbitType = nF === 0 ? "truth-only orbit" : nT === 0 ? "falsity-only orbit" : "exchange-mixed";
  } else { orbitType = "mixed"; orbitSize = "variable"; }

  return {
    firingCounts: counts,
    orbitType,
    orbitSize,
    selfDual: orbitType === "self-dual",
    negated: values.map((v) => GAUGE.negation[v]),
  };
}

export interface ComposedSelfDuality {
  composed: boolean;
  everySymmetric: boolean;
  negationFixed: boolean;
  agree: boolean;
}

export function verifyComposedSelfDuality(values: Four[]): ComposedSelfDuality {
  const composed = classifyOrbitType(values).selfDual;
  const everySymmetric = values.every((v) => v === "top" || v === "bot");
  const negationFixed = firingPatternSelfDual(values, "negation" as GaugeElement);
  return { composed, everySymmetric, negationFixed, agree: composed === everySymmetric && everySymmetric === negationFixed };
}
