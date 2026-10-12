// principal — the OS identity tool: a PRINCIPAL is a settled identity cell in the trace, not a record
// you authenticate against. Its account is a PLAYER whose identity, authentication, and authority are
// settled, contestable, evidence-bearing CHARGES — capability not credential, recognition not registry,
// continuous-fold not session-bit, ⊤-held-dispute not access-denied.
//
// THE LAW for this file (and the whole tool):
//   - paraconsistent: a recognition DISPUTE rises to ⊤ and is HELD with BOTH witnesses, surfaced —
//     never resolved to a winner, never collapsed to access-denied.
//   - append-only: state is the FOLD of the trace. There is no session-bit; "are you authenticated" is
//     a CONTINUOUS fold of evidence read at act-time, decaying toward ⊥ as evidence ages (zero-trust).
//   - evidence is linear witnesses: every row is conserved; the charge carrier accumulates witnesses,
//     nothing is dropped (substrate.fold's joinKnowledge over a lossless carrier).
//   - identity via jcs: a row's identity is sha256(jcs(row)); a principal/cell address is canonical.
//   - capability not credential: a capability is a held, unforgeable, attenuable CHARGE; delegation is
//     `allocation` — the principal NARROWS downstream, the accountable stays at the APEX.
//
// ARCHITECTURE CONTRACT (an OS tool under computer/, like Unix uid+auth — NOT a userspace app):
// PURE over the substrate. The bytes are the caller's — every mutating call RETURNS rows to persist
// (the substrate's pure-fold contract), it does NO node:fs and NO write. `math` is never imported here
// beyond what the substrate/governance already re-export; we BUILD ON existing pieces by name and
// re-derive NOTHING:
//   - the EAVT section's evidence fold and section; metrologic's sectionSpace
//   - @red-cup-engineering/computer/distribution/governance — governAction (FOUR-valued Hohfeldian decision)
//   - @red-cup-engineering/computer/process-runtime/allocation — allocateProcess (principal narrows, accountable apex)
//   - SignCell/SignChain readings - the four-bilattice
//     values (potential/active/absurd/stable) and their names

import { foldEavtEvidence, sectionEavtEvidence } from "@red-cup-engineering/eavt-services-section";
import { canonicalCborToNiUri, encodeCanonical } from "@red-cup-engineering/cbor-services-section";
import { canonicalJson } from "@red-cup-engineering/json-services-section/canonical-json";
import { sectionSpace } from "@red-cup-engineering/metrologic/articulation/predicating/positing/independent-evidence";
import { governAction } from "@red-cup-engineering/computer/distribution/governance";
import { allocateProcess } from "@red-cup-engineering/computer/process-runtime/allocation";
import { pointWitnesses } from "@red-cup-engineering/metrologic/chu";
import { readingAs } from "@red-cup-engineering/computer-data-engineering-services-section/four";

// === the recognition CONE: a principal's identity as a Chu space ============================
// A principal's identity is "the recognition graph" — and a graph of (party recognizes principal-AS-X)
// is a Chu space (math/chu): claims are the POINTS, the witnessing parties are the STATES, the value at
// (claim, party) is the FOUR face that party witnesses (t recognized / f disputed / ⊤ both / ⊥ neither).
// This is the one structure whois/can/authenticated read; the substrate's sectionSpace builds it (the
// rich sibling of section()), resolving evidence to parties ONCE. A point's settled reading is the
// knowledge-join of its parties' faces (settleRow); the witnessing parties are a row read (chuRow) — so
// there is no witness index to rebuild and no FOUR to hand-roll: the party IS a coordinate.
const facesOf = (space, point) => {
  const witnesses = pointWitnesses(space, point);
  return { settled: witnesses.settled, recognizedBy: witnesses.for, disputedBy: witnesses.against };
};

// === addressing ============================================================================
// A principal's identity CELL is a subject in the trace. We address it canonically so every observer
// folds the same cell. The subject IS the principal's name (a string the recognition graph refers to);
// identity beyond the name is the FOLD of what is recognized/attested about it. No registry, no uid
// allocation — a principal exists exactly insofar as evidence names it.
const asName = (p) => {
  if (typeof p === "string" && p) return p;
  if (p && typeof p === "object" && typeof p.name === "string" && p.name) return p.name;
  throw new TypeError("principal: a principal must be a non-empty name string (or {name})");
};

// The identity-predicate family. `recognized-as` is the POSITIVE identity face: "(principal) is
// recognized as (claim)". Its CONVERSE `disputed-as` charges the NEGATIVE face of the same cell, so a
// cell told both an affirmation AND a withholding on the SAME claim settles to ⊤ — a HELD dispute.
export const IDENTITY = Object.freeze({
  predicate: "recognized-as",
  converse: "disputed-as",
});
// The converse map the substrate folds under: a `disputed-as` row contributes to the NEGATIVE face of
// the matching `recognized-as` cell (substrate.fold opts.converse: {converse -> positive}).
export const IDENTITY_CONVERSE = Object.freeze({ [IDENTITY.converse]: IDENTITY.predicate });

// === evidence: append rows ABOUT a principal ===============================================
// These functions are PURE: they return {e,a,v,t} rows for the caller to persist (eavt-append).
//
// THE WITNESS RIDES IN `t`. The eavt contract names `t` the "transaction/WITNESS". So a row's `v` is
// the bare CLAIM/value (which is what the substrate keys a cell on — `jcs([predicate, object])`), and
// the WHO + WHEN ride in `t` as a witness stamp `{ by, at }`. This is what lets two parties recognize
// the SAME claim and fold to ONE cell (two witnesses on one face), while a recognize and a dispute on
// that same claim rise to ⊤ — both witnesses conserved, never collapsed. `at` is the time the decay
// fold reads; `by` is the party the witness index resolves. (rowId stays content-identity over all
// four fields, so distinct witnesses are distinct rows — evidence is linear, nothing aliases away.)
const stamp = (by, at) => Object.freeze({ by: asName(by), at: at ?? null });

// recognize(by, principal, asWhat, at) — `by` recognizes `principal` AS `asWhat` (a positive identity
// claim). This is web-of-trust: identity is recognition, not credential-match.
export function recognize(by, principal, asWhat, at) {
  return Object.freeze({ e: asName(principal), a: IDENTITY.predicate, v: asWhat, t: stamp(by, at) });
}

// dispute(by, principal, asWhat, at) — `by` WITHHOLDS the claim that `principal` is `asWhat` (the
// converse predication — negative evidence is NEVER a polarity field, it is the converse row). When a
// recognize and a dispute stand on the SAME (principal, claim), the cell settles to ⊤ — HELD, both
// witnesses surfaced, NOT resolved to a winner.
export function dispute(by, principal, asWhat, at) {
  return Object.freeze({ e: asName(principal), a: IDENTITY.converse, v: asWhat, t: stamp(by, at) });
}

// attest(by, principal, attribute, value, at) — `by` attests a fact (a signature, a key, a property)
// about `principal`. Attestations are identity EVIDENCE that is not itself an identity-name claim: a
// (principal, attests:<attribute>, value) row witnessed by `by`, folded alongside recognitions.
export function attest(by, principal, attribute, value, at) {
  return Object.freeze({ e: asName(principal), a: `attests:${String(attribute)}`, v: value, t: stamp(by, at) });
}

// present(by, principal, capability, at) — `principal` PRESENTS a capability it holds as authentication
// evidence (object-capability: authority is a reference you HOLD). A presented capability is a row the
// authenticated-fold and may() read. `by` is who observed/accepted the presentation.
export function present(by, principal, capability, at) {
  return Object.freeze({ e: asName(principal), a: "presents", v: capabilityRef(capability), t: stamp(by, at) });
}

// === whois: fold the identity cell -> settled identity =====================================
// whois(rows, principal, opts?) — FOLD the principal's identity cell to its settled identity. Returns
// the settled section over the identity predicate: each distinct claim is a cell carrying a
// four-bilattice charge; a claim recognized by one party and disputed by another rises to ⊤ and is
// reported under `disputed` (HELD, with BOTH witnesses), NEVER silently resolved.
//
// Identity is multi-valued (a principal may be recognized as several things at once), so we do NOT
// supersede the identity predicate — we fold the raw trace under the identity converse. Returns:
//   { principal, recognizedAs:[{claim, by:[…]}], disputed:[{claim, recognizedBy:[…], disputedBy:[…]}],
//     attestations:[…], folded, section }
export function whois(rows, principal, opts = {}) {
  const subject = asName(principal);
  const allRows = rows ?? [];
  const folded = foldEavtEvidence({
    subject,
    rows: allRows,
    converse: { ...IDENTITY_CONVERSE, ...(opts.converse ?? {}) },
    retract: opts.retract,
  });
  const sec = sectionEavtEvidence({ folded });

  // the recognition CONE: identity claims (points) × witnessing parties (states), valued in FOUR.
  const { space, cellFor, stateOfId } = sectionSpace(folded, allRows, { predicate: IDENTITY.predicate });

  const recognizedAs = [];
  const disputed = [];
  for (const point of space.points) {
    const { object: claim } = cellFor(point);
    const { settled, recognizedBy, disputedBy } = facesOf(space, point);
    if (settled === "stable") {
      // ⊤ — a HELD dispute. Both faces stand; we surface both witness sets and DO NOT pick a winner.
      disputed.push(Object.freeze({ claim, recognizedBy, disputedBy, value: "stable", held: true }));
    } else if (settled === "potential") {
      recognizedAs.push(Object.freeze({ claim, by: recognizedBy, value: "potential" }));
    }
    // f-only and ⊥ are not surfaced as identity — denied/empty claims hold no standing.
  }

  const attestations = foldedAttestations(folded, stateOfId);

  return Object.freeze({
    principal: subject,
    recognizedAs: Object.freeze(recognizedAs),
    disputed: Object.freeze(disputed),    // the ⊤ cells — HELD, both witnesses, never resolved
    attestations: Object.freeze(attestations),
    settled: !disputed.length,            // settled to a single reading iff no ⊤ dispute stands
    space,                                // the recognition CONE — pass it on; don't re-fold downstream
    folded,
    section: sec,
  });
}

// === authenticated: the CONTINUOUS-AUTH fold ===============================================
// authenticated(rows, principal, opts?) — read the principal's evidence AT ACT-TIME and fold it to a
// FOUR-valued standing. There is NO session-bit: standing is recomputed from the trace every time, and
// DECAYS toward ⊥ as evidence ages. This is zero-trust / continuous authentication done natively.
//
// opts.now (the act-time stamp; caller supplies — no clock here), opts.halfLife (rows older than this
// many time-units have decayed; default Infinity = no decay), opts.challenge (a Player/Opponent play:
// { issued, response } — a response that answers the issued challenge is a fresh, undecayed witness).
//
// Returns { principal, value:FOUR, standing, fresh:[…], stale:[…], reason }. value is:
//   t   — at least one FRESH authenticating witness stands (recognition/presentation/challenge-response)
//   bot — evidence exists but has DECAYED past the half-life (standing fell back to ⊥; re-auth needed)
//   f   — a standing WITHHOLDING/dispute denies authentication
//   top — a fresh authentication AND a fresh withholding both stand (HELD, surfaced)
export function authenticated(rows, principal, opts = {}) {
  const subject = asName(principal);
  const now = opts.now ?? null;
  const halfLife = opts.halfLife ?? Infinity;

  // an authenticating witness: a recognition of THIS principal, a presented capability, or a
  // challenge-response. Each carries a time `t`; freshness is now - t against the half-life.
  const at = (r) => (r.t && typeof r.t === "object" ? r.t.at : r.t); // the witness time rides in t.at
  const who = (r) => (r.t && typeof r.t === "object" ? r.t.by : undefined);
  const witnesses = [];
  for (const r of rows ?? []) {
    if (r.e !== subject) continue;
    if (r.a === IDENTITY.predicate) witnesses.push({ kind: "recognition", at: at(r), by: who(r), claim: r.v });
    else if (r.a === "presents") witnesses.push({ kind: "presentation", at: at(r), by: who(r), capability: r.v });
  }
  // a challenge-response play (the strategy that survives is authenticated): a fresh, undecayed witness.
  if (opts.challenge && respondsTo(opts.challenge)) {
    witnesses.push({ kind: "challenge-response", at: opts.challenge.response?.t ?? now, by: subject });
  }

  // standing WITHHELD: a dispute on the principal's identity is a withdrawal of authentication standing.
  const withholdings = [];
  for (const r of rows ?? []) {
    if (r.e !== subject) continue;
    if (r.a === IDENTITY.converse) withholdings.push({ kind: "dispute", at: at(r), by: who(r), claim: r.v });
  }

  const isFresh = (w) => decayStanding(w.at, now, halfLife) > 0;
  const fresh = witnesses.filter(isFresh);
  const stale = witnesses.filter((w) => !isFresh(w));
  const freshWithheld = withholdings.filter(isFresh);

  let value;
  let reason;
  if (fresh.length && freshWithheld.length) {
    value = "stable"; // HELD: fresh authentication AND fresh withholding both stand — surfaced.
    reason = `authentication contested: ${fresh.length} fresh witness(es) and ${freshWithheld.length} fresh withholding(s) stand — held, not resolved.`;
  } else if (freshWithheld.length) {
    value = "active";
    reason = `authentication withheld by ${[...new Set(freshWithheld.map((w) => w.by))].join(", ")}.`;
  } else if (fresh.length) {
    value = "potential";
    reason = `${fresh.length} fresh witness(es) stand; standing folds to authenticated.`;
  } else if (witnesses.length) {
    value = "absurd"; // evidence DECAYED — standing fell back to ⊥; re-authentication needed.
    reason = `all ${witnesses.length} witness(es) decayed past the half-life; standing fell to ⊥ — re-authenticate.`;
  } else {
    value = "absurd";
    reason = "no authenticating evidence; standing is ⊥ (no basis), not a denial.";
  }

  return Object.freeze({
    principal: subject,
    value: readingAs("knowledge", value),
    standing: fresh.reduce((s, w) => Math.max(s, decayStanding(w.at, now, halfLife)), 0),
    fresh: Object.freeze(fresh.map(Object.freeze)),
    stale: Object.freeze(stale.map(Object.freeze)),
    withheld: Object.freeze(freshWithheld.map(Object.freeze)),
    reason,
  });
}

// === may / can: route through governAction over the recognition graph ======================
// may(rows, principal, action, opts?) — the AUTHORITY fold. Routes through distribution/governance
// `governAction` over the recognition graph, returning a FOUR-valued (Hohfeldian power/duty/privilege/
// immunity) decision — NOT a boolean. ⊤ = contested authority (two regimes/parties disagree, HELD and
// surfaced); ⊥ = no basis either way; t = held authority; f = denied. The `can` capability test
// governAction folds under is built FROM the principal's held capabilities in the trace (object-cap:
// authority is a reference you hold), and the action's affirmations/withdrawals come from the
// recognition graph (who recognizes the principal's authority for this action, who withholds it).
//
// Returns the full governAction decision RECORD (which carries .value:FOUR), augmented with the FOUR
// reading. The caller persists it (append (principal, "governed", decision)); governance posits, the
// trace keeps. We do NO write.
export function may(rows, principal, action, opts = {}) {
  const subject = asName(principal);
  const allRows = rows ?? [];

  // the principal's held capabilities — the object-capability basis. `can(agent, action)` is true iff
  // the principal holds an un-attenuated capability covering `action` (a presented/granted ref).
  const held = heldCapabilities(allRows, subject);
  const can = (agent, act) => held.some((cap) => capabilityCovers(cap, act));

  // recognition-graph affirmations/withdrawals for THIS action: parties who recognize the principal's
  // authority to act, and parties who withhold it. These drive the consensus/contrarian regimes so a
  // contested authority can rise to ⊤. The caller may also pass explicit affirmations/withdrawals.
  const graph = authorityGraph(allRows, subject, action);
  const affirmations = [...new Set([...(opts.affirmations ?? []), ...graph.affirmations])];
  const withdrawals = [...new Set([...(opts.withdrawals ?? []), ...graph.withdrawals])];

  const agent = { name: subject, office: opts.office ?? subject };
  const target = { kind: opts.targetKind ?? "action", title: action, affirmations, withdrawals };
  const decision = governAction(agent, action, target, {
    regime: opts.regime, // explicit regime wins; else governAction defaults kyriarchical (capability)
    regimeFor: opts.regimeFor,
    structuration: opts.structuration,
    can,
    now: opts.now ?? null,
    affirmations,
    withdrawals,
    costWitness: opts.costWitness,
  });

  return Object.freeze({
    ...decision,
    principal: subject,
    four: readingAs("knowledge", decision.value), // the FOUR reading, surfaced for the caller's settle
    heldCapabilities: Object.freeze(held.map((c) => c.ref)),
  });
}

// can(rows, principal, action, opts?) — the bare object-capability read: does the principal HOLD an
// un-attenuated capability covering `action`? This is the capability LIMB of authority (what may()
// folds under `can`), exposed on its own. Returns FOUR: t held, f explicitly revoked (a converse on
// the capability), ⊥ not held (no basis), ⊤ both granted and revoked (HELD). NOT a boolean.
export function can(rows, principal, action, opts = {}) {
  const subject = asName(principal);
  const cells = capabilityCells(rows ?? [], subject);
  let granted = false;
  let revoked = false;
  const grantedBy = new Set();
  const revokedBy = new Set();
  for (const cell of cells) {
    if (!capabilityCovers(cell, action)) continue;
    if (cell.pos) { granted = true; cell.grantedBy.forEach((p) => grantedBy.add(p)); }
    if (cell.neg) { revoked = true; cell.revokedBy.forEach((p) => revokedBy.add(p)); }
  }
  let value;
  if (granted && revoked) value = "stable";
  else if (granted) value = "potential";
  else if (revoked) value = "active";
  else value = "absurd";
  return Object.freeze({
    principal: subject,
    action,
    value: readingAs("knowledge", value),
    held: granted && !revoked,
    grantedBy: Object.freeze([...grantedBy].sort()),
    revokedBy: Object.freeze([...revokedBy].sort()),
  });
}

// === grant / attenuate / delegate: capability-as-charge ====================================
// A CAPABILITY is an unforgeable, attenuable HELD reference (object-capability). Its identity is
// content-addressed via jcs (capabilityRef), so it cannot be forged — only granted, attenuated, or
// delegated by someone who holds it. These are PURE: they RETURN the rows the caller persists.
//
// grant(from, to, capability, t) — `from` grants `to` a capability: a (to, holds-capability, {by, cap})
// row. The grant is a positive charge on `to`'s capability cell; its witness `from` is conserved.
export function grant(from, to, capability, at) {
  const cap = capabilityValue(capability);
  return Object.freeze({ e: asName(to), a: "holds-capability", v: cap, t: stamp(from, at) });
}

// revoke(from, to, capability, t) — the CONVERSE of grant: `from` revokes `to`'s capability (negative
// evidence is the converse predication). A grant + a revoke on the same capability cell rise to ⊤ —
// HELD (the held reference is contested), surfaced by can()/may(), never silently dropped.
export function revoke(from, to, capability, at) {
  const cap = capabilityValue(capability);
  return Object.freeze({ e: asName(to), a: "revokes-capability", v: cap, t: stamp(from, at) });
}
// the converse map can()/may() fold capability cells under.
export const CAPABILITY_CONVERSE = Object.freeze({ "revokes-capability": "holds-capability" });

// attenuate(capability, restriction) — narrow a capability into a STRICTLY weaker one (object-cap
// attenuation is a fold, not a new authority). Returns a NEW capability whose scope is the meet of the
// original scope and the restriction, carrying its parent ref so the chain is auditable. Attenuation
// can only NARROW: the result covers a subset of what the parent covered.
export function attenuate(capability, restriction) {
  const cap = capabilityValue(capability);
  const parentRef = capabilityRef(cap);
  const scope = intersectScope(cap.scope, restriction?.scope ?? restriction);
  return Object.freeze({
    kind: "capability",
    resource: restriction?.resource ?? cap.resource,
    scope: Object.freeze(scope),
    attenuatedFrom: parentRef,        // the parent it narrows — the audit chain
    accountable: cap.accountable,     // accountability stays at the APEX, unchanged by attenuation
  });
}

// delegate(from, to, capability, world, t) — DELEGATION via process-runtime/allocation: place a
// process that carries the capability at a modal-world typed-path. The PRINCIPAL narrows downstream
// (the delegate `to` becomes the principal of the allocated process) while the ACCOUNTABLE stays at
// the APEX (H^0-invariant under delegation-chain extension — the original grantor/accountable answers
// for it). Returns { capability (attenuated), allocation, row } — the row is the grant the caller
// persists; the allocation is the placed process; the capability is the narrowed delegate's reference.
export function delegate(from, to, capability, world = {}, t) {
  const granter = asName(from);
  const delegateName = asName(to);
  const cap = capabilityValue(capability);
  // the accountable stays at the apex: the capability's existing accountable, or — first delegation —
  // the granter. It is NEVER overwritten by a downstream delegation (that is the H^0 invariant).
  const accountable = cap.accountable ?? granter;
  // the delegated capability NARROWS: it records its parent and pins the accountable apex. (If the
  // caller passed an attenuation we honor it; otherwise the scope is carried unchanged but the
  // principal still narrows to the delegate downstream.)
  const delegated = Object.freeze({
    kind: "capability",
    resource: cap.resource,
    scope: Object.freeze([...(cap.scope ?? [])]),
    attenuatedFrom: capabilityRef(cap),
    delegatedFrom: granter,
    accountable,                       // APEX — conserved across the chain
  });

  // allocate a process for the delegate. principal NARROWS to the delegate; accountable stays apex.
  const proc = {
    id: `cap:${capabilityRef(delegated).slice(0, 16)}:${delegateName}`,
    rows: [],
    principal: delegateName,
    accountable,
  };
  const allocation = allocateProcess(proc, world, delegateName, accountable);

  // the grant row the caller persists: `from` grants `to` the delegated (narrowed) capability.
  const row = grant(granter, delegateName, delegated, t);

  return Object.freeze({
    capability: delegated,
    principal: delegateName,           // who acts downstream (narrowed)
    accountable,                       // who answers (apex, conserved)
    allocation,
    row,
  });
}

// === capability helpers ====================================================================
// A capability VALUE is { kind:"capability", resource, scope:[…], … }. Its REF is the content-address
// (jcs->sha256-ish) — unforgeable identity. We accept either a bare resource string or a full value.
function capabilityValue(capability) {
  if (typeof capability === "string") {
    return Object.freeze({ kind: "capability", resource: capability, scope: Object.freeze([capability]) });
  }
  if (capability && typeof capability === "object") {
    // Only carry fields that are present — jcs rejects `undefined` object values, and the cap's
    // content-id must be stable, so an absent provenance field must be ABSENT, not undefined.
    const out = {
      kind: "capability",
      resource: capability.resource ?? capability.ref ?? "",
      scope: Object.freeze([...(capability.scope ?? (capability.resource ? [capability.resource] : []))]),
    };
    if (capability.attenuatedFrom !== undefined) out.attenuatedFrom = capability.attenuatedFrom;
    if (capability.delegatedFrom !== undefined) out.delegatedFrom = capability.delegatedFrom;
    if (capability.accountable !== undefined) out.accountable = capability.accountable;
    return Object.freeze(out);
  }
  throw new TypeError("capability: must be a resource string or a capability value object");
}
export function capabilityRef(capability) {
  return canonicalCborToNiUri(encodeCanonical(capabilityValue(capability)));
}
function capabilityCovers(cap, action) {
  const scope = cap.scope ?? [];
  if (scope.includes("*") || scope.includes(action)) return true;
  if (cap.resource === action) return true;
  // prefix scoping: a capability scoped "fs:/home/*" covers "fs:/home/alice".
  return scope.some((s) => typeof s === "string" && s.endsWith("*") && action.startsWith(s.slice(0, -1)));
}
function intersectScope(a = [], b) {
  const left = Array.isArray(a) ? a : [a];
  if (b === undefined || b === null) return [...left];
  const right = Array.isArray(b) ? b : [b];
  // the meet: items in left that are also covered by right (or right is the universal "*").
  if (right.includes("*")) return [...left];
  return left.filter((s) => right.includes(s) || right.some((r) => typeof r === "string" && r.endsWith("*") && String(s).startsWith(r.slice(0, -1))));
}

// === capability + authority reads over the trace ===========================================
// capabilityCells(rows, subject) — fold the subject's holds-capability / revokes-capability rows into
// per-capability cells carrying pos/neg + witness parties. The fold is the substrate's: a grant and a
// revoke on the same capability rise to ⊤ (pos && neg). We read it off the section's evidence so the
// granting/revoking parties are surfaced.
function capabilityCells(rows, subject) {
  const folded = foldEavtEvidence({ subject, rows, converse: CAPABILITY_CONVERSE });
  // the capability CONE — "an office table (Office × Capability → holds)" (math/chu:9): capabilities are
  // the points, granting/revoking parties the states. A grant + a revoke on one cell rises to ⊤ — read
  // off the row, not a hand-rolled witness index.
  const { space, cellFor } = sectionSpace(folded, rows, { predicate: "holds-capability" });
  const cells = [];
  for (const point of space.points) {
    const cap = cellFor(point).object;
    const { settled, recognizedBy, disputedBy } = facesOf(space, point);
    cells.push({
      ref: capabilityRef(cap),
      resource: cap?.resource,
      scope: cap?.scope ?? [],
      pos: settled === "potential" || settled === "stable",
      neg: settled === "active" || settled === "stable",
      grantedBy: new Set(recognizedBy),
      revokedBy: new Set(disputedBy),
    });
  }
  return cells;
}
// the held (un-attenuated-away, un-revoked) capabilities: pos and not neg.
function heldCapabilities(rows, subject) {
  return capabilityCells(rows, subject).filter((c) => c.pos && !c.neg);
}

// authorityGraph(rows, subject, action) — read the recognition graph for WHO recognizes the
// principal's authority to do `action` and who withholds it. A row (subject, recognizes-authority,
// {by, action}) affirms; its converse (subject, withholds-authority, {by, action}) withdraws. These
// feed governAction's consensus/contrarian regimes so contested authority rises to ⊤.
function authorityGraph(rows, subject, action) {
  const affirmations = new Set();
  const withdrawals = new Set();
  for (const r of rows) {
    if (r.e !== subject) continue;
    const act = r.v;                                      // the action rides in `v`; witness in `t.by`
    const by = r.t && typeof r.t === "object" ? r.t.by : undefined;
    if (r.a === "recognizes-authority" && (act === action || act === "*")) affirmations.add(by);
    if (r.a === "withholds-authority" && (act === action || act === "*")) withdrawals.add(by);
  }
  return { affirmations: [...affirmations].filter(Boolean).sort(), withdrawals: [...withdrawals].filter(Boolean).sort() };
}

// recognizesAuthority(by, principal, action, at) / withholdsAuthority(...) — append authority-graph
// evidence the may() fold reads. PURE; returns rows. The action is the value; the witness rides in t.
export function recognizesAuthority(by, principal, action, at) {
  return Object.freeze({ e: asName(principal), a: "recognizes-authority", v: action, t: stamp(by, at) });
}
export function withholdsAuthority(by, principal, action, at) {
  return Object.freeze({ e: asName(principal), a: "withholds-authority", v: action, t: stamp(by, at) });
}

// === small shared helpers ==================================================================
// foldedAttestations(folded, stateOfId) — surface attests:<attribute> cells with their witnesses,
// resolving evidence ids through the one id→party map the recognition cone already built (substrate's
// sectionSpace). No separate witness index — evidence is linear, every contributing id is recoverable.
function foldedAttestations(folded, stateOfId) {
  const out = [];
  for (const c of folded.fiber) {
    if (typeof c.predicate !== "string" || !c.predicate.startsWith("attests:")) continue;
    const [posIds] = c.value.evidence;
    const by = new Set();
    for (const id of posIds) { const s = stateOfId.get(id); if (s != null) by.add(s); }
    out.push(Object.freeze({
      attribute: c.predicate.slice("attests:".length),
      value: c.object,
      by: Object.freeze([...by].sort()),
      contested: !!(c.value.pos && c.value.neg),
    }));
  }
  return out;
}

// decayStanding(t, now, halfLife) — the continuous-auth decay. Standing is 1 at t===now (or when no
// stamp/half-life is given) and HALVES every `halfLife` time-units of age, toward 0 (⊥). A witness is
// "fresh" while standing > 0; with halfLife===Infinity it never decays (standing stays 1). A row whose
// age exceeds a finite cutoff (here, when standing rounds below a small epsilon) has decayed to ⊥.
function decayStanding(t, now, halfLife) {
  if (now === null || now === undefined) return 1;        // no act-time stamp => treat as fresh
  if (t === null || t === undefined) return 0;             // an unstamped witness cannot be dated => ⊥
  if (!Number.isFinite(halfLife) || halfLife <= 0) return 1; // no decay regime => always fresh
  const age = Number(now) - Number(t);
  if (!Number.isFinite(age)) return 0;
  if (age < 0) return 1;                                    // future-stamped (caller's clock) => fresh
  const standing = Math.pow(0.5, age / halfLife);
  return standing < 1e-6 ? 0 : standing;                   // rounded-to-⊥ past ~20 half-lives
}

// respondsTo(challenge) — the Player/Opponent play: does the response answer the issued challenge? A
// minimal structural check (the response carries the issued nonce) — the cryptographic verification is
// the caller's (bytes are theirs); here we model that a MATCHING response is the surviving strategy.
function respondsTo(challenge) {
  if (!challenge || typeof challenge !== "object") return false;
  const issued = challenge.issued;
  const response = challenge.response;
  if (!issued || !response) return false;
  if (response.answers !== undefined && response.answers === issued) return true;
  if (response.nonce !== undefined && response.nonce === issued?.nonce) return true;
  if (response.to !== undefined) return canonicalJson(response.to) === canonicalJson(issued);
  return false;
}

// the default surface — the whole tool as one object, for `import principal from ".../principal"`.
export default Object.freeze({
  recognize, dispute, attest, present,
  whois, authenticated, may, can,
  recognizesAuthority, withholdsAuthority,
  grant, revoke, attenuate, delegate, capabilityRef,
  IDENTITY, IDENTITY_CONVERSE, CAPABILITY_CONVERSE,
});
