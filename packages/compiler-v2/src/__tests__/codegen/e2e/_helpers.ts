/**
 * E2E Test Helpers for Code Generator
 *
 * Provides the full compilation pipeline from Blend source code to ASM-IL output.
 * Pipeline: Source → Lexer → Parser → Semantic → Frame Allocator → IL Generator → Code Generator
 *
 * These helpers let E2E tests verify that Blend source code produces expected
 * 6502 assembly patterns through the entire compilation pipeline.
 *
 * @module __tests__/codegen/e2e/_helpers
 */

import { Lexer } from '../../../lexer/index.js';
import { Parser } from '../../../parser/index.js';
import { SemanticAnalyzer } from '../../../semantic/index.js';
import { DiagnosticSeverity } from '../../../ast/diagnostics.js';
import { ILGenerator } from '../../../il/index.js';
import { CodeGenerator } from '../../../codegen/generator/generator.js';
import {
  AsmILProgram,
  AsmILElement,
  AsmILSection,
  isInstructionElement,
  isLabelElement,
  isCommentElement,
} from '../../../codegen/asm-il/types.js';

// ============================================================================
// Full Pipeline: Source → ASM-IL
// ============================================================================

/**
 * Compiles Blend source code to ASM-IL through the full pipeline.
 *
 * Steps:
 * 1. Lexer: Source → Tokens
 * 2. Parser: Tokens → AST
 * 3. Semantic: AST → Typed AST + Frame Map
 * 4. IL Generator: AST + Frames → IL Program
 * 5. Code Generator: IL → ASM-IL
 *
 * @param source - Blend source code
 * @returns AsmILProgram ready for inspection
 * @throws Error if any pipeline stage fails
 */
export function compileToAsm(source: string): AsmILProgram {
  // Step 1: Lexer
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();

  // Step 2: Parser
  const parser = new Parser(tokens, { filePath: 'test.blend' });
  const ast = parser.parse();

  // Step 3: Semantic Analysis (includes frame allocation)
  const semanticAnalyzer = new SemanticAnalyzer({
    runFrameAllocation: true,
    runAdvancedAnalysis: false, // Skip for faster E2E tests
  });
  const analysisResult = semanticAnalyzer.analyze(ast);

  // Check for semantic errors (DiagnosticSeverity.ERROR = 'error')
  const errors = analysisResult.diagnostics.filter(d => d.severity === DiagnosticSeverity.ERROR);
  if (errors.length > 0) {
    throw new Error(`Semantic errors: ${errors.map(e => e.message).join(', ')}`);
  }

  if (!analysisResult.frameMap) {
    throw new Error('Frame allocation failed - no frameMap in analysis result');
  }

  // Step 4: IL Generation
  const ilGenerator = new ILGenerator(analysisResult.frameMap, analysisResult.symbolTable);
  const ilProgram = ilGenerator.generate(ast);

  // Step 5: Code Generation
  const codeGenerator = new CodeGenerator();
  return codeGenerator.generate(ilProgram);
}

// ============================================================================
// Output Inspection Helpers
// ============================================================================

/**
 * Flattens all elements from all sections into one array.
 *
 * @param program - Generated ASM-IL program
 * @returns All elements from all sections
 */
export function allElements(program: AsmILProgram): AsmILElement[] {
  return program.sections.flatMap((s: AsmILSection) => s.elements);
}

/**
 * Gets only instruction elements from generated output.
 *
 * @param program - Generated ASM-IL program
 * @returns Only instruction elements
 */
export function allInstructions(program: AsmILProgram): AsmILElement[] {
  return allElements(program).filter(isInstructionElement);
}

/**
 * Gets instruction mnemonics as a simple string array.
 *
 * @param program - Generated ASM-IL program
 * @returns Array of mnemonic strings (e.g., ['LDA', 'CLC', 'ADC', 'STA'])
 */
export function mnemonics(program: AsmILProgram): string[] {
  return allInstructions(program).map(e =>
    isInstructionElement(e) ? e.instruction.mnemonic : ''
  );
}

/**
 * Gets label names from generated output.
 *
 * @param program - Generated ASM-IL program
 * @returns Array of label names
 */
export function labelNames(program: AsmILProgram): string[] {
  return allElements(program)
    .filter(isLabelElement)
    .map(e => (isLabelElement(e) ? e.label.name : ''));
}

/**
 * Finds all instruction elements with a specific mnemonic.
 *
 * @param program - Generated ASM-IL program
 * @param mnemonic - Mnemonic to search for (e.g., 'LDA', 'STA')
 * @returns Matching instruction elements
 */
export function findMnemonic(program: AsmILProgram, mnemonic: string): AsmILElement[] {
  return allInstructions(program).filter(
    e => isInstructionElement(e) && e.instruction.mnemonic === mnemonic
  );
}

/**
 * Counts occurrences of a specific mnemonic.
 *
 * @param program - Generated ASM-IL program
 * @param mnemonic - Mnemonic to count
 * @returns Count of matching instructions
 */
export function countMnemonic(program: AsmILProgram, mnemonic: string): number {
  return findMnemonic(program, mnemonic).length;
}

/**
 * Checks if the output contains a label with the given name.
 * Handles the code generator's localLabel prefix (`.` prefix).
 *
 * @param program - Generated ASM-IL program
 * @param name - Label name to search for
 * @returns true if label exists
 */
export function hasLabel(program: AsmILProgram, name: string): boolean {
  const names = labelNames(program);
  return names.includes(name) || names.includes(`.${name}`);
}

/**
 * Checks if the output contains a comment with specific text.
 *
 * @param program - Generated ASM-IL program
 * @param text - Text to search for (substring match)
 * @returns true if matching comment exists
 */
export function hasComment(program: AsmILProgram, text: string): boolean {
  return allElements(program).some(e => {
    if (isCommentElement(e)) {
      return e.comment.text.includes(text);
    }
    if (isInstructionElement(e) && e.instruction.comment) {
      return e.instruction.comment.includes(text);
    }
    return false;
  });
}

/**
 * Gets all sections from the program.
 *
 * @param program - Generated ASM-IL program
 * @returns Array of sections
 */
export function getSections(program: AsmILProgram): AsmILSection[] {
  return program.sections;
}

/**
 * Gets a section by name.
 *
 * @param program - Generated ASM-IL program
 * @param name - Section name
 * @returns The section, or undefined
 */
export function getSection(program: AsmILProgram, name: string): AsmILSection | undefined {
  return program.sections.find((s: AsmILSection) => s.name === name);
}

/**
 * Checks if output contains at least one of the given mnemonics.
 * Useful when IL can emit different opcodes depending on context.
 *
 * @param program - Generated ASM-IL program
 * @param mnemonicList - Array of mnemonics to check
 * @returns true if any mnemonic is present
 */
export function hasAnyMnemonic(program: AsmILProgram, mnemonicList: string[]): boolean {
  return mnemonicList.some(m => countMnemonic(program, m) > 0);
}
