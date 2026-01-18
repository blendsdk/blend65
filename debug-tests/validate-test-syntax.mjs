#!/usr/bin/env node
/**
 * Validate if test source code is valid Blend syntax
 */

import { Lexer } from '../packages/compiler/dist/lexer/lexer.js';
import { Parser } from '../packages/compiler/dist/parser/parser.js';

const testCases = [
  {
    name: 'should warn about writing to code address range (BASIC area)',
    source: `
        @map codeLocation at $0801: byte;
        function test() {
          codeLocation = 0x60;
        }
      `,
  },
  {
    name: 'should track function parameters as memory locations',
    source: `
        function process(value: byte) {
          let temp: byte = value;
        }
      `,
  },
  {
    name: '@zp counter declaration',
    source: '@zp counter: byte;',
  },
  {
    name: 'Regular variable',
    source: 'let counter: byte = 0;',
  },
  {
    name: 'Two variables with assignment',
    source: `
        let x: byte = 0;
        let y: byte = x;
      `,
  },
];

console.log('=== VALIDATING TEST SOURCE SYNTAX ===\n');

for (const { name, source } of testCases) {
  console.log(`\n--- ${name} ---`);
  console.log(`Source: ${source.trim()}`);
  
  try {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('✅ VALID SYNTAX');
    console.log(`   Declarations: ${ast.declarations.length}`);
    
    if (ast.declarations.length > 0) {
      for (let i = 0; i < ast.declarations.length; i++) {
        const decl = ast.declarations[i];
        console.log(`   [${i}] ${decl.getNodeType()}: ${decl.getName ? decl.getName() : 'N/A'}`);
      }
    }
  } catch (error) {
    console.log('❌ INVALID SYNTAX');
    console.log(`   Error: ${error.message}`);
  }
}

console.log('\n=== END VALIDATION ===');