# project-file-url-filepath
## Requirements
- `file-url-to-filepath`: The operation projects one file: URL spelling, such as a module's import.meta.url, to the platform filepath it names, decoding percent-escapes.
## Prohibitions
- `non-file-url-refusal`: The operation must refuse a request that is not a string beginning with file:.
## Laws
- `fabricate-do-not-hand-write` | 561 Group working discipline, dispatch-agents skill | 2026-09-04 | .claude/skills/dispatch-agents/SKILL.md | Applies to the imports of every new script and source module in the tree. | A direct node:url import where a house service exists is a defect a lot must not ship; this service is the one house owner of the file-URL-to-path projection.
## Standards
- `node-url-file-url-to-path` | Node.js | v24.2.0+ | https://nodejs.org/docs/v24/api/url.html#urlfileurltopathurl-options | Applies to the projection of a WHATWG file: URL to a platform path. | The projection decodes percent-escapes and rejects non-file: URLs exactly as url.fileURLToPath does.
- `node-esm-operation` | Node.js | v24.2.0+ | https://nodejs.org/docs/v24/api/esm.html | Applies to the .mjs operation, its import.meta.main guard, and downstream package-birth assays. | The package uses one executable ESM operation source file that is eligible for downstream staged package-birth assays.
## Open questions
none
## Package
```json
{"packageName":"@red-cup-engineering/project-file-url-filepath-service","packageVersion":"0.1.0","license":"MIT","dependencies":{},"devDependencies":{}}
```
## Operation
```mjs path=scripts/project-file-url-filepath.mjs
#!/usr/bin/env node
import { fileURLToPath } from "node:url";

/**
 * Projects one file: URL spelling, such as a module's import.meta.url, to the platform filepath it names.
 * @param {string} url A file: URL string.
 * @returns {string} The platform filepath the URL names.
 * @throws {TypeError} When url is not a string beginning with file:.
 */
export function projectFileUrlFilepath(url) {
  if (typeof url !== "string" || !url.startsWith("file:")) throw new TypeError("a file: URL string is required");
  return fileURLToPath(url);
}

if (import.meta.main) {
  if (process.argv.includes("--help")) {
    process.stdout.write("projectFileUrlFilepath — Projects one file: URL spelling, such as a module's import.meta.url, to the platform filepath it names.\n");
  } else {
    let text = "";
    for await (const chunk of process.stdin) text += chunk;
    for (const line of text.split("\n")) {
      if (line.length > 0) process.stdout.write(`${JSON.stringify(projectFileUrlFilepath(JSON.parse(line)))}\n`);
    }
  }
}
```
## Tests
```mjs path=test/project-file-url-filepath.test.mjs
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
```
## Examples
```json name="projects a file URL"
{"input":"file:///tmp/a%20b/c.mjs","output":"/tmp/a b/c.mjs"}
```
## Traceability
- `file-url-to-filepath` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `fabricate-do-not-hand-write`, `node-url-file-url-to-path`, `node-esm-operation`
- `non-file-url-refusal` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `fabricate-do-not-hand-write`, `node-url-file-url-to-path`, `node-esm-operation`
