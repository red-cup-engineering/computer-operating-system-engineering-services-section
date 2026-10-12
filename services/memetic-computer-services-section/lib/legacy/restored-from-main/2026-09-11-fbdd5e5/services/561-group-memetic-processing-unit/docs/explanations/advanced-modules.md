# Obstruction, d-frame, spectral, and Verdier modules

Several MPU modules look like independent mathematical utilities at first glance. They are better read as supporting calculi for the same processing story.

They answer questions such as:

- How long does closure take?
- Which regime is a settling in?
- Where do non-Scott-continuous firings appear?
- What is the cohomological obstruction?
- How do FOUR-valued firings split into truth and falsity sides?
- How do substitution systems expose duality, spectrum, and gauge behavior?

## `closure/`: closure ordinals and regimes

The closure module defines constructive ordinal notations and a general monotone-operator iteration scheme.

The core fold is:

```txt
F(0) = ⊥
F(α + 1) = Φ(F(α))
F(λ) = ⋁_{β < λ} F(β)
```

The module classifies closure behavior into four regimes:

| Regime | Meaning |
| --- | --- |
| `finite` | closure ordinal `κ < ω` |
| `scott` | closure stabilizes at `ω` |
| `transfinite` | `ω < κ < ω₁` |
| `aperiodic` | no countable `κ` found / search does not stabilize |

Important exports:

- ordinal constructors: `ordZero`, `ordSucc`, `ordLimit`, `fin`, `OMEGA`, `omegaTimes`, `OMEGA_SQ`;
- iteration: `approx`, `closureOrbit`, `stabilizingSup`;
- classification: `closureOrdinal`, `leastFixedPoint`, `regimeOfOrdinal`;
- witnesses: `reachability`, `omegaPlusOne`, `tower`, `fromBilattice`.

`fromBilattice` bridges the MPU floor into the general closure machinery, showing that ordinary `settle` is the finite-κ restriction of the general closure story.

## `obstruction/`: settling cohomology

The obstruction module has two cohomological readings.

### Temporal settling H¹

A `Settling` is a monotone sequence of stages. Knowledge may accumulate but must not drop.

Limit stages matter because non-Scott-continuous firings appear there.

The temporal H¹ is:

```txt
H¹ = free abelian group on cells first designated at a limit stage
```

Important exports:

- `settling`
- `increments`
- `firings`
- `nscFirings`
- `h1`
- `clInv`
- `mldEquivalent`
- `classify`
- `depth`

A finite settling has temporal `H¹ = 0`.

### Cellular cochain H¹

The cochain module builds a graph cochain complex from cells:

```txt
C⁰ = ℤ^{entities} --δ⁰--> C¹ = ℤ^{cells}

(δ⁰ f)(s → o) = f(o) - f(s)
```

It computes:

- `H0.rank`: number of connected components;
- `H1.rank`: first Betti number, `|cells| - |entities| + #components`.

This is distinct from temporal settling H¹. A single self-loop can have cellular H¹ even when the floor's temporal settling H¹ vanishes.

### Floor bridge

`settlingOf` reads the MPU's closure trace as a finite settling. `voidCone` delegates to `vanish`. `gradedVoid` and `apexVoidMatch` connect non-Scott firings with void-rank reads.

## `dframe/`: bigraded FOUR cohomology

The d-frame module reads each FOUR value as contributions to two sides:

| FOUR | L₊ | L₋ | Firing type |
| --- | --- | --- | --- |
| `t` | 1 | 0 | `truth-only` |
| `f` | 0 | 1 | `falsity-only` |
| `top` | 1 | 1 | `top-firing` |
| `bot` | 0 | 0 | `bot-firing` |

Important exports:

- `SIDE_CONTRIBUTION`
- `classifyFiring`
- `perFiringDframe`
- `dframeCohomology`
- `classifyOrbitType`
- `verifyComposedSelfDuality`

`dframeCohomology` combines a substitution matrix with FOUR-valued firing labels and reports truth/falsity-side shadows, rank, singularity, and firing counts.

## `dgen/`: H¹ d-frame generators

The d-generator module assigns a generator `D_μ` to each non-Scott-continuous firing `μ`.

Important exports:

- `dframeGenerator`
- `h1Dframe`
- `dgenShadow`
- `negateGenerator`
- `linearlyIndependent`
- `dgenFromSettling`

The generator records the firing's FOUR value, truth/falsity side contribution, consistency behavior, and totality behavior.

`H¹_dFrm` is the direct sum of the firing generators.

## `number/`: exact arithmetic floor

The number module supplies exact arithmetic used by spectral and Verdier modules.

- `Natural`: interned von Neumann-style extensions.
- `Integer`: balanced two-sided evidence, `pos - neg`.
- `Rational`: canonical ratios of integers.
- `Matrix`: integer matrices with determinant, characteristic polynomial, Smith normal form, and rank.

This is not incidental host-math wrapping. It keeps the arithmetic inside the package's own exact tower.

## `spectral/`: inversion and root location

The spectral module works with integer polynomials.

`inversion.ts` provides:

- polynomial normalization;
- reciprocal polynomial by coefficient reversal;
- self-reciprocal checks;
- resultants;
- shared-root and inversion-symmetry checks.

`location.ts` uses the Cayley map:

```txt
z = (1 + w) / (1 - w)
```

to turn unit-circle location into right-half-plane root counting. It reports expanding, contracting, and neutral roots, and has a `isPisot` predicate for polynomials.

## `verdier/`: substitution, spectrum, duality, gauge

The Verdier module studies substitution systems.

### Substitution

A substitution is a free-monoid morphism:

```txt
σ* : A* → A*
```

Important exports:

- `substitute`
- `iterate`
- `substitutionOrbit`
- `fixedPointClosure`
- `abelianize`

`abelianize` turns a substitution rule into the integer matrix that counts letters.

### Spectral checks

The Verdier spectral layer provides:

- characteristic polynomial over exact matrices;
- primitivity check;
- Perron polynomial and rational convergents;
- Pisot-matrix test.

### Verdier duality

The Verdier duality module compares Anderson-Putnam-style direct-limit structures:

```txt
H¹  = colim(ℤⁿ, Mᵀ)
H₁  = colim(ℤⁿ, M)
```

It checks equality of rank, determinant, and Smith factors.

### Gauge

The gauge module gives the Klein-four action on FOUR:

- `id`
- `negation`
- `conflation`
- `double`

It can compute fixed sets, induced permutations, firing-pattern self-duality, and substitution-rule self-duality.

## How these modules fit together

The package is organized around one processing floor:

1. charge gives the four-valued word;
2. descent and compose build settled sections;
3. closure classifies fixed-point behavior;
4. obstruction reads non-Scott firings and cohomology;
5. d-frame and dgen grade those firings by FOUR value;
6. spectral and Verdier modules analyze substitution systems that model recurring firings and dualities.

The modules should be documented and tested as one architecture, not as disconnected utilities.
