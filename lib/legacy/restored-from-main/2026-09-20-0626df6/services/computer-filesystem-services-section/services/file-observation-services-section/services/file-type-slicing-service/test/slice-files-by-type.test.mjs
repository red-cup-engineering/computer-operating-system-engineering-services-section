import assert from "node:assert/strict";
import test from "node:test";
import { sliceFilesByType } from "../scripts/slice-files-by-type.mjs";

test("slices already-observed files by normalized extension", () => {
  const slice = sliceFilesByType({ files: [
    { path: "README.md", kind: "file", bytes: 5 },
    { path: "src/a.MJS", kind: "file", bytes: 3 },
    { path: "src/b.mjs", kind: "file", bytes: 4 },
    { path: "LICENSE", kind: "file", bytes: 2 },
  ] });
  assert.deepEqual(slice.slices.mjs, { count: 2, bytes: 7, paths: ["src/a.MJS", "src/b.mjs"] });
  assert.deepEqual(slice.total, { count: 4, bytes: 14 });
  assert.ok(Object.isFrozen(slice.slices.mjs.paths));
});

test("validates the observed carrier shape", () => {
  assert.throws(() => sliceFilesByType({}), /array/u);
  assert.throws(() => sliceFilesByType({ files: [{ path: "a.txt" }] }), /numeric bytes/u);
});
