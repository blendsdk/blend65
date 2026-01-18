#!/usr/bin/env node
import { Lexer } from '../packages/compiler/dist/lexer/lexer.js';
import { Parser } from '../packages/compiler/dist/parser/parser.js';

const source = `
function test(): @address
  let buffer: byte[256];
  return @buffer;
end function
`;

console.log('=== Testing @ (address-of) Operator ===\n');
console.log('Source code:');
console.log(source);
console.log('\n=== Lexer Output ===');

try {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  
  console.log('Tokens:');
  tokens.slice(0, 30).forEach((token, i) => {
    console.log(`${i}: ${token.type.padEnd(20)} "${token.value}"`);
  });
  
  console.log('\n=== Parser Output ===');
  
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  console.log('AST parsed successfully!');
  console.log('Functions:', ast.declarations.length);
  
  if (ast.declarations.length > 0) {
    const func = ast.declarations[0];
    console.log('\nFunction:', func.name);
    console.log('Return type:', func.returnType);
    
    if (func.body && func.body.length > 0) {
      console.log('\nBody statements:', func.body.length);
      func.body.forEach((stmt, i) => {
        console.log(`${i}: ${stmt.constructor.name}`);
      });
      
      // Find return statement
      const returnStmt = func.body.find(s => s.constructor.name === 'ReturnStatement');
      if (returnStmt && returnStmt.expression) {
        console.log('\nReturn expression:', returnStmt.expression.constructor.name);
        if (returnStmt.expression.constructor.name === 'UnaryExpression') {
          console.log('Unary operator:', returnStmt.expression.operator);
          console.log('Operand:', returnStmt.expression.operand.constructor.name);
          if (returnStmt.expression.operand.name) {
            console.log('Operand name:', returnStmt.expression.operand.name);
          }
        }
      }
    }
  }
  
  console.log('\n✅ @ operator is working!');
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error('\nStack:', error.stack);
}