/**
 * Debug: analyzer-integration.test.ts
 * Test: "complete C64 program with @map and functions"
 * 
 * Expected: result.success === true
 * Actual: result.success === false
 */

import { Lexer } from '../packages/compiler/dist/lexer/lexer.js';
import { Parser } from '../packages/compiler/dist/parser/parser.js';
import { SemanticAnalyzer } from '../packages/compiler/dist/semantic/analyzer.js';

const source = `
  @map borderColor at $D020: byte;
  @map bgColor at $D021: byte;

  let frameCount: byte = 0;

  function initialize(): void
    borderColor = 0;
    bgColor = 0;
    frameCount = 0;
  end function

  function updateColors(): void
    frameCount = frameCount + 1;
    borderColor = frameCount;
  end function

  export function main(): void
    initialize();
    while true
      updateColors();
    end while
  end function
`;

console.log('=== DEBUG: Integration - Complete C64 Program ===\n');
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
if (symbolTable) {
  const rootScope = symbolTable.getRootScope();
  console.log(`Root scope symbols: ${Array.from(rootScope.symbols.keys()).join(', ')}`);
}

console.log('\n--- CFGs ---');
const cfgs = analyzer.getAllCFGs();
console.log(`CFG count: ${cfgs.size}`);
console.log(`Expected: 3 (initialize, updateColors, main)`);

console.log('\n=== ISSUE ===');
console.log('Expected: result.success === true (complete C64 program should work)');
console.log(`Actual: result.success === ${result.success}`);