# Chu, FOUR, and duality

The `chu/` module gives the MPU a relational duality layer over the same four-valued floor used by charge.

It contains three pieces:

- `four.ts`: named FOUR values and lifted bilattice operations;
- `chu.ts`: Chu spaces over FOUR;
- `chu-transform.ts`: Chu transforms as adjoint pairs.

## FOUR

`FOUR` is the Belnap-style naming of the charge value bits.

| FOUR | Charge bits | Reading |
| --- | --- | --- |
| `t` | `[true, false]` | true-only / potential |
| `f` | `[false, true]` | false-only / active |
| `bot` | `[false, false]` | neither / absurd |
| `top` | `[true, true]` | both / stable |

The module exports:

```ts
import {
  FOUR,
  isFour,
  asFour,
  toCharge,
  fromCharge,
  fourNegate,
  fourConflate,
  knowledgeJoin,
  knowledgeMeet,
  truthJoin,
  truthMeet
} from "@561-group/memetic-processing-unit";
```

The FOUR operations are not a second algebra. They are the charge operations lifted to the evidence-free named values.

## Charge conversion

Use `toCharge` and `fromCharge` when crossing between named FOUR values and MPU charges.

```ts
import { FOUR, fourToCharge, fourFromCharge } from "@561-group/memetic-processing-unit";

const charge = fourToCharge(FOUR.T);
const value = fourFromCharge(charge); // "t"
```

`fromCharge` reads only the value bits. It discards evidence because FOUR values do not carry witnesses.

## Chu spaces

A Chu space over FOUR is a matrix-like relation:

```txt
C = (A, r, X)

r : A × X → FOUR
```

- `A` gives points / rows.
- `X` gives states / columns.
- `r` gives a FOUR value at each point-state cell.

```ts
import { fromMatrix, FOUR } from "@561-group/memetic-processing-unit";

const space = fromMatrix(
  ["alice", "bob"],
  ["home", "away"],
  {
    alice: { home: FOUR.T, away: FOUR.F },
    bob: { home: FOUR.BOT }
  },
  { absent: FOUR.BOT }
);
```

The `absent` option controls how missing cells are read. The default is closed-world `FOUR.F`; use `FOUR.BOT` for an open-world/EAVT style memory read.

## Rows, columns, and extensions

```ts
import { row, col, extension } from "@561-group/memetic-processing-unit";

row(space, "alice");      // values across every state
col(space, "home");       // values for every point under one state
extension(space, "home"); // points whose value is FOUR.T
```

`settleRow` and `settleColumn` fold a row or column through a bilattice join, defaulting to knowledge join with `bot` as identity.

## Transpose and dual

`transpose` swaps points and states.

`dual` swaps points and states and negates every cell.

```ts
import { transpose, dual } from "@561-group/memetic-processing-unit";

const t = transpose(space);
const d = dual(space);
const dd = dual(d); // same cell values as the original
```

This is the `*-autonomous` dual: transpose plus negation.

## Chu transforms

A Chu transform from `C = (A, r, X)` to `D = (B, s, Y)` is an adjoint pair:

```txt
f : A → B

g : Y → X

s(f(a), y) = r(a, g(y))
```

The forward leg moves points covariantly. The backward leg pulls states back contravariantly.

```ts
import { checkChuTransform, chuTransform } from "@561-group/memetic-processing-unit";

const check = checkChuTransform(source, target, forward, backward);

if (check.ok) {
  const morphism = chuTransform(source, target, forward, backward);
}
```

`chuTransform` throws if the pair is not adjoint. Use `checkChuTransform` when you want the list of failures.

## Transform composition and duals

The module also exports:

- `idTransform`
- `composeTransforms`
- `dualTransform`
- `isChuTransform`

Composition sends points forward through both transforms and pulls states backward in reverse order.

Dualization swaps the forward and backward legs across the dual spaces.

## Why this belongs in the MPU

The Chu module is not a generic matrix helper. It is the relational duality surface for the MPU's four-valued word.

It makes these readings explicit:

- a relation can be read row-wise or column-wise;
- duality swaps points and states while preserving the four-valued floor;
- observations pull back even when points push forward;
- the same charge algebra supports both predication and relational duality.
