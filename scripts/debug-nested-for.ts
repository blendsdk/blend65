#!/usr/bin/env npx ts-node

/**
 * Debug script for nested for loops compilation
 */

import { Lexer } from '../packages/compiler/src/lexer/lexer.js';
import { Parser } from '../packages/compiler/src/parser/parser.js';
import { SemanticAnalyzer } from '../packages/compiler/src/semantic/analyzer.js';
import { ILGenerator } from '../packages/compiler/src/il/generator/generator.js';

const code = `
@zp let i: byte;
@zp let j: byte;
function test(): void {
  for (i = 0 to 9) {
    for (j = 0 to 9) {
      nop();
    }
  }
}
`;

console.log('=== Nested For Loop Debug ===\n');
console.log('Source code:');
console.log(code);
console.log('\n--- Phases ---\n');

// Phase 1: Lexer
const lexer = new Lexer(code, 'test.blend');
const tokens = lexer.tokenize();
console.log('✓ Phase 1: Lexer - OK');

// Phase 2: Parser
const parser = new Parser(tokens);
const ast = parser.parseProgram();
if (parser.getErrors().length > 0) {
  console.log('✗ Phase 2: Parser - FAILED');
  console.log('  Parser errors:', parser.getErrors());
  process.exit(1);
}
console.log('✓ Phase 2: Parser - OK');

// Phase 3: Semantic Analysis
const analyzer = new SemanticAnalyzer();
const analysisResult = analyzer.analyze(ast);
if (analysisResult.errors.length > 0) {
  console.log('✗ Phase 3: Semantic Analysis - FAILED');
  console.log('  Semantic errors:', analysisResult.errors);
  process.exit(1);
}
console.log('✓ Phase 3: Semantic Analysis - OK');

// Phase 4: IL Generation
const ilGen = new ILGenerator(analysisResult.symbolTable);
const ilResult = ilGen.generateModule(ast);
if (!ilResult.success) {
  console.log('✗ Phase 4: IL Generation - FAILED');
  console.log('\nErrors:');
  for (const error of ilResult.errors) {
    console.log(`  - ${error.message}`);
  }
  if (ilResult.warnings.length > 0) {
    console.log('\nWarnings:');
    for (const warning of ilResult.warnings) {
      console.log(`  - ${warning.message}`);
    }
  }
  process.exit(1);
}

console.log('✓ Phase 4: IL Generation - OK');

// Print IL module info
console.log('\n--- IL Module ---\n');
console.log(`Functions: ${ilResult.module.functions.length}`);
for (const fn of ilResult.module.functions) {
  console.log(`  - ${fn.name}`);
  console.log(`    Blocks: ${fn.blocks.length}`);
  for (const block of fn.blocks) {
    console.log(`      [${block.label}] predecessors=${block.predecessors.length}, successors=${block.successors.length}, hasTerminator=${block.hasTerminator()}`);
  }
}

console.log('\n=== Success! ===');