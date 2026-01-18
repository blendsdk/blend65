#!/usr/bin/env node
import { Lexer } from '../packages/compiler/dist/lexer/lexer.js';
import { Parser } from '../packages/compiler/dist/parser/parser.js';
import { SemanticAnalyzer } from '../packages/compiler/dist/semantic/analyzer.js';

const source = `
function test(): word
  let x: byte = 42;
  return @x;
end function
`;

console.log('=== Testing Address-Of in Escape Analysis ===\n');
console.log('Source code:');
console.log(source);

try {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  console.log('\n✅ Parsing successful!');
  console.log('Functions:', ast.declarations.length);
  
  const analyzer = new SemanticAnalyzer();
  analyzer.analyze(ast);
  
  const diagnostics = analyzer.getDiagnostics();
  
  console.log('\n=== Diagnostics ===');
  console.log('Total diagnostics:', diagnostics.length);
  
  if (diagnostics.length > 0) {
    diagnostics.forEach((diag, i) => {
      console.log(`\n${i + 1}. [${diag.severity}] ${diag.code}`);
      console.log(`   Message: ${diag.message}`);
      if (diag.location) {
        console.log(`   Location: Line ${diag.location.start.line}, Col ${diag.location.start.column}`);
      }
    });
  } else {
    console.log('No diagnostics!');
  }
  
  const errors = diagnostics.filter(d => d.severity === 'error');
  const warnings = diagnostics.filter(d => d.severity === 'warning');
  
  console.log(`\n✅ Errors: ${errors.length}`);
  console.log(`⚠️  Warnings: ${warnings.length}`);
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error('\nStack:', error.stack);
}