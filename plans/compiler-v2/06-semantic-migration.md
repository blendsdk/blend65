# Semantic Migration: Compiler v2

> **Document**: 06-semantic-migration.md  
> **Parent**: [Index](00-index.md)  
> **Status**: Planning Complete

## Overview

The semantic analyzer performs type checking, symbol resolution, and validation after parsing. In v2, we need to:
1. Remove all SSA preparation code
2. Remove @map type handling
3. Add **call graph building** for SFA
4. Add **recursion detection** (compile error)

## Migration Strategy

**Reuse**: 60%

**Changes Required**:
1. Remove SSA-related code (PHI preparation, versioning)
2. Remove @map symbol and type handling
3. Add call graph builder (NEW)
4. Add recursion detection (NEW)
5. Update memory layout for SFA frames

---

## Source Files

### Files to Copy As-Is

| v1 File | v2 File | Notes |
|---------|---------|-------|
| `semantic/type-system.ts` | `semantic/type-system.ts` | Core types |
| `semantic/types.ts` | `semantic/types.ts` | Type interfaces |
| `semantic/symbol.ts` | `semantic/symbol.ts` | Symbol class |
| `semantic/scope.ts` | `semantic/scope.ts` | Scope class |

### Files to Copy With Changes

| v1 File | v2 File | Changes |
|---------|---------|---------|
| `semantic/symbol-table.ts` | `semantic/symbol-table.ts` | Remove SSA prep |
| `semantic/analyzer.ts` | `semantic/analyzer.ts` | Major cleanup |
| `semantic/memory-layout.ts` | `semantic/memory-layout.ts` | Adapt for SFA |

### New Files to Create

| v2 File | Description |
|---------|-------------|
| `semantic/call-graph.ts` | Build function call graph |
| `semantic/recursion-check.ts` | Detect recursion cycles |

### Files to NOT Copy

| v1 File | Reason |
|---------|--------|
| Any SSA-specific files | Not needed in SFA |
| PHI-related analysis | Not needed in SFA |

---

## Key Changes

### 1. Remove SSA Preparation

The v1 semantic analyzer prepares for SSA by:
- Tracking variable versions
- Identifying phi node insertion points
- Building dominance information

**Remove all of this**. In SFA, variables have static addresses - no versioning needed.

```typescript
// REMOVE code like:
// - prepareForSSA()
// - calculateDominators()
// - identifyPhiPoints()
// - versionVariables()

// KEEP code like:
// - type checking
// - symbol resolution
// - scope management
// - error reporting
```

### 2. Remove @map Handling

```typescript
// REMOVE from analyzer.ts:
// - visitMapDeclaration()
// - validateMapAddress()
// - registerMapSymbol()

// REMOVE from symbol-table.ts:
// - MapSymbol type (if separate)
// - @map-specific symbol registration

// REMOVE from type-system.ts:
// - Any @map-specific type handling
```

### 3. Add Call Graph Building (NEW)

The call graph tracks which functions call which:

```typescript
// semantic/call-graph.ts

export interface CallGraphNode {
  /** Function name */
  name: string;
  /** Functions this function calls */
  callees: Set<string>;
  /** Functions that call this function */
  callers: Set<string>;
}

export interface CallGraph {
  /** All functions in the program */
  nodes: Map<string, CallGraphNode>;
  /** Entry point (usually "main") */
  entryPoint: string | null;
}

export class CallGraphBuilder {
  private graph: CallGraph = {
    nodes: new Map(),
    entryPoint: null,
  };

  /**
   * Build call graph from AST.
   */
  build(module: ModuleDeclaration): CallGraph {
    // Pass 1: Register all functions
    for (const decl of module.declarations) {
      if (isFunctionDeclaration(decl)) {
        this.registerFunction(decl.name);
        if (decl.name === 'main') {
          this.graph.entryPoint = 'main';
        }
      }
    }

    // Pass 2: Analyze function bodies for calls
    for (const decl of module.declarations) {
      if (isFunctionDeclaration(decl)) {
        this.analyzeFunction(decl);
      }
    }

    return this.graph;
  }

  protected registerFunction(name: string): void {
    if (!this.graph.nodes.has(name)) {
      this.graph.nodes.set(name, {
        name,
        callees: new Set(),
        callers: new Set(),
      });
    }
  }

  protected analyzeFunction(func: FunctionDeclaration): void {
    const callerName = func.name;
    
    // Walk the function body looking for call expressions
    this.walkForCalls(func.body, callerName);
  }

  protected walkForCalls(node: ASTNode, callerName: string): void {
    if (isCallExpression(node)) {
      const calleeName = this.getCalleeName(node);
      if (calleeName && this.graph.nodes.has(calleeName)) {
        // Record the call edge
        this.graph.nodes.get(callerName)!.callees.add(calleeName);
        this.graph.nodes.get(calleeName)!.callers.add(callerName);
      }
    }

    // Recursively walk children
    for (const child of node.getChildren()) {
      this.walkForCalls(child, callerName);
    }
  }

  protected getCalleeName(call: CallExpression): string | null {
    if (isIdentifierExpression(call.callee)) {
      return call.callee.name;
    }
    return null; // Indirect call or method call
  }
}
```

### 4. Add Recursion Detection (NEW)

Recursion is forbidden in SFA. Detect both direct and indirect recursion:

```typescript
// semantic/recursion-check.ts

export interface RecursionError {
  /** Type of recursion */
  type: 'direct' | 'indirect';
  /** Function that recurses */
  function: string;
  /** Cycle path (for indirect recursion) */
  cycle: string[];
  /** Source location */
  location: SourceLocation;
}

export class RecursionChecker {
  /**
   * Check call graph for recursion cycles.
   * Returns errors for any recursion found.
   */
  check(callGraph: CallGraph): RecursionError[] {
    const errors: RecursionError[] = [];

    for (const [name, node] of callGraph.nodes) {
      // Check for direct recursion (function calls itself)
      if (node.callees.has(name)) {
        errors.push({
          type: 'direct',
          function: name,
          cycle: [name, name],
          location: this.getFunctionLocation(name),
        });
        continue; // Don't also report indirect
      }

      // Check for indirect recursion (A → B → ... → A)
      const cycle = this.findCycle(callGraph, name);
      if (cycle.length > 0) {
        errors.push({
          type: 'indirect',
          function: name,
          cycle,
          location: this.getFunctionLocation(name),
        });
      }
    }

    return errors;
  }

  /**
   * Find a cycle starting from the given function.
   * Returns the cycle path, or empty array if no cycle.
   */
  protected findCycle(graph: CallGraph, start: string): string[] {
    const visited = new Set<string>();
    const path: string[] = [];

    const dfs = (current: string): string[] | null => {
      if (path.includes(current)) {
        // Found cycle - extract it
        const cycleStart = path.indexOf(current);
        return [...path.slice(cycleStart), current];
      }

      if (visited.has(current)) {
        return null; // Already fully explored
      }

      visited.add(current);
      path.push(current);

      const node = graph.nodes.get(current);
      if (node) {
        for (const callee of node.callees) {
          if (graph.nodes.has(callee)) { // Only user functions
            const cycle = dfs(callee);
            if (cycle) return cycle;
          }
        }
      }

      path.pop();
      return null;
    };

    return dfs(start) || [];
  }

  protected getFunctionLocation(name: string): SourceLocation {
    // Implementation depends on how you store function locations
    // This would query the symbol table
    return { line: 0, column: 0 }; // Placeholder
  }
}
```

### 5. Error Messages for Recursion

```typescript
// In error-messages.ts or diagnostics:

export function recursionError(error: RecursionError): Diagnostic {
  if (error.type === 'direct') {
    return {
      severity: 'error',
      code: 'E0100',
      message: `Recursion not allowed: function '${error.function}' calls itself`,
      location: error.location,
      notes: [
        'Blend65 uses static frame allocation which doesn\'t support recursion.',
        'Use iteration (while/for loops) instead of recursion.',
      ],
    };
  } else {
    const cyclePath = error.cycle.join(' → ');
    return {
      severity: 'error',
      code: 'E0101',
      message: `Indirect recursion not allowed: ${cyclePath}`,
      location: error.location,
      notes: [
        'Blend65 uses static frame allocation which doesn\'t support recursion.',
        'Restructure your code to avoid circular function calls.',
      ],
    };
  }
}
```

---

## Updated Semantic Pipeline

```
AST
 │
 ▼
┌──────────────────────────┐
│ 1. Symbol Registration    │  Register all declarations
└──────────────────────────┘
 │
 ▼
┌──────────────────────────┐
│ 2. Type Checking          │  Validate types, resolve symbols
└──────────────────────────┘
 │
 ▼
┌──────────────────────────┐
│ 3. Call Graph Building    │  (NEW) Build function call graph
└──────────────────────────┘
 │
 ▼
┌──────────────────────────┐
│ 4. Recursion Check        │  (NEW) Detect direct/indirect recursion
└──────────────────────────┘
 │
 ▼
┌──────────────────────────┐
│ 5. Validation             │  Other semantic checks
└──────────────────────────┘
 │
 ▼
Typed AST + Call Graph
```

---

## Migration Tasks

### Session 5.1: Copy Semantic Base

| # | Task | File | Description |
|---|------|------|-------------|
| 5.1.1 | Copy type-system.ts | `semantic/type-system.ts` | Type utilities |
| 5.1.2 | Copy types.ts | `semantic/types.ts` | Type interfaces |
| 5.1.3 | Copy symbol.ts | `semantic/symbol.ts` | Symbol class |
| 5.1.4 | Copy scope.ts | `semantic/scope.ts` | Scope class |

### Session 5.2: Adapt Semantic Analysis

| # | Task | File | Description |
|---|------|------|-------------|
| 5.2.1 | Copy symbol-table.ts | `semantic/symbol-table.ts` | Symbol table |
| 5.2.2 | Remove SSA code | `semantic/symbol-table.ts` | Clean up |
| 5.2.3 | Copy analyzer.ts | `semantic/analyzer.ts` | Main analyzer |
| 5.2.4 | Remove SSA code | `semantic/analyzer.ts` | Clean up |
| 5.2.5 | Remove @map handling | `semantic/*.ts` | All files |

### Session 5.3: Add Recursion Detection

| # | Task | File | Description |
|---|------|------|-------------|
| 5.3.1 | Create call-graph.ts | `semantic/call-graph.ts` | Call graph builder |
| 5.3.2 | Create recursion-check.ts | `semantic/recursion-check.ts` | Recursion detector |
| 5.3.3 | Integrate into analyzer | `semantic/analyzer.ts` | Wire up new code |
| 5.3.4 | Add error messages | `semantic/` | Recursion errors |

### Session 5.4: Tests and Verification

| # | Task | File | Description |
|---|------|------|-------------|
| 5.4.1 | Copy semantic tests | `__tests__/semantic/` | Base tests |
| 5.4.2 | Remove @map tests | `__tests__/semantic/` | Clean up |
| 5.4.3 | Add call graph tests | `__tests__/semantic/` | New tests |
| 5.4.4 | Add recursion tests | `__tests__/semantic/` | New tests |
| 5.4.5 | Create index.ts | `semantic/index.ts` | Exports |
| 5.4.6 | Run all tests | - | Verify |

---

## Intrinsic Function Validation

The semantic analyzer must validate intrinsic function calls:

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

// asm_* functions (56 opcodes) - validate addressing mode usage
const ASM_INTRINSICS: Map<string, AsmIntrinsicSignature> = new Map([
  ['asm_lda_imm', { opcode: 'LDA', mode: 'immediate', param: 'byte' }],
  ['asm_lda_abs', { opcode: 'LDA', mode: 'absolute', param: 'word' }],
  ['asm_sta_abs', { opcode: 'STA', mode: 'absolute', param: 'word' }],
  // ... 53 more
]);
```

---

## Verification Checklist

After migration, verify:

- [ ] Type checking works correctly
- [ ] Symbol resolution works correctly
- [ ] Scope management works correctly
- [ ] Call graph builds correctly
- [ ] Direct recursion detected
- [ ] Indirect recursion detected
- [ ] Recursion errors have good messages
- [ ] No SSA-related code remains
- [ ] No @map-related code remains
- [ ] Intrinsic validation works
- [ ] All tests pass

---

## Related Documents

| Document | Description |
|----------|-------------|
| [05-parser-migration.md](05-parser-migration.md) | Parser that provides AST |
| [07-frame-allocator.md](07-frame-allocator.md) | Next: Frame allocation |
| [99-execution-plan.md](99-execution-plan.md) | Full task list |