# Current State: CALL_VOID Bug and length() String Support

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### CALL vs CALL_VOID Logic

The current implementation in `generateCallExpression` (packages/compiler/src/il/generator/expressions.ts):

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

// Emit call based on return type
const returnType = this.convertType(funcSymbol.type.signature.returnType);
if (returnType.kind === 'void') {
  this.builder?.emitCallVoid(funcName, argRegs);
  return null;
} else {
  return this.builder?.emitCall(funcName, argRegs, returnType) ?? null;
}
```

**Problem**: The function lookup fails (`!funcSymbol || !funcSymbol.type || !funcSymbol.type.signature`) even for functions defined in the same module.

### length() Intrinsic Logic

The current implementation in `generateLengthIntrinsic` (packages/compiler/src/il/generator/expressions.ts):

```typescript
protected generateLengthIntrinsic(expr: CallExpression): VirtualRegister | null {
  const args = expr.getArguments();

  if (args.length !== 1) {
    this.addError('length() requires exactly 1 argument', expr.getLocation(), 'E_INTRINSIC_ARGS');
    return null;
  }

  const arg = args[0];

  // Check if argument is an identifier (array/string variable name)
  if (arg.getNodeType() === ASTNodeType.IDENTIFIER_EXPR) {
    // ... handles array variables
  }

  // Argument is not a variable reference
  this.addError(
    'length() requires an array or string variable',
    expr.getLocation(),
    'E_LENGTH_INVALID_ARG',
  );
  return null;
}
```

**Problem**: Only `IDENTIFIER_EXPR` is handled. `LITERAL_EXPR` (string literals) is not supported.

## Relevant Files

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `packages/compiler/src/il/generator/expressions.ts` | IL expression generation | Fix CALL/CALL_VOID logic, add string literal to length() |
| `packages/compiler/src/__tests__/il/generator-expressions-ternary.test.ts` | Ternary test | Unskip test after fix |
| `packages/compiler/src/__tests__/e2e/type-acceptance.test.ts` | Type acceptance test | Unskip test after fix |

## Gaps Identified

### Gap 1: Function Symbol Lookup Fails

**Current Behavior:** When calling a function defined in the same module, the symbol lookup returns a symbol without `type.signature`, causing CALL_VOID to be emitted.

**Required Behavior:** Symbol lookup should return the complete function signature including return type.

**Investigation Needed:** Determine why `funcSymbol.type.signature` is missing. Possible causes:
1. Symbol registration doesn't include signature
2. Type resolution runs after IL generation
3. Scope issue - function not visible at call site

### Gap 2: length() Only Handles Identifiers

**Current Behavior:** `length("hello")` fails with error "length() requires an array or string variable"

**Required Behavior:** `length("hello")` should return 5 (compile-time constant)

**Fix Required:** Add `LITERAL_EXPR` handling in `generateLengthIntrinsic` for string literals

## Dependencies

### Internal Dependencies

- Symbol table must have correct function signatures (for CALL_VOID fix)
- IL builder must support both CALL and CALL_VOID instructions (already exists)

### External Dependencies

- None

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| CALL_VOID fix breaks existing code | Low | High | Run full test suite before/after |
| Symbol table changes needed | Medium | Medium | Investigate root cause first |
| length() fix affects other intrinsics | Low | Low | Isolated change to one method |