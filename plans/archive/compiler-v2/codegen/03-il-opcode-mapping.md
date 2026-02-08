# IL Opcode to 6502 Mapping

> **Document**: 03-il-opcode-mapping.md
> **Parent**: [Index](00-index.md)

## Overview

This document defines the exact 6502 code generation pattern for every IL opcode. This is the authoritative reference for the Code Generator implementation.

**Format:** Each opcode shows:
- IL syntax and operands
- Generated 6502 code
- Accumulator state changes
- Notes on edge cases

---

## Memory Operations

### LOAD_BYTE

Load a byte from a slot into the accumulator.

| IL | `LOAD_BYTE slot` |
|---|---|
| 6502 (ZP) | `LDA $nn` |
| 6502 (ABS) | `LDA $nnnn` |
| A State | Known: address=slot.address |

```asm
; LOAD_BYTE counter (ZP slot at $02)
LDA $02

; LOAD_BYTE buffer (ABS slot at $0400)
LDA $0400
```

### STORE_BYTE

Store the accumulator to a slot.

| IL | `STORE_BYTE slot` |
|---|---|
| 6502 (ZP) | `STA $nn` |
| 6502 (ABS) | `STA $nnnn` |
| A State | Known: address=slot.address |

```asm
; STORE_BYTE result (ZP slot at $03)
STA $03
```

### LOAD_WORD

Load a 16-bit word from a slot (A=low, X=high).

| IL | `LOAD_WORD slot` |
|---|---|
| 6502 | `LDA slot` + `LDX slot+1` |
| A State | Unknown (low byte in A, high in X) |

```asm
; LOAD_WORD address (slot at $04)
LDA $04
LDX $05
```

### STORE_WORD

Store A/X to a word slot (A=low, X=high).

| IL | `STORE_WORD slot` |
|---|---|
| 6502 | `STA slot` + `STX slot+1` |
| A State | Preserved |

```asm
; STORE_WORD pointer (slot at $06)
STA $06
STX $07
```

### LOAD_IMM

Load an immediate byte value.

| IL | `LOAD_IMM value` |
|---|---|
| 6502 | `LDA #value` |
| A State | Known: immediate=value |

```asm
; LOAD_IMM 42
LDA #42
```

### LOAD_IMM_WORD

Load an immediate 16-bit value (A=low, X=high).

| IL | `LOAD_IMM_WORD value` |
|---|---|
| 6502 | `LDA #lo` + `LDX #hi` |
| A State | Unknown |

```asm
; LOAD_IMM_WORD $1234
LDA #$34
LDX #$12
```

---

## Arithmetic Operations

### ADD_BYTE

Add a byte slot to accumulator.

| IL | `ADD_BYTE slot` |
|---|---|
| 6502 | `CLC` + `ADC slot` |
| A State | Unknown (result) |

```asm
; ADD_BYTE value
CLC
ADC $02
```

### SUB_BYTE

Subtract a byte slot from accumulator.

| IL | `SUB_BYTE slot` |
|---|---|
| 6502 | `SEC` + `SBC slot` |
| A State | Unknown (result) |

```asm
; SUB_BYTE delta
SEC
SBC $03
```

### ADD_IMM

Add immediate to accumulator.

| IL | `ADD_IMM value` |
|---|---|
| 6502 | `CLC` + `ADC #value` |
| A State | Unknown (result) |

```asm
; ADD_IMM 5
CLC
ADC #5
```

### SUB_IMM

Subtract immediate from accumulator.

| IL | `SUB_IMM value` |
|---|---|
| 6502 | `SEC` + `SBC #value` |
| A State | Unknown (result) |

```asm
; SUB_IMM 1
SEC
SBC #1
```

### MUL_BYTE

Multiply accumulator by byte slot (software routine).

| IL | `MUL_BYTE slot` |
|---|---|
| 6502 | `STA _mul_a` + `LDA slot` + `STA _mul_b` + `JSR __mul8` |
| A State | Unknown (result) |

```asm
; MUL_BYTE factor
STA _mul_a
LDA $04
STA _mul_b
JSR __mul8
```

### MUL_IMM

Multiply accumulator by immediate (software routine).

| IL | `MUL_IMM value` |
|---|---|
| 6502 | `STA _mul_a` + `LDA #value` + `STA _mul_b` + `JSR __mul8` |
| A State | Unknown (result) |

### DIV_BYTE

Divide accumulator by byte slot (software routine).

| IL | `DIV_BYTE slot` |
|---|---|
| 6502 | `STA _div_a` + `LDA slot` + `STA _div_b` + `JSR __div8` |
| A State | Unknown (quotient) |

### MOD_BYTE

Modulo accumulator by byte slot (software routine).

| IL | `MOD_BYTE slot` |
|---|---|
| 6502 | `STA _mod_a` + `LDA slot` + `STA _mod_b` + `JSR __mod8` |
| A State | Unknown (remainder) |

### INC_BYTE

Increment a byte slot in place.

| IL | `INC_BYTE slot` |
|---|---|
| 6502 | `INC slot` |
| A State | Preserved |

### DEC_BYTE

Decrement a byte slot in place.

| IL | `DEC_BYTE slot` |
|---|---|
| 6502 | `DEC slot` |
| A State | Preserved |

---

## Bitwise Operations

### AND_BYTE

Bitwise AND with slot.

| IL | `AND_BYTE slot` |
|---|---|
| 6502 | `AND slot` |
| A State | Unknown (result) |

### OR_BYTE

Bitwise OR with slot.

| IL | `OR_BYTE slot` |
|---|---|
| 6502 | `ORA slot` |
| A State | Unknown (result) |

### XOR_BYTE

Bitwise XOR with slot.

| IL | `XOR_BYTE slot` |
|---|---|
| 6502 | `EOR slot` |
| A State | Unknown (result) |

### AND_IMM

Bitwise AND with immediate.

| IL | `AND_IMM value` |
|---|---|
| 6502 | `AND #value` |
| A State | Unknown (result) |

### OR_IMM

Bitwise OR with immediate.

| IL | `OR_IMM value` |
|---|---|
| 6502 | `ORA #value` |
| A State | Unknown (result) |

### XOR_IMM

Bitwise XOR with immediate.

| IL | `XOR_IMM value` |
|---|---|
| 6502 | `EOR #value` |
| A State | Unknown (result) |

### NOT_BYTE

Bitwise complement.

| IL | `NOT_BYTE` |
|---|---|
| 6502 | `EOR #$FF` |
| A State | Unknown (result) |

### SHL_BYTE

Shift left by count.

| IL | `SHL_BYTE count` |
|---|---|
| 6502 | `ASL A` × count |
| A State | Unknown (result) |

```asm
; SHL_BYTE 3
ASL A
ASL A
ASL A
```

### SHR_BYTE

Shift right by count (logical, unsigned).

| IL | `SHR_BYTE count` |
|---|---|
| 6502 | `LSR A` × count |
| A State | Unknown (result) |

---

## Comparison Operations

### CMP_BYTE

Compare accumulator with byte slot.

| IL | `CMP_BYTE slot` |
|---|---|
| 6502 | `CMP slot` |
| A State | Preserved |
| Flags | Z, N, C set |

### CMP_IMM

Compare accumulator with immediate.

| IL | `CMP_IMM value` |
|---|---|
| 6502 | `CMP #value` |
| A State | Preserved |
| Flags | Z, N, C set |

---

## Control Flow

### LABEL

Define a jump target label.

| IL | `LABEL name` |
|---|---|
| 6502 | `name:` |
| A State | Reset to unknown |

### JUMP

Unconditional jump.

| IL | `JUMP label` |
|---|---|
| 6502 | `JMP label` |
| A State | N/A (control transfer) |

### JUMP_EQ

Jump if equal (Z=1).

| IL | `JUMP_EQ label` |
|---|---|
| 6502 | `BEQ label` |
| A State | Preserved |

### JUMP_NE

Jump if not equal (Z=0).

| IL | `JUMP_NE label` |
|---|---|
| 6502 | `BNE label` |
| A State | Preserved |

### JUMP_LT

Jump if less than (unsigned, C=0).

| IL | `JUMP_LT label` |
|---|---|
| 6502 | `BCC label` |
| A State | Preserved |

### JUMP_GE

Jump if greater or equal (unsigned, C=1).

| IL | `JUMP_GE label` |
|---|---|
| 6502 | `BCS label` |
| A State | Preserved |

### JUMP_LE

Jump if less or equal (unsigned, C=0 OR Z=1).

| IL | `JUMP_LE label` |
|---|---|
| 6502 | `BCC label` + `BEQ label` |
| A State | Preserved |

### JUMP_GT

Jump if greater than (unsigned, C=1 AND Z=0).

| IL | `JUMP_GT label` |
|---|---|
| 6502 | `BEQ .skip` + `BCS label` + `.skip:` |
| A State | Preserved |

---

## Function Operations

### CALL

Call a function.

| IL | `CALL funcname` |
|---|---|
| 6502 | `JSR funcname` |
| A State | Reset to unknown |

### RETURN

Return from function.

| IL | `RETURN` |
|---|---|
| 6502 | `RTS` |
| A State | N/A |

---

## Register Transfer Operations

### TRANSFER_AX

Transfer A to X.

| IL | `TRANSFER_AX` |
|---|---|
| 6502 | `TAX` |
| A State | Preserved |

### TRANSFER_AY

Transfer A to Y.

| IL | `TRANSFER_AY` |
|---|---|
| 6502 | `TAY` |
| A State | Preserved |

### TRANSFER_XA

Transfer X to A.

| IL | `TRANSFER_XA` |
|---|---|
| 6502 | `TXA` |
| A State | Reset (now has X value) |

### TRANSFER_YA

Transfer Y to A.

| IL | `TRANSFER_YA` |
|---|---|
| 6502 | `TYA` |
| A State | Reset (now has Y value) |

---

## Intrinsics

See [04-intrinsics-codegen.md](04-intrinsics-codegen.md) for detailed intrinsic code generation.

### PEEK

Read byte from address.

| IL | `PEEK` (address in A/X) |
|---|---|
| 6502 | See intrinsics doc |

### POKE

Write byte to address.

| IL | `POKE` (address in A/X, value prepared) |
|---|---|
| 6502 | See intrinsics doc |

### PEEKW / POKEW / HI / LO

See intrinsics document.

---

## Special Operations

### NOP

No operation.

| IL | `NOP` |
|---|---|
| 6502 | `NOP` |
| A State | Preserved |

### PUSH_A

Push accumulator to stack.

| IL | `PUSH_A` |
|---|---|
| 6502 | `PHA` |
| A State | Preserved |

### POP_A

Pop accumulator from stack.

| IL | `POP_A` |
|---|---|
| 6502 | `PLA` |
| A State | Reset to unknown |

---

## Summary Table

| IL Opcode | 6502 Code | Cycles (approx) |
|-----------|-----------|-----------------|
| LOAD_BYTE | LDA | 3-4 |
| STORE_BYTE | STA | 3-4 |
| LOAD_WORD | LDA+LDX | 6-8 |
| STORE_WORD | STA+STX | 6-8 |
| LOAD_IMM | LDA # | 2 |
| LOAD_IMM_WORD | LDA#+LDX# | 4 |
| ADD_BYTE | CLC+ADC | 5-6 |
| SUB_BYTE | SEC+SBC | 5-6 |
| ADD_IMM | CLC+ADC# | 4 |
| SUB_IMM | SEC+SBC# | 4 |
| MUL_BYTE | JSR __mul8 | ~100 |
| DIV_BYTE | JSR __div8 | ~150 |
| MOD_BYTE | JSR __mod8 | ~150 |
| INC_BYTE | INC | 5-6 |
| DEC_BYTE | DEC | 5-6 |
| AND_BYTE | AND | 3-4 |
| OR_BYTE | ORA | 3-4 |
| XOR_BYTE | EOR | 3-4 |
| NOT_BYTE | EOR #$FF | 2 |
| SHL_BYTE | ASL×n | 2×n |
| SHR_BYTE | LSR×n | 2×n |
| CMP_BYTE | CMP | 3-4 |
| CMP_IMM | CMP # | 2 |
| LABEL | label: | 0 |
| JUMP | JMP | 3 |
| JUMP_EQ | BEQ | 2-3 |
| JUMP_NE | BNE | 2-3 |
| JUMP_LT | BCC | 2-3 |
| JUMP_GE | BCS | 2-3 |
| JUMP_LE | BCC+BEQ | 4-6 |
| JUMP_GT | BEQ+BCS | 4-6 |
| CALL | JSR | 6 |
| RETURN | RTS | 6 |
| NOP | NOP | 2 |
| PUSH_A | PHA | 3 |
| POP_A | PLA | 4 |