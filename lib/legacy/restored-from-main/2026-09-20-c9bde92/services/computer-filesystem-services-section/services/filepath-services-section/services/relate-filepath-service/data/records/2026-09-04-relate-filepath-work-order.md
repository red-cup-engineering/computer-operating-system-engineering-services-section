# relate-filepath
## Requirements
- `relation-projected`: The operation returns the relative path from the from spelling to the to spelling exactly as node:path relative does.
## Prohibitions
- `missing-endpoints-refusal`: The operation must refuse a request whose from or to is not a string.
## Laws
- `fabricate-do-not-hand-write` | 561 Group working discipline, dispatch-agents skill | 2026-09-04 | .claude/skills/dispatch-agents/SKILL.md | Applies to the imports of every new script and source module in the tree. | A direct Node built-in import where a house service exists is a defect a lot must not ship; this service is the one house owner of its operation.
## Standards
- `node-path` | Node.js | v24.2.0+ | https://nodejs.org/docs/v24/api/path.html | Applies to the path projection. | The projection is the platform path algebra of node:path, without observing the filesystem.
- `node-esm-operation` | Node.js | v24.2.0+ | https://nodejs.org/docs/v24/api/esm.html | Applies to the .mjs operation, its import.meta.main guard, and downstream package-birth assays. | The package uses one executable ESM operation source file that is eligible for downstream staged package-birth assays.
## Open questions
none
## Package
```json
{"packageName":"@red-cup-engineering/relate-filepath-service","packageVersion":"0.1.0","license":"MIT","dependencies":{},"devDependencies":{}}
```
## Operation
```mjs path=scripts/relate-filepath.mjs
#!/usr/bin/env node
import { relative } from "node:path";

/**
 * Projects the relative filepath spelling from one path to another, without observing the filesystem.
 * @param {object} request A record with from and to filepath spellings.
 * @returns {string} The relative path from from to to.
 * @throws {TypeError} When from or to is not a string.
 */
export function relateFilepath(request) {
  if (typeof request?.from !== "string" || typeof request?.to !== "string") throw new TypeError("from and to filepath strings are required");
  return relative(request.from, request.to);
}

if (import.meta.main) {
  if (process.argv.includes("--help")) {
    process.stdout.write("relateFilepath — Projects the relative filepath spelling from one path to another, without observing the filesystem.\n");
  } else {
    let text = "";
    for await (const chunk of process.stdin) text += chunk;
    for (const line of text.split("\n")) {
      if (line.length > 0) process.stdout.write(`${JSON.stringify(await relateFilepath(JSON.parse(line)))}\n`);
    }
  }
}
```
## Tests
```mjs path=test/relate-filepath.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { relateFilepath } from "../scripts/relate-filepath.mjs";
test("relates two paths", () => {
  assert.equal(relateFilepath({ from: "/a/b", to: "/a/c/d" }), "../c/d");
  assert.equal(relateFilepath({ from: "/a", to: "/a" }), "");
});
test("refuses missing endpoints", () => assert.throws(() => relateFilepath({ from: "/a" }), /from and to filepath strings are required/u));
```
## Examples
```json name="relate-filepath example"
{"input":{"from":"/a/b","to":"/a/c/d"},"output":"../c/d"}
```
## Traceability
- `relation-projected` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `fabricate-do-not-hand-write`, `node-esm-operation`
- `missing-endpoints-refusal` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `fabricate-do-not-hand-write`, `node-esm-operation`
