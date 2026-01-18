/**
 * Alias Analysis (Task 8.8 - Phase 8 Tier 3)
 *
 * Tracks which variables/pointers may refer to the same memory location
 * and detects potential self-modifying code patterns.
 *
 * Uses Andersen's-style points-to analysis (flow-insensitive, context-insensitive)
 * to determine may-alias relationships between variables.
 *
 * **Analysis Only**: Marks alias relationships in metadata for IL optimizer.
 * Does NOT perform transformations - that's the IL optimizer's job.
 */

import type { Program } from '../../ast/nodes.js';
import type { SymbolTable } from '../symbol-table.js';
import type { Diagnostic } from '../../ast/diagnostics.js';
import { DiagnosticSeverity, DiagnosticCode } from '../../ast/diagnostics.js';
import { MemoryRegion, OptimizationMetadataKey } from './optimization-metadata-keys.js';
import type { Symbol } from '../symbol.js';
import { SymbolKind } from '../symbol.js';
import { TokenType } from '../../lexer/types.js';
import { Declaration, Statement, Expression, SourceLocation } from '../../ast/base.js';
import {
  VariableDecl,
  FunctionDecl,
  SimpleMapDecl,
  RangeMapDecl,
  SequentialStructMapDecl,
  ExplicitStructMapDecl,
  AssignmentExpression,
  UnaryExpression,
  IdentifierExpression,
  BinaryExpression,
  LiteralExpression,
  ExpressionStatement,
  IfStatement,
  WhileStatement,
  ForStatement,
  BlockStatement,
  MatchStatement,
} from '../../ast/nodes.js';

/**
 * Memory location representation for alias analysis
 */
interface MemoryLocation {
  /** Symbol being tracked */
  symbol: Symbol;
  
  /** Memory region ($0000-$00FF = ZP, $D000-$DFFF = Hardware, etc.) */
  region: MemoryRegion;
  
  /** Address if known statically (for @map declarations) */
  address?: number;
}

/**
 * Points-to constraint for Andersen's algorithm
 */
interface PointsToConstraint {
  /** Left-hand side symbol name */
  lhs: string;
  
  /** Right-hand side symbol name */
  rhs: string;
  
  /** Constraint type */
  type: 'direct' | 'load' | 'store';
}

/**
 * Code address range for self-modifying code detection
 */
interface CodeAddressRange {
  /** Start address */
  start: number;
  
  /** End address */
  end: number;
  
  /** Description */
  description: string;
}

/**
 * Alias analyzer (Task 8.8)
 *
 * Performs pointer alias analysis to determine which variables
 * may refer to the same memory location. This information enables:
 * - Safe reordering of memory operations
 * - Dead store elimination
 * - Register allocation
 * - Self-modifying code detection
 *
 * Uses Andersen's algorithm:
 * 1. Build points-to constraints from assignments
 * 2. Solve constraints iteratively until fixpoint
 * 3. Build alias sets from points-to information
 * 4. Detect memory region accesses
 * 5. Detect self-modifying code patterns
 *
 * Results stored in AST metadata using OptimizationMetadataKey enum.
 *
 * @example
 * ```typescript
 * const analyzer = new AliasAnalyzer(symbolTable);
 * analyzer.analyze(ast);
 * const diagnostics = analyzer.getDiagnostics();
 * ```
 */
export class AliasAnalyzer {
  /** Diagnostics collected during analysis */
  protected diagnostics: Diagnostic[] = [];

  /** Points-to sets: symbol name → Set<symbol names> */
  protected pointsToSets = new Map<string, Set<string>>();

  /** Points-to constraints to solve */
  protected constraints: PointsToConstraint[] = [];

  /** Memory locations tracked */
  protected memoryLocations = new Map<string, MemoryLocation>();

  /** Typical C64 code address ranges (conservative) */
  protected codeAddressRanges: CodeAddressRange[] = [
    { start: 0x0801, end: 0xCFFF, description: 'BASIC/Program area' },
    { start: 0xE000, end: 0xFFFF, description: 'KERNAL ROM' },
  ];

  /**
   * Creates an alias analyzer
   *
   * @param symbolTable - Symbol table from Pass 1
   */
  constructor(protected readonly symbolTable: SymbolTable) {}

  /**
   * Create a minimal symbol for analysis (when symbol table doesn't have it)
   */
  protected createMinimalSymbol(name: string, kind: SymbolKind, location: SourceLocation): Symbol {
    return {
      name,
      kind,
      declaration: null as any, // Minimal symbol for analysis only
      isExported: false,
      isConst: false,
      scope: null as any, // Not needed for alias analysis
      location,
    };
  }

  /**
   * Run alias analysis on program
   *
   * Steps:
   * 1. Build memory location map
   * 2. Collect points-to constraints
   * 3. Solve constraints (fixpoint)
   * 4. Build alias metadata
   * 5. Detect self-modifying code
   *
   * @param ast - Program AST to analyze
   */
  public analyze(ast: Program): void {
    try {
      // Phase 1: Build memory location map
      this.buildMemoryLocationMap(ast);

      // Phase 2: Collect points-to constraints
      this.collectConstraints(ast);

      // Phase 3: Solve constraints
      this.solveConstraints();

      // Phase 4: Build alias metadata
      this.buildAliasMetadata(ast);

      // Phase 5: Detect self-modifying code
      this.detectSelfModifyingCode(ast);
    } catch (error) {
      this.diagnostics.push({
        code: DiagnosticCode.TYPE_MISMATCH,
        severity: DiagnosticSeverity.ERROR,
        message: `Internal error during alias analysis: ${error instanceof Error ? error.message : String(error)}`,
        location: ast.getLocation(),
      });
    }
  }

  /**
   * Build map of all memory locations in program
   *
   * Identifies:
   * - @map declarations with known addresses
   * - Regular variables with memory regions
   * - Function parameters
   *
   * @param ast - Program AST
   */
  protected buildMemoryLocationMap(ast: Program): void {
    // Walk all declarations
    for (const decl of ast.getDeclarations()) {
      this.processDeclaration(decl);
    }
  }

  /**
   * Process a declaration to extract memory locations
   */
  protected processDeclaration(decl: Declaration): void {
    if (decl instanceof VariableDecl) {
      this.processVariableDecl(decl);
    } else if (decl instanceof SimpleMapDecl) {
      this.processSimpleMapDecl(decl);
    } else if (decl instanceof RangeMapDecl) {
      this.processRangeMapDecl(decl);
    } else if (decl instanceof SequentialStructMapDecl) {
      this.processSequentialStructMapDecl(decl);
    } else if (decl instanceof ExplicitStructMapDecl) {
      this.processExplicitStructMapDecl(decl);
    } else if (decl instanceof FunctionDecl) {
      this.processFunctionDecl(decl);
    }
  }

  /**
   * Process variable declaration
   */
  protected processVariableDecl(decl: VariableDecl): void {
    const name = decl.getName();
    
    // Skip declarations with parsing errors (name === "error")
    if (name === "error" || !name) {
      return;
    }
    
    const storageClass = decl.getStorageClass();
    
    // Determine memory region
    let region = MemoryRegion.RAM; // Default
    if (storageClass === TokenType.ZP) {
      region = MemoryRegion.ZeroPage;
    } else if (storageClass === null || storageClass === undefined) {
      // When storage class is null, check if it might be @zp or another storage class
      // This handles cases where parser doesn't set storage class correctly
      // For now, default to RAM (parser issue needs separate fix)
      region = MemoryRegion.RAM;
    }
    
    // Get or create symbol (analyzer works independently of pre-populated symbol table)
    let symbol = this.symbolTable.lookup(name);
    if (!symbol) {
      // Create a minimal symbol for analysis purposes
      symbol = this.createMinimalSymbol(name, SymbolKind.Variable, decl.getLocation());
    }
    
    this.memoryLocations.set(name, {
      symbol,
      region,
    });
    
    // Initialize points-to set with self-reference (variable points to itself)
    if (!this.pointsToSets.has(name)) {
      this.pointsToSets.set(name, new Set([name]));
    }
  }

  /**
   * Process simple @map declaration
   */
  protected processSimpleMapDecl(decl: SimpleMapDecl): void {
    const name = decl.getName();
    const addressExpr = decl.getAddress();
    
    // Extract address if it's a literal
    const address = this.extractAddress(addressExpr);
    const region = this.determineRegion(address);
    
    let symbol = this.symbolTable.lookup(name);
    if (!symbol) {
      symbol = this.createMinimalSymbol(name, SymbolKind.MapVariable, decl.getLocation());
    }
    
    this.memoryLocations.set(name, {
      symbol,
      region,
      address,
    });
    
    if (!this.pointsToSets.has(name)) {
      this.pointsToSets.set(name, new Set());
    }
  }

  /**
   * Process range @map declaration
   */
  protected processRangeMapDecl(decl: RangeMapDecl): void {
    const name = decl.getName();
    const startExpr = decl.getStartAddress();
    
    const address = this.extractAddress(startExpr);
    const region = this.determineRegion(address);
    
    let symbol = this.symbolTable.lookup(name);
    if (!symbol) {
      symbol = this.createMinimalSymbol(name, SymbolKind.MapVariable, decl.getLocation());
    }
    
    this.memoryLocations.set(name, {
      symbol,
      region,
      address,
    });
    
    if (!this.pointsToSets.has(name)) {
      this.pointsToSets.set(name, new Set());
    }
  }

  /**
   * Process sequential struct @map declaration
   */
  protected processSequentialStructMapDecl(decl: SequentialStructMapDecl): void {
    const name = decl.getName();
    const baseExpr = decl.getBaseAddress();
    
    const address = this.extractAddress(baseExpr);
    const region = this.determineRegion(address);
    
    let symbol = this.symbolTable.lookup(name);
    if (!symbol) {
      symbol = this.createMinimalSymbol(name, SymbolKind.MapVariable, decl.getLocation());
    }
    
    this.memoryLocations.set(name, {
      symbol,
      region,
      address,
    });
    
    if (!this.pointsToSets.has(name)) {
      this.pointsToSets.set(name, new Set());
    }
  }

  /**
   * Process explicit struct @map declaration
   */
  protected processExplicitStructMapDecl(decl: ExplicitStructMapDecl): void {
    const name = decl.getName();
    const baseExpr = decl.getBaseAddress();
    
    const address = this.extractAddress(baseExpr);
    const region = this.determineRegion(address);
    
    let symbol = this.symbolTable.lookup(name);
    if (!symbol) {
      symbol = this.createMinimalSymbol(name, SymbolKind.MapVariable, decl.getLocation());
    }
    
    this.memoryLocations.set(name, {
      symbol,
      region,
      address,
    });
    
    if (!this.pointsToSets.has(name)) {
      this.pointsToSets.set(name, new Set());
    }
  }

  /**
   * Process function declaration (track parameters and local variables)
   */
  protected processFunctionDecl(decl: FunctionDecl): void {
    // Track function parameters as memory locations
    for (const param of decl.getParameters()) {
      let symbol = this.symbolTable.lookup(param.name);
      if (!symbol) {
        symbol = this.createMinimalSymbol(param.name, SymbolKind.Parameter, param.location);
      }
      
      this.memoryLocations.set(param.name, {
        symbol,
        region: MemoryRegion.RAM, // Parameters are typically in RAM
      });
      
      // Initialize points-to set with self-reference (like regular variables)
      if (!this.pointsToSets.has(param.name)) {
        this.pointsToSets.set(param.name, new Set([param.name]));
      }
    }
    
    // Also process local variables in function body
    const body = decl.getBody();
    if (body) {
      for (const stmt of body) {
        if (stmt instanceof VariableDecl) {
          this.processVariableDecl(stmt);
        }
      }
    }
  }

  /**
   * Extract numeric address from expression
   */
  protected extractAddress(expr: Expression): number | undefined {
    if (expr instanceof LiteralExpression) {
      const value = expr.getValue();
      if (typeof value === 'number') {
        return value;
      }
    }
    return undefined;
  }

  /**
   * Determine memory region from address
   */
  protected determineRegion(address: number | undefined): MemoryRegion {
    if (address === undefined) {
      return MemoryRegion.RAM;
    }
    
    // C64 memory map regions
    if (address >= 0x00 && address <= 0xFF) {
      return MemoryRegion.ZeroPage;
    } else if (address >= 0xD000 && address <= 0xDFFF) {
      return MemoryRegion.Hardware;
    } else if (address >= 0xA000 && address <= 0xBFFF) {
      return MemoryRegion.ROM; // BASIC ROM
    } else if (address >= 0xE000 && address <= 0xFFFF) {
      return MemoryRegion.ROM; // KERNAL ROM
    }
    
    return MemoryRegion.RAM;
  }

  /**
   * Collect points-to constraints from program
   *
   * Builds constraints from:
   * - Direct assignments (x = y)
   * - Address-of operations (x = @y)
   * - Pointer dereferences (x = *p)
   * - Store operations (*p = x)
   *
   * @param ast - Program AST
   */
  protected collectConstraints(ast: Program): void {
    // Walk all declarations
    for (const decl of ast.getDeclarations()) {
      this.collectConstraintsFromDeclaration(decl);
    }
  }

  /**
   * Collect constraints from a declaration
   */
  protected collectConstraintsFromDeclaration(decl: Declaration): void {
    if (decl instanceof VariableDecl) {
      // Check initializer for constraints
      const init = decl.getInitializer();
      if (init) {
        this.collectConstraintsFromAssignment(decl.getName(), init);
      }
    } else if (decl instanceof FunctionDecl) {
      // Walk function body
      const body = decl.getBody();
      if (body) {
        for (const stmt of body) {
          this.collectConstraintsFromStatement(stmt);
        }
      }
    }
  }

  /**
   * Collect constraints from a statement
   */
  protected collectConstraintsFromStatement(stmt: Statement): void {
    // Handle variable declarations in function bodies
    if (stmt instanceof VariableDecl) {
      const init = stmt.getInitializer();
      if (init) {
        this.collectConstraintsFromAssignment(stmt.getName(), init);
      }
    } else if (stmt instanceof ExpressionStatement) {
      const expr = stmt.getExpression();
      if (expr instanceof AssignmentExpression) {
        const target = expr.getTarget();
        const value = expr.getValue();
        
        // Extract target variable name
        if (target instanceof IdentifierExpression) {
          this.collectConstraintsFromAssignment(target.getName(), value);
        }
      }
    } else if (stmt instanceof IfStatement) {
      // Walk branches
      for (const s of stmt.getThenBranch()) {
        this.collectConstraintsFromStatement(s);
      }
      const elseBranch = stmt.getElseBranch();
      if (elseBranch) {
        for (const s of elseBranch) {
          this.collectConstraintsFromStatement(s);
        }
      }
    } else if (stmt instanceof WhileStatement) {
      for (const s of stmt.getBody()) {
        this.collectConstraintsFromStatement(s);
      }
    } else if (stmt instanceof ForStatement) {
      for (const s of stmt.getBody()) {
        this.collectConstraintsFromStatement(s);
      }
    } else if (stmt instanceof BlockStatement) {
      for (const s of stmt.getStatements()) {
        this.collectConstraintsFromStatement(s);
      }
    } else if (stmt instanceof MatchStatement) {
      for (const c of stmt.getCases()) {
        for (const s of c.body) {
          this.collectConstraintsFromStatement(s);
        }
      }
      const defaultCase = stmt.getDefaultCase();
      if (defaultCase) {
        for (const s of defaultCase) {
          this.collectConstraintsFromStatement(s);
        }
      }
    }
  }

  /**
   * Collect constraints from an assignment (lhs = rhs)
   */
  protected collectConstraintsFromAssignment(target: string, value: Expression): void {
    if (value instanceof IdentifierExpression) {
      // Direct assignment: x = y
      // Constraint: x points-to y
      this.addConstraint(target, value.getName(), 'direct');
    } else if (value instanceof UnaryExpression && value.getOperator() === TokenType.AT) {
      // Address-of: x = @y
      const operand = value.getOperand();
      if (operand instanceof IdentifierExpression) {
        // Constraint: x points-to y's address
        this.addConstraint(target, operand.getName(), 'direct');
      }
    } else if (value instanceof BinaryExpression) {
      // Binary expression: may reference variables
      this.collectConstraintsFromExpression(target, value);
    }
  }

  /**
   * Collect constraints from an expression
   */
  protected collectConstraintsFromExpression(target: string, expr: Expression): void {
    if (expr instanceof BinaryExpression) {
      const left = expr.getLeft();
      const right = expr.getRight();
      
      // Check if either operand is an identifier
      if (left instanceof IdentifierExpression) {
        this.addConstraint(target, left.getName(), 'direct');
      }
      if (right instanceof IdentifierExpression) {
        this.addConstraint(target, right.getName(), 'direct');
      }
      
      // Recursively check nested expressions
      if (left instanceof BinaryExpression) {
        this.collectConstraintsFromExpression(target, left);
      }
      if (right instanceof BinaryExpression) {
        this.collectConstraintsFromExpression(target, right);
      }
    }
  }

  /**
   * Add points-to constraint
   *
   * @param lhs - Left-hand side symbol name
   * @param rhs - Right-hand side symbol name
   * @param type - Constraint type
   */
  protected addConstraint(lhs: string, rhs: string, type: PointsToConstraint['type']): void {
    this.constraints.push({ lhs, rhs, type });

    // Initialize points-to sets if needed
    if (!this.pointsToSets.has(lhs)) {
      this.pointsToSets.set(lhs, new Set());
    }
    if (!this.pointsToSets.has(rhs)) {
      this.pointsToSets.set(rhs, new Set());
    }
  }

  /**
   * Solve points-to constraints using Andersen's algorithm
   *
   * Iteratively propagates points-to information until fixpoint:
   * 1. For each constraint x ⊇ y, add y's points-to set to x's
   * 2. Repeat until no changes
   *
   * Time complexity: O(n³) worst case (but typically much faster)
   */
  protected solveConstraints(): void {
    let changed = true;
    let iterations = 0;
    const maxIterations = 1000; // Prevent infinite loops

    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;

      for (const constraint of this.constraints) {
        const { lhs, rhs, type } = constraint;

        if (type === 'direct') {
          // Direct constraint: lhs ⊇ rhs
          // Add rhs to lhs points-to set
          const lhsSet = this.pointsToSets.get(lhs);
          const rhsSet = this.pointsToSets.get(rhs);

          if (lhsSet && rhsSet) {
            // Add rhs itself
            if (!lhsSet.has(rhs)) {
              lhsSet.add(rhs);
              changed = true;
            }

            // Propagate rhs's points-to set
            for (const target of rhsSet) {
              if (!lhsSet.has(target)) {
                lhsSet.add(target);
                changed = true;
              }
            }
          }
        }

        // TODO: Handle 'load' and 'store' constraints for pointer dereferences
      }
    }

    if (iterations >= maxIterations) {
      // Warn about potential infinite loop
      this.diagnostics.push({
        code: DiagnosticCode.TYPE_MISMATCH,
        severity: DiagnosticSeverity.WARNING,
        message: 'Alias analysis fixpoint iteration limit reached. Results may be incomplete.',
        location: { 
          start: { offset: 0, line: 1, column: 1 }, 
          end: { offset: 0, line: 1, column: 1 } 
        },
      });
    }
  }

  /**
   * Build alias metadata and attach to AST nodes
   *
   * For each variable:
   * - Set AliasPointsTo metadata (points-to set)
   * - Set AliasNonAliasSet metadata (proven non-aliases)
   * - Set AliasMemoryRegion metadata (memory region)
   *
   * Attaches metadata to:
   * 1. Declarations (for summary information)
   * 2. ALL identifier expressions (for use-site analysis)
   *
   * @param ast - Program AST
   */
  protected buildAliasMetadata(ast: Program): void {
    // Attach metadata to all declarations
    for (const decl of ast.getDeclarations()) {
      this.attachMetadataToDeclaration(decl);
      
      // Also walk declarations to find all identifier expressions
      this.walkDeclarationForIdentifiers(decl);
    }
  }

  /**
   * Attach alias metadata to a declaration
   */
  protected attachMetadataToDeclaration(decl: Declaration): void {
    // Get declaration name
    let name: string | null = null;
    if (decl instanceof VariableDecl) {
      name = decl.getName();
    } else if (decl instanceof SimpleMapDecl || decl instanceof RangeMapDecl ||
               decl instanceof SequentialStructMapDecl || decl instanceof ExplicitStructMapDecl) {
      name = (decl as any).getName();
    }
    
    if (!name) return;
    
    // Attach metadata
    const location = this.memoryLocations.get(name);
    if (location) {
      // Memory region
      if (!decl.metadata) {
        decl.metadata = new Map();
      }
      decl.metadata.set(OptimizationMetadataKey.AliasMemoryRegion, location.region);
      
      // Points-to set
      const pointsTo = this.pointsToSets.get(name);
      if (pointsTo && pointsTo.size > 0) {
        // Convert symbol names to Symbol objects
        const symbolSet = new Set<Symbol>();
        for (const symName of pointsTo) {
          let sym = this.symbolTable.lookup(symName);
          if (!sym) {
            // Create minimal symbol if not in symbol table
            const memLoc = this.memoryLocations.get(symName);
            if (memLoc) {
              sym = memLoc.symbol;
            }
          }
          if (sym) {
            symbolSet.add(sym);
          }
        }
        if (symbolSet.size > 0) {
          decl.metadata.set(OptimizationMetadataKey.AliasPointsTo, symbolSet);
        }
      }
      
      // Non-alias set
      const nonAliasSet = this.computeNonAliasSet(name);
      if (nonAliasSet.size > 0) {
        decl.metadata.set(OptimizationMetadataKey.AliasNonAliasSet, nonAliasSet);
      }
    }
  }

  /**
   * Walk a declaration to find and annotate all identifier expressions
   */
  protected walkDeclarationForIdentifiers(decl: Declaration): void {
    // Walk variable initializers
    if (decl instanceof VariableDecl) {
      const init = decl.getInitializer();
      if (init) {
        this.walkExpressionForIdentifiers(init);
      }
    }
    
    // Walk function bodies
    if (decl instanceof FunctionDecl) {
      const body = decl.getBody();
      if (body) {
        for (const stmt of body) {
          this.walkStatementForIdentifiers(stmt);
        }
      }
    }
    
    // Walk @map address expressions
    if (decl instanceof SimpleMapDecl) {
      this.walkExpressionForIdentifiers(decl.getAddress());
    } else if (decl instanceof RangeMapDecl) {
      this.walkExpressionForIdentifiers(decl.getStartAddress());
      this.walkExpressionForIdentifiers(decl.getEndAddress());
    } else if (decl instanceof SequentialStructMapDecl) {
      this.walkExpressionForIdentifiers(decl.getBaseAddress());
    } else if (decl instanceof ExplicitStructMapDecl) {
      this.walkExpressionForIdentifiers(decl.getBaseAddress());
    }
  }

  /**
   * Walk a statement to find and annotate all identifier expressions
   */
  protected walkStatementForIdentifiers(stmt: Statement): void {
    // Handle variable declarations that appear as statements in function bodies
    if (stmt instanceof VariableDecl) {
      // Attach metadata to this variable declaration
      this.attachMetadataToDeclaration(stmt);
      
      // Walk initializer for identifiers
      const init = stmt.getInitializer();
      if (init) {
        this.walkExpressionForIdentifiers(init);
      }
    } else if (stmt instanceof ExpressionStatement) {
      this.walkExpressionForIdentifiers(stmt.getExpression());
    } else if (stmt instanceof IfStatement) {
      // Walk condition
      this.walkExpressionForIdentifiers(stmt.getCondition());
      
      // Walk branches
      for (const s of stmt.getThenBranch()) {
        this.walkStatementForIdentifiers(s);
      }
      const elseBranch = stmt.getElseBranch();
      if (elseBranch) {
        for (const s of elseBranch) {
          this.walkStatementForIdentifiers(s);
        }
      }
    } else if (stmt instanceof WhileStatement) {
      this.walkExpressionForIdentifiers(stmt.getCondition());
      for (const s of stmt.getBody()) {
        this.walkStatementForIdentifiers(s);
      }
    } else if (stmt instanceof ForStatement) {
      // Walk start and end expressions
      this.walkExpressionForIdentifiers(stmt.getStart());
      this.walkExpressionForIdentifiers(stmt.getEnd());
      
      for (const s of stmt.getBody()) {
        this.walkStatementForIdentifiers(s);
      }
    } else if (stmt instanceof BlockStatement) {
      for (const s of stmt.getStatements()) {
        this.walkStatementForIdentifiers(s);
      }
    } else if (stmt instanceof MatchStatement) {
      this.walkExpressionForIdentifiers(stmt.getValue());
      
      for (const c of stmt.getCases()) {
        for (const s of c.body) {
          this.walkStatementForIdentifiers(s);
        }
      }
      const defaultCase = stmt.getDefaultCase();
      if (defaultCase) {
        for (const s of defaultCase) {
          this.walkStatementForIdentifiers(s);
        }
      }
    }
  }

  /**
   * Walk an expression to find and annotate all identifier expressions
   */
  protected walkExpressionForIdentifiers(expr: Expression): void {
    if (expr instanceof IdentifierExpression) {
      // Attach metadata to this identifier
      this.attachMetadataToIdentifier(expr);
    } else if (expr instanceof UnaryExpression) {
      this.walkExpressionForIdentifiers(expr.getOperand());
    } else if (expr instanceof BinaryExpression) {
      this.walkExpressionForIdentifiers(expr.getLeft());
      this.walkExpressionForIdentifiers(expr.getRight());
    } else if (expr instanceof AssignmentExpression) {
      this.walkExpressionForIdentifiers(expr.getTarget());
      this.walkExpressionForIdentifiers(expr.getValue());
    }
    // Other expression types don't contain identifiers or are handled above
  }

  /**
   * Attach alias metadata to an identifier expression
   */
  protected attachMetadataToIdentifier(identifier: IdentifierExpression): void {
    const name = identifier.getName();
    const location = this.memoryLocations.get(name);
    
    if (location) {
      if (!identifier.metadata) {
        identifier.metadata = new Map();
      }
      
      // Attach memory region
      identifier.metadata.set(OptimizationMetadataKey.AliasMemoryRegion, location.region);
      
      // Attach points-to set
      const pointsTo = this.pointsToSets.get(name);
      if (pointsTo && pointsTo.size > 0) {
        const symbolSet = new Set<Symbol>();
        for (const symName of pointsTo) {
          let sym = this.symbolTable.lookup(symName);
          if (!sym) {
            // Create minimal symbol if not in symbol table
            const memLoc = this.memoryLocations.get(symName);
            if (memLoc) {
              sym = memLoc.symbol;
            }
          }
          if (sym) {
            symbolSet.add(sym);
          }
        }
        if (symbolSet.size > 0) {
          identifier.metadata.set(OptimizationMetadataKey.AliasPointsTo, symbolSet);
        }
      }
      
      // Attach non-alias set
      const nonAliasSet = this.computeNonAliasSet(name);
      if (nonAliasSet.size > 0) {
        identifier.metadata.set(OptimizationMetadataKey.AliasNonAliasSet, nonAliasSet);
      }
    }
  }

  /**
   * Compute non-alias set for a variable
   *
   * Non-alias set contains all variables that definitely don't alias.
   * Two variables don't alias if:
   * - They have different, non-overlapping @map addresses
   * - They are in different memory regions (I/O vs RAM)
   *
   * @param varName - Variable name
   * @returns Set of symbols that don't alias
   */
  protected computeNonAliasSet(varName: string): Set<Symbol> {
    const nonAliasSet = new Set<Symbol>();
    const varLocation = this.memoryLocations.get(varName);

    if (!varLocation) {
      return nonAliasSet;
    }

    for (const [otherName, otherLocation] of this.memoryLocations) {
      if (otherName === varName) {
        continue; // Skip self
      }

      // Check for guaranteed non-aliasing
      if (this.cannotAlias(varLocation, otherLocation)) {
        nonAliasSet.add(otherLocation.symbol);
      }
    }

    return nonAliasSet;
  }

  /**
   * Check if two memory locations cannot alias
   *
   * @param loc1 - First location
   * @param loc2 - Second location
   * @returns True if locations definitely don't alias
   */
  protected cannotAlias(loc1: MemoryLocation, loc2: MemoryLocation): boolean {
    // Different memory regions (Hardware vs RAM) never alias
    if (loc1.region !== loc2.region) {
      return true;
    }

    // Both have known addresses - check for overlap
    if (loc1.address !== undefined && loc2.address !== undefined) {
      // For simplicity, assume byte-sized variables (TODO: handle arrays/structs)
      return loc1.address !== loc2.address;
    }

    // Conservative: may alias
    return false;
  }

  /**
   * Detect potential self-modifying code patterns
   *
   * Warns when code writes to addresses in typical code ranges:
   * - $0801-$CFFF: BASIC/Program area
   * - $E000-$FFFF: KERNAL ROM (can't modify but warn anyway)
   *
   * Self-modifying code breaks optimizations and is dangerous!
   *
   * @param ast - Program AST
   */
  protected detectSelfModifyingCode(ast: Program): void {
    // Check all @map declarations
    for (const decl of ast.getDeclarations()) {
      if (decl instanceof SimpleMapDecl || decl instanceof RangeMapDecl ||
          decl instanceof SequentialStructMapDecl || decl instanceof ExplicitStructMapDecl) {
        const name = (decl as any).getName();
        const location = this.memoryLocations.get(name);
        
        if (location && location.address !== undefined) {
          // Check if address is in code range
          if (this.isCodeAddress(location.address)) {
            const addrHex = `$${location.address.toString(16).toUpperCase().padStart(4, '0')}`;
            this.diagnostics.push({
              code: DiagnosticCode.TYPE_MISMATCH,
              severity: DiagnosticSeverity.WARNING,
              message: `Potential self-modifying code: @map at code address ${addrHex}. This breaks optimizations and may cause crashes.`,
              location: decl.getLocation(),
            });
            
            // Mark in metadata
            if (!decl.metadata) {
              decl.metadata = new Map();
            }
            decl.metadata.set(OptimizationMetadataKey.SelfModifyingCode, true);
          }
        }
      } else if (decl instanceof FunctionDecl) {
        // Check function body for writes to code addresses
        const body = decl.getBody();
        if (body) {
          for (const stmt of body) {
            this.checkStatementForSelfModifyingCode(stmt);
          }
        }
      }
    }
  }

  /**
   * Check a statement for self-modifying code patterns
   */
  protected checkStatementForSelfModifyingCode(stmt: Statement): void {
    if (stmt instanceof ExpressionStatement) {
      const expr = stmt.getExpression();
      if (expr instanceof AssignmentExpression) {
        const target = expr.getTarget();
        
        // Check if target is an identifier that maps to code address
        if (target instanceof IdentifierExpression) {
          const name = target.getName();
          const location = this.memoryLocations.get(name);
          
          if (location && location.address !== undefined && this.isCodeAddress(location.address)) {
            const addrHex = `$${location.address.toString(16).toUpperCase().padStart(4, '0')}`;
            this.diagnostics.push({
              code: DiagnosticCode.TYPE_MISMATCH,
              severity: DiagnosticSeverity.WARNING,
              message: `self-modifying code detected: writing to code address ${addrHex}`,
              location: stmt.getLocation(),
            });
            
            // Mark statement metadata
            if (!stmt.metadata) {
              stmt.metadata = new Map();
            }
            stmt.metadata.set(OptimizationMetadataKey.SelfModifyingCode, true);
          }
        }
      }
    } else if (stmt instanceof IfStatement) {
      for (const s of stmt.getThenBranch()) {
        this.checkStatementForSelfModifyingCode(s);
      }
      const elseBranch = stmt.getElseBranch();
      if (elseBranch) {
        for (const s of elseBranch) {
          this.checkStatementForSelfModifyingCode(s);
        }
      }
    } else if (stmt instanceof WhileStatement) {
      for (const s of stmt.getBody()) {
        this.checkStatementForSelfModifyingCode(s);
      }
    } else if (stmt instanceof ForStatement) {
      for (const s of stmt.getBody()) {
        this.checkStatementForSelfModifyingCode(s);
      }
    } else if (stmt instanceof BlockStatement) {
      for (const s of stmt.getStatements()) {
        this.checkStatementForSelfModifyingCode(s);
      }
    } else if (stmt instanceof MatchStatement) {
      for (const c of stmt.getCases()) {
        for (const s of c.body) {
          this.checkStatementForSelfModifyingCode(s);
        }
      }
      const defaultCase = stmt.getDefaultCase();
      if (defaultCase) {
        for (const s of defaultCase) {
          this.checkStatementForSelfModifyingCode(s);
        }
      }
    }
  }

  /**
   * Check if address is in code range
   */
  protected isCodeAddress(address: number): boolean {
    for (const range of this.codeAddressRanges) {
      if (address >= range.start && address <= range.end) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get all diagnostics generated during analysis
   *
   * @returns Array of diagnostics
   */
  public getDiagnostics(): Diagnostic[] {
    return [...this.diagnostics];
  }
}