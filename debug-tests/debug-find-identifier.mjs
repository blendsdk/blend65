#!/usr/bin/env node
/**
 * Debug: Test findIdentifier() helper used in tests
 */

import { Lexer } from '../packages/compiler/dist/lexer/lexer.js';
import { Parser } from '../packages/compiler/dist/parser/parser.js';
import { SymbolTable } from '../packages/compiler/dist/semantic/symbol-table.js';
import { AliasAnalyzer } from '../packages/compiler/dist/semantic/analysis/alias-analysis.js';

// Same helper from tests
function findIdentifier(ast, name) {
  const identifiers = [];
  
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    
    // Check if this is an identifier with matching name
    if (node.getNodeType && node.getNodeType() === 'IdentifierExpression') {
      if (node.getName && node.getName() === name) {
        identifiers.push(node);
      }
    }
    
    // Walk all properties
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
  return identifiers[0];
}

const source = `
  let x: byte = 0;
  let y: byte = x;
`;

console.log('=== FIND IDENTIFIER DEBUG ===\n');
console.log(`Source: ${source.trim()}\n`);

const lexer = new Lexer(source);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

const symbolTable = new SymbolTable();
const analyzer = new AliasAnalyzer(symbolTable);
analyzer.analyze(ast);

console.log('Looking for identifier "x"...');
const xId = findIdentifier(ast, 'x');
console.log(`Found: ${!!xId}`);
if (xId) {
  console.log(`  NodeType: ${xId.getNodeType()}`);
  console.log(`  Name: ${xId.getName()}`);
  console.log(`  Has metadata: ${!!xId.metadata}`);
  if (xId.metadata) {
    console.log(`  Metadata keys: ${Array.from(xId.metadata.keys())}`);
    for (const [key, value] of xId.metadata.entries()) {
      if (value instanceof Set) {
        const items = Array.from(value).map(s => s.name || s);
        console.log(`    ${key}: [${items.join(', ')}]`);
      } else {
        console.log(`    ${key}: ${value}`);
      }
    }
  }
}

console.log('\nLooking for identifier "y"...');
const yId = findIdentifier(ast, 'y');
console.log(`Found: ${!!yId}`);
if (yId) {
  console.log(`  NodeType: ${yId.getNodeType()}`);
  console.log(`  Name: ${yId.getName()}`);
  console.log(`  Has metadata: ${!!yId.metadata}`);
  if (yId.metadata) {
    console.log(`  Metadata keys: ${Array.from(yId.metadata.keys())}`);
    for (const [key, value] of yId.metadata.entries()) {
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