/**
 * Debug: stub-functions-integration.test.ts
 * Test: "C64 program using built-in stub functions"
 * 
 * Expected: result.success === true
 * Actual: result.success === false
 */

import { Lexer } from '../packages/compiler/dist/lexer/lexer.js';
import { Parser } from '../packages/compiler/dist/parser/parser.js';
import { SemanticAnalyzer } from '../packages/compiler/dist/semantic/analyzer.js';

const source = `
  function peek(addr: word): byte;
  function poke(addr: word, val: byte): void;

  @map borderColor at $D020: byte;
  @map bgColor at $D021: byte;

  let frameCount: byte = 0;

  function initialize(): void
    borderColor = 0;
    bgColor = 0;
    frameCount = 0;
  end function

  function updateScreen(): void
    frameCount = frameCount + 1;
    poke(0xD020, frameCount);
    let currentBorder: byte = peek(0xD020);
  end function

  export function main(): void
    initialize();
    while true
      updateScreen();
    end while
  end function
`;

console.log('=== DEBUG: Stub Functions - C64 Program ===\n');
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
  console.log('\nExpected: peek, poke, borderColor, bgColor, frameCount, initialize, updateScreen, main');
}

console.log('\n--- CFGs ---');
const cfgs = analyzer.getAllCFGs();
console.log(`CFG count: ${cfgs.size}`);
console.log(`Expected: 3 (initialize, updateScreen, main - stub functions should NOT have CFGs)`);
console.log(`Actual CFGs: ${Array.from(cfgs.keys()).join(', ')}`);

console.log('\n=== ISSUE ===');
console.log('Expected: result.success === true');
console.log(`Actual: result.success === ${result.success}`);
console.log('\nThis test validates that C64 programs with stub functions (peek/poke) work correctly.');