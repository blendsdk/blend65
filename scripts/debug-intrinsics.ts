/**
 * Debug Script for Intrinsic Codegen Issues
 *
 * This script analyzes the generated assembly for intrinsics that are failing E2E tests:
 * - hi()/lo() byte extraction
 * - volatile_read/volatile_write
 * - unary minus (negation)
 *
 * Run with: npx tsx scripts/debug-intrinsics.ts
 */

import { Compiler } from '../packages/compiler/dist/compiler.js';
import { getDefaultConfig } from '../packages/compiler/dist/config/defaults.js';

interface TestCase {
  name: string;
  code: string;
  expectedPattern?: string;
}

const testCases: TestCase[] = [
  {
    name: 'hi($1234) - should produce LDA #$12',
    code: `function test(): byte { return hi($1234); }`,
    expectedPattern: 'LDA #$12',
  },
  {
    name: 'lo($1234) - should produce LDA #$34',
    code: `function test(): byte { return lo($1234); }`,
    expectedPattern: 'LDA #$34',
  },
  {
    name: 'hi($ABCD) - should produce LDA #$AB',
    code: `function test(): byte { return hi($ABCD); }`,
    expectedPattern: 'LDA #$AB',
  },
  {
    name: 'lo($ABCD) - should produce LDA #$CD',
    code: `function test(): byte { return lo($ABCD); }`,
    expectedPattern: 'LDA #$CD',
  },
  {
    name: 'volatile_read($D012) - should produce LDA $D012',
    code: `function test(): byte { return volatile_read($D012); }`,
    expectedPattern: 'LDA $D012',
  },
  {
    name: 'volatile_write($D020, 0) - should produce STA $D020',
    code: `function test(): void { volatile_write($D020, 0); }`,
    expectedPattern: 'STA $D020',
  },
  {
    name: 'unary minus - should produce EOR #$FF',
    code: `let x: byte = 10; function test(): byte { return -x; }`,
    expectedPattern: 'EOR',
  },
];

console.log('='.repeat(70));
console.log('Intrinsics Debug Script');
console.log('='.repeat(70));

for (const tc of testCases) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`TEST: ${tc.name}`);
  console.log(`${'='.repeat(70)}`);
  console.log(`\nSource Code:\n${tc.code}`);

  const compiler = new Compiler();
  const config = getDefaultConfig();
  const sources = new Map<string, string>();
  sources.set('main.blend', tc.code);
  const result = compiler.compileSource(sources, config);

  if (result.success && result.output?.assembly) {
    const assembly = result.output.assembly;
    console.log('\n--- Generated Assembly (relevant lines) ---');

    // Filter for relevant instructions
    const lines = assembly.split('\n');
    const relevantLines = lines.filter(
      (l) =>
        l.includes('LDA') ||
        l.includes('STA') ||
        l.includes('EOR') ||
        l.includes('TXA') ||
        l.includes('LDY') ||
        l.includes('_test') ||
        l.includes('RTS') ||
        l.includes('INTRINSIC') ||
        l.includes('NOP') ||
        l.includes('lo(') ||
        l.includes('hi(') ||
        l.includes('volatile'),
    );

    if (relevantLines.length > 0) {
      relevantLines.forEach((l) => console.log(l));
    } else {
      console.log('(No relevant lines found)');
    }

    // Check if expected pattern is present
    if (tc.expectedPattern) {
      const found = assembly.includes(tc.expectedPattern);
      console.log(`\n${found ? '✓ PASS' : '✗ FAIL'}: Expected "${tc.expectedPattern}"`);
      if (!found) {
        console.log('\n--- Full Assembly ---');
        console.log(assembly);
      }
    }
  } else {
    console.log('Compilation failed:');
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    if (errors.length > 0) {
      errors.forEach((e) => console.log(`  - ${e.message}`));
    } else {
      console.log('  - (No error details available)');
      console.log('  - Result:', JSON.stringify(result, null, 2));
    }
  }
}

console.log('\n' + '='.repeat(70));
console.log('Debug Complete');
console.log('='.repeat(70));