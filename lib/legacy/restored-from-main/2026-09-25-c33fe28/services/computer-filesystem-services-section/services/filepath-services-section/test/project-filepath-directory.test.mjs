import assert from "node:assert/strict";
import test from "node:test";

import { projectFilepathDirectory } from "../scripts/project-filepath-directory.mjs";

test("projects the containing directory spelling", () => {
  assert.equal(projectFilepathDirectory("packages/thing/package.json"), "packages/thing");
  assert.equal(projectFilepathDirectory("package.json"), ".");
});
