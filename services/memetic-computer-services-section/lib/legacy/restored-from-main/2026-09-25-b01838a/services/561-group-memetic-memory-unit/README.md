# @561-group/memetic-memory-unit

`@561-group/memetic-memory-unit` is the in-memory memory package for the memetic workspace. It exports a `MemeStore`: an accretive log of `Meme` values addressable by their `cell`.

The package stores and recalls memes. It does not interpret them.

## What this package is

This package is a private ESM TypeScript package for holding raw memetic evidence during a process run.

It provides:

- a `MemeStore` class;
- an `Address` type alias for `Meme["cell"]`;
- append-only storage through `store(meme)`;
- address-based recall through `recall(address)`;
- small inspection helpers: `has(address)`, `cells()`, `size`, and `memes`.

## What this package is not

The memory unit deliberately does not provide:

- charge folding or settlement;
- truth-value, knowledge-order, or contradiction logic;
- validation of unknown input;
- persistence to disk;
- deduplication or overwrite semantics;
- indexes beyond the private in-memory log.

A cell witnessed both ways is stored as two memes. The memory unit keeps the evidence; a processing unit decides how to settle it.

## Install and check

This package is marked private, so it is meant to be used as part of the surrounding workspace rather than published directly to npm.

```sh
pnpm install
pnpm check
pnpm test
```

`pnpm check` runs TypeScript with `tsc --noEmit`. `pnpm test` runs the Node test suite.

The package expects Node `>=22.18`.

## Basic use

```ts
import { MemeStore } from "@561-group/memetic-memory-unit";
import type { Meme } from "@561-group/meme";

const cell = {
  subject: "elderberry",
  predicate: "grows-near",
  object: "wetland-edge"
};

const affirmed: Meme = {
  cell,
  charge: {
    value: [true, false],
    evidence: [["field note"], []]
  }
};

const denied: Meme = {
  cell,
  charge: {
    value: [false, true],
    evidence: [[], ["winter dieback note"]]
  }
};

const memory = new MemeStore();

memory.store(affirmed).store(denied);

const raw = memory.recall(cell);

console.log(raw.length); // 2
```

The two memes have the same address and opposite charges. `MemeStore` returns both, in store order, unchanged.

## Core model

```txt
Meme = Cell + Charge
          │
          ▼
store(meme) appends to memory
          │
          ▼
recall(address) returns the raw stored memes at that cell
          │
          ▼
processing, folding, settlement, and persistence happen elsewhere
```

A `Cell` gives the relational address, read as:

```txt
subject —predicate→ object
```

A `Charge` gives the four-valued evidential word at that address. This package treats that charge as payload.

## API snapshot

```ts
import { MemeStore } from "@561-group/memetic-memory-unit";
import type { Address } from "@561-group/memetic-memory-unit";

const memory = new MemeStore();

memory.store(meme);      // append, chainable
memory.recall(address);  // Meme[] in first-stored order
memory.has(address);     // boolean
memory.cells();          // distinct addresses in first-stored order
memory.size;             // number of stored memes
memory.memes;            // shallow copy of the log
```

The package root exports only `MemeStore` and the `Address` type.

## Package boundary

`@561-group/meme` defines the shared `Meme` vocabulary: `Cell`, `Charge`, `Meme`, and related type guards. This package consumes that vocabulary as a type surface and stores `Meme` values without changing them.

A processing unit can consume recalled memes to fold, negate, settle, or compute fixed points. A future persistence unit can write memory contents to disk. Neither responsibility belongs here.

## Documentation map

- [Documentation index](docs/index.md)
- [Explanation: memory versus processing](docs/explanations/memory-versus-processing.md)
- [Explanation: addresses and accretion](docs/explanations/addresses-and-accretion.md)
- [Tutorial: store and recall a meme](docs/tutorials/store-and-recall-a-meme.md)
- [Tutorial: preserve contradiction](docs/tutorials/preserve-contradiction.md)
- [Guide: using `MemeStore`](docs/guides/using-memestore.md)
- [Guide: package boundaries](docs/guides/package-boundaries.md)
- [Reference: API](docs/references/api.md)
- [Reference: invariants](docs/references/invariants.md)
- [Terms](docs/terms/index.md)

## Development notes

The package uses strict TypeScript with `module` and `moduleResolution` set to `nodenext`, `allowImportingTsExtensions`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `isolatedModules`, and `noEmit`.

Keep the unit boring: append, recall, inspect. If a change starts interpreting a charge or deciding what a contradiction means, it probably belongs in a processing package instead.
