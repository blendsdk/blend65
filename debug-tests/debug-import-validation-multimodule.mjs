/**
 * Debug: import-validation.test.ts
 * Test: "should not break existing multi-module tests"
 * 
 * Expected: result.success === true
 * Actual: result.success === false
 */

import { Lexer } from '../packages/compiler/dist/lexer/lexer.js';
import { Parser } from '../packages/compiler/dist/parser/parser.js';
import { SemanticAnalyzer } from '../packages/compiler/dist/semantic/analyzer.js';

const moduleASource = `
  module moduleA
  export let foo: byte = 10;
  export function getFoo(): byte
    return foo;
  end function
`;

const moduleBSource = `
  module moduleB
  import foo, getFoo from moduleA

  export function main(): void
    let x: byte = foo;
    let y: byte = getFoo();
  end function
`;

console.log('=== DEBUG: Import Validation - Multi-Module ===\n');
console.log('Module A:');
console.log(moduleASource);
console.log('\nModule B:');
console.log(moduleBSource);
console.log('\n--- Parsing ---');

const lexerA = new Lexer(moduleASource);
const tokensA = lexerA.tokenize();
const parserA = new Parser(tokensA);
const programA = parserA.parse();

const lexerB = new Lexer(moduleBSource);
const tokensB = lexerB.tokenize();
const parserB = new Parser(tokensB);
const programB = parserB.parse();

console.log('✓ Both modules parsed successfully\n');

console.log('--- Semantic Analysis (analyzeMultiple) ---');
const analyzer = new SemanticAnalyzer();
const result = analyzer.analyzeMultiple([programA, programB]);

console.log(`\nResult.success: ${result.success}`);
console.log(`Diagnostics count: ${result.diagnostics.length}\n`);

if (result.diagnostics.length > 0) {
  console.log('DIAGNOSTICS:');
  result.diagnostics.forEach((diag, idx) => {
    console.log(`  ${idx + 1}. [${diag.severity}] [${diag.code}] ${diag.message}`);
    if (diag.location) {
      console.log(`     at line ${diag.location.line}, column ${diag.location.column}`);
    }
  });
  console.log();
}

console.log('--- Module Results ---');
console.log(`Modules analyzed: ${result.modules.size}`);
console.log(`Modules: ${Array.from(result.modules.keys()).join(', ')}`);

if (result.modules.has('moduleA')) {
  const modA = result.modules.get('moduleA');
  console.log(`\nModule A: success=${modA.success}, diagnostics=${modA.diagnostics.length}`);
}

if (result.modules.has('moduleB')) {
  const modB = result.modules.get('moduleB');
  console.log(`Module B: success=${modB.success}, diagnostics=${modB.diagnostics.length}`);
}

console.log('\n=== ISSUE ===');
console.log('Expected: result.success === true (existing multi-module tests should not break)');
console.log(`Actual: result.success === ${result.success}`);
console.log('\nThis tests that valid cross-module imports work correctly.');