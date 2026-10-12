// chu/index.ts — the Chu module surface.
export type { Four } from "./four.ts";
export {
  FOUR, GLYPH, isFour, asFour, toCharge, fromCharge,
  negate, conflate, knowledgeJoin, knowledgeMeet, truthJoin, truthMeet,
} from "./four.ts";

export type { ChuSpace, ChuCell, ChuCoCell } from "./chu.ts";
export {
  chuSpace, fromMatrix, row, col, extension, transpose, dual,
  settleColumn, settleRow, isChuSpace,
} from "./chu.ts";

export type { ChuForward, ChuBackward, ChuFailure, ChuCheckResult, ChuTransform } from "./chu-transform.ts";
export {
  checkChuTransform, chuTransform, isChuTransform,
  idTransform, composeTransforms, dualTransform,
} from "./chu-transform.ts";
