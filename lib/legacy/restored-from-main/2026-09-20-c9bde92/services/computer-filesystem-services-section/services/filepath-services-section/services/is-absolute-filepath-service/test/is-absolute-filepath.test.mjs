import assert from "node:assert/strict";
import test from "node:test";
import { isAbsoluteFilepath } from "../scripts/is-absolute-filepath.mjs";
test("reports absoluteness", () => {
  assert.equal(isAbsoluteFilepath("/x/y"), true);
  assert.equal(isAbsoluteFilepath("x/y"), false);
  assert.equal(isAbsoluteFilepath(""), false);
});
test("refuses a non-string", () => assert.throws(() => isAbsoluteFilepath(null), /a filepath string is required/u));
