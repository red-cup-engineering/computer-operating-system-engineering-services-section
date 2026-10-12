// Horsetail — the computer's native programming language: a paraconsistent settling Lisp. The barrel.
//
// THE ONE INVERSION (the spec): a normal Lisp is homoiconic over cons cells and `eval` is a function
// call. Horsetail is homoiconic over PREDICATION cells, and `eval` is `settle`. Evaluating a form appends
// predications to the trace and settles it to a Knaster–Tarski fixed point; the "value" is the projected
// settled charge, collapsed to a scalar only at the edge where you must act. The program is a trace;
// running it is folding it. There is no clock — evaluation is aperiodic settling, not stepping.
//
// THE LAW: paraconsistent (⊤ is a bindable HELD value, never an error), append-only (eval settles the
// trace; define adds counter-evidence, never overwrites), evidence linear (no dropped witnesses),
// identity via jcs/rowId, math never imports computer. Pure over the substrate — bytes are the host's.
//
// It is an OS tool: it lives in computer/ (the kernel ships the language). The settling shell
// (apps/interface/shell) is its REPL — read → settle → project → loop — and hosts these special forms
// as its built-in verbs. The name "Horsetail" is provisional; LANGUAGE_NAME holds it (rename-friendly).

import { readAll, read, write } from "./reader.mjs";
import { evaluate, evaluateAll, makeWorld, LANGUAGE_NAME, glyph, fourName } from "./evaluator.mjs";
import { STDLIB, STDLIB_FNS } from "./stdlib.mjs";

export { read, readAll, write } from "./reader.mjs";
export { evaluate, evaluateAll, makeWorld, LANGUAGE_NAME } from "./evaluator.mjs";
export { glyph, fourName, boolean, isTrue, isFalse, isBottom, isTopValue, present } from "./charges.mjs";
export { T, F, BOT, TOP } from "./charges.mjs";

// world() — a fresh world with the stdlib loaded (the prelude is itself Horsetail: forms settled into the
// trace + macros defined). A program then runs against this.
export function world(init = {}) {
  const w = makeWorld(init);
  evaluateAll(readAll(STDLIB), w);      // macros (control flow, collection-as-trace, modules surface)
  evaluateAll(readAll(STDLIB_FNS), w);  // fn definitions (map/reduce/filter/fold/range/… — first-class)
  return w;
}

// run(source, w?) — read every top-level form, settle each into the world, return the LAST form's charge
// (a program is a trace you can re-run). Loads the stdlib if no world is given.
export function run(source, w = world()) {
  return evaluateAll(readAll(source), w);
}

// repl(world) — the read → settle → project → loop step (the shell drives this). Given a source line, it
// settles it into the world and returns { charge, glyph, world } — the projected view the shell renders.
export function step(source, w) {
  const charge = evaluateAll(readAll(source), w);
  return { charge, glyph: glyph(charge), four: fourName(charge), world: w };
}

// the default export: the language object (constant-named so a rename touches one place).
export default { [LANGUAGE_NAME]: { read, readAll, write, evaluate, evaluateAll, makeWorld, world, run, step, LANGUAGE_NAME } };
