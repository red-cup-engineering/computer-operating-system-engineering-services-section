// matrix.ts — integer matrices over our integers.
//
// Determinant (cofactor expansion), characteristic polynomial det(λI − M), Smith normal form,
// rank — all exact over our ℤ, no host arithmetic, no external package.
import * as Z from "./integer.ts";
import type { Integer } from "./integer.ts";

export type Matrix = Integer[][];

// ── ℤ[λ] polynomials (low→high), for the characteristic polynomial ────────────

type Poly = Integer[];

const PZERO: Poly = [Z.zero];

const pnorm = (p: Poly): Poly => {
  let h = p.length - 1;
  while (h > 0 && Z.isZero(p[h]!)) h--;
  return p.slice(0, h + 1);
};

const ppad = (a: Poly, b: Poly, op: (x: Integer, y: Integer) => Integer): Poly => {
  const n = Math.max(a.length, b.length);
  return pnorm(Array.from({ length: n }, (_, i) => op(a[i] ?? Z.zero, b[i] ?? Z.zero)));
};

const padd = (a: Poly, b: Poly): Poly => ppad(a, b, Z.add);
const psub = (a: Poly, b: Poly): Poly => ppad(a, b, Z.subtract);
const pmul = (a: Poly, b: Poly): Poly => {
  const r: Integer[] = Array.from({ length: a.length + b.length - 1 }, () => Z.zero);
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++)
      r[i + j] = Z.add(r[i + j]!, Z.multiply(a[i]!, b[j]!));
  return pnorm(r);
};

interface Ring<T> { zero: T; add(a: T, b: T): T; sub(a: T, b: T): T; mul(a: T, b: T): T; }

const Zring: Ring<Integer> = { zero: Z.zero, add: Z.add, sub: Z.subtract, mul: Z.multiply };
const Pring: Ring<Poly>    = { zero: PZERO,  add: padd,  sub: psub,       mul: pmul };

function det<T>(M: T[][], R: Ring<T>): T {
  const n = M.length;
  if (n === 1) return M[0]![0]!;
  let acc = R.zero;
  for (let j = 0; j < n; j++) {
    const minor = M.slice(1).map((row) => row.filter((_, k) => k !== j));
    const term = R.mul(M[0]![j]!, det(minor, R));
    acc = j % 2 === 0 ? R.add(acc, term) : R.sub(acc, term);
  }
  return acc;
}

// ── matrix operations ────────────────────────────────────────────────────────

/** Transpose. */
export const transpose = (M: Matrix): Matrix => M[0]!.map((_, j) => M.map((r) => r[j]!));

/** Matrix product over our ℤ. */
export const matmul = (A: Matrix, B: Matrix): Matrix =>
  A.map((row) => B[0]!.map((_, j) =>
    row.reduce((s, aik, k) => Z.add(s, Z.multiply(aik, B[k]![j]!)), Z.zero)));

/** Structural equality of two integer matrices. */
export const matEqual = (A: Matrix, B: Matrix): boolean =>
  A.length === B.length &&
  A.every((r, i) => r.length === B[i]!.length && r.every((x, j) => Z.equal(x, B[i]![j]!)));

/** The determinant of a square integer matrix (exact, our ℤ). */
export const determinant = (M: Matrix): Integer => det(M, Zring);

/** The characteristic polynomial det(λI − M) — coefficients (our ℤ) low→high, monic. */
export function charPoly(M: Matrix): Poly {
  const lamIminusM: Poly[][] = M.map((row, i) =>
    row.map((x, j) => (i === j ? [Z.negate(x), Z.one] : [Z.negate(x)])));
  return det(lamIminusM, Pring);
}

/** The Smith normal form invariant factors |d₁| | |d₂| | … (our ℤ, nonnegative). */
export function smithNormalForm(M: Matrix): Integer[] {
  const A: Integer[][] = M.map((r) => [...r]);
  const m = A.length, n = A[0]!.length;
  const swapRows = (i: number, j: number) => { [A[i], A[j]] = [A[j]!, A[i]!]; };
  const swapCols = (i: number, j: number) => { for (const r of A) [r[i], r[j]] = [r[j]!, r[i]!]; };
  const addRow = (dst: number, src: number, q: Integer) => {
    for (let j = 0; j < n; j++) A[dst]![j] = Z.subtract(A[dst]![j]!, Z.multiply(q, A[src]![j]!));
  };
  const addCol = (dst: number, src: number, q: Integer) => {
    for (let i = 0; i < m; i++) A[i]![dst] = Z.subtract(A[i]![dst]!, Z.multiply(q, A[i]![src]!));
  };

  const lim = Math.min(m, n);
  for (let t = 0; t < lim; t++) {
    let found = false;
    outer: for (let i = t; i < m; i++) for (let j = t; j < n; j++) {
      if (!Z.isZero(A[i]![j]!)) { swapRows(t, i); swapCols(t, j); found = true; break outer; }
    }
    if (!found) break;
    for (;;) {
      let changed = false;
      for (let i = t + 1; i < m; i++) {
        if (Z.isZero(A[i]![t]!)) continue;
        addRow(i, t, Z.quotient(A[i]![t]!, A[t]![t]!));
        if (!Z.isZero(A[i]![t]!)) { swapRows(t, i); changed = true; }
      }
      for (let j = t + 1; j < n; j++) {
        if (Z.isZero(A[t]![j]!)) continue;
        addCol(j, t, Z.quotient(A[t]![j]!, A[t]![t]!));
        if (!Z.isZero(A[t]![j]!)) { swapCols(t, j); changed = true; }
      }
      if (!changed) break;
    }
    let fixed = false;
    outer2: for (let i = t + 1; i < m; i++) for (let j = t + 1; j < n; j++) {
      if (!Z.divides(A[t]![t]!, A[i]![j]!)) { addRow(t, i, Z.negate(Z.one)); fixed = true; break outer2; }
    }
    if (fixed) { t--; continue; }
  }

  const factors: Integer[] = [];
  for (let t = 0; t < lim; t++) factors.push(Z.fromNatural(Z.magnitude(A[t]![t]! ?? Z.zero)));
  return factors;
}

/** The rank — the number of nonzero invariant factors (= rank over ℚ). */
export const rank = (M: Matrix): number => smithNormalForm(M).filter((f) => !Z.isZero(f)).length;

/** A matrix from host integers, for inputs and tests. */
export const fromInts = (rows: number[][]): Matrix => rows.map((r) => r.map(Z.fromInt));
