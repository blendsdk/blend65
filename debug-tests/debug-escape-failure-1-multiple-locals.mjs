/**
 * Debug Escape Analysis Failure #1: "should mark multiple local-only variables"
 * 
 * Issue: Variables 'a' and 'b' are being marked as escaping when they shouldn't be
 * They are only used in 'c' initialization (c = a + b)
 * 
 * Expected: a.EscapeEscapes = false, b.EscapeEscapes = false
 * Actual: One or both marked as true
 */

import { Lexer } from '../packages/compiler/dist/lexer/lexer.js';
import { Parser } from '../packages/compiler/dist/parser/parser.js';
import { SemanticAnalyzer } from '../packages/compiler/dist/semantic/analyzer.js';
import { OptimizationMetadataKey, EscapeReason } from '../packages/compiler/dist/semantic/analysis/optimization-metadata-keys.js';

const source = `
function compute(): byte
  let a: byte = 1;
  let b: byte = 2;
  let c: byte = a + b;
  return c;
end function
`;

console.log('=== DEBUGGING ESCAPE FAILURE #1: Multiple Local Variables ===\n');
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
  
  for (let i = 0; i < 3; i++) {
    const varDecl = body[i];
    const name = varDecl.getName();
    const escapes = varDecl.metadata?.get(OptimizationMetadataKey.EscapeEscapes);
    const reason = varDecl.metadata?.get(OptimizationMetadataKey.EscapeReason);
    const localOnly = varDecl.metadata?.get(OptimizationMetadataKey.EscapeLocalOnly);
    
    console.log(`\nVariable: ${name}`);
    console.log(`  Escapes: ${escapes}`);
    console.log(`  Reason: ${reason}`);
    console.log(`  LocalOnly: ${localOnly}`);
    console.log(`  Expected Escapes: ${i < 2 ? 'false (a,b local-only)' : 'true (c returned)'}`);
    
    if (i < 2 && escapes === true) {
      console.log(`  ❌ PROBLEM: Variable ${name} should NOT escape!`);
      console.log(`     It's only used in another variable's initialization (c = a + b)`);
    }
  }
}

console.log('\n=== ANALYSIS ===');
console.log('The issue is likely that when we scan the expression "c = a + b",');
console.log('we are treating a and b as escaping. But they should only be local-only.');
console.log('The key question: Does using a variable in another local variable');
console.log('initializer count as escaping? Answer: NO, it should not.');