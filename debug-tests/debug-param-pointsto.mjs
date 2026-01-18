#!/usr/bin/env node
/**
 * Debug function parameter points-to sets
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
  return identifiers[0];
}

const source = `
function process(value: byte): void
  let temp: byte = value;
end function
`;

console.log('=== FUNCTION PARAMETER POINTS-TO DEBUG ===\n');
console.log('Source:', source.trim());

const lexer = new Lexer(source);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

const symbolTable = new SymbolTable();
const analyzer = new AliasAnalyzer(symbolTable);
analyzer.analyze(ast);

console.log('\n--- Looking for "temp" identifier ---');
const tempId = findIdentifier(ast, 'temp');
if (tempId) {
  console.log('Found: YES');
  console.log(`Has metadata: ${!!tempId.metadata}`);
  if (tempId.metadata) {
    for (const [key, value] of tempId.metadata.entries()) {
      if (value instanceof Set) {
        const items = Array.from(value).map(s => s.name || s);
        console.log(`  ${key}: [${items.join(', ')}]`);
      } else {
        console.log(`  ${key}: ${value}`);
      }
    }
  }
} else {
  console.log('Found: NO');
}

console.log('\n--- Looking for "value" identifier ---');
const valueId = findIdentifier(ast, 'value');
if (valueId) {
  console.log('Found: YES');
  console.log(`Has metadata: ${!!valueId.metadata}`);
  if (valueId.metadata) {
    for (const [key, value] of valueId.metadata.entries()) {
      if (value instanceof Set) {
        const items = Array.from(value).map(s => s.name || s);
        console.log(`  ${key}: [${items.join(', ')}]`);
      } else {
        console.log(`  ${key}: ${value}`);
      }
    }
  }
} else {
  console.log('Found: NO');
}

// Check function
const funcDecl = ast.declarations[0];
console.log('\n--- Function Declaration ---');
console.log(`Name: ${funcDecl.getName()}`);
console.log(`Parameters: ${funcDecl.getParameters().length}`);
if (funcDecl.getParameters().length > 0) {
  console.log(`  Param 0 name: ${funcDecl.getParameters()[0].name}`);
}
console.log(`Body statements: ${funcDecl.getBody().length}`);

console.log('\n=== END DEBUG ===');