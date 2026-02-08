/**
 * Hardware Analysis Module
 *
 * Provides target-specific hardware analyzers for different
 * 6502-based machines (C64, C128, X16, etc.).
 *
 * **Three-Level Analysis Architecture:**
 * - Level 1: Universal (language-level) - in analysis/
 * - Level 2: 6502-Common (CPU-level) - Common6502Analyzer
 * - Level 3: Target-Specific (hardware-level) - this module
 *
 * **Usage:**
 * ```typescript
 * import { getHardwareAnalyzer, TargetArchitecture } from './hardware/index.js';
 *
 * const analyzer = getHardwareAnalyzer(
 *   TargetArchitecture.C64,
 *   symbolTable,
 *   cfgs
 * );
 *
 * const result = analyzer.analyze(ast);
 * ```
 */

// ============================================
// Base Classes and Types
// ============================================

export {
  BaseHardwareAnalyzer,
  type HardwareAnalysisResult,
} from './base-hardware-analyzer.js';

export {
  Common6502Analyzer,
  CPU_6502_CONSTANTS,
  type StackUsageResult,
  type BranchDistanceResult,
} from './common-6502-analyzer.js';

// ============================================
// Registry Functions
// ============================================

export {
  createHardwareAnalyzer,
  createHardwareAnalyzerFromConfig,
  getDefaultHardwareAnalyzer,
  getHardwareAnalyzer,
  isHardwareAnalyzerAvailable,
  getTargetsWithAnalyzers,
  NoAnalyzerForTargetError,
} from './target-analyzer-registry.js';

// ============================================
// C64 Analyzer (Fully Implemented)
// ============================================

export { C64HardwareAnalyzer } from './c64/index.js';
export {
  C64ZeroPageCategory,
  type ZeroPageLocationInfo,
  type C64ZeroPageValidationResult,
  getC64ZeroPageCategory,
  getC64CategoryDescription,
  isC64ZeroPageSafe,
  validateC64ZeroPageAllocation,
  getC64ZeroPageInfo,
  getC64AvailableZeroPageBytes,
  getC64SafeZeroPageRange,
  suggestC64ZeroPageAllocation,
  C64_ZERO_PAGE_DETAILS,
} from './c64/index.js';

// ============================================
// C128 Analyzer (Placeholder)
// ============================================

export { C128HardwareAnalyzer } from './c128/index.js';

// ============================================
// X16 Analyzer (Placeholder)
// ============================================

export { X16HardwareAnalyzer } from './x16/index.js';