# remove-path
## Requirements
- `path-removed`: The operation removes the file or directory tree at the given path, recursively and without error when absent, and returns a PathRemoved record naming the path.
## Prohibitions
- `missing-path-refusal`: The operation must refuse a request whose path is not a non-empty string.
## Laws
- `fabricate-do-not-hand-write` | 561 Group working discipline, dispatch-agents skill | 2026-09-04 | .claude/skills/dispatch-agents/SKILL.md | Applies to the imports of every new script and source module in the tree. | A direct Node built-in import where a house service exists is a defect a lot must not ship; this service is the one house owner of its operation.
## Standards
- `node-fs-promises` | Node.js | v24.2.0+ | https://nodejs.org/docs/v24/api/fs.html#promises-api | Applies to the filesystem effect. | The operation performs exactly one filesystem effect through the fs promises API.
- `node-esm-operation` | Node.js | v24.2.0+ | https://nodejs.org/docs/v24/api/esm.html | Applies to the .mjs operation, its import.meta.main guard, and downstream package-birth assays. | The package uses one executable ESM operation source file that is eligible for downstream staged package-birth assays.
## Open questions
none
## Package
```json
{"packageName":"@red-cup-engineering/remove-path-service","packageVersion":"0.1.0","license":"MIT","dependencies":{},"devDependencies":{}}
```
## Operation
```mjs path=scripts/remove-path.mjs
#!/usr/bin/env node
import { rm } from "node:fs/promises";

/**
 * Removes one file or directory tree at a path, and reports the path removed; an absent path is not an error.
 * @param {object} request A record with the path to remove.
 * @returns {Promise<object>} A PathRemoved record.
 * @throws {TypeError} When path is not a non-empty string.
 */
export async function removePath(request) {
  if (typeof request?.path !== "string" || request.path.length === 0) throw new TypeError("a non-empty path is required");
  await rm(request.path, { recursive: true, force: true });
  return { type: "PathRemoved", path: request.path };
}

if (import.meta.main) {
  if (process.argv.includes("--help")) {
    process.stdout.write("removePath — Removes one file or directory tree at a path, and reports the path removed; an absent path is not an error.\n");
  } else {
    let text = "";
    for await (const chunk of process.stdin) text += chunk;
    for (const line of text.split("\n")) {
      if (line.length > 0) process.stdout.write(`${JSON.stringify(await removePath(JSON.parse(line)))}\n`);
    }
  }
}
```
## Tests
```mjs path=test/remove-path.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { removePath } from "../scripts/remove-path.mjs";
import { tmpdir } from "node:os";
import { mkdir, writeFile, access } from "node:fs/promises";
test("removes a directory tree and tolerates an absent path", async () => {
  const root = `${tmpdir()}/561-remove-path-test-${process.pid}`;
  await mkdir(`${root}/a`, { recursive: true });
  await writeFile(`${root}/a/f.txt`, "x");
  assert.deepEqual(await removePath({ path: root }), { type: "PathRemoved", path: root });
  await assert.rejects(() => access(root));
  assert.deepEqual(await removePath({ path: root }), { type: "PathRemoved", path: root });
});
test("refuses a missing path", async () => { await assert.rejects(() => removePath({ path: "" }), /a non-empty path is required/u); });
```
## Examples
```json name="remove-path example"
{"input":{"path":"/tmp/561-group-remove-path-example-absent"},"output":{"type":"PathRemoved","path":"/tmp/561-group-remove-path-example-absent"}}
```
## Traceability
- `path-removed` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `fabricate-do-not-hand-write`, `node-esm-operation`
- `missing-path-refusal` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `fabricate-do-not-hand-write`, `node-esm-operation`
