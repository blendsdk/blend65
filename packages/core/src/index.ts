/**
 * Blend65 Core Compilation Infrastructure
 * Task 1.5.5: Multi-file Compilation Infrastructure
 *
 * This package provides the core infrastructure for multi-file Blend65 compilation:
 * - CompilationUnit for orchestrating multi-file compilation
 * - Project configuration and file discovery
 * - Multi-file lex/parse coordination
 * - Clean interface for semantic analysis
 */

// Core compilation infrastructure
export { CompilationUnit } from './compilation-unit.js';

// Type definitions and interfaces
export type {
  SourceFile,
  CompilationError,
  CompilationResult,
  CompilationStatistics,
  CompilationErrorType,
  ProjectConfig,
  FileStatus,
} from './types.js';

// Utility functions
export {
  createSourceFile,
  createCompilationError,
  createDefaultProjectConfig,
  validateProjectConfig,
  matchesPatterns,
  getFileExtension,
  isBlend65File,
  normalizePath,
} from './types.js';

/**
 * Main entry points for different use cases:
 *
 * @example Multi-file compilation from file paths
 * ```typescript
 * import { CompilationUnit } from '@blend65/core';
 *
 * const unit = await CompilationUnit.fromFiles(['main.blend', 'player.blend']);
 * await unit.lexAndParseAll();
 * const programs = unit.getAllPrograms();
 * ```
 *
 * @example Project-based compilation
 * ```typescript
 * import { CompilationUnit, createDefaultProjectConfig } from '@blend65/core';
 *
 * const config = createDefaultProjectConfig('MyGame');
 * config.sourceFiles = ['src/main.blend', 'src/player.blend'];
 * const unit = CompilationUnit.fromConfig(config);
 * ```
 *
 * @example Integration with semantic analysis
 * ```typescript
 * import { CompilationUnit } from '@blend65/core';
 * import { SemanticAnalyzer } from '@blend65/semantic';
 *
 * const unit = await CompilationUnit.fromFiles(['game.blend']);
 * await unit.lexAndParseAll();
 *
 * if (!unit.hasErrors()) {
 *   const analyzer = new SemanticAnalyzer();
 *   const result = analyzer.analyze(unit.getAllPrograms());
 * }
 * ```
 */
