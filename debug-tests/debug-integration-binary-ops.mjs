/**
 * Debug: analyzer-integration.test.ts
 * Test: "validates binary operation types"
 * 
 * Expected: result.success === true
 * Actual: result.success === false
 */

import { Lexer } from '../packages/compiler/dist/lexer/lexer.js';
import { Parser } from '../packages/compiler/dist/parser/parser.js';
import { SemanticAnalyzer } from '../packages/compiler/dist/semantic/analyzer.js';

const source = `
  let a: byte = 10;
  let b: byte = 20;

  function test(): void
    let result: byte = a + b;
  end function
`;

console.log('=== DEBUG: Integration - Binary Operations ===\n');
console.log('Source code:');
console.log(source);
console.log('\n--- Parsing ---');

const lexer = new Lexer(source);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('✓ Parsed successfully\n');

console.log('--- Semantic Analysis ---');
const analyzer = new SemanticAnalyzer();
const result = analyzer.analyze(ast);

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

console.log('=== ISSUE ===');
console.log('Expected: result.success === true (binary operations should type check)');
console.log(`Actual: result.success === ${result.success}`);
console.log('\nThis test validates that binary operations like a + b type check correctly.');