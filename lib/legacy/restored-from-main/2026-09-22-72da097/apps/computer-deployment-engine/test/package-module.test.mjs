import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { admitPackageModule } from "@red-cup-engineering/jsnode-engine/package-module";

const declaration = JSON.parse(await readFile(new URL("../jsnode.module.json", import.meta.url), "utf8"));

test("computer-deployment-engine (LAGOON) publishes its model and Guile scripts as one admitted JSNode package module", () => {
  const module = admitPackageModule(declaration);
  assert.equal(module.package.name, "@red-cup-engineering/computer-deployment-engine");
  assert.equal(module.behaviors.length, 4);
  assert.deepEqual(module.behaviors.map(({ path }) => path).sort(), [
    "scripts/eavt-worker.mjs",
    "scripts/look.scm",
    "scripts/run-node-worker-tests.scm",
    "scripts/verify.scm",
  ]);
  assert.match(module.receipt.contentIdentity, /^ni:\/\/\/sha-256;[A-Za-z0-9_-]{43}$/u);
});
