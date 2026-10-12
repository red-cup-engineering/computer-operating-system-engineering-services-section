// substitution.ts — a substitution as a morphism: σ*: A* → A*, the unique homomorphic extension.
//
// The substitution MATRIX is the abelianization of the morphism — its commutative shadow.
// `fixedPointClosure` presents the morphism as a (lattice, phi) pair for the closure module.

import * as Z from "../number/integer.ts";

export type Rule = Readonly<Record<string, readonly string[]>>;

export const substitute = (rule: Rule, word: readonly string[]): string[] =>
  word.flatMap((letter) => rule[letter] ?? [letter]);

export function iterate(rule: Rule, word: readonly string[], n: number): string[] {
  let w: readonly string[] = word;
  for (let i = 0; i < n; i++) w = substitute(rule, w);
  return [...w];
}

export function* orbit(rule: Rule, seed: readonly string[]): Generator<string[]> {
  let w: readonly string[] = seed;
  for (;;) { yield [...w]; w = substitute(rule, w); }
}

type InfWord = { fixedPoint: true } | string[];
const INF: InfWord = { fixedPoint: true } as { fixedPoint: true };
const isInf = (w: InfWord): w is { fixedPoint: true } => !Array.isArray(w);
const isPrefix = (a: string[], b: string[]): boolean => a.every((x, i) => x === b[i]);

export function fixedPointClosure(rule: Rule, seed: readonly string[]): {
  lattice: {
    bottom: InfWord; eq(a: InfWord, b: InfWord): boolean;
    leq(a: InfWord, b: InfWord): boolean; join(a: InfWord, b: InfWord): InfWord;
    sup(seqFn: (n: number) => InfWord): InfWord;
  };
  phi: (w: InfWord) => InfWord;
} {
  const eq = (a: InfWord, b: InfWord): boolean =>
    isInf(a) ? isInf(b) : !isInf(b) && a.length === b.length && isPrefix(a, b);
  const lattice = {
    bottom: [...seed] as InfWord,
    eq,
    leq: (a: InfWord, b: InfWord) => isInf(b) || (!isInf(a) && a.length <= (b as string[]).length && isPrefix(a, b as string[])),
    join: (a: InfWord, b: InfWord): InfWord => (isInf(a) || isInf(b) ? INF : a.length >= (b as string[]).length ? a : b),
    sup: (seqFn: (n: number) => InfWord): InfWord => {
      let prev = seqFn(0);
      for (let n = 1; n <= 32; n++) {
        const cur = seqFn(n);
        if (eq(cur, prev)) return cur;
        if (!isInf(cur) && !isInf(prev) && cur.length > (prev as string[]).length) return INF;
        prev = cur;
      }
      return INF;
    },
  };
  const phi = (w: InfWord): InfWord => isInf(w) ? INF : substitute(rule, w as string[]);
  return { lattice, phi };
}

export function abelianize(rule: Rule, alphabet: readonly string[]): ReturnType<typeof Z.fromInt>[][] {
  return alphabet.map((row) =>
    alphabet.map((col) => Z.fromInt((rule[col] ?? []).filter((x) => x === row).length)));
}
