#!/usr/bin/env node
/**
 * Debug specific failing test cases
 */

import { Lexer } from '../packages/compiler/dist/lexer/lexer.js';
import { Parser } from '../packages/compiler/dist/parser/parser.js';
import { SymbolTable } from '../packages/compiler/dist/semantic/symbol-table.js';
import { AliasAnalyzer } from '../packages/compiler/dist/semantic/analysis/alias-analysis.js';

function findIdentifier(ast, name) {
  const identifiers = [];
  
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    
    if (node.getNodeType && node.getNodeType() === 'IdentifierExpression') {
      if (node.getName && node.getName() === name) {
        identifiers.push(node);
      }
    }
    
    for (const key of Object.keys(node)) {
      if (Array.isArray(node[key])) {
        for (const child of node[key]) {
          walk(child);
        }
      } else if (typeof node[key] === 'object') {
        walk(node[key]);
      }
    }
  }
  
  walk(ast);
  console.log(`  Total "${name}" identifiers found: ${identifiers.length}`);
  return identifiers[0];
}

const testCases = [
  {
    name: 'RAM region detection',
    source: 'let counter: byte = 0;',
    findId: 'counter',
  },
  {
    name: 'Direct assignment aliasing',
    source: `let x: byte = 0;\nlet y: byte = x;`,
    findId: 'y',
  },
  {
    name: 'Address-of operator',
    source: `let counter: byte = 0;\nlet ptr: word = @counter;`,
    findId: 'ptr',
  },
  {
    name: '@zp with address',
    source: '@zp zpCounter at $02: byte;',
    findId: 'zpCounter',
  },
];

console.log('=== DEBUGGING FAILING TESTS ===\n');

for (const { name, source, findId } of testCases) {
  console.log(`\n--- ${name} ---`);
  console.log(`Source: ${source}`);
  console.log(`Looking for: "${findId}"`);
  
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  const symbolTable = new SymbolTable();
  const analyzer = new AliasAnalyzer(symbolTable);
  analyzer.analyze(ast);
  
  const identifier = findIdentifier(ast, findId);
  
  if (identifier) {
    console.log(`  Found identifier: YES`);
    console.log(`  Has metadata: ${!!identifier.metadata}`);
    if (identifier.metadata) {
      for (const [key, value] of identifier.metadata.entries()) {
        if (value instanceof Set) {
          const items = Array.from(value).map(s => s.name || s);
          console.log(`    ${key}: [${items.join(', ')}]`);
        } else {
          console.log(`    ${key}: ${value}`);
        }
      }
    }
  } else {
    console.log(`  Found identifier: NO`);
    console.log(`  Declaration count: ${ast.declarations.length}`);
    for (let i = 0; i < ast.declarations.length; i++) {
      const decl = ast.declarations[i];
      console.log(`    [${i}] ${decl.getNodeType()}: ${decl.getName ? decl.getName() : 'N/A'}`);
      if (decl.metadata) {
        console.log(`      Has metadata: YES`);
      }
    }
  }
}

console.log('\n=== END DEBUG ===');