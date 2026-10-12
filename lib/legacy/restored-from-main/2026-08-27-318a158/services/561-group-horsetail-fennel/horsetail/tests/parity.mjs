// parity — Horsetail's MEET-OR-BEAT-Fennel proof suite. One test (or cluster) per Fennel feature category,
// proving Horsetail meets it, PLUS a test per BEAT (where Horsetail's paraconsistent settling does what
// Fennel cannot). Run on the real engine (reader + evaluator + substrate fold + kernel bilattice). Pure,
// no disk. Exit 0 if all pass, 1 otherwise. This file is ADDITIVE — the original run.mjs (the 57 LAW
// proofs) is untouched and still green.

import { world, run, glyph } from "../src/horsetail.mjs";
import { isTrue, isTopValue, isBottom, present } from "../src/charges.mjs";

const results = [];
const check = (name, pass) => results.push({ name, pass: !!pass });
const g = (charge) => glyph(charge);                 // t / f / ⊥ / ⊤
const d = (charge) => charge.evidence[0][0];         // the carried value datum
// run a fresh-world program and return its last charge's value datum.
const val = (src) => d(run(src));
const four = (src) => g(run(src));

// ── 1. functions / closures (fn/lambda, varargs, multiple values, apply) ─────────────────────────
check("fn: a lambda applies and its body settles", val("(define inc (fn (n) (+ n 1))) (inc 41)") === 42);
check("fn: multi-arg application binds positionally", val("(define add (fn (a b) (+ a b))) (add 40 2)") === 42);
check("fn: (apply f a b) applies to listed args", val("(define add (fn (a b) (+ a b))) (apply add 3 4)") === 7);
check("closure: a returned fn closes over its defining scope (lexical)",
  val("(define mk (fn (a) (fn (b) (+ a b)))) (define add5 (mk 5)) (add5 100)") === 105);
check("closure: free variable resolves up the captured path",
  val("(define base 10) (define addbase (fn (x) (+ x base))) (addbase 5)") === 15);
check("recursion: a recursive fn folds to a fixed point (no TCO declared)",
  val("(define fac (fn (n) (if (< n 1) 1 (* n (fac (- n 1)))))) (fac 5)") === 120);
check("recursion: deeper mutual-style recursion (fib) settles",
  val("(define fib (fn (n) (if (< n 2) n (+ (fib (- n 1)) (fib (- n 2)))))) (fib 10)") === 55);
{
  const v = val("(define rest (fn (a . xs) xs)) (rest 1 2 3 4)");
  check("varargs: a dotted-tail fn param binds the rest as a sequence", Array.isArray(v.seq) && v.seq.length === 3);
}
{
  const v = val("(values 7 8 9)");
  check("multiple-values: (values …) carries all values in one charge", Array.isArray(v.values) && v.values.length === 3);
  check("multiple-values: a bare caller sees the FIRST value", isTrue(run("(values 7 8 9)")));
  check("multiple-values: let-values destructures positionally",
    val("(let-values (((a b) (values 7 8))) (+ a b))") === 15);
}

// ── 2. bindings + destructuring (let/local over sequences & associative cells) ───────────────────
check("let: local bindings are visible in the body", val("(let ((x 5) (y 10)) (+ x y))") === 15);
check("let: bindings are sequential (let*) — a later sees the earlier", val("(let ((x 5) (y (+ x 1))) (+ x y))") === 11);
check("let: a binding is a real trace row (auditable, append-only)", (() => {
  const w = world(); run("(let ((z 3)) z)", w); return w.trace.some((r) => r.e.includes("/let/") && r.a === "bound-to");
})());
check("destructure: let over a sequence binds positionally", val("(let (((a b) (seq 10 20))) (+ a b))") === 30);
check("destructure: nested sequence destructuring", val("(let (((a (b c)) (seq 1 (seq 2 3)))) (+ a (+ b c)))") === 6);
check("destructure: a fn param can be a sequence pattern", val("(define ps (fn ((x y)) (+ x y))) (ps (seq 3 4))") === 7);

// ── 3. control flow (when/unless/do/cond/case) — four-valued ─────────────────────────────────────
check("do: progn alias returns the last form", val("(do 1 2 3)") === 3);
check("when: runs the body iff the test is t", isTrue(run("(when t (assert a b c))")));
check("when: a non-t test yields ⊥ (no body)", four("(when f (assert a b c))") === "⊥");
check("unless: runs the body iff the test is NOT t", isTrue(run("(unless f (assert a b c))")));
check("cond: first true clause wins", val("(cond ((< 5 1) 100) ((< 1 5) 200) (else 999))") === 200);
check("cond: else fires when no test is true", val("(cond ((< 5 1) 100) (else 999))") === 999);
check("case: pattern dispatch (= match)", val("(case 2 (1 100) (2 200) (_ 0))") === 200);

// ── 4. PATTERN MATCHING (match: patterns/guards/wildcards/or) ────────────────────────────────────
check("match: a literal pattern matches by value", val("(match 2 (1 100) (2 200) (_ 0))") === 200);
check("match: a wildcard _ catches all", val("(match 5 (1 100) (_ 999))") === 999);
check("match: a binder ?x binds the subject", val("(match 7 (?x (+ x 1)))") === 8);
check("match: an or-pattern alternates", val("(match 3 ((or 1 2 3) 111) (_ 0))") === 111);
check("match: a sequence pattern destructures and binds", val("(match (seq 1 2 3) ((?a ?b ?c) (+ a (+ b c))))") === 6);
check("match: a guarded pattern (? guard p) tests the bound value",
  val("(match 5 ((? (> it 3) ?x) (* x 10)) (_ 0))") === 50);
check("match: no clause matches → ⊥ (undetermined)", four("(match 9 (1 t) (2 f))") === "⊥");

// ── 5. loops / comprehensions (each/for/while + map/reduce/filter/range) ─────────────────────────
check("reduce: folds a step over a sequence", val("(reduce (fn (a x) (+ a x)) 0 (seq 1 2 3 4))") === 10);
{
  const m = val("(map (fn (x) (* x 10)) (seq 1 2 3))");
  check("map: builds a new sequence element-wise", Array.isArray(m.seq) && m.seq.length === 3 && m.seq[2].evidence[0][0] === 30);
}
{
  const f = val("(filter (fn (x) (< x 3)) (seq 1 2 3 4))");
  check("filter: keeps elements whose predicate settles t", Array.isArray(f.seq) && f.seq.length === 2);
}
check("range+sum: a comprehension-style fold over a generated range", val("(sum (range 5))") === 10);
check("for-each: iterates for effect, binding each element (3 distinct values seen)", (() => {
  const w = world();
  run("(for-each (fn (x) (assert /log saw x)) (seq a b c))", w);
  const seen = w.trace.filter((r) => r.e === "/log" && r.a === "saw").map((r) => r.v);
  return seen.length === 3 && seen.includes("a") && seen.includes("b") && seen.includes("c");
})());
check("length: sequence length", val("(length (seq 9 8 7))") === 3);

// ── 6. MODULE system (module/require/import — typed-path addressed) ──────────────────────────────
{
  const w = world();
  run("(module /geo (assert origin x 0) (define dist (fn (a) (* a a))))", w);
  check("module: require loads + federates a registered module", four("(require /geo)", w) === "t" || g(run("(require /geo)", w)) === "t");
  check("module: a module assertion is readable after require", g(run("(recall /geo/origin x)", w)) === "t");
  check("module: a module fn is callable by its typed path", val("(/geo/dist 6)", w) === undefined ? false : d(run("(/geo/dist 6)", w)) === 36);
}
{
  // require for an UNKNOWN module is ⊥ (no host throw — paraconsistent).
  check("module: requiring an unknown module is ⊥ (not an error)", g(run("(require /nope)")) === "⊥");
}

// ── 7. STDLIB written in Horsetail (sequence/number/string/collection + threading) ───────────────
check("arith: (+ - * /) compute on charges", val("(+ 1 2 3)") === 6 && val("(- 10 3)") === 7 && val("(* 2 3 4)") === 24);
check("compare: (< > =) return charges", four("(< 1 2)") === "t" && four("(> 1 2)") === "f" && four("(= 2 2)") === "t");
check("string: (str …) concatenates, (len …) measures", val('(str "ab" "cd")') === "abcd" && val('(len "hello")') === 5);
check("string: (sub s i j) substrings", val('(sub "horsetail" 0 5)') === "horse");
check("collection-as-trace: assoc puts, get reads", (() => {
  const w = world(); run("(assoc tbl color red)", w); return g(run("(get tbl color)", w)) === "t";
})());
check("collection-as-trace: keys projects the section", isTrue(run("(assoc t2 a 1) (keys t2)", world())));
check("threading: -> inserts as the first arg", val("(-> 5 (+ 1) (* 2))") === 12);
check("threading: ->> inserts as the last arg", val("(->> 5 (- 10))") === 5);

// ── 8. error handling (paraconsistent: an error is a ⊥/⊤ you HOLD; try/raise) ─────────────────────
check("error: (raise x) settles to a HELD ⊤ (never a host throw)", g(run("(raise t)")) === "⊤");
check("error: (try body (catch ?e h)) runs the handler on a ⊤/⊥ body", g(run("(try (raise t) (catch ?e t))")) === "t");
check("error: (try body …) passes a clean t body through", g(run("(try t (catch ?e f))")) === "t");
check("error: a body settling to ⊥ triggers the catch", g(run("(try (seq-head (seq)) (catch ?e t))")) === "t");

// ── 9. compile story (macroexpand-all → residual core-form cell) ─────────────────────────────────
{
  const v = val("(macroexpand-all (quote (when t (assert a b c))))");
  check("compile: macroexpand-all returns a residual core-form cell", v && typeof v === "object" && Array.isArray(v.cell));
}

// ══════════════════════ THE BEATS (where Horsetail BEATS Fennel) ═════════════════════════════════

// BEAT 1: match BINDS AND BRANCHES ON ⊤ — a clause matches a held-contradictory subject and runs its body.
{
  const w = world();
  run("(assert sky has blue)", w);
  run("(deny sky has blue)", w); // sky/has is now ⊤ (told both)
  const r = run("(match (recall sky has) (⊤ (assert /handled the contradiction)) (_ f))", w);
  check("BEAT match-⊤: a ⊤ subject MATCHES the ⊤ pattern (Fennel would have crashed)", isTopValue(r) || g(r) === "⊤");
  check("BEAT match-⊤: the clause body RAN under the contradiction", w.trace.some((r2) => r2.e === "/handled"));
}

// BEAT 2: fn whose body SETTLES — a function asserts/denies into the live trace and can query it.
{
  const w = world();
  run("(define remember (fn (k v) (assert /memory k v)))", w);
  run("(remember favorite blue)", w);
  check("BEAT fn-settles: applying a fn APPENDED a predication to the trace",
    w.trace.some((r) => r.e === "/memory" && r.a === "favorite" && r.v === "blue"));
}

// BEAT 3: collections are settled SECTIONS — dissoc DENIES (the key goes f/⊤, never silently gone).
{
  const w = world();
  run("(assoc box lid on)", w);
  run("(dissoc box lid on)", w);     // a put then a remove of the SAME cell → ⊤ (held), not vanished
  check("BEAT collection: dissoc after assoc holds the cell ⊤ (provenance kept, not silently gone)",
    g(run("(get box lid)", w)) === "⊤");
  check("BEAT collection: BOTH witnesses survive (auditable)", w.trace.filter((r) => r.e === "/box").length >= 2);
}

// BEAT 4: merge / require is FEDERATE — conflicting keys settle to ⊤, not last-write-wins.
{
  const w = world();
  run("(assert realm has peace)", w);
  check("BEAT federate-merge: merging a disagreeing trace settles the cell to ⊤ (not clobbered)",
    g(run("(merge ((deny realm has peace)) realm)", w)) === "⊤");
}

// BEAT 5: modal forms (must/should/may) have NO Fennel analogue — RFC-2119 □/◇ as first-class values.
check("BEAT modal: (must t) is a first-class language value (□)", g(run("(must t)")) === "t");
check("BEAT modal: (may ⊥) stays ⊥ (◇ over nothing)", g(run("(may ⊥)")) === "⊥");

// BEAT 6: -?> threads four-valued — short-circuits on ⊥ (absent), distinct from ⊤ (contradicted).
check("BEAT maybe-thread: -?> short-circuits to ⊥ on an absent step", g(run("(-?> 5 (seq-head (seq)) (+ 1))")) === "⊥");
check("BEAT maybe-thread: -?> threads a present chain through", d(run("(-?> 5 (+ 1) (* 2))")) === 12);

// BEAT 7: the REPL/program is an auditable, re-foldable TRACE — re-defining shows ⊤ (told both).
{
  const w = world();
  run("(define ok t)", w);
  run("(define ok f)", w);          // re-define to the OPPOSING charge (told both t and f)
  check("BEAT trace-repl: re-defining a name to an opposing charge shows ⊤ (told both), not a silent rebind",
    g(run("(recall ok)", w)) === "⊤");
  check("BEAT trace-repl: both define witnesses survive (the session is an auditable trace)",
    w.trace.filter((r) => r.e === "/ok").length >= 2);
}

// BEAT 8: filter/comparison return CHARGES — a ⊤ element is HELD by filter-hold; (= ⊤-side) is ⊤.
{
  const fh = val("(filter-hold (fn (x) (if (< x 3) t (both q r s))) (seq 1 2 9))");
  check("BEAT four-valued-filter: filter-hold KEEPS a ⊤ element (held, not crashed)",
    Array.isArray(fh.seq) && fh.seq.length === 3);
  // (= …) over a contradictory side is ⊤, not a forced boolean.
  const w = world();
  run("(assert n is 5)", w); run("(deny n is 5)", w);
  check("BEAT four-valued-compare: (= …) over a ⊤ operand returns ⊤ (uncertainty carried)",
    g(run("(= (recall n is) (recall n is))", w)) === "⊤");
}

// ── hygiene / gensym (capture-avoidance under settling) ──────────────────────────────────────────
{
  const w = world();
  const a = d(run("(gensym foo)", w)), b = d(run("(gensym foo)", w));
  check("gensym: two gensyms in one world are distinct fresh symbols", a.name !== b.name);
}
check("hygiene: a macro-introduced %% local does not capture a caller binding", (() => {
  const w = world();
  run("(defmacro hold-it (e) (let ((%%tmp e)) %%tmp))", w);
  // a caller using the name `tmp` must not be captured by the macro's %%tmp local.
  return d(run("(let ((tmp 99)) (hold-it 7))", w)) === 7;
})());

// ── report ───────────────────────────────────────────────────────────────────────────────────────
let failed = 0;
for (const r of results) { console.log(`${r.pass ? "  ok" : "FAIL"}  ${r.name}`); if (!r.pass) failed++; }
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
