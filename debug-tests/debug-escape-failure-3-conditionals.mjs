/**
 * Debug Escape Analysis Failure #3: "should handle local variables in conditionals"
 * 
 * Issue: Test expects 0 errors but gets 1 diagnostic (code: S004)
 */

import { Lexer } from '../packages/compiler/dist/lexer/lexer.js';
import { Parser } from '../packages/compiler/dist/parser/parser.js';
import { SemanticAnalyzer } from '../packages/compiler/dist/semantic/analyzer.js';

const source = `
function conditional(flag: boolean): byte
  let result: byte = 0;
  if flag then
    let temp: byte = 10;
    result = temp;
  else
    let temp: byte = 20;
    result = temp;
  end if
  return result;
end function
`;

console.log('=== DEBUGGING ESCAPE FAILURE #3: Conditionals ===\n');
console.log('Source Code:');
console.log(source);
console.log('\n--- Parsing and Analysis ---');

const lexer = new Lexer(source);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

const analyzer = new SemanticAnalyzer();
analyzer.analyze(ast);

const diagnostics = analyzer.getDiagnostics();
console.log(`\nDiagnostics: ${diagnostics.length}`);
diagnostics.forEach((d, i) => {
  console.log(`\n[${i}] ${d.severity}: ${d.message}`);
  console.log(`    Code: ${d.code}`);
  console.log(`    Location: Line ${d.location?.line}, Col ${d.location?.column}`);
});

console.log('\n=== ANALYSIS ===');
console.log('The test expects 0 errors.');
console.log('We are getting 1 diagnostic with code S004.');
console.log('Need to identify what S004 is and why it is being generated.');