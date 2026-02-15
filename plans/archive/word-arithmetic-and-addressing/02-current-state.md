# Current State: Word Arithmetic & Indirect Addressing

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## What Exists (Working)

### Word Load/Store (IL + Codegen)

| IL Opcode | Codegen | Status |
|-----------|---------|--------|
| `LOAD_WORD` | `LDA addr / LDX addr+1` | ✅ Working |
| `STORE_WORD` | `STA addr / STX addr+1` | ✅ Working |
| `LOAD_IMM_WORD` | `LDA #lo / LDX #hi` | ✅ Working |

Convention: **low byte in A, high byte in X**.

### Byte Arithmetic (IL + Codegen)

| IL Opcode | Description | Status |
|-----------|-------------|--------|
| `ADD_BYTE` | 8-bit add from stack | ✅ Working |
| `ADD_IMM` | 8-bit add immediate | ✅ Working |
| `SUB_BYTE` | 8-bit subtract from stack | ✅ Working |
| `SUB_IMM` | 8-bit subtract immediate | ✅ Working |
| `MUL_BYTE` | 8-bit multiply | ✅ Working |
| `MUL_IMM` | 8-bit multiply immediate | ✅ Working |
| `DIV_BYTE` | 8-bit divide | ✅ Working |
| `CMP_BYTE` | 8-bit compare from stack | ✅ Working |
| `CMP_IMM` | 8-bit compare immediate | ✅ Working |

### Intrinsic Fast Paths

| Path | IL Pattern | Codegen | Status |
|------|-----------|---------|--------|
| Constant address | `POKE [AddressOperand]` | `STA $addr` | ✅ Working |
| Constant + byte var | `POKE [IndexedAddressOperand]` | `STA $base,X` | ✅ Working |
| Dynamic address | — | — | ❌ Throws error |

### ASM-IL Indirect Support

The ASM-IL layer already supports `IndirectIndexed` addressing mode via `asm_*()` functions:
- `AsmAddressingMode.IndirectIndexed` enum value exists ✅
- `mapAsmRawAddressingMode('indirectY')` maps correctly ✅
- NOT used by peek/poke intrinsics ❌

### TypeInfo on AST Nodes

The semantic analyzer already sets `TypeInfo` on all expression nodes:
- `node.typeInfo: TypeInfo` property exists ✅
- `node.getTypeInfo(): TypeInfo | undefined` method exists ✅
- IL generator does NOT query this for arithmetic decisions ❌

### ZP Scratch Space

C64 platform reserves: `{ start: 0xFB, end: 0xFF, label: 'compiler_scratch' }` (4 bytes)
- $FB/$FC available for pointer ✅
- $FD/$FE available for second pointer ✅
- NOT currently used by codegen ❌

## What's Missing (Gaps)

### Gap 1: No Word Arithmetic IL Opcodes

The IL has `ADD_BYTE`, `SUB_BYTE`, etc. but **zero** word equivalents. This means:
```js
let addr: word = $0400 + i;  // Uses ADD_BYTE → 8-bit result → wrong
```

**Impact**: ALL word expressions produce wrong results at runtime.

### Gap 2: Expression Generator Ignores Types

`generateBinary()` in `expressions.ts` always uses 8-bit opcodes:
```typescript
// Current code — always 8-bit regardless of type:
case TokenType.PLUS:
  this.builder.addImm(value);  // ADD_IMM (8-bit always!)
  break;
```

**Impact**: `word + byte`, `word + word` all truncated to 8 bits.

### Gap 3: No Indirect Addressing in Codegen

`getAddressMode()` only returns direct modes:
```typescript
protected getAddressMode(addr): 'zeroPage' | 'zeroPageX' | ... | 'absoluteY'
// No 'indirectIndexed' option!
```

`getAddressOperand()` throws if no address operand present:
```typescript
if (!op || op.kind !== 'address') {
  throw new Error(`Expected address operand...`);
}
```

**Impact**: No way to poke/peek at runtime-computed addresses.

### Gap 4: All 4 Intrinsics Missing Dynamic Path

| Intrinsic | Constant addr | Indexed addr | Dynamic addr |
|-----------|--------------|--------------|--------------|
| `peek()` | ✅ | ✅ | ❌ Throws |
| `poke()` | ✅ | ✅ | ❌ Throws |
| `peekw()` | ✅ | ❌ | ❌ Dead code (would crash) |
| `pokew()` | ✅ | ❌ | ❌ Dead code (would crash) |

### Gap 5: No Constant Folding for Non-Addition

`tryResolveConstantAddress()` only handles:
1. Numeric literals
2. Constant identifier references

Does NOT handle: `CONST + CONST`, `CONST * CONST`, `CONST << CONST`, etc.

### Gap 6: No Word Comparisons

`CMP_BYTE` and `CMP_IMM` are 8-bit only. Word comparisons (`if (addr > $0400)`) and word loop conditions (`for (i: word = 0 to 1000)`) produce wrong results.

### Gap 7: No Word Increment

`INC_BYTE` exists but no `INC_WORD`. `wordVar += 1` uses 8-bit increment, wrapping at 255 instead of 65535.

## Dependencies

### Internal Dependencies
- TypeInfo infrastructure (✅ exists) — needed by type-aware expressions
- A:X word convention (✅ exists) — needed by word arithmetic
- ASM-IL IndirectIndexed (✅ exists) — needed by indirect addressing
- ZP scratch $FB-$FE (✅ exists) — needed by pointer storage

### External Dependencies
- None

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Existing tests break from type-aware changes | Medium | High | Byte expressions must generate identical code |
| A:X convention conflicts with existing X usage | Low | Medium | Careful register preservation in codegen |
| Optimizer doesn't understand new word opcodes | Medium | Medium | Add word opcodes to optimizer's instruction tables |
| ZP scratch conflicts with user ZP variables | Low | Low | $FB-$FE already reserved, not available to user |
