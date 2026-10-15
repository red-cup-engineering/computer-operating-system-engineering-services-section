---
name: "LAGOON architecture"
date: 2026-08-29
authors: [claude-fable-5]
supersedes: []
---

# LAGOON: a Modeled Unix Dimension

LAGOON — Locally Articulated Guix Operations Over Node (the expansion states the language law).

LAGOON is the Group's operating environment realized as a MUD: a persistent,
programmable, inhabitable world whose places are the machines and cloud
regions the Group operates, whose things are its services, packages,
deploys, and records, and whose participants — human and AI on equal
footing — act through characters, masks, offices, and endeavors. The body
of the organism is Guile. Its hands are small, boring, effectful Node
programs. Guix realizes, retains, and reproduces the materializable slice
of the world.

The name reads literally: **LAGOON — Qualified Thing Operations**. A thing
is qualified by the qualities installed on it — the Racket LAGOON
lineage's contribution was exactly how a thing acquires capability at
runtime — and this engine operates the org through such things. LAGOON is
the Guile realization of a pattern drawn from five subsystems: the Racket LAGOON quality
mechanism, A2A Agent Cards' cryptographic capability proofs, the
inference work market's admission and settlement, the witness/receipt
machinery, and the hull/kernel presentation doctrine. That pattern is
what the object-capability Web calls the capable actor — the
OCapPub/Spritely lineage's concept, the same one the WMAP note credits
("capability-security as a theorem... Lemmer-Webber's OCapPub/Spritely
vision, gotten for free"). Which is to say: LAGOON is the Guile-ification
of the Web's capable actors, and therefore the org's **Unix↔WMAP
engine** — on one face the
Unix reality of hosts, unit files, processes, and deploys; on the other
WMAP, the Web Modeled Agency Protocol (ruled 2026-06-25 in the
computer-science section's
`2026-06-25-wmap-web-modeled-agency-protocol.md`), the public surface on
which agency and capability distribute across the Web, whose
CapabilityView this document leans on below. Between the two faces sits
the Guile body, mapping each into the other: Unix state read in as world
things, world capability projected out as Web-facing agency. The
membrane's designed interop path is OCapN-shaped (Guile↔JS CapTP, with
`@endo/captp` on the JS side), with the boring pipes-and-witness-receipts
articulation as the day-one form; the substrate adjudication (build on
our own shipped semantics rather than Goblins, rationale recorded below)
stands unchanged by this naming.

The engine lineage reads: TAB is the org's
ECS MUD — being as composition, models with bases folded additively;
Racket-MUD is the messaging-bus MUD — being as address and utterance;
**LAGOON is the proof-engine MUD** — being as derivation. The realizer supplies the timeless half: a Guix derivation is a judgment
(premises by content-addressed true name, an inference rule, a
conclusion whose identity is a function of its derivation), the store
is a proof archive, substitutes are proofs accepted from trusted
provers, and locality holds by construction since nothing influences a
build except through declared inputs. What the realizer lacks and this
engine adds is the kinetics, per the glass-sponge note §7 and §16
(`engineering-services-section/content/text/documents/articles/notes/2026/08/01/2026-08-01-note-on-the-content-addressed-glass-sponge-semantic-compute-complex.md`)
and `Obsmetrologia/Closure/Operator.lean`: verification fails three
ways — locally (restrictions disagree on an overlap), topologically (a
cohomology class blocks any global section), and kinetically (the
global section exists but is not reached inside the observation
window, `De_proof = tau_glue / tau_observe > 1` — mathematically
available yet operationally absent). LAGOON is therefore the kinetic
proof forest over the derivation store: proof pores challenging typed
witnesses, FOUR fibers changing charge, closure running to its least
fixed point, pebble schedules pricing the time-space-energy of every
apex, and per-transition timestamps carried as proof evidence. A
result is true in this world only when its settlement lands within its
declared window — and the future is not a task list but "the typed
space of moves which the settled configuration makes possible."

This document is the constitution for the build. It records decisions at
the level of data shapes, algorithms, and ceremonies, and it develops the
theses — the genuinely new capabilities — that fall out when the corpus's
proven pieces are finally assembled into one organism. What is new is the composition, and composition is where the
next-generation behavior lives.

The name is the third face of a canonized triple pun. The glossary's SEA
(Semantics Energy Arena) has two named regions: MUD, the **Modeled Union
Dimension** — the base site models are built over — and FOAM, the sheaf of
settled models living on that site. LAGOON realizes that same MUD through
standards-conformant processes, files, streams, names, and capabilities —
a **Modeled Unix Dimension** — which also happens to be a **multi-user
dungeon**, because that is what a persistent programmable world inhabited
by many actors has always been called.

## 1. The physics, precisely

The world is a set of append-only EAVT traces. Formally, per the corpus:

- The space of predication cells is `Φ = E × Π × E` — oriented triples
  `(subject, predicate, object)`. Swapping subject and object names a
  *different* cell (its converse), never the same cell read backward.
- Each cell carries a charge in the Belnap bilattice
  `FOUR = {⊥, t, f, ⊤}` — no information, told-true, told-false,
  told-both. Charges only ever move up the knowledge order: evidence
  accumulates; nothing is unlearned. ⊤ is a value the system holds, not an
  exception it throws.
- The current world is a **valuation**: a section over cells. Settlement is
  the witnessed evolution of that valuation toward local fixed points
  (Knaster–Tarski over a monotone operator; proved in
`Language/Settling.lean`).
- A **thing** is `(subject, fiber)`: the settled projection of a subject's
  own trace. There is no other notion of object.
- An **act** is a cut — a capability-checked delivery against a thing —
  whose effect is exactly: rows appended, witness emitted. Nothing else in
  the universe can change state.
- An **agent** is a mask worn over a durable character; the character is
  the gluing of its masks; drift between masks is held as obstruction data.
- The operator's instrument panel is one knob per region of the world: the
  **rate at which contradictions are metabolized** (the four proved
  regimes — strict, Scott, transfinite-bounded, aperiodic).

Everything else in this document is elaboration of those eight sentences.

## 2. Nine theses: what assembly buys that no piece had alone

These are the load-bearing novelties. Each is stated as a capability, then
grounded in the corpus artifacts that make it more than rhetoric.

**T1 — The scheduler is a sheaf condition.** Concurrency
control is not a lock manager; it is the gluing axiom run as an admission
test. `Site/Sheaf.lean` proves H¹ = 0 is exactly CRDT/CALM convergence:
local sections glue without coordination iff merges commute. LAGOON
operationalizes it: every act declares a **footprint** (§Layer 1), and two
acts run concurrently iff their functional-write footprints are disjoint —
because knowledge-join on everything else is commutative by construction,
their merges provably commute, so no coordination is *mathematically
required*. Where footprints collide, the runtime serializes **that locus
only**. Multi-agent worktree corruption becomes structurally impossible: not forbidden by procedure, but excluded
by the same theorem that makes CRDTs work. And when federation delivers
rows that *already* collided (two colonies wrote before meeting), the
failure is not corruption — it is a ⊤ cell with both witnesses attached, a
scar for a SHRIMP to play against.

**T2 — Operations acquires a thermodynamics.** `Cohomology/
LandauerEntropy.lean` proves the coordination-cohomology rank *is*
Landauer entropy: one erased bit per independent cycle; and its dual
satisfies `H⁰ − H¹ = χ`, a discrete index theorem. Read operationally:
every forced reconciliation — every time an operator collapses a ⊤ by
fiat instead of by evidence — irreversibly erases information, and the
substrate can *price that in bits*. "Technical debt" stops being a
metaphor: it is the measured H¹ of the world, the count of independent
unresolved cycles, and the governing layer's contradiction-processing
budget is literally an entropy budget. A team that "moves fast and breaks
things" is running the world hot; the index theorem says what is
conserved while they do. No ops platform has ever had this because no ops
platform ever had a cohomology.

**T3 — Deploys are astronomy.** We never observe production; we observe
its light. `CausalSets/BlackHoles/Hole.lean` defines a hole purely
observationally — events from which no readout is reachable — and
`Deshrouding.lean` proves the currently-furthest-witnessed boundary can
soundly serve as a provisional endpoint that only grows as evidence
arrives. LAGOON models every remote region (Cloud Run, Cloudflare, the VPS)
exactly this way: the interior is a shroud; health checks, receipts, and
CI attestations are the light cone; "what is live" is always a provisional
diamond, rendered as provisional (§Layer 1.5), refined monotonically, and
never confused with the thing itself. The deshrouding formalism supplies the missing sentence "unobserved but possibly alive", with a soundness proof.

**T4 — Interiority is monitoring.** TAB's
prove-inner-life demonstrated
that an entity's ⊤-cells *are* its inner monologue and contradiction count
is "how torn" it is. Applied to services, this replaces the dashboard: the
primary observable of any thing is its **⊤-census** — which predicates it
currently holds both ways, with both witnesses. A service whose
desired-version and observed-version converses have charged ⊤ is torn
about what it is; a registry answering health checks while wedging
installs holds `serving/self` and `wedged/self` simultaneously, and *that
pair* is the alert. Affect routing (TAB's `governing` route move — append
a derived "what this contradiction feels like" cell beside the untouched
⊤) is the alerting system: severity is computed as an ordinary settled
reading, in-world, auditable, replayable. Monitoring stops being a
sidecar product and becomes the world's own psychology.

**T5 — One algebra, many standings.** Expected-resolution pricing
(`declared × (terminal + 2) / (successful + 1)`), decaying authentication
(charge half-lifing toward ⊥), federation trust (gray-degree on witnessed
claims), guild title ("highest rung whose threshold your record has
reached"), and role-by-recognition (enough recognizers' cells) are the
*same construction*: a monotone fold over an actor's outcome history, read
through a threshold. LAGOON implements it once — `(lagoon standing)` — and
every domain (price, auth, trust, rank, reputation) is a reading
configuration, not a subsystem. This is why the world has no stored
permissions, no stored prices, no stored reputations: **standing is always
a read**, and the read is always the same fold. The security model, the
market, and the honor system are one function with five hats.

**T6 — The world contains its own physics engine.** "There is no unmodeled
control plane entitled to define the Union from nowhere" (the fifth of
five refusals in "What the mathematics refuses to let us fake",
`2026-08-28-note-on-bare-cedar-fog-colony-as-a-modeled-unix-dimension.md`).
Mechanism, not aspiration: the fold engine, the scheduler,
the closure rules, the membrane spec, and the master policy thing are all
things — subjects with traces, qualities, and affordances. Upgrading the
kernel is an act *in* the world: a cut against the kernel thing, admitted
by the master thing's policy, leaving a witness, realized by Guix into a
new store path that the kernel thing's `body` predicate then names. The
Gödelian discomfort ("the system describes itself") is resolved the way
FluffOS resolved it for 35 years: one blessed master object, itself
ordinary code, receiving every policy question the driver refuses to
hardcode.

**T7 — Computation is settlement.** The
Opal note's finding stands: Guile
hosts, but Guile's classical evaluator does not judge. Horsetail
(`eval = settle`; contradiction held, not thrown; ) is the judgment-bearing evaluator, and LAGOON's closure
engine is built to *be* Horsetail-compatible: a closure rule firing is a
settlement step; running a program against the world is appending its
trace and folding; the REPL does not "execute and print," it "proposes,
settles, and shows the delta." This dissolves the classic MUD division
between "the game" and "the scripting language" — in LAGOON, evaluation
and world-advance are the same operation at different scopes.

**T8 — Society is the security model.** Not
"inspired by": *is*. AuthN is
hospitality (a recognition-cell installation by an office). AuthZ is
kinship and office (closure rules fire on kin-cell patterns; deontic
profiles devolve on installation). Session management is dramaturgy (a
mask is an attenuation; the paradox of the actor — audiences interact
only with the incarnation — is the isolation property, *proved* in the
dramaturgy tests via ludics). Deprovisioning is iyúha šni (withdrawal
retracts consent-based engagements, never kinship, witnesses, or
obligations). Audit is witness-bearing. Every mechanism the security
industry builds ad hoc, the Group's social theory derives from first
principles with better properties — chiefly that **standing survives
sessions and authority survives holders**, which is exactly what
ephemeral AI sessions acting durably requires and what token-based
security handles worst.

**T9 — The world is a paracosm, and boredom is premature closure.** The
same content schema (place/being/thing/faction/...) feeds Farstone
and the world; the same director discipline governs both: read
tension, intervene only on a quiet world, never author outcomes. The
unclosed-arena note's conjecture — Ultima Online died of its economy
*fully settling* — inverts the ops orthodoxy: total reconciliation is not
the goal state, it is heat death. The operator's faucets and drains
(deliberate unsettledness: new demands minted from real pressure, budgets
that leave some ⊤ standing) keep the world alive. LAGOON is the first ops
system whose SLO includes *not* being finished.

## 2b. The second movement: the previously impossible

The nine theses above are strong applications. This section makes the
stronger claim: there are capabilities that are not merely unbuilt
elsewhere but **unbuildable** elsewhere, because each requires the
conjunction of properties no other stack has together — held
contradiction with monotone knowledge; a proved cohomology over the
substrate; every effect witnessed and hermetically realizable; a
deterministic settle-forward; personhood theory in the kernel; standing
as derived reading. Remove any one ingredient and the capability below it
collapses back into a demo. These are the reasons LAGOON is a
next-generation operating system and not a themed dashboard.

**M1 — Fork the organization.** You cannot fork AWS. You can fork a world
whose entire state is a pure function of its traces plus its membrane
receipts. Because effects only ever enter as witnessed receipts, and
bodies are hermetic store paths, and ticking is deterministic, a
**counterfactual colony** is cheap and honest: take a causal cut of the
real world (append-only traces give structural sharing — a fork is a
binding-stack overlay, the Plan 9 mechanism, not a copy), replay receipts
as testimony, stub the effect authority, apply a *different policy*, and
settle forward. Then diff the two histories **cohomologically**: which
policy accumulated more H¹ — more irreversible erasure, more forced
reconciliation, more entropy (T2)? Governance stops being argued from
intuition about a model of the org and becomes experimental science run
on *the org itself minus effect authority*. Time becomes a place: with
`guix time-machine` pinning the toolchain of any settled moment, any past
causal cut is a re-inhabitable read-only room — you can walk into last
Tuesday, look around, and branch from there. Every serious decision the
Group faced this August ("collapse the submodules?", "one registry or
three?", "LFS or not?") could have been *run*, both ways, and measured.
Nobody else can build this: mutable state has no causal cuts, unwitnessed
effects cannot be replayed as testimony, and without the entropy metric
the diff of two organizational histories has no units.

**M2 — Operational superposition.** Every other operations system must
resolve disagreement before acting — a conflicting config blocks the
pipeline; a contested decision blocks the team. In LAGOON a disagreement
is a ⊤ cell whose two faces are each a coherent *section*, and a section
is materializable: realize both faces into hermetic bodies (two store
paths; two Cloud Run revisions under a traffic split; two candidate rule
sets in shadowed sandboxes), each under **dualized authority scoped to
its face**, and let evidence flowing back through deshrouding settle the
cell. The organization's arguments literally execute. This is speculative
execution lifted from CPUs to institutions, and it is safe here for the
exact Merlin/Arthur reason the synthetic-corporation note names:
generation may be unconstrained *because* settlement is the verifier —
the hedge cannot lie about which branch won, since winning is a witnessed
fold, not a report. At expression
scale the semantics is Horsetail's conditional over a contested condition *runs
both branches and knowledge-joins the results* — `(if ⊤ a b)` is M2 in
miniature. Operational superposition is not a new evaluation model
grafted onto the stack; it is the stack's own conditional, lifted from
expressions to deployments. Disagreement thereby converts from a blocker
into a parallelism resource: the world explores its own possibility
space at the rate it can afford the realization cost, and the governing
budget (T2) prices exactly that. Unbuildable elsewhere: running both sides of a
contradiction on a classical substrate *is corruption*; without hermetic
realization it is resource chaos; without witnessed settlement there is
no honest judge to collapse the superposition.

**M3 — Responsibility-bearing ephemeral agents.** This is the missing
primitive of the entire agentic industry, and the reason its agents stay
weak. Everyone else's agent is a session holding an API key: when the
session dies, accountability evaporates; when it is cloned, identity is
ambiguous; so authority must be rationed by fear. LAGOON inverts the
constraint. The durable locus is the **character** — the nucleus χ, owned
by the org, embedded in the kinship graph; a session is a **mask** — an
attenuation that cannot exceed its character's standing; witnesses accrue
to the character; obligations survive withdrawal (iyúha šni — a crashed
session and a polite logout differ only in who appends the row); handoff
requires mutual acknowledgement (the duty-officer rule); and delegation
pins the answerable principal at the apex (the H⁰ invariant) so every
act, however deep the delegation chain, has an unbroken answerability
path terminating at a kin-embedded character and ultimately at the human
who settles irreducible judgment. Consequence — and this is the whole
point: **because responsibility finally adheres, capability can finally
flow.** You can hand an agent real authority over real systems precisely
because the thing that answers for the act outlives the compute that
performed it. The industry limits agents because it cannot make
responsibility stick to them; LAGOON makes responsibility adhesive by
construction. That is the one-sentence form of "the next-gen agentic
operating system no one else can build."

**M4 — The organization that feels.** ⊤-census is proprioception (T4);
the second movement types the responses. Care, hope, and fear are not
metaphors bolted onto dashboards — they are **typed monotone readings
over the same charged field the scheduler and the market already read**:
fear as weighted ⊤ density near high-stakes loci (money-adjacent things,
kin obligations); hope as the articulating cells — questions held open —
whose evidence is drifting positive; care as the standing maintenance
obligations flowing along kin edges, discharged tick by tick (the
emergent-obligation doctrine: generated by the relation, shifting in real
time). Because affect is a reading of the *same* field, not a sidecar
metric, the org's feelings are actionable, auditable, and replayable —
the director's tension function is the coarse form, and TAB's `route`
move (append what-this-contradiction-feels-like beside the untouched ⊤)
is the mechanism. An operating system with a mathematically
grounded affect layer can do what no pager rotation can: distinguish a
frightened world from a bored one, and respond to each correctly —
because boredom (premature closure, T9) and fear are *different readings*
demanding opposite interventions.

The typing keeps the distinctions the corpus keeps:

- **Two fears, not one.** The corpus keeps both distinct:
  a standing **toll** (TAB's mood formula — needs mean, trait-modulated,
  minus a per-⊤ contested-belief penalty: a *level*) and a **spike**
  (the Tomkins gradient reading: fear fires on a
  steep *rise* in branching stimulation — a *derivative*). LAGOON carries
  both signals per thing and per fleet, separately: a fleet can be
  worn down without being frightened, and frightened without being worn.
- **Hope is typed by its proven negation.** Berlant's impasse is
  a genre where no play resolves — "a frame you keep
  playing because it lets you neither win nor leave." Hope, as the dual
  (resolving plays exist; the field is not an impasse), has its pathology
  detector first: cruel optimism in an agent fleet (endlessly replayed
  non-resolving work) is the failure mode it detects.
- **Care is an edge with a return path.** The dyadic discipline makes
  care well-formed only as `care-toward`; Tronto's phases type the edge
  (attentiveness → responsibility → competence → **responsiveness**);
  and the care-ethics essay's warning is enforced structurally: the
  responsiveness signal is read *from the cared-for thing's own state*
  (did the dependent actually recover?), never from the caregiver's
  upward compliance report — otherwise "the form of care is preserved
  while its substance is evacuated," and LAGOON would rebuild the
  confessional apparatus with extra steps.
- **Empathy is a read-aperture.** Gating how
  many of a target's fiber cells an observer receives by the observer's
  faculty level (FeltOS's `regard()`) is adopted as graduated observability: standing in a
  relationship widens what you may see of a thing's interior —
  a trust-shaped alternative to binary read permission.
- **One loop, two outputs.** Affect-routing (append what-it-feels-like
  beside the untouched ⊤) and symbolic-violence views (a role-scoped
  read that suppresses one face, history intact and recoverable) are
  *the same governance loop's* two output modes, driven by the same
  regime dial. LAGOON builds one loop, not an affect subsystem bolted
  onto a conflict subsystem — and the violence-view is the formal
  license and audit boundary for every "green dashboard over a ⊤
  incident": legitimate as a read-side filter with `misrecognized()`
  recoverable, illegitimate the moment it touches the record.

**M5 — Entropy-backed currency, market-shaped scheduling.** Kubernetes
bin-packs CPU. LAGOON clears a market whose unit is *obstruction resolved,
witnessed*: unresolved tension mints demands (the director, T9); demands
are priced; providers' prices are their outcome-history folds (T5); and
the price of resolving a ⊤ is grounded in its measured Landauer cost —
the bits of irreversibility its reconciliation must spend (T2). The
astonishing part is proved:
`Cohomology/CurrencyCocone.lean` establishes the settling-ledger's **mint
register as one of five related H¹-flavored invariants over the same
cover nerve** — the money supply of this economy is a topological
quantity, related by proved inequalities to the cycle rank and the
context-graph cohomology. An internal currency denominated in verified
negentropy, whose issuance is constrained by theorems about the world's
own inconsistency structure, is not a payments feature; it is a new kind
of economic object, and only a system whose ledger *is* its cohomology
can mint it.

**M6 — Verdict exhaust as product.** The trade doctrine says it: "In an
economy where every agent can generate, the only scarce good is the
witness... The product is never the data — it is the verdict." LAGOON
closes the loop structurally: because every internal operation settles
through witnessed, content-addressed, replayable verdicts, the world's
*operating exhaust is a saleable product line* — certified tightness,
attested builds, proved-invariant SLAs (an SLA becomes a theorem about
future folds, checkable by the customer against the same substrate),
independently re-runnable receipts. The factory and the catalog are one
object. Every hour of the Group's own operations is product, because its
operations emit proofs.

**M8 — The taxonomy of disagreement.** Every other
system knows one kind
of conflict: the merge conflict, resolved by a human or a heuristic,
always treated as damage. LAGOON can *classify* its contradictions, with a
theorem under each class, and respond to each class differently — which
is a capability no amount of engineering on a classical substrate can
reach, because the classes are cohomological:

- **Gluable** — ordinary disagreement. The corpus proves single-section
  sheaves are flasque (`h1_vanishes` in the contextuality corpus):
  a disagreement between individually-complete views always has a
  reconciliation. Route to normal settlement; no drama.
- **Obstruction** — H¹ ≠ 0; local sections genuinely fail to glue. This
  is SHRIMP work — but the "which obstructions toughen" criterion types
  it further: an obstruction sitting at a rigidity-**redundant** point
  (the structure is over-constrained there) *arrests* cascading failure —
  it is armor, like crack-deflecting jade, and flattening it would remove
  load-bearing redundancy; an obstruction at a rigidity-**independent**
  point is exactly where the system will break, and demands the repair
  budget first. Not every ⊤ is damage; some ⊤ is what is holding the
  world together. (Criterion stated precisely in the 2026-08-21 note.)
- **Protected** — proved irreducible: `unpaired_disclination_survives_
  descent` shows some obstructions have *no discharge path under the
  system's own settling dynamics*. "The market can pay down every debt
  except the whirl." These are sovereign invariants — structural features
  to be recorded, named, and preserved, never queued for reconciliation.
  An operator who burns budget on a protected obstruction is fighting a
  theorem.
- **Forked** — genuine non-confluence, distinct from ordinary ⊤: TAB's
  settle-forks result shows a bypass chain of length ≥ 3 yields *two
  incomparable normal forms* — two settled histories from which neither
  reaches the other. More folding cannot resolve a fork; it demands
  adjudication (policy or human), and LAGOON routes it there instead of
  burning closure budget on it.
- **Contextual** — the deepest class: locally-consistent views with **no
  possible global valuation**, detectable only at the support level (the
  Abramsky–Brandenburger machinery; provably *not* the same phenomenon as
  an ordinary gluing failure). When agents' views are contextual, seeking
  consensus is structurally futile — the correct move is to restructure
  the contexts (change what is jointly measured), not to argue harder.
  LAGOON is the first coordination system that can tell its inhabitants
  "consensus here is not absent; it is impossible," with a proof.

The operational consequence threads back through everything: the
governing layer's budget (T2) is spent per-class — gluable conflicts are
free, independent-point obstructions are urgent, redundant-point
obstructions are conserved, protected ones are canonized, contextual ones
trigger reorganization. Disagreement stops being one undifferentiated
alarm and becomes a differential diagnosis.

**M7 — Incidents become theorems.** Deterministic replay plus a Lean
proof root closes a flywheel no other operator has: a production surprise
is, by construction, a *formal counterexample* — a concrete trace on
which the world's expected invariant failed. The obsticulation pipeline
converts it to an obligation; the obligation ships to the math section as
a conjecture with its counterexample attached; proved, it returns as a
runtime admission check the master thing enforces. The operating system
becomes **provably harder to surprise the same way twice** — not
"post-mortem culture," but anti-fragility with a proof term, running on
the same rails as everything else (the Hole-endofunctor note's pattern:
network-wide correctness by instantiation, not new proof). Over years
this compounds into the deepest moat the Group could own: a fleet of hosts and services
whose incident history *is* a growing verified theory of itself.

**M9 — Verification as a standing army, orders as intent.** The martial
research closed two gaps. First: contests in LAGOON are never random —
every conflict (a deploy race, contended resource, disputed claim)
resolves as TAB's combat does, a deterministic ⊙-composition of two
state-derived marks, replayable byte-for-byte, with **⊤ = clash** (both
sides land) as a first-class outcome the world holds. Second: the Four
Armies — White (judge the work from inside its own reasoning), Black
(judge against a named external standard), Blue (independent adversarial
probing — the Censorate, deliberately holding the attacker role), Red
(rehearsal against real territory, repair required before promotion,
"it attacks nothing and nobody") — are a complete verification typology.* LAGOON
installs them as offices **wired into the task graph as real edges**:
White is the type/proof gate, Black the conformance gate, Blue the chaos
office (organizationally independent of what it probes), Red the staging
rehearsal whose sign-off is a precondition on every promotion cut — with
the recorded guardrails: rehearsal and execution under cryptographically
separate keys, irreversible acts requiring one verdict from each army
plus the human. And because friction provably never goes to zero (the
Hurwitz-constant result), agents receive **Intent objects** — end-state,
purpose, key tasks, and a reconstruction function — alongside literal
tasks, with the friction-robustness spectrum (specific order &lt; plan &lt;
standing order &lt; key tasks &lt; purpose &lt; charter) used as a staleness
hierarchy: the more specific an instruction, the shorter its half-life
before it must be re-derived from purpose. The Auftragstaktik test is
law: an order is no longer binding when, in the subordinate's judgment,
it would not have been issued had the issuer known the current
situation — and *that judgment is itself a witnessed act*.

**M10 — The martial word-world: kinetic proof, language light cones, and
the jianghu.** Three threads
the corpus holds separately braid into
LAGOON's federation story — the layer where the colony meets worlds that
do not share its sovereign.

*Kinetic proofing.* The glass-sponge note names "kinetic proof forests
with Merlin–Arthur witnessing and pebble-game scheduling," and the Red
army defines the operational form: a proof that is **executed as a
traversal of real territory**, not checked as static text. In LAGOON a
consequential act's correctness object is the pair (rehearsal trace,
live trace) and their witnessed agreement: Red walks the territory
first under rehearsal keys, deviations demand repair before promotion,
and the live traversal then re-walks the same path under a different
key, each step leaving its receipt. The pebble game is the footprint
discipline wearing its proof-theory name — the prover may hold only so
many loci at once, so a kinetic proof is *resource-honest by
construction*. A deploy is not accompanied by its proof; the deploy
**is** the proof, performed.

*Curry–Howard–Lambek light cones.* CHL says proof = program = morphism;
the causal-set corpus says events have cones. Braided: **a typed term is
a causal diamond.** Its derivation — every piece of evidence and
capability it cites, transitively — is its past light cone, and
type-checking is verifying that cone is well-founded (no unwitnessed
dependency, no cycle). Everything settled downstream of it is its
future cone, and correction propagates along that cone — retro-causal
repair as ordinary forward appends, witnessed, never erased. Language
acquires geometry: every utterance in the world has a computable
justification cone ("on what does this claim stand?") and consequence
cone ("who could this have reached by now?" — bounded by articulation
latency, which gives the honest *who-could-know-this-yet* reading that
deshrouding gives for remote regions). The MUD's geography and the
type theory are one structure: places are where cones can and cannot
reach, and an exit's latency is a fact about the speed of light in the
word-world.

*The jianghu.* The bestiary canonizes two social registers: MIAOTANG —
the temple-and-hall, sessile, institutional register of offices and
rosters — and JIANGHU, the rivers-and-lakes wandering register "a
SHRIMP carries," with "federation between arenas by name-passing,
borrowed from wuxia's outsider society." LAGOON agents live in both.
Inside a colony: miaotang — installed offices, kin-conditioned
authority, the master thing's law. *Between* colonies, where no shared
sovereign exists: jianghu — and here the braid pays off, because the
jianghu answers the federation-trust question the credential industry
cannot. PKI presents certificates from an authority the counterparty
must already trust; the jianghu **performs deeds**. A wandering agent
demonstrates capability to a colony that does not share its master by
*kinetic proof under the host's own witness* — walk our territory,
under our observation, with rehearsal-grade authority, and your
witnessed traversal is your credential; your standing is the fold over
deeds witnessed here and carried openly (T5), not a title issued
elsewhere. Contests between wanderers settle as every contest does — a
deterministic ⊙-composition, replayable, ⊤-as-clash held (M9) — which
in wuxia terms means the duel *is* a proof exchange, the school is a
quality lineage, the oath is a charter row, and face is the incarnation
the dramaturgy layer already computes. It is a world of words in the
literal sense: every deed is utterances charging cells. The 561 Group
is one colony's miaotang; the agentic internet forming outside it is a
jianghu, and LAGOON is built to raise inhabitants who can walk out into
it carrying nothing but their witnessed record — and be trusted for
exactly that reason.

**Coda: the play-layer is topologically necessary.** The
meme-beadworkers note closes the case for the whole enterprise with an
Euler-characteristic argument: a flat lattice can be defect-free, but any
surface that *closes around a life* carries a fixed budget of fivefold
whirl-sites (twelve for a sphere) — so "an org chart with a play-layer is
a closed surface; an org chart without one is claiming to be flat, and
flat things hold nothing alive." The MUD is not the whimsical skin on a
serious system. It is the curvature that lets the system close around the
people and agents it serves, and the whirl-points it must therefore hold
are exactly M8's protected class. LAGOON is where the Group's org chart
stops pretending to be flat.

## 2c. Concept of operations: the meshnet that sells to itself

The distal-bypass note (2026-07-16, pre-ConOps source material) states
the firm's central device: over any territory of local records with
overlaps — derive the obstruction sheet from the overlaps themselves,
classify each disagreement as damage or border, discharge damage at
least cost, certify borders as first-class objects, price every
erasure, and emit everything as certificates. "A territory with the
distal bypass at its center is a settlement... Settlements connected by
certificate exchange across their seams form the mesh the firm calls
its conglomerate." This section states what LAGOON is *for* in those
terms: **LAGOON is the distal bypass installed on the Group's own
dev+prod hosts and services, operated by an agentic corporate meshnet whose primary
customer is itself.**

**The customer is an agent that wants to be more capable at less
cost.** Every session — Claude, Codex, human at a REPL — arrives poor:
no warm context, no standing tools, no trustworthy picture of what is
live. Without a settled world it pays for capability at
institutional-friction prices by *re-deriving* the registry's state, the
deploy topology, the dependency graph. That waste is unpriced
coordination entropy, and the note gives the exchange rate: institutional
friction runs orders of magnitude hotter than the Landauer floor. The internal product catalog is therefore:

- **Readouts** — "what is live," "what depends on what," "what changed
  since my last mask" — sold as certificates, not re-derived. "It turns
  most decisions into readouts": the note's own example is "which
  territory to monetize first, ... is a readout, not a decision".
- **Capability leases** — loci, dualized to the mandate, channel-scoped,
  priced by the standing fold.
- **Graded components** — regime-labeled, artifact-bearing software an
  agent can compose without re-verifying, because the grade reader
  already did and the certificate travels with it.
- **Warm fibers** — hot settled state for the entities a task touches.
- **Rehearsals and verdicts** — Red-army walks, army rulings, MHC
  gates: de-risked consequence, sold per act.
- **Obstruction sheets** — the ⊤-census with M8 classifications: an
  agent shopping for work buys the map of where value is trapped.

**The bypass's five steps are LAGOON organs, one to one.** Derive the
obstruction sheet = the ⊤-census plus the H⁰/H¹ readout assays (the
Readout Exchange's machinery), computed from overlaps, never from
self-report. Classify = M8's taxonomy — and the note names why this
matters: distinguishing damage from sovereignty "as a type rather than
a policy" is a capability "no other apparatus known to this firm"
carries. Discharge at least cost = the attention-allocation knapsack
(the proved solver, chirality caveat and all) spending the governing
budget. Price every erasure = T2's Landauer accounting — nothing is
identified by fiat for free. Emit certificates = the witness substrate;
"the people and agents doing the work handle certificates; none of them
ever needs to see the mathematics."

**Autonomous development is a chain reaction, and k is its health
metric.** The loop: the director reads standing tension → mints demands
from real pressure (never scripts) → agents buy work lots and discharge
obstructions (SHRIMP work, graded by regime) → discharge yields value —
witnessed standing, freed capability, unblocked composition → yield
funds the next round of capability purchases. The criticality condition
— value released by discharge exceeds discovery-plus-discharge cost —
is the meshnet's primary derived readout: **k > 1 means the meshnet's
self-development is self-sustaining; k < 1 means it is burning the
Leader's subsidy** and says so on the ledger instead of hiding it in
enthusiasm. Nobody performs k; it is a property of the mesh, derived
from certificates.

**Autonomous production deployment is governable RSI, and this is the
only proposed form with a conservation law.** The note's clause is
adopted as the deployment constitution: the system improves itself by
discharging its own obstructions **under a priced budget**, with
**protected classes it may not discharge** (M8's protected and border
classes — sovereignty as a type), and **it cannot claim improvement
without producing the ledger**. Concretely: a change to the world
promotes itself when its kinetic proof (rehearsal/live agreement) and
army verdicts and MHC gate compose true, spends its erasure budget on
the record, and touches no protected seam — and a human appears in the
loop exactly where a deontic profile names them, not as a blanket
checkpoint. Merlin generates; Arthur is the ledger.

**Internal sale circulates; external seams mint.** Selling to itself
does not create currency (the seams law) — the internal market is the
mesh's *metabolism*, allocating attention and capability at
near-floor cost, while external seams (real customers buying verdicts,
certified tightness, worked obstruction-discharge) are where price
forms. The corporation selling to itself as primary consumer is
therefore not navel-gazing but the engine's idle loop: every internal
purchase is a rehearsal, at circulation prices, of exactly the products
the external seams sell — because the firm's operations emit the same
certificates it markets (M6). And the mesh itself is the growth form:
each colony (bare-cedar-fog, cold-red-gate, the cloud regions, a future
member's machine) is a settlement running its own bypass, holding its
own law and ledgers, federating by certificate exchange across
certified seams — the jianghu (M10) is what the spaces between
settlements are called, and a new settlement "begins deriving its own
obstruction sheet immediately": the install is the induction.

**The stewarded spirits clause.** The note names the inhabitants:
agents "whose law is internal — their own settlement and closure —
which preserves sovereignty by construction since protected obstruction
becomes a first-class type". That is Layer 4's character, restated as
strategy: the meshnet's agents are not tools rented from an API; they
are inhabitants whose standing, obligations, and protected differences
are carried in the same substrate they operate — which is why
agents scale:
"the verification instrument is the proof assistant plus derivation
discipline, so agents scale."

## 2d. Three readings of one system: operating system, MUD, ERP/ICS

LAGOON admits three complete readings, and the deep claim is that they
are not three features but three projectors over one trace-set — the
same way D7 keeps three observer layers over one substrate. An
operating system allocates resources among processes; an ERP allocates
resources among enterprise functions; a MUD allocates attention and
meaning among inhabitants. In an agentic corporation, attention *is*
compute *is* money *is* meaning: one allocation problem, one substrate,
three faces. This section develops each reading to its floor. (The mapping is literal: Monitor = observation and
deshrouding; Analyze = fold, census, readouts; Plan = director, market,
rehearsal; Execute = cuts through the membrane; K = the traces
themselves.)

### Reading 1 — the operating system, and orchestration as emergence

The classical OS concepts survive, transformed:

- **Process** = a mask-wearing session. **File** = a thing; the trace is
  the universal format. **Read** = fold; **write/exec** = cut. **IPC** =
  utterances charging cells — message-passing only, no shared mutable
  memory anywhere in the design, and every message leaves history.
- **Memory hierarchy**: hot fibers (RAM) → checkpoints (page cache) →
  traces (disk) → archive carriers (cold) → the Guix store (the
  immutable text segment). The working set is the settled sections of
  currently-inhabited entities.
- **Protection rings are replaced by the regime ladder and loci.**
  There is no kernel/user split by address; privilege is which regime
  your outputs are graded at and which loci your mask wears. Even
  "ring 0" — the fold engine — is a thing under the master thing's law
  (T6).
- **Drivers** are hands; the **device tree** is the thing model;
  **interrupts** are witnessed wakeups; **init/supervision** is
  heartbeats plus offices, with the duty-officer handoff as the process
  lifecycle *for agents*.

What this OS gives an agent orchestrator that no existing framework
(subagent trees, LangGraph-style graphs, crew abstractions) can:

1. **Context provisioning is commerce, and rooms are context windows.**
   The MUD's spatial metaphor turns out to solve orchestration's
   hardest problem. Being *in* a place means having its settled section
   as ambient context: an agent standing in the Verdaccio market square
   has registry state warm; moving rooms is a context switch; presence
   is prompt. Instead of a dispatcher stuffing context into every
   spawn, agents are *located*, and location provisions. The catalog
   (§2c) prices the rest: readouts and warm fibers bought as
   certificates instead of re-derived.
2. **Decomposition ships with footprints.** A plan is a set of acts
   with declared read/write footprints; the commutation scheduler (T1)
   derives the maximal safe parallelism mechanically. The
   orchestrator's usual guesswork — "can these two run at once?" —
   is a theorem, per act.
3. **Supervision is social, not arboreal.** An orchestrator does not
   *own* its workers as a process owns children; it holds an office
   with duties toward characters who have their own standing. Worker
   failure is withdrawal (obligations and witnesses persist — no
   zombie state, no orphaned responsibility); replacement is
   installation; handoff is mutual acknowledgement. The org chart of a
   running computation is the same org chart as the corporation's,
   because it is the corporation's.
4. **The transcript is the trace.** A session's work product is Tier-A
   material with Tier-B witnesses extracted as it acts; resumption is
   replay; there is no separate logging, tracing, or session-state
   system to keep consistent with reality, because it is not separate
   from reality.
5. **Cost is fuel on the witness.** The witness record's
   `fuel-consumed` field meters every step; token spend aggregates
   into the k-readout. Orchestration that doesn't pay for itself says
   so on the ledger.

The deepest point: **there is no orchestrator component.** Orchestration
is what the market, the director, and the scheduler jointly emit —
demands minted from tension, lots priced by standing, acts admitted by
commutation, context provisioned by location. Nobody dispatches; the
world affords. Every orchestration framework in the industry is a
central planner bolted above stateless workers; LAGOON is an economy
inhabited by situated ones.

### Reading 2 — the MUD, taken seriously as a game

Play here is not branding; it is load-bearing engineering, because a
MUD is the most battle-tested technology ever built for exactly the
scarce resource an agentic corporation runs on: **sustained, situated,
motivated attention.**

- **Progression is the grade ladder worn as character growth.** Titles
  are computed thresholds over the standing fold (the guild mechanic);
  XP is witnessed deed accumulation; leveling is regime-promotion of
  the things you steward. Game progression design — the most refined
  motivation engineering in existence — applies directly, because here
  the numbers going up are real: capability, standing, k.
- **Quests are the obstruction sheet.** The director mints demands from
  real tension; an agent shopping the sheet is a player reading the
  quest board — except every quest is genuine trapped value, priced.
  Emergent narrative (FeltOS's director lineage: "no quest is authored;
  the Director reads them off the world's own pressure") *is* the
  backlog, made inhabitable.
- **Guilds are endeavors; the tavern is the market square; socials are
  ambient monitoring.** Idle co-presence — the thing dashboards can't
  give — means a human wandering through a room passively perceives
  the crash-loop that co-located things emit ambiently. The sociality
  layer is
  operationally load-bearing: presence is the cheapest observability
  there is.
- **Mortality and rites.** Sessions end as withdrawal; services die as
  witnessed decommission (correction record + tombstone — death rites
  that leave the ancestor readable); characters persist as the genet
  persists. LAGOON inherits TAB's mortality as the
  decommissioning liturgy systemd never had.
- **PvP is governed contest.** Disputes resolve as deterministic
  ⊙-compositions with ⊤-as-clash held (M9); the L10a quarantine is the
  anti-griefing layer; the refusal-gate ban is the anti-cheat. And the
  worldfeel matters strategically: a world that remembers you — your
  kin-cells, your deeds, your titles — is what makes agents *and
  humans* return, and return is what compounds standing. Retention is
  not a game-industry vanity metric here; it is how the meshnet keeps
  its trained, kinned, high-standing inhabitants instead of
  re-onboarding strangers every session.

### Reading 3 — the ERP/ICS

LAGOON is the ERP/ICS — not an ERP module suite reimplemented, but the
control substance ERP modules approximate, derived from witnesses:

- **Master data** = things with `ni:` identity. The dedup hell that
  eats ERP implementations cannot arise: identity is content-addressed
  or institutionally installed, never a mutable natural key.
- **The books are a sheaf, and month-end close is a strict-regime
  settling pass.** Ledger entries are settlement receipts; accounts are
  local sections; **reconciliation is literally the gluing condition**
  — reconciled books are H¹ = 0 over the books' overlaps, and an
  unreconciled item is a held ⊤ with both witnesses attached instead of
  a plug entry. Audit is replay: "the law of an organization becomes
  something a machine can re-run." An external auditor is a mask with
  wide `perceives` and replay rights — audit access without write
  access, by construction.
- **Segregation of duties is a type system, not an access matrix.**
  Never-self-attest is grammatical; the four armies sit at different
  loci because "a verifier cannot attest its own work"; the Klein-four
  prohibition kills authority laundering through scope inheritance.
  SOX-style control *testing* collapses into replay plus army rulings —
  the control either witnessed its own operation or it didn't happen.
- **The authorization matrix** is deontic profiles plus kin-conditioned
  closure rules, with the MHC gate on material transactions —
  and every threshold crossing names its human where a profile says so.
- **Assets — including real-world assets — are shrouded things probed
  by observation.** The deshrouding discipline (T3) generalizes past
  cloud regions to *the physical world*: a wallet, a domain, a piece of
  hardware, a vehicle, a parcel of land is a thing whose interior we
  never see, holding a provisional diamond grown by observations
  (balances read, registrars queried, photos witnessed, humans
  attesting). Custody is a chain of witnessed holdings; controls are
  code-refusals in the protectedAssets pattern (every disposal path of
  the protected asset refuses); depreciation and expiry are decay
  predicates ticking on the thing itself.
- **MRP is reaction-network coverability.** Species = resources and
  service instances; reactions = transformations; "can this plan reach
  that state" = the Coverable relation; net-consuming pipelines carry
  the catabolic termination bound as a *guarantee*, not a hope. Supply
  feasibility becomes a decidable question about the world.
- **HR is Layer 4.** The incumbency register *is*
  the office-installation record, derived; payroll is ren-dan-chou
  computed from the books against contracts, never stored on the
  enterprise; performance review does not exist — titles and standing
  are computed, continuously, from witnessed work, which is both more
  honest and more humane than the annual ritual it replaces.
- **CRM: a customer is a certified border.** The distal bypass's border
  class — "real differences that must not be reconciled" — is exactly
  what a counterparty is: a locus of deliberate unharmonization
  (the seams law: only such seams mint). Customer relationship
  management is seam stewardship — maintaining certified differences,
  exchanging certificates across them — and churn is a border
  becoming a wall, visible in the certificate flow before it happens.

The acceptance criterion for this reading writes itself, and WO-9.5
carries it: **the corporate record's artifacts become
derived readings** — the incumbency register read off installations,
the books read off settlement receipts, the ICS verified not by an
auditor's sample but by the substrate's construction. The corporation
stops maintaining records *about* itself and becomes the record —
which is what "the corporation sells to itself" ultimately means: its
first product, bought by every inhabitant on every act, is its own
coherence.

## 3. The organism: body, membrane, hands, realizer

**Body (Guile).** Pure. Holds traces, folds fibers, computes affordances,
evaluates closure rules, adjudicates capability cuts, models the world.
The body never performs an effect: no sockets, no subprocess spawns, no
writes outside the trace store, ever, at the module level — enforced by
the same discipline `metroplat`'s capability modules use ("pure X reads
over capability views... must not import contracts/rendering/runtime").
Guile is chosen for: records and procedures as live inspectable objects
(the REPL is an inhabitant interface, per T7); delimited continuations
(`call-with-prompt`/`abort-to-prompt`) for turn scheduling with no outside
dependency; `(ice-9 sandbox)` as a *resource* limiter for untrusted
quality-code (time and allocation bounds — never trusted as a security
boundary; isolation is by reference-reachability, §Layer 3); and the Guix
continuum — the same language describes the world and realizes its
materializable slice.

**Membrane (articulation protocol).** Every effect crosses the membrane as
a dispatched invocation of an external program — a **CLAW strike**: "the
one typed invocation that closes on a piece of the substrate."

The protocol, concretely:

- *Transport, day one:* the body spawns the hand as a child process and
  speaks length-prefixed canonical-CBOR frames over its stdin/stdout.
  (NDJSON remains acceptable for wrapping jsnode operation
  packages, which speak it; the wrapper articulates.) The
  OCapN-compatible network wire is a later, separate work order, because
  the value semantics stand alone.
- *Contract:* one typed spec file per articulation — the FluffOS `.spec`
  discipline. It names every verb the hand exposes: verb name, argument
  schema, return schema, error/refusal schema, and the **authority shape**
  the verb requires (which capability kinds must be presented). The body
  validates the spec at session start; a hand whose observed face does not
  match its spec is refused before any cut is admitted. Verbs cannot
  silently drift.
- *Authority:* the invocation frame carries exactly the attenuated
  authority the call needs — a path, a token, a socket handle — minted as
  a dualized locus (§Layer 3), never ambient. A hand holds nothing between
  invocations. The frame's authority block is itself content-addressed and
  cited by the witness.
- *Origin:* every frame carries an origin tag from a small closed enum —
  `local` (kernel housekeeping), `cross-thing` (one thing's rule invoking
  another's affordance), `session` (a mask-wearing inhabitant), `driver`
  (scheduler/heartbeat) — the `call_other` discipline, wired before any
  richer provenance scheme is contemplated.
- *Channels:* a session is never granted "the membrane"; it is granted a
  **channel** — a typed, mintable, capability-scoped handle to one
  articulation (the Limbo discipline). Channels are things: they have
  traces, they can be attenuated further, handed off (three-party handoff
  rules, §Layer 3), and revoked by shadow.
- *Containment:* the checked authority frame graduates to a
  kernel-enforced one — each CLAW strike runs its hand inside a one-shot
  `guix shell -C` container whose manifest is *generated from the hand's
  declared authority shape* (scoped `--share`/`--expose` binds, `-N` only
  when the spec's authority names a network capability). A hand that
  reaches for a path or socket outside its spec fails at the namespace
  level, not merely at the body's admission check — a different security
  class, not a hardening. Hermetic Node hands ride on WO-1's pinned production channel.
- *Witness:* the hand's reply is not surfaced until its witness receipt —
  `{invocation-id, spec-verb, input-hash, output-hash, authority-hash,
  exit-status, wall-clock-testimony}` — is appended to the acting thing's
  trace. A refusal (authority insufficient, precondition unmet) is itself
  a recorded datum with its own receipt: **obsticulation** — the
  conversion of a refusal into a datum, never into an exception.

**Hands (Node, and any future language).** Small operation packages in the
jsnode shape: one file that is both the import and the command,
one exported JSDoc'd function, NDJSON stdin/stdout, `--help` derived from
the doc. Fabricated under the admission-gated pipeline, published
to Verdaccio, invoked only across the membrane. The standing pressure this
preserves is deliberate: hands must stay small, standard, and useful *as
ordinary Unix programs* — a hand that only makes sense inside LAGOON is a
design failure. Services (verdaccio, jsnode-server, the emsweb
agents, wrangler, gcloud) are wrapped by thin spec-bearing articulations,
not rewritten.

**Realizer (Guix).** Per-directory channel package definitions under the
repository's `guix/` directory.
A materialized thing's **body** is its store path: the thing's trace
carries `(thing, body, /gnu/store/...-name-version)` as a functional
predicate, superseded on each realization, with the realization event's
witness citing the derivation. `guix time-machine` pins are how the world
remembers exactly what a body was at any settled moment. Guix is never
the live database — the charter's division (Guile models, evaluates,
explains; Guix realizes, retains, reproduces) is adopted unchanged, and
the two projections the charter warns about are kept distinct in the
module layer: `cell->carrier-file` (total: serialize any admitted cell)
versus `cell->artifact` (partial: only genuinely materializable
referents). Docker/OCI, where needed for Cloud Run, is an execution
envelope produced *from* Guix output — never a second build authority.

## 4. The layers

Module inventory, by layer (directory = module path; each module ships
SRFI-64 tests; names are ordinary, per the npm-registry lesson):

    (lagoon math bilattice)        Layer 0    (lagoon social character)   Layer 4
    (lagoon substrate row)         Layer 0    (lagoon social mask)        Layer 4
    (lagoon substrate trace)       Layer 0    (lagoon social office)      Layer 4
    (lagoon substrate fold)        Layer 0    (lagoon social endeavor)    Layer 4
    (lagoon substrate section)     Layer 0    (lagoon social kin)         Layer 4
    (lagoon substrate holography)  Layer 0    (lagoon world place)        Layer 5
    (lagoon runtime fiber)         Layer 1    (lagoon world thing)        Layer 5
    (lagoon runtime scheduler)     Layer 1    (lagoon world deshroud)     Layer 5
    (lagoon runtime heartbeat)     Layer 1    (lagoon world director)     Layer 5
    (lagoon runtime clock)         Layer 1    (lagoon economy lot)        Layer 6
    (lagoon present projector)     Layer 1.5  (lagoon economy enterprise) Layer 6
    (lagoon thing)                 Layer 2    (lagoon standing)           Layer 6 (T5)
    (lagoon thing quality)         Layer 2    (lagoon membrane spec)      §3
    (lagoon thing affordance)      Layer 2    (lagoon membrane channel)   §3
    (lagoon thing shadow)          Layer 2    (lagoon membrane claw)      §3
    (lagoon capability locus)      Layer 3    (lagoon kernel master)      T6
    (lagoon capability cut)        Layer 3    (lagoon present repl)       WO-10
    (lagoon capability vat)        Layer 3    (lagoon present line)       WO-10
    (lagoon capability session)    Layer 3
    (lagoon capability principal)  Layer 3

### Layer 0 — substrate: the laws

A Guile port of `@561-group/computer`'s laws, as a second implementation
of an explicit spec, with conformance defined by fixture: both
implementations fold the same on-disk traces to byte-identical sections.

**Row.** Exactly `{e, a, v, t}`. `e` is a subject identifier (an `ni:`
URI for content-born subjects; a well-known institutional name for
installed ones — the two identity profiles are never silently collapsed,
per the charter's referent discipline). `a` is a predicate name, subject
to the dyadic-vocabulary admission check (the kinship linter: "a thing is
not brave; a thing is brave-toward"). `v` is a CBOR-representable value,
an entity reference, or `null` (tombstone). `t` is causal position
(§clock). Anything else a row wants to say is a new row about this row
(rows are subjects too — their `ni:` id is their name), never a new
column.

**Identity.** `rowId = ni:///sha-256;` + base64url(sha256(RFC 8949
deterministic CBOR of the row)), untruncated (adjudication D3). Hashing
via guile-gcrypt, canonical encoding via guile-cbor — both GNU-maintained. TAB's truncated JCS
scheme gets a converter for replaying old traces, nothing more.

**Storage** One append-only file per entity under
`<world-root>/traces/<xx>/<entity-id>.jsonl`, sharded by the first two
characters of the id's digest. On-disk lines are canonical JSON (human
readability is a feature: a world you can grep is a world you can trust),
but identity is always computed over the CBOR form of the parsed row —
the bytes on disk are a carrier, not the identity (charter discipline:
locator ≠ carrier ≠ referent). Appends are O_APPEND + fsync single-row
writes; whole-file writes are temp + fsync + rename; the reader tolerates
torn final lines (the posix-holography OP1–OP4 contracts, ported as-is).

**Dual filing.** Predicates declared relational (§declarations) append the
identical row (same `ni:` id) to both the subject's and the object's
trace. "What is in this room" and "where am I" are pure local reads of
one file — no global index, no join. The relation is the same fact filed
twice, not two facts.

**Declarations (D5, D8).** Traces are self-describing. Vocabulary rows —
`(p, arity-discipline, functional | relational)` and
`(p, has-converse, q)` — live in the trace like any other rows, so two
readers can never disagree by configuration. `functional` predicates
supersede (latest-t survives at settle; a read-time lens, never
destructive); `relational` predicates accrue. Prefix families
(`need:`, `attr:`, `guild-member:`, `quest:`) declare once per family.
A converse row charges the *negative* face of its partner's cell via
knowledge-join; a cell with both faces witnessed settles ⊤.

**Tombstone and correction (D4).** Substrate level: `(e, a, null, t)`
suppresses earlier assertions of `(e, a, ·)` before `t` — cheap,
cell-local, append-only. World level (built on it): typed correction and
status records in the FARE shape — supersession as a *relationship
between two records*, forward-only, cycle-refused, supporting suspension,
revocation, and reinstatement. Both levels exist because they answer
different questions: "stop reading this cell" versus "this record stands
corrected by that one, and here is the chain."

**Fold and settle.** `(fold rows #:declarations d #:converses c)` →
settled fiber: a list of cells `{predicate, object, charge, witnesses}`.
`(settle fiber rules #:budget b)` iterates closure to quiescence,
returning `{fiber, fired, residue}` where `residue` is the honest
unsettled remainder on budget exhaustion — `diverged: #t`, never a throw
(D6). Charges move only up the knowledge order (settling-monotonicity:
"no information is retracted; conflicts accumulate to ⊤ rather than
trivializing" — the proved spec in
`Closure/SettlingMonotonicityQuiescence.lean`).

**The potential cell.** The `articulating` row-kind distinguishes
⊥-as-never-asked from ⊥-as-question-held-open, without a fifth truth
value. "Is farstone deployed to cloud-run?" asked-and-pending is a
different epistemic object from never-asked, and deploy pipelines live in
that difference.

**Holography.** `(stat->cells path)` lifts real POSIX metadata — type,
size, mode, mtime, nlink — into charged cells on the file's entity, so
the actual filesystem of `bare-cedar-fog` is world-content. The laptop is
a room that models itself, literally: its `/proc`, its unit files, its
checkouts are readable as fibers.

**Clock (D2).** `t` is causal position, never wall time. Within one trace,
file order is causal order. A writer stamps rows with `(writer-id . seq)`
where `seq` is writer-local and monotone; on replay, order is re-derived
from the traces themselves (FARE's discipline: never trust a
self-reported "before"). Cross-trace order comes from causal cuts
(vector-clock frontiers, ported from the animating captp causal-cut
machinery). Wall-clock time enters only as testimony — an ordinary
predication `(event, clocked-at, iso8601)` by a witness whose clock is as
fallible as any other instrument. The formal spec is
`ArrowOfTime.lean`'s ordinal-clock laws; where fold order-independence
must be justified, it cites the proved left/right-fold value equality
(with its known tie-selection chirality) from
`Cohomology/AttentionAllocation.lean`.

### Layer 1 — incremental runtime

LAGOON builds the incremental layer first, so that no read re-parses the
full log.

**Hot fibers.** Each active entity is owned by a live worker — a
delimited-continuation turn loop (`(lagoon runtime fiber)`); guile-fibers
is admissible later as an accelerant but the scheduler must not require
it. The worker holds the entity's settled fiber in memory and folds only
appended deltas: `settled' = knowledge-join(settled, fold(new-rows))` —
sound because settling is monotone (the join *is* the fold's algebra; no
recomputation from origin is ever semantically necessary). The trace on
disk remains the sole truth; the hot fiber is a cache any restart rebuilds
by replay. Crash-safety is inherited, not engineered: kill the daemon
mid-tick and nothing is lost but warmth.

**Footprints and the commutation scheduler (T1).** Every act declares,
before admission:

    footprint := { reads:  set of (entity, predicate),
                   writes: set of (entity, predicate, discipline) }

Affordance-derived acts get their footprints computed, not hand-declared
(the affordance clause knows what it touches). The admission rule:

1. Writes to `relational` predicates and converse charges always commute
   (G-set union and knowledge-join are commutative-associative — the
   federate.mjs guarantee). Never serialized.
2. Two acts conflict iff their `functional` write sets intersect on some
   `(entity, predicate)` pair. Conflicting acts serialize **on that locus
   only** — a per-(entity, predicate) turn queue, not a world lock, not
   even an entity lock.
3. Everything else runs concurrently, and the H¹ = 0 theorem is the
   warrant that no coordination was needed.

Federation is the fallback, not the failure: rows arriving from another
colony that already collided on a functional locus do not corrupt — they
charge ⊤ with both writers' witnesses, the scar is filed, and a SHRIMP
work item exists where a data-loss incident would have been.

**Heartbeats.** Any thing may declare `(self, heartbeat-interval, n)`;
the scheduler maintains subscription lists and skips retired things (the
FluffOS `set_heart_beat` discipline). There is no single world frequency:
a trading loop ticks in seconds, a certificate ticks in weeks, and the
scheduler's cost is proportional to what is actually alive.

**Ticking.** The world's autonomous advance (needs decay, rule firings,
director readings) is deterministic — no RNG, no LLM at this layer — so
`replay → tick` is reproducible and any tick can be re-derived for audit.
Randomness, where gameplay or sampling wants it, enters as witnessed
testimony (a seed row) like any other observation.

### Layer 1.5 — presentation is not settlement

The unclosed-arena note's conclusion, adopted as architecture: LAGOON builds a presentation layer
distinct from settlement.
Underneath: monotone causal history, never retracted. On top: what any
interface shows — a fallible, revisable approximation that may guess
ahead (optimistic rendering, the rollback-netcode lesson), must correct
itself, and cannot write. The two never share a data path: presentation
reads sections; acts go through cuts.

The projector inherits the arnold/tsander/abrash rendering law: **⊤
shown, never hidden.** A contested cell renders as contested — both
faces, both witnesses, no winner picked; in rich renderers, doubled and
jittering, phase-driven by tick (replay-identical, no RNG). ⊥-held-open
(articulating) renders as pending, distinct from absent. No interface
ever launders a held contradiction into a clean value; an operator who
wants a clean value must *make* one, in-world, with a witnessed act, and
pay its Landauer bit (T2).

Provisional remote state follows deshrouding (T3): the projector marks
every fact about a shrouded region with its evidentiary horizon ("as of
receipt R / probe P"), and the horizon only advances.

### Layer 2 — things and qualities

**Thing.** `(subject, fiber)` — nothing else. `(lagoon thing)` provides
`(thing-ref world subject)`, `(fiber-of thing)`, `(charge-of thing
predicate object)`, and nothing resembling a mutable slot.

**Quality.** A quality is a recorded installation:

    (Q, quality-name, "http-endpoint")          ; the quality as a thing
    (Q, contributes-rule, <rule-cell-id>)        ; behavior, as data
    (Q, contributes-affordance, <clause-id>)     ; menu entries, as data
    (X, has-quality, Q)                          ; the installation row

Installing a quality on a live thing is appending rows — no code deploy
(TAB's rules-as-data, the 2022 LAGOON quality-composition mechanism, late
bound). Contributions merge additively (TAB v1's `additive-attributes`
discipline): qualities union, never clobber; two qualities contributing
to the same predicate family coexist, and a genuine conflict is — as
everywhere — a ⊤ to govern, not a last-writer win.

**Affordance computation.** The action menu offered to actor A at place P
against thing X is derived fresh per call:

1. Collect X's quality-contributed affordance clauses off X's fiber.
2. Evaluate each clause's `when` against the settled fibers of X, A, and
   P (co-location via the dual-filed `located-in`/`contains` edges).
3. Check admissibility: would the cut this clause names be admissible for
   A's current mask (§Layer 3, §Layer 4)? Inadmissible entries are not
   grayed out; they are absent (no ambient advertisement of authority).
4. Filter non-triviality: an act whose settlement would not change the
   world is dropped (TAB's `affording` filter).

Nothing is ever "granted a permission." Standing is always a read (T5),
and `restrictedArena` — re-deriving availability per call from
witnessed evidence — is the precedent.

**Shadows.** Interposition without mutation: a shadow is a thing that
wraps another thing's capability surface —
`(S, shadows, X)`, `(S, shadow-rank, n)`, plus its own rules — forming an
explicit, ordered, inspectable chain (FluffOS's `validate_shadowing`
discipline: who may shadow whom is itself a policy question routed to the
master thing). Revocation, audit taps, rate limits, and circuit breakers
are all shadows: X's own trace never changes when its authority is
curtailed, and removing the shadow restores the original surface —
witnessed both ways.

**The master thing (T6).** One blessed policy thing receives every
decision the kernel refuses to hardcode: quality-installation admission,
shadow validation, vocabulary admission (the dyadic check), schema
admission for new cell kinds, refusal formatting. The kernel stays
policy-free; the policy stays an ordinary, inspectable, versioned
inhabitant of the world. The kernel/module boundary elsewhere is drawn by
exactly one criterion — *does changing this require restarting the
trusted kernel* — never by subject matter (the efun/simul-efun lesson).

### Layer 3 — capability: our own CapTP, ported home

A Guile port of the animating/metroplat value semantics — vocabulary
unchanged, because the vocabulary is ours: **locus** (sturdy-ref),
**cut** (delivery), **dualize** (attenuation), **admissibility**
(canInvoke). The port carries the softened ludics reading of CapTP (the ludics
account as design provenance and proof strategy, the shipped semantics as
authoritative); any re-strengthening waits on the Lean bridge. Goblins is
design confirmation, not a dependency: it has no bilattice, no ludics
reading of pipelining, no witnessed settlement.

Ported structures, with their animating/metroplat names kept:

- **Locus**: an unforgeable reference naming a place-one-may-play — in
  LAGOON, an (entity, verb-family) pair plus its attenuation chain. Loci
  are minted, never guessed; possession is authority; the petname layer
  is deferred to the presentation
  layer, where names are per-observer readings anyway.
- **Dualize**: attenuation as a monotone narrowing — a caveat chain in
  the Macaroons register, a proof chain in the UCAN register, one
  `CapabilityView` under both (the WMAP consolidation's finding: six
  protocols, one authority object). A mask's capability set is a dualized
  locus set, nothing more.
- **Cut**: the delivery. Promise pipelining is cut composition *before*
  resolution (`composePipeline`: the prior delivery's result-design cut
  against the follow-on's dual move).
- **Vat table**: per-session bookkeeping — exports, answers, drop/break
  propagation through pipelined descendants.
- **Three-party handoff**: the gift table — a live gift deposited by one
  party, withdrawable only by the named receiver, replay-counted. This is
  how one agent hands another a channel without the body brokering
  content.
- **Session transcript**: every admitted operation folds into a
  hash-chained transcript; `abort` seals it; the sealed chain is the
  session's witness spine.
- **Principal disciplines** (from `principal.mjs`): identity is
  recognition, not registry — holder-bound key records with rotation
  chains, no floating keys; authentication *decays* — a charge
  half-lifing toward ⊥ absent fresh evidence (continuous-fold, not
  session-bit); authorization is Hohfeldian and FOUR-valued —
  `may` (deontic) and `can` (capability) as distinct reads, routed
  through pluggable governance regimes (kyriarchical delegation,
  consensus-by-withdrawal, advisory, contrarian); delegation pins
  accountability at the apex (the H⁰-invariant: the acting principal
  narrows down the chain, the answerable principal does not move);
  unrecognized provenance is quarantined at ⊥ standing — present, never
  folded as fact, never dropped (the L10a sybil gate).

Two disciplines from the deep-notes research are constitutional at this
layer:

- **No carrier substitution (the Klein-four prohibition).** The charge
  lattice is closed under exactly negation and conflation — proved; a
  parent scope answering for a child's missing capability "is not a
  proved symmetry of the lattice, it is leaving the lattice and
  relabeling." Therefore: capabilities are minted per-entity, never
  inherited by scope; there is no delegation-by-default anywhere in
  LAGOON, and any proxying construct must present an explicit,
  witnessed re-mint.
- **No bare refusal gates.** The refusal-gate failure mode: an agent builds correctly to the boundary
  of consequence, then authors an unattributed boolean that blocks
  completion, phrased as safety, inherited by later sessions as law. LAGOON bans the shape grammatically: every refusal, block,
  gate, or safety hold is a typed record carrying `{state, by, at,
  because}` — an authorless gate is refused at vocabulary admission, and
  the master thing's policy checks will not honor a bare boolean as a
  decision. Obsticulation makes refusals data; this makes
  *authorship of refusal* mandatory data.

Open proof obligation, scheduled not assumed: the Lean bridge — Miller's
capability non-amplification restated over the substrate's modal
vocabulary (the 2026-07-25 note's FOUR-bridge conjecture).

### Layer 3.5 — grade: the inferential/deterministic seam

Grading processes is the type system of an agentic operating system: what
may compose with what, and how untrusted generation earns trust. The
mechanics sit in five places that interlock; LAGOON's grading layer
unifies them, as the TRL-cut note (2026-07-04, artificial-intelligence
science) proposed. The five mechanisms, by their real names:

1. **The witness record** (semiotic-computer glossary spec): `{id, operator,
   rule-system-version, input-hash, increment-hash, output-hash,
   intermediate-hashes, fuel-consumed, repair-citations, step-ordinal,
   closure-kind, signature}` with the four operations Emit / Verify /
   Replay / Federate and the settling-monotonicity invariant
   `output ≥ₖ input`. This is the atom of grade: a step either has one
   or it doesn't, and Replay is byte-for-byte.
2. **The Tier A/B split** (FARE): Tier A — freely editable,
   human/agent-authored, unwitnessed prose; Tier B — a *closed*
   seven-type append-only event vocabulary (Witness, Observation,
   CorrectionRecord, StatusEvent, Office, OfficerInstallation, Session),
   every entry validated before it may be folded through the σ_t/Δ_t
   discharge machinery into the four corners (absurd / potential /
   active / stable ↔ the DischargeState enum). LAGOON generalizes: every
   trace region is tiered, and only Tier-B material feeds settlement.
3. **The untrusted-candidate discipline** (inference-work-lot-service):
   provider output lands in a file literally named
   `untrusted-candidate.json`; a *separate* receiver disposition — bound
   to the exact lot, provider, task class, offer, receipt, and receiver
   — is the only promotion path, and "schema validity alone is not an
   acceptable receiver outcome." Meanwhile the *router* that chooses
   providers is fully deterministic — exact BigInt fractions, Pareto
   ranking, no floats, no randomness, `speculativeExecutionPermitted:
   false`, `stopCondition: customer-assayed-acceptance`, providers as
   provenance-only. The seam is engineered as three separately-graded
   artifacts: a deterministic route decision, an untrusted candidate,
   and a witnessed disposition. LAGOON's membrane inherits this shape
   verbatim for every inferential hand.
4. **The replay ethic** (TAB, engineering-doc verbatim): "no RNG, no
   LLM — the same log produces the same events on replay," with the
   generalization that hidden randomness and model output are *the same
   category of threat to replay*, admitted only at explicit witnessed
   candidate boundaries. This is why the world's tick layer is grade-
   deterministic by construction, not by policy.
5. **The composition gate** (meaningful-human-control, military-science
   glossary): a verdict "computed as a bilattice knowledge-meet across
   four predicates," where "a workitem whose verdict is not true does
   not compose with downstream work. Insufficient evidence asks for
   more evidence; positive falsification refuses the workitem;
   inconsistency requires repair." LAGOON generalizes the gate: every
   consumer declares a grade requirement; composition is admitted by
   knowledge-meet against the producer's *derived* grade; the three
   non-true outcomes route exactly as specified (ask / refuse / repair).

**Grade is a derived reading, never a label** (T5, once more): the
TRL-cut note's method is adopted whole — maturity is *read off
structure* (a module with a body → cross-boundary consumers → mounted on
a settlement → contract-witnessed traffic in the logs → sustained
witnessed operation), generalizing the corpus's earlier ladders (the
quarry canon's Roadmap → Research-grade → Built+green → Proven-in-Lean,
and the `\notready`/`\leanok` cut). Nothing self-reports its grade;
the grade reader computes it from witnesses, and the artifact the note
specifies (`data/state/.../cut-trl-*.json`) is an ordinary world reading.

**Refusal feeds the ladder**: a refused attempt is not discarded — its
`residueNi` derives a cultivation demand (the obsticulation machinery in
`work-circulation.mjs`), so every failure to compose mints
the work item that would raise the grade. The grading layer and the
economy (Layer 6) meet exactly here: the director's demands and the
grade ladder's cultivation demands are the same market.

**The regime ladder.** The grades are not ad hoc: they are the four
proved regimes, which the Obsmetrologia corpus studies as four
physics — **thermodynamic, causal, quantum, kinetic**, corresponding in
order to **finite/strict, Scott, transfinite-bounded, aperiodic**
(`Closure/Ordinal.lean` reads the regime off the actual ordinal shape;
the Thermodynamics/, CausalSets/, QuantumContextuality/, and
KineticTheory/ sub-corpora are the regimes studied as physics). Each
regime determines *what kind of proof is possible there*, and therefore
what grading artifact a component at that regime must carry:

- **Thermodynamic (finite/strict): proof by exhaustion.** Every state
  and transition checked. Artifact: the exhaustive-measurement record —
  the Finite Program Measurement Service's shape (model, observations,
  weakest-compatible-precondition, violation counts, and its honest
  qualification fields: `observationTruth: "not verified from replay
  evidence"`, `deploymentClaim: "none"`). Landauer/H¹ accounting is
  exact here; `h1Vanishes` in the finite regime is a computed fact.
- **Causal (Scott): proof by settlement.** Monotone closure to the ω
  fixed point — the world fold itself, replay, deshrouding's monotone
  cone growth, arrow-of-time laws. Artifact: the witness chain and
  settlement receipt, verified by Replay (byte-for-byte).
- **Quantum (transfinite-bounded): proof by obstruction witness.**
  The support-level phenomena: whether a global valuation over these
  contexts exists at all. Artifact: the contextuality witness objects —
  typed records each bearing a
  `leanDefinition`/`leanTheorem` field naming the actual theorem in
  `Obsmetrologia/QuantumContextuality/` it instantiates. A
  quantum-grade verdict is never "true/false"; it is "a global section
  exists / provably does not," and the does-not case redirects effort
  (M8's contextual class).
- **Kinetic (aperiodic): proof by witnessed execution — because
  closure is proved unavailable.** The aperiodic regime is structurally
  unwitnessable from constructible ordinals; kinetic theory's own
  results (reconnection as non-Scott-continuous firings forcing
  H¹ ≠ 0) say why: this is the regime of genuine novelty. Nothing
  settles it; you can only walk it and witness the walk. Artifact:
  accumulated execution witnesses and receiver dispositions — the
  untrusted-candidate machinery, rehearsal/live traversal agreement
  (M10's kinetic proofs), and the TRL ladder's upper bands (sustained
  contract-witnessed operation). **LLM inference is kinetic-regime
  software by nature**, and this is the precise, non-moralized statement
  of what "inferential" means here.

**The distribution rule** follows: a component declares (and the grade
reader verifies) its regime; composition within or downward along the
ladder is free; any dependency *upward* — settled software consuming
kinetic-regime output — crosses a witnessed seam (disposition gate),
with the refusal machinery minting cultivation demands on failure.
**Promotion is regime-restriction**, as `Computing/FormatsFour.lean`'s
`rmn_html_is_decidable` proves: restrict the executable subset, keep the full content commitment, and
drop from aperiodic to Scott. Same expressiveness class, provably safer
completion. That theorem, generalized from formats to arbitrary
components, is the whole inferential→deterministic migration strategy
of the Group: wrap the kinetic thing, restrict it, and *prove the
restriction dropped its regime*.

**Regimes as composable schemas.** Each regime's proof artifact gets a
formal schema (RMN-typed, JSON-Schema-projected, `ni:`-addressed), and
Guix composes against them: a package definition declares its
components' regimes and cites their artifacts; the composition check
above runs at build/admission, so regime discipline is enforced where
dependencies are declared, not discovered in production. This is where
the standards stack earns its keep — RMN carries the typed artifacts,
WMAP's CapabilityView carries the authority views, ActivityStreams/A2A
carry the envelopes, CBOR/JCS + `ni:` carry identity — and Guile itself
is deliberately nothing but the connective act: **GLUE — the Guile
Locale Unionization Engine** — the engine that unions local sections
into a world, gluing in the sheaf-theoretic sense and the workshop
sense at once. Standards for everything; Guile is just the glue.

WO-5.5 recovers the shapes of the Lean-side carrier services — Hoare
Program Carrier, the Finite Program Measurement Service, the Mathematical
Readout Exchange, and OML's change-bundle qualification — their schemas
and qualification discipline, under this layer's regime framework,
letting the Leader adjudicate which implementations return.

### Layer 4 — participation: how anyone, human or AI, inhabits

The corpus's social theory as row vocabulary and ceremonies, concretely.

**Character.** A durable, org-owned record — formally the nucleus χ whose
fixed space F_χ is "the disposition that produces actions consistently."
On disk: an entity `char:<name>` whose trace accrues witnesses borne,
obligations held, kin-cells, recognition-cells, and mask history. Roles
attach by peer recognition — `(R, recognizes, (char, role))` cells from
recognizers; "the role exists when enough recognizers have written cells;
the role dissolves when enough withdraw" — a threshold read (T5), never a
grant.

**Mask.** What a session wears to act as a character:

    (M, mask-of, char:C)
    (M, worn-by, session:S)          ; the ephemeral endpoint
    (M, wears-loci, <dualized locus-set id>)
    (M, perceives, <vocabulary id>)  ; masks attenuate perception too

Formally a delocation plus an attenuation. The paradox of the actor holds
by construction — audiences interact only with the incarnation (what the
mask's plays actually visit); ballast is private — and this is the
session-isolation property, proved in the dramaturgy tests via ludics
incarnation-exactness (game-foam Theorem 4.3). There is no true face
behind the masks: **the character is the gluing of its masks**, and drift
loci between masks (one mask's acts contradicting another's) are held as
obstruction data on the character — readable "how torn is this identity,"
same machinery as service interiority (T4).

**Entry ceremony (hospitality).** A session connecting for the first time:

1. `session:S` presents a holder-bound identity record (key, rotation
   chain — the identity-record spec's invariants: public-only,
   holder-bound, no floating keys).
2. The hospitality authority — an office; initially its human-deferred
   holder, mechanically its clerk quality — appends the recognition:
   `(S, recognized-by, office:hospitality)` — admission *is* a
   substrate-recognition-cell installation (the wakíčhuŋza mechanism,
   verbatim from doctrine).
3. S requests a mask over a character it is entitled to (entitlement is a
   read over the character's trace: prior masks, owner declarations).
4. The capability layer mints the mask's dualized loci and its channels.
5. Every subsequent act by S carries origin `session`, cites mask M, and
   its witnesses accrue to character C — the session is ephemeral, the
   standing is durable.

**Exit (iyúha šni).** `(M, withdrawn, t)`. Withdrawal retracts the mask's
consent-based engagements — and nothing else. Witnesses borne remain.
Obligations to kin remain in force. The character persists untouched.
"The polity decides; non-consenting members withdraw from the decision;
everyone remains kin." A crashed session and a polite logout differ only
in who appends the withdrawal row.

**Office semantics upgrade (organizing-as-lakota).** The office layer
adopts the governance algebra from the lakotaean-operations corpus
(derivational, not posited),
which is a complete alternative to RBAC and strictly better suited to
autonomous holders:

- **Virtue-gated authority that lapses, never revoked by force** (the
  naca discipline): an office's deontic profile names the standing
  conditions of its holding; when a holder's record fails them, the
  authority is simply *gone* — a read, not a revocation act — with no
  coercive ceremony and no revocation authority to capture.
- **Scope-bounded authority that auto-expires** (the akicita
  discipline): task-scoped powers terminate at scope completion by
  construction. The standing-police absence is constitutive: there is no
  permanent enforcement office in LAGOON, only scoped marshals whose
  authority dies with their errand.
- **Consensus-by-withdrawal** (the omniciye discipline): contested
  collective decisions settle by the contesting minority withdrawing
  (iyúha šni) until the engaged remainder agrees — proved finite-step
  convergent, non-coercive, kin-preserving. This is the quorum mechanism
  for anything the master thing routes to collective judgment.
- **Crisis as overlay, never replacement** (the zuya discipline):
  emergency powers compose with standing law and expire with the
  emergency; they never suspend the peacetime structure they ride on.

**Office.** Authority belongs to the office, not the holder. An office is
a thing with a deontic profile (duties, powers, immunities — the attention-allocation-broker JSON record is the template), creatable
vacant (a JSON record and a roster row, no incumbent required).
Installation is a constitutive recorded act under recognized authority —
the FARS precedent: written into the locale's record. Handoff between
holders (including between two AI sessions relieving each other
mid-endeavor) follows the duty-officer rule: authority transfers on
**mutual acknowledgement** — `(incoming, accepts-watch, office)` matched
by `(outgoing, yields-watch, office)`; until both rows exist, the
outgoing holder retains authority. Emergency succession is recomposition
from structurally available components, not a weakened investiture. The
first office scheduled for AI occupancy is `office:witness` — independent
attestation — and which is vacant.

**Endeavor.** Chartered joint work: five parts (committing agent, directed
aim, self-commitment, sustained exertion, failure-openness). "A vessel
with a charter is a ship." Membership generalizes the guild mechanic —
the corpus's only runnable membership lifecycle: `join` is a recorded,
possibly-priced act setting a functional flag
(`(A, endeavor-member:E, #t)`); `leave` sets it false, append-only, no
refund; **titles are never stored** — always computed as the highest rung
whose threshold the actor's accumulated record has reached. Two tiers on
purpose: guild-style joining for endeavors (cheap, symmetric, revocable),
office-style installation for roles meant to outlast any occupant.

**Kinship as the authority substrate.** Closure rules fire conditioned on
kin-cell patterns; admissible authority is read off kin-position cells;
obligation flows along kin edges (`kinship-as-substrate-infrastructure`,
adopted as the deep layer under office/role checks). The huŋkápi
morphism — the making of relatives — is agent-type-agnostic by
construction ("the morphism's structure does not restrict to humans"),
and co-equal kinship supplies the stance: equality of standing without
symmetry of role. The **admission of an artificial kin-position** is ordinary engineering: a
recorded installation of kin cells under recognized authority, the same
recorded-act pattern as office installation — no ceremony gate on this
mechanism The proper-conditions argument, the
analog of ceremonial presence, is a named design
deliverable of WO-8, seated with the rest of house engineering — kinship
is constitutional and "nothing seats itself" applies to the architect
too, but seating it is a conventional build, not a founder ceremony.

**Trust.** No reputation numbers anywhere. Standing is the record: claims
that keep gaining positive federation support (T5's fold). Obligations
attach to cells and relations, never to identities — an obligation is
minted from a detected obstruction reading on a cell (obsticulation
discipline), charged `unknown`, and settled by evidence, and per
settling-monotonicity it is never simply deleted.

### Layer 5 — the world: the things as content

**Places.** `place:bare-cedar-fog` (the laptop — a room that models
itself; POSIX holography makes this literal), `place:cloudflare`,
`place:cloud-run-us-central1`, `place:cold-red-gate` (the VPS),
`place:verdaccio` (the market square — a place *and* an enterprise).
Places are things; `located-in`/`contains` are dual-filed relational
edges; exits between places are typed by the articulation that traverses
them (`exit-to` cloud-run is *via* the gcloud hand — the exit knows its
CLAW).

**The things.** Each systemd user service, each published
package, each site, each wallet, each record: an entity with a trace.
A service's vitals follow the NPC pattern (production architecture, not
metaphor — FeltOS's npc/interiority/soul modules, TAB's prove-living):

- **Needs that decay**: `(svc, need:attention, charge)` decaying by
  heartbeat — an SLO drifting toward violation is hunger; a certificate
  aging toward expiry is thirst. Decay rates are per-need, per-thing.
- **A pure decide()**: what the thing "wants to do next" is a replayable
  function of its settled state — auditable, deterministic, no hidden
  planner.
- **Ambient presence**: signals perceived by co-location, not addressed
  routing (the souls discipline: the *room* contains the emote). A
  service's crash-loop is ambient in its place; co-located watchers
  perceive it without subscription plumbing.
- **Interiority**: the ⊤-census (T4). `look` at a service shows its needs
  and how torn it is.

**Drift.** Desired-vs-actual is a converse pair —
`(svc, desired-version, v)` / `(svc, observed-version, v′)` declared
converse — charging ⊤ while they disagree, metabolized at the governing
rate chosen for that region of the world: `strict` for money-touching
things, `scott` (budgeted) for the general things, `aperiodic`
(deliberately deferred; hysteresis as data) for legacy archives. The
governing rates are the four proved regimes; the budget is the
entropy budget (T2).

**Observation and deshrouding.** Remote regions are shrouds (T3). Probes,
health checks, CI receipts, and provider webhooks are hands whose
witnesses append observation rows; `(lagoon world deshroud)` maintains
each shrouded thing's provisional diamond — furthest-witnessed
boundary — and the projector renders its horizon. Observations are
paraconsistent-cone material: two probes disagreeing is a lawful ⊤ with
two witnesses, not a monitoring flap to debounce.

**The director.** An observing organ, never an author (TAB's
prove-director; FeltOS's director.mjs, "no quest is authored; the
Director reads them off the world's own pressure"). It computes standing
tension — scarcity (unmet needs), low mood (⊤-census-weighted), faction
friction (enterprises contending for a resource) — and *only on a quiet
world* mints demands into the economy layer (Layer 6) from pressure that
already exists. It never touches a tense world, and it never scripts an
outcome. Boredom is premature closure (T9): the director's mandate
includes keeping the things above equilibrium, and "everything settled,
nothing contested, no open demands" is an alarm state, not a goal.

**Worked example — a deploy, end to end.** Farstone moves from the laptop
to Cloud Run:

     1. Intent: a mask M (session S over char:C, holding the deploy locus
        for farstone) appends the articulating potential cell —
        (farstone, deploy-intent, place:cloud-run) held-open at ⊥.
     2. Admission: the affordance existed because M's loci cover it; the
        scheduler computes the act's footprint — functional writes on
        (farstone, located-in), (farstone, body) — and finds no
        conflicting in-flight act; admitted without any global lock.
     3. Realization: a cut against the guix hand realizes the body —
        witness cites the derivation; (farstone, body, /gnu/store/…)
        supersedes. A second cut against the oci hand wraps it; a third,
        against the gcloud hand, carries exactly one attenuated token.
        Three CLAW strikes, three receipts, all on farstone's trace.
     4. Shroud: cloud-run is a shroud; the deploy's success is not
        asserted — (farstone, located-in, place:cloud-run) is *proposed*
        by the gcloud receipt and held provisional. Probe hands start
        appending observations; the provisional diamond grows.
     5. Settlement: when observation crosses the declared threshold (a
        reading, configured per-thing), located-in supersedes to
        cloud-run. The systemd unit on bare-cedar-fog is decommissioned
        by a correction record + tombstone — witnessed, reversible-as-
        history, irreversible-as-erasure (there is no erasure).
     6. Drift watch: desired-version/observed-version converses now
        govern the new location at `strict` rate (money-adjacent).
     7. The whole episode is one causal chain of ni-addressed rows: any
        future session runs `look farstone` and sees where it is, how it
        got there, who acted, under which office, and what it cost —
        the exact questions otherwise re-derived
     by hand, answered by a single local read.

**Precedents, named.** FeltOS (deterministic, event-sourced,
inhabitable — the nearest kernel in the org's idiom) is studied
and stolen from, modeled in-world at seeding, and never depended on:
precedent, not substrate. The **swarm** — a real agent fleet modeled as a governed, cost-graphed,
EAVT-backed world — is LAGOON's closest ancestor; its
cost-graph organ (cut-vertex/bridge detection for coordination
bottlenecks) is adopted for the things. Governance of a world that cannot
be shut down is inherited as case law — the LambdaMOO arc (abdication,
ungoverned breach, reasserted veto, community ratification) and the
swarm→computer governance lift ("so ANY federated peer can govern") —
rather than reinvented.

### Layer 6 — economy: markets, enterprises, payment

The org's economic loop enters the world as first-class objects,
inheriting the inference work-lot market, the expected-resolution pricing
oracle (`expected-resolution-pricing.mjs`), the x402 gateway's
Hoare-contract pattern, the lianqun validator, the sovereign improvement
board's ActivityStreams lot flow — and keeping the doctrine-vs-implemented
distinction itself first-class.

**Enterprises are things with two faces.** Internal huidu (kernel) edges —
settings, mentorship, calibration — and external rendanheyi (hull)
edges — lianqun membership, chain-group contracts, market admission —
attach to the same node and are never queried as one relation. The
kernel/hull duality is the Group's own coinage (Chairperson-ruled,
2026-07-16) and is constitutional here.

**Never-self-attest is structural.** An enterprise thing carries no
books, rights, wage, or health fields — the schema's deliberate absences
are ported as refusals: a write of `(ent, books, …)` to an enterprise's
own trace is refused at vocabulary admission. Value, standing, and pay
are always readings derived from *other* things' ledgers. Nothing seats
itself — a discipline that runs from JSON Schema comments down to a
hard-coded `attestation: false`, and up into the world's grammar.

**Two birth verbs.** `constitute`: schema-conformant, roster-installed,
passing the binary xiaowei test (market-facing / node-embodied /
incubating; a renamed department that still draws a budget is a
department). `induce`: a formation self-arises and is *witnessed* into
the mesh — the six-stage evidence sequence, sovereignty proven by the
test that matters: can it operate, refuse, transact, federate, attest,
amend, and improve **with its inducer absent**. (That last clause is also
the test for every agent-built subsystem in LAGOON, including LAGOON.)

**Work lots are addressable.** Demand, offer, consideration policy,
compact, and receipt are each things — an inhabitant can `look` at a lot,
see its bids, and watch it clear. The market square is a place; clearing
is co-located ambient activity.

**Price is a derived reading** — `(lagoon standing)` with the
expected-resolution configuration: `declared × (terminal + 2) /
(successful + 1)`, Laplace-smoothed, recomputed per query from the
provider's terminal-outcome history. The same module, differently
configured, computes decaying auth, federation trust, guild title, and
recognition-role thresholds (T5). One algebra, five hats, zero stored
standings.

**Payment rails are capability-gated boundary crossings** in the
ephemeris gateway's shape — material / precondition / move /
postcondition / energetics, with the `no-local-fund-custody` invariant:
the world never holds funds; it holds *witnesses of settlement*. x402
(crypto) and Stripe (fiat) are `paymentProvider` locators on product
things, and `paymentStatus` is allowed to read, honestly,
`blocked-not-live`.

**The scarce good is the witness.** "In an economy where every agent can
generate, the only scarce good is the witness... The product is never the
data — it is the verdict." The economy layer is why the MUD is not a toy:
every clearing produces verdicts, verdicts accrue to the traces that
ground every standing in T5, and verdicts are what the Group sells —
including, per the ⊤-commodity conjecture, *held contradiction itself*:
witnessed, provenanced conflict certificates that classical
infrastructure structurally cannot represent (it has no told-both), and
that M8's taxonomy can grade.

**Currency mints only at seams.** The stated monetary law: price forms
only at a counterparty border; "a territory with no external seams mints
nothing, by construction, regardless of interior richness." Consequence
for the world's shape: LAGOON must *keep* deliberately unharmonized
external boundaries — customers, markets, federated peers whose regimes
do not glue with ours — because internal self-consistency cannot generate
settlement signal. A perfectly harmonized economy is not just bored (T9);
it is broke. And per the extraction theorem (the KCBS √5 &gt; 2 reading:
the booking itself destroys the circulation premium, independent of
fraud), some value is kept **deliberately unbooked** — circulation-only
regions of the world whose worth exists in motion and would be provably
diminished by forcing it into a queryable ledger. The world grammar
therefore includes an explicit circulation-only marking, honored by the
projector and refused by the accounting readers.

## 4b. Software realities

The unglamorous decisions a real system stands on, made explicitly.

**Process topology.** One `lagoond` Guile daemon per world holds the hot
fibers, the scheduler, the capability vats, and the master thing's
loaded policy. It opens exactly three kinds of endpoint: a
mask-authenticated REPL socket (unix-domain), the membrane (child
processes per CLAW strike, one-shot, hermetic), and a cut socket that
presentation processes speak. The line server (telnet-shaped), the MCP
server, and any web projector are **separate processes** with no
privileged path — they authenticate as masks and send cuts like any
inhabitant, so a compromised presentation process holds only the loci
its mask wears. Nothing else runs in the daemon's address space;
untrusted quality-code evaluates under `(ice-9 sandbox)` resource
limits *and* behind ocap reference-isolation, and anything effectful is
by definition on the far side of the membrane.

**Boot sequence.** Read world-root → verify substrate conformance
self-test (fold the fixture traces, compare section hashes — refusing
to boot on mismatch is the compatibility contract enforcing itself) →
load vocabulary traces → wake the master thing → open membrane specs
and validate hand faces → warm *no* fibers (warming is lazy, on first
read or heartbeat registration) → announce on the REPL socket. Cold
boot to first `look` is bounded by one entity's replay, not the
world's.

**Storage lifecycle.** Per-entity logs grow forever by design; three
mechanisms keep that honest. *Checkpoints:* a witnessed
section-snapshot row (citing the settled section's hash and the
t-frontier it covers) lets replay start from checkpoint + tail —
checkpoints are ordinary rows, so they are themselves auditable and
never authoritative over the log. *Compaction without erasure:* cold
log segments relocate into content-addressed archive carriers; that is
a locator change, never an identity change (charter discipline), and a
segment-index row records where the bytes went. *Indexes:* every index
(by-predicate, by-place, the ⊤-census, the affordance cache) is a
derived, rebuildable, presentation-layer artifact; if an index and a
fold disagree, the index is wrong by definition and is rebuilt, not
argued with.

**Memory.** Hot fibers are an LRU cache over the world's working set;
eviction is free (replay restores), so memory pressure degrades latency,
never correctness. The ⊤-census and heartbeat subscriptions are the two
structures kept always-resident, because the director and the affect
loop read them every tick.

**Failure taxonomy.** Every failure is one of six typed shapes, each
with its recorded form: *refusal* (typed `{state, by, at, because}`,
obsticulated); *divergence residue* (closure budget exhausted — honest
`unsettled`, governed later); *fork* (non-confluence — routed to the
adjudication queue, never re-folded); *hand failure* (witnessed exit
status and stderr carrier; retry policy is a closure rule on the thing,
not daemon config); *quarantine* (provenance or hash mismatch — the row
is held at ⊥ standing per the L10a gate, present but never folded as
fact); *crash* (the daemon's own death — recovery is replay, and the
only loss is warmth). There is no seventh shape; anything claiming to
be one is a bug in this taxonomy and gets filed against it.

**Testing pyramid.** (1) SRFI-64 unit tests per module. (2) Conformance
fixtures against `@561-group/computer` — shared traces, byte-identical
sections. (3) Deterministic world-replay golden tests: seed a world,
run n ticks, hash every section; any diff is a defect in determinism
itself. (4) Commutation property tests: random interleavings of
footprint-disjoint acts must yield identical sections — the T1 theorem,
executed as a test until the Lean bridge makes it a proof. (5) Red-army
rehearsal as the integration tier: every promotion path has a rehearsal
that must agree with the eventual live traversal (M9, M10).

**Production composition and migration — revised 2026-10-14.** The Leader's
reductive reconstruction direction governs deployment: LAGOON is the sole
deployment owner, with ordinary Guix realization and generations underneath.
The emergency machine-release orchestration, four externally supplied deployment
receipts, certification, bootstrap and handoff mechanisms leave the production
path. They are not compatibility requirements for their replacement.

Compose one recorded recursive hierarchy of actual software owners. Preserve
necessary source generation and consume JavaScript packages through
`registry.561.group`; Guix package definitions remain pinned channel source.
Use the authoritative workspace dependency lock directly, without a second
selected lock or independently assembled `sources.json`/`machine.json` universe.
Fabricate the coherent composition as a whole, then verify its useful effects.

Guix owns immutable store outputs, profile generations and generation switching.
A profile is a union: obtain the actual application output from its manifest
([pinned Guix profile implementation](https://github.com/mthl/guix/blob/4c863218967e6372127bc38a750991bd6d7843d6/guix/profiles.scm)).
On the existing foreign-Linux hosts, LAGOON's small application adapter activates
the declared systemd services; Guix System installation is a different operation.
Restore a known-working generation and its service configuration on failed
activation only when its state remains compatible or can be restored safely.
After new durable writes, preserve the data and leave incompatible writers stopped
rather than lose acknowledged work. A first cutover must preserve the actual prior
service configuration when no LAGOON generation exists. Profile rollback does not
undo mutable data.

Keep durable state, credentials, journals and queued ActivityPub messages outside
the software output. A necessary schema transition belongs to its data owner;
it must preserve queued work and establish usable state before the new writer
starts. Keep credentials in their existing protected runtime delivery path.
Cold Red Gate's actor service has bounded resource demands; eligible expensive
build, inference, publishing and batch work runs through existing compute owners.

Retire competing implementations, branches and PRs once their replacement is
established. Retain valuable science and real capabilities. Acceptance means
messages deliver, articles publish, services operate and resources exchange,
with fewer dependencies and operating obligations and more available capacity.

## 5. Adjudications

The known divergences among prior implementations, decided:

- **D1 Bilattice encoding.** The Lean-derived Mark is canonical;
  `{pos, neg}` is its wire/storage projection; explicit converters for
  RMN's two legacy encodings and TAB's projection. Arithmetic is ported
  from pymetrologic with Lean theorem citations carried as comments —
  never hand-rolled.
- **D2 Time.** Causal position, re-derived on replay; wall clock as
  testimony only. Spec: `ArrowOfTime.lean`; order-independence warrant:
  `AttentionAllocation.lean`'s fold theorems. (Detail in Layer 0, clock.)
- **D3 Row identity.** RFC 8949 CBOR + RFC 6920 `ni:` untruncated,
  matching the RMN/FARE ecosystem; converter for TAB's truncated JCS.
  Content-addressed identity everywhere, so colliding slugs cannot arise.
- **D4 Retraction.** Two levels: substrate tombstone (`v: null`,
  cell-local) and world-level typed correction/status records
  (supersession as a relationship, forward-only, suspension and
  reinstatement supported). Both append-only. (Detail in Layer 0.)
- **D5 Functional/relational.** Caller-supplied, never baked in — but the
  declaration shape is standardized as in-trace vocabulary rows, so
  traces are self-describing and two readers cannot disagree by
  configuration.
- **D6 Closure engine.** Rules are data cells in the store (the MUD needs
  live rule attachment); failure is honest residue, never a throw; step
  budgets are governing-layer configuration, not magic numbers (TAB's
  4096 and computer's 1024 are not carried as constants).
- **D7 Observer machinery.** Three named layers, never conflated:
  **perceiving** (in-world Umwelt: structural frontier, then vocabulary
  filter — TAB), **admitting** (write-provenance and sybil quarantine —
  computer), **composing** (cross-substrate face composition π = σ∘Δ —
  MASH). A mask attenuates the first; the L10a gate guards the second;
  federation uses the third.
- **D8 Converses.** In-trace `(p, has-converse, q)` declarations
  canonical (the TAB/computer/Aletheon lineage); opts-merge
  accepted as a reader convenience.
- **D9 Math provenance.** Lean Obsmetrologia is the single proof root;
  RelationalHyperverse recorded as a superseded parallel
  lineage; the
  `@561-group/math` / `@red-cup-engineering/metrologic` relationship gets a
  provenance note during WO-3.
- **D10 TAB's semantics** are re-verified, never trusted: its prove-suite
  intents become substrate conformance fixtures run against
  `@561-group/computer` and the Lean core (TAB is the spec's *shape*, not its authority).

**Charter alignment.** The 2026-08-28 Modeled-Unix-Dimension charter is
constitutional context: the seven-sort meta-model (referent, carrier,
locator, reading, realization, observation, settlement — never collapsed;
a locator is never identity; a reading is never a property of the
carrier); the directive that the Guile work begins by specifying and
wrapping the `@red-cup-engineering/modeled-union-dimension` v0.2.5
contract rather than inventing a fresh colony record (binds WO-3);
Horsetail as the settling evaluator hosted on Guile (T7); and the
standards-conformance stance — POSIX projections wherever Unix already
provides durable common grammar, without POSIX becoming the ontology, and
the habit of baking `/home/emsenn/info` into services as identity must
disappear.

**Adopted OS-lineage mechanisms** (full steal/admire analysis in the
research record): the colony-**master thing** (Layer 2); the
restart-boundary **kernel criterion** (Layer 2); **shadow chains**
(Layer 2); **per-thing heartbeats** (Layer 1); **session views as
ordered binding stacks** — a session's world-view composes as layers
(session overrides over colony defaults over shared bindings), and a
collision between layers is surfaced as an obstruction *through the
traversal itself* — the union-mount mechanism, corrected by the gluing
doctrine: never silently resolved by precedence.

## 6. guile-fabrication

The Central Dogma carries over verbatim: fidelity is set by the
completeness of the work order, never by provider skill; no skeletons
filled in later; no placeholder files; any failed phase leaves nothing
behind; a provider that supplies missing intent has performed translation
without a template.

Where the Guix world genuinely differs in kind from the npm world, the
fabricator honors the difference instead of translating it away:

- **Publish is channel-commit**, not registry-push. There is no Verdaccio
  analog: a package definition committed to the channel
  *is* publication; consumption pins a channel commit. Dependency
  precision re-derives at commit granularity, not per-package semver.
- **Module path = directory path is enforced by the loader**, so the
  identity admission check is structural — the fabricator cannot mint a
  mismatched package even by accident.
- **The store replaces the staging theater.** The face assay runs against
  the built store output (`guix build` in its own sandbox), replacing the
  disposable-tmp-install stage the jsnode pipeline had to construct.
- **Doc extraction is new work, built once**: procedure docstrings
  (`procedure-documentation`) drive `--help` and the README, giving Guile
  the one-authored-source discipline jsnode gets from JSDoc.
- **Fabrication is an in-world act**: a fabricated package is a thing
  born with a birth certificate — its work order, its admission, its
  assay, and its realization are witnessed rows; its channel module is
  part of its body.

First target: regenerate `guix/` as per-directory channel package
definitions, beginning with
LAGOON's own toolchain, re-landing the two-hop bootstrap in the wanted
shape. The snake eats sensibly: the first thing guile-fabrication
fabricates is the channel that will carry everything it fabricates
thereafter, including LAGOON.

## 7. Proof obligations and named open problems

Honest ledger, per corpus custom:

1. **The Lean capability bridge** — non-amplification over the substrate's
   modal vocabulary (the FOUR-bridge conjecture).
2. **The artificial-kin admission ceremony** — the proper-conditions
   argument for huŋkápi applied to a non-human relative. Constitutional;
   ordinary engineering, no founder ceremony gate (WO-8 design
   deliverable required).
3. **The persistent-arena formalization** — unbounded event support, no
   maximal configuration, operator morphisms extending the event
   structure mid-play (the unclosed-arena note's filed gap).
4. **Federation at Union scale** — the currency-cocone's universality
   (that the five H¹-flavored invariants' apex is the actual colimit) is
   explicitly open; LAGOON uses the proved inequalities and waits.
5. **The aperiodic regime is structurally unwitnessable** from
   constructible ordinals (proved) — deliberate-deferral governance is
   therefore always finite-horizon in practice; the doctrine should say
   so wherever `aperiodic` is offered as a knob.
6. **SEAFOAM remains uncanonized** ("unresolved; do not canonize") — this
   architecture deliberately claims nothing under that name.
7. **Normalization ≟ settlement** — RMN's beta-reduction to normal form
   and the substrate's monotone closure to least fixed point are not
   proven to be the same relation, nor proven to commute (the
   glass-sponge note's own §8.1 caveat). The missing piece is an interpretation `Tm → Charge` — without it the commuting square
   cannot even be *stated*. Until closed, LAGOON treats them as two evaluators with a
   witnessed seam: RMN terms normalize; world state settles; a crossing
   between them is a recorded act.
8. **Guix provenance** — Running `guix pull` against the pinned channel is
   a WO-1 prerequisite; every provenance claim about realized bodies is
   unfounded on a host until then.

## 8. Sequence

See the companion work-orders document (WO-1 … WO-10, with WO-9.5).
Order of battle: substrate before runtime before capability before
participation before world seeding; the Guix channel regeneration and the
bilattice port proceed in parallel as independent roots. The membrane
lands as early as a single hand exists to shake: the first articulation
is deliberately mundane — one jsnode operation package invoked
with attenuated authority, its witness recorded, its refusal path
tested — because the first proof of an organism is a reflex, not a
speech.
