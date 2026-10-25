#!/usr/bin/env node
// observe-source-drift <node_modules> [--registry URL] [--stale-days N] [--json]
// Reads what a deployment runs against the house registry and its repositories' default branches.
import { observeSourceDrift } from "../src/source-drift.mjs";

const args = process.argv.slice(2);
const option = (name) => { const at = args.indexOf(`--${name}`); return at === -1 ? undefined : args[at + 1]; };
const nodeModules = args.find((arg, index) => !arg.startsWith("--") && !["--registry", "--stale-days"].includes(args[index - 1]));
if (nodeModules === undefined) {
  process.stderr.write("usage: observe-source-drift <node_modules> [--registry URL] [--stale-days N] [--json]\n");
  process.exit(2);
}
const observation = await observeSourceDrift({
  nodeModules,
  ...(option("registry") === undefined ? {} : { registry: option("registry") }),
  ...(option("stale-days") === undefined ? {} : { stalePullRequestDays: Number(option("stale-days")) }),
});
if (args.includes("--json")) {
  process.stdout.write(`${JSON.stringify(observation, null, 2)}\n`);
} else {
  process.stdout.write(`${observation.observedAt}: ${observation.packages} house packages (${observation.installs} installs) in ${nodeModules}\n`);
  for (const [kind, count] of Object.entries(observation.counts).sort()) process.stdout.write(`  ${kind}: ${count}\n`);
  for (const finding of observation.findings.filter((item) => item.kind !== "source-unread")) {
    const { kind, ...rest } = finding;
    process.stdout.write(`${kind}\t${JSON.stringify(rest)}\n`);
  }
}
