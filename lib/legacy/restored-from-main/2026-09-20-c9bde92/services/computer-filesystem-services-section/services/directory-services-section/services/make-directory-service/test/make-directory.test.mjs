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
