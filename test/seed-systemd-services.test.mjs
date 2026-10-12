// seed-systemd-services.test — direct unit tests for currentStoppedClaim against synthetic rows
// arrays only (no live system call, no on-disk trace).

import { test } from "node:test";
import assert from "node:assert/strict";
import { currentStoppedClaim } from "../scripts/seed-systemd-services.mjs";

const address = "systemd-service:test";

test("currentStoppedClaim returns undefined when the predicate was never asserted", () => {
  assert.equal(currentStoppedClaim([], address), undefined);
});

test("currentStoppedClaim returns the single 'yes' row when only one exists", () => {
  const row = { e: address, a: "stopped", v: "yes", t: 1000 };
  assert.deepEqual(currentStoppedClaim([row], address), row);
});

test("currentStoppedClaim returns the later tombstone over an earlier 'yes'", () => {
  const yes = { e: address, a: "stopped", v: "yes", t: 1000 };
  const tombstone = { e: address, a: "stopped", v: null, t: 2000 };
  assert.deepEqual(currentStoppedClaim([yes, tombstone], address), tombstone);
});

test("currentStoppedClaim returns a later 'yes' over an earlier tombstone", () => {
  const yes1 = { e: address, a: "stopped", v: "yes", t: 1000 };
  const tombstone = { e: address, a: "stopped", v: null, t: 2000 };
  const yes2 = { e: address, a: "stopped", v: "yes", t: 3000 };
  assert.deepEqual(currentStoppedClaim([yes1, tombstone, yes2], address), yes2);
});
