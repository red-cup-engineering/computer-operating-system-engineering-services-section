// iterate.ts — transfinite iteration of a monotone operator: the closure morphism itself.
//
// F(0) = ⊥; F(α+1) = Φ(F(α)); F(λ) = ⋁_{β<λ} F(β).
// `approx(L, Φ, α)` is this fold over the ordinal notation. The mathematics that can fail to halt lives in
// `L.sup`: for a finite or eventually-stable lattice it terminates; for a genuinely-growing chain it runs
// forever — and that non-termination IS the content (the closure ordinal is past ω).

import { show, type Ordinal } from "./ordinal.ts";

export interface Lattice<T> {
  readonly bottom: T;
  leq(a: T, b: T): boolean;
  join(a: T, b: T): T;
  eq(a: T, b: T): boolean;
  sup(seqFn: (n: number) => T): T;
}

export function approx<T>(L: Lattice<T>, phi: (x: T) => T, alpha: Ordinal, memo: Map<string, T> = new Map()): T {
  const key = show(alpha);
  if (memo.has(key)) return memo.get(key)!;
  let v: T;
  if (alpha.kind === "zero") v = L.bottom;
  else if (alpha.kind === "succ") v = phi(approx(L, phi, alpha.pred, memo));
  else v = L.sup((n) => approx(L, phi, alpha.seq(n), memo));
  memo.set(key, v);
  return v;
}

export function* orbit<T>(L: Lattice<T>, phi: (x: T) => T): Generator<{ stage: number; value: T }> {
  let v = L.bottom, stage = 0;
  yield { stage, value: v };
  for (;;) { v = phi(v); yield { stage: ++stage, value: v }; }
}

export const stabilizingSup = <T>(L: Pick<Lattice<T>, "eq">) => (seqFn: (n: number) => T): T => {
  let prev = seqFn(0);
  for (let n = 1; ; n++) { const cur = seqFn(n); if (L.eq(cur, prev)) return cur; prev = cur; }
};
