/**
 * Debug E2E Test Failures
 *
 * This script tests the specific code patterns that are failing in E2E tests
 * and outputs detailed diagnostic information.
 */

import { Compiler } from '../packages/compiler/dist/compiler.js';
import { getDefaultConfig } from '../packages/compiler/dist/config/defaults.js';

interface TestCase {
  name: string;
  source: string;
  expectedSuccess: boolean;
  expectedAsm?: string[];
}

const testCases: TestCase[] = [
  // @map array type failures
  {
    name: '@map byte array at address',
    source: '@map screen at $0400: byte[1000];',
    expectedSuccess: true,
  },
  {
    name: '@map word array at address',
    source: '@map vectors at $FFFA: word[3];',
    expectedSuccess: true,
  },
  {
    name: 'export @map byte array',
    source: 'export @map screen at $0400: byte[1000];',
    expectedSuccess: true,
  },

  // JSR function call failures
  {
    name: 'JSR for function call',
    source: `
function helper(): void {
}
function main(): void {
  helper();
}
`,
    expectedSuccess: true,
    expectedAsm: ['JSR _helper'],
  },
  {
    name: 'Multiple calls in sequence',
    source: `
function a(): void {
}
function b(): void {
}
function main(): void {
  a();
  b();
}
`,
    expectedSuccess: true,
    expectedAsm: ['JSR _a', 'JSR _b'],
  },

  // hi()/lo() codegen failures
  {
    name: 'hi() extracts high byte',
    source: `
let result: byte = 0;
function main(): void {
  result = hi($1234);
}
`,
    expectedSuccess: true,
    expectedAsm: ['LDA #$12'],
  },
  {
    name: 'lo/hi both bytes',
    source: `
let low: byte = 0;
let high: byte = 0;
function main(): void {
  low = lo($AB12);
  high = hi($AB12);
}
`,
    expectedSuccess: true,
    expectedAsm: ['LDA #$12', 'LDA #$AB'],
  },

  // volatile intrinsics failures
  {
    name: 'volatile_read generates LDA',
    source: `
let rasterLine: byte = 0;
function main(): void {
  rasterLine = volatile_read($D012);
}
`,
    expectedSuccess: true,
    expectedAsm: ['LDA $D012'],
  },
  {
    name: 'volatile_write generates STA',
    source: `
function main(): void {
  volatile_write($D020, 1);
}
`,
    expectedSuccess: true,
    expectedAsm: ['STA $D020'],
  },

  // Recursive function failure
  {
    name: 'Recursive function',
    source: `
function factorial(n: byte): byte {
  if (n == 0) {
    return 1;
  }
  return n * factorial(n - 1);
}
`,
    expectedSuccess: true,
  },

  // Unary minus EOR failure
  {
    name: 'Unary minus negates variable',
    source: `
let x: byte = 5;
let y: byte = 0;
function main(): void {
  y = -x;
}
`,
    expectedSuccess: true,
    expectedAsm: ['EOR'],
  },

  // length() with @map array
  {
    name: 'length() with @map array',
    source: `
@map screen at $0400: byte[1000];
function test(): word {
  return length(screen);
}
`,
    expectedSuccess: true,
  },
];

function runTests(): void {
  console.log('='.repeat(70));
  console.log('Debug E2E Test Failures');
  console.log('='.repeat(70));
  console.log('');

  const compiler = new Compiler();
  const config = getDefaultConfig();

  let passed = 0;
  let failed = 0;

  for (const test of testCases) {
    const sources = new Map<string, string>();
    sources.set('main.blend', test.source);

    console.log(`\n--- Test: ${test.name} ---`);
    console.log('Source:');
    console.log(test.source.trim());
    console.log('');

    try {
      const result = compiler.compileSource(sources, config);

      console.log(`Success: ${result.success}`);

      if (result.diagnostics.length > 0) {
        console.log('Diagnostics:');
        for (const d of result.diagnostics) {
          const loc = d.location
            ? ` at ${d.location.start.line}:${d.location.start.column}`
            : '';
          console.log(`  [${d.severity}] ${d.message}${loc}`);
        }
      }

      if (result.success !== test.expectedSuccess) {
        console.log(`FAIL: Expected success=${test.expectedSuccess}, got ${result.success}`);
        failed++;
        continue;
      }

      if (result.success && result.output?.assembly) {
        console.log('\nGenerated Assembly (excerpt):');
        const lines = result.output.assembly.split('\n');
        // Show the main function section and any relevant code
        let inMain = false;
        let relevantLines: string[] = [];
        for (const line of lines) {
          if (line.includes('_main:') || line.includes('_helper:') || line.includes('_a:') || line.includes('_b:') || line.includes('_factorial:') || line.includes('_test:')) {
            inMain = true;
          }
          if (inMain) {
            relevantLines.push(line);
            if (line.trim() === 'RTS') {
              inMain = false;
            }
          }
        }

        if (relevantLines.length > 0) {
          console.log(relevantLines.join('\n'));
        } else {
          // Show first 30 non-comment lines
          const codeLines = lines.filter(l => !l.startsWith(';') && l.trim().length > 0).slice(0, 30);
          console.log(codeLines.join('\n'));
        }

        // Check for expected ASM patterns
        if (test.expectedAsm) {
          const asm = result.output.assembly;
          for (const pattern of test.expectedAsm) {
            if (!asm.includes(pattern)) {
              console.log(`\nFAIL: Expected assembly to contain "${pattern}"`);
              failed++;
              continue;
            }
          }
        }
      }

      passed++;
      console.log('PASS');
    } catch (error) {
      console.log(`ERROR: ${error}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(70));
}

runTests();