# Execution Plan: Phase 10 — Integration, Pipeline & v1 Removal

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-08-02 16:35
> **Progress**: 63/75 tasks (84%)

## Overview

This document defines the execution sessions for Phase 10 of the Blend65 compiler-v2 project. Phase 10 is the final phase that wires everything together.

**🚨 IMPORTANT: Update this document after EACH completed task!**

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 10A | Infrastructure Migration | 2 | 2-3 hours |
| 10B | Library Files | 2 | 2-3 hours |
| 10C | ASM_RAW IL + CodeGen | 2-3 | 3-4 hours |
| 10D | Pipeline & Compiler Class | 3 | 4-5 hours |
| 10E | E2E Tests | 2-3 | 3-4 hours |
| 10F | CLI Update | 1 | 1-2 hours |
| 10G | V1 Removal & Rename | 1-2 | 1-2 hours |
| 10H | Final Verification | 1 | 1-2 hours |

**Total: 14-17 sessions, ~17-25 hours**

---

## Phase 10A: Infrastructure Migration

**Reference**: [01-infrastructure.md](01-infrastructure.md)

### Session 10A.1: Config & Target Migration

**Objective**: Copy config types and target system from v1

**Tasks**:

| # | Task | File(s) |
|---|------|---------|
| 10A.1.1 | Copy config types.ts from v1 | `src/config/types.ts` |
| 10A.1.2 | Create config index.ts | `src/config/index.ts` |
| 10A.1.3 | Copy target architecture.ts | `src/target/architecture.ts` |
| 10A.1.4 | Copy target config.ts | `src/target/config.ts` |
| 10A.1.5 | Copy target registry.ts + configs/ | `src/target/registry.ts`, `src/target/configs/` |
| 10A.1.6 | Create target index.ts | `src/target/index.ts` |
| 10A.1.7 | Add config + target unit tests | `__tests__/config/`, `__tests__/target/` |

**Deliverables**:
- [ ] Config types compile in v2
- [ ] Target system compiles in v2
- [ ] Unit tests pass

**Verify**: `./compiler-test`

---

### Session 10A.2: Library Loader Migration

**Objective**: Copy and adapt library loader from v1

**Tasks**:

| # | Task | File(s) |
|---|------|---------|
| 10A.2.1 | Copy library loader.ts, update imports | `src/library/loader.ts` |
| 10A.2.2 | Create library index.ts | `src/library/index.ts` |
| 10A.2.3 | Create v2 library directory structure | `library/common/`, `library/c64/common/`, `library/x16/common/` |
| 10A.2.4 | Copy SourceRegistry from v1, update imports | `src/utils/source-registry.ts` |
| 10A.2.5 | Add library loader unit tests | `__tests__/library/` |

**Deliverables**:
- [ ] Library loader compiles with v2 imports
- [ ] Directory structure created
- [ ] Unit tests pass

**Verify**: `./compiler-test`

---

## Phase 10B: Library Files

**Reference**: [02-library-sync.md](02-library-sync.md), [03-asm-blend-declarations.md](03-asm-blend-declarations.md)

### Session 10B.1: system.blend & hardware.blend

**Objective**: Create v2 system.blend (10 intrinsics), copy hardware.blend

**Tasks**:

| # | Task | File(s) |
|---|------|---------|
| 10B.1.1 | Write v2 system.blend (10 intrinsics only) | `library/common/system.blend` |
| 10B.1.2 | Copy hardware.blend from v1 (no changes needed — uses export const, no @map) | `library/c64/common/hardware.blend` |
| 10B.1.3 | Verify hardware.blend parses with v2 | `library/c64/common/hardware.blend` |
| 10B.1.4 | Test: system.blend parses with v2 lexer/parser | Test file |
| 10B.1.5 | Test: hardware.blend parses with v2 lexer/parser | Test file |
| 10B.1.6 | Integration test: LibraryLoader loads both | Test file |

**Deliverables**:
- [ ] system.blend with 10 intrinsic stubs
- [ ] hardware.blend compatible with v2
- [ ] Parse and load tests pass

**Verify**: `./compiler-test`

---

### Session 10B.2: asm.blend

**Objective**: Create asm.blend with all 151 asm_* function stubs

**Tasks**:

| # | Task | File(s) |
|---|------|---------|
| 10B.2.1 | Write asm.blend with all function stubs | `library/common/asm.blend` |
| 10B.2.2 | Test: asm.blend parses with v2 lexer/parser | Test file |
| 10B.2.3 | Test: LibraryLoader auto-loads asm.blend | Test file |
| 10B.2.4 | Test: Semantic analyzer registers all stubs | Test file |

**Deliverables**:
- [ ] asm.blend with 151 stubs
- [ ] All stubs parse and register correctly
- [ ] Auto-loading works

**Verify**: `./compiler-test`

---

## Phase 10C: ASM_RAW IL + CodeGen

**Reference**: [04-asm-il-wiring.md](04-asm-il-wiring.md), [05-asm-codegen.md](05-asm-codegen.md)

### Session 10C.1: ASM_RAW IL Opcode & Parser Utility

**Objective**: Add ASM_RAW opcode, operand type, and name parser

**Tasks**:

| # | Task | File(s) |
|---|------|---------|
| 10C.1.1 | Add ASM_RAW to ILOpcode enum | `src/il/enums.ts` |
| 10C.1.2 | Add AsmRawOperand type | `src/il/operands.ts` (or types.ts) |
| 10C.1.3 | Create parseAsmFunctionName() utility | `src/il/asm-utils.ts` |
| 10C.1.4 | Unit test: parseAsmFunctionName all patterns | `__tests__/il/asm-utils.test.ts` |

**Deliverables**:
- [ ] ASM_RAW opcode in enum
- [ ] AsmRawOperand type defined
- [ ] Name parser handles all 12 addressing modes
- [ ] Unit tests pass

**Verify**: `./compiler-test`

---

### Session 10C.2: IL Generator asm_* Handling

**Objective**: Wire asm_* detection into IL generator expression handling

**Tasks**:

| # | Task | File(s) |
|---|------|---------|
| 10C.2.1 | Add asm_* detection in call expression handler | `src/il/generator/expressions.ts` |
| 10C.2.2 | Emit ASM_RAW for implied-mode asm_* calls | `src/il/generator/expressions.ts` |
| 10C.2.3 | Emit ASM_RAW with operand for addressed calls | `src/il/generator/expressions.ts` |
| 10C.2.4 | Unit tests: IL output for asm_* calls | `__tests__/il/asm-il-gen.test.ts` |

**Deliverables**:
- [ ] asm_* calls generate ASM_RAW IL
- [ ] All addressing modes work
- [ ] Unit tests pass

**Verify**: `./compiler-test`

---

### Session 10C.3: CodeGen ASM_RAW Handler

**Objective**: Generate 6502 assembly from ASM_RAW IL instructions

**Tasks**:

| # | Task | File(s) |
|---|------|---------|
| 10C.3.1 | Add ASM_RAW case to intrinsics codegen | `src/codegen/generator/intrinsics.ts` |
| 10C.3.2 | Implement all 12 addressing mode formatters | `src/codegen/generator/intrinsics.ts` |
| 10C.3.3 | Unit tests: each addressing mode output | `__tests__/codegen/asm-raw.test.ts` |
| 10C.3.4 | Integration test: asm_* → IL → ASM-IL | `__tests__/codegen/asm-integration.test.ts` |

**Deliverables**:
- [ ] All 12 addressing modes generate correct assembly
- [ ] Integration tests verify full flow
- [ ] All tests pass

**Verify**: `./compiler-test`

---

## Phase 10D: Pipeline & Compiler Class

**Reference**: [06-pipeline-compiler.md](06-pipeline-compiler.md)

### Session 10D.1: Pipeline Types & Phase Wrappers (Part 1)

**Objective**: Create pipeline types and first 4 phase wrappers

**Tasks**:

| # | Task | File(s) |
|---|------|---------|
| 10D.1.1 | Create pipeline types (PhaseResult, CompilationResult) | `src/pipeline/types.ts` |
| 10D.1.2 | Create ParsePhase wrapper | `src/pipeline/parse-phase.ts` |
| 10D.1.3 | Create SemanticPhase wrapper | `src/pipeline/semantic-phase.ts` |
| 10D.1.4 | Create FramePhase wrapper | `src/pipeline/frame-phase.ts` |
| 10D.1.5 | Create ILPhase wrapper | `src/pipeline/il-phase.ts` |

**Deliverables**:
- [ ] Pipeline types defined
- [ ] First 4 phases compile

**Verify**: `clear && yarn build`

---

### Session 10D.2: Phase Wrappers (Part 2) & Compiler Class

**Objective**: Create remaining phases and main Compiler class

**Tasks**:

| # | Task | File(s) |
|---|------|---------|
| 10D.2.1 | Create OptimizePhase wrapper | `src/pipeline/optimize-phase.ts` |
| 10D.2.2 | Create CodegenPhase wrapper | `src/pipeline/codegen-phase.ts` |
| 10D.2.3 | Create AsmOptPhase wrapper | `src/pipeline/asm-opt-phase.ts` |
| 10D.2.4 | Create EmitPhase wrapper | `src/pipeline/emit-phase.ts` |
| 10D.2.5 | Create pipeline index.ts | `src/pipeline/index.ts` |
| 10D.2.6 | Create Compiler class | `src/compiler.ts` |

**Deliverables**:
- [ ] All 8 phase wrappers compile
- [ ] Compiler class compiles
- [ ] Pipeline wired together

**Verify**: `clear && yarn build`

---

### Session 10D.3: Compiler Tests & Public API

**Objective**: Test Compiler class and finalize public API exports

**Tasks**:

| # | Task | File(s) |
|---|------|---------|
| 10D.3.1 | Update index.ts: uncomment module re-exports + add full public API | `src/index.ts` |
| 10D.3.2 | Unit test: Compiler.compile() | `__tests__/compiler.test.ts` |
| 10D.3.3 | Unit test: Compiler.check() | `__tests__/compiler.test.ts` |
| 10D.3.4 | Unit test: library auto-loading | `__tests__/compiler.test.ts` |
| 10D.3.5 | Unit test: error propagation | `__tests__/compiler.test.ts` |

**Deliverables**:
- [ ] Public API exports all needed types
- [ ] Compiler class tested
- [ ] All tests pass

**Verify**: `./compiler-test`

---

## Phase 10E: E2E Tests

**Reference**: [07-e2e-tests.md](07-e2e-tests.md)

### Session 10E.1: Basic Pipeline E2E Tests

**Objective**: Test simple programs and intrinsics through full pipeline

**Tasks**:

| # | Task | File(s) |
|---|------|---------|
| 10E.1.1 | Create E2E test helper | `__tests__/e2e/pipeline/helpers.ts` |
| 10E.1.2 | Simple programs E2E tests | `__tests__/e2e/pipeline/simple-programs.test.ts` |
| 10E.1.3 | Intrinsics E2E tests | `__tests__/e2e/pipeline/intrinsics.test.ts` |
| 10E.1.4 | Error cases E2E tests | `__tests__/e2e/pipeline/error-cases.test.ts` |

**Deliverables**:
- [ ] Simple programs compile to assembly
- [ ] Intrinsics generate correct code
- [ ] Error cases produce diagnostics

**Verify**: `./compiler-test`

---

### Session 10E.2: ASM Functions & Multi-Module E2E Tests

**Objective**: Test asm_* functions and multi-module compilation

**Tasks**:

| # | Task | File(s) |
|---|------|---------|
| 10E.2.1 | ASM function E2E tests | `__tests__/e2e/pipeline/asm-functions.test.ts` |
| 10E.2.2 | Multi-module E2E tests | `__tests__/e2e/pipeline/multi-module.test.ts` |
| 10E.2.3 | C64 pattern E2E tests | `__tests__/e2e/pipeline/c64-patterns.test.ts` |

**Deliverables**:
- [ ] All asm_* categories tested
- [ ] Multi-module compilation works
- [ ] C64 patterns produce valid assembly

**Verify**: `./compiler-test`

---

## Phase 10F: CLI Update

**Reference**: [08-cli-update.md](08-cli-update.md)

### Session 10F.1: Update CLI Imports

**Objective**: Switch CLI to use v2 compiler

**Tasks**:

| # | Task | File(s) |
|---|------|---------|
| 10F.1.1 | Update cli package.json dependency | `packages/cli/package.json` |
| 10F.1.2 | Update build.ts imports | `packages/cli/src/commands/build.ts` |
| 10F.1.3 | Update check.ts imports | `packages/cli/src/commands/check.ts` |
| 10F.1.4 | Update formatter.ts imports | `packages/cli/src/output/formatter.ts` |
| 10F.1.5 | Update SourceRegistry import (already ported in 10A.2.4) | `packages/cli/src/output/formatter.ts` |
| 10F.1.6 | Test CLI build command manually | Manual |

**Deliverables**:
- [ ] CLI imports from v2
- [ ] CLI commands work
- [ ] All tests pass

**Verify**: `./compiler-test`

---

## Phase 10G: V1 Removal & Rename

**Reference**: [09-v1-removal.md](09-v1-removal.md)

### Session 10G.1: Archive V1 & Rename V2

**Objective**: Remove v1 package, rename v2 to primary

**Tasks**:

| # | Task | File(s) |
|---|------|---------|
| 10G.1.1 | Archive v1 package | `archive/packages/compiler-v1/` |
| 10G.1.2 | Rename compiler-v2 → compiler | `packages/compiler/` |
| 10G.1.3 | Update package.json name | `packages/compiler/package.json` |
| 10G.1.4 | Update CLI imports (v2 → compiler) | `packages/cli/src/` |
| 10G.1.5 | Update monorepo configs | `turbo.json`, `vitest.config.ts`, `compiler-test` |
| 10G.1.6 | Update examples if needed | `examples/` |
| 10G.1.7 | Full test suite verification | All |

**Deliverables**:
- [ ] v1 archived
- [ ] v2 is now packages/compiler
- [ ] All imports updated
- [ ] All tests pass

**Verify**: `./compiler-test`

---

## Phase 10H: Final Verification

**Reference**: [10-verification.md](10-verification.md)

### Session 10H.1: Final Checks & Documentation

**Objective**: Final verification and documentation update

**Tasks**:

| # | Task | File(s) |
|---|------|---------|
| 10H.1.1 | Full test suite pass | `./compiler-test` |
| 10H.1.2 | Compile example programs | `examples/` |
| 10H.1.3 | Update PROJECT_STATUS.md | `PROJECT_STATUS.md` |
| 10H.1.4 | Update main 99-execution-plan.md Phase 10 | `plans/compiler-v2/99-execution-plan.md` |
| 10H.1.5 | Clean up dead code and unused files | Various |

**Deliverables**:
- [ ] All tests passing (7000+)
- [ ] Example programs compile
- [ ] Documentation current
- [ ] Project clean

**Verify**: `./compiler-test`

---

## Task Checklist (All Phases)

### Phase 10A: Infrastructure Migration

- [x] 10A.1.1 Copy config types.ts from v1 ✅ (completed: 2026-08-02 10:18)
- [x] 10A.1.2 Create config index.ts ✅ (completed: 2026-08-02 10:18)
- [x] 10A.1.3 Copy target architecture.ts ✅ (completed: 2026-08-02 10:18)
- [x] 10A.1.4 Copy target config.ts ✅ (completed: 2026-08-02 10:19)
- [x] 10A.1.5 Copy target registry.ts + configs/ ✅ (completed: 2026-08-02 10:21)
- [x] 10A.1.6 Create target index.ts ✅ (completed: 2026-08-02 10:21)
- [x] 10A.1.7 Add config + target unit tests ✅ (completed: 2026-08-02 10:59)
- [x] 10A.2.1 Copy library loader.ts, update imports ✅ (completed: 2026-08-02 10:23)
- [x] 10A.2.2 Create library index.ts ✅ (completed: 2026-08-02 10:23)
- [x] 10A.2.3 Create v2 library directory structure (incl. x16/common/) ✅ (completed: 2026-08-02 10:25)
- [x] 10A.2.4 Copy SourceRegistry from v1, update imports ✅ (completed: 2026-08-02 10:24)
- [x] 10A.2.5 Add library loader unit tests ✅ (completed: 2026-08-02 10:59)

### Phase 10B: Library Files

- [x] 10B.1.1 Write v2 system.blend ✅ (completed: 2026-08-02 10:25)
- [x] 10B.1.2 Copy hardware.blend from v1 (no changes needed) ✅ (completed: 2026-08-02 10:25)
- [x] 10B.1.3 Verify hardware.blend parses with v2 ✅ (completed: 2026-08-02 10:59)
- [x] 10B.1.4 Test: system.blend parses ✅ (completed: 2026-08-02 10:59)
- [x] 10B.1.5 Test: hardware.blend parses ✅ (completed: 2026-08-02 10:59)
- [x] 10B.1.6 Integration test: LibraryLoader loads both ✅ (completed: 2026-08-02 10:59)
- [x] 10B.2.1 Write asm.blend with all 151 stubs ✅ (completed: 2026-08-02 10:27)
- [x] 10B.2.2 Test: asm.blend parses ✅ (completed: 2026-08-02 10:59)
- [x] 10B.2.3 Test: LibraryLoader auto-loads asm.blend ✅ (completed: 2026-08-02 10:59)
- [ ] 10B.2.4 Test: Semantic registers all stubs (deferred - needs pipeline)

### Phase 10C: ASM_RAW IL + CodeGen

- [x] 10C.1.1 Add ASM_RAW to ILOpcode enum ✅ (completed: 2026-08-02 11:02)
- [x] 10C.1.2 Add AsmRawOperand type ✅ (completed: 2026-08-02 11:03)
- [x] 10C.1.3 Create parseAsmFunctionName() utility ✅ (completed: 2026-08-02 11:05)
- [x] 10C.1.4 Unit test: parseAsmFunctionName ✅ (completed: 2026-08-02 11:09)
- [x] 10C.2.1 Add asm_* detection in call handler ✅ (completed: 2026-08-02 11:28)
- [x] 10C.2.2 Emit ASM_RAW for implied-mode calls ✅ (completed: 2026-08-02 11:28)
- [x] 10C.2.3 Emit ASM_RAW with operand for addressed calls ✅ (completed: 2026-08-02 11:28)
- [x] 10C.2.4 Unit tests: IL output for asm_* calls ✅ (completed: 2026-08-02 11:45)
- [x] 10C.3.1 Add ASM_RAW case to intrinsics codegen ✅ (completed: 2026-08-02 11:30)
- [x] 10C.3.2 Implement all addressing mode formatters ✅ (completed: 2026-08-02 11:30)
- [x] 10C.3.3 Unit tests: addressing mode output ✅ (completed: 2026-08-02 11:45)
- [x] 10C.3.4 Integration test: asm_* → IL → ASM-IL ✅ (completed: 2026-08-02 11:45)

### Phase 10D: Pipeline & Compiler Class

- [x] 10D.1.1 Create pipeline types ✅ (completed: 2026-08-02 12:00)
- [x] 10D.1.2 Create ParsePhase ✅ (completed: 2026-08-02 12:00)
- [x] 10D.1.3 Create SemanticPhase ✅ (completed: 2026-08-02 12:00)
- [x] 10D.1.4 Create FramePhase ✅ (completed: 2026-08-02 12:00)
- [x] 10D.1.5 Create ILPhase ✅ (completed: 2026-08-02 12:00)
- [x] 10D.2.1 Create OptimizePhase ✅ (completed: 2026-08-02 12:20)
- [x] 10D.2.2 Create CodegenPhase ✅ (completed: 2026-08-02 12:20)
- [x] 10D.2.3 Create AsmOptPhase ✅ (completed: 2026-08-02 12:20)
- [x] 10D.2.4 Create EmitPhase ✅ (completed: 2026-08-02 12:20)
- [x] 10D.2.5 Create pipeline index.ts ✅ (completed: 2026-08-02 12:20)
- [x] 10D.2.6 Create Compiler class ✅ (completed: 2026-08-02 12:30)
- [x] 10D.3.1 Update index.ts: selective re-exports + full public API ✅ (completed: 2026-08-02 13:00)
- [x] 10D.3.2 Unit test: Compiler.compile() + compileSource() ✅ (completed: 2026-08-02 13:55)
- [x] 10D.3.3 Unit test: Compiler.check() + parseOnly() ✅ (completed: 2026-08-02 13:55)
- [x] 10D.3.4 Unit test: library auto-loading ✅ (completed: 2026-08-02 13:55)
- [x] 10D.3.5 Unit test: error propagation + formatDiagnostics ✅ (completed: 2026-08-02 13:55)

### Phase 10E: E2E Tests

- [x] 10E.1.1 Create E2E test helper ✅ (completed: 2026-08-02 15:03)
- [x] 10E.1.2 Simple programs E2E tests ✅ (completed: 2026-08-02 15:11)
- [x] 10E.1.3 Intrinsics E2E tests ✅ (completed: 2026-08-02 15:16)
- [x] 10E.1.4 Error cases E2E tests ✅ (completed: 2026-08-02 15:20)
- [x] 10E.2.1 ASM function E2E tests ✅ (completed: 2026-08-02 16:27)
- [x] 10E.2.2 Multi-module E2E tests ✅ (completed: 2026-08-02 16:33)
- [x] 10E.2.3 C64 pattern E2E tests ✅ (completed: 2026-08-02 16:34)

### Phase 10F: CLI Update

- [ ] 10F.1.1 Update cli package.json
- [ ] 10F.1.2 Update build.ts imports
- [ ] 10F.1.3 Update check.ts imports
- [ ] 10F.1.4 Update formatter.ts imports
- [ ] 10F.1.5 Update SourceRegistry import (already ported in 10A.2.4)
- [ ] 10F.1.6 Test CLI build command

### Phase 10G: V1 Removal & Rename

- [ ] 10G.1.1 Archive v1 package
- [ ] 10G.1.2 Rename compiler-v2 → compiler
- [ ] 10G.1.3 Update package.json name
- [ ] 10G.1.4 Update CLI imports
- [ ] 10G.1.5 Update monorepo configs
- [ ] 10G.1.6 Update examples
- [ ] 10G.1.7 Full test suite verification

### Phase 10H: Final Verification

- [ ] 10H.1.1 Full test suite pass
- [ ] 10H.1.2 Compile example programs
- [ ] 10H.1.3 Update PROJECT_STATUS.md
- [ ] 10H.1.4 Update main execution plan
- [ ] 10H.1.5 Clean up dead code

---

## Dependencies

```
Phase 10A (Infrastructure)
    ↓
Phase 10B (Library Files)
    ↓
Phase 10C (ASM_RAW IL + CodeGen)
    ↓
Phase 10D (Pipeline & Compiler)
    ↓
Phase 10E (E2E Tests)
    ↓
Phase 10F (CLI Update)
    ↓
Phase 10G (V1 Removal)
    ↓
Phase 10H (Verification)
```

---

## Session Protocol

### Starting a Session

```bash
clear && scripts/agent.sh start
# "Implement Phase 10X, Session 10X.Y per plans/compiler-v2/phase-10/99-execution-plan.md"
```

### Ending a Session

```bash
./compiler-test
clear && scripts/agent.sh finished
# call attempt_completion
# user runs /compact
```

---

## Success Criteria

**Phase 10 is complete when**:

1. ✅ All 75 tasks completed
2. ✅ All tests passing (7000+)
3. ✅ Full pipeline working end-to-end
4. ✅ All 151 asm_* functions working
5. ✅ CLI using v2 compiler
6. ✅ V1 archived
7. ✅ Documentation current
