/**
 * @file Fixture Test Runner
 * @description Main test runner for E2E fixture tests.
 *
 * This test file discovers all fixtures in the fixtures/ directory,
 * compiles them using the real compiler, and validates the results
 * against the expected outcomes defined in fixture metadata.
 *
 * **Usage:**
 * - Run all fixtures: `./compiler-test e2e`
 * - Run with verbose output: VERBOSE=1 ./compiler-test e2e
 *
 * **Fixture Format:**
 * Fixtures are .blend files with metadata comments at the top.
 * See fixtures/README.md for the complete format documentation.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'path';
import { existsSync } from 'fs';
import {
  loadAllFixtures,
  validateAllFixtures,
  generateValidationReport,
} from './fixture-validator.js';
import { FixtureExecutor } from './fixture-executor.js';
import {
  FixtureCategory,
  FixtureTestResult,
  FixtureTestSummary,
  LoadedFixture,
} from './fixture-types.js';

// Get the fixtures directory path
const FIXTURES_DIR = join(__dirname, '../../../fixtures');

// Check if verbose mode is enabled
const VERBOSE = process.env.VERBOSE === '1' || process.env.VERBOSE === 'true';

/**
 * Runs all fixture tests and returns a summary.
 *
 * @param fixtures - Array of loaded fixtures
 * @param executor - Fixture executor instance
 * @returns Test summary with all results
 */
function runFixtures(fixtures: LoadedFixture[], executor: FixtureExecutor): FixtureTestSummary {
  const startTime = performance.now();
  const results: FixtureTestResult[] = [];
  const failures: FixtureTestResult[] = [];

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const fixture of fixtures) {
    const result = executor.execute(fixture);
    results.push(result);

    if (result.failureReason?.startsWith('Skipped:')) {
      skipped++;
    } else if (result.passed) {
      passed++;
    } else {
      failed++;
      failures.push(result);
    }

    // Verbose logging
    if (VERBOSE) {
      const status = result.passed ? '✓' : '✗';
      const skipNote = result.failureReason?.startsWith('Skipped:') ? ' (skipped)' : '';
      console.log(`  ${status} ${fixture.metadata.fixture}${skipNote}`);
      if (!result.passed && !result.failureReason?.startsWith('Skipped:')) {
        console.log(`    Reason: ${result.failureReason}`);
      }
    }
  }

  const totalTimeMs = performance.now() - startTime;

  return {
    total: fixtures.length,
    passed,
    failed,
    skipped,
    passRate: fixtures.length > 0 ? (passed / (fixtures.length - skipped)) * 100 : 100,
    totalTimeMs,
    results,
    failures,
  };
}

/**
 * Formats a failure for detailed reporting.
 *
 * @param result - The failed test result
 * @returns Formatted failure string
 */
function formatFailure(result: FixtureTestResult): string {
  const lines: string[] = [];

  lines.push(`\n═══════════════════════════════════════════════════════════════════`);
  lines.push(`FIXTURE: ${result.fixture.metadata.fixture}`);
  lines.push(`FILE: ${result.fixture.filePath}`);
  lines.push(`EXPECTED: ${result.fixture.metadata.expect}`);
  lines.push(`───────────────────────────────────────────────────────────────────`);
  lines.push(`FAILURE: ${result.failureReason}`);

  if (result.diagnostics && result.diagnostics.length > 0) {
    lines.push(`───────────────────────────────────────────────────────────────────`);
    lines.push('DIAGNOSTICS:');
    for (const diag of result.diagnostics) {
      lines.push(`  ${diag}`);
    }
  }

  lines.push(`═══════════════════════════════════════════════════════════════════\n`);

  return lines.join('\n');
}

/**
 * Generates a summary report for all test results.
 *
 * @param summary - Test summary
 * @returns Formatted summary string
 */
function generateSummaryReport(summary: FixtureTestSummary): string {
  const lines: string[] = [];

  lines.push('\n');
  lines.push('╔═══════════════════════════════════════════════════════════════════╗');
  lines.push('║                    FIXTURE TEST SUMMARY                          ║');
  lines.push('╠═══════════════════════════════════════════════════════════════════╣');
  lines.push(`║  Total Fixtures:  ${String(summary.total).padStart(5)}                                       ║`);
  lines.push(`║  Passed:          ${String(summary.passed).padStart(5)}  ✓                                    ║`);
  lines.push(`║  Failed:          ${String(summary.failed).padStart(5)}  ${summary.failed > 0 ? '✗' : ' '}                                    ║`);
  lines.push(`║  Skipped:         ${String(summary.skipped).padStart(5)}                                       ║`);
  lines.push(`║  Pass Rate:       ${summary.passRate.toFixed(1).padStart(5)}%                                     ║`);
  lines.push(`║  Time:            ${summary.totalTimeMs.toFixed(0).padStart(5)}ms                                    ║`);
  lines.push('╚═══════════════════════════════════════════════════════════════════╝');
  lines.push('');

  return lines.join('\n');
}

describe('E2E Fixture Tests', () => {
  // Store fixtures for use in tests
  let allFixtures: LoadedFixture[] = [];
  let executor: FixtureExecutor;

  beforeAll(() => {
    // Validate fixtures directory exists
    if (!existsSync(FIXTURES_DIR)) {
      console.warn(`Fixtures directory not found: ${FIXTURES_DIR}`);
      return;
    }

    // Create executor
    executor = new FixtureExecutor({
      optimizationLevel: 0,
      target: 'c64',
      verbose: VERBOSE,
    });

    // Load all fixtures
    allFixtures = loadAllFixtures(FIXTURES_DIR);

    if (VERBOSE) {
      console.log(`\nLoaded ${allFixtures.length} fixtures from ${FIXTURES_DIR}\n`);
    }
  });

  it('should validate all fixture files have correct metadata', () => {
    // Skip if no fixtures directory
    if (!existsSync(FIXTURES_DIR)) {
      console.log('Fixtures directory not found, skipping validation');
      return;
    }

    const validationSummary = validateAllFixtures(FIXTURES_DIR);

    // Report validation results
    if (validationSummary.invalidFixtures > 0) {
      console.log(generateValidationReport(validationSummary));
    }

    // All fixtures should be valid
    expect(validationSummary.invalidFixtures).toBe(0);
  });

  it('should have at least one fixture to test', () => {
    // Skip if no fixtures directory
    if (!existsSync(FIXTURES_DIR)) {
      console.log('Fixtures directory not found, skipping');
      return;
    }

    expect(allFixtures.length).toBeGreaterThan(0);
  });

  // Generate individual tests for each fixture
  describe('Individual Fixture Tests', () => {
    // This will be dynamically populated once fixtures are loaded
    it.each(
      // Get fixtures or provide a placeholder if none
      allFixtures.length > 0
        ? allFixtures.map(f => [f.metadata.fixture, f])
        : [['no fixtures loaded', null as unknown as LoadedFixture]]
    )('%s', (fixtureName, fixture) => {
      // Skip placeholder test
      if (!fixture) {
        console.log('No fixtures loaded');
        return;
      }

      const result = executor.execute(fixture);

      // Handle skipped tests
      if (result.failureReason?.startsWith('Skipped:')) {
        console.log(`Skipped: ${result.failureReason}`);
        return;
      }

      // Assert the test passed
      if (!result.passed) {
        console.log(formatFailure(result));
      }

      expect(result.passed, result.failureReason).toBe(true);
    });
  });

  // Category-based test suites
  describe('By Category', () => {
    const categories = Object.values(FixtureCategory);

    for (const category of categories) {
      describe(`Category: ${category}`, () => {
        it(
          `should pass all ${category} fixtures`,
          () => {
            // Skip if no fixtures
            if (allFixtures.length === 0) {
              console.log('No fixtures loaded');
              return;
            }

            // Filter fixtures for this category
            const categoryFixtures = allFixtures.filter(f => f.metadata.category === category);

            // Skip if no fixtures in this category
            if (categoryFixtures.length === 0) {
              console.log(`No fixtures in category: ${category}`);
              return;
            }

            // Run fixtures
            const summary = runFixtures(categoryFixtures, executor);

            // Report results if there are failures
            if (summary.failed > 0) {
              for (const failure of summary.failures) {
                console.log(formatFailure(failure));
              }
            }

            // All should pass
            expect(summary.failed).toBe(0);
          },
          60_000 // 60 second timeout for category aggregation tests
        );
      });
    }
  });

  // Full suite summary test
  describe('Full Suite', () => {
    it(
      'should pass all fixtures',
      () => {
        // Skip if no fixtures
        if (allFixtures.length === 0) {
          console.log('No fixtures loaded');
          return;
        }

        // Run all fixtures
        const summary = runFixtures(allFixtures, executor);

        // Always print summary
        console.log(generateSummaryReport(summary));

        // Print failures if any
        if (summary.failed > 0) {
          console.log('\n=== FAILURES ===\n');
          for (const failure of summary.failures) {
            console.log(formatFailure(failure));
          }
        }

        // All should pass
        expect(summary.failed).toBe(0);
      },
      120_000 // 120 second timeout for full suite aggregation test
    );
  });
});

/**
 * Standalone runner function for programmatic use.
 *
 * @param fixturesDir - Path to fixtures directory
 * @param options - Executor options
 * @returns Test summary
 */
export function runAllFixtures(
  fixturesDir: string,
  options: { optimizationLevel?: number; target?: string; verbose?: boolean } = {}
): FixtureTestSummary {
  const executor = new FixtureExecutor(options);
  const fixtures = loadAllFixtures(fixturesDir);
  return runFixtures(fixtures, executor);
}

/**
 * Runs fixtures for a specific category.
 *
 * @param fixturesDir - Path to fixtures directory
 * @param category - Category to filter by
 * @param options - Executor options
 * @returns Test summary
 */
export function runCategoryFixtures(
  fixturesDir: string,
  category: FixtureCategory,
  options: { optimizationLevel?: number; target?: string; verbose?: boolean } = {}
): FixtureTestSummary {
  const executor = new FixtureExecutor(options);
  const fixtures = loadAllFixtures(fixturesDir, category);
  return runFixtures(fixtures, executor);
}