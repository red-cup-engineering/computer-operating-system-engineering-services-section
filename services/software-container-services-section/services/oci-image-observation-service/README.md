# OCI image observation service

This package owns one read-only function:

> an immutable OCI image reference, an optional exact platform, and a bounded
> injected OCI Distribution read authority → a content-addressed observation of
> the selected manifest/config/layers, the final static root filesystem, occupied
> numeric identities, and statically supportable Node and Debian facts.

It does not execute an image, extract a layer onto the host, store credentials,
write registry state, build an image, or make deployment decisions. Its CLI is
anonymous-public only. Private authentication remains an explicitly injected
programmatic capability; there is deliberately no raw-token command-line flag.

## Public API

```js
import {
  createOciDistributionHttpReadAuthority,
  observeOciImage,
  verifyOciImageObservationRecord,
} from "@red-cup-engineering/oci-image-observation-service";

const registryReadAuthority = createOciDistributionHttpReadAuthority({
  registry: "registry.example",
  repository: "team/image",
  authMode: "anonymous",
});

const observation = await observeOciImage(
  {
    reference: "registry.example/team/image@sha256:…",
    platform: { os: "linux", architecture: "amd64" },
    limits: { compressedLayerBytes: 268435456 },
  },
  {
    registryReadAuthority,
  },
);
```

The two injected readers return `{ status, headers, body }`. `body` may be a byte
carrier or a sync/async iterable of byte carriers. Credentials, clients, and
tokens may be closed over by those functions; only the authority's content
identity enters the observation. Reads are bounded before bytes are admitted.

`createOciDistributionHttpReadAuthority` binds one HTTPS registry and repository.
It sends the owned OCI/Docker manifest `Accept` set, parses a 401 Bearer challenge,
requires the exact `repository:<repository>:pull` scope and an HTTPS token realm,
and retries through a small, explicit HTTPS redirect state machine. Redirect
locations must be credential-free and fragment-free; loops, missing locations,
downgrades, and excess hops are refused. Bearer authorization is forwarded across
same-origin redirects and permanently omitted after a cross-origin hop, which
admits Docker Hub's HTTPS blob CDN without lending it registry credentials. The
maximum redirect count and this origin policy are bound into the authority
identity; transient CDN URLs and token bytes are not. Anonymous mode obtains a bounded public
token without sending credentials. Provider mode accepts an injected
`tokenProvider` function for private-registry policy; token bytes remain ephemeral
and are absent from the content-addressed authority identity and observation.

`observeOciImage` always resolves to one of:

- `OciImageObservation`: one platform-specific image;
- `OciImageObservationCatalog`: all entries of an index when no platform was
  requested; or
- `OciImageObservationRefusal`: a typed, content-addressed refusal with no side
  effects.

`verifyOciImageObservationRecord` recomputes the record's content
identity. That is structural/content verification, not proof that a registry
served the record. Authenticity comes from running the observation with the
expected injected read authority, or from separately signed custody of the
result.
Every record uses sorted-key JSON and an RFC 6920-style SHA-256 `ni` ID.

## Observation law

1. Only a digest reference is admitted. Tags are mutable and therefore are not
   observations.
2. The top-level bytes are hashed against the requested digest. Index selection
   must have exactly one matching `os`/`architecture`/optional `variant` when a
   platform is requested. The selected config must agree with that platform.
3. Every config and compressed layer is checked against its descriptor digest
   and size. Every uncompressed layer is checked against the config's DiffID.
4. Tar parsing occurs in memory. Paths are relative names; empty paths
   and traversal are refused. Symlinks are resolved component by component inside
   the synthetic root only, hardlinks snapshot their target inode identity at
   application time, and devices/FIFOs remain inert metadata. None are created or
   followed on the host.
5. Layers are replayed in order. Whiteouts remove only lower-layer entries;
   opaque whiteouts hide the lower contents of their directory. The receipt binds
   every surviving entry's path, kind, mode, numeric owner, byte length, content
   digest, inert link target, and device major/minor where applicable.
6. Occupied numeric IDs are the union of surviving filesystem owners, numeric
   `/etc/passwd` and `/etc/group` records, and numeric `config.User` parts. Named
   `config.User` values and dynamic NSS identities are explicitly unresolved.

This is a static observation, not a claim about runtime behavior. It cannot see
identities synthesized by NSS, files mounted later, package-manager behavior, or
facts created only by starting the image.

## Node and Debian evidence

An exact Node version is observed only when the image config has one exact
`NODE_VERSION=x.y.z` value and the surviving
`/usr/local/include/node/node_version.h` has matching major, minor, and patch
macros. This is deliberately evidence shaped like the official Node image's
construction, not an assertion based on a directory name or image tag. Missing or
contradictory evidence produces a typed unresolved fact.

A Debian suite is observed only from a surviving `/etc/os-release` (or its
`/usr/lib/os-release` fallback) with `ID=debian` and an exact
`VERSION_CODENAME`. `/etc/debian_version` is bound as supporting evidence when
present. The parser does not source the file as shell code.

## Bounds and refusals

Limits cover manifest/config bytes, index descriptor count, compressed bytes per
layer and in total, uncompressed bytes per layer and in total, tar entry count,
and evidence bytes per file/in total. Catalog children share the same total byte
and entry budgets. Every regular file is hashed, while only the six exact evidence
paths and their component-wise resolved targets retain bytes for parsing; an
arbitrary earlier file therefore cannot starve later evidence. Unsupported compression,
base-256 tar numbers, malformed PAX, invalid account databases, digest/DiffID
mismatches, ambiguous platform selection, and limit violations become typed
refusals. No partial observation is returned.

## Primary specifications

- [OCI Distribution Specification](https://github.com/opencontainers/distribution-spec/blob/main/spec.md) — digest-addressed manifest and blob reads.
- [OCI Image Manifest](https://github.com/opencontainers/image-spec/blob/main/manifest.md) — indexes, manifests, configs, layers, and platform descriptors.
- [OCI Image Configuration](https://github.com/opencontainers/image-spec/blob/main/config.md) — platform fields, `rootfs.diff_ids`, and runtime config.
- [OCI Image Layer Filesystem Changeset](https://github.com/opencontainers/image-spec/blob/main/layer.md) — tar layers, whiteouts, and opaque directories.
- [Docker Registry v2 bearer authentication](https://distribution.github.io/distribution/spec/auth/token/) — why authentication belongs to the injected read authority rather than this observation record.
- [Official Node image Dockerfile](https://github.com/nodejs/docker-node/blob/main/24/bookworm/Dockerfile) — the `NODE_VERSION` and installed-header evidence used for static agreement.
- [Node.js release process](https://github.com/nodejs/node/blob/main/doc/contributing/releases.md) — exact Node release-version semantics.

## Verification

`npm run check && npm test && npm pack --dry-run --ignore-scripts` checks syntax, runs the hermetic synthetic-registry suite, and
performs a dry package build. Tests require neither network access nor a container
runtime.

To opt into a live anonymous observation after obtaining the immutable digest
from a trusted release/catalog source, substitute it for `<digest>`:

```sh
node src/cli.mjs --reference registry-1.docker.io/library/node@sha256:<digest> --platform linux/amd64
```

The live command is intentionally outside the hermetic test suite and accepts no
credential argument.
