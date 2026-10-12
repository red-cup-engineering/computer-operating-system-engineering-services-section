import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { moveWorkspaceResource, observeWorkspaceResource, readWorkspaceFile, writeWorkspaceFile } from "../src/index.mjs";

const sha = text => createHash("sha256").update(text).digest("hex");

test("writes atomically, emits one durable receipt, and supports bounded readback", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "filesystem-custody-"));
  await mkdir(path.join(root, "src"));
  await writeFile(path.join(root, "src", "a.txt"), "before");
  const outbox = path.join(root, ".custody", "outbox.jsonl");
  const receipt = await writeWorkspaceFile({ root, path: "src/a.txt", expectedSha256: sha("before"), content: "after", outbox });
  assert.equal(receipt.changed, true);
  assert.equal(await readFile(path.join(root, "src/a.txt"), "utf8"), "after");
  assert.deepEqual(JSON.parse((await readFile(outbox, "utf8")).trim()), receipt);
  const read = await readWorkspaceFile({ root, path: "src/a.txt" });
  assert.equal(read.sha256, sha("after"));
});

test("refuses stale writes and paths outside the custody root", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "filesystem-custody-"));
  await writeFile(path.join(root, "a.txt"), "before");
  await assert.rejects(() => writeWorkspaceFile({ root, path: "a.txt", expectedSha256: sha("other"), content: "after", outbox: path.join(root, "outbox.jsonl") }), { code: "stale-source" });
  await assert.rejects(() => readWorkspaceFile({ root, path: "../outside.txt" }), { code: "outside-root" });
});

test("moves one observed resource without changing its content identity", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "filesystem-custody-move-"));
  await mkdir(path.join(root, "legacy", "package", "src"), { recursive: true });
  await writeFile(path.join(root, "legacy", "package", "package.json"), "{}\n");
  await writeFile(path.join(root, "legacy", "package", "src", "index.mjs"), "export const value = 1;\n");
  const before = await observeWorkspaceResource({ root, path: "legacy/package", resource: "ni:///sha-256;AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" });
  const outbox = path.join(root, ".custody", "outbox.jsonl");
  const receipt = await moveWorkspaceResource({ root, from: "legacy/package", to: "services/target/package", expectedContentDigest: before.contentDigest, resource: before.resource, outbox });
  const after = await observeWorkspaceResource({ root, path: "services/target/package", resource: before.resource });
  assert.equal(after.contentDigest, before.contentDigest);
  assert.equal(receipt.contentDigest, before.contentDigest);
  await assert.rejects(access(path.join(root, "legacy", "package")), { code: "ENOENT" });
  assert.deepEqual(JSON.parse((await readFile(outbox, "utf8")).trim()), receipt);
});

test("refuses stale or overwriting resource moves", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "filesystem-custody-move-"));
  await mkdir(path.join(root, "from"));
  await mkdir(path.join(root, "occupied"));
  await writeFile(path.join(root, "from", "value.txt"), "value");
  const outbox = path.join(root, "outbox.jsonl");
  await assert.rejects(() => moveWorkspaceResource({ root, from: "from", to: "target", expectedContentDigest: "ni:///sha-256;AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", outbox }), { code: "stale-source" });
  const observed = await observeWorkspaceResource({ root, path: "from" });
  await assert.rejects(() => moveWorkspaceResource({ root, from: "from", to: "occupied", expectedContentDigest: observed.contentDigest, outbox }), { code: "target-exists" });
});
