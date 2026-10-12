import assert from "node:assert/strict";
import test from "node:test";
import { projectFilepathExtension } from "../scripts/project-filepath-extension.mjs";
test("projects the final extension", () => {
  assert.equal(projectFilepathExtension("a/b.tar.gz"), ".gz");
  assert.equal(projectFilepathExtension("a/b"), "");
  assert.equal(projectFilepathExtension(".hidden"), "");
});
test("refuses a non-string", () => assert.throws(() => projectFilepathExtension(1), /a filepath string is required/u));
