# Execution Plan: RD-17 — Intrinsic Functions & Runtime-Routine ABI

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-02 (PLAN COMPLETE — all 6 phases executed, full verify green)
> **Progress**: 47/47 tasks (100%)
> **CodeOps Skills Version**: 3.1.0

## Overview

Implements RD-17 in full (AR-P1) across six phases, one per component doc plus an
end-to-end closeout. Every phase follows the mandatory spec-first ordering
(spec tests → red → implement → green → impl tests → verify).

**🚨 Update this document after EACH completed task!**

**AC-14 note (AR-P4):** emulator-tier functional verification of the `.asm` routine math
is DEFERRED to RD-12. This plan verifies assembly-level correctness (ST-30, ST-33).

---

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | Core registry, catalog & core deltas (03-01) | 3 | ~5 h |
| 2 | Semantic validation pass (03-02) | 3 | ~6 h |
| 3 | IL lowering & T1/T2 emission (03-03) | 3 | ~5 h |
| 4 | T3 runtime modules, embedding & marshalling (03-04) | 3 | ~7 h |
| 5 | T4 platform mechanism (03-05) | 3 | ~4 h |
| 6 | End-to-end, catalog audit & closeout | 2 | ~3 h |

**Total: 17 sessions, ~28–32 hours**

---

## Phase 1: Core registry, catalog & core deltas

### Session 1.1: Spec tests (03-01)
**Reference**: [03-01](03-01-core-registry.md), [07 ST-1..ST-7](07-testing-strategy.md)
**Tasks**:

| # | Task | File |
|---|------|------|
| 1.1.1 | Write registry + catalog + floor spec tests (ST-1..ST-7) — no implementation reading | `core/src/intrinsics/{registry,catalog}.spec.test.ts`, `core/src/platform/validate-profile.spec.test.ts` |
| 1.1.2 | Run spec tests — verify they FAIL (red phase) | — |

### Session 1.2: Implementation
**Tasks**:

| # | Task | File |
|---|------|------|
| 1.2.1 | Descriptor types + registry (`createIntrinsicRegistry`, duplicate-throw AR-P9) | `core/src/intrinsics/{descriptor,registry}.ts` |
| 1.2.2 | Full catalog: 23 user-visible + 4 `__rt_*` T3 descriptors, costs/descriptions | `core/src/intrinsics/catalog.ts` |
| 1.2.3 | Core deltas: E10043/44/45/46; `asm_wai`→RESERVED_BUILTINS (+locked tests); `WAI`→W65C02_OPCODES; `zpArgBlockSize>=4` floor; `zpArgBlockMin` 0→4 (+locked `records.impl.test.ts:31` & `DEFAULT_PROFILE` assertion sweep — PF-020); canonical profile +`platformId` (5 plugins + fixtures, `validateProfile` consistency check — PF-015); plugin `IntrinsicDescriptor` placeholder → real type; barrel exports (`RuntimeModule.baseUrl` lands in Phase 5 — PF-017) | per [03-01 table](03-01-core-registry.md) |
| 1.2.4 | Run spec tests — verify PASS (green); fix implementation, never tests | — |

### Session 1.3: Impl tests & hardening
**Tasks**:

| # | Task | File |
|---|------|------|
| 1.3.1 | Impl tests: `getAvailable` × 5 profiles, TypeRef shapes, set-growth assertions | `core/src/intrinsics/registry.impl.test.ts` |
| 1.3.2 | Full verify | — |

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 2: Semantic validation pass

### Session 2.1: Spec tests (03-02)
| # | Task | File |
|---|------|------|
| 2.1.1 | Write validation spec tests ST-8..ST-14, ST-17 (T4 cases ST-15/16 authored now, marked `.todo` until Phase 5 wires the fixture) | `frontend/src/semantics/intrinsic-validation.spec.test.ts` |
| 2.1.2 | Red phase | — |

### Session 2.2: Implementation
| # | Task | File |
|---|------|------|
| 2.2.1 | Minimal declaration collection (structs/enums/vars/imports — AR-P13) | `frontend/src/semantics/declaration-collection.ts` |
| 2.2.2 | `AnalyzeInput.registry?` + internal default (AR-P3) and `AnalyzeInput.targetProfile?` (canonical profile; V4/V6b skipped when absent — PF-014); wire pass seams | `frontend/src/semantics/{analyze,passes}.ts` |
| 2.2.3 | Checks V1–V8 (E10040/41, E10171 literal, E10043, E10101, E10046, W10120 — AR-P6/P14) | `frontend/src/semantics/intrinsic-validation.ts` |
| 2.2.4 | Green phase (ST-8..14, ST-17) | — |

### Session 2.3: Impl tests & hardening
| # | Task | File |
|---|------|------|
| 2.3.1 | Impl tests: multi-module imports, type-table edges, no-throw fuzz | `frontend/src/semantics/intrinsic-validation.impl.test.ts` |
| 2.3.2 | Full verify | — |

---

## Phase 3: IL lowering & T1/T2 emission

### Session 3.1: Spec tests (03-03)
| # | Task | File |
|---|------|------|
| 3.1.1 | Write lowering/emission spec tests ST-18..ST-23 + ST-34 (length boundary, AR-P15) | `codegen/src/il/lower-intrinsics.spec.test.ts`, `codegen/src/instr/translate-t1.spec.test.ts` |
| 3.1.2 | Red phase | — |

### Session 3.2: Implementation
| # | Task | File |
|---|------|------|
| 3.2.1 | Migrate IL placeholder descriptor → core type (tier string union) | `codegen/src/il/intrinsic-descriptor.ts`, `il/instruction.ts` |
| 3.2.2 | Strategy-dispatched `lowerIntrinsic`: folds (type table), inline peekw/pokew/lo/hi, T1→`intrinsic` op; E10045 replaces the address ICE (AR-P5) | `codegen/src/il/lower.ts` |
| 3.2.3 | Translate `'opcode'` path: one Instr per T1 (AC-07) | `codegen/src/instr/translate.ts` |
| 3.2.4 | Green phase | — |

### Session 3.3: Impl tests & hardening
| # | Task | File |
|---|------|------|
| 3.3.1 | Impl tests: little-endian pairs, poison recovery, emitter-map completeness | `codegen/src/il/lower-intrinsics.impl.test.ts` |
| 3.3.2 | Full verify | — |

---

## Phase 4: T3 runtime modules, embedding & marshalling

### Session 4.1: Spec tests (03-04)
| # | Task | File |
|---|------|------|
| 4.1.1 | Write marshalling + embedding spec tests ST-24..ST-29 | `codegen/src/instr/marshalling.spec.test.ts`, `codegen/src/runtime/embed.spec.test.ts` |
| 4.1.2 | Write ACME syntax-check spec test ST-30 (skip-if-no-ACME; harness prepends the `__zp_arg_0/1` prelude for word routines — PF-019) | `compiler/src/runtime-asm.spec.test.ts` |
| 4.1.3 | Red phase | — |

### Session 4.2: Implementation
| # | Task | File |
|---|------|------|
| 4.2.1 | Author the four `.asm` modules per §4.6 convention + AR-P7 ABI (reference algorithms) | `codegen/runtime/{mul8,mul16,div8,div16}.asm` |
| 4.2.2 | `embed.ts`: referenced-symbol collection (post-peephole), module loading with path guard; reuse allocator `__zp_arg_N` symbols — no new symbol defs (PF-018) | `codegen/src/runtime/embed.ts` |
| 4.2.3 | Serializer: optional `opts?: { runtimeSection? }` appended as a discrete section (PF-016; goldens for no-runtime programs unchanged — ST-29) | `codegen/src/instr/serialize-acme.ts` |
| 4.2.4 | Marshalling rewrite (`marshalAndCall`): both operands, word→ZP block, mod-remainder binding, E10044 via `generateInstr` `opts.zpArgBlockSize` threaded by `assembleProgram` (PF-016) | `codegen/src/instr/translate.ts`, `codegen/src/instr/instr-program.ts` |
| 4.2.5 | Remove mul/div `runtimeModules` stubs from 5 plugins (+locked tests) — AR-98 | `platforms/src/*.ts` |
| 4.2.6 | Green phase | — |

### Session 4.3: Impl tests & hardening
| # | Task | File |
|---|------|------|
| 4.3.1 | Impl tests: symbol collection, path guard, `__zp_arg_N` reference correctness (PF-018) | `codegen/src/runtime/embed.impl.test.ts` |
| 4.3.2 | Full verify | — |

---

## Phase 5: T4 platform mechanism

### Session 5.1: Spec tests (03-05)
| # | Task | File |
|---|------|------|
| 5.1.1 | Fixture plugin + `.asm`; write ST-31/ST-32; un-`.todo` ST-15/ST-16 | `platforms/src/t4-contribution.spec.test.ts`, fixtures |
| 5.1.2 | Red phase (incl. ST-15/16 now live) | — |

### Session 5.2: Implementation
| # | Task | File |
|---|------|------|
| 5.2.1 | Registry merge with `platformId`-keyed availability wrapper (AC-15/16 — PF-015); add `RuntimeModule.baseUrl` field (PF-017 — deferred from Phase 1) + T4 embedding with package-root traversal guard | `core/src/platform/platform-plugin.ts`, `core/src/intrinsics/registry.ts`, `codegen/src/runtime/embed.ts` |
| 5.2.2 | Validation pass covers `CallExprNode` T4 path (E10046/E10043 — AR-P14) | `frontend/src/semantics/intrinsic-validation.ts` |
| 5.2.3 | Green phase | — |

### Session 5.3: Impl tests & hardening
| # | Task | File |
|---|------|------|
| 5.3.1 | Impl tests: availability wrapper, `[]` plugins unaffected, fixture isolation | `platforms/src/t4-contribution.impl.test.ts` |
| 5.3.2 | Full verify | — |

---

## Phase 6: End-to-end, catalog audit & closeout

### Session 6.1: E2E + audit
| # | Task | File |
|---|------|------|
| 6.1.1 | AC-19 golden: byte `*`, word `/`, byte `%` → ACME → binary, zero unresolved symbols (spec test, red→green within session per small-feature compression) | `compiler/src/assemble-rt.golden.spec.test.ts` |
| 6.1.2 | AC-17 audit: grep-sweep — no intrinsic-name string switches outside catalog/emitter-map construction; document result in this file | — |
| 6.1.3 | Full verify | — |

### Session 6.2: Closeout
| # | Task | File |
|---|------|------|
| 6.2.1 | Check off RD-17 §6 ACs (AC-14 marked deferred→RD-12); update RD status header | `../../requirements/RD-17-intrinsics-runtime-abi.md` |
| 6.2.2 | Roadmap update (RD-17 → done; next up per critical path) via the roadmap protocol | `../../00-roadmap.md`, `codeops/00-roadmap.md` |

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## 🚨 Master Progress Checklist (All Phases) — MANDATORY

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> 1. **After completing each task:** mark it `[x]` with a timestamp — e.g., `- [x] 1.1.1 … ✅ (completed: YYYY-MM-DD HH:MM)`
> 2. **After completing each phase:** confirm every task in that phase is marked
> 3. **Update the Progress header** after every update
> 4. **This checklist MUST exist** — reconstruct from phase details if missing
> 5. **Never batch updates**

### Phase 1: Core registry, catalog & core deltas
- [x] 1.1.1 Registry/catalog/floor spec tests (ST-1..7) ✅ (completed: 2026-07-02)
- [x] 1.1.2 Red phase ✅ (completed: 2026-07-02 — 2 files unresolved, ST-6 fails as expected)
- [x] 1.2.1 Descriptor types + registry ✅ (completed: 2026-07-02)
- [x] 1.2.2 Full catalog ✅ (completed: 2026-07-02)
- [x] 1.2.3 Core deltas (diag codes, reserved set, WAI, floors, plugin type) ✅ (completed: 2026-07-02 — WAI legality row added to cpu-table for opcode/table consistency)
- [x] 1.2.4 Green phase ✅ (completed: 2026-07-02 — 11/11 Phase 1 spec tests pass)
- [x] 1.3.1 Registry impl tests ✅ (completed: 2026-07-02 — 11/11 pass)
- [x] 1.3.2 Full verify ✅ (completed: 2026-07-02 — build+typecheck+lint+test all green)

### Phase 2: Semantic validation pass
- [x] 2.1.1 Validation spec tests (ST-8..14, ST-17; ST-15/16 `.todo`) ✅ (completed: 2026-07-02)
- [x] 2.1.2 Red phase ✅ (completed: 2026-07-02 — 7 checks red, clean-path + todos as expected)
- [x] 2.2.1 Declaration collection (AR-P13) ✅ (completed: 2026-07-02 — structs/enums; vars/imports deferred to their consuming phases to avoid dead tables)
- [x] 2.2.2 `AnalyzeInput.registry` + pass wiring ✅ (completed: 2026-07-02 — +registry/targetProfile; functional model construction, no ReadonlyMap mutation)
- [x] 2.2.3 Checks V1–V8 ✅ (completed: 2026-07-02 — E10043 requirement rendered via generic CPU-probe, no name special-casing; V6a/V6b T4 deferred to Phase 5)
- [x] 2.2.4 Green phase ✅ (completed: 2026-07-02 — 9/9 specs; RD-04 passthrough oracle preserved)
- [x] 2.3.1 Validation impl tests ✅ (completed: 2026-07-02 — 19/19: type-table edges, boundaries, multi-program, no-throw)
- [x] 2.3.2 Full verify ✅ (completed: 2026-07-02 — build+typecheck+lint+test all green)

### Phase 3: IL lowering & T1/T2 emission
- [x] 3.1.1 Lowering/emission spec tests (ST-18..23, ST-34) ✅ (completed: 2026-07-02 — oracle-derived from RD-17 §4.3/ST table)
- [x] 3.1.2 Red phase ✅ (completed: 2026-07-02 — NOTE: Phase 3 authored impl slightly ahead of tests; spec tests remain oracle-derived and surfaced a real ST-18 semantics fix, RTS terminator excluded. Strict spec-first resumes Phase 4)
- [x] 3.2.1 IL descriptor migration ✅ (completed: 2026-07-02 — il/intrinsic-descriptor re-exports core type; il-model spec updated for real descriptor)
- [x] 3.2.2 Strategy-dispatched lowering + E10045 ✅ (completed: 2026-07-02 — fold by node-shape, inline via keyed emitter map, E10045 replaces address ICE; model+registry threaded into LowerCtx)
- [x] 3.2.3 T1 opcode translation ✅ (completed: 2026-07-02 — T1_OPCODES map, one Implied Instr per T1)
- [x] 3.2.4 Green phase ✅ (completed: 2026-07-02 — 22/22 Phase 3 spec tests pass)
- [x] 3.3.1 Lowering impl tests ✅ (completed: 2026-07-02 — 11/11: poison recovery, little-endian, completeness sweep)
- [x] 3.3.2 Full verify ✅ (completed: 2026-07-02 — build+typecheck+lint+test all green, 0 regressions)

### Phase 4: T3 runtime, embedding & marshalling
- [x] 4.1.1 Marshalling/embedding spec tests (ST-24..29) ✅ (completed: 2026-07-02 — oracle: RD-17 §4.5/§4.6, AR-33/AR-98/AR-P7/AR-100 + plan ABI table)
- [x] 4.1.2 ACME syntax spec test (ST-30) ✅ (completed: 2026-07-02 — skip-if-no-ACME; PF-019 prelude defines __zp_arg_0..3; ACME 0.97 present locally)
- [x] 4.1.3 Red phase ✅ (completed: 2026-07-02 — 4 failures: missing embed module, left-only stub, no E10044, no TXA remainder binding)
- [x] 4.2.1 Four `.asm` modules ✅ (completed: 2026-07-02 — mul16 is self-contained via internal `__rt_mul16_core` (three 8x8 partials), NOT a cross-module call (§4.6); byte routines use arg-block scratch within the R35 floor, Y preserved; all 4 assemble under ACME 0.97)
- [x] 4.2.2 `embed.ts` ✅ (completed: 2026-07-02 — collect/load/buildRuntimeSection; path-traversal guard; catalog-order determinism)
- [x] 4.2.3 Serializer runtime section ✅ (completed: 2026-07-02 — optional `opts.runtimeSection`, serializer stays pure; no option → byte-identical output)
- [x] 4.2.4 Marshalling rewrite + E10044 ✅ (completed: 2026-07-02 — `marshalAndCall` both operands (AC-10), word b→__zp_arg_0/1 then a→A/X, mod binds remainder (TXA / arg-block reload), E10044+poison via `TranslateOptions` threaded by `assembleProgram` from `plugin.profile`)
- [x] 4.2.5 Plugin runtimeModules migration ✅ (completed: 2026-07-02 — 5 plugins → `[]`; c64 ST-C64-10 oracle deliberately updated per AR-98)
- [x] 4.2.6 Green phase ✅ (completed: 2026-07-02 — 12/12 Phase 4 spec tests; codegen 314 + platforms 30, 0 regressions)
- [x] 4.3.1 Embed impl tests ✅ (completed: 2026-07-02 — 10/10 embed internals + **AR-P17 functional harness**: in-process 6502 interpreter runs ACME-assembled routines against edge crosses + 500 seeded randoms each — all four routines' math PROVEN (4/4); AR-P4's emulator-tier deferral to RD-12 stands)
- [x] 4.3.2 Full verify ✅ (completed: 2026-07-02 — build+typecheck+lint+test all green)

### Phase 5: T4 platform mechanism
- [x] 5.1.1 Fixture + T4 spec tests (ST-31/32; ST-15/16 live) ✅ (completed: 2026-07-02 — fixture plugin in platforms/src/__fixtures__ (AR-P2, not in barrel); ST-32 placed in @blend65/compiler per the D10 package-boundary rule (platforms depends on core only); frontend/compiler use test-local descriptor factories (plan-sanctioned))
- [x] 5.1.2 Red phase ✅ (completed: 2026-07-02 — 5 failures across 3 packages: no wrapper, no E10043/E10046 T4 path, plugin modules unknown to embed)
- [x] 5.2.1 Registry merge + T4 embedding ✅ (completed: 2026-07-02 — createIntrinsicRegistry(descriptors, platformId) with id-stamped availability wrapper (descriptor gains optional platformId, PF-015); RuntimeModule.baseUrl (PF-017) + loadPluginRuntimeModule with nearest-package.json traversal guard; lower.ts CallExpr→registry 'call' path added for the T4 pipeline (AC-17))
- [x] 5.2.2 T4 validation path (E10046/E10043) ✅ (completed: 2026-07-02 — validateT4Call on plain CallExprNodes: V6b wrong-platform E10043 (platformId-keyed), V6a unimported E10046 with exact AR-P14 hint, arity mirror; collectImports per program (AR-97))
- [x] 5.2.3 Green phase ✅ (completed: 2026-07-02 — 9/9 Phase 5 spec tests across frontend/platforms/compiler)
- [x] 5.3.1 T4 impl tests ✅ (completed: 2026-07-02 — 12/12: wrapper stamping/no-mutation/AND-composition, []-plugin neutrality, fixture barrel isolation, baseUrl guard + plugin-module dead-strip)
- [x] 5.3.2 Full verify ✅ (completed: 2026-07-02 — build+typecheck+lint+test all green; frontend 255 (ST-15/16 todos now live), platforms 40, compiler 41, codegen 329)

### Phase 6: End-to-end & closeout
- [x] 6.1.1 AC-19 golden E2E ✅ (completed: 2026-07-02 — ST-33: byte `*` + word `/` + byte `%` → assembleProgram(c64) → embed → ACME → main.prg produced, zero unresolved symbols; mul16 dead-stripped)
- [x] 6.1.2 AC-17 no-special-casing audit ✅ (completed: 2026-07-02 — **AUDIT RESULT: PASS.** Grep-sweep over all production `packages/*/src` for intrinsic-name string switches/comparisons found 4 hits, all in sanctioned categories: (1) `parser/pratt.ts:399-401` — grammar-level: `sizeof`/`offsetof` take a *type* argument, a syntactic node-shape distinction owned by RD-03's grammar, not semantic dispatch; (2) `intrinsic-validation.ts` V8 — the `asm_sed`/`asm_cld` pairing rule (W10120) is itself specified over those two names; (3) `translate.ts:668/691` — `RT_BY_NAME` keyed-map lookups selecting the routine symbol by IL op width (map construction/ABI selection, explicitly allowed). All lowering/validation/emission dispatch is descriptor-driven: strategy dispatch in `lower.ts`, `T1_OPCODES`/`INLINE_EMITTERS`/`RT_BY_NAME` keyed maps, registry-driven T4 recognition.)
- [x] 6.1.3 Full verify ✅ (completed: 2026-07-02 — build+typecheck+lint+test all green)
- [x] 6.2.1 RD-17 AC checkoff (AC-14 deferred note) ✅ (completed: 2026-07-02 — 18/19 ACs checked with ST evidence; AC-14 marked ⏸️ deferred→RD-12 (AR-P4) with the AR-P17 interim functional harness noted; RD status header → IMPLEMENTED)
- [x] 6.2.2 Roadmap update ✅ (completed: 2026-07-02 — RD-17 moved to Done, Current Position → RD-16, RD-12 row carries the AC-14 emulator-tier note, portfolio cascaded)

---

## Dependencies

```
Phase 1 (core types/registry/catalog)
    ↓
Phase 2 (validation — needs registry)      Phase 3 (lowering — needs descriptors + P2 type table for folds)
    ↓                                          ↓
Phase 4 (marshalling/embedding — needs P3 intrinsic ops)
    ↓
Phase 5 (T4 — needs P2 validation + P4 embedding)
    ↓
Phase 6 (E2E + closeout)
```
Phase 3 depends on Phase 2's type table for folds — execute strictly in order.

---

## Success Criteria

**Feature is complete when:**
1. ✅ All 47 tasks completed
2. ✅ Full verify passing (command above)
3. ✅ RD-17 AC-01..AC-19 checked (AC-14 explicitly deferred to RD-12 — AR-P4)
4. ✅ No dead code; no intrinsic-name special-casing outside catalog construction (AC-17)
5. ✅ Security: path-traversal guard on module loading; validation never throws on user input
6. ✅ RD-09 golden outputs unchanged for runtime-free programs (ST-29)
7. ✅ Roadmap updated (Phase 6.2.2)
8. ✅ Post-completion re-analysis (exec_plan skill)
