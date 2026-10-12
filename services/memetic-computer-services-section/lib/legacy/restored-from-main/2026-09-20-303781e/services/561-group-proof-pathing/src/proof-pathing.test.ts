// proof-pathing.test.ts — behavioral proof that a path is a proof. Run: node --test (Node ≥ 22.18).
import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import {
  address,
  addressNested,
  composeTerm,
  decomposeTerm,
  desanitizeSegment,
  logPath,
  MORPHISM_KEYS,
  pathOf,
  namespaceOf,
  prove,
  proves,
  sanitizeSegment,
  structureOf,
  termOf,
  termOfNested,
  walk,
  withinNamespace,
  cellOf,
} from "./index.ts";

// ── specialization: the is-a /library/ type-path (the grow.mjs spine) ───────────

test("a specialization (is-a) chain renders the typed /library/ path that proves the target", () => {
  const cells = [
    { subject: "room", predicate: "is-a", object: "paracosm" },
    { subject: "paracosm", predicate: "is-a", object: "category" },
  ];
  const atoms = structureOf(cells); // category →specialization→ paracosm →specialization→ room

  const p = prove(atoms, "category", "room");
  assert.equal(p.ok, true);
  assert.deepEqual(p.generators, ["specialization", "specialization"]);
  assert.equal(p.path, "category/specialization/library/paracosm/specialization/library/room");
  assert.equal(walk(atoms, p.path!).ok, true);
});

test("reachability is the LFP closure and is directed (general → specific, not back)", () => {
  const cells = [
    { subject: "room", predicate: "is-a", object: "paracosm" },
    { subject: "paracosm", predicate: "is-a", object: "category" },
  ];
  const atoms = structureOf(cells);
  assert.equal(proves(atoms, "category", "room"), true); // transitive closure composes the two steps
  assert.equal(proves(atoms, "room", "category"), false); // specialization runs type → instance only
});

// ── the relational generators: converse, subject-/object-projection ─────────────

test("a relational cell contributes converse + subject-projection + object-projection edges", () => {
  const atoms = structureOf([{ subject: "socrates", predicate: "teaches", object: "plato" }]);
  const node = cellOf("socrates", "teaches", "plato");

  const toObject = prove(atoms, node, "plato");
  assert.deepEqual(toObject.generators, ["object-projection"]);
  assert.equal(walk(atoms, toObject.path!).ok, true);

  const toSubject = prove(atoms, node, "socrates");
  assert.deepEqual(toSubject.generators, ["subject-projection"]);

  const toConverse = prove(atoms, node, cellOf("plato", "teaches", "socrates"));
  assert.deepEqual(toConverse.generators, ["converse"]);
});

// ── a mixed-generator proof: composition across kinds (saturate's μ) ────────────

test("a proof composes generators of different kinds (specialization then object-projection)", () => {
  const cell = cellOf("socrates", "teaches", "plato");
  const atoms = structureOf([
    { subject: "socrates", predicate: "teaches", object: "plato" },
    { subject: cell, predicate: "is-a", object: "teaching-relation" }, // teaching-relation →spec→ cell
  ]);

  const p = prove(atoms, "teaching-relation", "plato");
  assert.equal(p.ok, true);
  assert.deepEqual(p.generators, ["specialization", "object-projection"]);
  assert.equal(walk(atoms, p.path!).ok, true);
});

// ── the proof term is checkable, and the address is deterministic (Yoneda) ───────

test("walk rejects a path whose hops are not real generator edges", () => {
  const atoms = structureOf([
    { subject: "room", predicate: "is-a", object: "paracosm" },
  ]);
  assert.equal(walk(atoms, "paracosm/converse/library/room").ok, false); // it is a specialization, not converse
  assert.equal(walk(atoms, "paracosm/specialization/library/room").ok, true);
});

test("same structure yields the same path — the term is its own collision-free index", () => {
  const cells = [{ subject: "room", predicate: "is-a", object: "paracosm" }];
  assert.equal(prove(structureOf(cells), "paracosm", "room").path, prove(structureOf(cells), "paracosm", "room").path);
});

test("the generator slots are the canonical predicate-category classes", () => {
  assert.deepEqual([...MORPHISM_KEYS], ["specialization", "converse", "subject-projection", "object-projection"]);
});

test("pathOf folds math-style morphism-slot structures directly to a typed proof path", () => {
  const structure = {
    objects: ["being", "mortal", "human", "socrates", "plato"],
    specialization: [
      { domain: "being", codomain: "mortal" },
      { domain: "mortal", codomain: "human" },
      { domain: "human", codomain: "socrates" },
    ],
    converse: [],
    "subject-projection": [],
    "object-projection": [{ domain: "socrates", codomain: "plato" }],
  };

  assert.equal(
    pathOf(structure, "being", "socrates"),
    "being/specialization/library/mortal/specialization/library/human/specialization/library/socrates",
  );
  assert.equal(
    pathOf(structure, "being", "plato"),
    "being/specialization/library/mortal/specialization/library/human/specialization/library/socrates/object-projection/library/plato",
  );
  assert.equal(pathOf(structure, "human", "being"), null);
});

// ── typed term coordinates: absorbed from typed-filepath addressing ───────────

test("address resolves a term to a typed coordinate and termOf recovers the term", () => {
  const root = "/tmp/tfas";

  assert.equal(address(root, "people/morgan", "jsonl"), join(root, "people", "morgan", "morgan.jsonl"));
  assert.equal(address(root, ["a", "b"], "json"), join(root, "a", "b", "b.json"));
  assert.equal(address(root, "x", ".md"), address(root, "x", "md"));
  assert.equal(logPath(root, "people/morgan"), address(root, "people/morgan", "jsonl"));
  assert.equal(termOf(root, address(root, "creatures/ada", "jsonl")), "creatures/ada");
  assert.throws(() => address(root, "", "jsonl"), /empty term/);
  assert.throws(() => address(root, "x", ""), /needs a type/);
});

test("segment hygiene is reversible, traversal-safe, and collision-resistant for hostile parts", () => {
  const inputs = [
    "", ".", "..", "...", ".hidden", "plain", "Morgan O'Toole",
    "a/b/c", "../../etc/passwd", "with space", "tab\tand\nnewline",
    "cafe", "cafe\u0301", "emoji-🜂", "~tilde", "~7e", "weird~e",
    "https://example.com/path?q=1&x=2#frag",
  ];

  for (const input of inputs) {
    const atom = sanitizeSegment(input);
    assert.ok(atom.length > 0);
    assert.ok(!atom.includes("/"));
    assert.notEqual(atom, ".");
    assert.notEqual(atom, "..");
    assert.ok(!atom.startsWith("."));
    assert.match(atom, /^[A-Za-z0-9._~-]+$/);
    assert.equal(desanitizeSegment(atom), input);
  }
  assert.equal(new Set(inputs.map(sanitizeSegment)).size, inputs.length);
});

test("addressNested treats each arbitrary part as one reversible coordinate segment", () => {
  const root = "/tmp/tfas-hygiene";
  const boss = "Morgan O'Toole / boss";

  assert.equal(addressNested(root, ["people", "ada"], "jsonl"), join(root, "people", "ada", "ada.jsonl"));
  assert.equal(addressNested(root, boss, "jsonl"), join(root, sanitizeSegment(boss), `${sanitizeSegment(boss)}.jsonl`));

  const traversal = addressNested(root, ["a", "../../etc/passwd", "b"], "jsonl");
  assert.ok(traversal.startsWith(join(root, "a")));
  assert.ok(!traversal.includes("/.."));
  assert.deepEqual(termOfNested(root, traversal), ["a", "../../etc/passwd", "b"]);

  const parts = ["people", "Morgan O'Toole", "cafe\u0301"];
  assert.deepEqual(termOfNested(root, addressNested(root, parts, "jsonl")), parts);
  assert.notEqual(addressNested(root, ["a/b"], "jsonl"), addressNested(root, ["a", "b"], "jsonl"));
});

test("composeTerm creates reversible namespaced term coordinates", () => {
  const term = composeTerm("agents", ["Ada Lovelace", "msg/42"]);

  assert.equal(term, `agents/${sanitizeSegment("Ada Lovelace")}/${sanitizeSegment("msg/42")}`);
  assert.deepEqual(decomposeTerm(term), { namespace: "agents", parts: ["Ada Lovelace", "msg/42"] });
  assert.equal(namespaceOf(term), "agents");
  assert.equal(withinNamespace(term, "agents"), true);
  assert.equal(withinNamespace(term, "claims"), false);
  assert.deepEqual(decomposeTerm(""), { namespace: "", parts: [] });
});
