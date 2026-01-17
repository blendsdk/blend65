/**
 * Debug: analyzer-integration.test.ts
 * Test: "simple program runs all passes successfully"
 * 
 * Expected: result.success === true
 * Actual: result.success === false
 */

import { Lexer } from '../packages/compiler/dist/lexer/lexer.js';
import { Parser } from '../packages/compiler/dist/parser/parser.js';
import { SemanticAnalyzer } from '../packages/compiler/dist/semantic/analyzer.js';

const source = `
  let counter: byte = 0;
  const MAX: byte = 100;

  function increment(): void
    counter = counter + 1;
  end function

  function main(): void
    increment();
  end function
`;

console.log('=== DEBUG: Integration - Simple Program ===\n');
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

console.log('--- Symbol Table ---');
const symbolTable = analyzer.getSymbolTable();
console.log(`Symbol table exists: ${symbolTable !== null}`);
if (symbolTable) {
  const rootScope = symbolTable.getRootScope();
  console.log(`Root scope symbols: ${Array.from(rootScope.symbols.keys()).join(', ')}`);
}

console.log('\n--- Type System ---');
const typeSystem = analyzer.getTypeSystem();
console.log(`Type system exists: ${typeSystem !== null}`);

console.log('\n--- CFGs ---');
const cfgs = analyzer.getAllCFGs();
console.log(`CFG count: ${cfgs.size}`);
console.log(`CFG keys: ${Array.from(cfgs.keys()).join(', ')}`);

console.log('\n=== ISSUE ===');
console.log('Expected: result.success === true (all passes complete successfully)');
console.log(`Actual: result.success === ${result.success}`);