/**
 * Parser Configuration
 *
 * Configuration options for the Blend65 parser, allowing customization
 * of parsing behavior, error handling, and output.
 */

/**
 * Parser configuration options
 *
 * Controls various aspects of parser behavior including:
 * - Error handling strategy
 * - Diagnostic collection
 * - Strict mode enforcement
 * - Performance optimizations
 */
export interface ParserConfig {
  /**
   * Continue parsing after errors
   *
   * If true, parser will attempt to recover from errors and continue
   * parsing to find more errors. If false, stops at first error.
   *
   * Default: true (better user experience - see all errors at once)
   */
  continueOnError: boolean;

  /**
   * Maximum number of errors before stopping
   *
   * Prevents infinite loops or excessive error accumulation.
   * Parser stops after this many errors even if continueOnError is true.
   *
   * Default: 100
   */
  maxErrors: number;

  /**
   * Collect warnings
   *
   * If true, parser emits warnings for suspicious but valid code.
   * If false, only errors are collected.
   *
   * Default: true
   */
  collectWarnings: boolean;

  /**
   * Strict mode
   *
   * If true, warnings are treated as errors (compilation fails).
   * Useful for ensuring high code quality standards.
   *
   * Default: false
   */
  strict: boolean;

  /**
   * Build parent links in AST
   *
   * If true, each AST node gets a parent pointer for upward traversal.
   * Useful for some analysis but has memory/performance cost.
   *
   * Default: false (build parent links only when needed)
   */
  buildParentLinks: boolean;

  /**
   * Track source text in nodes
   *
   * If true, stores the actual source text in each node's location.
   * Useful for error messages but increases memory usage.
   *
   * Default: false (extract from source on demand)
   */
  trackSourceText: boolean;
}

/**
 * Default parser configuration
 *
 * Optimized for development workflow:
 * - Shows all errors (continueOnError)
 * - Collects warnings
 * - Not strict (warnings don't fail build)
 * - Minimal memory overhead (no parent links or source text caching)
 */
export const DEFAULT_PARSER_CONFIG: ParserConfig = {
  continueOnError: true,
  maxErrors: 100,
  collectWarnings: true,
  strict: false,
  buildParentLinks: false,
  trackSourceText: false,
};

/**
 * Strict parser configuration
 *
 * For production builds or high-quality code enforcement:
 * - Shows all errors
 * - Collects warnings
 * - Strict mode (warnings are errors)
 * - Minimal memory overhead
 */
export const STRICT_PARSER_CONFIG: ParserConfig = {
  continueOnError: true,
  maxErrors: 100,
  collectWarnings: true,
  strict: true,
  buildParentLinks: false,
  trackSourceText: false,
};

/**
 * Development parser configuration
 *
 * For development with maximum feedback:
 * - Shows all errors
 * - Collects warnings
 * - Not strict
 * - Tracks source text (better error messages)
 * - Builds parent links (enables more analysis)
 */
export const DEV_PARSER_CONFIG: ParserConfig = {
  continueOnError: true,
  maxErrors: 100,
  collectWarnings: true,
  strict: false,
  buildParentLinks: true,
  trackSourceText: true,
};

/**
 * Creates a custom parser configuration
 *
 * Merges provided options with default configuration.
 *
 * @param options - Partial configuration to override defaults
 * @returns Complete parser configuration
 *
 * @example
 * ```typescript
 * const config = createParserConfig({
 *   strict: true,
 *   maxErrors: 50
 * });
 * ```
 */
export function createParserConfig(options: Partial<ParserConfig> = {}): ParserConfig {
  return {
    ...DEFAULT_PARSER_CONFIG,
    ...options,
  };
}
