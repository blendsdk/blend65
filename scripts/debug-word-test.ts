/**
 * Debug script for word variables test failure
 */
import { Lexer } from '../packages/compiler-v2/src/lexer/index.js';
import { Parser } from '../packages/compiler-v2/src/parser/index.js';
import { SemanticAnalyzer } from '../packages/compiler-v2/src/semantic/index.js';

const source = `
  module Test;
  let start: word = $0400;
  let end: word = $07FF;
  let len: word = end - start;
`;

console.log('=== Debug Word Variables Test ===');
console.log('Source:', source);
console.log();

const lexer = new Lexer(source);
const tokens = lexer.tokenize();
console.log('Tokens:', tokens.length);

const parser = new Parser(tokens);
const program = parser.parse();
console.log('AST:', program ? 'OK' : 'FAILED');

const analyzer = new SemanticAnalyzer();
const result = analyzer.analyze(program);

console.log();
console.log('=== Analysis Result ===');
console.log('Success:', result.success);
console.log('Error Count:', result.stats.errorCount);
console.log('Warning Count:', result.stats.warningCount);
console.log('Total Declarations:', result.stats.totalDeclarations);

if (result.diagnostics && result.diagnostics.length > 0) {
  console.log();
  console.log('=== Diagnostics ===');
  for (const diag of result.diagnostics) {
    console.log(`[${diag.severity}] ${diag.message}`);
    if (diag.location) {
      console.log(`  at line ${diag.location.start.line}, col ${diag.location.start.column}`);
    }
  }
}