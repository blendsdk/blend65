/**
 * Parse Phase
 *
 * Orchestrates the parsing of multiple source files into ASTs.
 * This phase runs the Lexer and Parser on each source file,
 * collecting all diagnostics and producing Program ASTs.
 *
 * **Phase Responsibilities:**
 * - Tokenize source files with Lexer
 * - Parse tokens into AST with Parser
 * - Aggregate diagnostics from all files
 * - Track timing for performance analysis
 *
 * @module pipeline/parse-phase
 */

import { Lexer } from '../lexer/lexer.js';
import { Parser } from '../parser/parser.js';
import type { Program } from '../ast/nodes.js';
import type { Diagnostic } from '../ast/diagnostics.js';
import type { PhaseResult } from './types.js';

/**
 * Parse Phase - converts source strings to AST
 *
 * Orchestrates the complete parsing pipeline:
 * 1. For each source file: Lexer → Parser
 * 2. Collect all diagnostics from all files
 * 3. Return array of Program ASTs
 *
 * **Error Recovery:**
 * All files are parsed even if some have errors.
 * This allows reporting all errors at once.
 *
 * @example
 * ```typescript
 * const parsePhase = new ParsePhase();
 * const sources = new Map([
 *   ['main.blend', 'export function main(): void { }'],
 *   ['game.blend', 'function update(): void { }'],
 * ]);
 * const result = parsePhase.execute(sources);
 *
 * if (!result.success) {
 *   console.error('Parse errors:', result.diagnostics);
 * }
 * ```
 */
export class ParsePhase {
  /**
   * Parse multiple source files
   *
   * Processes each file through Lexer → Parser and collects results.
   * All files are parsed regardless of errors in individual files.
   *
   * @param sources - Map of filename → source code
   * @returns Phase result with Program[] and aggregated diagnostics
   */
  public execute(sources: Map<string, string>): PhaseResult<Program[]> {
    const startTime = performance.now();
    const programs: Program[] = [];
    const diagnostics: Diagnostic[] = [];

    // Process each source file
    for (const [filename, source] of sources) {
      const fileResult = this.parseFile(filename, source);
      programs.push(fileResult.program);
      diagnostics.push(...fileResult.diagnostics);
    }

    // Determine success based on error-severity diagnostics
    const hasErrors = diagnostics.some(d => d.severity === 'error');

    return {
      data: programs,
      diagnostics,
      success: !hasErrors,
      timeMs: performance.now() - startTime,
    };
  }

  /**
   * Parse a single source file
   *
   * Runs Lexer and Parser on the file, collecting diagnostics from both.
   *
   * @param filename - Name of the source file (for error reporting)
   * @param source - Source code content
   * @returns Parsed program and diagnostics
   */
  protected parseFile(
    _filename: string,
    source: string
  ): { program: Program; diagnostics: Diagnostic[] } {
    const diagnostics: Diagnostic[] = [];

    // Phase 1: Lexical analysis (tokenization)
    // Note: Lexer doesn't accept filename in options - it's tracked internally
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();

    // Note: Lexer doesn't have getDiagnostics() method
    // Lexer errors are thrown as exceptions or embedded in tokens
    // Any lexer-level errors will cause parser failures

    // Phase 2: Syntactic analysis (parsing)
    // Note: Parser config doesn't have filename option
    const parser = new Parser(tokens);
    const program = parser.parse();
    diagnostics.push(...parser.getDiagnostics());

    return { program, diagnostics };
  }
}