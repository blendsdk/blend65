/**
 * 6502 Processor Variant Analyzers - Export index
 *
 * This module exports all supported 6502 family processor analyzers
 * for use by the main 6502 analysis system.
 *
 * Supported Processors:
 * - MOS 6502 (VIC-20) - Pure NMOS reference implementation
 * - MOS 6510 (C64) - With banking and VIC-II interference
 * - WDC 65C02 (X16) - Enhanced CMOS with additional instructions
 * - Future: WDC 65816 (SNES) - 16-bit enhanced version
 */

// Base analyzer foundation
export { Base6502Analyzer } from './base-6502-analyzer.js';

// Processor-specific implementations
export { VIC20_6502Analyzer } from './vic20-6502-analyzer.js';
export { C64_6510Analyzer } from './c64-6510-analyzer.js';
export { X16_65C02Analyzer } from './x16-65c02-analyzer.js';

// Re-export types for convenience
export type {
  ProcessorVariant,
  PlatformTarget,
  InstructionTimingInfo,
  SixtyTwo6502AnalysisOptions,
} from '../types/6502-analysis-types.js';
