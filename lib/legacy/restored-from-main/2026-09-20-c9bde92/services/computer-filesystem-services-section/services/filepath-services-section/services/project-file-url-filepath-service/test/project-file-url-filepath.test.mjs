import assert from "node:assert/strict";
import test from "node:test";
import { projectFileUrlFilepath } from "../scripts/project-file-url-filepath.mjs";
test("projects a file URL to its filepath, decoding escapes", () => {
  assert.equal(projectFileUrlFilepath("file:///tmp/a%20b/c.mjs"), "/tmp/a b/c.mjs");
});
test("projects a module's own import.meta.url", () => {
  assert.ok(projectFileUrlFilepath(import.meta.url).endsWith("/test/project-file-url-filepath.test.mjs"));
});
test("refuses a non-file URL", () => assert.throws(() => projectFileUrlFilepath("https://example.org/x"), /a file: URL string is required/u));
test("refuses a non-string", () => assert.throws(() => projectFileUrlFilepath(42), /a file: URL string is required/u));
