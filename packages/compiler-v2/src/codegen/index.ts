/**
 * Code Generator Module
 *
 * Translates IL (Intermediate Language) to ASM-IL (structured 6502 assembly).
 *
 * **Architecture:**
 * - `asm-il/` - ASM-IL types and builder
 * - `generator/` - Code generator with inheritance chain
 *
 * @module codegen
 */

// ASM-IL types and builder
export * from './asm-il/index.js';

// Code generator
export { CodeGenerator, CodeGeneratorBase } from './generator/index.js';