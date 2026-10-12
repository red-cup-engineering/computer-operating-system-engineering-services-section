import { createHash } from "node:crypto";
import { posix } from "node:path";
import { verifyOciImageObservationRecord } from "@red-cup-engineering/oci-image-observation-service";

const DIGEST_IMAGE = /^[a-z0-9][a-z0-9._/:+-]*@sha256:[a-f0-9]{64}$/u;
const VERSION = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;
const ENGINE = /^>=(0|[1-9][0-9]*)(?:\.(0|[1-9][0-9]*))?(?:\.(0|[1-9][0-9]*))?$/u;
const SNAPSHOT = /^\d{8}T\d{6}Z$/u;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const SAFE_TOKEN = /^[a-z0-9][a-z0-9.+:~_-]*$/u;
const SAFE_VERSION_TOKEN = /^[A-Za-z0-9][A-Za-z0-9.+:~_-]*$/u;
const SAFE_COMMAND = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const ENVIRONMENT_NAME = /^[A-Z][A-Z0-9_]*$/u;
const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const CONTENT_ID = /^ni:\/\/\/sha-256;[A-Za-z0-9_-]{43}$/u;
const CORE_PYTHON_PACKAGES = Object.freeze(["ca-certificates", "python3", "python3-pip", "python3-venv"]);
const ARCHITECTURE = /^(?:amd64|arm64)$/u;
const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u;
const AUTHORITY_KEYS = Object.freeze(["ociImageObservation", "node", "debian", "python", "identity", "paths", "network", "shutdown"]);

function canonical(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  throw new TypeError("construction values must be finite JSON records");
}

function sha256(bytes) { return `sha256:${createHash("sha256").update(bytes).digest("hex")}`; }
function contentId(value) { return `ni:///sha-256;${createHash("sha256").update(canonical(value)).digest("base64url")}`; }
function plain(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function exactKeys(value, names, label) {
  if (!plain(value) || canonical(Object.keys(value).sort()) !== canonical([...names].sort())) throw new TypeError(`${label} must contain exactly ${names.join(", ")}`);
  return value;
}
function text(value, label) {
  if (typeof value !== "string" || value === "" || value.trim() !== value || /[\0\r\n]/u.test(value)) throw new TypeError(`${label} must be one exact non-empty line`);
  return value;
}
function token(value, label) {
  const result = text(value, label);
  if (!SAFE_TOKEN.test(result)) throw new TypeError(`${label} contains an unsafe or non-canonical token`);
  return result;
}
function relativePath(value, label) {
  const path = text(value, label);
  if (path.startsWith("/") || path.includes("\\") || posix.normalize(path) !== path || path === "." || path.startsWith("../") || /[^A-Za-z0-9._/-]/u.test(path)) throw new TypeError(`${label} must be one normalized safe relative POSIX path`);
  return path;
}
function absolutePath(value, label) {
  const path = text(value, label);
  if (!path.startsWith("/") || path === "/" || path.includes("\\") || posix.normalize(path) !== path || /[^A-Za-z0-9._/-]/u.test(path)) throw new TypeError(`${label} must be one normalized non-root safe absolute POSIX path`);
  return path;
}
function overlaps(left, right) { return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`); }
function dedicatedWriteRoot(path, label) {
  const protectedRoots = ["/bin", "/boot", "/dev", "/etc", "/home", "/lib", "/lib64", "/opt", "/proc", "/root", "/run", "/sbin", "/srv", "/sys", "/tmp", "/usr", "/var"];
  if (protectedRoots.includes(path)) throw new TypeError(`${label} must be one dedicated child path, not a shared system root`);
  return path;
}
function exactInteger(value, minimum, maximum, label) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new TypeError(`${label} must be an integer from ${minimum} through ${maximum}`);
  return value;
}
function freeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (plain(value)) return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, member]) => [key, freeze(member)])));
  return value;
}

function normalizeOciImageObservation(value) {
  const verified = verifyOciImageObservationRecord(value);
  if (verified.type !== "OciImageObservation" || verified.version !== 1 || verified.status !== "observed" || !Array.isArray(verified.effects) || verified.effects.length !== 0 || !CONTENT_ID.test(verified.id ?? "")) throw new TypeError("OCI image observation must be one verified effect-free singular OciImageObservation v1");
  const reference = text(verified.reference, "OCI image observation reference"), requestedDigest = text(verified.requestedDigest, "OCI requested digest");
  if (!DIGEST_IMAGE.test(reference) || !SHA256.test(requestedDigest) || !reference.endsWith(`@${requestedDigest}`)) throw new TypeError("OCI image observation must bind one immutable requested reference and digest");
  const selectedManifest = exactKeys(verified.manifest, ["digest", "mediaType", "bytes"], "OCI selected manifest");
  if (!SHA256.test(selectedManifest.digest ?? "") || !Number.isSafeInteger(selectedManifest.bytes) || selectedManifest.bytes < 1 || !["application/vnd.oci.image.manifest.v1+json", "application/vnd.docker.distribution.manifest.v2+json"].includes(selectedManifest.mediaType)) throw new TypeError("OCI image observation must bind one selected image manifest");
  let selectedIndex = null;
  if (verified.index === null) {
    if (selectedManifest.digest !== requestedDigest) throw new TypeError("direct OCI observation selected manifest must equal the requested digest");
  } else {
    selectedIndex = exactKeys(verified.index, ["digest", "mediaType", "bytes"], "OCI selected index");
    if (selectedIndex.digest !== requestedDigest || !Number.isSafeInteger(selectedIndex.bytes) || selectedIndex.bytes < 1 || !["application/vnd.oci.image.index.v1+json", "application/vnd.docker.distribution.manifest.list.v2+json"].includes(selectedIndex.mediaType)) throw new TypeError("OCI image observation index must equal the requested digest");
  }
  const selectedConfig = exactKeys(verified.config, ["mediaType", "digest", "size", "os", "architecture", "variant", "user"], "OCI selected config");
  if (!SHA256.test(selectedConfig.digest ?? "") || !Number.isSafeInteger(selectedConfig.size) || selectedConfig.size < 1 || !["application/vnd.oci.image.config.v1+json", "application/vnd.docker.container.image.v1+json"].includes(selectedConfig.mediaType)) throw new TypeError("OCI image observation must bind one selected image config");
  const platform = exactKeys(verified.platform, verified.platform?.variant === undefined ? ["os", "architecture"] : ["os", "architecture", "variant"], "OCI selected platform");
  if (platform.os !== "linux" || !ARCHITECTURE.test(platform.architecture ?? "") || selectedConfig.os !== platform.os || selectedConfig.architecture !== platform.architecture || (selectedConfig.variant ?? null) !== (platform.variant ?? null)) throw new TypeError("OCI selected manifest config and platform must agree on a supported Linux architecture");
  if (verified.node?.status !== "observed" || !VERSION.test(verified.node.version ?? "")) throw new TypeError("OCI image observation must contain an observed exact Node version");
  const suite = token(verified.debian?.suite, "observed Debian suite");
  if (verified.debian.status !== "observed") throw new TypeError("OCI image observation must contain an observed Debian suite");
  const occupied = exactKeys(verified.finalRootfs?.occupied?.union, ["uids", "gids"], "OCI occupied identity union");
  const identities = (members, label) => {
    if (!Array.isArray(members)) throw new TypeError(`${label} must be one array`);
    const result = members.map((entry) => exactInteger(entry, 0, 2_147_483_647, label));
    if (new Set(result).size !== result.length || result.some((entry, index) => index > 0 && entry <= result[index - 1])) throw new TypeError(`${label} must be sorted and unique`);
    return result;
  };
  return freeze({
    value: verified, id: verified.id, reference, requestedDigest, index: selectedIndex, manifest: selectedManifest, config: selectedConfig,
    architecture: platform.architecture, nodeVersion: verified.node.version, debianSuite: suite,
    occupied: { uids: identities(occupied.uids, "occupied UIDs"), gids: identities(occupied.gids, "occupied GIDs") },
  });
}

function normalizeAuthoritySelections(input) {
  exactKeys(input, AUTHORITY_KEYS, "construction authority input");
  const observation = normalizeOciImageObservation(input.ociImageObservation);
  const node = exactKeys(input.node, ["version", "baseImage"], "Node selection");
  const nodeVersion = text(node.version, "Node version");
  if (!VERSION.test(nodeVersion)) throw new TypeError("Node version must be one exact semantic version");
  const baseImage = text(node.baseImage, "Node base image");
  if (!DIGEST_IMAGE.test(baseImage)) throw new TypeError("Node base image must be pinned by one sha256 digest");

  const debian = exactKeys(input.debian, ["suite", "snapshot", "architecture", "packageRequests"], "Debian selection");
  const suite = token(debian.suite, "Debian suite");
  if (!ARCHITECTURE.test(debian.architecture ?? "")) throw new TypeError("Debian architecture must be amd64 or arm64");
  if (!SNAPSHOT.test(debian.snapshot ?? "")) throw new TypeError("Debian snapshot must be one UTC basic timestamp");
  if (!Array.isArray(debian.packageRequests) || debian.packageRequests.length === 0) throw new TypeError("Debian packageRequests must be one non-empty set of exact snapshot-bounded top-level requests");
  const packageRequests = debian.packageRequests.map((value) => {
    const row = exactKeys(value, ["name", "version"], "Debian package request");
    const version = text(row.version, `Debian package ${row.name} version`);
    if (!SAFE_VERSION_TOKEN.test(version)) throw new TypeError(`Debian package ${row.name} version contains an unsafe token`);
    return { name: token(row.name, "Debian package name"), version };
  }).sort((left, right) => left.name.localeCompare(right.name));
  if (new Set(packageRequests.map(({ name }) => name)).size !== packageRequests.length) throw new TypeError("Debian package request names must be unique");

  const python = exactKeys(input.python, ["version", "venv"], "CPython selection");
  const pythonVersion = text(python.version, "CPython version");
  if (!VERSION.test(pythonVersion)) throw new TypeError("CPython version must be one exact semantic version");
  const venv = absolutePath(python.venv, "Python venv path");
  const pythonArtifact = packageRequests.find(({ name }) => name === "python3")?.version;
  if (pythonArtifact === undefined || !pythonArtifact.startsWith(`${pythonVersion}-`)) throw new TypeError("CPython version must agree with the exact python3 package artifact");

  const identity = exactKeys(input.identity, ["uid", "gid"], "runtime identity");
  const uid = exactInteger(identity.uid, 1, 2_147_483_647, "runtime UID");
  const gid = exactInteger(identity.gid, 1, 2_147_483_647, "runtime GID");
  if (observation.occupied.uids.includes(uid) || observation.occupied.gids.includes(gid)) throw new TypeError("runtime UID or GID collides with an identity occupied by the observed base image");
  const paths = exactKeys(input.paths, ["app", "writable", "temporary"], "runtime paths");
  const app = absolutePath(paths.app, "application path");
  const writable = dedicatedWriteRoot(absolutePath(paths.writable, "writable path"), "writable path");
  const temporary = dedicatedWriteRoot(absolutePath(paths.temporary, "temporary path"), "temporary path");
  if ([writable, temporary].some((path) => overlaps(app, path)) || overlaps(writable, temporary)) throw new TypeError("application, writable, and temporary paths must not overlap");
  if (!venv.startsWith(`${app}/`)) throw new TypeError("Python venv must be inside the immutable application path");
  const network = exactKeys(input.network, ["port"], "network selection");
  const port = exactInteger(network.port, 1, 65_535, "listener port");
  const shutdown = exactKeys(input.shutdown, ["timeoutSeconds"], "shutdown selection");
  const timeoutSeconds = exactInteger(shutdown.timeoutSeconds, 1, 60, "shutdown timeout");
  const baseName = baseImage.slice(0, baseImage.lastIndexOf("@sha256:"));
  const tagSeparator = baseName.lastIndexOf(":");
  const tag = tagSeparator > baseName.lastIndexOf("/") ? baseName.slice(tagSeparator + 1) : "";
  if (!(tag === nodeVersion || tag.startsWith(`${nodeVersion}-`))) throw new TypeError("Node base image tag must name the selected exact Node patch");
  if (!tag.split("-").includes(suite)) throw new TypeError("Node base image tag must name the selected Debian suite");
  if (!baseImage.endsWith(`@${observation.requestedDigest}`) || observation.nodeVersion !== nodeVersion || observation.debianSuite !== suite || observation.architecture !== debian.architecture) throw new TypeError("construction selections disagree with the exact OCI image observation");
  return freeze({
    ociImageObservation: observation.value,
    baseImageSource: { observationId: observation.id, reference: observation.reference, index: observation.index, manifest: observation.manifest, config: observation.config },
    node: { version: nodeVersion, baseImage },
    debian: { suite, snapshot: debian.snapshot, architecture: debian.architecture, packageRequests },
    python: { version: pythonVersion, venv }, identity: { uid, gid }, paths: { app, writable, temporary },
    network: { port }, shutdown: { timeoutSeconds },
  });
}

export function formNodeRuntimeContainerImageConstructionAuthority(input = {}) {
  const selections = normalizeAuthoritySelections(input);
  const body = { type: "NodeRuntimeContainerImageConstructionAuthority", version: 1, status: "declared", effects: [], ...selections };
  return freeze({ id: contentId(body), ...body });
}

export function admitNodeRuntimeContainerImageConstructionAuthority(value) {
  if (!plain(value) || value.type !== "NodeRuntimeContainerImageConstructionAuthority" || value.version !== 1 || value.status !== "declared" || !Array.isArray(value.effects) || value.effects.length !== 0 || !CONTENT_ID.test(value.id ?? "")) throw new TypeError("value is not one effect-free NodeRuntimeContainerImageConstructionAuthority v1");
  const input = Object.fromEntries(AUTHORITY_KEYS.map((key) => [key, value[key]]));
  const expected = formNodeRuntimeContainerImageConstructionAuthority(input);
  if (canonical(expected) !== canonical(value)) throw new TypeError("construction authority differs from its canonical content-addressed formation");
  return expected;
}

function admitProviderRequirement(value) {
  if (!plain(value) || !/^[A-Za-z][A-Za-z0-9]*RuntimeImageRequirement$/u.test(value.type ?? "") || value.version !== 1 || value.status !== "required" || !Array.isArray(value.effects) || value.effects.length !== 0 || !CONTENT_ID.test(value.id ?? "")) throw new TypeError("provider requirement must be one effect-free content-addressed RuntimeImageRequirement v1");
  const body = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "id"));
  if (contentId(body) !== value.id) throw new TypeError("provider requirement content identity is invalid");
  const entryId = value.containerOwnerHandoff?.catalogEntry?.id;
  if (!SAFE_ID.test(entryId ?? "") || value.entry?.catalogEntryId !== entryId) throw new TypeError("provider requirement must bind one filesystem-safe released catalog entry");
  const handoff = value.containerOwnerHandoff.catalogEntry;
  if (handoff.entryPackage !== value.entry?.package?.name || handoff.entryVersion !== value.entry?.package?.version || handoff.artifactDigest !== value.entry?.runtimeReleaseCatalog?.artifactDigest || !/^[a-f0-9]{64}$/u.test(handoff.artifactDigest ?? "")) throw new TypeError("provider requirement catalog handoff differs from its admitted release entry");
  const provider = value.providerContract;
  const process = value.runtime?.process;
  if (!plain(provider) || !plain(process) || !SAFE_COMMAND.test(provider.bin ?? "") || process.command !== provider.bin) throw new TypeError("provider requirement must own one safe exact process command");
  if (!plain(provider.package) || !PACKAGE_NAME.test(provider.package.name ?? "") || !VERSION.test(provider.package.version ?? "") || provider.package.name !== value.entry?.package?.name || provider.package.version !== value.entry?.package?.version || provider.package.name !== handoff.entryPackage || provider.package.version !== handoff.entryVersion) throw new TypeError("provider contract package must equal the admitted entry and catalog handoff package identity");
  const entrypoint = relativePath(provider.entrypoint, "provider entrypoint");
  const nodeEngine = text(process.nodeEngine, "provider Node engine");
  if (provider.nodeEngine !== nodeEngine || !ENGINE.test(nodeEngine)) throw new TypeError("provider requirement must own one supported Node compatibility floor");
  const lock = provider.requirementsLock;
  if (!plain(lock) || relativePath(lock.path, "provider requirements lock") !== lock.path || !SHA256.test(lock.sha256 ?? "") || lock.installation !== "require-hashes" || process.requirementsInstallation !== "require-hashes") throw new TypeError("provider requirement must own one sha256-bound require-hashes lock");
  if (!/^[A-Za-z_][A-Za-z0-9_.]*$/u.test(process.pythonImport ?? "")) throw new TypeError("provider Python import capability is invalid");
  const environment = value.runtime?.environment;
  if (!Array.isArray(environment) || environment.some((name) => !ENVIRONMENT_NAME.test(name)) || new Set(environment).size !== environment.length) throw new TypeError("provider runtime environment names must be unique safe names");
  const listener = value.runtime?.listener;
  if (!plain(listener) || listener.count !== 1 || !ENVIRONMENT_NAME.test(listener.hostBinding ?? "") || !ENVIRONMENT_NAME.test(listener.portBinding ?? "") || !environment.includes(listener.hostBinding) || !environment.includes(listener.portBinding)) throw new TypeError("provider requirement must name one listener and its environment bindings");
  const writableBinding = value.runtime?.writableState?.binding;
  if (!ENVIRONMENT_NAME.test(writableBinding ?? "") || !environment.includes(writableBinding)) throw new TypeError("provider requirement must name its writable-state environment binding");
  const optionalBinding = (candidate, label) => {
    if (candidate === undefined) return null;
    if (!ENVIRONMENT_NAME.test(candidate) || !environment.includes(candidate)) throw new TypeError(`${label} must name one declared provider environment binding`);
    return candidate;
  };
  const pythonBinding = optionalBinding(process.pythonEnvironmentBinding, "provider Python executable binding");
  const shutdownBinding = optionalBinding(value.runtime?.shutdown?.timeoutEnvironmentBinding, "provider shutdown timeout binding");
  const constructedBindings = [listener.hostBinding, listener.portBinding, writableBinding, pythonBinding, shutdownBinding].filter((name) => name !== null);
  if (new Set(constructedBindings).size !== constructedBindings.length || constructedBindings.some((name) => ["NODE_ENV", "PYTHONDONTWRITEBYTECODE", "TMPDIR"].includes(name))) throw new TypeError("provider-derived construction environment bindings must be distinct and not reserved by the image constructor");
  const secrets = value.runtime?.secrets;
  if (!Array.isArray(secrets) || secrets.some((entry) => !plain(entry) || !ENVIRONMENT_NAME.test(entry.name ?? "") || !["environment", "read-only-file"].includes(entry.delivery))) throw new TypeError("provider secret contract must be one array of named delivery obligations");
  if (new Set(secrets.map(({ name }) => name)).size !== secrets.length) throw new TypeError("provider secret obligations must be unique");
  const evidenceAlternatives = value.runtime?.evidenceAlternatives;
  if (!Array.isArray(evidenceAlternatives) || evidenceAlternatives.some((entry) => !plain(entry))) throw new TypeError("provider evidence alternatives must be one array of records");
  const conditionalEnvironment = [], conditionalSecrets = [];
  for (const alternative of evidenceAlternatives) {
    if (!Array.isArray(alternative.environment) || alternative.environment.some((name) => !ENVIRONMENT_NAME.test(name))) throw new TypeError("provider evidence-alternative environment obligations are invalid");
    if (!Array.isArray(alternative.secrets) || alternative.secrets.some((entry) => !plain(entry) || !ENVIRONMENT_NAME.test(entry.name ?? "") || !["environment", "read-only-file"].includes(entry.delivery))) throw new TypeError("provider evidence-alternative secret obligations are invalid");
    conditionalEnvironment.push(...alternative.environment);
    conditionalSecrets.push(...alternative.secrets.map(({ name }) => name));
  }
  return freeze({
    value: structuredClone(value), entryId, entrypoint, nodeEngine, lock: { path: lock.path, sha256: lock.sha256 }, pythonImport: process.pythonImport,
    listener: { hostBinding: listener.hostBinding, portBinding: listener.portBinding }, writableBinding, pythonBinding, shutdownBinding,
    environment: [...environment].sort(), secrets: freeze(structuredClone(secrets)), evidenceAlternatives: freeze(structuredClone(evidenceAlternatives)),
    conditionalEnvironment: [...new Set(conditionalEnvironment)].sort(), conditionalSecrets: [...new Set(conditionalSecrets)].sort(),
  });
}

function satisfiesEngine(version, engine) {
  const actual = VERSION.exec(version), floor = ENGINE.exec(engine);
  const left = actual.slice(1, 4).map(Number), right = [floor[1], floor[2] ?? "0", floor[3] ?? "0"].map(Number);
  for (let index = 0; index < 3; index += 1) if (left[index] !== right[index]) return left[index] > right[index];
  return true;
}

function providerRequiredPackages(requirement) {
  const declared = requirement.value.runtime?.imageCapabilities?.aptPackages;
  if (declared !== undefined && !Array.isArray(declared)) throw new TypeError("provider apt capabilities must be one array");
  const additions = (declared ?? []).map((name) => token(name, "provider apt capability"));
  if (new Set(additions).size !== additions.length) throw new TypeError("provider apt capabilities must be unique");
  return freeze([...new Set([...CORE_PYTHON_PACKAGES, ...additions])].sort());
}

function imageEnvironment(requirement, authority) {
  return freeze({
    NODE_ENV: "production", PYTHONDONTWRITEBYTECODE: "1", TMPDIR: authority.paths.temporary,
    [requirement.listener.hostBinding]: "0.0.0.0", [requirement.listener.portBinding]: String(authority.network.port),
    [requirement.writableBinding]: authority.paths.writable,
    ...(requirement.pythonBinding === null ? {} : { [requirement.pythonBinding]: `${authority.python.venv}/bin/python3` }),
    ...(requirement.shutdownBinding === null ? {} : { [requirement.shutdownBinding]: String(authority.shutdown.timeoutSeconds * 1000) }),
  });
}

function dockerfile(requirement, authority) {
  if (!satisfiesEngine(authority.node.version, requirement.nodeEngine)) throw new TypeError(`Node ${authority.node.version} does not satisfy provider engine ${requirement.nodeEngine}`);
  const requiredPackages = providerRequiredPackages(requirement);
  const selectedNames = authority.debian.packageRequests.map(({ name }) => name);
  for (const name of requiredPackages) if (!selectedNames.includes(name)) throw new TypeError(`construction authority does not implement provider apt capability ${name}`);
  const appMount = authority.paths.app.slice(1);
  const entrypoint = `${authority.paths.app}/${requirement.entrypoint}`;
  const lock = `${authority.paths.app}/${requirement.lock.path}`;
  const apt = authority.debian.packageRequests.map(({ name, version }) => `${name}=${version}`).join(" ");
  const snapshot = authority.debian.snapshot;
  const suite = authority.debian.suite;
  const uid = String(authority.identity.uid), gid = String(authority.identity.gid);
  const timeoutMs = String(authority.shutdown.timeoutSeconds * 1000);
  const lockDigest = requirement.lock.sha256.slice("sha256:".length);
  const constructedEnvironment = imageEnvironment(requirement, authority);
  const environmentLines = Object.entries(constructedEnvironment).sort(([left], [right]) => left.localeCompare(right));
  return [
    `FROM --platform=linux/${authority.debian.architecture} ${authority.node.baseImage}`,
    "",
    "RUN rm -f /etc/apt/sources.list /etc/apt/sources.list.d/* \\",
    ` && printf '%s\\n' 'deb [check-valid-until=no] https://snapshot.debian.org/archive/debian/${snapshot} ${suite} main' 'deb [check-valid-until=no] https://snapshot.debian.org/archive/debian-security/${snapshot} ${suite}-security main' > /etc/apt/sources.list \\`,
    " && apt-get update \\",
    ` && apt-get install --yes --no-install-recommends ${apt} \\`,
    " && rm -rf /var/lib/apt/lists/*",
    `RUN install --directory --owner ${uid} --group ${gid} --mode 0700 ${authority.paths.writable} ${authority.paths.temporary}`,
    `COPY ${appMount}/ ${authority.paths.app}/`,
    `RUN printf '%s  %s\\n' ${lockDigest} ${lock} | sha256sum --check --strict - \\`,
    ` && python3 -m venv ${authority.python.venv} \\`,
    ` && ${authority.python.venv}/bin/python3 -m pip install --no-cache-dir --require-hashes --requirement ${lock} \\`,
    ` && ${authority.python.venv}/bin/python3 -c 'import ${requirement.pythonImport}' \\`,
    ` && chmod -R a-w ${authority.paths.app}`,
    ...environmentLines.map(([name, value], index) => `${index === 0 ? "ENV " : "    "}${name}=${value}${index === environmentLines.length - 1 ? "" : " \\"}`),
    "STOPSIGNAL SIGTERM",
    `USER ${uid}:${gid}`,
    `WORKDIR ${authority.paths.app}`,
    `EXPOSE ${authority.network.port}`,
    `ENTRYPOINT ["node",${JSON.stringify(entrypoint)}]`,
    "",
  ].join("\n");
}

export function formNodeRuntimeContainerImageBuildCarrierSet({ providerRequirement, authority } = {}) {
  const requirement = admitProviderRequirement(providerRequirement);
  const admittedAuthority = admitNodeRuntimeContainerImageConstructionAuthority(authority);
  const source = dockerfile(requirement, admittedAuthority);
  const pythonExecutable = `${admittedAuthority.python.venv}/bin/python3`;
  const environment = imageEnvironment(requirement, admittedAuthority);
  const unresolvedExternalEnvironment = requirement.environment.filter((name) => !Object.hasOwn(environment, name));
  const unresolvedConditionalEnvironment = requirement.conditionalEnvironment.filter((name) => !Object.hasOwn(environment, name));
  const unresolvedSecretBindings = requirement.secrets.map(({ name }) => name).sort();
  const carrier = freeze({ path: "Dockerfile", mode: 0o644, bytes: Buffer.byteLength(source), sha256: sha256(source), utf8: source });
  const body = {
    type: "NodeRuntimeContainerImageBuildCarrierSet", version: 1, status: "formed", effects: [], identityScope: "regular-file-path-utf8-bytes-mode",
    providerRequirement: freeze({ id: providerRequirement.id, type: providerRequirement.type, catalogEntryId: requirement.entryId }),
    authority: freeze({ id: admittedAuthority.id }),
    layoutPolicy: freeze({ type: "NodeRuntimeContainerImageLayoutPolicy", version: 1, entries: [{ id: requirement.entryId, mount: admittedAuthority.paths.app.slice(1) }] }),
    runtimeProjection: freeze({
      process: { argv: ["node", `${admittedAuthority.paths.app}/${requirement.entrypoint}`], pythonExecutable, pythonEnvironmentBinding: requirement.pythonBinding },
      environment: { image: environment, providerDeclared: requirement.environment, unresolvedExternal: unresolvedExternalEnvironment },
      secrets: requirement.secrets,
      evidenceAlternatives: requirement.evidenceAlternatives,
      identity: { uid: admittedAuthority.identity.uid, gid: admittedAuthority.identity.gid },
      workdir: admittedAuthority.paths.app,
      stopSignal: "SIGTERM",
      filesystem: {
        application: { path: admittedAuthority.paths.app, owner: { uid: 0, gid: 0 }, runtimeWritable: false },
        venv: { path: admittedAuthority.python.venv, owner: { uid: 0, gid: 0 }, runtimeWritable: false },
        writable: { path: admittedAuthority.paths.writable, owner: { uid: admittedAuthority.identity.uid, gid: admittedAuthority.identity.gid }, mode: 0o700, runtimeWritable: true },
        temporary: { path: admittedAuthority.paths.temporary, owner: { uid: admittedAuthority.identity.uid, gid: admittedAuthority.identity.gid }, mode: 0o700, runtimeWritable: true },
      },
      listener: { host: "0.0.0.0", port: admittedAuthority.network.port },
      shutdown: { timeoutSeconds: admittedAuthority.shutdown.timeoutSeconds, timeoutEnvironmentBinding: requirement.shutdownBinding },
      unresolvedBindings: {
        environment: unresolvedExternalEnvironment,
        secrets: unresolvedSecretBindings,
        conditionalEnvironment: unresolvedConditionalEnvironment,
        conditionalSecrets: requirement.conditionalSecrets,
        semantics: [
        ...(requirement.pythonBinding === null ? ["python-executable-environment-binding"] : []),
        ...(requirement.shutdownBinding === null ? ["shutdown-timeout-environment-binding"] : []),
        ],
      },
    }),
    carriers: freeze([carrier]),
    staticCarriers: freeze([{ path: carrier.path, mode: carrier.mode, utf8: carrier.utf8 }]),
  };
  return freeze({ id: contentId(body), ...body });
}

export function admitNodeRuntimeContainerImageBuildCarrierSet(value, { providerRequirement, authority } = {}) {
  if (!plain(value) || value.type !== "NodeRuntimeContainerImageBuildCarrierSet" || value.version !== 1 || value.status !== "formed" || !CONTENT_ID.test(value.id ?? "")) throw new TypeError("value is not one NodeRuntimeContainerImageBuildCarrierSet v1");
  const expected = formNodeRuntimeContainerImageBuildCarrierSet({ providerRequirement, authority });
  if (canonical(expected) !== canonical(value)) throw new TypeError("build carrier set differs from deterministic construction");
  return expected;
}
