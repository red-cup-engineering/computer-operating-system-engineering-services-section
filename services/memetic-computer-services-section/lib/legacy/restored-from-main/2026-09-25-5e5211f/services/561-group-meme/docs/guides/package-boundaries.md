# Package boundaries

`@561-group/meme` is a vocabulary package.

Its job is to keep the shared data shapes stable enough that processing, memory, federation, and application packages can talk about the same things without importing one another.

## Boundary rule

Keep this package limited to:

- TypeScript vocabulary types;
- shallow structural guards;
- JSON Schemas;
- type-only morphism signatures;
- documentation for the vocabulary.

Do not add runtime policy here unless every consumer of the meme vocabulary must share it.

## What belongs here

Add or change code in this package when the change is vocabulary-level.

Good fits:

- adding a shared type that multiple memetic packages need;
- documenting a field already present in the schemas;
- adding a JSON Schema for an exported data surface;
- adding a shallow type guard for a structural type;
- clarifying the descent vocabulary in docs.

Example:

```ts
export interface Meme {
  readonly cell: Cell;
  readonly charge: Charge;
}
```

`Meme` belongs here because it is the common unit processed and stored by other packages.

## What belongs outside this package

Do not add these here:

- closure algorithms;
- charge merge operations;
- schema validators as dependencies;
- storage engines;
- JSONL log policy;
- network or federation envelopes;
- predicate registries;
- domain-specific entity validation;
- application workflows.

These belong in consuming packages.

## Examples of boundary decisions

### Charge constructors

Local helpers like this are useful:

```ts
import type { Charge } from "@561-group/meme";

export const absurd = (): Charge => ({
  value: [false, false],
  evidence: [[], []]
});
```

But they impose a construction API. Keep them in a processing or application package until there is a clear need for shared constructors at the vocabulary level.

### JSON Schema validation

The schemas belong here. A validator dependency does not.

A consumer can import a schema and choose its own validator:

```ts
import chargeSchema from "@561-group/meme/schema/charge" with { type: "json" };
```

This package should not choose Ajv, TypeBox, Zod, Valibot, or any other validation runtime for every consumer.

### Morphism implementation

The morphism types belong here:

```ts
export type Settle = (posited: Posited) => Sheaf;
```

The implementation of `settle` belongs elsewhere. Different processing packages may need different closure strategies, trace policies, or evaluation hooks.

## Stability expectations

Because this package is a shared vocabulary layer, changes should be conservative.

Prefer additive changes when possible:

- add a new exported type instead of changing a field's meaning;
- add a new schema instead of weakening an existing schema silently;
- document a term before relying on it across packages;
- preserve existing subpath exports unless a coordinated workspace migration is happening.

## Review checklist

Before changing this package, ask:

1. Is this a shared vocabulary invariant?
2. Would multiple packages need the same shape?
3. Does this add runtime behavior or policy?
4. Could this live in a consumer package instead?
5. Does the JSON Schema still match the TypeScript type?
6. Does the documentation explain the intended use without overclaiming implementation behavior?

If the answer to question 3 is yes, the change probably belongs outside this package.
