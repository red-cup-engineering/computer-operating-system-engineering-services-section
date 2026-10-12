// cochain.ts — the cohomology of a settling, constructed from the carriers.
//
// From the cells the descent witnesses, we build the cellular cochain complex
//   C⁰ = ℤ^{entities}  ──δ⁰──▶  C¹ = ℤ^{cells}    (δ⁰ f)(s → o) = f(o) − f(s)
//
// δ⁰ is the incidence map of the witnessed graph. H⁰ = ker δ⁰ ≅ ℤ^{#components}; H¹ rank = first
// Betti number |cells| − |entities| + #components. Connectivity via union-find, no host arithmetic.

import type { Cell } from "@561-group/meme";
import { articulate, predicate, posit, settle } from "../descent.ts";

const S = (x: unknown) => JSON.stringify(x);

export interface CohomologyResult {
  readonly entities: readonly string[];
  readonly cells: readonly { subject: unknown; predicate: unknown; object: unknown }[];
  readonly d0: readonly (readonly number[])[];
  readonly H0: { readonly rank: number; readonly cocycles: readonly (readonly number[])[] };
  readonly H1: { readonly rank: number; readonly vanishes: boolean };
}

export function cohomologyOfRelation(
  cells: readonly { subject: unknown; predicate: unknown; object: unknown }[],
): CohomologyResult {
  const entities = [...new Set(cells.flatMap((c) => [S(c.subject), S(c.object)]))];
  const vi = new Map(entities.map((v, i) => [v, i]));
  const V = entities.length, E = cells.length;

  const d0: number[][] = cells.map((c) => {
    const row = Array(V).fill(0) as number[];
    const oi = vi.get(S(c.object)); const si = vi.get(S(c.subject));
    if (oi !== undefined) row[oi] = (row[oi] ?? 0) + 1;
    if (si !== undefined) row[si] = (row[si] ?? 0) - 1;
    return row;
  });

  const parent: number[] = entities.map((_, i) => i);
  const find = (x: number): number => { if (parent[x] === x) return x; parent[x] = find(parent[x]!); return parent[x]!; };
  const union = (a: number, b: number) => { parent[find(a)] = find(b); };
  for (const c of cells) {
    const si = vi.get(S(c.subject)), oi = vi.get(S(c.object));
    if (si !== undefined && oi !== undefined) union(si, oi);
  }
  const roots = [...new Set(entities.map((_, i) => find(i)))];
  const components = roots.length;

  const cocycles = roots.map((r) => entities.map((_, i) => (find(i) === r ? 1 : 0)));

  return {
    entities,
    cells,
    d0,
    H0: { rank: components, cocycles },
    H1: { rank: E - V + components, vanishes: E - V + components === 0 },
  };
}

export const settledRelation = (category: ReturnType<typeof posit>): Cell[] =>
  settle(category).sheaf.section["fiber-algebras"].flatMap((fa) =>
    fa.assignments.map((a) => a.cell as Cell));

export const cohomologyOf = (utterance: [unknown, unknown]): CohomologyResult =>
  cohomologyOfRelation(settledRelation(posit(predicate(articulate(utterance)))));
