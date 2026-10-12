// closure.ts — the closure ordinal κ as a morphism, and the regime it determines.
//
// REGIME, read off κ:
//   finite      κ < ω
//   scott       κ = ω         (Scott-continuous — the ω-limit is already fixed)
//   transfinite ω < κ < ω₁   (non-Scott-continuous firing pushes κ past ω, still countable)
//   aperiodic   κ ≥ ω₁       (no countable κ — the search never finds one, witnessed not asserted)

import { zero, succ, fin, omegaTimes, OMEGA_SQ, plusFin, toFinite, type Ordinal } from "./ordinal.ts";
import { approx, type Lattice } from "./iterate.ts";

export type Regime = "finite" | "scott" | "transfinite" | "aperiodic";

export function regimeOfOrdinal(kappa: Ordinal | null): Regime {
  if (kappa === null) return "aperiodic";
  if (toFinite(kappa) < Infinity) return "finite";
  if (kappa.kind === "limit" && toFinite(kappa.seq(2)) < Infinity) return "scott";
  return "transfinite";
}

export interface ClosureResult<T> {
  kappa: Ordinal | null;
  value: T;
  regime: Regime;
}

export function closureOrdinal<T>(
  L: Lattice<T>,
  phi: (x: T) => T,
  { finite = 64, limits = 4 }: { finite?: number; limits?: number } = {},
): ClosureResult<T> {
  const memo = new Map<string, T>();
  const at = (a: Ordinal) => approx(L, phi, a, memo);
  const fixedAt = (a: Ordinal) => L.eq(at(succ(a)), at(a));

  const blocks: Ordinal[] = [zero(), ...Array.from({ length: limits }, (_, k) => omegaTimes(k + 1))];
  for (const base of blocks) {
    if (base.kind === "limit" && fixedAt(base)) {
      return { kappa: base, value: at(base), regime: regimeOfOrdinal(base) };
    }
    for (let i = 0; i < finite; i++) {
      const a: Ordinal = base.kind === "zero" ? fin(i) : plusFin(base, i);
      if (fixedAt(a)) return { kappa: a, value: at(a), regime: regimeOfOrdinal(a) };
    }
  }
  if (fixedAt(OMEGA_SQ)) return { kappa: OMEGA_SQ, value: at(OMEGA_SQ), regime: "transfinite" };
  return { kappa: null, value: at(omegaTimes(limits + 1)), regime: "aperiodic" };
}

export const leastFixedPoint = <T>(
  L: Lattice<T>,
  phi: (x: T) => T,
  opts?: { finite?: number; limits?: number },
): T => closureOrdinal(L, phi, opts).value;
