// evaluator — the SETTLER. The one inversion: eval is not a function call, it is `settle`. Evaluating a
// form APPENDS predications to the trace and settles it to a Knaster–Tarski fixed point; the "value" is
// the projected settled charge, collapsed to a scalar only at the edge where you must act. The program
// is a trace; running it is folding it. There is no clock that STEPS — `t` is a monotone witness stamp
// for fold-ordering (retraction/supersede), never a time the evaluator advances on its own.
//
// Each special form maps to an OS op over the canonical shapes:
//   assert/deny  -> append a (charged) {e,a,v,t} row (negative evidence is the CONVERSE predication)
//   define       -> append-only binding (re-define adds counter-evidence, never overwrites)
//   recall/query -> believe/recall over the settled section (the belief read-out, ./believe.mjs)
//   settle       -> force the fold to its fixed point; section -> {affirmed,denied,contradicted}
//   relate / relate-from -> the substrate's general graph reads
//   quote/quasiquote/defmacro -> homoiconic over cells; a macro transforms cells
//   must/should/may -> the modal □/◇ as necessitating/possibilising charges
//   at           -> typed-path addressing/scope
//   as           -> act as a principal (computer/principal)
//   federate     -> tensor-merge two traces (computer/distribution)
//
// Pure over the substrate: NO node:fs here. The trace is in-memory data; persisting bytes is the host's
// concern (posix-holography), kept out of the language. math never imports computer.

import { fold, settle as substrateSettle, section as substrateSection, sectionSpace, relate, relateFrom, rowId }
  from "./_substrate.mjs";
import { row as chuRow, settleRow } from "@lenticule-science/metrologic/chu";
import believe from "./believe.mjs";
import {
  necessitateKnowledge, possibilizeKnowledge, lastValuation,
} from "@lenticule-science/metrologic/bilattice/descent";
import { federate, sectionOf, allRows } from "./_distribution.mjs";
import { may as principalMay } from "./_principal.mjs";
import { asFour, toCharge } from "@lenticule-science/metrologic/chu/four";
import { isSym, isCell, isChargeLit, sym, cell, write } from "./reader.mjs";
import { matchCell } from "./pattern.mjs";
import { makeArith } from "./arith.mjs";
import { makeStrings } from "./strings.mjs";
import { makeSeq } from "./seq.mjs";
import {
  T, F, BOT, TOP, affirmCharge, denyCharge, fourName, glyph, isCharge,
  kOrAll, kAndAll, tOrAll, tAndAll, negate, conflate, combine, boolean,
  isTrue, isFalse, isBottom, isTopValue, present,
} from "./charges.mjs";

// The provisional name of the language — used where a constant would otherwise hardcode "Horsetail".
export const LANGUAGE_NAME = "Horsetail";

// ── the world: the append-only trace + the bookkeeping a settler needs ───────────────────────────
// A world is { trace, clock, macros, principal, scope }. The trace is the {e,a,v,t} log (the program).
// clock is the monotone witness counter. macros maps a head-symbol -> a transformer cell. principal is
// the current `as` actor (null = the base self). scope is the current `at` typed-path prefix (a string).
export function makeWorld(init = {}) {
  return {
    trace: init.trace ? [...init.trace] : [],
    clock: init.clock ?? 0,
    gensym: init.gensym ?? 0,   // a SEPARATE monotone counter for fresh-symbol minting (kept out of the
                                // witness-stamp namespace so evidence-ordering stays clean — openFork resolved).
    macros: new Map(init.macros ?? []),
    fns: new Map(init.fns ?? []),         // fn-id -> {kind:'fn', params, body, scope, principal}: the
                                          // closure store. A fn charge carries its id; apply reads it back.
    modules: new Map(init.modules ?? []), // module-name -> registered source string (the require loader's
                                          // in-memory source map; disk stays the host's per the spec).
    principal: init.principal ?? null,
    scope: init.scope ?? "/",
    converse: { ...(init.converse ?? {}) }, // converse-predicate -> positive predicate, for fold
  };
}

// gensymName(world, prefix) -> a fresh, never-reused Sym name `/<prefix>/g<n>` off the dedicated gensym
// counter (NOT world.clock — keeps witness stamps and generated ids in separate namespaces). The leading
// "/" makes it an absolute typed-path so it is never captured by a relative scope.
function gensymName(world, prefix = "gensym") {
  return "/" + prefix + "/g" + String(world.gensym++);
}

// stamp(world) -> the next monotone witness `t`. Append-only: t never goes backward. (A string keeps it
// comparable by the substrate's `>` on t, and legible.)
const stamp = (world) => `t${String(world.clock++).padStart(6, "0")}`;

// append(world, row) -> push a {e,a,v,t} row onto the trace (the one mutation). Returns its rowId as the
// witness token, so a charge can carry the exact row that witnesses it (evidence linear: nothing dropped).
function append(world, e, a, v) {
  const row = { e: String(e), a: String(a), v, t: stamp(world) };
  world.trace.push(row);
  return { row, id: rowId(row) };
}

// ── resolution / scope: a symbol is a typed-path reference ───────────────────────────────────────
// resolvePath(world, name) -> the absolute typed-path of a symbol under the current `at` scope. A leading
// "/" is already absolute; otherwise it hangs off world.scope. Lexical scope IS the path tree (the spec).
export function resolvePath(world, name) {
  if (name.startsWith("/")) return name;
  if (world.scope === "/") return "/" + name;
  return world.scope.replace(/\/$/, "") + "/" + name;
}

// resolveBinding(world, name) — LEXICAL variable resolution: find the path at which `name` is BOUND, by
// searching the current scope and walking UP its ancestor path segments (lexical scope IS the path tree).
// An absolute name (leading "/") resolves to itself. Returns { path, datum, charge } of the nearest binding,
// or null if no ancestor binds it. This is what makes a closure's FREE variable (e.g. a recursive fn's own
// name, or a captured outer `a`) resolve from an inner call scope up to where it was defined.
function resolveBinding(world, name) {
  if (name.startsWith("/")) {
    const got = recallDatum(world, name);
    return got && got.datum !== undefined ? { path: name, ...got } : null;
  }
  // candidate paths: scope/name, then each ancestor of scope down to /name.
  const segs = world.scope === "/" ? [] : world.scope.replace(/^\//, "").replace(/\/$/, "").split("/");
  for (let i = segs.length; i >= 0; i--) {
    const prefix = i === 0 ? "" : "/" + segs.slice(0, i).join("/");
    const path = prefix + "/" + name;
    const got = recallDatum(world, path);
    if (got && got.datum !== undefined) return { path, ...got };
  }
  return null;
}

// the settled section of a subject under the current trace (functional predicates left to the caller's
// converse map; this is the general read). Returns the substrate's folded fiber.
function settledOf(world, subject) {
  return substrateSettle(subject, world.trace, { converse: world.converse });
}

// chargeForCell(folded, predicate, object) -> the charge of one (predicate, object) cell, as a kernel
// charge (so ⊤ is bindable). ⊥ when the cell is absent (no evidence).
function chargeForCell(folded, predicate, object) {
  const c = folded.fiber.find((x) => x.predicate === predicate && jsonEq(x.object, object));
  if (!c) return BOT;
  const { pos, neg, evidence } = c.value;
  return { value: [!!pos, !!neg], evidence: evidence ?? [[], []] };
}

const jsonEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// recallDatum(world, name) -> the stored OBJECT datum a (name, bound-to, {is,as}) row carries (the VALUE a
// `define`/`let`/`fn-arg` binding holds), latest-wins over the trace, with its settled charge. Returns
// { datum, charge } or null if the name has no binding. This is how let/fn/destructuring read a binding's
// VALUE back (the binding charge's evidence is a rowId witness, not the value — the value is in v.is).
function recallDatum(world, name) {
  const folded = settledOf(world, name);
  const cells = folded.fiber.filter((c) => c.predicate === "bound-to");
  if (cells.length === 0) return null;
  // latest binding by witness stamp t (append-only: the last asserted binding is the current value; the
  // charge still reflects ALL bindings so a re-defined name reads ⊤ — append-only LAW preserved).
  const all = world.trace.filter((r) => r.e === name && r.a === "bound-to");
  const last = all.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0))[all.length - 1];
  const charge = cells.map((c) => ({ value: [!!c.value.pos, !!c.value.neg], evidence: c.value.evidence }))
    .reduce((a, b) => combine(a, b));
  return { datum: last ? last.v.is : undefined, charge };
}

// ── the literal evaluator: a value form settles to its own charge ────────────────────────────────
// A charge literal -> its charge. A number/string/boolean/object literal -> an affirmed charge whose
// witness is the value itself (the datum is its own evidence). A cell -> a special-form/application.
function evalLiteral(form) {
  if (isChargeLit(form)) return four(form.four);
  if (typeof form === "number" || typeof form === "string" || typeof form === "boolean") {
    return { value: [true, false], evidence: [[form], []] };
  }
  if (form === null) return BOT;
  if (isCharge(form)) return form;
  // a plain object/array LITERAL carried as data: its own evidence.
  return { value: [true, false], evidence: [[form], []] };
}

const four = (name) => (name === "t" ? T : name === "f" ? F : name === "top" ? TOP : BOT);

// datum(form) — the OBJECT value a form denotes when used as an EAVT `v` or a path component. A BOUND
// symbol (a let/fn local, a define) resolves to its VALUE datum — so (assert s p x) inside a fn body
// stores the value `x` is bound to, not the literal name "x" (variable references work in object position
// too, not just expression position). An UNBOUND symbol is its own name (so (assert sky has blue) stores
// "blue" as before — backward compatible). A string/number/boolean is itself; a charge literal its FOUR
// name; a cell stays cell-data (homoiconic storage). The settler's args are READ forms; here we project
// to storable data.
function datum(form, world) {
  if (isSym(form)) {
    if (world) {
      const bound = resolveBinding(world, form.name);
      if (bound && bound.datum !== undefined) {
        // a fn-binding stores its {fn:id} datum; a scalar/seq its value; normalize a Sym-name back to a name.
        return isSym(bound.datum) ? bound.datum.name : bound.datum;
      }
    }
    return form.name;
  }
  if (isChargeLit(form)) return form.four;
  if (isCell(form)) {
    // an EVALUABLE cell in object position (an application / arith / seq …) is evaluated to its value datum
    // so (assert s p (+ 1 2)) stores 3; a quoted/literal cell stays cell-data (homoiconic storage).
    const h = isSym(form[0]) ? form[0].name : null;
    if (world && h && (SPECIAL[h] || world.macros.has(h)) && h !== "quote" && h !== "quasiquote") {
      return chargeValueDatum(evaluate(form, world));
    }
    return quoteData(form);
  }
  return form;
}

// quoteData(cell) -> the plain-JSON shadow of a cell (for storing code AS data). Symbols become {sym},
// charge-lits become {charge}, nested cells recurse. write/read is the legible inverse; this is the
// structural one the trace stores.
function quoteData(form) {
  if (isCell(form)) return { cell: form.map(quoteData) };
  if (isSym(form)) return { sym: form.name };
  if (isChargeLit(form)) return { charge: form.four };
  return form;
}

// ── the special-form table: each maps to an OS op. Forms get UNEVALUATED args (they decide). ─────
const head = (c) => (isSym(c[0]) ? c[0].name : null);

// the dispatcher: macroexpand, then special form, then application (a relational call — settle).
export function evaluate(form, world) {
  // a BARE SYMBOL in evaluation position resolves to its BINDING if one exists (let/fn locals, define): the
  // charge the name was bound to, read back from its (name, bound-to, {is,as}) row. This is what makes
  // (+ x y) work after (let ((x 1)(y 2)) …) — bare names are variable references. If the name has NO
  // binding, the symbol is its own datum (backward compatible: a bare symbol used as DATA still works,
  // since assert/define args go through datum()/pathOf() and never through evaluate()).
  if (isSym(form)) {
    const bound = resolveBinding(world, form.name);
    if (bound && bound.datum !== undefined) {
      if (isFnDatum(bound.datum)) return { value: [true, false], evidence: [[bound.datum], []] };
      // a pure FOUR-point binding (datum is its FOUR name) reads back as that charge; a scalar/data datum
      // reads back as an affirmed charge carrying it, tinted by the binding's settled charge (so a
      // re-defined name reads ⊤ — append-only).
      if (bound.datum === "t" || bound.datum === "f" || bound.datum === "bot" || bound.datum === "top") {
        return four(bound.datum);
      }
      const d = isFnDatum(bound.datum) ? bound.datum : bound.datum;
      const base = { value: [true, false], evidence: [[d], []] };
      return isTopValue(bound.charge) ? combine(base, TOP) : base;
    }
    return evalLiteral(form);
  }
  if (!isCell(form)) return evalLiteral(form);
  const h = head(form);
  // macro? expand the cell, then evaluate the expansion (code is a trace is data).
  if (h && world.macros.has(h)) return evaluate(macroexpand(form, world), world);
  if (h && SPECIAL[h]) return SPECIAL[h](form.slice(1), world, form);
  // a bare cell whose HEAD is a Sym that resolves to a fn-charge is a fn APPLICATION ((f a b …)). We only
  // apply when the head explicitly settles to an {fn:id} charge, leaving non-fn bare cells purely
  // relational (openFork resolved CONSERVATIVELY: a relational subject read never accidentally "calls").
  if (h && isSym(form[0])) {
    const headCharge = resolveBinding(world, h);
    if (headCharge && isFnDatum(headCharge.datum)) {
      const argv = form.slice(1).map((a) => evaluate(a, world));
      return applyFn({ value: [true, false], evidence: [[headCharge.datum], []] }, argv, world);
    }
  }
  // otherwise a bare cell is a body/sequence: evaluate each subform; the value is the LAST (progn).
  return progn(form, world);
}

// bindValue(nameSym, charge, world) — append a (name, bound-to, {is,as}) row under the CURRENT scope for
// an already-evaluated charge (the let/fn/match binder). The stored datum is the charge's VALUE datum so a
// later recallDatum reads it back; a denied charge stores the converse face (append-only, never overwrite).
function bindValue(nameSym, charge, world) {
  const name = pathOf(nameSym, world);
  const bound = { is: chargeValueDatum(charge), as: fourName(charge) };
  if (isFalse(charge)) { const conv = "not:bound-to"; world.converse[conv] = "bound-to"; append(world, name, conv, bound); }
  else append(world, name, "bound-to", bound);
  // register the fn id under the name too, so (name …) application can find the closure (fn values bind
  // by their {fn:id} datum — recallDatum returns it and the dispatch applies it).
  return chargeForCell(settledOf(world, name), "bound-to", bound);
}

// defineLocal(targetSym, valForm, charge, world) — the let-binding path: bind a Sym to a value form's
// charge under the current scope. Reuses bindingDatum (the same shape `define` stores) so recall/recallDatum
// read it identically. SEQUENTIAL: a later let-binding sees this one (it is already in the trace).
function defineLocal(targetSym, valForm, charge, world) {
  const name = pathOf(targetSym, world);
  const bound = bindingDatum(valForm, charge, world);
  if (isFalse(charge)) { const conv = "not:bound-to"; world.converse[conv] = "bound-to"; append(world, name, conv, bound); }
  else append(world, name, "bound-to", bound);
  return chargeForCell(settledOf(world, name), "bound-to", bound);
}

// chargeValueDatum(charge) — the storable VALUE datum a charge carries: its single positive-evidence datum
// if it has exactly one (a scalar/fn/seq/values rides there), else its FOUR name (a pure charge point).
function chargeValueDatum(charge) {
  const pos = charge && charge.evidence && charge.evidence[0];
  if (Array.isArray(pos) && pos.length === 1) return pos[0];
  return fourName(charge);
}

// seqCharge(items) — wrap an ordered list of charges as a SEQUENCE charge: one affirmed charge carrying
// {seq:[…]} in its evidence (the ordered-collection carrier map/reduce/filter fold over). Empty seq is an
// affirmed empty {seq:[]} (NOT ⊥ — an empty sequence is a value, distinct from no-evidence).
function seqCharge(items) {
  return { value: [true, false], evidence: [[{ seq: items }], []] };
}

// isFnDatum(d) -> true if d is a stored fn reference {fn:id}. The dispatch test for fn application.
const isFnDatum = (d) => d !== null && typeof d === "object" && typeof d.fn === "string";

// fnFromCharge(charge, world) -> the closure record a fn-charge points at, or null. A fn-charge carries
// {fn:id} as its single positive-evidence datum; we look the id up in world.fns.
function fnFromCharge(charge, world) {
  const d = charge && charge.evidence && charge.evidence[0] && charge.evidence[0][0];
  if (isFnDatum(d)) return world.fns.get(d.fn) ?? null;
  return null;
}

// applyFn(fcharge, argv, world) -> settle the fn body with argv bound under a fresh scope nested in the
// fn's CAPTURED scope (lexical closure: the captured path is the parent, so free names resolve up it).
// Params bind positionally; a Sym param is a local (define), a CELL param destructures (bindPattern), and
// a dotted `.` tail binds the rest of the args as a sequence charge. The body settles (can assert/deny,
// hold ⊤, query the trace). Returns the body's settled charge; a non-fn head settles to ⊥ (not an error).
function applyFn(fcharge, argv, world) {
  const f = fnFromCharge(fcharge, world);
  if (!f) return BOT;
  const prior = world.scope, priorP = world.principal;
  // the call scope hangs off the CAPTURED scope (closure), with a fresh gensym leaf so each call is its own
  // frame (recursion-safe: distinct arg bindings per activation).
  const captured = f.scope === "/" ? "" : f.scope.replace(/\/$/, "");
  world.scope = captured + gensymName(world, "call");
  if (f.principal !== undefined) world.principal = f.principal;
  try {
    const params = f.params;
    for (let i = 0; i < params.length; i++) {
      const p = params[i];
      if (isSym(p) && p.name === ".") {            // dotted tail: bind rest as a seq charge
        const restName = params[i + 1];
        const rest = seqCharge(argv.slice(i));
        bindValue(restName, rest, world);
        break;
      }
      const v = argv[i] !== undefined ? argv[i] : BOT;
      if (isCell(p)) bindPatternInScope(p, v, world);
      else bindValue(p, v, world);
    }
    return progn(cell(f.body), world);
  } finally { world.scope = prior; world.principal = priorP; }
}

// ── pattern matching + destructuring (pattern.mjs is the four-valued matcher) ─────────────────────
// patternHelpers(world) — the small surface pattern.mjs needs: predicates, the FOUR reader, value-datum
// extraction, equality, charge wrapping, and a guard runner (apply a fn or evaluate a form against the
// subject + bindings). Keeps pattern.mjs pure over charges; the evaluator owns eval/scope.
function patternHelpers(world) {
  return {
    isSym, isCell, isChargeLit, fourName,
    valueDatum: (charge) => chargeValueDatum(charge),
    jsonEq,
    wrapDatum: (d) => ({ value: [true, false], evidence: [[d], []] }),
    asCharge: (x) => (isCharge(x) ? x : { value: [true, false], evidence: [[x], []] }),
    // runGuard(form, subject, bindings) -> the guard's charge. The guard may be a fn-charge value OR a code
    // form; we evaluate it in a fresh scope with the match bindings (and `it` = the subject) in place.
    runGuard: (form, subject, bindings) => {
      const prior = world.scope;
      world.scope = gensymName(world, "guard");
      try {
        bindValue(sym("it"), subject, world);
        for (const [k, v] of bindings) bindValue(sym(k), v, world);
        return evaluate(form, world);
      } finally { world.scope = prior; }
    },
  };
}

// matchDispatch(args, world) — (match subject (pat body…)…). Evaluate the subject ONCE, try each clause's
// pattern; the FIRST clause whose match is t OR ⊤ runs (the BEAT: a ⊤-match runs the body bound to the
// contested value). The chosen body settles under a fresh scope with the pattern binders defined. A
// ⊤-match knowledge-combines ⊤ onto the body result (the contradiction is HELD, surfaced). No clause →
// ⊥ (undetermined: nothing matched / subject still settling).
function matchDispatch(args, world) {
  const subject = evaluate(args[0], world);
  const helpers = patternHelpers(world);
  for (let i = 1; i < args.length; i++) {
    const clause = args[i];
    if (!isCell(clause)) continue;
    const pat = clause[0], body = clause.slice(1);
    const m = matchCell(pat, subject, helpers);
    if (m.four === "t" || m.four === "top") {
      const prior = world.scope;
      world.scope = gensymName(world, "match");
      try {
        for (const [k, v] of m.bindings) bindValue(sym(k), v, world);
        const result = progn(cell(body), world);
        return m.four === "top" ? combine(result, TOP) : result;
      } finally { world.scope = prior; }
    }
  }
  return BOT;
}

// threadForm(args, world, where, mode) — the threading macros (-> ->> -?>). Evaluate the seed ONCE, then
// for each step weave the running CHARGE in as the first/last arg. A step may be a bare Sym `f` (→ (f val))
// or a cell (f a b) (→ (f val a b) for first, (f a b val) for last). The threaded value is passed as an
// already-evaluated charge by binding it to a fresh local, so it is not re-evaluated. mode "maybe" short-
// circuits to ⊥ when a step settles to ⊥ (the four-valued maybe-thread); ⊤ is HELD and threading continues.
function threadForm(args, world, where, mode) {
  let val = evaluate(args[0], world);
  for (let i = 1; i < args.length; i++) {
    if (mode === "maybe" && isBottom(val)) return BOT; // short-circuit on absent (⊥)
    const step = args[i];
    // bind the running value to a fresh local, then splice that local symbol into the step (single-eval).
    const prior = world.scope;
    world.scope = gensymName(world, "thread");
    const holder = sym("/thread-val");
    try {
      bindValue(holder, val, world);
      let callForm;
      if (isCell(step)) {
        const h = step[0], rest = step.slice(1);
        callForm = where === "first" ? cell([h, holder, ...rest]) : cell([h, ...rest, holder]);
      } else {
        callForm = cell([step, holder]);
      }
      val = evaluate(callForm, world);
    } finally { world.scope = prior; }
  }
  return val;
}

// safeRecallChain(args, world) — (?. subj k1 k2 …): recall (subj k1) to get a value; treat it as the next
// subject and recall k2; etc. Short-circuit to ⊥ as soon as a hop is absent. The recall-chaining maybe.
function safeRecallChain(args, world) {
  // the first hop's subject is a typed-path SUBJECT (resolve under scope), like recall/at; later hops use
  // the recalled cell's OBJECT as the next subject.
  let subj = pathOf(args[0], world);
  let subjCharge = BOT;
  for (let i = 1; i < args.length; i++) {
    const key = datum(args[i], world);
    const folded = settledOf(world, String(subj));
    const cells = folded.fiber.filter((c) => c.predicate === key);
    if (cells.length === 0) return BOT; // absent hop → short-circuit
    const c = cells[0];
    subjCharge = { value: [!!c.value.pos, !!c.value.neg], evidence: c.value.evidence };
    if (isBottom(subjCharge)) return BOT;
    // the recalled OBJECT becomes the next hop's subject, resolved to a typed path (a bare object name
    // hangs off root, matching how assert stored its subject).
    const obj = c.object;
    subj = typeof obj === "string" && obj.startsWith("/") ? obj : resolvePath(world, String(obj));
  }
  return subjCharge;
}

// bindPatternInScope(pattern, charge, world) — destructure a value into the current scope by binding every
// ?x/`.`-tail binder a pattern names. Shared by let, fn params, let-values. Reuses matchCell's binder set
// (so destructuring and match agree on the pattern language). A non-matching pattern still binds whatever
// it could (best-effort, LAW-safe: no throw); the unbound names simply read ⊥.
function bindPatternInScope(pattern, charge, world) {
  const helpers = { ...patternHelpers(world), bindBare: true }; // destructuring: bare Syms bind
  const m = matchCell(pattern, charge, helpers);
  for (const [k, v] of m.bindings) bindValue(sym(k), v, world);
  return m;
}

// ── error handling: paraconsistent try/catch (an error is a ⊥/⊤ you can HOLD, or a host throw) ──────
// tryForm(args, world) — (try body… (catch ?e handler…)). Settle the body. If it settles to ⊥ or ⊤, or if
// a host JS throw occurs (a real fault, surfaced as a ⊤ datum), run the (catch …) clause with the caught
// charge bound to its ?binder. Otherwise return the body's charge. No silent swallow: the caught value is
// the four-valued charge, inspectable/matchable.
function tryForm(args, world) {
  const clauses = args.filter((a) => isCell(a) && head(a) === "catch");
  const bodyForms = args.filter((a) => !(isCell(a) && head(a) === "catch"));
  let result, faulted = null;
  try {
    result = progn(cell(bodyForms), world);
  } catch (e) {
    faulted = { value: [true, true], evidence: [[{ error: String(e && e.message || e) }], [{ error: String(e && e.message || e) }]] };
  }
  const caught = faulted ?? result;
  const isProblem = faulted !== null || isBottom(caught) || isTopValue(caught);
  if (isProblem && clauses.length) {
    const clause = clauses[0];
    const binder = clause[1];
    const handler = clause.slice(2);
    const prior = world.scope;
    world.scope = gensymName(world, "catch");
    try {
      if (isSym(binder) && binder.name.startsWith("?")) bindValue(sym(binder.name.slice(1)), caught, world);
      return progn(cell(handler), world);
    } finally { world.scope = prior; }
  }
  return caught;
}

// ── modules: require = federate a registered sub-world (in-memory source map; disk is the host's) ──────
// requireModule(args, world) — (require /name). Look up the module's registered source, settle it into a
// FRESH sub-world scoped at /name, then federate the sub-trace into this world (G-Set union; clashing
// exports settle to ⊤). Registration happens via the (module …) stdlib macro / registerModule. Returns the
// module subject's federated charge (⊥ if the module is unknown — not a host throw).
function requireModule(args, world) {
  const name = pathOf(args[0], world);
  const src = world.modules.get(name);
  if (src === undefined) return BOT;
  const sub = makeWorld({ converse: world.converse, scope: name, modules: [...world.modules], fns: [...world.fns] });
  for (const f of src) evaluate(f, sub);
  // federate the sub-world's rows into this world (append-only union; converse maps merge).
  Object.assign(world.converse, sub.converse);
  for (const [k, v] of sub.fns) world.fns.set(k, v); // carry the module's closures over
  const w = federate(worldToFederation(world), worldToFederation(sub));
  world.trace = allRows(w); // federate returns a Map world; allRows extracts the deduped row list
  // the module subject /name itself may carry no direct cells (its bindings/assertions live under it);
  // report t when the load brought rows in (the module is present), else the subject's own section charge.
  const sec = chargeFromSection(sectionOf(w, name, { converse: world.converse }));
  return isBottom(sec) && world.trace.some((r) => r.e.startsWith(name + "/")) ? T : sec;
}

// registerModule(world, name, forms) — record a module's body forms under /name in world.modules (the
// in-memory source map). Called by the (module …) macro's expansion via SPECIAL.register-module.
function registerModule(world, name, forms) {
  world.modules.set(name, forms);
}

// ── compile: full macroexpansion to a residual core-form cell (homoiconic output) ──────────────────
// expandAll(form, world) — recursively macroexpand every macro call to a fixed point, leaving only core
// special forms / applications. The honest "compile": settle IS evaluation, so the only residual is the
// expanded code. Does NOT evaluate — pure structure.
function expandAll(form, world) {
  if (!isCell(form)) return form;
  const h = head(form);
  if (h && world.macros.has(h)) return expandAll(macroexpand(form, world), world);
  return cell(form.map((x) => expandAll(x, world)));
}

// progn(cell) — evaluate each item; the value is the LAST (a body). An empty cell is ⊥.
function progn(items, world) {
  let v = BOT;
  for (const f of items) v = evaluate(f, world);
  return v;
}

// macroexpand — apply a macro: bind its params to the UNEVALUATED argument cells, substitute, then
// HYGIENE-RENAME the result. A macro transforms cells (homoiconic). The transformer is { params, body }.
//
// VARARGS: a dotted-tail param — the Sym `.` followed by one name — binds that name to a CELL of the
// remaining argument cells (so the body can splice it under ,@rest). Reader tokenizes `.` as an ordinary
// atom→Sym, so no reader change.
//
// HYGIENE: after substitution, any symbol the MACRO BODY introduced (not a param, not an already-absolute
// typed path, not a known special/macro head) is alpha-renamed through a per-expansion gensym map, so the
// positional substitute() stops leaking a binding into the caller. A leading-"/" path is real ADDRESSING,
// not a binding (openFork resolved: absolute paths are never renamed).
function macroexpand(form, world) {
  const { params, body } = world.macros.get(head(form));
  const args = form.slice(1);
  const env = new Map();
  const bound = new Set();        // param names — referentially transparent, never renamed
  for (let i = 0; i < params.length; i++) {
    if (params[i] === ".") {       // dotted tail: bind the next name to the REST of the args as a cell
      const restName = params[i + 1];
      env.set(restName, cell(args.slice(i)));
      bound.add(restName);
      break;
    }
    env.set(params[i], args[i]);
    bound.add(params[i]);
  }
  const substituted = substitute(body, env);
  return hygiene(substituted, bound, world);
}

// substitute — replace symbol leaves named in `env` with their bound cells; recurse into cells, HONORING
// unquote-splice so a macro body can write `,@rest` to splice a dotted-tail param's cell of args inline
// (and `,x` to insert one). This lets macros be written WITHOUT an explicit backtick (the whole body is
// an implicit template): a (unquote-splice p) whose param p is bound to a cell splices its elements into
// the surrounding cell; a (unquote p) inserts the bound form. Outside those, substitution is pure
// structure (a symbol leaf in env → its bound form; everything else unchanged).
function substitute(form, env) {
  if (isCell(form)) {
    const out = [];
    for (const item of form) {
      if (isCell(item) && isSym(item[0]) && item[0].name === "unquote-splice") {
        const spliced = substitute(item[1], env);
        if (isCell(spliced)) out.push(...spliced);
        else out.push(spliced);
      } else if (isCell(item) && isSym(item[0]) && item[0].name === "unquote") {
        out.push(substitute(item[1], env));
      } else {
        out.push(substitute(item, env));
      }
    }
    return cell(out);
  }
  if (isSym(form) && env.has(form.name)) return env.get(form.name);
  return form;
}

// hygiene — alpha-rename macro-INTRODUCED locals to fresh gensyms so an expansion cannot capture or leak a
// name into the caller's scope. OpenFork (which Syms are bindings vs typed-PATH references) is resolved by
// an EXPLICIT, LAW-safe convention rather than a fragile structural guess: a symbol whose name starts with
// "%%" is a macro-introduced local. Every such symbol is renamed CONSISTENTLY to one fresh gensym per
// expansion; absolute typed paths (leading "/"), heads, charge words, and ordinary data symbols pass
// through untouched (so `/foo` addressing and a literal data symbol are never clobbered). `bound` (the
// params) are referentially transparent and never marked "%%", so they are never renamed.
function hygiene(form, bound, world) {
  const renames = new Map();
  const fresh = (name) => {
    if (!renames.has(name)) renames.set(name, sym(gensymName(world, "hy")));
    return renames.get(name);
  };
  const walk = (f) => {
    if (isCell(f)) return cell(f.map(walk));
    if (isSym(f) && f.name.startsWith("%%") && !bound.has(f.name)) return fresh(f.name);
    return f;
  };
  return walk(form);
}

const SPECIAL = {
  // (quote x) — x unevaluated, as a cell (code is data). Its charge witnesses the cell itself.
  quote: (args) => ({ value: [true, false], evidence: [[quoteData(args[0])], []] }),

  // (quasiquote x) — like quote but (unquote y) / (unquote-splice y) holes are evaluated/spliced.
  quasiquote: (args, world) => {
    const built = quasi(args[0], world);
    return { value: [true, false], evidence: [[quoteData(built)], []] };
  },

  // (gensym) / (gensym prefix) — mint a FRESH typed-path Sym off the dedicated gensym counter, carried as
  // a datum charge (its own evidence). Mechanized off the monotone counter, never reused. The PREREQUISITE
  // for capture-avoiding macros: a macro calls (gensym) to name a local it introduces.
  gensym: (args, world) => {
    const prefix = args[0] !== undefined ? String(datum(args[0], world)) : "gensym";
    return { value: [true, false], evidence: [[sym(gensymName(world, prefix))], []] };
  },

  // (do body…) — an EXPLICIT alias for progn (the body sequencer), so macros (when/unless/cond) can emit
  // (do …) without relying on the bare-cell fallthrough. The value is the LAST form's charge.
  do: (args, world) => progn(args, world),

  // (let ((x e1) (y e2)) body…) — local bindings, REFRAMED to the append-only trace. Open a FRESH gensym
  // scope path, (define x e1)(define y e2) under it via the same machinery `at` uses, then progn the body,
  // and restore the prior scope. A binding is a real, auditable trace row — shadowing is a deeper path,
  // never an overwrite (LAW-preserving). Bindings are SEQUENTIAL (a later one sees the earlier — let*).
  let: (args, world) => {
    const bindings = isCell(args[0]) ? args[0] : cell([]);
    const prior = world.scope;
    world.scope = gensymName(world, "let");
    try {
      for (const b of bindings) {
        if (!isCell(b)) continue;
        const target = b[0], valForm = b[1];
        const v = evaluate(valForm, world);
        // destructuring: a CELL target (pattern) binds its parts via bindPattern; a Sym target binds one.
        if (isCell(target)) bindPatternInScope(target, v, world);
        else defineLocal(target, valForm, v, world);
      }
      return progn(args.slice(1), world);
    } finally { world.scope = prior; }
  },

  // (fn (params…) body…) — a callable VALUE whose body SETTLES. Returns a charge carrying a fresh fn-id;
  // the closure datum {kind:'fn', params, body, scope, principal} is stored in world.fns under that id.
  // The captured `scope` (a PATH) is the closure: free names resolve up that path at apply time (lexical
  // scope IS the path tree). params may be Syms OR pattern cells (destructuring) and may end in a dotted
  // `.` tail (varargs) — same surface as defmacro. This is the spine: many later features are fns.
  fn: (args, world) => {
    const params = isCell(args[0]) ? [...args[0]] : [];
    const body = args.slice(1);
    const id = gensymName(world, "fn");
    world.fns.set(id, { kind: "fn", params, body, scope: world.scope, principal: world.principal });
    return { value: [true, false], evidence: [[{ fn: id }], []] };
  },

  // (apply f a b …) — settle the body of fn `f` with args bound under a fresh scope. The head is evaluated
  // to a charge; if it carries an {fn:id}, apply it, else ⊥ (not a fn). Each arg is evaluated to a charge
  // first (applicative), then bound as a let-style row. Recursion needs no TCO declaration — the body is a
  // trace folded to a fixed point — but deep re-entrant JS frames are the host's limit (openFork noted).
  apply: (args, world) => {
    const f = evaluate(args[0], world);
    const argv = args.slice(1).map((a) => evaluate(a, world));
    return applyFn(f, argv, world);
  },

  // (values a b c …) — multiple values as ONE charge carrying {values:[…]} in its evidence (the carrier
  // the language already uses). A bare caller sees the FIRST value (first-class projection); let-values
  // destructures positionally. No new kernel value-kind — it is data in a charge (evidence-linear: the
  // extra values ride in the evidence, nothing is dropped).
  values: (args, world) => {
    const vs = args.map((a) => evaluate(a, world));
    const first = vs[0] ?? BOT;
    return { value: first.value, evidence: [[{ values: vs }], []] };
  },

  // (match subject (pat body)…) — four-valued pattern matching (pattern.mjs). The dispatch point only; the
  // matcher returns {result, bindings} and the chosen clause body settles under a fresh scope with the
  // pattern's binders defined. ⊤-AWARE: a clause can match a held-contradictory subject and run its body
  // bound to the ⊤ value (the BEAT over Fennel). See matchDispatch.
  match: (args, world) => matchDispatch(args, world),

  // (cond (test arm)…) — first-true-wins, REFRAMED four-valued: a t test runs its arm; an f test falls to
  // the next clause; a ⊥ test is pending (its arm is skipped, fall through); a ⊤ test runs its arm AND
  // falls through, knowledge-combining both (Fennel cannot express a contested test that both fires and
  // continues). No clause settled → ⊥. The literal `else`/`t` test always fires.
  cond: (args, world) => {
    let acc = null;
    for (const clause of args) {
      if (!isCell(clause)) continue;
      const test = clause[0];
      const body = clause.slice(1);
      const isElse = isSym(test) && (test.name === "else" || test.name === "_");
      const c = isElse ? T : evaluate(test, world);
      if (isTrue(c)) { const arm = progn(cell(body), world); return acc ? combine(acc, arm) : arm; }
      if (isTopValue(c)) { const arm = combine(progn(cell(body), world), TOP); acc = acc ? combine(acc, arm) : arm; }
      // f or ⊥: fall through to the next clause.
    }
    return acc ?? BOT;
  },

  // (-> seed (f a) (g b) …) — thread-first: insert the running value as the FIRST arg of each step. A bare
  // symbol step `f` becomes `(f value)`. The seed is evaluated ONCE (threaded by value), not re-read.
  "->": (args, world) => threadForm(args, world, "first", null),
  // (->> seed …) — thread-last: insert as the LAST arg of each step.
  "->>": (args, world) => threadForm(args, world, "last", null),
  // (-?> seed …) — the four-valued maybe-thread: short-circuit (return ⊥) as soon as a step settles to ⊥
  // (no evidence). A ⊤ is HELD (threading continues carrying the contradiction), distinguishing 'absent'
  // (⊥, abort) from 'contradicted' (⊤, continue) — nil-punning cannot. Thread-first variant.
  "-?>": (args, world) => threadForm(args, world, "first", "maybe"),
  // (?. subj k…) — safe path/recall chaining: (recall subj k1) then treat that as a subject for k2, etc.
  // Each hop short-circuits to ⊥ if the cell is absent. The recall-chaining maybe-thread.
  "?.": (args, world) => safeRecallChain(args, world),

  // (let-values ((a b) (values 1 2)) body…) — destructure a (values …) charge positionally into locals,
  // then run the body. The bare caller of (values …) sees the first; let-values binds ALL (evidence-linear:
  // no witness dropped). Built on the values carrier + bindValue.
  "let-values": (args, world) => {
    const bindings = isCell(args[0]) ? args[0] : cell([]);
    const prior = world.scope;
    world.scope = gensymName(world, "letv");
    try {
      for (const b of bindings) {
        if (!isCell(b)) continue;
        const names = b[0];        // a cell of binder names
        const v = evaluate(b[1], world);
        const vs = (v.evidence[0][0] && Array.isArray(v.evidence[0][0].values)) ? v.evidence[0][0].values : [v];
        if (isCell(names)) names.forEach((n, i) => bindValue(n, vs[i] ?? BOT, world));
      }
      return progn(args.slice(1), world);
    } finally { world.scope = prior; }
  },

  // (try body… (catch pat handler…)) — the paraconsistent take on error handling. The body settles; its
  // charge is inspected. There is NO host exception path for a Horsetail-level "error" — an error is a ⊥
  // (no evidence / absent) or ⊤ (held contradiction) you can HOLD. (try …) runs the body; if it settles to
  // ⊥ or ⊤ and a (catch …) clause is present, the handler runs with the caught charge bound. A host JS
  // throw (a real fault) is also caught and surfaced as a ⊤ datum the handler may inspect.
  try: (args, world) => tryForm(args, world),

  // (raise charge?) — signal a paraconsistent "error": settle to ⊤ (a held contradiction) carrying the
  // given datum, so callers can (try …)/(match …) on it. Never a host throw — ⊤ is bindable.
  raise: (args, world) => {
    const payload = args[0] !== undefined ? evaluate(args[0], world) : TOP;
    return combine(payload, TOP);
  },

  // (require /name) — load a registered module (modules.mjs): settle its source into a sub-world scoped at
  // /name, then federate that sub-trace into this world (G-Set union; clashing exports settle to ⊤, never
  // last-write-wins). Returns the module subject's federated charge. The loader reads a REGISTERED in-memory
  // source map (disk stays the host's per the spec — posix-holography).
  require: (args, world) => requireModule(args, world),

  // (macroexpand-all form) — the honest "compile": fully expand a quoted form to its residual core-form
  // cell (homoiconic output), for inspection/caching. settle IS evaluation, so there is no target codegen.
  "macroexpand-all": (args, world) => {
    const form = dataToForm(evaluate(args[0], world).evidence[0][0]);
    const expanded = expandAll(form, world);
    return { value: [true, false], evidence: [[quoteData(expanded)], []] };
  },

  // (assert s p o) — append a positive predication; its charge is the affirmed cell after settling. ⊤ if
  // a converse already denied it (HELD, not an error).
  assert: (args, world) => {
    const [s, p, o] = args;
    const subj = pathOf(s, world), pred = datum(p, world), obj = datum(o, world);
    append(world, subj, pred, obj);
    return chargeForCell(settledOf(world, subj), pred, obj);
  },

  // (deny s p o) — append the CONVERSE predication (negative evidence is the converse, never a flag). We
  // register `not:pred` as a converse of `pred` so the fold charges the negative face of the SAME cell.
  deny: (args, world) => {
    const [s, p, o] = args;
    const subj = pathOf(s, world), pred = datum(p, world), obj = datum(o, world);
    const conv = "not:" + pred;
    world.converse[conv] = pred;
    append(world, subj, conv, obj);
    return chargeForCell(settledOf(world, subj), pred, obj);
  },

  // (define name expr) — APPEND-ONLY binding. We evaluate expr to a charge, then append a `defined-as`
  // row binding name -> the charge's FOUR name with the value's datum. Re-defining APPENDS another row
  // (counter-evidence), never overwrites: a name asserted twice with opposing values settles to ⊤.
  define: (args, world) => {
    const name = pathOf(args[0], world);
    const v = evaluate(args[1], world);
    // store the binding as a predication about the name: (name, bound-to, <datum>) charged by v.
    const bound = bindingDatum(args[1], v, world);
    if (isFalse(v)) { const conv = "not:bound-to"; world.converse[conv] = "bound-to"; append(world, name, conv, bound); }
    else append(world, name, "bound-to", bound);
    return chargeForCell(settledOf(world, name), "bound-to", bound);
  },

  // (recall name) / (recall s p) — the predicate-algebra read. (recall name) -> the binding charge of a
  // defined name. (recall s p) -> the believe-projection of subject s on predicate p.
  recall: (args, world) => {
    if (args.length === 1) {
      const name = pathOf(args[0], world);
      const folded = settledOf(world, name);
      // the latest binding cell's charge (any (name, bound-to, *) cell), knowledge-combined.
      const cells = folded.fiber.filter((c) => c.predicate === "bound-to");
      if (cells.length === 0) return BOT;
      return cells.map((c) => ({ value: [!!c.value.pos, !!c.value.neg], evidence: c.value.evidence }))
        .reduce((a, b) => combine(a, b));
    }
    const subj = pathOf(args[0], world), pred = datum(args[1], world);
    const folded = settledOf(world, subj);
    const cells = folded.fiber.filter((c) => c.predicate === pred);
    if (cells.length === 0) return BOT;
    return cells.map((c) => ({ value: [!!c.value.pos, !!c.value.neg], evidence: c.value.evidence }))
      .reduce((a, b) => combine(a, b));
  },

  // (query subject) — the belief read-out over a subject's settled cells:
  // {affirmed, denied, contradicted} by predicate. Carried as a data charge (its own evidence).
  query: (args, world) => {
    const subj = pathOf(args[0], world);
    const folded = settledOf(world, subj);
    const memory = foldedToMemory(folded, subj);
    const belief = believe(memory);
    // believe() is the edge RENDER (the finite shadow) — it DROPS the witness. Attach the CONE additively
    // (built once from the same folded fiber) so the witness survives as a coordinate a program can read.
    const { space } = sectionConeOf(world, subj, folded);
    return { value: [true, false], evidence: [[{ ...belief, space }], []] };
  },

  // (settle expr) — force the fixed point. Evaluating already settles; this makes it explicit and runs
  // the kernel's knowledge closure on the subject's section to prove the fixed point is reached.
  settle: (args, world) => {
    if (args.length === 1 && isSym(args[0])) {
      const subj = pathOf(args[0], world);
      const folded = settledOf(world, subj);
      // explicitly drive the kernel closure to a fixed point over this section (no clock — pure fold).
      kernelFixpoint(foldedToCategory(folded, subj));
      // the value: the knowledge-aggregate of all the subject's cells (the settled charge of the subject).
      const cs = folded.fiber.map((c) => ({ value: [!!c.value.pos, !!c.value.neg], evidence: c.value.evidence }));
      if (!cs.length) return BOT;
      const aggregate = cs.reduce((a, b) => combine(a, b));
      // Carry the CONE alongside the aggregate. The settle form used to throw the structure away and hand
      // back a flat scalar charge; now it ALSO exposes the settled fiber as a first-class Chu space the
      // caller can pass/read. The aggregate's VALUE bits (and so glyph/fourName) are UNCHANGED — only the
      // evidence payload gains { four, space } so a program reaches the cone via evidence[0][0].space.
      const { space } = sectionConeOf(world, subj, folded);
      return { value: aggregate.value, evidence: [[{ four: fourName(aggregate), space }], aggregate.evidence[1]] };
    }
    return evaluate(args[0], world);
  },

  // (section subj) — project {affirmed, denied, contradicted} (the substrate's section), now carrying the
  // CONE. The flat triple is an edge-only RENDER that DROPS which witness stands where; we build the Chu
  // space ONCE from the same folded fiber and attach it additively as `.space` so a program reads the
  // witness as a coordinate (chuRow / settleRow) instead of re-deriving it. Data charge: still isTrue, the
  // payload still has .affirmed/.denied/.contradicted (backward compatible) and now also .space.
  section: (args, world) => {
    const subj = pathOf(args[0], world);
    const folded = settledOf(world, subj);
    const sec = substrateSection(folded);
    const { space } = sectionConeOf(world, subj, folded);
    return { value: [true, false], evidence: [[{ ...sec, space }], []] };
  },

  // (relate p o) — the subjects standing in p to o. (relate-from s p) — the objects s stands in p to.
  relate: (args, world) => {
    const subjects = relate(world.trace, datum(args[0], world), datum(args[1], world));
    return { value: [true, false], evidence: [[subjects], []] };
  },
  "relate-from": (args, world) => {
    const objects = relateFrom(world.trace, pathOf(args[0], world), datum(args[1], world));
    return { value: [true, false], evidence: [[objects], []] };
  },

  // (defmacro name (params…) body) — register a cell transformer. Homoiconic: body is a cell, params are
  // symbol names substituted at expansion. Returns t (the macro is defined).
  defmacro: (args, world) => {
    const name = isSym(args[0]) ? args[0].name : String(args[0]);
    const params = (isCell(args[1]) ? args[1] : []).map((p) => (isSym(p) ? p.name : String(p)));
    world.macros.set(name, { params, body: args[2] });
    return T;
  },

  // the modal □/◇ as charges (RFC-2119 the bilattice already reads). must = necessitate (□), may =
  // possibilise (◇), should = the in-between (a possibilised necessity). Each runs ONE kernel modal step
  // on the evaluated charge's single-cell valuation, so `must`/`may` are the kernel generators, not ad hoc.
  must: (args, world) => modal(evaluate(args[0], world), "necessitate"),
  should: (args, world) => modal(modal(evaluate(args[0], world), "necessitate"), "possibilise"),
  may: (args, world) => modal(evaluate(args[0], world), "possibilise"),

  // the two and/or families, σ-dual. knowledge ⊗/⊕ and truth ∧/∨ (charges.mjs n-ary folds).
  "k-or": (args, world) => kOrAll(args.map((a) => evaluate(a, world))),
  "k-and": (args, world) => kAndAll(args.map((a) => evaluate(a, world))),
  or: (args, world) => tOrAll(args.map((a) => evaluate(a, world))),
  and: (args, world) => tAndAll(args.map((a) => evaluate(a, world))),
  not: (args, world) => negate(evaluate(args[0], world)),
  conflate: (args, world) => conflate(evaluate(args[0], world)),

  // (if x a b) — four-valued branch. t -> a, f -> b, ⊥ -> pending (⊥), ⊤ -> run BOTH arms and hold the
  // result contested (knowledge-join of both branches — the honest paraconsistent default).
  if: (args, world) => {
    const c = evaluate(args[0], world);
    if (isTrue(c)) return evaluate(args[1], world);
    if (isFalse(c)) return args[2] !== undefined ? evaluate(args[2], world) : BOT;
    if (isBottom(c)) return BOT; // pending
    // ⊤: both arms, held contested.
    const a = evaluate(args[1], world);
    const b = args[2] !== undefined ? evaluate(args[2], world) : BOT;
    return combine(combine(a, b), TOP);
  },

  // (boolean x) — the EXPLICIT truth-projection to t/f (collapse at the edge where you must act).
  boolean: (args, world) => (boolean(evaluate(args[0], world)) ? T : F),

  // (affirmed? x) — t iff x's POSITIVE bit is set (x is t OR ⊤): "there is evidence FOR". The four-valued
  // keep-test filter-hold uses to keep both the true and the held-contradictory (distinguishing them from
  // f/⊥). (denied? x) — t iff the NEGATIVE bit is set (f OR ⊤). (held? x) — t iff x is ⊤ exactly.
  "affirmed?": (args, world) => (present(evaluate(args[0], world))[0] ? T : F),
  "denied?": (args, world) => (present(evaluate(args[0], world))[1] ? T : F),
  "held?": (args, world) => (isTopValue(evaluate(args[0], world)) ? T : F),
  "pending?": (args, world) => (isBottom(evaluate(args[0], world)) ? T : F),

  // (at path body…) — scope: evaluate body with the `at` typed-path set. A symbol inside resolves under
  // it (lexical scope IS the path tree). Restores the prior scope after (dynamic extent).
  at: (args, world) => {
    const prior = world.scope;
    world.scope = pathOf(args[0], world);
    try { return progn(args.slice(1), world); } finally { world.scope = prior; }
  },

  // (as principal body…) — act as a principal. The capability gate (computer/principal `may`) is the hook;
  // ⊤-dispute is surfaced, never denied. We set world.principal for the extent and tag appended rows'
  // subjects with the actor so authority folds can read them.
  as: (args, world) => {
    const prior = world.principal;
    const principal = datum(args[0], world);
    world.principal = principal;
    try {
      const v = progn(args.slice(1), world);
      // surface the principal's authority as a co-charge: principal.may (governAction) over the trace.
      // The gate is NON-BLOCKING (the spec: ⊤-dispute surfaced, NOT denied). A clean authority (t may, f
      // may-not, ⊥ no basis) leaves the body value as-is — the verdict is informational, read separately
      // via principal.may. Only a CONTESTED authority (⊤ — recognized AND withheld) knowledge-combines
      // onto the value, lifting the result to ⊤ so the dispute is held, never silently dropped. Degrades
      // to identity if the identity tool's surface is unavailable.
      const auth = authorityCharge(world, principal);
      return auth && isTopValue(auth) ? combine(v, auth) : v;
    } finally { world.principal = prior; }
  },

  // (federate other body…) — tensor-merge this world's trace with another's (computer/distribution). The
  // `other` is a quoted program: we settle it into its own world, then G-Set union the traces; a
  // disagreement settles to ⊤. Returns the federated charge of the named subject if given, else t.
  federate: (args, world) => {
    const otherForms = isCell(args[0]) ? args[0] : cell([args[0]]);
    const otherWorld = makeWorld({ converse: world.converse, scope: world.scope });
    for (const f of otherForms) evaluate(f, otherWorld);
    const w = federate(worldToFederation(world), worldToFederation(otherWorld));
    // merge the converse maps (a denied cell in EITHER world is the converse of its positive) so the
    // re-fold reads both faces; then adopt the federated rows back (append-only union).
    Object.assign(world.converse, otherWorld.converse);
    const merged = federationRows(w);
    world.trace = merged;
    if (args[1] && isSym(args[1])) {
      const subj = pathOf(args[1], world);
      return chargeFromSection(sectionOf(w, subj, { converse: world.converse }));
    }
    return T;
  },

  // (module /name body…) — REGISTER a module's body forms (UNEVALUATED) under /name in the in-memory source
  // map, so (require /name) can later settle+federate them. A module is a SUBTREE of the path trace; the
  // body forms are stored verbatim (homoiconic). Returns t.
  module: (args, world) => {
    const name = pathOf(args[0], world);
    registerModule(world, name, args.slice(1));
    return T;
  },
};

// ── host primitives (arith / strings / seq): EAGER-eval args, compute, wrap as a charge ────────────
// The factories take the charge surface they need (value reader, four reader, the four points, affirm,
// isCharge) so the primitive files import nothing from this module (no cycle). We register each as a
// SPECIAL handler that eager-evaluates its arg forms to charges, then delegates. These are computer-layer
// host ops (not math); registering them into SPECIAL keeps them at the language edge.
const affirm = (datum) => ({ value: [true, false], evidence: [[datum], []] });
const primSurface = { valueDatum: chargeValueDatum, fourName, T, F, TOP, BOT, affirm, isCharge };
for (const table of [makeArith(primSurface), makeStrings(primSurface), makeSeq(primSurface)]) {
  for (const [name, fn] of Object.entries(table)) {
    SPECIAL[name] = (args, world) => fn(args.map((a) => evaluate(a, world)));
  }
}

// pathOf(form, world) — a symbol/string used as a SUBJECT resolves to its typed-path under scope.
function pathOf(form, world) {
  if (isSym(form)) return resolvePath(world, form.name);
  if (typeof form === "string") return resolvePath(world, form);
  if (isChargeLit(form)) return form.four;
  return String(datum(form, world));
}

// bindingDatum — the OBJECT a (name, bound-to, …) row stores: the EVALUATED value's datum (so a fn binds
// its {fn:id}, a seq its {seq:…}, a computed number its number — recallDatum reads the VALUE back, and
// bare-symbol resolution + fn-application dispatch find the closure). For a plain literal/symbol the
// evaluated datum equals the expression's datum, so re-defining the SAME value stays one G-Set row; a
// DIFFERENT value is a second row the fold reads as competing evidence (append-only ⊤). A Sym datum is
// normalized to its name (matching how datum() stores it).
function bindingDatum(expr, charge, world) {
  let is = chargeValueDatum(charge);
  if (isSym(is)) is = is.name;
  // a pure FOUR-point charge (no carried datum) keeps the expression's datum so the printed binding is
  // legible (e.g. (define x t) stores is:"t"), matching the original behavior.
  if (is === fourName(charge) && !isCell(expr) && (isChargeLit(expr) || isSym(expr))) is = datum(expr, world);
  return { is, as: fourName(charge) };
}

// authorityCharge(world, principal) — the FOUR-valued authority of `principal` to `act`, read off the
// trace by computer/principal's `may` (governAction). Returns the kernel charge for that FOUR, or null
// if the read is unavailable (then `as` is identity — the hook is present but degrades gracefully). The
// action defaults to "act"; a recognition-graph in the trace can lift it to ⊤ (contested), surfaced.
function authorityCharge(world, principal) {
  try {
    const verdict = principalMay(world.trace, principal, "act");
    if (!verdict || verdict.four === undefined) return null;
    return toCharge(asFour(verdict.four));
  } catch { return null; } // tool surface changed / no basis — degrade to identity, never throw
}

// ── modal □/◇ via the kernel generators (one step over a one-cell valuation) ─────────────────────
function modal(charge, dir) {
  const valuation = { base: {}, "fiber-algebras": [{ assignments: [{ cell: { subject: { const: "_" }, predicate: { const: "_" }, object: { const: "_" } }, charge }] }] };
  const stepped = dir === "necessitate" ? necessitateKnowledge({ traces: [{ valuations: [valuation] }] })
                                        : possibilizeKnowledge({ traces: [{ valuations: [valuation] }] });
  const last = lastValuation(stepped);
  return last["fiber-algebras"][0].assignments[0].charge;
}

// kernelFixpoint(category) — run the kernel's knowledge closure to its fixed point over a section. This
// is the PROOF the settler reaches a Knaster–Tarski fixed point with no clock: iterate □_k then ◇_k until
// the valuation stops changing. Returns the fixed-point valuation.
function kernelFixpoint(category) {
  let cur = category, prev;
  const S = (c) => JSON.stringify(lastValuation(c));
  do { prev = cur; cur = possibilizeKnowledge(necessitateKnowledge(cur)); } while (S(cur) !== S(prev));
  return lastValuation(cur);
}

// foldedToCategory — adapt a substrate-folded fiber into the kernel's trace/valuation shape so the
// kernel closure can run on it (one fiber-algebra of single-cell assignments).
function foldedToCategory(folded, subject) {
  const assignments = folded.fiber.map((c) => ({
    cell: { subject: { const: subject }, predicate: { const: c.predicate }, object: { const: c.object } },
    charge: { value: [!!c.value.pos, !!c.value.neg], evidence: c.value.evidence },
  }));
  const valuation = { base: {}, "fiber-algebras": [{ assignments }] };
  return { traces: [{ valuations: [valuation] }] };
}

// foldedToMemory — adapt a substrate-folded fiber into the believe read-out's "memory" shape
// (a settled section { entity-set, assignments:[{cell, charge}] } with {const} schema docs).
function foldedToMemory(folded, subject) {
  const asDoc = (v) => (v !== null && typeof v === "object" && !Array.isArray(v)) || typeof v === "boolean" ? v : { const: v };
  const assignments = folded.fiber.map((c) => ({
    cell: { subject: asDoc(subject), predicate: asDoc(c.predicate), object: asDoc(c.object) },
    charge: { value: [!!c.value.pos, !!c.value.neg], evidence: c.value.evidence },
  }));
  return { "entity-set": { entities: [subject] }, assignments };
}

// sectionConeOf(world, subject, folded) — lift the subject's ALREADY-folded fiber into the language CONE:
// an explicit Chu space (math/chu) over FOUR, built ONCE via the substrate's sectionSpace from the SAME
// folded fiber settledOf produced (no re-fold). The POINTS are the folded cells (keyed jcs([predicate,
// object])); the STATES are the witnessing coordinate stateOf(row) — in horsetail's append-only trace `t`
// is a witness STAMP (a string, rowId-ordered), so stateOf falls back to r.t and each distinct row is its
// own state (the open-world EAVT default). The value at (cell, state) is the FOUR face that state
// witnesses: t a positive predication, f the converse (deny, folded via world.converse), ⊤ both (a HELD
// contradiction, e.g. assert+deny on one cell), ⊥ the open-world absent. This is the SAME structure
// section()/believe() FLATTEN to {affirmed,denied,contradicted} — but the cone keeps the witness as a
// COORDINATE a program can read (chuRow / settleRow), instead of dropping which witness stands where.
function sectionConeOf(world, subject, folded) {
  return sectionSpace(folded, world.trace, {});
}

// quasi — quasiquote expansion: walk the cell, evaluate (unquote x) holes to their datum, splice
// (unquote-splice x) lists, leave everything else as code.
function quasi(form, world) {
  if (!isCell(form)) return form;
  if (head(form) === "unquote") {
    const v = evaluate(form[1], world);
    return chargeToForm(v);
  }
  const out = [];
  for (const item of form) {
    if (isCell(item) && head(item) === "unquote-splice") {
      const v = evaluate(item[1], world);
      const data = v.evidence[0][0];
      if (Array.isArray(data)) out.push(...data.map(dataToForm));
      else out.push(chargeToForm(v));
    } else out.push(quasi(item, world));
  }
  return cell(out);
}

// chargeToForm — turn an evaluated charge back into a read form for splicing into quasiquoted code: a
// charge whose evidence holds a single datum re-forms that datum; otherwise the FOUR-name charge literal.
function chargeToForm(charge) {
  const pos = charge.evidence[0];
  if (pos.length === 1) return dataToForm(pos[0]);
  return sym(fourName(charge));
}
function dataToForm(d) {
  if (d && typeof d === "object" && "cell" in d) return cell(d.cell.map(dataToForm));
  if (d && typeof d === "object" && "sym" in d) return sym(d.sym);
  if (d && typeof d === "object" && "charge" in d) return { four: d.charge, toString() { return d.charge; } };
  return d;
}

// ── federation adapters (computer/distribution shapes a world as subject -> log) ─────────────────
function worldToFederation(world) {
  const w = {};
  for (const r of world.trace) (w[r.e] ??= []).push(r);
  return w;
}
function federationRows(w) {
  const rows = [];
  for (const subject of Object.keys(w)) for (const r of w[subject]) rows.push(r);
  return rows;
}
function chargeFromSection(sec) {
  // a section {affirmed,denied,contradicted}: ⊤ if any contradicted, t if any affirmed, f if denied.
  if (sec.contradicted && sec.contradicted.length) return TOP;
  if (sec.affirmed && sec.affirmed.length) return T;
  if (sec.denied && sec.denied.length) return F;
  return BOT;
}

// ── the public surface ───────────────────────────────────────────────────────────────────────────
// evaluateAll(forms, world) -> the LAST charge after appending+settling each form (a program is a trace).
export function evaluateAll(forms, world) {
  let v = BOT;
  for (const f of forms) v = evaluate(f, world);
  return v;
}

export { glyph, fourName, present, isTrue, isFalse, isBottom, isTopValue, boolean, write };
export { T, F, BOT, TOP };
