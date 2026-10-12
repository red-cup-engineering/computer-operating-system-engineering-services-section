// ascend.ts — the Kleene / Knaster–Tarski ascent: apply a monotone single-step operator until the
// canonical state stops changing (the least fixed point above the seed). `key` canonicalizes a state for
// equality, so the fixpoint is content, not identity. A non-convergent operator hits a typed RangeError,
// not a hang. Pure. (Vendored from computer/mm/term-memory; its own header says it is "destined to
// upstream into @561-group/math" — kept here until that home exists.)
export function ascend<T>(step: (state: T) => T, seed: T, key: (state: T) => string = (x) => JSON.stringify(x), maxRounds = 1024): { value: T; rounds: number } {
  let current = seed;
  let currentKey = key(current);
  for (let round = 0; round < maxRounds; round += 1) {
    const next = step(current);
    const nextKey = key(next);
    if (nextKey === currentKey) return { value: current, rounds: round };
    current = next;
    currentKey = nextKey;
  }
  throw new RangeError(`ascend: no fixed point within ${maxRounds} rounds — operator not convergent on this input`);
}
