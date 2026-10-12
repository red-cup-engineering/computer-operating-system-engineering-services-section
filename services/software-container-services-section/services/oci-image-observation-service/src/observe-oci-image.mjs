import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";
import { posix } from "node:path";
import { makeNiUri } from "@red-cup-engineering/uri-services-section/ni-uri";
import { canonicalJson as canonical } from "@red-cup-engineering/json-services-section/canonical-json";
import { sha256Digest, sha256Hex } from "@red-cup-engineering/cryptographic-computer-data-engineering-services-section/integrity";

const DIGEST = /^sha256:[a-f0-9]{64}$/u;
const CONTENT_ID = /^ni:\/\/\/sha-256;[A-Za-z0-9_-]{43}$/u;
const REFERENCE = /^(?<registry>[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::[1-9][0-9]{0,4})?)\/(?<repository>[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*)@(?<digest>sha256:[a-f0-9]{64})$/u;
const OCI_INDEX = "application/vnd.oci.image.index.v1+json";
const DOCKER_INDEX = "application/vnd.docker.distribution.manifest.list.v2+json";
const OCI_MANIFEST = "application/vnd.oci.image.manifest.v1+json";
const DOCKER_MANIFEST = "application/vnd.docker.distribution.manifest.v2+json";
const OCI_CONFIG = "application/vnd.oci.image.config.v1+json";
const DOCKER_CONFIG = "application/vnd.docker.container.image.v1+json";
const TAR = new Set(["application/vnd.oci.image.layer.v1.tar"]);
const GZIP = new Set(["application/vnd.oci.image.layer.v1.tar+gzip", "application/vnd.docker.image.rootfs.diff.tar.gzip"]);
const ACCEPT = Object.freeze([OCI_INDEX, DOCKER_INDEX, OCI_MANIFEST, DOCKER_MANIFEST]);
const DEFAULT_LIMITS = Object.freeze({ manifestBytes: 4 * 1024 * 1024, configBytes: 4 * 1024 * 1024, compressedLayerBytes: 256 * 1024 * 1024, totalCompressedBytes: 1024 * 1024 * 1024, uncompressedLayerBytes: 1024 * 1024 * 1024, totalUncompressedBytes: 4 * 1024 * 1024 * 1024, entries: 2_000_000, evidenceFileBytes: 16 * 1024 * 1024, totalEvidenceBytes: 64 * 1024 * 1024, maxPlatformDescriptors: 64 });
const OWN_ERROR = Symbol("oci-image-observation-error");

function decodeUtf8(bytes, label) {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { fail("utf8-invalid", `${label} is not valid UTF-8`); }
}
function contentId(value) { return makeNiUri(Buffer.from(canonical(value), "utf8")); }
function freeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, member]) => [key, freeze(member)])));
  return value;
}
function fail(code, detail) { throw Object.assign(new TypeError(detail), { code, [OWN_ERROR]: true }); }
function refusal(operation, error, subject = null) {
  const trusted = error?.[OWN_ERROR] === true;
  const body = { type: "OciImageObservationRefusal", version: 1, status: "refused", operation, subject, code: trusted ? error.code : "observation-failed", detail: trusted ? error.message : "an untrusted observation dependency failed", effects: [] };
  return freeze({ id: contentId(body), ...body });
}
function record(value, label) { if (value === null || typeof value !== "object" || Array.isArray(value)) fail("record-invalid", `${label} must be one record`); return value; }
function exactKeys(value, allowed, label) { const extras = Object.keys(value).filter((key) => !allowed.includes(key)); if (extras.length > 0) fail("record-key-unsupported", `${label} has unsupported keys: ${extras.sort().join(", ")}`); }
function integer(value, minimum, maximum, label) { if (!Number.isSafeInteger(value) || value < minimum || value > maximum) fail("limit-invalid", `${label} must be an integer from ${minimum} through ${maximum}`); return value; }
function normalizeLimits(value = {}) {
  record(value, "limits");
  exactKeys(value, Object.keys(DEFAULT_LIMITS), "limits");
  const result = {};
  for (const [name, fallback] of Object.entries(DEFAULT_LIMITS)) result[name] = integer(value[name] ?? fallback, 1, Number.MAX_SAFE_INTEGER, name);
  if (result.compressedLayerBytes > result.totalCompressedBytes || result.uncompressedLayerBytes > result.totalUncompressedBytes || result.evidenceFileBytes > result.totalEvidenceBytes) fail("limit-invalid", "per-item limits cannot exceed corresponding total limits");
  return freeze(result);
}
function platform(value) {
  if (value === undefined) return null;
  record(value, "platform");
  const keys = Object.keys(value).sort().join("\0"), expected = (value.variant === undefined ? ["architecture", "os"] : ["architecture", "os", "variant"]).sort().join("\0");
  if (keys !== expected || !/^[a-z0-9][a-z0-9_-]*$/u.test(value.os ?? "") || !/^[a-z0-9][a-z0-9_-]*$/u.test(value.architecture ?? "") || value.variant !== undefined && !/^[a-z0-9][a-z0-9._-]*$/u.test(value.variant)) fail("platform-invalid", "platform must be exact os, architecture, and optional variant tokens");
  return freeze({ os: value.os, architecture: value.architecture, ...(value.variant === undefined ? {} : { variant: value.variant }) });
}
function parseReference(value) {
  const matched = REFERENCE.exec(String(value ?? ""));
  if (!matched) fail("reference-invalid", "image reference must be registry/repository@sha256:digest with no tag");
  return freeze(matched.groups);
}
function authority(value) {
  if (value?.type !== "OciDistributionReadAuthority" || value.version !== 1 || !CONTENT_ID.test(value.id ?? "") || typeof value.readManifest !== "function" || typeof value.readBlob !== "function") fail("read-authority-invalid", "an explicit content-addressed OCI Distribution read authority is required");
  return value;
}
function splitChallengeParameters(source) {
  const rows = []; let start = 0, quoted = false, escaped = false;
  for (let index = 0; index <= source.length; index += 1) {
    const character = source[index];
    if (escaped) escaped = false;
    else if (character === "\\" && quoted) escaped = true;
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted || index === source.length) { rows.push(source.slice(start, index).trim()); start = index + 1; }
  }
  if (quoted || escaped || rows.some((row) => row === "")) fail("bearer-challenge-invalid", "Bearer challenge parameters are malformed");
  return rows;
}
function parseBearerChallenge(source, expectedScope) {
  const matched = /^Bearer\s+(.+)$/iu.exec(source ?? "");
  if (!matched) fail("bearer-challenge-invalid", "registry did not provide one Bearer challenge");
  const parameters = {};
  for (const row of splitChallengeParameters(matched[1])) {
    const pair = /^([A-Za-z][A-Za-z0-9_-]*)=("(?:[^"\\]|\\["\\])*"|[^\s,]+)$/u.exec(row);
    if (!pair) fail("bearer-challenge-invalid", "Bearer challenge parameter is malformed");
    const key = pair[1].toLowerCase(); if (Object.hasOwn(parameters, key)) fail("bearer-challenge-invalid", `duplicate Bearer ${key} parameter`);
    parameters[key] = pair[2].startsWith('"') ? pair[2].slice(1, -1).replace(/\\(["\\])/gu, "$1") : pair[2];
  }
  if (parameters.scope !== undefined && parameters.scope !== expectedScope) fail("bearer-scope-mismatch", "registry Bearer challenge requested a different scope");
  let realm;
  try { realm = new URL(parameters.realm); } catch { fail("bearer-realm-invalid", "Bearer challenge realm is not an absolute URL"); }
  if (realm.protocol !== "https:" || realm.username !== "" || realm.password !== "") fail("bearer-realm-invalid", "Bearer challenge realm must be credential-free HTTPS");
  return { realm, service: parameters.service ?? null, scope: expectedScope };
}
async function* boundedResponseBody(body, limit, label) {
  let total = 0;
  const source = body instanceof Uint8Array || typeof body === "string" ? [body] : body;
  if (!source || typeof source[Symbol.asyncIterator] !== "function" && typeof source[Symbol.iterator] !== "function") fail("registry-response-invalid", `${label} body is not a byte carrier`);
  for await (const chunk of source) {
    const bytes = typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk);
    total += bytes.length; if (total > limit) fail("authority-byte-limit-exceeded", `${label} exceeds authority limit ${limit}`);
    yield bytes;
  }
}
export function createOciDistributionHttpReadAuthority(options = {}, injected = {}) {
  record(options, "HTTP read authority options"); record(injected, "HTTP read authority injections");
  exactKeys(options, ["registry", "repository", "authMode", "manifestResponseBytes", "blobResponseBytes", "tokenResponseBytes", "maxRedirects"], "HTTP read authority options");
  exactKeys(injected, ["fetch", "tokenProvider"], "HTTP read authority injections");
  const parsed = parseReference(`${options.registry}/${options.repository}@sha256:${"0".repeat(64)}`);
  if (parsed.registry !== options.registry || parsed.repository !== options.repository) fail("http-authority-binding-invalid", "registry and repository must be exact OCI reference components");
  const authMode = options.authMode ?? "anonymous";
  if (!["anonymous", "provider"].includes(authMode)) fail("http-authority-auth-mode-invalid", "authMode must be anonymous or provider");
  if (authMode === "provider" && typeof injected.tokenProvider !== "function") fail("http-authority-token-provider-required", "provider authMode requires an injected tokenProvider");
  if (authMode === "anonymous" && injected.tokenProvider !== undefined) fail("http-authority-token-provider-forbidden", "anonymous authMode does not admit a tokenProvider");
  const fetchImplementation = injected.fetch ?? globalThis.fetch;
  if (typeof fetchImplementation !== "function") fail("http-authority-fetch-required", "an HTTPS fetch implementation is required");
  const limits = freeze({
    manifestResponseBytes: integer(options.manifestResponseBytes ?? DEFAULT_LIMITS.manifestBytes, 1, Number.MAX_SAFE_INTEGER, "manifestResponseBytes"),
    blobResponseBytes: integer(options.blobResponseBytes ?? DEFAULT_LIMITS.uncompressedLayerBytes, 1, Number.MAX_SAFE_INTEGER, "blobResponseBytes"),
    tokenResponseBytes: integer(options.tokenResponseBytes ?? 1024 * 1024, 1, Number.MAX_SAFE_INTEGER, "tokenResponseBytes"),
    maxRedirects: integer(options.maxRedirects ?? 3, 0, 8, "maxRedirects"),
  });
  const identity = { type: "OciDistributionHttpReadAuthorityIdentity", version: 1, protocol: "https", registry: parsed.registry, repository: parsed.repository, authMode, limits, redirectPolicy: { sameOriginAuthorization: "forward", crossOriginAuthorization: "omit" } };
  const expectedScope = `repository:${parsed.repository}:pull`;
  const registryOrigin = new URL(`https://${parsed.registry}`).origin;
  const fetchWithRedirects = async (initialUrl, accept, initialAuthorization = null) => {
    let url = new URL(initialUrl), authorization = initialAuthorization;
    const visited = new Set([url.href]), redirectStatuses = new Set([301, 302, 303, 307, 308]);
    for (let redirects = 0; ; redirects += 1) {
      const requestHeaders = { Accept: accept };
      if (authorization !== null) requestHeaders.Authorization = `Bearer ${authorization}`;
      const response = await fetchImplementation(url, { method: "GET", headers: requestHeaders, redirect: "manual" });
      if (!redirectStatuses.has(response.status)) return { response, url, redirects };
      if (redirects >= limits.maxRedirects) fail("registry-redirect-limit-exceeded", `registry response exceeds ${limits.maxRedirects} redirects`);
      const location = response.headers?.get?.("location");
      if (location === null || location === undefined || location === "") fail("registry-redirect-location-missing", "registry redirect has no Location");
      let next;
      try { next = new URL(location, url); } catch { fail("registry-redirect-location-invalid", "registry redirect Location is invalid"); }
      if (next.protocol !== "https:" || next.username !== "" || next.password !== "" || location.includes("#")) fail("registry-redirect-location-invalid", "registry redirect Location must be credential-free fragment-free HTTPS");
      if (visited.has(next.href)) fail("registry-redirect-loop", "registry redirect repeats an already visited URL");
      visited.add(next.href);
      if (next.origin !== url.origin) authorization = null;
      await response.body?.cancel?.();
      url = next;
    }
  };
  const tokenFor = async (challenge) => {
    if (authMode === "provider") {
      const token = await injected.tokenProvider({ registry: parsed.registry, repository: parsed.repository, realm: challenge.realm.href, service: challenge.service, scope: expectedScope });
      if (typeof token !== "string" || token === "" || Buffer.byteLength(token) > limits.tokenResponseBytes || /[\r\n]/u.test(token)) fail("bearer-token-invalid", "tokenProvider did not return one bounded header-safe token");
      return token;
    }
    const tokenUrl = new URL(challenge.realm);
    if (challenge.service !== null) tokenUrl.searchParams.set("service", challenge.service);
    tokenUrl.searchParams.set("scope", expectedScope);
    const response = await fetchImplementation(tokenUrl, { method: "GET", headers: { Accept: "application/json" }, redirect: "error" });
    if (response.status !== 200) fail("anonymous-token-read-refused", `anonymous token endpoint returned ${response.status}`);
    const tokenBytes = await boundedBody(boundedResponseBody(response.body, limits.tokenResponseBytes, "token response"), limits.tokenResponseBytes, "token response");
    const value = JSON.parse(decodeUtf8(tokenBytes, "token response"));
    if (value?.token !== undefined && value.access_token !== undefined && value.token !== value.access_token) fail("bearer-token-invalid", "anonymous token response has contradictory token fields");
    const token = value?.token ?? value?.access_token;
    if (typeof token !== "string" || token === "" || /[\r\n]/u.test(token)) fail("bearer-token-invalid", "anonymous token response has no header-safe token");
    return token;
  };
  const read = async (request, kind) => {
    if (request?.registry !== parsed.registry || request.repository !== parsed.repository || !DIGEST.test(request.digest ?? "")) fail("http-authority-request-out-of-scope", "read request is outside the authority's registry/repository/digest binding");
    const accept = kind === "manifest" ? ACCEPT.join(", ") : "application/octet-stream";
    if (kind === "manifest" && (request.accept === undefined || canonical(request.accept) !== canonical(ACCEPT))) fail("http-authority-accept-invalid", "manifest read must request the complete owned OCI/Docker media-type set");
    const url = new URL(`https://${parsed.registry}/v2/${parsed.repository}/${kind === "manifest" ? "manifests" : "blobs"}/${request.digest}`);
    let fetched = await fetchWithRedirects(url, accept), { response } = fetched;
    if (response.status === 401) {
      if (fetched.redirects !== 0 || fetched.url.origin !== registryOrigin) fail("bearer-challenge-out-of-scope", "Bearer challenge did not come from the bound registry request");
      const challenge = parseBearerChallenge(response.headers?.get?.("www-authenticate") ?? null, expectedScope), token = await tokenFor(challenge);
      await response.body?.cancel?.();
      fetched = await fetchWithRedirects(url, accept, token); response = fetched.response;
    }
    const limit = kind === "manifest" ? limits.manifestResponseBytes : limits.blobResponseBytes;
    const declaredLength = response.headers?.get?.("content-length");
    if (declaredLength !== null && declaredLength !== undefined && (!/^\d+$/u.test(declaredLength) || Number(declaredLength) > limit)) fail("authority-byte-limit-exceeded", `${kind} Content-Length exceeds authority limit`);
    return { status: response.status, headers: response.headers, body: boundedResponseBody(response.body, limit, `${kind} response`) };
  };
  return Object.freeze({
    type: "OciDistributionReadAuthority", version: 1, id: contentId(identity), identity: freeze(identity),
    readManifest: (request) => read(request, "manifest"), readBlob: (request) => read(request, "blob"),
  });
}
async function boundedBody(body, limit, label) {
  const chunks = []; let total = 0;
  const source = body instanceof Uint8Array || typeof body === "string" ? [body] : body;
  if (!source || typeof source[Symbol.asyncIterator] !== "function" && typeof source[Symbol.iterator] !== "function") fail("registry-response-invalid", `${label} body is not a byte carrier`);
  for await (const chunk of source) {
    const bytes = typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk);
    total += bytes.length; if (total > limit) fail("byte-limit-exceeded", `${label} exceeds ${limit} bytes`); chunks.push(bytes);
  }
  return Buffer.concat(chunks, total);
}
function headers(value) {
  const source = value ?? {};
  const get = (name) => typeof source.get === "function" ? source.get(name) : source[name] ?? source[name.toLowerCase()] ?? source[Object.keys(source).find((key) => key.toLowerCase() === name.toLowerCase())];
  return { contentType: get("content-type")?.split(";", 1)[0]?.trim() ?? null, digest: get("docker-content-digest") ?? null };
}
function verifyDescriptor(bytes, descriptor, label) {
  record(descriptor, `${label} descriptor`);
  if (!DIGEST.test(descriptor.digest ?? "") || !Number.isSafeInteger(descriptor.size) || descriptor.size < 0 || bytes.length !== descriptor.size || sha256Digest(bytes) !== descriptor.digest) fail("descriptor-mismatch", `${label} bytes disagree with their descriptor`);
}
async function readManifest(read, target, digest, limit) {
  const response = record(await read.readManifest({ registry: target.registry, repository: target.repository, digest, accept: ACCEPT }), "manifest response");
  if (response.status !== 200) fail("registry-read-refused", `registry returned ${response.status} for manifest ${digest}`);
  const bytes = await boundedBody(response.body, limit, "manifest"), observedHeaders = headers(response.headers);
  if (sha256Digest(bytes) !== digest || observedHeaders.digest !== null && observedHeaders.digest !== digest) fail("manifest-digest-mismatch", "manifest bytes or Docker-Content-Digest disagree with requested digest");
  const value = JSON.parse(decodeUtf8(bytes, "manifest"));
  if (value.mediaType !== undefined && observedHeaders.contentType !== null && value.mediaType !== observedHeaders.contentType) fail("manifest-media-type-mismatch", "manifest Content-Type disagrees with its mediaType");
  return { bytes, value, mediaType: value.mediaType ?? observedHeaders.contentType, digest };
}
async function readBlob(read, target, descriptor, limit, label) {
  const response = record(await read.readBlob({ registry: target.registry, repository: target.repository, digest: descriptor.digest }), `${label} response`);
  if (response.status !== 200) fail("registry-read-refused", `registry returned ${response.status} for ${label}`);
  const bytes = await boundedBody(response.body, limit, label), observedHeaders = headers(response.headers);
  verifyDescriptor(bytes, descriptor, label);
  if (observedHeaders.digest !== null && observedHeaders.digest !== descriptor.digest) fail("blob-digest-mismatch", `${label} Docker-Content-Digest disagrees with descriptor`);
  return bytes;
}
function descriptor(value, label) {
  record(value, label);
  if (typeof value.mediaType !== "string" || !DIGEST.test(value.digest ?? "") || !Number.isSafeInteger(value.size) || value.size < 0) fail("descriptor-invalid", `${label} is not one exact OCI descriptor`);
  return freeze({ mediaType: value.mediaType, digest: value.digest, size: value.size });
}
function selectedDescriptors(index, requested, maximum) {
  if (!Array.isArray(index.manifests)) fail("index-invalid", "image index has no manifests array");
  if (index.manifests.length > maximum) fail("platform-descriptor-limit-exceeded", `image index has more than ${maximum} platform descriptors`);
  const rows = index.manifests.map((entry) => ({ descriptor: descriptor(entry, "index manifest"), platform: entry.platform }));
  if (requested === null) return rows;
  const matches = rows.filter(({ platform: candidate }) => candidate?.os === requested.os && candidate.architecture === requested.architecture && (requested.variant === undefined || candidate.variant === requested.variant));
  if (matches.length !== 1) fail("platform-selection-unresolved", `image index has ${matches.length} exact matches for requested platform`);
  return matches;
}
async function gunzip(bytes, limit) {
  const stream = Readable.from([bytes]).pipe(createGunzip()), chunks = []; let total = 0;
  try {
    for await (const chunk of stream) { total += chunk.length; if (total > limit) { stream.destroy(); fail("decompression-limit-exceeded", `uncompressed layer exceeds ${limit} bytes`); } chunks.push(Buffer.from(chunk)); }
  } catch (error) { if (error?.code === "decompression-limit-exceeded") throw error; fail("layer-compression-invalid", `gzip layer cannot be decompressed: ${error.message}`); }
  return Buffer.concat(chunks, total);
}
function tarText(block, start, length) { const field = block.subarray(start, start + length), end = field.indexOf(0); return decodeUtf8(end < 0 ? field : field.subarray(0, end), "tar text field"); }
function tarNumber(block, start, length, label) {
  const bytes = block.subarray(start, start + length);
  if ((bytes[0] & 0x80) !== 0) fail("tar-unsupported", `${label} uses unsupported base-256 encoding`);
  const source = bytes.toString("ascii").replace(/\0.*$/su, "").trim();
  if (source === "") return 0;
  if (!/^[0-7]+$/u.test(source)) fail("tar-invalid", `${label} is not octal`);
  const value = Number.parseInt(source, 8); if (!Number.isSafeInteger(value)) fail("tar-invalid", `${label} exceeds safe integer range`); return value;
}
function normalizeTarPath(value, label) {
  let path = String(value).replace(/^\.\//u, "").replace(/\/$/u, "");
  if (path === "") return "";
  if (path.startsWith("/") || path.includes("\\") || path.split("/").some((part) => part === "" || part === "." || part === "..") || /[\0\r\n]/u.test(path)) fail("tar-path-traversal", `${label} escapes or is not a canonical relative path`);
  return path;
}
function normalizeTarLink(value) {
  const link = String(value);
  if (link === "" || link.includes("\\") || /[\0\r\n]/u.test(link)) fail("tar-link-invalid", "tar link target is empty or contains forbidden bytes");
  return link;
}
function pax(bytes) {
  const result = Object.create(null); let offset = 0;
  while (offset < bytes.length) {
    const space = bytes.indexOf(0x20, offset); if (space < 0) fail("tar-pax-invalid", "PAX record has no length separator");
    const length = Number(bytes.subarray(offset, space).toString("ascii"));
    if (!Number.isSafeInteger(length) || length <= space - offset + 2 || offset + length > bytes.length || bytes[offset + length - 1] !== 0x0a) fail("tar-pax-invalid", "PAX record length is invalid");
    const row = decodeUtf8(bytes.subarray(space + 1, offset + length - 1), "PAX record"), equals = row.indexOf("=");
    if (equals < 1) fail("tar-pax-invalid", "PAX record has no key"); result[row.slice(0, equals)] = row.slice(equals + 1); offset += length;
  }
  return result;
}
function validatePaxMetadata(value) {
  const nonFilesystemKeys = new Set(["atime", "charset", "comment", "ctime", "gname", "mtime", "uname"]), ownedKeys = new Set(["gid", "linkpath", "path", "uid"]);
  for (const key of Object.keys(value)) if (key === "size" || !ownedKeys.has(key) && !nonFilesystemKeys.has(key)) fail("tar-pax-unsupported", `PAX key ${key} changes unsupported filesystem semantics`);
}
function tarEntries(bytes, layerIndex, limits, budget) {
  const entries = []; let offset = 0, nextPax = {}, globalPax = {}, longName = null, longLink = null, zeroBlocks = 0;
  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512); offset += 512;
    if (header.every((byte) => byte === 0)) { zeroBlocks += 1; if (zeroBlocks === 2) break; continue; } zeroBlocks = 0;
    const stored = tarNumber(header, 148, 8, "tar checksum"), copy = Buffer.from(header); copy.fill(0x20, 148, 156);
    const computed = [...copy].reduce((sum, byte) => sum + byte, 0); if (stored !== computed) fail("tar-checksum-invalid", "tar header checksum is invalid");
    const rawSize = tarNumber(header, 124, 12, "tar entry size"), padded = Math.ceil(rawSize / 512) * 512;
    if (offset + padded > bytes.length) fail("tar-truncated", "tar entry content is truncated");
    const content = bytes.subarray(offset, offset + rawSize); offset += padded;
    const type = String.fromCharCode(header[156] || 0x30), prefix = tarText(header, 345, 155), headerName = tarText(header, 0, 100), headerLink = tarText(header, 157, 100);
    if (type === "x" || type === "g") { const parsed = pax(content); if (type === "g") globalPax = { ...globalPax, ...parsed }; else nextPax = parsed; continue; }
    if (type === "L") { longName = decodeUtf8(content, "GNU long path").replace(/\0.*$/su, ""); continue; }
    if (type === "K") { longLink = decodeUtf8(content, "GNU long link").replace(/\0.*$/su, ""); continue; }
    const metadata = { ...globalPax, ...nextPax }; nextPax = {}; validatePaxMetadata(metadata);
    const rawName = metadata.path ?? longName ?? (prefix ? `${prefix}/${headerName}` : headerName), rawLink = metadata.linkpath ?? longLink ?? headerLink; longName = null; longLink = null;
    const path = normalizeTarPath(rawName, "tar entry"), link = rawLink === "" ? null : normalizeTarLink(rawLink);
    const numeric = (candidate, fallback, label) => candidate === undefined ? fallback : (/^[0-9]+$/u.test(candidate) ? Number(candidate) : fail("tar-pax-invalid", `${label} PAX value is invalid`));
    const uid = numeric(metadata.uid, tarNumber(header, 108, 8, "tar UID"), "uid"), gid = numeric(metadata.gid, tarNumber(header, 116, 8, "tar GID"), "gid"), mode = tarNumber(header, 100, 8, "tar mode");
    const deviceMajor = tarNumber(header, 329, 8, "tar device major"), deviceMinor = tarNumber(header, 337, 8, "tar device minor");
    if (![uid, gid].every(Number.isSafeInteger)) fail("tar-invalid", "tar identity exceeds safe integer range");
    budget.entries += 1; if (budget.entries > limits.entries) fail("entry-limit-exceeded", `layer entries exceed ${limits.entries}`);
    const kind = ({ "0": "file", "\0": "file", "1": "hardlink", "2": "symlink", "3": "character-device", "4": "block-device", "5": "directory", "6": "fifo", "7": "file" })[type];
    if (kind === undefined) fail("tar-unsupported", `unsupported tar entry type ${JSON.stringify(type)}`);
    if (path === "" && kind !== "directory") fail("tar-path-empty", "non-directory tar entries must have a non-empty path");
    entries.push({ path, kind, mode, uid, gid, link, bytes: rawSize, content: kind === "file" ? content : null, contentDigest: kind === "file" ? sha256Digest(content) : null, deviceMajor: kind === "character-device" || kind === "block-device" ? deviceMajor : null, deviceMinor: kind === "character-device" || kind === "block-device" ? deviceMinor : null, layerIndex });
  }
  return entries;
}
function removeTree(rootfs, path, maximumLayer) {
  for (const [candidate, entry] of rootfs) if (entry.layerIndex < maximumLayer && (candidate === path || candidate.startsWith(`${path}/`))) rootfs.delete(candidate);
}
function resolveRootfsPath(rootfs, initial, followFinal = true) {
  let pending = initial === "" ? [] : initial.split("/"), resolved = [];
  const seen = new Set();
  while (pending.length > 0) {
    const component = pending.shift(), candidate = [...resolved, component].join("/"), entry = rootfs.get(candidate), final = pending.length === 0;
    if (entry?.kind === "symlink" && (followFinal || !final)) {
      const state = `${candidate}\0${pending.join("/")}`;
      if (seen.has(state) || seen.size >= 80) fail("rootfs-link-cycle", `rootfs link cycle while resolving ${initial}`);
      seen.add(state);
      const target = posix.resolve("/", `/${resolved.join("/")}`, entry.link).slice(1);
      pending = [...(target === "" ? [] : target.split("/")), ...pending]; resolved = []; continue;
    }
    if (!final && entry !== undefined && entry.kind !== "directory") fail("rootfs-parent-not-directory", `${initial} has a non-directory ancestor`);
    resolved.push(component);
  }
  const path = resolved.join("/");
  return { path, entry: rootfs.get(path) ?? null };
}
function resolveEntryPath(rootfs, initial) {
  const slash = initial.lastIndexOf("/"), parent = slash < 0 ? "" : initial.slice(0, slash), name = slash < 0 ? initial : initial.slice(slash + 1);
  const resolved = resolveRootfsPath(rootfs, parent, true);
  if (resolved.entry !== null && resolved.entry.kind !== "directory") fail("rootfs-parent-not-directory", `${initial} has a non-directory parent`);
  return resolved.path === "" ? name : `${resolved.path}/${name}`;
}
function applyLayer(rootfs, entries, layerIndex) {
  for (const rawEntry of entries) {
    const entry = { ...rawEntry, path: resolveEntryPath(rootfs, rawEntry.path) };
    const name = entry.path.slice(entry.path.lastIndexOf("/") + 1), parent = entry.path.includes("/") ? entry.path.slice(0, entry.path.lastIndexOf("/")) : "";
    if (name === ".wh..wh..opq") { for (const [candidate, prior] of rootfs) if (prior.layerIndex < layerIndex && candidate.startsWith(parent ? `${parent}/` : "")) rootfs.delete(candidate); }
    else if (name.startsWith(".wh.")) { const targetName = name.slice(4); if (targetName === "") fail("whiteout-invalid", "whiteout has no target basename"); removeTree(rootfs, parent ? `${parent}/${targetName}` : targetName, layerIndex); }
  }
  for (const rawEntry of entries) {
    const entry = { ...rawEntry, path: resolveEntryPath(rootfs, rawEntry.path) };
    const name = entry.path.slice(entry.path.lastIndexOf("/") + 1); if (name.startsWith(".wh.")) continue;
    const prior = rootfs.get(entry.path); if (prior !== undefined && !(prior.kind === "directory" && entry.kind === "directory")) removeTree(rootfs, entry.path, Number.POSITIVE_INFINITY);
    if (entry.kind === "hardlink") {
      const targetPath = posix.resolve("/", entry.link).slice(1), target = resolveFile(rootfs, targetPath);
      if (target === null) fail("hardlink-target-unresolved", `${entry.path} hardlink target does not name an existing regular file`);
      rootfs.set(entry.path, { ...entry, mode: target.mode, uid: target.uid, gid: target.gid, bytes: target.bytes, content: target.content, contentDigest: target.contentDigest });
    } else rootfs.set(entry.path, entry);
  }
}
function resolveFile(rootfs, initial) {
  const { entry } = resolveRootfsPath(rootfs, initial, true);
  if (entry?.kind === "file" || entry?.kind === "hardlink" && entry.contentDigest !== null) return entry;
  return null;
}
function utf8(entry, label) {
  if (!entry || entry.content === null) return null;
  return decodeUtf8(entry.content, label);
}
function accountObservation(rootfs) {
  const passwdEntry = resolveFile(rootfs, "etc/passwd"), groupEntry = resolveFile(rootfs, "etc/group"), uids = new Set(), gids = new Set();
  const passwd = utf8(passwdEntry, "/etc/passwd"), group = utf8(groupEntry, "/etc/group");
  const unresolved = [...(passwdEntry && passwd === null ? ["passwd-content-not-retained"] : []), ...(groupEntry && group === null ? ["group-content-not-retained"] : [])];
  if (passwd !== null) for (const [index, line] of passwd.split("\n").entries()) if (line && !line.startsWith("#")) { const fields = line.split(":"); if (fields.length !== 7 || !/^\d+$/u.test(fields[2]) || !/^\d+$/u.test(fields[3]) || !Number.isSafeInteger(Number(fields[2])) || !Number.isSafeInteger(Number(fields[3]))) fail("passwd-invalid", `/etc/passwd line ${index + 1} is invalid`); uids.add(Number(fields[2])); gids.add(Number(fields[3])); }
  if (group !== null) for (const [index, line] of group.split("\n").entries()) if (line && !line.startsWith("#")) { const fields = line.split(":"); if (fields.length !== 4 || !/^\d+$/u.test(fields[2]) || !Number.isSafeInteger(Number(fields[2]))) fail("group-invalid", `/etc/group line ${index + 1} is invalid`); gids.add(Number(fields[2])); }
  return { uids: [...uids].sort((a, b) => a - b), gids: [...gids].sort((a, b) => a - b), unresolved, evidence: { passwd: passwdEntry?.contentDigest ?? null, group: groupEntry?.contentDigest ?? null } };
}
function configUser(value) {
  const source = value?.config?.User;
  if (typeof source !== "string" || source === "") return { raw: source ?? null, uid: null, gid: null, unresolved: source ? ["named-config-user"] : [] };
  const fields = source.split(":");
  if (fields.length > 2 || fields.some((field) => field === "")) return { raw: source, uid: null, gid: null, unresolved: ["invalid-config-user"] };
  const [user, group] = fields, numericUser = /^\d+$/u.test(user) && Number.isSafeInteger(Number(user)), numericGroup = group !== undefined && /^\d+$/u.test(group) && Number.isSafeInteger(Number(group));
  return { raw: source, uid: numericUser ? Number(user) : null, gid: numericGroup ? Number(group) : null, unresolved: [...(!numericUser ? ["named-or-out-of-range-config-user"] : []), ...(group !== undefined && !numericGroup ? ["named-or-out-of-range-config-group"] : [])] };
}
function nodeObservation(config, rootfs) {
  const environment = Array.isArray(config?.config?.Env) ? config.config.Env : [];
  const rows = environment.filter((entry) => typeof entry === "string" && entry.startsWith("NODE_VERSION="));
  const envVersion = rows.length === 1 && /^NODE_VERSION=(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.test(rows[0]) ? rows[0].slice(13) : null;
  const header = resolveFile(rootfs, "usr/local/include/node/node_version.h"), source = utf8(header, "Node version header");
  const macro = (name) => source?.match(new RegExp(`^#define\\s+${name}\\s+(0|[1-9][0-9]*)\\s*$`, "mu"))?.[1] ?? null;
  const parts = [macro("NODE_MAJOR_VERSION"), macro("NODE_MINOR_VERSION"), macro("NODE_PATCH_VERSION")];
  const headerVersion = parts.every((part) => part !== null) ? parts.join(".") : null;
  if (envVersion !== null && headerVersion !== null && envVersion === headerVersion) return freeze({ status: "observed", version: envVersion, evidence: { configEnvironment: "NODE_VERSION", headerPath: "/usr/local/include/node/node_version.h", headerDigest: header.contentDigest } });
  return freeze({ status: "unresolved", version: null, code: envVersion !== null && headerVersion !== null ? "node-version-evidence-disagrees" : "node-version-evidence-incomplete", evidence: { environmentVersion: envVersion, headerVersion, headerDigest: header?.contentDigest ?? null } });
}
function osRelease(source) {
  const result = {};
  for (const [index, line] of source.split("\n").entries()) {
    if (line === "" || line.startsWith("#")) continue;
    const matched = /^([A-Z][A-Z0-9_]*)=(.*)$/u.exec(line); if (!matched) fail("os-release-invalid", `/etc/os-release line ${index + 1} is invalid`);
    let value = matched[2]; if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    if (/[$`\\]/u.test(value)) fail("os-release-invalid", "/etc/os-release contains shell expansion syntax"); result[matched[1]] = value;
  }
  return result;
}
function debianObservation(rootfs) {
  const release = resolveFile(rootfs, "etc/os-release") ?? resolveFile(rootfs, "usr/lib/os-release"), source = utf8(release, "os-release");
  if (source === null) return freeze({ status: "unresolved", suite: null, code: "os-release-absent", evidence: null });
  const value = osRelease(source);
  if (value.ID === "debian" && /^[a-z][a-z0-9_-]*$/u.test(value.VERSION_CODENAME ?? "")) {
    const version = resolveFile(rootfs, "etc/debian_version");
    return freeze({ status: "observed", suite: value.VERSION_CODENAME, evidence: { osReleaseDigest: release.contentDigest, debianVersionDigest: version?.contentDigest ?? null } });
  }
  return freeze({ status: "unresolved", suite: null, code: "not-static-debian-suite", evidence: { osReleaseDigest: release.contentDigest, id: value.ID ?? null, codename: value.VERSION_CODENAME ?? null } });
}
const EVIDENCE_PATHS = Object.freeze(["etc/passwd", "etc/group", "etc/os-release", "usr/lib/os-release", "etc/debian_version", "usr/local/include/node/node_version.h"]);
function retainEvidenceBytes(rootfs, limits) {
  const evidenceEntries = new Set(EVIDENCE_PATHS.map((path) => resolveFile(rootfs, path)).filter((entry) => entry !== null));
  let retained = 0;
  const copies = new Map();
  for (const entry of evidenceEntries) {
    if (entry.content === null || entry.bytes > limits.evidenceFileBytes || retained + entry.bytes > limits.totalEvidenceBytes) copies.set(entry, null);
    else { const copy = Buffer.from(entry.content); retained += copy.length; copies.set(entry, copy); }
  }
  for (const entry of rootfs.values()) if (entry.kind === "file" || entry.kind === "hardlink") entry.content = copies.get(entry) ?? null;
}
function rootfsObservation(rootfs, config) {
  const files = [...rootfs].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([path, entry]) => ({ path: path === "" ? "/" : path, kind: entry.kind, mode: entry.mode, uid: entry.uid, gid: entry.gid, bytes: entry.bytes, contentDigest: entry.contentDigest, link: entry.link, deviceMajor: entry.deviceMajor, deviceMinor: entry.deviceMinor }));
  const filesystemUids = [...new Set(files.map(({ uid }) => uid))].sort((a, b) => a - b), filesystemGids = [...new Set(files.map(({ gid }) => gid))].sort((a, b) => a - b);
  const accounts = accountObservation(rootfs), user = configUser(config), accountUids = [...new Set([...accounts.uids, ...(user.uid === null ? [] : [user.uid])])].sort((a, b) => a - b), accountGids = [...new Set([...accounts.gids, ...(user.gid === null ? [] : [user.gid])])].sort((a, b) => a - b);
  const body = { type: "OciFinalRootfsObservation", version: 1, files, occupied: { accounts: { uids: accountUids, gids: accountGids }, filesystemOwners: { uids: filesystemUids, gids: filesystemGids }, union: { uids: [...new Set([...accountUids, ...filesystemUids])].sort((a, b) => a - b), gids: [...new Set([...accountGids, ...filesystemGids])].sort((a, b) => a - b) }, configUser: user, unresolved: ["dynamic-nss-identities", ...accounts.unresolved, ...user.unresolved] }, accountEvidence: accounts.evidence };
  return freeze({ id: contentId(body), ...body });
}
async function observeManifest(target, read, manifestRecord, parentIndex, selectedPlatform, limits, budget) {
  if (![OCI_MANIFEST, DOCKER_MANIFEST].includes(manifestRecord.mediaType) || manifestRecord.value.schemaVersion !== 2) fail("manifest-invalid", "selected document is not an OCI/Docker image manifest v2");
  const configDescriptor = descriptor(manifestRecord.value.config, "image config");
  if (![OCI_CONFIG, DOCKER_CONFIG].includes(configDescriptor.mediaType)) fail("config-media-type-unsupported", `unsupported image config media type ${configDescriptor.mediaType}`);
  const configBytes = await readBlob(read, target, configDescriptor, limits.configBytes, "image config"), config = JSON.parse(decodeUtf8(configBytes, "image config"));
  if (!/^[a-z0-9][a-z0-9_-]*$/u.test(config.os ?? "") || !/^[a-z0-9][a-z0-9_-]*$/u.test(config.architecture ?? "")) fail("config-platform-invalid", "image config has no exact os and architecture");
  const observedPlatform = { os: config.os, architecture: config.architecture, ...(config.variant === undefined ? {} : { variant: config.variant }) };
  if (selectedPlatform !== null && (observedPlatform.os !== selectedPlatform.os || observedPlatform.architecture !== selectedPlatform.architecture || selectedPlatform.variant !== undefined && observedPlatform.variant !== selectedPlatform.variant)) fail("config-platform-mismatch", "selected descriptor platform disagrees with image config");
  const layers = manifestRecord.value.layers?.map((entry) => descriptor(entry, "image layer"));
  if (!Array.isArray(layers) || !Array.isArray(config.rootfs?.diff_ids) || config.rootfs.type !== "layers" || layers.length !== config.rootfs.diff_ids.length) fail("rootfs-invalid", "manifest layers and config DiffIDs do not agree in count");
  const rootfs = new Map(), layerObservations = [];
  for (const [index, layer] of layers.entries()) {
    if (!TAR.has(layer.mediaType) && !GZIP.has(layer.mediaType)) fail("layer-media-type-unsupported", `unsupported layer media type ${layer.mediaType}`);
    const compressedAllowance = Math.min(limits.compressedLayerBytes, limits.totalCompressedBytes - budget.compressed);
    if (compressedAllowance < 1) fail("byte-limit-exceeded", "total compressed layers exceed limit");
    const compressed = await readBlob(read, target, layer, compressedAllowance, `layer ${index}`); budget.compressed += compressed.length;
    const uncompressedAllowance = Math.min(limits.uncompressedLayerBytes, limits.totalUncompressedBytes - budget.uncompressed);
    if (uncompressedAllowance < 1) fail("decompression-limit-exceeded", "total uncompressed layers exceed limit");
    const unpacked = GZIP.has(layer.mediaType) ? await gunzip(compressed, uncompressedAllowance) : compressed;
    if (unpacked.length > limits.uncompressedLayerBytes) fail("decompression-limit-exceeded", `layer ${index} exceeds uncompressed limit`); budget.uncompressed += unpacked.length; if (budget.uncompressed > limits.totalUncompressedBytes) fail("decompression-limit-exceeded", "total uncompressed layers exceed limit");
    const diffId = sha256Digest(unpacked); if (diffId !== config.rootfs.diff_ids[index]) fail("diffid-mismatch", `layer ${index} uncompressed DiffID disagrees with image config`);
    const entries = tarEntries(unpacked, index, limits, budget); applyLayer(rootfs, entries, index);
    layerObservations.push({ ...layer, diffId, uncompressedBytes: unpacked.length, entries: entries.length });
  }
  retainEvidenceBytes(rootfs, limits);
  const finalRootfs = rootfsObservation(rootfs, config), node = nodeObservation(config, rootfs), debian = debianObservation(rootfs);
  const body = {
    type: "OciImageObservation", version: 1, status: "observed", effects: [], reference: `${target.registry}/${target.repository}@${target.digest}`,
    requestedDigest: target.digest, index: parentIndex, manifest: { digest: manifestRecord.digest, mediaType: manifestRecord.mediaType, bytes: manifestRecord.bytes.length },
    config: { ...configDescriptor, os: config.os, architecture: config.architecture, variant: config.variant ?? null, user: config.config?.User ?? null },
    platform: observedPlatform, layers: layerObservations, finalRootfs, node, debian,
    unresolved: [...finalRootfs.occupied.unresolved, ...(node.status === "unresolved" ? [node.code] : []), ...(debian.status === "unresolved" ? [debian.code] : [])],
    readAuthority: { id: read.id }, limits,
  };
  return freeze({ id: contentId(body), ...body });
}
async function observe(input, injected) {
  record(input, "observation input"); record(injected, "observation injections");
  exactKeys(input, ["reference", "platform", "limits"], "observation input"); exactKeys(injected, ["registryReadAuthority"], "observation injections");
  const target = parseReference(input?.reference), requestedPlatform = platform(input?.platform), limits = normalizeLimits(input?.limits), read = authority(injected?.registryReadAuthority);
  const budget = { compressed: 0, uncompressed: 0, entries: 0 };
  const initial = await readManifest(read, target, target.digest, limits.manifestBytes);
  if ([OCI_MANIFEST, DOCKER_MANIFEST].includes(initial.mediaType)) return observeManifest(target, read, initial, null, requestedPlatform, limits, budget);
  if (![OCI_INDEX, DOCKER_INDEX].includes(initial.mediaType) || initial.value.schemaVersion !== 2) fail("manifest-media-type-unsupported", `unsupported top-level manifest media type ${initial.mediaType}`);
  const choices = selectedDescriptors(initial.value, requestedPlatform, limits.maxPlatformDescriptors), observations = [];
  for (const choice of choices) {
    const child = await readManifest(read, target, choice.descriptor.digest, limits.manifestBytes); verifyDescriptor(child.bytes, choice.descriptor, "selected image manifest");
    const childPlatform = choice.platform === undefined ? null : platform({
      os: choice.platform.os,
      architecture: choice.platform.architecture,
      ...(choice.platform.variant === undefined ? {} : { variant: choice.platform.variant }),
    });
    observations.push(await observeManifest(target, read, child, { digest: initial.digest, mediaType: initial.mediaType, bytes: initial.bytes.length }, childPlatform, limits, budget));
  }
  if (requestedPlatform !== null) return observations[0];
  const body = { type: "OciImageObservationCatalog", version: 1, status: "observed", effects: [], reference: input.reference, index: { digest: initial.digest, mediaType: initial.mediaType, bytes: initial.bytes.length }, observations };
  return freeze({ id: contentId(body), ...body });
}

export async function observeOciImage(input = {}, injected = {}) {
  try { return await observe(input, injected); }
  catch (error) { return refusal("observe", error, typeof input?.reference === "string" && REFERENCE.test(input.reference) ? input.reference : null); }
}

export function verifyOciImageObservationRecord(value) {
  try {
    if (!value || !["OciImageObservation", "OciImageObservationCatalog", "OciImageObservationRefusal"].includes(value.type) || value.version !== 1 || !CONTENT_ID.test(value.id ?? "")) fail("observation-invalid", "value is not one content-addressed OCI observation record");
    const body = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "id"));
    if (contentId(body) !== value.id) fail("observation-invalid", "OCI observation content identity is invalid");
    return freeze(structuredClone(value));
  } catch (error) { return refusal("verify-record", error, value?.reference ?? value?.subject ?? null); }
}

export const OCI_IMAGE_MEDIA_TYPES = ACCEPT;
export const OCI_IMAGE_OBSERVATION_DEFAULT_LIMITS = DEFAULT_LIMITS;
