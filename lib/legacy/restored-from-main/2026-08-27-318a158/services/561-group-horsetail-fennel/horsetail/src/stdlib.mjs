// stdlib — the prelude, written IN Horsetail (the language bootstraps in itself). A source string of forms
// the world settles into its trace before a program runs: macro definitions that desugar common shapes to
// the core special forms, plus a few fn definitions. A program is a trace, so the prelude is just the first
// part of that trace — nothing magic, all homoiconic.
//
// THE LAW rides through every macro: four-valued `if` (⊤ runs both arms), append-only bindings, ⊤ held.
// Macro-introduced locals are marked "%%name" so the evaluator's hygiene pass renames them per expansion
// (capture-avoidance). Threading/comprehension macros use dotted-tail varargs (`. rest`) + ,@rest.

export const STDLIB = String.raw`
;; ── knowledge-base sugar (original prelude, kept) ───────────────────────────────────────────────
(defmacro fact (s p o) (assert s p o))
(defmacro counter-fact (s p o) (deny s p o))
(defmacro both (s p o) (and (assert s p o) (deny s p o)))
(defmacro believe? (s p) (recall s p))
(defmacro yes (x) (boolean x))

;; ── control flow (four-valued; ⊤ runs both arms via core (if …)) ────────────────────────────────
;; (when c body…) — run body iff c is t; ⊥ otherwise. ⊤ runs body AND falls through (the (if …) ⊤ rule).
(defmacro when (c . body) (if c (do ,@body) bot))
;; (unless c body…) — run body iff c is NOT t (its truth-negation is t).
(defmacro unless (c . body) (if (not c) (do ,@body) bot))

;; (cond (test arm)… ) is a core special form (it folds over clause cells with the four-valued ⊤ rule a
;; macro cannot express structurally). case is match by another name (pattern dispatch).
(defmacro case (subj . clauses) (match subj ,@clauses))

;; threading (-> ->> -?> ?.) are core special forms (they rewrite by clause-structure with single-eval of
;; the seed, and -?> needs the four-valued ⊥/⊤ short-circuit). No macro surface needed.

;; ── collection-as-trace (BEATS Fennel: a table is a subject; assoc=assert, dissoc=deny, get=recall) ──
;; (assoc subj key val) — assert (subj key val): an auditable, witnessed put (never overwrite).
(defmacro assoc (subj key val) (assert subj key val))
;; (dissoc subj key val) — deny (subj key val): the cell goes f/⊤, never silently gone.
(defmacro dissoc (subj key val) (deny subj key val))
;; (get subj key) — recall (subj key): the settled charge of the cell.
(defmacro get (subj key) (recall subj key))
;; (merge other subj) — federate another trace over subj: clashing keys settle to ⊤ (not last-write-wins).
(defmacro merge (other subj) (federate other subj))
;; (keys subj) — the {affirmed,denied,contradicted} section projection of a subject.
(defmacro keys (subj) (section subj))

;; ── modules surface (module/export/import over the path trace + federate) ────────────────────────
;; (export name…) — mark bindings as a module's public face. A module is a path SUBTREE; export records
;; the names as exported cells under the current scope so an importer can read them (section/recall).
(defmacro export (. names) (do ,@names))
;; (import /name) — load + federate a module (require), bringing its /name subtree into the trace. Selected
;; binding import is by full path (/name/binding) — the path tree IS the namespace.
(defmacro import (modpath) (require modpath))
`;

// STDLIB_FNS — definitions that are easier as fns than macros (iteration/sequence ops). Loaded after the
// macros. These are real Horsetail fn values (closures over the trace); map/reduce/filter recurse over the
// seq carrier. Kept as fns (not macros) so they are first-class (passable to higher-order calls).
export const STDLIB_FNS = String.raw`
;; (reduce step init s) — fold step over sequence s, left to right. step is a fn (acc x)->acc. Recursion
;; folds to a fixed point (no TCO needed — there is no stepping clock).
(define reduce
  (fn (step init s)
    (if (seq-empty? s)
        init
        (reduce step (apply step init (seq-head s)) (seq-tail s)))))

;; (map step s) — a new sequence of (step x) for each x. Built by reduce + seq-append.
(define map
  (fn (step s)
    (reduce (fn (acc x) (seq-append acc (seq (apply step x)))) (seq) s)))

;; (filter pred s) — keep elements whose (pred x) settles t. BEATS Fennel: a ⊥/⊤ predicate result does NOT
;; crash — only a t keeps the element (a ⊤ element is dropped by truth-projection here; (filter-hold …)
;; below KEEPS ⊤ elements, the held-maybe variant).
(define filter
  (fn (pred s)
    (reduce (fn (acc x) (if (apply pred x) (seq-append acc (seq x)) acc)) (seq) s)))

;; (filter-hold pred s) — the four-valued filter: keep an element when (pred x) is t OR ⊤ (held), drop on
;; f/⊥. The maybe-filter that distinguishes 'contradicted' from 'false' — no analogue in Fennel.
(define filter-hold
  (fn (pred s)
    (reduce (fn (acc x) (if (affirmed? (apply pred x)) (seq-append acc (seq x)) acc)) (seq) s)))

;; (for-each step s) — apply step to each element for effect (its body settles, e.g. assert). Returns the
;; last step's charge. Iteration is fold over the seq carrier.
(define for-each
  (fn (step s)
    (if (seq-empty? s)
        bot
        (do (apply step (seq-head s)) (for-each step (seq-tail s))))))

;; (fold step init s) — alias of reduce, the named fold (the loop primitive replacement).
(define fold (fn (step init s) (reduce step init s)))

;; (range n) — the sequence 0..n-1, built by recursion. A tiny iteration source for comprehensions.
(define range
  (fn (n)
    (if (< n 1) (seq) (seq-append (range (- n 1)) (seq (- n 1))))))

;; (sum s) — sum a sequence of numbers (reduce + on 0).
(define sum (fn (s) (reduce (fn (acc x) (+ acc x)) 0 s)))

;; (length s) — element count (seq-len, exposed under a friendly name).
(define length (fn (s) (seq-len s)))
`;
