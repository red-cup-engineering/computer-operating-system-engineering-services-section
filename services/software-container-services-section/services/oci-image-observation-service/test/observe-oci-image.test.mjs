import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createOciDistributionHttpReadAuthority, observeOciImage, verifyOciImageObservationRecord } from "../src/observe-oci-image.mjs";

const MT = {
  index: "application/vnd.oci.image.index.v1+json",
  manifest: "application/vnd.oci.image.manifest.v1+json",
  config: "application/vnd.oci.image.config.v1+json",
  layer: "application/vnd.oci.image.layer.v1.tar+gzip",
};
const sha = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const json = (value) => Buffer.from(JSON.stringify(value));
const descriptor = (mediaType, body) => ({ mediaType, digest: sha(body), size: body.length });

function octal(value, width) {
  return `${value.toString(8).padStart(width - 1, "0")}\0`;
}
function tar(entries) {
  const chunks = [];
  for (const entry of entries) {
    const body = Buffer.from(entry.body ?? ""), header = Buffer.alloc(512);
    header.write(entry.path, 0, 100, "utf8");
    header.write(octal(entry.mode ?? 0o644, 8), 100, 8, "ascii");
    header.write(octal(entry.uid ?? 0, 8), 108, 8, "ascii");
    header.write(octal(entry.gid ?? 0, 8), 116, 8, "ascii");
    header.write(octal(body.length, 12), 124, 12, "ascii");
    header.write(octal(0, 12), 136, 12, "ascii");
    header.fill(0x20, 148, 156);
    header[156] = (entry.type ?? "0").charCodeAt(0);
    if (entry.link) header.write(entry.link, 157, 100, "utf8");
    header.write("ustar\0", 257, 6, "binary");
    header.write("00", 263, 2, "ascii");
    header.write(octal(entry.deviceMajor ?? 0, 8), 329, 8, "ascii");
    header.write(octal(entry.deviceMinor ?? 0, 8), 337, 8, "ascii");
    const checksum = [...header].reduce((sum, byte) => sum + byte, 0);
    header.write(octal(checksum, 8), 148, 8, "ascii");
    chunks.push(header, body, Buffer.alloc((512 - body.length % 512) % 512));
  }
  chunks.push(Buffer.alloc(1024));
  return Buffer.concat(chunks);
}

function imageFixture({ architecture = "amd64", nodeVersion = "24.19.0", headerVersion = nodeVersion } = {}) {
  const [major, minor, patch] = headerVersion.split(".");
  const bottomTar = tar([
    { path: "./", type: "5", mode: 0o755 },
    { path: "aaa/noise", body: Buffer.alloc(400, 0x61) },
    { path: "usr/lib/os-release", body: 'ID=debian\nVERSION_ID="12"\nVERSION_CODENAME=bookworm\n' },
    { path: "etc/os-release", type: "2", link: "../usr/lib/os-release" },
    { path: "etc/debian_version", body: "12.11\n" },
    { path: "etc/passwd", body: "root:x:0:0:root:/root:/bin/sh\nnode:x:1000:1000::/home/node:/bin/sh\n" },
    { path: "etc/group", body: "root:x:0:\nnode:x:1000:\n" },
    { path: "usr/local/include", type: "2", link: "altinclude" },
    { path: "usr/local/altinclude/node/node_version.h", body: `#define NODE_MAJOR_VERSION ${major}\n#define NODE_MINOR_VERSION ${minor}\n#define NODE_PATCH_VERSION ${patch}\n` },
    { path: "hard-source", uid: 777, gid: 778, body: "original inode" },
    { path: "hard-copy", type: "1", link: "hard-source" },
    { path: "old/deleted", uid: 444, gid: 445, body: "gone" },
    { path: "opaque/lower", uid: 700, gid: 701, body: "gone" },
    { path: "dev/null", type: "3", uid: 0, gid: 0, deviceMajor: 1, deviceMinor: 3 },
  ]);
  const topTar = tar([
    { path: "old/.wh.deleted", body: "" },
    { path: "opaque/.wh..wh..opq", body: "" },
    { path: "opaque/new", uid: 800, gid: 801, body: "new" },
    { path: "same/.wh.target", body: "" },
    { path: "same/target", uid: 900, gid: 901, body: "same-layer addition survives" },
    { path: "hard-source", uid: 999, gid: 998, body: "replacement inode" },
    { path: "usr/local/include/node/through-ancestor-link", body: "reachable" },
  ]);
  const compressed = [gzipSync(bottomTar, { mtime: 0 }), gzipSync(topTar, { mtime: 0 })];
  const layers = compressed.map((body) => descriptor(MT.layer, body));
  const configBody = json({
    architecture, os: "linux",
    config: { Env: [`NODE_VERSION=${nodeVersion}`], User: "10001:10002" },
    rootfs: { type: "layers", diff_ids: [sha(bottomTar), sha(topTar)] },
  });
  const config = descriptor(MT.config, configBody);
  const manifestBody = json({ schemaVersion: 2, mediaType: MT.manifest, config, layers });
  const manifest = descriptor(MT.manifest, manifestBody);
  return { blobs: new Map([[config.digest, configBody], ...layers.map((row, index) => [row.digest, compressed[index]])]), config, layers, manifest, manifestBody };
}

function singleLayerFixture(entries) {
  const layerTar = tar(entries), layerBody = gzipSync(layerTar, { mtime: 0 }), layer = descriptor(MT.layer, layerBody);
  const configBody = json({ architecture: "amd64", os: "linux", config: {}, rootfs: { type: "layers", diff_ids: [sha(layerTar)] } }), config = descriptor(MT.config, configBody);
  const manifestBody = json({ schemaVersion: 2, mediaType: MT.manifest, config, layers: [layer] });
  return { manifestBody, manifest: descriptor(MT.manifest, manifestBody), blobs: new Map([[config.digest, configBody], [layer.digest, layerBody]]) };
}

function indexFixture() {
  const amd64 = imageFixture(), arm64 = imageFixture({ architecture: "arm64" });
  const indexBody = json({ schemaVersion: 2, mediaType: MT.index, manifests: [
    { ...amd64.manifest, platform: { os: "linux", architecture: "amd64", "os.features": ["ignored-extension"] } },
    { ...arm64.manifest, platform: { os: "linux", architecture: "arm64" } },
  ] });
  return { indexBody, index: descriptor(MT.index, indexBody), images: [amd64, arm64] };
}

function registryFor(fixture, mutate = {}) {
  const calls = [], manifests = new Map(), blobs = new Map();
  if (fixture.index) {
    manifests.set(fixture.index.digest, fixture.indexBody);
    for (const image of fixture.images) { manifests.set(image.manifest.digest, image.manifestBody); for (const row of image.blobs) blobs.set(...row); }
  } else {
    manifests.set(fixture.manifest.digest, fixture.manifestBody);
    for (const row of fixture.blobs) blobs.set(...row);
  }
  const response = (digest, body, kind) => {
    const effective = mutate[digest] ?? body;
    return { status: 200, headers: { "content-type": kind === "manifest" ? JSON.parse(body).mediaType : "application/octet-stream", "docker-content-digest": digest }, body: effective };
  };
  return {
    type: "OciDistributionReadAuthority", version: 1,
    id: "ni:///sha-256;AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    credential: "the-secret-must-not-enter-the-observation",
    calls,
    async readManifest(request) { calls.push({ method: "manifest", ...request }); return response(request.digest, manifests.get(request.digest), "manifest"); },
    async readBlob(request) { calls.push({ method: "blob", ...request }); return response(request.digest, blobs.get(request.digest), "blob"); },
  };
}
const reference = (digest) => `registry.example/research/node@${digest}`;

test("observes verified layers, whiteouts, safe special files, owners, Node, and Debian", async () => {
  const fixture = imageFixture(), registry = registryFor(fixture);
  const result = await observeOciImage({ reference: reference(fixture.manifest.digest) }, { registryReadAuthority: registry });
  assert.equal(result.type, "OciImageObservation");
  assert.equal(result.node.status, "observed");
  assert.equal(result.node.version, "24.19.0");
  assert.equal(result.debian.suite, "bookworm");
  const files = new Map(result.finalRootfs.files.map((row) => [row.path, row]));
  assert.equal(files.get("/").kind, "directory");
  assert.equal(files.has("old/deleted"), false);
  assert.equal(files.has("opaque/lower"), false);
  assert.equal(files.get("opaque/new").uid, 800);
  assert.equal(files.get("same/target").uid, 900);
  assert.equal(files.get("usr/local/altinclude/node/through-ancestor-link").contentDigest, sha(Buffer.from("reachable")));
  assert.equal(files.get("hard-copy").uid, 777);
  assert.equal(files.get("hard-copy").contentDigest, sha(Buffer.from("original inode")));
  assert.equal(files.get("hard-source").uid, 999);
  assert.equal(files.get("dev/null").kind, "character-device");
  assert.equal(files.get("dev/null").deviceMajor, 1);
  assert.equal(files.get("dev/null").deviceMinor, 3);
  assert.deepEqual(result.finalRootfs.occupied.union.uids, [0, 777, 800, 900, 999, 1000, 10001]);
  assert.deepEqual(result.finalRootfs.occupied.union.gids, [0, 778, 801, 901, 998, 1000, 10002]);
  assert.deepEqual(result.finalRootfs.occupied.accounts.uids, [0, 1000, 10001]);
  assert.deepEqual(result.finalRootfs.occupied.accounts.gids, [0, 1000, 10002]);
  assert.equal(result.finalRootfs.occupied.configUser.raw, "10001:10002");
  assert.equal(JSON.stringify(result).includes(registry.credential), false);
  assert.deepEqual(verifyOciImageObservationRecord(result), result);
});

test("selects one exact index platform and returns a deterministic catalog otherwise", async () => {
  const fixture = indexFixture(), registry = registryFor(fixture);
  const selected = await observeOciImage({ reference: reference(fixture.index.digest), platform: { os: "linux", architecture: "amd64" } }, { registryReadAuthority: registry });
  assert.equal(selected.type, "OciImageObservation");
  assert.equal(selected.platform.architecture, "amd64");
  assert.equal(selected.index.digest, fixture.index.digest);
  const first = await observeOciImage({ reference: reference(fixture.index.digest) }, { registryReadAuthority: registry });
  const second = await observeOciImage({ reference: reference(fixture.index.digest) }, { registryReadAuthority: registry });
  assert.equal(first.type, "OciImageObservationCatalog");
  assert.equal(first.id, second.id);
  assert.deepEqual(first.observations.map((row) => row.platform.architecture), ["amd64", "arm64"]);
});

test("bounds index breadth and shares byte budgets across catalog children", async () => {
  const fixture = indexFixture();
  const tooBroad = await observeOciImage({ reference: reference(fixture.index.digest), limits: { maxPlatformDescriptors: 1 } }, { registryReadAuthority: registryFor(fixture) });
  assert.equal(tooBroad.code, "platform-descriptor-limit-exceeded");
  const oneImageCompressedBytes = fixture.images[0].layers.reduce((sum, row) => sum + row.size, 0);
  const exhausted = await observeOciImage({
    reference: reference(fixture.index.digest),
    limits: { compressedLayerBytes: oneImageCompressedBytes, totalCompressedBytes: oneImageCompressedBytes },
  }, { registryReadAuthority: registryFor(fixture) });
  assert.equal(exhausted.code, "byte-limit-exceeded");
});

test("arbitrary earlier files cannot consume the evidence-byte allowance", async () => {
  const fixture = imageFixture();
  const result = await observeOciImage({
    reference: reference(fixture.manifest.digest),
    limits: { evidenceFileBytes: 512, totalEvidenceBytes: 512 },
  }, { registryReadAuthority: registryFor(fixture) });
  assert.equal(result.node.status, "observed");
  assert.equal(result.debian.status, "observed");
  assert.deepEqual(result.finalRootfs.occupied.accounts.uids, [0, 1000, 10001]);
});

test("refuses a compressed blob digest mismatch", async () => {
  const fixture = imageFixture(), corrupted = Buffer.from(fixture.blobs.get(fixture.layers[0].digest)); corrupted[0] ^= 0xff;
  const result = await observeOciImage({ reference: reference(fixture.manifest.digest) }, { registryReadAuthority: registryFor(fixture, { [fixture.layers[0].digest]: corrupted }) });
  assert.equal(result.type, "OciImageObservationRefusal");
  assert.equal(result.code, "descriptor-mismatch");
});

test("refuses a DiffID mismatch independently of compressed integrity", async () => {
  const fixture = imageFixture();
  const configValue = JSON.parse(fixture.blobs.get(fixture.config.digest));
  configValue.rootfs.diff_ids[0] = `sha256:${"0".repeat(64)}`;
  const configBody = json(configValue), config = descriptor(MT.config, configBody);
  const manifestBody = json({ ...JSON.parse(fixture.manifestBody), config });
  const altered = { ...fixture, config, manifestBody, manifest: descriptor(MT.manifest, manifestBody), blobs: new Map([...fixture.blobs, [config.digest, configBody]]) };
  const result = await observeOciImage({ reference: reference(altered.manifest.digest) }, { registryReadAuthority: registryFor(altered) });
  assert.equal(result.code, "diffid-mismatch");
});

test("refuses traversal entries without extracting anything", async () => {
  const fixture = imageFixture(), layerTar = tar([{ path: "../escape", body: "never written" }]), layerBody = gzipSync(layerTar, { mtime: 0 }), layer = descriptor(MT.layer, layerBody);
  const configBody = json({ architecture: "amd64", os: "linux", config: {}, rootfs: { type: "layers", diff_ids: [sha(layerTar)] } }), config = descriptor(MT.config, configBody);
  const manifestBody = json({ schemaVersion: 2, mediaType: MT.manifest, config, layers: [layer] });
  const malicious = { manifestBody, manifest: descriptor(MT.manifest, manifestBody), blobs: new Map([[config.digest, configBody], [layer.digest, layerBody]]) };
  const result = await observeOciImage({ reference: reference(malicious.manifest.digest) }, { registryReadAuthority: registryFor(malicious) });
  assert.equal(result.code, "tar-path-traversal");
});

test("refuses empty entry paths, parent files, and component symlink cycles", async () => {
  const empty = singleLayerFixture([{ path: "", body: "invalid" }]);
  const emptyResult = await observeOciImage({ reference: reference(empty.manifest.digest) }, { registryReadAuthority: registryFor(empty) });
  assert.equal(emptyResult.code, "tar-path-empty");

  const impossible = singleLayerFixture([{ path: "bad", body: "file" }, { path: "bad/child", body: "cannot exist" }]);
  const impossibleResult = await observeOciImage({ reference: reference(impossible.manifest.digest) }, { registryReadAuthority: registryFor(impossible) });
  assert.equal(impossibleResult.code, "rootfs-parent-not-directory");

  const cycle = singleLayerFixture([{ path: "usr", type: "2", link: "usr" }]);
  const cycleResult = await observeOciImage({ reference: reference(cycle.manifest.digest) }, { registryReadAuthority: registryFor(cycle) });
  assert.equal(cycleResult.code, "rootfs-link-cycle");
});

test("enforces decompression bounds", async () => {
  const fixture = imageFixture();
  const result = await observeOciImage({ reference: reference(fixture.manifest.digest), limits: { uncompressedLayerBytes: 512, totalUncompressedBytes: 1024 } }, { registryReadAuthority: registryFor(fixture) });
  assert.equal(result.code, "decompression-limit-exceeded");
});

test("enforces compressed-byte bounds before decompression", async () => {
  const fixture = imageFixture();
  const result = await observeOciImage({ reference: reference(fixture.manifest.digest), limits: { compressedLayerBytes: 64, totalCompressedBytes: 128 } }, { registryReadAuthority: registryFor(fixture) });
  assert.equal(result.code, "byte-limit-exceeded");
});

test("reports contradictory Node evidence as unresolved and record verification catches tampering", async () => {
  const fixture = imageFixture({ headerVersion: "24.18.0" });
  const result = await observeOciImage({ reference: reference(fixture.manifest.digest) }, { registryReadAuthority: registryFor(fixture) });
  assert.equal(result.node.status, "unresolved");
  assert.equal(result.node.code, "node-version-evidence-disagrees");
  const tampered = structuredClone(result); tampered.node.version = "99.0.0";
  const admitted = verifyOciImageObservationRecord(tampered);
  assert.equal(admitted.type, "OciImageObservationRefusal");
  assert.equal(admitted.operation, "verify-record");
});

test("requires an explicit authority and records only its identity", async () => {
  const fixture = imageFixture();
  const absent = await observeOciImage({ reference: reference(fixture.manifest.digest) });
  assert.equal(absent.code, "read-authority-invalid");
  const registry = registryFor(fixture), result = await observeOciImage({ reference: reference(fixture.manifest.digest) }, { registryReadAuthority: registry });
  assert.deepEqual(result.readAuthority, { id: registry.id });
  assert.ok(registry.calls.every((call) => !Object.hasOwn(call, "credential")));
});

test("does not copy an injected authority's thrown credential into a refusal", async () => {
  const fixture = imageFixture(), secret = "Bearer registry-token-that-must-disappear";
  const registry = registryFor(fixture);
  registry.readManifest = async () => { throw new Error(secret); };
  const result = await observeOciImage({ reference: reference(fixture.manifest.digest) }, { registryReadAuthority: registry });
  assert.equal(result.type, "OciImageObservationRefusal");
  assert.equal(result.code, "observation-failed");
  assert.equal(JSON.stringify(result).includes(secret), false);
});

test("HTTP authority performs exact anonymous Bearer pull-scope exchange", async () => {
  const fixture = imageFixture(), memory = registryFor(fixture), calls = [], token = "ephemeral-public-token";
  const fetch = async (input, init) => {
    const url = new URL(input), authorization = init.headers.Authorization ?? null;
    calls.push({ url: url.href, authorization, accept: init.headers.Accept, redirect: init.redirect });
    if (url.hostname === "auth.example") {
      assert.equal(url.searchParams.get("service"), "registry.example");
      assert.equal(url.searchParams.get("scope"), "repository:research/node:pull");
      assert.equal(authorization, null);
      return { status: 200, headers: new Headers({ "content-type": "application/json" }), body: [json({ token })] };
    }
    if (authorization === null) return { status: 401, headers: new Headers({ "www-authenticate": 'Bearer realm="https://auth.example/token",service="registry.example",scope="repository:research/node:pull"' }), body: [] };
    assert.equal(authorization, `Bearer ${token}`);
    const digest = decodeURIComponent(url.pathname.slice(url.pathname.lastIndexOf("/") + 1));
    const inner = url.pathname.includes("/manifests/")
      ? await memory.readManifest({ registry: "registry.example", repository: "research/node", digest, accept: [MT.index, "application/vnd.docker.distribution.manifest.list.v2+json", MT.manifest, "application/vnd.docker.distribution.manifest.v2+json"] })
      : await memory.readBlob({ registry: "registry.example", repository: "research/node", digest });
    return { ...inner, headers: new Headers(inner.headers) };
  };
  const authority = createOciDistributionHttpReadAuthority({ registry: "registry.example", repository: "research/node", authMode: "anonymous" }, { fetch });
  const result = await observeOciImage({ reference: reference(fixture.manifest.digest) }, { registryReadAuthority: authority });
  assert.equal(result.type, "OciImageObservation");
  assert.ok(calls.filter((call) => new URL(call.url).hostname === "registry.example").every((call) => call.redirect === "manual"));
  assert.ok(calls.filter((call) => new URL(call.url).hostname === "auth.example").every((call) => call.redirect === "error"));
  assert.equal(JSON.stringify(authority).includes(token), false);
  assert.equal(JSON.stringify(result).includes(token), false);
});

test("HTTP authority follows Docker-Hub-shaped 307 blob redirects without leaking Bearer auth", async () => {
  const fixture = imageFixture(), memory = registryFor(fixture), calls = [], token = "docker-public-token";
  const fetch = async (input, init) => {
    const url = new URL(input), authorization = init.headers.Authorization ?? null;
    calls.push({ host: url.hostname, path: url.pathname, authorization });
    if (url.hostname === "auth.docker.io") return { status: 200, headers: new Headers(), body: [json({ token })] };
    if (url.hostname === "production.cloudflare.docker.com") {
      assert.equal(authorization, null);
      const digest = url.searchParams.get("digest"), inner = await memory.readBlob({ registry: "registry.example", repository: "research/node", digest });
      return { status: 200, headers: new Headers({ "content-type": "application/octet-stream" }), body: inner.body };
    }
    assert.equal(url.hostname, "registry-1.docker.io");
    if (authorization === null) return { status: 401, headers: new Headers({ "www-authenticate": 'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:library/node:pull"' }), body: [] };
    assert.equal(authorization, `Bearer ${token}`);
    const digest = decodeURIComponent(url.pathname.slice(url.pathname.lastIndexOf("/") + 1));
    if (url.pathname.includes("/manifests/")) {
      const inner = await memory.readManifest({ registry: "registry.example", repository: "research/node", digest, accept: [MT.index, "application/vnd.docker.distribution.manifest.list.v2+json", MT.manifest, "application/vnd.docker.distribution.manifest.v2+json"] });
      return { ...inner, headers: new Headers(inner.headers) };
    }
    return { status: 307, headers: new Headers({ location: `https://production.cloudflare.docker.com/registry-v2/docker/registry/v2/blobs/redirect?digest=${encodeURIComponent(digest)}` }), body: [] };
  };
  const authority = createOciDistributionHttpReadAuthority({ registry: "registry-1.docker.io", repository: "library/node" }, { fetch });
  const result = await observeOciImage({ reference: `registry-1.docker.io/library/node@${fixture.manifest.digest}` }, { registryReadAuthority: authority });
  assert.equal(result.type, "OciImageObservation");
  assert.ok(calls.some((call) => call.host === "production.cloudflare.docker.com"));
  assert.ok(calls.filter((call) => call.host === "production.cloudflare.docker.com").every((call) => call.authorization === null));
});

test("HTTP redirect policy forwards auth only on the same origin", async () => {
  const digest = `sha256:${"3".repeat(64)}`, seen = [];
  const fetch = async (input, init) => {
    const url = new URL(input), authorization = init.headers.Authorization ?? null; seen.push({ url: url.href, authorization });
    if (seen.length === 1) return { status: 401, headers: new Headers({ "www-authenticate": 'Bearer realm="https://auth.example/token"' }), body: [] };
    if (seen.length === 2) return { status: 307, headers: new Headers({ location: "/same-origin-copy" }), body: [] };
    if (seen.length === 3) return { status: 307, headers: new Headers({ location: "https://cdn.example/blob" }), body: [] };
    return { status: 200, headers: new Headers(), body: [Buffer.from("bytes")] };
  };
  const authority = createOciDistributionHttpReadAuthority({ registry: "registry.example", repository: "research/node", authMode: "provider" }, { fetch, tokenProvider: async () => "private-bearer" });
  const response = await authority.readBlob({ registry: "registry.example", repository: "research/node", digest });
  for await (const _chunk of response.body) { /* drain */ }
  assert.equal(seen[1].authorization, "Bearer private-bearer");
  assert.equal(seen[2].authorization, "Bearer private-bearer");
  assert.equal(seen[3].authorization, null);
});

test("HTTP redirect policy refuses loops, excess hops, downgrade, credentials, fragments, and missing Location", async () => {
  const digest = `sha256:${"4".repeat(64)}`, request = { registry: "registry.example", repository: "research/node", digest };
  const cases = [
    { location: null, code: "registry-redirect-location-missing" },
    { location: "http://cdn.example/blob", code: "registry-redirect-location-invalid" },
    { location: "https://user:pass@cdn.example/blob", code: "registry-redirect-location-invalid" },
    { location: "https://cdn.example/blob#fragment", code: "registry-redirect-location-invalid" },
    { location: "https://cdn.example/blob#", code: "registry-redirect-location-invalid" },
    { location: `https://registry.example/v2/research/node/blobs/${digest}`, code: "registry-redirect-loop" },
  ];
  for (const row of cases) {
    const fetch = async () => ({ status: 307, headers: new Headers(row.location === null ? {} : { location: row.location }), body: [] });
    const authority = createOciDistributionHttpReadAuthority({ registry: "registry.example", repository: "research/node" }, { fetch });
    await assert.rejects(() => authority.readBlob(request), (error) => error.code === row.code);
  }
  let hop = 0;
  const authority = createOciDistributionHttpReadAuthority({ registry: "registry.example", repository: "research/node", maxRedirects: 1 }, { fetch: async () => ({ status: 307, headers: new Headers({ location: `/hop-${hop += 1}` }), body: [] }) });
  await assert.rejects(() => authority.readBlob(request), (error) => error.code === "registry-redirect-limit-exceeded");
});

test("HTTP authority binds auth mode but never provider token bytes", async () => {
  const digest = `sha256:${"1".repeat(64)}`, used = [];
  const fetch = async (_input, init) => init.headers.Authorization === undefined
    ? { status: 401, headers: new Headers({ "www-authenticate": 'Bearer realm="https://auth.example/token",service="private"' }), body: [] }
    : (used.push(init.headers.Authorization), { status: 200, headers: new Headers(), body: [Buffer.from("ok")] });
  const first = createOciDistributionHttpReadAuthority({ registry: "registry.example", repository: "research/node", authMode: "provider", blobResponseBytes: 8 }, { fetch, tokenProvider: async ({ scope }) => (assert.equal(scope, "repository:research/node:pull"), "private-one") });
  const second = createOciDistributionHttpReadAuthority({ registry: "registry.example", repository: "research/node", authMode: "provider", blobResponseBytes: 8 }, { fetch, tokenProvider: async () => "private-two" });
  assert.equal(first.id, second.id);
  const response = await first.readBlob({ registry: "registry.example", repository: "research/node", digest });
  for await (const _chunk of response.body) { /* drain the bounded carrier */ }
  assert.deepEqual(used, ["Bearer private-one"]);
  assert.equal(JSON.stringify(first).includes("private-one"), false);
  assert.throws(() => createOciDistributionHttpReadAuthority({ registry: "registry.example", repository: "research/node", token: "raw-secret" }), (error) => error.code === "record-key-unsupported");
});

test("HTTP authority rejects insecure realms, scope expansion, and oversized bodies", async () => {
  const fixture = imageFixture();
  for (const challenge of [
    'Bearer realm="http://auth.example/token",scope="repository:research/node:pull"',
    'Bearer realm="https://auth.example/token",scope="repository:research/node:push,pull"',
  ]) {
    const fetch = async () => ({ status: 401, headers: new Headers({ "www-authenticate": challenge }), body: [] });
    const authority = createOciDistributionHttpReadAuthority({ registry: "registry.example", repository: "research/node" }, { fetch });
    const result = await observeOciImage({ reference: reference(fixture.manifest.digest) }, { registryReadAuthority: authority });
    assert.equal(result.type, "OciImageObservationRefusal");
    assert.ok(["bearer-realm-invalid", "bearer-scope-mismatch"].includes(result.code));
  }
  const digest = `sha256:${"2".repeat(64)}`;
  const authority = createOciDistributionHttpReadAuthority({ registry: "registry.example", repository: "research/node", blobResponseBytes: 4 }, { fetch: async () => ({ status: 200, headers: new Headers(), body: [Buffer.from("12345")] }) });
  const response = await authority.readBlob({ registry: "registry.example", repository: "research/node", digest });
  await assert.rejects(async () => { for await (const _chunk of response.body) { /* enforce while streaming */ } }, (error) => error.code === "authority-byte-limit-exceeded");
  await assert.rejects(() => authority.readBlob({ registry: "registry.example", repository: "another/repo", digest }), (error) => error.code === "http-authority-request-out-of-scope");
});

test("CLI exposes anonymous observation without a raw credential surface", () => {
  const cli = fileURLToPath(new URL("../src/cli.mjs", import.meta.url));
  const help = spawnSync(process.execPath, [cli, "--help"], { encoding: "utf8" });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Anonymous public-registry reads only/u);
  const token = spawnSync(process.execPath, [cli, "--token", "forbidden"], { encoding: "utf8" });
  assert.equal(token.status, 2);
  assert.match(token.stderr, /unknown or incomplete argument --token/u);
  assert.equal(token.stdout.includes("forbidden"), false);
});
