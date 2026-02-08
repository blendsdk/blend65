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
 * - Register source text for rich diagnostic output
 *
 * @module pipeline/parse-phase
 */

import { Lexer } from '../lexer/lexer.js';
import { Parser } from '../parser/parser.js';
import { Program, ModuleDecl } from '../ast/nodes.js';
import type { Diagnostic } from '../ast/diagnostics.js';
import { DiagnosticCode, DiagnosticSeverity } from '../ast/diagnostics.js';
import type { PhaseResult } from './types.js';
import { SourceRegistry } from '../utils/source-registry.js';

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
   * Also registers source text with SourceRegistry for rich diagnostic output.
   * Catches Lexer exceptions and converts them to proper diagnostics.
   *
   * @param filename - Name of the source file (for error reporting)
   * @param source - Source code content
   * @returns Parsed program and diagnostics
   */
  protected parseFile(
    filename: string,
    source: string
  ): { program: Program; diagnostics: Diagnostic[] } {
    const diagnostics: Diagnostic[] = [];

    // Register source text for rich diagnostic output (snippets)
    SourceRegistry.getInstance().register(filename, source);

    // Phase 1: Lexical analysis (tokenization)
    // Wrap in try/catch to convert lexer exceptions to proper diagnostics
    const lexer = new Lexer(source);
    let tokens;
    try {
      tokens = lexer.tokenize();
    } catch (error) {
      // Convert lexer exception to proper diagnostic with filename
      const diagnostic = this.createLexerErrorDiagnostic(error, filename);
      diagnostics.push(diagnostic);

      // Return empty program with error diagnostic
      // Cannot continue parsing without valid tokens
      return {
        program: this.createEmptyProgram(filename),
        diagnostics,
      };
    }

    // Phase 2: Syntactic analysis (parsing)
    // Pass filename to parser for accurate error location reporting
    const parser = new Parser(tokens, { filePath: filename });
    const program = parser.parse();
    diagnostics.push(...parser.getDiagnostics());

    return { program, diagnostics };
  }

  /**
   * Creates a proper diagnostic from a Lexer exception
   *
   * Parses error message to extract line/column information,
   * then creates a diagnostic with the actual filename.
   *
   * @param error - The caught error from lexer
   * @param filename - The source file being parsed
   * @returns Properly formatted Diagnostic with accurate location
   */
  protected createLexerErrorDiagnostic(error: unknown, filename: string): Diagnostic {
    const message = error instanceof Error ? error.message : String(error);

    // Try to extract line and column from error message
    // Format: "Error message at line X, column Y"
    const locationMatch = message.match(/at line (\d+), column (\d+)/);
    let line = 1;
    let column = 1;

    if (locationMatch) {
      line = parseInt(locationMatch[1], 10);
      column = parseInt(locationMatch[2], 10);
    }

    // Determine the diagnostic code based on error message
    let code = DiagnosticCode.UNEXPECTED_TOKEN;
    let cleanMessage = message;

    if (message.includes('Unterminated string')) {
      code = DiagnosticCode.UNTERMINATED_STRING;
      cleanMessage = 'Unterminated string literal';
    } else if (message.includes('Invalid number')) {
      code = DiagnosticCode.INVALID_NUMBER_LITERAL;
      cleanMessage = message.replace(/at line \d+, column \d+/, '').trim();
    }

    return {
      code,
      severity: DiagnosticSeverity.ERROR,
      message: cleanMessage,
      location: {
        file: filename,
        start: { line, column, offset: 0 },
        end: { line, column: column + 1, offset: 0 },
      },
    };
  }

  /**
   * Creates an empty Program AST node for error cases
   *
   * When lexer fails, we still need to return a valid Program
   * to maintain consistent API behavior.
   *
   * @param filename - The source file name
   * @returns Empty Program AST node
   */
  protected createEmptyProgram(filename: string): Program {
    const emptyLocation = {
      file: filename,
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 1, column: 1, offset: 0 },
    };

    // Create implicit global module
    // ModuleDecl(namePath: string[], location, isImplicit)
    const implicitModule = new ModuleDecl(['global'], emptyLocation, true);

    return new Program(implicitModule, [], emptyLocation);
  }
}