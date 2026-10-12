// number.test.ts — behavioral proof of the number tower (ℕ, ℤ, ℚ, matrix).
import { test } from "node:test";
import assert from "node:assert/strict";

import * as N from "./natural.ts";
import * as Z from "./integer.ts";
import * as Q from "./rational.ts";
import { fromInts, determinant, matmul, matEqual, rank, charPoly, smithNormalForm } from "./matrix.ts";

// ── ℕ — natural numbers ───────────────────────────────────────────────────────

test("ℕ: zero is reached — its extension is empty", () => {
  assert.ok(N.isZero(N.zero));
  assert.equal(N.toCount(N.zero), 0);
});

test("ℕ: successor grows the extension by one", () => {
  const two = N.successor(N.one);
  assert.equal(N.toCount(N.one), 1);
  assert.equal(N.toCount(two), 2);
});

test("ℕ: fromCount / toCount round-trip", () => {
  for (const k of [0, 1, 3, 5]) {
    assert.equal(N.toCount(N.fromCount(k)), k);
  }
});

test("ℕ: internment — fromCount(k) is the same object on repeated calls", () => {
  assert.ok(N.fromCount(3) === N.fromCount(3));
});

test("ℕ: equal — same canonical object", () => {
  assert.ok(N.equal(N.zero, N.zero));
  assert.ok(!N.equal(N.zero, N.one));
  assert.ok(N.equal(N.fromCount(4), N.fromCount(4)));
});

test("ℕ: add — 2 + 3 = 5", () => {
  const two = N.fromCount(2), three = N.fromCount(3), five = N.fromCount(5);
  assert.ok(N.equal(N.add(two, three), five));
});

test("ℕ: multiply — 2 · 3 = 6", () => {
  assert.ok(N.equal(N.multiply(N.fromCount(2), N.fromCount(3)), N.fromCount(6)));
});

test("ℕ: monus — 5 ∸ 3 = 2; 2 ∸ 5 = 0", () => {
  assert.ok(N.equal(N.monus(N.fromCount(5), N.fromCount(3)), N.fromCount(2)));
  assert.ok(N.equal(N.monus(N.fromCount(2), N.fromCount(5)), N.zero));
});

test("ℕ: divmod — 7 ÷ 3 = 2 rem 1", () => {
  const { quotient, remainder } = N.divmod(N.fromCount(7), N.fromCount(3));
  assert.equal(N.toCount(quotient), 2);
  assert.equal(N.toCount(remainder), 1);
});

test("ℕ: divmod throws on zero divisor", () => {
  assert.throws(() => N.divmod(N.one, N.zero), RangeError);
});

test("ℕ: gcd — gcd(12, 8) = 4", () => {
  assert.ok(N.equal(N.gcd(N.fromCount(12), N.fromCount(8)), N.fromCount(4)));
});

test("ℕ: leq — 2 ≤ 3; 3 ≰ 2", () => {
  assert.ok(N.leq(N.fromCount(2), N.fromCount(3)));
  assert.ok(!N.leq(N.fromCount(3), N.fromCount(2)));
});

test("ℕ: isMember — 2 ∈ 3 (von Neumann: 3 = {0,1,2})", () => {
  assert.ok(N.isMember(N.fromCount(2), N.fromCount(3)));
  assert.ok(!N.isMember(N.fromCount(3), N.fromCount(3)));
});

test("ℕ: compare — total order", () => {
  assert.equal(N.compare(N.fromCount(2), N.fromCount(3)), -1);
  assert.equal(N.compare(N.fromCount(3), N.fromCount(3)), 0);
  assert.equal(N.compare(N.fromCount(4), N.fromCount(3)), 1);
});

test("ℕ: asExtension realization — membership via Chu space and floor's extension()", () => {
  const three = N.fromCount(3);
  const ext = N.extensionOf(three);
  assert.equal(ext.length, 3); // {#0, #1, #2} settle to t
});

// ── ℤ — integers ──────────────────────────────────────────────────────────────

test("ℤ: zero is balanced — isZero and toInt=0", () => {
  assert.ok(Z.isZero(Z.zero));
  assert.equal(Z.toInt(Z.zero), 0);
});

test("ℤ: fromInt / toInt round-trip for positive and negative", () => {
  for (const k of [-5, -1, 0, 1, 7]) {
    assert.equal(Z.toInt(Z.fromInt(k)), k);
  }
});

test("ℤ: negate swaps the evidence sides — −(−z) = z", () => {
  const z = Z.fromInt(3);
  assert.ok(Z.equal(Z.negate(Z.negate(z)), z));
  assert.equal(Z.toInt(Z.negate(z)), -3);
});

test("ℤ: add — 3 + (−5) = −2", () => {
  assert.equal(Z.toInt(Z.add(Z.fromInt(3), Z.fromInt(-5))), -2);
});

test("ℤ: subtract — 2 − 7 = −5", () => {
  assert.equal(Z.toInt(Z.subtract(Z.fromInt(2), Z.fromInt(7))), -5);
});

test("ℤ: multiply — (−3) · 4 = −12", () => {
  assert.equal(Z.toInt(Z.multiply(Z.fromInt(-3), Z.fromInt(4))), -12);
});

test("ℤ: divmod — 7 ÷ 3 = 2 rem 1; −7 ÷ 3 = −2 rem −1", () => {
  const { quotient: q1, remainder: r1 } = Z.divmod(Z.fromInt(7), Z.fromInt(3));
  assert.equal(Z.toInt(q1), 2);
  assert.equal(Z.toInt(r1), 1);
  const { quotient: q2, remainder: r2 } = Z.divmod(Z.fromInt(-7), Z.fromInt(3));
  assert.equal(Z.toInt(q2), -2);
  assert.equal(Z.toInt(r2), -1);
});

test("ℤ: divmod throws on zero divisor", () => {
  assert.throws(() => Z.divmod(Z.one, Z.zero), RangeError);
});

test("ℤ: sign and magnitude", () => {
  assert.equal(Z.sign(Z.fromInt(5)), 1);
  assert.equal(Z.sign(Z.fromInt(-3)), -1);
  assert.equal(Z.sign(Z.zero), 0);
  assert.equal(N.toCount(Z.magnitude(Z.fromInt(-4))), 4);
});

test("ℤ: compare — total order", () => {
  assert.equal(Z.compare(Z.fromInt(-1), Z.fromInt(1)), -1);
  assert.equal(Z.compare(Z.fromInt(3), Z.fromInt(3)), 0);
  assert.equal(Z.compare(Z.fromInt(2), Z.fromInt(-2)), 1);
});

test("ℤ: equivalent — (2,0) ∼ (3,1) since 2+1 = 3+0", () => {
  assert.ok(Z.equivalent(Z.fromInt(2), Z.integer(N.fromCount(3), N.fromCount(1))));
});

// ── ℚ — rationals ─────────────────────────────────────────────────────────────

test("ℚ: fromRatio / toNumber round-trip", () => {
  for (const [n, d] of [[1, 2], [3, 4], [-2, 3], [7, 1]]) {
    assert.ok(Math.abs(Q.toNumber(Q.fromRatio(n!, d!)) - n! / d!) < 1e-12);
  }
});

test("ℚ: canonical form — 6/4 reduces to 3/2", () => {
  const q = Q.fromRatio(6, 4);
  assert.equal(Q.toNumber(q), 1.5);
  assert.equal(Z.toInt(q.den), 2);
});

test("ℚ: add — 1/2 + 1/3 = 5/6", () => {
  const r = Q.add(Q.fromRatio(1, 2), Q.fromRatio(1, 3));
  assert.ok(Math.abs(Q.toNumber(r) - 5 / 6) < 1e-12);
});

test("ℚ: subtract — 3/4 − 1/4 = 1/2", () => {
  const r = Q.subtract(Q.fromRatio(3, 4), Q.fromRatio(1, 4));
  assert.equal(Q.toNumber(r), 0.5);
});

test("ℚ: multiply — (2/3)(3/4) = 1/2", () => {
  const r = Q.multiply(Q.fromRatio(2, 3), Q.fromRatio(3, 4));
  assert.equal(Q.toNumber(r), 0.5);
});

test("ℚ: divide — (3/4) / (3/2) = 1/2", () => {
  const r = Q.divide(Q.fromRatio(3, 4), Q.fromRatio(3, 2));
  assert.equal(Q.toNumber(r), 0.5);
});

test("ℚ: reciprocal(q) · q = 1", () => {
  const q = Q.fromRatio(3, 7);
  assert.ok(Q.equal(Q.multiply(Q.reciprocal(q), q), Q.one));
});

test("ℚ: negate — −(3/4) has opposite sign", () => {
  const q = Q.fromRatio(3, 4);
  assert.equal(Q.sign(Q.negate(q)), -1);
});

test("ℚ: reciprocal throws on zero", () => {
  assert.throws(() => Q.reciprocal(Q.zero), RangeError);
});

test("ℚ: compare — total order", () => {
  assert.equal(Q.compare(Q.fromRatio(1, 3), Q.fromRatio(1, 2)), -1);
  assert.equal(Q.compare(Q.fromRatio(1, 2), Q.fromRatio(1, 2)), 0);
  assert.equal(Q.compare(Q.fromRatio(3, 4), Q.fromRatio(1, 4)), 1);
});

// ── matrix ────────────────────────────────────────────────────────────────────

test("matrix: determinant of 2×2 identity = 1", () => {
  const I = fromInts([[1, 0], [0, 1]]);
  assert.equal(Z.toInt(determinant(I)), 1);
});

test("matrix: determinant of [[1,2],[3,4]] = −2", () => {
  const M = fromInts([[1, 2], [3, 4]]);
  assert.equal(Z.toInt(determinant(M)), -2);
});

test("matrix: matmul — I · M = M", () => {
  const I = fromInts([[1, 0], [0, 1]]);
  const M = fromInts([[3, 5], [7, 11]]);
  assert.ok(matEqual(matmul(I, M), M));
});

test("matrix: rank of full-rank 2×2 is 2", () => {
  assert.equal(rank(fromInts([[1, 0], [0, 1]])), 2);
});

test("matrix: rank of rank-deficient matrix is 1", () => {
  assert.equal(rank(fromInts([[1, 2], [2, 4]])), 1);
});

test("matrix: smithNormalForm of diag(2,3) is [1, 6] — d₁=gcd of 1×1 minors=1, d₁d₂=det=6", () => {
  const M = fromInts([[2, 0], [0, 3]]);
  const factors = smithNormalForm(M).map(Z.toInt);
  assert.deepEqual(factors, [1, 6]);
});

test("matrix: charPoly of identity 2×2 is (λ−1)² = λ²−2λ+1 — coefficients [1,−2,1]", () => {
  const I = fromInts([[1, 0], [0, 1]]);
  const cp = charPoly(I).map(Z.toInt);
  assert.deepEqual(cp, [1, -2, 1]);
});
