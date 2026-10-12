# @561-group/memetic-processing-unit

`@561-group/memetic-processing-unit` is the Memetic Processing Unit: a TypeScript package that processes witnessed utterances into bilattice-valued predication structures.

It consumes the shared data vocabulary from `@561-group/meme` and supplies the processing layer: charge operations, descent, witness composition, modal closure, cone/void reads, and a stateful `Mpu` facade.

It owns none of the general mathematics. Chu spaces over FOUR, the exact number tower, closure ordinals, obstruction/cohomology, d-frame generators, spectral tests, and Verdier/substitution duality are `@lenticule-science/metrologic`'s, and are imported from it directly — `@lenticule-science/metrologic/chu`, `/number`, `/closure`, `/obstruction`, `/spectral`, `/verdier`, `/dframe`, `/dgen`. This package used to carry a TypeScript copy of all of them; the copy is gone.

The core slogan is: **the MPU does not reduce an utterance to a Boolean scalar.** It preserves cell/fiber/sheaf structure and uses a four-valued charge as its word.

## What this package provides

- A bilattice charge algebra over the `Charge` type from `@561-group/meme`.
- The descent pipeline: `articulate → predicate → cohere → posit → commutate → settle`.
- KB-level composition from witness tuples into a settled `Sheaf`.
- A stateful `Mpu` class for accretive witness logging and projection queries.
- Cone duals: `brim`, `adjudicate`, and `presume`.
- Void reads: `gap`, `vanish`, `estrange`, and the path-composition operations `saturate`, `transfer`, `twistor`, `precipitate`.

## What this package is not

This package is not a datastore, network protocol, UI, or validator bundle. It is not a home for general mathematics: anything that is not the descent over charges belongs to `@lenticule-science/metrologic`.

It depends on `@561-group/meme` for shared data shapes. The MPU owns the operations over those shapes.

## Install, check, and test

```sh
npm install
npm run check
npm test
```

`npm run check` runs TypeScript with `tsc --noEmit`.

`npm test` runs Node's built-in test runner over `src/**/*.test.ts`.

The package expects Node `>=22.18`.

## Quick start: use the stateful MPU

```ts
import { Mpu } from "@561-group/memetic-processing-unit";

const mpu = new Mpu();

mpu
  .articulate("socrates", "mortal")
  .articulate("plato", "mortal")
  .deny("sky", "green");

console.log(mpu.memeCharge("socrates", "mortal")); // "potential"
console.log(mpu.memeCharge("sky", "green"));      // "active"
console.log(mpu.memeCharge("nobody", "nothing")); // "absurd"

const sheaf = mpu.settle();
console.log(sheaf.section["fiber-algebras"]);
```

Affirming and denying the same cell does not erase the conflict. It becomes `stable`:

```ts
const mpu = new Mpu();

mpu.articulate("sky", "blue").deny("sky", "blue");

console.log(mpu.memeCharge("sky", "blue")); // "stable"
console.log(mpu.compare().paraconsistent);
```

## Quick start: use the functional core

```ts
import {
  articulate,
  predicate,
  posit,
  settle,
  compose,
  chargeAt,
  memeChargeOf
} from "@561-group/memetic-processing-unit";

const posited = posit(predicate(articulate(["socrates", "mortal"])));
const { sheaf } = settle(posited);

const section = compose([
  ["socrates", "mortal"],
  ["plato", "mortal"],
  ["sky", "blue"],
  ["sky", "blue", false]
]).section;

const charge = chargeAt(section, {
  subject: "sky",
  predicate: "blue",
  object: "sky"
});

console.log(memeChargeOf(charge)); // "stable"
```

## Witness tuple forms

`compose` and `Mpu#witness` accept witness tuples in four forms:

| Tuple | Meaning |
| --- | --- |
| `[subject, claim]` | affirmation; object defaults to subject |
| `[subject, claim, false]` | denial; object defaults to subject |
| `[subject, claim, object]` | affirmation with explicit object |
| `[subject, claim, object, false]` | denial with explicit object |

Witnesses of the same cell fold by knowledge join. Affirmation plus denial produces `stable` and keeps both witness sides.

## Main module map

| Import | Purpose |
| --- | --- |
| `@561-group/memetic-processing-unit` | root surface |
| `@561-group/memetic-processing-unit/charge` | charge algebra and constructors |
| `@561-group/memetic-processing-unit/descent` | single-utterance descent and modal closure |
| `@561-group/memetic-processing-unit/compose` | KB witness composition and projections |
| `@561-group/memetic-processing-unit/cone` | LFP/GFP cone duals |
| `@561-group/memetic-processing-unit/void` | gap, vanish, estrange, and path-composition void reads |

The mathematics is imported from its owner, not from here:

| Import | Purpose |
| --- | --- |
| `@lenticule-science/metrologic/chu` | FOUR, Chu spaces, and Chu transforms |
| `@lenticule-science/metrologic/number` | exact natural/integer/rational/matrix tower |
| `@lenticule-science/metrologic/closure` | ordinal notation, transfinite iteration, closure regimes |
| `@lenticule-science/metrologic/obstruction` | settling cohomology and floor bridge |
| `@lenticule-science/metrologic/spectral` | polynomial inversion and root-location tests |
| `@lenticule-science/metrologic/verdier` | substitution, AP colimit, Verdier duality, gauge |
| `@lenticule-science/metrologic/dframe` | d-frame cohomology and orbit classification |
| `@lenticule-science/metrologic/dgen` | d-frame H¹ generators |

## Documentation

- [Documentation index](docs/index.md)
- [Explanation: architecture](docs/explanations/architecture.md)
- [Explanation: descent, charge, and closure](docs/explanations/descent-charge-closure.md)
- [Tutorial: use the MPU facade](docs/tutorials/use-the-mpu.md)
- [Tutorial: compose witnesses](docs/tutorials/compose-witnesses.md)
- [Guide: choosing an API surface](docs/guides/choosing-an-api-surface.md)
- [Guide: package boundaries](docs/guides/package-boundaries.md)
- [Reference: API](docs/references/api.md)
- [Reference: module map](docs/references/module-map.md)
- [Terms](docs/terms/index.md)

## Development notes

The package is strict ESM TypeScript with `module` and `moduleResolution` set to `nodenext`, `allowImportingTsExtensions`, `verbatimModuleSyntax`, `isolatedModules`, and `noEmit`.

The test suite is part of the documentation. Tests are written as behavioral proofs for each module family. When changing a module, update both the docs and its corresponding tests.
