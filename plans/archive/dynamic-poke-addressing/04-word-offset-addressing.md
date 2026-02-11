# Word Offset Addressing for Poke/Peek

> **Document**: 04-word-offset-addressing.md
> **Parent**: [Index](00-index.md)

## Overview

When `poke()` or `peek()` is called with a word-type (16-bit) offset like `poke(SCREEN_BASE + offset, value)` where `offset: word`, the current indexed addressing pattern (`TAX` + `STA base,X`) silently produces incorrect code because the 6502's X register is only 8 bits. The high byte of the offset is lost.

This document specifies two phases of the fix:
1. **Phase A** — Detect word offsets and emit a clear error (safety net)
2. **Phase B** — Support word offsets via 6502 indirect indexed addressing `STA ($ptr),Y`

## Architecture

### Current (Broken) Flow for Word Offsets

```
poke(SCREEN_BASE + offset, value)   where offset: word
  ↓
tryDecomposeIndexedAddress → { base: 0x0400, offsetExpr: offset }
  ↓
generateExpression(offset) → computes 16-bit value into A (low) + X (high)
TRANSFER_AX              → only low byte goes to X! HIGH BYTE LOST!
POKE $0400,X             → wrong address for offsets > 255
```

### Proposed Flow (Phase B)

```
poke(SCREEN_BASE + offset, value)   where offset: word
  ↓
tryDecomposeIndexedAddress → { base: 0x0400, offsetExpr: offset }
  ↓
detect word-type offset → use indirect addressing path
  ↓
Compute full 16-bit address: SCREEN_BASE + offset
Store in ZP pointer: STA $FB / STX $FC
Generate value expression into A
STA ($FB),Y  with Y=0    → correct for any 16-bit address
```

## Implementation Details

### Phase A: Word Offset Detection (Safety Net)

**Goal:** Prevent silent incorrect code by detecting word-type offsets and producing a clear error message.

**File:** `packages/compiler/src/il/generator/expressions.ts`

**Changes to `generatePokeIntrinsic()` and `generatePeekIntrinsic()`:**

After `tryDecomposeIndexedAddress` succeeds, check if the offset expression resolves to a word type. If so, either use indirect addressing (Phase B) or emit an error.

```typescript
// In generatePokeIntrinsic(), after tryDecomposeIndexedAddress succeeds:
const indexed = this.tryDecomposeIndexedAddress(addrExpr);
if (indexed) {
  // Check if offset is word type — X register can only hold 8 bits
  const offsetType = this.resolveExpressionType(indexed.offsetExpr);
  if (offsetType && offsetType.size > 1) {
    // Word offset requires indirect addressing (Phase B)
    // For now, emit an error until indirect addressing is implemented
    this.generateIndirectPoke(indexed.base, indexed.offsetExpr, valueExpr, label);
    return;
  }
  // Existing byte-offset path: TAX + STA base,X
  // ... (unchanged)
}
```

### Phase B: Indirect Addressing Implementation

**Goal:** Support word offsets using 6502 indirect indexed addressing.

#### B.1: New IL Opcode or Extended Operand

**Option chosen: Extended operand with `indirectY` addressing mode.**

Add a new operand type or extend `AddressOperand` to support indirect indexed mode:

**File:** `packages/compiler/src/il/operands.ts`

The existing `AddressOperand` already has `indexRegister?: 'X' | 'Y'`. We need to add an `indirect` flag:

```typescript
export interface AddressOperand {
  readonly kind: 'address';
  readonly address: number;
  readonly isZeroPage: boolean;
  readonly indexRegister?: 'X' | 'Y';
  readonly indirect?: boolean;  // NEW: true for (addr),Y mode
}
```

**File:** `packages/compiler/src/il/factories.ts`

Add a factory function for indirect addressing:

```typescript
/**
 * Creates an indirect indexed address operand for (ptr),Y mode.
 * Used when poke/peek needs 16-bit dynamic addressing.
 * The address is a ZP pointer location (e.g., $FB).
 */
export function createIndirectAddressOperand(
  zpPointer: number,
): AddressOperand {
  return {
    kind: 'address',
    address: zpPointer,
    isZeroPage: true,
    indexRegister: 'Y',
    indirect: true,
  };
}
```

#### B.2: IL Generation for Indirect Poke

**File:** `packages/compiler/src/il/generator/expressions.ts`

New method for generating indirect poke:

```typescript
/**
 * Generate IL for poke with word-sized dynamic offset using indirect addressing.
 *
 * Computes the full 16-bit address (base + word_offset), stores it in
 * the ZP scratch pointer ($FB/$FC), then emits STA ($FB),Y with Y=0.
 *
 * Assembly pattern:
 *   CLC
 *   LDA offset_lo    ; low byte of offset
 *   ADC #<base       ; add low byte of base constant
 *   STA $FB          ; store pointer low
 *   LDA offset_hi    ; high byte of offset (from X reg)
 *   ADC #>base       ; add high byte of base constant (with carry)
 *   STA $FC          ; store pointer high
 *   LDY #0           ; Y = 0 (no additional offset)
 *   LDA value        ; load value to write
 *   STA ($FB),Y      ; indirect indexed store
 */
protected generateIndirectPoke(
  base: number,
  offsetExpr: Expression,
  valueExpr: Expression,
  label: string,
): void {
  // 1. Compute the full 16-bit address: base + offset
  //    Generate offset (word) → result in A (low) and X (high)
  this.generateExpression(offsetExpr);
  
  // 2. Emit IL to add base constant and store in ZP pointer
  this.builder.emit(ILOpcode.SETUP_INDIRECT_PTR, 
    [createAddressOperand(base), createAddressOperand(this.getZpScratchPtr())],
    `setup ptr: $${base.toString(16)} + offset → ($FB)`
  );
  
  // 3. Generate the value expression
  this.generateExpression(valueExpr);
  
  // 4. Emit indirect POKE
  this.builder.emit(
    ILOpcode.POKE,
    [createIndirectAddressOperand(this.getZpScratchPtr())],
    `${label}(($FB),Y)`
  );
}
```

**Alternative (simpler) approach — inline IL sequence without new opcode:**

Instead of a new `SETUP_INDIRECT_PTR` opcode, we can emit a sequence of existing IL instructions that the codegen already knows how to handle. This avoids adding new opcodes entirely.

```typescript
protected generateIndirectPoke(
  base: number,
  offsetExpr: Expression,
  valueExpr: Expression,
  label: string,
): void {
  const zpPtr = this.getZpScratchPtr(); // e.g., 0xFB
  
  // 1. Generate offset (word) into A/X
  this.generateExpression(offsetExpr);
  
  // 2. Add base constant: offset + base → ZP pointer
  //    Uses LOAD_IMM + ADC for 16-bit addition, stores to ZP scratch
  this.builder.emit(ILOpcode.ADD_CONST_STORE_PTR,
    [createImmediateOperand(base & 0xFF),       // base low
     createImmediateOperand((base >> 8) & 0xFF), // base high
     createAddressOperand(zpPtr)],               // destination ZP pointer
    `compute ptr: $${base.toString(16)} + offset → ($${zpPtr.toString(16)})`
  );
  
  // 3. Load Y=0 for indirect addressing
  this.builder.emit(ILOpcode.LOAD_IMM_Y, [createImmediateOperand(0)], 'Y = 0');
  
  // 4. Generate value
  this.generateExpression(valueExpr);
  
  // 5. Emit POKE with indirect operand
  this.builder.emit(
    ILOpcode.POKE,
    [createIndirectAddressOperand(zpPtr)],
    `${label}(($${zpPtr.toString(16)}),Y)`
  );
}
```

**Note:** The exact approach (new opcode vs. extended existing opcodes) will be determined during implementation based on what integrates best with the existing IL architecture.

#### B.3: Codegen for Indirect POKE/PEEK

**File:** `packages/compiler/src/codegen/generator/intrinsics.ts`

Modify `genPoke()` to handle the indirect addressing mode:

```typescript
protected genPoke(instr: ILInstruction): void {
  this.emitComment(instr);
  const addr = this.getAddressOperand(instr.operands);
  const mode = this.getAddressMode(addr);
  
  // STA supports: zeroPage, zeroPageX, absolute, absoluteX, absoluteY,
  //               indirectX, indirectY (NEW)
  this.asm.sta(addr.address, mode as Parameters<typeof this.asm.sta>[1]);
}
```

Modify `getAddressMode()` in base.ts to handle indirect flag:

```typescript
protected getAddressMode(addr: AddressOperand): string {
  if (addr.indirect && addr.indexRegister === 'Y') {
    return 'indirectY';  // (ptr),Y mode
  }
  // ... existing code unchanged ...
}
```

## ZP Scratch Pointer

The C64 platform config already reserves $FB-$FE as compiler scratch:

```typescript
// From packages/compiler/src/frame/platform.ts
zpScratch: {
  start: 0xFB,
  end: 0xFF,
  label: 'compiler_scratch',
}
```

- `$FB` — Pointer low byte
- `$FC` — Pointer high byte
- `$FD-$FE` — Additional scratch (available for future use)

The codegen currently doesn't use these locations, so they're available.

## 6502 Assembly Pattern

### For `poke(SCREEN_BASE + offset, value)` where offset is word:

```asm
; Compute full address: $0400 + offset
CLC
LDA offset_lo       ; Low byte of word offset
ADC #<$0400         ; Add low byte of SCREEN_BASE
STA $FB             ; Store pointer low
LDA offset_hi       ; High byte of word offset  
ADC #>$0400         ; Add high byte + carry
STA $FC             ; Store pointer high
; Write value
LDY #$00            ; Y = 0 (no additional offset)
LDA value           ; Load value to write
STA ($FB),Y         ; Indirect indexed store — correct for any address
```

### For `peek(SCREEN_BASE + offset)` where offset is word:

```asm
; Same pointer setup as above
CLC
LDA offset_lo
ADC #<$0400
STA $FB
LDA offset_hi
ADC #>$0400
STA $FC
; Read value
LDY #$00
LDA ($FB),Y         ; Indirect indexed load
```

## Code Examples

### Before Fix (Silent Bug)

```js
let offset: word = y * 40 + x;     // e.g., 12 * 40 + 5 = 485
poke(SCREEN_BASE + offset, 65);    // Should write to $0400 + 485 = $05E5
                                     // BUG: only low byte (485 & 0xFF = 229) used
                                     // Actually writes to $0400 + 229 = $04E5 — WRONG!
```

### After Fix (Correct)

```js
let offset: word = y * 40 + x;     // e.g., 485
poke(SCREEN_BASE + offset, 65);    // Computes $0400 + 485 = $05E5
                                     // Stores $E5 in $FB, $05 in $FC
                                     // STA ($FB),Y → writes to $05E5 ✅
```

## Error Handling

| Error Case | Handling Strategy |
|------------|-------------------|
| ZP scratch not available | Use platform config to get correct scratch start address |
| Concurrent ZP pointer use | Document as limitation; one indirect poke/peek at a time |
| Nested indirect operations | The sequential IL nature prevents conflicts |
| Optimizer moving indirect setup | Mark POKE with side effects (already done) |

## Testing Requirements

- Unit test: word-offset detection in `tryDecomposeIndexedAddress`
- Unit test: indirect POKE IL generation
- Unit test: indirect PEEK IL generation
- Integration test: `poke(CONST + word_var, value)` through full pipeline
- E2E test: starfield simulation (sprite-test.blend) compiles and produces correct assembly
- Regression: all existing poke/peek tests pass unchanged
