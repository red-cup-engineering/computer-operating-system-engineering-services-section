// principal (barrel) — the one-import surface of the OS identity tool. Re-exports the principal tool's
// functions so a consumer gets the whole surface from `@red-cup-engineering/computer/principal`.
//
// The tool is PURE over the substrate (no node:fs, no write); every mutating function RETURNS the
// {e,a,v,t} rows the caller persists. Identity is a settled, contestable charge — recognition not
// registry, capability not credential, continuous-fold not session-bit, ⊤-held-dispute not denial.
export {
  // identity evidence (append rows ABOUT a principal)
  recognize,
  dispute,
  attest,
  present,
  // identity fold
  whois,
  // continuous authentication fold
  authenticated,
  // authority fold (FOUR-valued, via governAction)
  may,
  can,
  // authority-graph evidence
  recognizesAuthority,
  withholdsAuthority,
  // capability-as-charge
  grant,
  revoke,
  attenuate,
  delegate,
  capabilityRef,
  // the predicate constants + converse maps the substrate folds under
  IDENTITY,
  IDENTITY_CONVERSE,
  CAPABILITY_CONVERSE,
} from "./principal.mjs";

export { default } from "./principal.mjs";
