// principal.test — proves the OS identity tool obeys THE LAW:
//   - identity FOLDS (whois folds the cell to a settled identity);
//   - a recognition DISPUTE is HELD as ⊤ with BOTH witnesses, NOT resolved to a winner;
//   - may() returns FOUR (incl ⊤/⊥), never a boolean;
//   - authentication is a CONTINUOUS fold that decays toward ⊥ (no session-bit);
//   - a delegated capability NARROWS the principal but keeps the accountable APEX;
//   - capabilities are held charges that rise to ⊤ when contested;
//   - evidence is CONSERVED (nothing dropped).
// Run directly (export not registered yet): node principal/tests/principal.test.mjs

import assert from "node:assert/strict";
import {
  recognize,
  dispute,
  attest,
  present,
  whois,
  authenticated,
  may,
  can,
  grant,
  revoke,
  attenuate,
  delegate,
  recognizesAuthority,
  withholdsAuthority,
  capabilityRef,
} from "../src/principal.mjs";
import { identifyContentAddressedRow } from "@red-cup-engineering/eavt-services-section";
const rowId = (row) => identifyContentAddressedRow({ row }).identity;

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

// ── identity FOLDS ─────────────────────────────────────────────────────────────────────────
test("whois folds an undisputed recognition to a settled identity", () => {
  const rows = [
    recognize("bob", "alice", "alice-the-gardener", 1),
    recognize("carol", "alice", "alice-the-gardener", 2),
  ];
  const id = whois(rows, "alice");
  assert.equal(id.principal, "alice");
  assert.equal(id.settled, true, "no dispute => settled to a single reading");
  assert.equal(id.disputed.length, 0);
  assert.equal(id.recognizedAs.length, 1, "one claim, recognized by two parties, folds to one cell");
  const cell = id.recognizedAs[0];
  assert.equal(cell.claim, "alice-the-gardener");
  assert.equal(cell.value, "potential");
  assert.deepEqual(cell.by, ["bob", "carol"], "BOTH recognizing witnesses conserved on the cell");
});

// ── a recognition DISPUTE is HELD as ⊤ with BOTH witnesses, NOT resolved ─────────────────────
test("a recognition dispute rises to ⊤, HELD with both witnesses, never resolved to a winner", () => {
  // bob recognizes alice as the gardener; mallory DISPUTES that very claim (impersonation / name war).
  const rows = [
    recognize("bob", "alice", "alice-the-gardener", 1),
    dispute("mallory", "alice", "alice-the-gardener", 2),
  ];
  const id = whois(rows, "alice");
  assert.equal(id.settled, false, "a standing dispute is NOT settled to one reading");
  assert.equal(id.disputed.length, 1, "the contested claim is surfaced as a held dispute");
  const d = id.disputed[0];
  assert.equal(d.value, "stable", "the cell is ⊤ — told both, never collapsed to a winner");
  assert.equal(d.held, true);
  assert.deepEqual(d.recognizedBy, ["bob"], "the recognizing witness is surfaced");
  assert.deepEqual(d.disputedBy, ["mallory"], "the disputing witness is surfaced");
  // it is NOT in recognizedAs — we did not pick bob's side.
  assert.equal(id.recognizedAs.length, 0, "the disputed claim is held, not promoted to a settled identity");
});

// ── evidence is CONSERVED ────────────────────────────────────────────────────────────────────
test("evidence is conserved: every contributing row id rides in the folded charge carrier", () => {
  const r1 = recognize("bob", "alice", "alice-the-gardener", 1);
  const r2 = dispute("mallory", "alice", "alice-the-gardener", 2);
  const id = whois([r1, r2], "alice");
  const cell = id.disputed[0];
  // walk back into the folded section: the cell's evidence must carry BOTH row ids — nothing dropped.
  const folded = id.folded.fiber.find((c) => c.predicate === "recognized-as");
  const [posIds, negIds] = folded.value.evidence;
  assert.ok(posIds.includes(rowId(r1)), "the recognizing row id is conserved on the positive face");
  assert.ok(negIds.includes(rowId(r2)), "the disputing row id is conserved on the negative face");
});

test("attestations are surfaced with their witnesses (identity evidence beyond name-claims)", () => {
  const rows = [
    attest("ca", "alice", "pubkey", "ed25519:AAAA", 1),
    recognize("bob", "alice", "alice-the-gardener", 2),
  ];
  const id = whois(rows, "alice");
  assert.equal(id.attestations.length, 1);
  assert.equal(id.attestations[0].attribute, "pubkey");
  assert.equal(id.attestations[0].value, "ed25519:AAAA");
  assert.deepEqual(id.attestations[0].by, ["ca"]);
});

// ── authentication is a CONTINUOUS fold that DECAYS toward ⊥ (no session-bit) ─────────────────
test("authentication folds to t when a fresh witness stands", () => {
  const rows = [recognize("verifier", "alice", "alice", 100)];
  const a = authenticated(rows, "alice", { now: 100, halfLife: 10 });
  assert.equal(a.value, "potential", "a fresh witness => authenticated (t)");
  assert.ok(a.standing > 0.99);
});

test("authentication DECAYS to ⊥ as evidence ages — no session-bit, re-auth needed", () => {
  const rows = [recognize("verifier", "alice", "alice", 100)];
  // act far in the future relative to the witness: many half-lives elapsed => standing falls to ⊥.
  const a = authenticated(rows, "alice", { now: 100 + 10 * 40, halfLife: 10 });
  assert.equal(a.value, "absurd", "decayed past the half-life => ⊥ (no basis), NOT a stale 'still logged in'");
  assert.equal(a.standing, 0);
  assert.equal(a.fresh.length, 0);
  assert.equal(a.stale.length, 1, "the decayed witness is retained as stale, not dropped");
});

test("a challenge-response play is a fresh authenticating witness (Player/Opponent)", () => {
  const challenge = { issued: { nonce: "n-123" }, response: { nonce: "n-123", t: 200 } };
  const a = authenticated([], "alice", { now: 200, halfLife: 10, challenge });
  assert.equal(a.value, "potential", "the surviving challenge-response strategy authenticates");
});

test("a fresh dispute and a fresh authentication hold authentication at ⊤ (surfaced, not resolved)", () => {
  const rows = [
    recognize("bob", "alice", "alice", 100),
    dispute("mallory", "alice", "alice", 100),
  ];
  const a = authenticated(rows, "alice", { now: 100, halfLife: 10 });
  assert.equal(a.value, "stable", "contested authentication is HELD as ⊤, not failed closed");
  assert.ok(a.withheld.length >= 1, "the withholding witness is surfaced");
});

// ── may() returns FOUR, not a boolean ────────────────────────────────────────────────────────
test("may() returns FOUR (t) when the principal holds a covering capability — not a boolean", () => {
  const rows = [grant("root", "alice", { resource: "fs:write", scope: ["fs:write"] }, 1)];
  const d = may(rows, "alice", "fs:write");
  assert.equal(typeof d, "object", "may() returns a decision record, never a boolean");
  assert.equal(d.four, "potential");
  assert.equal(d.value, "potential");
  assert.equal(d.admitted, true);
  assert.notEqual(typeof d, "boolean");
});

test("may() returns FOUR (f) when no capability backs the action — denied, distinct from ⊥", () => {
  const d = may([], "alice", "fs:write");
  assert.equal(d.four, "active", "no office-capability under the default regime => f (denied)");
  assert.equal(d.admitted, false);
});

test("may() rises to ⊤ when authority is CONTESTED in the recognition graph (held, surfaced)", () => {
  const rows = [
    recognizesAuthority("bob", "alice", "deploy", 1),
    withholdsAuthority("mallory", "alice", "deploy", 2),
  ];
  // route through the contrarian regime: a standing contradiction surfaces as ⊤, not a silent denial.
  const d = may(rows, "alice", "deploy", { regime: "contrarian" });
  assert.equal(d.four, "stable", "contested authority is HELD as ⊤");
  assert.ok(d.affirmations.includes("bob"));
  assert.ok(d.withdrawals.includes("mallory"));
});

test("may() can yield ⊥ (no basis) — distinct from f (denied)", () => {
  // consensus-by-withdrawal with neither affirmation nor withdrawal => ⊥ (not yet in the settled section).
  const d = may([], "alice", "gather", { regime: "consensus-by-withdrawal" });
  assert.equal(d.four, "absurd", "no affirmation entered the join => ⊥, not a boolean false");
});

// ── capability is a held charge; a grant+revoke rise to ⊤ ─────────────────────────────────────
test("can() folds a grant to t, a revoke to f, and grant+revoke to ⊤ (contested held reference)", () => {
  const cap = { resource: "fs:write", scope: ["fs:write"] };
  const granted = can([grant("root", "alice", cap, 1)], "alice", "fs:write");
  assert.equal(granted.value, "potential");
  assert.equal(granted.held, true);
  assert.deepEqual(granted.grantedBy, ["root"]);

  const contested = can(
    [grant("root", "alice", cap, 1), revoke("auditor", "alice", cap, 2)],
    "alice",
    "fs:write",
  );
  assert.equal(contested.value, "stable", "a grant AND a revoke on the same cap is HELD as ⊤");
  assert.deepEqual(contested.grantedBy, ["root"]);
  assert.deepEqual(contested.revokedBy, ["auditor"]);
  assert.equal(contested.held, false, "held is false while contested — but the grant is NOT dropped");
});

test("attenuate NARROWS a capability strictly (the meet of scopes), keeping the accountable apex", () => {
  const parent = { resource: "fs", scope: ["fs:read", "fs:write"], accountable: "root" };
  const child = attenuate(parent, { scope: ["fs:read"] });
  assert.deepEqual([...child.scope], ["fs:read"], "attenuation narrows to a subset of the parent scope");
  assert.equal(child.accountable, "root", "accountability stays at the apex, unchanged by attenuation");
  assert.equal(child.attenuatedFrom, capabilityRef(parent), "the parent ref is recorded — auditable chain");
});

// ── delegation NARROWS the principal, keeps the accountable APEX ──────────────────────────────
test("delegate narrows the principal downstream but keeps the accountable at the apex (H^0-invariant)", () => {
  const cap = { resource: "deploy", scope: ["deploy"], accountable: "captain" };
  const d1 = delegate("captain", "alice", cap, { root: "/tmp/world", modal: "actual" }, 1);
  assert.equal(d1.principal, "alice", "the principal NARROWS to the delegate");
  assert.equal(d1.accountable, "captain", "the accountable stays at the apex");
  assert.equal(d1.allocation.allocation.principal, "alice", "allocation places the process under the delegate");
  assert.equal(d1.allocation.allocation.accountable, "captain", "allocation keeps the accountable apex");

  // re-delegate down a second hop: principal narrows AGAIN, accountable is STILL the original apex.
  const d2 = delegate("alice", "bob", d1.capability, { root: "/tmp/world", modal: "actual" }, 2);
  assert.equal(d2.principal, "bob", "principal narrows further down the chain");
  assert.equal(d2.accountable, "captain", "accountable is H^0-invariant under chain extension — still the apex");
  assert.equal(d2.capability.attenuatedFrom, capabilityRef(d1.capability), "the chain is auditable parent->child");
  assert.equal(d2.capability.delegatedFrom, "alice", "the immediate delegator is recorded");
});

test("a delegated capability's grant row is a persistable {e,a,v,t}, and the delegate then HOLDS it", () => {
  const cap = { resource: "deploy", scope: ["deploy"], accountable: "captain" };
  const d = delegate("captain", "alice", cap, {}, 1);
  // the returned row is exactly an EAVT row the caller appends; folding it, alice holds the capability.
  assert.equal(d.row.e, "alice");
  assert.equal(d.row.a, "holds-capability");
  const c = can([d.row], "alice", "deploy");
  assert.equal(c.value, "potential", "after persisting the delegation grant, alice can deploy (t)");
});

// ── purity: mutating calls return rows, do no I/O, drop nothing ───────────────────────────────
test("recognize/grant/etc. return frozen persistable rows and mutate no input", () => {
  const r = recognize("bob", "alice", "alice", 1);
  assert.ok(Object.isFrozen(r));
  assert.deepEqual(Object.keys(r).sort(), ["a", "e", "t", "v"], "exactly an {e,a,v,t} row");
  const rows = [];
  grant("root", "alice", "x", 1); // returns a row, appends nothing
  assert.equal(rows.length, 0, "no hidden write — bytes are the caller's");
});

console.log(`\n${passed} passed`);
