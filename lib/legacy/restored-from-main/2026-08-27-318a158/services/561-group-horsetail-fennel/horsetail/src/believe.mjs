// believe — Horsetail's belief read-out of a settled memory, used by (query …) and (recall s p).
// Absorbed from the retired predicate-algebra-parser tile: that tile's only live consumer was this
// language, which used exactly its `believe` (and the `negate` rule `believe` runs first). Both are
// thin aliases over @lenticule-science/metrologic/bilattice — `believe` is a projection of the kernel's `compare`
// split, `negate` lifts the kernel's `negate`/`joinKnowledge` from charges to memories — so they live
// here, against the math directly, rather than in a tile of their own.
//
// believe(memory) projects a settled section to { affirmed, denied, contradicted }, reporting each
// cell by its OBJECT (the value lives in the coordinate):
//   affirmed     — believed-true cells (t):   predicate -> object
//   denied       — believed-false cells (f):  predicate -> object   (a belief STATE, never a retraction)
//   contradicted — ⊤ cells (told both):       predicate -> object   (the contested proposition)
// ⊥ (unknown) cells carry no witness and are omitted. This is a projection — the finite shadow of the
// cells — not the memory's value.
import { compare, negate as kernelNegate, joinKnowledge } from "@lenticule-science/metrologic/bilattice";

const S = (x) => JSON.stringify(x);
// objects are { const: v } for scalars but raw for booleans/objects — read the value either way.
const value = (o) => (o !== null && typeof o === "object" && "const" in o ? o.const : o);
const asSchemaDoc = (v) =>
  (v !== null && typeof v === "object" && !Array.isArray(v)) || typeof v === "boolean" ? v : { const: v };
const isNegation = (o) =>
  o !== null && typeof o === "object" && !Array.isArray(o) && "not" in o && Object.keys(o).length === 1;

// negate(memory) -> memory with every { not: X } cell resolved as negative evidence on its base cell
// (subject, predicate, X): the kernel's `negate` swaps a charge's slots, turning an affirmation of the
// negation into negative evidence, knowledge-joined onto whatever the base cell already holds. So
// affirm-(s,p,X) and affirm-not-(s,p,X) climb to ⊤ — a live, contained contradiction.
function negate(memory) {
  const cells = memory.assignments ?? [];
  const byCell = new Map();
  for (const { cell, charge } of cells) {        // index the base (non-negation) cells first
    if (isNegation(cell.object)) continue;
    byCell.set(S([cell.subject, cell.predicate, cell.object]), { cell, charge });
  }
  for (const { cell, charge } of cells) {        // fold each negation cell as negated evidence on its base
    if (!isNegation(cell.object)) continue;
    const object = asSchemaDoc(cell.object.not);
    const key = S([cell.subject, cell.predicate, object]);
    const negated = kernelNegate(charge);        // affirmation of the negation → negative evidence on base
    if (byCell.has(key)) byCell.get(key).charge = joinKnowledge({ left: byCell.get(key).charge, right: negated });
    else byCell.set(key, { cell: { subject: cell.subject, predicate: cell.predicate, object }, charge: negated });
  }
  return { "entity-set": memory["entity-set"], assignments: [...byCell.values()] };
}

// believe(memory) -> { affirmed, denied, contradicted }, where memory is a settled section.
export default function believe(memory) {
  const resolved = negate(memory); // apply the negation rule before reading belief
  const out = { affirmed: {}, denied: {}, contradicted: {} };
  const { consistent, paraconsistent } = compare({ "fiber-algebras": [{ assignments: resolved.assignments }] });

  for (const a of paraconsistent["fiber-algebras"][0].assignments) {   // ⊤ — the inconsistency locus
    out.contradicted[a.cell.predicate.const] = value(a.cell.object);
  }
  for (const a of consistent["fiber-algebras"][0].assignments) {       // ⊥ / t / f
    const key = a.cell.predicate.const;
    if (a.charge.evidence[0].length === 1) out.affirmed[key] = value(a.cell.object);
    else if (a.charge.evidence[1].length === 1) out.denied[key] = value(a.cell.object);
    // else ⊥: unknown — omit
  }
  return out;
}
