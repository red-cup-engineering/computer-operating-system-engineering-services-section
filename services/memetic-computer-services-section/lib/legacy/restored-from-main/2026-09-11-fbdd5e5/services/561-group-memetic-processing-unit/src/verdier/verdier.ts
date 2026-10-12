// verdier.ts — Verdier duality on substitution settlings via Anderson-Putnam direct-limit homology.
//
// H¹ (sheaf)  = colim(ℤⁿ, Mᵀ)   H₁ (cosheaf) = colim(ℤⁿ, M)
// Verdier duality: H¹ ≅ H₁ as ℤ-modules (same rank, det, Smith invariant factors).
// All linear algebra exact over our ℤ; stable determinant μ read off the char-poly.

import * as Z from "../number/integer.ts";
import { transpose, determinant, rank, smithNormalForm } from "../number/matrix.ts";
import { charPolyOver } from "./spectral.ts";

type HostMatrix = number[][];

const liftMat = (M: HostMatrix) => M.map((row) => row.map(Z.fromInt));

const primeFactors = (x: Z.Integer): Z.Integer[] => {
  const ps: Z.Integer[] = [];
  let m = x, p = Z.fromInt(2);
  while (!Z.isNegative(Z.subtract(m, Z.multiply(p, p)))) {
    while (Z.divides(p, m)) {
      if (!ps.some((q) => Z.equal(q, p))) ps.push(p);
      m = Z.quotient(m, p);
    }
    p = Z.add(p, Z.one);
  }
  if (!Z.equal(m, Z.one)) ps.push(m);
  return ps;
};

export interface ColimStructure {
  rank: number;
  det: number;
  smith: number[];
  stableDet: number;
  structure: string;
}

export function colimStructure(M: HostMatrix): ColimStructure {
  const n = M.length;
  const Mz = liftMat(M);
  const cpZ = charPolyOver(M);
  const j = cpZ.findIndex((x) => !Z.isZero(x));
  const r = n - j;
  const muZ = Z.fromNatural(Z.magnitude(cpZ[j]!));
  const structure = Z.equal(muZ, Z.one)
    ? `Z^${r}`
    : `${primeFactors(muZ).map((p) => `Z[1/${Z.toInt(p)}]`).join(" ⊗ ")}^${r}`;
  return {
    rank: r,
    det: Z.toInt(determinant(Mz)),
    smith: smithNormalForm(Mz).map(Z.toInt),
    stableDet: Z.toInt(muZ),
    structure,
  };
}

export interface VerdierDual {
  sheaf: ColimStructure;
  cosheaf: ColimStructure;
  holds: boolean;
}

export function verdierDual(M: HostMatrix): VerdierDual {
  const Mt = transpose(liftMat(M)).map((row) => row.map(Z.toInt));
  const sheaf = colimStructure(Mt);
  const cosheaf = colimStructure(M);
  const holds =
    sheaf.rank === cosheaf.rank &&
    sheaf.det === cosheaf.det &&
    JSON.stringify(sheaf.smith) === JSON.stringify(cosheaf.smith);
  return { sheaf, cosheaf, holds };
}

export const verdierHolds = (M: HostMatrix): boolean => verdierDual(M).holds;
export const stepNInvariant = (M: HostMatrix) => ({ rank: rank(liftMat(M)), module: colimStructure(M).structure });
