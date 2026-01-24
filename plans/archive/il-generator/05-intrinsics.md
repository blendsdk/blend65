# Phase 5: Intrinsics & Special Handling

> **Phase**: 5 of 8  
> **Est. Time**: ~19 hours  
> **Tasks**: 12  
> **Tests**: ~190  
> **Prerequisites**: Phase 4 (Expression Translation)

---

## Overview

This phase implements intrinsic function handling, @map access, and v2.0 features.

**See also:** [05a-intrinsics-library.md](05a-intrinsics-library.md) for detailed intrinsics library specification including optimization control and CPU instruction intrinsics.

## Directory Structure Created

```
packages/compiler/src/il/intrinsics/
├── index.ts                    # Intrinsic exports
└── registry.ts                 # IntrinsicRegistry
```

---

## Task 5.1: Create Intrinsic Registry

**File**: `packages/compiler/src/il/intrinsics/registry.ts`

**Time**: 2 hours

**Tests**: 15 tests (registry, lookup)

**Key Concepts**:
- Registry of all intrinsic functions
- Maps function name to IL generation handler
- Distinguishes compile-time vs runtime intrinsics

---

## Task 5.2: peek/poke Intrinsics

**Time**: 1.5 hours

**Tests**: 20 tests (memory access patterns)

**Key Concepts**:
- peek(address) → INTRINSIC_PEEK
- poke(address, value) → INTRINSIC_POKE
- Direct memory access

---

## Task 5.3: peekw/pokew Intrinsics

**Time**: 1 hour

**Tests**: 10 tests (word access)

**Key Concepts**:
- peekw(address) → INTRINSIC_PEEKW (16-bit read)
- pokew(address, value) → INTRINSIC_POKEW (16-bit write)

---

## Task 5.4: sizeof Intrinsic (Compile-Time)

**Time**: 1.5 hours

**Tests**: 15 tests (type sizes)

**Key Concepts**:
- Compile-time evaluation
- Returns constant based on type
- No runtime IL generated

---

## Task 5.5: length Intrinsic

**Time**: 1 hour

**Tests**: 10 tests (arrays, strings)

**Key Concepts**:
- INTRINSIC_LENGTH for runtime
- Compile-time for fixed arrays

---

## Task 5.6: @map Variable Access

**Time**: 2 hours

**Tests**: 20 tests (hardware registers)

**Key Concepts**:
- Simple @map → HARDWARE_READ/WRITE
- Struct @map → MAP_LOAD_FIELD/STORE_FIELD
- Range @map → MAP_LOAD_RANGE/STORE_RANGE

---

## Task 5.7: Storage Class Handling (@zp, @ram, @data)

**Time**: 1.5 hours

**Tests**: 15 tests (storage classes)

**Key Concepts**:
- @zp → zero page allocation hint
- @ram → standard RAM
- @data → read-only data section

---

## Task 5.8: Hardware Hints Passthrough

**Time**: 1 hour

**Tests**: 10 tests (VIC-II, SID metadata)

**Key Concepts**:
- Preserves semantic analysis hints
- VIC timing info
- SID register sequences

---

## Task 5.9: @map Struct IL Instructions (v2.0)

**Time**: 2 hours

**Tests**: 20 tests (@map field load/store, range access)

**Key Concepts**:
- MAP_LOAD_FIELD / MAP_STORE_FIELD
- MAP_LOAD_RANGE / MAP_STORE_RANGE
- Enables optimizer to understand struct access patterns

---

## Task 5.10: Optimization Barriers (v2.0)

**Time**: 1.5 hours

**Tests**: 15 tests (barrier placement, volatile read/write)

**Key Concepts**:
- OPT_BARRIER prevents reordering
- VOLATILE_READ cannot be eliminated
- VOLATILE_WRITE cannot be eliminated
- Critical for C64 hardware timing

---

## Task 5.11: CPU Instruction Intrinsics (v2.0)

**Time**: 2 hours

**Tests**: 20 tests (sei, cli, nop, pha, pla, etc.)

**Key Concepts**:
- sei() → CPU_SEI (disable interrupts)
- cli() → CPU_CLI (enable interrupts)  
- nop() → CPU_NOP (cycle timing)
- brk() → CPU_BRK (software interrupt)
- pha(), pla(), php(), plp() → stack operations
- Maps 1:1 to 6502 instructions
- See [05a-intrinsics-library.md](05a-intrinsics-library.md) for details

---

## Task 5.12: Utility Intrinsics (v2.0)

**Time**: 1.5 hours

**Tests**: 15 tests (lo/hi extraction)

**Key Concepts**:
- lo(word) → INTRINSIC_LO (extract low byte)
- hi(word) → INTRINSIC_HI (extract high byte)
- Compile-time evaluation when possible
- Runtime IL for dynamic values

---

## Phase 5 Task Checklist

| Task | Description | Time | Tests | Status |
|------|-------------|------|-------|--------|
| 5.1 | Intrinsic registry | 2 hr | 15 | [ ] |
| 5.2 | peek/poke intrinsics | 1.5 hr | 20 | [ ] |
| 5.3 | peekw/pokew intrinsics | 1 hr | 10 | [ ] |
| 5.4 | sizeof intrinsic | 1.5 hr | 15 | [ ] |
| 5.5 | length intrinsic | 1 hr | 10 | [ ] |
| 5.6 | @map variable access | 2 hr | 20 | [ ] |
| 5.7 | Storage class handling | 1.5 hr | 15 | [ ] |
| 5.8 | Hardware hints passthrough | 1 hr | 10 | [ ] |
| 5.9 | @map struct IL instructions | 2 hr | 20 | [ ] |
| 5.10 | Optimization barriers | 1.5 hr | 15 | [ ] |
| 5.11 | CPU instruction intrinsics | 2 hr | 20 | [ ] |
| 5.12 | Utility intrinsics (lo/hi) | 1.5 hr | 15 | [ ] |
| **Total** | | **18.5 hr** | **185** | |

---

## Success Criteria

- [ ] All intrinsics generate correct IL
- [ ] @map generates appropriate instruction type
- [ ] Storage classes affect allocation hints
- [ ] Hardware hints preserved
- [ ] v2.0 features working (barriers, CPU intrinsics, lo/hi)
- [ ] 185 tests passing

---

**Previous**: [04-expressions.md](04-expressions.md)  
**Next**: [06-ssa-construction.md](06-ssa-construction.md)