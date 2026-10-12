// generator.ts — the d-frame H¹-generator D_μ at a non-Scott-continuous firing.
//
// At each NSC (limit) firing μ, the newly-designated cell's bilattice value gives:
//   truth-only (t):  (ℤ, 0, trivial, trivial)
//   falsity-only (f):(0, ℤ, trivial, trivial)
//   ⊤-firing:        (ℤ, ℤ, con-fails-on-singleton-pair, trivial)
//   ⊥-firing:        (0, 0, trivial, trivial)
//
// H¹_dFrm = ⊕_μ D_μ over the firings; its shadow recovers the dframe ranks.

import type { Four } from "../chu/index.ts";
import { SIDE_CONTRIBUTION, classifyFiring, type FiringType } from "../dframe/cohomology.ts";
import { GAUGE } from "../verdier/gauge.ts";
import { nscFirings, type Settling } from "../obstruction/settling.ts";

export interface DframeGenerator {
  value: Four;
  firingType: FiringType;
  lPlus: 0 | 1;
  lMinus: 0 | 1;
  consistency: string;
  totality: "trivial";
}

export function dframeGenerator(value: Four): DframeGenerator {
  const side = SIDE_CONTRIBUTION[value];
  if (!side) throw new RangeError(`not a bilattice value: ${value}`);
  const [plus, minus] = side;
  return {
    value,
    firingType: classifyFiring(value),
    lPlus: plus ? 1 : 0,
    lMinus: minus ? 1 : 0,
    consistency: plus && minus ? "con-fails-on-singleton-pair" : "trivial",
    totality: "trivial",
  };
}

export interface H1Dframe {
  generators: { stage: number; value: Four; D: DframeGenerator }[];
  rank: number;
  lPlus: number;
  lMinus: number;
  structure: string;
}

export function h1Dframe(valuedFirings: { stage: number; value: Four }[]): H1Dframe {
  const generators = valuedFirings.map((f) => ({ stage: f.stage, value: f.value, D: dframeGenerator(f.value) }));
  const lPlus = generators.filter((g) => g.D.lPlus).length;
  const lMinus = generators.filter((g) => g.D.lMinus).length;
  const structure = generators.length ? generators.map((g) => `D_${g.stage}`).join(" ⊕ ") : "0";
  return { generators, rank: generators.length, lPlus, lMinus, structure };
}

export function shadow(valuedFirings: { stage: number; value: Four }[]): {
  lPlus: number; lMinus: number; truthSide: string; falsitySide: string;
} {
  const h = h1Dframe(valuedFirings);
  return { lPlus: h.lPlus, lMinus: h.lMinus, truthSide: `Z^${h.lPlus}`, falsitySide: `Z^${h.lMinus}` };
}

export const negateGenerator = (D: DframeGenerator): DframeGenerator =>
  dframeGenerator(GAUGE.negation[D.value]);

export function linearlyIndependent(valuedFirings: { stage: number; value: Four }[]): boolean {
  const stages = valuedFirings.map((f) => f.stage);
  return new Set(stages).size === stages.length;
}

export function fromSettling(settling: Settling, values: Four[]): { stage: number; value: Four }[] {
  const firings = nscFirings(settling);
  if (values.length !== firings.length)
    throw new RangeError(`expected ${firings.length} values (one per NSC firing), got ${values.length}`);
  return firings.map((f, i) => ({ stage: f.stage, value: values[i]! }));
}
