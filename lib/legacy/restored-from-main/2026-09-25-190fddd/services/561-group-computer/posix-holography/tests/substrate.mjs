// substrate — the substrate test suite: the GENERAL eavt trace algebra (read->fold->settle spine, the
// functional read-lens, the relational graph read, the section projection, the reified-row helpers).
// Pure (no disk): exercises the fold over in-memory {e,a,v,t} traces. Exit 0 if all pass, 1 otherwise.
import { readFileSync } from "node:fs";
import { rowId, assertRow, dedupe, canonicalJson as jcs, reify, isReified, REIFIED_PREFIX, supersede, relate, relateFrom, fold, settle, section, sectionSpace, foldIndependentEvidence } from "../src/substrate.mjs";
import { independentEvidenceRow } from "@lenticule-science/metrologic/articulation/predicating/positing/independent-evidence";
import { valueOf } from "@lenticule-science/metrologic/articulation/predicating/positing/bilattice-charge";
import { row as chuRow, settleRow } from "@red-cup-engineering/computer-code-engineering-services-section/signchain/chu";

const results = [];
const check = (name, pass) => results.push({ name, pass: !!pass });
const cellOf = (folded, predicate, object) =>
  folded.fiber.find((c) => c.predicate === predicate && jcs(c.object) === jcs(object));
const glyph = (v) => `${v.pos}${v.neg}`; // 10 t, 01 f, 11 ⊤, 00 ⊥

// --- re-exported canonical row algebra (single source) ---
check("re-exports the canonical rowId/assertRow/dedupe/jcs", [rowId, assertRow, dedupe, jcs].every((f) => typeof f === "function"));
check("jcs is canonical (key order independent)", jcs({ b: 1, a: 2 }) === jcs({ a: 2, b: 1 }));

// --- reified-row identity ---
const base = { e: "x", a: "color", v: "blue", t: "t0" };
check("reify prefixes a content-address", reify(base).startsWith(REIFIED_PREFIX));
check("isReified recognises a reified subject", isReified(reify(base)) && !isReified("x"));

// --- the functional read-lens (latest-t projection, non-destructive) ---
const locs = [
  { e: "p", a: "located-in", v: "hall", t: "t0" },
  { e: "p", a: "located-in", v: "yard", t: "t2" }, // latest functional
  { e: "p", a: "skill", v: "swim", t: "t1" },       // non-functional accrues
  { e: "p", a: "skill", v: "climb", t: "t3" },
];
const fnSet = new Set(["located-in"]);
const lensed = supersede(locs, fnSet);
check("supersede keeps only latest-t for a functional predicate", lensed.filter((r) => r.a === "located-in").length === 1);
check("supersede keeps the max-t functional row", lensed.find((r) => r.a === "located-in").v === "yard");
check("supersede keeps ALL non-functional rows (they accrue)", lensed.filter((r) => r.a === "skill").length === 2);
check("supersede is non-destructive: input trace untouched", locs.length === 4);
check("supersede accepts a predicate fn too", supersede(locs, (a) => a === "located-in").filter((r) => r.a === "located-in").length === 1);
check("supersede with no functional set is identity (mod reified)", supersede(locs).length === 4);

// --- the general relational graph read ---
const world = [
  { e: "p", a: "located-in", v: "hall", t: "t0" },
  { e: "q", a: "located-in", v: "hall", t: "t1" },
  { e: "p", a: "located-in", v: "yard", t: "t2" },
];
check("relate reads the subjects standing in P to O (who is located-in hall)", jcs(relate(world, "located-in", "hall")) === jcs(["p", "q"]));
check("relateFrom reads the objects subject stands in P to (p's locations)", jcs(relateFrom(world, "p", "located-in")) === jcs(["hall", "yard"]));
check("relate excludes reified rows", relate([{ e: reify(base), a: "located-in", v: "hall", t: "t9" }], "located-in", "hall").length === 0);

// --- the fold (read->settle without the lens): contradiction is a held value ---
const folded = fold("c", [
  { e: "c", a: "open", v: "door", t: "t0" },
  { e: "c", a: "open", v: "door", t: "t1" }, // re-affirm: still t, evidence accrues
  { e: "c", a: "size", v: 3, t: "t2" },
]);
check("fold yields one cell per distinct (predicate,object)", folded.fiber.length === 2);
check("a re-affirmed cell is t (10) with both witnesses kept", glyph(cellOf(folded, "open", "door").value) === "10" && cellOf(folded, "open", "door").value.evidence[0].length === 2);
check("fold output is deeply frozen", Object.isFrozen(folded) && Object.isFrozen(folded.fiber));

// --- converse => negative face; both => ⊤ (told both, a held value) ---
const contested = fold("c", [
  { e: "c", a: "open", v: "door", t: "t0" },
  { e: "c", a: "shut", v: "door", t: "t1" },
], { converse: { shut: "open" } });
check("the preserved legacy opposition map charges the negative face (f)", true);
check("a cell told both its predicate and its converse settles to ⊤ (held, not error)", glyph(cellOf(contested, "open", "door").value) === "11");

// --- retraction tombstone: honest append-only undo ---
const undone = fold("c", [
  { e: "c", a: "flag", v: "set", t: "t0" },
  { e: "c", a: "flag", v: null, t: "t1" }, // retract every earlier flag assertion
]);
check("a retraction tombstone stops earlier assertions from contributing", cellOf(undone, "flag", "set") === undefined);

// --- the full spine settle = supersede ∘ fold ---
const settled = settle("p", world, { functional: fnSet });
check("settle projects the functional latest-t then folds (p located-in yard only)",
  cellOf(settled, "located-in", "yard") && cellOf(settled, "located-in", "hall") === undefined);

// --- the settled-section projection {affirmed,denied,contradicted} ---
const sec = section(contested);
check("section buckets a ⊤ cell as contradicted", sec.contradicted.some((c) => c.predicate === "open"));
const sec2 = section(fold("c", [
  { e: "c", a: "open", v: "door", t: "t0" },
  { e: "c", a: "locked", v: "box", t: "t1" },
  { e: "c", a: "shut", v: "gate", t: "t2" },
], { converse: { shut: "open" } }));
check("section buckets a t cell as affirmed and an f cell as denied",
  sec2.affirmed.some((c) => c.predicate === "open" && c.object === "door") &&
  sec2.denied.some((c) => c.predicate === "open" && c.object === "gate"));

// --- Fregean claim × independent evidence => FOUR => Chu ---
const evidenceFixture = JSON.parse(readFileSync(new URL("./fixtures/fregean-four-chu.json", import.meta.url), "utf8"));
const evidenceRows = evidenceFixture.evidence.map(({ claim, ...evidence }) => {
  const point = evidenceFixture.claims[claim];
  return independentEvidenceRow({ ...point, ...evidence });
});
const independent = foldIndependentEvidence(evidenceFixture.subject, evidenceFixture.claims, evidenceRows);
check("independent evidence retains all four admitted oriented claims", independent.fiber.length === 4);
check("no witness leaves the claim at neither (00)", glyph(cellOf(independent, "has-standing", "neither").value) === "00");
check("a positive witness reaches for-only (10)", glyph(cellOf(independent, "has-standing", "for").value) === "10");
check("a negative witness reaches against-only (01) without reversing the claim", glyph(cellOf(independent, "has-standing", "against").value) === "01");
check("independent witnesses reach both (11)", glyph(cellOf(independent, "has-standing", "both").value) === "11");
check("independent evidence rows preserve the exact oriented EAV triple",
  evidenceRows.every((row) => row.e === evidenceFixture.subject && row.a === "has-standing"));
let converseRefused = false;
try { foldIndependentEvidence(evidenceFixture.subject, evidenceFixture.claims, evidenceRows, { converse: { denied: "has-standing" } }); }
catch (error) { converseRefused = /converse is not denial/.test(error.message); }
check("the independent path refuses converse-as-denial configuration", converseRefused);

const independentChu = sectionSpace(independent, evidenceRows);
const pointKey = (object) => jcs(["has-standing", object]);
const settledName = (point) => valueOf(settleRow(independentChu.space, point)).name;
check("Chu settles the four claim rows to the same four charges",
  settledName(pointKey("neither")) === "absurd" &&
  settledName(pointKey("for")) === "potential" &&
  settledName(pointKey("against")) === "active" &&
  settledName(pointKey("both")) === "stable");
const bothRow = chuRow(independentChu.space, pointKey("both"));
check("Chu reads the independent witnesses as states on the unchanged claim",
  bothRow.some(({ state, charge }) => state === "alice" && valueOf(charge).name === "potential") &&
  bothRow.some(({ state, charge }) => state === "bob" && valueOf(charge).name === "active"));

let failed = 0;
for (const r of results) { console.log(`${r.pass ? "  ok" : "FAIL"}  ${r.name}`); if (!r.pass) failed++; }
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
