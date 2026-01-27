/**
 * @file Fixture Type Definitions for E2E Testing Infrastructure
 * @description Type definitions for fixture metadata parsing and validation
 *
 * Fixtures are Blend source files with metadata comments that define
 * expected compilation behavior (success, error, warnings) and output validation.
 */

/**
 * Fixture categories that map to the directory structure.
 * Each category represents a different phase of compilation being tested.
 */
export enum FixtureCategory {
  /** Lexer/tokenization tests */
  Lexer = 'lexer',
  /** Parser/AST construction tests */
  Parser = 'parser',
  /** Semantic analysis/type checking tests */
  Semantic = 'semantic',
  /** IL generation tests */
  ILGenerator = 'il-generator',
  /** Optimizer transformation tests */
  Optimizer = 'optimizer',
  /** Code generation tests */
  Codegen = 'codegen',
  /** Full pipeline integration tests */
  Integration = 'integration',
  /** Edge case and boundary value tests */
  EdgeCases = 'edge-cases',
  /** Error handling validation tests */
  ErrorCases = 'error-cases',
  /** Regression tests for fixed bugs */
  Regressions = 'regressions',
}

/**
 * Expected outcome of compiling a fixture.
 */
export enum ExpectedOutcome {
  /** Compilation should succeed without errors */
  Success = 'success',
  /** Compilation should fail with an error */
  Error = 'error',
  /** Compilation should succeed but produce warnings */
  Warning = 'warning',
}

/**
 * Output check type - how to validate the generated assembly.
 */
export enum OutputCheckType {
  /** Check if output contains a specific pattern */
  Contains = 'contains',
  /** Check if output does NOT contain a specific pattern */
  NotContains = 'not-contains',
  /** Check if output matches a regex pattern */
  Matches = 'matches',
  /** Check instruction count or size constraints */
  SizeConstraint = 'size-constraint',
}

/**
 * A single output validation check.
 */
export interface OutputCheck {
  /** Type of check to perform */
  type: OutputCheckType;
  /** Pattern or value to check against */
  pattern: string;
  /** Optional description for error messages */
  description?: string;
}

/**
 * Complete fixture metadata parsed from source file comments.
 */
export interface FixtureMetadata {
  /**
   * Unique fixture identifier (path-like format).
   * Example: "integration/real-programs/sprite-movement"
   */
  fixture: string;

  /**
   * Category this fixture belongs to.
   * Determines which compiler phase is being tested.
   */
  category: FixtureCategory;

  /**
   * Human-readable description of what this fixture tests.
   */
  description: string;

  /**
   * Expected outcome of compilation.
   */
  expect: ExpectedOutcome;

  /**
   * Expected error code (required if expect is 'error').
   * Should match compiler diagnostic codes.
   */
  errorCode?: string;

  /**
   * Expected error message substring (optional, for error cases).
   */
  errorMessage?: string;

  /**
   * Output validation checks (optional).
   * Array of checks to perform on generated assembly.
   */
  outputChecks?: OutputCheck[];

  /**
   * If set, this fixture should be skipped with the given reason.
   */
  skip?: string;

  /**
   * Additional categorization tags for filtering tests.
   */
  tags?: string[];

  /**
   * Dependencies on other fixtures or modules (for multi-file tests).
   */
  dependencies?: string[];

  /**
   * Minimum optimization level required for this test.
   * Default is 0 (no optimization).
   */
  minOptLevel?: number;

  /**
   * Maximum optimization level this test is valid for.
   * Default is unlimited.
   */
  maxOptLevel?: number;
}

/**
 * Result of parsing fixture metadata from a source file.
 */
export interface FixtureParseResult {
  /** Whether parsing succeeded */
  success: boolean;
  /** Parsed metadata (if successful) */
  metadata?: FixtureMetadata;
  /** Parse errors (if failed) */
  errors?: string[];
  /** Warnings (non-fatal issues) */
  warnings?: string[];
}

/**
 * A loaded fixture ready for execution.
 */
export interface LoadedFixture {
  /** File path relative to fixtures directory */
  filePath: string;
  /** Absolute file path */
  absolutePath: string;
  /** Source code content */
  source: string;
  /** Parsed metadata */
  metadata: FixtureMetadata;
}

/**
 * Result of executing a single fixture test.
 */
export interface FixtureTestResult {
  /** The fixture that was tested */
  fixture: LoadedFixture;
  /** Whether the test passed */
  passed: boolean;
  /** Detailed failure reason (if failed) */
  failureReason?: string;
  /** Compilation diagnostics */
  diagnostics?: string[];
  /** Generated assembly output (if compilation succeeded) */
  assemblyOutput?: string;
  /** Execution time in milliseconds */
  executionTimeMs: number;
}

/**
 * Summary of all fixture test results.
 */
export interface FixtureTestSummary {
  /** Total number of fixtures */
  total: number;
  /** Number of passed tests */
  passed: number;
  /** Number of failed tests */
  failed: number;
  /** Number of skipped tests */
  skipped: number;
  /** Pass rate as percentage */
  passRate: number;
  /** Total execution time in milliseconds */
  totalTimeMs: number;
  /** Individual test results */
  results: FixtureTestResult[];
  /** Failed test details for reporting */
  failures: FixtureTestResult[];
}

/**
 * Configuration for the fixture test runner.
 */
export interface FixtureRunnerConfig {
  /** Base directory for fixtures */
  fixturesDir: string;
  /** Categories to include (empty = all) */
  includeCategories?: FixtureCategory[];
  /** Categories to exclude */
  excludeCategories?: FixtureCategory[];
  /** Tag filters (include fixtures with any of these tags) */
  includeTags?: string[];
  /** Tag filters (exclude fixtures with any of these tags) */
  excludeTags?: string[];
  /** Optimization level to use */
  optimizationLevel?: number;
  /** Whether to run skipped tests anyway */
  runSkipped?: boolean;
  /** Stop on first failure */
  failFast?: boolean;
  /** Verbose output */
  verbose?: boolean;
}