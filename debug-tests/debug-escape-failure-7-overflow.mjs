/**
 * Debug Escape Analysis Failures #7-8: Stack Overflow Detection
 */

import { Lexer } from '../packages/compiler/dist/lexer/lexer.js';
import { Parser } from '../packages/compiler/dist/parser/parser.js';
import { SemanticAnalyzer } from '../packages/compiler/dist/semantic/analyzer.js';

// Test 1: High stack usage (should warn)
const locals = [];
for (let i = 0; i < 100; i++) {
  locals.push(`let var${i}: byte = ${i};`);
}

const source1 = `
function manyLocals(): byte
  ${locals.join('\n  ')}
  return var0;
end function
`;

console.log('=== TEST 1: High Stack Usage (100 locals = 102 bytes) ===\n');

const lexer1 = new Lexer(source1);
const tokens1 = lexer1.tokenize();
const parser1 = new Parser(tokens1);
const ast1 = parser1.parse();

const analyzer1 = new SemanticAnalyzer();
analyzer1.analyze(ast1);

const warnings1 = analyzer1.getDiagnostics().filter(d => d.severity === 'warning');
const errors1 = analyzer1.getDiagnostics().filter(d => d.severity === 'error');

console.log(`Warnings: ${warnings1.length}`);
warnings1.forEach((w, i) => {
  console.log(`  [${i}] ${w.message}`);
});

console.log(`Errors: ${errors1.length}`);

console.log(`\nExpected: At least 1 warning about high stack usage (>200 bytes threshold)`);
console.log(`Has warning with 'stack usage': ${warnings1.some(w => w.message.includes('stack usage'))}`);

// Test 2: Stack overflow (256+ bytes)
console.log('\n\n=== TEST 2: Stack Overflow (30 deep calls) ===\n');

const functions = [];
for (let i = 0; i < 30; i++) {
  const nextCall = i < 29 ? `let result: byte = func${i + 1}();` : 'let result: byte = 1;';
  functions.push(`
function func${i}(): byte
  let a: byte = 1;
  let b: byte = 2;
  let c: byte = 3;
  let d: byte = 4;
  let e: byte = 5;
  let f: byte = 6;
  let g: byte = 7;
  let h: byte = 8;
  let i: byte = 9;
  let j: byte = 10;
  ${nextCall}
  return result;
end function
`);
}

const source2 = functions.join('\n');

const lexer2 = new Lexer(source2);
const tokens2 = lexer2.tokenize();
const parser2 = new Parser(tokens2);
const ast2 = parser2.parse();

const analyzer2 = new SemanticAnalyzer();
analyzer2.analyze(ast2);

const errors2 = analyzer2.getDiagnostics().filter(d => d.severity === 'error');

console.log(`Errors: ${errors2.length}`);
errors2.forEach((e, i) => {
  console.log(`  [${i}] ${e.message}`);
});

console.log(`\nExpected: At least 1 error about 'Stack overflow'`);
console.log(`Has 'Stack overflow' error: ${errors2.some(e => e.message.includes('Stack overflow'))}`);