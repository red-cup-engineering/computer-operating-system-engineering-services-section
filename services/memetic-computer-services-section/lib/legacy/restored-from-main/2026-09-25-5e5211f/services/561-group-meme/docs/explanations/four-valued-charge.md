# Four-valued charge

`Charge` is the evidential word of a meme.

A `Cell` identifies an oriented predication address. A `Charge` records the evidential state currently held at that address.

```ts
export interface Charge {
  readonly value: readonly [boolean, boolean];
  readonly evidence: readonly [readonly unknown[], readonly unknown[]];
}
```

The two booleans are independent marks:

```txt
[positive, negative]
```

The two evidence arrays are independent witness carriers:

```txt
[positiveWitnesses, negativeWitnesses]
```

## The four phases

| Value | Name | Meaning |
| --- | --- | --- |
| `[false, false]` | `absurd` | no side; no information |
| `[true, false]` | `potential` | positive only; has potential, not yet active |
| `[false, true]` | `active` | negative only; engaged |
| `[true, true]` | `stable` | both marks; contradiction or two-sided evidence is held |

The important point is that `[true, true]` is not malformed. Stable charge means both sides are present. A consuming package may interpret that as contradiction, saturation, settlement, or a held two-sided state, but it should not erase the state just because it is not Boolean.

## Evidence is lossless

The `evidence` field is part of the charge, not debug metadata.

```ts
const charge = {
  value: [true, true],
  evidence: [
    ["positive witness A", "positive witness B"],
    ["negative witness C"]
  ]
} as const;
```

Consumers should append witnesses rather than overwriting them. If a later operation changes the value, the witnesses that produced previous marks should remain available unless a higher-level package has an explicit retention policy.

## Knowledge and truth readings

The charge pair can be read in two ways:

- knowledge reading: how determined the cell is;
- truth-orientation reading: which side is marked.

Under the knowledge reading, `absurd` is least determined and `stable` is most determined. Under the truth-orientation reading, `potential` and `active` occupy opposite one-sided orientations.

This package does not implement bilattice operations. It only fixes the data shape that makes those operations possible in a higher-level package.

## Relation to Bit slots

A `Bit` has two witness slots:

```ts
export interface Bit {
  readonly carrier: Utterance;
  readonly slots: readonly [readonly unknown[], readonly unknown[]];
}
```

The slot occupancy of a bit can be read in the same four-phase pattern:

| Slot occupancy | Phase |
| --- | --- |
| `[[], []]` | absurd |
| `[[...], []]` | potential |
| `[[], [...]]` | active |
| `[[...], [...]]` | stable |

`Bit` is the articulated carrier. `Charge` is the settled evidential word used by `Meme`.

## Construction helper example

This package intentionally does not export constructors, but consumers can define local helpers:

```ts
import type { Charge } from "@561-group/meme";

export const absurd = (): Charge => ({
  value: [false, false],
  evidence: [[], []]
});

export const potential = (witness: unknown): Charge => ({
  value: [true, false],
  evidence: [[witness], []]
});

export const active = (witness: unknown): Charge => ({
  value: [false, true],
  evidence: [[], [witness]]
});

export const stable = (positive: unknown, negative: unknown): Charge => ({
  value: [true, true],
  evidence: [[positive], [negative]]
});
```

Keep helpers outside this package unless they are truly vocabulary-level and do not impose a runtime policy.
