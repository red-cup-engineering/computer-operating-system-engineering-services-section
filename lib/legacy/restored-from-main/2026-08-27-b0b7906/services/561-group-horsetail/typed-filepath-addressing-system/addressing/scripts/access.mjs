// access — the membrane access guard (L13, Unit C). One read-only consult of principal recognition, with
// the FOUR→act projection the spec fixes, returning an L9b fault on refusal rather than throwing.
//
// This is NOT an authority of its own: it IMPORTS the recognition read `can` from the principal tool
// (@561-group/horsetail/principal — READ-ONLY; we append nothing, decide nothing the trace doesn't already
// hold) and folds it to an admit/deny at the membrane. The capability charge is FOUR-valued; the boolean
// gate is taken HERE, at the membrane act-edge (L13), and a balanced ⊤ is a CONTEST, never an invented
// winner — it is HELD and surfaced (deny-but-surface), both witness sets conserved.
//
//   t   → admit   ({ ok:true, recognition })
//   f   → deny-with-witness     (fault face:'f',   condition:'denied',    witnesses: the deniers)
//   ⊥   → no-basis (deny)       (fault face:'bot', condition:'absent',    witnesses: [] — ENOENT-class)
//   ⊤   → contested, HELD       (fault face:'top', condition:'contended', witnesses: BOTH faces)
import { can } from "@561-group/horsetail/principal";
import { FOUR, toCharge } from "@lenticule-science/metrologic/chu/four";

// guardAccess(world, principal, action, mode) ->
//   null                              when NO principal is supplied (back-compat passthrough)
//   { ok:true,  recognition }         when admitted (FOUR t)
//   { ok:false, fault }               when denied/no-basis/contested — fault is the L9b payload
//                                     { face, condition, charge, witnesses } the membrane RETURNS (no throw).
//
// `action` is the RESOURCE coordinate a capability is scoped over — the bare term/path (object-capability).
// `mode` is the membrane verb (carried on the fault for audit); it does NOT narrow the capability scope.
export function guardAccess(world, principal, action, mode) {
  if (principal === undefined || principal === null) return null; // unauthenticated back-compat
  const rows = world ?? [];
  const recognition = can(rows, principal, action);
  const face = recognition.value; // FOUR: 't' | 'f' | 'bot' | 'top'

  if (face === FOUR.T) return { ok: true, recognition };

  // a refusal: the charge is the kernel charge of the deciding FOUR face (the held ⊤ is conserved as
  // [true,true], not collapsed); witnesses are the disputing/granting ids — evidence is linear.
  const charge = withWitnesses(toCharge(face), recognition.grantedBy, recognition.revokedBy);
  return { ok: false, fault: faultFor(face, charge, recognition, action, mode) };
}

// faultFor — the L9b fault payload for a non-admit FOUR face. f and ⊤ surface their honest channel and
// BOTH witness sets where held; ⊥ is the no-basis (ENOENT-class) refusal under the default deny policy.
function faultFor(face, charge, recognition, action, mode) {
  const { grantedBy, revokedBy, principal } = recognition;
  let channel, condition, witnesses;
  if (face === FOUR.TOP) {
    channel = "top"; condition = "contended";       // held — never resolved to a winner
    witnesses = [grantedBy, revokedBy];             // BOTH sets surfaced
  } else if (face === FOUR.F) {
    channel = "f"; condition = "denied";            // EACCES — the deniers are the witnesses
    witnesses = revokedBy;
  } else {
    channel = "bot"; condition = "absent";          // ⊥ — no capability stands (ENOENT-class no-basis)
    witnesses = [];
  }
  return Object.freeze({ face: channel, condition, charge, witnesses, action, mode, principal });
}

// withWitnesses — carry the granting/revoking parties into the kernel charge's lossless evidence carrier
// (evidence:[posWitnessIds[], negWitnessIds[]]). Evidence is linear: no witness is dropped.
function withWitnesses(charge, grantedBy = [], revokedBy = []) {
  return Object.freeze({ value: charge.value, evidence: [[...grantedBy], [...revokedBy]] });
}
