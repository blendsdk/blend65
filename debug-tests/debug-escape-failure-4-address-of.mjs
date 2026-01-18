/**
 * Debug Escape Analysis Failures #4-5: Address-Of Operator Tests
 * 
 * Issue: Tests expect 0 errors but getting parser/semantic errors
 */

import { Lexer } from '../packages/compiler/dist/lexer/lexer.js';
import { Parser } from '../packages/compiler/dist/parser/parser.js';
import { SemanticAnalyzer } from '../packages/compiler/dist/semantic/analyzer.js';

const source1 = `
function test(): word
  let x: byte = 42;
  return @x;
end function
`;

const source2 = `
function test(): void
  let x: byte = 10;
  let ptr: word = @x;
end function
`;

console.log('=== DEBUGGING ESCAPE FAILURES #4-5: Address-Of Operator ===\n');

for (const [idx, source] of [[1, source1], [2, source2]]) {
  console.log(`\n--- Test Case ${idx} ---`);
  console.log('Source Code:');
  console.log(source);
  console.log('\n--- Parsing and Analysis ---');

  try {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    const analyzer = new SemanticAnalyzer();
    analyzer.analyze(ast);

    const diagnostics = analyzer.getDiagnostics();
    console.log(`Diagnostics: ${diagnostics.length}`);
    diagnostics.forEach((d, i) => {
      console.log(`  [${i}] ${d.severity}: ${d.message}`);
      console.log(`      Code: ${d.code}`);
    });
  } catch (error) {
    console.log(`ERROR: ${error.message}`);
  }
}

console.log('\n=== ANALYSIS ===');
console.log('The @ (address-of) operator may not be supported by the parser yet.');
console.log('These tests should be skipped or removed until the feature is implemented.');