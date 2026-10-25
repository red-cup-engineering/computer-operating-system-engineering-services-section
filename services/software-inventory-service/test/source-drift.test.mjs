import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classifySourceDrift, compareVersions, githubRepositoryOf, observeSourceDrift, readDeployedPackages } from "../src/source-drift.mjs";

test("versions compare by semantic precedence, prerelease counters numerically", () => {
  assert.equal(compareVersions("0.21.9-dev.993", "0.21.9-dev.973"), 1);
  assert.equal(compareVersions("0.21.9-dev.99", "0.21.9-dev.100"), -1);
  assert.equal(compareVersions("0.21.9", "0.21.9-dev.993"), 1);
  assert.equal(compareVersions("0.3.2", "0.3.2"), 0);
  assert.equal(compareVersions("0.10.0", "0.9.9"), 1);
});

test("a repository is read from its package.json url and directory", () => {
  assert.deepEqual(githubRepositoryOf({ url: "git+https://github.com/red-cup-engineering/feltos.git" }), { owner: "red-cup-engineering", name: "feltos", directory: "" });
  assert.deepEqual(githubRepositoryOf({ url: "https://github.com/o/r", directory: "./apps/metroplat/" }), { owner: "o", name: "r", directory: "apps/metroplat" });
  assert.equal(githubRepositoryOf({ url: "https://example.com/x" }), undefined);
});

const NOW = "2026-10-24T12:00:00Z";
const pkg = (name, version, repo = "o/r", directory = "") => ({ name, version, repository: { owner: repo.split("/")[0], name: repo.split("/")[1], directory } });

test("each kind of drift is named, and a package in sync has no finding", () => {
  const reading = classifySourceDrift({
    now: NOW,
    deployed: [
      pkg("@x/in-sync", "1.0.0", "o/sync"),
      pkg("@x/ahead", "0.21.9-dev.993", "o/ahead"),
      pkg("@x/behind", "1.0.0", "o/behind"),
      pkg("@x/unreleased", "1.0.0", "o/unreleased"),
      pkg("@x/twice", "1.0.0", "o/twice"), pkg("@x/twice", "1.1.0", "o/twice"),
      { name: "@x/nowhere", version: "1.0.0", repository: undefined },
    ],
    registry: new Map([["@x/in-sync", { latest: "1.0.0", gitHeads: { "1.0.0": "s1" } }], ["@x/ahead", { latest: "0.21.9-dev.993", gitHeads: { "0.21.9-dev.993": "a1" } }],
      ["@x/behind", { latest: "1.2.0", gitHeads: { "1.0.0": "b1" } }], ["@x/unreleased", { latest: "1.0.0", gitHeads: { "1.0.0": "u1" } }],
      ["@x/twice", { latest: "1.1.0", gitHeads: { "1.1.0": "t1" } }], ["@x/nowhere", { latest: "1.0.0" }]]),
    sources: new Map([
      // A branch declaring an older prerelease than it published is not drift: the commit decides.
      ["o/sync", { versions: { "": "0.9.0" }, onMain: { s1: true }, pullRequests: [{ number: 1, createdAt: "2026-10-23T00:00:00Z", title: "fresh" }] }],
      ["o/ahead", { versions: { "": "0.21.9-dev.973" }, onMain: { a1: false }, pullRequests: [] }],
      ["o/behind", { versions: { "": "1.2.0" }, onMain: { b1: true }, pullRequests: [] }],
      ["o/unreleased", { versions: { "": "1.1.0" }, onMain: { u1: true }, pullRequests: [{ number: 7, createdAt: "2026-10-01T00:00:00Z", title: "old" }] }],
      ["o/twice", { versions: { "": "1.1.0" }, onMain: { t1: true }, pullRequests: [] }],
    ]),
  });
  const kinds = (name) => reading.findings.filter((finding) => finding.package === name || finding.repository === `o/${name}`).map((finding) => finding.kind).sort();
  assert.deepEqual(kinds("@x/in-sync"), []);
  assert.deepEqual(kinds("sync"), []);
  assert.deepEqual(kinds("@x/ahead"), ["deployed-not-on-main"]);
  assert.deepEqual(kinds("@x/behind"), ["released-not-deployed"]);
  assert.deepEqual(kinds("@x/unreleased").filter((kind) => kind !== "stale-pull-requests"), ["merged-not-released"]);
  assert.deepEqual(reading.findings.find((finding) => finding.kind === "stale-pull-requests"), { kind: "stale-pull-requests", repository: "o/unreleased", open: 1, stale: 1, oldest: [{ number: 7, createdAt: "2026-10-01T00:00:00Z", title: "old" }] });
  assert.deepEqual(kinds("@x/twice"), ["duplicate-versions"]);
  assert.deepEqual(kinds("@x/nowhere"), ["source-unread"]);
  assert.equal(reading.packages, 6);
  assert.equal(reading.installs, 7);
});

test("an unread registry or branch is unknown, never in sync", () => {
  const reading = classifySourceDrift({ now: NOW, deployed: [pkg("@x/a", "1.0.0")], registry: new Map(), sources: new Map() });
  assert.deepEqual(reading.findings.map((finding) => [finding.kind, finding.unread]), [["source-unread", "registry"], ["source-unread", "default-branch"]]);
  const uncompared = classifySourceDrift({ now: NOW, deployed: [pkg("@x/a", "1.0.0")], registry: new Map([["@x/a", { latest: "1.0.0", gitHeads: { "1.0.0": "c" } }]]),
    sources: new Map([["o/r", { versions: { "": "1.0.0" }, pullRequests: [] }]]) });
  assert.deepEqual(uncompared.findings.map((finding) => [finding.kind, finding.unread]), [["source-unread", "commit-ancestry"]]);
});

test("a pnpm node_modules is read for its house packages and their repositories", async () => {
  const root = mkdtempSync(join(tmpdir(), "source-drift-"));
  try {
    const install = (entry, scope, name, manifest) => {
      const dir = join(root, ".pnpm", entry, "node_modules", scope, name);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "package.json"), JSON.stringify(manifest));
    };
    install("@red-cup-engineering+feltos@0.21.9-dev.993_abc", "@red-cup-engineering", "feltos", { name: "@red-cup-engineering/feltos", version: "0.21.9-dev.993", repository: { url: "git+https://github.com/red-cup-engineering/feltos.git" } });
    install("left-pad@1.3.0", "", "left-pad", { name: "left-pad", version: "1.3.0" });
    const deployed = readDeployedPackages(root);
    assert.deepEqual(deployed, [{ name: "@red-cup-engineering/feltos", version: "0.21.9-dev.993", repository: { owner: "red-cup-engineering", name: "feltos", directory: "" } }]);
    const asked = [];
    const observation = await observeSourceDrift({ nodeModules: root, now: NOW,
      readRegistry: async () => new Map([["@red-cup-engineering/feltos", { latest: "0.21.9-dev.993", gitHeads: { "0.21.9-dev.993": "74e102f9" } }]]),
      readSources: async () => new Map([["red-cup-engineering/feltos", { versions: { "": "0.21.9-dev.973" }, pullRequests: [] }]]),
      readOnMain: async (commits) => { asked.push(...[...commits].map(([key, set]) => [key, [...set]])); return new Map([["red-cup-engineering/feltos", { "74e102f9": true }]]); } });
    assert.equal(observation.kind, "source-drift-observation");
    assert.deepEqual(asked, [["red-cup-engineering/feltos", ["74e102f9"]]]);
    assert.deepEqual(observation.counts, {});
  } finally { rmSync(root, { recursive: true, force: true }); }
});
