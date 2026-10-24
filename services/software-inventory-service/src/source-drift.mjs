/**
 * Source drift: what a deployment runs, read against where its packages come from. Each house package
 * installed in a deployment's node_modules is compared with the house registry's latest release, the
 * version its repository's default branch declares, and the repository's open pull requests:
 *
 *   deployed-not-on-main   the deployment runs a version newer than its default branch declares (it was
 *                          released from source that is not on the branch)
 *   released-not-deployed  the registry holds a newer release than the deployment runs
 *   merged-not-released    the default branch declares a version newer than the registry's latest
 *   duplicate-versions     the deployment installs more than one version of the package
 *   stale-pull-requests    the package's repository holds open pull requests older than the threshold
 *   source-unread          the registry or repository could not be read: unknown, never "in sync"
 *
 * The classification is a pure function of the readings (`classifySourceDrift`); reading them is
 * `observeSourceDrift`, with the registry read over HTTP and GitHub through the `gh` CLI, so no
 * credential passes through this module.
 */
import { execFile } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
export const HOUSE_SCOPES = Object.freeze(["@red-cup-engineering", "@561-group", "@causeway-services", "@coesite-operations", "@lenticule-science"]);
export const STALE_PULL_REQUEST_DAYS = 3;
const GITHUB_BATCH = 20;

/** -1, 0 or 1 by semantic version precedence; prerelease identifiers compare numerically when numeric. */
export function compareVersions(left, right) {
  const parse = (version) => {
    const [core, pre] = String(version).split("+")[0].split(/-(.*)/su);
    return { core: core.split(".").map(Number), pre: pre === undefined ? [] : pre.split(".") };
  };
  const a = parse(left), b = parse(right);
  for (let i = 0; i < 3; i += 1) if ((a.core[i] ?? 0) !== (b.core[i] ?? 0)) return (a.core[i] ?? 0) < (b.core[i] ?? 0) ? -1 : 1;
  if (a.pre.length === 0 || b.pre.length === 0) return a.pre.length === b.pre.length ? 0 : a.pre.length === 0 ? 1 : -1;
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i += 1) {
    const x = a.pre[i], y = b.pre[i];
    if (x === undefined || y === undefined) return x === undefined ? -1 : 1;
    if (x === y) continue;
    const nx = /^\d+$/u.test(x), ny = /^\d+$/u.test(y);
    if (nx && ny) return Number(x) < Number(y) ? -1 : 1;
    if (nx !== ny) return nx ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return 0;
}
const newest = (versions) => [...versions].sort(compareVersions).at(-1);

/** The GitHub owner, name and package directory a package.json `repository` names, or undefined. */
export function githubRepositoryOf(repository) {
  const url = typeof repository === "string" ? repository : repository?.url;
  const found = /github\.com[/:]([^/]+)\/([^/#]+?)(?:\.git)?(?:#.*)?$/u.exec(url ?? "");
  if (found === null) return undefined;
  const directory = typeof repository === "object" && typeof repository.directory === "string" ? repository.directory.replace(/^\.?\/*|\/*$/gu, "") : "";
  return { owner: found[1], name: found[2], directory };
}

/** The house packages a pnpm node_modules installs: `{name, version, repository}` per installed version. */
export function readDeployedPackages(nodeModules, { scopes = HOUSE_SCOPES } = {}) {
  const found = new Map();
  const consider = (dir) => {
    let manifest;
    try { manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")); } catch { return; }
    if (typeof manifest.name !== "string" || !scopes.some((scope) => manifest.name.startsWith(`${scope}/`))) return;
    found.set(`${manifest.name}@${manifest.version}`, Object.freeze({ name: manifest.name, version: manifest.version, repository: githubRepositoryOf(manifest.repository) }));
  };
  for (const entry of readdirSync(join(nodeModules, ".pnpm"), { withFileTypes: true })) {
    if (!entry.isDirectory() || !scopes.some((scope) => entry.name.startsWith(`${scope}+`))) continue;
    const [scope, rest] = entry.name.split("+");
    consider(join(nodeModules, ".pnpm", entry.name, "node_modules", scope, rest.split("@")[0]));
  }
  return [...found.values()].sort((left, right) => left.name.localeCompare(right.name, "en") || compareVersions(left.version, right.version));
}

/**
 * The drift findings of one reading. `registry`: name -> {latest} (absent when unread);
 * `sources`: "owner/name" -> {versions: {directory: version}, pullRequests: [{number, createdAt, title}]}
 * (absent when unread). Findings name what is owed; packages with none are in sync.
 */
export function classifySourceDrift({ deployed, registry, sources, now, stalePullRequestDays = STALE_PULL_REQUEST_DAYS }) {
  const findings = [];
  const byName = new Map();
  for (const item of deployed) byName.set(item.name, [...(byName.get(item.name) ?? []), item]);
  const reposSeen = new Set();
  for (const [name, installs] of byName) {
    const versions = installs.map((item) => item.version);
    const running = newest(versions);
    const repository = installs.at(-1).repository;
    if (versions.length > 1) findings.push({ kind: "duplicate-versions", package: name, deployed: versions });
    const latest = registry.get(name)?.latest;
    if (latest === undefined) findings.push({ kind: "source-unread", package: name, deployed: running, unread: "registry" });
    else if (compareVersions(latest, running) > 0) findings.push({ kind: "released-not-deployed", package: name, deployed: running, registry: latest });
    const key = repository === undefined ? undefined : `${repository.owner}/${repository.name}`;
    const source = key === undefined ? undefined : sources.get(key);
    const main = source?.versions?.[repository?.directory ?? ""];
    if (main === undefined) findings.push({ kind: "source-unread", package: name, deployed: running, unread: repository === undefined ? "repository-undeclared" : "default-branch" });
    else {
      if (compareVersions(running, main) > 0) findings.push({ kind: "deployed-not-on-main", package: name, deployed: running, main, repository: key });
      if (latest !== undefined && compareVersions(main, latest) > 0) findings.push({ kind: "merged-not-released", package: name, main, registry: latest, repository: key });
    }
    if (source !== undefined && !reposSeen.has(key)) {
      reposSeen.add(key);
      const cutoff = Date.parse(now) - stalePullRequestDays * 86_400_000;
      const stale = (source.pullRequests ?? []).filter((pull) => Date.parse(pull.createdAt) < cutoff);
      if (stale.length > 0) findings.push({ kind: "stale-pull-requests", repository: key, open: source.pullRequests.length, stale: stale.length,
        oldest: stale.map((pull) => ({ number: pull.number, createdAt: pull.createdAt, title: pull.title })).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, 5) });
    }
  }
  const counts = {};
  for (const finding of findings) counts[finding.kind] = (counts[finding.kind] ?? 0) + 1;
  return Object.freeze({ packages: byName.size, installs: deployed.length, counts, findings });
}

/** Each package's registry latest, read from a npm-compatible registry's packuments; unread packages are absent. */
export async function readRegistryLatest(names, { registry, fetch = globalThis.fetch, concurrency = 8 }) {
  const latest = new Map();
  const queue = [...names];
  const worker = async () => {
    for (let name = queue.shift(); name !== undefined; name = queue.shift()) {
      try {
        const response = await fetch(`${registry.replace(/\/$/u, "")}/${name.replace("/", "%2F")}`, { headers: { accept: "application/vnd.npm.install-v1+json" } });
        if (!response.ok) continue;
        const packument = await response.json();
        if (typeof packument?.["dist-tags"]?.latest === "string") latest.set(name, { latest: packument["dist-tags"].latest });
      } catch { /* unread stays absent */ }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return latest;
}

const graphqlString = (value) => JSON.stringify(value);

/** Each repository's default-branch package versions (per directory) and open pull requests, through `gh api graphql`. */
export async function readGitHubSources(repositories, { gh = "gh" } = {}) {
  const byKey = new Map();
  for (const repository of repositories) {
    const key = `${repository.owner}/${repository.name}`;
    const held = byKey.get(key) ?? { ...repository, directories: new Set() };
    held.directories.add(repository.directory);
    byKey.set(key, held);
  }
  const entries = [...byKey.entries()];
  const sources = new Map();
  for (let start = 0; start < entries.length; start += GITHUB_BATCH) {
    const batch = entries.slice(start, start + GITHUB_BATCH);
    const fields = batch.map(([, repository], index) => {
      const manifests = [...repository.directories].map((directory, at) =>
        `m${at}: object(expression: ${graphqlString(`HEAD:${directory === "" ? "" : `${directory}/`}package.json`)}) { ... on Blob { text } }`).join(" ");
      return `r${index}: repository(owner: ${graphqlString(repository.owner)}, name: ${graphqlString(repository.name)}) { ${manifests} pullRequests(states: OPEN, first: 100) { nodes { number createdAt title } } }`;
    }).join("\n");
    let data;
    try {
      const { stdout } = await run(gh, ["api", "graphql", "-f", `query=query { ${fields} }`], { maxBuffer: 64 * 1024 * 1024 });
      data = JSON.parse(stdout).data ?? {};
    } catch (error) {
      // A partial GraphQL answer (one renamed or missing repository) still carries the others.
      try { data = JSON.parse(error.stdout ?? "").data ?? {}; } catch { data = {}; }
    }
    batch.forEach(([key, repository], index) => {
      const answer = data[`r${index}`];
      if (answer === null || answer === undefined) return;
      const versions = {};
      [...repository.directories].forEach((directory, at) => {
        try { const version = JSON.parse(answer[`m${at}`]?.text ?? "").version; if (typeof version === "string") versions[directory] = version; } catch { /* unread */ }
      });
      sources.set(key, { versions, pullRequests: answer.pullRequests?.nodes ?? [] });
    });
  }
  return sources;
}

/** Observe one deployment's source drift: `{kind, observedAt, nodeModules, registry, ...classification}`. */
export async function observeSourceDrift({ nodeModules, registry = "https://registry.561.group", now = new Date().toISOString(), stalePullRequestDays, readRegistry = readRegistryLatest, readSources = readGitHubSources } = {}) {
  const deployed = readDeployedPackages(nodeModules);
  const names = [...new Set(deployed.map((item) => item.name))];
  const repositories = deployed.map((item) => item.repository).filter((repository) => repository !== undefined);
  const [latest, sources] = await Promise.all([readRegistry(names, { registry }), readSources(repositories)]);
  return Object.freeze({ kind: "source-drift-observation", observedAt: now, nodeModules, registry,
    ...classifySourceDrift({ deployed, registry: latest, sources, now, stalePullRequestDays }) });
}
