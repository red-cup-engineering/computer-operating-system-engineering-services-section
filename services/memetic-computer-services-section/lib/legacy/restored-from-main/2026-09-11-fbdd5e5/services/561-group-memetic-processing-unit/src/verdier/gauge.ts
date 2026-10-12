// gauge.ts — the Klein-four gauge on FOUR, and self-duality tests for substitution settlings.
//
// GAUGE elements: id, negation (t↔f, fixes ⊥,⊤), conflation (⊥↔⊤, fixes t,f), double (swaps both).
// Each is read off the floor's own involutions — not declared as literals.

import { FOUR as F, negate, conflate } from "../chu/index.ts";
import type { Four } from "../chu/index.ts";
import * as Z from "../number/integer.ts";
import { matmul, matEqual } from "../number/matrix.ts";

const liftMat = (M: number[][]) => M.map((row) => row.map(Z.fromInt));

export const FOUR_VALUES: Four[] = [F.BOT, F.T, F.F, F.TOP];

const mapOf = (g: (v: Four) => Four): Record<Four, Four> =>
  Object.fromEntries(FOUR_VALUES.map((v) => [v, g(v)])) as Record<Four, Four>;

export const GAUGE: Record<"id" | "negation" | "conflation" | "double", Record<Four, Four>> = {
  id: mapOf((v) => v),
  negation: mapOf(negate),
  conflation: mapOf(conflate),
  double: mapOf((v) => negate(conflate(v))),
};

export type GaugeElement = keyof typeof GAUGE;

export const fixedSet = (sigma: GaugeElement): Four[] =>
  FOUR_VALUES.filter((v) => GAUGE[sigma][v] === v);

export function firingPatternSelfDual(labeling: Four[], sigma: GaugeElement): boolean {
  const fixed = new Set(fixedSet(sigma));
  return labeling.every((v) => fixed.has(v));
}

export function inducedPermutation(labeling: Four[], sigma: GaugeElement): ReturnType<typeof liftMat> | null {
  const n = labeling.length;
  const valueToLetter = new Map(labeling.map((v, i) => [v, i]));
  const P = Array.from({ length: n }, () => Array.from({ length: n }, () => Z.zero));
  for (let i = 0; i < n; i++) {
    const target = GAUGE[sigma][labeling[i]!];
    const j = valueToLetter.get(target);
    if (j === undefined) return null;
    P[j]![i] = Z.one;
  }
  return P;
}

export function substitutionRuleSelfDual(
  M: number[][],
  labeling: Four[],
  sigma: GaugeElement,
): { selfDual: boolean; trivial: boolean } | null {
  const P = inducedPermutation(labeling, sigma);
  if (P === null) return null;
  const Mz = liftMat(M);
  const trivial = P.every((row, i) => row.every((x, j) => Z.equal(x, i === j ? Z.one : Z.zero)));
  return { selfDual: matEqual(matmul(Mz, P), matmul(P, Mz)), trivial };
}
