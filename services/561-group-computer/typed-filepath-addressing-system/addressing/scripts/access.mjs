// access — the membrane access guard (L13, Unit C). One read-only consult of principal recognition, with
// the FOUR→act projection the spec fixes, returning an L9b fault on refusal rather than throwing.
//
// This is NOT an authority of its own: it IMPORTS the recognition read `can` from the principal tool
// (@red-cup-engineering/computer/principal — READ-ONLY; we append nothing, decide nothing the trace doesn't already
// hold) and folds it to an admit/deny at the membrane. The capability reading is FOUR-valued; the boolean
// gate is taken HERE, at the membrane act-edge (L13), and a balanced ⊤ is a CONTEST, never an invented
// winner — it is HELD and surfaced (deny-but-surface), both witness sets conserved.
//
//   potential -> admit           ({ ok:true, recognition })
//   active    -> deny-with-witness (fault face:'active', condition:'denied',    witnesses: the deniers)
//   absurd    -> no-basis (deny)   (fault face:'absurd', condition:'absent',    witnesses: [] - ENOENT-class)
//   stable    -> contested, HELD   (fault face:'stable', condition:'contended', witnesses: BOTH faces)
import { can } from "@red-cup-engineering/computer/principal";
import { evidence } from "@red-cup-engineering/signcell/cell";

// guardAccess(world, principal, action, mode) ->
//   null                              when NO principal is supplied (back-compat passthrough)
//   { ok:true,  recognition }         when admitted (FOUR t)
//   { ok:false, fault }               when denied/no-basis/contested — fault is the L9b payload
//                                     { face, condition, evidence, witnesses } the membrane RETURNS (no throw).
//
// `action` is the RESOURCE coordinate a capability is scoped over — the bare term/path (object-capability).
// `mode` is the membrane verb (carried on the fault for audit); it does NOT narrow the capability scope.
export function guardAccess(world, principal, action, mode) {
  if (principal === undefined || principal === null) return null; // unauthenticated back-compat
  const rows = world ?? [];
  const recognition = can(rows, principal, action);
  const face = recognition.value; // a reading: potential | active | absurd | stable

  if (face === "potential") return { ok: true, recognition };

  // a refusal: its evidence is the granting ids for and the revoking ids against (the held ⊤ is conserved
  // as both sides told, not collapsed) — evidence is linear.
  const refusalEvidence = evidence({ for: recognition.grantedBy ?? [], against: recognition.revokedBy ?? [] });
  return { ok: false, fault: faultFor(face, refusalEvidence, recognition, action, mode) };
}

// faultFor — the L9b fault payload for a non-admit FOUR face. f and ⊤ surface their honest channel and
// BOTH witness sets where held; ⊥ is the no-basis (ENOENT-class) refusal under the default deny policy.
function faultFor(face, refusalEvidence, recognition, action, mode) {
  const { grantedBy, revokedBy, principal } = recognition;
  let channel, condition, witnesses;
  if (face === "stable") {
    channel = "stable"; condition = "contended";       // held — never resolved to a winner
    witnesses = [grantedBy, revokedBy];             // BOTH sets surfaced
  } else if (face === "active") {
    channel = "active"; condition = "denied";            // EACCES — the deniers are the witnesses
    witnesses = revokedBy;
  } else {
    channel = "absurd"; condition = "absent";          // ⊥ — no capability stands (ENOENT-class no-basis)
    witnesses = [];
  }
  return Object.freeze({ face: channel, condition, evidence: refusalEvidence, witnesses, action, mode, principal });
}

