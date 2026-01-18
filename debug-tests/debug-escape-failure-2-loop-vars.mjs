/**
 * Debug Escape Analysis Failure #2: "should handle local variables in loops"
 * 
 * Issue: Variables 'sum' and 'i' may be incorrectly marked as escaping
 * 
 * Expected: sum.EscapeEscapes = false, i.EscapeEscapes = false
 * Actual: One or both might be marked as true
 */

import { Lexer } from '../packages/compiler/dist/lexer/lexer.js';
import { Parser } from '../packages/compiler/dist/parser/parser.js';
import { SemanticAnalyzer } from '../packages/compiler/dist/semantic/analyzer.js';
import { OptimizationMetadataKey } from '../packages/compiler/dist/semantic/analysis/optimization-metadata-keys.js';

const source = `
function loop(): byte
  let sum: byte = 0;
  let i: byte = 0;
  while i < 10
    sum = sum + i;
    i = i + 1;
  end while
  return sum;
end function
`;

console.log('=== DEBUGGING ESCAPE FAILURE #2: Loop Variables ===\n');
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
console.log(`Diagnostics: ${diagnostics.length}`);
diagnostics.forEach((d, i) => {
  console.log(`  [${i}] ${d.severity}: ${d.message}`);
});

const funcDecl = ast.getDeclarations()[0];
if (funcDecl.getNodeType() === 'FunctionDecl') {
  const body = funcDecl.getBody();
  
  console.log('\n--- Variable Analysis ---');
  
  const sumDecl = body[0];
  const iDecl = body[1];
  
  console.log(`\nVariable: sum`);
  console.log(`  Escapes: ${sumDecl.metadata?.get(OptimizationMetadataKey.EscapeEscapes)}`);
  console.log(`  Reason: ${sumDecl.metadata?.get(OptimizationMetadataKey.EscapeReason)}`);
  console.log(`  LocalOnly: ${sumDecl.metadata?.get(OptimizationMetadataKey.EscapeLocalOnly)}`);
  console.log(`  Expected: Escapes=true (returned from function)`);
  
  console.log(`\nVariable: i`);
  console.log(`  Escapes: ${iDecl.metadata?.get(OptimizationMetadataKey.EscapeEscapes)}`);
  console.log(`  Reason: ${iDecl.metadata?.get(OptimizationMetadataKey.EscapeReason)}`);
  console.log(`  LocalOnly: ${iDecl.metadata?.get(OptimizationMetadataKey.EscapeLocalOnly)}`);
  console.log(`  Expected: Escapes=false (loop counter, local-only)`);
}

console.log('\n=== ANALYSIS ===');
console.log('Variable "sum" is RETURNED, so it SHOULD escape.');
console.log('Variable "i" is only used as loop counter, so it should NOT escape.');
console.log('The test may have wrong expectations!');