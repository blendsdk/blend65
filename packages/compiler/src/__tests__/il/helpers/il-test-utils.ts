/**
 * IL Generator Test Utilities
 *
 * Shared helpers for IL generation tests. Provides convenient functions
 * for compiling source to IL, counting/finding opcodes, and wrapping
 * test code in module/function structures.
 *
 * @module __tests__/il/helpers/il-test-utils
 */

import { Lexer } from '../../../lexer/index.js';
import { Parser } from '../../../parser/index.js';
import { SemanticAnalyzer } from '../../../semantic/index.js';
import { DiagnosticSeverity } from '../../../ast/diagnostics.js';
import { ILGenerator, ILOpcode } from '../../../il/index.js';
import type { ILProgram, ILFunction } from '../../../il/structures.js';
import type { ILInstruction } from '../../../il/instruction.js';
import type { ImmediateOperand, SlotOperand } from '../../../il/operands.js';
import { isSlotOperand, isImmediateOperand } from '../../../il/guards.js';

// ============================================================================
// Core Compilation Helpers
// ============================================================================

/**
 * Compiles source code to IL program through the full pipeline.
 *
 * Pipeline: Source → Lexer → Parser → SemanticAnalyzer → ILGenerator
 *
 * The SemanticAnalyzer performs:
 * - Symbol table building
 * - Type resolution and type checking
 * - Control flow analysis
 * - Call graph & recursion detection
 * - Frame allocation (required for IL generation)
 *
 * @param source - Blend source code
 * @param filename - Optional filename for error reporting
 * @returns IL program
 * @throws Error if compilation fails (lexer, parser, or semantic errors)
 *
 * @example
 * ```typescript
 * const program = compileToIL(`
 *   module Test;
 *   function main(): void {
 *     let x: byte = 5;
 *   }
 * `);
 * expect(program.functions.length).toBe(1);
 * ```
 */
export function compileToIL(source: string, filename = 'test.blend'): ILProgram {
  // Step 1: Lexer
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();

  // Step 2: Parser
  const parser = new Parser(tokens, { filePath: filename });
  const ast = parser.parse();

  // Step 3: Semantic Analysis (includes frame allocation)
  const semanticAnalyzer = new SemanticAnalyzer({
    runFrameAllocation: true,
    runAdvancedAnalysis: false, // Skip for faster E2E tests
  });
  const analysisResult = semanticAnalyzer.analyze(ast);

  // Check for errors
  const errors = analysisResult.diagnostics.filter(d => d.severity === DiagnosticSeverity.ERROR);
  if (errors.length > 0) {
    throw new Error(`Semantic errors: ${errors.map(e => e.message).join(', ')}`);
  }

  // Frame map is computed by SemanticAnalyzer
  if (!analysisResult.frameMap) {
    throw new Error('Frame allocation failed - no frameMap in analysis result');
  }

  // Step 4: IL Generation
  const ilGenerator = new ILGenerator(analysisResult.frameMap, analysisResult.symbolTable);
  return ilGenerator.generate(ast);
}

// ============================================================================
// Opcode Counting & Finding Helpers
// ============================================================================

/**
 * Counts occurrences of a specific opcode in an instruction list.
 *
 * @param instructions - List of IL instructions
 * @param opcode - The opcode to count
 * @returns Number of instructions with the given opcode
 *
 * @example
 * ```typescript
 * const loadCount = countOpcode(func.instructions, ILOpcode.LOAD_IMM);
 * expect(loadCount).toBe(2);
 * ```
 */
export function countOpcode(instructions: ILInstruction[], opcode: ILOpcode): number {
  return instructions.filter(i => i.opcode === opcode).length;
}

/**
 * Checks if an instruction list contains a specific opcode.
 *
 * @param instructions - List of IL instructions
 * @param opcode - The opcode to check for
 * @returns true if at least one instruction has the opcode
 *
 * @example
 * ```typescript
 * expect(hasOpcode(func.instructions, ILOpcode.CALL)).toBe(true);
 * ```
 */
export function hasOpcode(instructions: ILInstruction[], opcode: ILOpcode): boolean {
  return instructions.some(i => i.opcode === opcode);
}

/**
 * Finds all instructions with a specific opcode.
 *
 * @param instructions - List of IL instructions
 * @param opcode - The opcode to find
 * @returns Array of instructions matching the opcode
 *
 * @example
 * ```typescript
 * const calls = findInstructions(func.instructions, ILOpcode.CALL);
 * expect(calls.length).toBe(3);
 * ```
 */
export function findInstructions(instructions: ILInstruction[], opcode: ILOpcode): ILInstruction[] {
  return instructions.filter(i => i.opcode === opcode);
}

/**
 * Gets the first instruction with a specific opcode.
 *
 * @param instructions - List of IL instructions
 * @param opcode - The opcode to find
 * @returns First matching instruction or undefined
 *
 * @example
 * ```typescript
 * const loadInstr = getFirstInstruction(func.instructions, ILOpcode.LOAD_IMM);
 * expect(getOperandValue(loadInstr!)).toBe(42);
 * ```
 */
export function getFirstInstruction(
  instructions: ILInstruction[],
  opcode: ILOpcode
): ILInstruction | undefined {
  return instructions.find(i => i.opcode === opcode);
}

/**
 * Gets the last instruction with a specific opcode.
 *
 * @param instructions - List of IL instructions
 * @param opcode - The opcode to find
 * @returns Last matching instruction or undefined
 */
export function getLastInstruction(
  instructions: ILInstruction[],
  opcode: ILOpcode
): ILInstruction | undefined {
  const matches = findInstructions(instructions, opcode);
  return matches.length > 0 ? matches[matches.length - 1] : undefined;
}

// ============================================================================
// Operand Value Helpers
// ============================================================================

/**
 * Gets the immediate operand value from an instruction.
 *
 * @param instruction - IL instruction
 * @returns Immediate value or undefined if not an immediate operand
 *
 * @example
 * ```typescript
 * const loadInstr = getFirstInstruction(func.instructions, ILOpcode.LOAD_IMM);
 * expect(getImmediateValue(loadInstr!)).toBe(5);
 * ```
 */
export function getImmediateValue(instruction: ILInstruction): number | undefined {
  if (instruction.operands.length > 0 && isImmediateOperand(instruction.operands[0])) {
    return (instruction.operands[0] as ImmediateOperand).value;
  }
  return undefined;
}

/**
 * Gets the slot name from an instruction's first operand.
 *
 * @param instruction - IL instruction
 * @returns Slot name or undefined if not a slot operand
 */
export function getSlotName(instruction: ILInstruction): string | undefined {
  if (instruction.operands.length > 0 && isSlotOperand(instruction.operands[0])) {
    return (instruction.operands[0] as SlotOperand).slot.name;
  }
  return undefined;
}

/**
 * Gets all immediate values from a list of instructions with a specific opcode.
 *
 * @param instructions - List of IL instructions
 * @param opcode - The opcode to filter by
 * @returns Array of immediate values
 */
export function getAllImmediateValues(
  instructions: ILInstruction[],
  opcode: ILOpcode
): number[] {
  return findInstructions(instructions, opcode)
    .map(i => getImmediateValue(i))
    .filter((v): v is number => v !== undefined);
}

// ============================================================================
// Function & Program Helpers
// ============================================================================

/**
 * Gets a function by name from an IL program.
 *
 * @param program - IL program
 * @param name - Function name to find
 * @returns ILFunction or undefined if not found
 *
 * @example
 * ```typescript
 * const mainFunc = getFunction(program, 'main');
 * expect(mainFunc).toBeDefined();
 * ```
 */
export function getFunction(program: ILProgram, name: string): ILFunction | undefined {
  return program.functions.find(f => f.name === name);
}

/**
 * Gets the main function from an IL program.
 *
 * @param program - IL program
 * @returns ILFunction for 'main' or undefined
 */
export function getMainFunction(program: ILProgram): ILFunction | undefined {
  return getFunction(program, 'main');
}

/**
 * Gets the total instruction count across all functions.
 *
 * @param program - IL program
 * @returns Total number of instructions
 */
export function getTotalInstructionCount(program: ILProgram): number {
  return program.functions.reduce((sum, f) => sum + f.instructions.length, 0) +
         program.globalInit.length;
}

// ============================================================================
// Verification Helpers
// ============================================================================

/**
 * Verifies that an opcode does NOT appear in instructions.
 * Throws assertion error if found.
 *
 * @param instructions - List of IL instructions
 * @param opcode - The opcode that should not appear
 * @throws Error if opcode is found
 *
 * @example
 * ```typescript
 * // Verify no division by zero pattern
 * verifyNoOpcode(func.instructions, ILOpcode.DIV_BYTE);
 * ```
 */
export function verifyNoOpcode(instructions: ILInstruction[], opcode: ILOpcode): void {
  const found = instructions.find(i => i.opcode === opcode);
  if (found) {
    throw new Error(`Unexpected opcode ${opcode} found`);
  }
}

/**
 * Verifies that a specific opcode appears at least N times.
 *
 * @param instructions - List of IL instructions
 * @param opcode - The opcode to check
 * @param minCount - Minimum expected count
 * @throws Error if count is less than expected
 */
export function verifyMinOpcodeCount(
  instructions: ILInstruction[],
  opcode: ILOpcode,
  minCount: number
): void {
  const count = countOpcode(instructions, opcode);
  if (count < minCount) {
    throw new Error(`Expected at least ${minCount} ${opcode} instructions, found ${count}`);
  }
}

/**
 * Verifies instruction sequence contains expected opcodes in order.
 * Does not require opcodes to be adjacent.
 *
 * @param instructions - List of IL instructions
 * @param expectedSequence - Array of opcodes expected in order
 * @throws Error if sequence is not found
 */
export function verifyOpcodeSequence(
  instructions: ILInstruction[],
  expectedSequence: ILOpcode[]
): void {
  let seqIndex = 0;
  for (const instr of instructions) {
    if (instr.opcode === expectedSequence[seqIndex]) {
      seqIndex++;
      if (seqIndex === expectedSequence.length) {
        return; // Found complete sequence
      }
    }
  }
  throw new Error(
    `Expected opcode sequence ${expectedSequence.join(' → ')} not found. ` +
    `Only found first ${seqIndex} opcodes.`
  );
}

// ============================================================================
// Code Wrapper Helpers
// ============================================================================

/**
 * Wraps code in a module declaration.
 *
 * @param body - Code to wrap
 * @param moduleName - Module name (default: 'Test')
 * @returns Valid Blend source with module wrapper
 *
 * @example
 * ```typescript
 * const source = wrapInModule('function main(): void { }');
 * // Returns: "module Test;\nfunction main(): void { }"
 * ```
 */
export function wrapInModule(body: string, moduleName = 'Test'): string {
  return `module ${moduleName};\n${body}`;
}

/**
 * Wraps code in a function declaration.
 *
 * @param body - Code to wrap in function body
 * @param fnName - Function name (default: 'main')
 * @param returnType - Return type (default: 'void')
 * @returns Function declaration containing the code
 *
 * @example
 * ```typescript
 * const fn = wrapInFunction('let x: byte = 5;');
 * // Returns: "function main(): void {\n  let x: byte = 5;\n}"
 * ```
 */
export function wrapInFunction(
  body: string,
  fnName = 'main',
  returnType = 'void'
): string {
  return `function ${fnName}(): ${returnType} {\n  ${body}\n}`;
}

/**
 * Wraps code in both module and function declarations.
 * Most convenient helper for simple test cases.
 *
 * @param body - Code to wrap
 * @param moduleName - Module name (default: 'Test')
 * @param fnName - Function name (default: 'main')
 * @returns Complete valid Blend program
 *
 * @example
 * ```typescript
 * const source = wrapInProgram('let x: byte = 5;');
 * // Returns complete program with module Test and function main
 * ```
 */
export function wrapInProgram(
  body: string,
  moduleName = 'Test',
  fnName = 'main'
): string {
  return wrapInModule(wrapInFunction(body, fnName), moduleName);
}

// ============================================================================
// C64 Hardware Address Constants
// ============================================================================

/**
 * Common C64 hardware addresses for testing.
 * These are useful for writing realistic hardware interaction tests.
 */
export const C64_ADDRESSES = {
  // VIC-II registers
  BORDER_COLOR: 0xD020,
  BACKGROUND_COLOR: 0xD021,
  RASTER_LINE: 0xD012,
  SPRITE_ENABLE: 0xD015,
  SPRITE_X_EXPAND: 0xD01D,
  SPRITE_Y_EXPAND: 0xD017,
  SPRITE_PRIORITY: 0xD01B,
  SPRITE_MULTICOLOR: 0xD01C,
  
  // CIA registers
  CIA1_DATA_A: 0xDC00,
  CIA1_DATA_B: 0xDC01,
  CIA1_TIMER_A_LO: 0xDC04,
  CIA1_TIMER_A_HI: 0xDC05,
  
  // SID registers
  SID_VOICE1_FREQ_LO: 0xD400,
  SID_VOICE1_FREQ_HI: 0xD401,
  SID_VOICE1_CONTROL: 0xD404,
  SID_VOLUME: 0xD418,
  
  // Memory
  SCREEN_RAM: 0x0400,
  COLOR_RAM: 0xD800,
  SPRITE_POINTERS: 0x07F8,
} as const;

// ============================================================================
// Code Generation Helpers (for stress tests)
// ============================================================================

/**
 * Generates a simple program with N variables.
 *
 * @param count - Number of variables to generate
 * @returns Blend source code
 */
export function generateManyVariables(count: number): string {
  const vars: string[] = [];
  for (let i = 0; i < count; i++) {
    vars.push(`let v${i}: byte = ${i % 256};`);
  }
  return wrapInProgram(vars.join('\n  '));
}

/**
 * Generates a program with N functions.
 *
 * @param count - Number of functions to generate
 * @returns Blend source code
 */
export function generateManyFunctions(count: number): string {
  const funcs: string[] = [];
  for (let i = 0; i < count; i++) {
    funcs.push(`function func${i}(): void { }`);
  }
  funcs.push(`function main(): void { func0(); }`);
  return wrapInModule(funcs.join('\n'));
}

/**
 * Generates nested if statements.
 *
 * @param depth - Nesting depth
 * @returns Blend source code
 */
export function generateNestedIfs(depth: number): string {
  let code = 'let x: byte = 0;\n  ';
  for (let i = 0; i < depth; i++) {
    code += `if (x < ${i + 10}) {\n${'  '.repeat(i + 2)}`;
  }
  code += 'x = 1;';
  for (let i = depth - 1; i >= 0; i--) {
    code += `\n${'  '.repeat(i + 1)}}`;
  }
  return wrapInProgram(code);
}

/**
 * Generates nested for loops.
 *
 * @param depth - Nesting depth
 * @returns Blend source code
 */
export function generateNestedLoops(depth: number): string {
  let code = '';
  for (let i = 0; i < depth; i++) {
    code += `for (let i${i}: byte = 0; i${i} < 10; i${i} = i${i} + 1) {\n${'  '.repeat(i + 2)}`;
  }
  code += 'let x: byte = 1;';
  for (let i = depth - 1; i >= 0; i--) {
    code += `\n${'  '.repeat(i + 1)}}`;
  }
  return wrapInProgram(code);
}

/**
 * Generates a chain of binary operations.
 *
 * @param count - Number of operations
 * @param operator - Operator to use (default: '+')
 * @returns Blend source code
 */
export function generateExpressionChain(count: number, operator = '+'): string {
  const parts: string[] = ['1'];
  for (let i = 0; i < count; i++) {
    parts.push(`${i % 10}`);
  }
  return wrapInProgram(`let result: byte = ${parts.join(` ${operator} `)};`);
}