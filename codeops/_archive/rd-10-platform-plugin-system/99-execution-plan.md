# Execution Plan: RD-10 Platform Plugin System

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-06-09 23:17
> **Progress**: 19/19 tasks (100%) — COMPLETE


> **CodeOps Version**: (unstamped — no `codeops-mcp` dependency in this repo; consistent with RD-01..RD-07b)
> **Commit mode**: `--no-commit` (D5)

## Overview

Implements the RD-10 platform plugin slice (D1): the canonical profile/plugin types + the
relocated Instr/stream model in `@blend65/core` (D2/D6/D7), the full `c64` plugin with codegen
hooks (golden-tested via `printInstr`), and the registry + the four remaining platform profiles.
Spec-tests-first throughout. No git operations (D5) — the user commits.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
| ----- | ----- | -------- | --------- |
| 1 | Core types + Instr/stream model relocation | 1–2 | 90–120 min |
| 2 | C64 plugin + codegen hooks (golden-tested) | 1–2 | 90–120 min |
| 3 | Registry + built-in profiles + closeout | 1 | 60–90 min |

**Total: 3–5 sessions, ~4–6 hours**

---

## Phase 1: Core types + model relocation

> **Reference**: 03-01; decisions D2/D6/D7. Relocate the RD-07a pure-data model into core
> (value-preserving) and add the profile/plugin types behind the `@blend65/core/platform` subpath.

### Session 1.1: Model relocation (D7) — value-preserving

| # | Task | File |
|---|------|------|
| 1.1.1 | Move pure-data model (`Opcode`, `AddressingMode`, `InstrOperand` +ctors/guards, `AcmeDirective`, `StreamEntry`, `InstrStream` +ctors/guards, `CpuVariant`) into `@blend65/core` **`core/src/instr-model/`** (dedicated dir; re-exported through the `@blend65/core/platform` subpath — D8) | `packages/core/src/instr-model/*` |

| 1.1.2 | Re-export the moved model from `@blend65/codegen` `instr/` barrel (and `stream.ts`) so all RD-07a/07b import paths resolve unchanged | `packages/codegen/src/instr/*` |
| 1.1.3 | Run existing codegen `instr` spec/impl tests unchanged — verify GREEN (ST-RELOC1/2) | (existing tests) |

### Session 1.2: Profile + plugin types + subpath barrel

| # | Task | File |
|---|------|------|
| 1.2.1 | Write spec tests ST-CP1..CP7 (profile construct, `validateProfileFields`, CpuVariant union, subpath export) | `packages/core/src/platform/platform-profile.spec.test.ts` |
| 1.2.2 | Verify ST-CP1..CP7 FAIL (red phase) | — |
| 1.2.3 | Implement `cpu-variant.ts`, `platform-profile.ts`, `platform-plugin.ts`, `validate-profile.ts`, `platform/index.ts`; add `"./platform"` to `core/package.json` `exports` | `packages/core/src/platform/*`, `packages/core/package.json` |
| 1.2.4 | Verify ST-CP1..CP7 PASS (green); interim-profile tests + full verify GREEN | — |
| 1.2.5 | Write impl tests (multiple validation errors, `zpStart === zpEnd` boundary) | `packages/core/src/platform/validate-profile.impl.test.ts` |

**Verify**: `yarn turbo run build typecheck lint test` + `yarn vitest run test/`

---

## Phase 2: C64 plugin + codegen hooks

> **Reference**: 03-02; decision D3. Golden-tested via `printInstr`.

### Session 2.1: C64 plugin

| # | Task | File |
|---|------|------|
| 2.1.1 | Write spec tests ST-C64-1..10 (output directive, preamble/shim goldens, encode, termination, validate, profile fields, runtimeModules) — goldens derived from 03-02 + `printInstr` rules | `packages/platforms/src/c64.spec.test.ts` |
| 2.1.2 | Verify ST-C64-1..10 FAIL (red) | — |
| 2.1.3 | Implement `c64.ts`: profile data + `emitPreamble`/`emitStartupShim`/`getOutputDirective`/`encodeString`/`encodeChar`/`getMainTerminationPolicy`/`validateProfile` + `runtimeModules` metadata + `intrinsics: []` | `packages/platforms/src/c64.ts` |
| 2.1.4 | Verify ST-C64-1..10 PASS (green); full verify GREEN | — |
| 2.1.5 | Write impl tests (encode edge cases; shim `needsBssZero/needsDataInit`) | `packages/platforms/src/c64.impl.test.ts` |

> **If the `$01`-port symbolRef convention or the §4.5 BASIC-stub bytes prove undetermined during
> 2.1.3, STOP and register the next `D-N (runtime)` before proceeding (surface-during-authoring).**

---

## Phase 3: Registry + built-in profiles + closeout

> **Reference**: 03-03; decision D4.

### Session 3.1: Registry, profiles, closeout

| # | Task | File |
|---|------|------|
| 3.1.1 | Write spec tests ST-REG1..4 + ST-PROF1..6 | `packages/platforms/src/registry.spec.test.ts`, `profiles.spec.test.ts` |
| 3.1.2 | Verify red phase | — |
| 3.1.3 | Implement `c64u.ts`/`cx16.ts`/`a800xl.ts`/`a7800.ts` (profile + validate; hooks delegate to c64), transcribing each profile from its frozen appendix | `packages/platforms/src/{c64u,cx16,a800xl,a7800}.ts` |
| 3.1.4 | Implement `registry.ts` (`PLATFORM_REGISTRY`/`loadPlatform`/`DEFAULT_PLATFORM`) + rewrite `index.ts` exports | `packages/platforms/src/registry.ts`, `index.ts` |
| 3.1.5 | Verify ST-REG/ST-PROF PASS (green); full verify GREEN; R15 boundary tier green; `spec/` clean | — |
| 3.1.6 | Annotate `requirements/RD-10-platform-plugin-system.md` status banner (slice done; RD-17/15/16/09 carry remainder); tick achieved ACs | `requirements/RD-10-platform-plugin-system.md` |

**Verify**: `yarn turbo run build typecheck lint test` + `yarn vitest run test/`

---

## 🚨 Master Progress Checklist (All Phases) — MANDATORY

> **⚠️ EXECUTION RULE:** Mark each task `[x]` with a timestamp immediately on completion; update
> the Progress header; never batch. Reconstruct this list from the phase tables if missing.

### Phase 1: Core types + model relocation
- [x] 1.1.1 Move pure-data Instr/stream model into `@blend65/core` ✅ (completed: 2026-06-09 22:28) — `core/src/instr-model/` (D8)
- [x] 1.1.2 Re-export moved model from `@blend65/codegen` `instr/` barrel ✅ (completed: 2026-06-09 22:28) — path-preserving shims via `@blend65/core/platform`
- [x] 1.1.3 Existing codegen `instr` tests GREEN after move (ST-RELOC1/2) ✅ (completed: 2026-06-09 22:28) — core 140 + codegen 134 tests pass; build+typecheck green

- [x] 1.2.1 Write ST-CP1..CP7 spec tests ✅ (completed: 2026-06-09 22:30)
- [x] 1.2.2 Verify ST-CP1..CP7 RED ✅ (completed: 2026-06-09 22:30) — 5 fail (CP1/CP6 pass: type-only)
- [x] 1.2.3 Implement profile/plugin types + subpath barrel + `exports` ✅ (completed: 2026-06-09 22:31) — platform-profile/plugin/validate-profile.ts; `cpu-variant` reused from instr-model (D8)
- [x] 1.2.4 Verify ST-CP1..CP7 GREEN + interim tests green ✅ (completed: 2026-06-09 22:32) — 7/7 green; core+codegen build/typecheck/test pass
- [x] 1.2.5 Write Phase-1 impl tests ✅ (completed: 2026-06-09 22:32) — validate-profile.impl.test.ts (4 tests); core 151 tests, lint clean


### Phase 2: C64 plugin + hooks
- [x] 2.1.1 Write ST-C64-1..10 spec tests (goldens from spec + printInstr) ✅ (completed: 2026-06-09 23:05) — `c64.spec.test.ts` (11 cases); codegen added as devDependency + tsconfig ref (test-only `printInstr` import; R15 unaffected)
- [x] 2.1.2 Verify ST-C64-1..10 RED ✅ (completed: 2026-06-09 23:07) — suite fails to load (no `c64.js`)
- [x] 2.1.3 Implement `c64.ts` (profile + 6 hooks + metadata) ✅ (completed: 2026-06-09 23:07) — `$01` port via verbatim `symbolRef("$01")`; BASIC stub per §4.5 (no new ambiguity)
- [x] 2.1.4 Verify ST-C64-1..10 GREEN + full verify ✅ (completed: 2026-06-09 23:09) — 11/11 green; 40/40 turbo tasks; R15 3/3; spec/ clean
- [x] 2.1.5 Write C64 impl tests ✅ (completed: 2026-06-09 23:09) — `c64.impl.test.ts` (7 cases); vitest glob widened to `{spec,impl}`

### Phase 3: Registry + built-in profiles + closeout
- [x] 3.1.1 Write ST-REG1..4 + ST-PROF1..6 spec tests ✅ (completed: 2026-06-09 23:12) — `registry.spec.test.ts` (4) + `profiles.spec.test.ts` (6)
- [x] 3.1.2 Verify RED ✅ (completed: 2026-06-09 23:12) — both suites fail to load (no registry/profile modules)
- [x] 3.1.3 Implement c64u/cx16/a800xl/a7800 profiles (from appendices) ✅ (completed: 2026-06-09 23:15) — profiles transcribed from frozen §10 blocks; hooks delegate via `shared-hooks.ts` (D4); a7800 canReturn=false (AC-15)
- [x] 3.1.4 Implement registry/loader + index exports ✅ (completed: 2026-06-09 23:15) — `registry.ts` + rewritten `index.ts`; smoke test updated off removed `VERSION`
- [x] 3.1.5 Verify GREEN + R15 boundary + spec/ clean ✅ (completed: 2026-06-09 23:16) — platforms 30 tests; 40/40 turbo tasks; R15 3/3; spec/ clean
- [x] 3.1.6 Annotate RD-10 requirements status banner + tick ACs ✅ (completed: 2026-06-09 23:17) — status 🔵 Implemented (slice); AC-01..11/13/14/15/18/19/20 ticked; AC-12/16/17 deferred (RD-07/RD-17)

---

## Dependencies

```
Phase 1 (core types + model relocation)
    ↓
Phase 2 (c64 plugin — needs the relocated model + types)
    ↓
Phase 3 (registry + profiles — needs the c64 hooks to delegate to)
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed
2. ✅ All verification passing (`yarn turbo run build typecheck lint test` + root `vitest run test/`)
3. ✅ No warnings/errors
4. ✅ No dead code — no unused params/functions/modules (except spec'd hook signatures) (code.md r4)
5. ✅ No security regressions (N/A — pure compile-time data; no user-input paths)
6. ✅ The shipped codegen `instr` tests stay GREEN after the D7 relocation; interim-profile + RD-04/05 tests stay GREEN (D6); R15 boundary tier green; `spec/` clean
7. ✅ RD-10 requirements status banner annotated (slice done; deferred remainder noted)
8. ✅ **Post-completion:** Ask user to re-analyze project and update `.clinerules/project.md`

---

## Session Protocol

### Starting a Session
Reference this plan: "Implement Phase X, Session X.X per `plans/rd-10-platform-plugin-system/99-execution-plan.md`".

### Ending a Session
1. Run the verify command.
2. Commit mode is `--no-commit` (D5) — do NOT commit; note uncommitted changes in the summary.
3. `/compact`.
