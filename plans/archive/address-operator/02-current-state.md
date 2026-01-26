# Current State Analysis

> **Document**: 02-current-state.md  
> **Parent**: [Index](00-index.md)

## Pipeline Overview

The Blend65 compiler pipeline:

```
Source → Parser → Semantic Analysis → IL Generation → IL Optimizer → ASM-IL → ASM-IL Optimizer → CodeGen → ACME
```

## Current Implementation Status

### ✅ Parser - WORKING

The parser correctly handles the `@` operator.

**File**: `packages/compiler/src/parser/expressions.ts`

```typescript
// Parses @variable as UnaryExpression
// TokenType.ADDRESS = '@'
UnaryExpression(TokenType.ADDRESS, identifier)
```

**Evidence**: Parser tests pass for `@variable` syntax.

---

### ✅ Type Checker - WORKING

The type system recognizes `callback` type and `@address` type alias.

**Evidence**: 
- `callback` type exists in type definitions
- `@address` type alias maps to `word`

---

### ❌ IL Opcodes - MISSING

**File**: `packages/compiler/src/il/instructions.ts`

**Problem**: No opcodes exist for loading addresses.

| Needed Opcode | Current Status |
|---------------|----------------|
| `LOAD_ADDRESS` | ❌ Does not exist |
| `LOAD_FUNC_ADDRESS` | ❌ Does not exist |

**Existing Related Opcode**:
```typescript
CALL_INDIRECT = 'CALL_INDIRECT'  // Exists but not what we need
```

---

### ❌ IL Generator - BROKEN

**File**: `packages/compiler/src/il/generator/expressions.ts`

#### Problem 1: `generateIdentifierExpression()` Doesn't Check Functions

Current implementation only checks:
1. Local variables
2. Parameters
3. Global variables

It does NOT check if the identifier is a **function name**.

**Current Code Flow**:
```typescript
// When processing: rasterIRQ (a function name)
generateIdentifierExpression(expr) {
  const name = expr.getName();
  
  // Check 1: Local variable? NO
  // Check 2: Parameter? NO  
  // Check 3: Global variable? NO
  // Result: ERROR - "Unknown identifier"
}
```

#### Problem 2: Address-of Operator is Placeholder

**Current Code**:
```typescript
case TokenType.ADDRESS:
  // Address-of operator (@)
  // For now, this is a placeholder - full implementation depends on backend
  this.addWarning(
    'Address-of operator not fully implemented',
    expr.getLocation(),
    'W_ADDRESS_NOT_IMPLEMENTED',
  );
  return operandReg;  // BUG: Just returns operand, doesn't get address!
```

**What it should do**: Emit `LOAD_ADDRESS` opcode with symbol reference.

---

### ❌ ASM-IL Layer - NO HANDLING

**Directory**: `packages/compiler/src/asm-il/`

**Problem**: No conversion logic for `LOAD_ADDRESS` opcode (because it doesn't exist).

Would need to convert:
```
LOAD_ADDRESS "myVar" -> r1
```
To ASM-IL instructions that load low/high bytes.

---

### ❌ CodeGen Layer - NO HANDLING

**Directory**: `packages/compiler/src/codegen/`

**Problem**: No 6502 instruction generation for address loading.

Would need to generate:
```asm
LDA #<symbol
STA result_lo
LDA #>symbol  
STA result_hi
```

---

## Root Cause Summary

When you write:
```js
setInterrupt(100, rasterIRQ);  // rasterIRQ is a function
```

The flow breaks at IL generation:

| Stage | Status | Issue |
|-------|--------|-------|
| Parser | ✅ | Creates `IdentifierExpression("rasterIRQ")` |
| Type Checker | ✅ | Validates callback type compatibility |
| IL Generator | ❌ | Looks up as variable → NOT FOUND → Error |

## What Needs to Change

| Component | Change Required |
|-----------|-----------------|
| `il/instructions.ts` | Add `LOAD_ADDRESS` opcode and instruction class |
| `il/builder.ts` | Add `emitLoadAddress()` method |
| `il/generator/expressions.ts` | Fix `@` operator and function identifier handling |
| `asm-il/emitters/` | Add LOAD_ADDRESS to ASM-IL conversion |
| `codegen/` | Generate `LDA #<symbol` / `LDA #>symbol` |