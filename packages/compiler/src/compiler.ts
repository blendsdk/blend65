/**
 * Main Compiler Class
 *
 * Unified entry point for the Blend65 v2 compiler that orchestrates
 * the complete compilation pipeline.
 *
 * **V2 Pipeline (8 phases):**
 * 1. Parse - Lexer + Parser (source → AST)
 * 2. Semantic - Type checking, symbol resolution
 * 3. Frame - Static Frame Allocation
 * 4. IL - Intermediate language generation
 * 5. Optimize - IL optimization passes
 * 6. Codegen - IL → ASM-IL
 * 7. AsmOpt - ASM-IL peephole optimization
 * 8. Emit - ASM-IL → assembly text
 *
 * @module compiler
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  ParsePhase,
  SemanticPhase,
  FramePhase,
  ILPhase,
  OptimizePhase,
  CodegenPhase,
  AsmOptPhase,
  EmitPhase,
  type CompilationResult,
  type CompileOptions,
  type PhaseResult,
} from './pipeline/index.js';

import type { Blend65Config } from './config/types.js';
import type { Diagnostic } from './ast/diagnostics.js';
import { DiagnosticCode, DiagnosticSeverity } from './ast/diagnostics.js';
import type { Program } from './ast/program.js';
import type { TargetConfig } from './target/config.js';
import { getTargetConfig, getDefaultTargetConfig } from './target/registry.js';
import { parseTargetArchitecture, isTargetImplemented } from './target/architecture.js';
import type { OptimizationLevel } from './optimizer/options.js';
import { LibraryLoader } from './library/loader.js';

/**
 * Main Blend65 v2 Compiler Class
 *
 * Orchestrates the complete 8-phase compilation pipeline from source
 * files to assembly output.
 *
 * @example
 * ```typescript
 * const compiler = new Compiler();
 * const result = compiler.compile({
 *   files: ['src/main.blend'],
 *   config: loadedConfig,
 * });
 *
 * if (result.success) {
 *   writeFileSync('game.asm', result.output!.assembly);
 * }
 * ```
 */
export class Compiler {
  /** Parse phase handler */
  protected parsePhase = new ParsePhase();

  /** Semantic analysis phase handler */
  protected semanticPhase = new SemanticPhase();

  /** Static Frame Allocation phase handler */
  protected framePhase = new FramePhase();

  /** IL generation phase handler */
  protected ilPhase = new ILPhase();

  /** IL optimization phase handler */
  protected optimizePhase = new OptimizePhase();

  /** Code generation phase handler */
  protected codegenPhase = new CodegenPhase();

  /** ASM-IL optimization phase handler */
  protected asmOptPhase = new AsmOptPhase();

  /** Assembly emission phase handler */
  protected emitPhase = new EmitPhase();

  /** Library loader for standard library */
  protected libraryLoader = new LibraryLoader();

  /**
   * Compile source files to assembly output
   *
   * Main compilation entry point. Loads files from disk,
   * then runs all 8 pipeline phases.
   *
   * @param options - Compilation options (files, config, stopAfterPhase)
   * @returns Complete compilation result with output and diagnostics
   */
  public compile(options: CompileOptions): CompilationResult {
    const startTime = performance.now();
    const { files, config } = options;

    const result = this.createEmptyResult();

    try {
      // Validate target platform
      const targetValidation = this.validateTarget(config);
      if (!targetValidation.success) {
        result.diagnostics.push(...targetValidation.diagnostics);
        return this.finalize(result, startTime);
      }
      result.target = targetValidation.target;

      // Load source files from disk
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
   * Compile from source strings (for testing and REPL)
   *
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
    stopAfterPhase?: CompileOptions['stopAfterPhase']
  ): CompilationResult {
    const startTime = performance.now();
    const result = this.createEmptyResult();

    try {
      const targetValidation = this.validateTarget(config);
      if (!targetValidation.success) {
        result.diagnostics.push(...targetValidation.diagnostics);
        return this.finalize(result, startTime);
      }
      result.target = targetValidation.target;

      return this.runPipeline(sources, config, result, stopAfterPhase, startTime);
    } catch (error) {
      result.diagnostics.push(this.createInternalError(error));
      return this.finalize(result, startTime);
    }
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
   * Parse only (for IDE integration)
   *
   * Runs only the parse phase and returns ASTs.
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
   * Run the full compilation pipeline
   *
   * Executes all 8 phases in order, stopping if a phase fails
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
    stopAfterPhase: CompileOptions['stopAfterPhase'],
    startTime: number
  ): CompilationResult {
    // Load library sources and merge with user sources
    const libraryLoad = this.loadLibrarySources(config, result);
    if (!libraryLoad.success) {
      return this.finalize(result, startTime);
    }
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

    // Phase 3: Frame Allocation
    const frameResult = this.framePhase.execute(semanticResult.data, parseResult.data);
    result.phases.frame = frameResult;
    result.diagnostics.push(...frameResult.diagnostics);
    if (!frameResult.success || stopAfterPhase === 'frame') {
      result.success = frameResult.success && stopAfterPhase === 'frame';
      return this.finalize(result, startTime);
    }

    // Phase 4: IL Generation
    const ilResult = this.ilPhase.execute(semanticResult.data, frameResult.data, parseResult.data);
    result.phases.il = ilResult;
    result.diagnostics.push(...ilResult.diagnostics);
    if (!ilResult.success || stopAfterPhase === 'il') {
      result.success = ilResult.success && stopAfterPhase === 'il';
      return this.finalize(result, startTime);
    }

    // Phase 5: IL Optimization
    const optLevel = (config.compilerOptions.optimization || 'O0') as OptimizationLevel;
    const optimizeResult = this.optimizePhase.execute(ilResult.data, optLevel);
    result.phases.optimize = optimizeResult;
    result.diagnostics.push(...optimizeResult.diagnostics);
    if (!optimizeResult.success || stopAfterPhase === 'optimize') {
      result.success = optimizeResult.success && stopAfterPhase === 'optimize';
      return this.finalize(result, startTime);
    }

    // Phase 6: Code Generation (IL → ASM-IL)
    // Pass frameResult.data so codegen can build the data segment for @data globals
    const codegenResult = this.codegenPhase.execute(optimizeResult.data, frameResult.data);
    result.phases.codegen = codegenResult;
    result.diagnostics.push(...codegenResult.diagnostics);
    if (!codegenResult.success || stopAfterPhase === 'codegen') {
      result.success = codegenResult.success && stopAfterPhase === 'codegen';
      return this.finalize(result, startTime);
    }

    // Phase 7: ASM-IL Optimization
    const asmOptResult = this.asmOptPhase.execute(codegenResult.data);
    result.phases.asmOpt = asmOptResult;
    result.diagnostics.push(...asmOptResult.diagnostics);
    if (!asmOptResult.success || stopAfterPhase === 'asmOpt') {
      result.success = asmOptResult.success && stopAfterPhase === 'asmOpt';
      return this.finalize(result, startTime);
    }

    // Phase 8: Emit Assembly Text
    const emitResult = this.emitPhase.execute(asmOptResult.data.program);
    result.phases.emit = emitResult;
    result.diagnostics.push(...emitResult.diagnostics);
    if (emitResult.success) {
      result.output = { assembly: emitResult.data };
      result.success = true;
    }

    return this.finalize(result, startTime);
  }

  /**
   * Load standard library sources
   *
   * Auto-loads common/ and {target}/common/ library files.
   *
   * @param config - Compilation configuration
   * @param result - Result object to add diagnostics to
   * @returns Load result with sources map
   */
  protected loadLibrarySources(
    config: Blend65Config,
    result: CompilationResult
  ): { success: boolean; sources: Map<string, string> } {
    const libraries = config.compilerOptions.libraries || [];
    const target = config.compilerOptions.target || 'c64';

    const libraryResult = this.libraryLoader.loadLibraries(target, libraries);
    result.diagnostics.push(...libraryResult.diagnostics);

    return {
      success: libraryResult.success,
      sources: libraryResult.sources,
    };
  }

  /**
   * Merge library sources with user sources
   *
   * @param librarySources - Library source files
   * @param userSources - User source files
   * @returns Combined sources map (libraries first)
   */
  protected mergeSources(
    librarySources: Map<string, string>,
    userSources: Map<string, string>
  ): Map<string, string> {
    const merged = new Map<string, string>();
    for (const [file, content] of librarySources) {
      merged.set(file, content);
    }
    for (const [file, content] of userSources) {
      merged.set(file, content);
    }
    return merged;
  }

  /**
   * Validate target platform
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

    const target = getTargetConfig(targetArch);
    return { success: true, target, diagnostics };
  }

  /**
   * Load source files from disk
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

  /** Create an empty CompilationResult */
  protected createEmptyResult(): CompilationResult {
    return {
      success: false,
      diagnostics: [],
      phases: {},
      totalTimeMs: 0,
      target: getDefaultTargetConfig(),
    };
  }

  /** Finalize compilation result with timing */
  protected finalize(result: CompilationResult, startTime: number): CompilationResult {
    result.totalTimeMs = performance.now() - startTime;
    return result;
  }

  /** Create internal error diagnostic */
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
 * @param diagnostics - Diagnostics to format
 * @returns Formatted string
 */
export function formatDiagnostics(diagnostics: Diagnostic[]): string {
  if (diagnostics.length === 0) {
    return 'No diagnostics.';
  }

  const sorted = [...diagnostics].sort((a, b) => {
    const sourceA = a.location.source ?? '';
    const sourceB = b.location.source ?? '';
    if (sourceA !== sourceB) return sourceA.localeCompare(sourceB);
    if (a.location.start.line !== b.location.start.line) {
      return a.location.start.line - b.location.start.line;
    }
    const severityOrder: Record<string, number> = { error: 0, warning: 1, info: 2, hint: 3 };
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
  return `${d.severity}: ${d.message}\n  --> ${loc.source}:${loc.start.line}:${loc.start.column}`;
}
