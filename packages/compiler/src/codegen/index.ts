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

// CPU instruction set abstraction
export {
  createCpuInstructionSet,
  CpuInstructionSet,
  Cpu6502InstructionSet,
  Cpu65C02InstructionSet,
  DEFAULT_CPU_TARGET,
} from './cpu/index.js';
export type { CpuTarget } from './cpu/index.js';
