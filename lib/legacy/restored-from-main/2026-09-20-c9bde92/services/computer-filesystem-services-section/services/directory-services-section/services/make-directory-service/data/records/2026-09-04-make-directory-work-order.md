# make-directory
## Requirements
- `directory-made`: The operation makes the directory at the given path with every missing ancestor and returns a DirectoryMade record naming the path; an existing directory is not an error.
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
{"packageName":"@red-cup-engineering/make-directory-service","packageVersion":"0.1.0","license":"MIT","dependencies":{},"devDependencies":{}}
```
## Operation
```mjs path=scripts/make-directory.mjs
#!/usr/bin/env node
import { mkdir } from "node:fs/promises";

/**
 * Makes one directory and every missing ancestor, and reports the path made.
 * @param {object} request A record with the directory path.
 * @returns {Promise<object>} A DirectoryMade record.
 * @throws {TypeError} When path is not a non-empty string.
 */
export async function makeDirectory(request) {
  if (typeof request?.path !== "string" || request.path.length === 0) throw new TypeError("a non-empty path is required");
  await mkdir(request.path, { recursive: true });
  return { type: "DirectoryMade", path: request.path };
}

if (import.meta.main) {
  if (process.argv.includes("--help")) {
    process.stdout.write("makeDirectory — Makes one directory and every missing ancestor, and reports the path made.\n");
  } else {
    let text = "";
    for await (const chunk of process.stdin) text += chunk;
    for (const line of text.split("\n")) {
      if (line.length > 0) process.stdout.write(`${JSON.stringify(await makeDirectory(JSON.parse(line)))}\n`);
    }
  }
}
```
## Tests
```mjs path=test/make-directory.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { makeDirectory } from "../scripts/make-directory.mjs";
import { tmpdir } from "node:os";
import { stat, rm } from "node:fs/promises";
test("makes nested directories and tolerates existing ones", async () => {
  const path = `${tmpdir()}/561-make-directory-test-${process.pid}/a/b`;
  assert.deepEqual(await makeDirectory({ path }), { type: "DirectoryMade", path });
  assert.ok((await stat(path)).isDirectory());
  assert.deepEqual(await makeDirectory({ path }), { type: "DirectoryMade", path });
  await rm(`${tmpdir()}/561-make-directory-test-${process.pid}`, { recursive: true, force: true });
});
test("refuses a missing path", async () => { await assert.rejects(() => makeDirectory({}), /a non-empty path is required/u); });
```
## Examples
```json name="make-directory example"
{"input":{"path":"/tmp/561-group-make-directory-example"},"output":{"type":"DirectoryMade","path":"/tmp/561-group-make-directory-example"}}
```
## Traceability
- `directory-made` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `fabricate-do-not-hand-write`, `node-esm-operation`
- `missing-path-refusal` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `fabricate-do-not-hand-write`, `node-esm-operation`
