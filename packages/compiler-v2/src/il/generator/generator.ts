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
   * @param func - Function declaration
   * @returns IL function with instructions
   */
  protected generateFunction(func: FunctionDecl): ILFunction {
    // Begin function generation
    this.beginFunction(func.getName());

    // Get the function's frame for slot context
    const frame = this.getCurrentFrame();

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

      // Store to slot
      const slot = this.resolveVariable(decl.getName());
      this.builder.storeSlot(slot, `let ${decl.getName()}`);
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
   * @param decl - Global variable declaration
   * @param globalInit - Array to add instructions to
   */
  protected generateGlobalInit(
    decl: VariableDecl,
    globalInit: ILInstruction[]
  ): void {
    const initializer = decl.getInitializer();
    if (!initializer) {
      return; // No initialization needed
    }

    // Save current state
    const savedInstructions = this.builder.getInstructions().slice();
    this.builder.clear();

    // Generate initializer
    this.setLocation(decl.getLocation());
    this.generateExpression(initializer);

    // Note: Global slot resolution needs special handling
    // For now, we just collect the instructions
    // Full global support will be added in Phase 7c

    // Collect generated instructions
    for (const instr of this.builder.getInstructions()) {
      globalInit.push(instr);
    }

    // Restore state
    this.builder.clear();
    for (const instr of savedInstructions) {
      // Re-emit saved instructions
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