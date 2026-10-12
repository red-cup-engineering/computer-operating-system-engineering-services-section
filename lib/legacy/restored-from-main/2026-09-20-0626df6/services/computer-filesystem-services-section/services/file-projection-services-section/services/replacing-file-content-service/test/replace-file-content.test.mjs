import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { replaceFileContent } from "../scripts/replace-file-content.mjs";

const execFileAsync = promisify(execFile);

test("replaceFileContent previews and atomically applies literal replacements", async () => {
  const root = await mkdtemp(join(tmpdir(), "replace-file-content-"));
  const path = join(root, "example.txt");
  try {
    await writeFile(path, "old and old\n");
    const preview = await replaceFileContent({ path, search: "old", replacement: "new", expectedCount: 2, dryRun: true });
    assert.equal(preview.matches, 2);
    assert.equal(await readFile(path, "utf8"), "old and old\n");

    const applied = await replaceFileContent({ path, search: "old", replacement: "new", expectedCount: 2 });
    assert.equal(applied.changed, true);
    assert.equal(await readFile(path, "utf8"), "new and new\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("replaceFileContent refuses an unexpected match count", async () => {
  const root = await mkdtemp(join(tmpdir(), "replace-file-content-count-"));
  const path = join(root, "example.txt");
  try {
    await writeFile(path, "old\n");
    await assert.rejects(
      replaceFileContent({ path, search: "old", replacement: "new", expectedCount: 2 }),
      /expected 2 matches/u,
    );
    assert.equal(await readFile(path, "utf8"), "old\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("CLI emits one JSON result and applies the same replacement operation", async () => {
  const root = await mkdtemp(join(tmpdir(), "replace-file-content-cli-"));
  const path = join(root, "example.txt");
  try {
    await writeFile(path, "old\n");
    const script = join(import.meta.dirname, "..", "scripts", "replace-file-content.mjs");
    const { stdout } = await execFileAsync("node", [script, "--file", path, "--search", "old", "--replacement", "new", "--expected-count", "1"]);
    assert.equal(JSON.parse(stdout).matches, 1);
    assert.equal(await readFile(path, "utf8"), "new\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
