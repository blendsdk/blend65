# Execution Plan: RD-09 ACME Emitter & Assembler Integration

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-06-10 14:29
> **Progress**: 8/25 tasks (32%)

## Overview

Implement RD-09 in 6 small, independently-testable phases following spec-tests-first
ordering. Phase 1 is the pure serializer (MVP-gate-critical, no external dependency);
Phases 2–6 build the ACME process layer in `@blend65/compiler`. Each phase: write spec tests
→ verify red → implement → verify green → impl tests → full verify.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Package | Est. Time |
| ----- | ----- | ------- | --------- |
| 1 | `serializeToAcme` whole-program serializer | codegen | 60 min |
| 2 | `E_ACME_NOT_FOUND` code + ACME discovery | core + compiler | 45 min |
| 3 | Label-file parser | compiler | 30 min |
| 4 | ACME invocation (mocked child_process) | compiler | 60 min |
| 5 | `emit-binary` orchestration + `--emit-asm` | compiler | 60 min |
| 6 | Post-ACME budget check + artifacts wiring | compiler | 45 min |

**Total: 6 phases, ~5 hours**

---

## Phase 1: Serializer

### Session 1.1: `serializeToAcme`
**Reference**: [03-01-serializer.md](03-01-serializer.md) · **ST**: ST-S1..S8

| # | Task | File |
|---|------|------|
| 1.1.1 | Write spec tests ST-S1..S8 | `codegen/src/instr/serialize-acme.spec.test.ts` |
| 1.1.2 | Run spec tests — verify FAIL (red) | — |
| 1.1.3 | Export `hex16` from `print-instr.ts` (DRY); implement `serializeToAcme` | `codegen/src/instr/serialize-acme.ts`, `print-instr.ts` |
| 1.1.4 | Wire barrel re-export | `codegen/src/instr/index.ts` |
| 1.1.5 | Run spec tests — verify PASS (green) | — |
| 1.1.6 | Write impl/edge tests | `codegen/src/instr/serialize-acme.impl.test.ts` |
| 1.1.7 | Migrate ST-AG1 golden to call `serializeToAcme` (AR-95/A): replace the hand-composed `printInstr` composition with `serializeToAcme(program)`; update the expected golden to add the `; --- symbol definitions ---` header + `; --- function: _main ---` comment (instruction/preamble bytes unchanged) | `compiler/src/assemble.golden.spec.test.ts` |
| 1.1.8 | Full verification (incl. migrated ST-AG1 + boundary tier) | — |

**Verify**: `clear && sleep 3 && yarn build && yarn typecheck && yarn lint && yarn test`

> **AR-95/A note:** `serializeToAcme` is the single canonical whole-program output. ST-S8 asserts
> the header-bearing §4.8 golden, and the existing ST-AG1 test is migrated (task 1.1.7) to call
> `serializeToAcme` so there is exactly one rendering path (no `--emit-asm`/build drift).

---

## Phase 2: ACME Discovery + new diagnostic code

### Session 2.1: `AcmeNotFound` + `discoverAcme`
**Reference**: [03-02-acme-process-layer.md](03-02-acme-process-layer.md) · **ST**: ST-D1..D3

| # | Task | File |
|---|------|------|
| 2.1.1 | Add `DiagCode.AcmeNotFound` + assert uniqueness | `core/src/diagnostics/diagnostic-codes.ts` (+ spec test) |
| 2.1.2 | Write spec tests ST-D1..D3 | `compiler/src/acme/discover-acme.spec.test.ts` |
| 2.1.3 | Run spec tests — verify FAIL (red) | — |
| 2.1.4 | Implement `discoverAcme` (3-tier) | `compiler/src/acme/discover-acme.ts` |
| 2.1.5 | Run spec tests — verify PASS (green) + impl tests | `discover-acme.impl.test.ts` |

**Verify**: full verify command.

---

## Phase 3: Label-File Parser

### Session 3.1: `parseLabelFile`
**Reference**: 03-02 · **ST**: ST-L1..L3

| # | Task | File |
|---|------|------|
| 3.1.1 | Write spec tests ST-L1..L3 | `compiler/src/acme/label-file.spec.test.ts` |
| 3.1.2 | Run spec tests — verify FAIL (red) | — |
| 3.1.3 | Implement `parseLabelFile` | `compiler/src/acme/label-file.ts` |
| 3.1.4 | Run spec tests — verify PASS (green) + impl tests | `label-file.impl.test.ts` |

**Verify**: full verify command.

---

## Phase 4: ACME Invocation

### Session 4.1: `invokeAcme` (mocked child_process)
**Reference**: 03-02 · **ST**: ST-I1..I3

| # | Task | File |
|---|------|------|
| 4.1.1 | Write spec tests ST-I1..I3 (mock `child_process`) | `compiler/src/acme/invoke-acme.spec.test.ts` |
| 4.1.2 | Run spec tests — verify FAIL (red) | — |
| 4.1.3 | Implement `invokeAcme` (spawn, argv array, exit/stderr → ICE) | `compiler/src/acme/invoke-acme.ts` |
| 4.1.4 | Run spec tests — verify PASS (green) + impl tests | `invoke-acme.impl.test.ts` |

**Verify**: full verify command.

---

## Phase 5: Emit Orchestration

### Session 5.1: `emitBinary` + `--emit-asm`
**Reference**: 03-02 · **ST**: ST-E1, ST-E2

| # | Task | File |
|---|------|------|
| 5.1.1 | Write spec tests ST-E1, ST-E2 (mock invoke/fs) | `compiler/src/acme/emit-binary.spec.test.ts` |
| 5.1.2 | Run spec tests — verify FAIL (red) | — |
| 5.1.3 | Implement `emitBinary` (write asm → emit-asm stop / invoke → symbols) | `compiler/src/acme/emit-binary.ts` |
| 5.1.4 | Run spec tests — verify PASS (green) | — |

**Verify**: full verify command.

---

## Phase 6: Budget Check + Artifacts

### Session 6.1: Post-ACME budget + barrel wiring
**Reference**: 03-02 · **ST**: ST-E3

| # | Task | File |
|---|------|------|
| 6.1.1 | Write spec test ST-E3 (budget `E10034`) | `emit-binary.spec.test.ts` (append) |
| 6.1.2 | Implement budget check in `emitBinary`; wire `compiler` barrel | `emit-binary.ts`, `compiler/src/index.ts` |
| 6.1.3 | Run spec tests — verify PASS (green) + impl tests | `emit-binary.impl.test.ts` |
| 6.1.4 | Full verification + confirm ST-AG1/boundary intact | — |

**Verify**: full verify command.

---

## 🚨 Master Progress Checklist (All Phases) — MANDATORY

> **⚠️ EXECUTION RULE:** After completing each task, mark it `[x]` with a timestamp and update
> the Progress header. Never batch updates. Reconstruct this list from the phase tables if missing.

### Phase 1: Serializer
- [x] 1.1.1 Write spec tests ST-S1..S8 ✅ (completed: 2026-06-10 14:24)
- [x] 1.1.2 Run spec tests — verify FAIL (red) ✅ (completed: 2026-06-10 14:25)
- [x] 1.1.3 Export `hex16`; implement `serializeToAcme` ✅ (completed: 2026-06-10 14:26)
- [x] 1.1.4 Wire barrel re-export ✅ (completed: 2026-06-10 14:26)
- [x] 1.1.5 Run spec tests — verify PASS (green) ✅ (completed: 2026-06-10 14:27)
- [x] 1.1.6 Write impl/edge tests ✅ (completed: 2026-06-10 14:28)
- [x] 1.1.7 Migrate ST-AG1 golden to call `serializeToAcme` (AR-95/A) ✅ (completed: 2026-06-10 14:28)
- [x] 1.1.8 Full verification (incl. migrated ST-AG1 + boundary tier) ✅ (completed: 2026-06-10 14:29)

### Phase 2: ACME Discovery + diagnostic code
- [ ] 2.1.1 Add `DiagCode.AcmeNotFound` + uniqueness assert
- [ ] 2.1.2 Write spec tests ST-D1..D3
- [ ] 2.1.3 Run spec tests — verify FAIL (red)
- [ ] 2.1.4 Implement `discoverAcme`
- [ ] 2.1.5 Verify PASS (green) + impl tests

### Phase 3: Label-File Parser
- [ ] 3.1.1 Write spec tests ST-L1..L3
- [ ] 3.1.2 Run spec tests — verify FAIL (red)
- [ ] 3.1.3 Implement `parseLabelFile`
- [ ] 3.1.4 Verify PASS (green) + impl tests

### Phase 4: ACME Invocation
- [ ] 4.1.1 Write spec tests ST-I1..I3 (mock child_process)
- [ ] 4.1.2 Run spec tests — verify FAIL (red)
- [ ] 4.1.3 Implement `invokeAcme`
- [ ] 4.1.4 Verify PASS (green) + impl tests

### Phase 5: Emit Orchestration
- [ ] 5.1.1 Write spec tests ST-E1, ST-E2 (mock invoke/fs)
- [ ] 5.1.2 Run spec tests — verify FAIL (red)
- [ ] 5.1.3 Implement `emitBinary`
- [ ] 5.1.4 Verify PASS (green)

### Phase 6: Budget Check + Artifacts
- [ ] 6.1.1 Write spec test ST-E3 (budget `E10034`)
- [ ] 6.1.2 Implement budget check; wire compiler barrel
- [ ] 6.1.3 Verify PASS (green) + impl tests
- [ ] 6.1.4 Full verification + ST-AG1/boundary intact

---

## Dependencies

```
Phase 1 (serializer, codegen)
    ↓
Phase 2 (discovery + diag code) ─┐
Phase 3 (label parser) ──────────┤  (2,3 independent; both feed 4/5)
    ↓                            │
Phase 4 (invocation) ────────────┘
    ↓
Phase 5 (orchestration)
    ↓
Phase 6 (budget + wiring)
```

---

## Success Criteria

1. ✅ All 6 phases completed
2. ✅ All verification passing (build + typecheck + lint + test)
3. ✅ No warnings/errors; no dead code (code.md r4)
4. ✅ Security: ACME spawned with explicit argv (no shell) (code.md r32-34)
5. ✅ ST-AG1 (migrated to `serializeToAcme`, AR-95/A) + R15 boundary tier still green
6. ✅ All decisions trace to AR-94/AR-95 or the RD's AR citations (AC-20)
7. ✅ `plans/ROADMAP.md` updated to Done on completion
8. ✅ **Post-completion:** ask user to re-analyze project / update `.clinerules/project.md`
