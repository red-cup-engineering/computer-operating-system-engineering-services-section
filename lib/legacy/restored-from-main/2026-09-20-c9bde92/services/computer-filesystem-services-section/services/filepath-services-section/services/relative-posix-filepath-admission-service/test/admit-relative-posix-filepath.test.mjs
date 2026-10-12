import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { admitRelativePosixFilepath } from "../scripts/admit-relative-posix-filepath.mjs";

test("admits normalized paths beneath an unnamed root", () => {
  assert.equal(admitRelativePosixFilepath("scripts/example.mjs"), "scripts/example.mjs");
  assert.equal(admitRelativePosixFilepath("package.json"), "package.json");
});

test("refuses empty, absolute, traversing, noncanonical, and non-POSIX paths", () => {
  for (const value of ["", ".", "..", "../x", "/x", "x/../y", "x//y", "x\\y", "x\0y"]) {
    assert.throws(() => admitRelativePosixFilepath(value), TypeError, value);
  }
});

test("the command face maps JSON string lines to admitted JSON string lines", () => {
  const command = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/admit-relative-posix-filepath.mjs", import.meta.url))], {
    input: "\"scripts/example.mjs\"\n\"package.json\"\n",
    encoding: "utf8",
  });
  assert.equal(command.status, 0, command.stderr);
  assert.deepEqual(command.stdout.trim().split("\n").map(JSON.parse), ["scripts/example.mjs", "package.json"]);
});
