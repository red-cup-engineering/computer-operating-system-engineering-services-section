# Choosing an API surface

The package has several valid entry points. Choose the one that matches the shape of the work you are doing.

## Use `Mpu` for an accretive local witness log

Use the stateful facade when you want to append witnesses and ask projection questions.

```ts
import { Mpu } from "@561-group/memetic-processing-unit";

const mpu = new Mpu();
mpu.articulate("alice", "home", "cottage").deny("sky", "green");

mpu.settle();
mpu.memeCharge("sky", "green");
mpu.claimsFor("alice");
mpu.subjectsFor("green");
```

Choose this when:

- you want chainable `articulate` / `deny` calls;
- you want a simple in-process witness log;
- you want projection helpers;
- you do not need to persist or distribute the log yourself.

Do not use `Mpu` as a durable memory unit. It is an in-process facade, not a storage engine.

## Use `compose` for batch witness processing

Use `compose` when you already have witness tuples.

```ts
import { compose } from "@561-group/memetic-processing-unit";

const sheaf = compose([
  ["socrates", "mortal"],
  ["sky", "blue"],
  ["sky", "blue", false]
]);
```

Choose this when:

- your input is already a list of witness tuples;
- you do not need a stateful object;
- you want a settled `Sheaf` directly;
- you are writing a memory or import pipeline.

## Use `descent` for single-utterance processing

Use the descent functions when you need exact control over the stages.

```ts
import { articulate, predicate, posit, settle, settleTraced } from "@561-group/memetic-processing-unit";

const potential = articulate(["socrates", "mortal"]);
const predicated = predicate(potential);
const posited = posit(predicated);
const { sheaf } = settle(posited);
const traced = settleTraced(posited);
```

Choose this when:

- you are testing or modifying the descent pipeline;
- you need a `Posited` value for cone/void operations;
- you need trace history or closure depth;
- you are writing lower-level processing code.

## Use `charge` for value algebra

Use the charge functions when you only need bilattice operations.

```ts
import { joinKnowledge, negate, bottom, potential } from "@561-group/memetic-processing-unit";

const a = potential("witness-a");
const b = negate(potential("witness-b"));
const stable = joinKnowledge({ left: a, right: b });
```

Choose this when:

- you are folding or comparing charges;
- you need the gauge operations;
- you need to preserve evidence while computing values.

## Use `cone` and `void` for dual reads

Use cone/void functions when least-fixed-point settlement is not enough.

```ts
import { brim, vanish, gap } from "@561-group/memetic-processing-unit";

const { cone } = brim(posited);
const { apex, evidence } = vanish(posited);
```

Choose this when:

- you need the gap between least and greatest fixed points;
- you want to inspect free/underdetermined cells;
- you are studying void cones or aperiodic residue.

## Use `@lenticule-science/metrologic` for the mathematics

None of the general mathematics lives in this package. Import it from its owner:

| Import | Use when you need |
| --- | --- |
| `@lenticule-science/metrologic/chu` | FOUR, Chu spaces, duals, and Chu transforms |
| `@lenticule-science/metrologic/number` | exact natural/integer/rational/matrix arithmetic |
| `@lenticule-science/metrologic/closure` | ordinal notation, transfinite iteration, closure regimes |
| `@lenticule-science/metrologic/obstruction` | temporal settling H¹, cellular cochain H¹, floor bridge |
| `@lenticule-science/metrologic/dframe` | FOUR-valued bigraded firing reads |
| `@lenticule-science/metrologic/dgen` | H¹ d-frame generators for NSC firings |
| `@lenticule-science/metrologic/spectral` | polynomial inversion, root location, Pisot checks |
| `@lenticule-science/metrologic/verdier` | substitutions, AP colimit structures, Verdier duality, gauge |

```ts
import { FOUR, fromMatrix, dual } from "@lenticule-science/metrologic/chu";
import { closureOrdinal, reachability } from "@lenticule-science/metrologic/closure";
```

## Rule of thumb

Start high and drop lower only when you need control.

```txt
Mpu
  ↓ if you already have witness tuples
compose
  ↓ if you need phase control
articulate / predicate / posit / settle
  ↓ if you need algebraic internals
charge / descent / cone / void
  ↓ if you need the mathematics underneath
@lenticule-science/metrologic/*
```
