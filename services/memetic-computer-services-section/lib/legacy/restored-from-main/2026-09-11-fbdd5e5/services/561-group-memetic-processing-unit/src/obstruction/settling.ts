// settling.ts — the settling-associated sheaf and its cohomology, computed over real data.
//
// A SETTLING is a monotone sequence of stages. Each stage designates a cumulative set of cells
// (knowledge only accumulates). Some stages are LIMIT ordinals (marked `limit: true`).
//
//   H¹ = the free abelian group on cells FIRST designated at a limit stage.
//   rank H¹ = number of such cells (the non-Scott-continuous firings count).
//
// A finite settling (no limit stage) has H¹ = 0 — exactly what the bilattice floor produces.

const S = (x: unknown) => JSON.stringify(x);
const dedup = <T>(xs: T[]): T[] => { const out: T[] = []; for (const x of xs) if (!out.some((o) => S(o) === S(x))) out.push(x); return out; };
const without = <T>(xs: T[], ys: T[]): T[] => xs.filter((x) => !ys.some((y) => S(y) === S(x)));

export interface Stage { readonly designated: readonly unknown[]; readonly limit: boolean }
export interface Settling { readonly stages: readonly Stage[]; readonly cofinal?: string }

export function settling(
  stages: readonly { designated: readonly unknown[]; limit?: boolean }[],
  opts: { cofinal?: "uncountable" } = {},
): Settling {
  if (!Array.isArray(stages) || stages.length === 0) throw new TypeError("settling: need at least one stage");
  if (stages[0]!.limit) throw new TypeError("settling: stage 0 cannot be a limit ordinal");
  const norm: Stage[] = stages.map((s, i) => {
    const designated = dedup([...(s.designated ?? [])]);
    if (i > 0) {
      const prev = stages[i - 1]!.designated ?? [];
      if (without([...prev], designated).length) throw new TypeError(`settling: stage ${i} drops cells — knowledge must only accumulate`);
    }
    return { designated, limit: !!s.limit };
  });
  return opts.cofinal ? { stages: norm, cofinal: opts.cofinal } : { stages: norm };
}

export interface Increment { readonly stage: number; readonly limit: boolean; readonly added: readonly unknown[] }

export function increments(v: Settling): Increment[] {
  return v.stages.map((s, i) => ({
    stage: i,
    limit: s.limit,
    added: i === 0 ? [...s.designated] : without([...s.designated], [...v.stages[i - 1]!.designated]),
  }));
}

export const firings = (v: Settling): Increment[] => increments(v).filter((d) => d.added.length > 0);
export const nscFirings = (v: Settling): Increment[] => firings(v).filter((d) => d.limit);

export interface H1Result {
  readonly generators: readonly { stage: number; cell: unknown }[];
  readonly rank: number;
  readonly degree: 1;
  readonly vanishes: boolean;
}

export function h1(v: Settling): H1Result {
  const generators = nscFirings(v).flatMap((d) => d.added.map((cell) => ({ stage: d.stage, cell })));
  return { generators, rank: generators.length, degree: 1, vanishes: generators.length === 0 };
}

export const clInv = (v: Settling): string => S(nscFirings(v).map((d) => dedup([...d.added])));
export const mldEquivalent = (a: Settling, b: Settling): boolean => clInv(a) === clInv(b);

export type Regime = "finite" | "scott" | "transfinite" | "aperiodic";

export interface Classification { readonly depth: number; readonly regime: Regime }

export function classify(v: Settling): Classification {
  const fs = firings(v);
  const depth = fs.length ? fs[fs.length - 1]!.stage : 0;
  const hasLimit = v.stages.some((s) => s.limit);
  const hasNsc = nscFirings(v).length > 0;
  let regime: Regime;
  if (!hasNsc) regime = hasLimit ? "scott" : "finite";
  else regime = v.cofinal === "uncountable" ? "aperiodic" : "transfinite";
  return { depth, regime };
}

export const depth = (v: Settling): number => classify(v).depth;
