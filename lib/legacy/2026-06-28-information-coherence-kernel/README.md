# @emsenn/information-coherence-kernel

The **Information Coherence Kernel (ICK)** is one served manifold face over the nine core faculties, for sites to mount.
It is the flagship of this repo: an *operating system for coherent information*.
The thesis is that ~20 wire protocols are not 20 integrations but **20 readings of ONE witness ledger, served behind ONE stable API** — so an Activity, a cell, an invocation, a payment receipt, and a chat message are provably the same object underneath and compose without glue.

For the full account read the whitepaper, [`dev/content/researching/papers/2026-06-26-ick-whitepaper.md`](../../dev/content/researching/papers/2026-06-26-ick-whitepaper.md), and the root [AGENTS.md](../../AGENTS.md).

## The syscall surface — `/<faculty>/<verb>`

The current service exposes the **coproduct of the nine faculties' action apexes** as one flat `/<faculty>/<verb>` mount.
That flat mount is the current operator surface, not a settled claim that this service should ontologically own all faculty composition.
The hierarchy is:

```text
relating
  -> communicating, knowing, playing
  -> animating
  -> socializing, computing, gaming
  -> organizing
```

`relating` is the seed substrate.
`communicating`, `knowing`, and `playing` are its first-generation faculties.
`animating` is their face/binder and should own the realization of their combined capability as a single agent.
`socializing`, `computing`, and `gaming` are animating's collective-scale faculties.
`organizing` is their face/binder and should own the realization of their combined capability as a collective.

The ICK service is the outer served sum/stable process face.
Its current flat mount is useful for sites and operators, but the target composition law should let the face/binder packages (`animating`, `organizing`) mount their own faculties.

The service does not re-export the nine as a bundle; it *induces* one namespaced coproduct apex and serves it through `@emsenn/relating/running`, so HTTP, OpenAPI, MCP, WebUX, discovery, health, and feed all fall out of the same apex with no second ontology.
The smoke report records **261 total actions** with matching CLI / discovery / HTTP / OpenAPI / MCP / WebUX counts across all nine faculties, plus the ICK-owned top-level boundary actions.

The faculty is named *in the verb* deliberately, so the public face stays the flat, stable `/<faculty>/<verb>` site mount rather than a data-flow-tiled nesting.

## API surface

| export | what it does |
|---|---|
| `createIckServer` | the one call a site mounts to get a served ICK boundary |
| `createIckCoproductInduced` | induce the namespaced nine-faculty coproduct apex |
| `createIckCoproductActions` | the coproduct action set behind the mount |
| `createIckMounts` | the shared faces (`/openapi.json`, `/mcp`, `/`, `/discovery`, `/health`, `/feed`) |
| `createInformationCoherenceKernelService` / `InformationCoherenceKernelService` | the service object |
| `createIckSmokeReport` / `ickSummary` | the 261-action smoke report and summary |
| `ICK_HOOK_ADMISSION_VERB` / `ickHookAdmissionActions` | the top-level hook-admission boundary action |
| `ICK_FACULTIES` | the nine faculty names |

Types: `FacultyName`, `IckConfig`, `IckFaceCount`, `IckSmokeReport`, `IckSummary`.

## Bin

| command | what it does |
|---|---|
| `ick` (alias `information-coherence-kernel`) | run the CLI; `ick serve` starts the server; `ick dispatch <verb>` runs and witnesses one syscall from stdin |

## Usage

```ts
import { createIckServer } from "@emsenn/information-coherence-kernel";

// a site mounts ONE service face; the nine faculty packages keep being
// refactored behind it without the site noticing — the ICK is the
// upstream-stable contract boundary (whitepaper §7.3).
const server = createIckServer(/* config */);
```

```sh
pnpm --filter @emsenn/information-coherence-kernel run smoke   # 261-action report
pnpm --filter @emsenn/information-coherence-kernel run serve
printf '{"hook_event_name":"UserPromptSubmit"}' \
  | node services/information-coherence-kernel/dist/cli.mjs dispatch admit-hook-event --output-format json --root sites/dev.bare-cedar-fog.emsenn.net
```

## Subpaths

`.
` (the surface above), `./service`, `./cli`.
See `package.json#exports` for the authoritative list.

## Maturity

**Built+green.** The nine-faculty mount, hook-admission boundary, CLI dispatch witnessing, and the 261-action smoke are tested in-tree.
`ops.
561.group` and `dev.bare-cedar-fog.emsenn.net` both mount the *same* ICK service.
The contradiction-aware federation that makes the kernel more than an integration layer lives in `@emsenn/organizing`; the coherence Reading kernel it rests on lives in `@emsenn/relating/ledger`.
Individual capabilities carry their own maturity tags — see the whitepaper §9 (some bridges are Proven-in-Lean, some Research-grade, the InfoTiles renderer is Roadmap).
