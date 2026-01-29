# Code Generator Fixes - Implementation Plan

> **Feature**: Fix ALL code generation issues for 100% working compiler
> **Status**: Planning Complete
> **Created**: 2026-01-28
> **Source**: CODEGEN-ISSUES-ANALYSIS.md (14 critical issues)

## Overview

This plan addresses **14 critical issues** in the Blend65 code generator that prevent compilation of any non-trivial programs. The issues range from fundamental value tracking problems to missing IL opcode handlers.

**After completing ALL phases, the compiler will:**
- ✅ Generate correct 6502 assembly for all language features
- ✅ Pass 300+ correctness tests
- ✅ Compile real C64 programs without errors
- ✅ Handle all 47 IL opcodes
- ✅ Support multi-file compilation

## Document Index

| #  | Document | Description |
|----|----------|-------------|
| 00 | [Index](00-index.md) | This document - overview and navigation |
| 01 | [Requirements](01-requirements.md) | All 14 issues as formal requirements |
| 02 | [Current State](02-current-state.md) | Analysis of current codegen implementation |
| 03 | [Test Infrastructure](03-test-infrastructure.md) | Phase 0: Build test tools FIRST |
| 04 | [Value Tracking](04-value-tracking.md) | Phase 1: Fix value tracking (foundation) |
| 05 | [Missing Opcodes](05-missing-opcodes.md) | Phase 2: Implement 15+ missing IL opcodes |
| 06 | [PHI Lowering](06-phi-lowering.md) | Phase 3: Fix SSA PHI node handling |
| 07 | [Calling Convention](07-calling-convention.md) | Phase 4: Function parameter passing ABI |
| 08 | [String Literals](08-string-literals.md) | Phase 5: Implement string support |
| 09 | [Word Operations](09-word-operations.md) | Phase 6: Fix 16-bit operations |
| 10 | [Register Allocation](10-register-allocation.md) | Phase 7: Proper A/X/Y/ZP usage |
| 11 | [Module System](11-module-system.md) | Phase 8: Test import/export |
| 12 | [Correctness Tests](12-correctness-tests.md) | Phase 9: 300+ verification tests |
| 13 | [VICE Test Rig](13-vice-test-rig.md) | **Amendment**: VICE integration for testing |
| 14 | [Missing Features](14-missing-features.md) | **Amendment**: Intrinsics, enums, do-while |
| 15 | [Runtime Safety](15-runtime-safety.md) | **Amendment**: Spill area, recursion, runtime lib |
| 16 | [Verification Tests](16-verification-tests.md) | **Amendment**: Storage classes, 2D arrays |
| 17 | [Amendments 2026-01-28](17-amendments-2026-01-28.md) | **Amendment**: Removed opcodes, switch tests, @address |
| 18 | [Critical Gaps 2026-01-28](18-critical-gaps-2026-01-28.md) | **CRITICAL Amendment**: 9 critical gaps for 100% working compiler |
| 19 | [Final Gaps 2026-01-28](19-final-gaps-2026-01-28.md) | **FINAL Amendment**: 11 final gaps for 100% working compiler (78 tasks) |
| 20 | [Review Gaps 2026-01-28](20-review-gaps-2026-01-28.md) | **REVIEW Amendment**: 6 review gaps for true 100% completion (27 tasks) |
| 21 | [Final Completion 2026-01-28](21-final-completion-2026-01-28.md) | **FINAL Amendment**: 3 final gaps for true 100% (12 tasks) |
| 22 | [Final Polish 2026-01-28](22-final-polish-2026-01-28.md) | **POLISH Amendment**: 5 edge cases for absolute 100% (17 tasks) |
| 99 | [Execution Plan](99-execution-plan.md) | Session-by-session task checklist |

## Quick Reference

### The 14 Critical Issues

| # | Issue | Severity | Phase |
|---|-------|----------|-------|
| 1 | Value Tracking Broken | CRITICAL | 1 |
| 2 | PHI Node Lowering Incomplete | CRITICAL | 3 |
| 3 | Binary Ops Don't Preserve Operands | CRITICAL | 1 |
| 4 | Function Calling Convention Missing | CRITICAL | 4 |
| 5 | No Register Allocation | HIGH | 7 |
| 6 | E2E Tests Don't Verify Correctness | HIGH | 0, 9 |
| 7 | Extreme Testing Required | HIGH | 9 |
| 8 | 15+ IL Opcodes Not Implemented | CRITICAL | 2 |
| 9 | String Literals Not Implemented | CRITICAL | 5 |
| 10 | 16-bit Operations Partially Broken | HIGH | 6 |
| 11 | Short-Circuit Evaluation Not Implemented | HIGH | 2 |
| 12 | Module/Import System Gaps | MEDIUM | 8 |
| 13 | Array Initialization Incomplete | MEDIUM | 2 |
| 14 | Complex Expression Nesting | HIGH | 1, 7 |

### Phase Overview

| Phase | Name | Issues Addressed | Sessions | Est. Hours |
|-------|------|------------------|----------|------------|
| 0 | Test Infrastructure | 6, 7 | 3-4 | 8-12 |
| 1 | Value Tracking | 1, 3, 14 | 4-5 | 12-16 |
| 2 | Missing Opcodes | 8, 11, 13 | 5-6 | 16-20 |
| 3 | PHI Lowering | 2 | 3-4 | 10-14 |
| 4 | Calling Convention | 4 | 3-4 | 10-14 |
| 5 | String Literals | 9 | 2-3 | 6-10 |
| 6 | Word Operations | 10 | 3-4 | 10-14 |
| 7 | Register Allocation | 5, 14 | 4-5 | 12-16 |
| 8 | Module System | 12 | 2-3 | 6-10 |
| 9 | Correctness Tests | 6, 7 | 6-8 | 20-30 |
| **TOTAL** | | **14 issues** | **35-46** | **110-160** |

### Key Files to Modify

| File | Phases | Description |
|------|--------|-------------|
| `codegen/base-generator.ts` | 1, 3, 7 | Value tracking infrastructure |
| `codegen/instruction-generator.ts` | 1, 2, 3, 4, 5, 6 | Main instruction translation |
| `codegen/globals-generator.ts` | 5, 8 | Global variables, strings |
| `codegen/code-generator.ts` | 4, 7, 8 | Entry point, orchestration |
| `il/generator/expressions.ts` | 5 | String literal IL generation |
| `__tests__/e2e/*.test.ts` | 0, 9 | Correctness test files |

## Success Criteria

**The project is COMPLETE when:**

1. ✅ All 14 issues are fixed
2. ✅ All 47 IL opcodes have handlers
3. ✅ 300+ new tests pass
4. ✅ E2E tests verify correctness, not just compilation
5. ✅ Example programs compile and run correctly
6. ✅ No STUB comments in generated assembly
7. ✅ No "Unknown value" warnings
8. ✅ Multi-file compilation works

## Related Documents

- [CODEGEN-ISSUES-ANALYSIS.md](../../CODEGEN-ISSUES-ANALYSIS.md) - Original analysis
- [COMPILER-MASTER-PLAN.md](../COMPILER-MASTER-PLAN.md) - Overall compiler roadmap
- [Language Specification](../../docs/language-specification/) - Language reference