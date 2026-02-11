# Indirect Addressing & Intrinsic Dynamic Addresses

> **Document**: 05-indirect-addressing.md
> **Parent**: [Index](00-index.md)
> **Covers**: Indirect addressing codegen, address decomposer, 3-tier intrinsic strategy, constant folding

## Indirect Addressing Codegen

### New IL Opcodes

| Opcode | Description | Operands | Effect |
|--------|-------------|----------|--------|
| `POKE_INDIRECT` | Store A via ZP pointer | none | ($FB),Y ← A (Y=0) |
| `PEEK_INDIRECT` | Load A via ZP pointer | none | A ← ($FB),Y (Y=0) |
| `STORE_ZP_PTR` | Store A:X to ZP pointer | none | $FB ← A, $FC ← X |

### 6502 Codegen

```asm
; STORE_ZP_PTR: Store computed address A:X to ZP pointer
STA $FB            ; low byte
STX $FC            ; high byte

; POKE_INDIRECT: Write value through pointer
LDY #0
STA ($FB),Y        ; indirect indexed store

; PEEK_INDIRECT: Read value through pointer
LDY #0
LDA ($FB),Y        ; indirect indexed load
```

### Files to Modify

| File | Changes |
|------|---------|
| `il/enums.ts` | Add `POKE_INDIRECT`, `PEEK_INDIRECT`, `STORE_ZP_PTR` |
| `codegen/generator/intrinsics.ts` | Codegen for indirect peek/poke |

## Address Expression Decomposer

### Interface

```typescript
interface AddressDecomposition {
  constantSum: number;           // All constants folded (16-bit)
  variableTerms: Expression[];   // All runtime sub-expressions
  isAdditionOnly: boolean;       // True if only + ops in chain
}
```

### Algorithm

Walk the binary expression tree. At each `+` node:
- If a sub-expression resolves to a constant → add to `constantSum`
- Otherwise → push to `variableTerms`

For non-`+` operators (*, -, etc.), treat the entire sub-tree as one variable term.

### Constant Folding Enhancement

`tryResolveConstantAddress()` extended to handle ALL operators between constants:

```typescript
if (isBinaryExpression(expr)) {
  const left = tryResolve(expr.getLeft());
  const right = tryResolve(expr.getRight());
  if (left !== undefined && right !== undefined) {
    switch (expr.getOperator()) {
      case PLUS:  return (left + right) & 0xFFFF;
      case MINUS: return (left - right) & 0xFFFF;
      case MULTIPLY: return (left * right) & 0xFFFF;
      case SHIFT_LEFT: return (left << right) & 0xFFFF;
      case SHIFT_RIGHT: return (left >> right) & 0xFFFF;
      case BITWISE_AND: return left & right;
      case BITWISE_OR:  return left | right;
      case BITWISE_XOR: return left ^ right;
    }
  }
}
```

## 3-Tier Intrinsic Strategy

Applied to ALL 4 intrinsics: peek, poke, peekw, pokew.

### Tier 1: Absolute (compile-time constant address)

**Condition**: Address decomposes to `constantSum` only, zero variable terms.

```
poke($D020, val) → STA $D020
peek(SCREEN + 40) → LDA $0428
```

### Tier 2: Indexed (constant base + single byte variable)

**Condition**: One variable term that is byte-typed, addition chain only.

```
poke(SCREEN + i, val) → LDX i; STA $0400,X
peek(SCREEN + 250 + col, val) → LDX col; LDA $04FA,X
```

### Tier 3: Indirect (everything else)

**Condition**: Multiple variable terms, OR word-typed variable, OR non-addition operators.

**Strategy**: Compute full 16-bit address in A:X → store in ZP pointer → indirect access.

```
poke(SCREEN + i + j, val):
  ; Load folded constant base
  LDA #<$0400; LDX #>$0400
  ; Add each variable term (using ADD_WORD_BYTE_SLOT)
  CLC; ADC i_addr; BCC +2; INX
  CLC; ADC j_addr; BCC +2; INX
  ; Store pointer
  STA $FB; STX $FC
  ; Generate value, indirect store
  LDA value; LDY #0; STA ($FB),Y
```

### Refactored generatePokeIntrinsic()

```typescript
protected generatePokeIntrinsic(addrExpr, valueExpr, label): void {
  // Tier 1: Pure constant
  const constAddr = tryResolveConstantAddress(addrExpr);
  if (constAddr !== undefined) { /* existing absolute code */ return; }

  // Decompose address expression
  const decomp = decomposeAddressExpression(addrExpr);

  // Tier 2: Single byte variable offset
  if (decomp.isAdditionOnly && decomp.variableTerms.length === 1
      && isByteTyped(decomp.variableTerms[0])) {
    generateExpression(decomp.variableTerms[0]);
    builder.transferAX();
    builder.emit(POKE, [createIndexedAddressOperand(decomp.constantSum, 'X')]);
    return;
  }

  // Tier 3: General indirect addressing
  // Load constant base into A:X
  builder.emit(LOAD_IMM_WORD, [createImmediateOperand(decomp.constantSum, true)]);
  // Add each variable term
  for (const term of decomp.variableTerms) {
    generateExpression(term); // Result in A (byte) or A:X (word)
    // Use ADD_WORD_BYTE_SLOT or ADD_WORD_SLOT based on type
  }
  // Store address to ZP pointer
  builder.emit(STORE_ZP_PTR);
  // Generate value
  generateExpression(valueExpr);
  // Indirect poke
  builder.emit(POKE_INDIRECT);
}
```

### Same Pattern for peek, peekw, pokew

All 4 intrinsics use the same 3-tier decomposition. Only the final instruction differs:
- `peek` → `PEEK_INDIRECT` (LDA ($FB),Y)
- `poke` → `POKE_INDIRECT` (STA ($FB),Y)
- `peekw` → `PEEK_INDIRECT` + `PEEK_INDIRECT` with Y=0 and Y=1
- `pokew` → `POKE_INDIRECT` + `POKE_INDIRECT` with Y=0 and Y=1

### Fix pokew/peekw Broken Fallback

Remove the broken dead-code fallback in `generatePokewIntrinsic` and `generatePeekwIntrinsic`. Replace with the same 3-tier strategy.

## Files to Modify

| File | Changes |
|------|---------|
| `il/enums.ts` | New opcodes: POKE_INDIRECT, PEEK_INDIRECT, STORE_ZP_PTR |
| `il/generator/expressions.ts` | Address decomposer, enhanced constant folding, refactored intrinsic handlers |
| `il/factories.ts` | Factory for indirect operands if needed |
| `codegen/generator/intrinsics.ts` | Codegen for POKE_INDIRECT, PEEK_INDIRECT, STORE_ZP_PTR |
