/**
 * Debug script for remaining IL test failures
 */

import { SemanticAnalyzer } from '../packages/compiler-v2/src/semantic/index.js';
import { Parser } from '../packages/compiler-v2/src/parser/index.js';
import { Lexer } from '../packages/compiler-v2/src/lexer/index.js';
import { ILGenerator } from '../packages/compiler-v2/src/il/generator/index.js';
import { ILOpcode } from '../packages/compiler-v2/src/il/enums.js';
import { DiagnosticSeverity } from '../packages/compiler-v2/src/ast/diagnostics.js';
import type { Program } from '../packages/compiler-v2/src/ast/index.js';
import type { ILProgram } from '../packages/compiler-v2/src/il/structures.js';

function compileToIL(source: string): ILProgram | null {
  // Step 1: Lexer
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();

  // Step 2: Parser
  const parser = new Parser(tokens, { filePath: 'test.blend' });
  const ast = parser.parse();

  // Step 3: Semantic Analysis (includes frame allocation)
  const semanticAnalyzer = new SemanticAnalyzer({
    runFrameAllocation: true,
    runAdvancedAnalysis: false,
  });
  const analysisResult = semanticAnalyzer.analyze(ast);

  // Check for errors
  const errors = analysisResult.diagnostics.filter(d => d.severity === DiagnosticSeverity.ERROR);
  if (errors.length > 0) {
    console.log('Semantic errors:');
    for (const e of errors) {
      console.log(`  ${e.message}`);
    }
    return null;
  }

  // Frame map is computed by SemanticAnalyzer
  if (!analysisResult.frameMap) {
    console.log('Frame allocation failed - no frameMap in analysis result');
    return null;
  }

  // Step 4: IL Generation
  const ilGenerator = new ILGenerator(analysisResult.frameMap, analysisResult.symbolTable);
  return ilGenerator.generate(ast);
}

console.log('=== Debug: Remaining IL Test Failures ===\n');

// Test 2: Smooth scroll X
console.log('--- Test 2: Smooth scroll X (expects OR_IMM or OR_BYTE) ---');
const source2 = `
  module SmoothScrollX;
  
  const VIC_CONTROL_2: word = $D016;
  
  function setXScroll(scroll: byte): void {
    let masked: byte = peek(VIC_CONTROL_2) & $F8;
    poke(VIC_CONTROL_2, masked | (scroll & 7));
  }
  
  function main(): void {
    setXScroll(3);
  }
`;
const il2 = compileToIL(source2);
if (il2) {
  const setFunc = il2.functions.find(f => f.name === 'setXScroll');
  if (setFunc) {
    console.log('IL instructions for setXScroll:');
    for (const inst of setFunc.instructions) {
      console.log(`  ${inst.opcode} ${inst.operands.map(o => JSON.stringify(o)).join(', ')}`);
    }
    
    const hasOrImm = setFunc.instructions.some(i => i.opcode === ILOpcode.OR_IMM);
    const hasOrByte = setFunc.instructions.some(i => i.opcode === ILOpcode.OR_BYTE);
    console.log(`Has OR_IMM: ${hasOrImm}, Has OR_BYTE: ${hasOrByte}`);
    console.log(`Expected: true (either one), Actual: ${hasOrImm || hasOrByte}`);
  }
}

// Test 3: Memory block compare
console.log('\n--- Test 3: Memory block compare (expects CMP_BYTE) ---');
const source3 = `
  module MemCompare;
  
  let block1: byte[16] = [];
  let block2: byte[16] = [];
  
  function compareBlocks(): byte {
    for (let i: byte = 0 to 15 step 1) {
      if (block1[i] != block2[i]) {
        return 0;
      }
    }
    return 1;
  }
  
  function main(): void {
    let same: byte = compareBlocks();
  }
`;
const il3 = compileToIL(source3);
if (il3) {
  const cmpFunc = il3.functions.find(f => f.name === 'compareBlocks');
  if (cmpFunc) {
    console.log('IL instructions for compareBlocks:');
    for (const inst of cmpFunc.instructions) {
      console.log(`  ${inst.opcode} ${inst.operands.map(o => JSON.stringify(o)).join(', ')}`);
    }
    
    const hasCmpByte = cmpFunc.instructions.some(i => i.opcode === ILOpcode.CMP_BYTE);
    const hasCmpImm = cmpFunc.instructions.some(i => i.opcode === ILOpcode.CMP_IMM);
    console.log(`Has CMP_BYTE: ${hasCmpByte}, Has CMP_IMM: ${hasCmpImm}`);
    console.log(`Expected: CMP_BYTE = true, Actual: ${hasCmpByte}`);
  }
}

// Test 4: Memory checksum pattern (XOR_BYTE expected)
console.log('\n--- Test 4: Memory checksum pattern (expects XOR_BYTE) ---');
const source4 = `
  module Checksum;
  
  let data: byte[64] = [];
  
  function calculateChecksum(): byte {
    let sum: byte = 0;
    for (let i: byte = 0 to 63 step 1) {
      sum = sum ^ data[i];
    }
    return sum;
  }
  
  function main(): void {
    let check: byte = calculateChecksum();
  }
`;
const il4 = compileToIL(source4);
if (il4) {
  const checksumFunc = il4.functions.find(f => f.name === 'calculateChecksum');
  if (checksumFunc) {
    console.log('IL instructions for calculateChecksum:');
    for (const inst of checksumFunc.instructions) {
      console.log(`  ${inst.opcode} ${inst.operands.map(o => JSON.stringify(o)).join(', ')}`);
    }
    
    const hasXorByte = checksumFunc.instructions.some(i => i.opcode === ILOpcode.XOR_BYTE);
    const hasXorImm = checksumFunc.instructions.some(i => i.opcode === ILOpcode.XOR_IMM);
    console.log(`Has XOR_BYTE: ${hasXorByte}, Has XOR_IMM: ${hasXorImm}`);
    console.log(`Expected: XOR_BYTE = true, Actual: ${hasXorByte}`);
  }
}

console.log('\n=== Debug complete ===');