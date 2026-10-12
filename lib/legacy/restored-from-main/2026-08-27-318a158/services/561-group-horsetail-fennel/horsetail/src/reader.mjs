// reader — the homoiconic front: s-expressions -> cells. A "cell" here is the read form of code, and
// code is data is a trace: a list reads to a CELL (a JS array tagged as a form), an atom reads to a
// SYMBOL (a typed-path reference) or a self-quoting LITERAL (number, string, charge-name). The reader
// re-derives nothing about meaning — it only sorts bytes into the cell/charge shapes the settler folds.
//
// Atoms read as follows (the spec's "atoms read to charges/typed-paths"):
//   t f ⊥ ⊤ (and bot/top)      -> a CHARGE literal (a FOUR value) — the value algebra's four points
//   123  1.5  -12              -> a number literal
//   "…"                        -> a string literal
//   true/false (bare)          -> a boolean literal (a truth-projection convenience; NOT the charge ⊤/⊥)
//   anything else              -> a SYMBOL: a typed-path reference resolved by the settler's scope/`at`
//
// Lists () read to cells; '(…) is (quote …); `(…) is (quasiquote …); ,x is (unquote x). A cell is
// just a JS array of read forms with no further interpretation — the settler decides what its head means.
// Pure: no fold, no eval, no disk. The bytes are the host's; this only shapes them.

// A SYMBOL is a boxed name so it is never confused with a string LITERAL. Identity is the name.
export class Sym {
  constructor(name) { this.name = name; Object.freeze(this); }
  toString() { return this.name; }
}
export const sym = (name) => new Sym(name);
export const isSym = (x) => x instanceof Sym;

// A CHARGE literal is a boxed FOUR name (t/f/bot/top). Boxed so `t` the value is never a `t` the symbol.
export class ChargeLit {
  constructor(four) { this.four = four; Object.freeze(this); }
  toString() { return this.four; }
}
export const chargeLit = (four) => new ChargeLit(four);
export const isChargeLit = (x) => x instanceof ChargeLit;

// The glyph/word spellings of the four charge points the reader recognizes as a CHARGE literal.
const CHARGE_WORDS = new Map([
  ["t", "t"], ["f", "f"],
  ["⊥", "bot"], ["bot", "bot"], ["bottom", "bot"],
  ["⊤", "top"], ["top", "top"],
]);

// A cell is a tagged array. We tag with a non-enumerable brand so a cell is distinguishable from a bare
// array LITERAL a program might carry as data.
const CELL = Symbol.for("Horsetail.cell");
export const cell = (items) => { const a = [...items]; Object.defineProperty(a, CELL, { value: true }); return a; };
export const isCell = (x) => Array.isArray(x) && x[CELL] === true;

const isDigit = (c) => c >= "0" && c <= "9";

// tokenize — split source into tokens. Parens, quote-marks, strings, and whitespace/comments (`;…`).
function tokenize(src) {
  const toks = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ";") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === " " || c === "\t" || c === "\n" || c === "\r" || c === ",") {
      // a bare comma is unquote ONLY when followed by a non-space; a lone comma is whitespace (like CL).
      if (c === "," && i + 1 < src.length && !" \t\n\r".includes(src[i + 1])) {
        if (src[i + 1] === "@") { toks.push({ t: "unquote-splice" }); i += 2; }
        else { toks.push({ t: "unquote" }); i += 1; }
        continue;
      }
      i++; continue;
    }
    if (c === "(") { toks.push({ t: "(" }); i++; continue; }
    if (c === ")") { toks.push({ t: ")" }); i++; continue; }
    if (c === "'") { toks.push({ t: "quote" }); i++; continue; }
    if (c === "`") { toks.push({ t: "quasiquote" }); i++; continue; }
    if (c === '"') {
      let s = ""; i++;
      while (i < src.length && src[i] !== '"') {
        if (src[i] === "\\" && i + 1 < src.length) { const n = src[i + 1]; s += n === "n" ? "\n" : n === "t" ? "\t" : n; i += 2; }
        else { s += src[i]; i++; }
      }
      if (src[i] !== '"') throw new SyntaxError("reader: unterminated string");
      i++; toks.push({ t: "str", v: s }); continue;
    }
    // an atom: run until a delimiter.
    let a = "";
    while (i < src.length && !"()'`, \t\n\r;\"".includes(src[i])) { a += src[i]; i++; }
    toks.push({ t: "atom", v: a });
  }
  return toks;
}

// atomToForm — classify a bare atom token into a charge literal, number, boolean, or symbol.
function atomToForm(a) {
  if (CHARGE_WORDS.has(a)) return chargeLit(CHARGE_WORDS.get(a));
  if (a === "true") return true;
  if (a === "false") return false;
  // a number: optional sign, digits, optional fraction. Anything else is a symbol (typed-path ref).
  if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(a) && (isDigit(a[0]) || ((a[0] === "+" || a[0] === "-" || a[0] === ".") && a.length > 1))) {
    return Number(a);
  }
  return sym(a);
}

// parse one form from the token stream at position `pos`; returns [form, nextPos].
function parseForm(toks, pos) {
  const tk = toks[pos];
  if (!tk) throw new SyntaxError("reader: unexpected end of input");
  switch (tk.t) {
    case "(": {
      const items = [];
      let p = pos + 1;
      while (toks[p] && toks[p].t !== ")") { const [form, np] = parseForm(toks, p); items.push(form); p = np; }
      if (!toks[p]) throw new SyntaxError("reader: unterminated list");
      return [cell(items), p + 1];
    }
    case ")": throw new SyntaxError("reader: unexpected )");
    case "str": return [tk.v, pos + 1];
    case "atom": return [atomToForm(tk.v), pos + 1];
    case "quote": { const [form, np] = parseForm(toks, pos + 1); return [cell([sym("quote"), form]), np]; }
    case "quasiquote": { const [form, np] = parseForm(toks, pos + 1); return [cell([sym("quasiquote"), form]), np]; }
    case "unquote": { const [form, np] = parseForm(toks, pos + 1); return [cell([sym("unquote"), form]), np]; }
    case "unquote-splice": { const [form, np] = parseForm(toks, pos + 1); return [cell([sym("unquote-splice"), form]), np]; }
    default: throw new SyntaxError(`reader: bad token ${tk.t}`);
  }
}

// read(src) -> the first form. readAll(src) -> every top-level form (a program is a list of forms).
export function read(src) {
  const toks = tokenize(src);
  if (toks.length === 0) throw new SyntaxError("reader: empty input");
  const [form] = parseForm(toks, 0);
  return form;
}

export function readAll(src) {
  const toks = tokenize(src);
  const forms = [];
  let p = 0;
  while (p < toks.length) { const [form, np] = parseForm(toks, p); forms.push(form); p = np; }
  return forms;
}

// write(form) -> the s-expression string of a read form (the print side of homoiconicity). Round-trips
// read: write(read(s)) is s up to whitespace. Lets a macro's output and a quoted trace be shown as code.
export function write(form) {
  if (isCell(form)) return "(" + form.map(write).join(" ") + ")";
  if (isSym(form)) return form.name;
  if (isChargeLit(form)) return form.four;
  if (typeof form === "string") return JSON.stringify(form);
  if (typeof form === "boolean") return String(form);
  if (typeof form === "number") return String(form);
  if (form === null) return "nil";
  return JSON.stringify(form);
}
