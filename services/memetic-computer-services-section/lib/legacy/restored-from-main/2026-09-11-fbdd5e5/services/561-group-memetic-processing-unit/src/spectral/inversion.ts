// inversion.ts — the spectral inversion duality z ↦ 1/z, over our integers.
//
// Two morphisms, both pure integer (no roots computed, no division):
//   reciprocal     — p ↦ p* (reverse coefficients), an involution
//   inversionSymmetric — p shares a root with p* iff resultant(p, p*) = 0

import * as Z from "../number/integer.ts";
import type { Integer } from "../number/integer.ts";

type Poly = Integer[];

function normalize(coeffs: Poly): Poly {
  let hi = coeffs.length - 1;
  while (hi > 0 && Z.isZero(coeffs[hi]!)) hi--;
  return coeffs.slice(0, hi + 1);
}

export const fromInts = (ints: number[]): Poly => normalize(ints.map(Z.fromInt));
export const toInts = (p: Poly): number[] => p.map(Z.toInt);
export const degree = (p: Poly): number => normalize(p).length - 1;

export function equal(p: Poly, q: Poly): boolean {
  const a = normalize(p), b = normalize(q);
  return a.length === b.length && a.every((c, i) => Z.equal(c, b[i]!));
}

export const reciprocal = (p: Poly): Poly => normalize([...normalize(p)].reverse());
export const isSelfReciprocal = (p: Poly): boolean => equal(p, reciprocal(p));

function determinant(M: Integer[][]): Integer {
  const n = M.length;
  if (n === 1) return M[0]![0]!;
  let acc = Z.zero;
  for (let j = 0; j < n; j++) {
    const minor = M.slice(1).map((row) => row.filter((_, k) => k !== j));
    const term = Z.multiply(M[0]![j]!, determinant(minor));
    acc = j % 2 === 0 ? Z.add(acc, term) : Z.subtract(acc, term);
  }
  return acc;
}

function sylvester(p: Poly, q: Poly): Integer[][] {
  const a = normalize(p), b = normalize(q);
  const n = a.length - 1, m = b.length - 1;
  const P = [...a].reverse(), Q = [...b].reverse();
  const size = n + m;
  const S = Array.from({ length: size }, () => Array.from({ length: size }, () => Z.zero));
  for (let i = 0; i < m; i++) for (let j = 0; j <= n; j++) S[i]![i + j] = P[j]!;
  for (let i = 0; i < n; i++) for (let j = 0; j <= m; j++) S[m + i]![i + j] = Q[j]!;
  return S;
}

export const resultant = (p: Poly, q: Poly): Integer => determinant(sylvester(p, q));
export const sharesRoot = (p: Poly, q: Poly): boolean => Z.isZero(resultant(p, q));
export const inversionSymmetric = (p: Poly): boolean => sharesRoot(p, reciprocal(p));
