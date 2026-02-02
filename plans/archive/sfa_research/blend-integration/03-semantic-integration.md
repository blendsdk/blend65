# Blend Integration: Semantic Analyzer Integration

> **Document**: blend-integration/03-semantic-integration.md
> **Parent**: [00-overview.md](00-overview.md)
> **Status**: Design Complete
> **Last Updated**: 2025-02-01

## Overview

This document describes how the Frame Allocator integrates with the Semantic Analyzer in Blend65 compiler-v2. The semantic analyzer is the **primary integration point** for SFA - it's where frame allocation is computed after type checking and call graph construction.

---

## Integration Point in Semantic Pipeline

The semantic analyzer runs multiple passes. Frame allocation occurs after Pass 6:

```
┌────────────────────────────────────────────────────────────────────┐
│                     SEMANTIC ANALYZER PIPELINE                      │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Pass 1: Symbol Table Builder                                      │
│  ────────────────────────────                                      │
│  • Collect all declarations                                        │
│  • Build scope tree                                                │
│  • Register symbols                                                │
│                                                                    │
│  Pass 2: Type Resolution                                           │
│  ───────────────────────                                           │
│  • Resolve type annotations                                        │
│  • Annotate symbols with types                                     │
│                                                                    │
│  Pass 3: Type Checking                                             │
│  ──────────────────────                                            │
│  • Type check expressions                                          │
│  • Validate assignments                                            │
│  • Check function calls                                            │
│                                                                    │
│  Pass 5: Control Flow Analysis                                     │
│  ────────────────────────────                                      │
│  • Build CFGs                                                      │
│  • Dead code detection                                             │
│                                                                    │
│  Pass 6: Call Graph & Recursion                                    │
│  ──────────────────────────────                                    │
│  • Build function call graph                                       │
│  • DETECT RECURSION (compile error!)                               │
│  │                                                                 │
│  │  ┌────────────────────────────────────────────────────────────┐│
│  │  │ 🚫 RECURSION CHECK - MUST PASS BEFORE FRAME ALLOCATION     ││
│  │  │                                                            ││
│  │  │ If recursion detected:                                     ││
│  │  │   → Emit error: "Recursion not allowed"                    ││
│  │  │   → STOP - do not proceed to frame allocation              ││
│  │  │                                                            ││
│  │  │ If no recursion:                                           ││
│  │  │   → Continue to frame allocation                           ││
│  │  └────────────────────────────────────────────────────────────┘│
│  │                                                                 │
│  ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │       ★★★ FRAME ALLOCATION (NEW INTEGRATION POINT) ★★★       │   │
│  │                                                              │   │
│  │  Input:                                                      │   │
│  │    • Program AST (type-resolved)                             │   │
│  │    • Symbol Table                                            │   │
│  │    • Call Graph (from Pass 6)                                │   │
│  │    • Platform Config (C64, X16, etc.)                        │   │
│  │                                                              │   │
│  │  Processing:                                                 │   │
│  │    1. Build enhanced call graph with coalesce groups         │   │
│  │    2. Calculate frame sizes for each function                │   │
│  │    3. Assign frame base addresses                            │   │
│  │    4. Allocate zero page slots by priority                   │   │
│  │    5. Build final FrameMap                                   │   │
│  │                                                              │   │
│  │  Output:                                                     │   │
│  │    • FrameMap with all addresses resolved                    │   │
│  │    • Allocation diagnostics (errors, warnings)               │   │
│  │    • Statistics (bytes used, bytes saved, etc.)              │   │
│  └──────────────────────────────────────┬───────────────────────┘   │
│                                         │                          │
│                                         ▼                          │
│  Pass 7: Advanced Analysis                                         │
│  ─────────────────────────                                         │
│  • Definite assignment                                             │
│  • Variable usage                                                  │
│  • 6502 optimization hints (uses frame info!)                      │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## When to Call FrameAllocator

### Timing Requirements

1. **AFTER** type resolution (Pass 2) - need type sizes
2. **AFTER** type checking (Pass 3) - need valid program
3. **AFTER** call graph construction (Pass 6) - need function relationships
4. **AFTER** recursion check - must verify no recursion first
5. **BEFORE** advanced analysis (Pass 7) - provides frame info for hints

### Trigger Conditions

```typescript
// In SemanticAnalyzer.analyze():

// Passes 1-6 run first...
this.runPass1_SymbolTableBuilder(ast);
this.runPass2_TypeResolution(ast);
this.runPass3_TypeChecker(ast);
this.runPass5_ControlFlowAnalyzer(ast);
this.runPass6_CallGraphAndRecursion(ast);

// Check for recursion before frame allocation
if (this.recursionChecker.hasRecursion()) {
  // Recursion errors already added to diagnostics
  // DO NOT proceed with frame allocation
  return this.buildResult(); // Early return with errors
}

// ★ FRAME ALLOCATION - only if no recursion ★
this.frameMap = this.runFrameAllocation(ast);

// Pass 7 can use frame info
this.runPass7_AdvancedAnalysis(ast);
```

---

## SemanticAnalyzer Modifications

### New Dependencies

```typescript
// semantic/analyzer.ts

import { FrameAllocator, AllocatorConfigBuilder } from '../frame/index.js';
import type { FrameMap, AllocatorResult } from '../frame/types.js';
```

### New Instance Variables

```typescript
export class SemanticAnalyzer {
  // Existing...
  protected symbolTable: SymbolTable;
  protected typeSystem: TypeSystem;
  protected callGraph: CallGraph;
  protected diagnostics: Diagnostic[];
  
  // NEW: Frame allocation
  protected frameAllocator: FrameAllocator | null = null;
  protected frameMap: FrameMap | null = null;
  protected platformConfig: PlatformConfig;
  
  constructor(platformConfig: PlatformConfig = C64_CONFIG) {
    // ...existing initialization...
    this.platformConfig = platformConfig;
  }
}
```

### New Method: runFrameAllocation

```typescript
/**
 * Run frame allocation after call graph is built and recursion is checked.
 * 
 * Prerequisites:
 * - Call graph must be built (Pass 6)
 * - Recursion must be checked (no recursive functions)
 * - Symbol table must have all function/variable declarations
 * 
 * @param ast - The type-resolved AST
 * @returns FrameMap with allocated frames, or null if allocation fails
 */
protected runFrameAllocation(ast: Program): FrameMap | null {
  // Build allocator configuration from platform config
  const config = new AllocatorConfigBuilder()
    .forPlatform(this.platformConfig.target)
    .withFrameRegion(
      this.platformConfig.frameRegionStart,
      this.platformConfig.frameRegionEnd
    )
    .withZpRegion(
      this.platformConfig.zpStart,
      this.platformConfig.zpEnd
    )
    .enableCoalescing(true)
    .build();
  
  // Create allocator
  this.frameAllocator = new FrameAllocator(config);
  
  // Run allocation
  const result = this.frameAllocator.allocate(ast, this.accessAnalysis);
  
  // Merge diagnostics
  this.diagnostics.push(...result.diagnostics);
  
  // Check for errors
  if (result.hasErrors) {
    return null;
  }
  
  // Store and return frame map
  this.frameMap = result.frameMap;
  return this.frameMap;
}
```

### Updated analyze() Method

```typescript
/**
 * Analyze a single module.
 */
analyze(ast: Program): AnalysisResult {
  try {
    // Pass 1: Symbol Table Builder
    this.runPass1_SymbolTableBuilder(ast);
    if (this.hasErrors()) return this.buildResult();
    
    // Pass 2: Type Resolution
    this.runPass2_TypeResolution(ast);
    if (this.hasErrors()) return this.buildResult();
    
    // Pass 3: Type Checking
    this.runPass3_TypeChecker(ast);
    if (this.hasErrors()) return this.buildResult();
    
    // Pass 5: Control Flow Analysis
    this.runPass5_ControlFlowAnalyzer(ast);
    // Control flow warnings don't stop compilation
    
    // Pass 6: Call Graph & Recursion
    this.runPass6_CallGraphAndRecursion(ast);
    if (this.hasErrors()) return this.buildResult();
    
    // ★★★ FRAME ALLOCATION ★★★
    // Only run if no recursion detected
    const frameMap = this.runFrameAllocation(ast);
    if (!frameMap) {
      // Frame allocation failed - errors already in diagnostics
      return this.buildResult();
    }
    
    // Pass 7: Advanced Analysis
    // Pass frame map so hints can use frame information
    this.runPass7_AdvancedAnalysis(ast, frameMap);
    
    return this.buildResult();
  } catch (error) {
    this.addError(
      DiagnosticCode.INTERNAL_ERROR,
      `Semantic analysis failed: ${error.message}`,
      ast.location
    );
    return this.buildResult();
  }
}
```

### Updated AnalysisResult Type

```typescript
/**
 * Result of single-module semantic analysis.
 */
export interface AnalysisResult {
  /** Symbol table with all declarations */
  symbolTable: SymbolTable;
  
  /** Type system used */
  typeSystem: TypeSystem;
  
  /** Function call graph */
  callGraph: CallGraph;
  
  /** Control flow graphs for each function */
  cfgs: Map<string, ControlFlowGraph>;
  
  /** ★ NEW: Frame allocation map */
  frameMap: FrameMap | null;
  
  /** All diagnostics (errors, warnings, hints) */
  diagnostics: Diagnostic[];
  
  /** True if analysis succeeded without errors */
  success: boolean;
}
```

---

## Recursion Detection Integration

### RecursionChecker Interface

The existing recursion checker from Pass 6 provides the input gate for frame allocation:

```typescript
// semantic/recursion-checker.ts

export interface RecursionError {
  type: 'direct' | 'indirect';
  function: string;
  cycle: string[];
  location: SourceLocation;
}

export class RecursionChecker {
  /**
   * Check for recursion in the call graph.
   * 
   * @param callGraph - The function call graph
   * @returns Array of recursion errors (empty if no recursion)
   */
  check(callGraph: CallGraph): RecursionError[];
  
  /**
   * Convert recursion errors to diagnostics.
   */
  toDiagnostics(errors: RecursionError[]): Diagnostic[];
}
```

### Integration with Frame Allocator

```typescript
// In runPass6_CallGraphAndRecursion():

protected runPass6_CallGraphAndRecursion(ast: Program): void {
  // Build call graph
  const builder = new CallGraphBuilder();
  this.callGraph = builder.build(ast);
  
  // Check for recursion
  const recursionChecker = new RecursionChecker();
  const recursionErrors = recursionChecker.check(this.callGraph);
  
  // Add recursion errors to diagnostics
  if (recursionErrors.length > 0) {
    const diagnostics = recursionChecker.toDiagnostics(recursionErrors);
    this.diagnostics.push(...diagnostics);
    // Frame allocation will be skipped due to errors
  }
}
```

### Error Messages

```typescript
// Recursion error messages (from compiler-v2 spec)

// E0100: Direct recursion
{
  code: DiagnosticCode.RECURSION_DIRECT,
  message: `Recursion not allowed: function '${name}' calls itself`,
  severity: DiagnosticSeverity.Error,
  notes: [
    'Blend65 uses static frame allocation which doesn\'t support recursion.',
    'Use iteration (while/for loops) instead of recursion.'
  ]
}

// E0101: Indirect recursion
{
  code: DiagnosticCode.RECURSION_INDIRECT,
  message: `Indirect recursion not allowed: ${cycle.join(' → ')}`,
  severity: DiagnosticSeverity.Error,
  notes: [
    'Blend65 uses static frame allocation which doesn\'t support recursion.',
    'Restructure your code to avoid circular function calls.'
  ]
}
```

---

## Symbol Table Integration

### Accessing Variable Information

The frame allocator needs to access symbol information from the symbol table:

```typescript
// Frame allocator uses symbol table for:

// 1. Getting function declarations
const funcSymbol = symbolTable.lookup(funcName);
const funcDecl = funcSymbol.declaration as FunctionDecl;

// 2. Getting parameter types and sizes
for (const param of funcDecl.parameters) {
  const paramSymbol = symbolTable.lookupLocal(param.name, funcScope);
  const type = paramSymbol.type;
  const size = typeSystem.getSize(type);
}

// 3. Getting local variable declarations
const scope = symbolTable.getFunctionScope(funcName);
const locals = scope.getLocalVariables();
for (const local of locals) {
  const type = local.type;
  const size = typeSystem.getSize(type);
}
```

### Annotating Symbols with Frame Info

After frame allocation, symbols can be annotated with their frame addresses:

```typescript
// Optional: Annotate symbols with allocated addresses
for (const [funcName, frame] of frameMap.frames) {
  for (const slot of frame.slots) {
    const symbol = symbolTable.lookup(slot.name, funcScope);
    if (symbol) {
      // Store frame info in symbol metadata
      symbol.metadata.set('frameSlot', slot);
      symbol.metadata.set('address', frame.frameBaseAddress + slot.offset);
      symbol.metadata.set('location', slot.location); // ZP or RAM
    }
  }
}
```

---

## Access Analysis Integration

### Purpose

Access analysis provides information about how variables are used, which helps ZP scoring:

```typescript
interface AccessAnalysis {
  /** How many times each variable is accessed */
  accessCounts: Map<string, number>;
  
  /** Maximum loop depth for each variable access */
  loopDepths: Map<string, number>;
  
  /** Whether variable is used in pointer operations */
  usedAsPointer: Map<string, boolean>;
  
  /** Whether variable has @zp directive */
  hasZpDirective: Map<string, boolean>;
}
```

### Building Access Analysis

Access analysis is built during type checking or as a separate pass:

```typescript
// Can be part of type checker or separate pass
class AccessAnalyzer extends ASTVisitor<void> {
  protected accessCounts = new Map<string, number>();
  protected loopDepths = new Map<string, number>();
  protected currentLoopDepth = 0;
  
  visitIdentifierExpression(node: IdentifierExpression): void {
    const name = node.name;
    
    // Increment access count
    const count = this.accessCounts.get(name) ?? 0;
    this.accessCounts.set(name, count + 1);
    
    // Track max loop depth
    const currentMax = this.loopDepths.get(name) ?? 0;
    this.loopDepths.set(name, Math.max(currentMax, this.currentLoopDepth));
  }
  
  visitWhileStatement(node: WhileStatement): void {
    this.currentLoopDepth++;
    this.visit(node.condition);
    this.visit(node.body);
    this.currentLoopDepth--;
  }
  
  visitForStatement(node: ForStatement): void {
    this.currentLoopDepth++;
    // ... visit for parts
    this.currentLoopDepth--;
  }
}
```

### Passing to Frame Allocator

```typescript
// Build access analysis during or after type checking
const accessAnalyzer = new AccessAnalyzer();
accessAnalyzer.analyze(ast);
const accessAnalysis = accessAnalyzer.getResult();

// Pass to frame allocator
const result = this.frameAllocator.allocate(ast, accessAnalysis);
```

---

## Error Handling

### Frame Allocation Errors

The frame allocator may produce these errors:

| Error Code | Message | Cause |
|------------|---------|-------|
| E0300 | Frame region overflow | Too many functions/locals |
| E0301 | Zero page overflow | Too many @zp variables |
| E0302 | Invalid @zp size | Variable too large for ZP |
| E0303 | @zp(required) failed | Cannot satisfy @zp requirement |

### Integration with Diagnostic System

```typescript
// Frame allocation errors become semantic errors
if (result.hasErrors) {
  for (const diagnostic of result.diagnostics) {
    // Remap error codes if needed
    const semanticDiagnostic = {
      code: remapFrameErrorCode(diagnostic.code),
      message: diagnostic.message,
      severity: diagnostic.severity,
      location: diagnostic.location,
      notes: diagnostic.notes,
    };
    this.diagnostics.push(semanticDiagnostic);
  }
}
```

---

## Multi-Module Considerations

### Module-Level Frame Allocation

For multi-module programs, each module has its own frame allocation:

```typescript
/**
 * Analyze multiple modules with shared frame region.
 */
analyzeMultiple(programs: Program[]): MultiModuleAnalysisResult {
  // Step 1: Analyze each module individually
  const moduleResults = new Map<string, AnalysisResult>();
  for (const program of programs) {
    const result = this.analyze(program);
    moduleResults.set(program.moduleName, result);
  }
  
  // Step 2: Build global frame allocation
  // All modules share the same frame region
  const globalFrameMap = this.allocateGlobalFrames(moduleResults);
  
  return {
    modules: moduleResults,
    globalFrameMap,
    // ...
  };
}

/**
 * Allocate frames across all modules.
 */
protected allocateGlobalFrames(
  moduleResults: Map<string, AnalysisResult>
): FrameMap {
  // Collect all functions from all modules
  const allFunctions: FunctionInfo[] = [];
  for (const [moduleName, result] of moduleResults) {
    const functions = this.collectFunctions(result);
    allFunctions.push(...functions);
  }
  
  // Build combined call graph
  const combinedCallGraph = this.buildCombinedCallGraph(allFunctions);
  
  // Run frame allocation with combined info
  const allocator = new FrameAllocator(this.config);
  return allocator.allocateMultiModule(allFunctions, combinedCallGraph);
}
```

### Cross-Module Call Graph

When functions call across modules, the call graph must span modules:

```typescript
// Example: main.blend imports utils.blend
// main.main() → utils.helper() → utils.internal()

// Combined call graph:
{
  'main::main': { callees: ['utils::helper'], ... },
  'utils::helper': { callees: ['utils::internal'], callers: ['main::main'], ... },
  'utils::internal': { callers: ['utils::helper'], ... },
}
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('SemanticAnalyzer Frame Allocation', () => {
  describe('runFrameAllocation', () => {
    it('should allocate frames after successful type checking', () => {
      const ast = parseProgram(`
        function add(a: byte, b: byte): byte {
          return a + b;
        }
        function main(): void {
          let x = add(1, 2);
        }
      `);
      
      const result = analyzer.analyze(ast);
      
      expect(result.success).toBe(true);
      expect(result.frameMap).not.toBeNull();
      expect(result.frameMap!.frames.has('add')).toBe(true);
      expect(result.frameMap!.frames.has('main')).toBe(true);
    });
    
    it('should not allocate frames if recursion detected', () => {
      const ast = parseProgram(`
        function recursive(): void {
          recursive(); // Direct recursion
        }
      `);
      
      const result = analyzer.analyze(ast);
      
      expect(result.success).toBe(false);
      expect(result.frameMap).toBeNull();
      expect(result.diagnostics.some(d => 
        d.code === DiagnosticCode.RECURSION_DIRECT
      )).toBe(true);
    });
    
    it('should report frame region overflow', () => {
      // Create program with too many large locals
      const ast = createLargeProgramAST();
      
      const result = analyzer.analyze(ast);
      
      expect(result.success).toBe(false);
      expect(result.diagnostics.some(d =>
        d.code === DiagnosticCode.FRAME_REGION_OVERFLOW
      )).toBe(true);
    });
  });
});
```

### Integration Tests

```typescript
describe('Semantic to IL Integration', () => {
  it('should pass frame map to IL generator', () => {
    const ast = parseProgram(`
      function calculate(x: byte): byte {
        let result: byte = x * 2;
        return result;
      }
    `);
    
    const semanticResult = analyzer.analyze(ast);
    expect(semanticResult.success).toBe(true);
    
    // Frame map should be available for IL generator
    const ilGenerator = new ILGenerator(semanticResult.frameMap!);
    const ilProgram = ilGenerator.generate(ast);
    
    // IL should use frame addresses
    const calcFunc = ilProgram.functions.find(f => f.name === 'calculate');
    expect(calcFunc).toBeDefined();
    expect(calcFunc!.frame.frameBaseAddress).toBeDefined();
  });
});
```

---

## Summary

The semantic analyzer integration is the **primary integration point** for the frame allocator:

1. **Timing**: Frame allocation runs after Pass 6 (call graph), before Pass 7 (advanced analysis)
2. **Prerequisites**: Recursion must be checked first - frame allocation cannot proceed with recursive functions
3. **Input**: AST, symbol table, call graph, platform config, optional access analysis
4. **Output**: FrameMap added to AnalysisResult
5. **Errors**: Frame allocation errors become semantic errors

---

## Related Documents

| Document | Description |
|----------|-------------|
| [00-overview.md](00-overview.md) | Integration overview |
| [02-allocator-impl.md](02-allocator-impl.md) | Allocator implementation |
| [04-il-integration.md](04-il-integration.md) | IL generator integration |
| [05-codegen-integration.md](05-codegen-integration.md) | Code generator integration |
| [../../compiler-v2/06-semantic-migration.md](../../compiler-v2/06-semantic-migration.md) | Compiler v2 semantic spec |