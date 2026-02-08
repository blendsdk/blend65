# Runtime Routines

> **Document**: 05-runtime-routines.md
> **Parent**: [Index](00-index.md)

## Overview

The 6502 doesn't have multiply, divide, or modulo instructions. The Code Generator includes software implementations as runtime routines.

## Multiply Routine (__mul8)

8-bit multiplication: A × B → A (8-bit result, overflow discarded)

**Parameters:**
- `_mul_a` (ZP): First operand
- `_mul_b` (ZP): Second operand

**Result:**
- A register: Low 8 bits of product

```asm
; Runtime ZP variables
_mul_a = $02
_mul_b = $03
_mul_tmp = $04

; 8-bit multiply: _mul_a × _mul_b → A
__mul8:
    LDA #0              ; Clear result
    LDX #8              ; 8 bits
.loop:
    LSR _mul_b          ; Shift multiplier right
    BCC .skip           ; If bit was 0, skip add
    CLC
    ADC _mul_a          ; Add multiplicand
.skip:
    ASL _mul_a          ; Shift multiplicand left
    DEX
    BNE .loop
    RTS
```

**Cycles:** ~80-100 depending on operand values

---

## Divide Routine (__div8)

8-bit unsigned division: A ÷ B → A (quotient)

**Parameters:**
- `_div_a` (ZP): Dividend
- `_div_b` (ZP): Divisor

**Result:**
- A register: Quotient

```asm
_div_a = $05
_div_b = $06
_div_rem = $07

; 8-bit divide: _div_a ÷ _div_b → A (quotient), _div_rem (remainder)
__div8:
    LDA #0              ; Clear remainder
    STA _div_rem
    LDX #8              ; 8 bits
.loop:
    ASL _div_a          ; Shift dividend left
    ROL _div_rem        ; Rotate into remainder
    LDA _div_rem
    SEC
    SBC _div_b          ; Try subtracting divisor
    BCC .skip           ; If underflow, skip
    STA _div_rem        ; Store new remainder
    INC _div_a          ; Set quotient bit
.skip:
    DEX
    BNE .loop
    LDA _div_a          ; Return quotient in A
    RTS
```

**Cycles:** ~120-150

---

## Modulo Routine (__mod8)

8-bit unsigned modulo: A % B → A (remainder)

**Parameters:**
- `_mod_a` (ZP): Dividend
- `_mod_b` (ZP): Divisor

**Result:**
- A register: Remainder

```asm
_mod_a = $08
_mod_b = $09
_mod_rem = $0A

; 8-bit modulo: _mod_a % _mod_b → A (remainder)
__mod8:
    LDA #0
    STA _mod_rem
    LDX #8
.loop:
    ASL _mod_a
    ROL _mod_rem
    LDA _mod_rem
    SEC
    SBC _mod_b
    BCC .skip
    STA _mod_rem
    INC _mod_a
.skip:
    DEX
    BNE .loop
    LDA _mod_rem        ; Return remainder in A
    RTS
```

---

## Zero Page Allocation

| Address | Variable | Purpose |
|---------|----------|---------|
| $02 | _mul_a | Multiply operand A |
| $03 | _mul_b | Multiply operand B |
| $04 | _mul_tmp | Multiply temp |
| $05 | _div_a | Divide dividend |
| $06 | _div_b | Divide divisor |
| $07 | _div_rem | Divide remainder |
| $08 | _mod_a | Modulo dividend |
| $09 | _mod_b | Modulo divisor |
| $0A | _mod_rem | Modulo remainder |
| $FB-$FC | _ptr | Indirect pointer |
| $FD | _tmp | Temporary storage |

**Note:** These addresses are in the "user" ZP range ($02-$8F) and don't conflict with KERNAL.

---

## Runtime Inclusion

The runtime routines are only included if used. The Code Generator tracks which routines are needed and emits them at the end of the program.

```typescript
interface RuntimeNeeds {
  mul8: boolean;
  div8: boolean;
  mod8: boolean;
}
```