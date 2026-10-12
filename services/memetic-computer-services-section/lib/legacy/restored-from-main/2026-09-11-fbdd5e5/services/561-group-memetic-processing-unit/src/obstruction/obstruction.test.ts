// obstruction.test.ts — behavioral proof of the obstruction module (settling + cochain + floor).
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  settling, increments, firings, nscFirings, h1, clInv, mldEquivalent, classify, depth,
} from "./settling.ts";
import { cohomologyOfRelation, cohomologyOf } from "./cochain.ts";
import { settlingOf, designatedCells, voidCone, gradedVoid, apexVoidMatch } from "./floor.ts";
import { articulate, predicate, posit } from "../descent.ts";
import { vanish } from "../void.ts";

const S = (x: unknown) => JSON.stringify(x);
const c = (s: unknown, p: unknown, o: unknown) => ({ subject: s, predicate: p, object: o });

const finiteS = settling([
  { designated: [c("a", "r", "b")] },
  { designated: [c("a", "r", "b"), c("b", "r", "d")] },
]);
const scottS = settling([
  { designated: [c("a", "r", "b")] },
  { designated: [c("a", "r", "b")], limit: true },
]);
const transS = settling([
  { designated: [c("a", "r", "b")] },
  { designated: [c("a", "r", "b"), c("L", "r", "L")], limit: true },
]);
const twoS = settling([
  { designated: [c("a", "r", "b")] },
  { designated: [c("a", "r", "b"), c("L1", "r", "L1")], limit: true },
  { designated: [c("a", "r", "b"), c("L1", "r", "L1"), c("L2", "r", "L2")], limit: true },
]);

// ── settling ──────────────────────────────────────────────────────────────────

test("obstruction: settling throws on knowledge drop or limit at stage 0", () => {
  assert.throws(() => settling([{ designated: [c("a", "r", "b")] }, { designated: [] }]));
  assert.throws(() => settling([{ designated: [c("a", "r", "b")], limit: true }]));
});

test("obstruction: increments are Δ⁺_τ (newly designated cells at each stage)", () => {
  const inc = increments(transS);
  assert.equal(S(inc[0]!.added), S([c("a", "r", "b")]));
  assert.equal(S(inc[1]!.added), S([c("L", "r", "L")]));
});

test("obstruction: H¹ = 0 in the finite regime", () => {
  assert.equal(h1(finiteS).vanishes, true);
  assert.equal(classify(finiteS).regime, "finite");
});

test("obstruction: H¹ = 0 in the scott regime (limit stage, no firing at it)", () => {
  assert.equal(nscFirings(scottS).length, 0);
  assert.equal(h1(scottS).rank, 0);
  assert.equal(classify(scottS).regime, "scott");
});

test("obstruction: H¹ has one generator per NSC (limit) firing", () => {
  assert.equal(h1(transS).rank, 1);
  assert.equal(S(h1(transS).generators[0]!.cell), S(c("L", "r", "L")));
  assert.equal(classify(transS).regime, "transfinite");
  assert.equal(h1(twoS).rank, 2);
});

test("obstruction: aperiodic regime from cofinal declaration", () => {
  const aper = settling([
    { designated: [c("a", "r", "b")] },
    { designated: [c("a", "r", "b"), c("L", "r", "L")], limit: true },
  ], { cofinal: "uncountable" });
  assert.equal(classify(aper).regime, "aperiodic");
});

test("obstruction: clInv is MLD-invariant under settling-shift", () => {
  const shifted = settling([
    { designated: [c("a", "r", "b")] },
    { designated: [c("a", "r", "b")] },
    { designated: [c("a", "r", "b"), c("L", "r", "L")], limit: true },
  ]);
  assert.equal(mldEquivalent(transS, shifted), true);
  assert.equal(mldEquivalent(transS, twoS), false);
});

test("obstruction: depth is the last firing stage", () => {
  assert.equal(depth(twoS), 2);
  assert.equal(depth(transS), 1);
});

// ── cochain ───────────────────────────────────────────────────────────────────

test("obstruction: cohomologyOfRelation — path a→b: H0 rank 1, H1 rank 0 (tree)", () => {
  const cells = [c("a", "r", "b")];
  const r = cohomologyOfRelation(cells);
  assert.equal(r.H0.rank, 1);
  assert.equal(r.H1.rank, 0);
  assert.equal(r.H1.vanishes, true);
});

test("obstruction: cohomologyOfRelation — triangle a→b→c→a: H1 rank 1 (one cycle)", () => {
  const cells = [c("a", "r", "b"), c("b", "r", "c"), c("c", "r", "a")];
  const r = cohomologyOfRelation(cells);
  assert.equal(r.H0.rank, 1);
  assert.equal(r.H1.rank, 1);
});

test("obstruction: cohomologyOf a bilattice utterance — self-referential cell creates a self-loop (H1 = 1)", () => {
  // The MPU settles [subject, predicate] to a self-referential cell {subject, predicate, object: subject}.
  // The cochain H¹ is the graph's first Betti number: a self-loop has E=V=components=1 → H¹ = 1.
  // (This is distinct from the temporal settling H¹, which is 0 for finite floor settlings.)
  const r = cohomologyOf(["socrates", "mortal"]);
  assert.equal(r.H0.rank, 1);
  assert.equal(r.H1.rank, 1); // one self-loop = one cycle
});

// ── floor bridge ──────────────────────────────────────────────────────────────

test("obstruction: floor settling is finite — H¹ = 0", () => {
  const po = posit(predicate(articulate(["socrates", "mortal"])));
  const fs = settlingOf(po);
  assert.equal(h1(fs).vanishes, true);
  assert.equal(classify(fs).regime, "finite");
});

test("obstruction: settlingOf designates the t-valued cells", () => {
  const po = posit(predicate(articulate(["socrates", "mortal"])));
  const fs = settlingOf(po);
  assert.equal(S(fs.stages[0]!.designated), S([c("socrates", "mortal", "socrates")]));
});

test("obstruction: voidCone delegates to floor vanish", () => {
  const po = posit(predicate(articulate(["socrates", "mortal"])));
  assert.equal(S(voidCone(po)), S(vanish(po)));
});

test("obstruction: apexVoidMatch holds for both a floor settling and a transfinite one", () => {
  const po = posit(predicate(articulate(["socrates", "mortal"])));
  assert.equal(apexVoidMatch(settlingOf(po)), true);
  assert.equal(gradedVoid(transS).rank, h1(transS).rank);
  assert.equal(apexVoidMatch(transS), true);
});
