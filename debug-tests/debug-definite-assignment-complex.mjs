/**
 * Debug: Definite Assignment - Complex Expressions
 * Test: "should track assignments in complex expressions"
 * 
 * Expected: 0 errors
 * Actual: 2 errors
 * 
 * Test code:
 *   let x: byte;
 *   let y: byte;
 *   y = (x = 10);
 *   let z: byte = x + y;
 */

import { Lexer } from '../packages/compiler/dist/lexer/lexer.js';
import { Parser } from '../packages/compiler/dist/parser/parser.js';
import { SemanticAnalyzer } from '../packages/compiler/dist/semantic/analyzer.js';
import { DiagnosticSeverity } from '../packages/compiler/dist/ast/diagnostics.js';

const source = `
  function test(): void
    let x: byte;
    let y: byte;
    y = (x = 10);
    let z: byte = x + y;
  end function
`;

console.log('=== DEBUG: Definite Assignment - Complex Expressions ===\n');
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
analyzer.analyze(ast);

const diagnostics = analyzer.getDiagnostics();
const errors = diagnostics.filter(d => d.severity === DiagnosticSeverity.ERROR);
const warnings = diagnostics.filter(d => d.severity === DiagnosticSeverity.WARNING);

console.log(`Total diagnostics: ${diagnostics.length}`);
console.log(`Errors: ${errors.length}`);
console.log(`Warnings: ${warnings.length}\n`);

if (errors.length > 0) {
  console.log('ERRORS:');
  errors.forEach((err, idx) => {
    console.log(`  ${idx + 1}. [${err.code}] ${err.message}`);
    if (err.location) {
      console.log(`     at line ${err.location.line}, column ${err.location.column}`);
    }
  });
  console.log();
}

if (warnings.length > 0) {
  console.log('WARNINGS:');
  warnings.forEach((warn, idx) => {
    console.log(`  ${idx + 1}. [${warn.code}] ${warn.message}`);
    if (warn.location) {
      console.log(`     at line ${warn.location.line}, column ${warn.location.column}`);
    }
  });
  console.log();
}

console.log('=== ISSUE ===');
console.log('Expected: 0 errors (assignments in expressions should be tracked)');
console.log(`Actual: ${errors.length} errors`);
console.log('\nThe expression `y = (x = 10)` should initialize both x and y.');
console.log('After this line, both x and y should be considered initialized.');
console.log('Therefore, `let z: byte = x + y` should not produce uninitialized use errors.');