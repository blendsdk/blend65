# Phase 6: 6502 Specific - Phase Index

> **Phase**: 6 of 7  
> **Status**: Not Started  
> **Sessions**: ~5-7  
> **Goal**: 6502-specific optimizations  
> **Milestone**: Code competitive with hand-written assembly

---

## Phase Overview

Phase 6 implements **6502-specific optimizations** that exploit the unique characteristics of the 6502 architecture. These optimizations go beyond generic patterns to leverage zero-page addressing, flag behaviors, and the limited register set.

**After this phase**: The compiler produces code that rivals hand-optimized assembly for most use cases.

---

## Documents in This Phase

| Doc | Name | Focus | Est. Lines |
|-----|------|-------|------------|
| **01** | [Zero-Page Promotion](01-zp-promotion.md) | Hot variable allocation to ZP | ~350 |
| **02** | [Indexed Addressing](02-indexed-addr.md) | X/Y indexed mode optimization | ~300 |
| **03** | [Flag Optimization](03-flag-opt.md) | C/Z/N flag tracking & removal | ~350 |
| **04** | [6502 Strength Reduce](04-6502-strength.md) | ASL chains, rotation tricks | ~300 |
| **05** | [Stack Optimization](05-stack-opt.md) | PHA/PLA elimination | ~250 |
| **99** | [Tasks](99-phase-tasks.md) | Task checklist | ~150 |

---

## Key Optimizations

### Zero-Page Promotion

The 6502 zero-page ($00-$FF) is faster and uses fewer bytes:

| Operation | Regular | Zero-Page | Savings |
|-----------|---------|-----------|---------|
| Load | `LDA $1234` (4 bytes, 4 cycles) | `LDA $50` (2 bytes, 3 cycles) | 2 bytes, 1 cycle |
| Store | `STA $1234` (4 bytes, 4 cycles) | `STA $50` (2 bytes, 3 cycles) | 2 bytes, 1 cycle |
| Indirect | `LDA ($1234),Y` (invalid!) | `LDA ($50),Y` (2 bytes, 5 cycles) | Required for indirect! |

**Promotion Strategy**:
1. Count variable access frequency
2. Rank by hotness (frequency × instruction weight)
3. Allocate hottest variables to available ZP space
4. Update all references

```js
// Before - hot loop counter in RAM
let counter: byte @ $0400;

// After - promoted to zero-page
let counter: byte @ $50;    // 1 cycle faster per access!
```

### Indexed Addressing Optimization

Choose optimal indexed mode based on context:

```asm
; Before (absolute indexed - 4 bytes, 4+ cycles)
LDA $1234,X

; After (zero-page indexed - 2 bytes, 4 cycles)
LDA $50,X                   ; If base fits in ZP
```

**Index Selection**:
- Use X for arrays accessed with computed index
- Use Y for arrays accessed with fixed offset
- Prefer zero-page indexed when possible

### Flag Optimization

Track CPU flags to eliminate redundant flag operations:

```asm
; Before
LDA value                   ; Sets Z, N flags
CMP #0                      ; Redundant! Z already correct
BEQ zero

; After  
LDA value                   ; Sets Z flag
BEQ zero                    ; CMP removed
```

**Flag Tracking**:
- Track which flags are valid after each instruction
- Remove CMP when preceding instruction sets needed flags
- Remove SEC/CLC when carry state is already correct

### 6502 Strength Reduction

Use 6502-specific cheap operations:

| Expensive | Cheap 6502 Version | Cycles Saved |
|-----------|-------------------|--------------|
| `x * 2` | `ASL A` | ~70 cycles |
| `x * 4` | `ASL A; ASL A` | ~140 cycles |
| `x * 10` | `ASL; STA t; ASL; ASL; CLC; ADC t` | ~60 cycles |
| `x / 2` | `LSR A` | ~50 cycles |
| `x % 2` | `AND #$01` | ~50 cycles |

### Stack Optimization

Eliminate unnecessary stack operations:

```asm
; Before
PHA                         ; Save A
; ... code that doesn't use A ...
PLA                         ; Restore A
; ... A not used after ...

; After
; (both PHA and PLA removed)
```

---

## Directory Structure

```
packages/compiler/src/asm-il/optimizer/passes/
├── 6502/
│   ├── index.ts              # 6502 pass exports
│   ├── zp-promotion.ts       # Zero-page promotion
│   ├── indexed-addr.ts       # Indexed addressing
│   ├── flag-opt.ts           # Flag optimization
│   ├── strength-6502.ts      # 6502 strength reduction
│   └── stack-opt.ts          # Stack optimization
└── index.ts                  # All pass exports
```

---

## Dependencies

### From Phase 5

- ASM peephole infrastructure
- Pattern matching framework (ASM level)

### From Phase 2

- Liveness analysis (for stack optimization)
- Use-def analysis (for ZP promotion ranking)

---

## 6502 Architecture Reference

### Zero-Page ($00-$FF)

- **$00-$01**: Reserved (CPU vectors on C64)
- **$02-$8F**: Available for variables (142 bytes)
- **$90-$FF**: Kernel/BASIC workspace (usable if disabled)
- **Addressing**: 2-byte instructions, 3-cycle access

### Register Set

| Register | Use | Notes |
|----------|-----|-------|
| A | Accumulator | Primary math/logic |
| X | Index | Best for array index |
| Y | Index | Best for fixed offset |
| SP | Stack | $0100-$01FF |
| P | Flags | C, Z, I, D, B, V, N |

### Flags Affected by Instructions

| Instruction | C | Z | N | V |
|-------------|---|---|---|---|
| LDA, LDX, LDY | - | ✓ | ✓ | - |
| ADC, SBC | ✓ | ✓ | ✓ | ✓ |
| CMP, CPX, CPY | ✓ | ✓ | ✓ | - |
| AND, ORA, EOR | - | ✓ | ✓ | - |
| ASL, LSR, ROL, ROR | ✓ | ✓ | ✓ | - |
| INC, DEC | - | ✓ | ✓ | - |
| INX, INY, DEX, DEY | - | ✓ | ✓ | - |
| BIT | - | ✓ | ✓ | ✓ |

---

## Success Criteria

- [ ] ZP promotion working for hot variables
- [ ] Index register selection optimized
- [ ] Redundant flag operations removed
- [ ] 6502 strength reduction patterns working
- [ ] Unnecessary PHA/PLA eliminated
- [ ] ~125 tests passing
- [ ] Code size competitive with hand-written

---

## Why 6502-Specific?

| Optimization | Why It Matters |
|--------------|----------------|
| **ZP Promotion** | 50% of instructions can be shorter |
| **Flag Tracking** | ~10% of instructions are redundant CMP |
| **Index Selection** | Wrong index costs 1-2 cycles per access |
| **Strength Reduce** | Multiply is ~100 cycles vs 2 for ASL |
| **Stack Opt** | PHA/PLA cost 7 cycles total |

---

**Parent**: [OPTIMIZER-ROADMAP.md](../OPTIMIZER-ROADMAP.md)  
**Previous Phase**: [Phase 5: ASM Peephole](../phase-5-asm-peephole/00-phase-index.md)  
**Next Phase**: [Phase 7: Advanced](../phase-7-advanced/00-phase-index.md)