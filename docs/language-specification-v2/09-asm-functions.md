# ASM Functions

> **Status**: Draft  
> **Related Documents**: [Intrinsics](08-intrinsics.md), [Compiler](10-compiler.md)

## Overview

ASM functions provide **direct 6502 instruction access** from Blend65 code. Each function maps to exactly one 6502 opcode, giving developers low-level CPU control when needed.

## Design Philosophy

1. **One function = One opcode**: Each `asm_*` function compiles to exactly one 6502 instruction
2. **Zero overhead**: No runtime cost beyond the instruction itself
3. **Complete coverage**: All 56 official 6502 opcodes are available
4. **Addressing mode specificity**: Different addressing modes are separate functions

## Naming Convention

```
asm_<mnemonic>_<addressing_mode>
```

**Examples:**
- `asm_lda_imm(value)` → `LDA #value` (immediate)
- `asm_lda_abs(addr)` → `LDA addr` (absolute)
- `asm_lda_zp(addr)` → `LDA addr` (zero page)
- `asm_sei()` → `SEI` (implied)

## Addressing Modes

| Suffix | Addressing Mode | 6502 Syntax | Example Function |
|--------|-----------------|-------------|------------------|
| (none) | Implied | `SEI` | `asm_sei()` |
| `_imm` | Immediate | `LDA #$00` | `asm_lda_imm(0)` |
| `_zp` | Zero Page | `LDA $00` | `asm_lda_zp(0)` |
| `_zpx` | Zero Page,X | `LDA $00,X` | `asm_lda_zpx(0)` |
| `_zpy` | Zero Page,Y | `LDA $00,Y` | `asm_ldx_zpy(0)` |
| `_abs` | Absolute | `LDA $1234` | `asm_lda_abs($1234)` |
| `_abx` | Absolute,X | `LDA $1234,X` | `asm_lda_abx($1234)` |
| `_aby` | Absolute,Y | `LDA $1234,Y` | `asm_lda_aby($1234)` |
| `_ind` | Indirect | `JMP ($1234)` | `asm_jmp_ind($1234)` |
| `_inx` | Indexed Indirect | `LDA ($00,X)` | `asm_lda_inx(0)` |
| `_iny` | Indirect Indexed | `LDA ($00),Y` | `asm_lda_iny(0)` |
| `_rel` | Relative | `BEQ label` | `asm_beq_rel(offset)` |

## Complete ASM Function Reference

### Load/Store Operations

#### LDA - Load Accumulator

```js
asm_lda_imm(value: byte): void;   // LDA #value
asm_lda_zp(addr: byte): void;     // LDA addr
asm_lda_zpx(addr: byte): void;    // LDA addr,X
asm_lda_abs(addr: word): void;    // LDA addr
asm_lda_abx(addr: word): void;    // LDA addr,X
asm_lda_aby(addr: word): void;    // LDA addr,Y
asm_lda_inx(addr: byte): void;    // LDA (addr,X)
asm_lda_iny(addr: byte): void;    // LDA (addr),Y
```

#### LDX - Load X Register

```js
asm_ldx_imm(value: byte): void;   // LDX #value
asm_ldx_zp(addr: byte): void;     // LDX addr
asm_ldx_zpy(addr: byte): void;    // LDX addr,Y
asm_ldx_abs(addr: word): void;    // LDX addr
asm_ldx_aby(addr: word): void;    // LDX addr,Y
```

#### LDY - Load Y Register

```js
asm_ldy_imm(value: byte): void;   // LDY #value
asm_ldy_zp(addr: byte): void;     // LDY addr
asm_ldy_zpx(addr: byte): void;    // LDY addr,X
asm_ldy_abs(addr: word): void;    // LDY addr
asm_ldy_abx(addr: word): void;    // LDY addr,X
```

#### STA - Store Accumulator

```js
asm_sta_zp(addr: byte): void;     // STA addr
asm_sta_zpx(addr: byte): void;    // STA addr,X
asm_sta_abs(addr: word): void;    // STA addr
asm_sta_abx(addr: word): void;    // STA addr,X
asm_sta_aby(addr: word): void;    // STA addr,Y
asm_sta_inx(addr: byte): void;    // STA (addr,X)
asm_sta_iny(addr: byte): void;    // STA (addr),Y
```

#### STX - Store X Register

```js
asm_stx_zp(addr: byte): void;     // STX addr
asm_stx_zpy(addr: byte): void;    // STX addr,Y
asm_stx_abs(addr: word): void;    // STX addr
```

#### STY - Store Y Register

```js
asm_sty_zp(addr: byte): void;     // STY addr
asm_sty_zpx(addr: byte): void;    // STY addr,X
asm_sty_abs(addr: word): void;    // STY addr
```

### Transfer Operations

```js
asm_tax(): void;   // Transfer A to X
asm_tay(): void;   // Transfer A to Y
asm_txa(): void;   // Transfer X to A
asm_tya(): void;   // Transfer Y to A
asm_tsx(): void;   // Transfer SP to X
asm_txs(): void;   // Transfer X to SP
```

### Arithmetic Operations

#### ADC - Add with Carry

```js
asm_adc_imm(value: byte): void;   // ADC #value
asm_adc_zp(addr: byte): void;     // ADC addr
asm_adc_zpx(addr: byte): void;    // ADC addr,X
asm_adc_abs(addr: word): void;    // ADC addr
asm_adc_abx(addr: word): void;    // ADC addr,X
asm_adc_aby(addr: word): void;    // ADC addr,Y
asm_adc_inx(addr: byte): void;    // ADC (addr,X)
asm_adc_iny(addr: byte): void;    // ADC (addr),Y
```

#### SBC - Subtract with Carry

```js
asm_sbc_imm(value: byte): void;   // SBC #value
asm_sbc_zp(addr: byte): void;     // SBC addr
asm_sbc_zpx(addr: byte): void;    // SBC addr,X
asm_sbc_abs(addr: word): void;    // SBC addr
asm_sbc_abx(addr: word): void;    // SBC addr,X
asm_sbc_aby(addr: word): void;    // SBC addr,Y
asm_sbc_inx(addr: byte): void;    // SBC (addr,X)
asm_sbc_iny(addr: byte): void;    // SBC (addr),Y
```

#### INC/DEC - Increment/Decrement

```js
asm_inc_zp(addr: byte): void;     // INC addr
asm_inc_zpx(addr: byte): void;    // INC addr,X
asm_inc_abs(addr: word): void;    // INC addr
asm_inc_abx(addr: word): void;    // INC addr,X

asm_dec_zp(addr: byte): void;     // DEC addr
asm_dec_zpx(addr: byte): void;    // DEC addr,X
asm_dec_abs(addr: word): void;    // DEC addr
asm_dec_abx(addr: word): void;    // DEC addr,X

asm_inx(): void;   // Increment X
asm_iny(): void;   // Increment Y
asm_dex(): void;   // Decrement X
asm_dey(): void;   // Decrement Y
```

### Logical Operations

#### AND - Logical AND

```js
asm_and_imm(value: byte): void;   // AND #value
asm_and_zp(addr: byte): void;     // AND addr
asm_and_zpx(addr: byte): void;    // AND addr,X
asm_and_abs(addr: word): void;    // AND addr
asm_and_abx(addr: word): void;    // AND addr,X
asm_and_aby(addr: word): void;    // AND addr,Y
asm_and_inx(addr: byte): void;    // AND (addr,X)
asm_and_iny(addr: byte): void;    // AND (addr),Y
```

#### ORA - Logical OR

```js
asm_ora_imm(value: byte): void;   // ORA #value
asm_ora_zp(addr: byte): void;     // ORA addr
asm_ora_zpx(addr: byte): void;    // ORA addr,X
asm_ora_abs(addr: word): void;    // ORA addr
asm_ora_abx(addr: word): void;    // ORA addr,X
asm_ora_aby(addr: word): void;    // ORA addr,Y
asm_ora_inx(addr: byte): void;    // ORA (addr,X)
asm_ora_iny(addr: byte): void;    // ORA (addr),Y
```

#### EOR - Exclusive OR

```js
asm_eor_imm(value: byte): void;   // EOR #value
asm_eor_zp(addr: byte): void;     // EOR addr
asm_eor_zpx(addr: byte): void;    // EOR addr,X
asm_eor_abs(addr: word): void;    // EOR addr
asm_eor_abx(addr: word): void;    // EOR addr,X
asm_eor_aby(addr: word): void;    // EOR addr,Y
asm_eor_inx(addr: byte): void;    // EOR (addr,X)
asm_eor_iny(addr: byte): void;    // EOR (addr),Y
```

### Compare Operations

#### CMP - Compare Accumulator

```js
asm_cmp_imm(value: byte): void;   // CMP #value
asm_cmp_zp(addr: byte): void;     // CMP addr
asm_cmp_zpx(addr: byte): void;    // CMP addr,X
asm_cmp_abs(addr: word): void;    // CMP addr
asm_cmp_abx(addr: word): void;    // CMP addr,X
asm_cmp_aby(addr: word): void;    // CMP addr,Y
asm_cmp_inx(addr: byte): void;    // CMP (addr,X)
asm_cmp_iny(addr: byte): void;    // CMP (addr),Y
```

#### CPX/CPY - Compare X/Y

```js
asm_cpx_imm(value: byte): void;   // CPX #value
asm_cpx_zp(addr: byte): void;     // CPX addr
asm_cpx_abs(addr: word): void;    // CPX addr

asm_cpy_imm(value: byte): void;   // CPY #value
asm_cpy_zp(addr: byte): void;     // CPY addr
asm_cpy_abs(addr: word): void;    // CPY addr
```

### Shift/Rotate Operations

```js
// Accumulator
asm_asl(): void;   // Arithmetic Shift Left A
asm_lsr(): void;   // Logical Shift Right A
asm_rol(): void;   // Rotate Left A
asm_ror(): void;   // Rotate Right A

// Memory
asm_asl_zp(addr: byte): void;     // ASL addr
asm_asl_zpx(addr: byte): void;    // ASL addr,X
asm_asl_abs(addr: word): void;    // ASL addr
asm_asl_abx(addr: word): void;    // ASL addr,X

asm_lsr_zp(addr: byte): void;     // LSR addr
asm_lsr_zpx(addr: byte): void;    // LSR addr,X
asm_lsr_abs(addr: word): void;    // LSR addr
asm_lsr_abx(addr: word): void;    // LSR addr,X

asm_rol_zp(addr: byte): void;     // ROL addr
asm_rol_zpx(addr: byte): void;    // ROL addr,X
asm_rol_abs(addr: word): void;    // ROL addr
asm_rol_abx(addr: word): void;    // ROL addr,X

asm_ror_zp(addr: byte): void;     // ROR addr
asm_ror_zpx(addr: byte): void;    // ROR addr,X
asm_ror_abs(addr: word): void;    // ROR addr
asm_ror_abx(addr: word): void;    // ROR addr,X
```

### Branch Operations

```js
asm_bcc_rel(offset: byte): void;  // Branch if Carry Clear
asm_bcs_rel(offset: byte): void;  // Branch if Carry Set
asm_beq_rel(offset: byte): void;  // Branch if Equal (Z=1)
asm_bne_rel(offset: byte): void;  // Branch if Not Equal (Z=0)
asm_bmi_rel(offset: byte): void;  // Branch if Minus (N=1)
asm_bpl_rel(offset: byte): void;  // Branch if Plus (N=0)
asm_bvc_rel(offset: byte): void;  // Branch if Overflow Clear
asm_bvs_rel(offset: byte): void;  // Branch if Overflow Set
```

### Jump/Call Operations

```js
asm_jmp_abs(addr: word): void;    // Jump to address
asm_jmp_ind(addr: word): void;    // Jump indirect
asm_jsr(addr: word): void;        // Jump to subroutine
asm_rts(): void;                   // Return from subroutine
asm_rti(): void;                   // Return from interrupt
```

### Stack Operations

```js
asm_pha(): void;   // Push Accumulator
asm_pla(): void;   // Pull Accumulator
asm_php(): void;   // Push Processor Status
asm_plp(): void;   // Pull Processor Status
```

### Flag Operations

```js
asm_clc(): void;   // Clear Carry
asm_sec(): void;   // Set Carry
asm_cli(): void;   // Clear Interrupt Disable
asm_sei(): void;   // Set Interrupt Disable
asm_cld(): void;   // Clear Decimal Mode
asm_sed(): void;   // Set Decimal Mode
asm_clv(): void;   // Clear Overflow
```

### Bit Test

```js
asm_bit_zp(addr: byte): void;     // BIT addr
asm_bit_abs(addr: word): void;    // BIT addr
```

### Miscellaneous

```js
asm_nop(): void;   // No Operation
asm_brk(): void;   // Break (software interrupt)
```

## Usage Examples

### Disable Interrupts During Critical Section

```js
function criticalOperation(): void {
  asm_sei();              // Disable interrupts
  
  // Critical code here
  poke($D020, 14);
  poke($D021, 6);
  
  asm_cli();              // Re-enable interrupts
}
```

### Fast Loop with Register

```js
function clearMemory(addr: word, count: byte): void {
  asm_lda_imm(0);         // Load 0 into A
  asm_ldx_imm(count);     // Load count into X
  
  // Loop would need labels - this shows the pattern
  while (count > 0) {
    asm_sta_abx(addr);    // Store A at addr+X
    asm_dex();            // Decrement X
    count -= 1;
  }
}
```

### Direct Hardware Access

```js
function setRasterIRQ(line: byte): void {
  asm_sei();                    // Disable interrupts
  
  asm_lda_imm(line);            // Load raster line
  asm_sta_abs($D012);           // Set raster line
  
  asm_lda_abs($D011);           // Load control register
  asm_and_imm($7F);             // Clear bit 7
  asm_sta_abs($D011);           // Store back
  
  asm_cli();                    // Re-enable interrupts
}
```

### Preserve/Restore Registers

```js
function preserveRegisters(): void {
  asm_pha();              // Save A
  asm_txa();
  asm_pha();              // Save X
  asm_tya();
  asm_pha();              // Save Y
  
  // ... do work ...
  
  asm_pla();              // Restore Y
  asm_tay();
  asm_pla();              // Restore X
  asm_tax();
  asm_pla();              // Restore A
}
```

## Best Practices

### 1. Use ASM Functions Sparingly

```js
// ✅ GOOD: Use intrinsics for common operations
poke($D020, 14);
let color = peek($D020);

// ✅ GOOD: Use ASM functions for specific 6502 control
asm_sei();
asm_cli();
```

### 2. Document Register Usage

```js
// ✅ GOOD: Document what registers are affected
// Note: Destroys A, X registers
function fastFill(): void {
  asm_lda_imm(0);
  asm_ldx_imm(255);
  // ...
}
```

### 3. Pair SEI/CLI

```js
// ✅ GOOD: Always pair interrupt disable/enable
asm_sei();
// ... critical section ...
asm_cli();
```

### 4. Be Aware of Register Side Effects

ASM functions modify CPU registers. Be aware that:
- `asm_lda_*` modifies A register
- `asm_ldx_*` modifies X register
- `asm_ldy_*` modifies Y register
- Most instructions affect processor flags (N, Z, C, V)

## Limitations

- **No labels**: Branch offsets must be calculated manually or use high-level constructs
- **No macros**: Each call is a single instruction
- **Register interference**: ASM functions share registers with compiled code