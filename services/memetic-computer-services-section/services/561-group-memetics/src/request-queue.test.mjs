import test from "node:test";
import assert from "node:assert/strict";

import { createRequestQueue, defaultRequestValidator } from "./request-queue.mjs";

test("default request validator accepts plain objects and rejects malformed ingress", () => {
  assert.deepEqual(defaultRequestValidator({ kind: "move", actor: "a" }), { kind: "move", actor: "a" });
  assert.equal(defaultRequestValidator(null), null);
  assert.equal(defaultRequestValidator("nope"), null);
  assert.equal(defaultRequestValidator(42), null);
  assert.equal(defaultRequestValidator(["array-is-not-an-intent"]), null);
});

test("request queue validates and drains intents in arrival order", () => {
  const q = createRequestQueue();

  assert.deepEqual(q.push({ n: 1 }), { n: 1 });
  assert.deepEqual(q.push({ n: 2 }), { n: 2 });
  assert.deepEqual(q.push({ n: 3 }), { n: 3 });
  assert.equal(q.depth(), 3);

  assert.deepEqual(q.drain().map((intent) => intent.n), [1, 2, 3]);
  assert.equal(q.depth(), 0);
  assert.deepEqual(q.drain(), []);
});

test("request queue freezes each drain as the single-writer batch", () => {
  const q = createRequestQueue();

  q.push({ a: 1 });
  q.push({ a: 2 });
  const first = q.drain();
  q.push({ a: 3 });
  const second = q.drain();

  assert.deepEqual(first.map((intent) => intent.a), [1, 2]);
  assert.deepEqual(second.map((intent) => intent.a), [3]);
});

test("request queue peek observes without consuming or mutating pending intents", () => {
  const q = createRequestQueue();

  q.push({ x: 1 });
  q.push({ x: 2 });
  const seen = q.peek();
  seen.push({ x: 999 });

  assert.deepEqual(q.peek().map((intent) => intent.x), [1, 2]);
  assert.equal(q.depth(), 2);
});

test("custom request validators are the trust boundary", () => {
  const dirs = new Set(["n", "s", "e", "w"]);
  const q = createRequestQueue((raw) => {
    if (!raw || typeof raw !== "object") return null;
    const record = raw;
    if (record.kind === "move" && typeof record.actor === "string" && dirs.has(String(record.dir))) {
      return { kind: "move", actor: record.actor, dir: record.dir };
    }
    if (record.kind === "say" && typeof record.actor === "string" && typeof record.text === "string" && record.text.trim()) {
      return { kind: "say", actor: record.actor, text: record.text.trim().slice(0, 200) };
    }
    return null;
  });

  assert.deepEqual(q.push({ kind: "move", actor: "al", dir: "n" }), { kind: "move", actor: "al", dir: "n" });
  assert.equal(q.push({ kind: "move", actor: "al", dir: "up" }), null);
  assert.equal(q.push({ kind: "fly", actor: "al" }), null);
  assert.equal(q.push({ kind: "say", dir: "n" }), null);
  assert.equal(q.depth(), 1);
  assert.deepEqual(q.drain(), [{ kind: "move", actor: "al", dir: "n" }]);
});

test("request queue rejects non-function validators", () => {
  assert.throws(() => createRequestQueue("not-a-function"), /validate must be a function/);
});
