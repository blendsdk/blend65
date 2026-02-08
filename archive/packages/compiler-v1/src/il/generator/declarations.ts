/**
 * IL Declaration Generator
 *
 * Generates IL for function declarations and local variables.
 * Extends ILModuleGenerator to add function-level generation capabilities.
 *
 * This layer handles:
 * - Function body generation setup
 * - Parameter-to-register mapping
 * - Local variable declaration processing
 * - Intrinsic function detection and registration
 *
 * The actual statement and expression generation is delegated to subclasses
 * (ILStatementGenerator, ILExpressionGenerator).
 *
 * @module il/generator/declarations
 */

import type { Declaration, SourceLocation, Statement } from '../../ast/base.js';
import type { SymbolTable } from '../../semantic/symbol-table.js';
import type { TargetConfig } from '../../target/config.js';
import type { ILType } from '../types.js';
import type { VirtualRegister } from '../values.js';
import type { ILFunction } from '../function.js';
import type { Parameter } from '../../ast/nodes.js';

import { ASTNodeType } from '../../ast/base.js';
import {
  FunctionDecl,
  VariableDecl,
  BlockStatement,
  IfStatement,
  WhileStatement,
  ForStatement,
  MatchStatement,
} from '../../ast/nodes.js';
import { ILStorageClass } from '../function.js';
import { IL_BYTE, IL_VOID, IL_WORD } from '../types.js';
import { ILModuleGenerator } from './modules.js';

// =============================================================================
// Intrinsic Function Info
// =============================================================================

/**
 * Information about an intrinsic function.
 *
 * Intrinsic functions are stub functions that map to special
 * IL operations or are resolved at link time.
 */
export interface IntrinsicInfo {
  /** Intrinsic name */
  readonly name: string;

  /** Parameter types */
  readonly parameterTypes: readonly ILType[];

  /** Return type */
  readonly returnType: ILType;

  /** Whether this is a compile-time intrinsic (e.g., sizeof) */
  readonly isCompileTime: boolean;

  /** Source location where the intrinsic was declared */
  readonly location: SourceLocation;
}

/**
 * Information about a local variable in a function.
 */
export interface LocalVariableInfo {
  /** Variable name */
  readonly name: string;

  /** IL type */
  readonly type: ILType;

  /** Virtual register holding the value */
  readonly register: VirtualRegister;

  /** Storage class hint */
  readonly storageClass: ILStorageClass;

  /** Whether this is a constant */
  readonly isConst: boolean;

  /** Initial value (if constant) */
  readonly initialValue?: number;
}

// =============================================================================
// ILDeclarationGenerator Class
// =============================================================================

/**
 * Generates IL for function declarations and local variables.
 *
 * This class extends ILModuleGenerator to provide function-level
 * generation capabilities including:
 * - Setting up function entry blocks
 * - Mapping parameters to registers
 * - Processing local variable declarations
 * - Detecting and registering intrinsic functions
 *
 * Statement generation is handled by subclasses.
 *
 * @example
 * ```typescript
 * const generator = new ILDeclarationGenerator(symbolTable, targetConfig);
 * const result = generator.generateModule(program);
 *
 * // Check for intrinsics
 * const intrinsics = generator.getIntrinsics();
 * for (const [name, info] of intrinsics) {
 *   console.log(`Intrinsic: ${name}`);
 * }
 * ```
 */
export class ILDeclarationGenerator extends ILModuleGenerator {
  /**
   * Registry of intrinsic functions (stub functions).
   * Maps function name to intrinsic info.
   */
  protected readonly intrinsics: Map<string, IntrinsicInfo> = new Map();

  /**
   * Local variables for the current function being generated.
   * Cleared when entering a new function.
   */
  protected readonly currentLocals: Map<string, LocalVariableInfo> = new Map();

  /**
   * Creates a new declaration generator.
   *
   * @param symbolTable - Symbol table from semantic analysis
   * @param targetConfig - Optional target configuration
   */
  constructor(symbolTable: SymbolTable, targetConfig: TargetConfig | null = null) {
    super(symbolTable, targetConfig);
  }

  // ===========================================================================
  // Intrinsic Registry
  // ===========================================================================

  /**
   * Gets all registered intrinsic functions.
   *
   * @returns Map of intrinsic name to info
   */
  public getIntrinsics(): ReadonlyMap<string, IntrinsicInfo> {
    return this.intrinsics;
  }

  /**
   * Checks if a function is an intrinsic.
   *
   * @param name - Function name
   * @returns true if the function is registered as an intrinsic
   */
  public isIntrinsic(name: string): boolean {
    return this.intrinsics.has(name);
  }

  /**
   * Gets information about an intrinsic function.
   *
   * Checks both registered intrinsics (from stub functions) and built-in
   * intrinsics like peek, poke, peekw, pokew, sizeof, length, lo, hi, etc.
   *
   * @param name - Function name
   * @returns Intrinsic info, or undefined if not an intrinsic
   */
  public getIntrinsicInfo(name: string): IntrinsicInfo | undefined {
    // Check registered intrinsics first (from stub functions)
    const registered = this.intrinsics.get(name);
    if (registered) {
      return registered;
    }

    // Check built-in intrinsics
    return this.getBuiltinIntrinsicInfo(name);
  }

  /**
   * Gets information about a built-in intrinsic function.
   *
   * Built-in intrinsics are recognized automatically without
   * requiring stub function declarations.
   *
   * @param name - Function name
   * @returns Intrinsic info, or undefined if not a built-in intrinsic
   */
  protected getBuiltinIntrinsicInfo(name: string): IntrinsicInfo | undefined {
    // Built-in intrinsics recognized by the generator
    // These don't require stub function declarations
    switch (name) {
      // Memory intrinsics
      case 'peek':
        return {
          name: 'peek',
          parameterTypes: [IL_WORD], // address
          returnType: IL_BYTE,
          isCompileTime: false,
          location: this.dummyLocation(),
        };
      case 'poke':
        return {
          name: 'poke',
          parameterTypes: [IL_WORD, IL_BYTE], // address, value
          returnType: IL_VOID,
          isCompileTime: false,
          location: this.dummyLocation(),
        };
      case 'peekw':
        return {
          name: 'peekw',
          parameterTypes: [IL_WORD], // address
          returnType: IL_WORD,
          isCompileTime: false,
          location: this.dummyLocation(),
        };
      case 'pokew':
        return {
          name: 'pokew',
          parameterTypes: [IL_WORD, IL_WORD], // address, value
          returnType: IL_VOID,
          isCompileTime: false,
          location: this.dummyLocation(),
        };

      // Compile-time intrinsics
      case 'sizeof':
        return {
          name: 'sizeof',
          parameterTypes: [], // Takes a type, not a value
          returnType: IL_WORD,
          isCompileTime: true,
          location: this.dummyLocation(),
        };
      case 'length':
        return {
          name: 'length',
          parameterTypes: [], // Takes an array
          returnType: IL_WORD,
          isCompileTime: true,
          location: this.dummyLocation(),
        };

      // Byte extraction intrinsics
      case 'lo':
        return {
          name: 'lo',
          parameterTypes: [IL_WORD], // word value
          returnType: IL_BYTE,
          isCompileTime: false,
          location: this.dummyLocation(),
        };
      case 'hi':
        return {
          name: 'hi',
          parameterTypes: [IL_WORD], // word value
          returnType: IL_BYTE,
          isCompileTime: false,
          location: this.dummyLocation(),
        };

      // CPU control intrinsics
      case 'sei':
        return {
          name: 'sei',
          parameterTypes: [], // no arguments
          returnType: IL_VOID,
          isCompileTime: false,
          location: this.dummyLocation(),
        };
      case 'cli':
        return {
          name: 'cli',
          parameterTypes: [], // no arguments
          returnType: IL_VOID,
          isCompileTime: false,
          location: this.dummyLocation(),
        };
      case 'nop':
        return {
          name: 'nop',
          parameterTypes: [], // no arguments
          returnType: IL_VOID,
          isCompileTime: false,
          location: this.dummyLocation(),
        };
      case 'brk':
        return {
          name: 'brk',
          parameterTypes: [], // no arguments
          returnType: IL_VOID,
          isCompileTime: false,
          location: this.dummyLocation(),
        };

      // Stack operation intrinsics
      case 'pha':
        return {
          name: 'pha',
          parameterTypes: [], // no arguments - pushes accumulator
          returnType: IL_VOID,
          isCompileTime: false,
          location: this.dummyLocation(),
        };
      case 'pla':
        return {
          name: 'pla',
          parameterTypes: [], // no arguments
          returnType: IL_BYTE, // returns popped value
          isCompileTime: false,
          location: this.dummyLocation(),
        };
      case 'php':
        return {
          name: 'php',
          parameterTypes: [], // no arguments - pushes processor status
          returnType: IL_VOID,
          isCompileTime: false,
          location: this.dummyLocation(),
        };
      case 'plp':
        return {
          name: 'plp',
          parameterTypes: [], // no arguments
          returnType: IL_VOID, // restores processor status from stack
          isCompileTime: false,
          location: this.dummyLocation(),
        };

      // Optimization control intrinsics
      case 'barrier':
        return {
          name: 'barrier',
          parameterTypes: [], // no arguments
          returnType: IL_VOID,
          isCompileTime: false,
          location: this.dummyLocation(),
        };
      case 'volatile_read':
        return {
          name: 'volatile_read',
          parameterTypes: [IL_WORD], // address
          returnType: IL_BYTE, // returns value at address
          isCompileTime: false,
          location: this.dummyLocation(),
        };
      case 'volatile_write':
        return {
          name: 'volatile_write',
          parameterTypes: [IL_WORD, IL_BYTE], // address, value
          returnType: IL_VOID,
          isCompileTime: false,
          location: this.dummyLocation(),
        };

      default:
        return undefined;
    }
  }

  /**
   * Registers a function as an intrinsic.
   *
   * Called when processing stub functions (functions without bodies).
   *
   * @param funcDecl - Function declaration
   */
  protected registerIntrinsic(funcDecl: FunctionDecl): void {
    const name = funcDecl.getName();
    const params = funcDecl.getParameters();
    const returnTypeStr = funcDecl.getReturnType();

    // Convert parameter types
    const parameterTypes = params.map((p) => this.convertTypeAnnotation(p.typeAnnotation));

    // Convert return type
    const returnType = returnTypeStr ? this.convertTypeAnnotation(returnTypeStr) : IL_VOID;

    // Determine if this is a compile-time intrinsic
    // Known compile-time intrinsics: sizeof
    const isCompileTime = this.isCompileTimeIntrinsic(name);

    // Register the intrinsic
    this.intrinsics.set(name, {
      name,
      parameterTypes,
      returnType,
      isCompileTime,
      location: funcDecl.getLocation(),
    });
  }

  /**
   * Checks if an intrinsic is evaluated at compile time.
   *
   * Compile-time intrinsics are evaluated during IL generation and emit
   * constant values rather than runtime operations.
   *
   * @param name - Intrinsic name
   * @returns true if compile-time intrinsic
   */
  protected isCompileTimeIntrinsic(name: string): boolean {
    // Known compile-time intrinsics
    // sizeof - returns size of a type
    // offsetof, alignof - reserved for future struct support
    // length - returns compile-time known array/string length
    const compileTimeIntrinsics = new Set(['sizeof', 'offsetof', 'alignof', 'length']);
    return compileTimeIntrinsics.has(name);
  }

  // ===========================================================================
  // Function Body Generation
  // ===========================================================================

  /**
   * Generates the body for a function.
   *
   * Overrides the base implementation to actually generate function bodies.
   * Sets up the function context, maps parameters to registers, and
   * delegates statement generation to subclasses.
   *
   * @param decl - Declaration containing a function
   */
  protected override generateFunctionBody(decl: Declaration): void {
    const funcDecl = this.getFunctionDecl(decl);
    if (!funcDecl) {
      return;
    }

    // Check for stub function - register as intrinsic and skip body generation
    if (funcDecl.isStubFunction()) {
      this.registerIntrinsic(funcDecl);
      return;
    }

    const name = funcDecl.getName();
    const body = funcDecl.getBody();

    // Must have a body for non-stub functions
    if (!body) {
      this.addError(`Function '${name}' has no body`, funcDecl.getLocation(), 'E_NO_BODY');
      return;
    }

    // Get the IL function from the module (created in createFunctionStub)
    const ilFunc = this.context!.module.getFunction(name);
    if (!ilFunc) {
      this.addError(
        `IL function '${name}' not found - stub not created?`,
        funcDecl.getLocation(),
        'E_NO_FUNCTION',
      );
      return;
    }

    // CRITICAL: Enter the function in the builder
    // This sets up the builder's currentFunction and currentBlock so emit methods work.
    // The builder maintains its own state separate from the generator context.
    this.builder?.enterFunction(ilFunc);

    // Also set up the generator's context for state tracking
    this.context!.currentFunction = ilFunc;
    this.context!.currentBlock = ilFunc.getEntryBlock();

    // Clear local variable tracking from previous function
    this.currentLocals.clear();
    this.clearLocalVariableMappings();

    // Map parameters to registers
    this.setupParameterMappings(funcDecl, ilFunc);

    // Process local variable declarations in the body
    this.processLocalDeclarations(body, ilFunc);

    // Generate the function body statements
    // This is delegated to subclasses (ILStatementGenerator)
    this.generateStatements(body, ilFunc);

    // Ensure function ends with a return if needed
    this.ensureTerminator(ilFunc);

    // Exit the function in the builder to clean up state
    this.builder?.exitFunction();

    // Clear generator's function context
    this.context!.currentFunction = null;
    this.context!.currentBlock = null;
  }

  /**
   * Sets up parameter-to-register mappings.
   *
   * Maps each function parameter to its corresponding virtual register.
   * Also records variable mappings for use during expression generation.
   *
   * @param funcDecl - Function declaration
   * @param ilFunc - IL function
   */
  protected setupParameterMappings(funcDecl: FunctionDecl, ilFunc: ILFunction): void {
    const params = funcDecl.getParameters();

    for (let i = 0; i < params.length; i++) {
      const param = params[i];
      const register = ilFunc.getParameterRegister(i);

      if (register) {
        // Look up the symbol for this parameter
        const symbol = this.symbolTable.lookup(param.name);
        if (symbol) {
          // Record the mapping: symbol → register
          this.recordVariableMapping(symbol, register, false);
        }

        // Also record as a local for quick lookup
        this.currentLocals.set(param.name, {
          name: param.name,
          type: this.convertTypeAnnotation(param.typeAnnotation),
          register,
          storageClass: this.getParameterStorageHint(param),
          isConst: false,
        });
      }
    }
  }

  /**
   * Gets the storage class hint for a parameter.
   *
   * Parameters default to RAM unless specified otherwise.
   *
   * @param _param - Parameter definition (unused, reserved for future @zp support)
   * @returns Storage class
   */
  protected getParameterStorageHint(_param: Parameter): ILStorageClass {
    // For now, all parameters default to RAM
    // Future: could support @zp parameters for performance
    return ILStorageClass.Ram;
  }

  /**
   * Processes local variable declarations in a function body.
   *
   * Scans through statements to find variable declarations and
   * creates corresponding registers and mappings.
   *
   * @param body - Function body statements
   * @param ilFunc - IL function
   */
  protected processLocalDeclarations(body: readonly Statement[], ilFunc: ILFunction): void {
    for (const stmt of body) {
      // Check for variable declarations
      if (stmt.getNodeType() === ASTNodeType.VARIABLE_DECL) {
        this.processLocalVariable(stmt as VariableDecl, ilFunc);
      }

      // Check for block statements that might contain declarations
      if (stmt.getNodeType() === ASTNodeType.BLOCK_STMT) {
        const block = stmt as BlockStatement;
        this.processLocalDeclarations(block.getStatements(), ilFunc);
      }

      // Check for control flow statements that contain nested declarations
      this.processNestedDeclarations(stmt, ilFunc);
    }
  }

  /**
   * Processes a local variable declaration.
   *
   * Creates a virtual register for the variable and records
   * the mapping for use during expression generation.
   *
   * @param varDecl - Variable declaration
   * @param ilFunc - IL function
   */
  protected processLocalVariable(varDecl: VariableDecl, ilFunc: ILFunction): void {
    const name = varDecl.getName();
    const typeAnnotation = varDecl.getTypeAnnotation();
    const storageClassToken = varDecl.getStorageClass();
    const isConst = varDecl.isConst();

    // Check for duplicate local
    if (this.currentLocals.has(name)) {
      // Already processed (might be in a nested scope that shadows)
      // For now, just skip - proper scoping handled in semantic analysis
      return;
    }

    // Convert type
    const ilType = typeAnnotation ? this.convertTypeAnnotation(typeAnnotation) : this.inferTypeFromInitializer(varDecl);

    // Convert storage class
    const storageClass = this.convertTokenStorageClass(storageClassToken);

    // Create a register for this local variable
    const register = ilFunc.createRegister(ilType, name);

    // Record the local variable
    this.currentLocals.set(name, {
      name,
      type: ilType,
      register,
      storageClass,
      isConst,
    });

    // Look up symbol and record mapping
    const symbol = this.symbolTable.lookup(name);
    if (symbol) {
      this.recordVariableMapping(symbol, register, false);
    }

    // Apply storage hint to function if it's a special class
    if (storageClass === ILStorageClass.ZeroPage) {
      // Mark this variable for zero-page allocation during code generation
      // This is a hint - the allocator will decide
      ilFunc.setParameterStorageHint(name, storageClass);
    }
  }

  /**
   * Infers the IL type from a variable's initializer.
   *
   * Used when no type annotation is provided.
   *
   * @param varDecl - Variable declaration
   * @returns Inferred IL type (defaults to byte)
   */
  protected inferTypeFromInitializer(varDecl: VariableDecl): ILType {
    const initializer = varDecl.getInitializer();
    if (!initializer) {
      // No initializer and no type annotation - default to byte
      return this.convertTypeAnnotation('byte');
    }

    // Type inference based on initializer would require expression type analysis
    // For now, default to byte - proper type inference handled in semantic analysis
    return this.convertTypeAnnotation('byte');
  }

  /**
   * Processes declarations nested in control flow statements.
   *
   * Handles if/else, while, for statements that may contain
   * variable declarations in their bodies.
   *
   * @param stmt - Statement to check
   * @param ilFunc - IL function
   */
  protected processNestedDeclarations(stmt: Statement, ilFunc: ILFunction): void {
    switch (stmt.getNodeType()) {
      case ASTNodeType.IF_STMT: {
        const ifStmt = stmt as IfStatement;
        this.processLocalDeclarations(ifStmt.getThenBranch(), ilFunc);
        const elseBranch = ifStmt.getElseBranch();
        if (elseBranch) {
          this.processLocalDeclarations(elseBranch, ilFunc);
        }
        break;
      }

      case ASTNodeType.WHILE_STMT: {
        const whileStmt = stmt as WhileStatement;
        this.processLocalDeclarations(whileStmt.getBody(), ilFunc);
        break;
      }

      case ASTNodeType.FOR_STMT: {
        const forStmt = stmt as ForStatement;
        this.processLocalDeclarations(forStmt.getBody(), ilFunc);
        break;
      }

      case ASTNodeType.MATCH_STMT: {
        const matchStmt = stmt as MatchStatement;
        for (const caseClause of matchStmt.getCases()) {
          this.processLocalDeclarations(caseClause.body, ilFunc);
        }
        const defaultCase = matchStmt.getDefaultCase();
        if (defaultCase) {
          this.processLocalDeclarations(defaultCase, ilFunc);
        }
        break;
      }

      // Other statements don't contain nested declarations
      default:
        break;
    }
  }

  // ===========================================================================
  // Statement Generation (Hooks for Subclasses)
  // ===========================================================================

  /**
   * Generates IL for a list of statements.
   *
   * This is a hook for subclasses (ILStatementGenerator) to implement.
   * The base implementation is a no-op.
   *
   * @param _statements - Statements to generate (used by subclasses)
   * @param _ilFunc - Current function (used by subclasses)
   */
  protected generateStatements(
    _statements: readonly Statement[],
    _ilFunc: ILFunction,
  ): void {
    // Hook for subclasses - base implementation does nothing
    // ILStatementGenerator will override this to generate actual statements
  }

  /**
   * Ensures the current block has a terminator.
   *
   * If the function's current block doesn't end with a terminator,
   * adds an implicit return.
   *
   * @param ilFunc - IL function
   */
  protected ensureTerminator(ilFunc: ILFunction): void {
    const currentBlock = this.context?.currentBlock;
    if (!currentBlock) {
      return;
    }

    // Check if block already has a terminator
    if (currentBlock.hasTerminator()) {
      return;
    }

    // Add implicit return for void functions
    if (ilFunc.isVoid()) {
      this.builder?.emitReturnVoid();
    } else {
      // Non-void function without return - error should have been caught in semantic analysis
      // Add a return with undefined value to prevent malformed IR
      this.addWarning(
        `Function '${ilFunc.name}' may not return a value on all paths`,
        this.dummyLocation(),
        'W_MISSING_RETURN',
      );
      // For now, emit a void return - codegen will handle the error
      this.builder?.emitReturnVoid();
    }
  }

  // ===========================================================================
  // Local Variable Access
  // ===========================================================================

  /**
   * Gets information about a local variable.
   *
   * @param name - Variable name
   * @returns Local variable info, or undefined if not found
   */
  protected getLocalVariable(name: string): LocalVariableInfo | undefined {
    return this.currentLocals.get(name);
  }

  /**
   * Checks if a variable is a local in the current function.
   *
   * @param name - Variable name
   * @returns true if the variable is a local
   */
  protected isLocalVariable(name: string): boolean {
    return this.currentLocals.has(name);
  }

  /**
   * Gets the register for a local variable.
   *
   * @param name - Variable name
   * @returns Virtual register, or undefined if not a local
   */
  protected getLocalRegister(name: string): VirtualRegister | undefined {
    return this.currentLocals.get(name)?.register;
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Clears the intrinsic registry.
   *
   * Called at the start of module generation to reset state.
   */
  protected clearIntrinsics(): void {
    this.intrinsics.clear();
  }
}