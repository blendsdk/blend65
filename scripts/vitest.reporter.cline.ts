/**
 * Cline Reporter for Vitest
 *
 * AI-optimized reporter that:
 * - Runs silently during test execution (no progress output)
 * - Outputs only failures and summary at the end
 * - Provides minimal, parseable output for AI analysis
 */

import type { Task } from '@vitest/runner';
import type { Vitest } from 'vitest/node';

// Minimal interfaces for Vitest reporter types
interface TestResult {
  state: 'passed' | 'failed' | 'skipped' | 'pending' | 'run';
  errors?: Array<{ message?: string; [key: string]: any }>;
}

interface TestCase {
  id: string;
  task: Task;
  result(): TestResult;
}

interface TestModule {
  id: string;
  task: Task;
  children: {
    allTests(): IterableIterator<TestCase>;
  };
}

interface FailedTest {
  /** Full test name including suite hierarchy */
  fullName: string;
  /** Relative file path from project root */
  file: string;
  /** Error message */
  error: string;
}

/**
 * ClineReporter - Silent reporter that outputs minimal results at the end
 *
 * This reporter is designed for AI analysis and provides:
 * - Zero output during test execution
 * - Single output block when all tests complete
 * - Only failed tests shown (passed tests are just counted)
 * - Clean, parseable format optimized for AI token efficiency
 */
export default class ClineReporter {
  /** Count of passed tests */
  protected passed = 0;

  /** Count of failed tests */
  protected failed = 0;

  /** Count of skipped tests */
  protected skipped = 0;

  /** Array of failed test details for final output */
  protected failures: FailedTest[] = [];

  /** Reference to Vitest context */
  protected ctx!: Vitest;

  /** TTY flag */
  protected isTTY = false;

  /**
   * Initialize reporter - silent operation
   */
  onInit(ctx: Vitest): void {
    this.ctx = ctx;
    // Silent - no banner, no output during initialization
  }

  /**
   * Called when test run starts - silent operation
   */
  onTestRunStart(): void {
    // Silent - no output when tests start
    this.passed = 0;
    this.failed = 0;
    this.skipped = 0;
    this.failures = [];
  }

  /**
   * Called when a test module is collected
   * This is where we can iterate over all tests in the module
   */
  onTestModuleCollected(module: TestModule): void {
    // Iterate over all tests in this module
    for (const testCase of module.children.allTests()) {
      // Register the test - we'll count it when result comes in
      this.onTestCaseReady(testCase);
    }
  }

  /**
   * Called when a test case is ready
   */
  protected onTestCaseReady(_testCase: TestCase): void {
    // Silent - just wait for results
  }

  /**
   * Called when a test case completes
   * Accumulates test results silently
   */
  onTestCaseResult(testCase: TestCase): void {
    const result = testCase.result();

    if (!result) {
      return;
    }

    // Count test results
    if (result.state === 'passed') {
      this.passed++;
    } else if (result.state === 'failed') {
      this.failed++;

      // Collect failure details
      const fullName = this.getFullTestName(testCase);
      const file = this.getRelativeFilePath(testCase);
      const error = this.getErrorMessage(result);

      this.failures.push({
        fullName,
        file,
        error,
      });
    } else if (result.state === 'skipped') {
      this.skipped++;
    }
  }

  /**
   * Called when all tests are finished
   * This is the ONLY place where output occurs
   */
  onTestRunEnd(): void {
    // Build output as a single string
    const output: string[] = [];

    output.push('\n=== VITEST RESULTS ===\n');

    // Output failures section (if any)
    if (this.failures.length > 0) {
      output.push('FAILURES:');
      this.failures.forEach((failure, index) => {
        output.push(`[${index + 1}] ${failure.file} > ${failure.fullName}`);
        output.push(`    ${failure.error}\n`);
      });
    } else {
      output.push('FAILURES: None\n');
    }

    // Output summary
    output.push('SUMMARY:');
    output.push(`✓ Passed:  ${this.passed}`);
    output.push(`✗ Failed:  ${this.failed}`);
    output.push(`⊘ Skipped: ${this.skipped}`);
    output.push('━━━━━━━━━━━━━━━━');
    output.push(`Total: ${this.passed + this.failed + this.skipped} tests`);
    output.push('');

    // Write to logger
    this.ctx.logger.log(output.join('\n'));
  }

  /**
   * Build full test name including suite hierarchy
   * Example: "Suite Name > Nested Suite > Test Name"
   */
  protected getFullTestName(testCase: TestCase): string {
    const names: string[] = [];
    let current: Task | undefined = testCase.task;

    // Walk up the task hierarchy to build full name
    while (current) {
      // Skip file-level tasks (they're not part of the test name)
      if (current.type !== 'suite' || !('filepath' in current)) {
        if (current.name) {
          names.unshift(current.name);
        }
      }
      current = current.suite;
    }

    return names.join(' > ');
  }

  /**
   * Get relative file path from project root
   */
  protected getRelativeFilePath(testCase: TestCase): string {
    const filepath = testCase.task.file?.filepath || '';
    if (!filepath) {
      return 'unknown';
    }

    const projectRoot = this.ctx.config.root;
    if (filepath.startsWith(projectRoot)) {
      return filepath.substring(projectRoot.length + 1);
    }
    return filepath;
  }

  /**
   * Extract error message from test result
   * Returns concise error information for AI parsing
   */
  protected getErrorMessage(result: ReturnType<TestCase['result']>): string {
    if (!result || !result.errors || result.errors.length === 0) {
      return 'Unknown error';
    }

    const error = result.errors[0];

    // Get error message
    let message = error.message || String(error);

    // Clean up the message - remove ANSI codes if present
    message = message.replace(/\u001b\[\d+m/g, '');

    // Limit message length for AI efficiency (first 300 chars)
    if (message.length > 300) {
      message = message.substring(0, 300) + '...';
    }

    return message;
  }
}
