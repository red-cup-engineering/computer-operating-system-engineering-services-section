import { createHash, randomUUID } from "node:crypto";
import { EMPTY_WITNESS_ROOT, identifyBytesSemanticContent } from "@red-cup-engineering/semantic-content-identify-service";
import { appendFile, lstat, mkdir, open, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const MAX_READ_BYTES = 256 * 1024;
export const MAX_WRITE_BYTES = 1024 * 1024;
export const MAX_RESOURCE_BYTES = 64 * 1024 * 1024;
export const MAX_RESOURCE_ENTRIES = 10_000;

const digest = value => createHash("sha256").update(value).digest("hex");
const canonical = value => JSON.stringify(value, Object.keys(value).sort());

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

async function custodyRoot(root) {
  if (typeof root !== "string" || root.length === 0) fail("invalid-root", "custody root is required");
  return realpath(root);
}

/** Resolve one relative path without accepting an escape or a symlink target. */
async function targetAt(root, relativePath) {
  if (typeof relativePath !== "string" || relativePath.length === 0 || path.isAbsolute(relativePath)) fail("invalid-path", "path must be a non-empty relative path");
  const target = path.resolve(root, relativePath);
  const relative = path.relative(root, target);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) fail("outside-root", "path escapes the custody root");
  const parent = await realpath(path.dirname(target));
  if (parent !== root && !parent.startsWith(`${root}${path.sep}`)) fail("outside-root", "resolved parent escapes the custody root");
  try {
    if ((await lstat(target)).isSymbolicLink()) fail("symlink-target", "custody provider does not write through symlinks");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return target;
}

async function appendReceipt(outbox, receipt) {
  await mkdir(path.dirname(outbox), { recursive: true });
  const handle = await open(outbox, "a", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(receipt)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

function relativeTarget(root, relativePath) {
  if (typeof relativePath !== "string" || relativePath.length === 0 || path.isAbsolute(relativePath)) fail("invalid-path", "path must be a non-empty relative path");
  const target = path.resolve(root, relativePath);
  const relative = path.relative(root, target);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) fail("outside-root", "path escapes the custody root");
  return { target, relative: relative.split(path.sep).join("/") };
}

async function assertUnlinkedDescent(root, target, { permitAbsentLeaf = false } = {}) {
  const displacement = path.relative(root, target);
  let cursor = root;
  const segments = displacement.split(path.sep);
  for (let index = 0; index < segments.length; index += 1) {
    cursor = path.join(cursor, segments[index]);
    try {
      if ((await lstat(cursor)).isSymbolicLink()) fail("symlink-target", "custody provider does not traverse symlinks");
    } catch (error) {
      if (error?.code === "ENOENT" && permitAbsentLeaf) return;
      throw error;
    }
  }
}

const resourceIdentity = (bytes) => identifyBytesSemanticContent({ objectKind: "workspace-filesystem.resource-tree", bytes, witnessRoot: EMPTY_WITNESS_ROOT }).token;

async function resourceTree(target, { maxBytes = MAX_RESOURCE_BYTES, maxEntries = MAX_RESOURCE_ENTRIES } = {}) {
  const records = [];
  let bytes = 0;
  let entries = 0;
  async function visit(absolute, relativePath) {
    entries += 1;
    if (entries > maxEntries) fail("resource-too-many-entries", `resource exceeds ${maxEntries} entries`);
    const entry = await lstat(absolute);
    if (entry.isSymbolicLink()) fail("symlink-resource", "custody provider does not move resources containing symlinks");
    if (entry.isFile()) {
      const content = await readFile(absolute);
      bytes += content.byteLength;
      if (bytes > maxBytes) fail("resource-too-large", `resource exceeds ${maxBytes} bytes`);
      records.push(Buffer.from(`file\0${relativePath}\0${content.byteLength}\0`, "utf8"), content);
      return;
    }
    if (!entry.isDirectory()) fail("unsupported-resource", "custody provider moves only regular files and directories");
    records.push(Buffer.from(`directory\0${relativePath}\0`, "utf8"));
    const children = await readdir(absolute, { withFileTypes: true });
    children.sort((left, right) => left.name.localeCompare(right.name));
    for (const child of children) {
      await visit(path.join(absolute, child.name), relativePath ? `${relativePath}/${child.name}` : child.name);
    }
  }
  await visit(target, "");
  return Object.freeze({ bytes, entries, contentDigest: resourceIdentity(Buffer.concat(records)) });
}

export async function observeWorkspaceResource({ root, path: relativePath, resource = null, maxBytes = MAX_RESOURCE_BYTES, maxEntries = MAX_RESOURCE_ENTRIES }) {
  const resolvedRoot = await custodyRoot(root);
  const address = relativeTarget(resolvedRoot, relativePath);
  await assertUnlinkedDescent(resolvedRoot, address.target);
  const measured = await resourceTree(address.target, { maxBytes, maxEntries });
  return Object.freeze({ kind: "filesystem-resource-observation/v1", resource, path: address.relative, ...measured });
}

export async function moveWorkspaceResource({ root, from, to, expectedContentDigest, resource = null, outbox }) {
  if (typeof expectedContentDigest !== "string" || !/^ni:\/\/\/sha-256;[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/u.test(expectedContentDigest)) fail("invalid-expected", "expectedContentDigest must be an RFC 6920 SHA-256 identity");
  if (typeof outbox !== "string" || outbox.length === 0) fail("invalid-outbox", "outbox path is required");
  const resolvedRoot = await custodyRoot(root);
  const source = relativeTarget(resolvedRoot, from);
  const destination = relativeTarget(resolvedRoot, to);
  if (source.target === destination.target) fail("same-path", "source and destination must differ");
  await assertUnlinkedDescent(resolvedRoot, source.target);
  await assertUnlinkedDescent(resolvedRoot, destination.target, { permitAbsentLeaf: true });
  try {
    await lstat(destination.target);
    fail("target-exists", "relocation target already exists");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const pre = await observeWorkspaceResource({ root: resolvedRoot, path: source.relative, resource });
  if (pre.contentDigest !== expectedContentDigest) fail("stale-source", "source no longer matches the admitted content identity");
  await mkdir(path.dirname(destination.target), { recursive: true });
  await assertUnlinkedDescent(resolvedRoot, path.dirname(destination.target));
  const lock = `${source.target}.filesystem-custody-move.lock`;
  let lockHandle;
  try {
    lockHandle = await open(lock, "wx", 0o600);
  } catch (error) {
    if (error?.code === "EEXIST") fail("busy", "source has an active custody move");
    throw error;
  }
  try {
    await rename(source.target, destination.target);
    let post;
    try {
      post = await observeWorkspaceResource({ root: resolvedRoot, path: destination.relative, resource });
      if (post.contentDigest !== pre.contentDigest) fail("postimage-mismatch", "relocation changed the resource content identity");
    } catch (error) {
      await rename(destination.target, source.target).catch(() => {});
      throw error;
    }
    const receiptCore = { kind: "filesystem-move-receipt/v1", resource, from: source.relative, to: destination.relative, contentDigest: pre.contentDigest, bytes: pre.bytes, entries: pre.entries, occurredAt: new Date().toISOString() };
    const receipt = Object.freeze({ ...receiptCore, id: `sha256:${digest(canonical(receiptCore))}`, outbox: path.resolve(outbox) });
    await appendReceipt(outbox, receipt);
    return receipt;
  } finally {
    await lockHandle.close();
    await rm(lock, { force: true });
  }
}

export async function readWorkspaceFile({ root, path: relativePath, maxBytes = MAX_READ_BYTES }) {
  const resolvedRoot = await custodyRoot(root);
  const target = await targetAt(resolvedRoot, relativePath);
  const stat = await lstat(target);
  if (!stat.isFile()) fail("not-file", "read target is not a regular file");
  const bound = Math.min(MAX_READ_BYTES, Number.isSafeInteger(maxBytes) && maxBytes > 0 ? maxBytes : MAX_READ_BYTES);
  if (stat.size > bound) fail("read-too-large", `read target exceeds ${bound} bytes`);
  const content = await readFile(target, "utf8");
  return Object.freeze({ kind: "filesystem-read-receipt/v1", root: resolvedRoot, path: path.relative(resolvedRoot, target).split(path.sep).join("/"), bytes: Buffer.byteLength(content), sha256: digest(content), content });
}

/**
 * Write only after exact content-address admission. The lock makes the
 * compare-and-swap explicit; host isolation remains the enforcement layer for
 * foreign processes. Every successful change has one durable outbox receipt.
 */
export async function writeWorkspaceFile({ root, path: relativePath, expectedSha256, content, outbox }) {
  if (typeof expectedSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(expectedSha256)) fail("invalid-expected", "expectedSha256 must be a SHA-256 hex digest");
  if (typeof content !== "string" || Buffer.byteLength(content, "utf8") > MAX_WRITE_BYTES) fail("write-too-large", `content must be UTF-8 and at most ${MAX_WRITE_BYTES} bytes`);
  if (typeof outbox !== "string" || outbox.length === 0) fail("invalid-outbox", "outbox path is required");
  const resolvedRoot = await custodyRoot(root);
  const target = await targetAt(resolvedRoot, relativePath);
  const resolvedOutbox = path.resolve(outbox);
  const lock = `${target}.filesystem-custody.lock`;
  let lockHandle;
  try {
    lockHandle = await open(lock, "wx", 0o600);
  } catch (error) {
    if (error?.code === "EEXIST") fail("busy", "target has an active custody write");
    throw error;
  }
  try {
    const beforeContent = await readFile(target, "utf8");
    const before = digest(beforeContent);
    if (before !== expectedSha256) fail("stale-source", "target no longer matches the admitted content identity");
    const after = digest(content);
    const relative = path.relative(resolvedRoot, target).split(path.sep).join("/");
    if (before === after) return Object.freeze({ kind: "filesystem-write-receipt/v1", changed: false, root: resolvedRoot, path: relative, before, after, bytes: Buffer.byteLength(content), outbox: resolvedOutbox });
    const temporary = path.join(path.dirname(target), `.${path.basename(target)}.${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, content, { encoding: "utf8", mode: 0o600, flush: true });
      await rename(temporary, target);
    } finally {
      await rm(temporary, { force: true });
    }
    const receiptCore = { kind: "filesystem-write-receipt/v1", changed: true, root: resolvedRoot, path: relative, before, after, bytes: Buffer.byteLength(content), occurredAt: new Date().toISOString() };
    const receipt = Object.freeze({ ...receiptCore, id: `sha256:${digest(canonical(receiptCore))}`, outbox: resolvedOutbox });
    await appendReceipt(resolvedOutbox, receipt);
    return receipt;
  } finally {
    await lockHandle.close();
    await rm(lock, { force: true });
  }
}
