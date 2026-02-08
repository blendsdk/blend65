# ASM Function Declarations (asm.blend)

> **Document**: 03-asm-blend-declarations.md
> **Parent**: [Index](00-index.md)
> **Specification**: [09-asm-functions.md](../../../docs/language-specification-v2/09-asm-functions.md)

## Overview

Create a new `asm.blend` library file containing stub declarations for all 56 official 6502 opcodes with their addressing mode variants. This is exactly **151 function stubs** that the compiler will recognize and generate direct 6502 instructions for.

## Location

`packages/compiler-v2/library/common/asm.blend`

This file is in `common/` so it is **auto-loaded for all targets** (every 6502-based platform supports these instructions).

## Function Categories & Counts

| Category | Opcodes | Functions | Notes |
|----------|---------|-----------|-------|
| Load/Store | LDA, LDX, LDY, STA, STX, STY | 31 | Multiple addressing modes |
| Transfer | TAX, TAY, TXA, TYA, TSX, TXS | 6 | Implied only |
| Arithmetic | ADC, SBC, INC, DEC, INX, INY, DEX, DEY | 28 | ADC:8 + SBC:8 + INC:4 + DEC:4 + register:4 |
| Logical | AND, ORA, EOR | 24 | 8 addressing modes each |
| Compare | CMP, CPX, CPY | 14 | Multiple addressing modes |
| Shift/Rotate | ASL, LSR, ROL, ROR | 20 | Accumulator + memory variants |
| Branch | BCC, BCS, BEQ, BNE, BMI, BPL, BVC, BVS | 8 | Relative only |
| Jump/Call | JMP, JSR, RTS, RTI | 5 | Absolute + indirect |
| Stack | PHA, PLA, PHP, PLP | 4 | Implied only |
| Flags | CLC, SEC, CLI, SEI, CLD, SED, CLV | 7 | Implied only |
| Bit Test | BIT | 2 | ZP + absolute |
| Misc | NOP, BRK | 2 | Implied only |
| **Total** | **56** | **151** | |

## Complete Function List

### Load/Store (31 functions)

```js
// LDA - Load Accumulator (8 modes)
export function asm_lda_imm(value: byte): void;
export function asm_lda_zp(addr: byte): void;
export function asm_lda_zpx(addr: byte): void;
export function asm_lda_abs(addr: word): void;
export function asm_lda_abx(addr: word): void;
export function asm_lda_aby(addr: word): void;
export function asm_lda_inx(addr: byte): void;
export function asm_lda_iny(addr: byte): void;

// LDX - Load X Register (5 modes)
export function asm_ldx_imm(value: byte): void;
export function asm_ldx_zp(addr: byte): void;
export function asm_ldx_zpy(addr: byte): void;
export function asm_ldx_abs(addr: word): void;
export function asm_ldx_aby(addr: word): void;

// LDY - Load Y Register (5 modes)
export function asm_ldy_imm(value: byte): void;
export function asm_ldy_zp(addr: byte): void;
export function asm_ldy_zpx(addr: byte): void;
export function asm_ldy_abs(addr: word): void;
export function asm_ldy_abx(addr: word): void;

// STA - Store Accumulator (7 modes)
export function asm_sta_zp(addr: byte): void;
export function asm_sta_zpx(addr: byte): void;
export function asm_sta_abs(addr: word): void;
export function asm_sta_abx(addr: word): void;
export function asm_sta_aby(addr: word): void;
export function asm_sta_inx(addr: byte): void;
export function asm_sta_iny(addr: byte): void;

// STX - Store X Register (3 modes)
export function asm_stx_zp(addr: byte): void;
export function asm_stx_zpy(addr: byte): void;
export function asm_stx_abs(addr: word): void;

// STY - Store Y Register (3 modes)
export function asm_sty_zp(addr: byte): void;
export function asm_sty_zpx(addr: byte): void;
export function asm_sty_abs(addr: word): void;
```

### Transfer (6 functions)

```js
export function asm_tax(): void;
export function asm_tay(): void;
export function asm_txa(): void;
export function asm_tya(): void;
export function asm_tsx(): void;
export function asm_txs(): void;
```

### Arithmetic (28 functions)

```js
// ADC (8 modes)
export function asm_adc_imm(value: byte): void;
export function asm_adc_zp(addr: byte): void;
export function asm_adc_zpx(addr: byte): void;
export function asm_adc_abs(addr: word): void;
export function asm_adc_abx(addr: word): void;
export function asm_adc_aby(addr: word): void;
export function asm_adc_inx(addr: byte): void;
export function asm_adc_iny(addr: byte): void;

// SBC (8 modes)
export function asm_sbc_imm(value: byte): void;
export function asm_sbc_zp(addr: byte): void;
export function asm_sbc_zpx(addr: byte): void;
export function asm_sbc_abs(addr: word): void;
export function asm_sbc_abx(addr: word): void;
export function asm_sbc_aby(addr: word): void;
export function asm_sbc_inx(addr: byte): void;
export function asm_sbc_iny(addr: byte): void;

// INC/DEC memory (4+4 modes)
export function asm_inc_zp(addr: byte): void;
export function asm_inc_zpx(addr: byte): void;
export function asm_inc_abs(addr: word): void;
export function asm_inc_abx(addr: word): void;
export function asm_dec_zp(addr: byte): void;
export function asm_dec_zpx(addr: byte): void;
export function asm_dec_abs(addr: word): void;
export function asm_dec_abx(addr: word): void;

// INC/DEC register (implied)
export function asm_inx(): void;
export function asm_iny(): void;
export function asm_dex(): void;
export function asm_dey(): void;
```

### Logical (24 functions)

```js
// AND (8 modes)
export function asm_and_imm(value: byte): void;
export function asm_and_zp(addr: byte): void;
export function asm_and_zpx(addr: byte): void;
export function asm_and_abs(addr: word): void;
export function asm_and_abx(addr: word): void;
export function asm_and_aby(addr: word): void;
export function asm_and_inx(addr: byte): void;
export function asm_and_iny(addr: byte): void;

// ORA (8 modes)
export function asm_ora_imm(value: byte): void;
export function asm_ora_zp(addr: byte): void;
export function asm_ora_zpx(addr: byte): void;
export function asm_ora_abs(addr: word): void;
export function asm_ora_abx(addr: word): void;
export function asm_ora_aby(addr: word): void;
export function asm_ora_inx(addr: byte): void;
export function asm_ora_iny(addr: byte): void;

// EOR (8 modes)
export function asm_eor_imm(value: byte): void;
export function asm_eor_zp(addr: byte): void;
export function asm_eor_zpx(addr: byte): void;
export function asm_eor_abs(addr: word): void;
export function asm_eor_abx(addr: word): void;
export function asm_eor_aby(addr: word): void;
export function asm_eor_inx(addr: byte): void;
export function asm_eor_iny(addr: byte): void;
```

### Compare (14 functions)

```js
// CMP (8 modes)
export function asm_cmp_imm(value: byte): void;
export function asm_cmp_zp(addr: byte): void;
export function asm_cmp_zpx(addr: byte): void;
export function asm_cmp_abs(addr: word): void;
export function asm_cmp_abx(addr: word): void;
export function asm_cmp_aby(addr: word): void;
export function asm_cmp_inx(addr: byte): void;
export function asm_cmp_iny(addr: byte): void;

// CPX (3 modes)
export function asm_cpx_imm(value: byte): void;
export function asm_cpx_zp(addr: byte): void;
export function asm_cpx_abs(addr: word): void;

// CPY (3 modes)
export function asm_cpy_imm(value: byte): void;
export function asm_cpy_zp(addr: byte): void;
export function asm_cpy_abs(addr: word): void;
```

### Shift/Rotate (20 functions)

```js
// Accumulator variants (implied)
export function asm_asl(): void;
export function asm_lsr(): void;
export function asm_rol(): void;
export function asm_ror(): void;

// Memory variants (4 modes each × 4 ops = 16)
export function asm_asl_zp(addr: byte): void;
export function asm_asl_zpx(addr: byte): void;
export function asm_asl_abs(addr: word): void;
export function asm_asl_abx(addr: word): void;

export function asm_lsr_zp(addr: byte): void;
export function asm_lsr_zpx(addr: byte): void;
export function asm_lsr_abs(addr: word): void;
export function asm_lsr_abx(addr: word): void;

export function asm_rol_zp(addr: byte): void;
export function asm_rol_zpx(addr: byte): void;
export function asm_rol_abs(addr: word): void;
export function asm_rol_abx(addr: word): void;

export function asm_ror_zp(addr: byte): void;
export function asm_ror_zpx(addr: byte): void;
export function asm_ror_abs(addr: word): void;
export function asm_ror_abx(addr: word): void;
```

### Branch (8 functions)

```js
export function asm_bcc_rel(offset: byte): void;
export function asm_bcs_rel(offset: byte): void;
export function asm_beq_rel(offset: byte): void;
export function asm_bne_rel(offset: byte): void;
export function asm_bmi_rel(offset: byte): void;
export function asm_bpl_rel(offset: byte): void;
export function asm_bvc_rel(offset: byte): void;
export function asm_bvs_rel(offset: byte): void;
```

### Jump/Call (5 functions)

```js
export function asm_jmp_abs(addr: word): void;
export function asm_jmp_ind(addr: word): void;
export function asm_jsr(addr: word): void;
export function asm_rts(): void;
export function asm_rti(): void;
```

### Stack (4 functions)

```js
export function asm_pha(): void;
export function asm_pla(): void;
export function asm_php(): void;
export function asm_plp(): void;
```

### Flags (7 functions)

```js
export function asm_clc(): void;
export function asm_sec(): void;
export function asm_cli(): void;
export function asm_sei(): void;
export function asm_cld(): void;
export function asm_sed(): void;
export function asm_clv(): void;
```

### Bit Test (2 functions)

```js
export function asm_bit_zp(addr: byte): void;
export function asm_bit_abs(addr: word): void;
```

### Misc (2 functions)

```js
export function asm_nop(): void;
export function asm_brk(): void;
```

## Implementation Notes

- Each function stub has **no body** (just the signature with semicolon)
- The compiler recognizes `asm_*` prefix as a special intrinsic pattern
- Each function maps to **exactly one 6502 instruction**
- The `asm.blend` file should include JSDoc comments organized by category
- Module declaration: `module asm;`

## Testing Requirements

- Verify `asm.blend` parses without errors
- Verify all 151 function stubs are registered in symbol table
- Verify the semantic analyzer recognizes them as valid stub functions
- Integration test: LibraryLoader auto-loads asm.blend from common/

## Dependencies

- Library loader migration (01-infrastructure.md)
- v2 parser must handle stub function declarations (already working)
