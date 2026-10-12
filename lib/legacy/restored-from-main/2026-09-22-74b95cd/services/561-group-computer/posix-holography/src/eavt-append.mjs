// eavt-append — the public entry for the durable single-row eavt append (OP1/OP2/OP4). A default-exporting
// surface over eavt.mjs's appendEavt, since consumers (TTMS write, tab, capture, …) import it as a default.
export { appendEavt as default } from "./eavt.mjs";
