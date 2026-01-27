# CALL_VOID Fix: Technical Specification

> **Document**: 03-call-void-fix.md
> **Parent**: [Index](00-index.md)

## Overview

This document specifies the technical approach to fix the CALL_VOID bug where the IL generator incorrectly emits `CALL_VOID` instead of `CALL` for functions that return a value.

## Root Cause Analysis

### Hypothesis 1: Symbol Lookup Failure

The `symbolTable.lookup(funcName)` call may not be finding the function symbol correctly when:
- The function is defined in the same module but after the calling function
- The function symbol exists but `type.signature` is not populated

### Hypothesis 2: Type Registration Timing

The semantic analyzer may not fully populate `funcSymbol.type.signature` before IL generation runs.

### Investigation Approach

1. Add debug logging to `generateCallExpression` to see what `funcSymbol` contains
2. Check if the function symbol is in the symbol table
3. Check if `funcSymbol.type` is populated
4. Check if `funcSymbol.type.signature` is populated

## Implementation Details

### Current Code (Problem)

```typescript
// Look up the function to determine return type
const funcSymbol = this.symbolTable.lookup(funcName);
if (!funcSymbol || !funcSymbol.type || !funcSymbol.type.signature) {
  // Unknown function - emit void call and warn
  this.addWarning(
    `Unknown function '${funcName}', assuming void return`,
    expr.getLocation(),
    'W_UNKNOWN_FUNCTION',
  );
  this.builder?.emitCallVoid(funcName, argRegs);
  return null;
}
```

### Proposed Fix

**Option A: Fix Symbol Lookup (Preferred)**

If the symbol exists but signature is missing, check for function kind:

```typescript
// Look up the function to determine return type
const funcSymbol = this.symbolTable.lookup(funcName);

// Check if we found a function symbol
if (!funcSymbol) {
  this.addWarning(
    `Unknown function '${funcName}', assuming void return`,
    expr.getLocation(),
    'W_UNKNOWN_FUNCTION',
  );
  this.builder?.emitCallVoid(funcName, argRegs);
  return null;
}

// For functions, we need the signature to determine return type
// If signature is missing, check the function declaration in the module
if (!funcSymbol.type?.signature) {
  // Try to find the function in the current module's IL functions
  const ilFunc = this.module.getFunction(funcName);
  if (ilFunc && !ilFunc.isVoid()) {
    // Function exists and returns a value - use CALL
    return this.builder?.emitCall(funcName, argRegs, ilFunc.getReturnType()) ?? null;
  }
  
  // Fall back to void if we can't determine return type
  this.addWarning(
    `Cannot determine return type for '${funcName}', assuming void`,
    expr.getLocation(),
    'W_UNKNOWN_RETURN_TYPE',
  );
  this.builder?.emitCallVoid(funcName, argRegs);
  return null;
}

// Emit call based on return type from signature
const returnType = this.convertType(funcSymbol.type.signature.returnType);
if (returnType.kind === 'void') {
  this.builder?.emitCallVoid(funcName, argRegs);
  return null;
} else {
  return this.builder?.emitCall(funcName, argRegs, returnType) ?? null;
}
```

**Option B: Check IL Function Registry**

If the function has already been processed by the IL generator, we can look it up:

```typescript
// Check if we already generated IL for this function
const ilFunc = this.module.getFunction(funcName);
if (ilFunc) {
  const returnType = ilFunc.getReturnType();
  if (returnType.kind === 'void') {
    this.builder?.emitCallVoid(funcName, argRegs);
    return null;
  } else {
    return this.builder?.emitCall(funcName, argRegs, returnType) ?? null;
  }
}
```

## Integration Points

### Files to Modify

1. `packages/compiler/src/il/generator/expressions.ts`
   - Method: `generateCallExpression`
   - Add fallback lookup in IL function registry

### Files to Update (Tests)

1. `packages/compiler/src/__tests__/il/generator-expressions-ternary.test.ts`
   - Unskip: "should generate ternary for function argument"

## Error Handling

- If function is not found anywhere, emit warning and use CALL_VOID (current behavior)
- If return type cannot be determined, emit warning and use CALL_VOID

## Testing Requirements

- Verify CALL is emitted for non-void functions
- Verify CALL_VOID is emitted for void functions
- Verify nested calls work (call inside call)
- Verify calls in ternary expressions work