/** LAGOON realizes the explicitly selected instance inside its own Guix output. */
import { lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readInstanceDefinition } from "@red-cup-engineering/metroplat/instance";
import { parseJsonValue } from "@red-cup-engineering/json-services-section/parse-json-value";
import { parseJsonPointer, resolveJsonPointer } from "@red-cup-engineering/json-services-section/resolve-json-pointer";
import { admitModuleParameterizationSources, readModuleParameterizations } from "@red-cup-engineering/javascript-node-services-section/module-closure";

const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const relativePath = value => typeof value === "string" && value.length > 0
  && !value.includes("\\") && !value.includes("\0") && !isAbsolute(value)
  && value.split("/").every(part => part !== "" && part !== "." && part !== "..");
const outputPath = value => typeof value === "string" && /^\/gnu\/store\/[^/\0]+$/u.test(value)
  && resolve(value) === value;
const token = "{release}";


/** Pure derivation of the complete, explicitly bound deployment set. */
export function realizeNodeJobInstance(source, output, selection) {
  if (typeof source !== "string" || !outputPath(output)) throw new TypeError("node-job realization requires source JSON and the actual top-level Guix output");
  if (!object(selection) || typeof selection.module !== "string"
    || !/^@[^/]+\/[^/]+(?:\/[A-Za-z0-9._-]+)*$/u.test(selection.module)
    || typeof selection.export !== "string" || !/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(selection.export)
    || typeof selection.deploymentRecordsPointer !== "string"
    || !selection.deploymentRecordsPointer.startsWith("/parameterData/")
    || selection.deploymentRecordsPointer.length > 2048)
    throw new TypeError("node-job realization requires its explicit schedule selection and parameterData pointer");
  const instance = parseJsonValue(source);
  if (!object(instance) || instance.version !== 1 || instance.instanceOf !== "@red-cup-engineering/metroplat")
    throw new TypeError("node-job realization requires a MetroPlat instance");
  const pointer = selection.deploymentRecordsPointer;
  parseJsonPointer(pointer, { allowFragment: false });
  admitModuleParameterizationSources(instance.operationSources ?? []);
  admitModuleParameterizationSources(instance.scheduleSources ?? []);
  const selected = resolveJsonPointer(instance, pointer);
  if (!object(selected) || typeof selected.law !== "string" || !selected.law.trim()
    || !Array.isArray(selected.deploymentRecords) || selected.deploymentRecords.length < 1
    || selected.deploymentRecords.length > 100)
    throw new TypeError("node-job realization needs bounded authored deployment records and their law");
  const seen = new Set();
  for (const record of selected.deploymentRecords) {
    if (!object(record) || typeof record.deployment !== "string"
      || !/^[a-z0-9][a-z0-9-]*$/u.test(record.deployment) || seen.has(record.deployment)
      || typeof record.host !== "string" || !record.host.trim()
      || !Array.isArray(record.scope) || record.scope.length > 64
      || new Set(record.scope).size !== record.scope.length
      || record.scope.some(term => typeof term !== "string" || !term.trim() || term.length > 2048))
      throw new TypeError("node-job realization needs distinct authored deployments, hosts and scope terms");
    seen.add(record.deployment);
    const configuration = record.jobConfiguration;
    if (!object(configuration) || configuration.runtimeRoot !== token || configuration.artifact !== token)
      throw new TypeError("each native runtimeRoot and artifact must be exactly {release}");
    if (!relativePath(configuration.jobsDirectory) || configuration.jobsDirectory.includes(token)
      || typeof configuration.stateRoot !== "string" || !isAbsolute(configuration.stateRoot)
      || configuration.stateRoot.includes(token) || configuration.stateRoot.includes("\0")
      || typeof configuration.unitPrefix !== "string" || !/^[a-z0-9][a-z0-9-]*$/u.test(configuration.unitPrefix))
      throw new TypeError("native job records require authored relative jobs, absolute state and unit identity");
  }
  for (const record of selected.deploymentRecords) {
    record.jobConfiguration.runtimeRoot = output;
    record.jobConfiguration.artifact = output;
  }
  return { instance, configurations: selected.deploymentRecords.map(record => record.jobConfiguration) };
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

  const declaration = await readInstanceDefinition(file, {
    readFile: (candidate, encoding) => {
      const path = relative(output, candidate);
      if (!relativePath(path)) throw new TypeError("node-job profile must stay within the Guix output");
      return candidate === file ? (encoding === undefined ? sourceBytes : sourceBytes.toString(encoding))
        : readFileSync(regularPath(output, path), encoding);
    },
  });
  const authored = parseJsonValue(source);
  const pointer = selection.deploymentRecordsPointer;
  const rawValue = resolveJsonPointer(authored, pointer);
  if (rawValue === undefined || JSON.stringify(rawValue) !== JSON.stringify(resolveJsonPointer(declaration, pointer)))
    throw new TypeError("selected node-job parameter data must be authored by the raw host instance");
  const result = realizeNodeJobInstance(JSON.stringify(declaration), output, selection);
  const raw = [...(declaration.operationSources ?? []), ...(declaration.scheduleSources ?? [])];
  const resolved = await readModuleParameterizations(raw, {
    moduleBasePath: join(output, "package.json"), sourceDocument: result.instance,
    readFile: file => readFileSync(file),
  });
  const value = resolveJsonPointer(result.instance, pointer);
  const sharedBinding = index => Object.values(raw[index].parameters ?? {}).some(
    reference => reference?.instancePointer === pointer);
  const sameConfiguration = entry => JSON.stringify(entry.configuration) === JSON.stringify(value);
  const operationCount = (declaration.operationSources ?? []).length;
  const operations = resolved.filter((entry, index) => index < operationCount
    && entry.module === selection.module && entry.export === "nodeJobOperations"
    && sharedBinding(index) && sameConfiguration(entry));
  const schedules = resolved.filter((entry, index) => index >= operationCount
    && entry.module === selection.module && entry.export === selection.export
    && sharedBinding(index) && sameConfiguration(entry));
  if (operations.length !== 1 || schedules.length !== 1)
    throw new TypeError("node-job operation and schedule must each bind the same authored deployment-record pointer");
  result.content = `${JSON.stringify({ ...authored, parameterData: result.instance.parameterData }, null, 2)}\n`;

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
  if (process.argv.length !== 7) throw new TypeError("usage: realize-node-job-instance.mjs GUIX-OUTPUT INSTANCE-PATH MODULE EXPORT DEPLOYMENT-RECORDS-POINTER");
  await realizeInstalledNodeJobs(process.argv[2], process.argv[3], { module: process.argv[4], export: process.argv[5], deploymentRecordsPointer: process.argv[6] });
}
