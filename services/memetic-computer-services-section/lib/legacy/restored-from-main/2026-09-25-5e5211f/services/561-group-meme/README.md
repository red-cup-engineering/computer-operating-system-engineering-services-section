# @561-group/meme

`@561-group/meme` is the vocabulary package for the Meme and its descent vocabulary.

It defines the data shapes shared by memetic packages: `Token`, `Claim`, `Utterance`, `Bit`, `Cell`, `Charge`, `FiberAlgebra`, `PositPresheaf`, `Sheaf`, and `Meme`. The package is intentionally small: TypeScript type surfaces, a few structural type guards, and JSON Schema files. It does not provide the runtime implementation of the descent pipeline.

## What this package is

This package is a private ESM TypeScript package for naming and checking the structural vocabulary used by the memetic system.

It provides:

- strict TypeScript interfaces and type aliases under `src/`;
- JSON Schemas under `schema/`;
- subpath exports for each major vocabulary surface;
- structural type guards for `Bit`, `Cell`, `Charge`, and `Meme`;
- type-only morphism signatures for `articulate → predicate → posit → settle`.

It deliberately does not provide:

- runtime dependencies;
- validators bundled into the package;
- lattice operations over charges;
- implementations of the descent morphisms;
- storage, federation, or processing engines.

Those belong in packages that consume this vocabulary, such as a memetic processing unit, memory unit, or higher-level memetics package.

## Install and check

This package is marked private, so it is meant to be used as part of the surrounding workspace rather than published directly to npm.

```sh
npm install
npm run check
```

`npm run check` runs TypeScript with `tsc --noEmit`.

The package expects Node `>=22.18`.

## Core model

The descent vocabulary starts with a bare utterance and ends with a settled meme/sheaf structure.

```txt
Token + Claim
    ↓
Utterance = [token, claim]
    ↓ articulate
Bit = { carrier, slots }
    ↓ predicate
Predicated = { cell-set, fiber }
    ↓ posit
Posited = { presheaf, traces }
    ↓ settle
Sheaf = { base, section }
```

The main stored/processed unit is a `Meme`:

```ts
import type { Meme } from "@561-group/meme";

const meme: Meme = {
  cell: {
    subject: "seed-bank",
    predicate: "depends-on",
    object: "water"
  },
  charge: {
    value: [true, false],
    evidence: [["observed"], []]
  }
};
```

A meme is the irreducible thing-with-evidence: a `Cell` gives its relational identity, and a `Charge` gives its four-valued evidential state.

## Charge phases

A `Charge` stores two independent marks, `[positive, negative]`, plus two evidence slots, `[positiveWitnesses, negativeWitnesses]`.

| Value | Name | Reading |
| --- | --- | --- |
| `[false, false]` | absurd | no side; no information |
| `[true, false]` | potential | positive only; has potential, not yet active |
| `[false, true]` | active | negative only; engaged |
| `[true, true]` | stable | both sides; contradiction or two-sided evidence is held, not thrown away |

Evidence is lossless. Consumers should accumulate witnesses rather than erase them to force a single Boolean truth value.

## Imports

```ts
import type {
  Token,
  Claim,
  Utterance,
  Bit,
  Cell,
  Charge,
  Meme,
  Fiber,
  FiberAlgebra,
  PositPresheaf,
  Posited,
  Sheaf,
  Articulate,
  Predicate,
  Posit,
  Settle
} from "@561-group/meme";

import { isBit, isCell, isCharge, isMeme } from "@561-group/meme";
```

Subpath exports are also available:

```ts
import type { Meme } from "@561-group/meme/meme";
import type { FiberAlgebra } from "@561-group/meme/fiber";
import type { Sheaf } from "@561-group/meme/presheaf";
import type { Settle } from "@561-group/meme/morphisms";
```

JSON Schemas are exported as package subpaths:

```ts
import memeSchema from "@561-group/meme/schema/meme" with { type: "json" };
import chargeSchema from "@561-group/meme/schema/charge" with { type: "json" };
```

## Documentation map

- [Documentation index](docs/index.md)
- [Explanation: the descent pipeline](docs/explanations/descent.md)
- [Explanation: cells, predicates, and fibers](docs/explanations/cells-and-fibers.md)
- [Explanation: four-valued charge](docs/explanations/four-valued-charge.md)
- [Tutorial: create a meme](docs/tutorials/create-a-meme.md)
- [Tutorial: write a descent stub](docs/tutorials/write-a-descent-stub.md)
- [Guide: using TypeScript types and JSON Schemas](docs/guides/using-types-and-schemas.md)
- [Guide: package boundaries](docs/guides/package-boundaries.md)
- [Reference: API](docs/references/api.md)
- [Reference: schemas](docs/references/schemas.md)
- [Terms](docs/terms/index.md)

## Development notes

The package uses strict TypeScript with `module` and `moduleResolution` set to `nodenext`, `allowImportingTsExtensions`, `verbatimModuleSyntax`, `isolatedModules`, and `noEmit`. Keep exported source files importable as ESM TypeScript modules.

The type guards in this package are intentionally shallow structural guards. Use the JSON Schemas when you need boundary validation for untrusted data.
