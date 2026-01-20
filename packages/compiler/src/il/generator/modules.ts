/**
 * IL Module Generator
 *
 * Generates IL for entire modules (compilation units).
 * Extends ILGeneratorBase to add module-level generation capabilities.
 *
 * Module generation order:
 * 1. Create ILModule
 * 2. Process imports
 * 3. Process global variables
 * 4. Process functions (declarations only first, then bodies)
 * 5. Process exports
 *
 * This layer handles:
 * - Module creation and initialization
 * - Import resolution and registration
 * - Global variable registration
 * - Function stub creation
 * - Export registration
 *
 * Function body generation is handled by subclasses (declaration/statement generators).
 *
 * @module il/generator/modules
 */

import type { ASTNode, Declaration } from '../../ast/base.js';
import type { SymbolTable } from '../../semantic/symbol-table.js';
import type { TargetConfig } from '../../target/config.js';
import type { ILType } from '../types.js';

import {
  Program,
  ImportDecl,
  ExportDecl,
  VariableDecl,
  FunctionDecl,
  TypeDecl,
  EnumDecl,
  SimpleMapDecl,
  RangeMapDecl,
  SequentialStructMapDecl,
  ExplicitStructMapDecl,
  LiteralExpression,
} from '../../ast/nodes.js';
import { ASTNodeType } from '../../ast/base.js';
import { TokenType } from '../../lexer/types.js';
import { ILModule } from '../module.js';
import { ILStorageClass } from '../function.js';
import { IL_VOID, IL_BYTE, IL_WORD } from '../types.js';
import { ILBuilder } from '../builder.js';
import { ILGeneratorBase } from './base.js';

// =============================================================================
// Module Generation Result
// =============================================================================

/**
 * Result of module generation.
 */
export interface ModuleGenerationResult {
  /** The generated IL module */
  readonly module: ILModule;

  /** Whether generation was successful (no errors) */
  readonly success: boolean;
}

// =============================================================================
// ILModuleGenerator Class
// =============================================================================

/**
 * Generates IL for entire modules.
 *
 * This class handles the top-level generation of IL from an AST Program.
 * It processes:
 * - Module declaration
 * - Imports
 * - Global variables and @map declarations
 * - Function declarations (stubs)
 * - Exports
 *
 * Function body generation is delegated to subclass methods that will
 * be implemented in the declaration/statement generator layers.
 *
 * @example
 * ```typescript
 * const generator = new ILModuleGenerator(symbolTable, targetConfig);
 * const result = generator.generateModule(program);
 *
 * if (result.success) {
 *   console.log(result.module.toDetailedString());
 * } else {
 *   console.error(generator.getErrors());
 * }
 * ```
 */
export class ILModuleGenerator extends ILGeneratorBase {
  /**
   * Creates a new module generator.
   *
   * @param symbolTable - Symbol table from semantic analysis
   * @param targetConfig - Optional target configuration
   */
  constructor(symbolTable: SymbolTable, targetConfig: TargetConfig | null = null) {
    super(symbolTable, targetConfig);
  }

  // ===========================================================================
  // Module Generation Entry Point
  // ===========================================================================

  /**
   * Generates IL for a complete program.
   *
   * This is the main entry point for module generation.
   * Processes the entire AST and produces an ILModule.
   *
   * @param program - AST Program node
   * @returns Generation result with module and success status
   */
  public generateModule(program: Program): ModuleGenerationResult {
    // Clear any previous state
    this.clearErrors();
    this.clearVariableMappings();

    // Get module name
    const moduleDecl = program.getModule();
    const moduleName = moduleDecl.getFullName();

    // Create the IL module
    const ilModule = new ILModule(moduleName);

    // Create generation context
    this.context = {
      module: ilModule,
      currentFunction: null,
      currentBlock: null,
      loopStack: [],
    };

    // Create builder
    this.builder = new ILBuilder(ilModule);

    // Process declarations in order
    const declarations = program.getDeclarations();

    // Phase 1: Process imports first (so symbols are available)
    for (const decl of declarations) {
      if (decl.getNodeType() === ASTNodeType.IMPORT_DECL) {
        this.processImport(decl as ImportDecl);
      }
    }

    // Phase 2: Process global variables and @map declarations
    for (const decl of declarations) {
      this.processGlobalDeclaration(decl);
    }

    // Phase 3: Create function stubs (signatures only)
    for (const decl of declarations) {
      if (this.isFunctionDeclaration(decl)) {
        this.createFunctionStub(decl);
      }
    }

    // Phase 4: Generate function bodies
    // This is where subclasses (declaration/statement generators) will
    // provide the actual body generation logic
    for (const decl of declarations) {
      if (this.isFunctionDeclaration(decl)) {
        this.generateFunctionBody(decl);
      }
    }

    // Phase 5: Process exports
    for (const decl of declarations) {
      if (decl.getNodeType() === ASTNodeType.EXPORT_DECL) {
        this.processExport(decl as ExportDecl);
      }
    }

    // Check for entry point
    this.detectEntryPoint(ilModule);

    return {
      module: ilModule,
      success: !this.hasErrors(),
    };
  }

  // ===========================================================================
  // Import Processing
  // ===========================================================================

  /**
   * Processes an import declaration.
   *
   * Creates ILImport entries for each imported symbol.
   *
   * @param importDecl - Import declaration AST node
   */
  protected processImport(importDecl: ImportDecl): void {
    const modulePath = importDecl.getModuleName();
    const identifiers = importDecl.getIdentifiers();
    const isWildcard = importDecl.isWildcardImport();

    if (isWildcard) {
      // Wildcard import: import * from module
      // For now, we record it but actual resolution requires the module registry
      this.context!.module.createImport('*', '*', modulePath, false);
    } else {
      // Named imports: import foo, bar from module
      for (const name of identifiers) {
        this.context!.module.createImport(name, name, modulePath, false);
      }
    }
  }

  // ===========================================================================
  // Global Declaration Processing
  // ===========================================================================

  /**
   * Processes a global-level declaration.
   *
   * Routes to specific handlers based on declaration type.
   * Skips imports and exports (handled separately).
   *
   * @param decl - Declaration AST node
   */
  protected processGlobalDeclaration(decl: Declaration): void {
    switch (decl.getNodeType()) {
      case ASTNodeType.VARIABLE_DECL:
        this.processGlobalVariable(decl as VariableDecl);
        break;

      case ASTNodeType.SIMPLE_MAP_DECL:
        this.processSimpleMapDecl(decl as SimpleMapDecl);
        break;

      case ASTNodeType.RANGE_MAP_DECL:
        this.processRangeMapDecl(decl as RangeMapDecl);
        break;

      case ASTNodeType.SEQUENTIAL_STRUCT_MAP_DECL:
        this.processSequentialStructMapDecl(decl as SequentialStructMapDecl);
        break;

      case ASTNodeType.EXPLICIT_STRUCT_MAP_DECL:
        this.processExplicitStructMapDecl(decl as ExplicitStructMapDecl);
        break;

      case ASTNodeType.TYPE_DECL:
        // Type declarations don't generate IL (compile-time only)
        break;

      case ASTNodeType.ENUM_DECL:
        this.processEnumDecl(decl as EnumDecl);
        break;

      // Skip imports, exports, and functions (handled separately)
      case ASTNodeType.IMPORT_DECL:
      case ASTNodeType.EXPORT_DECL:
      case ASTNodeType.FUNCTION_DECL:
        break;

      default:
        // Unknown declaration type - should not happen with valid AST
        break;
    }
  }

  /**
   * Processes a global variable declaration.
   *
   * Creates an ILGlobalVariable in the module.
   *
   * @param varDecl - Variable declaration AST node
   */
  protected processGlobalVariable(varDecl: VariableDecl): void {
    const name = varDecl.getName();
    const typeAnnotation = varDecl.getTypeAnnotation();
    const storageClassToken = varDecl.getStorageClass();
    const initializer = varDecl.getInitializer();
    const isConst = varDecl.isConst();
    const isExported = varDecl.isExportedVariable();

    // Convert type
    const ilType = typeAnnotation
      ? this.convertTypeAnnotation(typeAnnotation)
      : IL_BYTE; // Default to byte

    // Convert storage class
    const storageClass = this.convertTokenStorageClass(storageClassToken);

    // Extract initial value if it's a literal
    let initialValue: number | number[] | undefined;
    if (initializer && initializer.getNodeType() === ASTNodeType.LITERAL_EXPR) {
      const literal = initializer as LiteralExpression;
      const value = literal.getValue();
      if (typeof value === 'number') {
        initialValue = value;
      } else if (typeof value === 'boolean') {
        initialValue = value ? 1 : 0;
      }
    }

    // Create the global variable
    this.context!.module.createGlobal(name, ilType, storageClass, {
      initialValue,
      isExported,
      isConstant: isConst,
    });

    // Record mapping for later use
    const symbol = this.symbolTable.lookup(name);
    if (symbol) {
      this.recordVariableMapping(symbol, undefined, true);
    }
  }

  /**
   * Processes a simple @map declaration.
   *
   * @map borderColor at $D020: byte;
   *
   * @param mapDecl - Simple map declaration AST node
   */
  protected processSimpleMapDecl(mapDecl: SimpleMapDecl): void {
    const name = mapDecl.getName();
    const typeAnnotation = mapDecl.getTypeAnnotation();
    const addressExpr = mapDecl.getAddress();

    // Get the address (must be a constant)
    const address = this.evaluateConstantExpression(addressExpr);
    if (address === null) {
      this.addError(
        `@map address must be a constant expression`,
        mapDecl.getLocation(),
        'E_MAP_ADDRESS',
      );
      return;
    }

    // Convert type
    const ilType = this.convertTypeAnnotation(typeAnnotation);

    // Create the global with Map storage class and fixed address
    this.context!.module.createGlobal(name, ilType, ILStorageClass.Map, {
      address,
      isExported: false,
      isConstant: false,
    });

    // Record mapping
    const symbol = this.symbolTable.lookup(name);
    if (symbol) {
      this.recordVariableMapping(symbol, undefined, true, address);
    }
  }

  /**
   * Processes a range @map declaration.
   *
   * @map spriteRegs from $D000 to $D02E: byte;
   *
   * @param mapDecl - Range map declaration AST node
   */
  protected processRangeMapDecl(mapDecl: RangeMapDecl): void {
    const name = mapDecl.getName();
    const typeAnnotation = mapDecl.getTypeAnnotation();
    const startExpr = mapDecl.getStartAddress();
    const endExpr = mapDecl.getEndAddress();

    // Get addresses
    const startAddr = this.evaluateConstantExpression(startExpr);
    const endAddr = this.evaluateConstantExpression(endExpr);

    if (startAddr === null || endAddr === null) {
      this.addError(
        `@map range addresses must be constant expressions`,
        mapDecl.getLocation(),
        'E_MAP_RANGE_ADDRESS',
      );
      return;
    }

    // Calculate array size
    const elementType = this.convertTypeAnnotation(typeAnnotation);
    const elementSize = elementType.sizeInBytes;
    const size = Math.floor((endAddr - startAddr + 1) / elementSize);

    // Create as an array type with Map storage
    const arrayType = this.convertTypeAnnotation(`${typeAnnotation}[${size}]`);

    this.context!.module.createGlobal(name, arrayType, ILStorageClass.Map, {
      address: startAddr,
      isExported: false,
      isConstant: false,
    });

    // Record mapping
    const symbol = this.symbolTable.lookup(name);
    if (symbol) {
      this.recordVariableMapping(symbol, undefined, true, startAddr);
    }
  }

  /**
   * Processes a sequential struct @map declaration.
   *
   * @map sid at $D400 type ... end @map
   *
   * @param mapDecl - Sequential struct map declaration AST node
   */
  protected processSequentialStructMapDecl(mapDecl: SequentialStructMapDecl): void {
    const name = mapDecl.getName();
    const baseExpr = mapDecl.getBaseAddress();
    const fields = mapDecl.getFields();

    // Get base address
    const baseAddr = this.evaluateConstantExpression(baseExpr);
    if (baseAddr === null) {
      this.addError(
        `@map base address must be a constant expression`,
        mapDecl.getLocation(),
        'E_MAP_BASE_ADDRESS',
      );
      return;
    }

    // Process each field with sequential layout
    let currentOffset = 0;
    for (const field of fields) {
      const fieldName = `${name}.${field.name}`;
      const fieldType = this.convertTypeAnnotation(field.baseType);

      // Handle array fields
      let finalType: ILType;
      let fieldSize: number;
      if (field.arraySize !== null) {
        finalType = this.convertTypeAnnotation(`${field.baseType}[${field.arraySize}]`);
        fieldSize = fieldType.sizeInBytes * field.arraySize;
      } else {
        finalType = fieldType;
        fieldSize = fieldType.sizeInBytes;
      }

      // Create global for this field
      const fieldAddr = baseAddr + currentOffset;
      this.context!.module.createGlobal(fieldName, finalType, ILStorageClass.Map, {
        address: fieldAddr,
        isExported: false,
        isConstant: false,
      });

      currentOffset += fieldSize;
    }

    // Also create a "pseudo-global" for the struct itself
    // This allows accessing `sid` as a base reference
    this.context!.module.createGlobal(name, IL_WORD, ILStorageClass.Map, {
      address: baseAddr,
      isExported: false,
      isConstant: true, // The address itself is constant
    });
  }

  /**
   * Processes an explicit struct @map declaration.
   *
   * @map vic at $D000 layout ... end @map
   *
   * @param mapDecl - Explicit struct map declaration AST node
   */
  protected processExplicitStructMapDecl(mapDecl: ExplicitStructMapDecl): void {
    const name = mapDecl.getName();
    const baseExpr = mapDecl.getBaseAddress();
    const fields = mapDecl.getFields();

    // Get base address
    const baseAddr = this.evaluateConstantExpression(baseExpr);
    if (baseAddr === null) {
      this.addError(
        `@map base address must be a constant expression`,
        mapDecl.getLocation(),
        'E_MAP_BASE_ADDRESS',
      );
      return;
    }

    // Process each field with explicit addresses
    for (const field of fields) {
      const fieldName = `${name}.${field.name}`;
      const fieldType = this.convertTypeAnnotation(field.typeAnnotation);

      if (field.addressSpec.kind === 'single') {
        // Single address: field at $offset
        const offset = this.evaluateConstantExpression(field.addressSpec.address);
        if (offset === null) {
          this.addError(
            `Field address must be a constant expression`,
            field.location,
            'E_FIELD_ADDRESS',
          );
          continue;
        }

        const fieldAddr = baseAddr + offset;
        this.context!.module.createGlobal(fieldName, fieldType, ILStorageClass.Map, {
          address: fieldAddr,
          isExported: false,
          isConstant: false,
        });
      } else {
        // Range address: field from $start to $end
        const startOffset = this.evaluateConstantExpression(field.addressSpec.startAddress);
        const endOffset = this.evaluateConstantExpression(field.addressSpec.endAddress);

        if (startOffset === null || endOffset === null) {
          this.addError(
            `Field range addresses must be constant expressions`,
            field.location,
            'E_FIELD_RANGE_ADDRESS',
          );
          continue;
        }

        const elementSize = fieldType.sizeInBytes;
        const size = Math.floor((endOffset - startOffset + 1) / elementSize);
        const arrayType = this.convertTypeAnnotation(`${field.typeAnnotation}[${size}]`);
        const fieldAddr = baseAddr + startOffset;

        this.context!.module.createGlobal(fieldName, arrayType, ILStorageClass.Map, {
          address: fieldAddr,
          isExported: false,
          isConstant: false,
        });
      }
    }

    // Create base reference
    this.context!.module.createGlobal(name, IL_WORD, ILStorageClass.Map, {
      address: baseAddr,
      isExported: false,
      isConstant: true,
    });
  }

  /**
   * Processes an enum declaration.
   *
   * Enums generate constants for each member.
   *
   * @param enumDecl - Enum declaration AST node
   */
  protected processEnumDecl(enumDecl: EnumDecl): void {
    const enumName = enumDecl.getName();
    const members = enumDecl.getMembers();
    const isExported = enumDecl.isExportedEnum();

    let currentValue = 0;
    for (const member of members) {
      const memberName = `${enumName}.${member.name}`;

      // Use explicit value or auto-increment
      if (member.value !== null) {
        currentValue = member.value;
      }

      // Create constant global for this enum member
      // Use byte for values 0-255, word for larger
      const ilType = currentValue > 255 ? IL_WORD : IL_BYTE;

      this.context!.module.createGlobal(memberName, ilType, ILStorageClass.Data, {
        initialValue: currentValue,
        isExported,
        isConstant: true,
      });

      currentValue++;
    }
  }

  // ===========================================================================
  // Function Processing
  // ===========================================================================

  /**
   * Checks if a declaration is a function declaration.
   *
   * Handles both regular function declarations and exported functions.
   *
   * @param decl - Declaration to check
   * @returns true if it's a function declaration
   */
  protected isFunctionDeclaration(decl: Declaration): boolean {
    const nodeType = decl.getNodeType();

    if (nodeType === ASTNodeType.FUNCTION_DECL) {
      return true;
    }

    if (nodeType === ASTNodeType.EXPORT_DECL) {
      const exportDecl = decl as ExportDecl;
      const innerDecl = exportDecl.getDeclaration();
      return innerDecl.getNodeType() === ASTNodeType.FUNCTION_DECL;
    }

    return false;
  }

  /**
   * Gets the function declaration from a declaration node.
   *
   * Unwraps export declarations if necessary.
   *
   * @param decl - Declaration node
   * @returns Function declaration, or null if not a function
   */
  protected getFunctionDecl(decl: Declaration): FunctionDecl | null {
    if (decl.getNodeType() === ASTNodeType.FUNCTION_DECL) {
      return decl as FunctionDecl;
    }

    if (decl.getNodeType() === ASTNodeType.EXPORT_DECL) {
      const exportDecl = decl as ExportDecl;
      const innerDecl = exportDecl.getDeclaration();
      if (innerDecl.getNodeType() === ASTNodeType.FUNCTION_DECL) {
        return innerDecl as FunctionDecl;
      }
    }

    return null;
  }

  /**
   * Creates a function stub (signature only, no body).
   *
   * This allows all functions to be known before generating bodies,
   * enabling forward references and mutual recursion.
   *
   * @param decl - Declaration containing a function
   */
  protected createFunctionStub(decl: Declaration): void {
    const funcDecl = this.getFunctionDecl(decl);
    if (!funcDecl) {
      return;
    }

    const name = funcDecl.getName();
    const params = funcDecl.getParameters();
    const returnTypeStr = funcDecl.getReturnType();
    const isExported =
      funcDecl.isExportedFunction() || decl.getNodeType() === ASTNodeType.EXPORT_DECL;
    const isStub = funcDecl.isStubFunction();

    // Convert return type
    const returnType = returnTypeStr ? this.convertTypeAnnotation(returnTypeStr) : IL_VOID;

    // Convert parameters
    const ilParams = params.map((p) => ({
      name: p.name,
      type: this.convertTypeAnnotation(p.typeAnnotation),
    }));

    // Create the function in the module
    const ilFunc = this.context!.module.createFunction(name, ilParams, returnType);

    // Mark as exported if needed
    if (isExported) {
      ilFunc.setExported(true);
    }

    // Stub functions get a minimal body with just a return
    // Note: Stub functions don't have AST bodies, so we generate a placeholder
    // The actual implementation would come from external linking
    if (isStub) {
      // Stub functions are marked but don't have generated bodies yet
      // They will be resolved at link time
    }
  }

  /**
   * Generates the body for a function.
   *
   * This is a hook for subclasses to implement actual body generation.
   * The base implementation does nothing for non-stub functions.
   *
   * Subclasses should override this method to implement actual body generation
   * using the AST function body.
   *
   * @param decl - Declaration containing a function
   */
  protected generateFunctionBody(decl: Declaration): void {
    const funcDecl = this.getFunctionDecl(decl);
    if (!funcDecl || funcDecl.isStubFunction()) {
      return; // Stubs don't have bodies to generate
    }

    // Base implementation is a no-op
    // Subclasses (DeclarationGenerator, StatementGenerator) will override this
    // to generate actual function bodies from the AST

    // Note: The function already exists in the module (created in createFunctionStub)
    // The entry block is already created by the ILFunction constructor
    // Subclasses will add instructions to the function's blocks
  }

  // ===========================================================================
  // Export Processing
  // ===========================================================================

  /**
   * Processes an export declaration.
   *
   * Registers exports in the IL module.
   *
   * @param exportDecl - Export declaration AST node
   */
  protected processExport(exportDecl: ExportDecl): void {
    const innerDecl = exportDecl.getDeclaration();
    const nodeType = innerDecl.getNodeType();

    switch (nodeType) {
      case ASTNodeType.FUNCTION_DECL: {
        const funcDecl = innerDecl as FunctionDecl;
        const name = funcDecl.getName();
        this.context!.module.createExport(name, name, 'function');
        break;
      }

      case ASTNodeType.VARIABLE_DECL: {
        const varDecl = innerDecl as VariableDecl;
        const name = varDecl.getName();
        this.context!.module.createExport(name, name, 'variable');
        break;
      }

      case ASTNodeType.TYPE_DECL: {
        const typeDecl = innerDecl as TypeDecl;
        const name = typeDecl.getName();
        this.context!.module.createExport(name, name, 'type');
        break;
      }

      default:
        // Other declaration types
        break;
    }
  }

  // ===========================================================================
  // Entry Point Detection
  // ===========================================================================

  /**
   * Detects and sets the entry point function.
   *
   * Looks for a function named 'main' or marked as entry point.
   *
   * @param module - IL module to check
   */
  protected detectEntryPoint(module: ILModule): void {
    // Check for a function named 'main'
    if (module.hasFunction('main')) {
      module.setEntryPoint('main');
      return;
    }

    // Could also check for metadata or attributes indicating entry point
    // For now, we only support 'main' as the entry point name
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Converts a token storage class to IL storage class.
   *
   * @param tokenType - Storage class token type (or null)
   * @returns IL storage class
   */
  protected convertTokenStorageClass(tokenType: TokenType | null): ILStorageClass {
    if (!tokenType) {
      return ILStorageClass.Ram;
    }

    switch (tokenType) {
      case TokenType.ZP:
        return ILStorageClass.ZeroPage;
      case TokenType.RAM:
        return ILStorageClass.Ram;
      case TokenType.DATA:
        return ILStorageClass.Data;
      case TokenType.MAP:
        return ILStorageClass.Map;
      default:
        return ILStorageClass.Ram;
    }
  }

  /**
   * Evaluates a constant expression to a number.
   *
   * For now, only handles literal numbers.
   * Full constant expression evaluation would be implemented
   * in a constant folding pass.
   *
   * @param expr - Expression to evaluate
   * @returns Number value, or null if not constant
   */
  protected evaluateConstantExpression(expr: ASTNode): number | null {
    if (expr.getNodeType() === ASTNodeType.LITERAL_EXPR) {
      const literal = expr as LiteralExpression;
      const value = literal.getValue();
      if (typeof value === 'number') {
        return value;
      }
      if (typeof value === 'boolean') {
        return value ? 1 : 0;
      }
    }

    // For binary expressions with constants, we could evaluate them
    // but that's better handled by a constant folding pass
    return null;
  }
}