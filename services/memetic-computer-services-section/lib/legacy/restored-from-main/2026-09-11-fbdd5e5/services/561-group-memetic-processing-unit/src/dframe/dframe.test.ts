// dframe.test.ts — behavioral proof of the dframe and dgen modules.
import { test } from "node:test";
import assert from "node:assert/strict";

import { classifyFiring, SIDE_CONTRIBUTION, dframeCohomology } from "./cohomology.ts";
import { classifyOrbitType, verifyComposedSelfDuality } from "./orbits.ts";
import { dframeGenerator, h1Dframe, shadow as dgenShadow, negateGenerator, linearlyIndependent, fromSettling as dgenFromSettling } from "../dgen/generator.ts";
import { settling } from "../obstruction/settling.ts";
import { abelianize } from "../verdier/substitution.ts";
import * as Z from "../number/integer.ts";
import type { Four } from "../chu/index.ts";

// ── fixture matrices ──────────────────────────────────────────────────────────

const M = (rule: Record<string, Four[]>, alpha: Four[]) =>
  abelianize(rule, alpha).map((row) => row.map(Z.toInt));

const twoA = { alpha: ["t","f"] as Four[], rule: { t: ["t","t","f"], f: ["t","f"] } as Record<string, Four[]> };
const twoB = { alpha: ["t","f"] as Four[], rule: { t: ["t","f"], f: ["t","f"] } as Record<string, Four[]> };
const twoSym = { alpha: ["top","bot"] as Four[], rule: { top: ["top","bot"], bot: ["top"] } as Record<string, Four[]> };
const three = { alpha: ["t","f","top"] as Four[], rule: { t: ["t","t","f"], f: ["t","f","top"], top: ["t"] } as Record<string, Four[]> };
const FIXTURES = [twoA, twoB, twoSym, three];

// ── classifyFiring ────────────────────────────────────────────────────────────

test("dframe: classifyFiring returns the correct type for each FOUR value", () => {
  assert.equal(classifyFiring("t"), "truth-only");
  assert.equal(classifyFiring("f"), "falsity-only");
  assert.equal(classifyFiring("top"), "top-firing");
  assert.equal(classifyFiring("bot"), "bot-firing");
});

test("dframe: SIDE_CONTRIBUTION encodes L₊/L₋ bits correctly", () => {
  assert.deepEqual(SIDE_CONTRIBUTION["t"], [true, false]);
  assert.deepEqual(SIDE_CONTRIBUTION["f"], [false, true]);
  assert.deepEqual(SIDE_CONTRIBUTION["top"], [true, true]);
  assert.deepEqual(SIDE_CONTRIBUTION["bot"], [false, false]);
});

// ── dframeCohomology ──────────────────────────────────────────────────────────

test("dframe: L₊ = truth-only + top-firing; L₋ = falsity-only + top-firing", () => {
  for (const { alpha, rule } of FIXTURES) {
    const mat = M(rule, alpha);
    const c = dframeCohomology(mat, alpha);
    const fc = c.firingCounts;
    assert.equal(c.shadow.lPlus, fc["truth-only"] + fc["top-firing"]);
    assert.equal(c.shadow.lMinus, fc["falsity-only"] + fc["top-firing"]);
  }
});

test("dframe: firingCounts sums to alphabet size", () => {
  for (const { alpha, rule } of FIXTURES) {
    const mat = M(rule, alpha);
    const fc = dframeCohomology(mat, alpha).firingCounts;
    const total = Object.values(fc).reduce((a, b) => a + b, 0);
    assert.equal(total, alpha.length);
  }
});

test("dframe: singular fixture (two-b) is marked singular, abRank collapses", () => {
  const c = dframeCohomology(M(twoB.rule, twoB.alpha), twoB.alpha);
  assert.equal(c.singular, true);
  assert.ok(c.abRank < twoB.alpha.length);
});

test("dframe: dframeCohomology throws on size mismatch", () => {
  assert.throws(() => dframeCohomology(M(twoA.rule, twoA.alpha), ["t"]));
});

test("dframe: all-top alphabet — L₊ = L₋ = n", () => {
  const alpha = ["top","top"] as Four[];
  const c = dframeCohomology([[1,0],[0,1]], alpha);
  assert.equal(c.shadow.lPlus, 2);
  assert.equal(c.shadow.lMinus, 2);
});

// ── orbits ────────────────────────────────────────────────────────────────────

test("dframe: {top,bot} is self-dual; {t,f} is exchange-mixed; {t,top} is mixed", () => {
  assert.equal(classifyOrbitType(["top","bot"]).orbitType, "self-dual");
  assert.equal(classifyOrbitType(["t","f"]).orbitType, "exchange-mixed");
  assert.equal(classifyOrbitType(["t","top"]).orbitType, "mixed");
});

test("dframe: verifyComposedSelfDuality: all three booleans agree", () => {
  for (const vals of [["top","bot"],["t","f"],["t","top"]] as Four[][]) {
    const r = verifyComposedSelfDuality(vals);
    assert.ok(r.agree, `${JSON.stringify(vals)}: agree must be true`);
  }
});

// ── dgen ─────────────────────────────────────────────────────────────────────

test("dgen: dframeGenerator structure matches the theorem", () => {
  const pick = (D: ReturnType<typeof dframeGenerator>) => ({ lPlus: D.lPlus, lMinus: D.lMinus, consistency: D.consistency });
  assert.deepEqual(pick(dframeGenerator("t")),   { lPlus: 1, lMinus: 0, consistency: "trivial" });
  assert.deepEqual(pick(dframeGenerator("f")),   { lPlus: 0, lMinus: 1, consistency: "trivial" });
  assert.deepEqual(pick(dframeGenerator("top")), { lPlus: 1, lMinus: 1, consistency: "con-fails-on-singleton-pair" });
  assert.deepEqual(pick(dframeGenerator("bot")), { lPlus: 0, lMinus: 0, consistency: "trivial" });
  assert.throws(() => dframeGenerator("nope" as Four));
});

test("dgen: H¹_dFrm is the direct sum ⊕ D_μ — two-firing example", () => {
  const vf = [{ stage: 1, value: "t" as Four }, { stage: 2, value: "t" as Four }];
  const h = h1Dframe(vf);
  assert.equal(h.rank, 2);
  assert.equal(h.structure, "D_1 ⊕ D_2");
  assert.deepEqual(dgenShadow(vf), { lPlus: 2, lMinus: 0, truthSide: "Z^2", falsitySide: "Z^0" });
});

test("dgen: shadow accumulates t+⊤ for L₊, f+⊤ for L₋", () => {
  const vf = [{ stage: 1, value: "t" as Four }, { stage: 2, value: "f" as Four }, { stage: 3, value: "top" as Four }];
  const s = dgenShadow(vf);
  assert.equal(s.lPlus, 2);
  assert.equal(s.lMinus, 2);
});

test("dgen: negateGenerator swaps truth-only ↔ falsity-only, fixes ⊤/⊥", () => {
  assert.equal(negateGenerator(dframeGenerator("t")).firingType, "falsity-only");
  assert.equal(negateGenerator(dframeGenerator("f")).firingType, "truth-only");
  assert.equal(negateGenerator(dframeGenerator("top")).firingType, "top-firing");
  assert.equal(negateGenerator(dframeGenerator("bot")).firingType, "bot-firing");
});

test("dgen: linearlyIndependent iff distinct stages", () => {
  assert.equal(linearlyIndependent([{ stage: 1, value: "t" as Four }, { stage: 2, value: "f" as Four }]), true);
  assert.equal(linearlyIndependent([{ stage: 1, value: "t" as Four }, { stage: 1, value: "f" as Four }]), false);
});

test("dgen: fromSettling builds valued firings from obstruction settling", () => {
  const c = (s: string) => ({ subject: s, predicate: "r", object: s });
  const s = settling([
    { designated: [c("a")] },
    { designated: [c("a"), c("L1")], limit: true },
    { designated: [c("a"), c("L1"), c("L2")], limit: true },
  ]);
  const vf = dgenFromSettling(s, ["t","top"]);
  assert.deepEqual(vf, [{ stage: 1, value: "t" }, { stage: 2, value: "top" }]);
  assert.deepEqual(dgenShadow(vf), { lPlus: 2, lMinus: 1, truthSide: "Z^2", falsitySide: "Z^1" });
  assert.throws(() => dgenFromSettling(s, ["t"]));
});
