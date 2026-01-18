#!/usr/bin/env node

import { Lexer } from '../packages/compiler/dist/lexer/lexer.js';
import { Parser } from '../packages/compiler/dist/parser/parser.js';

const source = `
function addFive(): void
  let x: byte = 10;
  let y: byte = x + 5;
end function
`;

console.log('Testing function parse...\n');
console.log('Source:', source);

try {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  console.log('\nTokenization: SUCCESS');
  
  const parser = new Parser(tokens);
  const ast = parser.parse();
  console.log('Parsing: SUCCESS');
  console.log(`Declarations: ${ast.declarations.length}`);
  
  if (ast.declarations.length > 0) {
    const decl = ast.declarations[0];
    console.log(`First declaration type: ${decl.getNodeType()}`);
  }
} catch (error) {
  console.log('\nParsing: FAILED');
  console.error(error.message);
}