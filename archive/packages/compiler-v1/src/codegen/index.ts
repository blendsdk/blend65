/**
 * Code Generation Module
 *
 * Public exports for the code generation subsystem.
 * This module transforms IL (Intermediate Language) into
 * 6502 assembly and binary output.
 *
 * **Exported Components:**
 * - Types: CodegenOptions, CodegenResult, SourceMapEntry, CodegenStats
 * - Classes: AssemblyWriter, LabelGenerator, SourceMapper
 * - Functions: getDefaultCodegenOptions, generateBasicStub
 * - Constants: C64_BASIC_START, C64_CODE_START, BASIC_TOKEN_SYS
 *
 * **Usage:**
 * ```typescript
 * import {
 *   AssemblyWriter,
 *   LabelGenerator,
 *   SourceMapper,
 *   generateBasicStub,
 *   getDefaultCodegenOptions,
 * } from './codegen/index.js';
 * ```
 *
 * @module codegen
 */

// Types
export type {
  CodegenOptions,
  CodegenResult,
  SourceMapEntry,
  CodegenStats,
  OutputFormat,
  DebugMode,
} from './types.js';

// Functions and Constants
export { getDefaultCodegenOptions, C64_BASIC_START, C64_CODE_START } from './types.js';

// Assembly Writer
export { AssemblyWriter } from './assembly-writer.js';
export type { AssemblySection } from './assembly-writer.js';

// Label Generator
export { LabelGenerator } from './label-generator.js';
export type { LabelType, LabelEntry } from './label-generator.js';

// BASIC Stub Generator
export {
  generateBasicStub,
  generateStandardBasicStub,
  calculateBasicStubSize,
  verifyBasicStub,
  numberToAsciiDigits,
  BASIC_TOKEN_SYS,
  BASIC_END_OF_LINE,
  BASIC_DEFAULT_LINE_NUMBER,
} from './basic-stub.js';
export type { BasicStubOptions, BasicStubResult } from './basic-stub.js';

// Source Mapper
export { SourceMapper } from './source-mapper.js';

// ACME Invoker
export {
  invokeAcme,
  findAcme,
  isAcmeAvailable,
  assembleSimple,
  getAcmeVersion,
  AcmeError,
  AcmeNotFoundError,
} from './acme-invoker.js';
export type { AcmeOptions, AcmeResult } from './acme-invoker.js';

// Code Generator (inheritance chain)
export { BaseCodeGenerator } from './base-generator.js';
export { GlobalsGenerator } from './globals-generator.js';
export { InstructionGenerator } from './instruction-generator.js';
export { CodeGenerator } from './code-generator.js';