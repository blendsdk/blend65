#!/usr/bin/env node
import { Lexer } from '../packages/compiler/dist/lexer/lexer.js';
import { Parser } from '../packages/compiler/dist/parser/parser.js';
import { SemanticAnalyzer } from '../packages/compiler/dist/semantic/analyzer.js';
import { OptimizationMetadataKey, EscapeReason } from '../packages/compiler/dist/semantic/analysis/optimization-metadata-keys.js';

const source = `
function test(): void
  let x: byte = 10;
  let ptr: word = @x;
end function
`;

console.log('=== Testing Address-Of in Assignment ===\n');
console.log('Source code:');
console.log(source);

try {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  const analyzer = new SemanticAnalyzer();
  analyzer.analyze(ast);
  
  const diagnostics = analyzer.getDiagnostics();
  const errors = diagnostics.filter(d => d.severity === 'error');
  
  console.log('\n=== Analysis Results ===');
  console.log('Errors:', errors.length);
  
  if (errors.length > 0) {
    errors.forEach(e => console.log(`  - ${e.message}`));
  }
  
  const funcDecl = ast.declarations[0];
  if (funcDecl.getNodeType() === 'FunctionDecl') {
    const body = funcDecl.getBody();
    
    console.log('\n=== Variable: x (should escape - address taken) ===');
    const xDecl = body[0];
    console.log('Escapes:', xDecl.metadata?.get(OptimizationMetadataKey.EscapeEscapes));
    console.log('Reason:', xDecl.metadata?.get(OptimizationMetadataKey.EscapeReason));
    console.log('Expected: Escapes=true, Reason=AddressTaken');
    
    console.log('\n=== Variable: ptr (should NOT escape - local only) ===');
    const ptrDecl = body[1];
    console.log('Escapes:', ptrDecl.metadata?.get(OptimizationMetadataKey.EscapeEscapes));
    console.log('Reason:', ptrDecl.metadata?.get(OptimizationMetadataKey.EscapeReason));
    console.log('LocalOnly:', ptrDecl.metadata?.get(OptimizationMetadataKey.EscapeLocalOnly));
    console.log('Expected: Escapes=false, LocalOnly=true');
    
    if (ptrDecl.metadata?.get(OptimizationMetadataKey.EscapeEscapes) === false) {
      console.log('\n✅ Test would PASS!');
    } else {
      console.log('\n❌ Test FAILS - ptr incorrectly marked as escaping');
      console.log('   Actual Escapes:', ptrDecl.metadata?.get(OptimizationMetadataKey.EscapeEscapes));
      console.log('   Expected Escapes: false');
    }
  }
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error('\nStack:', error.stack);
}