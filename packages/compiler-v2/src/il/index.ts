/**
 * Intermediate Language module for Blend65 v2 (NEW)
 *
 * Defines and generates a simple linear IL - NO SSA, NO PHI nodes.
 * Instructions directly reference frame slot addresses.
 *
 * **Key Components:**
 * - IL Types: Opcode enum, instruction types, program structure
 * - IL Builder: Instruction construction utilities
 * - IL Generator: AST + Frames → IL instructions
 *
 * **IL Characteristics:**
 * - ~25 simple opcodes
 * - Direct frame slot addresses (no virtual registers)
 * - Accumulator-centric design (matches 6502)
 * - Linear control flow with explicit jumps
 *
 * **Example IL:**
 * ```
 * LOAD_BYTE $0200    ; Load from frame slot
 * ADD_IMM 1          ; Add immediate
 * STORE_BYTE $0200   ; Store back to frame slot
 * ```
 *
 * @module il
 */

// Will be populated in Phase 7: IL Generator
// export * from './types.js';
// export * from './builder.js';
// export * from './generator.js';