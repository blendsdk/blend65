# Current State: Dynamic Poke/Peek Addressing

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

The poke/peek intrinsic handling lives in the IL generator's expression layer. The flow is:

1. **IL Generator** (`expressions.ts`) — Resolves address expressions, emits IL opcodes
2. **IL Operands** (`operands.ts`, `factories.ts`) — Represent address operands with optional index registers
3. **Codegen** (`intrinsics.ts`) — Translates IL POKE/PEEK to 6502 STA/LDA instructions
4. **Codegen Base** (`base.ts`) — Maps operand addressing modes to 6502 modes

### Address Resolution Chain

```
poke(addr_expr, value)
  ↓
tryResolveConstantAddress(addr_expr)
  → Handles: numeric literal, constant identifier
  → Returns: number | undefined
  ↓ (if undefined)
tryDecomposeIndexedAddress(addr_expr)
  → Handles: CONST + var, var + CONST (binary addition only)
  → Returns: { base: number, offsetExpr: Expression } | undefined
  ↓ (if undefined)
throw Error("Dynamic poke address not supported")
```

### Relevant Files

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `packages/compiler/src/il/generator/expressions.ts` | Core intrinsic handling | Add constant folding + indirect mode |
| `packages/compiler/src/il/operands.ts` | AddressOperand type | May need `indirectY` support |
| `packages/compiler/src/il/factories.ts` | createIndexedAddressOperand | May need indirect factory |
| `packages/compiler/src/il/enums.ts` | ILOpcode enum | May need POKE_INDIRECT opcode |
| `packages/compiler/src/codegen/generator/intrinsics.ts` | genPoke/genPeek | Add indirect addressing path |
| `packages/compiler/src/codegen/generator/base.ts` | getAddressMode | Already supports indirectY |

### Code Analysis

#### `tryResolveConstantAddress()` (line 855)

```typescript
protected tryResolveConstantAddress(expr: Expression): number | undefined {
    // Case 1: Numeric literal (e.g., $D020, 53280, 0xD020)
    if (isLiteralExpression(expr)) {
      const value = expr.getValue();
      if (typeof value === 'number') {
        return value;
      }
    }

    // Case 2: Constant identifier reference (e.g., BORDER where const BORDER = $D020)
    if (isIdentifierExpression(expr)) {
      const name = expr.getName();
      const symbol = this.symbolTable.lookupGlobal(name);
      if (symbol && symbol.isConst && symbol.initializer) {
        return this.tryResolveConstantAddress(symbol.initializer);
      }
    }

    // Cannot resolve to a constant address — MISSING: BinaryExpression case!
    return undefined;
  }
```

**Gap**: No handling for `BinaryExpression` where both sides are constants.

#### `tryDecomposeIndexedAddress()` (line 895)

```typescript
protected tryDecomposeIndexedAddress(expr: Expression):
    { base: number; offsetExpr: Expression } | undefined {
    if (!isBinaryExpression(expr)) return undefined;
    if (binExpr.getOperator() !== TokenType.PLUS) return undefined;

    const leftConst = this.tryResolveConstantAddress(left);
    if (leftConst !== undefined) return { base: leftConst, offsetExpr: right };

    const rightConst = this.tryResolveConstantAddress(right);
    if (rightConst !== undefined) return { base: rightConst, offsetExpr: left };

    return undefined;
}
```

**Gap**: Does not check whether `offsetExpr` is byte or word type. If word, the `TAX` instruction truncates to 8 bits, silently producing wrong code.

#### `generatePokeIntrinsic()` (line 1055)

```typescript
protected generatePokeIntrinsic(addrExpr, valueExpr, label): void {
    // Path 1: Pure constant → POKE with address operand
    const constAddr = this.tryResolveConstantAddress(addrExpr);
    if (constAddr !== undefined) { ... return; }

    // Path 2: CONST + byte_var → TAX + POKE with indexed operand
    const indexed = this.tryDecomposeIndexedAddress(addrExpr);
    if (indexed) { ... return; }

    // Path 3: Everything else → throw Error
    throw new Error("Dynamic poke address not supported...");
}
```

**Gap**: No Path 3 fallback for word offsets using indirect addressing.

#### Codegen `genPoke()` (intrinsics.ts line 51)

```typescript
protected genPoke(instr: ILInstruction): void {
    const addr = this.getAddressOperand(instr.operands);
    const mode = this.getAddressMode(addr);
    // STA supports: zeroPage, zeroPageX, absolute, absoluteX, absoluteY
    this.asm.sta(addr.address, mode);
}
```

**Gap**: No handling for `indirectY` mode. The ASM builder already supports `sta(addr, 'indirectY')` but the codegen never uses it for POKE.

## Gaps Identified

### Gap 1: Missing Constant Folding in Address Resolution

**Current Behavior:** `tryResolveConstantAddress(SCREEN_BASE + 250)` returns `undefined`
**Required Behavior:** Should recursively evaluate to `0x0400 + 250 = 0x04FA`
**Fix Required:** Add BinaryExpression case handling `+` and `-` operators with constant operands

### Gap 2: Silent Truncation of Word Offsets

**Current Behavior:** `tryDecomposeIndexedAddress(SCREEN_BASE + offset)` returns `{ base: 0x0400, offsetExpr: offset }` even when `offset` is `word` type. The subsequent `TRANSFER_AX` (TAX) truncates the 16-bit value to 8 bits.
**Required Behavior:** Detect word-type offsets and either: (a) emit indirect addressing, or (b) produce a clear error
**Fix Required:** Type-check the offset expression and branch to appropriate addressing mode

### Gap 3: No Indirect Addressing Path for POKE/PEEK

**Current Behavior:** No fallback for 16-bit dynamic addressing. Throws error.
**Required Behavior:** Compute full 16-bit address, store in ZP pointer, use `STA ($ptr),Y` / `LDA ($ptr),Y`
**Fix Required:** New IL generation path + codegen support for indirect indexed mode

## Dependencies

### Internal Dependencies

- ASM IL builder already supports `STA` with `indirectY` mode ✅
- ASM IL emitter already formats `IndirectIndexed` as `(ptr),Y` ✅
- Type information available through semantic analysis ✅
- ZP temp locations need to be defined/reserved (may already exist)

### External Dependencies

- None

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Constant folding integer overflow | Low | Medium | Mask to 16-bit range (& 0xFFFF) |
| ZP pointer conflicts with other compiler uses | Medium | High | Verify no other codegen path uses $FB/$FC simultaneously |
| Optimizer passes not understanding indirect addressing | Medium | Medium | Mark indirect POKE/PEEK as having side effects (already done) |
| Regression in existing poke/peek patterns | Low | High | Full test suite must pass before merging |
