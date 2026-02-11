# Word Arithmetic Opcodes: IL + Codegen

> **Document**: 03-word-arithmetic-opcodes.md
> **Parent**: [Index](00-index.md)

## Overview

Add 16-bit arithmetic IL opcodes and their 6502 codegen sequences. All word operations use the **A:X convention** (low byte in A, high byte in X).

## New IL Opcodes

### Addition

| Opcode | Description | Operands | Effect |
|--------|-------------|----------|--------|
| `ADD_WORD_IMM` | Add immediate word to A:X | `[ImmediateOperand]` | A:X ← A:X + imm16 |
| `ADD_WORD_BYTE_IMM` | Add immediate byte to A:X (with carry) | `[ImmediateOperand]` | A:X ← A:X + imm8 |
| `ADD_WORD_SLOT` | Add word slot to A:X | `[SlotOperand]` | A:X ← A:X + [slot16] |
| `ADD_WORD_BYTE_SLOT` | Add byte slot to A:X (zero-extended) | `[SlotOperand]` | A:X ← A:X + [slot8] |

### Subtraction

| Opcode | Description | Operands | Effect |
|--------|-------------|----------|--------|
| `SUB_WORD_IMM` | Subtract immediate word from A:X | `[ImmediateOperand]` | A:X ← A:X - imm16 |
| `SUB_WORD_BYTE_IMM` | Subtract immediate byte from A:X | `[ImmediateOperand]` | A:X ← A:X - imm8 |
| `SUB_WORD_SLOT` | Subtract word slot from A:X | `[SlotOperand]` | A:X ← A:X - [slot16] |
| `SUB_WORD_BYTE_SLOT` | Subtract byte slot from A:X | `[SlotOperand]` | A:X ← A:X - [slot8] |

### Comparison

| Opcode | Description | Operands | Effect |
|--------|-------------|----------|--------|
| `CMP_WORD_IMM` | Compare A:X with immediate word | `[ImmediateOperand]` | flags ← A:X cmp imm16 |
| `CMP_WORD_SLOT` | Compare A:X with word slot | `[SlotOperand]` | flags ← A:X cmp [slot16] |

### Increment/Decrement

| Opcode | Description | Operands | Effect |
|--------|-------------|----------|--------|
| `INC_WORD` | Increment word slot | `[SlotOperand]` | [slot16] ← [slot16] + 1 |
| `DEC_WORD` | Decrement word slot | `[SlotOperand]` | [slot16] ← [slot16] - 1 |

### Bitwise (Should Have)

| Opcode | Description | Operands | Effect |
|--------|-------------|----------|--------|
| `AND_WORD_IMM` | Bitwise AND A:X with immediate | `[ImmediateOperand]` | A:X ← A:X & imm16 |
| `OR_WORD_IMM` | Bitwise OR A:X with immediate | `[ImmediateOperand]` | A:X ← A:X \| imm16 |
| `XOR_WORD_IMM` | Bitwise XOR A:X with immediate | `[ImmediateOperand]` | A:X ← A:X ^ imm16 |
| `SHIFT_LEFT_WORD` | Shift A:X left by 1 | none | A:X ← A:X << 1 |
| `SHIFT_RIGHT_WORD` | Shift A:X right by 1 | none | A:X ← A:X >> 1 |

## 6502 Codegen Sequences

### ADD_WORD_BYTE_IMM (add byte immediate to A:X)

Most common case: `word_var + byte_literal` (e.g., `$0400 + 5`)

```asm
; A:X = A:X + byte_immediate
CLC
ADC #byte_value    ; add to low byte
BCC +2             ; if no carry, skip
INX                ; propagate carry to high byte
```

### ADD_WORD_IMM (add word immediate to A:X)

```asm
; A:X = A:X + word_immediate
CLC
ADC #<word_value   ; add low bytes
PHA                ; save low result
TXA                ; get high byte
ADC #>word_value   ; add high bytes + carry
TAX                ; high result back to X
PLA                ; restore low result to A
```

### ADD_WORD_BYTE_SLOT (add byte variable to A:X)

Common case: `$0400 + i` where i is byte variable

```asm
; A:X = A:X + byte_slot (zero-extended)
CLC
ADC slot_addr      ; add byte slot to low byte
BCC +2             ; if no carry, skip
INX                ; propagate carry to high byte
```

### ADD_WORD_SLOT (add word variable to A:X)

```asm
; A:X = A:X + word_slot
CLC
ADC slot_addr      ; add low bytes
PHA                ; save low result
TXA                ; get high byte
ADC slot_addr+1    ; add high bytes + carry
TAX                ; high result to X
PLA                ; restore low result to A
```

### SUB_WORD_BYTE_IMM (subtract byte immediate from A:X)

```asm
; A:X = A:X - byte_immediate
SEC
SBC #byte_value    ; subtract from low byte
BCS +2             ; if no borrow, skip
DEX                ; propagate borrow to high byte
```

### SUB_WORD_IMM (subtract word immediate from A:X)

```asm
; A:X = A:X - word_immediate
SEC
SBC #<word_value   ; subtract low bytes
PHA                ; save low result
TXA                ; get high byte
SBC #>word_value   ; subtract high bytes + borrow
TAX                ; high result to X
PLA                ; restore low result to A
```

### CMP_WORD_IMM (compare A:X with word immediate)

```asm
; Compare A:X with word — sets Z and C flags correctly
; Compare high bytes first; if not equal, that determines result
CPX #>word_value   ; compare high bytes
BNE .done          ; if high bytes differ, flags are set
CMP #<word_value   ; high bytes equal, compare low bytes
.done:
```

### INC_WORD (increment word slot in place)

```asm
; [slot16] += 1
INC slot_addr      ; increment low byte
BNE +2             ; if low byte didn't wrap to 0, done
INC slot_addr+1    ; increment high byte (carry)
```

### DEC_WORD (decrement word slot in place)

```asm
; [slot16] -= 1
LDA slot_addr      ; check if low byte is 0
BNE +2             ; if not 0, no borrow needed
DEC slot_addr+1    ; decrement high byte (borrow)
DEC slot_addr      ; decrement low byte
```

### SHIFT_LEFT_WORD (shift A:X left by 1)

```asm
; A:X <<= 1
ASL A              ; shift low byte left, bit 7 → carry
PHA                ; save low result
TXA                ; get high byte
ROL A              ; rotate left through carry
TAX                ; high result to X
PLA                ; restore low to A
```

## Type Promotion: Byte → Word

When a byte value needs to participate in word arithmetic, zero-extend it:

```asm
; Promote byte in A to word in A:X
LDX #0             ; high byte = 0 (unsigned extension)
```

This is emitted by the IL generator when it detects `byte + word` mixed arithmetic.

## Integration with Existing Opcodes

The new opcodes follow the same conventions as existing byte opcodes:
- Slot operands use `SlotOperand` with `FrameSlot`
- Immediate operands use `ImmediateOperand` with `isWord: true`
- Builder methods follow naming pattern: `addWordImm()`, `addWordSlot()`, etc.
- Codegen dispatch follows existing `switch(instr.opcode)` pattern

## Files to Modify

| File | Changes |
|------|---------|
| `il/enums.ts` | Add all new opcode enum values |
| `il/builder/arithmetic.ts` | Add builder methods for word ops |
| `il/builder/base.ts` | Add cost estimates for new opcodes |
| `codegen/generator/arithmetic.ts` | Add codegen for all word arithmetic sequences |
| `codegen/generator/comparison.ts` | Add codegen for word comparisons |
