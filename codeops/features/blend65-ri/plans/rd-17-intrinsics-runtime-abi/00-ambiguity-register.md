# Ambiguity Register: RD-17 — Intrinsic Functions & Runtime-Routine ABI

> **Status**: ✅ GATE PASSED — all 14 items resolved (AR-P14 surfaced during authoring)
> **Last Updated**: 2026-07-02
> **Feature**: blend65-ri · **Implements**: blend65-ri/RD-17

> **Pre-resolved context.** RD-level decisions were settled before this plan by:
> (a) the requirements-discovery register (`../../requirements/00-ambiguity-register.md`,
> AR-28..AR-36, AR-49), and (b) the RD-17 requirements preflight of 2026-07-02
> (`../../requirements/00-preflight-report.md`, PF-001..PF-013) which logged runtime
> entries **AR-97..AR-101** (T4 import form, fused div/mod ABI, asm_stp dropped,
> textual inlining, non-constant-address deferral). This register covers the
> **planning-level** decisions that remained. Items below are numbered **AR-P1..AR-P13**
> to avoid colliding with the global AR-NN sequence.
>
> All 13 recommendations were presented with alternatives and accepted by the user on
> 2026-07-02: *"if you think those are the best possible recommendations to go forward
> then i accept"* — recorded per item below after the agent confirmed convergence
> (hardening layers run; no reflexive changes).

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| AR-P1 | Scope | Full RD-17 in one plan, or slice? | Full / slice out T4 mechanism | **Full RD-17 in one plan** (T4 slice would fail AC-05/06/16) | ✅ Resolved |
| AR-P2 | Scope | Which concrete T4 intrinsics ship? | Fixture-only / one real T4 (e.g. petscii) | **Mechanism only, proven via a test-fixture plugin descriptor**; production plugins keep `intrinsics: []` (no T4 has designed semantics — language guard) | ✅ Resolved |
| AR-P3 | Integration | How does the registry thread without `compile()` (RD-15 pending)? | Parameter injection / module singleton | **`createIntrinsicRegistry(platformDescriptors?)` + core catalog in `@blend65/core`; `AnalyzeInput` gains optional `registry` field; codegen receives it via parameter injection.** No global singleton | ✅ Resolved |
| AR-P4 | Testability | How are `.asm` routine bodies verified without RD-12 emulators? | Assemble-level now + defer functional / mini-interpreter now | **Assemble-level tests now (output assembles, symbols resolve — AC-19); functional emulator verification of the math explicitly deferred to RD-12 (AC-14)**; algorithms from well-known 6502 references | ✅ Resolved |
| AR-P5 | Behavioral | Where does E10045 (non-constant address) fire? | Codegen IL lowering / frontend semantic pass | **Codegen IL lowering** — replace the ICE in `lower.ts` `addressLocation` with `bag.addError(E10045)` (const-foldability is decided there today) | ✅ Resolved |
| AR-P6 | Scope | Depth of intrinsic arg-TYPE checking (AC-02)? | Literal-args-only / full expression inference | **Arity, availability, shadowing, import-boundary checks complete; arg-type checks cover literal arguments (kind + range); non-literal args pass through** until the RD-04b type checker exists | ✅ Resolved |
| AR-P7 | Data & state | Word-operand marshalling + div16 remainder layout | A/X + ZP layout / alternatives (none viable) | **`mul16`/`div16`: `a`→A(lo)/X(hi), `b`→ZP arg bytes 0–1; `div16` remainder returned in ZP arg bytes 0–1 (overwrites `b`, dead after the divide)** — consistent with AR-33/AR-98 | ✅ Resolved |
| AR-P8 | Naming | New file/module locations + diag constant names | (single coherent proposal) | **core `src/intrinsics/{descriptor,registry,catalog}.ts`; codegen `runtime/*.asm` at package root (read via `import.meta.url`); codegen `src/runtime/embed.ts`; diag names `IntrinsicUnavailable` (E10043), `ZpArgBlockExceeded` (E10044), `NonConstantIntrinsicAddress` (E10045)** | ✅ Resolved |
| AR-P9 | Data & state | Duplicate descriptor registration behavior | Throw / last-wins | **`register()` throws a plain `Error`** (compiler-setup bug, not a user diagnostic; matches `loadPlatform()` precedent) | ✅ Resolved |
| AR-P10 | Integration | Interim `zpArgBlockMin` reconciliation (RD-17 R33) | Raise default 0→4 / retire the field now | **Raise `DEFAULT_PROFILE.zpArgBlockMin` from 0 to 4** (satisfies the R34 floor; retiring the field touches SFA plumbing beyond RD-17) | ✅ Resolved |
| AR-P11 | UX | Diagnostic message wording for the new codes | (concrete formats proposed) | **E10043 `"'<name>' requires <requirement>, but the target is <actual>"`; E10044 `"runtime routine '<symbol>' needs <n> ZP argument bytes, but the '<platform>' profile provides <m>"`; E10045 `"'<name>' requires a compile-time-constant address in this version"`** | ✅ Resolved |
| AR-P12 | Scope | W10121 (`asm_brk` in release) needs a build mode that doesn't exist | W10120 now + defer W10121 to RD-16 / invent `buildMode` now | **Implement W10120 now; defer W10121 to RD-16** (debug/release is a configuration concept — RD-16 scope) | ✅ Resolved |
| AR-P13 | Technical | `sizeof`/`offsetof`/`length` folding needs type info the passthrough analyzer doesn't build | Minimal declaration-collection pass / primitives-only folding | **Minimal declaration-collection step (structs/enums → `StructType` with offsets/byteSize) reusing `core/semantics/type-utils`**, sufficient for folding. Flagged as the plan's riskiest area | ✅ Resolved |
| AR-P14 | Behavioral | Diagnostic code for the T4 import boundary (AC-05) vs wrong platform (AC-06) — surfaced during 03-02 authoring | A: E10043 for wrong-platform + new E10046 `IntrinsicNotImported` for unimported / B: E10043 for both | **Option A** — wrong-platform is availability (R25 keys the predicate on `platformId`) → E10043; unimported-but-right-platform → **E10046 `IntrinsicNotImported`**, message `"'<name>' requires 'import { <name> } from <platform>;'"` | ✅ Resolved |

### Resolution Notes

**AR-P1:** The RD was re-scoped by the 2026-07-02 preflight to include RD-04's deferred
intrinsic validation rules (PF-001); everything in it is interdependent
(registry ⇄ validation ⇄ lowering ⇄ routine bodies), so a further slice would leave
acceptance criteria unverifiable.

**AR-P2:** AC-05/AC-06/AC-16 are tested against a fixture plugin contributing a T4
descriptor (e.g. a `fix_probe` intrinsic) — the *mechanism* is production code, the
*content* is test-only. Real platform intrinsic libraries arrive with future platform
work once their semantics are designed (language guard: 23 rules).

**AR-P3:** Grounded in `packages/frontend/src/semantics/analyze.ts:35-42` — `AnalyzeInput`
is an extensible options object designed for exactly this kind of optional addition
(F1-Extensible). The R15 boundary (frontend imports core only) forces the core catalog
and registry to live in `@blend65/core`.

**AR-P4:** AC-14 ("hand-written `.asm` runtime modules pass emulator-tier tests") is
formally **deferred to RD-12** by this decision; the execution plan carries the deferral
note. AC-19 (assembles with no unresolved symbols) is verified in this plan via the
existing `compiler/src/assemble.golden.spec.test.ts` pattern.

**AR-P5:** `packages/codegen/src/il/lower.ts:295-300` (`addressLocation`) is today the
single point that requires a numeric literal and raises an ICE — the diagnostic replaces
it in place.

**AR-P7:** AR-33 caps register parameters at 3 scalar bytes; a word `a` consumes A/X and
no 4th register exists, so `b` must use the ZP arg-block. Reusing `b`'s slots for the
div16 remainder is safe because `b` is dead once the routine computes the remainder.

**AR-P13:** The semantic model types (`StructType` with `fields: Map<string,{type,offset}>`
and `byteSize`, `packages/core/src/semantics/type.ts:39-47`) and `type-utils` helpers
already exist and are tested; the missing piece is only the declaration-walk that
populates them. If this proves deeper than expected during execution, STOP and raise a
new AR-PN per the surface-during-authoring rule (runtime variant).
