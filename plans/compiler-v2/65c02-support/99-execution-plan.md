# Execution Plan: 65C02 Multi-CPU Support

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-06-02 10:43
> **Progress**: 6/18 tasks (33%)

## Overview

**🚨 IMPORTANT: Update this document after EACH completed task!**

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | CPU Strategy Types & Classes | 1 | 1-2 hours |
| 2 | ASM-IL Builder 65C02 Instructions | 1 | 1 hour |
| 3 | PlatformConfig + Codegen Integration | 1 | 1-2 hours |
| 4 | Codegen Layer Refactor | 1-2 | 2-3 hours |
| 5 | Testing | 1 | 1-2 hours |

**Total: 5-6 sessions, ~6-10 hours**

---

## Phase 1: CPU Strategy Types & Classes

### Session 1.1: Create CpuInstructionSet Abstraction

**Reference**: [03-cpu-strategy.md](03-cpu-strategy.md)

**Objective**: Create the CPU instruction set abstraction, 6502 and 65C02 implementations, and factory.

**Tasks**:
| # | Task | File |
|---|------|------|
| 1.1.1 | Create CpuTarget type and CodegenOptions | `codegen/cpu/types.ts` |
| 1.1.2 | Create CpuInstructionSet abstract class | `codegen/cpu/cpu-instruction-set.ts` |
| 1.1.3 | Create Cpu6502InstructionSet | `codegen/cpu/cpu-6502.ts` |
| 1.1.4 | Create Cpu65C02InstructionSet | `codegen/cpu/cpu-65c02.ts` |
| 1.1.5 | Create factory + index.ts | `codegen/cpu/index.ts` |
| 1.1.6 | Add CPU strategy unit tests | `__tests__/codegen/cpu/cpu-instruction-set.test.ts` |

**Deliverables**:
- [ ] CpuTarget type exists
- [ ] Both instruction set classes compile
- [ ] Factory creates correct class for each target
- [ ] Unit tests verify both 6502 and 65C02 emit correct instructions
- [ ] All existing tests still pass

**Verify**: `./compiler-test codegen`

---

## Phase 2: ASM-IL Builder 65C02 Instructions

### Session 2.1: Add 65C02 Mnemonic Support

**Objective**: Ensure the ASM-IL builder can represent all 65C02 instructions.

**Tasks**:
| # | Task | File |
|---|------|------|
| 2.1.1 | Add AsmAddressingMode.Relative (for BRA) if missing | `codegen/asm-il/types.ts` |
| 2.1.2 | Add AsmAddressingMode.Accumulator if missing | `codegen/asm-il/types.ts` |
| 2.1.3 | Add builder helpers: stz(), bra(), phx(), plx(), phy(), ply() | `codegen/asm-il/builder.ts` |
| 2.1.4 | Add builder tests for 65C02 instructions | `__tests__/codegen/asm-il/builder-65c02.test.ts` |

**Deliverables**:
- [ ] Builder can emit all 65C02 instructions used
- [ ] Tests verify correct ASM-IL elements created
- [ ] All existing tests still pass

**Verify**: `./compiler-test codegen`

---

## Phase 3: PlatformConfig + Codegen Integration

### Session 3.1: Wire CPU Target Through Pipeline

**Objective**: Add `cpuTarget` to PlatformConfig and wire it into CodeGenerator constructor.

**Tasks**:
| # | Task | File |
|---|------|------|
| 3.1.1 | Add `cpuTarget` field to PlatformConfig interface | `frame/platform.ts` |
| 3.1.2 | Set `cpuTarget: '6502'` on C64_PLATFORM_CONFIG | `frame/platform.ts` |
| 3.1.3 | Set `cpuTarget: '65c02'` on X16_PLATFORM_CONFIG | `frame/platform.ts` |
| 3.1.4 | Set `cpuTarget: '6502'` on TEST_PLATFORM_CONFIG | `frame/platform.ts` |
| 3.1.5 | Update CodeGeneratorBase constructor to accept CpuTarget | `codegen/generator/base.ts` |
| 3.1.6 | Add `protected cpu: CpuInstructionSet` to base | `codegen/generator/base.ts` |
| 3.1.7 | Update CodeGenerator to pass cpuTarget through | `codegen/generator/generator.ts` |
| 3.1.8 | Update codegen exports | `codegen/index.ts` |

**Deliverables**:
- [ ] PlatformConfig carries cpuTarget
- [ ] CodeGenerator creates correct CpuInstructionSet
- [ ] Default is '6502' (backward compatible)
- [ ] All existing tests still pass unchanged

**Verify**: `./compiler-test`

---

## Phase 4: Codegen Layer Refactor

### Session 4.1: Refactor Codegen Layers to Use CPU Strategy

**Objective**: Replace direct multi-instruction patterns with CPU strategy calls.

**Tasks**:
| # | Task | File |
|---|------|------|
| 4.1.1 | Refactor memory.ts — use `this.cpu.emitStoreZero()` for zero stores | `codegen/generator/memory.ts` |
| 4.1.2 | Refactor control.ts — use `this.cpu.emitBranchAlways()` for unconditional jumps | `codegen/generator/control.ts` |
| 4.1.3 | Refactor arithmetic.ts — use `this.cpu.emitIncrementA()`/`emitDecrementA()` | `codegen/generator/arithmetic.ts` |
| 4.1.4 | Refactor functions.ts — use `this.cpu.emitPushX()`/`emitPullX()` etc. | `codegen/generator/functions.ts` |

**Deliverables**:
- [ ] Codegen layers delegate to CPU strategy
- [ ] No direct multi-instruction patterns remain for CPU-specific operations
- [ ] All existing 6502 tests still pass (strategy produces same output)

**Verify**: `./compiler-test codegen`

---

## Phase 5: Testing

### Session 5.1: 65C02 Codegen Tests

**Objective**: Verify 65C02 code generation produces optimized output.

**Tasks**:
| # | Task | File |
|---|------|------|
| 5.1.1 | Create 65C02 memory ops tests (STZ) | `__tests__/codegen/unit/memory-ops-65c02.test.ts` |
| 5.1.2 | Create 65C02 control flow tests (BRA) | `__tests__/codegen/unit/control-flow-65c02.test.ts` |
| 5.1.3 | Create 65C02 arithmetic tests (INA/DEA) | `__tests__/codegen/unit/arithmetic-65c02.test.ts` |
| 5.1.4 | Create 65C02 function tests (PHX/PLX/PHY/PLY) | `__tests__/codegen/unit/functions-65c02.test.ts` |
| 5.1.5 | Run full test suite — verify zero regressions | - |

**Deliverables**:
- [ ] 65C02 tests verify STZ, BRA, INA, DEA, PHX, PLX, PHY, PLY
- [ ] Tests confirm 65C02 output is shorter than 6502 equivalent
- [ ] All 6272+ existing tests still pass
- [ ] Full test suite green

**Verify**: `./compiler-test`

---

## Task Checklist (All Phases)

### Phase 1: CPU Strategy Types & Classes
- [x] 1.1.1 Create CpuTarget type and CodegenOptions ✅ (completed: 2026-06-02 09:55)
- [x] 1.1.2 Create CpuInstructionSet abstract class ✅ (completed: 2026-06-02 10:00)
- [x] 1.1.3 Create Cpu6502InstructionSet ✅ (completed: 2026-06-02 10:06)
- [x] 1.1.4 Create Cpu65C02InstructionSet ✅ (completed: 2026-06-02 10:12)
- [x] 1.1.5 Create factory + index.ts ✅ (completed: 2026-06-02 10:14)
- [x] 1.1.6 Add CPU strategy unit tests ✅ (completed: 2026-06-02 10:42)

### Phase 2: ASM-IL Builder 65C02 Instructions
- [ ] 2.1.1 Add AsmAddressingMode.Relative if missing
- [ ] 2.1.2 Add AsmAddressingMode.Accumulator if missing
- [ ] 2.1.3 Add builder helpers for 65C02
- [ ] 2.1.4 Add builder tests for 65C02

### Phase 3: PlatformConfig + Codegen Integration
- [ ] 3.1.1 Add cpuTarget to PlatformConfig
- [ ] 3.1.2-3.1.4 Set cpuTarget on all platform configs
- [ ] 3.1.5-3.1.6 Update CodeGeneratorBase with CpuInstructionSet
- [ ] 3.1.7-3.1.8 Update CodeGenerator + exports

### Phase 4: Codegen Layer Refactor
- [ ] 4.1.1 Refactor memory.ts
- [ ] 4.1.2 Refactor control.ts
- [ ] 4.1.3 Refactor arithmetic.ts
- [ ] 4.1.4 Refactor functions.ts

### Phase 5: Testing
- [ ] 5.1.1-5.1.4 Create 65C02-specific tests
- [ ] 5.1.5 Full test suite verification

---

## Session Protocol

### Starting a Session

```bash
clear && scripts/agent.sh start
# "Implement Phase X per plans/compiler-v2/65c02-support/99-execution-plan.md"
```

### Ending a Session

```bash
./compiler-test
clear && scripts/agent.sh finished
/compact
```

---

## Dependencies

```
Phase 1 (CPU Strategy)
    ↓
Phase 2 (ASM-IL Builder) ← can be parallel with Phase 1
    ↓
Phase 3 (Integration) ← requires Phase 1 + 2
    ↓
Phase 4 (Layer Refactor) ← requires Phase 3
    ↓
Phase 5 (Testing) ← requires Phase 4
```

---

## Success Criteria

**65C02 support is complete when**:

1. ✅ CpuInstructionSet abstraction exists with 6502 and 65C02 implementations
2. ✅ PlatformConfig carries cpuTarget
3. ✅ X16 platform generates 65C02-optimized assembly
4. ✅ C64 platform generates identical 6502 assembly (zero regression)
5. ✅ All existing 6272+ tests pass unchanged
6. ✅ New 65C02 tests verify optimized output
7. ✅ Adding future CPU targets = new CpuInstructionSet subclass only
