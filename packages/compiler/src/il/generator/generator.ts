/**
 * IL Generator - Final Concrete Class
 *
 * Statement generation and main entry points:
 * - Variable declaration
 * - Expression statements
 * - Block statements
 * - Control flow (if/else, while, for, return, break, continue)
 * - Function and program generation
 *
 * Inheritance chain:
 * ILGeneratorBase → ILGeneratorExpressions → ILGeneratorControlFlow → ILGenerator
 *
 * @module il/generator/generator
 */

import { Statement } from '../../ast/base.js';
import { VariableDecl, FunctionDecl } from '../../ast/declarations.js';
import { ExpressionStatement, BlockStatement } from '../../ast/statements.js';
import { Program } from '../../ast/program.js';
import {
  isVariableDecl,
  isFunctionDecl,
  isExpressionStatement,
  isBlockStatement,
  isIfStatement,
  isWhileStatement,
  isForStatement,
  isReturnStatement,
  isBreakStatement,
  isContinueStatement,
} from '../../ast/type-guards.js';
import {
  IfStatement,
  WhileStatement,
  ForStatement,
  ReturnStatement,
} from '../../ast/statements.js';
import { SlotKind, SlotLocation } from '../../frame/enums.js';
import type { Frame } from '../../frame/allocator/frame-calculator.js';
import { ILInstruction } from '../instruction.js';
import { ILFunction, ILProgram } from '../structures.js';
import { createILFunction, createILProgram } from '../factories.js';
import { ILGeneratorControlFlow } from './control-flow.js';

// ============================================================================
// ILGenerator Class
// ============================================================================

/**
 * Complete IL Generator.
 *
 * Generates IL from AST with full SFA context. The inheritance chain:
 * - ILGeneratorBase: Core infrastructure, variable resolution
 * - ILGeneratorExpressions: All expression generation
 * - ILGeneratorControlFlow: Control flow (if, while, for, return, break, continue)
 * - ILGenerator: Statement generation and entry points
 *
 * @example
 * ```typescript
 * const generator = new ILGenerator(frameMap, symbolTable);
 * const ilProgram = generator.generate(program);
 *
 * for (const func of ilProgram.functions) {
 *   console.log(`Function ${func.name}: ${func.instructions.length} instructions`);
 * }
 * ```
 */
export class ILGenerator extends ILGeneratorControlFlow {
  // ═══════════════════════════════════════════════════════════════════
  // Main Entry Point
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Generate IL for an entire program.
   *
   * Processes all function declarations and global variable
   * initializations to produce a complete ILProgram.
   *
   * @param program - Program AST node
   * @returns Complete IL program
   *
   * @example
   * ```typescript
   * const program = parser.parse();
   * const frameMap = frameAllocator.allocate(program);
   * const generator = new ILGenerator(frameMap, symbolTable);
   * const ilProgram = generator.generate(program);
   * ```
   */
  generate(program: Program): ILProgram {
    const functions: ILFunction[] = [];
    const globalInit: ILInstruction[] = [];

    // Process all declarations in the program
    for (const decl of program.getDeclarations()) {
      if (isFunctionDecl(decl)) {
        // Skip stub functions (no body)
        if (!decl.isStubFunction()) {
          functions.push(this.generateFunction(decl));
        }
      } else if (isVariableDecl(decl)) {
        // Global variable initialization
        this.generateGlobalInit(decl, globalInit);
      }
    }

    // Calculate statistics
    const instructionCount = this.countInstructions(functions, globalInit);
    const totalCycles = this.sumCycles(functions, globalInit);

    return createILProgram(program.getModule().getFullName(), {
      functions,
      globalInit,
      entryPoint: this.findEntryPoint(functions),
      instructionCount,
      totalEstimatedCycles: totalCycles,
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // Function Generation
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Generate IL for a function.
   *
   * Generates a complete function including:
   * 1. Parameter prologue — stores incoming A (byte) or A:X (word) to first param slot
   * 2. Function body — all statements
   * 3. Implicit void return — ensures void functions end with RETURN
   *
   * The parameter prologue handles the 6502 calling convention:
   * - First byte parameter arrives in A register → STORE_BYTE to slot
   * - First word parameter arrives in A:X pair → STORE_WORD to slot
   * - Register parameters (SlotLocation.Register) are skipped — read directly via TRANSFER_*A
   *
   * @param func - Function declaration
   * @returns IL function with instructions
   */
  protected generateFunction(func: FunctionDecl): ILFunction {
    // Begin function generation
    this.beginFunction(func.getName());

    // Get the function's frame for slot context
    const frame = this.getCurrentFrame();

    // Generate parameter prologue: store incoming A or A:X to first param's memory slot
    // This implements the callee side of the 6502 calling convention
    this.generateParameterPrologue(frame);

    // Generate function body
    const body = func.getBody();
    if (body) {
      for (const stmt of body) {
        this.generateStatement(stmt);
      }
    }

    // Ensure void functions end with return
    const returnType = func.getReturnType();
    if (returnType === 'void' || !returnType) {
      this.builder.return_();
    }

    // End function and collect results
    const result = this.endFunction();

    return createILFunction(func.getName(), frame, {
      instructions: result.instructions,
      loops: result.loops,
      maxLoopDepth: result.maxLoopDepth,
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // Parameter Prologue
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Generate parameter prologue for a function.
   *
   * On the 6502, the first argument is passed in registers:
   * - Byte parameter: value in A register
   * - Word parameter: low byte in A, high byte in X (A:X pair)
   *
   * The prologue stores these incoming register values to the parameter's
   * memory slot so that the function body can access them by name.
   *
   * Register parameters (SlotLocation.Register) are skipped because they
   * are read directly from their register via TRANSFER_*A instructions
   * when the identifier is referenced in the function body.
   *
   * @param frame - The function's frame containing parameter slots
   */
  protected generateParameterPrologue(frame: Frame): void {
    // Find the first parameter slot (parameters are first in slot order)
    const firstParam = frame.slots.find(s => s.kind === SlotKind.Parameter);
    if (!firstParam) {
      return; // No parameters — no prologue needed
    }

    // Skip register parameters — they are read directly via TRANSFER_*A
    // when the identifier is referenced in the function body
    if (firstParam.location === SlotLocation.Register) {
      return;
    }

    // Store incoming register value(s) to the parameter's memory slot
    if (firstParam.size === 2) {
      // Word parameter: A:X pair → STORE_WORD to 2-byte slot
      this.builder.storeSlotWord(firstParam, `param ${firstParam.name} (word)`);
    } else {
      // Byte parameter: A → STORE_BYTE to 1-byte slot
      this.builder.storeSlot(firstParam, `param ${firstParam.name}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Statement Generation
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Generate IL for a statement.
   *
   * Dispatches to specific handlers based on statement type.
   *
   * @param stmt - Statement to generate
   */
  protected generateStatement(stmt: Statement): void {
    if (isVariableDecl(stmt)) {
      this.generateVariableDecl(stmt);
    } else if (isExpressionStatement(stmt)) {
      this.generateExpressionStatement(stmt);
    } else if (isBlockStatement(stmt)) {
      this.generateBlockStatement(stmt);
    } else if (isIfStatement(stmt)) {
      this.generateIfStatement(stmt as IfStatement);
    } else if (isWhileStatement(stmt)) {
      this.generateWhileStatement(stmt as WhileStatement);
    } else if (isForStatement(stmt)) {
      this.generateForStatement(stmt as ForStatement);
    } else if (isReturnStatement(stmt)) {
      this.generateReturnStatement(stmt as ReturnStatement);
    } else if (isBreakStatement(stmt)) {
      this.generateBreakStatement();
    } else if (isContinueStatement(stmt)) {
      this.generateContinueStatement();
    }
    // Other statement types can be added as needed
  }

  /**
   * Override generateStatementDispatch for control flow.
   *
   * This method is called by control flow generators (if/while/for)
   * to generate statements in their bodies.
   *
   * @param stmt - Statement to generate
   */
  protected override generateStatementDispatch(stmt: Statement): void {
    this.generateStatement(stmt);
  }

  /**
   * Generate IL for a variable declaration.
   *
   * If the declaration has an initializer, generates the
   * initializer expression and stores to the slot.
   *
   * @param decl - Variable declaration
   */
  protected generateVariableDecl(decl: VariableDecl): void {
    this.setLocation(decl.getLocation());

    const initializer = decl.getInitializer();
    if (initializer) {
      // Generate initializer expression
      this.generateExpression(initializer);

      // Store to slot — use word store for 2-byte slots (A:X pair)
      const slot = this.resolveVariable(decl.getName());
      if (slot.size === 2) {
        this.builder.storeSlotWord(slot, `let ${decl.getName()} (word)`);
      } else {
        this.builder.storeSlot(slot, `let ${decl.getName()}`);
      }
    }
    // If no initializer, the slot is uninitialized (value undefined)

    this.clearLocation();
  }

  /**
   * Generate IL for an expression statement.
   *
   * Simply generates the expression and discards the result.
   *
   * @param stmt - Expression statement
   */
  protected generateExpressionStatement(stmt: ExpressionStatement): void {
    this.generateExpression(stmt.getExpression());
    // Result in A is discarded (used for side effects only)
  }

  /**
   * Generate IL for a block statement.
   *
   * Generates all statements in the block sequentially.
   *
   * @param stmt - Block statement
   */
  protected generateBlockStatement(stmt: BlockStatement): void {
    for (const s of stmt.getStatements()) {
      this.generateStatement(s);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Global Initialization
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Generate IL for global variable initialization.
   *
   * Global initializers are collected separately from function
   * instructions and executed at program startup.
   *
   * Handles each storage class differently:
   * - @data const: **SKIPPED** — data is embedded in binary, no runtime init needed
   * - const (without @data): **SKIPPED** — compile-time constants, resolved inline
   * - @zp / @ram / default: Generates LOAD + STORE instructions with allocated address
   *
   * @param decl - Global variable declaration
   * @param globalInit - Array to add instructions to
   */
  protected generateGlobalInit(
    decl: VariableDecl,
    globalInit: ILInstruction[]
  ): void {
    // Skip const declarations — compile-time constants are resolved inline
    // (e.g., const BORDER: word = $D020 is used as immediate, not stored)
    if (decl.isConst()) {
      return;
    }

    // Skip @data declarations — data is embedded in binary at compile time,
    // no runtime initialization IL is needed
    const globalSlot = this.findGlobalSlot(decl.getName());
    if (globalSlot && globalSlot.storageClass === 'data') {
      return;
    }

    const initializer = decl.getInitializer();
    if (!initializer) {
      return; // No initialization needed (variable starts at whatever is in memory)
    }

    // Save current builder state (global init uses a separate instruction stream)
    const savedInstructions = this.builder.getInstructions().slice();
    this.builder.clear();

    // Generate the initializer expression — result will be in accumulator
    this.setLocation(decl.getLocation());
    this.generateExpression(initializer);

    // Store the initialized value to the global variable's allocated address
    // Resolve the variable to get its FrameSlot (with proper address from GlobalAllocator)
    const slot = this.tryResolveModuleVariable(decl.getName());
    if (slot) {
      // Determine if this is a word-sized store
      const isWord = slot.size === 2;

      // Add volatile comment for @zp globals (optimization hint)
      const volatileTag = globalSlot?.storageClass === 'zp' ? ' [volatile:zp]' : '';
      const comment = `init global ${decl.getName()}${volatileTag}`;

      if (isWord) {
        this.builder.storeSlotWord(slot, comment);
      } else {
        this.builder.storeSlot(slot, comment);
      }
    }

    // Collect the generated initialization instructions
    for (const instr of this.builder.getInstructions()) {
      globalInit.push(instr);
    }

    // Restore builder to its previous state
    this.builder.clear();
    for (const instr of savedInstructions) {
      this.builder.emit(instr.opcode, instr.operands, instr.comment);
    }

    this.clearLocation();
  }

  // ═══════════════════════════════════════════════════════════════════
  // Statistics Helpers
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Count total instructions across all functions.
   *
   * @param functions - Array of IL functions
   * @param globalInit - Global initialization instructions
   * @returns Total instruction count
   */
  protected countInstructions(
    functions: ILFunction[],
    globalInit: ILInstruction[]
  ): number {
    let count = globalInit.length;
    for (const func of functions) {
      count += func.instructions.length;
    }
    return count;
  }

  /**
   * Sum estimated cycles across all functions.
   *
   * @param functions - Array of IL functions
   * @param globalInit - Global initialization instructions
   * @returns Total estimated cycles
   */
  protected sumCycles(
    functions: ILFunction[],
    globalInit: ILInstruction[]
  ): number {
    let cycles = 0;

    // Global init cycles
    for (const instr of globalInit) {
      cycles += instr.cost?.cycles ?? 0;
    }

    // Function cycles
    for (const func of functions) {
      for (const instr of func.instructions) {
        cycles += instr.cost?.cycles ?? 0;
      }
    }

    return cycles;
  }

  /**
   * Find the program entry point.
   *
   * Looks for a 'main' function, or returns the first function.
   *
   * @param functions - Array of IL functions
   * @returns Entry point function name
   */
  protected findEntryPoint(functions: ILFunction[]): string {
    // Look for 'main' function
    const main = functions.find((f) => f.name === 'main');
    if (main) {
      return 'main';
    }

    // Fall back to first function
    if (functions.length > 0) {
      return functions[0].name;
    }

    return 'main'; // Default
  }
}