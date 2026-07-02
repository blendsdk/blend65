# Preflight Report: RD-17 — Intrinsics & Runtime ABI (Implementation Plan)

> **Status**: ✅ PREFLIGHT PASSED — all 11 findings resolved
> **Iteration**: 2 (fixes applied + re-scanned; PF numbering continues from the RD-17
> requirements preflight, which ended at PF-013 in `../../requirements/00-preflight-report.md`)
> **Artifact**: Implementation plan at `codeops/features/blend65-ri/plans/rd-17-intrinsics-runtime-abi/`
> **Codebase Grounded**: ~30 source/test files examined; ~30 plan references verified (0 phantom)
> **Last Updated**: 2026-07-02
>
> ⚠️ SAME-AGENT REVIEW: the plan was authored by the same model in a *previous* session
> (fresh context for this review). Standard-first checking applied: frozen `spec/` text was
> cited directly for every spec-bound behavior (Ch 04 §div, Ch 08 §9 `length`, Ch 12 catalog,
> Ch 14 code bands, platform appendices).

## Codebase Context Summary

**Tech Stack:** TypeScript ESM (NodeNext, ES2023, strict), Node 22, Yarn v1 + Turborepo, Vitest; 10 `@blend65/*` packages.
**Architecture:** staged AOT compiler (lexer → parser → passthrough analyzer → SFA → IL → Instr → ACME serializer → ACME process layer); R15 boundary (frontend/LSP never import codegen) enforced by ESLint + `test/boundary.spec.test.ts`.
**Key Files Examined:** `core/src/{ast/reserved-builtins.ts, diagnostics/diagnostic-codes.ts, platform/{platform-plugin,platform-profile,validate-profile}.ts, semantics/{platform-profile,type}.ts, instr-model/{opcode,stream}.ts}`; `frontend/src/{semantics/{analyze,passes}.ts, parser/{pratt,parser}.ts, sfa/{zp-allocator,plan-allocation,symbols}.ts}`; `codegen/src/{il/{lower,instruction,intrinsic-descriptor}.ts, instr/{translate,instr-program,serialize-acme}.ts}`; `platforms/src/c64.ts` (+ spec tests); `compiler/src/{acme/*, assemble.golden.spec.test.ts}`; frozen `spec/{04,08,12,14}-*.md`, platform appendices.

**Verification headline:** every `file:line` citation in the plan is accurate. E10043–E10046 are
free in both the code registry and frozen Ch 14. The findings below are integration gaps and
spec-conformance issues the citations don't cover — dominated by one fault line: **descriptor
availability/ABI checks are specified against the canonical RD-10 profile, but the analyzer and
`generateInstr` only receive the interim profile / a bare `CpuVariant`.**

## Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|------------------|
| 1 | Ambiguities | 1 (PF-021) | 🟡 |
| 2 | Implicit Assumptions | 0 | — |
| 3 | Logical Contradictions | 2 (PF-016, PF-019) | 🟠 |
| 4 | Completeness Gaps | 2 (PF-017, PF-022) | 🟠 |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | folded into PF-014/015 | — |
| 7 | Testability | folded into PF-019 | — |
| 8 | Security Blind Spots | 0 (path guard + no-throw specified) | — |
| 9 | Edge Cases | 1 (PF-023) | 🟡 |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 0 (phase graph sound; ST-15/16 `.todo` staging correct) | — |
| 12 | Consistency | 1 (PF-024) | 🔵 |
| 13 | Codebase Alignment | 4 (PF-014, PF-015, PF-018, PF-020) | 🔴 |

## Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 1 | all resolved |
| MAJOR | 3 | all resolved |
| MINOR | 6 | all resolved |
| OBSERVATION | 1 | all resolved |

## Iteration 2 — fixes applied & re-scanned (2026-07-02)

> **Previous Iteration**: 11 findings — all resolved (user: "apply all per your recommendations")
> **This Iteration**: 0 new findings against the amended plan; 1 sequencing regression
> found **in the fix set itself** and corrected before close (see below)
> **Carried Forward**: none

**Fix verification (all 11):**

- **PF-014** — 03-02 now specifies `AnalyzeInput.targetProfile?` (canonical, skip-V4/V6b-when-absent semantics + error-handling row); mirrored in 03-01, 02-current-state, task 2.2.2. ✓
- **PF-015** — canonical profile gains `platformId` (03-01 core-deltas row incl. the 5 plugins/fixtures + `validateProfile` consistency check); 03-05's wrapped predicate rewritten to compare `profile.platformId`; production-reachability limitation documented; task 1.2.3 updated. ✓
- **PF-016** — 03-03 Integration Points replaced ("signatures unchanged" removed; optional `opts` on `generateInstr` + `serializeToAcme` specified); 03-04 marshalling step 4 + embedding section updated; tasks 4.2.3/4.2.4 + 02-current-state rows updated. ✓
- **PF-017** — `RuntimeModule.baseUrl` mechanism specified in 03-05 (concrete traversal-guard root, src/dist reachability note); tasks updated. ✓
- **PF-018** — `__rt_arg*` eliminated everywhere in favor of the allocator's `__zp_arg_N` (03-04 ×3 sites, ST-25, tasks 4.2.2/4.3.1); grep sweep confirms no stale references. ✓
- **PF-019** — ST-30 + task 4.1.2 now carry the 2-line `__zp_arg` prelude harness note. ✓
- **PF-020** — `records.impl.test.ts:31` + `DEFAULT_PROFILE` assertion sweep added to task 1.2.3 and the 03-01/02 tables. ✓
- **PF-021** — `lo`/`hi` catalogued as `'inline'` (03-01 note); 03-03 strategy table de-contradicted. ✓
- **PF-022** — signed `*`//`/`/`%` deferral added to 01-requirements Won't-Have; logged as **AR-P16**. ✓
- **PF-023** — deliberate ≤255 boundary documented in 03-03 with the frozen-spec citation; logged as **AR-P15**; boundary case added as **ST-34** (07 + tasks 3.1.1). ✓
- **PF-024** — register/index counts corrected to AR-P1..P16; preflight-report row added to the document index. ✓

**Regression found & fixed during re-scan:** the initial PF-017 fix placed the
`RuntimeModule.baseUrl` field addition in Phase 1 (task 1.2.3), which would have broken
the spec-locked plugin `runtimeModules` tests three phases before their scheduled Phase-4
update. Re-sequenced to Phase 5 (task 5.2.1), where the Phase-4 stub removal has already
landed and only the T4 fixture sets the field. 03-01's delta row carries the phase note.

**Fresh 13-dimension pass over the amended docs:** no new ambiguities, contradictions, or
alignment breaks; cross-document terminology (`targetProfile`, `platformId`, `baseUrl`,
`runtimeSection`, `__zp_arg_N`, ST-34, AR-P15/P16) verified consistent across all 11 documents.

---

### PF-014: Availability checks have no canonical profile in the analyzer 🔴 CRITICAL

**Dimension:** 13 — Codebase Alignment (Stale Assumption) + 3 — Contradiction (03-01 vs 03-02)
**Location:** `03-01-core-registry.md` §Types ("PlatformProfile here is the **canonical** RD-10 profile — availability predicates key on `profile.cpu`") vs `03-02-semantic-validation.md` V4/V6b (checks run in the frontend pass) and `02-current-state.md` (only "+optional `registry`" is added to the analyzer).
**Codebase Evidence:** `packages/frontend/src/semantics/analyze.ts:23,34-41` — `AnalyzeInput.profile` is the **interim** `PlatformProfile` from the core root barrel; `packages/core/src/semantics/platform-profile.ts:23-60` — the interim profile has **no `cpu` field** (and no platform id); the canonical profile (`core/src/platform/platform-profile.ts:85`) is exported only from the `@blend65/core/platform` subpath.
**The Problem:** V4 (`availability(profile) === false` → E10043, AC-04/ST-11) and V6b cannot be implemented as planned — the analyzer never receives a value the descriptor predicates can accept. This is a type-level impossibility spanning two phase docs; Phase 2 would stall on an unplanned design decision, and AC-04's diagnostic message ("requires <CPU>, but the target is <actual>") also needs `cpu` for rendering.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | `AnalyzeInput` gains optional `targetProfile?: PlatformProfile` (canonical, imported from `@blend65/core/platform`); absent → availability checks are skipped | Idiomatic F1-Extensible move (`analyze.ts:28-33` designed for this); registry stays a target-agnostic catalog per RD §4.2; existing callers unaffected | Two profile params on one input (interim + canonical) until the RD-10 migration retires the interim one |
| B | Bind target at registry construction: `createIntrinsicRegistry(descriptors?, target?)` + `isAvailable(name)` | Single injection point | Deviates from RD §4.2's `getAvailable(profile)` contract; the plan's fallback ("registry absent → construct internally") would build a target-less registry that silently disables E10043 |
| C | Add `cpu` to the interim semantics profile | Smallest diff | Enlarges the documented-as-superseded interim type (`semantics/platform-profile.ts:11-16`), growing the exact debt the RD-10 migration must unwind |

**Recommendation:** Option A — with PF-015's resolution the canonical profile also carries the
platform id, so one optional field gives V4, V6b, and the message renderer everything they need.
Update 03-02 (Architecture + Wiring), 02-current-state Relevant Files, and task 2.2.2.

Confidence: High — the only thing that would change this is a decision to accelerate the full RD-10 profile migration instead.
Hardening: challenger amended my initial framing (skip-when-absent semantics; message rendering needs `cpu` too) — adopted.
Challenger: converged (independent pick: A).

**User Decision:** Resolved — user accepted the recommendation ("apply all per your recommendations", 2026-07-02); fix applied and verified in iteration 2

---

### PF-015: T4 platform-identity check has no data path (`profile.platformId` is a phantom field) 🟠 MAJOR

**Dimension:** 13 — Codebase Alignment (Phantom Reference)
**Location:** `03-05-t4-platform-mechanism.md` §Proposed (id-stamped wrapped predicate "`profile → contributed-by === activePlugin.id && …`"); RD-17 R25 ("the availability predicate checks `profile.platformId`"); ST-16.
**Codebase Evidence:** `packages/core/src/platform/platform-profile.ts:46-112` — the canonical `PlatformProfile` has **no `platformId` field**; the id lives on `PlatformPlugin.id` (`platform-plugin.ts:90`). Frozen platform appendices (e.g. `spec/appendix-c64.md:14`) list "Platform ID" as the first row of each profile table — the TS type simply omitted it.
**The Problem:** The wrapped predicate closes over the *contributing* plugin's id at merge time, but its only evaluation-time input is the profile, which carries no active-platform identity — so V6b (E10043, AC-06, ST-16) cannot evaluate. Additionally, since only the active plugin's descriptors merge, wrong-platform names are absent from the registry in production compiles; AC-06 is only reachable in test harnesses that construct the registry from a fixture while targeting another platform (a limitation to document either way).

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| B | Add `readonly platformId: string` to the canonical `PlatformProfile` (5 plugins set it; `validateProfileFields` gains a `platformId === plugin.id` consistency check) | Implements R25 as written; spec-aligned (appendices list Platform ID as profile data); keeps availability a pure `profile → boolean`, uniform with the R24 CPU check; the plan's 03-05 wrapper then works verbatim | One more required field on a shipped type (5 plugins + profile fixtures updated) |
| A | Stamp `contributedBy` on descriptors + thread the active id as a second channel into the analyzer | No profile change | Forks a second input channel and special-cases V6b; re-litigates R25 |
| C | Merge ALL platforms' descriptors globally (R11 "global registry" literally) | E10043 production-reachable | AR-P9 duplicate-throw explodes on legitimate cross-platform name reuse (c64/c64u); reopens a closed AR |

**Recommendation:** Option B — and add a one-line documented limitation: wrong-platform E10043 is
verified via the fixture registry (ST-16); in production compiles unknown T4 names fall to RD-04b
name resolution (deferred). Composes with PF-014-A: the threaded canonical profile carries the id.

Confidence: High — would change only if a cross-platform global-merge design were pulled into RD-17 scope (rejected: collision semantics are a bigger decision than this RD needs).
Hardening: my initial pick was A; the challenger's spec-appendix grounding (Platform ID *is* profile data) and the R25-verbatim argument are stronger — adopted B. This is convergence on evidence, not drift: B satisfies the requirement text and the frozen spec, A satisfied only the mechanism.
Challenger: diverged — recommended B over my A; reconciled by adopting B (grounds above).

**User Decision:** Resolved — user accepted the recommendation ("apply all per your recommendations", 2026-07-02); fix applied and verified in iteration 2

---

### PF-016: E10044 + embedding contradict "signatures unchanged" 🟠 MAJOR

**Dimension:** 3 — Logical Contradiction (+ 13)
**Location:** `03-03-il-t1-t2-codegen.md` §Integration Points ("`generateInstr`/`assembleProgram` signatures unchanged") vs `03-04-t3-runtime-marshalling.md` §Marshalling step 4 (E10044 needs `profile.zpArgBlockSize` inside translate) and §Embedding (`serializeToAcme` "gains a final discrete section" of file-loaded text).
**Codebase Evidence:** `packages/codegen/src/instr/instr-program.ts:63-67` — `generateInstr(ilProgram, cpuVariant, bag)` receives no profile; `serialize-acme.ts:70,78` — `serializeToAcme(program)` is documented "Pure and deterministic (R5)" and takes only the program.
**The Problem:** As written, Phase 4's E10044 check (R35/AC-13/ST-27) has no access to `zpArgBlockSize` at the point the plan places it, and the embedding step would either break the serializer's purity contract or has an unspecified data path. Contradictory guidance for the executing agent → mid-phase stall.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Additive optional param: `generateInstr(il, cpu, bag, opts?: { zpArgBlockSize?: number })`, threaded by `assembleProgram` from `plugin.profile`; embedding computed in `embed.ts` and passed in: `serializeToAcme(program, opts?: { runtimeSection?: string })` | Check lives at the single point of truth (marshalling emission); source-compatible with all RD-08/09 consumers; serializer purity preserved (IO isolated in embed.ts) | Bare `generateInstr` callers silently skip the E10044 check (driver-discipline dependency) |
| C | E10044 scan over IL in `assembleProgram` pre-translate | Fires whenever a plugin is present | Duplicates translate's notion of "runtime routine call site" → drift risk |
| D | Extend `InstrProgram` with embedded-module text | Serializer signature untouched | Pollutes the frozen, peephole-consumed program type with serializer-only data |

**Recommendation:** Option A — amend 03-03/03-04 and tasks 4.2.3/4.2.4 to name the two optional
params explicitly. (Frontend placement of the check was considered and dropped: R15 keeps the
canonical profile threading awkward there, and codegen already emits user-facing diagnostics —
W10170-72 precedent at `translate.ts:564-599`.)

Confidence: High — the counter-argument (silent skip on bare `generateInstr`) is mitigated by making `assembleProgram` the documented E10044-carrying path and asserting it in ST-27.
Hardening: no change from the deeper pass.
Challenger: converged (independent pick: A).

**User Decision:** Resolved — user accepted the recommendation ("apply all per your recommendations", 2026-07-02); fix applied and verified in iteration 2

---

### PF-017: T4 `.asm` package-root resolution mechanism unspecified 🟠 MAJOR

**Dimension:** 4 — Completeness Gap (+ 13 Dependency Reality)
**Location:** `03-05-t4-platform-mechanism.md` ("`asmPath` resolved against the **plugin package** root") and `03-04` §loadRuntimeModule.
**Codebase Evidence:** `packages/codegen/package.json` — codegen depends only on core + frontend, so it cannot locate the platforms package; `core/src/platform/platform-plugin.ts:56-63` — `RuntimeModule` carries only a relative `asmPath`, no base.
**The Problem:** `embed.ts` (codegen) has no way to turn a plugin-relative path into a real file. The mechanism is production code (AR-P2: the *mechanism* ships, the content is fixture-only), and ST-32 requires actual embedding — Phase 5 would stall on an unplanned contract change.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add `readonly baseUrl: string` to `RuntimeModule` (each plugin sets `import.meta.url`); `embed.ts` resolves `new URL(asmPath, baseUrl)` + canonicalized prefix guard | Same self-locating mechanism AR-P8 already chose for T3; works from both `src/` (vitest) and `dist/` (tsc); each module self-contained through registry merge | One optional-becomes-required field shaped against a single fixture |
| B | Absolutize paths at merge time | Codegen sees pre-validated paths | Relocates, doesn't solve, the "who knows the base" problem; forks `asmPath` semantics pre/post merge |
| C | Fixture-only loader + documented AR deferral of the production mechanism | Zero contract change now | The production T4 branch of `loadRuntimeModule` ships unwritten/untested; the fixture hand-rolls what A formalizes |

**Recommendation:** Option A — plus two plan amendments the challenger surfaced: state that plugin
assets must resolve identically from `src/` and `dist/`, and define the traversal guard's "package
root" concretely (resolved path must stay under the directory containing the owning package's
`package.json`).

Confidence: Med — post-AR-98 there are zero production T4 modules, so the field is shaped against one fixture; if a future platform-content RD redefines packaging, `baseUrl` may need revisiting (it is one field, cheaply revisable).
Hardening: added the src/dist reachability + concrete-root amendments from the challenger.
Challenger: converged (independent pick: A).

**User Decision:** Resolved — user accepted the recommendation ("apply all per your recommendations", 2026-07-02); fix applied and verified in iteration 2

---

### PF-018: `__rt_arg0/1` duplicates the allocator's existing `__zp_arg_N` symbols 🟡 MINOR

**Dimension:** 13 — Codebase Alignment (Redundancy)
**Location:** `03-04-t3-runtime-marshalling.md` §ABI ("`embed.ts` emits the `__rt_arg0`/`__rt_arg1` symbol definitions into the serializer's symbol-def header").
**Codebase Evidence:** `packages/frontend/src/sfa/zp-allocator.ts:189-192` — the arg-block bytes are already allocated as named entries `__zp_arg_0`, `__zp_arg_1`, …; `frontend/src/sfa/symbols.ts:84-85` — every ZP allocation already flows into `AllocationPlan.symbolDefinitions` and thus into the `.asm` symbol header.
**The Problem:** Once AR-P10 raises the floor to 4, the header already defines `__zp_arg_0..3`. Emitting a parallel `__rt_arg*` set creates two names for the same bytes — divergence risk and dead machinery in embed.ts.

**Recommendation (single viable path):** Use the existing `__zp_arg_0/1` symbols in the routine
bodies and marshalling code; delete the embed.ts symbol-emission bullet. Considered and dropped:
renaming the allocator's symbols to `__rt_arg*` — touches shipped SFA tests for zero benefit.

Confidence: High. Hardening: no change.

**User Decision:** Resolved — user accepted the recommendation ("apply all per your recommendations", 2026-07-02); fix applied and verified in iteration 2

---

### PF-019: ST-30 "assembles standalone" fails for mul16/div16 (undefined ZP symbols) 🟡 MINOR

**Dimension:** 7 — Testability (+ 3)
**Location:** `07-testing-strategy.md` ST-30 ("Each `runtime/*.asm` file through ACME standalone … zero errors") vs `03-04` ("no hardcoded addresses" — routines reference arg-block symbols defined in the program's symbol header).
**Codebase Evidence:** the symbol defs live in the serialized program header (`serialize-acme.ts:90-93`), not in the module files — a bare `acme mul16.asm` has no `__zp_arg_*` definitions.
**The Problem:** The spec test as written is unsatisfiable for the two word routines; since spec tests are immutable oracles authored first, this would force an oracle "fix" mid-phase — exactly what the protocol forbids doing casually.
**Recommendation (single viable path):** Amend ST-30/task 4.1.2: the test harness prepends a
2-line fixture prelude (`__zp_arg_0 = $02` …) before invoking ACME; intent (syntax/symbol
correctness of the module text) is preserved. No genuinely distinct alternative: hardcoding ZP
addresses in the modules contradicts AR-100/03-04 by design.

Confidence: High. Hardening: no change.

**User Decision:** Resolved — user accepted the recommendation ("apply all per your recommendations", 2026-07-02); fix applied and verified in iteration 2

---

### PF-020: AR-P10 breaks a shipped default-lock test the plan doesn't list 🟡 MINOR

**Dimension:** 13 — Codebase Alignment (Test Impact)
**Location:** `03-01-core-registry.md` Core-deltas table row "Interim floor … 0→4"; task 1.2.3.
**Codebase Evidence:** `packages/core/src/sfa/records.impl.test.ts:31` — `expect(DEFAULT_PROFILE.zpArgBlockMin).toBe(0)`.
**The Problem:** The plan names the size-locked `RESERVED_BUILTINS` tests as deliberate updates but not this one; an executing agent hits an "unexpected" red test in Phase 1.
**Recommendation (single viable path):** Add `records.impl.test.ts` (and a sweep for other
`DEFAULT_PROFILE` assertions) to task 1.2.3's deliberate-update list.

Confidence: High. Hardening: verified the golden `assemble.golden.spec.test.ts` is NOT affected (it hand-builds `emptyPlan()` with no ZP allocations), so ST-29's byte-identical claim survives — checked and cleared rather than assumed.

**User Decision:** Resolved — user accepted the recommendation ("apply all per your recommendations", 2026-07-02); fix applied and verified in iteration 2

---

### PF-021: `lo`/`hi` lowering strategy is contradictory across the plan's own tables 🟡 MINOR

**Dimension:** 1 — Ambiguities
**Location:** `03-03-il-t1-t2-codegen.md` strategy table — `'fold'` row claims "`lo`/`hi` of constants", `'inline'` row claims "non-constant `lo`/`hi`"; `03-01` fixes exactly one `loweringStrategy` per descriptor and ST-1-style tests spec-lock catalog values.
**The Problem:** Which single value do the `lo`/`hi` descriptors carry? A spec test locking the wrong one becomes a false oracle.
**Recommendation (single viable path):** Catalog them as `'inline'`, with the inline emitter
folding constant operands as an optimization (mirrors RD-17 §4.3 "fold or AND #$FF"). Note this in
03-01's catalog section. Considered and dropped: a `'fold-or-inline'` union value — grows the
strategy vocabulary for one case.

Confidence: High. Hardening: no change.

**User Decision:** Resolved — user accepted the recommendation ("apply all per your recommendations", 2026-07-02); fix applied and verified in iteration 2

---

### PF-022: Signed `*` / `/` / `%` silently out of scope 🟡 MINOR

**Dimension:** 4 — Completeness Gap (+ 9 Edge Cases)
**Location:** `01-requirements.md` §Won't Have (no mention); `03-04` ABI table (unsigned signatures only).
**Codebase Evidence:** frozen `spec/04-expressions-operators.md:87` — "Division is integer division — truncated toward zero (for **both signed and unsigned** operands)"; `translate.ts:539-603` dispatches runtime calls on width only, so `sword / sword` would call unsigned `__rt_div16` and compute wrong results (two's-complement multiply is width-safe; division is not).
**The Problem:** AC-19 covers "byte and word operands" (unsigned) — fine — but nothing records that signed division/modulo remain unimplemented, so the gap risks being presumed closed after RD-17.
**Recommendation (single viable path):** Add to Won't-Have: "Signed `*`//`/`/`%` runtime routines
(`__rt_sdiv*`) — spec Ch 04 §3.2 semantics deferred; log as a runtime AR naming the owning future
slice." No alternative: designing signed routines now is unrequested scope.

Confidence: High. Hardening: no change.

**User Decision:** Resolved — user accepted the recommendation ("apply all per your recommendations", 2026-07-02); fix applied and verified in iteration 2

---

### PF-023: `length()` byte/word boundary deviates from the frozen spec 🟡 MINOR

**Dimension:** 9 — Edge Cases (spec conformance)
**Location:** `03-03` fold semantics ("result type `byte` if ≤255 else `word`"); `07-testing-strategy.md` ST-22 ("≤255 → `byte`").
**Codebase Evidence (standard text):** frozen `spec/08-arrays-strings.md:513` — "**Return type**: `byte` for arrays **≤256** elements; `word` for arrays >256 elements"; `spec/12-intrinsics.md:187` — example `const TABLE_LEN: byte = length(SINE_TABLE); // 256`.
**The Problem:** The spec's own boundary is ≤256 (with an example storing 256 in a `byte`, which cannot represent it — a frozen-spec quirk). The plan silently substituted ≤255. Under D3 (spec frozen) and the immutable-oracle rule, a silent deviation is not allowed — this needs an explicit decision, and the exact-256 boundary case has no ST.
**Recommendation:** Deviate deliberately: adopt ≤255→`byte` (256 is unrepresentable; the spec text
is self-contradictory), record it as the next runtime AR-PN with the spec citation, and add a
boundary ST for a 256-element array (expect `word`, value 256). The alternative — follow ≤256
verbatim with 256 wrapping to 0 — is genuinely viable only as strict-conformance theater and
produces a wrong program; named and dropped.

Confidence: High — this is the standards-first check working as intended; only a spec-owner ruling that Ch 08 §9 means something else would change it.
Hardening: no change.

**User Decision:** Resolved — user accepted the recommendation ("apply all per your recommendations", 2026-07-02); fix applied and verified in iteration 2

---

### PF-024: Register header says 13 items; the table has 14 🔵 OBSERVATION

**Dimension:** 12 — Consistency
**Location:** `00-ambiguity-register.md` preamble ("numbered **AR-P1..AR-P13**", "All 13 recommendations…") and `00-index.md` AR row ("AR-P1..P13") vs the table (14 rows; AR-P14 surfaced during authoring; status line correctly says 14).
**Recommendation (single viable path):** s/P13/P14/, s/13 recommendations/14/ in the two headers.

**User Decision:** Resolved — user accepted the recommendation ("apply all per your recommendations", 2026-07-02); fix applied and verified in iteration 2

---

## Adversarial-question checklist (pre-conclusion)

- *Assumption unconsciously confirmed?* The plan's line-cites all verified — the risk was trusting its **integration** claims; dimensions 3/13 above were scanned specifically against real signatures, which is where all four high-severity findings came from.
- *External standard violated?* Checked frozen spec text directly → PF-022, PF-023.
- *What would a disagreeing expert flag?* "Your registry never sees non-active platforms" → captured as the documented limitation inside PF-015.
