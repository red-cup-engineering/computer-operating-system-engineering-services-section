// spectral.ts (verdier) — primitivity and Pisot test for a substitution matrix.
//
// All exact over our ℤ/ℚ. The characteristic polynomial is charPoly from number/matrix. Pisot test
// delegates to spectral/location. The Perron eigenvalue is carried as its char-poly + rational convergents.

import * as Z from "../number/integer.ts";
import * as Q from "../number/rational.ts";
import { charPoly as charPolyZ, matmul as matmulZ } from "../number/matrix.ts";
import { rootLocation } from "../spectral/location.ts";

type HostMatrix = number[][];

const liftMat = (M: HostMatrix) => M.map((row) => row.map(Z.fromInt));

export function charPoly(M: HostMatrix): number[] {
  return charPolyZ(liftMat(M)).map(Z.toInt);
}

export const charPolyOver = (M: HostMatrix) => charPolyZ(liftMat(M));

export function isPrimitive(M: HostMatrix): boolean {
  const n = M.length;
  if (M.some((r) => r.some((x) => x < 0))) return false;
  const Mz = liftMat(M);
  const allPositive = (P: ReturnType<typeof liftMat>) => P.every((r) => r.every((x) => Z.isPositive(x)));
  let P = Mz;
  for (let k = 1; k <= (n - 1) * (n - 1) + 1; k++) {
    if (allPositive(P)) return true;
    P = matmulZ(P, Mz);
  }
  return allPositive(P);
}

export const perronPoly = (M: HostMatrix): number[] => charPoly(M);

export function perronConvergent(M: HostMatrix, iters = 4): Q.Rational {
  const n = M.length;
  const Mz = liftMat(M);
  let v = Array(n).fill(Z.one);
  const total = (w: Z.Integer[]) => w.reduce((s: Z.Integer, x: Z.Integer) => Z.add(s, x), Z.zero);
  for (let k = 0; k < iters; k++) {
    const w = Mz.map((row) => row.reduce((s: Z.Integer, a: Z.Integer, j: number) => Z.add(s, Z.multiply(a, v[j]!)), Z.zero));
    if (k === iters - 1) return Q.rational(Z.fromNatural(Z.magnitude(total(w))), Z.fromNatural(Z.magnitude(total(v))));
    v = w;
  }
  return Q.one;
}

export function isPisot(M: HostMatrix): { pisot: boolean; outside: number | null } {
  const cp = charPolyOver(M);
  const loc = rootLocation(cp);
  if (loc.degenerate) return { pisot: false, outside: null };
  return { pisot: loc.expanding === 1 && loc.neutral === 0, outside: loc.expanding };
}
