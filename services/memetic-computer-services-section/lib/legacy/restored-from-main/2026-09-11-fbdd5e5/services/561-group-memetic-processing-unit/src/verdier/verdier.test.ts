// verdier.test.ts — behavioral proof of the verdier module (substitution, spectral, verdier, gauge).
import { test } from "node:test";
import assert from "node:assert/strict";

import { substitute, iterate, orbit as substitutionOrbit, abelianize } from "./substitution.ts";
import { charPoly, isPrimitive, isPisot as isPisotMatrix, perronConvergent } from "./spectral.ts";
import { colimStructure, verdierDual, verdierHolds, stepNInvariant } from "./verdier.ts";
import {
  GAUGE, fixedSet, firingPatternSelfDual, inducedPermutation, substitutionRuleSelfDual, FOUR_VALUES,
} from "./gauge.ts";
import * as Z from "../number/integer.ts";
import type { Four } from "../chu/index.ts";

// ── fixtures (inline) ─────────────────────────────────────────────────────────

const SPECS: Record<string, { alphabet: Four[]; rule: Record<string, Four[]> }> = {
  "two-a":  { alphabet: ["t", "f"],          rule: { t: ["t","t","f"],             f: ["t","f"] } },
  "two-b":  { alphabet: ["t", "f"],          rule: { t: ["t","f"],                 f: ["t","f"] } },
  "two-sym":{ alphabet: ["top", "bot"],      rule: { top: ["top","bot"],           bot: ["top"] } },
  "three":  { alphabet: ["t","f","top"],     rule: { t: ["t","t","f"], f: ["t","f","top"], top: ["t"] } },
};

const EXAMPLES = Object.fromEntries(
  Object.entries(SPECS).map(([name, s]) => [name, {
    ...s,
    M: abelianize(s.rule, s.alphabet).map((row) => row.map(Z.toInt)),
  }]),
);
const NAMES = Object.keys(EXAMPLES);
const M = (name: string) => EXAMPLES[name]!.M;
const ALPHABET = (name: string): Four[] => EXAMPLES[name]!.alphabet;
const RULE = (name: string): Record<string, Four[]> => EXAMPLES[name]!.rule;

// ── substitute: free monoid homomorphism ─────────────────────────────────────

test("verdier/substitute: σ*(u·v) = σ*(u)·σ*(v)", () => {
  const rule: Record<string, string[]> = { a: ["a","b","a"], b: ["b","a","b"] };
  const words = [[], ["a"], ["b"], ["a","b"], ["b","a"]];
  for (const u of words) for (const v of words) {
    assert.deepEqual(substitute(rule, [...u,...v]), [...substitute(rule,u),...substitute(rule,v)]);
  }
});

test("verdier/substitute: σ*(ε) = ε", () => {
  assert.deepEqual(substitute({ a: ["a","b"] }, []), []);
});

test("verdier/iterate: σ⁰(w) = w", () => {
  assert.deepEqual(iterate({ a: ["a","b"], b: ["b"] }, ["a","b"], 0), ["a","b"]);
});

test("verdier/iterate: σ^(m+n) = σ^n ∘ σ^m for fixture seeds", () => {
  for (const name of NAMES) {
    const rule = RULE(name), alpha = ALPHABET(name);
    for (const seed of alpha.map((l) => [l])) {
      for (let m = 0; m <= 2; m++) for (let n = 0; n <= 2; n++) {
        assert.deepEqual(iterate(rule, seed, m + n), iterate(rule, iterate(rule, seed, m), n));
      }
    }
  }
});

test("verdier/orbit: prolongable seed produces a growing prefix chain", () => {
  for (const [name, seed] of [["two-a","t"],["two-sym","top"],["three","t"]] as const) {
    const rule = RULE(name);
    const gen = substitutionOrbit(rule, [seed]);
    const words: string[][] = Array.from({ length: 5 }, () => gen.next().value!);
    for (let i = 0; i + 1 < words.length; i++) {
      assert.ok(words[i+1]!.length > words[i]!.length);
      assert.deepEqual(words[i+1]!.slice(0, words[i]!.length), words[i]);
    }
  }
});

// ── abelianize ────────────────────────────────────────────────────────────────

test("verdier/abelianize: M·|w| = |σ*(w)| for fixture substitutions", () => {
  const countVec = (alpha: string[], word: string[]) => alpha.map((a) => word.filter((x) => x === a).length);
  const matVec = (mat: number[][], v: number[]) => mat.map((row) => row.reduce((s, m, j) => s + m * v[j]!, 0));
  for (const name of NAMES) {
    const rule = RULE(name), alpha = ALPHABET(name), mat = M(name);
    const words = [[], ...alpha.map((l) => [l]), ...alpha.flatMap((a) => alpha.map((b) => [a, b]))];
    for (const w of words)
      assert.deepEqual(countVec(alpha, substitute(rule, w)), matVec(mat, countVec(alpha, w)));
  }
});

// ── verdier duality ───────────────────────────────────────────────────────────

test("verdier/verdierHolds is true for every fixture matrix", () => {
  for (const name of NAMES) assert.equal(verdierHolds(M(name)), true);
});

test("verdier/unimodular matrices have structure 'Z^n'", () => {
  for (const name of ["two-a","two-sym","three"] as const) {
    const s = colimStructure(M(name));
    assert.equal(s.structure, `Z^${M(name).length}`);
  }
});

test("verdier/singular fixture (two-b) localizes: structure Z[1/2]^1", () => {
  const s = colimStructure(M("two-b"));
  assert.equal(s.rank, 1);
  assert.equal(s.structure, "Z[1/2]^1");
});

test("verdier/sheaf and cosheaf have equal rank, det, Smith factors", () => {
  for (const name of NAMES) {
    const { sheaf, cosheaf, holds } = verdierDual(M(name));
    assert.equal(holds, true);
    assert.equal(sheaf.rank, cosheaf.rank);
    assert.equal(sheaf.det, cosheaf.det);
    assert.deepEqual(sheaf.smith, cosheaf.smith);
  }
});

// ── spectral / Pisot ──────────────────────────────────────────────────────────

test("verdier/isPrimitive is true for all fixtures (all primitive by construction)", () => {
  for (const name of NAMES) assert.equal(isPrimitive(M(name)), true);
});

test("verdier/isPisotMatrix: pisot=true iff outside===1 for sub-4×4 fixtures", () => {
  for (const name of NAMES) {
    const { pisot, outside } = isPisotMatrix(M(name));
    if (pisot) assert.equal(outside, 1);
    if (outside === 1 && !pisot) assert.fail(`${name}: outside=1 but pisot=false`);
  }
});

test("verdier/charPoly has correct degree (= alphabet size)", () => {
  for (const name of NAMES) {
    const cp = charPoly(M(name));
    assert.equal(cp.length - 1, M(name).length);
  }
});

// ── gauge ─────────────────────────────────────────────────────────────────────

test("verdier/gauge: fixed sets are correct", () => {
  assert.deepEqual(fixedSet("id"), ["bot","t","f","top"]);
  assert.deepEqual(fixedSet("negation"), ["bot","top"]);
  assert.deepEqual(fixedSet("conflation"), ["t","f"]);
  assert.deepEqual(fixedSet("double"), []);
});

test("verdier/gauge: every gauge element is an involution", () => {
  for (const sigma of Object.keys(GAUGE) as (keyof typeof GAUGE)[]) {
    for (const v of FOUR_VALUES) {
      assert.equal(GAUGE[sigma][GAUGE[sigma][v]], v);
    }
  }
});

test("verdier/gauge: Klein-four composition law", () => {
  const compose = (s1: keyof typeof GAUGE, s2: keyof typeof GAUGE) =>
    Object.fromEntries(FOUR_VALUES.map((v) => [v, GAUGE[s1][GAUGE[s2][v]]]));
  const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  assert.ok(eq(compose("negation","conflation"), GAUGE.double));
  assert.ok(eq(compose("conflation","negation"), GAUGE.double));
  assert.ok(eq(compose("negation","double"), GAUGE.conflation));
});

test("verdier/gauge: firingPatternSelfDual matches its definition", () => {
  for (const name of NAMES) {
    const alpha = ALPHABET(name);
    for (const sigma of Object.keys(GAUGE) as (keyof typeof GAUGE)[]) {
      const fixed = new Set(fixedSet(sigma));
      assert.equal(firingPatternSelfDual(alpha, sigma), alpha.every((v) => fixed.has(v)));
    }
  }
});

test("verdier/gauge: substitutionRuleSelfDual under id is always trivially true", () => {
  for (const name of NAMES) {
    const r = substitutionRuleSelfDual(M(name), ALPHABET(name), "id");
    assert.ok(r !== null);
    assert.equal(r!.trivial, true);
    assert.equal(r!.selfDual, true);
  }
});

test("verdier/gauge: null when σ maps a labeling value off the alphabet", () => {
  // three has alphabet [t,f,top]; conflation(top)=bot not in alphabet
  assert.equal(substitutionRuleSelfDual(M("three"), ALPHABET("three"), "conflation"), null);
});
