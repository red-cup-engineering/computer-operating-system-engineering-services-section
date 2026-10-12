# project-filepath-extension
## Requirements
- `extension-projected`: The operation returns the extension of the last path component including its leading dot, exactly as node:path extname does, and the empty string when there is none.
## Prohibitions
- `non-string-refusal`: The operation must refuse a request that is not a string.
## Laws
- `fabricate-do-not-hand-write` | 561 Group working discipline, dispatch-agents skill | 2026-09-04 | .claude/skills/dispatch-agents/SKILL.md | Applies to the imports of every new script and source module in the tree. | A direct Node built-in import where a house service exists is a defect a lot must not ship; this service is the one house owner of its operation.
## Standards
- `node-path` | Node.js | v24.2.0+ | https://nodejs.org/docs/v24/api/path.html | Applies to the path projection. | The projection is the platform path algebra of node:path, without observing the filesystem.
- `node-esm-operation` | Node.js | v24.2.0+ | https://nodejs.org/docs/v24/api/esm.html | Applies to the .mjs operation, its import.meta.main guard, and downstream package-birth assays. | The package uses one executable ESM operation source file that is eligible for downstream staged package-birth assays.
## Open questions
none
## Package
```json
{"packageName":"@red-cup-engineering/project-filepath-extension-service","packageVersion":"0.1.0","license":"MIT","dependencies":{},"devDependencies":{}}
```
## Operation
```mjs path=scripts/project-filepath-extension.mjs
#!/usr/bin/env node
import { extname } from "node:path";

/**
 * Projects one filepath spelling to its final extension, including the dot, or the empty string when it has none, without observing the filesystem.
 * @param {string} path A filepath spelling.
 * @returns {string} The extension including its dot, or the empty string.
 * @throws {TypeError} When path is not a string.
 */
export function projectFilepathExtension(path) {
  if (typeof path !== "string") throw new TypeError("a filepath string is required");
  return extname(path);
}

if (import.meta.main) {
  if (process.argv.includes("--help")) {
    process.stdout.write("projectFilepathExtension — Projects one filepath spelling to its final extension, including the dot, or the empty string when it has none, without observing the filesystem.\n");
  } else {
    let text = "";
    for await (const chunk of process.stdin) text += chunk;
    for (const line of text.split("\n")) {
      if (line.length > 0) process.stdout.write(`${JSON.stringify(await projectFilepathExtension(JSON.parse(line)))}\n`);
    }
  }
}
```
## Tests
```mjs path=test/project-filepath-extension.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { projectFilepathExtension } from "../scripts/project-filepath-extension.mjs";
test("projects the final extension", () => {
  assert.equal(projectFilepathExtension("a/b.tar.gz"), ".gz");
  assert.equal(projectFilepathExtension("a/b"), "");
  assert.equal(projectFilepathExtension(".hidden"), "");
});
test("refuses a non-string", () => assert.throws(() => projectFilepathExtension(1), /a filepath string is required/u));
```
## Examples
```json name="project-filepath-extension example"
{"input":"a/b.tar.gz","output":".gz"}
```
## Traceability
- `extension-projected` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `fabricate-do-not-hand-write`, `node-esm-operation`
- `non-string-refusal` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `fabricate-do-not-hand-write`, `node-esm-operation`
