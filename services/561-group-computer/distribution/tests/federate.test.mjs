// federate — the L9 tensor ∥. These prove the laws that make coordination unnecessary (CALM) and
// disagreement a value rather than an error, plus the L10a admission gate that stops a hostile peer
// from forcing ⊤ everywhere. Written when the tile moved into @red-cup-engineering/computer, which its own
// consumers (tsander's world, horsetail's `federate` form) name as its home.
import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyWorld, admitLog, federate, mergeWorlds, allRows, subjects,
  inertFor, sectionOf, disagreements, contentKey, migrateSubjects, logFor,
} from "@red-cup-engineering/computer/distribution";

const CONVERSE = { converse: { has: "not-has" } };
const claim = (by, a) => ({ e: "realm", a, v: "peace", t: { n: 1, by } });
const worldOf = (subject, rows) => admitLog(emptyWorld(), subject, rows).world;

test("a G-Set union: identical rows collapse, differing rows all survive", () => {
  const same = federate(
    worldOf("village", [{ e: "village", a: "has", v: "water", t: 1 }]),
    worldOf("village", [{ e: "village", a: "has", v: "water", t: 1 }]),
  );
  assert.equal(allRows(same).length, 1, "an identical row from two peers is one row, not two");

  const differing = federate(worldOf("realm", [claim("peer-a", "has")]), worldOf("realm", [claim("peer-b", "not-has")]));
  assert.equal(allRows(differing).length, 2, "differing rows ALL survive — no witness is dropped");
  assert.deepEqual(subjects(differing), ["realm"]);
});

test("disagreement settles to a HELD contradiction carrying both witnesses", () => {
  const contested = federate(worldOf("realm", [claim("peer-a", "has")]), worldOf("realm", [claim("peer-b", "not-has")]));
  const section = sectionOf(contested, "realm", CONVERSE);
  assert.equal(section.contradicted.length, 1, "the contested cell reads as contradicted, not as a winner");
  assert.deepEqual(section.affirmed, [], "neither face is promoted to fact");

  const [dispute] = disagreements(contested, CONVERSE);
  assert.equal(dispute.subject, "realm");
  // Evidence is linear: BOTH sides' row identities ride in the disagreement, so it is enumerable.
  assert.equal(dispute.evidence.flat().length, 2, "both witnesses are carried, so the dispute is a value");
});

test("federate is idempotent and commutative — which is why no coordinator is needed", () => {
  const a = worldOf("realm", [claim("peer-a", "has")]);
  const b = worldOf("realm", [claim("peer-b", "not-has")]);
  const ab = federate(a, b);
  assert.equal(contentKey(federate(ab, ab)), contentKey(ab), "idempotent: re-federating changes nothing");
  assert.equal(contentKey(federate(a, b)), contentKey(federate(b, a)), "commutative: peer order is irrelevant");
  assert.equal(contentKey(mergeWorlds(a, b)), contentKey(ab), "mergeWorlds agrees with the binary tensor");
});

test("L10a: an unrecognized peer cannot force a contradiction (the sybil top-injection)", () => {
  const honest = worldOf("realm", [claim("peer-a", "has")]);
  const hostile = worldOf("realm", [claim("attacker", "not-has")]);

  const ungated = federate(honest, hostile);
  assert.equal(sectionOf(ungated, "realm", CONVERSE).contradicted.length, 1,
    "ungated, the attacker's converse-spam DOES force the cell to ⊤ — this is the attack");

  const gated = federate(honest, hostile, { recognize: new Set(["peer-a"]) });
  assert.equal(sectionOf(gated, "realm", CONVERSE).contradicted.length, 0, "gated, the injection is refused");
  assert.equal(inertFor(gated, "realm").length, 1, "the unrecognized row is quarantined, not folded");
  assert.equal(allRows(gated).length, 2,
    "and it is still PRESENT — append-only: quarantined is held inert, never deleted");
});

test("L10a does not over-gate honest disagreement between two recognized peers", () => {
  const gated = federate(
    worldOf("realm", [claim("peer-a", "has")]),
    worldOf("realm", [claim("peer-b", "not-has")]),
    { recognize: new Set(["peer-a", "peer-b"]) },
  );
  assert.equal(sectionOf(gated, "realm", CONVERSE).contradicted.length, 1,
    "two RECOGNIZED peers disagreeing still reach ⊤ — honest contest must survive the gate");
  assert.equal(inertFor(gated, "realm").length, 0, "nothing is quarantined when both sources are recognized");
});

test("provenance: only the witnessed-t form is reachable through the eavt row shape", () => {
  // provenanceOf also reads `row.source` and `row.signature`, but assertRow admits EXACTLY {e,a,v,t},
  // so a row carrying either key is rejected before the gate can read it. Recorded rather than
  // silently worked around: closing it means either widening the row shape or dropping those forms.
  assert.throws(
    () => admitLog(emptyWorld(), "realm", [{ e: "realm", a: "has", v: "peace", t: 1, source: "peer-a" }]),
    /row must be exactly \{e,a,v,t\}/,
    "a row carrying `source` is refused by the eavt shape, making that provenance form unreachable",
  );
});

test("migrateSubjects: rebuilds a world with every row's subject renamed through the mapping function", () => {
  const w = worldOf("old:1", [{ e: "old:1", a: "has", v: "water", t: 1 }]);
  const moved = migrateSubjects(w, (s) => s.replace("old:", "new:"));
  assert.deepEqual(subjects(moved), ["new:1"]);
  assert.equal(logFor(moved, "new:1")[0].e, "new:1");
});

test("migrateSubjects: two subjects mapped to the same target UNION their rows (G-Set, nothing overwritten)", () => {
  let w = admitLog(emptyWorld(), "a1", [{ e: "a1", a: "has", v: "water", t: 1 }]).world;
  w = admitLog(w, "a2", [{ e: "a2", a: "has", v: "water", t: 2 }]).world;
  const moved = migrateSubjects(w, () => "merged");
  assert.equal(logFor(moved, "merged").length, 2);
});

test("migrateSubjects: distinct from migrate — it re-keys ONE world's own subjects, never crosses two worlds", () => {
  assert.throws(() => migrateSubjects(worldOf("x", [{ e: "x", a: "has", v: "water", t: 1 }]), "not-a-function"),
    TypeError, "mapSubject must be a function");
});
