#!/usr/bin/env npx tsx
/**
 * Debug Skipped Tests
 *
 * This script investigates the 5 remaining skipped tests in the compiler test suite.
 * Run with: npx tsx scripts/debug-skipped-tests.ts
 *
 * Skipped Tests:
 * 1. type-acceptance.test.ts - length() with string literal
 * 2. generator-expressions-ternary.test.ts - ternary for function argument
 * 3. optimizer-metrics.test.ts - strength reduction (optimizer not implemented)
 * 4. type-checker-assignments-complex.test.ts - chained function calls (array return types)
 * 5. performance.test.ts - consistent performance (inherently flaky)
 *
 * @module scripts/debug-skipped-tests
 */

import { ILExpressionGenerator } from '../packages/compiler/src/il/generator/expressions.js';
import { GlobalSymbolTable } from '../packages/compiler/src/semantic/global-symbol-table.js';
import { Lexer } from '../packages/compiler/src/lexer/lexer.js';
import { Parser } from '../packages/compiler/src/parser/parser.js';
import { ILOpcode } from '../packages/compiler/src/il/instructions.js';
import type { Program } from '../packages/compiler/src/ast/nodes.js';

// =============================================================================
// Utilities
// =============================================================================

function parseSource(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

function hasInstruction(
  ilFunc: { getBlocks(): readonly { getInstructions(): readonly { opcode: ILOpcode }[] }[] },
  opcode: ILOpcode,
): boolean {
  for (const block of ilFunc.getBlocks()) {
    for (const instr of block.getInstructions()) {
      if (instr.opcode === opcode) return true;
    }
  }
  return false;
}

function printSeparator(title: string): void {
  console.log('\n' + '='.repeat(70));
  console.log(`TEST: ${title}`);
  console.log('='.repeat(70) + '\n');
}

// =============================================================================
// Test 1: length() with string literal
// =============================================================================

function testLengthWithString(): void {
  printSeparator('length() with string literal (type-acceptance.test.ts)');

  const source = `module test
function test(): word {
  return length("hello");
}`;

  console.log('Source:');
  console.log(source);
  console.log('\nExpected: Type error - length() expects byte[], not string');
  console.log('Status: KNOWN ISSUE - requires type system change to treat strings as byte[]');

  try {
    const symbolTable = new GlobalSymbolTable();
    const generator = new ILExpressionGenerator(symbolTable);
    const result = generator.generateModule(parseSource(source));
    console.log('\nResult:', result.success ? 'SUCCESS' : 'FAILED');
    if (!result.success && result.diagnostics) {
      console.log('Diagnostics:', result.diagnostics);
    }
  } catch (error) {
    console.log('\nError:', error instanceof Error ? error.message : error);
  }

  console.log('\nFix Required: Modify type checker to allow string types for length() intrinsic');
}

// =============================================================================
// Test 2: Ternary in function argument
// =============================================================================

function testTernaryInFunctionArg(): void {
  printSeparator('Ternary in function argument (generator-expressions-ternary.test.ts)');

  const source = `module test
function identity(x: byte): byte { return x; }
function test(): byte { let flag: boolean = true; return identity(flag ? 10 : 20); }`;

  console.log('Source:');
  console.log(source);
  console.log('\nExpected: BRANCH instruction in test() function AND CALL instruction');

  try {
    const symbolTable = new GlobalSymbolTable();
    const generator = new ILExpressionGenerator(symbolTable);
    const result = generator.generateModule(parseSource(source));

    console.log('\nResult:', result.success ? 'SUCCESS' : 'FAILED');

    if (result.success && result.module) {
      const testFunc = result.module.getFunction('test');
      if (testFunc) {
        const hasBranch = hasInstruction(testFunc, ILOpcode.BRANCH);
        const hasCall = hasInstruction(testFunc, ILOpcode.CALL);
        const hasCallVoid = hasInstruction(testFunc, ILOpcode.CALL_VOID);
        console.log('Has BRANCH:', hasBranch);
        console.log('Has CALL:', hasCall);
        console.log('Has CALL_VOID:', hasCallVoid);

        if (hasBranch && hasCall) {
          console.log('\n✅ TEST WOULD PASS - Consider enabling the test!');
        } else if (hasBranch && hasCallVoid) {
          console.log('\n⚠️ TEST FAILS - Using CALL_VOID instead of CALL');
          console.log('   The IL generator is treating identity() as void-returning');
          console.log('   Bug: identity(x: byte): byte should use CALL, not CALL_VOID');
        } else {
          console.log('\n❌ TEST WOULD FAIL - Missing expected instructions');
        }

        // Print all instructions for debugging
        console.log('\nInstructions in test():');
        for (const block of testFunc.getBlocks()) {
          console.log(`  Block ${block.getLabel()}:`);
          for (const instr of block.getInstructions()) {
            console.log(`    ${ILOpcode[instr.opcode]}`);
          }
        }
      }
    }
  } catch (error) {
    console.log('\nError:', error instanceof Error ? error.message : error);
  }
}

// =============================================================================
// Test 3: Strength reduction (optimizer)
// =============================================================================

function testStrengthReduction(): void {
  printSeparator('Strength reduction (optimizer-metrics.test.ts)');

  console.log('Status: CANNOT TEST - Optimizer is not implemented');
  console.log('This test requires the O2 optimizer to convert:');
  console.log('  x * 2 → x << 1 (ASL instruction)');
  console.log('  x * 4 → x << 2');
  console.log('  etc.');
  console.log('\nFix Required: Implement optimizer with strength reduction pass');
}

// =============================================================================
// Test 4: Chained function calls with array return
// =============================================================================

function testArrayReturnType(): void {
  printSeparator('Array return type (type-checker-assignments-complex.test.ts)');

  const source = `module test
function getIndex(): byte {
  return 2;
}

function getArray(): byte[5] {
  return [1, 2, 3, 4, 5];
}

let value: byte = getArray()[getIndex()];`;

  console.log('Source:');
  console.log(source);
  console.log('\nExpected: Type error - byte[5] return type not supported');

  try {
    const program = parseSource(source);
    console.log('\nParsing:', 'SUCCESS');

    // Try to generate IL
    const symbolTable = new GlobalSymbolTable();
    const generator = new ILExpressionGenerator(symbolTable);
    const result = generator.generateModule(program);

    console.log('IL Generation:', result.success ? 'SUCCESS' : 'FAILED');
    if (!result.success && result.diagnostics) {
      console.log('Diagnostics:', result.diagnostics);
    }
  } catch (error) {
    console.log('\nError:', error instanceof Error ? error.message : error);
  }

  console.log('\nFix Required: Implement array return types in function declarations');
}

// =============================================================================
// Test 5: Performance consistency
// =============================================================================

function testPerformanceConsistency(): void {
  printSeparator('Performance consistency (performance.test.ts)');

  console.log('Status: SHOULD REMAIN SKIPPED');
  console.log('Reason: Inherently flaky due to:');
  console.log('  - System load variations');
  console.log('  - GC timing');
  console.log('  - CPU throttling');
  console.log('  - Background processes');
  console.log('\nThis test measures variance across multiple compilations');
  console.log('and expects deviation < 2x average, which is unreliable.');
  console.log('\nRecommendation: Keep skipped or move to manual benchmark suite');
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║           SKIPPED TESTS INVESTIGATION SCRIPT                        ║');
  console.log('║                                                                      ║');
  console.log('║  This script investigates the 5 remaining skipped tests:            ║');
  console.log('║  1. length() with string literal                                    ║');
  console.log('║  2. Ternary in function argument                                    ║');
  console.log('║  3. Strength reduction (optimizer)                                  ║');
  console.log('║  4. Array return type in functions                                  ║');
  console.log('║  5. Performance consistency                                         ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  testLengthWithString();
  testTernaryInFunctionArg();
  testStrengthReduction();
  testArrayReturnType();
  testPerformanceConsistency();

  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`
Skipped Test                          | Status              | Action Required
--------------------------------------|---------------------|---------------------------
length() with string literal          | Type system gap     | Modify type checker
Ternary in function argument          | Needs verification  | May be fixable now
Strength reduction                    | Not implemented     | Requires optimizer
Array return types                    | Not supported       | Major type system work
Performance consistency               | Inherently flaky    | Keep skipped
`);
}

main().catch(console.error);