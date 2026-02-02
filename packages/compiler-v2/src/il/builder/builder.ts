/**
 * IL Builder - Final Concrete Class
 *
 * The final ILBuilder class that inherits all operations
 * from the inheritance chain:
 *
 * ILBuilderBase → ILBuilderMemory → ILBuilderArithmetic → ILBuilderControl → ILBuilder
 *
 * @module il/builder/builder
 */

import { ILBuilderControl } from './control.js';

/**
 * Complete IL Builder.
 *
 * Provides a fluent API for constructing IL instructions with:
 * - Label management
 * - Memory operations (load/store slots and immediates)
 * - Arithmetic operations (add, sub, mul, div, mod, inc, dec)
 * - Bitwise operations (and, or, xor, not, shl, shr)
 * - Comparison operations (cmp)
 * - Control flow (jump, jumpEq, jumpNe, etc.)
 * - Function operations (call, return)
 * - Register transfers
 * - Intrinsics (peek, poke, hi, lo)
 *
 * @example
 * ```typescript
 * const builder = new ILBuilder();
 *
 * // Generate: for (i = 0; i < 10; i++)
 * const loopLabel = builder.newLabel('for');
 * const endLabel = builder.newLabel('endfor');
 *
 * builder.loadImm(0);
 * builder.storeSlot(iSlot, 'i = 0');
 *
 * builder.label(loopLabel);
 * builder.loadSlot(iSlot);
 * builder.cmpImm(10);
 * builder.jumpGe(endLabel);
 *
 * // Loop body...
 *
 * builder.incSlot(iSlot, 'i++');
 * builder.jump(loopLabel);
 * builder.label(endLabel);
 *
 * const instructions = builder.getInstructions();
 * ```
 */
export class ILBuilder extends ILBuilderControl {
  // The ILBuilder class inherits all functionality from the chain.
  // This class exists as the final concrete class for:
  // - Clean import: `import { ILBuilder } from './builder'`
  // - Extension point: add project-specific methods if needed
  // - Documentation: serves as the main entry point
}