// _substrate — the one place Horsetail names the substrate's path. The OS substrate (L3) is the
// settler's engine: fold/settle/section/relate/relate-from + row identity. Re-exported here so the
// evaluator imports a stable surface.
//
// RECOVERY NOTE (see horsetail/README.md "Recovery notes" and this package's top-level README): at the
// last commit before computer/ was archived (cd6b4e97704), this file pointed at posix-holography's
// PRE-flatten deep library/... path even though that same commit's own diff flattened posix-holography
// into src/*.mjs — an in-flight-refactor oversight (only horsetail/README.md was touched in that
// commit, not this file), so horsetail's own tests could not have run at that final commit. Then,
// horsetail lived inside the same package as posix-holography (computer/), so it reached the substrate
// with a relative import. Recovered here as its OWN package (@561-group/horsetail), sibling to
// @561-group/computer rather than re-inserted into it (see this package's README), so the substrate is
// now a real cross-package dependency, reached the same way every other consumer reaches it.
export {
  fold, settle, section, sectionSpace, relate, relateFrom, supersede,
  rowId, assertRow, dedupe, jcs, reify, isReified,
} from "@561-group/computer/posix-holography/eavt-substrate";
