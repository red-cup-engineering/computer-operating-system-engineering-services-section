/** LAGOON realizes the explicitly selected instance inside its own Guix output. */
import { lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const relativePath = value => typeof value === "string" && value.length > 0
  && !value.includes("\\") && !value.includes("\0") && !isAbsolute(value)
  && value.split("/").every(part => part !== "" && part !== "." && part !== "..");
const outputPath = value => typeof value === "string" && /^\/gnu\/store\/[^/\0]+$/u.test(value)
  && resolve(value) === value;
const token = "{release}";

/** Pure derivation. Only the two complete, typed output references are realized. */
export function realizeNodeJobInstance(source, output, selection) {
  if (typeof source !== "string" || !outputPath(output)) throw new TypeError("node-job realization requires source JSON and the actual top-level Guix output");
  if (!object(selection) || typeof selection.module !== "string"
    || !/^@[^/]+\/[^/]+(?:\/[A-Za-z0-9._-]+)*$/u.test(selection.module)
    || typeof selection.export !== "string" || !/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(selection.export))
    throw new TypeError("node-job realization requires one explicit schedule module/export selection");
  const instance = JSON.parse(source);
  if (!object(instance) || instance.version !== 1 || instance.instanceOf !== "@red-cup-engineering/metroplat"
    || !Array.isArray(instance.scheduleSources)) throw new TypeError("node-job realization requires a MetroPlat instance with schedule sources");
  const configurations = [];
  for (const entry of instance.scheduleSources) {
    if (!object(entry) || entry.module !== selection.module || entry.export !== selection.export) continue;
    if (!object(entry.configuration) || !Object.hasOwn(entry.configuration, "jobConfiguration"))
      throw new TypeError("selected node-job schedule source must declare its native job configuration");
    const configuration = entry.configuration.jobConfiguration;
    if (!object(configuration) || configuration.runtimeRoot !== token || configuration.artifact !== token)
      throw new TypeError("native job runtimeRoot and artifact must each be exactly {release}");
    if (!relativePath(configuration.jobsDirectory) || configuration.jobsDirectory.includes(token)
      || typeof configuration.stateRoot !== "string" || !isAbsolute(configuration.stateRoot)
      || configuration.stateRoot.includes(token) || configuration.stateRoot.includes("\0")
      || typeof configuration.unitPrefix !== "string" || !/^[a-z0-9][a-z0-9-]*$/u.test(configuration.unitPrefix))
      throw new TypeError("native job declarations require authored relative jobs, absolute state and unit identity");
    configuration.runtimeRoot = output;
    configuration.artifact = output;
    configurations.push(configuration);
  }
  if (configurations.length === 0) throw new TypeError("selected instance declares no native job configuration");
  return { instance, configurations, content: `${JSON.stringify(instance, null, 2)}\n` };
}

function regularPath(root, path) {
  let current = root;
  if (!lstatSync(current).isDirectory()) throw new TypeError("Guix output must be a directory");
  const parts = path.split("/");
  for (let index = 0; index < parts.length; index += 1) {
    current = join(current, parts[index]);
    const stat = lstatSync(current);
    if (index === parts.length - 1 ? !stat.isFile() : !stat.isDirectory())
      throw new TypeError("selected instance must be a regular file under real output directories");
  }
  return current;
}

/** Constructor-only file realization; no service, job, network or state write occurs. */
export async function realizeInstalledNodeJobs(output, instancePath, selection) {
  if (!outputPath(output) || !relativePath(instancePath) || instancePath.startsWith(".guix-systemd/"))
    throw new TypeError("node-job realization requires a relative installed instance path");
  const file = regularPath(output, instancePath);
  const sourceBytes = readFileSync(file);
  const source = new TextDecoder("utf-8", { fatal: true }).decode(sourceBytes);
  const result = realizeNodeJobInstance(source, output, selection);
  // Use the same public provider that the installed job factories consume.
  // Its declaration reader is pure: construction does not execute any job.
  const require = createRequire(join(output, "package.json"));
  const { nodeJobsAt } = await import(pathToFileURL(require.resolve("@red-cup-engineering/node-job-service")).href);
  for (const configuration of result.configurations) nodeJobsAt(configuration);
  const custodyRoot = join(output, ".guix-systemd");
  if (!lstatSync(custodyRoot).isDirectory()) throw new TypeError("reserved deployment directory must be a real directory");
  const sourceRoot = join(custodyRoot, "source-declarations");
  mkdirSync(sourceRoot); // One explicit instance per output; never overwrite retained bytes.
  const retained = join(sourceRoot, instancePath);
  mkdirSync(dirname(retained), { recursive: true });
  writeFileSync(retained, sourceBytes, { flag: "wx", mode: 0o444 });
  const temporary = `${file}.lagoon-realized`;
  writeFileSync(temporary, result.content, { flag: "wx", mode: 0o444 });
  renameSync(temporary, file);
  return { instancePath, sourcePath: `.guix-systemd/source-declarations/${instancePath}`, configurations: result.configurations.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 6) throw new TypeError("usage: realize-node-job-instance.mjs GUIX-OUTPUT INSTANCE-PATH MODULE EXPORT");
  await realizeInstalledNodeJobs(process.argv[2], process.argv[3], { module: process.argv[4], export: process.argv[5] });
}
