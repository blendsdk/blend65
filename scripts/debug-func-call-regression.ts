/**
 * Debug script for the function call with variable arguments regression.
 * Uses the same pipeline as the E2E test helpers.
 */

import { Lexer } from '../packages/compiler/src/lexer/index.js';
import { Parser } from '../packages/compiler/src/parser/index.js';
import { SemanticAnalyzer } from '../packages/compiler/src/semantic/index.js';
import { DiagnosticSeverity } from '../packages/compiler/src/ast/diagnostics.js';
import { ILGenerator } from '../packages/compiler/src/il/index.js';
import { CodeGenerator } from '../packages/compiler/src/codegen/generator/generator.js';
import {
  AsmILProgram,
  AsmILSection,
  isInstructionElement,
} from '../packages/compiler/src/codegen/asm-il/types.js';

const source = `
  module Test;
  function double(x: byte): byte {
    return x + x;
  }
  function main(): void {
    let value: byte = 5;
    let result: byte = double(value);
  }
`;

try {
  // Step 1: Lexer
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();

  // Step 2: Parser
  const parser = new Parser(tokens, { filePath: 'test.blend' });
  const ast = parser.parse();

  // Step 3: Semantic Analysis
  const semanticAnalyzer = new SemanticAnalyzer({
    runFrameAllocation: true,
    runAdvancedAnalysis: false,
  });
  const analysisResult = semanticAnalyzer.analyze(ast);

  const errors = analysisResult.diagnostics.filter(d => d.severity === DiagnosticSeverity.ERROR);
  if (errors.length > 0) {
    console.error('Semantic errors:', errors.map(e => e.message));
  }

  if (!analysisResult.frameMap) {
    console.error('No frameMap!');
    process.exit(1);
  }

  // Print frame info
  console.log('=== FRAME MAP ===');
  for (const [name, frame] of analysisResult.frameMap) {
    console.log(`  ${name}: ${frame.slots.length} slots, totalSize=${frame.totalSize}`);
    for (const s of frame.slots) {
      console.log(`    ${s.name}: kind=${s.kind}, size=${s.size}, location=${s.location}, address=0x${s.address.toString(16)}, register=${s.register ?? 'none'}`);
    }
  }

  // Step 4: IL Generation
  const ilGenerator = new ILGenerator(analysisResult.frameMap, analysisResult.symbolTable);
  const ilProgram = ilGenerator.generate(ast);

  console.log('\n=== IL PROGRAM ===');
  for (const func of ilProgram.functions) {
    console.log(`Function ${func.name}: ${func.instructions.length} instructions`);
    for (const instr of func.instructions) {
      console.log(`  ${instr.opcode} ${instr.operands.map(o => JSON.stringify(o)).join(', ')} ${instr.comment ? `; ${instr.comment}` : ''}`);
    }
  }

  // Step 5: Code Generation
  const codeGenerator = new CodeGenerator();
  const asmResult = codeGenerator.generate(ilProgram);

  console.log('\n=== ASM-IL SECTIONS ===');
  for (const section of asmResult.sections) {
    console.log(`Section: ${section.name}`);
    for (const elem of section.elements) {
      if (isInstructionElement(elem)) {
        console.log(`  ${elem.mnemonic} ${elem.operand ?? ''}`);
      } else {
        console.log(`  [${elem.type}] ${JSON.stringify(elem)}`);
      }
    }
  }

  // Count LDA
  let ldaCount = 0;
  for (const section of asmResult.sections) {
    for (const elem of section.elements) {
      if (isInstructionElement(elem) && elem.mnemonic === 'LDA') {
        ldaCount++;
      }
    }
  }
  console.log(`\nLDA count: ${ldaCount}`);

} catch (e) {
  console.error('Error:', e);
}
