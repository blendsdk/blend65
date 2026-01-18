#!/usr/bin/env node

import { Lexer } from '../packages/compiler/dist/lexer/lexer.js';
import { Parser } from '../packages/compiler/dist/parser/parser.js';
import { SymbolTable } from '../packages/compiler/dist/semantic/symbol-table.js';
import { SymbolKind } from '../packages/compiler/dist/semantic/symbol.js';

console.log('=== Location Debug ===\n');

const source = '@zp let zpVar: byte = 0;';

// Test with filename
console.log('Test 1: With filename');
const lexer1 = new Lexer(source, 'test.bl65');
const tokens1 = lexer1.tokenize();
const parser1 = new Parser(tokens1);
const program1 = parser1.parse();
const decl1 = program1.getDeclarations()[0];

console.log('Declaration location:', decl1.getLocation());
console.log('Location.source:', decl1.getLocation().source);
console.log('');

// Create a symbol like the test does
const symbolTable = new SymbolTable();
const rootScope = symbolTable.getRootScope();

const symbol = {
  name: 'zpVar',
  kind: SymbolKind.VARIABLE,
  declaration: decl1,
  scope: rootScope,
  isExported: false,
  isConst: false,
  type: {
    kind: 'primitive',
    name: 'byte',
    size: 1,
  },
};

console.log('Symbol declaration location:', symbol.declaration.getLocation());
console.log('Symbol declaration location.source:', symbol.declaration.getLocation().source);
console.log('Is source defined?:', symbol.declaration.getLocation().source !== undefined);
console.log('Is source truthy?:', !!symbol.declaration.getLocation().source);