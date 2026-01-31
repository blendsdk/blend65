/**
 * Debug script to analyze type checking test failures
 */

import { SemanticAnalyzer, type AnalysisResult } from '../packages/compiler-v2/src/semantic/index.js';
import { DiagnosticSeverity } from '../packages/compiler-v2/src/ast/diagnostics.js';
import { Parser } from '../packages/compiler-v2/src/parser/index.js';
import { Lexer } from '../packages/compiler-v2/src/lexer/index.js';
import type { Program, Diagnostic } from '../packages/compiler-v2/src/ast/index.js';

function parse(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, source);
  return parser.parse();
}

function analyze(source: string): AnalysisResult {
  const program = parse(source);
  const analyzer = new SemanticAnalyzer({ runAdvancedAnalysis: false });
  return analyzer.analyze(program);
}

function getErrors(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.filter(d => d.severity === DiagnosticSeverity.ERROR);
}

console.log('=== Test 1: should handle binary literals ===');
const test1Source = `
module Test
let a: byte = %10101010;
`;
const result1 = analyze(test1Source);
console.log('Success:', result1.success);
console.log('Errors:', getErrors(result1.diagnostics).map(d => d.message));
console.log('All diagnostics:', result1.diagnostics.map(d => `[${d.severity}] ${d.message}`));
console.log('');

console.log('=== Test 2: should detect wrong argument type ===');
const test2Source = `
module Test

function process(x: byte): void {}

function main(): void {
  let flag: bool = true;
  process(flag);
}
`;
const result2 = analyze(test2Source);
console.log('Success:', result2.success, '(expected false)');
console.log('Errors:', getErrors(result2.diagnostics).map(d => d.message));
console.log('All diagnostics:', result2.diagnostics.map(d => `[${d.severity}] ${d.message}`));
console.log('');

console.log('=== Test 3: should detect type mismatch in assignment ===');
const test3Source = `
module Test

function main(): void {
  let x: byte = 10;
  let flag: bool = true;
  x = flag;
}
`;
const result3 = analyze(test3Source);
console.log('Success:', result3.success, '(expected false)');
console.log('Errors:', getErrors(result3.diagnostics).map(d => d.message));
console.log('All diagnostics:', result3.diagnostics.map(d => `[${d.severity}] ${d.message}`));
console.log('');