import assert from "node:assert/strict";
import test from "node:test";
import { relateFilepath } from "../scripts/relate-filepath.mjs";
test("relates two paths", () => {
  assert.equal(relateFilepath({ from: "/a/b", to: "/a/c/d" }), "../c/d");
  assert.equal(relateFilepath({ from: "/a", to: "/a" }), "");
});
test("refuses missing endpoints", () => assert.throws(() => relateFilepath({ from: "/a" }), /from and to filepath strings are required/u));
