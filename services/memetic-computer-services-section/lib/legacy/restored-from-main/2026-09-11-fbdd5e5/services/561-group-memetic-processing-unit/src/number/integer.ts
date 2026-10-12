// integer.ts — ℤ as the charge's two-sided evidence, read as a difference.
//
// An integer is a pair (pos, neg) of naturals standing for pos − neg. negate = swap (the truth
// involution). Addition = transverse accumulation (each side grows independently). Zero is REACHED:
// balanced evidence where the two sides cancel. Canonicalised so one side is always zero.
import * as N from "./natural.ts";
import type { Natural } from "./natural.ts";

export interface Integer { readonly pos: Natural; readonly neg: Natural; }

function balance(pos: Natural, neg: Natural): Integer {
  return N.leq(neg, pos)
    ? { pos: N.monus(pos, neg), neg: N.zero }
    : { pos: N.zero, neg: N.monus(neg, pos) };
}

/** The integer for two-sided evidence (pos, neg) — its value is pos − neg. */
export const integer = (pos: Natural, neg: Natural): Integer => balance(pos, neg);

/** The integer of a natural n — purely positive evidence (n, 0). */
export const fromNatural = (n: Natural): Integer => ({ pos: n, neg: N.zero });

/** 0 — the canonical balance (0, 0). */
export const zero: Integer = fromNatural(N.zero);

/** 1 = (1, 0). */
export const one: Integer = fromNatural(N.one);

/** The additive inverse −z: swap the two evidence sides. */
export const negate = (z: Integer): Integer => ({ pos: z.neg, neg: z.pos });

/** Addition: accumulate each side separately — (p,m) + (q,n) = (p+q, m+n). */
export const add = (a: Integer, b: Integer): Integer =>
  balance(N.add(a.pos, b.pos), N.add(a.neg, b.neg));

/** Subtraction a − b = a + (−b). */
export const subtract = (a: Integer, b: Integer): Integer => add(a, negate(b));

/** Multiplication: (p−m)(q−n) = (pq+mn) − (pn+mq). */
export const multiply = (a: Integer, b: Integer): Integer =>
  balance(
    N.add(N.multiply(a.pos, b.pos), N.multiply(a.neg, b.neg)),
    N.add(N.multiply(a.pos, b.neg), N.multiply(a.neg, b.pos)),
  );

/** Equality — canonical, so structural equality of the two sides. */
export const equal = (a: Integer, b: Integer): boolean =>
  N.equal(a.pos, b.pos) && N.equal(a.neg, b.neg);

/** The evidence-balance relation: (p,m) ∼ (q,n) iff p + n = q + m. */
export const equivalent = (a: Integer, b: Integer): boolean =>
  N.equal(N.add(a.pos, b.neg), N.add(b.pos, a.neg));

/** Is z zero? */
export const isZero = (z: Integer): boolean => N.isZero(z.pos) && N.isZero(z.neg);

/** Is z positive? (Canonical: positive evidence remains after cancellation.) */
export const isPositive = (z: Integer): boolean => !N.isZero(z.pos);

/** Is z negative? */
export const isNegative = (z: Integer): boolean => !N.isZero(z.neg);

/** The sign of z: −1, 0, or +1. */
export const sign = (z: Integer): -1 | 0 | 1 =>
  isPositive(z) ? 1 : isNegative(z) ? -1 : 0;

/** The magnitude |z| as a natural — the nonzero evidence side (or zero). */
export const magnitude = (z: Integer): Natural =>
  isZero(z) ? z.pos : isPositive(z) ? z.pos : z.neg;

/** Division truncated toward zero: a = quotient·b + remainder. Throws on b = 0. */
export function divmod(a: Integer, b: Integer): { quotient: Integer; remainder: Integer } {
  if (isZero(b)) throw new RangeError("integer divmod: division by zero");
  const qMag = N.divmod(magnitude(a), magnitude(b)).quotient;
  const q = sign(a) * sign(b) < 0 ? negate(fromNatural(qMag)) : fromNatural(qMag);
  return { quotient: q, remainder: subtract(a, multiply(q, b)) };
}

/** The truncated quotient ⌊a/b⌋ toward zero. */
export const quotient = (a: Integer, b: Integer): Integer => divmod(a, b).quotient;

/** Does b divide a exactly? */
export const divides = (b: Integer, a: Integer): boolean => isZero(divmod(a, b).remainder);

/** Total comparison: −1 if a < b, 0 if equal, +1 if a > b. */
export const compare = (a: Integer, b: Integer): -1 | 0 | 1 => sign(subtract(a, b));

// ── boundary reads ────────────────────────────────────────────────────────────

/** The host integer of z: |pos| − |neg|. */
export const toInt = (z: Integer): number => N.toCount(z.pos) - N.toCount(z.neg);

/** Build the integer for a host integer k. */
export const fromInt = (k: number): Integer =>
  k >= 0 ? fromNatural(N.fromCount(k)) : negate(fromNatural(N.fromCount(-k)));
