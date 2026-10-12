import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { serializeLines } from "../../../../../../../../../../computer-data-engineering-services-section/services/serialized-computer-data-engineering-services-section/services/json-services-section/src/index.mjs";
import { readTextFileCreationStage } from "../scripts/read-text-file-creation-stage.mjs";

async function fixture(t) {
  const stageDirectory = await mkdtemp(path.join("/tmp", "read-stage-test-"));
  t.after(() => rm(stageDirectory, { recursive: true, force: true }));
  await mkdir(path.join(stageDirectory, "scripts"));
  await writeFile(path.join(stageDirectory, "scripts/run.mjs"), "run\n");
  await chmod(path.join(stageDirectory, "scripts/run.mjs"), 0o755);
  const files = [{ type: "TextFileCreationProjection", version: 1, path: "scripts/run.mjs", text: "run\n", mode: 0o755 }];
  return {
    type: "TextFileCreationStage",
    version: 1,
    stageDirectory,
    files,
    filesDigest: `sha256:${createHash("sha256").update(serializeLines(files)).digest("hex")}`,
  };
}

test("reads and proves exact staged files", async (t) => {
  const read = await readTextFileCreationStage(await fixture(t));
  assert.equal(read.type, "TextFileCreationStageRead", JSON.stringify(read));
  assert.equal(read.fileDigests[0].path, "scripts/run.mjs");
  assert.match(read.fileDigests[0].digest, /^sha256:[a-f0-9]{64}$/u);
});

test("refuses stage drift", async (t) => {
  const stage = await fixture(t);
  await writeFile(path.join(stage.stageDirectory, "scripts/run.mjs"), "changed\n");
  assert.equal((await readTextFileCreationStage(stage)).code, "STAGE_CONTENT_MISMATCH");
});
