#!/usr/bin/env node
/**
 * Debug: Check what getStorageClass() returns for @zp variables
 */

import { Lexer } from '../packages/compiler/dist/lexer/lexer.js';
import { Parser } from '../packages/compiler/dist/parser/parser.js';
import { TokenType } from '../packages/compiler/dist/lexer/types.js';

const testCases = [
  { name: '@zp variable', source: '@zp counter: byte;' },
  { name: '@ram variable', source: '@ram data: byte;' },
  { name: 'Regular variable', source: 'let counter: byte = 0;' },
];

console.log('=== STORAGE CLASS DEBUG ===\n');
console.log(`TokenType.ZP value: "${TokenType.ZP}"`);
console.log(`TokenType.RAM value: "${TokenType.RAM}"`);

for (const { name, source } of testCases) {
  console.log(`\n--- ${name} ---`);
  console.log(`Source: ${source.trim()}`);
  
  try {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    const decl = ast.declarations[0];
    if (decl.getStorageClass) {
      const storageClass = decl.getStorageClass();
      console.log(`  getStorageClass() returns: "${storageClass}"`);
      console.log(`  Type: ${typeof storageClass}`);
      console.log(`  Equals TokenType.ZP? ${storageClass === TokenType.ZP}`);
      console.log(`  Equals TokenType.RAM? ${storageClass === TokenType.RAM}`);
      console.log(`  Equals null? ${storageClass === null}`);
    }
    
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
  }
}

console.log('\n=== END DEBUG ===');