# Explore closure regimes

This tutorial uses the `closure` module to classify fixed-point behavior.

The closure module is useful when you want to ask: how far must a monotone process iterate before it stabilizes?

## 1. Import closure helpers

```ts
import {
  closureOrdinal,
  leastFixedPoint,
  reachability,
  omegaPlusOne,
  tower,
  OMEGA,
  succ,
  approx,
  show
} from "@561-group/memetic-processing-unit/closure";
```

## 2. Finite closure: reachability

`reachability` creates a finite graph-closure example.

```ts
const { lattice, phi } = reachability(
  5,
  [[0, 1], [1, 2], [2, 3], [3, 4]],
  [0]
);

const result = closureOrdinal(lattice, phi);

console.log(result.regime); // "finite"
console.log(result.value);  // [0, 1, 2, 3, 4]
```

The closure ordinal is finite because the graph has only finitely many vertices and the reachable set stabilizes after a finite number of steps.

## 3. Non-Scott-continuous closure: ω + 1

`omegaPlusOne` creates an example where the process reaches all natural numbers at `ω`, then fires once more at `ω + 1`.

```ts
const { lattice, phi } = omegaPlusOne();

const atOmega = approx(lattice, phi, OMEGA);
const afterOmega = approx(lattice, phi, succ(OMEGA));
const result = closureOrdinal(lattice, phi);

console.log(atOmega);          // { tag: "nats" }
console.log(afterOmega);       // { tag: "all" }
console.log(show(result.kappa!)); // "ω+1"
console.log(result.regime);    // "transfinite"
```

This is the model for a non-Scott-continuous firing: the limit stage is not already fixed.

## 4. Aperiodic closure: no countable κ found

`tower` creates a never-stabilizing tower witness.

```ts
const { lattice, phi } = tower();
const result = closureOrdinal(lattice, phi, { finite: 30, limits: 4 });

console.log(result.kappa);  // null
console.log(result.regime); // "aperiodic"
```

`null` does not prove an absolute mathematical impossibility. It means the search strategy did not find a countable closure ordinal in the explored pattern, and the process is being reported as aperiodic.

## 5. Get only the least fixed point

Use `leastFixedPoint` when you do not need the ordinal metadata.

```ts
const fixed = leastFixedPoint(lattice, phi);
```

This is a convenience wrapper around `closureOrdinal(...).value`.

## 6. Bridge MPU settle into closure

The `fromBilattice` helper shows how the MPU floor's `settle` appears as a finite-κ closure.

```ts
import { articulate, predicate, posit } from "@561-group/memetic-processing-unit";
import { fromBilattice, closureOrdinal } from "@561-group/memetic-processing-unit/closure";

const posited = posit(predicate(articulate(["socrates", "mortal"])));
const { lattice, phi, settledValuation } = fromBilattice(posited);
const result = closureOrdinal(lattice, phi);

console.log(result.regime); // "finite"
console.log(result.value);  // same valuation as settledValuation
```

This connects the general closure module back to the MPU's ordinary descent closure.

## What to watch for

The `closureOrdinal` search has options:

```ts
closureOrdinal(lattice, phi, { finite: 64, limits: 4 });
```

- `finite` controls how many successor steps are checked inside each block.
- `limits` controls how many `ω·k` limit blocks are checked.

Use larger values for experiments, but remember that some closures are interesting precisely because they do not halt quickly.
