// ordinal.ts — constructive ordinal notations up to ε₀.
//
// An ordinal is one of three shapes — the same three transfinite recursion folds over:
//   zero                      — 0
//   succ(α)                   — α + 1
//   limit(seq)                — sup of a fundamental sequence seq: ℕ → Ord (strictly increasing)
//
// A limit carries its fundamental sequence as a function (constructive: ω is "the sup of 0,1,2,…",
// presented as n ↦ fin(n)). Every ordinal below ε₀ is expressible this way; ω₁ is NOT — it has no
// countable fundamental sequence — which is exactly why an ω₁-closure cannot be reached, and why the
// iteration over it never halts. The notation makes that boundary precise rather than hand-waved.

export interface ZeroOrdinal { readonly kind: "zero" }
export interface SuccOrdinal { readonly kind: "succ"; readonly pred: Ordinal }
export interface LimitOrdinal { readonly kind: "limit"; readonly seq: (n: number) => Ordinal; readonly name?: string }
export type Ordinal = ZeroOrdinal | SuccOrdinal | LimitOrdinal

export const zero = (): ZeroOrdinal => ({ kind: "zero" });
export const succ = (a: Ordinal): SuccOrdinal => ({ kind: "succ", pred: a });
export const limit = (seq: (n: number) => Ordinal, name?: string): LimitOrdinal =>
  name !== undefined ? { kind: "limit", seq, name } : { kind: "limit", seq };

export const isZero = (a: Ordinal): a is ZeroOrdinal => a.kind === "zero";
export const isSucc = (a: Ordinal): a is SuccOrdinal => a.kind === "succ";
export const isLimit = (a: Ordinal): a is LimitOrdinal => a.kind === "limit";

export const fin = (n: number): Ordinal => { let a: Ordinal = zero(); for (let i = 0; i < n; i++) a = succ(a); return a; };

export const plusFin = (a: Ordinal, n: number): Ordinal => { let r = a; for (let i = 0; i < n; i++) r = succ(r); return r; };

export const OMEGA: LimitOrdinal = limit((n) => fin(n), "ω");

export const omegaTimes = (k: number): Ordinal =>
  k <= 0 ? zero() : limit((n) => plusFin(omegaTimes(k - 1), n), k === 1 ? "ω" : `ω·${k}`);

export const OMEGA_SQ: LimitOrdinal = limit((n) => omegaTimes(n), "ω²");

export const toFinite = (a: Ordinal): number => {
  let n = 0, c: Ordinal = a;
  while (c.kind === "succ") { n++; c = (c as SuccOrdinal).pred; }
  return c.kind === "zero" ? n : Infinity;
};

export function show(a: Ordinal): string {
  if (a.kind === "zero") return "0";
  if (a.kind === "limit") return a.name ?? "lim";
  let n = 0, c: Ordinal = a;
  while (c.kind === "succ") { n++; c = (c as SuccOrdinal).pred; }
  return c.kind === "zero" ? String(n) : `${show(c)}+${n}`;
}
