import assert from "node:assert/strict";
import test from "node:test";

import { resolveFilepath } from "../scripts/resolve-filepath.mjs";

test("resolves an explicit segment sequence", () => {
  assert.equal(resolveFilepath(["/workspace", "packages", "thing", "package.json"]), "/workspace/packages/thing/package.json");
});

test("refuses absent or non-text segments", () => {
  assert.throws(() => resolveFilepath([]), /nonempty array of strings/u);
  assert.throws(() => resolveFilepath(["/workspace", 1]), /nonempty array of strings/u);
});
