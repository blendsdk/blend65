# Preflight Report: RD-11 — Diagnostics Engine & Resource Reporting

> **Status**: ✅ PREFLIGHT PASSED — all 14 findings resolved (0 critical, 3 major, 7 minor, 4 observations); user accepted all recommendations 2026-07-03; **fixes applied 2026-07-03** to RD-11 (PF-001 R46+AC-19, PF-002 §4.6/§4.8 rebuilt on `SfaResourceData`, PF-003 R43/§4.7/AC-18 → Ch 11 §6 layout, PF-004 header+R20, PF-005 §4.4 `createSeverityPolicy`+R31, PF-006 R14/R35, PF-007+PF-013 R33, PF-008 R1+§5, PF-009 R51, PF-010 R52, PF-011 R50, PF-012 §4.7, PF-014 R31), RD-15 §4.4 (illustration cascade), the ambiguity register (runtime AR-102), both roadmaps, and CLAUDE.md
> **Iteration**: 1 (first scan)
> **Artifact**: Requirement document at `codeops/features/blend65-ri/requirements/RD-11-diagnostics-reporting.md`
> **Codebase Grounded**: ✅ shipped RD-11a code read in full (`packages/core/src/diagnostics/*`), plus `core/src/sfa/allocation-plan.ts`, `core/src/platform/platform-profile.ts`, `frontend/src/sfa/*`, `frontend/src/lexer/lexer.ts`, `config/src/{types,defaults,validate,load-config}.ts`, `compiler/src/acme/emit-binary.ts`, `codegen` producer sweep; frozen `spec/14-diagnostics.md` + `spec/11-memory-model.md` §6 quoted verbatim; sibling RDs 05/08/15/16, the archived RD-11a plan, and the ambiguity register (AR-70..85, AR-92, AR-97..101) cross-checked
> **Last Updated**: 2026-07-03
>
> Note: per convention this path holds the latest requirements-level audit. The previous
> RD-15 audit (PF-001..PF-010, PASSED 2026-07-03) is preserved in git history. PF numbering
> restarts per artifact.
>
> Same-agent note: RD-11 was authored 2026-05-31 in a prior session — this is NOT a
> same-session review. All three MAJOR findings were hardened with an independent
> challenger (blind to the original reasoning, instructed to refute); all three were
> CONFIRMED and the challenger's evidence corrections are folded into the write-ups below.

---

## Context

RD-11 is **split**: **RD-11a (diagnostics core) shipped and is archived**
(`codeops/_archive/rd-11a-diagnostics-core/`, AR-Q1 split: R1–R15, R17–R22, AC-01..07/10/21).
This preflight gates **RD-11b** (severity policy, 4 renderers, `SourceMap`, `ResourceReport`)
before its `make_plan`. Dimension 13 therefore audits the RD against *both* the shipped
11a code and the shipped upstream data sources (RD-05 SFA, RD-09 ACME, RD-10 profiles,
RD-16 config) the 11b remainder consumes.

## Codebase Context Summary

- **Shipped and matching the RD**: `Diagnostic`/`DiagnosticOptions` (`diagnostic.ts`),
  `DiagnosticBag` with dedup/(code,sourceId,start), deterministic sort, max-errors cap
  (`diagnostic-bag.ts`), `SourceSpan`/`SourceId`/`LabeledSpan`/`makeSpan` (`source-span.ts`),
  `LineMap` with byte + UTF-16 conversion (`line-map.ts`), the code registry
  (`diagnostic-codes.ts`). §4.1–§4.3 interfaces match shipped code near-verbatim.
- **Confirmed absent (RD-11b scope)**: `SourceMap`, `SeverityPolicy`/`applySeverityPolicy`,
  `renderTerminal`, `renderJson`, `ResourceReport`, `renderReportTerminal`,
  `renderReportJson` — zero hits in `packages/*/src` (grep-verified).
- **R37 upheld today**: zero `console.`/`process.stdout|stderr` hits in core/frontend/
  codegen/compiler/config `src/`.
- **Producers already live**: lexer, parser, semantics, config (E10240–46/W10240–41),
  IL lowering, instr translate/peephole (ICEs + W10170–72), SFA budgets
  (E10032/E10033/W10030/W10033), `emit-binary.ts:128` (E10034). Budget-timing split (R42)
  is already implemented by RD-05/RD-09.
- **Flag spellings**: all RD-11 flag names match RD-15 §3.7/§3.9 and frozen Ch 14 §4 exactly.
- **Aggregator inputs shipped**: `SfaResourceData` (`core/src/sfa/allocation-plan.ts:125`),
  profile budgets `maxBinarySize`/`maxRam`/`maxZp`/`stackBudget`
  (`core/src/platform/platform-profile.ts:78-84`), ACME label-file parsing (RD-09).

## Summary by Dimension

| # | Dimension | Findings |
|---|-----------|----------|
| 1 | Ambiguities | PF-007, PF-013 |
| 2 | Implicit Assumptions | PF-005 |
| 3 | Logical Contradictions | PF-001, PF-003, PF-006 |
| 4 | Completeness Gaps | PF-002 (peak field), PF-009, PF-014 |
| 5 | Dependency Issues | PF-004 (Depends On), PF-002 (layering) |
| 6 | Feasibility Concerns | PF-007, PF-012 |
| 7 | Testability | PF-001 (AC-19), PF-003 (AC-18) |
| 8 | Security Blind Spots | PF-010 |
| 9 | Edge Cases | PF-009, PF-011, PF-014 |
| 10 | Scope Creep Indicators | — clean |
| 11 | Ordering & Sequencing | — clean (RD-11b unblocked; deps all shipped) |
| 12 | Consistency | PF-004, PF-008 |
| 13 | Codebase Alignment | PF-002, PF-004, PF-005, PF-006, PF-008, PF-011 |

## Summary by Severity

| Severity | Count | IDs |
|---|---|---|
| 🔴 CRITICAL | 0 | — |
| 🟠 MAJOR | 3 | PF-001, PF-002, PF-003 |
| 🟡 MINOR | 7 | PF-004..PF-010 |
| 🔵 OBSERVATION | 4 | PF-011..PF-014 |

---

## 🟠 MAJOR

### PF-001: R46/AC-19 contradict RD-15 on what `--report=json` does 🟠

- **Dimension**: 3 (Contradiction), 7 (Testability)
- **Location**: RD-11 R46 (§3.10), AC-19
- **Codebase Evidence**: RD-15 R24 — `--emit-report` writes `<outName>.report.json` to the
  out-dir; RD-15 R36 — `--report=json` prints the report JSON **to stdout** (implies
  `--quiet` for the table); RD-15 R39 routes diagnostics to stderr *specifically* so the
  stdout JSON stays clean; RD-15 AC-17 pins stdout. RD-11 R46 says both flags "write the
  report to a JSON file".
- **Problem**: Normative text vs normative text. RD-11b lands *before* RD-15, so AC-19 as
  written is undischargeable in-slice (the flags won't exist) and its stated semantics are
  wrong; implementing file-writing in core would also violate RD-15 R4 (only `@blend65/cli`
  prints/writes). AR-82 does not protect R46 — it explicitly marked the flag names as
  working names "fixed at RD authoring", and RD-15 is where they were fixed.
- **Recommendation**: Amend R46 to: JSON report rendering is opt-in; RD-11's deliverable is
  `renderReportJson()`; flag surfacing per RD-15 R24 (file) / R36 (stdout). Reword AC-19
  AC-13-symmetric: "`renderReportJson` produces parseable report JSON (flag surfacing per
  RD-15 R24/R36)".
- **Considered and dropped**: changing RD-15 to match RD-11 (file for both) — RD-15's
  stdout/stderr split is load-bearing and was preflighted clean yesterday.
- **Confidence**: High. **Hardening**: independent challenger CONFIRMED at MAJOR; its
  AC-19 nuance (vague, not self-contradictory) folded in.
- **User Decision**: ✅ Accepted — recommendation applied 2026-07-03

### PF-002: §4.6 `ResourceReport` contradicts the shipped, RD-blessed `SfaResourceData` — and RD-11's own R40 🟠

- **Dimension**: 13 (Stale Assumptions), 4, 5
- **Location**: RD-11 §4.6, R40, R48
- **Codebase Evidence**: `packages/core/src/sfa/allocation-plan.ts:125-144` ships
  `SfaResourceData { frameRegionBytes, frameRegionPeak, frameSharingSaved, zpUsed, zpBudget,
  ramUsed, ramBudget, stackWorstCase, stackBudget }`, populated at
  `frontend/src/sfa/plan-allocation.ts:174-184`. RD-05 R58/AC-18 *require* it to "feed
  RD-11's aggregator" with "all numbers needed by the `ResourceReport` SFA-owned columns".
- **Problem**: §4.6 (authored before RD-05 shipped) uses `stackDepth` (shipped:
  `stackWorstCase`) and has **no field for frame-region peak** — yet R40 says the SFA owns
  "frame-region peak", and spec §6 renders it (`[peak: 10 bytes simultaneous]`,
  `spec/11-memory-model.md:213`). Under AR-84's no-reshape rule ("shape defined in full
  now; later slices only populate"), freezing §4.6 as written makes the fix forbidden later.
  Also: `peepholeStats?` references RD-08 §4.8's `PeepholeStats`, which lives in
  `@blend65/codegen` — core cannot import codegen (R15/AR-20 direction), so the type must
  be core-resident; population is deferred to RD-08 Phase B per its AR-P7.
- **Recommendation**: Amend §4.6 to **embed** the SFA-owned block structurally —
  `sfa: SfaResourceData` — beside ACME-owned/plugin-owned fields (realizes R41's
  one-owner-per-number structurally; both types live in core, no boundary issue). Define
  `PeepholeStats` core-resident (mirroring RD-08 §4.8), population Phase-B. Note that under
  AR-92 the rendered peak equals `frameRegionBytes` (spec §6's 47-vs-10 figures are
  pre-AR-92 illustration).
- **Considered and dropped**: flat-copy with renamed fields (passes but drift-prone);
  keep-§4.6-plus-adapter (AR-84 forbids the later reshape).
- **Confidence**: High. **Hardening**: challenger CONFIRMED at MAJOR and *strengthened*
  (requirements-vs-requirements, not just code); its embed-over-copy refinement and
  PeepholeStats provenance correction adopted.
- **User Decision**: ✅ Accepted — recommendation applied 2026-07-03

### PF-003: R43 mandates the Ch 11 §6 layout; §4.7's own example is a different table 🟠

- **Dimension**: 3 (Contradiction), 13, 7
- **Location**: RD-11 R43, §4.7 example, AC-18
- **Codebase Evidence**: `spec/11-memory-model.md:205-230` — `=== Blend65 Build Summary ===`
  free-form layout: segment lines with `$addr` ranges + peak annotation, ZP category
  breakdown, hardware-stack block, startup line, total. RD-11 §4.7 example — a compact
  box-drawn `Resource/Used/Budget/%` 4-row grid. Not subset-compatible.
- **Problem**: R43 and resolved AR-82 both pin "the Ch 11 §6 layout"; the RD's own example
  contradicts them. AR-84's MVP staging is about which *lines are populated*, not a second
  geometry — it explicitly says the gate reporter must "render the §6 table". The renderer
  is RD-11b's headline deliverable and gets golden-locked immediately; locking the wrong
  format forces a renderer rewrite + full golden regeneration across RD-15/RD-12.
  Cascades: RD-15 §4.4 reproduces the same compact grid in its CLI illustration; RD-11
  AC-18 ("used/budget/percentage for **all** categories") is derived from the compact grid
  — in §6 only the ZP and stack blocks show `used / budget (%)`.
- **Recommendation**: Make the Ch 11 §6 layout normative; replace the §4.7 example with the
  §6 form; reword AC-18 to match §6 (ZP + stack blocks show used/budget/%; segment lines
  show bytes + ranges); fix RD-15 §4.4's illustration in the same pass; and explicitly
  decide unpopulated-line policy — recommend **render-as-zero** (not omit) so slice-2
  golden diffs are value-only, recorded as a runtime AR.
- **Considered and dropped**: compact grid as v1 normative — refuted by AR-84's own text
  and AR-82; would re-litigate two resolved ARs.
- **Confidence**: High. **Hardening**: challenger CONFIRMED at MAJOR; its AC-18 and
  RD-15-cascade additions adopted.
- **User Decision**: ✅ Accepted — recommendation applied 2026-07-03

---

## 🟡 MINOR

### PF-004: RD text not aligned with shipped RD-11a reality (split, deps, cap semantics) 🟡

- **Dimension**: 12, 13, 5
- **Evidence**: Header says `Depends On: RD-01` only; the 11b remainder consumes RD-05
  (`SfaResourceData`), RD-09 (label file/binary size), RD-10 (budgets), RD-16 (policy
  inputs) — the roadmap already records "RD-11a (+ RD-09)". The RD nowhere records the
  AR-Q1 11a/11b split. Shipped deviations undocumented: ICEs are **exempt from the
  max-errors cap** (`diagnostic-bag.ts:186-194`) — R20 says errors stop being accepted;
  the truncation sentinel carries reserved code **E10000** (`diagnostic-codes.ts:27`),
  which R20 doesn't name; `LineMap` shipped as a class with `makeSpan` helper (§4.8 lists
  neither).
- **Recommendation**: Add an implementation-status note under the header recording the
  AR-Q1 split (11a shipped: R1–R15, R17–R22 / AC-01..07, 10, 21); update `Depends On` to
  RD-01, RD-05, RD-09, RD-10 (+RD-16 policy inputs); amend R20 to record the ICE
  exemption + E10000 sentinel; refresh §4.8 exports (`makeSpan`, `LineMap` class).
- **User Decision**: ✅ Accepted — recommendation applied 2026-07-03

### PF-005: `BlendConfig → SeverityPolicy` adapter has no owner; post-policy failure check unstated 🟡

- **Dimension**: 2, 13
- **Evidence**: Shipped `BlendConfig` (`config/src/types.ts:53-57`):
  `warnAsError: boolean | string[]`, `suppressWarnings: string[]`. RD-11 §4.4
  `SeverityPolicy`: `warnAsError: boolean`, `promoteWarnings: Set<string>`,
  `suppressWarnings: Set<string>` — requires a union-split + array→Set adapter neither
  RD-11 nor RD-15 assigns. Also: after `applySeverityPolicy`, build failure must be derived
  from the returned array (bag.hasErrors() is pre-policy and misses promoted warnings) —
  unstated.
- **Recommendation**: Core owns the adapter (AR-75: policy in exactly one place) — export
  `createSeverityPolicy(input: { warnAsError: boolean | string[]; suppressWarnings: string[] })`;
  add a sentence to R31/§4.4 that consumers derive success/failure from the
  policy-applied array.
- **User Decision**: ✅ Accepted — recommendation applied 2026-07-03

### PF-006: Who builds/caches `LineMap` — R14/R35 say the lexer, §4.2 says `SourceMap` 🟡

- **Dimension**: 3, 13
- **Evidence**: R14/R35: "built by the lexer"/"the LineMap from the lexer". §4.2:
  `SourceMap.getLineMap(id)` "Get or build". Today the lexer builds its own
  (`frontend/src/lexer/lexer.ts:605`) *and* config builds its own
  (`config/src/load-config.ts:106`, `validate.ts:186,236`).
- **Recommendation**: `SourceMap.getLineMap` builds + caches lazily from interned content;
  the lexer's copy stays internal to lexing. Amend R14/R35 to say renderers resolve
  line/column via `SourceMap.getLineMap`, not "from the lexer". (O(n) rebuild is cheap;
  correctness of caching by `SourceId` is what matters.)
- **User Decision**: ✅ Accepted — recommendation applied 2026-07-03

### PF-007: `renderTerminal` color: implementation unspecified against core's zero-dependency posture 🟡

- **Dimension**: 1, 6
- **Evidence**: R33 cites AR-17 (chalk, CLI-side); the §4.5 signature puts colorization
  inside core (`options: { color: boolean }`). `@blend65/core` has **zero** runtime deps
  (package.json) and `line-map.ts:8` documents staying platform-free; CLAUDE.md records
  `jsonc-parser` as the workspace's only external runtime dependency.
- **Recommendation**: Core hand-rolls the ~4 ANSI SGR constants it needs behind the
  `color` flag (no dependency; deterministic goldens run `color: false`); chalk remains
  CLI-only for CLI chrome. Record this in R33.
- **Considered and dropped**: chalk in core (breaks the zero-dep posture); colorize in the
  CLI (splits caret layout across packages, makes the `color` option meaningless).
- **User Decision**: ✅ Accepted — recommendation applied 2026-07-03

### PF-008: R1's "codes defined in Ch 14" is no longer letter-true; §5 table stale 🟡

- **Dimension**: 12, 13
- **Evidence**: W10170/W10171/W10172 are **not in Ch 14** — they live in
  `spec/04-expressions-operators.md:494-496` (+ feature index), yet RD-11 §5 (RD-07 row)
  and R49's neighborhood treat Ch 14 as the registry. Additive shipped codes not in frozen
  Ch 14: E10000 (sentinel), E10035 (RD-09), E10043–46 (RD-17/AR-101), E10240–46 +
  W10240–41 (RD-16). §5 lists RD-16 as "config surface" only — it is also a *producer*
  (shipped); RD-17 (producer of E10040–46) has no row.
- **Recommendation**: Soften R1 to "Ch 14 is the canonical base registry; additive codes
  follow the RD-09/RD-16 precedent and are recorded in `diagnostic-codes.ts`, the single
  in-code registry (spec frozen per D3)". Refresh §5: RD-16 → producer + config surface;
  add RD-17 producer row.
- **User Decision**: ✅ Accepted — recommendation applied 2026-07-03

### PF-009: Renderer behavior undefined for spans it cannot resolve (sentinel/unknown `SourceId`) 🟡

- **Dimension**: 9, 4
- **Evidence**: Config diagnostics carry a sentinel `CONFIG_SOURCE_ID` (overridable)
  (`config/src/load-config.ts:73`) plus synthetic spans; a `SourceId` may not be interned
  in the `SourceMap` handed to `renderTerminal`. RD-11 never defines the fallback.
- **Recommendation**: Add a requirement: for an unresolvable `sourceId` the terminal
  renderer degrades to code+severity+message (no `-->` line, no excerpt) and never throws;
  JSON renderer emits the raw span. Spec-test it.
- **User Decision**: ✅ Accepted — recommendation applied 2026-07-03

### PF-010: Terminal renderer echoes raw source lines — control-character/ANSI injection 🟡

- **Dimension**: 8 (Security)
- **Evidence**: Ch 14 §1 format echoes the source line via `LineMap.getLineText`
  (`line-map.ts:220-234` returns raw text). A hostile `.blend` (or config) file containing
  escape sequences would be replayed into the developer's terminal (CWE-150 class).
- **Recommendation**: Require `renderTerminal` to sanitize C0/C1 control characters
  (except tab, which needs defined caret-width handling — see PF-013) in echoed excerpts;
  add a security test per the testing standards.
- **User Decision**: ✅ Accepted — recommendation applied 2026-07-03

---

## 🔵 OBSERVATIONS

### PF-011: W10241 overlap warning fires only for array-form `warnAsError` 🔵

`config/src/validate.ts:324-337` warns only when `warnAsError` is an array; blanket
`warnAsError: true` + a suppressed code emits no W10241 (matches RD-16 R30's letter).
R50's final sentence reads broader. Suggest qualifying R50: "…warns on the overlap of the
two explicit lists at load time (RD-16 R30)". Suppression-wins precedence itself is
unaffected (§4.4 already covers the blanket case).
**User Decision**: ✅ Accepted — recommendation applied 2026-07-03

### PF-012: `Map`-typed report fields don't survive `JSON.stringify` 🔵

§4.6 `frameSizes?: Map<string, number>` serializes to `{}`. If PF-002's embed is accepted
this largely dissolves (AllocationPlan exposes `frames: ReadonlyMap<string, FrameAllocation>`
— the JSON emitter must still convert). Suggest requiring `renderReportJson` to emit plain
objects/arrays, or shaping report fields as arrays of entries.
**User Decision**: ✅ Accepted — recommendation applied 2026-07-03

### PF-013: Multi-line-span caret rendering unspecified 🔵

Ch 14 §1's example is single-line; R33 doesn't say what the caret format does when
`primarySpan` crosses lines (or contains tabs). Suggest the plan decide (convention:
underline to end of first line) and golden-lock it.
**User Decision**: ✅ Accepted — recommendation applied 2026-07-03

### PF-014: Promoted warnings bypass `--max-errors` 🔵

The cap applies at emission (bag), promotion happens once post-collection (R31) — so
`--warn-as-error` over 100 warnings yields 100 errors regardless of `--max-errors 20`.
Deterministic, but worth one sentence in R31 documenting it as intended (Ch 14 §4's
"stop after N errors" reads on natural errors).
**User Decision**: ✅ Accepted — recommendation applied 2026-07-03

---

## Adversarial self-check (pre-conclusion)

- Standards cited from source, not memory: Ch 14 §1/§4 and Ch 11 §6 quoted verbatim from
  `spec/`; all shipped-code claims carry file:line.
- Findings I chose **not** to raise: R22 "thread-safe" vagueness (design constraint,
  already implemented, no consumer risk); §4.8 type-vs-value export pseudocode (folded
  into PF-004); `Instr.sourceSpan` survival (R16 — verified present in the instr model);
  RD-11b ordering (verified unblocked — deps all shipped).
- Clean dimensions (10, 11) are genuinely clean, not unexamined.
