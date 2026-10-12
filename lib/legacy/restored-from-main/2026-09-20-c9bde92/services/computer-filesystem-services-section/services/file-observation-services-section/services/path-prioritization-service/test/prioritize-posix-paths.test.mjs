import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { join } from "node:path";
import test from "node:test";
import { prioritizePosixPaths } from "../src/prioritize-posix-paths.mjs";

test("orders declared priority groups before unprioritized paths, lexically within each group", () => {
  const result = prioritizePosixPaths({
    paths: ["z.txt", "data/records/z.json", "content/z.md", "data/records/a.json", "content/a.md", "a.txt"],
    priorityPaths: ["content", "data/records"],
  });
  assert.deepEqual(result, ["content/a.md", "content/z.md", "data/records/a.json", "data/records/z.json", "a.txt", "z.txt"]);
  assert.ok(Object.isFrozen(result));
});

test("matches priority paths only at POSIX segment boundaries and preserves duplicate values", () => {
  const result = prioritizePosixPaths({
    paths: ["contents/a.md", "content", "content/a.md", "content/a.md", "contentment/a.md"],
    priorityPaths: ["content"],
  });
  assert.deepEqual(result, ["content", "content/a.md", "content/a.md", "contentment/a.md", "contents/a.md"]);
});

test("rejects malformed path values and redundant priority policy", () => {
  assert.throws(() => prioritizePosixPaths({ paths: ["/absolute"] }), /root-relative POSIX/u);
  assert.throws(() => prioritizePosixPaths({ paths: ["a\\b"] }), /normalized/u);
  assert.throws(() => prioritizePosixPaths({ paths: ["a/../b"] }), /normalized/u);
  assert.throws(() => prioritizePosixPaths({ paths: ["a"], priorityPaths: ["content", "content/docs"] }), /descendant/u);
  assert.throws(() => prioritizePosixPaths({ paths: ["a"], priorityPaths: ["content", "content"] }), /repeat/u);
});

test("CLI reads one JSON request from stdin and emits its JSON result", async () => {
  const script = join(import.meta.dirname, "..", "scripts", "prioritize-posix-paths.mjs");
  const process = spawn("node", [script]);
  let stdout = "";
  let stderr = "";
  process.stdout.on("data", (chunk) => { stdout += chunk; });
  process.stderr.on("data", (chunk) => { stderr += chunk; });
  process.stdin.end(JSON.stringify({
    paths: ["z", "content/z", "content/a"],
    priorityPaths: ["content"],
  }));
  const [code] = await once(process, "close");
  assert.equal(code, 0, stderr);
  assert.deepEqual(JSON.parse(stdout), ["content/a", "content/z", "z"]);
});
