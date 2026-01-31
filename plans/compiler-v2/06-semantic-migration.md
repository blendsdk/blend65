# Semantic Analyzer: Compiler v2

> **Document**: 06-semantic-migration.md  
> **Parent**: [Index](00-index.md)  
> **Status**: Planning Complete  
> **Approach**: Write From Scratch (SFA-Optimized, Production Quality)

## Overview

The semantic analyzer performs type checking, symbol resolution, and validation after parsing. For v2, we build a **production-quality semantic analyzer from scratch** specifically designed for Static Frame Allocation (SFA).

**Key Design Principles:**
1. **SFA-First Design** - No SSA preparation, no PHI nodes, variables have fixed addresses
2. **Production Quality** - Full multi-module support, comprehensive analysis passes
3. **Recursion Detection** - Compile-time error for recursive functions (SFA requirement)
4. **V1 as Reference** - Use V1 algorithms as documentation, not migration source

---

## Architecture Overview

```
packages/compiler-v2/src/semantic/
├── Core Foundation
│   ├── types.ts                    # Type system types (exists)
│   ├── symbol.ts                   # Symbol class
│   ├── scope.ts                    # Scope class
│   ├── symbol-table.ts             # Symbol table with scope management
│   └── type-system.ts              # Type checking utilities
│
├── Multi-Module Support
│   ├── module-registry.ts          # Module tracking
│   ├── dependency-graph.ts         # Import dependency graph
│   ├── import-resolver.ts          # Cross-module symbol resolution
│   └── global-symbol-table.ts      # Aggregated exports
│
├── Type Checking (Inheritance Chain)
│   └── visitors/
│       ├── symbol-table-builder.ts # Pass 1: Collect declarations
│       ├── type-resolver.ts        # Pass 2: Resolve type annotations
│       ├── control-flow-analyzer.ts # Pass 5: CFG building
│       └── type-checker/
│           ├── base.ts             # Base type checker utilities
│           ├── literals.ts         # Literal type checking
│           ├── expressions.ts      # Expression type checking
│           ├── declarations.ts     # Declaration validation
│           ├── statements.ts       # Statement validation
│           └── type-checker.ts     # Final concrete class
│
├── SFA-Specific Analysis
│   ├── call-graph.ts               # Function call graph
│   ├── recursion-checker.ts        # Recursion detection (compile error)
│   └── frame-analysis.ts           # Frame size estimation
│
├── Advanced Analysis
│   └── analysis/
│       ├── definite-assignment.ts  # Uninitialized variable detection
│       ├── variable-usage.ts       # Unused variable warnings
│       ├── dead-code.ts            # Unreachable code detection
│       ├── liveness.ts             # Live variable analysis
│       ├── purity-analysis.ts      # Function side-effect tracking
│       ├── loop-analysis.ts        # Loop optimization hints
│       ├── m6502-hints.ts          # Hardware-specific hints
│       └── advanced-analyzer.ts    # Orchestrates all analysis passes
│
└── Main Entry
    ├── analyzer.ts                 # Multi-pass orchestrator
    └── index.ts                    # Public exports
```

---

## Multi-Pass Pipeline

The semantic analyzer runs multiple passes in sequence:

```
AST (from Parser)
 │
 ▼
┌──────────────────────────────────┐
│ Pass 1: Symbol Table Builder      │  Register all declarations
│         (symbol-table-builder.ts) │  Build scope tree
└──────────────────────────────────┘
 │
 ▼
┌──────────────────────────────────┐
│ Pass 2: Type Resolution           │  Resolve type annotations
│         (type-resolver.ts)        │  Annotate symbols with types
└──────────────────────────────────┘
 │
 ▼
┌──────────────────────────────────┐
│ Pass 3: Type Checking             │  Type check expressions
│         (type-checker/)           │  Validate assignments
│                                   │  Check function calls
└──────────────────────────────────┘
 │
 ▼
┌──────────────────────────────────┐
│ Pass 4: Statement Validation      │  Control flow validation
│         (integrated in Pass 3)    │  break/continue/return checks
└──────────────────────────────────┘
 │
 ▼
┌──────────────────────────────────┐
│ Pass 5: Control Flow Analysis     │  Build CFGs
│         (control-flow-analyzer.ts)│  Dead code detection
└──────────────────────────────────┘
 │
 ▼
┌──────────────────────────────────┐
│ Pass 6: Call Graph & Recursion    │  Build function call graph
│         (call-graph.ts)           │  DETECT RECURSION (SFA error)
│         (recursion-checker.ts)    │  
└──────────────────────────────────┘
 │
 ▼
┌──────────────────────────────────┐
│ Pass 7: Advanced Analysis         │  Definite assignment
│         (advanced-analyzer.ts)    │  Variable usage
│                                   │  Liveness, purity, loops
│                                   │  6502 optimization hints
└──────────────────────────────────┘
 │
 ▼
Typed AST + Symbol Table + Call Graph + Diagnostics
```

---

## Component Specifications

### 1. Core Foundation

#### 1.1 Symbol Class (`symbol.ts`)

```typescript
/**
 * Symbol kinds in the Blend65 type system
 */
export enum SymbolKind {
  Variable = 'variable',
  Parameter = 'parameter',
  Function = 'function',
  ImportedSymbol = 'imported',
  Constant = 'constant',
  EnumMember = 'enum_member',
}

/**
 * Symbol represents a declared identifier in the program
 */
export interface Symbol {
  /** Symbol name */
  name: string;
  
  /** Symbol kind */
  kind: SymbolKind;
  
  /** Type information (resolved in Pass 2) */
  type: TypeInfo | null;
  
  /** Source location of declaration */
  location: SourceLocation;
  
  /** Scope where symbol is declared */
  scope: Scope;
  
  /** Is this symbol exported? */
  isExported: boolean;
  
  /** Is this symbol const? */
  isConst: boolean;
  
  /** For variables: initial value expression */
  initializer?: Expression;
  
  /** For functions: parameter symbols */
  parameters?: Symbol[];
  
  /** For imported symbols: source module */
  sourceModule?: string;
  
  /** Usage tracking metadata */
  metadata?: Map<string, unknown>;
}
```

#### 1.2 Scope Class (`scope.ts`)

```typescript
/**
 * Scope kinds
 */
export enum ScopeKind {
  Module = 'module',
  Function = 'function',
  Block = 'block',
}

/**
 * Scope represents a lexical scope in the program
 */
export interface Scope {
  /** Unique scope identifier */
  id: string;
  
  /** Scope kind */
  kind: ScopeKind;
  
  /** Parent scope (null for module scope) */
  parent: Scope | null;
  
  /** Child scopes */
  children: Scope[];
  
  /** Symbols declared in this scope */
  symbols: Map<string, Symbol>;
  
  /** AST node that created this scope */
  node: ASTNode | null;
  
  /** For function scopes: the function symbol */
  functionSymbol?: Symbol;
}
```

#### 1.3 Symbol Table (`symbol-table.ts`)

```typescript
/**
 * Symbol table manages all scopes and symbols
 * 
 * Operations:
 * - createScope(kind, parent, node): Create new scope
 * - enterScope(scope): Set current scope
 * - exitScope(): Return to parent scope
 * - declare(symbol): Add symbol to current scope
 * - lookup(name): Find symbol in scope chain
 * - lookupLocal(name): Find symbol in current scope only
 */
export class SymbolTable {
  protected rootScope: Scope;
  protected currentScope: Scope;
  protected scopes: Map<string, Scope>;
  protected scopeCounter: number;
  
  // Methods...
}
```

#### 1.4 Type System (`type-system.ts`)

```typescript
/**
 * Type system utilities for type checking
 * 
 * Features:
 * - Built-in types (byte, word, bool, void, string)
 * - Array type creation
 * - Function type creation
 * - Type compatibility checking
 * - Binary/unary operation result types
 */
export class TypeSystem {
  protected builtinTypes: Map<string, TypeInfo>;
  protected compatibilityCache: Map<number, TypeCompatibility>;
  
  getBuiltinType(name: string): TypeInfo | undefined;
  createArrayType(elementType: TypeInfo, size?: number): TypeInfo;
  createFunctionType(params: TypeInfo[], returnType: TypeInfo): TypeInfo;
  checkCompatibility(from: TypeInfo, to: TypeInfo): TypeCompatibility;
  canAssign(from: TypeInfo, to: TypeInfo): boolean;
  getBinaryOperationType(left: TypeInfo, right: TypeInfo, op: string): TypeInfo;
  getUnaryOperationType(operand: TypeInfo, op: string): TypeInfo;
}
```

---

### 2. Multi-Module Support

#### 2.1 Module Registry (`module-registry.ts`)

```typescript
/**
 * Tracks all modules in a multi-module compilation
 */
export class ModuleRegistry {
  protected modules: Map<string, Program>;
  protected dependencies: Map<string, Set<string>>;
  
  register(name: string, program: Program): void;
  getModule(name: string): Program | undefined;
  hasModule(name: string): boolean;
  addDependency(from: string, to: string): void;
  getDependencies(moduleName: string): Set<string>;
  getAllModuleNames(): string[];
}
```

#### 2.2 Dependency Graph (`dependency-graph.ts`)

```typescript
/**
 * Import dependency graph with cycle detection
 */
export class DependencyGraph {
  protected nodes: Set<string>;
  protected edges: Map<string, Set<string>>;
  protected edgeLocations: Map<string, SourceLocation>;
  
  addNode(moduleName: string): void;
  addEdge(from: string, to: string, location: SourceLocation): void;
  detectCycles(): string[][];  // Returns array of cycles
  getTopologicalOrder(): string[];  // Compilation order
  getDependents(moduleName: string): Set<string>;
}
```

#### 2.3 Import Resolver (`import-resolver.ts`)

```typescript
/**
 * Resolves cross-module imports
 */
export class ImportResolver {
  constructor(protected registry: ModuleRegistry) {}
  
  validateAllImports(programs: Program[]): Diagnostic[];
  resolveImport(
    importDecl: ImportDeclaration,
    globalSymbols: GlobalSymbolTable
  ): Symbol | Diagnostic;
}
```

#### 2.4 Global Symbol Table (`global-symbol-table.ts`)

```typescript
/**
 * Aggregates exported symbols from all modules
 */
export class GlobalSymbolTable {
  protected moduleSymbols: Map<string, SymbolTable>;
  protected exportedSymbols: Map<string, Map<string, Symbol>>;
  
  registerModule(moduleName: string, symbolTable: SymbolTable): void;
  lookupInModule(symbolName: string, moduleName: string): Symbol | undefined;
  getAllExports(moduleName: string): Symbol[];
}
```

---

### 3. Type Checker (Inheritance Chain)

Per `.clinerules/code.md` Rules 17-20, the type checker uses an inheritance chain architecture for AI context management:

```
TypeCheckerBase (200-300 lines)
    │
    ▼
LiteralTypeChecker extends Base (150-200 lines)
    │
    ▼
ExpressionTypeChecker extends Literal (300-400 lines)
    │
    ▼
DeclarationTypeChecker extends Expression (200-300 lines)
    │
    ▼
StatementTypeChecker extends Declaration (200-300 lines)
    │
    ▼
TypeChecker extends Statement (100-200 lines) - Final concrete class
```

#### 3.1 TypeCheckerBase (`type-checker/base.ts`)

```typescript
/**
 * Base type checker with core utilities
 */
export abstract class TypeCheckerBase implements ASTVisitor<TypeInfo> {
  protected symbolTable: SymbolTable;
  protected typeSystem: TypeSystem;
  protected diagnostics: Diagnostic[];
  protected currentFunction: Symbol | null;
  
  // Core utilities
  protected addError(code: DiagnosticCode, message: string, location: SourceLocation): void;
  protected addWarning(code: DiagnosticCode, message: string, location: SourceLocation): void;
  protected lookupSymbol(name: string): Symbol | undefined;
  protected checkTypeCompatibility(from: TypeInfo, to: TypeInfo, location: SourceLocation): boolean;
  
  // Abstract methods for subclasses
  abstract visitLiteralExpression(node: LiteralExpression): TypeInfo;
  abstract visitBinaryExpression(node: BinaryExpression): TypeInfo;
  // ... other abstract methods
}
```

#### 3.2 LiteralTypeChecker (`type-checker/literals.ts`)

```typescript
/**
 * Type checking for literals
 */
export abstract class LiteralTypeChecker extends TypeCheckerBase {
  visitLiteralExpression(node: LiteralExpression): TypeInfo {
    const value = node.getValue();
    
    if (typeof value === 'number') {
      // Determine byte vs word based on value range
      return value <= 255
        ? this.typeSystem.getBuiltinType('byte')!
        : this.typeSystem.getBuiltinType('word')!;
    }
    
    if (typeof value === 'boolean') {
      return this.typeSystem.getBuiltinType('bool')!;
    }
    
    if (typeof value === 'string') {
      return this.typeSystem.getBuiltinType('string')!;
    }
    
    return BUILTIN_TYPES.UNKNOWN;
  }
  
  visitArrayLiteralExpression(node: ArrayLiteralExpression): TypeInfo;
}
```

#### 3.3 ExpressionTypeChecker (`type-checker/expressions.ts`)

```typescript
/**
 * Type checking for expressions
 */
export abstract class ExpressionTypeChecker extends LiteralTypeChecker {
  visitIdentifierExpression(node: IdentifierExpression): TypeInfo;
  visitBinaryExpression(node: BinaryExpression): TypeInfo;
  visitUnaryExpression(node: UnaryExpression): TypeInfo;
  visitCallExpression(node: CallExpression): TypeInfo;
  visitIndexExpression(node: IndexExpression): TypeInfo;
  visitMemberExpression(node: MemberExpression): TypeInfo;
  visitTernaryExpression(node: TernaryExpression): TypeInfo;
  visitAssignmentExpression(node: AssignmentExpression): TypeInfo;
}
```

#### 3.4 DeclarationTypeChecker (`type-checker/declarations.ts`)

```typescript
/**
 * Type checking for declarations
 */
export abstract class DeclarationTypeChecker extends ExpressionTypeChecker {
  visitVariableDeclaration(node: VariableDecl): TypeInfo;
  visitFunctionDeclaration(node: FunctionDecl): TypeInfo;
  visitParameterDeclaration(node: ParameterDecl): TypeInfo;
  visitImportDeclaration(node: ImportDecl): TypeInfo;
  visitExportDeclaration(node: ExportDecl): TypeInfo;
}
```

#### 3.5 StatementTypeChecker (`type-checker/statements.ts`)

```typescript
/**
 * Type checking and validation for statements
 */
export abstract class StatementTypeChecker extends DeclarationTypeChecker {
  protected loopDepth: number = 0;
  
  visitIfStatement(node: IfStatement): TypeInfo;
  visitWhileStatement(node: WhileStatement): TypeInfo;
  visitForStatement(node: ForStatement): TypeInfo;
  visitReturnStatement(node: ReturnStatement): TypeInfo;
  visitBreakStatement(node: BreakStatement): TypeInfo;
  visitContinueStatement(node: ContinueStatement): TypeInfo;
  visitBlockStatement(node: BlockStatement): TypeInfo;
  visitExpressionStatement(node: ExpressionStatement): TypeInfo;
}
```

#### 3.6 TypeChecker (`type-checker/type-checker.ts`)

```typescript
/**
 * Final concrete type checker
 */
export class TypeChecker extends StatementTypeChecker {
  constructor(symbolTable: SymbolTable, typeSystem: TypeSystem) {
    super();
    this.symbolTable = symbolTable;
    this.typeSystem = typeSystem;
    this.diagnostics = [];
  }
  
  visitProgram(node: Program): TypeInfo;
  visitModuleDeclaration(node: ModuleDeclaration): TypeInfo;
  
  getDiagnostics(): Diagnostic[];
  hasErrors(): boolean;
}
```

---

### 4. SFA-Specific Analysis

#### 4.1 Call Graph Builder (`call-graph.ts`)

```typescript
/**
 * Call graph node
 */
interface CallGraphNode {
  name: string;
  declaration: FunctionDecl;
  callees: Set<string>;
  callers: Set<string>;
  callCount: number;
  isRecursive: boolean;
}

/**
 * Builds function call graph from AST
 */
export class CallGraphBuilder extends ASTWalker {
  protected nodes: Map<string, CallGraphNode>;
  protected currentFunction: string | null;
  
  build(program: Program): CallGraph;
  getCallGraph(): Map<string, CallGraphNode>;
}
```

#### 4.2 Recursion Checker (`recursion-checker.ts`)

```typescript
/**
 * Recursion error types
 */
export interface RecursionError {
  type: 'direct' | 'indirect';
  function: string;
  cycle: string[];  // Path of the cycle
  location: SourceLocation;
}

/**
 * Detects direct and indirect recursion
 * 
 * CRITICAL: Recursion is a compile-time ERROR in SFA!
 */
export class RecursionChecker {
  check(callGraph: CallGraph): RecursionError[];
  
  // DFS cycle detection (algorithm from V1 as reference)
  protected findCycle(graph: CallGraph, start: string): string[];
}
```

#### 4.3 Frame Analysis (`frame-analysis.ts`)

```typescript
/**
 * Estimates frame sizes for functions
 * 
 * Used by Frame Allocator (Phase 6) for address planning
 */
export class FrameAnalyzer {
  analyze(symbolTable: SymbolTable, callGraph: CallGraph): Map<string, number>;
  
  protected calculateFrameSize(func: Symbol): number;
  protected getParameterSize(params: Symbol[]): number;
  protected getLocalVariableSize(scope: Scope): number;
}
```

---

### 5. Advanced Analysis

#### 5.1 Definite Assignment (`analysis/definite-assignment.ts`)

```typescript
/**
 * Detects use of possibly uninitialized variables
 */
export class DefiniteAssignmentAnalyzer {
  analyze(ast: Program, symbolTable: SymbolTable): Diagnostic[];
}
```

#### 5.2 Variable Usage (`analysis/variable-usage.ts`)

```typescript
/**
 * Detects unused variables and parameters
 */
export class VariableUsageAnalyzer {
  analyze(ast: Program, symbolTable: SymbolTable): Diagnostic[];
}
```

#### 5.3 Dead Code (`analysis/dead-code.ts`)

```typescript
/**
 * Detects unreachable code (after return, break, etc.)
 */
export class DeadCodeAnalyzer {
  analyze(ast: Program, cfgs: Map<string, ControlFlowGraph>): Diagnostic[];
}
```

#### 5.4 Liveness Analysis (`analysis/liveness.ts`)

```typescript
/**
 * Live variable analysis for register allocation hints
 */
export class LivenessAnalyzer {
  analyze(ast: Program, cfgs: Map<string, ControlFlowGraph>): LivenessInfo;
}
```

#### 5.5 Purity Analysis (`analysis/purity-analysis.ts`)

```typescript
/**
 * Determines if functions have side effects
 */
export class PurityAnalyzer {
  analyze(ast: Program, callGraph: CallGraph): Map<string, boolean>;
}
```

#### 5.6 Loop Analysis (`analysis/loop-analysis.ts`)

```typescript
/**
 * Loop optimization hints (invariants, bounds)
 */
export class LoopAnalyzer {
  analyze(ast: Program, cfgs: Map<string, ControlFlowGraph>): LoopInfo[];
}
```

#### 5.7 M6502 Hints (`analysis/m6502-hints.ts`)

```typescript
/**
 * 6502-specific optimization hints
 */
export class M6502HintAnalyzer {
  analyze(ast: Program, symbolTable: SymbolTable): M6502Hints;
  
  // Identify values that fit in A, X, Y registers
  identifyByteVariables(): Symbol[];
  
  // Identify loop counters for X/Y register allocation
  identifyLoopCounters(): Symbol[];
  
  // Identify frequently accessed variables for zero page
  identifyZeroPageCandidates(): Symbol[];
}
```

#### 5.8 Advanced Analyzer (`analysis/advanced-analyzer.ts`)

```typescript
/**
 * Orchestrates all advanced analysis passes
 */
export class AdvancedAnalyzer {
  constructor(
    protected symbolTable: SymbolTable,
    protected cfgs: Map<string, ControlFlowGraph>,
    protected typeSystem: TypeSystem
  ) {}
  
  analyze(ast: Program): void;
  getDiagnostics(): Diagnostic[];
}
```

---

### 6. Main Semantic Analyzer

#### 6.1 Analyzer (`analyzer.ts`)

```typescript
/**
 * Result of single-module semantic analysis
 */
export interface AnalysisResult {
  symbolTable: SymbolTable;
  typeSystem: TypeSystem;
  callGraph: CallGraph;
  cfgs: Map<string, ControlFlowGraph>;
  diagnostics: Diagnostic[];
  success: boolean;
}

/**
 * Result of multi-module semantic analysis
 */
export interface MultiModuleAnalysisResult {
  modules: Map<string, AnalysisResult>;
  globalSymbolTable: GlobalSymbolTable;
  dependencyGraph: DependencyGraph;
  diagnostics: Diagnostic[];
  success: boolean;
}

/**
 * Semantic analyzer - main entry point
 */
export class SemanticAnalyzer {
  /**
   * Analyze a single module
   */
  analyze(ast: Program): AnalysisResult;
  
  /**
   * Analyze multiple modules (production use)
   */
  analyzeMultiple(programs: Program[]): MultiModuleAnalysisResult;
  
  // Internal pass orchestration
  protected runPass1_SymbolTableBuilder(ast: Program): void;
  protected runPass2_TypeResolution(ast: Program): void;
  protected runPass3_TypeChecker(ast: Program): void;
  protected runPass5_ControlFlowAnalyzer(ast: Program): void;
  protected runPass6_CallGraphAndRecursion(ast: Program): void;
  protected runPass7_AdvancedAnalysis(ast: Program): void;
}
```

---

## Error Messages

### Recursion Errors (SFA-Specific)

```typescript
// E0100: Direct recursion
`Recursion not allowed: function '${name}' calls itself`
Notes:
- "Blend65 uses static frame allocation which doesn't support recursion."
- "Use iteration (while/for loops) instead of recursion."

// E0101: Indirect recursion  
`Indirect recursion not allowed: ${cycle.join(' → ')}`
Notes:
- "Blend65 uses static frame allocation which doesn't support recursion."
- "Restructure your code to avoid circular function calls."
```

### Type Errors

```typescript
// E0200: Type mismatch
`Type mismatch: cannot assign '${from}' to '${to}'`

// E0201: Unknown identifier
`Unknown identifier: '${name}'`

// E0202: Not callable
`Expression is not callable`

// E0203: Argument count
`Expected ${expected} arguments, got ${actual}`

// E0204: Return type mismatch
`Function '${name}' must return '${expected}', got '${actual}'`
```

---

## Intrinsic Function Validation

The semantic analyzer validates intrinsic function calls:

```typescript
// Built-in intrinsics
const INTRINSICS: Map<string, IntrinsicSignature> = new Map([
  ['peek', { params: [{ name: 'addr', type: 'word' }], returns: 'byte' }],
  ['poke', { params: [{ name: 'addr', type: 'word' }, { name: 'value', type: 'byte' }], returns: 'void' }],
  ['peekw', { params: [{ name: 'addr', type: 'word' }], returns: 'word' }],
  ['pokew', { params: [{ name: 'addr', type: 'word' }, { name: 'value', type: 'word' }], returns: 'void' }],
  ['hi', { params: [{ name: 'value', type: 'word' }], returns: 'byte' }],
  ['lo', { params: [{ name: 'value', type: 'word' }], returns: 'byte' }],
  ['len', { params: [{ name: 'array', type: 'array' }], returns: 'word' }],
]);
```

---

## Verification Checklist

After implementation, verify:

**Core Foundation:**
- [ ] Symbol class correctly represents all symbol kinds
- [ ] Scope class handles module/function/block scopes
- [ ] SymbolTable manages scope chain correctly
- [ ] TypeSystem handles all built-in types and operations

**Multi-Module:**
- [ ] ModuleRegistry tracks all modules
- [ ] DependencyGraph detects circular imports
- [ ] ImportResolver validates cross-module references
- [ ] GlobalSymbolTable aggregates exports

**Type Checking:**
- [ ] All literal types inferred correctly
- [ ] Binary/unary expressions type checked
- [ ] Function calls validated (argument count, types)
- [ ] Assignments validated
- [ ] Return statements match function types

**SFA-Specific:**
- [ ] Call graph built correctly
- [ ] Direct recursion DETECTED as ERROR
- [ ] Indirect recursion DETECTED as ERROR
- [ ] Frame sizes estimated

**Advanced Analysis:**
- [ ] Uninitialized variable warnings
- [ ] Unused variable warnings
- [ ] Dead code warnings
- [ ] Optimization hints generated

---

## 🚨 EXTREME TESTING STRATEGY (CRITICAL)

> **This section is CRITICAL. Every implementation task MUST have corresponding tests.**
> **Tests are NOT optional - they are MANDATORY for production quality.**

### Test File Organization

```
packages/compiler-v2/src/__tests__/semantic/
├── core/                           # Core Foundation Tests
│   ├── symbol.test.ts              # Symbol class tests (30+ tests)
│   ├── scope.test.ts               # Scope class tests (25+ tests)
│   ├── symbol-table.test.ts        # SymbolTable tests (40+ tests)
│   └── type-system.test.ts         # TypeSystem tests (50+ tests)
│
├── visitors/                       # Visitor Pass Tests
│   ├── symbol-table-builder.test.ts    # Pass 1 tests (40+ tests)
│   ├── type-resolver.test.ts           # Pass 2 tests (35+ tests)
│   └── control-flow-analyzer.test.ts   # Pass 5 tests (40+ tests)
│
├── type-checker/                   # Type Checker Tests (by category)
│   ├── literals.test.ts            # Literal type checking (30+ tests)
│   ├── identifiers.test.ts         # Identifier resolution (25+ tests)
│   ├── binary-expressions.test.ts  # Binary ops (40+ tests)
│   ├── unary-expressions.test.ts   # Unary ops (20+ tests)
│   ├── call-expressions.test.ts    # Function calls (35+ tests)
│   ├── index-expressions.test.ts   # Array indexing (25+ tests)
│   ├── ternary-expressions.test.ts # Ternary (15+ tests)
│   ├── assignment.test.ts          # Assignment (30+ tests)
│   ├── declarations.test.ts        # Declaration checking (40+ tests)
│   ├── statements.test.ts          # Statement checking (35+ tests)
│   ├── intrinsics.test.ts          # Intrinsic validation (40+ tests)
│   └── integration.test.ts         # Type checker integration (30+ tests)
│
├── multi-module/                   # Multi-Module Tests
│   ├── module-registry.test.ts     # Registry tests (25+ tests)
│   ├── dependency-graph.test.ts    # Graph + cycles (35+ tests)
│   ├── import-resolver.test.ts     # Import resolution (30+ tests)
│   ├── global-symbol-table.test.ts # Global symbols (25+ tests)
│   └── cross-module.test.ts        # Cross-module integration (40+ tests)
│
├── sfa/                            # SFA-Specific Tests (CRITICAL)
│   ├── call-graph.test.ts          # Call graph building (35+ tests)
│   ├── recursion-direct.test.ts    # Direct recursion (20+ tests)
│   ├── recursion-indirect.test.ts  # Indirect recursion (25+ tests)
│   └── frame-analysis.test.ts      # Frame size estimation (30+ tests)
│
├── analysis/                       # Advanced Analysis Tests
│   ├── definite-assignment.test.ts # Uninitialized vars (30+ tests)
│   ├── variable-usage.test.ts      # Unused vars (25+ tests)
│   ├── dead-code.test.ts           # Unreachable code (30+ tests)
│   ├── liveness.test.ts            # Liveness analysis (25+ tests)
│   ├── purity.test.ts              # Purity analysis (20+ tests)
│   ├── loop-analysis.test.ts       # Loop analysis (25+ tests)
│   └── m6502-hints.test.ts         # 6502 hints (20+ tests)
│
├── errors/                         # Error Message Tests
│   ├── type-errors.test.ts         # Type error messages (40+ tests)
│   ├── recursion-errors.test.ts    # Recursion error messages (15+ tests)
│   ├── import-errors.test.ts       # Import error messages (20+ tests)
│   └── semantic-errors.test.ts     # Other semantic errors (30+ tests)
│
├── analyzer.test.ts                # Main analyzer tests (40+ tests)
└── e2e/                            # End-to-End Tests
    ├── simple-programs.test.ts     # Simple program analysis (30+ tests)
    ├── complex-programs.test.ts    # Complex programs (25+ tests)
    ├── real-world.test.ts          # Real-world patterns (20+ tests)
    └── stress-tests.test.ts        # Performance/stress (15+ tests)
```

**Total Test Files: 35+**
**Total Tests: 1,200+**

---

### Test Categories Per Component

#### 1. Symbol Tests (`core/symbol.test.ts`) - 30+ tests

| Category | Tests | Description |
|----------|-------|-------------|
| Creation | 8 | Create symbols of each kind |
| Properties | 6 | Verify all properties work correctly |
| Type assignment | 6 | Setting/getting type info |
| Metadata | 5 | Metadata operations |
| Edge cases | 5 | Null values, missing fields |

#### 2. Scope Tests (`core/scope.test.ts`) - 25+ tests

| Category | Tests | Description |
|----------|-------|-------------|
| Creation | 5 | Create scopes of each kind |
| Hierarchy | 8 | Parent/child relationships |
| Symbol storage | 6 | Adding/retrieving symbols |
| Function scopes | 4 | Function-specific behavior |
| Edge cases | 2 | Empty scopes, nested scopes |

#### 3. SymbolTable Tests (`core/symbol-table.test.ts`) - 40+ tests

| Category | Tests | Description |
|----------|-------|-------------|
| Scope creation | 8 | Create all scope types |
| Scope navigation | 8 | Enter/exit/current scope |
| Symbol declaration | 10 | Declare in various scopes |
| Symbol lookup | 10 | Lookup with scope chain |
| Duplicate detection | 4 | Duplicate declarations |

#### 4. TypeSystem Tests (`core/type-system.test.ts`) - 50+ tests

| Category | Tests | Description |
|----------|-------|-------------|
| Built-in types | 10 | All built-in types exist |
| Type compatibility | 15 | All compatibility combinations |
| Array types | 8 | Array type creation/checking |
| Function types | 7 | Function type handling |
| Binary op types | 5 | Result types for all ops |
| Unary op types | 5 | Result types for unary ops |

#### 5. Symbol Table Builder Tests (`visitors/symbol-table-builder.test.ts`) - 40+ tests

| Category | Tests | Description |
|----------|-------|-------------|
| Module declarations | 5 | Module scope creation |
| Function declarations | 10 | Functions and scopes |
| Variable declarations | 10 | Variables in all scopes |
| Parameter handling | 5 | Function parameters |
| Import/export | 5 | Import/export handling |
| Error cases | 5 | Duplicate declarations |

#### 6. Type Checker: Literals (`type-checker/literals.test.ts`) - 30+ tests

| Category | Tests | Description |
|----------|-------|-------------|
| Numeric literals | 10 | 0-255 byte, 256+ word |
| Boolean literals | 4 | true/false handling |
| String literals | 4 | String type inference |
| Array literals | 8 | Homogeneous arrays |
| Edge cases | 4 | Empty arrays, nested |

#### 7. Type Checker: Binary Expressions (`type-checker/binary-expressions.test.ts`) - 40+ tests

| Category | Tests | Description |
|----------|-------|-------------|
| Arithmetic (+,-,*,/,%) | 15 | All combinations |
| Comparison (<,>,<=,>=,==,!=) | 10 | All operators |
| Logical (&&, \|\|) | 6 | Boolean logic |
| Bitwise (&,\|,^,<<,>>) | 9 | Bitwise ops |

#### 8. Type Checker: Call Expressions (`type-checker/call-expressions.test.ts`) - 35+ tests

| Category | Tests | Description |
|----------|-------|-------------|
| Valid calls | 10 | Correct argument counts/types |
| Argument validation | 10 | Type checking arguments |
| Return type inference | 8 | Return type propagation |
| Error cases | 7 | Wrong args, not callable |

#### 9. Type Checker: Intrinsics (`type-checker/intrinsics.test.ts`) - 40+ tests

| Category | Tests | Description |
|----------|-------|-------------|
| peek/poke | 10 | Memory access intrinsics |
| peekw/pokew | 8 | Word memory intrinsics |
| hi/lo | 6 | Byte extraction |
| len | 4 | Array length |
| asm_* functions | 12 | Assembly intrinsics |

#### 10. Type Checker: Statements (`type-checker/statements.test.ts`) - 35+ tests

| Category | Tests | Description |
|----------|-------|-------------|
| If statements | 8 | Condition type checking |
| While loops | 6 | Loop condition/body |
| For loops | 8 | Init/condition/update |
| Return statements | 8 | Return type matching |
| Break/continue | 5 | Loop context validation |

#### 11. Dependency Graph Tests (`multi-module/dependency-graph.test.ts`) - 35+ tests

| Category | Tests | Description |
|----------|-------|-------------|
| Node/edge operations | 8 | Add nodes/edges |
| Cycle detection | 12 | Various cycle patterns |
| Topological sort | 8 | Compilation order |
| Error cases | 7 | Missing modules |

#### 12. Recursion Tests (`sfa/recursion-direct.test.ts`, `sfa/recursion-indirect.test.ts`) - 45+ tests

| Category | Tests | Description |
|----------|-------|-------------|
| Direct recursion | 20 | Function calls itself |
| Indirect recursion (2-way) | 10 | A→B→A patterns |
| Indirect recursion (n-way) | 10 | A→B→C→A patterns |
| False positives | 5 | Non-recursive patterns |

#### 13. Analyzer E2E Tests (`e2e/`) - 90+ tests

| Category | Tests | Description |
|----------|-------|-------------|
| Simple programs | 30 | Basic valid programs |
| Complex programs | 25 | Multi-function programs |
| Real-world patterns | 20 | C64 programming patterns |
| Stress tests | 15 | Large programs, edge cases |

---

### Test File Targets Per Session

| Session | Implementation | Test File(s) | Min Tests |
|---------|---------------|--------------|-----------|
| 5.1 | Core Foundation | `core/symbol.test.ts`, `core/scope.test.ts` | 55 |
| 5.2 | TypeSystem | `core/type-system.test.ts` | 50 |
| 5.3 | SymbolTable | `core/symbol-table.test.ts` | 40 |
| 5.4 | Symbol Table Builder | `visitors/symbol-table-builder.test.ts` | 40 |
| 5.5 | Type Resolution | `visitors/type-resolver.test.ts` | 35 |
| 5.6 | Literals + Base | `type-checker/literals.test.ts` | 30 |
| 5.7 | Expressions | `type-checker/binary-expressions.test.ts`, `type-checker/unary-expressions.test.ts`, `type-checker/identifiers.test.ts` | 85 |
| 5.8 | More Expressions | `type-checker/call-expressions.test.ts`, `type-checker/index-expressions.test.ts`, `type-checker/ternary-expressions.test.ts`, `type-checker/assignment.test.ts` | 105 |
| 5.9 | Declarations | `type-checker/declarations.test.ts`, `type-checker/intrinsics.test.ts` | 80 |
| 5.10 | Statements | `type-checker/statements.test.ts`, `type-checker/integration.test.ts` | 65 |
| 5.11 | Control Flow | `visitors/control-flow-analyzer.test.ts` | 40 |
| 5.12 | Multi-Module (1) | `multi-module/module-registry.test.ts`, `multi-module/dependency-graph.test.ts` | 60 |
| 5.13 | Multi-Module (2) | `multi-module/import-resolver.test.ts`, `multi-module/global-symbol-table.test.ts`, `multi-module/cross-module.test.ts` | 95 |
| 5.14 | Call Graph | `sfa/call-graph.test.ts` | 35 |
| 5.15 | Recursion | `sfa/recursion-direct.test.ts`, `sfa/recursion-indirect.test.ts`, `sfa/frame-analysis.test.ts` | 75 |
| 5.16 | Analysis (1) | `analysis/definite-assignment.test.ts`, `analysis/variable-usage.test.ts` | 55 |
| 5.17 | Analysis (2) | `analysis/dead-code.test.ts`, `analysis/liveness.test.ts` | 55 |
| 5.18 | Analysis (3) | `analysis/purity.test.ts`, `analysis/loop-analysis.test.ts`, `analysis/m6502-hints.test.ts` | 65 |
| 5.19 | Error Messages | `errors/type-errors.test.ts`, `errors/recursion-errors.test.ts`, `errors/import-errors.test.ts`, `errors/semantic-errors.test.ts` | 105 |
| 5.20 | Main Analyzer | `analyzer.test.ts` | 40 |
| 5.21 | E2E Tests | `e2e/simple-programs.test.ts`, `e2e/complex-programs.test.ts` | 55 |
| 5.22 | E2E + Final | `e2e/real-world.test.ts`, `e2e/stress-tests.test.ts` | 35 |

**Total: 22 sessions, 1,295+ tests minimum**

---

### Test Quality Requirements

**Per `.clinerules/code.md` Rules 4-8:**

1. **All tests MUST pass** - No failing tests allowed
2. **Maximum coverage** - Every branch, every edge case
3. **Granular tests** - One assertion per test when possible
4. **Descriptive names** - Test name explains what's being tested
5. **Isolated tests** - Each test independent, no shared state

**Test Structure:**

```typescript
describe('ComponentName', () => {
  describe('methodName', () => {
    describe('when condition', () => {
      it('should expected behavior', () => {
        // Arrange
        // Act
        // Assert
      });
    });
  });
});
```

---

### Session Verification Protocol

**At the end of EACH implementation session:**

1. ✅ Run all tests: `./compiler-test semantic`
2. ✅ Verify test count matches minimum
3. ✅ Check coverage percentage
4. ✅ No skipped tests
5. ✅ All tests pass

**Verification Command:**
```bash
clear && yarn clean && yarn build && yarn test --filter=semantic
```

---

## Implementation Sessions (Updated with Testing)

| Session | Focus | Code Lines | Test Lines | Test Files |
|---------|-------|------------|------------|------------|
| 5.1 | Core: Symbol + Scope | 200 | 300 | 2 |
| 5.2 | Core: TypeSystem | 350 | 400 | 1 |
| 5.3 | Core: SymbolTable | 200 | 350 | 1 |
| 5.4 | Pass 1: Symbol Table Builder | 400 | 350 | 1 |
| 5.5 | Pass 2: Type Resolution | 300 | 300 | 1 |
| 5.6 | TypeChecker: Base + Literals | 300 | 250 | 1 |
| 5.7 | TypeChecker: Expressions (1) | 400 | 450 | 3 |
| 5.8 | TypeChecker: Expressions (2) | 350 | 500 | 4 |
| 5.9 | TypeChecker: Declarations | 300 | 400 | 2 |
| 5.10 | TypeChecker: Statements | 350 | 350 | 2 |
| 5.11 | Pass 5: Control Flow | 600 | 350 | 1 |
| 5.12 | Multi-Module (1) | 400 | 400 | 2 |
| 5.13 | Multi-Module (2) | 400 | 500 | 3 |
| 5.14 | Pass 6: Call Graph | 250 | 300 | 1 |
| 5.15 | Pass 6: Recursion | 250 | 400 | 3 |
| 5.16 | Pass 7: Analysis (1) | 400 | 350 | 2 |
| 5.17 | Pass 7: Analysis (2) | 400 | 350 | 2 |
| 5.18 | Pass 7: Analysis (3) | 350 | 350 | 3 |
| 5.19 | Error Messages | 200 | 500 | 4 |
| 5.20 | Main Analyzer | 400 | 350 | 1 |
| 5.21 | E2E Tests (1) | 0 | 400 | 2 |
| 5.22 | E2E Tests (2) | 0 | 300 | 2 |
| **Total** | | **~7,000** | **~8,000** | **35** |

**Combined Total: ~15,000 lines (7,000 code + 8,000 tests)**

---

## Reference Material

While writing from scratch, V1 code serves as **documentation** for:

| Component | V1 Reference | Algorithm to Extract |
|-----------|--------------|---------------------|
| Type compatibility | `type-system.ts` | `checkCompatibility()` |
| Scope management | `symbol-table.ts` | Scope chain pattern |
| Recursion detection | `analysis/call-graph.ts` | DFS cycle detection |
| Control flow | `control-flow.ts` | CFG building |

**Do NOT copy files directly** - write fresh implementations using V1 as documentation.

---

## Related Documents

| Document | Description |
|----------|-------------|
| [05-parser-migration.md](05-parser-migration.md) | Parser that provides AST |
| [07-frame-allocator.md](07-frame-allocator.md) | Next: Frame allocation (uses Call Graph) |
| [99-execution-plan.md](99-execution-plan.md) | Full task list |