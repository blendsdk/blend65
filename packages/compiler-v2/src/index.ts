/**
 * Blend65 Compiler v2
 *
 * A compiler for the Blend65 language targeting 6502-based systems
 * using Static Frame Allocation (SFA) architecture.
 *
 * **Key Features:**
 * - No SSA - Simple linear IL with direct memory addresses
 * - Static Frame Allocation - Each function gets a fixed memory region
 * - No recursion support - Compile-time cycle detection
 * - Simple accumulator-centric code generation
 *
 * **Pipeline:**
 * - Lexer: Source → Tokens
 * - Parser: Tokens → AST
 * - Semantic: Type checking, symbol resolution, recursion detection
 * - Frame Allocator: Assign static addresses to function frames
 * - IL Generator: AST + Frames → Simple Linear IL
 * - Code Generator: IL → 6502 Assembly
 * - ASM Optimizer: Peephole optimization
 *
 * @packageDocumentation
 * @module @blend65/compiler-v2
 */

// Version info
export const VERSION = '0.1.0';

// Module exports - populated as modules are implemented
export * from './lexer/index.js';
// export * from './parser/index.js';
// export * from './ast/index.js';
// export * from './semantic/index.js';
// export * from './frame/index.js';
// export * from './il/index.js';
// export * from './codegen/index.js';
// export * from './optimizer/index.js';