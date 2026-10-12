import assert from "node:assert/strict";
import test from "node:test";

import { projectFilepathBasename } from "../scripts/project-filepath-basename.mjs";

test("projects the final filepath component", () => {
  assert.equal(projectFilepathBasename("packages/thing/package.json"), "package.json");
});
