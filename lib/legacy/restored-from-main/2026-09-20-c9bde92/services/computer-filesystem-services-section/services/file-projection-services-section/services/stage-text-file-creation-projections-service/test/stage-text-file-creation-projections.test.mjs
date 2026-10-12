import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { lstat, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { serializeLines } from "../../../../../../../../../../computer-data-engineering-services-section/services/serialized-computer-data-engineering-services-section/services/json-services-section/src/index.mjs";
import { stageTextFileCreationProjections } from "../scripts/stage-text-file-creation-projections.mjs";

function request(parentDirectory) {
  const files = [
    { type: "TextFileCreationProjection", version: 1, path: "README.md", text: "hello\n", mode: 0o644 },
    { type: "TextFileCreationProjection", version: 1, path: "scripts/run.mjs", text: "run\n", mode: 0o755 },
  ];
  return {
    type: "TextFileCreationStagingRequest",
    version: 1,
    parentDirectory,
    files,
    filesDigest: `sha256:${createHash("sha256").update(serializeLines(files)).digest("hex")}`,
  };
}

test("stages exclusively and returns a read-back proof", async (t) => {
  const parent = await mkdtemp(path.join("/tmp", "stage-files-test-"));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const stage = await stageTextFileCreationProjections(request(parent));
  assert.equal(stage.type, "TextFileCreationStageRead", JSON.stringify(stage));
  assert.equal(await readFile(path.join(stage.stageDirectory, "README.md"), "utf8"), "hello\n");
  assert.equal((await lstat(path.join(stage.stageDirectory, "scripts/run.mjs"))).mode & 0o777, 0o755);
});

test("refuses a false digest without creating a stage", async (t) => {
  const parent = await mkdtemp(path.join("/tmp", "stage-files-test-"));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const invalid = { ...request(parent), filesDigest: "sha256:false" };
  assert.equal((await stageTextFileCreationProjections(invalid)).code, "FILES_DIGEST_MISMATCH");
});
