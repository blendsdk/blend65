/**
 * Re-export shim — the symbolic instruction-operand model now lives in
 * `@blend65/core`. Preserves the historical `./operand.js` import path so
 * existing code and tests resolve unchanged **by value**.
 *
 * Definitions moved to `@blend65/core/instr-model/operand.ts` (surfaced via the
 * `@blend65/core/platform` subpath).
 */

export type { InstrOperand } from "@blend65/core/platform";
export {
  none,
  imm8,
  symbolRef,
  symbolExpr,
  labelRef,
  zpSlot,
  isImmediateOperand,
  isSymbolRef,
  isSymbolExprOperand,
  isLabelRef,
  isZpSlot,
} from "@blend65/core/platform";
