# Using TypeScript types and JSON Schemas

`@561-group/meme` provides two complementary surfaces:

- TypeScript types for package-internal compile-time checking;
- JSON Schemas for validating serialized data at boundaries.

Use both, but do not confuse them.

## TypeScript types

Use the TypeScript types when writing packages that import this vocabulary directly.

```ts
import type { Meme, Charge, Cell } from "@561-group/meme";

export function describeMeme(meme: Meme): string {
  const { subject, predicate, object } = meme.cell;
  const [positive, negative] = meme.charge.value;

  return `${String(subject)} —${String(predicate)}→ ${String(object)} [${positive}, ${negative}]`;
}
```

The types are structural. Most fields use `unknown` because this package fixes vocabulary positions rather than the internal representation of entities, predicates, tokens, claims, or witnesses.

## Type guards

The package exports shallow structural guards:

```ts
import { isBit, isCell, isCharge, isMeme } from "@561-group/meme";
```

Use these when you need a quick local guard around values that may already be trusted by the surrounding program.

```ts
import { isCharge } from "@561-group/meme";

export function requireCharge(input: unknown) {
  if (!isCharge(input)) {
    throw new Error("Expected Charge");
  }

  return input;
}
```

These guards are intentionally shallow. They check the basic object/array/boolean shape required by the TypeScript interfaces. They do not validate domain-specific meanings.

## JSON Schemas

Use the JSON Schemas at serialization boundaries:

- reading a file;
- accepting network input;
- importing an archive;
- validating JSONL records;
- checking data before storage.

The package exports schemas as subpaths:

```ts
import memeSchema from "@561-group/meme/schema/meme" with { type: "json" };
import chargeSchema from "@561-group/meme/schema/charge" with { type: "json" };
```

A consuming package can pass these schemas to its validator of choice.

This package does not bundle a validator, because that would add runtime policy and dependencies to a vocabulary package.

## Choosing the right surface

| Situation | Use |
| --- | --- |
| Writing TypeScript against known values | TypeScript types |
| Narrowing a local unknown value | Type guard |
| Accepting untrusted serialized data | JSON Schema |
| Enforcing domain-specific predicate rules | Consumer package logic |
| Running closure or settlement | Processing package logic |

## Keep semantic validation outside this package

This package can say that a `Cell` has a `subject`, `predicate`, and `object`. It should not decide whether a particular predicate is legal for a particular entity.

That belongs in the package that owns the domain.

For example, a memory package might require predicates to come from a registry. A processing package might require certain closure rules. A federation package might require signed envelopes. None of those requirements should be baked into `@561-group/meme` unless they are vocabulary-level invariants shared by every consumer.

## Recommended boundary pattern

A consuming package should usually follow this pattern:

1. validate incoming JSON against the exported JSON Schema;
2. treat the validated value as the corresponding TypeScript type;
3. apply package-specific semantic checks;
4. only then run processing or storage logic.

Example outline:

```ts
import type { Meme } from "@561-group/meme";
import memeSchema from "@561-group/meme/schema/meme" with { type: "json" };

export function parseMemeJson(input: unknown): Meme {
  // 1. Validate `input` against `memeSchema` using your validator.
  // 2. Apply your package's semantic checks.
  // 3. Return it as `Meme` once both have passed.
  return input as Meme;
}
```

The cast in this outline is not a substitute for validation. It marks the point where the consuming package has done the work this vocabulary package intentionally does not do.
