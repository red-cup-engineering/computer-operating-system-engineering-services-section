# Use the MPU facade

This tutorial uses the stateful `Mpu` class.

Use this surface when you want an accretive witness log and convenient projection methods.

## 1. Create an MPU

```ts
import { Mpu } from "@561-group/memetic-processing-unit";

const mpu = new Mpu();
```

The instance starts with an empty witness log.

## 2. Add affirming witnesses

```ts
mpu
  .articulate("socrates", "mortal")
  .articulate("plato", "mortal");
```

`articulate(token, claim)` records an affirming witness.

With no explicit object, the cell is self-referential:

```ts
{
  subject: "socrates",
  predicate: "mortal",
  object: "socrates"
}
```

The method is chainable.

## 3. Add denying witnesses

```ts
mpu.deny("sky", "green");
```

`deny(token, claim)` records a denying witness. It produces an `active` charge for that cell after processing.

```ts
mpu.memeCharge("sky", "green"); // "active"
```

## 4. Use explicit objects

Pass a third argument when the object is not the subject.

```ts
mpu.articulate("alice", "home", "cottage");

mpu.memeCharge("alice", "home", "cottage"); // "potential"
mpu.memeCharge("alice", "home");            // "absurd"
```

The self-referential cell and the explicit-object cell are different cells.

## 5. Hold contradiction as stable data

Affirming and denying the same cell produces `stable`.

```ts
mpu.articulate("sky", "blue").deny("sky", "blue");

mpu.memeCharge("sky", "blue"); // "stable"
```

The contradiction is not thrown away. The positive and negative witnesses both remain in the charge evidence.

## 6. Settle the full section

```ts
const sheaf = mpu.settle();
const section = sheaf.section;

console.log(section["fiber-algebras"]);
```

`settle()` recomputes the section from the witness log.

The output is a `Sheaf`, not a single truth value.

## 7. Read projections

### Read one cell

```ts
const charge = mpu.chargeAt("socrates", "mortal");
const label = mpu.memeCharge("socrates", "mortal");
```

`chargeAt` returns the raw `Charge`.

`memeCharge` returns one of:

```txt
"potential" | "active" | "absurd" | "stable"
```

### Read claims for a subject

```ts
const claims = mpu.claimsFor("alice");
```

Each result has:

```ts
{
  claim: unknown;
  object: unknown;
  charge: Charge;
  memeCharge: MemeCharge;
}
```

### Read subjects for a predicate

```ts
const subjects = mpu.subjectsFor("mortal");
```

Each result has:

```ts
{
  subject: unknown;
  object: unknown;
  charge: Charge;
  memeCharge: MemeCharge;
}
```

## 8. Split consistent and paraconsistent parts

```ts
const { consistent, paraconsistent } = mpu.compare();
```

`consistent` contains cells whose charge is not stable.

`paraconsistent` contains cells whose charge is stable.

This is a projection over the settled section. It does not remove the stable cells from the MPU.

## 9. Inspect cone and void reads

```ts
const { cone } = mpu.brim();
const { verdict } = mpu.adjudicate();
const { presumption } = mpu.presume();
const { apex, evidence } = mpu.vanish();
```

- `brim()` computes the knowledge greatest-fixed-point cone.
- `adjudicate()` computes a truth-order least fixed point.
- `presume()` computes a truth-order greatest fixed point.
- `vanish()` reads the void between `settle` and `brim`.

## 10. Inspect the witness log

```ts
const witnesses = mpu.witnesses;
```

The getter returns a copy. Mutating the returned array does not mutate the MPU's internal log.

## Complete example

```ts
import { Mpu } from "@561-group/memetic-processing-unit";

const mpu = new Mpu();

mpu
  .articulate("alice", "home", "cottage")
  .articulate("alice", "knows", "bob")
  .deny("alice", "likes", "noise")
  .articulate("sky", "blue")
  .deny("sky", "blue");

console.log(mpu.memeCharge("alice", "home", "cottage")); // potential
console.log(mpu.memeCharge("alice", "likes", "noise"));  // active
console.log(mpu.memeCharge("sky", "blue"));               // stable

console.log(mpu.claimsFor("alice"));
console.log(mpu.subjectsFor("blue"));
console.log(mpu.compare().paraconsistent);
```

## When not to use `Mpu`

Use the functional modules instead when you need:

- stateless helpers;
- direct control over `Posited` values;
- custom traces;
- closure-regime experiments (`@lenticule-science/metrologic/closure`);
- integration into another state model.
