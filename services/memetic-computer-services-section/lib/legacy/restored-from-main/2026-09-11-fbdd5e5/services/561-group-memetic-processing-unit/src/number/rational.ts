// rational.ts — ℚ as ratios, more than one true reading at once.
//
// A rational is a ratio of integers num/den (den ≠ 0), canonicalised by gcd-reduction with den > 0.
// reciprocal (swap num ↔ den) is the multiplicative inverse; divide is the residual a ⊸ b = a/b.
// Built on ℤ (hence ℕ): exact over our integers, no host arithmetic.
import * as Z from "./integer.ts";
import * as N from "./natural.ts";
import type { Integer } from "./integer.ts";

export interface Rational { readonly num: Integer; readonly den: Integer; }

function canonical(num: Integer, den: Integer): Rational {
  if (Z.isZero(den)) throw new RangeError("rational: zero denominator");
  const s = Z.sign(num) * Z.sign(den);
  const mNum = Z.magnitude(num), mDen = Z.magnitude(den);
  if (N.isZero(mNum)) return { num: Z.zero, den: Z.one };
  const g = N.gcd(mNum, mDen);
  const n = Z.fromNatural(N.divmod(mNum, g).quotient);
  return { num: s < 0 ? Z.negate(n) : n, den: Z.fromNatural(N.divmod(mDen, g).quotient) };
}

/** The rational num/den (both integers, den ≠ 0). */
export const rational = (num: Integer, den: Integer): Rational => canonical(num, den);

/** The rational of an integer z — z/1. */
export const fromInteger = (z: Integer): Rational => ({ num: z, den: Z.one });

/** 0 = 0/1. */
export const zero: Rational = fromInteger(Z.zero);

/** 1 = 1/1. */
export const one: Rational = fromInteger(Z.one);

/** The additive inverse −q (in the numerator). */
export const negate = (q: Rational): Rational => ({ num: Z.negate(q.num), den: q.den });

/** The multiplicative inverse 1/q — swap num ↔ den.  Errors on 0. */
export const reciprocal = (q: Rational): Rational => canonical(q.den, q.num);

/** a/b + c/d = (ad + cb)/(bd). */
export const add = (a: Rational, b: Rational): Rational =>
  canonical(Z.add(Z.multiply(a.num, b.den), Z.multiply(b.num, a.den)), Z.multiply(a.den, b.den));

/** Subtraction a − b = a + (−b). */
export const subtract = (a: Rational, b: Rational): Rational => add(a, negate(b));

/** (a/b)(c/d) = ac/bd. */
export const multiply = (a: Rational, b: Rational): Rational =>
  canonical(Z.multiply(a.num, b.num), Z.multiply(a.den, b.den));

/** Division — the residual a ⊸ b = a/b = a·(1/b).  Errors on b = 0. */
export const divide = (a: Rational, b: Rational): Rational => multiply(a, reciprocal(b));

/** Equality by cross-multiplication: a/b = c/d iff a·d = b·c. */
export const equal = (a: Rational, b: Rational): boolean =>
  Z.equal(Z.multiply(a.num, b.den), Z.multiply(b.num, a.den));

/** Is q zero? */
export const isZero = (q: Rational): boolean => Z.isZero(q.num);

/** The sign of q: −1, 0, or +1 (denominator is canonically positive). */
export const sign = (q: Rational): -1 | 0 | 1 => Z.sign(q.num);

/** Total comparison: −1 if a < b, 0 if equal, +1 if a > b. */
export const compare = (a: Rational, b: Rational): -1 | 0 | 1 => sign(subtract(a, b));

// ── boundary reads ────────────────────────────────────────────────────────────

/** The rational for a host integer k. */
export const fromInt = (k: number): Rational => fromInteger(Z.fromInt(k));

/** The rational for a host ratio n/d. */
export const fromRatio = (n: number, d: number): Rational => canonical(Z.fromInt(n), Z.fromInt(d));

/** The host floating value of q (num/den). */
export const toNumber = (q: Rational): number => Z.toInt(q.num) / Z.toInt(q.den);
