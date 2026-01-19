# Semantic Analyzer Phase 6: Multi-Module Infrastructure

> **Status**: REVISED PLAN - New Architecture
> **Phase**: 6 of 8
> **Focus**: Transform analyzer from single-module to multi-module support
> **Dependencies**: Phases 0-5 complete
> **Duration**: 3 weeks (15 working days)
> **Tasks**: 11 major tasks
> **Tests**: 150+
> **Priority**: CRITICAL - Blocking all future work

---

## **Executive Summary**

This phase transforms the SemanticAnalyzer from single-module (`Program`) to multi-module (`Program[]`) support, enabling god-level analysis across an entire Blend65 project including system libraries.

**Key Architectural Changes:**

- Analyzer accepts `Program[]` instead of `Program`
- Multi-pass analysis: dependency graph → symbol collection → cross-module validation
- Global resource allocation (zero page, memory layout)
- Industry-standard approach (matches TypeScript, Rust, C#, Go)

---

## **✅ What's Already Complete (Phases 0-5)**

| Phase | Component                 | Status      | Notes                                     |
| ----- | ------------------------- | ----------- | ----------------------------------------- |
| 0     | AST Walker Infrastructure | ✅ Complete | Visitor pattern, collectors, transformers |
| 1     | Symbol Table Builder      | ✅ Complete | Per-module symbol collection              |
| 2     | Type Resolution           | ✅ Complete | Type annotation resolution                |
| 3     | Type Checking             | ✅ Complete | Expression & statement type checking      |
| 4     | Statement Validation      | ✅ Complete | Integrated into Phase 3                   |
| 5     | Control Flow Analysis     | ✅ Complete | CFG construction, reachability            |

**Current Limitation**: All phases work perfectly for **single modules only**.

---

## **🎯 Phase 6 Objectives**

### **Primary Goals:**

1. **Multi-Module Support**
   - Accept `Program[]` (multiple parsed modules)
   - Analyze all modules together with full context

2. **Dependency Management**
   - Build dependency graph from imports
   - Detect circular dependencies (fail-fast)
   - Determine compilation order (topological sort)

3. **Import/Export Resolution**
   - Validate all imported modules exist
   - Resolve imported symbols to actual declarations
   - Verify exported symbols are accessible

4. **Global Symbol Table**
   - Aggregate symbols from all modules
   - Enable cross-module symbol lookup
   - Maintain per-module and global views

5. **Global Resource Allocation**
   - Allocate zero page across ALL modules (only 112 bytes available!)
   - Detect @map conflicts between modules
   - Track total RAM/ROM usage

6. **Backward Compatibility**
   - Single-module tests continue working
   - Existing visitors (Phases 1-5) reused without changes
   - Clean API migration path

---

## **📋 Architecture Overview**

### **New Analysis Flow**

```typescript
class SemanticAnalyzer {
  // NEW SIGNATURE (multi-module)
  analyze(programs: Program[]): MultiModuleAnalysisResult {
    // ============================================
    // PHASE A: Module Discovery & Validation
    // ============================================
    // Pass 0: Build module registry
    const registry = this.buildModuleRegistry(programs);

    // Pass 1: Build dependency graph (FAIL-FAST on cycles)
    const depGraph = this.buildDependencyGraph(programs, registry);
    if (depGraph.hasCycles()) {
      return this.failWithCycles(depGraph.getCycles());
    }

    // Pass 2: Validate imports (FAIL-FAST on missing modules)
    const importErrors = this.validateImports(programs, registry);
    if (importErrors.length > 0) {
      return this.failWithErrors(importErrors);
    }

    // ============================================
    // PHASE B: Per-Module Analysis (Reuse Phases 1-5)
    // ============================================
    // Pass 3: Analyze each module in dependency order
    const compilationOrder = depGraph.getTopologicalOrder();
    const moduleResults = new Map<string, ModuleAnalysisResult>();

    for (const moduleName of compilationOrder) {
      const program = registry.get(moduleName);

      // Use EXISTING per-module analysis (no changes!)
      const result = this.analyzeModule(program);
      moduleResults.set(moduleName, result);
    }

    // ============================================
    // PHASE C: Cross-Module Integration
    // ============================================
    // Pass 4: Build global symbol table
    const globalSymbols = this.buildGlobalSymbolTable(programs, moduleResults, registry);

    // Pass 5: Validate cross-module references
    const crossModuleErrors = this.validateCrossModule(programs, globalSymbols, depGraph);

    // ============================================
    // PHASE D: Global Resource Management
    // ============================================
    // Pass 6: Allocate global resources
    const memoryLayout = this.allocateGlobalResources(programs, globalSymbols);

    return {
      modules: moduleResults,
      globalSymbolTable: globalSymbols,
      dependencyGraph: depGraph,
      memoryLayout: memoryLayout,
      diagnostics: this.collectAllDiagnostics(),
      success: !this.hasErrors(),
    };
  }

  // KEEP EXISTING (reuse for per-module analysis)
  private analyzeModule(ast: Program): ModuleAnalysisResult {
    // Existing Passes 1-5 logic - NO CHANGES!
    this.runPass1_SymbolTableBuilder(ast);
    this.runPass2_TypeResolution(ast);
    this.runPass3_TypeChecker(ast);
    this.runPass5_ControlFlowAnalyzer(ast);
    return { symbolTable, typeSystem, cfgs, diagnostics };
  }
}
```

---

## **📅 Implementation Timeline (3 Weeks)**

### **Week 1: Core Multi-Module Infrastructure**

| Task  | Description                 | Duration | Tests |
| ----- | --------------------------- | -------- | ----- |
| 6.1.1 | Refactor analyzer signature | 1 day    | 20    |
| 6.1.2 | Module registry             | 1 day    | 15    |
| 6.1.3 | Dependency graph builder    | 2 days   | 25    |
| 6.1.4 | Import resolver             | 2 days   | 20    |

**Week 1 Deliverable**: Can discover modules, build dependency graph, detect circular imports

### **Week 2: Global Symbol Management**

| Task  | Description              | Duration | Tests |
| ----- | ------------------------ | -------- | ----- |
| 6.2.1 | Global symbol table      | 3 days   | 30    |
| 6.2.2 | Module analysis ordering | 2 days   | 15    |
| 6.2.3 | Cross-module validation  | 2 days   | 20    |

**Week 2 Deliverable**: Can resolve imports, validate exports, cross-module symbol lookup

### **Week 3: Global Resource Allocation**

| Task  | Description               | Duration | Tests |
| ----- | ------------------------- | -------- | ----- |
| 6.3.1 | Memory layout builder     | 2 days   | 20    |
| 6.3.2 | @map conflict detection   | 1 day    | 15    |
| 6.3.3 | Storage class enforcement | 1 day    | 10    |
| 6.3.4 | Integration & E2E tests   | 3 days   | 30    |

**Week 3 Deliverable**: Complete multi-module analysis with global resource management

---

## **📋 Detailed Task Breakdown**

### **Task 6.1.1: Refactor SemanticAnalyzer Signature** (Day 1)

**Goal**: Change analyzer to accept multiple programs

**Implementation:**

```typescript
// packages/compiler/src/semantic/analyzer.ts

/**
 * Result of analyzing a single module
 */
export interface ModuleAnalysisResult {
  moduleName: string;
  symbolTable: SymbolTable;
  typeSystem: TypeSystem;
  cfgs: Map<string, ControlFlowGraph>;
  diagnostics: Diagnostic[];
}

/**
 * Result of multi-module analysis
 */
export interface MultiModuleAnalysisResult {
  /** Per-module analysis results */
  modules: Map<string, ModuleAnalysisResult>;

  /** Global symbol table (all exports from all modules) */
  globalSymbolTable: GlobalSymbolTable;

  /** Module dependency graph */
  dependencyGraph: DependencyGraph;

  /** Global memory layout */
  memoryLayout: GlobalMemoryLayout;

  /** All diagnostics from all modules */
  diagnostics: Diagnostic[];

  /** True if no errors */
  success: boolean;
}

export class SemanticAnalyzer {
  /**
   * Analyze multiple modules together
   *
   * @param programs - Array of parsed Program ASTs
   * @returns Complete multi-module analysis results
   */
  public analyze(programs: Program[]): MultiModuleAnalysisResult {
    // Implementation in subsequent tasks
  }

  /**
   * Analyze a single module (internal use)
   *
   * Reuses existing Passes 1-5 logic without changes
   */
  protected analyzeModule(ast: Program): ModuleAnalysisResult {
    // Existing logic - just extract into separate method
    this.runPass1_SymbolTableBuilder(ast);
    // ... rest of existing passes
  }
}
```

**Testing:**

- Update all existing tests to use `analyze([program])`
- Verify single-module tests still pass
- Add multi-module skeleton tests

**Deliverable**: Analyzer accepts `Program[]`, backward compatible

---

### **Task 6.1.2: Module Registry** (Day 2)

**Goal**: Track all modules by name

**Implementation:**

```typescript
// packages/compiler/src/semantic/module-registry.ts

/**
 * Module registry tracks all parsed modules by name
 */
export class ModuleRegistry {
  private modules: Map<string, Program> = new Map();

  /**
   * Register a module
   * @throws Error if module name already registered
   */
  register(name: string, ast: Program): void {
    if (this.modules.has(name)) {
      throw new Error(`Duplicate module: ${name}`);
    }
    this.modules.set(name, ast);
  }

  /**
   * Get a module by name
   */
  getModule(name: string): Program | undefined {
    return this.modules.get(name);
  }

  /**
   * Check if module exists
   */
  hasModule(name: string): boolean {
    return this.modules.has(name);
  }

  /**
   * Get all module names
   */
  getModuleNames(): string[] {
    return Array.from(this.modules.keys());
  }

  /**
   * Get all modules
   */
  getAllModules(): Map<string, Program> {
    return new Map(this.modules);
  }
}
```

**Usage in Analyzer:**

```typescript
protected buildModuleRegistry(programs: Program[]): ModuleRegistry {
  const registry = new ModuleRegistry();

  for (const program of programs) {
    const moduleName = program.getModule().getFullName();

    try {
      registry.register(moduleName, program);
    } catch (error) {
      this.reportError(
        DiagnosticCode.DUPLICATE_MODULE,
        `Duplicate module declaration: ${moduleName}`
      );
    }
  }

  return registry;
}
```

**Testing:**

- Register modules successfully
- Detect duplicate module names
- Lookup modules by name
- Handle empty module list

**Deliverable**: `ModuleRegistry` class, integrated into analyzer

---

### **Task 6.1.3: Dependency Graph Builder** (Days 3-4)

**Goal**: Build module dependency graph with cycle detection

**Implementation:**

```typescript
// packages/compiler/src/semantic/dependency-graph.ts

export interface DependencyEdge {
  from: string;
  to: string;
  importLocation: SourceLocation;
}

/**
 * Module dependency graph
 *
 * Tracks which modules import which other modules.
 * Provides cycle detection and topological sorting.
 */
export class DependencyGraph {
  private edges: DependencyEdge[] = [];
  private adjacencyList: Map<string, string[]> = new Map();

  /**
   * Add a dependency edge
   */
  addEdge(from: string, to: string, location: SourceLocation): void {
    this.edges.push({ from, to, importLocation: location });

    if (!this.adjacencyList.has(from)) {
      this.adjacencyList.set(from, []);
    }
    this.adjacencyList.get(from)!.push(to);
  }

  /**
   * Detect circular dependencies
   *
   * @returns Array of cycles (each cycle is array of module names)
   */
  detectCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const node of this.adjacencyList.keys()) {
      if (!visited.has(node)) {
        this.detectCyclesHelper(node, visited, recursionStack, [], cycles);
      }
    }

    return cycles;
  }

  private detectCyclesHelper(
    node: string,
    visited: Set<string>,
    recursionStack: Set<string>,
    path: string[],
    cycles: string[][]
  ): void {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const neighbors = this.adjacencyList.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        this.detectCyclesHelper(neighbor, visited, recursionStack, path, cycles);
      } else if (recursionStack.has(neighbor)) {
        // Found cycle
        const cycleStart = path.indexOf(neighbor);
        const cycle = path.slice(cycleStart);
        cycle.push(neighbor); // Close the cycle
        cycles.push(cycle);
      }
    }

    path.pop();
    recursionStack.delete(node);
  }

  /**
   * Get topological order for compilation
   *
   * @returns Module names in dependency order (leaves first)
   * @throws Error if graph has cycles
   */
  getTopologicalOrder(): string[] {
    const cycles = this.detectCycles();
    if (cycles.length > 0) {
      throw new Error(`Cannot compute topological order: circular dependencies exist`);
    }

    const visited = new Set<string>();
    const stack: string[] = [];

    for (const node of this.adjacencyList.keys()) {
      if (!visited.has(node)) {
        this.topologicalSortHelper(node, visited, stack);
      }
    }

    return stack.reverse();
  }

  private topologicalSortHelper(node: string, visited: Set<string>, stack: string[]): void {
    visited.add(node);

    const neighbors = this.adjacencyList.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        this.topologicalSortHelper(neighbor, visited, stack);
      }
    }

    stack.push(node);
  }

  /**
   * Get dependencies of a module
   */
  getModuleDependencies(moduleName: string): string[] {
    return this.adjacencyList.get(moduleName) || [];
  }

  /**
   * Check if graph has cycles
   */
  hasCycles(): boolean {
    return this.detectCycles().length > 0;
  }

  /**
   * Get all dependency edges
   */
  getEdges(): DependencyEdge[] {
    return [...this.edges];
  }
}
```

**Usage in Analyzer:**

```typescript
protected buildDependencyGraph(
  programs: Program[],
  registry: ModuleRegistry
): DependencyGraph {
  const graph = new DependencyGraph();

  for (const program of programs) {
    const moduleName = program.getModule().getFullName();

    // Extract all import declarations
    const imports = program.getDeclarations()
      .filter(d => d instanceof ImportDecl) as ImportDecl[];

    for (const imp of imports) {
      const targetModule = imp.getModuleName();
      graph.addEdge(moduleName, targetModule, imp.getLocation());
    }
  }

  // Check for cycles immediately (fail-fast)
  const cycles = graph.detectCycles();
  if (cycles.length > 0) {
    for (const cycle of cycles) {
      this.reportError(
        DiagnosticCode.CIRCULAR_IMPORT,
        `Circular import detected: ${cycle.join(' → ')}`
      );
    }
  }

  return graph;
}
```

**Testing:**

- Build graph from imports
- Detect simple cycles (A → B → A)
- Detect complex cycles (A → B → C → A)
- Topological sort (no cycles)
- Handle disconnected components
- Empty graph

**Deliverable**: `DependencyGraph` class with cycle detection and topological sort

---

### **Task 6.1.4: Import Resolver** (Days 5-6)

**Goal**: Validate imports resolve to actual modules

**Implementation:**

```typescript
// packages/compiler/src/semantic/import-resolver.ts

export interface ResolvedImport {
  fromModule: string;
  toModule: string;
  importedIdentifiers: string[];
  importDecl: ImportDecl;
}

/**
 * Import resolver validates and resolves imports
 */
export class ImportResolver {
  constructor(private registry: ModuleRegistry) {}

  /**
   * Validate all imports across all modules
   *
   * @returns Array of diagnostics (errors for missing modules)
   */
  validateAllImports(programs: Program[]): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const program of programs) {
      const moduleName = program.getModule().getFullName();
      const errors = this.validateModuleImports(program, moduleName);
      diagnostics.push(...errors);
    }

    return diagnostics;
  }

  /**
   * Validate imports for a single module
   */
  private validateModuleImports(program: Program, moduleName: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    const imports = program.getDeclarations().filter(d => d instanceof ImportDecl) as ImportDecl[];

    for (const imp of imports) {
      const targetModule = imp.getModuleName();

      // Check if target module exists
      if (!this.registry.hasModule(targetModule)) {
        diagnostics.push(
          this.createError(
            DiagnosticCode.MODULE_NOT_FOUND,
            `Module '${targetModule}' not found (imported by '${moduleName}')`,
            imp.getLocation()
          )
        );
      }
    }

    return diagnostics;
  }

  /**
   * Resolve all imports (for later symbol validation)
   */
  resolveImports(programs: Program[]): ResolvedImport[] {
    const resolved: ResolvedImport[] = [];

    for (const program of programs) {
      const moduleName = program.getModule().getFullName();
      const imports = program
        .getDeclarations()
        .filter(d => d instanceof ImportDecl) as ImportDecl[];

      for (const imp of imports) {
        const targetModule = imp.getModuleName();

        if (this.registry.hasModule(targetModule)) {
          resolved.push({
            fromModule: moduleName,
            toModule: targetModule,
            importedIdentifiers: imp.getIdentifiers(),
            importDecl: imp,
          });
        }
      }
    }

    return resolved;
  }

  private createError(code: DiagnosticCode, message: string, location: SourceLocation): Diagnostic {
    return {
      code,
      severity: 'error',
      message,
      location,
    };
  }
}
```

**Usage in Analyzer:**

```typescript
protected validateImports(
  programs: Program[],
  registry: ModuleRegistry
): Diagnostic[] {
  const resolver = new ImportResolver(registry);
  const errors = resolver.validateAllImports(programs);

  // Fail-fast on missing modules
  if (errors.length > 0) {
    this.diagnostics.push(...errors);
  }

  return errors;
}
```

**Testing:**

- Validate existing modules (pass)
- Detect missing modules (error)
- Multiple imports from same module
- Import from non-existent module
- Empty import list

**Deliverable**: `ImportResolver` class, integrated into analyzer

---

## **Week 1 Milestone Checklist**

After completing Tasks 6.1.1 through 6.1.4:

- [ ] Analyzer accepts `Program[]`
- [ ] Module registry tracks all modules
- [ ] Dependency graph built from imports
- [ ] Circular imports detected (fail-fast)
- [ ] Missing modules detected (fail-fast)
- [ ] Topological sort provides compilation order
- [ ] All 80+ tests passing
- [ ] Backward compatibility maintained

**Verification Test:**

```typescript
const programs = [
  parseModule('module A import foo from B'),
  parseModule('module B export function foo()'),
  parseModule('module C import bar from D'), // Missing D - should fail
];

const analyzer = new SemanticAnalyzer();
const result = analyzer.analyze(programs);

expect(result.success).toBe(false);
expect(result.diagnostics).toContainError("Module 'D' not found");
```

---

## **🎯 Success Criteria**

### **Phase 6 Complete When:**

✅ **Core Infrastructure:**

- Analyzer accepts `Program[]` and returns `MultiModuleAnalysisResult`
- Module registry tracks all modules
- Dependency graph with cycle detection works
- Import resolver validates module existence

✅ **Symbol Management:**

- Global symbol table aggregates all module symbols
- Cross-module symbol lookup works
- Import/export validation complete

✅ **Resource Management:**

- Zero page allocated globally across modules
- @map conflicts detected between modules
- Memory layout respects 6502 constraints

✅ **Quality:**

- 150+ tests passing
- Snake game example compiles
- Error messages are helpful and accurate
- Performance acceptable (<1s for typical projects)

✅ **Backward Compatibility:**

- Single-module tests still pass
- Existing visitors (Phases 1-5) unchanged
- API migration path documented

---

## **📊 Testing Strategy**

### **Test Categories:**

1. **Unit Tests** (100+)
   - Module registry operations
   - Dependency graph algorithms
   - Import resolution logic
   - Symbol table operations

2. **Integration Tests** (30+)
   - Multi-module analysis end-to-end
   - Cross-module import/export
   - Global resource allocation
   - Error handling

3. **Real-World Tests** (20+)
   - Snake game example
   - System library (c64.\* modules)
   - Complex dependency chains
   - Large projects

4. **Regression Tests**
   - All Phase 0-5 tests still pass
   - Single-module analysis unchanged
   - Existing API contracts maintained

---

## **🚧 Known Challenges & Mitigations**

### **Challenge 1: Zero Page Overflow**

**Problem**: Only 112 bytes available, easy to exceed with multiple modules

**Mitigation:**

- Track usage across all modules
- Warn at 80% capacity
- Error at overflow
- Suggest @ram as alternative

### **Challenge 2: Circular Import False Positives**

**Problem**: Complex import chains might trigger false cycle detection

**Mitigation:**

- Use proper DFS cycle detection algorithm
- Test with real-world patterns
- Clear error messages showing full cycle

### **Challenge 3: Performance with Many Modules**

**Problem**: Large projects (100+ modules) might be slow

**Mitigation:**

- Profile hot paths
- Cache dependency graph
- Parallel per-module analysis (future)
- Incremental compilation (future)

---

## **📚 References**

### **Industry Comparisons:**

- **TypeScript**: Roslyn-style unified compilation
- **Rust**: HIR/MIR multi-level IR
- **C#**: Compilation object with semantic model
- **Go**: Package-level type checking

### **Related Documents:**

- `semantic-analyzer-overview.md` - Architecture overview
- `docs/language-specification/04-module-system.md` - Module system spec
- `plans/semantic-analyzer-phase0-walker.md` - AST walker infrastructure

---

## **Next Steps After Phase 6**

### **Phase 7: Advanced Cross-Module Analysis** (1 week)

- Unused import detection
- Unused export detection
- Dead code elimination hints
- Optimization opportunities

### **Phase 8: Polish & Documentation** (1 week)

- Performance optimization
- Error message quality
- API documentation
- Production readiness

**Total Remaining**: ~5 weeks until semantic analyzer production-ready

---

**Ready to begin implementation! Start with Task 6.1.1 (Refactor Analyzer Signature).**
