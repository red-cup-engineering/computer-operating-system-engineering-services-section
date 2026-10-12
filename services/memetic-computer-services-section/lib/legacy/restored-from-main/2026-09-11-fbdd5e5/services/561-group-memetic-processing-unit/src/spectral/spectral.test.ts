// spectral.test.ts — behavioral proof of the spectral module (inversion + location).
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  fromInts, toInts, degree, equal, reciprocal, isSelfReciprocal,
  resultant, sharesRoot, inversionSymmetric,
} from "./inversion.ts";
import { mobius, rightHalfPlaneRoots, rootLocation, isPisot } from "./location.ts";
import { fromInt as qFromInt } from "../number/rational.ts";

// ── inversion ─────────────────────────────────────────────────────────────────

test("spectral: reciprocal reverses coefficients and is an involution", () => {
  const p = fromInts([-1, -1, 1]);
  assert.deepEqual(toInts(reciprocal(p)), [1, -1, -1]);
  assert.ok(equal(reciprocal(reciprocal(p)), p));
});

test("spectral: Pisot has no inversion symmetry", () => {
  const fib = fromInts([-1, -1, 1]);
  assert.equal(isSelfReciprocal(fib), false);
  assert.equal(inversionSymmetric(fib), false);
  assert.equal(inversionSymmetric(fromInts([-1, -1, 0, 1])), false);
});

test("spectral: reciprocal pairs and palindromic polynomials are inversion-symmetric", () => {
  const recipPair = fromInts([1, -3, 1]);
  assert.ok(isSelfReciprocal(recipPair));
  assert.ok(inversionSymmetric(recipPair));
  assert.ok(sharesRoot(recipPair, reciprocal(recipPair)));
});

test("spectral: on-circle roots are inversion-symmetric", () => {
  assert.ok(inversionSymmetric(fromInts([-1, 0, 1])));
  const cyclo = fromInts([1, 1, 1]);
  assert.ok(isSelfReciprocal(cyclo) && inversionSymmetric(cyclo));
});

test("spectral: resultant is zero exactly when polynomials share a root", () => {
  const p = fromInts([-1, -1, 1]);
  assert.ok(!sharesRoot(p, fromInts([1, 1, 1])));
  assert.ok(sharesRoot(p, p));
  assert.ok(sharesRoot(fromInts([2, -3, 1]), fromInts([6, -5, 1])));
  assert.ok(!sharesRoot(fromInts([2, -3, 1]), fromInts([12, -7, 1])));
});

test("spectral: degree and equality normalise high zeros", () => {
  assert.equal(degree(fromInts([-1, -1, 1])), 2);
  assert.ok(equal(fromInts([1, 2, 0, 0]), fromInts([1, 2])));
});

// ── location ──────────────────────────────────────────────────────────────────

test("spectral: mobius sends z²−z−1 to z²+4z−1", () => {
  assert.deepEqual(toInts(mobius(fromInts([-1, -1, 1]))), [-1, 4, 1]);
});

test("spectral: Fibonacci is Pisot — one expanding, one contracting, none neutral", () => {
  const fib = fromInts([-1, -1, 1]);
  assert.deepEqual(rootLocation(fib), { expanding: 1, contracting: 1, neutral: 0, degenerate: false });
  assert.equal(isPisot(fib), true);
});

test("spectral: plastic number (λ³−λ−1) is Pisot — one expanding, two contracting", () => {
  const plastic = fromInts([-1, -1, 0, 1]);
  assert.deepEqual(rootLocation(plastic), { expanding: 1, contracting: 2, neutral: 0, degenerate: false });
  assert.equal(isPisot(plastic), true);
});

test("spectral: all-outside control (λ²−4) counts both expanding", () => {
  const out = fromInts([-4, 0, 1]);
  assert.deepEqual(rootLocation(out), { expanding: 2, contracting: 0, neutral: 0, degenerate: false });
  assert.equal(isPisot(out), false);
});

test("spectral: on-circle controls are degenerate and not Pisot", () => {
  for (const p of [fromInts([-1, 0, 1]), fromInts([1, 1, 1])]) {
    assert.equal(rootLocation(p).degenerate, true);
    assert.equal(isPisot(p), false);
  }
});

test("spectral: Routh column sign changes count RHP roots", () => {
  const q = [-1, 4, 1].map(qFromInt);
  assert.deepEqual(rightHalfPlaneRoots(q), { rhp: 1, singular: false });
});
