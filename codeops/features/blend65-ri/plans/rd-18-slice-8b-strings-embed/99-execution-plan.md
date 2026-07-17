# Execution Plan: RD-18 Slice 8b — Strings & Embed

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-17 16:12
> **Progress**: 0/58 tasks (0%)
> **CodeOps Skills Version**: 3.8.0

## Overview

Six phases: encoding foundation → char literals → string initializers → embed() → acceptance
tier → rollout closure. Each feature phase follows the spec-first ordering (spec tests → red →
implement → green → impl tests → full verify). Designs live in the 03-docs; oracles in
`07-testing-strategy.md`; decisions in `00-ambiguity-register.md`.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Encoding foundation (core encoders, decoder, seam) | 12 |
| 2 | Char literals (universal desugar) | 8 |
| 3 | String initializers (desugar + diagnostics + retirements) | 11 |
| 4 | embed() end-to-end | 12 |
| 5 | Acceptance tier (fixture, negatives, golden, VICE) | 9 |
| 6 | Rollout closure (RD-18 items 8–9) | 6 |

**Total: 58 tasks across 6 phases**

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes below are the **single source of truth** for progress. Every task line
> appears exactly once. The executing agent MUST:
>
> 1. **On implementation:** mark the task `[~]` — `- [~] … ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** promote to `[x]` — `- [x] … ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header and Last Updated stamp after EVERY task** — never batch.
>    Only `[x]` counts as complete.
> 4. **Resume** top-to-bottom: first `[~]`, else first `[ ]`.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'` — never invented.

> **House rules (bind every task):** the Documentation ban (no plan/RD/AR/ST ids or codeops
> paths in shipped code/comments — self-check grep before every `[x]`); the immutable-oracle
> rule; the retired-row protocol for the two pins; `spec/` stays untouched (D3); prior-goldens
> byte-exact at every phase boundary.

---

## Phase 1: Encoding foundation

### Step 1.1: Specification tests (encoders + decoder + seam)

**Reference**: 03-01 · AR-2/3/5/6/7 · ST-1..9
**Objective**: The byte-level oracle exists before any encoder code.

- [ ] 1.1.1 Write `encoding.spec.test.ts` (ST-1..4, ST-8) — `packages/core/src/platform/`
- [ ] 1.1.2 Write `literal-decode.spec.test.ts` (ST-5..7) — `packages/core/src/text/`
- [ ] 1.1.3 Write `encoding-seam.spec.test.ts` (ST-9) — `packages/frontend/src/semantics/`
- [ ] 1.1.4 Run the three suites — verify they FAIL (red phase; modules don't exist)

### Step 1.2: Implementation

**Reference**: 03-01 §Implementation
**Objective**: Encoders + decoder in core; seam threaded; wrong stubs fixed.

- [ ] 1.2.1 Implement `CharEncoder` + `encoderFor` + the three encoders + raw default — `packages/core/src/platform/encoding.ts` (+ barrel export)
- [ ] 1.2.2 Implement `decodeLiteral` (segment model, code-point iteration) — `packages/core/src/text/literal-decode.ts`
- [ ] 1.2.3 Mint `UnencodableCharacter: "E10127"` (additive) — `packages/core/src/diagnostics/diagnostic-codes.ts`
- [ ] 1.2.4 Repoint platform hooks to core encoders (petscii delegation keeps `shared-hooks` API; a800xl/a7800 → atascii/ascii) — `packages/platforms/src/{shared-hooks,a800xl,a7800}.ts`
- [ ] 1.2.5 Thread `AnalyzeInput.encoder?` + derive from `targetProfile.defaultEncoding`; encoder onto `ConstTypeEngine` construction — `packages/frontend/src/semantics/{analyze.ts,const-type-engine.ts,passes.ts}`
- [ ] 1.2.6 Run the Step-1.1 suites — verify GREEN (fix implementation, never tests)

### Step 1.3: Impl tests & hardening

- [ ] 1.3.1 Write `encoding.impl.test.ts` (tail narrowing, boundary cps) — `packages/core/src/platform/`
- [ ] 1.3.2 Full verify + platform-suite regression (hook delegation) + prior-goldens check

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 2: Char literals

### Step 2.1: Specification tests

**Reference**: 03-02 §Char · AR-9 · ST-10..14

- [ ] 2.1.1 Write `char-literals.spec.test.ts` (ST-10..14) — `packages/frontend/src/semantics/type-check/`
- [ ] 2.1.2 Run — verify FAIL (red; today chars silently poison / E10193)

### Step 2.2: Implementation

- [ ] 2.2.1 Implement the universal `CharLitExpr` → synthetic `NumericLitExpr` desugar (choke point + splice sites per 03-02) — `packages/frontend/src/semantics/type-check/expression-typing.ts` (+ statement-typing splice sites)
- [ ] 2.2.2 Const-engine fold path proves out (case labels, const decls) — no new arm expected; fix per 03-02 if the engine sees a raw `CharLitExpr`
- [ ] 2.2.3 E10127 emit site at the literal span (unmappable) — same files
- [ ] 2.2.4 Run Step-2.1 suite — verify GREEN

### Step 2.3: Impl tests & hardening

- [ ] 2.3.1 Extend `literal-desugar.impl.test.ts` (char half: spans, typeMap, splice-once) — `packages/frontend/src/semantics/type-check/`
- [ ] 2.3.2 Full verify + prior-goldens check

**Verify**: (same command)

---

## Phase 3: String initializers

### Step 3.1: Specification tests (incl. the two retirement rewrites)

**Reference**: 03-02 §String · AR-8 · ST-15..24
**Objective**: All init forms + diagnostics pinned; retired rows rewritten to success FIRST.

- [ ] 3.1.1 Write `string-init.spec.test.ts` (ST-15..22, ST-24) — `packages/frontend/src/semantics/type-check/`
- [ ] 3.1.2 Rewrite the shipped E90001 string-init expectations to the new oracles (retired-row protocol; locate via `rejectStringArrayInit` references) — frontend spec suites
- [ ] 3.1.3 Rewrite the 8a zeropage-string pins (frontend + test-harness twins) to ST-23 success
- [ ] 3.1.4 Run — verify FAIL (red: E90001 still fires; bracketed form poisons)

### Step 3.2: Implementation

- [ ] 3.2.1 Mint `MixedStringValueInit: "E10116"` + `StringExceedsArraySize: "E10124"` (additive, Ch 08 wording) — `packages/core/src/diagnostics/diagnostic-codes.ts`
- [ ] 3.2.2 Implement the declaration-site desugar (bare + bracketed + fill forms, E10124 pre-splice, E10116 arms) replacing `rejectStringArrayInit`; delete the dead helper — `packages/frontend/src/semantics/type-check/statement-typing.ts`
- [ ] 3.2.3 E10080 arm for `StringLitExpr` in general expression positions — `packages/frontend/src/semantics/type-check/expression-typing.ts`
- [ ] 3.2.4 Zeropage-field parity (same desugar path; 8a field-initialiser context) — verify via ST-23, adjust `typeZeropageField` only if needed
- [ ] 3.2.5 Run Step-3.1 suites — verify GREEN (incl. both retirements)

### Step 3.3: Impl tests & hardening

- [ ] 3.3.1 Complete `literal-desugar.impl.test.ts` (string half: four consumers on synthetics — coverage/W10140, image bytes, initCode lowering, local frame stores) — same dir
- [ ] 3.3.2 Full verify + prior-goldens check

**Verify**: (same command)

---

## Phase 4: embed() end-to-end

### Step 4.1: Specification tests

**Reference**: 03-03 · AR-10/11/12/13 · ST-25..35

- [ ] 4.1.1 Write `embed.spec.test.ts` (ST-25..32, ST-34, ST-35; temp-dir fixtures incl. the traversal/absolute/oversize probes) — `packages/frontend/src/semantics/`
- [ ] 4.1.2 Write `lower-embed.spec.test.ts` (ST-33) — `packages/codegen/src/il/`
- [ ] 4.1.3 Run — verify FAIL (red; embed poisons silently today)

### Step 4.2: Implementation

- [ ] 4.2.1 Define `AssetReader` + `AssetReadResult` (Uint8Array contract) — `packages/core/src/host/asset-reader.ts` (+ barrel)
- [ ] 4.2.2 Mint `EmbedPathEscapesRoot: "E10205"` (additive) — `packages/core/src/diagnostics/diagnostic-codes.ts`
- [ ] 4.2.3 Implement the disk reader (resolve, containment, stat-cap, invalid-path policy per 03-03) + wire into `analyze()` input — `packages/compiler/src/api/` (`asset-reader.ts` + `run-frontend.ts`)
- [ ] 4.2.4 Implement embed declaration typing (EMB-1..4 legality, E10200/01/02/05 + format E90001, size inference, constValues bytes + `source:"embed"`, `embeddedAssets` map, absent-reader poison) — `packages/frontend/src/semantics/type-check/statement-typing.ts` (+ `semantic-model.ts` for the map/provenance types)
- [ ] 4.2.5 Provenance passthrough to `ConstDataEntry.type:"embed"` — `packages/codegen/src/il/lower.ts` (+ stale cfg.ts comment refresh)
- [ ] 4.2.6 Run Step-4.1 suites — verify GREEN

### Step 4.3: Impl tests & hardening

- [ ] 4.3.1 Write `asset-reader.impl.test.ts` (byte identity ≥`$80`, stat-cap ordering, containment prefix) — `packages/compiler/src/api/`
- [ ] 4.3.2 Write `embed.impl.test.ts` (provenance, inference parity) — `packages/frontend/src/semantics/`
- [ ] 4.3.3 Full verify + prior-goldens check

**Verify**: (same command)

---

## Phase 5: Acceptance tier

### Step 5.1: Fixture + suites (spec-first: assertions before the golden exists)

**Reference**: 03-04 · AR-14 · ST-36..40

- [ ] 5.1.1 Create `examples/slice8b/main.blend` + committed `table.bin` (verbatim per 03-04); harness `slice8b.ts` (`SLICE8B_MAIN_SRC`, `buildSlice8b` with ABSOLUTE outDir, asset staging)
- [ ] 5.1.2 Write `slice8b.spec.test.ts` (ST-36 assemble-clean + ST-37 VICE observables) — `packages/test-harness/src/`
- [ ] 5.1.3 Write `slice8b-negatives.spec.test.ts` (ST-40, one per code) — `packages/test-harness/src/`
- [ ] 5.1.4 Write `golden-slice8b.spec.test.ts` (ST-38 landmarks + ST-39 prior-goldens sweep) — `packages/test-harness/src/`
- [ ] 5.1.5 Run assemble/negatives/golden suites — confirm expected red (no golden yet) and assemble-clean status

### Step 5.2: Bar

- [ ] 5.2.1 Fix any assemble/negative failures; mint `test/golden/slice8b.asm.golden` once ASM is correct-by-inspection against 03-04 landmarks
- [ ] 5.2.2 Run the VICE runtime suite on real VICE 3.10 — ST-37 observables GREEN (local tier)
- [ ] 5.2.3 Verify the eleven prior goldens byte-exact (ST-39) + CI-tier suites green
- [ ] 5.2.4 Full verify

**Verify**: (same command)

---

## Phase 6: Rollout closure

**Reference**: 03-05 · AR-15 (doc-only; runs after the bar is green)

- [ ] 6.1.1 Audit + tick RD-04 AC-02..AC-20 (tick-with-annotation where 03-05 names it) — `requirements/RD-04-semantic-analysis.md`
- [ ] 6.1.2 Audit + tick RD-06 AC-02 and RD-07 AC-07..AC-09 (annotations per 03-05) — `requirements/RD-{06,07}-*.md`
- [ ] 6.1.3 Retire the RD-04b phantom (three refs per 03-05) — same files
- [ ] 6.1.4 Tick RD-18 items 7 (traversal clause + AR-16 annotation), 8, 9 (security checklist per 03-05) — `requirements/RD-18-codegen-language-completion.md`
- [ ] 6.1.5 Mint `08-resource-report.md`; advance both roadmaps (RD-18 → ✅ Done, cascade) — this plan dir + `codeops/**/00-roadmap.md`
- [ ] 6.1.6 Final full verify + `git status --porcelain spec/` empty

**Verify**: (same command)

---

## Dependencies

```
Phase 1 (seam) → Phase 2 (chars) → Phase 3 (strings) → Phase 4 (embed) → Phase 5 (bar) → Phase 6 (closure)
```

Phase 2 needs 1's encoder-on-engine; 3 needs 2's char desugar (char fills); 4 is independent of
2–3 in code but ordered for golden stability; 5 needs all; 6 needs 5 green.

---

## Success Criteria

**Feature is complete when:**

1. ✅ All 58 tasks `[x]`; all six phases verified
2. ✅ The three-part bar green on `examples/slice8b/` (ST-36..38)
3. ✅ Eleven prior goldens byte-exact (ST-39); zero regressions
4. ✅ No dead code (`rejectStringArrayInit` deleted; no unused seams)
5. ✅ Security: E10205 traversal rejection + stat-cap proven by tests (RD-18 item 9)
6. ✅ RD-18 items 7–9 ticked; RD-04/06/07 ACs audited; roadmaps advanced (closure = RD-18 DONE)
7. ✅ `spec/` untouched throughout (D3)
8. ✅ Post-completion re-analysis offered (exec_plan skill)
