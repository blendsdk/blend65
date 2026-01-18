#!/usr/bin/env node
/**
 * Debug: Understand AST structure for alias analysis
 */

import { Lexer } from '../packages/compiler/dist/lexer/lexer.js';
import { Parser } from '../packages/compiler/dist/parser/parser.js';

const testCases = [
  {
    name: '@zp variable',
    source: '@zp counter: byte;',
  },
  {
    name: 'Regular variable with initializer',
    source: 'let counter: byte = 0;',
  },
  {
    name: '@map hardware register',
    source: '@map vicBorder at $D020: byte;',
  },
  {
    name: 'Variable with identifier reference',
    source: `
      let x: byte = 0;
      let y: byte = x;
    `,
  },
];

console.log('=== AST STRUCTURE DEBUG ===\n');

for (const { name, source } of testCases) {
  console.log(`\n--- ${name} ---`);
  console.log(`Source: ${source.trim()}`);
  
  try {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log(`\nAST declarations count: ${ast.declarations.length}`);
    
    for (let i = 0; i < ast.declarations.length; i++) {
      const decl = ast.declarations[i];
      console.log(`\nDeclaration ${i}:`);
      console.log(`  nodeType: ${decl.getNodeType()}`);
      console.log(`  name: ${decl.getName ? decl.getName() : 'N/A'}`);
      
      // Check if it's a VariableDecl
      if (decl.getNodeType() === 'VariableDecl') {
        console.log(`  storage class: ${decl.getStorageClass ? decl.getStorageClass() : 'none'}`);
        console.log(`  has initializer: ${decl.getInitializer ? !!decl.getInitializer() : false}`);
        
        const init = decl.getInitializer ? decl.getInitializer() : null;
        if (init) {
          console.log(`  initializer nodeType: ${init.getNodeType()}`);
          if (init.getNodeType() === 'IdentifierExpression') {
            console.log(`  initializer name: ${init.getName()}`);
          }
        }
      }
      
      // Check if it's a MapDecl (any map variant)
      if (decl.getNodeType().includes('MapDecl')) {
        console.log(`  has getAddress: ${!!decl.getAddress}`);
        if (decl.getAddress) {
          console.log(`  address: ${decl.getAddress()}`);
        }
      }
      
      console.log(`  metadata exists: ${!!decl.metadata}`);
      if (decl.metadata) {
        console.log(`  metadata keys: ${Array.from(decl.metadata.keys())}`);
        for (const [key, value] of decl.metadata.entries()) {
          console.log(`    ${key}: ${value}`);
        }
      }
    }
    
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
  }
}

console.log('\n=== END DEBUG ===');