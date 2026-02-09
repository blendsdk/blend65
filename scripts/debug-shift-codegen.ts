/**
 * Debug script: Investigate what the codegen produces for shift operations.
 * Used to understand the actual ASM-IL output for << and >> operators.
 */
import { Lexer } from '../packages/compiler/src/lexer/index.js';
import { Parser } from '../packages/compiler/src/parser/index.js';
import { SemanticAnalyzer } from '../packages/compiler/src/semantic/index.js';
import { ILGenerator } from '../packages/compiler/src/il/index.js';
import { CodeGenerator } from '../packages/compiler/src/codegen/generator/generator.js';
import { AsmILEmitter } from '../packages/compiler/src/codegen/asm-il/emitter.js';
import { DiagnosticSeverity } from '../packages/compiler/src/ast/diagnostics.js';

function compileAndDump(label: string, source: string): void {
  console.log(`\n=== ${label} ===`);
  try {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens, { filePath: 'test.blend' });
    const ast = parser.parse();
    const semanticAnalyzer = new SemanticAnalyzer({
      runFrameAllocation: true,
      runAdvancedAnalysis: false,
    });
    const analysisResult = semanticAnalyzer.analyze(ast);
    const errors = analysisResult.diagnostics.filter(d => d.severity === DiagnosticSeverity.ERROR);
    if (errors.length > 0) {
      console.log('Semantic errors:', errors.map(e => e.message));
      return;
    }
    const ilGenerator = new ILGenerator(analysisResult.frameMap!, analysisResult.symbolTable);
    const ilProgram = ilGenerator.generate(ast);
    const codeGenerator = new CodeGenerator();
    const program = codeGenerator.generate(ilProgram);
    const emitter = new AsmILEmitter({ includeHeader: false, includeSectionSeparators: false, includeStats: false });
    const text = emitter.emit(program);
    console.log(text);
  } catch (e: any) {
    console.log('Error:', e.message);
  }
}

compileAndDump('Shift Left', `
  module Test;
  function main(): void {
    let x: byte = 1;
    let y: byte = x << 3;
  }
`);

compileAndDump('Shift Right', `
  module Test;
  function main(): void {
    let x: byte = $80;
    let y: byte = x >> 2;
  }
`);
