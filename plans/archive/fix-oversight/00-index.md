# Fix Oversight Implementation Plan

> **Feature**: Complete Compiler Functionality - Fix All Critical Oversights
> **Status**: Planning Complete
> **Created**: January 28, 2026
> **Priority**: 🔴 CRITICAL

## Overview

During a real-world test of the Blend65 compiler using the example programs, **critical oversights were discovered** that make the compiler non-functional for any real programs. Despite 99.97% test pass rate, the generated assembly code is broken because:

1. **Tests verify infrastructure, not execution** - Tests check "compiles without error" not "runs correctly"
2. **Code generator has STUB implementations** - Binary operations use placeholder values (`ADC #$00`)
3. **Semantic analyzer has gaps** - Member access (`vic.borderColor`) doesn't work
4. **E2E tests don't verify correctness** - No execution testing or behavioral verification

**This plan addresses ALL discovered oversights to make the compiler produce working programs.**

## Critical Findings

### Example Programs Status

| Program | Status | Issue |
|---------|--------|-------|
| `examples/simple/print-demo.blend` | ❌ FAILS | STUB instructions, ACME syntax errors |
| `examples/simple/main.blend` | ❌ FAILS | Undefined labels (`_main`, `_data`) |
| `examples/snake-game/hardware.blend` | ❌ FAILS | "Member access not implemented" |

### Test Infrastructure Gap

The E2E tests only verify:
- Compilation succeeds (`result.success === true`)
- Assembly output exists (`asm.length > 0`)
- Pattern matching (`expectAsmContains('RTS')`)

**No tests verify the generated code actually works!**

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document - overview and navigation |
| 01 | [Requirements](01-requirements.md) | All gaps and requirements |
| 02 | [Current State](02-current-state.md) | Analysis of what's broken |
| 03 | [Semantic Fixes](03-semantic-fixes.md) | Member access and type resolution |
| 04 | [CodeGen Operands](04-codegen-operands.md) | Fix binary operations with actual values |
| 05 | [CodeGen Missing Ops](05-codegen-missing-ops.md) | MUL, SHR, PHI, arrays |
| 06 | [Label Generation](06-label-generation.md) | Fix undefined and double-dot labels |
| 07 | [Testing Strategy](07-testing-strategy.md) | Add execution verification tests |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, and task checklist |

## Quick Reference

### All Oversights (Priority Order)

| # | Gap | Severity | Phase | Component |
|---|-----|----------|-------|-----------|
| 1 | Member access shows "type unknown" | 🔴 CRITICAL | Semantic | `semantic/analyzer.ts` |
| 2 | Binary ops use `#$00` placeholder | 🔴 CRITICAL | CodeGen | `codegen/instruction-generator.ts` |
| 3 | Comparisons use `#$00` placeholder | 🔴 CRITICAL | CodeGen | `codegen/instruction-generator.ts` |
| 4 | PHI nodes just emit NOP | 🔴 CRITICAL | CodeGen | `codegen/instruction-generator.ts` |
| 5 | Undefined labels (`_main`, `_data`) | 🔴 CRITICAL | CodeGen | `codegen/code-generator.ts` |
| 6 | MUL operation not implemented | 🟠 HIGH | CodeGen | `codegen/instruction-generator.ts` |
| 7 | SHL/SHR operations not implemented | 🟠 HIGH | CodeGen | `codegen/instruction-generator.ts` |
| 8 | LOAD_ARRAY not implemented | 🟠 HIGH | CodeGen | `codegen/instruction-generator.ts` |
| 9 | STORE_ARRAY not implemented | 🟠 HIGH | CodeGen | `codegen/instruction-generator.ts` |
| 10 | Function call ABI (params) | 🟡 MEDIUM | CodeGen | `codegen/instruction-generator.ts` |
| 11 | Double-dot labels (`..label`) | 🟡 MEDIUM | Emitter | `asm-il/emitters/acme-emitter.ts` |
| 12 | E2E tests don't verify execution | 🟡 MEDIUM | Testing | `__tests__/e2e/` |

### Key Files to Modify

| Component | File | Primary Changes |
|-----------|------|-----------------|
| Semantic | `semantic/analyzer.ts` | Member access resolution |
| CodeGen | `codegen/instruction-generator.ts` | Operand tracking, PHI, MUL, arrays |
| CodeGen | `codegen/base-generator.ts` | Value tracking infrastructure |
| CodeGen | `codegen/code-generator.ts` | Label generation fixes |
| Emitter | `asm-il/emitters/acme-emitter.ts` | Label prefix handling |
| Testing | `__tests__/e2e/execution.test.ts` | New execution verification tests |

## Success Criteria

**The fix is complete when:**

1. ✅ `examples/simple/print-demo.blend` compiles to working PRG
2. ✅ `examples/simple/main.blend` compiles to working PRG  
3. ✅ `examples/snake-game/hardware.blend` compiles without semantic errors
4. ✅ All existing tests pass (no regressions)
5. ✅ New execution verification tests added and passing
6. ✅ STATUS documents updated to reflect true state

## Estimated Effort

| Phase | Sessions | Time |
|-------|----------|------|
| Phase 1: Semantic Fixes | 1-2 | 2-4 hours |
| Phase 2: CodeGen Operand Tracking | 2-3 | 4-6 hours |
| Phase 3: Missing Operations | 2-3 | 4-6 hours |
| Phase 4: Label Fixes | 1 | 1-2 hours |
| Phase 5: Testing & Verification | 1-2 | 2-4 hours |
| **Total** | **7-11** | **13-22 hours** |

## Related Documents

- **GAP-REPORT.md** - Needs update to reflect true state
- **PROJECT_STATUS.md** - Needs update (not production ready)
- **WHATS-LEFT.md** - Needs update with critical gaps