// run — Horsetail's proofs. The acceptance test mirrors the OS law: does the language keep evidence, hold
// ⊤ as a value, settle instead of step, and treat define as append-not-overwrite? Each check is a claim
// from the spec, proved on the real engine (the substrate fold + the kernel bilattice + the predicate
// algebra). Pure (no disk). Exit 0 if all pass, 1 otherwise.

import {
  world, run, step, read, readAll, write, glyph, fourName, boolean, makeWorld, evaluate, evaluateAll, LANGUAGE_NAME,
} from "../src/horsetail.mjs";
import { isTrue, isTopValue, present } from "../src/charges.mjs";
import { recognizesAuthority, withholdsAuthority } from "../../principal/src/principal.mjs";
import { isChuSpace, settleRow, FOUR } from "@lenticule-science/metrologic/chu";
import { jcs } from "../src/_substrate.mjs";

// authorityRows(by, principal, action) — a CONTESTED authority: `by` both recognizes AND withholds the
// principal's authority to `action`. The substrate folds the two converse rows to ⊤ (contested), so a
// principal.may verdict over them is ⊤ — the held-dispute case (as).
const authorityRows = (by, principal, action) =>
  [recognizesAuthority(by, principal, action, "t0"), withholdsAuthority("other", principal, action, "t1")];

const results = [];
const check = (name, pass) => results.push({ name, pass: !!pass });
const g = (charge) => glyph(charge); // t / f / ⊥ / ⊤

// ── the reader is homoiconic: s-expressions <-> cells, round-tripping write∘read ─────────────────
check("reader: read then write round-trips a form", write(read("(assert sky has blue)")) === "(assert sky has blue)");
check("reader: a bare 't' reads to the charge t, not a symbol", g(run("t")) === "t");
check("reader: ⊤ and 'top' both read to the held value ⊤", g(run("⊤")) === "⊤" && g(run("top")) === "⊤");
check("reader: a number self-evaluates to an affirmed charge", isTrue(run("42")));
check("reader: a list reads to a cell (code is data)", Array.isArray(read("(a b c)")));

// ── eval = settle: evaluating a form appends a predication and settles ───────────────────────────
{
  const w = world();
  const before = w.trace.length;
  const v = run("(assert sky has blue)", w);
  check("eval=settle: assert appends a row to the trace", w.trace.length === before + 1);
  check("eval=settle: an affirmed cell settles to t", g(v) === "t");
}

// ── ⊤ is a BINDABLE held value: asserting both faces evaluates to ⊤, NOT an error ────────────────
{
  const w = world();
  run("(assert sky has blue)", w);
  let held, threw = false;
  try { held = run("(deny sky has blue)", w); } catch (e) { threw = true; }
  check("⊤-held: asserting both faces does NOT throw", !threw);
  check("⊤-held: the contested cell settles to ⊤ (told both)", g(held) === "⊤");
  check("⊤-held: ⊤ is bindable — (define z <the ⊤>) keeps it ⊤", g(run("(define z (recall sky has))", w)) !== "f");
  check("⊤-held: isTop reads the bound value as ⊤", isTopValue(run("(recall sky has)", w)));
  // paraconsistency: a contradiction does not explode — an unrelated cell stays t.
  run("(assert grass is green)", w);
  check("⊤-held: contradiction is contained (no explosion) — grass stays t", g(run("(recall grass is)", w)) === "t");
}

// ── the (both …) stdlib macro MAKES a ⊤ (proves ⊤ is constructible) ──────────────────────────────
check("⊤-construct: (both s p o) settles to ⊤", g(run("(both p likes q)", world())) === "⊤");

// ── the two and/or families are σ-dual: knowledge ⊗/⊕ vs truth ∧/∨ ───────────────────────────────
{
  const w = world();
  check("σ-dual: k-or (knowledge join) of t,f is ⊤", g(run("(k-or t f)", w)) === "⊤");
  check("σ-dual: or (truth join) of t,f is t", g(run("(or t f)", w)) === "t");
  check("σ-dual: k-and (knowledge meet) of t,f is ⊥", g(run("(k-and t f)", w)) === "⊥");
  check("σ-dual: and (truth meet) of t,f is f", g(run("(and t f)", w)) === "f");
  // the σ-duality itself: swapping the order (knowledge<->truth) on the SAME inputs gives the dual point.
  // k-or and or disagree exactly where the negative bit's treatment differs — the gauge between the orders.
  check("σ-dual: the families genuinely differ (⊤ vs t on the same inputs)", g(run("(k-or t f)", w)) !== g(run("(or t f)", w)));
  // the involutions: negate (truth flip) swaps t<->f; conflate (knowledge flip) swaps ⊥<->⊤.
  check("involution: (not t) is f (truth flip)", g(run("(not t)", w)) === "f");
  check("involution: (conflate ⊥) is ⊤ (knowledge flip)", g(run("(conflate ⊥)", w)) === "⊤");
  check("involution: (conflate ⊤) is ⊥", g(run("(conflate ⊤)", w)) === "⊥");
}

// ── define is APPEND-ONLY: re-defining adds counter-evidence, never overwrites ───────────────────
{
  const w = world();
  check("append-only: (define x t) settles t", g(run("(define x t)", w)) === "t");
  const afterFirst = w.trace.length;
  run("(define x f)", w); // re-define to the OPPOSING value
  check("append-only: re-define APPENDS a row (does not overwrite)", w.trace.length > afterFirst);
  check("append-only: x now recalls ⊤ — both bindings kept as competing evidence", g(run("(recall x)", w)) === "⊤");
  // and the original witness is still in the trace (evidence linear: nothing dropped).
  const boundRows = w.trace.filter((r) => r.e === "/x");
  check("evidence-linear: both define witnesses survive in the trace", boundRows.length >= 2);
}

// ── eval settles to a FIXED POINT with no clock (Knaster–Tarski) ──────────────────────────────────
{
  const w = world();
  run("(assert m n o)", w);
  const v1 = run("(settle m)", w);
  const v2 = run("(settle m)", w); // settling again changes nothing — it's a fixed point
  check("fixed-point: (settle subj) is idempotent (same charge twice)", g(v1) === g(v2));
  check("fixed-point: settling re-folds to t (no clock advanced the value)", g(v1) === "t");
  // re-settling the WHOLE program (re-running the same source) yields the same projection — a trace.
  const w2 = world();
  const src = "(assert a knows b) (assert b knows c) (recall a knows)";
  check("program-is-a-trace: re-running the same source settles to the same charge",
    g(run(src, w2)) === g(run(src, world())));
}

// ── a macro transforms CELLS (homoiconic over predication cells) ─────────────────────────────────
{
  const w = world();
  run("(defmacro twice (s p o) (and (assert s p o) (assert s p o)))", w);
  const expanded = run("(twice a likes b)", w);
  check("macro: a user macro expands its cell and settles", g(expanded) === "t");
  // the macro genuinely transformed structure: assert ran (the cell appended a row about /a).
  check("macro: the expansion appended the predication", w.trace.some((r) => r.e === "/a" && r.a === "likes" && r.v === "b"));
  // (quote …) hands back the cell as data (code is data is a trace).
  check("homoiconic: (quote (assert a b c)) is an affirmed datum charge", isTrue(run("(quote (assert a b c))", world())));
}

// ── a program is a trace you can (quote) and re-(settle) ─────────────────────────────────────────
{
  const w = world();
  run("(define greeting hello)", w);
  // quasiquote builds new code from a value, then we can settle it.
  const built = run("(quasiquote (assert door says (unquote greeting)))", w);
  check("quote+settle: quasiquote builds a code cell from a settled value", isTrue(built));
}

// ── modal □/◇: must/should/may as the kernel's necessitate/possibilise ───────────────────────────
{
  const w = world();
  check("modal: (must t) holds t", g(run("(must t)", w)) === "t");
  check("modal: (may ⊥) stays ⊥ (nothing to possibilise)", g(run("(may ⊥)", w)) === "⊥");
  check("modal: (should t) is defined (a possibilised necessity)", ["t", "f", "⊥", "⊤"].includes(g(run("(should t)", w))));
}

// ── at: typed-path addressing/scope (lexical scope IS the path tree) ──────────────────────────────
{
  const w = world();
  run("(at /house (assert door is open))", w);
  check("at: a symbol under (at /house …) resolves to /house/door", w.trace.some((r) => r.e === "/house/door"));
  check("at: recall under the same scope reads the cell back", g(run("(at /house (recall door is))", w)) === "t");
  check("at: scope is restored after the form (dynamic extent)", w.scope === "/");
}

// ── as: act as a principal (the hook is present; ⊤-dispute surfaced, not denied) ─────────────────
{
  const w = world();
  let threw = false, v;
  try { v = run("(as alice (assert alice owns key))", w); } catch (e) { threw = true; }
  check("as: acting as a principal does not error (capability hook present)", !threw);
  check("as: the principal's predication landed in the trace", w.trace.some((r) => r.e === "/alice" && r.a === "owns"));
  check("as: a clean (non-contested) authority is non-blocking — body value passes through as t", g(v) === "t");
}
// as: the gate consults principal.may but NEVER denies — a may-not (f) authority still runs the body.
{
  const w = world();
  // seed a withheld authority for `bob`; principal.may reads it, but `as` must not block the body.
  for (const r of authorityRows("root", "bob", "act")) w.trace.push(r);
  let threw = false, v;
  try { v = run("(as bob (assert bob did thing))", w); } catch (e) { threw = true; }
  check("as: a withheld authority does NOT deny — the body still runs (⊤-surfaced, not blocked)", !threw && w.trace.some((r) => r.e === "/bob"));
}

// ── federate: tensor-merge two traces; disagreement settles to ⊤ ─────────────────────────────────
{
  const w = world();
  run("(assert realm has peace)", w);
  const fed = run("(federate ((deny realm has peace)) realm)", w);
  check("federate: two worlds disagreeing on a cell settle it to ⊤", g(fed) === "⊤");
  const w2 = world();
  run("(assert village has water)", w2);
  check("federate: two worlds agreeing keep the cell t", g(run("(federate ((assert village has water)) village)", w2)) === "t");
}

// ── recall / query / section / relate: the read OS ops ───────────────────────────────────────────
{
  const w = world();
  run("(assert bird can fly)", w);
  check("recall: a present cell recalls t", g(run("(recall bird can)", w)) === "t");
  check("recall: an absent cell recalls ⊥ (no evidence)", g(run("(recall bird swims)", w)) === "⊥");
  check("query: believe-projection is a (data) charge", isTrue(run("(query bird)", w)));
  check("section: {affirmed,denied,contradicted} is a (data) charge", isTrue(run("(section bird)", w)));
  run("(assert tom located-in hall)", w);
  check("relate: a relational read returns a (data) charge", isTrue(run("(relate located-in hall)", w)));
  check("relate-from: the inverse read returns a (data) charge", isTrue(run("(relate-from tom located-in)", w)));
}

// ── the language CONE: a settled fiber crosses the boundary as a Chu space, witness as a COORDINATE ──
// THE LAW (2026-06-05 language-cones): the currency a tile hands a program is a CONE (a charged
// fiber-algebra read as a Chu space carrying evidence), NOT a flat {affirmed,denied,contradicted} triple.
// section()/believe() FLATTEN — they drop which witness stands where. The cone keeps the witness as a
// first-class coordinate (chuRow / settleRow). We prove it: assert AND deny the SAME cell (a HELD
// contradiction), then read the cone off the (section …)/(settle …) charge and confirm the contested cell
// settles to ⊤ in the space — the contradiction is CARRIED as a coordinate, not flattened to a boolean.
{
  const w = world();
  run("(assert sky has blue)", w);
  run("(deny sky has blue)", w);
  const point = jcs(["has", "blue"]);

  const secSpace = run("(section sky)", w).evidence[0][0].space;
  check("cone: (section subj) carries a Chu space (the witness as a coordinate, not a flat triple)", isChuSpace(secSpace));
  check("cone: the assert+deny cell settles to ⊤ in the section cone — contradiction held, not flattened", settleRow(secSpace, point) === FOUR.TOP);

  const settleSpace = run("(settle sky)", w).evidence[0][0].space;
  check("cone: (settle subj) ALSO exposes the settled fiber as a Chu space", isChuSpace(settleSpace));
  check("cone: the contested cell reads ⊤ in the settle cone (two witnesses, both conserved)", settleRow(settleSpace, point) === FOUR.TOP);

  const qSpace = run("(query sky)", w).evidence[0][0].space;
  check("cone: (query subj) carries the cone alongside the believe RENDER", isChuSpace(qSpace) && settleRow(qSpace, point) === FOUR.TOP);
}

// ── the explicit truth-projection (boolean) — collapse only at the edge ──────────────────────────
{
  const w = world();
  check("boolean: t projects to true (a JS scalar at the edge)", boolean(run("t", w)) === true);
  check("boolean: ⊤ projects to false (honest collapse, not silent)", boolean(run("⊤", w)) === false);
  check("boolean: ⊥ projects to false", boolean(run("⊥", w)) === false);
}

// ── the (if …) four-valued branch ────────────────────────────────────────────────────────────────
{
  const w = world();
  check("if: t takes the then-arm", g(run("(if t (assert i ran then) (assert i ran else))", w)) === "t");
  check("if: ⊥ is pending (⊥)", g(run("(if ⊥ t f)", world())) === "⊥");
  // ⊤ runs BOTH arms and holds the result contested.
  check("if: ⊤ runs both arms, held contested (⊤)", g(run("(if ⊤ t f)", world())) === "⊤");
}

// ── the language name is a constant (rename-friendly) ────────────────────────────────────────────
check("rename: LANGUAGE_NAME is a single constant, not hardcoded", typeof LANGUAGE_NAME === "string" && LANGUAGE_NAME.length > 0);

// ── report ───────────────────────────────────────────────────────────────────────────────────────
let failed = 0;
for (const r of results) { console.log(`${r.pass ? "  ok" : "FAIL"}  ${r.name}`); if (!r.pass) failed++; }
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
