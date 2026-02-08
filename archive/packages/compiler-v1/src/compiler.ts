/**
 * Main Compiler Class
 *
 * Unified entry point for the Blend65 compiler that orchestrates
 * the complete compilation pipeline.
 *
 * **Pipeline:**
 * 1. Parse - Lexer + Parser (source → AST)
 * 2. Semantic - Type checking, symbol resolution
 * 3. IL - Intermediate language generation
 * 4. Optimize - Optimization passes
 * 5. Codegen - Assembly/binary generation
 *
 * **Features:**
 * - Single-file and multi-file compilation
 * - Configuration-driven compilation
 * - Error aggregation from all phases
 * - Support for stopping after specific phases
 *
 * @module compiler
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  ParsePhase,
  SemanticPhase,
  ILPhase,
  OptimizePhase,
  CodegenPhase,
  type CompilationResult,
  type CompileOptions,
  type PhaseResult,
} from './pipeline/index.js';

import type { Blend65Config } from './config/types.js';
import type { Diagnostic } from './ast/diagnostics.js';
import { DiagnosticCode, DiagnosticSeverity } from './ast/diagnostics.js';
import type { Program } from './ast/nodes.js';
import type { TargetConfig } from './target/config.js';
import { getTargetConfig, getDefaultTargetConfig } from './target/registry.js';
import { parseTargetArchitecture, isTargetImplemented } from './target/architecture.js';
import { OptimizationLevel } from './optimizer/options.js';
import { LibraryLoader } from './library/index.js';

/**
 * Main Blend65 Compiler Class
 *
 * Orchestrates the complete compilation pipeline from source files
 * to target output. Provides a unified API for all compilation scenarios.
 *
 * **Usage Patterns:**
 *
 * 1. **File-based compilation** (typical CLI usage):
 * ```typescript
 * const compiler = new Compiler();
 * const result = compiler.compile({
 *   files: ['src/main.blend', 'src/game.blend'],
 *   config: loadedConfig,
 * });
 * ```
 *
 * 2. **Source-based compilation** (testing, REPL):
 * ```typescript
 * const compiler = new Compiler();
 * const sources = new Map([
 *   ['main.blend', 'export function main(): void { }'],
 * ]);
 * const result = compiler.compileSource(sources, config);
 * ```
 *
 * 3. **Check-only mode** (IDE integration):
 * ```typescript
 * const result = compiler.check(['src/main.blend'], config);
 * // Returns after semantic analysis, no codegen
 * ```
 *
 * @example
 * ```typescript
 * import { Compiler } from '@blend65/compiler';
 * import { ConfigLoader } from '@blend65/compiler/config';
 *
 * const config = new ConfigLoader().load('./blend65.json');
 * const compiler = new Compiler();
 * const result = compiler.compile({
 *   files: ['src/main.blend'],
 *   config,
 * });
 *
 * if (result.success) {
 *   writeFileSync('game.prg', result.output!.binary);
 * } else {
 *   console.error(formatDiagnostics(result.diagnostics));
 * }
 * ```
 */
export class Compiler {
  /** Parse phase handler */
  protected parsePhase = new ParsePhase();

  /** Semantic analysis phase handler */
  protected semanticPhase = new SemanticPhase();

  /** IL generation phase handler */
  protected ilPhase = new ILPhase();

  /** Optimization phase handler */
  protected optimizePhase = new OptimizePhase();

  /** Code generation phase handler */
  protected codegenPhase = new CodegenPhase();

  /** Library loader for standard library */
  protected libraryLoader = new LibraryLoader();

  /**
   * Compile source files to target output
   *
   * Main compilation entry point. Runs all pipeline phases
   * and produces final output (assembly, binary, etc.).
   *
   * **Phase Execution:**
   * 1. Load source files from disk
   * 2. Parse all files → AST
   * 3. Semantic analysis → typed AST
   * 4. IL generation → intermediate representation
   * 5. Optimization → optimized IL
   * 6. Code generation → assembly/binary
   *
   * @param options - Compilation options (files, config, stopAfterPhase)
   * @returns Complete compilation result with output and diagnostics
   */
  public compile(options: CompileOptions): CompilationResult {
    const startTime = performance.now();
    const { files, config } = options;

    // Initialize result structure
    const result: CompilationResult = {
      success: false,
      diagnostics: [],
      phases: {},
      totalTimeMs: 0,
      target: getDefaultTargetConfig(),
    };

    try {
      // Validate target platform
      const targetValidation = this.validateTarget(config);
      if (!targetValidation.success) {
        result.diagnostics.push(...targetValidation.diagnostics);
        return this.finalize(result, startTime);
      }
      result.target = targetValidation.target;

      // Load source files
      const sources = this.loadSourceFiles(files);
      if (sources.diagnostics.length > 0) {
        result.diagnostics.push(...sources.diagnostics);
        if (!sources.success) {
          return this.finalize(result, startTime);
        }
      }

      // Run compilation pipeline
      return this.runPipeline(sources.data, config, result, options.stopAfterPhase, startTime);
    } catch (error) {
      result.diagnostics.push(this.createInternalError(error));
      return this.finalize(result, startTime);
    }
  }

  /**
   * Compile from source strings
   *
   * Convenience method for testing and REPL scenarios.
   * Skips file loading and accepts source code directly.
   *
   * @param sources - Map of filename → source code
   * @param config - Compilation configuration
   * @param stopAfterPhase - Optional phase to stop after
   * @returns Complete compilation result
   */
  public compileSource(
    sources: Map<string, string>,
    config: Blend65Config,
    stopAfterPhase?: 'parse' | 'semantic' | 'il' | 'optimize' | 'codegen'
  ): CompilationResult {
    const startTime = performance.now();

    // Initialize result structure
    const result: CompilationResult = {
      success: false,
      diagnostics: [],
      phases: {},
      totalTimeMs: 0,
      target: getDefaultTargetConfig(),
    };

    try {
      // Validate target platform
      const targetValidation = this.validateTarget(config);
      if (!targetValidation.success) {
        result.diagnostics.push(...targetValidation.diagnostics);
        return this.finalize(result, startTime);
      }
      result.target = targetValidation.target;

      // Run compilation pipeline directly with sources
      return this.runPipeline(sources, config, result, stopAfterPhase, startTime);
    } catch (error) {
      result.diagnostics.push(this.createInternalError(error));
      return this.finalize(result, startTime);
    }
  }

  /**
   * Parse only (for IDE integration)
   *
   * Runs only the parse phase and returns AST.
   * Useful for syntax highlighting, outline view, etc.
   *
   * @param files - Source files to parse
   * @returns Parse phase result with Program[] ASTs
   */
  public parseOnly(files: string[]): PhaseResult<Program[]> {
    const sources = this.loadSourceFiles(files);
    if (!sources.success) {
      return {
        data: [],
        diagnostics: sources.diagnostics,
        success: false,
        timeMs: 0,
      };
    }

    return this.parsePhase.execute(sources.data);
  }

  /**
   * Check only (parse + semantic, no codegen)
   *
   * Runs parse and semantic phases only.
   * Useful for type checking without generating output.
   *
   * @param files - Source files to check
   * @param config - Compilation configuration
   * @returns Compilation result (stopped after semantic phase)
   */
  public check(files: string[], config: Blend65Config): CompilationResult {
    return this.compile({
      files,
      config,
      stopAfterPhase: 'semantic',
    });
  }

  /**
   * Load standard library sources
   *
   * Loads common libraries (auto-loaded) and any optional libraries
   * specified in the configuration. Libraries are loaded before user
   * sources in the pipeline.
   *
   * **Auto-Loading Behavior:**
   * - `common/` directory is ALWAYS loaded (contains system.blend with core intrinsics)
   * - `{target}/common/` is always loaded for the target platform
   * - Additional libraries can be specified via `libraries` config option
   *
   * @param config - Compilation configuration
   * @param result - Result object to add diagnostics to
   * @returns Load result with sources map and success flag
   */
  protected loadLibrarySources(
    config: Blend65Config,
    result: CompilationResult
  ): { success: boolean; sources: Map<string, string> } {
    const libraries = config.compilerOptions.libraries || [];
    const target = config.compilerOptions.target || 'c64';

    // Load libraries using the LibraryLoader
    // This automatically loads common/ and {target}/common/, plus any optional libraries
    const libraryResult = this.libraryLoader.loadLibraries(target, libraries);

    // Add any diagnostics from library loading
    result.diagnostics.push(...libraryResult.diagnostics);

    return {
      success: libraryResult.success,
      sources: libraryResult.sources,
    };
  }

  /**
   * Merge library sources with user sources
   *
   * Prepends library sources to user sources so library modules
   * are available for import by user code.
   *
   * @param librarySources - Library source files
   * @param userSources - User source files
   * @returns Combined sources map (libraries first)
   */
  protected mergeSources(
    librarySources: Map<string, string>,
    userSources: Map<string, string>
  ): Map<string, string> {
    // Create new map with library sources first
    const merged = new Map<string, string>();

    // Add library sources (processed first)
    for (const [file, content] of librarySources) {
      merged.set(file, content);
    }

    // Add user sources
    for (const [file, content] of userSources) {
      merged.set(file, content);
    }

    return merged;
  }

  /**
   * Run the compilation pipeline
   *
   * Executes all phases in order, stopping if a phase fails
   * or if stopAfterPhase is specified.
   *
   * @param sources - Map of filename → source code (user sources only)
   * @param config - Compilation configuration
   * @param result - Result object to populate
   * @param stopAfterPhase - Optional phase to stop after
   * @param startTime - Pipeline start time for timing
   * @returns Final compilation result
   */
  protected runPipeline(
    sources: Map<string, string>,
    config: Blend65Config,
    result: CompilationResult,
    stopAfterPhase: string | undefined,
    startTime: number
  ): CompilationResult {
    // Load library sources
    const libraryLoad = this.loadLibrarySources(config, result);
    if (!libraryLoad.success) {
      result.success = false;
      return this.finalize(result, startTime);
    }

    // Merge library sources with user sources
    const allSources = this.mergeSources(libraryLoad.sources, sources);

    // Phase 1: Parse
    const parseResult = this.parsePhase.execute(allSources);
    result.phases.parse = parseResult;
    result.diagnostics.push(...parseResult.diagnostics);

    if (!parseResult.success || stopAfterPhase === 'parse') {
      result.success = parseResult.success && stopAfterPhase === 'parse';
      return this.finalize(result, startTime);
    }

    // Phase 2: Semantic Analysis
    const semanticResult = this.semanticPhase.execute(parseResult.data);
    result.phases.semantic = semanticResult;
    result.diagnostics.push(...semanticResult.diagnostics);

    if (!semanticResult.success || stopAfterPhase === 'semantic') {
      result.success = semanticResult.success && stopAfterPhase === 'semantic';
      return this.finalize(result, startTime);
    }

    // Phase 3: IL Generation
    const ilResult = this.ilPhase.execute(semanticResult.data, parseResult.data, result.target);
    result.phases.il = ilResult;
    result.diagnostics.push(...ilResult.diagnostics);

    if (!ilResult.success || stopAfterPhase === 'il') {
      result.success = ilResult.success && stopAfterPhase === 'il';
      return this.finalize(result, startTime);
    }

    // Phase 4: Optimization
    const optLevel = this.parseOptimizationLevel(config.compilerOptions.optimization);
    const optimizeResult = this.optimizePhase.execute(ilResult.data, optLevel);
    result.phases.optimize = optimizeResult;
    result.diagnostics.push(...optimizeResult.diagnostics);

    if (!optimizeResult.success || stopAfterPhase === 'optimize') {
      result.success = optimizeResult.success && stopAfterPhase === 'optimize';
      return this.finalize(result, startTime);
    }

    // Phase 5: Code Generation
    const codegenResult = this.codegenPhase.execute(optimizeResult.data.module, {
      target: result.target,
      format: config.compilerOptions.outputFormat || 'prg',
      sourceMap: config.compilerOptions.debug !== 'none',
      debug: config.compilerOptions.debug,
    });
    result.phases.codegen = codegenResult;
    result.diagnostics.push(...codegenResult.diagnostics);

    if (codegenResult.success) {
      result.output = {
        assembly: codegenResult.data.assembly,
        binary: codegenResult.data.binary,
        sourceMap: codegenResult.data.sourceMap,
        viceLabels: codegenResult.data.viceLabels,
      };
      result.success = true;
    }

    return this.finalize(result, startTime);
  }

  /**
   * Validate target platform
   *
   * Checks if the specified target is valid and implemented.
   * Currently only 'c64' is fully implemented.
   *
   * @param config - Compilation configuration
   * @returns Validation result with target config or error diagnostics
   */
  protected validateTarget(config: Blend65Config): {
    success: boolean;
    target: TargetConfig;
    diagnostics: Diagnostic[];
  } {
    const targetStr = config.compilerOptions.target || 'c64';
    const diagnostics: Diagnostic[] = [];

    // Parse target architecture
    const targetArch = parseTargetArchitecture(targetStr);
    if (!targetArch) {
      diagnostics.push({
        code: DiagnosticCode.TYPE_MISMATCH,
        severity: DiagnosticSeverity.ERROR,
        message: `Invalid target '${targetStr}'. Valid targets: c64, c128, x16`,
        location: {
          source: 'config',
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: 1, offset: 0 },
        },
      });
      return { success: false, target: getDefaultTargetConfig(), diagnostics };
    }

    // Check if target is implemented
    if (!isTargetImplemented(targetArch)) {
      diagnostics.push({
        code: DiagnosticCode.TYPE_MISMATCH,
        severity: DiagnosticSeverity.ERROR,
        message: `Target '${targetStr}' is not implemented yet. Currently only 'c64' is supported.`,
        location: {
          source: 'config',
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: 1, offset: 0 },
        },
      });
      return { success: false, target: getDefaultTargetConfig(), diagnostics };
    }

    // Get target configuration
    const target = getTargetConfig(targetArch);
    return { success: true, target, diagnostics };
  }

  /**
   * Load source files from disk
   *
   * Reads all specified files and returns a Map of filename → content.
   * Reports errors for missing or unreadable files.
   *
   * @param files - Array of file paths to load
   * @returns Load result with sources map and any error diagnostics
   */
  protected loadSourceFiles(files: string[]): {
    success: boolean;
    data: Map<string, string>;
    diagnostics: Diagnostic[];
  } {
    const sources = new Map<string, string>();
    const diagnostics: Diagnostic[] = [];

    for (const file of files) {
      try {
        const absolutePath = path.resolve(file);
        const content = fs.readFileSync(absolutePath, 'utf-8');
        sources.set(file, content);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        diagnostics.push({
          code: DiagnosticCode.MODULE_NOT_FOUND,
          severity: DiagnosticSeverity.ERROR,
          message: `Cannot read file '${file}': ${message}`,
          location: {
            source: file,
            start: { line: 1, column: 1, offset: 0 },
            end: { line: 1, column: 1, offset: 0 },
          },
        });
      }
    }

    return {
      success: diagnostics.length === 0,
      data: sources,
      diagnostics,
    };
  }

  /**
   * Parse optimization level from string
   *
   * Converts config string to OptimizationLevel enum.
   *
   * @param level - Optimization level string
   * @returns OptimizationLevel enum value
   */
  protected parseOptimizationLevel(level: string | undefined): OptimizationLevel {
    switch (level) {
      case 'O0':
        return OptimizationLevel.O0;
      case 'O1':
        return OptimizationLevel.O1;
      case 'O2':
        return OptimizationLevel.O2;
      case 'O3':
        return OptimizationLevel.O3;
      case 'Os':
        return OptimizationLevel.Os;
      case 'Oz':
        return OptimizationLevel.Oz;
      default:
        return OptimizationLevel.O0;
    }
  }

  /**
   * Finalize compilation result
   *
   * Sets final timing and returns result.
   *
   * @param result - Result to finalize
   * @param startTime - Compilation start time
   * @returns Finalized result
   */
  protected finalize(result: CompilationResult, startTime: number): CompilationResult {
    result.totalTimeMs = performance.now() - startTime;
    return result;
  }

  /**
   * Create internal error diagnostic
   *
   * Wraps unexpected errors as diagnostics.
   *
   * @param error - Error that occurred
   * @returns Diagnostic for the error
   */
  protected createInternalError(error: unknown): Diagnostic {
    const message = error instanceof Error ? error.message : String(error);
    return {
      code: DiagnosticCode.TYPE_MISMATCH,
      severity: DiagnosticSeverity.ERROR,
      message: `Internal compiler error: ${message}`,
      location: {
        file: '<internal>',
        start: { line: 1, column: 1, offset: 0 },
        end: { line: 1, column: 1, offset: 0 },
      },
    };
  }
}

/**
 * Format diagnostics for display
 *
 * Formats an array of diagnostics into human-readable output.
 * Sorts by file, then line number, then severity.
 *
 * @param diagnostics - Diagnostics to format
 * @returns Formatted string
 */
export function formatDiagnostics(diagnostics: Diagnostic[]): string {
  if (diagnostics.length === 0) {
    return 'No diagnostics.';
  }

  // Sort diagnostics
  const sorted = [...diagnostics].sort((a, b) => {
    // Sort by file
    const sourceA = a.location.source ?? '';
    const sourceB = b.location.source ?? '';
    if (sourceA !== sourceB) {
      return sourceA.localeCompare(sourceB);
    }
    // Then by line
    if (a.location.start.line !== b.location.start.line) {
      return a.location.start.line - b.location.start.line;
    }
    // Then by severity (errors first)
    const severityOrder = { error: 0, warning: 1, info: 2, hint: 3 };
    return (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4);
  });

  return sorted.map(d => formatDiagnostic(d)).join('\n');
}

/**
 * Format a single diagnostic
 *
 * @param d - Diagnostic to format
 * @returns Formatted string
 */
export function formatDiagnostic(d: Diagnostic): string {
  const loc = d.location;
  const prefix = d.severity;
  return `${prefix}: ${d.message}
  --> ${loc.source}:${loc.start.line}:${loc.start.column}`;
}