# principal

The OS identity tool for the Red Cup Engineering computer — like Unix `uid` + authentication, but derived from
what this computer *is* (paraconsistent, append-only, multi-observer, recognition-governed,
game-shaped) rather than ported from Unix.

A **principal** is not a record you authenticate against. It is a **settled identity cell in the
trace** — a *player* whose identity, authentication, and authority are all settled, contestable,
evidence-bearing **charges**. Capability not credential; recognition not registry; continuous-fold not
session-bit; ⊤-held-dispute not access-denied.

This is an **OS tool** under `computer/`, not a userspace app. It is **pure over the substrate**: it
does no `node:fs` and no write. Every mutating function **returns the `{e,a,v,t}` rows the caller
persists** (the substrate's pure-fold contract — the bytes are the caller's). It re-derives nothing,
building by name on existing computer/math pieces:

- `@red-cup-engineering/computer/posix-holography/eavt-substrate` — `fold` / `settle` / `section` / `relate` / `rowId` / `jcs`
- `@red-cup-engineering/computer/distribution/governance` — `governAction` (FOUR-valued Hohfeldian decision)
- `@red-cup-engineering/computer/process-runtime/allocation` — `allocateProcess` (principal narrows, accountable apex)
- `@561-group/math/chu/four` — `FOUR` / `asFour`

## The surface

| function | what it does |
|---|---|
| `recognize(by, principal, asWhat, at)` | append a positive identity claim (web-of-trust) |
| `dispute(by, principal, asWhat, at)` | the converse — a withholding of that claim |
| `attest(by, principal, attribute, value, at)` | append a signed/property attestation |
| `present(by, principal, capability, at)` | present a held capability as auth evidence |
| `whois(rows, principal)` | **fold** the identity cell → settled identity; a dispute is **⊤, HELD with both witnesses**, never resolved |
| `authenticated(rows, principal, opts)` | the **continuous-auth fold** — reads evidence at act-time; standing **decays toward ⊥** as evidence ages (no session-bit). A challenge-response is a Player/Opponent play |
| `may(rows, principal, action, opts)` | route through `governAction` over the recognition graph → a **FOUR-valued** (Hohfeldian) decision; ⊤ = contested authority (held), ⊥ = no basis |
| `can(rows, principal, action)` | the object-capability limb: do they HOLD a covering capability? FOUR, not boolean |
| `grant` / `revoke` | capability-as-charge; a grant + a revoke on the same cell rise to **⊤** (held, contested), never dropped |
| `attenuate(capability, restriction)` | narrow a capability strictly (the meet of scopes); accountable stays apex |
| `delegate(from, to, capability, world, at)` | delegation via `allocation` — the **principal narrows** downstream, the **accountable stays at the apex** (H⁰-invariant under chain extension) |

### The witness rides in `t`

A row is exactly `{e,a,v,t}`. The eavt contract names `t` the *transaction/witness*. So a row's `v` is
the bare **claim/value** (what the substrate keys a cell on, `jcs([predicate, object])`) and the
**who + when** ride in `t = { by, at }`. This is what lets two parties recognize the *same* claim and
fold to *one* cell (two witnesses on one face), while a recognize and a dispute on that claim rise to
**⊤** with both witnesses conserved. `at` is the time the decay fold reads.

## Run the tests

```
node principal/tests/principal.test.mjs
```

They prove: identity folds; a recognition dispute is HELD as ⊤ with both witnesses (not resolved);
`may()` returns FOUR (incl. ⊤/⊥), not a boolean; authentication decays toward ⊥ (no session-bit); a
delegated capability narrows the principal but keeps the accountable apex; capabilities are held
charges that rise to ⊤ when contested; and evidence is conserved (nothing dropped).
