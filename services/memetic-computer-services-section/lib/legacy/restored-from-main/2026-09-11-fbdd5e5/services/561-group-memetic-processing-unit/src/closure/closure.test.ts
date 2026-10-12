// closure.test.ts — behavioral proof of the closure module.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  approx, orbit, closureOrdinal, leastFixedPoint, regimeOfOrdinal,
  zero, succ, fin, OMEGA, omegaTimes, show, toFinite,
  reachability, omegaPlusOne, tower, fromBilattice,
} from "./index.ts";
import { articulate, predicate, posit, settle } from "../descent.ts";

test("closure: orbit ascends and stabilizes at the closure ordinal (finite regime)", () => {
  const { lattice: L, phi } = reachability(5, [[0, 1], [1, 2], [2, 3], [3, 4]], [0]);
  const it = orbit(L, phi);
  let prev = it.next().value!;
  for (let i = 0; i < 6; i++) {
    const cur = it.next().value!;
    assert.ok(L.leq(prev.value, cur.value));
    prev = cur;
  }
  const r = closureOrdinal(L, phi);
  assert.equal(toFinite(r.kappa!), 4);
  assert.equal(r.regime, "finite");
  assert.deepEqual(r.value, [0, 1, 2, 3, 4]);
});

test("closure: F(κ) is the least fixed point — Φ(F(κ)) = F(κ), and F(i) is not fixed for i < κ", () => {
  const { lattice: L, phi } = reachability(5, [[0, 1], [1, 2], [2, 3], [3, 4]], [0]);
  const { kappa, value } = closureOrdinal(L, phi);
  assert.ok(L.eq(phi(value), value));
  const k = toFinite(kappa!);
  for (let i = 0; i < k; i++) {
    const v = approx(L, phi, fin(i));
    assert.ok(!L.eq(phi(v), v));
  }
});

test("closure: non-Scott-continuous firing pushes κ to ω+1 (transfinite regime)", () => {
  const { lattice: L, phi } = omegaPlusOne();
  assert.deepEqual(approx(L, phi, OMEGA), { tag: "nats" });
  assert.deepEqual(approx(L, phi, succ(OMEGA)), { tag: "all" });
  assert.ok(!L.eq(approx(L, phi, OMEGA), approx(L, phi, succ(OMEGA))));
  const r = closureOrdinal(L, phi);
  assert.equal(show(r.kappa!), "ω+1");
  assert.equal(r.regime, "transfinite");
  assert.deepEqual(r.value, { tag: "all" });
});

test("closure: never-stabilizing tower reports aperiodic — no countable κ found", () => {
  const { lattice: L, phi } = tower();
  const r = closureOrdinal(L, phi, { finite: 30, limits: 4 });
  assert.equal(r.kappa, null);
  assert.equal(r.regime, "aperiodic");
  assert.ok(!L.eq(approx(L, phi, omegaTimes(2)), approx(L, phi, succ(omegaTimes(2)))));
});

test("closure: regime read from the shape of κ", () => {
  assert.equal(regimeOfOrdinal(fin(7)), "finite");
  assert.equal(regimeOfOrdinal(OMEGA), "scott");
  assert.equal(regimeOfOrdinal(omegaTimes(1)), "scott");
  assert.equal(regimeOfOrdinal(succ(OMEGA)), "transfinite");
  assert.equal(regimeOfOrdinal(omegaTimes(3)), "transfinite");
  assert.equal(regimeOfOrdinal(null), "aperiodic");
});

test("closure: fromBilattice — floor's settle is the finite-κ restriction of closureOrdinal", () => {
  const posited = posit(predicate(articulate(["socrates", "mortal"])));
  const { lattice: L, phi, settledValuation } = fromBilattice(posited);
  const r = closureOrdinal(L, phi);
  assert.equal(r.regime, "finite");
  assert.ok(toFinite(r.kappa!) < Infinity);
  assert.deepEqual(r.value, settledValuation);
  assert.deepEqual(r.value, settle(posited).sheaf.section);
  assert.ok(L.eq(phi(r.value), r.value));
});

test("closure: leastFixedPoint agrees with closureOrdinal's value", () => {
  const { lattice: L, phi } = omegaPlusOne();
  const lfp = leastFixedPoint(L, phi);
  assert.ok(L.eq(phi(lfp), lfp));
  assert.deepEqual(lfp, closureOrdinal(L, phi).value);
});
