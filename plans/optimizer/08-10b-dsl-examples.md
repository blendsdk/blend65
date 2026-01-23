# Task 8.10b: Pattern DSL Examples & Idioms

> **Task**: 8.10b of 12 (Peephole Phase)  
> **Time**: ~2 hours  
> **Tests**: ~35 tests  
> **Prerequisites**: Task 8.10a (DSL Grammar & Tokens)

---

## Overview

Comprehensive examples demonstrating the Pattern DSL syntax. This document serves as both documentation and test cases for the DSL parser.

---

## Basic Pattern Examples

### Load/Store Patterns

```
// Redundant load after store to same address
pattern redundant-load-after-store {
  match: STA $addr; LDA $addr
  replace: STA $addr
  saves: 3 cycles, 2 bytes
  category: load-store
  level: O1, O2, O3
}

// Redundant store after store (dead store)
pattern dead-store {
  match: STA $addr; STA $addr
  replace: STA $addr
  saves: 4 cycles, 3 bytes
  category: load-store
  level: O1, O2, O3
}

// Load after load same value (zero page)
pattern redundant-zp-load {
  match: LDA $zp; LDA $zp
  where: $zp < $100
  replace: LDA $zp
  saves: 3 cycles, 2 bytes
  category: load-store
}

// Store X then load to A
pattern stx-lda-same {
  match: STX $addr; LDA $addr
  replace: STX $addr; TXA
  saves: 1 cycle, 1 byte
  category: load-store
}

// Store Y then load to A
pattern sty-lda-same {
  match: STY $addr; LDA $addr
  replace: STY $addr; TYA
  saves: 1 cycle, 1 byte
  category: load-store
}
```

### Transfer Patterns

```
// Transfer to X and back
pattern tax-txa-elimination {
  match: TAX; TXA
  replace: // empty
  saves: 4 cycles, 2 bytes
  category: transfer
  level: O1, O2, O3
}

// Transfer to Y and back
pattern tay-tya-elimination {
  match: TAY; TYA
  replace: // empty
  saves: 4 cycles, 2 bytes
  category: transfer
}

// Triple transfer chain
pattern tax-tay-chain {
  match: TAX; TXA; TAY
  replace: TAX; TAY
  saves: 2 cycles, 1 byte
  category: transfer
}

// Load then transfer (combine)
pattern lda-tax {
  match: LDA $addr; TAX
  replace: LDX $addr
  saves: 2 cycles, 1 byte
  category: transfer
  level: O2, O3
}

// Load then transfer to Y
pattern lda-tay {
  match: LDA $addr; TAY
  replace: LDY $addr
  saves: 2 cycles, 1 byte
  category: transfer
}
```

### Arithmetic Identity Patterns

```
// Add zero (identity)
pattern adc-zero {
  match: CLC; ADC #$00
  replace: // empty
  saves: 4 cycles, 3 bytes
  category: arithmetic
  level: O1, O2, O3
}

// Subtract zero (identity)
pattern sbc-zero {
  match: SEC; SBC #$00
  replace: // empty
  saves: 4 cycles, 3 bytes
  category: arithmetic
}

// Increment then decrement
pattern inc-dec-cancel {
  match: INC $addr; DEC $addr
  replace: // empty
  saves: 10 cycles, 4 bytes
  category: arithmetic
}

// Decrement then increment
pattern dec-inc-cancel {
  match: DEC $addr; INC $addr
  replace: // empty
  saves: 10 cycles, 4 bytes
  category: arithmetic
}

// INX then DEX cancel
pattern inx-dex-cancel {
  match: INX; DEX
  replace: // empty
  saves: 4 cycles, 2 bytes
  category: arithmetic
}

// INY then DEY cancel
pattern iny-dey-cancel {
  match: INY; DEY
  replace: // empty
  saves: 4 cycles, 2 bytes
  category: arithmetic
}
```

---

## Addressing Mode Examples

### Zero Page Patterns

```
// Zero page load optimization
pattern abs-to-zp-load {
  match: LDA $addr
  where: $addr < $100
  replace: LDA $addr  // same but marked as ZP
  saves: 1 cycle, 1 byte
  category: load-store
  level: O2, O3
}

// Zero page indexed
pattern zp-indexed-x {
  match: LDA $zp,X
  where: $zp < $100
  replace: LDA $zp,X
  saves: 0 cycles, 0 bytes  // already optimal
  category: load-store
}
```

### Indexed Addressing

```
// Load indexed and store
pattern lda-x-sta-x {
  match: LDA $addr,X; STA $addr,X
  replace: LDA $addr,X; STA $addr,X
  saves: 0 cycles, 0 bytes
  category: load-store
}

// Y-indexed patterns
pattern lda-y-sta-y {
  match: LDA $addr,Y; STA $addr,Y
  replace: LDA $addr,Y; STA $addr,Y
  saves: 0 cycles, 0 bytes
  category: load-store
}
```

### Indirect Addressing

```
// Indirect indexed (common C64 pattern)
pattern indirect-y-load-store {
  match: LDA ($zp),Y; STA ($dest),Y
  replace: LDA ($zp),Y; STA ($dest),Y
  saves: 0 cycles, 0 bytes
  category: load-store
}

// Indexed indirect
pattern indirect-x-pattern {
  match: LDA ($zp,X); STA ($dest,X)
  replace: LDA ($zp,X); STA ($dest,X)
  saves: 0 cycles, 0 bytes
  category: load-store
}
```

---

## Branch Optimization Examples

### Basic Branch Patterns

```
// Branch over branch (simplify)
pattern branch-over-branch {
  match: BEQ @skip; JMP $target; @skip:
  replace: BNE $target
  saves: 3 cycles, 3 bytes
  category: branch
  level: O1, O2, O3
}

// Compare then branch on zero
pattern cmp-beq-zero {
  match: CMP #$00; BEQ $target
  replace: BEQ $target  // CMP #0 redundant if prior sets Z
  where: flags.Z = valid
  saves: 2 cycles, 2 bytes
  category: branch
}

// Compare then branch not zero
pattern cmp-bne-zero {
  match: CMP #$00; BNE $target
  replace: BNE $target
  where: flags.Z = valid
  saves: 2 cycles, 2 bytes
  category: branch
}
```

### Branch Chain Optimization

```
// Double branch elimination
pattern double-beq {
  match: BEQ $a; BEQ $b
  replace: BEQ $a
  saves: 2 cycles, 2 bytes
  category: branch
}

// Branch to next instruction
pattern branch-to-next {
  match: BEQ @next; @next:
  replace: @next:
  saves: 2 cycles, 2 bytes
  category: branch
}

// Unconditional after conditional
pattern jmp-after-branch {
  match: BEQ @skip; JMP $far; @skip:
  replace: BNE $far; @skip:
  where: distance($far) < 128
  saves: 1 cycle, 1 byte
  category: branch
}
```

---

## Flag Operation Examples

### Carry Flag Patterns

```
// Consecutive CLC
pattern double-clc {
  match: CLC; CLC
  replace: CLC
  saves: 2 cycles, 1 byte
  category: flag
  level: O1, O2, O3
}

// Consecutive SEC
pattern double-sec {
  match: SEC; SEC
  replace: SEC
  saves: 2 cycles, 1 byte
  category: flag
}

// CLC after SEC (contradictory)
pattern sec-clc {
  match: SEC; CLC
  replace: CLC
  saves: 2 cycles, 1 byte
  category: flag
}

// SEC after CLC (contradictory)
pattern clc-sec {
  match: CLC; SEC
  replace: SEC
  saves: 2 cycles, 1 byte
  category: flag
}

// CLC before ADC (required) - no optimization
pattern clc-adc {
  match: CLC; ADC $val
  replace: CLC; ADC $val
  saves: 0 cycles, 0 bytes
  category: flag
}

// SEC before SBC (required) - no optimization
pattern sec-sbc {
  match: SEC; SBC $val
  replace: SEC; SBC $val
  saves: 0 cycles, 0 bytes
  category: flag
}
```

### Interrupt Flag Patterns

```
// Consecutive CLI
pattern double-cli {
  match: CLI; CLI
  replace: CLI
  saves: 2 cycles, 1 byte
  category: flag
}

// Consecutive SEI
pattern double-sei {
  match: SEI; SEI
  replace: SEI
  saves: 2 cycles, 1 byte
  category: flag
}

// SEI then CLI (intentional toggle)
pattern sei-cli-toggle {
  match: SEI; CLI
  replace: CLI
  where: no-interrupt-between
  saves: 2 cycles, 1 byte
  category: flag
}
```

---

## Shift and Rotate Examples

```
// Double shift left = multiply by 4
pattern asl-asl {
  match: ASL A; ASL A
  replace: ASL A; ASL A  // no optimization, but mark as x4
  saves: 0 cycles, 0 bytes
  category: arithmetic
}

// Shift then opposite shift (cancel if no carry use)
pattern asl-lsr-cancel {
  match: ASL A; LSR A
  replace: AND #$FE  // clear low bit
  where: carry.unused-after
  saves: 2 cycles, 1 byte
  category: arithmetic
  level: O3
}

// Triple shift = multiply by 8
pattern triple-asl {
  match: ASL A; ASL A; ASL A
  replace: ASL A; ASL A; ASL A
  saves: 0 cycles, 0 bytes
  category: arithmetic
}

// ROL after CLC = ASL
pattern clc-rol-to-asl {
  match: CLC; ROL A
  replace: ASL A
  saves: 2 cycles, 1 byte
  category: arithmetic
  level: O2, O3
}

// ROR after CLC
pattern clc-ror {
  match: CLC; ROR A
  replace: LSR A
  saves: 2 cycles, 1 byte
  category: arithmetic
}
```

---

## Logical Operation Examples

```
// AND with $FF (identity)
pattern and-ff {
  match: AND #$FF
  replace: // empty
  saves: 2 cycles, 2 bytes
  category: arithmetic
  level: O1, O2, O3
}

// AND with $00 (constant zero)
pattern and-00 {
  match: AND #$00
  replace: LDA #$00
  saves: 0 cycles, 0 bytes  // same but clearer intent
  category: arithmetic
}

// ORA with $00 (identity)
pattern ora-00 {
  match: ORA #$00
  replace: // empty
  saves: 2 cycles, 2 bytes
  category: arithmetic
}

// ORA with $FF (constant $FF)
pattern ora-ff {
  match: ORA #$FF
  replace: LDA #$FF
  saves: 0 cycles, 0 bytes
  category: arithmetic
}

// EOR with $00 (identity)
pattern eor-00 {
  match: EOR #$00
  replace: // empty
  saves: 2 cycles, 2 bytes
  category: arithmetic
}

// Double EOR (cancel)
pattern eor-eor-cancel {
  match: EOR $val; EOR $val
  replace: // empty
  saves: 4 cycles, 4 bytes
  category: arithmetic
  level: O1, O2, O3
}
```

---

## Stack Operation Examples

```
// Push then pop same register
pattern pha-pla-cancel {
  match: PHA; PLA
  replace: // empty
  where: no-stack-use-between
  saves: 7 cycles, 2 bytes
  category: general
  level: O2, O3
}

// Double push then double pop
pattern double-push-pop {
  match: PHA; PHA; PLA; PLA
  replace: // empty
  where: no-stack-use-between
  saves: 14 cycles, 4 bytes
  category: general
}

// PHP then PLP (save/restore status)
pattern php-plp-cancel {
  match: PHP; PLP
  replace: // empty
  where: no-stack-use-between
  saves: 7 cycles, 2 bytes
  category: general
}
```

---

## Multi-Instruction Idiom Examples

```
// 16-bit increment
pattern inc16 {
  match: INC $lo; BNE @skip; INC $hi; @skip:
  replace: INC $lo; BNE @skip; INC $hi; @skip:
  saves: 0 cycles, 0 bytes  // recognize idiom
  category: general
}

// 16-bit decrement
pattern dec16 {
  match: LDA $lo; BNE @skip; DEC $hi; @skip:; DEC $lo
  replace: LDA $lo; BNE @skip; DEC $hi; @skip:; DEC $lo
  saves: 0 cycles, 0 bytes
  category: general
}

// Register swap via stack
pattern swap-a-x-stack {
  match: PHA; TXA; PLA; TAX
  replace: // native swap if available
  saves: 0 cycles, 0 bytes
  category: general
}

// Multiply by 10 (x2 + x8)
pattern multiply-10 {
  match: ASL A; STA $tmp; ASL A; ASL A; CLC; ADC $tmp
  replace: ASL A; STA $tmp; ASL A; ASL A; CLC; ADC $tmp
  saves: 0 cycles, 0 bytes  // recognize idiom
  category: arithmetic
}

// Negate A (two's complement)
pattern negate-a {
  match: EOR #$FF; CLC; ADC #$01
  replace: EOR #$FF; SEC; ADC #$00  // alternative
  saves: 0 cycles, 0 bytes
  category: arithmetic
}
```

---

## Conditional Patterns with Where Clauses

```
// Load immediate then compare (can skip compare)
pattern lda-imm-cmp {
  match: LDA #$val; CMP #$cmp
  where: $val = $cmp
  replace: LDA #$val  // Z flag already set correctly
  saves: 2 cycles, 2 bytes
  category: branch
}

// Zero page boundary check
pattern zp-boundary {
  match: LDA $addr
  where: $addr >= $100
  replace: LDA $addr  // must use absolute
  saves: 0 cycles, 0 bytes
  category: load-store
}

// Branch distance check
pattern short-branch {
  match: JMP $target
  where: distance($target) < 128
  replace: BRA $target  // if 65C02
  saves: 1 cycle, 1 byte
  category: branch
  level: O3
}
```

---

## Optimization Level Examples

```
// Level O1 - Safe, always apply
pattern level-o1-example {
  match: NOP; NOP
  replace: // empty
  saves: 4 cycles, 2 bytes
  level: O1
}

// Level O2 - Standard optimization
pattern level-o2-example {
  match: LDA $addr; STA $addr
  replace: LDA $addr  // store redundant if just read
  saves: 4 cycles, 3 bytes
  level: O2, O3
}

// Level O3 - Aggressive optimization
pattern level-o3-example {
  match: PHP; PLP
  replace: // empty - risky if flags needed
  saves: 7 cycles, 2 bytes
  level: O3
}

// Level Os - Size optimization
pattern level-os-example {
  match: LDA #$00; LDA #$00
  replace: LDA #$00
  saves: 0 cycles, 2 bytes  // prioritize bytes
  level: Os
}

// Level Oz - Maximum size reduction
pattern level-oz-example {
  match: INX; INX; INX; INX
  replace: TXA; CLC; ADC #$04; TAX
  saves: -2 cycles, -1 byte  // slower but smaller? Actually larger
  level: Oz
}
```

---

## DSL Feature Summary

| Feature | Syntax | Example |
|---------|--------|---------|
| Pattern name | `pattern name { }` | `pattern tax-txa { }` |
| Match clause | `match: ...` | `match: TAX; TXA` |
| Replace clause | `replace: ...` | `replace: // empty` |
| Captures | `$name` | `$addr`, `$val` |
| Immediates | `#$hex` or `#decimal` | `#$FF`, `#255` |
| Where conditions | `where: cond` | `where: $addr < $100` |
| Savings | `saves: X cycles, Y bytes` | `saves: 4 cycles, 2 bytes` |
| Categories | `category: name` | `category: load-store` |
| Opt levels | `level: O1, O2` | `level: O1, O2, O3` |
| Labels | `@name:` | `@skip:` |
| Comments | `//` or `/* */` | `// explanation` |

---

## Tests Required

| Test | Description |
|------|-------------|
| Parse load-store | All load/store pattern examples |
| Parse transfer | All transfer pattern examples |
| Parse arithmetic | All arithmetic pattern examples |
| Parse branch | All branch pattern examples |
| Parse flag | All flag pattern examples |
| Parse shift | All shift/rotate examples |
| Parse logical | All logical operation examples |
| Parse stack | All stack operation examples |
| Parse idioms | Multi-instruction idiom examples |
| Parse where | Conditional pattern examples |
| Parse levels | Optimization level examples |
| Capture binding | Verify capture variables bind correctly |
| Address modes | All addressing mode variations |

---

## Task Checklist

| Item | Status |
|------|--------|
| Basic pattern examples | [ ] |
| Addressing mode examples | [ ] |
| Branch optimization examples | [ ] |
| Flag operation examples | [ ] |
| Shift/rotate examples | [ ] |
| Logical operation examples | [ ] |
| Stack operation examples | [ ] |
| Multi-instruction idioms | [ ] |
| Where clause examples | [ ] |
| Optimization level examples | [ ] |
| Write parser tests | [ ] |

---

**Next Task**: 8.10c → `08-10c-dsl-parser.md`