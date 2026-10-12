# Cells, predicates, and fibers

The central spatial vocabulary in this package is the predication cell.

A cell is not just an RDF-style triple and not a loose object-property-value record. It is an oriented assertion-position over the domain:

```txt
Φ = E × Π × E
```

where:

- `E` is the entity dimension;
- `Π` is the predicate dimension;
- each cell is a `(subject, predicate, object)` address.

## Cell

```ts
export interface Cell {
  readonly subject: unknown;
  readonly predicate: unknown;
  readonly object: unknown;
}
```

A `Cell` is the relational identity of a meme. It says what the meme is about, not what is said about it evidentially.

For example:

```ts
const cell = {
  subject: "elderberry",
  predicate: "grows-near",
  object: "wetland-edge"
};
```

This cell names the address `elderberry —grows-near→ wetland-edge`. Its charge may later be absurd, potential, active, or stable depending on evidence.

## Orientation matters

The subject and object positions are load-bearing.

```ts
{
  subject: "elderberry",
  predicate: "grows-near",
  object: "wetland-edge"
}
```

is not the same cell as:

```ts
{
  subject: "wetland-edge",
  predicate: "grows-near",
  object: "elderberry"
}
```

A package may define a converse morphism or a converse predicate, but it should not silently swap subject and object.

## Predicate typing matters

The predicate is not an incidental string key. It is the coordinate that determines which relational fiber is being considered.

A consumer may use strings for predicates, but the package leaves predicate values typed as `unknown` so higher-level packages can use richer predicate objects.

## EntitySet, PredicateSet, and CellSet

```ts
export interface EntitySet {
  readonly entities: readonly unknown[];
}

export interface PredicateSet {
  readonly predicates: readonly unknown[];
}

export interface CellSet {
  readonly "entity-set": EntitySet;
  readonly "predicate-set": PredicateSet;
}
```

A `CellSet` names the entity and predicate dimensions that define the domain `Φ`.

The package does not require a particular encoding for entities or predicates. It only fixes the structural positions.

## BaseCategory

```ts
export interface Edge {
  readonly source: unknown;
  readonly target: unknown;
}

export interface BaseCategory {
  readonly objects: unknown;
  readonly specialization: readonly Edge[];
  readonly converse: readonly Edge[];
  readonly "subject-projection": readonly Edge[];
  readonly "object-projection": readonly Edge[];
}
```

A `BaseCategory` stores the object set and the morphism slots used by the predication domain:

- `specialization`
- `converse`
- `subject-projection`
- `object-projection`

This package gives those slots names. It does not implement categorical closure over them.

## Fiber

```ts
export interface Fiber {
  readonly "cell-set": CellSet;
  readonly base: BaseCategory;
  readonly "entity-set": EntitySet;
}
```

A `Fiber` is the structural scaffold for a predicate's domain before charges are seeded.

It binds together:

- the cell-set;
- the base category;
- the entity set for the predicate's domain.

## FiberAlgebra

```ts
export interface FiberAlgebra {
  readonly "entity-set": EntitySet;
  readonly assignments: readonly Meme[];
  readonly predicate: unknown;
}
```

A `FiberAlgebra` is the charged assignment surface over a single predicate's `E × E` square.

Each assignment is a `Meme`, meaning each assignment has both:

- a `Cell`, giving the address;
- a `Charge`, giving the evidential state at that address.

## Shape discipline

Consumers should preserve these distinctions:

- A cell is an oriented predication address, not a generic object-property-value blob.
- A predicate is the relation coordinate, not merely a field name.
- A fiber is the scaffold for a predicate domain.
- A fiber-algebra is the charged assignment layer over that predicate domain.
- Charge belongs on assignments/memes, not directly on predicates.

This discipline lets separate packages agree on the same data surfaces without forcing every package to share one runtime implementation.
