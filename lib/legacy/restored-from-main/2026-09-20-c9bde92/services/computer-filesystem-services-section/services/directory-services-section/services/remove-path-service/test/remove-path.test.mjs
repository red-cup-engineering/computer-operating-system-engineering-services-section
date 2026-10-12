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
