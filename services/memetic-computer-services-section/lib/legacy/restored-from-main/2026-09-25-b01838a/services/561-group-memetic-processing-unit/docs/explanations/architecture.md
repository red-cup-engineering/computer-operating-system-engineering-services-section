# Architecture

`@561-group/memetic-processing-unit` is the operational layer above `@561-group/meme`.

`@561-group/meme` owns the shared data vocabulary: `Utterance`, `Cell`, `Charge`, `Meme`, `FiberAlgebra`, `PositPresheaf`, `Sheaf`, and related types.

The MPU owns computation over that vocabulary:

- charge algebra;
- descent;
- knowledge-base composition;
- fixed-point closure;
- cone and void duals;
- a stateful witness-log facade;
- supporting mathematical modules.

## Layer map

```txt
@561-group/meme
  shared data shapes and JSON Schemas
        ↓
@561-group/memetic-processing-unit
  operations over those shapes
        ↓
future memory / storage / federation / application packages
  persistence, transport, UI, policy
```

The MPU is not a memory store. It has a stateful `Mpu` class, but that class stores only an accretive in-process witness log. Durable storage belongs in another package.

## Root surface

The root export re-exports useful types from `@561-group/meme`, then exports the MPU's operational modules.

The main public surfaces are:

- `charge.ts`: the bilattice word algebra;
- `descent.ts`: single-utterance descent and modal closure;
- `compose.ts`: knowledge-base composition from witness tuples;
- `mpu.ts`: the stateful facade;
- `cone.ts`: greatest-fixed-point and truth-order duals;
- `void.ts`: gap/vanish/estrange and path-composition void reads;
- `number/`: exact arithmetic and matrices;

## Functional core and stateful shell

Most of the package is functional.

For example, this uses the raw descent functions:

```ts
import { articulate, predicate, posit, settle } from "@561-group/memetic-processing-unit";

const posited = posit(predicate(articulate(["socrates", "mortal"])));
const { sheaf } = settle(posited);
```

This uses the stateful facade:

```ts
import { Mpu } from "@561-group/memetic-processing-unit";

const mpu = new Mpu();
mpu.articulate("socrates", "mortal").deny("sky", "green");
const sheaf = mpu.settle();
```

The facade is a convenience layer over the functional core. It does not introduce a separate storage model.

## The unit of processing

The MPU processes witnessed predications, not plain Booleans.

A witness eventually becomes a cell with a charge:

```ts
{
  cell: {
    subject: "sky",
    predicate: "blue",
    object: "sky"
  },
  charge: {
    value: [true, true],
    evidence: [["sky"], ["sky"]]
  }
}
```

The `[true, true]` charge is `stable`: both sides have been told. It is a held contradiction, not an exception.

## Section, not scalar

The main output of processing is not a single truth value. It is a `Sheaf`, whose `section` is a `Valuation` containing fiber-algebras and assignments.

Projection functions such as `memeCharge`, `chargeAt`, `claimsFor`, and `subjectsFor` read out of the section. They are convenience views over the settled structure.

## Evidence and structural identity

Two internal helpers support this architecture:

- deterministic structural stringification for stable keys;
- witness-list union that keeps first occurrence and discards no evidence.

This matters because two cells can be structurally equal without being the same JavaScript object. It also matters because folding evidence must not erase the witnesses that made a charge stable.

## Tests as behavioral proofs

The test suite is organized by module family and acts as executable documentation:

- `src/mpu.test.ts` proves charge/descent/compose/Mpu/cone/void behavior;

When the implementation changes, the corresponding docs and tests should change together.
