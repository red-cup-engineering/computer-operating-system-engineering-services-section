// cohomology.ts — the d-frame-valued (bigraded) cohomology of a substitution settling.
//
// Each FOUR value contributes to a truth side (L₊) and falsity side (L₋):
//   t → (1,0)  truth-only     f → (0,1)  falsity-only
//   ⊤ → (1,1)  both           ⊥ → (0,0)  neither
// SIDE_CONTRIBUTION is READ off the floor's charge bits — not hand-written.

import * as Z from "../number/integer.ts";
import { rank, transpose } from "../number/matrix.ts";
import { FOUR, toCharge } from "../chu/index.ts";
import type { Four } from "../chu/index.ts";

const liftMat = (M: number[][]) => M.map((row) => row.map(Z.fromInt));

export const SIDE_CONTRIBUTION: Record<Four, readonly [boolean, boolean]> = Object.fromEntries(
  Object.values(FOUR).map((v) => [v, toCharge(v).value]),
) as Record<Four, readonly [boolean, boolean]>;

export type FiringType = "truth-only" | "falsity-only" | "top-firing" | "bot-firing";

export function classifyFiring(value: Four): FiringType {
  const [plus, minus] = SIDE_CONTRIBUTION[value];
  if (plus && minus) return "top-firing";
  if (plus) return "truth-only";
  if (minus) return "falsity-only";
  return "bot-firing";
}

export interface PerFiringDframe {
  value: Four;
  firingType: FiringType;
  lPlus: 0 | 1;
  lMinus: 0 | 1;
  consistency: string;
}

export function perFiringDframe(values: Four[]): PerFiringDframe[] {
  return values.map((v) => {
    const [plus, minus] = SIDE_CONTRIBUTION[v];
    return {
      value: v,
      firingType: classifyFiring(v),
      lPlus: plus ? 1 : 0,
      lMinus: minus ? 1 : 0,
      consistency: plus && minus ? "fails-on-singleton-pair" : "trivial",
    };
  });
}

export interface DframeCohomology {
  values: Four[];
  perFiring: PerFiringDframe[];
  firingCounts: Record<FiringType, number>;
  abRank: number;
  singular: boolean;
  shadow: { truthSide: string; falsitySide: string; lPlus: number; lMinus: number };
  shadowMatchesAbRank: boolean;
}

export function dframeCohomology(M: number[][], values: Four[]): DframeCohomology {
  if (values.length !== M.length) throw new RangeError("value count must match matrix size");
  const perFiring = perFiringDframe(values);
  const counts: Record<FiringType, number> = { "truth-only": 0, "falsity-only": 0, "top-firing": 0, "bot-firing": 0 };
  for (const d of perFiring) counts[d.firingType]++;
  const lPlusCount = perFiring.filter((d) => d.lPlus).length;
  const lMinusCount = perFiring.filter((d) => d.lMinus).length;
  const abRank = rank(transpose(liftMat(M)));
  return {
    values,
    perFiring,
    firingCounts: counts,
    abRank,
    singular: abRank < M.length,
    shadow: { truthSide: `Z^${lPlusCount}`, falsitySide: `Z^${lMinusCount}`, lPlus: lPlusCount, lMinus: lMinusCount },
    shadowMatchesAbRank: perFiring.length === abRank,
  };
}
