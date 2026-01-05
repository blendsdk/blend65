/**
 * 6502 Code Generation Package for Blend65
 * Provides comprehensive code generation from IL to 6502 assembly
 */

// Simple working code generator (ready to use)
export { SimpleCodeGenerator } from './simple-code-generator.js';
export type {
  SimpleCodeGenOptions,
  SimpleCodeGenResult
} from './simple-code-generator.js';

// Advanced code generator (under development)
export { CodeGenerator } from './code-generator.js';
export type {
  CodeGenOptions,
  CodeGenResult,
  CodeGenWarning,
  MemoryLayoutInfo,
  CompilationStats,
  SourceMapData
} from './code-generator.js';

// IL to 6502 mapping
export { ILTo6502Mapper } from './instruction-mapping/il-to-6502-mapper.js';
export type {
  CodeGenContext,
  MappingResult
} from './instruction-mapping/il-to-6502-mapper.js';
