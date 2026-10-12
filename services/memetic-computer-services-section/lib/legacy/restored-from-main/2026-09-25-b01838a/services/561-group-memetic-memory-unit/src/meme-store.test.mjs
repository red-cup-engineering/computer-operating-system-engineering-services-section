// meme-store.test.ts — behavioral proof of the Memetic Memory Unit. Run: node --test (Node ≥ 22.18).
import { test } from "node:test";
import assert from "node:assert/strict";

import { settleOne } from "@561-group/memetic-processing-unit";
import { negate } from "@lenticule-science/metrologic/articulation/predicating/positing/bilattice-charge"; // runtime use is the TEST's, not the unit's
import { MemeStore } from "./index.mjs";

const meme = (subject, predicate, object, value) => ({
  cell: { subject, predicate, object },
  charge: { value, evidence: [[], []] },
});

test("store then recall returns the meme at its exact address", () => {
  const store = new MemeStore();
  const m = meme("socrates", "mortal", "socrates", [true, false]);
  store.store(m);
  assert.deepEqual(store.recall({ subject: "socrates", predicate: "mortal", object: "socrates" }), [m]);
});

test("memory is ACCRETIVE and does NOT fold: a cell witnessed both ways stays as two memes", () => {
  const store = new MemeStore();
  store.store(meme("sky", "blue", "sky", [true, false])); // affirm
  store.store(meme("sky", "blue", "sky", [false, true])); // deny
  const got = store.recall({ subject: "sky", predicate: "blue", object: "sky" });
  assert.equal(got.length, 2); // both kept — the MPU would fold these to ⊤, the store does not
  assert.deepEqual(got.map((m) => m.charge.value), [[true, false], [false, true]]);
});

test("recall of an unstored address is empty; has reflects presence", () => {
  const store = new MemeStore();
  store.store(meme("a", "p", "a", [true, false]));
  assert.deepEqual(store.recall({ subject: "z", predicate: "q", object: "z" }), []);
  assert.equal(store.has({ subject: "a", predicate: "p", object: "a" }), true);
  assert.equal(store.has({ subject: "z", predicate: "q", object: "z" }), false);
});

test("cells() lists distinct addresses; size counts memes; memes is an immutable copy", () => {
  const store = new MemeStore();
  store.store(meme("a", "p", "a", [true, false]))
       .store(meme("a", "p", "a", [false, true])) // same address, second meme
       .store(meme("b", "q", "b", [true, false]));
  assert.equal(store.size, 3);
  assert.deepEqual(store.cells().map((c) => c.subject), ["a", "b"]); // distinct addresses
  const before = store.size;
  (store.memes).push(meme("x", "y", "x", [true, false]));
  assert.equal(store.size, before); // mutating the copy must not touch memory
});

test("interop: a Meme produced by the processing unit stores and recalls unchanged", () => {
  const store = new MemeStore();
  const affirmed = settleOne(["socrates", "mortal"]);
  const denied = { cell: affirmed.cell, charge: negate(affirmed.charge) };
  store.store(affirmed).store(denied);
  const got = store.recall(affirmed.cell);
  assert.equal(got.length, 2);
  assert.deepEqual(got[0], affirmed); // stored raw, unchanged
});
