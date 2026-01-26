# Semantic Analyzer Improvement Plan

> **Created:** 2025-01-25
> **Updated:** 2025-01-25
> **Status:** All Phases Complete (Phase 1-3)
> **Priority:** Low (examples now compile successfully)
> **Scope:** Fix critical bugs and improve code quality in the semantic analyzer

---

## Executive Summary

Deep code review of the semantic analyzer revealed **2 critical bugs** causing 11 runtime errors when compiling the example files, plus **5 medium-priority bugs** and **5 code quality issues**. This plan addresses all issues in priority order with clear phases, tasks, and testing requirements.

---

## Phase 1: Critical Bug Fixes (High Priority)

**Context:** These bugs prevent the compiler from processing valid Blend65 code. The example `main.blend` cannot compile due to these issues.

**Reasoning:** Must be fixed first as they block all other development and testing.

**Dependencies:** None (foundational fixes)

**Deliverables:**
- For-loop variables properly typed
- Memory layout correctly extracts map addresses
- All 11 runtime errors resolved
- Example files compile successfully

### Task 1.1: Add visitForStatement to TypeResolver

**Problem:** For-loop variables (e.g., `i` in `for i = 0 to 999`) have type `unknown` because `TypeResolver` has no `visitForStatement()` method.

**File:** `packages/compiler/src/semantic/visitors/type-resolver.ts`

**Implementation:**
```typescript
/**
 * Visit for statement - resolve loop variable type
 * 
 * For-loop variables are implicitly typed based on the range bounds:
 * - If start or end is word → variable is word
 * - Otherwise → variable is byte
 */
public visitForStatement(node: ForStatement): void {
  if (this.shouldStop) return;
  this.enterNode(node);

  // Get the loop variable name
  const varName = node.getVariable();
  
  // Type check start and end expressions to determine loop variable type
  const startType = this.resolveExpression(node.getStart());
  const endType = this.resolveExpression(node.getEnd());
  
  // Loop variable type is the larger of start/end (default to word for safety)
  let varType: TypeInfo;
  if (startType.kind === TypeKind.Word || endType.kind === TypeKind.Word) {
    varType = this.typeSystem.getBuiltinType('word')!;
  } else {
    varType = this.typeSystem.getBuiltinType('byte')!;
  }
  
  // Find the symbol and annotate with resolved type
  const symbol = this.symbolTable.lookup(varName);
  if (symbol) {
    symbol.type = varType;
  }
  
  // Visit body statements
  if (!this.shouldSkip && !this.shouldStop) {
    for (const stmt of node.getBody()) {
      if (this.shouldStop) break;
      stmt.accept(this);
    }
  }
  
  this.shouldSkip = false;
  this.exitNode(node);
}
```

**Tests:**
- Unit: For-loop variable has byte type when range is 0 to 255
- Unit: For-loop variable has word type when range exceeds 255
- Unit: For-loop variable is accessible in loop body
- Integration: `for i = 0 to 999` compiles without type errors

---

### Task 1.2: Fix extractMapInfo in MemoryLayoutBuilder

**Problem:** `extractMapInfo()` uses non-existent properties (`mapDecl.address`) instead of proper AST methods, returning `$0-$0` for all maps.

**File:** `packages/compiler/src/semantic/memory-layout.ts`

**Implementation:**
```typescript
/**
 * Extract map information from symbol
 *
 * Properly extracts address information from the AST node
 * using the correct getter methods for each map declaration type.
 *
 * @param symbol - Memory-mapped symbol
 * @returns Map metadata (address, size, form)
 */
protected extractMapInfo(symbol: Symbol): {
  startAddress: number;
  endAddress: number;
  size: number;
  form: 'simple' | 'range' | 'sequential' | 'explicit';
} {
  const decl = symbol.declaration;
  const nodeType = decl.getNodeType();
  
  // Import type guards and AST node types
  if (isSimpleMapDecl(decl)) {
    const address = this.evaluateConstantExpression(decl.getAddress());
    const size = this.getTypeSize(decl.getTypeAnnotation());
    return {
      startAddress: address,
      endAddress: address + size - 1,
      size,
      form: 'simple',
    };
  }
  
  if (isRangeMapDecl(decl)) {
    const startAddress = this.evaluateConstantExpression(decl.getStartAddress());
    const endAddress = this.evaluateConstantExpression(decl.getEndAddress());
    return {
      startAddress,
      endAddress,
      size: endAddress - startAddress + 1,
      form: 'range',
    };
  }
  
  if (isSequentialStructMapDecl(decl)) {
    const baseAddress = this.evaluateConstantExpression(decl.getBaseAddress());
    const size = this.calculateStructSize(decl.getFields());
    return {
      startAddress: baseAddress,
      endAddress: baseAddress + size - 1,
      size,
      form: 'sequential',
    };
  }
  
  if (isExplicitStructMapDecl(decl)) {
    const baseAddress = this.evaluateConstantExpression(decl.getBaseAddress());
    const { maxOffset, size } = this.calculateExplicitStructSize(decl.getFields());
    return {
      startAddress: baseAddress,
      endAddress: baseAddress + maxOffset + size - 1,
      size: maxOffset + size,
      form: 'explicit',
    };
  }
  
  // Fallback for unknown types
  return {
    startAddress: 0,
    endAddress: 0,
    size: 1,
    form: 'simple',
  };
}

/**
 * Evaluate a constant expression to a numeric value
 * 
 * For memory addresses, expressions must be compile-time constants.
 * This evaluates literal values directly.
 */
protected evaluateConstantExpression(expr: Expression): number {
  if (isLiteralExpression(expr)) {
    const value = expr.getValue();
    if (typeof value === 'number') {
      return value;
    }
  }
  // TODO: Support constant folding for more complex expressions
  return 0;
}
```

**Tests:**
- Unit: SimpleMapDecl extracts correct single address
- Unit: RangeMapDecl extracts start and end addresses
- Unit: SequentialStructMapDecl calculates struct size
- Unit: ExplicitStructMapDecl handles field offsets
- Integration: Memory overlap detection works correctly
- E2E: Example files compile without false overlap errors

---

### Task 1.3: Add Missing Type Guard Imports

**Problem:** The new `extractMapInfo` implementation needs type guard imports.

**File:** `packages/compiler/src/semantic/memory-layout.ts`

**Implementation:**
Add to imports:
```typescript
import {
  isSimpleMapDecl,
  isRangeMapDecl,
  isSequentialStructMapDecl,
  isExplicitStructMapDecl,
  isLiteralExpression,
} from '../ast/type-guards.js';
```

**Tests:** Covered by Task 1.2 tests

---

## Phase 2: Medium Priority Bug Fixes

**Context:** These bugs may cause subtle issues or crashes in edge cases.

**Reasoning:** Fix after critical bugs to ensure core functionality works.

**Dependencies:** Phase 1 complete

**Deliverables:**
- Control flow analyzer uses correct enum
- Type info assignments are null-safe
- Scope management is consistent
- Parameter declarations have proper types

### Task 2.1: Fix Invalid ContextType Cast in ControlFlowAnalyzer

**Problem:** Uses `0 as any` instead of proper `ContextType.FUNCTION` enum.

**File:** `packages/compiler/src/semantic/visitors/control-flow-analyzer.ts`

**Implementation:**
```typescript
// Line ~168: Change from:
this.context.enterContext(0 as any, node);

// To:
import { ContextType } from '../../ast/walker/context.js';
// ...
this.context.enterContext(ContextType.FUNCTION, node);
```

**Tests:**
- Unit: Function context correctly entered during CFG building
- Unit: Context type is FUNCTION (not numeric 0)

---

### Task 2.2: Add Null Safety to IndexExpression Type Assignment

**Problem:** Assigns potentially undefined `elementType` to `typeInfo`.

**File:** `packages/compiler/src/semantic/visitors/type-checker/assignments.ts`

**Implementation:**
```typescript
// In visitIndexExpression(), change from:
(node as any).typeInfo = elementType;

// To:
(node as any).typeInfo = elementType || {
  kind: TypeKind.Unknown,
  name: 'unknown',
  size: 0,
  isSigned: false,
  isAssignable: false,
};
```

**Tests:**
- Unit: IndexExpression has unknown type when element type missing
- Unit: No crashes when indexing invalid array type

---

### Task 2.3: Fix Scope Exit in TypeResolver

**Problem:** Manual scope exit after `super.visitFunctionDecl()` creates mismatch.

**File:** `packages/compiler/src/semantic/visitors/type-resolver.ts`

**Implementation:**
Review and ensure scope entry/exit is balanced:
```typescript
public visitFunctionDecl(node: FunctionDecl): void {
  // ... setup code ...
  
  // Enter function scope BEFORE super call
  this.symbolTable.enterScope(functionScope);
  
  // Annotate parameter types...
  
  // Visit function body (super handles context, we handle scope)
  const body = node.getBody();
  if (body && !this.shouldSkip && !this.shouldStop) {
    for (const stmt of body) {
      if (this.shouldStop) break;
      stmt.accept(this);
    }
  }
  
  // Exit function scope
  this.symbolTable.exitScope();
  
  // Handle context tracking separately (don't call super.visitFunctionDecl)
  this.exitNode(node);
}
```

**Tests:**
- Unit: Scope depth returns to original after function visit
- Unit: Parameters are accessible in function body
- Integration: Nested functions have correct scope

---

### Task 2.4: Fix Parameter Type Declaration

**Problem:** `Parameter` is cast to `any` for ASTNode requirement.

**File:** `packages/compiler/src/semantic/visitors/symbol-table-builder.ts`

**Implementation:**
Create a wrapper or use the function declaration as the parameter's declaration:
```typescript
// In visitParameter():
const symbol: Symbol = {
  name: param.name,
  kind: SymbolKind.Parameter,
  // Use the containing function declaration as the "declaration" node
  // since Parameter itself isn't a full ASTNode
  declaration: this.currentFunctionNode!, // Need to track this
  isExported: false,
  isConst: false,
  scope: this.symbolTable.getCurrentScope(),
  location: param.location,
};
```

Add tracking field to class:
```typescript
protected currentFunctionNode: FunctionDecl | null = null;

public visitFunctionDecl(node: FunctionDecl): void {
  this.currentFunctionNode = node;
  // ... existing code ...
  this.currentFunctionNode = null;
}
```

**Tests:**
- Unit: Parameter symbols have valid declaration reference
- Unit: Parameter location is correct (not function location)

---

### Task 2.5: Improve Function Scope Lookup

**Problem:** Only searches direct children, fails with nested scopes.

**File:** `packages/compiler/src/semantic/visitors/type-checker/declarations.ts`

**Implementation:**
```typescript
// In visitFunctionDecl(), use recursive scope search:
protected findFunctionScope(
  parentScope: Scope, 
  node: FunctionDecl
): Scope | undefined {
  // Check direct children first
  for (const child of parentScope.children) {
    if (child.node === node) {
      return child;
    }
  }
  
  // Recursively search child scopes (for nested functions)
  for (const child of parentScope.children) {
    const found = this.findFunctionScope(child, node);
    if (found) {
      return found;
    }
  }
  
  return undefined;
}
```

**Tests:**
- Unit: Finds scope for top-level function
- Unit: Finds scope for nested function
- Unit: Returns undefined for non-existent function

---

## Phase 3: Code Quality Improvements

**Context:** These improvements enhance maintainability and prevent future bugs.

**Reasoning:** Address after functional bugs are fixed.

**Dependencies:** Phase 2 complete

**Deliverables:**
- Proper TypeInfo interface for expressions
- Consistent type guard usage
- Defensive null handling
- Cleaner code patterns

### Task 3.1: Add typeInfo Property to Expression Interface

**Problem:** Using `(node as any).typeInfo` throughout codebase.

**File:** `packages/compiler/src/ast/base.ts`

**Implementation:**
```typescript
// In Expression class:
export abstract class Expression extends ASTNode {
  /** Resolved type information (set during type checking) */
  public typeInfo?: TypeInfo;
  
  // ... existing code ...
}
```

Update imports in type checker files to use proper interface.

**Tests:**
- Unit: Expression has optional typeInfo property
- Unit: TypeScript allows direct typeInfo access without cast
- Refactoring: Update all `(node as any).typeInfo` to `node.typeInfo`

---

### Task 3.2: Add Defensive Null Checks for getBuiltinType

**Problem:** Uses `!` assertion assuming builtin types always exist.

**Files:** Multiple type checker files

**Implementation:**
Create helper method:
```typescript
// In TypeCheckerBase:
protected getRequiredBuiltinType(name: string): TypeInfo {
  const type = this.typeSystem.getBuiltinType(name);
  if (!type) {
    throw new Error(`Internal error: builtin type '${name}' not found`);
  }
  return type;
}
```

Replace all `this.typeSystem.getBuiltinType('byte')!` with `this.getRequiredBuiltinType('byte')`.

**Tests:**
- Unit: Helper throws clear error if type missing
- Unit: All builtin types are properly registered

---

### Task 3.3: Standardize on Type Guards

**Problem:** Mix of `node.getNodeType() === ASTNodeType.X` and `isX(node)`.

**Files:** All type checker files

**Implementation:**
- Audit all AST node type checks
- Replace `getNodeType() === ASTNodeType.X` with `isXxx()` type guards
- Ensure type guards provide proper type narrowing

**Tests:**
- Refactoring: Verify no functional changes
- Coverage: All type checks use consistent pattern

---

### Task 3.4: Optimize Type Compatibility Cache

**Problem:** String concatenation for cache keys on every check.

**File:** `packages/compiler/src/semantic/type-system.ts`

**Implementation:**
```typescript
// Use WeakMap with type pair object, or numeric IDs:
protected typeIds: Map<TypeInfo, number> = new Map();
protected nextTypeId = 0;

protected getTypeId(type: TypeInfo): number {
  let id = this.typeIds.get(type);
  if (id === undefined) {
    id = this.nextTypeId++;
    this.typeIds.set(type, id);
  }
  return id;
}

public checkCompatibility(from: TypeInfo, to: TypeInfo): TypeCompatibility {
  const cacheKey = (this.getTypeId(from) << 16) | this.getTypeId(to);
  // ... use numeric key instead of string ...
}
```

**Tests:**
- Performance: Benchmark type checking speed
- Unit: Cache still returns correct results

---

## Task Implementation Checklist

| Task | Description                                | Dependencies | Status |
|------|--------------------------------------------|--------------|--------|
| 1.1  | Add visitForStatement to TypeResolver      | None         | [x] ✅ |
| 1.2  | Fix extractMapInfo in MemoryLayoutBuilder  | None         | [x] ✅ |
| 1.3  | Add missing type guard imports             | 1.2          | [x] ✅ |
| 2.1  | Fix ContextType cast in ControlFlowAnalyzer| Phase 1      | [x] ✅ |
| 2.2  | Add null safety to IndexExpression         | Phase 1      | [x] ✅ |
| 2.3  | Fix scope exit in TypeResolver             | Phase 1      | [x] ✅ |
| 2.4  | Fix Parameter type declaration             | Phase 1      | [x] ✅ |
| 2.5  | Improve function scope lookup              | Phase 1      | [x] ✅ |
| 3.1  | Add typeInfo to Expression interface       | Phase 2      | [x] ✅ (TypeInfo type + setTypeInfo method) |
| 3.2  | Add defensive null checks                  | Phase 2      | [x] ✅ (getRequiredBuiltinType helper) |
| 3.3  | Standardize on type guards                 | Phase 2      | [x] ✅ (type guards in base.ts + declarations.ts) |
| 3.4  | Optimize type compatibility cache          | Phase 2      | [x] ✅ (numeric ID cache keys in type-system.ts) |

---

## Verification Criteria

**After Phase 1:**
```bash
./packages/cli/bin/blend65.js build ./examples/simple/*.blend
# Should compile without errors
```

**After Phase 2:**
```bash
clear && yarn clean && yarn build && yarn test
# All tests pass, no TypeScript errors
```

**After Phase 3:**
- No `as any` casts for typeInfo
- Consistent type guard usage throughout
- Improved type safety and maintainability

---

## Notes

- Each task should be implemented in a separate session to avoid context overflow
- Run tests after each task before proceeding
- Update this checklist as tasks are completed
- Add new tests for each bug fix before marking complete