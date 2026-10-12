// mpu.ts — the Memetic Processing Unit.

import { compare, settleTraced } from "@red-cup-engineering/computer-systems-engineering-services-section/signcraft/descent";
import { compose, chargeAt, memeChargeOf, positedFrom } from "./compose.mjs";
import { brim as _brim, adjudicate as _adjudicate, presume as _presume } from "@red-cup-engineering/computer-systems-engineering-services-section/signcraft/cone";
import { vanish as _vanish } from "@red-cup-engineering/computer-systems-engineering-services-section/signcraft/void";
import { stringify as S } from "./internal.mjs";

export class Mpu {
  #witnesses = [];

  /** articulate(token, claim, object?) — admit an AFFIRMING utterance.  If `object` is given, the
   * cell is `{subject: token, predicate: claim, object}`; otherwise self-referential.  Chainable. */
  articulate(token, claim, object) {
    if (token === undefined || claim === undefined) {
      throw new TypeError("articulate: malformed utterance — expected (token, claim), both given");
    }
    this.#witnesses.push(object !== undefined ? [token, claim, object] : [token, claim]);
    return this;
  }

  /** deny(token, claim, object?) — admit a DENYING utterance.  Chainable. */
  deny(token, claim, object) {
    if (token === undefined || claim === undefined) {
      throw new TypeError("deny: malformed utterance — expected (token, claim), both given");
    }
    this.#witnesses.push(object !== undefined ? [token, claim, object, false] : [token, claim, false]);
    return this;
  }

  /** witness(w) — admit a raw Witness tuple.  Chainable. */
  witness(w) {
    this.#witnesses.push(w);
    return this;
  }

  // ── closures ──────────────────────────────────────────────────────────────

  /** settle() — drive the whole KB through the descent and return the glued sheaf. */
  settle() {
    return compose(this.#witnesses);
  }

  /** settleFull() — settle with the full modal history and closure depth. */
  settleFull() {
    return settleTraced(this.posited());
  }

  /** section() — the settled section (the sheaf's valuation). */
  section() {
    return this.settle().section;
  }

  /** posited() — wrap the assembled section as a KB-level Posited for cone/void operations. */
  posited() {
    return positedFrom(this.section());
  }

  /** compare() — split the settled section into consistent (absurd/potential/active) and
   * paraconsistent (stable) parts. */
  compare() {
    return compare(this.section());
  }

  // ── cone duals ────────────────────────────────────────────────────────────

  /** brim() — knowledge GFP: raises every free negative bit to ⊤. */
  brim() {
    return _brim(this.posited());
  }

  /** adjudicate() — truth LFP: the minimal truth-closed valuation. */
  adjudicate() {
    return _adjudicate(this.posited());
  }

  /** presume() — truth GFP: raises free negatives toward potential, then truth-closes. */
  presume() {
    return _presume(this.posited());
  }

  // ── void ─────────────────────────────────────────────────────────────────

  /** vanish() — gap(settle, brim): the cells underdetermined between LFP and GFP. */
  vanish() {
    return _vanish(this.posited());
  }

  // ── projections ───────────────────────────────────────────────────────────

  /** chargeAt(token, claim, object?) — the folded word of one cell (absurd if absent).
   * When no explicit object is given, uses the self-referential cell (object = token). */
  chargeAt(token, claim, object) {
    return chargeAt(this.section(), { subject: token, predicate: claim, object: object ?? token });
  }

  /** memeCharge(token, claim, object?) — the MemeCharge of one cell. */
  memeCharge(token, claim, object) {
    return memeChargeOf(this.chargeAt(token, claim, object));
  }

  /** claimsFor(token) — enumerate every claim recorded about a token, across all predicates. */
  claimsFor(token) {
    const tk = S(token);
    const result = [];
    for (const fa of this.section()["fiber-algebras"]) {
      for (const { cell, charge } of fa.assignments) {
        if (S(cell.subject) === tk) {
          result.push({ claim: cell.predicate, object: cell.object, charge, memeCharge: memeChargeOf(charge) });
        }
      }
    }
    return result;
  }

  /** subjectsFor(claim) — enumerate every subject recorded under a given claim (predicate). */
  subjectsFor(claim) {
    const ck = S(claim);
    const result = [];
    for (const fa of this.section()["fiber-algebras"]) {
      if (S(fa.predicate) === ck) {
        for (const { cell, charge } of fa.assignments) {
          result.push({ subject: cell.subject, object: cell.object, charge, memeCharge: memeChargeOf(charge) });
        }
      }
    }
    return result;
  }

  /** witnesses — a copy of the accretive memory log. */
  get witnesses() {
    return this.#witnesses.map((w) => [...w]);
  }
}

export default Mpu;
