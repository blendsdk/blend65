/**
 * Debug script for E2E semantic test failures
 */

import { SemanticAnalyzer, type AnalysisResult } from '../packages/compiler-v2/src/semantic/index.js';
import { DiagnosticSeverity, DiagnosticCode } from '../packages/compiler-v2/src/ast/diagnostics.js';
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
  const analyzer = new SemanticAnalyzer({
    runAdvancedAnalysis: true,
    includeInfoDiagnostics: true,
  });
  return analyzer.analyze(program);
}

function analyzeBasic(source: string): AnalysisResult {
  const program = parse(source);
  const analyzer = new SemanticAnalyzer({
    runAdvancedAnalysis: false,
  });
  return analyzer.analyze(program);
}

function getErrors(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.filter(d => d.severity === DiagnosticSeverity.ERROR);
}

function getWarnings(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.filter(d => d.severity === DiagnosticSeverity.WARNING);
}

function hasWarningCode(diagnostics: Diagnostic[], code: DiagnosticCode): boolean {
  return diagnostics.some(
    d => d.severity === DiagnosticSeverity.WARNING && d.code === code
  );
}

console.log('=== Test 1: should warn about unused parameter ===');
{
  const result = analyze(`
    module Test

    function process(unusedParam: byte): void {
      // Parameter is never used
    }
  `);
  
  console.log('success:', result.success);
  console.log('hasUnusedParameter warning:', hasWarningCode(result.diagnostics, DiagnosticCode.UNUSED_PARAMETER));
  console.log('All diagnostics:');
  result.diagnostics.forEach(d => {
    console.log(`  [${DiagnosticSeverity[d.severity]}] ${DiagnosticCode[d.code]}: ${d.message}`);
  });
  console.log('');
}

console.log('=== Test 2: should NOT warn when variable is used in expression ===');
{
  const result = analyze(`
    module Test

    function process(x: byte): byte { return x; }

    function main(): void {
      let value: byte = 5;
      let result: byte = process(value);
    }
  `);
  
  console.log('success:', result.success);
  const unusedVarWarnings = result.diagnostics.filter(
    d => d.code === DiagnosticCode.UNUSED_VARIABLE &&
         d.message.toLowerCase().includes('value')
  );
  console.log('unusedVarWarnings for "value":', unusedVarWarnings.length);
  console.log('All diagnostics:');
  result.diagnostics.forEach(d => {
    console.log(`  [${DiagnosticSeverity[d.severity]}] ${DiagnosticCode[d.code]}: ${d.message}`);
  });
  console.log('');
}

console.log('=== Test 3: should detect wrong argument type ===');
{
  const result = analyzeBasic(`
    module Test

    function process(x: byte): void {}

    function main(): void {
      let flag: bool = true;
      process(flag);
    }
  `);
  
  console.log('success:', result.success);
  console.log('errors:', getErrors(result.diagnostics).length);
  console.log('All diagnostics:');
  result.diagnostics.forEach(d => {
    console.log(`  [${DiagnosticSeverity[d.severity]}] ${DiagnosticCode[d.code]}: ${d.message}`);
  });
  console.log('');
}

console.log('=== Test 4: should detect type mismatch in assignment ===');
{
  const result = analyzeBasic(`
    module Test

    function main(): void {
      let x: byte = 10;
      let flag: bool = true;
      x = flag;
    }
  `);
  
  console.log('success:', result.success);
  console.log('errors:', getErrors(result.diagnostics).length);
  console.log('All diagnostics:');
  result.diagnostics.forEach(d => {
    console.log(`  [${DiagnosticSeverity[d.severity]}] ${DiagnosticCode[d.code]}: ${d.message}`);
  });
  console.log('');
}

console.log('=== Test 5: should analyze program with arrays ===');
{
  const result = analyzeBasic(`
    module Test

    function sumArray(arr: byte[5]): byte {
      let sum: byte = 0;
      for (let i: byte = 0 to 4 step 1) {
        sum = sum + arr[i];
      }
      return sum;
    }

    function main(): byte {
      let data: byte[5] = [1, 2, 3, 4, 5];
      return sumArray(data);
    }
  `);
  
  console.log('success:', result.success);
  console.log('errors:', getErrors(result.diagnostics).length);
  console.log('All diagnostics:');
  result.diagnostics.forEach(d => {
    console.log(`  [${DiagnosticSeverity[d.severity]}] ${DiagnosticCode[d.code]}: ${d.message}`);
  });
  console.log('');
}

console.log('=== DONE ===');