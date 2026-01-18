#!/usr/bin/env node

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
function addFive(): void
  let x: byte = 10;
  let y: byte = x + 5;
end function
`;

console.log('Testing identifier finding after analysis...\n');

const lexer = new Lexer(source);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

const symbolTable = new SymbolTable();
const analyzer = new AliasAnalyzer(symbolTable);
analyzer.analyze(ast);

console.log('Looking for "x" identifier...');
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
} else {
  console.log('  NOT FOUND - checking why...');
  
  // Let's see what we have in the AST
  const funcDecl = ast.declarations[0];
  console.log(`\n  Function: ${funcDecl.getName()}`);
  console.log(`  Has body: ${!!funcDecl.getBody()}`);
  if (funcDecl.getBody()) {
    console.log(`  Body statements: ${funcDecl.getBody().length}`);
  }
}