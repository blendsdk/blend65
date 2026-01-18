#!/usr/bin/env node
/**
 * Debug the remaining 5 failing tests
 */

import { Lexer } from '../packages/compiler/dist/lexer/lexer.js';
import { Parser } from '../packages/compiler/dist/parser/parser.js';
import { SymbolTable } from '../packages/compiler/dist/semantic/symbol-table.js';
import { AliasAnalyzer } from '../packages/compiler/dist/semantic/analysis/alias-analysis.js';

const testCases = [
  {
    name: '@zp without address',
    source: '@zp counter: byte;',
    checkDecl: 0,
  },
  {
    name: '@zp with address',
    source: '@zp zpCounter at $02: byte;',
    checkDecl: 0,
  },
  {
    name: '@zp zpVar vs @map ioReg',
    source: `@zp zpVar: byte;\n@map ioReg at $D020: byte;`,
    checkDecl: 0,
  },
  {
    name: 'Function with parameter',
    source: `function process(value: byte): void\n  let temp: byte = value;\nend function`,
    checkDecl: 0,
  },
];

console.log('=== DEBUGGING REMAINING 5 FAILURES ===\n');

for (const { name, source, checkDecl } of testCases) {
  console.log(`\n--- ${name} ---`);
  console.log(`Source: ${source}`);
  
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  const symbolTable = new SymbolTable();
  const analyzer = new AliasAnalyzer(symbolTable);
  analyzer.analyze(ast);
  
  const decl = ast.declarations[checkDecl];
  console.log(`\nDeclaration ${checkDecl}:`);
  console.log(`  NodeType: ${decl.getNodeType()}`);
  console.log(`  Name: ${decl.getName ? decl.getName() : 'N/A'}`);
  
  if (decl.getStorageClass) {
    console.log(`  StorageClass: ${decl.getStorageClass()}`);
  }
  
  console.log(`  Has metadata: ${!!decl.metadata}`);
  if (decl.metadata) {
    console.log(`  Metadata:`);
    for (const [key, value] of decl.metadata.entries()) {
      if (value instanceof Set) {
        const items = Array.from(value).map(s => s.name || s);
        console.log(`    ${key}: [${items.join(', ')}]`);
      } else {
        console.log(`    ${key}: ${value}`);
      }
    }
  }
}

console.log('\n=== END DEBUG ===');