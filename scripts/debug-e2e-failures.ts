/**
 * Debug script for E2E test failures
 */

import { SemanticAnalyzer } from '../packages/compiler-v2/src/semantic/index.js';
import { Parser } from '../packages/compiler-v2/src/parser/index.js';
import { Lexer } from '../packages/compiler-v2/src/lexer/index.js';
import type { Program } from '../packages/compiler-v2/src/ast/index.js';
import { DiagnosticSeverity } from '../packages/compiler-v2/src/ast/diagnostics.js';

function parse(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, source);
  return parser.parse();
}

function analyze(source: string) {
  const program = parse(source);
  const analyzer = new SemanticAnalyzer({ runAdvancedAnalysis: false });
  return analyzer.analyze(program);
}

// Test 1: Should detect wrong argument type (bool to byte)
console.log('=== Test 1: Wrong argument type ===');
const test1 = analyze(`
  module Test

  function process(x: byte): void {}

  function main(): void {
    let flag: bool = true;
    process(flag);
  }
`);

console.log('Success:', test1.success);
console.log('Diagnostics:');
for (const d of test1.diagnostics) {
  console.log(`  [${DiagnosticSeverity[d.severity]}] ${d.message}`);
}

// Test 2: Should detect type mismatch in assignment
console.log('\n=== Test 2: Type mismatch in assignment ===');
const test2 = analyze(`
  module Test

  function main(): void {
    let x: byte = 10;
    let flag: bool = true;
    x = flag;
  }
`);

console.log('Success:', test2.success);
console.log('Diagnostics:');
for (const d of test2.diagnostics) {
  console.log(`  [${DiagnosticSeverity[d.severity]}] ${d.message}`);
}

// Test 3: Should analyze program with loops
console.log('\n=== Test 3: Program with loops ===');
const test3 = analyze(`
  module Loops

  function sum(n: byte): byte {
    let total: byte = 0;
    for (let i: byte = 1 to n step 1) {
      total = total + i;
    }
    return total;
  }

  function countDown(start: byte): void {
    let i: byte = start;
    while (i > 0) {
      i = i - 1;
    }
  }
`);

console.log('Success:', test3.success);
console.log('Diagnostics:');
for (const d of test3.diagnostics) {
  console.log(`  [${DiagnosticSeverity[d.severity]}] ${d.message}`);
}

// Test 4: Should analyze program with arrays
console.log('\n=== Test 4: Program with arrays ===');
const test4 = analyze(`
  module Arrays

  function sumArray(arr: byte[5]): byte {
    let total: byte = 0;
    for (let i: byte = 0 to 4 step 1) {
      total = total + arr[i];
    }
    return total;
  }

  function main(): void {
    let data: byte[5] = [1, 2, 3, 4, 5];
    let sum: byte = sumArray(data);
  }
`);

console.log('Success:', test4.success);
console.log('Diagnostics:');
for (const d of test4.diagnostics) {
  console.log(`  [${DiagnosticSeverity[d.severity]}] ${d.message}`);
}

console.log('\n=== Debug Complete ===');