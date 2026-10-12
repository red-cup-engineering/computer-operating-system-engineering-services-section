# is-absolute-filepath
## Requirements
- `absoluteness-reported`: The operation returns true exactly when node:path isAbsolute does for the spelling.
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
{"packageName":"@red-cup-engineering/is-absolute-filepath-service","packageVersion":"0.1.0","license":"MIT","dependencies":{},"devDependencies":{}}
```
## Operation
```mjs path=scripts/is-absolute-filepath.mjs
#!/usr/bin/env node
import { isAbsolute } from "node:path";

/**
 * Reports whether one filepath spelling is absolute on this platform, without observing the filesystem.
 * @param {string} path A filepath spelling.
 * @returns {boolean} Whether the spelling is absolute.
 * @throws {TypeError} When path is not a string.
 */
export function isAbsoluteFilepath(path) {
  if (typeof path !== "string") throw new TypeError("a filepath string is required");
  return isAbsolute(path);
}

if (import.meta.main) {
  if (process.argv.includes("--help")) {
    process.stdout.write("isAbsoluteFilepath — Reports whether one filepath spelling is absolute on this platform, without observing the filesystem.\n");
  } else {
    let text = "";
    for await (const chunk of process.stdin) text += chunk;
    for (const line of text.split("\n")) {
      if (line.length > 0) process.stdout.write(`${JSON.stringify(await isAbsoluteFilepath(JSON.parse(line)))}\n`);
    }
  }
}
```
## Tests
```mjs path=test/is-absolute-filepath.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { isAbsoluteFilepath } from "../scripts/is-absolute-filepath.mjs";
test("reports absoluteness", () => {
  assert.equal(isAbsoluteFilepath("/x/y"), true);
  assert.equal(isAbsoluteFilepath("x/y"), false);
  assert.equal(isAbsoluteFilepath(""), false);
});
test("refuses a non-string", () => assert.throws(() => isAbsoluteFilepath(null), /a filepath string is required/u));
```
## Examples
```json name="is-absolute-filepath example"
{"input":"/x/y","output":true}
```
## Traceability
- `absoluteness-reported` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `fabricate-do-not-hand-write`, `node-esm-operation`
- `non-string-refusal` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `fabricate-do-not-hand-write`, `node-esm-operation`
