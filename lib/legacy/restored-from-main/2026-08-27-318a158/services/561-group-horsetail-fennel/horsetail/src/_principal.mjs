// _principal — the one place Horsetail names the OS identity tool (computer/principal). The (as principal …)
// form consults `may(rows, principal, action)` — a FOUR-valued authority fold over the trace
// (governAction): t may, f may-not, ⊥ no basis, ⊤ contested (HELD, surfaced not denied). Pure over the
// substrate (no write; mutating fns return rows). Re-exported so the evaluator imports a stable surface.
//
// Note: computer/package.json does NOT yet export a `./principal` subpath; Horsetail reaches the tool
// relatively (the same module). If the tool ever moves, this is the single edit. The `as` form degrades
// gracefully if the import surface changes — see the evaluator's try/catch around the authority read.
export { may, can, recognize } from "../../principal/src/principal-barrel.mjs";
