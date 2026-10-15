import assert from "node:assert/strict";
import test from "node:test";
import { realizeNodeJobInstance } from "../scripts/realize-node-job-instance.mjs";

const selection = { module: "@561-group/561-group-computer-services-section/node-job-operation", export: "nodeJobSchedules" };
const output = "/gnu/store/00000000000000000000000000000000-bare-cedar-fog-deployment-1";
const sourceOf = (overrides = {}) => JSON.stringify({
  version: 1, instanceOf: "@red-cup-engineering/metroplat", identity: { id: "fixture.561.group" },
  title: "A literal {release} sentence is not a configuration reference",
  operationSources: [{ module: "@561-group/561-group-computer-services-section/node-job-operation", export: "nodeJobOperations" }],
  scheduleSources: [{ module: "@561-group/561-group-computer-services-section/node-job-operation", export: "nodeJobSchedules", configuration: {
    deployment: "fixture-host", label: "Keep {release} exactly here", jobConfiguration: {
      runtimeRoot: "{release}", artifact: "{release}", jobsDirectory: "deployments/fixture-host/deploy/jobs",
      stateRoot: "/home/operator/.local/share/561-group/releases/fixture.561.group", unitPrefix: "fixture-561-group", ...overrides,
    },
  } }],
});

test("only the two exact native job fields derive from Guix's supplied output", () => {
  const source = sourceOf(), before = JSON.parse(source);
  const result = realizeNodeJobInstance(source, output, selection);
  const expected = structuredClone(before);
  Object.assign(expected.scheduleSources[0].configuration.jobConfiguration, { runtimeRoot: output, artifact: output });
  assert.deepEqual(result.instance, expected);
  assert.deepEqual(JSON.parse(source), before);
  assert.equal(result.configurations.length, 1);
  assert.equal(result.content, `${JSON.stringify(expected, null, 2)}\n`);
  assert.equal(realizeNodeJobInstance(source, output, selection).content, result.content);
});

test("ordinary, first-cutover and rollback outputs retain their own runtime and the same authored state", () => {
  const roots = [output, output.replace("000000", "111111"), output.replace("000000", "222222")];
  const generations = roots.map(root => realizeNodeJobInstance(sourceOf(), root, selection));
  for (let index = 0; index < roots.length; index += 1) {
    const configuration = generations[index].configurations[0];
    assert.equal(configuration.runtimeRoot, roots[index]);
    assert.equal(configuration.artifact, roots[index]);
    assert.equal(configuration.stateRoot, generations[0].configurations[0].stateRoot);
  }
  // Selecting a previous immutable generation does not realize it against a newer output.
  assert.equal(generations[0].configurations[0].runtimeRoot, output);
});

test("partial, missing, previously realized and unresolved output references refuse", () => {
  for (const value of [undefined, "", "{release}/runtime", "/prefix/{release}", "${release}", "/gnu/store/previous", null]) {
    assert.throws(() => realizeNodeJobInstance(sourceOf({ runtimeRoot: value }), output, selection), /exactly/);
    assert.throws(() => realizeNodeJobInstance(sourceOf({ artifact: value }), output, selection), /exactly/);
  }
});

test("authored state, job directory and unit identity cannot be silently interpolated", () => {
  for (const patch of [{ stateRoot: "relative" }, { stateRoot: "/state/{release}" }, { stateRoot: "/state/\0" },
    { jobsDirectory: "/jobs" }, { jobsDirectory: "../jobs" }, { jobsDirectory: "a/../jobs" },
    { jobsDirectory: "jobs/{release}" }, { jobsDirectory: "jobs\\other" }, { unitPrefix: "Upper" }])
    assert.throws(() => realizeNodeJobInstance(sourceOf(patch), output, selection), /authored/);
});

test("a selected instance without native jobs or with the wrong carrier refuses", () => {
  for (const instance of [{}, { version: 2 }, { version: 1, instanceOf: "other", scheduleSources: [] },
    { version: 1, instanceOf: "@red-cup-engineering/metroplat", scheduleSources: [] }])
    assert.throws(() => realizeNodeJobInstance(JSON.stringify(instance), output, selection), /instance|configuration/);
  for (const root of ["relative", "/tmp/output", "/gnu/store/item/child", "/gnu/store/../item", "/gnu/store/a\0"])
    assert.throws(() => realizeNodeJobInstance(sourceOf(), root, selection), /Guix output/);
});

test("all selected native configurations are validated before any result is returned", () => {
  const instance = JSON.parse(sourceOf());
  instance.scheduleSources.push(structuredClone(instance.scheduleSources[0]));
  instance.scheduleSources[1].configuration.jobConfiguration.artifact = "{release}/partial";
  assert.throws(() => realizeNodeJobInstance(JSON.stringify(instance), output, selection), /exactly/);
});

test("constructor refuses redirected instance paths and invalid UTF-8 before retaining or replacing bytes", async () => {
  const fs = (await import("node:fs")).default;
  const { syncBuiltinESMExports } = await import("node:module");
  const { realizeInstalledNodeJobs } = await import("../scripts/realize-node-job-instance.mjs");
  const originalStat = fs.lstatSync, originalRead = fs.readFileSync;
  let reads = 0;
  try {
    // A bounded observation fixture, not a filesystem or Guix claim. No writer
    // port is supplied, so reaching any retention/replacement would fail.
    fs.lstatSync = path => ({ isDirectory: () => path !== `${output}/deployment/instance.json`, isFile: () => false });
    fs.readFileSync = () => { reads++; throw new Error("must refuse before read"); };
    syncBuiltinESMExports();
    await assert.rejects(realizeInstalledNodeJobs(output, "deployment/instance.json", selection), /regular file/);
    assert.equal(reads, 0);
    fs.lstatSync = path => ({ isDirectory: () => path !== `${output}/deployment/instance.json`, isFile: () => path === `${output}/deployment/instance.json` });
    fs.readFileSync = () => { reads++; return Buffer.from([0xff]); };
    syncBuiltinESMExports();
    await assert.rejects(realizeInstalledNodeJobs(output, "deployment/instance.json", selection), /encoded data|encoding/i);
    assert.equal(reads, 1);
    for (const path of ["/instance.json", "../instance.json", ".guix-systemd/instance.json", "deployment/../instance.json"])
      await assert.rejects(realizeInstalledNodeJobs(output, path, selection), /relative installed/);
    assert.equal(reads, 1);
  } finally {
    fs.lstatSync = originalStat; fs.readFileSync = originalRead; syncBuiltinESMExports();
  }
});

test("an unrelated scheduler's same-shaped jobConfiguration remains authored", () => {
  const instance = JSON.parse(sourceOf());
  const otherModule = structuredClone(instance.scheduleSources[0]);
  otherModule.module = "@red-cup-engineering/another-scheduler";
  const otherExport = structuredClone(instance.scheduleSources[0]);
  otherExport.export = "otherSchedules";
  // Even an unrelated owner's partial token is ordinary content for this pass.
  otherExport.configuration.jobConfiguration.artifact = "literal-{release}/suffix";
  instance.scheduleSources.push(otherModule, otherExport);
  const result = realizeNodeJobInstance(JSON.stringify(instance), output, selection);
  assert.equal(result.configurations.length, 1);
  assert.deepEqual(result.instance.scheduleSources.slice(1), [otherModule, otherExport]);
  assert.equal(result.instance.scheduleSources[0].configuration.jobConfiguration.artifact, output);
});

test("the explicitly selected source must exist and carry native configuration", () => {
  const instance = JSON.parse(sourceOf());
  for (const invalid of [undefined, {}, { module: "../source", export: "x" }, { module: selection.module, export: "wrong-export" }])
    assert.throws(() => realizeNodeJobInstance(JSON.stringify(instance), output, invalid), /selection/);
  assert.throws(() => realizeNodeJobInstance(JSON.stringify(instance), output, { module: selection.module, export: "absent" }), /no native/);
  delete instance.scheduleSources[0].configuration.jobConfiguration;
  assert.throws(() => realizeNodeJobInstance(JSON.stringify(instance), output, selection), /selected node-job/);
});
