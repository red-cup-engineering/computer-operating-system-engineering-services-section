// number/index.ts — the number tower surface.
export type { Natural } from "./natural.ts";
export {
  zero as natZero, one as natOne,
  members, successor, isZero as natIsZero, equal as natEqual,
  isMember, leq as natLeq, less as natLess, compare as natCompare,
  predecessor, add as natAdd, multiply as natMultiply, monus,
  divmod as natDivmod, gcd, asExtension, extensionOf,
  toCount, fromCount,
} from "./natural.ts";

export type { Integer } from "./integer.ts";
export {
  integer, fromNatural,
  zero as intZero, one as intOne,
  negate as intNegate, add as intAdd, subtract as intSubtract, multiply as intMultiply,
  equal as intEqual, equivalent, isZero as intIsZero, isPositive, isNegative, sign, magnitude,
  divmod as intDivmod, quotient, divides, compare as intCompare,
  toInt, fromInt,
} from "./integer.ts";

export type { Rational } from "./rational.ts";
export {
  rational, fromInteger,
  zero as ratZero, one as ratOne,
  negate as ratNegate, reciprocal, add as ratAdd, subtract as ratSubtract,
  multiply as ratMultiply, divide,
  equal as ratEqual, isZero as ratIsZero, sign as ratSign, compare as ratCompare,
  fromInt as ratFromInt, fromRatio, toNumber,
} from "./rational.ts";

export type { Matrix } from "./matrix.ts";
export {
  transpose as matTranspose, matmul, matEqual, determinant, charPoly,
  smithNormalForm, rank, fromInts,
} from "./matrix.ts";
