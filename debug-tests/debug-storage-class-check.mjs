#!/usr/bin/env node

import { Lexer } from '../packages/compiler/dist/lexer/lexer.js';
import { Parser } from '../packages/compiler/dist/parser/parser.js';
import { TokenType } from '../packages/compiler/dist/lexer/types.js';

console.log('=== Storage Class Debug ===\n');

// Test different storage classes
const testCases = [
  { source: '@zp let counter: byte = 0;', expected: TokenType.ZP },
  { source: '@ram let buffer: byte = 0;', expected: TokenType.RAM },
  { source: '@data let table: byte = 0;', expected: TokenType.DATA },
  { source: 'let normal: byte = 0;', expected: null },
];

for (const testCase of testCases) {
  console.log(`Source: ${testCase.source}`);
  
  const lexer = new Lexer(testCase.source, 'test.bl65');
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const program = parser.parse();
  
  const decl = program.getDeclarations()[0];
  
  console.log(`  Declaration type: ${decl.constructor.name}`);
  console.log(`  Has getStorageClass method: ${typeof decl.getStorageClass === 'function'}`);
  
  if (typeof decl.getStorageClass === 'function') {
    const storageClass = decl.getStorageClass();
    console.log(`  Storage class from getStorageClass(): ${storageClass}`);
    console.log(`  Expected: ${testCase.expected}`);
    console.log(`  Match: ${storageClass === testCase.expected}`);
  } else {
    console.log(`  ERROR: getStorageClass() method not found!`);
    console.log(`  Available methods: ${Object.getOwnPropertyNames(Object.getPrototypeOf(decl))}`);
  }
  
  console.log('');
}

console.log('=== Type Guard Test ===\n');
import { isVariableDecl } from '../packages/compiler/dist/ast/type-guards.js';

const source = '@zp let test: byte = 0;';
const lexer = new Lexer(source, 'test.bl65');
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const program = parser.parse();
const decl = program.getDeclarations()[0];

console.log(`isVariableDecl check: ${isVariableDecl(decl)}`);
console.log(`instanceof VariableDecl: ${decl.constructor.name === 'VariableDecl'}`);