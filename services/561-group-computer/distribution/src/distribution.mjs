// distribution — the L9 coordination-free FEDERATION + governance layer, one import.
//
// L9 federation is the tensor ∥ of two append-only worlds: a G-Set union by content-id (jcs->rowId)
// then a per-observer re-fold (the L3 substrate). Conflicting facts settle to ⊤ with BOTH witnesses —
// CALM (union is monotone, so no coordination) and paraconsistent (disagreement is a held value). On
// top of the union rides a FOUR-valued jural/Hohfeldian governance (the REGIMES) and a structural
// bottleneck read (cut-vertices / bridge-edges) over the federated relational graph.
//
// ARCHITECTURE CONTRACT: this layer imports ONLY L2 (jcs) + L3 (substrate) + the math kernel FOUR.
// No coordinator, no clock, no node:fs in the algebra.

// federation: the tensor ∥
export {
  emptyWorld,
  asWorld,
  subjects,
  logFor,
  inertFor,
  allRows,
  admitLog,
  federate,
  mergeWorlds,
  migrate,
  migrateSubjects,
  frontier,
  sectionOf,
  sectionConeOf,
  disagreements,
  contentKey,
  default as federateDefault,
} from "./federate.mjs";

// governance: the FOUR-valued jural regimes
export {
  REGIMES,
  GOV_AXES,
  KNOWN_REGIME_FAMILIES,
  DEFAULT_REGIME,
  regimeNames,
  selectRegime,
  admitUnder,
  governAction,
} from "./governance.mjs";

// cost: structural bottleneck detection
export { costGraphSummary } from "./cost.mjs";
