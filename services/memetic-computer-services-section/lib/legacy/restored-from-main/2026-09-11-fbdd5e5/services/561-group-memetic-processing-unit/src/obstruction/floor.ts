// floor.ts — bridge from the bilattice floor to the settling cohomology, and the void-dual read.
//
// A bilattice settling is finite — no limit stage — so its H¹ = 0, as the four-regime dichotomy requires.
// `settlingOf` reads the floor's closure trace as a settling.

import type { Posited, Valuation } from "@561-group/meme";
import { commutate, possibilizeKnowledge, necessitateKnowledge, lastValuation } from "../descent.ts";
import { vanish } from "../void.ts";
import { present } from "../charge.ts";
import { settling, nscFirings, h1, type Settling } from "./settling.ts";

const S = (x: unknown) => JSON.stringify(x);
const dedup = <T>(xs: T[]): T[] => { const out: T[] = []; for (const x of xs) if (!out.some((o) => S(o) === S(x))) out.push(x); return out; };

export const designatedCells = (valuation: Valuation): unknown[] =>
  valuation["fiber-algebras"].flatMap((fa) =>
    fa.assignments
      .filter(({ charge }) => S(present(charge)) === S([true, false]))
      .map(({ cell }) => cell));

export function settlingOf(category: Posited): Settling {
  const { saturated: presheaf, residue: traces } = commutate(category);
  let current: Posited = { presheaf, traces };
  let prev: Posited;
  let cumulative = dedup(designatedCells(lastValuation(current)));
  const stages: { designated: unknown[] }[] = [{ designated: cumulative }];
  do {
    prev = current;
    current = possibilizeKnowledge(necessitateKnowledge(current));
    cumulative = dedup([...cumulative, ...designatedCells(lastValuation(current))]);
    stages.push({ designated: cumulative });
  } while (S(lastValuation(current)) !== S(lastValuation(prev)));
  return settling(stages);
}

export const voidCone = (category: Posited) => vanish(category);

export function gradedVoid(v: Settling): { lost: { stage: number; cell: unknown }[]; rank: number } {
  const lost = nscFirings(v).flatMap((d) => d.added.map((cell) => ({ stage: d.stage, cell })));
  return { lost, rank: lost.length };
}

export const apexVoidMatch = (v: Settling): boolean => h1(v).rank === gradedVoid(v).rank;
