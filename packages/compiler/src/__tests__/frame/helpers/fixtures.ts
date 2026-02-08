/**
 * Test fixture loading utilities and inline fixtures
 *
 * Provides both file-based fixture loading and inline fixture constants
 * for quick, focused tests.
 *
 * @module __tests__/frame/helpers/fixtures
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

// Path to SFA test fixtures directory
const FIXTURES_ROOT = join(__dirname, '../../../../fixtures/sfa');

/**
 * Load a fixture file by category and name
 *
 * @param category - The fixture category (e.g., '01-basic', '02-coalescing')
 * @param name - The fixture name (without .blend extension)
 * @returns The fixture source code
 */
export function loadFixture(category: string, name: string): string {
  const path = join(FIXTURES_ROOT, category, `${name}.blend`);
  if (!existsSync(path)) {
    throw new Error(`Fixture not found: ${path}`);
  }
  return readFileSync(path, 'utf-8');
}

/**
 * Load all fixtures from a category
 *
 * @param category - The fixture category directory
 * @returns Map of fixture name to source code
 */
export function loadFixtureCategory(category: string): Map<string, string> {
  const categoryPath = join(FIXTURES_ROOT, category);
  const fixtures = new Map<string, string>();

  if (!existsSync(categoryPath)) {
    return fixtures;
  }

  const files = readdirSync(categoryPath).filter(f => f.endsWith('.blend'));
  for (const file of files) {
    const name = basename(file, '.blend');
    const content = readFileSync(join(categoryPath, file), 'utf-8');
    fixtures.set(name, content);
  }

  return fixtures;
}

/**
 * Check if fixtures directory exists
 *
 * @returns True if SFA fixtures directory exists
 */
export function fixturesExist(): boolean {
  return existsSync(FIXTURES_ROOT);
}

/**
 * Common test programs as inline strings
 *
 * These fixtures are for quick, focused unit tests that don't need
 * file-based fixtures. Use file-based fixtures for complex scenarios.
 */
export const INLINE_FIXTURES = {
  // ===== BASIC FIXTURES =====

  /**
   * Single function with no locals
   * Expected: Frame with 0 bytes
   */
  emptyFunction: `
module Test;

function main(): void {
}
`,

  /**
   * Single function with one local
   * Expected: Frame with 1 byte
   */
  oneLocal: `
module Test;

function main(): void {
  let x: byte = 0;
}
`,

  /**
   * Single function with two byte locals
   * Expected: Frame with 2 bytes
   */
  simpleLocals: `
module Test;

function main(): void {
  let x: byte = 0;
  let y: byte = 0;
}
`,

  /**
   * Function with various sized locals
   * Expected: Frame with 5 bytes (1 + 2 + 2)
   */
  mixedSizeLocals: `
module Test;

function main(): void {
  let small: byte = 0;
  let medium: word = 0;
  let counter: word = 0;
}
`,

  /**
   * Function with parameters
   * Expected: Frame includes parameter slots
   */
  withParameters: `
module Test;

function add(a: byte, b: byte): byte {
  return a + b;
}
`,

  // ===== CALL GRAPH FIXTURES =====

  /**
   * Two non-overlapping functions (sequentially called)
   * Expected: Functions can coalesce (share memory)
   */
  nonOverlapping: `
module Test;

function main(): void {
  funcA();
  funcB();
}

function funcA(): void {
  let a: byte = 0;
}

function funcB(): void {
  let b: byte = 0;
}
`,

  /**
   * Nested calls (funcA calls funcB)
   * Expected: Functions CANNOT coalesce (overlapping execution)
   */
  nestedCalls: `
module Test;

function main(): void {
  outer();
}

function outer(): void {
  let outerLocal: byte = 0;
  inner();
}

function inner(): void {
  let innerLocal: byte = 0;
}
`,

  /**
   * Direct recursion (should error)
   * Expected: RecursionError
   */
  directRecursion: `
module Test;

function factorial(n: byte): byte {
  if n <= 1 {
    return 1;
  }
  return n * factorial(n - 1);
}
`,

  /**
   * Indirect recursion (should error)
   * Expected: RecursionError
   */
  indirectRecursion: `
module Test;

function funcA(): void {
  funcB();
}

function funcB(): void {
  funcA();
}
`,

  // ===== ZP ALLOCATION FIXTURES =====

  /**
   * Variable with @zp directive (must be in Zero Page)
   * Expected: Variable allocated to ZP
   */
  zpRequired: `
module Test;

function main(): void {
  @zp let counter: byte = 0;
  counter += 1;
}
`,

  /**
   * Variable with @ram directive (must NOT be in Zero Page)
   * Expected: Variable allocated to RAM, not ZP
   */
  ramRequired: `
module Test;

function main(): void {
  @ram let buffer: byte = 0;
}
`,

  /**
   * Pointer variable (high ZP priority)
   * Expected: Pointer gets high ZP score
   */
  pointerVariable: `
module Test;

function main(): void {
  let ptr: *byte = $0400;
  let value: byte = *ptr;
}
`,

  /**
   * Hot variable in loop (high ZP priority)
   * Expected: Loop variable gets elevated ZP score
   */
  hotLoopVariable: `
module Test;

function main(): void {
  let i: byte = 0;
  while i < 100 {
    i += 1;
  }
}
`,

  // ===== CALLBACK/ISR FIXTURES =====

  /**
   * Main function with callback
   * Expected: Main and callback cannot coalesce (different contexts)
   */
  callbackIsolation: `
module Test;

function main(): void {
  let mainLocal: byte = 0;
}

callback irq(): void {
  let irqLocal: byte = 0;
}
`,

  /**
   * Multiple callbacks
   * Expected: Callbacks in ISR context, cannot coalesce with main
   */
  multipleCallbacks: `
module Test;

function main(): void {
  let mainLocal: byte = 0;
}

callback irq(): void {
  let irqLocal: byte = 0;
}

callback nmi(): void {
  let nmiLocal: byte = 0;
}
`,

  // ===== COALESCING FIXTURES =====

  /**
   * Multiple independent functions (should all coalesce)
   * Expected: All functions share same memory region
   */
  manyIndependent: `
module Test;

function main(): void {
  funcA();
  funcB();
  funcC();
  funcD();
}

function funcA(): void {
  let a: byte = 1;
}

function funcB(): void {
  let b: byte = 2;
}

function funcC(): void {
  let c: byte = 3;
}

function funcD(): void {
  let d: byte = 4;
}
`,

  /**
   * Diamond call pattern
   * Expected: B and C can coalesce (both called by A, neither calls the other)
   */
  diamondPattern: `
module Test;

function main(): void {
  funcA();
}

function funcA(): void {
  funcB();
  funcC();
}

function funcB(): void {
  let b: byte = 1;
}

function funcC(): void {
  let c: byte = 2;
}
`,

  // ===== ERROR CONDITION FIXTURES =====

  /**
   * ZP overflow - too many @zp variables
   * Expected: Error when ZP is exhausted
   */
  zpOverflow: `
module Test;

function main(): void {
  @zp let v1: byte = 0;
  @zp let v2: byte = 0;
  @zp let v3: byte = 0;
  @zp let v4: byte = 0;
  @zp let v5: byte = 0;
  @zp let v6: byte = 0;
  @zp let v7: byte = 0;
  @zp let v8: byte = 0;
  @zp let v9: byte = 0;
  @zp let v10: byte = 0;
  @zp let v11: byte = 0;
  @zp let v12: byte = 0;
  @zp let v13: byte = 0;
  @zp let v14: byte = 0;
  @zp let v15: byte = 0;
  @zp let v16: byte = 0;
}
`,

  // ===== REAL-WORLD PATTERNS =====

  /**
   * Game loop pattern
   * Expected: init, update, render can share memory
   */
  gameLoop: `
module Test;

function main(): void {
  init();
  while true {
    update();
    render();
  }
}

function init(): void {
  let initState: byte = 0;
}

function update(): void {
  let updateState: byte = 0;
}

function render(): void {
  let renderState: byte = 0;
}
`,

  /**
   * State machine pattern
   * Expected: State handlers can coalesce
   */
  stateMachine: `
module Test;

function main(): void {
  let state: byte = 0;
  if state == 0 {
    handleIdle();
  }
  if state == 1 {
    handleRunning();
  }
  if state == 2 {
    handlePaused();
  }
}

function handleIdle(): void {
  let idleData: byte = 0;
}

function handleRunning(): void {
  let runData: byte = 0;
}

function handlePaused(): void {
  let pauseData: byte = 0;
}
`,
} as const;

/**
 * Type for inline fixture keys
 */
export type InlineFixtureKey = keyof typeof INLINE_FIXTURES;