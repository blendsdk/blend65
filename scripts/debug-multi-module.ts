/**
 * Debug script to trace multi-module analysis issues
 */

import { Lexer } from '../packages/compiler-v2/src/lexer/index.js';
import { Parser } from '../packages/compiler-v2/src/parser/index.js';
import { SemanticAnalyzer } from '../packages/compiler-v2/src/semantic/index.js';
import type { Program } from '../packages/compiler-v2/src/ast/index.js';

/**
 * Helper to parse a Blend65 source string and return the Program AST
 */
function parse(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, source);
  return parser.parse();
}

// Test 1: Simple import resolution
console.log('\n=== Test 1: Simple Import Resolution ===\n');

const sources1 = [
  `module Lib;
   export function getValue(): byte { return 42; }`,

  `module Main;
   import { getValue } from Lib;
   function main(): void {
     let x: byte = getValue();
   }`,
];

const programs1 = sources1.map((s) => parse(s));
console.log('Parsed programs:');
for (const p of programs1) {
  const moduleName = p.getModule().getFullName();
  console.log(`  - Module: ${moduleName}`);
  console.log(`    Declarations: ${p.getDeclarations().length}`);
  for (const decl of p.getDeclarations()) {
    console.log(`      - ${decl.getNodeType()}`);
  }
}

const analyzer1 = new SemanticAnalyzer({ runAdvancedAnalysis: false });
const result1 = analyzer1.analyzeMultiple(programs1);

console.log('\nMulti-module analysis result:');
console.log(`  success: ${result1.success}`);
console.log(`  modules: ${Array.from(result1.modules.keys()).join(', ')}`);
console.log(`  compilationOrder: ${result1.compilationOrder.join(', ')}`);
console.log(`  importResolution.success: ${result1.importResolution.success}`);
console.log(`  importResolution.errors: ${result1.importResolution.errors.length}`);
for (const err of result1.importResolution.errors) {
  console.log(`    - ${err.code}: ${err.message}`);
}
console.log(`  diagnostics: ${result1.diagnostics.length}`);
for (const diag of result1.diagnostics) {
  console.log(`    - [${diag.severity}] ${diag.message}`);
}

// Test 2: Circular imports
console.log('\n=== Test 2: Circular Imports ===\n');

const sources2 = [
  `module A;
   import { bFn } from B;
   export function aFn(): void { bFn(); }`,

  `module B;
   import { aFn } from A;
   export function bFn(): void { aFn(); }`,
];

const programs2 = sources2.map((s) => parse(s));
console.log('Parsed programs:');
for (const p of programs2) {
  const moduleName = p.getModule().getFullName();
  console.log(`  - Module: ${moduleName}`);
  for (const decl of p.getDeclarations()) {
    console.log(`    - ${decl.getNodeType()}`);
    if (decl.getNodeType() === 'ImportDecl') {
      const imp = decl as any;
      console.log(`      From: ${imp.getModuleName()}`);
      console.log(`      Identifiers: ${imp.getIdentifiers().join(', ')}`);
    }
  }
}

const analyzer2 = new SemanticAnalyzer({ runAdvancedAnalysis: false });
const result2 = analyzer2.analyzeMultiple(programs2);

console.log('\nDependency graph:');
console.log(result2.dependencyGraph.toString());

console.log('\nCycle detection:');
const cycles = result2.dependencyGraph.detectCycles();
console.log(`  Cycles found: ${cycles.length}`);
for (const cycle of cycles) {
  console.log(`    - ${cycle.cycle.join(' → ')}`);
}

console.log('\nMulti-module analysis result:');
console.log(`  success: ${result2.success}`);
console.log(`  diagnostics with CIRCULAR_IMPORT:`);
for (const diag of result2.diagnostics) {
  if (diag.message.includes('ircular')) {
    console.log(`    - ${diag.message}`);
  }
}