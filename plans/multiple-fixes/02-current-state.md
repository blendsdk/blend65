# Current State: Skipped Tests Fixes

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

The Blend65 compiler has a complete pipeline from source to assembly:
- **Lexer** → **Parser** → **Semantic Analyzer** → **IL Generator** → **Code Generator**

All 6963 tests pass. However, 18 tests are skipped, documenting known gaps.

### Relevant Files

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `packages/compiler/src/il/generator.ts` | IL generation from AST | Extract array literal values |
| `packages/compiler/src/codegen/instruction-generator.ts` | IL to assembly translation | Local variables, branch selection |
| `packages/compiler/src/codegen/globals-generator.ts` | Global variable code generation | Data directives, array fills |
| `packages/compiler/src/codegen/base-generator.ts` | Codegen infrastructure | Local variable tracking |

### Code Analysis

#### Issue 1: Array Initializers Not Captured

**Current Behavior** (IL Generator):
```typescript
// In packages/compiler/src/il/generator.ts
// When processing VariableDecl with ArrayLiteralExpression initializer:
// The initialValue is NOT being extracted from the AST
```

**Evidence**:
```
Input:  let data: byte[3] = [1, 2, 3];
IL:     { name: 'data', type: array, initialValue: undefined }
Output: !byte $00
```

**Root Cause**: IL generator doesn't extract `ArrayLiteralExpression` values.

---

#### Issue 2: Local Variables Not Tracked

**Current Behavior** (instruction-generator.ts lines 443-478):
```typescript
protected generateLoadVar(instr: ILLoadVarInstruction): void {
  const addrInfo = this.lookupGlobalAddress(instr.variableName);

  if (addrInfo) {
    // Global variable - works
  } else {
    const label = this.lookupGlobalLabel(instr.variableName);
    if (label) {
      // RAM variable - works  
    } else {
      this.emitComment(`STUB: Unknown variable ${instr.variableName}`);
      this.emitLdaImmediate(0, 'Placeholder');
    }
  }
}
```

**Evidence**:
```
Input:  function test(): byte { let x: byte = 10; return x; }
Output: ; STUB: Unknown variable x
        LDA #$00 ; Placeholder
```

**Root Cause**: `lookupGlobalAddress` and `lookupGlobalLabel` only search global variable maps. Local variables are not tracked.

---

#### Issue 3: Branch Instructions Always JMP

**Current Behavior** (instruction-generator.ts lines 416-430):
```typescript
protected generateBranch(instr: ILBranchInstruction): void {
  const thenLabel = this.getBlockLabel(instr.thenTarget.name);
  const elseLabel = this.getBlockLabel(instr.elseTarget.name);

  // STUB: Comment showing intended behavior, then unconditional jump
  this.emitComment(`STUB: Branch on ${instr.condition} ? ${thenLabel} : ${elseLabel}`);

  // For stub, always take the "then" path
  this.emitJmp(thenLabel, 'STUB: Always take then-branch');
}
```

**Evidence**:
```
Input:  if (x == 10) { ... }
Output: ; STUB: Branch on v2 ? _then_1 : _else_1
        JMP _then_1  ; STUB: Always take then-branch
```

**Root Cause**: Branch instruction doesn't check comparison type to select proper branch instruction.

---

#### Issue 4: Array Fill Directives

**Current Behavior** (globals-generator.ts lines 229-245):
```typescript
protected emitZeroFill(size: number, name: string): void {
  if (size === 1) {
    this.assemblyWriter.emitBytes([0], name);  // Single byte
  } else if (size === 2) {
    this.assemblyWriter.emitWords([0], name);  // Word
  } else {
    this.assemblyWriter.emitFill(size, 0, name);  // Fill
  }
}
```

**Evidence**: The `emitFill` path seems correct, but the issue is that array type sizes are computed correctly in `getTypeSize`:
```typescript
protected getTypeSize(type: { kind: string; size?: number }): number {
  if (type.size !== undefined) {
    return type.size;  // Uses explicit size from type
  }
  // ...
}
```

The issue is that for uninitialized arrays, the size IS being passed but `emitFill` may not be generating the expected `!fill` format in tests.

## Gaps Identified

### Gap 1: Array Literal Value Extraction

**Current Behavior:** IL generator ignores array literal element values
**Required Behavior:** Extract numeric values and store in `initialValue` array
**Fix Required:** Add array literal handling in IL generator

### Gap 2: Local Variable Allocation

**Current Behavior:** Only global variables are tracked
**Required Behavior:** Track local variables with zero-page addresses per function
**Fix Required:** Add local variable tracking in code generator

### Gap 3: Conditional Branch Selection

**Current Behavior:** Always generates `JMP` (unconditional)
**Required Behavior:** Generate `BNE`, `BEQ`, `BCS`, `BCC` based on comparison
**Fix Required:** Implement branch instruction selection logic

### Gap 4: Test Expectation Alignment

**Current Behavior:** Some tests expect specific formats that may differ
**Required Behavior:** Tests should match actual correct output
**Fix Required:** May need to update test expectations or fix generator

## Dependencies

### Internal Dependencies

- Array literal fix must complete before testing data section generation
- Local variable tracking must be designed before implementing

### External Dependencies

- None

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing tests | Medium | High | Run full test suite after each change |
| ZP overflow with locals | Low | High | Track and warn on overflow |
| Branch logic errors | Medium | High | Test all comparison types |
| Performance regression | Low | Low | These are compile-time operations |