# Semantic Analyzer Phase 1: Symbol Table Builder

> **Phase**: 1 of 9
> **Focus**: Symbol table infrastructure and declaration collection
> **Dependencies**: Phase 0 (AST Walker) must be complete
> **Duration**: 1 week
> **Tasks**: 15
> **Tests**: 80+

---

## **Phase Overview**

Phase 1 builds the symbol table infrastructure and implements the first semantic analysis pass: collecting all declarations and building symbol tables with proper scope management.

### **Objectives**

1. ✅ Create symbol table data structures
2. ✅ Implement scope management system
3. ✅ Build symbol table builder visitor (Pass 1)
4. ✅ Collect all declarations (variables, functions, @map, imports/exports)
5. ✅ Detect duplicate declarations
6. ✅ Establish scope hierarchy

### **What This Phase Produces**

- Complete symbol tables for all scopes
- Symbol lookup infrastructure
- Duplicate declaration detection
- Foundation for type resolution (Phase 2)

---

## **Symbol Table Architecture**

### **Core Data Structures**

```typescript
/**
 * Represents a symbol in the symbol table
 */
export interface Symbol {
  /** Symbol name */
  name: string;

  /** Symbol kind */
  kind: SymbolKind;

  /** AST node that declared this symbol */
  declaration: ASTNode;

  /** Type information (resolved in Phase 2) */
  type?: TypeInfo;

  /** Storage class for variables */
  storageClass?: StorageClass;

  /** Is this symbol exported? */
  isExported: boolean;

  /** Is this symbol a constant? */
  isConst: boolean;

  /** Scope where this symbol is declared */
  scope: Scope;

  /** Source location */
  location: SourceLocation;

  /** Additional metadata */
  metadata?: SymbolMetadata;
}

/**
 * Symbol kinds
 */
export enum SymbolKind {
  Variable = 'Variable',
  Function = 'Function',
  Parameter = 'Parameter',
  MapVariable = 'MapVariable',
  ImportedSymbol = 'ImportedSymbol',
  Type = 'Type',
  Enum = 'Enum',
  EnumMember = 'EnumMember',
}

/**
 * Storage classes for variables
 */
export enum StorageClass {
  ZeroPage = 'zp', // @zp
  RAM = 'ram', // @ram (default)
  Data = 'data', // @data (ROM-able)
  Map = 'map', // @map (memory-mapped)
}

/**
 * Represents a scope in the program
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
  node: ASTNode;

  /** Scope metadata */
  metadata?: ScopeMetadata;
}

/**
 * Scope kinds
 */
export enum ScopeKind {
  Module = 'Module',
  Function = 'Function',
  // Note: Blend has function-scoped variables, NOT block scope
  // if/while/for do NOT create new scopes
}

/**
 * Symbol table manages all scopes and symbols
 */
export class SymbolTable {
  /** Root scope (module scope) */
  protected rootScope: Scope;

  /** All scopes indexed by ID */
  protected scopes: Map<string, Scope>;

  /** Current scope during traversal */
  protected currentScope: Scope;

  /** Scope counter for unique IDs */
  protected scopeCounter: number;

  constructor() {
    this.scopeCounter = 0;
    this.scopes = new Map();
    this.rootScope = this.createScope(ScopeKind.Module, null, null);
    this.currentScope = this.rootScope;
  }

  /**
   * Create a new scope
   */
  public createScope(kind: ScopeKind, parent: Scope | null, node: ASTNode | null): Scope {
    const id = `scope_${this.scopeCounter++}`;
    const scope: Scope = {
      id,
      kind,
      parent,
      children: [],
      symbols: new Map(),
      node: node!,
    };

    this.scopes.set(id, scope);

    if (parent) {
      parent.children.push(scope);
    }

    return scope;
  }

  /**
   * Enter a scope (push onto scope stack)
   */
  public enterScope(scope: Scope): void {
    this.currentScope = scope;
  }

  /**
   * Exit current scope (pop from scope stack)
   */
  public exitScope(): void {
    if (this.currentScope.parent) {
      this.currentScope = this.currentScope.parent;
    }
  }

  /**
   * Get current scope
   */
  public getCurrentScope(): Scope {
    return this.currentScope;
  }

  /**
   * Get root scope
   */
  public getRootScope(): Scope {
    return this.rootScope;
  }

  /**
   * Declare a symbol in current scope
   * @throws Error if symbol already exists
   */
  public declare(symbol: Symbol): void {
    const existing = this.currentScope.symbols.get(symbol.name);

    if (existing) {
      throw new Error(`Duplicate declaration: '${symbol.name}' is already declared in this scope`);
    }

    this.currentScope.symbols.set(symbol.name, symbol);
  }

  /**
   * Lookup symbol in current scope and parent scopes
   */
  public lookup(name: string): Symbol | undefined {
    let scope: Scope | null = this.currentScope;

    while (scope) {
      const symbol = scope.symbols.get(name);
      if (symbol) {
        return symbol;
      }
      scope = scope.parent;
    }

    return undefined;
  }

  /**
   * Lookup symbol only in current scope (no parent lookup)
   */
  public lookupLocal(name: string): Symbol | undefined {
    return this.currentScope.symbols.get(name);
  }

  /**
   * Get all symbols in current scope
   */
  public getSymbolsInScope(scope?: Scope): Symbol[] {
    const targetScope = scope || this.currentScope;
    return Array.from(targetScope.symbols.values());
  }

  /**
   * Get all symbols in scope tree (current + parents)
   */
  public getVisibleSymbols(): Symbol[] {
    const symbols: Symbol[] = [];
    let scope: Scope | null = this.currentScope;

    while (scope) {
      symbols.push(...Array.from(scope.symbols.values()));
      scope = scope.parent;
    }

    return symbols;
  }
}
```

---

## **Symbol Table Builder Visitor**

### **Pass 1: Declaration Collection**

```typescript
/**
 * Symbol table builder - collects all declarations
 * and builds symbol tables with proper scoping
 */
export class SymbolTableBuilder extends ContextAwareWalker {
  /** Symbol table being built */
  protected symbolTable: SymbolTable;

  /** Diagnostics collector */
  protected diagnostics: Diagnostic[];

  constructor() {
    super();
    this.symbolTable = new SymbolTable();
    this.diagnostics = [];
  }

  /**
   * Get the built symbol table
   */
  public getSymbolTable(): SymbolTable {
    return this.symbolTable;
  }

  /**
   * Get collected diagnostics
   */
  public getDiagnostics(): Diagnostic[] {
    return this.diagnostics;
  }

  /**
   * Report a diagnostic
   */
  protected reportDiagnostic(diagnostic: Diagnostic): void {
    this.diagnostics.push(diagnostic);
  }

  //
  // Program and Module
  //

  public visitProgram(node: Program): void {
    // Process all declarations in module scope
    for (const decl of node.declarations) {
      decl.accept(this);
    }
  }

  //
  // Variable Declarations
  //

  public visitVariableDecl(node: VariableDecl): void {
    try {
      const symbol: Symbol = {
        name: node.name,
        kind: SymbolKind.Variable,
        declaration: node,
        isExported: node.isExported,
        isConst: node.isConst,
        scope: this.symbolTable.getCurrentScope(),
        location: node.location,
        storageClass: this.getStorageClass(node),
      };

      this.symbolTable.declare(symbol);
    } catch (error) {
      this.reportDuplicateDeclaration(node.name, node.location);
    }

    // Visit initializer if present
    if (node.initializer) {
      node.initializer.accept(this);
    }
  }

  /**
   * Get storage class from variable declaration
   */
  protected getStorageClass(node: VariableDecl): StorageClass {
    if (!node.storageClass) {
      return StorageClass.RAM; // Default
    }

    switch (node.storageClass) {
      case 'zp':
        return StorageClass.ZeroPage;
      case 'ram':
        return StorageClass.RAM;
      case 'data':
        return StorageClass.Data;
      default:
        return StorageClass.RAM;
    }
  }

  //
  // Memory-Mapped Declarations (@map)
  //

  public visitMapDecl(node: MapDecl): void {
    try {
      const symbol: Symbol = {
        name: node.name,
        kind: SymbolKind.MapVariable,
        declaration: node,
        isExported: node.isExported,
        isConst: false, // @map variables are never const
        scope: this.symbolTable.getCurrentScope(),
        location: node.location,
        storageClass: StorageClass.Map,
      };

      this.symbolTable.declare(symbol);
    } catch (error) {
      this.reportDuplicateDeclaration(node.name, node.location);
    }

    // Visit address expression
    node.address.accept(this);
  }

  //
  // Function Declarations
  //

  public visitFunctionDecl(node: FunctionDecl): void {
    try {
      // Declare function in current scope
      const symbol: Symbol = {
        name: node.name,
        kind: SymbolKind.Function,
        declaration: node,
        isExported: node.isExported,
        isConst: false,
        scope: this.symbolTable.getCurrentScope(),
        location: node.location,
      };

      this.symbolTable.declare(symbol);
    } catch (error) {
      this.reportDuplicateDeclaration(node.name, node.location);
    }

    // Create function scope
    const functionScope = this.symbolTable.createScope(
      ScopeKind.Function,
      this.symbolTable.getCurrentScope(),
      node
    );

    this.symbolTable.enterScope(functionScope);

    // Declare parameters in function scope
    for (const param of node.parameters) {
      this.visitParameter(param);
    }

    // Visit function body
    if (node.body) {
      node.body.accept(this);
    }

    this.symbolTable.exitScope();
  }

  /**
   * Process function parameter
   */
  protected visitParameter(param: FunctionParameter): void {
    try {
      const symbol: Symbol = {
        name: param.name,
        kind: SymbolKind.Parameter,
        declaration: param,
        isExported: false,
        isConst: false,
        scope: this.symbolTable.getCurrentScope(),
        location: param.location,
      };

      this.symbolTable.declare(symbol);
    } catch (error) {
      this.reportDuplicateDeclaration(param.name, param.location);
    }
  }

  //
  // Import/Export
  //

  public visitImportDecl(node: ImportDecl): void {
    // Create imported symbols in current scope
    for (const spec of node.specifiers) {
      try {
        const localName = spec.alias || spec.imported;

        const symbol: Symbol = {
          name: localName,
          kind: SymbolKind.ImportedSymbol,
          declaration: node,
          isExported: false,
          isConst: false,
          scope: this.symbolTable.getCurrentScope(),
          location: node.location,
          metadata: {
            importSource: node.source,
            importedName: spec.imported,
          },
        };

        this.symbolTable.declare(symbol);
      } catch (error) {
        this.reportDuplicateDeclaration(spec.imported, node.location);
      }
    }
  }

  //
  // Error Reporting
  //

  protected reportDuplicateDeclaration(name: string, location: SourceLocation): void {
    this.reportDiagnostic({
      severity: 'error',
      message: `Duplicate declaration of '${name}'`,
      location,
      code: 'E2001',
    });
  }
}
```

---

## **Implementation Tasks**

### **Task 1.1: Symbol and Scope Data Structures**

**Files to Create:**

- `src/semantic/symbol.ts` - Symbol types
- `src/semantic/scope.ts` - Scope types
- `src/semantic/symbol-table.ts` - SymbolTable class

**Implementation:**

1. Define `Symbol` interface with all properties
2. Define `SymbolKind` enum
3. Define `StorageClass` enum
4. Define `Scope` interface
5. Define `ScopeKind` enum
6. Implement `SymbolTable` class with:
   - Scope creation and management
   - Symbol declaration
   - Symbol lookup (local and hierarchical)
   - Scope navigation (enter/exit)

**Tests:** (15 tests)

- Symbol creation with all properties
- Scope creation and hierarchy
- Symbol declaration in scope
- Duplicate declaration detection
- Symbol lookup in single scope
- Symbol lookup with scope chain
- Scope enter/exit operations
- Root scope access
- Current scope tracking

**Time Estimate:** 6 hours

---

### **Task 1.2: Symbol Table Builder Base Class**

**Files to Create:**

- `src/semantic/visitors/symbol-table-builder.ts`

**Implementation:**

1. Create `SymbolTableBuilder` class extending `ContextAwareWalker`
2. Add symbol table instance
3. Add diagnostics collection
4. Implement helper methods:
   - `getStorageClass()` - Extract storage class from declaration
   - `reportDuplicateDeclaration()` - Error reporting
   - `visitParameter()` - Parameter processing

**Tests:** (10 tests)

- Builder instantiation
- Symbol table creation
- Diagnostics collection
- Storage class extraction
- Error reporting

**Time Estimate:** 4 hours

---

### **Task 1.3: Variable Declaration Collection**

**Implementation:**

1. Implement `visitVariableDecl()` method
2. Create symbols for variables
3. Handle storage classes (@zp, @ram, @data)
4. Handle const vs let
5. Handle export modifier
6. Process initializer expressions
7. Detect duplicate declarations

**Tests:** (12 tests)

- Collect simple variable declarations
- Collect const declarations
- Collect exported variables
- Collect @zp variables
- Collect @ram variables
- Collect @data variables
- Detect duplicate variable names
- Handle variables with initializers
- Handle variables without initializers
- Multiple variables in same scope

**Time Estimate:** 4 hours

---

### **Task 1.4: Memory-Mapped Declaration Collection**

**Implementation:**

1. Implement `visitMapDecl()` method
2. Create symbols for @map variables
3. Handle all 4 @map forms
4. Mark storage class as Map
5. Detect duplicate @map names
6. Process address expressions

**Tests:** (8 tests)

- Collect @map variable at address
- Collect @map variable at named address
- Collect @map variable at expression
- Collect @map variable with bracket syntax
- Detect duplicate @map names
- Handle exported @map variables
- Process complex address expressions

**Time Estimate:** 3 hours

---

### **Task 1.5: Function Declaration Collection**

**Implementation:**

1. Implement `visitFunctionDecl()` method
2. Create symbols for functions
3. Create function scopes
4. Handle function parameters
5. Handle export modifier
6. Process function body
7. Detect duplicate function names

**Tests:** (15 tests)

- Collect simple function declaration
- Collect exported function
- Collect function with parameters
- Collect function with return type
- Create function scope
- Declare parameters in function scope
- Detect duplicate function names
- Detect duplicate parameter names
- Handle nested function declarations (error)
- Multiple functions in module

**Time Estimate:** 5 hours

---

### **Task 1.6: Import/Export Declaration Collection**

**Implementation:**

1. Implement `visitImportDecl()` method
2. Create symbols for imported identifiers
3. Handle import aliases
4. Track import sources
5. Handle multiple imports from same module
6. Detect duplicate imported names

**Tests:** (10 tests)

- Collect single import
- Collect multiple imports
- Collect aliased imports
- Detect duplicate import names
- Handle import from same module
- Track import source information
- Handle mixed imports and aliases

**Time Estimate:** 4 hours

---

### **Task 1.7: Scope Management**

**Implementation:**

1. Implement proper scope creation
2. Handle module scope (root)
3. Handle function scopes
4. NO block scopes (function-scoped language)
5. Scope enter/exit during traversal
6. Scope hierarchy building

**Tests:** (12 tests)

- Create module scope
- Create function scope
- Function scope has module as parent
- Variables in if-block visible after (function scope)
- Variables in while-block visible after
- Nested function scopes
- Scope hierarchy navigation
- Current scope tracking
- Scope exit restores parent

**Time Estimate:** 4 hours

---

### **Task 1.8: Integration with Semantic Analyzer**

**Files to Create:**

- `src/semantic/analyzer.ts` - Main SemanticAnalyzer class

**Implementation:**

1. Create `SemanticAnalyzer` orchestrator class
2. Integrate SymbolTableBuilder as Pass 1
3. Add public API:
   - `analyze(ast: Program): AnalysisResult`
   - `getSymbolTable(): SymbolTable`
   - `getDiagnostics(): Diagnostic[]`
4. Coordinate passes (just Pass 1 for now)

**Tests:** (8 tests)

- Analyzer instantiation
- Run Pass 1 (SymbolTableBuilder)
- Get symbol table after analysis
- Get diagnostics after analysis
- Handle empty program
- Handle program with errors
- Integration with AST walker

**Time Estimate:** 5 hours

---

### **Task 1.9: Comprehensive Testing**

**Files to Create:**

- `src/semantic/__tests__/symbol-table.test.ts`
- `src/semantic/__tests__/symbol-table-builder.test.ts`
- `src/semantic/__tests__/scope-management.test.ts`

**Tests:** (10+ integration tests)

- End-to-end: Build symbol table for complete program
- Complex module with variables, functions, @map
- Nested scopes and lookups
- Import/export scenarios
- Error cases and recovery
- Performance with large symbol tables

**Time Estimate:** 6 hours

---

## **Task Implementation Checklist**

| Task | Description                          | Dependencies | Status |
| ---- | ------------------------------------ | ------------ | ------ |
| 1.1  | Symbol and Scope data structures     | Phase 0      | [ ]    |
| 1.2  | Symbol Table Builder base class      | 1.1          | [ ]    |
| 1.3  | Variable declaration collection      | 1.2          | [ ]    |
| 1.4  | Memory-mapped declaration collection | 1.2          | [ ]    |
| 1.5  | Function declaration collection      | 1.2          | [ ]    |
| 1.6  | Import/Export declaration collection | 1.2          | [ ]    |
| 1.7  | Scope management                     | 1.1          | [ ]    |
| 1.8  | Integration with SemanticAnalyzer    | 1.2-1.7      | [ ]    |
| 1.9  | Comprehensive testing                | 1.1-1.8      | [ ]    |

**Total**: 9 tasks, 80+ tests, ~1 week

---

## **Language Specification Compliance**

### **Critical Specification Rules**

**Before implementing, ALWAYS review:**

1. **Variable Scope** - `docs/language-specification/10-variables.md`
   - ✅ Function-scoped (NOT block-scoped)
   - ✅ Variables declared in if/while are visible after
   - ✅ Module-level variables visible throughout module

2. **Storage Classes** - `docs/language-specification/10-variables.md`
   - ✅ @zp: Zero page (256 bytes limit)
   - ✅ @ram: Default storage (anywhere in RAM)
   - ✅ @data: ROM-able (cannot modify at runtime)

3. **Memory-Mapped** - `docs/language-specification/12-memory-mapped.md`
   - ✅ @map must be module-scope only
   - ✅ Cannot declare @map inside functions
   - ✅ 4 forms: at address, at named, at expression, bracket syntax

4. **Functions** - `docs/language-specification/11-functions.md`
   - ✅ Parameters create symbols in function scope
   - ✅ Function body has access to parameters
   - ✅ Nested function declarations NOT allowed

5. **Module System** - `docs/language-specification/04-module-system.md`
   - ✅ Imports create symbols in module scope
   - ✅ Exports mark symbols as visible to importers
   - ✅ Import aliases create new names

---

## **Testing Strategy**

### **Unit Tests**

- Symbol creation and properties
- Scope creation and hierarchy
- Symbol table operations
- Each visitor method independently
- Error detection and reporting

### **Integration Tests**

- Complete programs with multiple declarations
- Symbol lookup across scopes
- Import/export scenarios
- Error recovery

### **Edge Cases**

- Empty programs
- Duplicate declarations
- Invalid storage classes
- @map in wrong scope
- Circular imports (detected in Phase 7)

### **Test Coverage Goals**

- **>95% line coverage**
- **100% of public API tested**
- **All error paths tested**
- **Edge cases covered**

---

## **Success Criteria**

Phase 1 is complete when:

- ✅ All 9 tasks completed
- ✅ 80+ tests passing
- ✅ Symbol table correctly built for all declarations
- ✅ Scope hierarchy properly established
- ✅ Duplicate declarations detected
- ✅ Integration with SemanticAnalyzer working
- ✅ No breaking changes to existing code
- ✅ Documentation complete
- ✅ Ready for Phase 2 (Type Resolution)

---

## **Next Phase**

**After Phase 1 completion:**

Proceed to **Phase 2: Type Resolution**

- Resolve type annotations
- Build type compatibility matrix
- Prepare for type checking (Phase 3)

---

## **Notes**

- Symbol table builder does NOT perform type checking (Phase 3)
- Symbol table builder does NOT resolve types (Phase 2)
- Focus is purely on **collecting declarations** and **building scopes**
- This is a foundation pass - later passes will annotate symbols with type info

---

**Ready to build symbol tables! 🔧**
