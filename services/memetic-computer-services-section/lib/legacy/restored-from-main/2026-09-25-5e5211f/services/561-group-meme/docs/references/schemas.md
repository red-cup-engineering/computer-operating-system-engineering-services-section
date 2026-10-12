# Schema reference

The package exports JSON Schemas for serialized meme vocabulary surfaces.

The schemas use JSON Schema draft 2020-12 and live under `schema/`.

## Importing schemas

The package exports schemas as subpaths:

```ts
import utteranceSchema from "@561-group/meme/schema/utterance" with { type: "json" };
import bitSchema from "@561-group/meme/schema/bit" with { type: "json" };
import cellSchema from "@561-group/meme/schema/cell" with { type: "json" };
import chargeSchema from "@561-group/meme/schema/charge" with { type: "json" };
import memeSchema from "@561-group/meme/schema/meme" with { type: "json" };
import fiberAlgebraSchema from "@561-group/meme/schema/fiber-algebra" with { type: "json" };
import positPresheafSchema from "@561-group/meme/schema/posit-presheaf" with { type: "json" };
import sheafSchema from "@561-group/meme/schema/sheaf" with { type: "json" };
```

This package does not bundle a validator. Use the validator chosen by the consuming package.

## Schemas

### `schema/utterance.schema.json`

Subpath:

```txt
@561-group/meme/schema/utterance
```

Shape:

```ts
type Utterance = readonly [Token, Claim];
```

Description:

A two-item array. The first item is the identity-carrying token. The second item is the content-carrying claim.

### `schema/bit.schema.json`

Subpath:

```txt
@561-group/meme/schema/bit
```

Shape:

```ts
interface Bit {
  carrier: Utterance;
  slots: [unknown[], unknown[]];
}
```

Description:

A bit is an utterance carrier plus two witness slots. Slot occupancy can be read as absurd, potential, active, or stable.

### `schema/cell.schema.json`

Subpath:

```txt
@561-group/meme/schema/cell
```

Shape:

```ts
interface Cell {
  subject: unknown;
  predicate: unknown;
  object: unknown;
}
```

Description:

A predication cell: an oriented `subject —predicate→ object` address.

### `schema/charge.schema.json`

Subpath:

```txt
@561-group/meme/schema/charge
```

Shape:

```ts
interface Charge {
  value: [boolean, boolean];
  evidence: [unknown[], unknown[]];
}
```

Description:

A four-valued evidential word. `value` is `[positive, negative]`; `evidence` is `[positiveWitnesses, negativeWitnesses]`.

### `schema/meme.schema.json`

Subpath:

```txt
@561-group/meme/schema/meme
```

Shape:

```ts
interface Meme {
  cell: Cell;
  charge: Charge;
}
```

Description:

The irreducible thing-with-evidence: a cell paired with a charge.

### `schema/fiber-algebra.schema.json`

Subpath:

```txt
@561-group/meme/schema/fiber-algebra
```

Shape:

```ts
interface FiberAlgebra {
  "entity-set": EntitySet;
  assignments: Meme[];
  predicate: unknown;
}
```

Description:

Charged assignments over a single predicate's `E × E` square. Each assignment is a meme.

### `schema/posit-presheaf.schema.json`

Subpath:

```txt
@561-group/meme/schema/posit-presheaf
```

Shape:

```ts
interface PositPresheaf {
  fiber: Fiber;
  base: BaseCategory;
  "entity-set": EntitySet;
  fibers: FiberAlgebra[];
}
```

Description:

The valued presheaf built by `posit`, with charged fibers seeded for the predicate domain.

### `schema/sheaf.schema.json`

Subpath:

```txt
@561-group/meme/schema/sheaf
```

Shape:

```ts
interface Sheaf {
  base: BaseCategory;
  section: Valuation;
}
```

Description:

The glued settled structure: the base category and settled section.

## Schema and TypeScript alignment

When changing a TypeScript type that has a schema, update the schema in the same change.

When changing a schema, check whether the TypeScript type should change too.

The package currently keeps validation intentionally structural. Most domain values remain unconstrained because entities, predicates, tokens, claims, and evidence witnesses are owned by consuming packages.

## Boundary validation pattern

Use schemas at trust boundaries:

```ts
import type { Meme } from "@561-group/meme";
import memeSchema from "@561-group/meme/schema/meme" with { type: "json" };

export function fromJson(input: unknown): Meme {
  // Validate input against memeSchema with your validator.
  // Then apply package-specific semantic checks.
  return input as Meme;
}
```

Do not treat the cast as validation. It is only the handoff point after your validator and semantic checks have run.
