# Phase 5: ASM Peephole - Phase Index

> **Phase**: 5 of 7  
> **Status**: Not Started  
> **Sessions**: ~5-6  
> **Goal**: 6502 ASM-level peephole patterns  
> **Milestone**: **main.asm redundant instructions ELIMINATED!** ✅

---

## Phase Overview

Phase 5 implements **6502-specific peephole patterns** at the ASM level. This is where we fix the redundant instructions in your current output!

**THIS PHASE FIXES YOUR main.asm:**

```asm
; BEFORE (current broken output)
LDA _data                   ; ← REMOVED (dead load)
LDA #$05                    
STA $50                     
LDA $50                     ; ← REMOVED (redundant)

; AFTER Phase 5
LDA #$05                    
STA $50                     
; Clean, efficient code!
```

---

## Documents in This Phase

| Doc | Name | Focus | Est. Lines |
|-----|------|-------|------------|
| **01** | [Flag Patterns](01-flag-patterns.md) | CLC/SEC/Zero-flag | ~300 |
| **02** | [Load-Store ASM](02-load-store-asm.md) | STA/LDA elimination | ~300 |
| **03** | [Branch Patterns](03-branch-patterns.md) | Branch chain collapse | ~250 |
| **04** | [Transfer Patterns](04-transfer-patterns.md) | TAX/TXA optimization | ~200 |
| **99** | [Tasks](99-phase-tasks.md) | Task checklist | ~150 |

---

## Key Patterns

### Store-Load Elimination (FIXES main.asm!)

```asm
; Before
STA $50                     ; Store value
LDA $50                     ; Load same value back

; After
STA $50                     ; Keep store only - A already has value!
```

### Zero-Flag Optimization

```asm
; Before  
LDA counter                 
CMP #0                      ; Redundant! LDA sets Z flag
BEQ done

; After
LDA counter
BEQ done                    ; CMP removed
```

### Redundant CLC Removal

```asm
; Before
ADC #$10                    ; Sets carry
CLC                         ; Redundant if not used
ADC #$20                    

; After  
ADC #$10
ADC #$20                    ; CLC removed
```

### Branch Chain Collapse

```asm
; Before
JMP label1
...
label1: JMP label2

; After
JMP label2                  ; Direct jump
```

---

## Directory Structure

```
packages/compiler/src/asm-il/optimizer/passes/
├── index.ts                # Pass exports
├── redundant-clc.ts        # CLC removal
├── redundant-sec.ts        # SEC removal
├── zero-flag.ts            # Zero-flag optimization
├── load-store.ts           # Load-store elimination
├── branch.ts               # Branch optimization
└── transfer.ts             # Transfer optimization
```

---

## Dependencies

### From Phase 4

- Pattern framework architecture
- Pattern registry system

### From ASM-IL Layer

- `AsmModule`, `AsmInstruction`
- `AsmOptimizer` infrastructure

---

## Success Criteria

- [ ] STA/LDA same address → removes LDA
- [ ] LDA + CMP #0 → removes CMP
- [ ] Redundant CLC/SEC removed
- [ ] Branch chains collapsed
- [ ] **main.asm produces clean output**
- [ ] ~125 tests passing
- [ ] No semantic changes

---

## Why This Phase is Critical

| Problem | This Phase Fixes It |
|---------|---------------------|
| `STA $50; LDA $50` redundancy | ✅ Store-Load elimination |
| `LDA _data` overwritten immediately | ✅ Dead load detection |
| Extra CLC/SEC instructions | ✅ Flag pattern removal |
| Inefficient branch chains | ✅ Branch collapse |

**After Phase 5, your compiler output will be CLEAN!**

---

**Parent**: [OPTIMIZER-ROADMAP.md](../OPTIMIZER-ROADMAP.md)  
**Previous Phase**: [Phase 4: IL Peephole](../phase-4-il-peephole/00-phase-index.md)  
**Next Phase**: [Phase 6: 6502 Specific](../phase-6-6502-specific/00-phase-index.md)