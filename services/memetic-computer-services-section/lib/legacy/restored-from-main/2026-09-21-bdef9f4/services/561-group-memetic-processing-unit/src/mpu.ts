// mpu.ts — the Memetic Processing Unit.
import type { Cell, Charge, Valuation, Sheaf, Posited } from "@561-group/meme";
import { compare, settleTraced } from "./descent.ts";
import { compose, chargeAt, memeChargeOf, positedFrom, type Witness, type MemeCharge } from "./compose.ts";
import { brim as _brim, adjudicate as _adjudicate, presume as _presume } from "./cone.ts";
import { vanish as _vanish, type GapInterval } from "./void.ts";
import { stringify as S } from "./internal.ts";

export class Mpu {
  #witnesses: Witness[] = [];

  /** articulate(token, claim, object?) — admit an AFFIRMING utterance.  If `object` is given, the
   * cell is `{subject: token, predicate: claim, object}`; otherwise self-referential.  Chainable. */
  articulate(token: unknown, claim: unknown, object?: unknown): this {
    if (token === undefined || claim === undefined) {
      throw new TypeError("articulate: malformed utterance — expected (token, claim), both given");
    }
    this.#witnesses.push(object !== undefined ? [token, claim, object] : [token, claim]);
    return this;
  }

  /** deny(token, claim, object?) — admit a DENYING utterance.  Chainable. */
  deny(token: unknown, claim: unknown, object?: unknown): this {
    if (token === undefined || claim === undefined) {
      throw new TypeError("deny: malformed utterance — expected (token, claim), both given");
    }
    this.#witnesses.push(object !== undefined ? [token, claim, object, false] : [token, claim, false]);
    return this;
  }

  /** witness(w) — admit a raw Witness tuple.  Chainable. */
  witness(w: Witness): this {
    this.#witnesses.push(w);
    return this;
  }

  // ── closures ──────────────────────────────────────────────────────────────

  /** settle() — drive the whole KB through the descent and return the glued sheaf. */
  settle(): Sheaf {
    return compose(this.#witnesses);
  }

  /** settleFull() — settle with the full modal history and closure depth. */
  settleFull(): { sheaf: Sheaf; history: readonly Valuation[]; depth: number } {
    return settleTraced(this.posited());
  }

  /** section() — the settled section (the sheaf's valuation). */
  section(): Valuation {
    return this.settle().section;
  }

  /** posited() — wrap the assembled section as a KB-level Posited for cone/void operations. */
  posited(): Posited {
    return positedFrom(this.section());
  }

  /** compare() — split the settled section into consistent (absurd/potential/active) and
   * paraconsistent (stable) parts. */
  compare(): { consistent: Valuation; paraconsistent: Valuation } {
    return compare(this.section());
  }

  // ── cone duals ────────────────────────────────────────────────────────────

  /** brim() — knowledge GFP: raises every free negative bit to ⊤. */
  brim(): { cone: Sheaf } {
    return _brim(this.posited());
  }

  /** adjudicate() — truth LFP: the minimal truth-closed valuation. */
  adjudicate(): { verdict: Sheaf } {
    return _adjudicate(this.posited());
  }

  /** presume() — truth GFP: raises free negatives toward potential, then truth-closes. */
  presume(): { presumption: Sheaf } {
    return _presume(this.posited());
  }

  // ── void ─────────────────────────────────────────────────────────────────

  /** vanish() — gap(settle, brim): the cells underdetermined between LFP and GFP. */
  vanish(): { apex: readonly Cell[]; evidence: readonly GapInterval[] } {
    return _vanish(this.posited());
  }

  // ── projections ───────────────────────────────────────────────────────────

  /** chargeAt(token, claim, object?) — the folded word of one cell (absurd if absent).
   * When no explicit object is given, uses the self-referential cell (object = token). */
  chargeAt(token: unknown, claim: unknown, object?: unknown): Charge {
    return chargeAt(this.section(), { subject: token, predicate: claim, object: object ?? token });
  }

  /** memeCharge(token, claim, object?) — the MemeCharge of one cell. */
  memeCharge(token: unknown, claim: unknown, object?: unknown): MemeCharge {
    return memeChargeOf(this.chargeAt(token, claim, object));
  }

  /** claimsFor(token) — enumerate every claim recorded about a token, across all predicates. */
  claimsFor(token: unknown): Array<{ claim: unknown; object: unknown; charge: Charge; memeCharge: MemeCharge }> {
    const tk = S(token);
    const result: Array<{ claim: unknown; object: unknown; charge: Charge; memeCharge: MemeCharge }> = [];
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
  subjectsFor(claim: unknown): Array<{ subject: unknown; object: unknown; charge: Charge; memeCharge: MemeCharge }> {
    const ck = S(claim);
    const result: Array<{ subject: unknown; object: unknown; charge: Charge; memeCharge: MemeCharge }> = [];
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
  get witnesses(): readonly Witness[] {
    return this.#witnesses.map((w) => [...w] as Witness);
  }
}

export default Mpu;
