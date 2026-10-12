// chu.test.ts — behavioral proof of the Chu module.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  FOUR, isFour, asFour, toCharge, fromCharge,
  negate, conflate, knowledgeJoin, knowledgeMeet, truthJoin, truthMeet,
} from "./four.ts";

import {
  chuSpace, fromMatrix, row, col, extension, transpose, dual,
  settleColumn, settleRow, isChuSpace,
} from "./chu.ts";

import {
  checkChuTransform, chuTransform, isChuTransform,
  idTransform, composeTransforms, dualTransform,
} from "./chu-transform.ts";

// ── four.ts ───────────────────────────────────────────────────────────────────

test("FOUR: the four named constants exist and are distinct", () => {
  assert.equal(FOUR.T, "t");
  assert.equal(FOUR.F, "f");
  assert.equal(FOUR.BOT, "bot");
  assert.equal(FOUR.TOP, "top");
  assert.ok(new Set(Object.values(FOUR)).size === 4);
});

test("isFour accepts the four names and rejects anything else", () => {
  assert.ok(isFour("t") && isFour("f") && isFour("bot") && isFour("top"));
  assert.ok(!isFour("x") && !isFour("") && !isFour(null));
});

test("asFour throws on an invalid value", () => {
  assert.throws(() => asFour("invalid"), TypeError);
});

test("toCharge / fromCharge are a codec: fromCharge(toCharge(v)) = v", () => {
  for (const v of [FOUR.T, FOUR.F, FOUR.BOT, FOUR.TOP]) {
    assert.equal(fromCharge(toCharge(v)), v);
  }
});

test("negate swaps t ↔ f and fixes ⊥,⊤", () => {
  assert.equal(negate(FOUR.T),   FOUR.F);
  assert.equal(negate(FOUR.F),   FOUR.T);
  assert.equal(negate(FOUR.BOT), FOUR.BOT);
  assert.equal(negate(FOUR.TOP), FOUR.TOP);
});

test("conflate swaps ⊥ ↔ ⊤ and fixes t,f", () => {
  assert.equal(conflate(FOUR.BOT), FOUR.TOP);
  assert.equal(conflate(FOUR.TOP), FOUR.BOT);
  assert.equal(conflate(FOUR.T),   FOUR.T);
  assert.equal(conflate(FOUR.F),   FOUR.F);
});

test("knowledgeJoin: ⊥ is identity; ⊤ absorbs", () => {
  assert.equal(knowledgeJoin(FOUR.BOT, FOUR.T), FOUR.T);
  assert.equal(knowledgeJoin(FOUR.T, FOUR.F), FOUR.TOP);
  assert.equal(knowledgeJoin(FOUR.TOP, FOUR.BOT), FOUR.TOP);
});

test("knowledgeMeet: ⊤ is identity; ⊥ absorbs", () => {
  assert.equal(knowledgeMeet(FOUR.TOP, FOUR.T), FOUR.T);
  assert.equal(knowledgeMeet(FOUR.T, FOUR.F), FOUR.BOT);
});

test("truthJoin: f is the truth-bottom (identity of ∨); joins raise toward t", () => {
  // truth-join: pos=OR, neg=AND  (truth rises, falsity falls)
  assert.equal(truthJoin(FOUR.F, FOUR.T),   FOUR.T);    // f∨t = t (f is identity)
  assert.equal(truthJoin(FOUR.T, FOUR.T),   FOUR.T);    // t∨t = t
  assert.equal(truthJoin(FOUR.BOT, FOUR.T), FOUR.T);    // [F,F]∨[T,F] = [T,F] = t
  assert.equal(truthJoin(FOUR.F, FOUR.BOT), FOUR.BOT);  // [F,T]∨[F,F] = [F,F] = bot
});

test("truthMeet: t is the truth-top (identity of ∧); meets lower toward f", () => {
  // truth-meet: pos=AND, neg=OR  (truth falls, falsity rises)
  assert.equal(truthMeet(FOUR.T, FOUR.F),   FOUR.F);    // t∧f = f (t is identity)
  assert.equal(truthMeet(FOUR.TOP, FOUR.F), FOUR.F);    // [T,T]∧[F,T] = [F,T] = f
  assert.equal(truthMeet(FOUR.T, FOUR.BOT), FOUR.BOT);  // [T,F]∧[F,F] = [F,F] = bot
});

// ── chu.ts ────────────────────────────────────────────────────────────────────

test("fromMatrix / at: reads cells from the explicit matrix, absent for missing cells", () => {
  const space = fromMatrix(["a", "b"], ["x", "y"], { a: { x: FOUR.T }, b: { y: FOUR.F } });
  assert.equal(space.at("a", "x"), FOUR.T);
  assert.equal(space.at("b", "y"), FOUR.F);
  assert.equal(space.at("a", "y"), FOUR.F);  // default absent = F
  assert.equal(space.at("a", "z"), FOUR.F);  // unknown state → absent
});

test("fromMatrix with absent=BOT uses BOT for missing cells", () => {
  const space = fromMatrix(["a"], ["x"], {}, { absent: FOUR.BOT });
  assert.equal(space.at("a", "x"), FOUR.BOT);
});

test("row returns all state values for a point", () => {
  const space = fromMatrix(["a"], ["x", "y"], { a: { x: FOUR.T, y: FOUR.F } });
  const r = row(space, "a");
  assert.deepEqual(r.map((c) => c.value), [FOUR.T, FOUR.F]);
});

test("col returns all point values for a state", () => {
  const space = fromMatrix(["a", "b"], ["x"], { a: { x: FOUR.T }, b: { x: FOUR.BOT } });
  const c = col(space, "x");
  assert.deepEqual(c.map((c) => c.value), [FOUR.T, FOUR.BOT]);
});

test("extension returns points with value t", () => {
  const space = fromMatrix(["a", "b", "c"], ["p"], { a: { p: FOUR.T }, b: { p: FOUR.F }, c: { p: FOUR.T } });
  assert.deepEqual(extension(space, "p"), ["a", "c"]);
});

test("transpose swaps points and states and transposes the matrix", () => {
  const space = fromMatrix(["a"], ["x"], { a: { x: FOUR.T } });
  const t = transpose(space);
  assert.deepEqual(t.points, ["x"]);
  assert.deepEqual(t.states, ["a"]);
  assert.equal(t.at("x", "a"), FOUR.T);
});

test("dual ∘ dual = id", () => {
  const space = fromMatrix(["a", "b"], ["x", "y"], { a: { x: FOUR.T, y: FOUR.F }, b: { x: FOUR.BOT, y: FOUR.TOP } });
  const dd = dual(dual(space));
  for (const p of space.points)
    for (const s of space.states)
      assert.equal(dd.at(p, s), space.at(p, s), `dual² failed at (${p},${s})`);
});

test("dual negates every cell and swaps rows/cols", () => {
  const space = fromMatrix(["a"], ["x"], { a: { x: FOUR.T } });
  const d = dual(space);
  assert.deepEqual(d.points, ["x"]);
  assert.equal(d.at("x", "a"), negate(FOUR.T)); // f
});

test("settleColumn folds a column by knowledge-join", () => {
  const space = fromMatrix(["a", "b", "c"], ["x"], { a: { x: FOUR.T }, b: { x: FOUR.F }, c: { x: FOUR.BOT } });
  // knowledgeJoin(knowledgeJoin(T, F), BOT) = knowledgeJoin(TOP, BOT) = TOP
  assert.equal(settleColumn(space, "x"), FOUR.TOP);
});

test("settleRow folds a row by knowledge-join", () => {
  const space = fromMatrix(["a"], ["x", "y"], { a: { x: FOUR.T, y: FOUR.BOT } });
  assert.equal(settleRow(space, "a"), FOUR.T);
});

test("isChuSpace accepts built spaces and rejects plain objects", () => {
  const space = fromMatrix([], [], {});
  assert.ok(isChuSpace(space));
  assert.ok(!isChuSpace({}));
  assert.ok(!isChuSpace(null));
});

// ── chu-transform.ts ──────────────────────────────────────────────────────────

test("idTransform is a valid morphism and satisfies the adjointness law", () => {
  const space = fromMatrix(["a"], ["x"], { a: { x: FOUR.T } });
  const id = idTransform(space);
  assert.ok(isChuTransform(id));
  assert.equal(id.forward("a"), "a");
  assert.equal(id.backward("x"), "x");
});

test("checkChuTransform: valid pair returns ok=true", () => {
  const space = fromMatrix(["a"], ["x"], { a: { x: FOUR.T } });
  const result = checkChuTransform(space, space, (a) => a, (y) => y);
  assert.ok(result.ok);
  assert.equal(result.failures.length, 0);
});

test("checkChuTransform: invalid forward leg returns a domain failure", () => {
  const src = fromMatrix(["a"], ["x"], {});
  const tgt = fromMatrix(["b"], ["x"], {});
  const result = checkChuTransform(src, tgt, (_) => "z", (y) => y);
  assert.ok(!result.ok);
  assert.ok(result.failures.some((f) => f.kind === "domain"));
});

test("chuTransform throws on a non-adjoint pair", () => {
  const src = fromMatrix(["a"], ["x"], { a: { x: FOUR.T } });
  const tgt = fromMatrix(["a"], ["x"], { a: { x: FOUR.F } });
  // forward: identity, backward: identity — but src.at(a,x)=T and tgt.at(a,x)=F; adjointness fails
  assert.throws(() => chuTransform(src, tgt, (a) => a, (y) => y), Error);
});

test("composeTransforms: compose id ∘ id = id behavior", () => {
  const space = fromMatrix(["a"], ["x"], { a: { x: FOUR.T } });
  const id = idTransform(space);
  const composed = composeTransforms(id, id);
  assert.ok(isChuTransform(composed));
  assert.equal(composed.forward("a"), "a");
  assert.equal(composed.backward("x"), "x");
});

test("dualTransform swaps forward and backward", () => {
  const space = fromMatrix(["a"], ["x"], { a: { x: FOUR.T } });
  const id = idTransform(space);
  const dt = dualTransform(id);
  assert.ok(isChuTransform(dt));
});
