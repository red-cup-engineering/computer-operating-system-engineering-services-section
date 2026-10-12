// Token and Claim do not decompose — they are the two non-assembling primitives where articulation
// bottoms out. As TypeScript type aliases of `unknown` they carry no structural constraint; their
// purpose is vocabulary: mark a position as identity-carrying (token) or content-carrying (claim).

/** Token: the identity-carrying side of an utterance. Non-assembling; does not decompose further. */

/** Claim: the content-carrying side of an utterance. Non-assembling; does not decompose further. */

/** Utterance: the bare two-fold [token, claim] — the input to articulate. */

/** Bit: the unit of informational-spacetime. A carrier (utterance) paired with two witness slots.
 * The four charge phases are the bit's possible states, read from slot occupancy:
 *   slots [[], []]    absurd    (⊥ [F,F]) — both slots empty, no information
 *   slots [[t], []]   potential ([T,F])   — token slot filled, claim slot empty
 *   slots [[], [c]]   active    ([F,T])   — token slot empty, claim slot filled
 *   slots [[t], [c]]  stable    (⊤ [T,T]) — both slots filled */

export const isBit = (x) => {
  if (typeof x !== "object" || x === null) return false;
  if (!("carrier" in x) || !("slots" in x)) return false;
  const { carrier, slots } = x;
  if (!Array.isArray(carrier) || carrier.length !== 2) return false;
  if (!Array.isArray(slots) || slots.length !== 2) return false;
  if (!Array.isArray(slots[0]) || !Array.isArray(slots[1])) return false;
  return true;
};
