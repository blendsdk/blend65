/**
 * Debug: module-analysis-ordering.test.ts
 * Test: "should analyze single module without imports"
 * 
 * Expected: result.success === true
 * Actual: result.success === false
 */

import { Lexer } from '../packages/compiler/dist/lexer/lexer.js';
import { Parser } from '../packages/compiler/dist/parser/parser.js';
import { SemanticAnalyzer } from '../packages/compiler/dist/semantic/analyzer.js';

const source = `
  module Test
  export let counter: byte = 0;
  export function increment(): void
    counter = counter + 1;
  end function
`;

console.log('=== DEBUG: Module Ordering - Single Module ===\n');
console.log('Source code:');
console.log(source);
console.log('\n--- Parsing ---');

const lexer = new Lexer(source);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const program = parser.parse();

console.log('✓ Parsed successfully\n');

console.log('--- Semantic Analysis (analyzeMultiple) ---');
const analyzer = new SemanticAnalyzer();
const result = analyzer.analyzeMultiple([program]);

console.log(`\nResult.success: ${result.success}`);
console.log(`Diagnostics count: ${result.diagnostics.length}`);
console.log(`Modules count: ${result.modules.size}\n`);

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
if (result.modules.has('Test')) {
  const moduleResult = result.modules.get('Test');
  console.log('Module "Test" found:');
  console.log(`  moduleName: ${moduleResult.moduleName}`);
  console.log(`  success: ${moduleResult.success}`);
  console.log(`  symbolTable exists: ${moduleResult.symbolTable !== undefined}`);
  console.log(`  typeSystem exists: ${moduleResult.typeSystem !== undefined}`);
  console.log(`  diagnostics: ${moduleResult.diagnostics.length}`);
  
  if (moduleResult.diagnostics.length > 0) {
    console.log('  Module diagnostics:');
    moduleResult.diagnostics.forEach((diag, idx) => {
      console.log(`    ${idx + 1}. [${diag.severity}] ${diag.message}`);
    });
  }
} else {
  console.log('Module "Test" NOT FOUND');
}

console.log('\n--- Global Symbol Table ---');
console.log(`Global symbol table exists: ${result.globalSymbolTable !== undefined}`);
if (result.globalSymbolTable) {
  const exported = result.globalSymbolTable.getExportedSymbols('Test');
  console.log(`Exported symbols from Test: ${exported.length}`);
  if (exported.length > 0) {
    exported.forEach(sym => {
      console.log(`  - ${sym.name} (${sym.kind})`);
    });
  }
}

console.log('\n--- Dependency Graph ---');
console.log(`Dependency graph exists: ${result.dependencyGraph !== undefined}`);

console.log('\n=== ISSUE ===');
console.log('Expected: result.success === true');
console.log(`Actual: result.success === ${result.success}`);