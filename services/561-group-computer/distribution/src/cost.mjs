// cost — bottleneck detection over a federated relational graph: cut-vertices and bridge-edges.
//
// THE LAW for this file. This is a PURE graph read over a federated world's rows — no clock, no I/O,
// no coordinator. The "cost" is structural: a federated world is a relational graph (subjects are
// vertices, relational rows are edges); the bottlenecks are the cut-vertices (whose removal raises the
// number of connected components) and bridge-edges (likewise). They mark where the federation depends
// on a single node/link — a coordination pressure the CALM design has not (yet) routed around. Nothing
// here SETTLES a value; it reports structure so a governance decision can cite it as a cost-witness.
//
// ARCHITECTURE CONTRACT: imports ONLY L2 (jcs) — no kernel, no fs, no clock. Operates on a federated
// world (the Map<subject,rows[]> from federate.mjs) or on a flat rows[] array.
//
// Lifted from apps/tools/swarm/src/cost.mjs — specifically the graph core (addVertex/addEdge,
// componentCountWith, centralVertices, removalSensitivity's cut-vertices/bridge-edges, and the
// costGraphSummary shape {dimensions, graph, bottlenecks}). The swarm-specific ledger feed (provider/
// office/tool/trace summaries, embodied-cost tuplets, worktree/safety pressure) STAYS in swarm; this
// lift takes its edges from the federated trace's relational rows instead, so ANY federated world has a
// bottleneck read, not just a swarm ledger.

import { canonicalJson } from "@red-cup-engineering/json-services-section/canonical-json";
import { composeAndReopen } from "@red-cup-engineering/signgraph/paths"; // path composition over the edges (its residue)

// predicates that name a row's own structure, not a relation between subjects — excluded as edges so a
// converse declaration or a retraction does not masquerade as a dependency link.
const NON_RELATIONAL = new Set(["has-converse"]);

function addVertex(vertices, id, kind = "subject") {
  if (!id) return null;
  if (!vertices.has(id)) vertices.set(id, { id, kind, inDegree: 0, outDegree: 0 });
  return vertices.get(id);
}

function addEdge(vertices, edges, from, to, relation) {
  if (!from || !to || from === to) return; // a self-loop is no bottleneck
  addVertex(vertices, from);
  addVertex(vertices, to);
  edges.push({ from, to, relation });
  vertices.get(from).outDegree += 1;
  vertices.get(to).inDegree += 1;
}

// componentCountWith — count connected components of the UNDIRECTED graph, optionally with one vertex
// or one edge removed (the cut-vertex / bridge probe). Lifted verbatim-in-logic from swarm cost.mjs.
function componentCountWith(vertices, edges, removedVertex = "", removedEdgeIndex = -1) {
  const neighbors = new Map([...vertices.keys()].map((id) => [id, new Set()]));
  if (removedVertex) neighbors.delete(removedVertex);
  for (const [index, edge] of edges.entries()) {
    if (index === removedEdgeIndex) continue;
    if (removedVertex && (edge.from === removedVertex || edge.to === removedVertex)) continue;
    neighbors.get(edge.from)?.add(edge.to);
    neighbors.get(edge.to)?.add(edge.from);
  }
  let count = 0;
  const seen = new Set();
  for (const id of neighbors.keys()) {
    if (seen.has(id)) continue;
    count += 1;
    const stack = [id];
    seen.add(id);
    while (stack.length) {
      const current = stack.pop();
      for (const next of neighbors.get(current) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        stack.push(next);
      }
    }
  }
  return count;
}

function componentCount(vertices, edges) {
  return componentCountWith(vertices, edges);
}

function centralVertices(vertices, limit = 5) {
  return [...vertices.values()]
    .map((v) => ({ ...v, degree: v.inDegree + v.outDegree }))
    .filter((v) => v.degree > 0)
    .sort((a, b) => b.degree - a.degree || a.id.localeCompare(b.id))
    .slice(0, limit);
}

function relationCounts(edges) {
  const counts = new Map();
  for (const e of edges) counts.set(e.relation, (counts.get(e.relation) ?? 0) + 1);
  return [...counts.entries()]
    .map(([relation, count]) => ({ relation, count }))
    .sort((a, b) => b.count - a.count || a.relation.localeCompare(b.relation));
}

// removalSensitivity — the cut-vertices (articulation points) and bridge-edges: the nodes/links whose
// removal raises the component count, i.e. the single points the federation routes through. The
// bottlenecks. Lifted from swarm cost.mjs's removalSensitivity.
function removalSensitivity(vertices, edges, limit = 5) {
  const base = componentCount(vertices, edges);
  const cutVertices = [...vertices.values()]
    .map((v) => ({ ...v, componentIncrease: componentCountWith(vertices, edges, v.id) - base }))
    .filter((v) => v.componentIncrease > 0)
    .sort((a, b) =>
      b.componentIncrease - a.componentIncrease ||
      (b.inDegree + b.outDegree) - (a.inDegree + a.outDegree) ||
      a.id.localeCompare(b.id))
    .slice(0, limit);
  const bridgeEdges = edges
    .map((e, index) => ({ ...e, componentIncrease: componentCountWith(vertices, edges, "", index) - base }))
    .filter((e) => e.componentIncrease > 0)
    .sort((a, b) => b.componentIncrease - a.componentIncrease || a.relation.localeCompare(b.relation))
    .slice(0, limit);
  return { cutVertices, bridgeEdges, baseComponentCount: base };
}

// rowsOf — accept a federated world (Map or plain object of subject->rows[]) OR a flat rows[] array.
function rowsOf(input) {
  if (Array.isArray(input)) return input;
  if (input instanceof Map) return [...input.values()].flat();
  if (input && typeof input === "object") return Object.values(input).flat();
  return [];
}

// costGraphSummary(world | rows) — build the relational graph from the federated trace and report its
// bottlenecks. An edge is a relational row (e --a--> v) where the object `v` is itself a subject id
// (a string). Returns { kind, dimensions, graph, bottlenecks } — the same shape swarm's governance
// cost-witness reads, so governAction({ costWitness }) can carry it unchanged.
export function costGraphSummary(input) {
  const rows = rowsOf(input);
  const vertices = new Map();
  const edges = [];
  let nonRelationalRows = 0;
  let relationalRows = 0;
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    if (NON_RELATIONAL.has(r.a)) { nonRelationalRows += 1; continue; }
    addVertex(vertices, r.e); // every subject is a vertex even if it has no outgoing relation
    if (typeof r.v === "string" && r.v) {
      addEdge(vertices, edges, r.e, r.v, r.a);
      relationalRows += 1;
    } else {
      nonRelationalRows += 1; // an attribute row (object is data, not another subject) — not an edge
    }
  }

  const sensitivity = removalSensitivity(vertices, edges);

  // The CONE alongside the graph read (the law: carry the cone, don't flatten to bottleneck strings).
  // The cut-vertex/bridge analysis is a graph-STRUCTURAL read (connectivity) that does NOT lift to the
  // Chu/FOUR rung — articulation points are not a bilattice fixed point. So we ADD the adjacent reading
  // Compose the same edges as paths: the residue is the composite relation-chains (the label sequences no
  // single predicate names) — a different question than articulation points, over the same edges, carried
  // alongside the structural read.
  const apex = edges.map((e) => ({ subject: e.from, predicate: e.relation, object: e.to }));
  const pathResidue = composeAndReopen(apex).residue; // [[concept,…],…] — the label sequences no single predicate names
  const paths = Object.freeze({
    residue: Object.freeze(pathResidue.map((seq) => Object.freeze([...seq]))),
    evidence: "the federated relational graph composed as paths over its edges: the residue is the composite concept-sequences — the path-composition reading carried alongside the structural cut-vertices/bridges.",
  });

  const dimensions = {
    subjects: vertices.size,
    relationalRows,
    nonRelationalRows,
    edges: edges.length,
    components: sensitivity.baseComponentCount,
    cutVertices: sensitivity.cutVertices.length,
    bridgeEdges: sensitivity.bridgeEdges.length,
  };
  const bottlenecks = [
    ...sensitivity.cutVertices.map((v) => `cut-vertex ${v.id}: removal splits into +${v.componentIncrease} component(s)`),
    ...sensitivity.bridgeEdges.map((e) => `bridge-edge ${e.from} --${e.relation}--> ${e.to}: removal splits into +${e.componentIncrease} component(s)`),
  ];

  return Object.freeze({
    kind: "distribution.cost.graph",
    evidence: "structural bottleneck read over the federated relational trace: cut-vertices and bridge-edges mark the single points the coordination-free federation routes through.",
    dimensions,
    graph: Object.freeze({
      vertexCount: vertices.size,
      edgeCount: edges.length,
      componentCount: sensitivity.baseComponentCount,
      centralVertices: centralVertices(vertices),
      relationCounts: relationCounts(edges),
      cutVertices: sensitivity.cutVertices,
      bridgeEdges: sensitivity.bridgeEdges,
      paths, // path composition over the same edges — carried alongside the structural read.
    }),
    bottlenecks,
    // a stable content key so two equal graphs witness equal (used by tests / dedupe). The new `paths`
    // cone is ADDITIVE and deliberately EXCLUDED here so the content key (hence dedupe) is unperturbed.
    contentKey: canonicalJson([dimensions, bottlenecks]),
  });
}

export default costGraphSummary;
