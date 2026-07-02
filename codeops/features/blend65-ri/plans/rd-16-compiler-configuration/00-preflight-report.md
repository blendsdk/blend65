# Preflight Report: RD-16 Compiler Configuration — Implementation Plan

> **Status**: ✅ PREFLIGHT PASSED — all 8 findings resolved (fixes applied 2026-07-02)
> **Iteration**: 1 (first scan)
> **Artifact**: Implementation plan at `codeops/features/blend65-ri/plans/rd-16-compiler-configuration/`
> **Codebase Grounded**: 14 source files examined, 31 references verified (30 verified, 1 unverifiable — see PF-017)
> **Last Updated**: 2026-07-02
> **CodeOps Skills Version**: 3.1.0

> **Numbering note**: findings start at **PF-015** to avoid colliding with the RD-16
> *requirements* preflight (PF-001..PF-014, `requirements/00-preflight-report.md`), which the
> plan documents cite throughout. The two reports remain separate artifacts.

> ⚠️ **Same-agent note**: the plan was authored earlier today (2026-07-02), almost certainly
> by the same model family. This review ran in a fresh session/context, but shared-model
> blind spots remain possible. The jsonc-parser offset-unit claim (PF-017) could not be
> verified against the installed package (it is not installed yet) and is flagged as such.

## Codebase Context Summary

**Repository:** blend65 (TypeScript ESM/NodeNext monorepo, Yarn v1 workspaces + Turbo, Vitest)
**Architecture:** 10 `@blend65/*` packages; `config` is an RD-01 stub (`index.ts` exports `VERSION` only); diagnostics core (bag/codes/spans/LineMap) shipped in `@blend65/core`; platform registry shipped in `@blend65/platforms`.
**Key Files Examined:** `packages/core/src/diagnostics/{diagnostic-bag,diagnostic-codes,source-span,line-map,index}.ts`, `packages/config/src/index.ts` + `package.json` + smoke test, `packages/platforms/src/registry.ts`, `packages/{cli,compiler}/package.json`, `packages/compiler/src/runtime-asm.spec.test.ts`, `packages/frontend/src/semantics/analyze.ts`, `spec/09-enums.md`, `requirements/RD-16-compiler-configuration.md`, feature roadmap.

**Reference Verification (all confirmed unless noted):**
- Dedup key `(code, sourceId, start)` at `diagnostic-bag.ts:89-93`; null-span dedup marker `-1`; default cap 20 (`:75,104`); E10000 truncation sentinel (`diagnostic-codes.ts:27`) ✓
- `CONFIG_SOURCE_ID = -2` is safe: distinct from the `-1` null marker, sorts before all real sources in `getAll()` (`diagnostic-bag.ts:196-219`) ✓
- E10240–E10249 and W10240+ unclaimed in both `diagnostic-codes.ts` and `spec/` (grep clean); E10230–E10236 are frozen enum codes at `spec/09-enums.md` §7 exactly as AR-P3 states; E10035 RD-09 precedent comment ✓
- Every shipped W-code matches `/^W\d{5}$/` ✓
- `PLATFORM_REGISTRY` (c64, c64u, cx16, a800xl, a7800) + `DEFAULT_PLATFORM = "c64"` (`registry.ts:20-29`) ✓
- `@blend65/cli` and `@blend65/compiler` already declare the `@blend65/config` dep edge ✓
- Zero external runtime deps anywhere in the workspace; `jsonc-parser` absent from `yarn.lock` — "workspace's first external runtime dep" claim ✓
- `mkdtempSync` temp-dir precedent at `runtime-asm.spec.test.ts:37` ✓; context-object injection pattern at `analyze.ts:43-50` ✓
- `LineMap` (byte-offset → line/col, CRLF/CR/BOM-aware) shipped and exported from core (`line-map.ts:36`, `diagnostics/index.ts:14`) — relevant to PF-017/PF-018
- jsonc-parser offset units: **unverifiable** (package not installed) — see PF-017

## Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|------------------|
| 1 | Ambiguities | 0 | — |
| 2 | Implicit Assumptions | 2 (PF-017, PF-020) | 🟡 |
| 3 | Logical Contradictions | 1 (PF-021) | 🟡 |
| 4 | Completeness Gaps | 1 (PF-022) | 🔵 |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | 0 | — |
| 7 | Testability | 0 | — |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 1 (PF-019) | 🟡 |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 1 (PF-015) | 🟠 |
| 12 | Consistency | 1 (PF-016) | 🟡 |
| 13 | Codebase Alignment | 1 (PF-018; PF-017 counted under #2) | 🟡 |

## Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 0 | — |
| 🟠 MAJOR | 1 | all resolved |
| 🟡 MINOR | 6 | all resolved |
| 🔵 OBSERVATION | 1 | all resolved |

## Fixes Applied (2026-07-02, all recommendations accepted)

| PF | Fix applied |
|----|-------------|
| PF-015 | `07-testing-strategy.md`: ST-6..ST-9 split into explicit **parse-level / loader-level** expectation columns with a placement note; file-mapping rows updated. `99-execution-plan.md` task 2.1.2 rescoped to the parse-level column only (no E10241/E10242/`CONFIG_SOURCE_ID`/dedup assertions before Phase 4) |
| PF-016 | `01-requirements.md` AC list renumbered to the actual ST table (AC-01→ST-6 … AC-12→ST-28; AC-13 note now cites task 4.3.2 + the impl-tier data-only assertion) |
| PF-017 | `03-01-config-loader.md`: `parseJsoncFile` converts jsonc-parser's UTF-16 code-unit offsets to UTF-8 byte offsets; `createOffsetConverter` added; `toByteOffset` in `ValidateContext` for node spans; Span-strategy table corrected; mislabels fixed here, in `00-ambiguity-register.md` AR-P1, and implicitly in F7. `99` task 1.2.1 checkpoint (b) verifies the unit claim against the installed package; non-ASCII impl-test row added to 07 |
| PF-018 | Newline-scan helper removed from the design — line/col for F9 messages via core's `LineMap` (`03-01` §Span strategy, `99` tasks 2.2.2/2.3.2, 07 impl rows) |
| PF-019 | Synthetic spans moved to a negative coordinate space with per-entry stride: `start = -(2 + ordinal*64 + entryIndex)`, `SYNTHETIC_SPAN_STRIDE` documented in `types.ts` (`03-01` §Span strategy; 07/99 impl-test rows updated) |
| PF-020 | `hasErrors` switched to local emission tracking in `loadConfig` (`03-01` algorithm step 6, `99` task 4.2.1); at-cap pre-populated-bag case added to the impl-test matrix (07, `99` task 4.3.1) |
| PF-021 | `JsoncParseResult` gains `tree`; `mergeConfig` gains the `origin: { configPath, projectRoot }` parameter; algorithm step 4 updated (`03-01`) |
| PF-022 | Register addendum **AR-P9**: post-error values stay as-merged, `platform` = `""` when unset, consumers gate on `hasErrors` (`00-ambiguity-register.md`; noted in `03-01` §Error Handling, 00-index Key Decisions, 07/99 impl-test rows) |

---

### PF-015: Phase 2 parse spec tests assert loader-level behavior that doesn't exist until Phase 4 🟠 MAJOR

**Dimension:** Ordering & Sequencing (11)
**Location:** `99-execution-plan.md` task 2.1.2 (line 88) and green gate 2.2.3; `07-testing-strategy.md` ST-7..ST-9 rows (lines 40–42)
**Codebase Evidence:** `03-01-config-loader.md:117-121` — `parseJsoncFile(text): { value, parseErrors[] }` takes no `DiagnosticBag` and emits no diagnostics; E10241/E10242 emission with `CONFIG_SOURCE_ID` spans is `loadConfig` step 2 (`03-01:154-156`), implemented at task 4.2.1.
**The Problem:** Task 2.1.2 instructs writing `parse.spec.test.ts` asserting "ST-7 … E10241 span with CONFIG_SOURCE_ID; ST-8 two errors survive dedup; ST-9 non-object → E10242". None of that is observable from `parseJsoncFile` — it requires `loadConfig`, which arrives in Phase 4. Phase 2's green gate (2.2.3) is unreachable as written. The trap is armed by the immutable-oracle rule: an executor who doesn't stop has only destructive moves (weaken the spec tests, or leak a bag into `parseJsoncFile` against the 03-01 contract). Root cause: 07's file-mapping table splits ST-7..ST-9 into "(parse-level)" and "(loader-level)", but the ST rows themselves define only loader-level expectations — the parse-level variants are never defined.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Define parse-level ST variants in 07 (assert `parseJsoncFile` output only: recovered `value`, `parseErrors` count/offsets); rewrite task 2.1.2 to cite those; keep loader-level ST-7..ST-9 in Phase 4 (4.1.1 already covers them) | Preserves red→green per phase; no API change; matches 07's own split | Small doc edit in two files |
| B | Move all ST-7..ST-9 testing to Phase 4 and drop parse.spec.test.ts assertions beyond ST-6 | Simplest edit | Leaves `parseJsoncFile`'s error-reporting contract spec-untested until Phase 4; weakens Phase 2's red/green cycle |

**Recommendation:** Option A — it is what the 07 mapping table already implies; concretely: ST-7p (recovered value + ≥1 `parseErrors` entry with an in-file offset), ST-8p (two `parseErrors`, distinct offsets), ST-9p (value is array/string — E10242 classification stays loader-level), and task 2.1.2 reworded to drop all `E10241`/`E10242`/`CONFIG_SOURCE_ID`/dedup language.
**Confidence:** High. **Hardening:** independent challenger (blind) verified the defect, independently rated it MAJOR, and supplied the parse-level variant scheme adopted in Option A.

**User Decision:** Resolved — user accepted the recommendation ("fix all per your recommendations", 2026-07-02); fix applied, see §Fixes Applied.

---

### PF-016: AC→ST cross-references in 01-requirements.md are systematically stale 🟡 MINOR

**Dimension:** Consistency (12)
**Location:** `01-requirements.md` Acceptance Criteria list (lines 115–128)
**Codebase Evidence:** `07-testing-strategy.md` ST table (the in-repo source of truth for ST numbering).
**The Problem:** Most AC citations are shifted +1/+2 against the actual ST table (STs were evidently renumbered after the AC list was written). Examples: AC-01 cites ST-5 (a discovery test) but JSONC-comments is ST-6; AC-05 cites ST-8/ST-9 (parse errors) but unknown-key tests are ST-10/ST-11; AC-12 cites ST-25 (a merge test) but the minimal E2E is ST-28; AC-13's "(… + ST-29 note)" is stale — ST-29 is the pre-populated-bag test. Implementation is unaffected (spec-test tasks reference 07), but closeout task 4.3.4 walks this AC list "ticking each with its evidencing ST" — stale pointers corrupt the traceability audit that AC-14 itself demands.

**Options:** Single viable resolution — renumber the citations to match 07: AC-01→ST-6; AC-04→ST-10..ST-17; AC-05→ST-10/ST-11; AC-06→ST-12; AC-07→ST-18/ST-19; AC-08→ST-25..ST-27; AC-09→ST-13, ST-20, ST-21, ST-24; AC-10→ST-21/ST-22; AC-11→ST-28..ST-31; AC-12→ST-28; AC-13→"task 4.3.2 audit + impl-tier data-only assertion (07 §Security)". (Considered and dropped: renumbering the ST table to match the AC list — it would ripple through 07 and 99, which are internally consistent.)

**Recommendation:** Apply the renumbering above before execution.
**Confidence:** High (every mapping re-derived from both documents). **Hardening:** challenger independently confirmed the drift, produced the same corrected mapping, and argued severity down from MAJOR to MINOR (implementation path unaffected; exposure confined to the 4.3.4 audit) — accepted.

**User Decision:** Resolved — user accepted the recommendation ("fix all per your recommendations", 2026-07-02); fix applied, see §Fixes Applied.

---

### PF-017: jsonc-parser offsets are UTF-16 code units; SourceSpan documents UTF-8 bytes 🟡 MINOR

**Dimension:** Implicit Assumptions (2) / Codebase Alignment (13 — Stale Assumptions)
**Location:** `03-01-config-loader.md` §Span strategy (line 176: "span `{sourceId, offset, offset+length}` from `jsonc-parser`"; line 177: node offsets); mislabels at `03-01:116-117` ("Parse errors with byte offsets"), `00-ambiguity-register.md:32-33` ("per-node byte offsets"), `01-requirements.md` F7 ("byte offsets")
**Codebase Evidence:** `source-span.ts:30-37` — `start`/`end` are documented UTF-8 byte offsets; `line-map.ts` interprets span offsets as bytes. Precedent: the lexer dodges this exact issue only because Blend65 source is ASCII-restricted (`lexer.ts:76-77`, AR-72) — `blend65.json` has no such restriction (JSONC comments invite prose). **Unverified:** jsonc-parser is not installed; the code-unit claim rests on API knowledge (it is VS Code's UTF-16-native JSONC scanner over a JS string).
**The Problem:** Storing parser offsets verbatim silently violates the core span contract for configs with non-ASCII content. Near-term output stays self-consistent (the plan's message line/col uses the same units), but the divergence goes live on the RD-11b renderer and especially the RD-14 LSP path, where a caller supplies a real `sourceId` and a `LineMap` computes wrong positions. A greenfield conversion now costs a few lines; a cross-module retrofit later poisons every span consumer.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Convert code-unit→byte offsets in `parse.ts` at span creation, applied at BOTH producing sites (parse-error spans and parse-tree node spans in `validate.ts`); ASCII fast path (`!/[^\x00-\x7F]/.test(text)` → no conversion); fix the three "byte offsets" mislabels; add an impl-test row (non-ASCII comment before an error → byte-correct span); confirm the unit claim against the installed package at the 1.2.1 checkpoint | Upholds the core contract; cheap now; testable | A few lines + doc edits |
| B | Document config spans as UTF-16 deviation | No code | Per-producer unit checks forever in RD-11b/RD-14; contract erosion in a shared core type |

**Recommendation:** Option A — convert, don't document.
**Confidence:** Medium-high (unit claim unverified against the installed package — flagged; verification folded into task 1.2.1). **Hardening:** challenger independently confirmed, rated MINOR-but-fix-now (accepted over my initial MAJOR: near-term output is self-consistent, trigger is narrow and latent), and extended the fix to the validate.ts node-span site.

**User Decision:** Resolved — user accepted the recommendation ("fix all per your recommendations", 2026-07-02); fix applied, see §Fixes Applied.

---

### PF-018: Planned newline-scan line/col helper duplicates core's shipped LineMap 🟡 MINOR

**Dimension:** Codebase Alignment (13 — Redundancy)
**Location:** `03-01-config-loader.md` §Span strategy (line 183: "line/col computed from the offset by a small newline-scan helper in parse.ts"); `99-execution-plan.md` task 2.2.2; `07-testing-strategy.md` parse.impl.test.ts row ("line/col math at offsets 0/EOF")
**Codebase Evidence:** `LineMap` (`packages/core/src/diagnostics/line-map.ts:36`, exported via `diagnostics/index.ts:14`) already converts byte offsets to 1-based line/col — O(log n), CRLF/CR/bare-CR and BOM aware (FR-8/FR-20), with its own impl-test suite (`line-map.impl.test.ts`).
**The Problem:** DRY violation: the helper re-implements a shipped, tested core capability, and the planned impl tests re-cover edge cases (`offsets 0/EOF`, BOM interplay) that `line-map.impl.test.ts` already owns. A naive newline-scan would also have to re-handle CRLF/CR correctly or drift from core behavior.

**Options:** Single viable resolution — use `new LineMap(sourceId, text)` (once per file) + `getLineCol(byteOffset)` for F9 message locations; `parse.ts` keeps only the PF-017 offset-conversion helper. Composes cleanly with PF-017: convert to byte offsets first, then LineMap consumes them natively. (Considered and dropped: keeping the local helper "to avoid a core import" — `@blend65/config` already depends on core for the bag/spans, so there is no boundary cost.)

**Recommendation:** Replace the helper with `LineMap`; drop the duplicated line/col impl-test rows (keep only a smoke assertion on the F9 message format).
**Confidence:** High (`file:line` verified). **Hardening:** in-context layers only (MINOR).

**User Decision:** Resolved — user accepted the recommendation ("fix all per your recommendations", 2026-07-02); fix applied, see §Fixes Applied.

---

### PF-019: Ordinal-span scheme can collide and can collapse per-entry diagnostics 🟡 MINOR

**Dimension:** Edge Cases (9)
**Location:** `03-01-config-loader.md` §Span strategy (line 178: `{sourceId, K, K}` with K = key ordinal)
**Codebase Evidence:** `diagnostic-bag.ts:89-93` — dedup on `(code, sourceId, start)`.
**The Problem:** Two dedup hazards in the fallback-span scheme: (a) a key ordinal K is a small integer that can equal a real byte offset — a file-anchored E10243 whose value node starts at byte K and an override-sourced E10243 for the key with ordinal K share `(E10243, -2, K)` → one is silently dropped; (b) the ordinal is per-KEY, so two offending entries in one override-sourced array (e.g. `overrides.include = ["/a", "../b"]`) produce identical spans → the second E10246 is dropped, contradicting the plan's own "E10246 per offending entry" (`03-01` Error Handling table).

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Move synthetic ordinal spans to a disjoint negative coordinate space with per-entry stride, e.g. `start = -(2 + ordinal * 64 + entryIndex)` (constant documented in `types.ts`) | Can never collide with real offsets (≥ 0); per-entry distinct; stable; sorts deterministically ahead of file-anchored diagnostics | Magic stride constant (documented) |
| B | Base ordinals past the file: `start = textLength + 1 + ordinal * 64 + entryIndex` | Positive offsets; sorts after file-anchored diagnostics | Depends on file length → unstable across edits (dedup keys shift); no file at all in the E10240 path |

**Recommendation:** Option A — length-independent, collision-proof, and the ordering (synthetic before file-anchored) is harmless since config diagnostics already sort first by `sourceId = -2`.
**Confidence:** High. **Hardening:** in-context layers only (MINOR); the existing "ordinal-span stability" impl-test row (07) should be pointed at the new scheme.

**User Decision:** Resolved — user accepted the recommendation ("fix all per your recommendations", 2026-07-02); fix applied, see §Fixes Applied.

---

### PF-020: `hasErrors` via before/after `getErrors().length` can report false on a capped, pre-populated bag 🟡 MINOR

**Dimension:** Implicit Assumptions (2)
**Location:** `03-01-config-loader.md` §Algorithm step 6 (lines 168–170)
**Codebase Evidence:** `diagnostic-bag.ts:151-170` — once `errorCount >= maxErrors` and the truncation sentinel has been emitted, further `addError` calls change nothing observable; `getErrors()` also sorts the whole store on every call (`:206-224`).
**The Problem:** For a caller-supplied bag already at its cap with truncation emitted, every config error the loader emits is suppressed with no observable delta → `hasErrors: false` for a genuinely invalid config → exit code 0 (RD-15 R43 bypassed). The RD's own §4.2 doc comment defines `hasErrors` as "any error-severity diagnostic was **emitted** during loading" — emission, not bag growth. Trigger is pathological today (the bootstrap note has the CLI create a fresh bag), but the LSP/programmatic path makes shared bags plausible.

**Options:** Single viable resolution — track emission locally: `loadConfig` routes error emission through a tiny wrapper that sets `hadError = true` on every attempt, and returns that flag. Immune to dedup and the cap, matches the RD §4.2 wording, and avoids two full sorts per call. (Considered and dropped: comparing `bag.count()` instead — still blind to cap-suppressed adds; consulting `isErrorLimitReached()` — already true before the call in the failing scenario.)

**Recommendation:** Local emission tracking; ST-29's wording ("hasErrors reflects only THIS call's errors") is satisfied unchanged.
**Confidence:** High. **Hardening:** in-context layers only (MINOR); the "pre-populated-bag hasErrors matrix" impl-test row should gain the at-cap case.

**User Decision:** Resolved — user accepted the recommendation ("fix all per your recommendations", 2026-07-02); fix applied, see §Fixes Applied.

---

### PF-021: Declared module signatures can't fulfill their documented responsibilities 🟡 MINOR

**Dimension:** Logical Contradictions (3)
**Location:** `03-01-config-loader.md` §New Functions
**Codebase Evidence:** internal to the plan (verified against RD-16 §4.2's `BlendConfig`, which includes `configPath`/`projectRoot`).
**The Problem:** Two signature/responsibility mismatches: (a) `mergeConfig(fileValues, overrides): BlendConfig` (`03-01:133-136`) must return a full `BlendConfig`, but algorithm step 4 (`03-01:160-162`) assigns `projectRoot`/`configPath` — inputs `mergeConfig` never receives; (b) `parseJsoncFile` returns `{ value, parseErrors }` (`03-01:117-121`) with no parse tree, yet `validateShape` "needs the parse tree for per-key spans" (`03-01:126`) and `ValidateContext` carries `tree?` (`03-01:143`) — nothing produces it.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Extend both: `JsoncParseResult` gains `tree: Node \| undefined` (value derived via `getNodeValue` or kept alongside); `mergeConfig(fileValues, overrides, origin: { configPath: string \| null; projectRoot: string })` | Each module stays self-sufficient; matches the declared data flow | Slightly wider signatures |
| B | Keep signatures; `loadConfig` assembles `configPath`/`projectRoot` onto the merge result and calls `parseTree` itself | Smaller module APIs | Splits "produce a complete BlendConfig" across two places; loadConfig reaches into jsonc-parser, blurring parse.ts's wrapper role |

**Recommendation:** Option A — keeps the parse wrapper the single jsonc-parser touchpoint and `mergeConfig` the single `BlendConfig` producer.
**Confidence:** High. **Hardening:** in-context layers only (MINOR).

**User Decision:** Resolved — user accepted the recommendation ("fix all per your recommendations", 2026-07-02); fix applied, see §Fixes Applied.

---

### PF-022: Post-error field values in the always-populated config are unspecified 🔵 OBSERVATION

**Dimension:** Completeness Gaps (4)
**Location:** `03-01-config-loader.md` Error Handling table; `07-testing-strategy.md` ST-13/ST-20/ST-21 (no value assertions)
**Codebase Evidence:** RD-16 AC-11 requires a fully populated `BlendConfig` even when `hasErrors: true`; RD R31 says `platform` is "always a validated non-empty string" — silent about the error case.
**The Problem:** Undefined-but-observable states: what does `config.platform` hold after E10245 (the field is `string`, there is no default)? Does `maxErrors: 0` survive into the returned config after its range E10243? Do E10246-offending patterns stay in the "verbatim" arrays? Nothing downstream consumes an errored config (exit 2 gates it), so this is not a defect today — but any future consumer or test that pokes an errored config meets unspecified behavior.

**Recommendation:** Settle it as a one-line register addendum (AR-P9): on semantic-stage failure the offending value is left **as-merged** (no post-hoc mutation), `platform` is `""` when unset, and consumers must gate on `hasErrors` — deterministic, testable, no mutation logic. Alternative (fall back to §4.1 defaults per failing key) is also viable but adds mutation rules and collides with AC-10's "verbatim" for patterns.
**Confidence:** Medium. **Hardening:** in-context layers only (observation).

**User Decision:** Resolved — user accepted the recommendation ("fix all per your recommendations", 2026-07-02); fix applied, see §Fixes Applied.
