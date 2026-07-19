# Preflight Report: RD-01 — Parity Measurement Infrastructure

> **Status**: ✅ PREFLIGHT PASSED — all 8 findings resolved (0 critical, 3 major, 3 minor, 2 observation); fixes applied to the RD same-session at the user's direction
> **Iteration**: 1 (first scan)
> **Artifact**: Requirements document at `codeops/features/asm-parity/requirements/RD-01-parity-measurement-infrastructure.md`
> **Codebase Grounded**: ~20 source files examined, 27 references verified (1 corrected during hardening)
> **Last Updated**: 2026-07-17
> **CodeOps Skills Version**: 3.9.0

> ⚠️ **SAME-SESSION REVIEW**: This artifact was created in the current session. Same-agent bias
> risk is elevated; a single independent challenger agent was run over the MAJOR batch (per the
> hardening protocol) and its corrections are folded in. Consider a fresh-session re-scan for
> maximum independence.

## Codebase Context Summary

**Tech Stack:** TypeScript ESM monorepo (Node 22, Yarn v1 workspaces, Turbo, Vitest, ESLint 9); ACME 0.97 + VICE 3.10 local, ACME-only CI (AR-27).
**Architecture:** 10 `@blend65/*` packages; pipeline Lexer→…→Codegen→Emitter; test-harness drives VICE via binary monitor; goldens byte-exact in `packages/test-harness/test/golden/`.
**Key Files Examined:** `test-harness/src/run/strategies.ts`, `src/fixture.ts`, `src/emulator/vice/{protocol,vice-driver}.ts`, `core/src/report/{resource-report,render-report-terminal,build-resource-report}.ts`, `core/src/instr-model/*`, `codegen/src/instr/{cpu-table,translate}.ts`, `platforms/src/cx16.ts`, `cli/src/{args,render,main}.ts`, the 12 goldens, `examples/balloon/*`, `scripts/gen-capability-matrix.mjs`, `.github/workflows/ci.yml`, root `package.json`, `test-harness/vitest.config.ts`, GitHub issue #64.
**Key Observations:**
- The VICE binary-monitor `CMD` table (`protocol.ts:28-41`) has no cycle-counter command — AR #1's deferral basis re-confirmed.
- `runUntilLabel(driver, symbols, label, timeout)` (`strategies.ts:61`) resolves labels via an explicit symbols map from `setupEmulator` (`fixture.ts:35-38`).
- `ResourceReport.startupCycles?` exists unpopulated (`resource-report.ts:88`); terminal renderer already prints the startup line (`render-report-terminal.ts:111-112`).
- Core has an `instr-model/` (Opcode, AddressingMode); codegen has legality tables `NMOS_6502_TABLE`/`W65C02_TABLE` (`cpu-table.ts`) — legality only, **no timing data anywhere in the repo** (F1 is not redundant).
- The only raster-poll loop in the repo is the balloon example (`main.blend`: `while (peek($D012) != 251) {}`; twin `balloon.asm:53-55`). `slice8.asm.golden:109` *writes* `$D012` (raster-IRQ line setup) but no golden *polls* it.
- `cx16.ts:51` sets `cpu: "wdc65c02"` (reachable via `blendc build --platform cx16`), but instruction selection is provably NMOS-only today (`translate.ts:91-104`, `_cpuVariant` deliberately unused).
- ACME 0.97 (local) supports `-r, --report FILE` — F6's input format exists.
- CI installs ACME, no VICE (`ci.yml:39-40`); `hasVice(platform = "c64")` has a default arg, so the RD's `skipIf(!hasVice())` shorthand is valid.

**Reference Verification:** 27 references mapped to code — 27 verified (initial "no golden contains D012" evidence corrected by the challenger to "no golden polls D012").

## Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|------------------|
| 1 | Ambiguities | 0 | — |
| 2 | Implicit Assumptions | 1 (PF-005) | 🟡 |
| 3 | Logical Contradictions | 0 | — |
| 4 | Completeness Gaps | 0 | — |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | 0 | — |
| 7 | Testability | 2 (PF-003, PF-007) | 🟠 |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 1 (PF-002) | 🟠 |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | 1 (PF-004) | 🟡 |
| 13 | Codebase Alignment | 3 (PF-001, PF-006, PF-008) | 🟠 |

**Ambiguity Register respected (not re-litigated):** AR #1 (mechanism deferral), AR #2 (window semantics), AR #7 (straight-line metric), AR #12 (exact ratchet — PF-003 addresses one window's *application* with new phase-sensitivity information, not the ratchet policy itself), AR #13 (names — PF-004 amends the pinned signature with new codebase information only).

## Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| MAJOR | 3 | all resolved, fixes applied |
| MINOR | 3 | all resolved, fixes applied |
| OBSERVATION | 2 | all resolved, fixes applied |

---

### PF-001: Raster-poll budget window has no home in the per-fixture budget tier 🟠 MAJOR

**Dimension:** 13 — Codebase Alignment (also 7 — Testability)
**Location:** RD-01, F3 ("Initial coverage: the `slice8b` copy inner loop and the raster-poll loop") and AC-4
**Codebase Evidence:** No golden contains a raster-poll loop (`slice8.asm.golden:109` only *writes* `$D012` for IRQ setup); the sole poll is the balloon example — `examples/balloon/main.blend` (`while (peek($D012) != 251) {}`), twin `examples/balloon/balloon.asm:53-55`. The budget tier is specified per golden fixture over `test/golden/budgets.json`; balloon is not a fixture and its generated output is not committed. Nothing in the repo budgets non-golden programs.
**The Problem:** F3/AC-4 place the raster-poll window alongside slice8b, implying it is a golden-fixture window. It isn't — the referent exists only in balloon, which sits outside the tier as specified. AC-4 cannot be implemented without pinning the mechanism by which the budget tier reaches that loop.
**Related:** Issue #64 names "copy inner loop, raster poll" without placing them; AR #3 fixed the budget file location but not this window's home.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Extend the budget tier to also compile the balloon example and budget its raster window | test-harness already depends on `@blend65/compiler` (`test-harness/package.json:18`); the `src/testing/slice8b.ts` pattern already stages source + `embed()` asset through real `build()` — balloon is mechanically identical; AC-5 already forces this RD to produce generated balloon output for twin-diff, so the build path exists regardless; balloon is the only window with an existing hand-written twin | budgets.json gains one non-golden entry (schema must name the program, not just fixtures) |
| B | Add a new minimal raster-poll golden fixture and budget that | Uniform per-golden tier | Contradicts the RD's repeated "12 goldens"; duplicates a loop that already exists in a first-class example; ships twin-less (grows RD-02) |
| C | Copy-loop window only; defer the raster window | Smallest | Contradicts issue #64's explicit ask; deferral would need its own AR entry |

**Recommendation:** Option A — reuses the balloon build path AC-5 already mandates, and budgets the one window that has a twin today. (Challenger verdict: confirmed MAJOR, endorsed A.)
Confidence: High · Hardening: independent challenger reconciled; evidence corrected (slice8 D012 write vs. poll).

**User Decision:** Resolved — User chose Options A **and** B combined: budget the balloon build AND add a raster-poll golden fixture. Fix applied (F3, AC-3, AC-4, pair manifest, Won't Have, Scope Decisions).

---

### PF-002: 65C02 / CpuVariant handling undefined for the timing table and the report 🟠 MAJOR

**Dimension:** 9 — Edge Cases (also 4 — Completeness)
**Location:** RD-01, F1 ("every documented NMOS 6502 opcode"), F7, AC-2, Won't Have (covers illegal NMOS opcodes only)
**Codebase Evidence:** `platforms/src/cx16.ts:51` sets `cpu: "wdc65c02"` (selectable via `blendc build --platform cx16`, `cli/src/args.ts:107`); `codegen/src/instr/cpu-table.ts:181` selects `W65C02_TABLE`; the shared `Opcode` union already includes 65C02 mnemonics (`codegen/src/instr/opcode.ts:12` re-exports from core). Counter-evidence bounding severity: instruction selection is NMOS-only today (`translate.ts:91-104`), so AC-2's unknown-opcode error would not fire yet.
**The Problem:** The RD never says what F7/F8 do when the build's CPU variant is not NMOS. Today an X16 build would render NMOS cycle counts labeled for a 65C02 target (wrong-by-datasheet where timings diverge: RMW abs,X 7→6+p, `JMP (abs)` 5→6); the moment codegen starts selecting 65C02 opcodes (which `W65C02_EXTRA_ROWS` plainly anticipates), AC-2's mandated lookup error turns every X16 build's report into a hard failure. For an RD whose entire value is *trustworthy numbers*, variant behavior must be defined, not implied.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Keep the table NMOS-only; require F7/F8 to degrade gracefully and explicitly for non-NMOS variants (omit cycle columns with a clear label; keep byte sizes, which are variant-independent for NMOS-legal ops); note 65C02 timing as future work in Won't Have | Matches the feature's C64 parity focus and F8's existing C64-only scoping; `CpuVariant` has exactly two values so the predicate is trivial; avoids authoring+pin-testing a second timing dataset with no consumer in this feature | X16 builds get no cycle estimates until a future RD |
| B | Make the table variant-aware now (NMOS + documented 65C02 timings incl. base-cycle differences) | Complete | Speculative generality: zero 65C02 opcodes emitted, zero X16 parity fixtures/twins; silently expands AC-2's test matrix |

**Recommendation:** Option A — and let the graceful-degradation clause also pin AC-2's typing choice: key the table on a narrowed NMOS-opcode subset type so an out-of-table opcode is a compile-time error at the table boundary, with the report layer applying the variant predicate. (Challenger verdict: confirmed as a real gap; MAJOR with this softened "mislabeled today, hard error later" framing.)
Confidence: High · Hardening: independent challenger reconciled; severity framing adjusted per its counter-evidence.

**User Decision:** Resolved — User accepted recommendation (Option A: NMOS-only + explicit graceful degradation). Fix applied (F1, F7, Won't Have, AC-2, Scope Decisions).

---

### PF-003: A measured exact-ratchet budget on the raster-poll window measures phase, not code 🟠 MAJOR

**Dimension:** 7 — Testability (also 9 — Edge Cases)
**Location:** RD-01, AC-4 (measured budget for the raster-poll window under exact ratchet)
**Codebase Evidence:** The poll window (`balloon.asm:53-55` idiom: `LDA $D012 / CMP #251 / BNE`) is wait-dominated: its measured cycle count is deterministic for one binary (AR #2 holds) but shifts with the raster phase at window entry — any upstream code change, *including improvements*, can swing it by up to a full PAL frame (~19,700 cycles).
**The Problem:** An exact-ratchet measured budget (AR #12) on that number churns `budgets.json` on unrelated changes and fails the gate for reasons that have nothing to do with code quality. This is new information about *this window's application* of the ratchet, not a challenge to AR #12's policy (deterministic compute-bound windows like the copy loop ratchet cleanly). Surfaced by the hardening challenger.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Poll loop gets a static per-iteration budget only (CI; e.g. LDA abs 4 + CMP imm 2 + BNE taken 3 = 9 cycles/iter from F1's own reference values); re-site the *measured* window onto the phase-stable frame-update body (poll-exit label → next poll-entry) | Preserves AC-4's intent (a measured hot-path budget from day one) while every asserted number means code cost; the update body is the actual per-frame work parity cares about | Slightly more wording in AC-4 (two windows on balloon) |
| B | Poll loop static per-iteration only; drop the measured assertion for this window entirely | Simplest | Loses the day-one measured budget on the balloon frame path; measured mode then debuts only via the copy loop |

**Recommendation:** Option A — keeps a meaningful measured ratchet where it is stable and moves the poll assertion to the metric that is honest for a busy-wait. (Rejected as non-viable: keeping AC-4 as written — a gate that fails on unrelated changes is noise by design.)
Confidence: High · Hardening: finding originated by the independent challenger with cycle-level evidence; reconciled by lead.

**User Decision:** Resolved — User accepted recommendation (Option A: static per-iteration poll budget + measured window on the frame-update body). Fix applied (F3, AC-4, budget-file section, Scope Decisions; AR #12 addendum recorded).

---

### PF-004: `measureCycles` pinned signature omits the symbols map 🟡 MINOR

**Dimension:** 12 — Consistency
**Location:** RD-01, F2 and AC-1 (`measureCycles(driver, fromLabel, toLabel)`); AR #13
**Codebase Evidence:** `strategies.ts:61-67` — `runUntilLabel(driver, symbols, label, timeout)` resolves labels via an explicit `Map<string, number>`; `setupEmulator` returns `{ driver, symbols }` (`fixture.ts:35-38, 140`). Drivers do not carry symbols.
**The Problem:** As pinned, the function cannot resolve its labels to addresses. New codebase information amending AR #13's shape, not re-litigating its names.

**Single viable resolution** (alternatives — teaching drivers to carry symbols, or changing `setupEmulator`'s contract — are larger refactors serving nothing else): amend to `measureCycles(driver, symbols, fromLabel, toLabel, timeout?)` in F2/AC-1 and record an addendum on AR #13.

**Recommendation:** Apply the amendment.

**User Decision:** Resolved — User accepted. Fix applied (F2, Technical Requirements, AC-1, Scope Decisions; AR #13 addendum recorded).

---

### PF-005: The balloon pair's "generated" side is unversioned and its production is unstated 🟡 MINOR

**Dimension:** 2 — Implicit Assumptions
**Location:** RD-01, Twin-diff pair manifest section; F5; AC-5
**Codebase Evidence:** `git ls-files examples/balloon/` → only `balloon.asm`, `balloon.bin`, `main.blend`; no committed generated output; no script builds it today.
**The Problem:** F5 maps "generated balloon output" to the twin, but the RD never states how that side comes to exist at diff time. (If PF-001 Option A is chosen, the same balloon-build path serves both consumers — the RD should say so once.)

**Recommendation:** Add one sentence to the manifest section: the tool obtains the generated side by compiling `main.blend` via the built compiler at run time (argv-array spawn or API import — plan decides), into a temp/build dir, never committed. CI already builds all packages before tests, so the CI informational step is covered.

**User Decision:** Resolved — User accepted. Fix applied (pair-manifest section; shared with PF-001's balloon build path).

---

### PF-006: Timing table should be keyed by the existing `instr-model` types and coverage-validated against the legality table 🟡 MINOR

**Dimension:** 13 — Codebase Alignment
**Location:** RD-01, Technical Requirements → Timing table ("mnemonic, mode, …"); AC-2
**Codebase Evidence:** Core exports `Opcode` and `AddressingMode` (`core/src/instr-model/opcode.ts`, `addressing-mode.ts`); `NMOS_6502_TABLE` (`codegen/src/instr/cpu-table.ts:37+`) enumerates every legal NMOS (opcode, mode) pair, spec-tested against the canonical matrix.
**The Problem:** The RD's conceptual record re-describes opcodes as loose `mnemonic`/`mode` strings without binding to the existing types, inviting a parallel representation (DRY violation); and AC-2's "covers all documented NMOS opcodes" is assertable *mechanically* — a spec test that every legal pair in the legality table has exactly one timing entry — which the RD doesn't require.

**Recommendation:** Amend the Technical Requirements to key the table by the existing `instr-model` types, and add the legality-table coverage cross-check to AC-2. (Note: the legality table currently lives in `codegen`; the coverage test can live wherever both are importable — wiring is plan-level.)

**User Decision:** Resolved — User accepted. Fix applied (F1, Technical Requirements → Timing table, AC-2).

---

### PF-007: AC-1's raster-IRQ demonstration — fixture provenance unstated 🔵 OBSERVATION

**Dimension:** 7 — Testability
**Location:** RD-01, AC-1 ("demonstrated by a spec test with a raster IRQ enabled")
**Codebase Evidence:** No harness fixture currently exercises a measured window with IRQs; the slice8 fixture family already configures the raster-IRQ line (`slice8.asm.golden:109`), and the assemble tier shows hand-written ACME fixtures are workable.
**The Problem (minor clarity):** The plan could wrongly assume the IRQ test program must be compiler output. A hand-written ACME fixture (or an extension of the slice8 program) is acceptable provenance — worth one clarifying clause so AC-1 doesn't silently grow language-level IRQ requirements.

**Recommendation:** Note in AC-1 that the demonstration program may be a hand-written assembly fixture.

**User Decision:** Resolved — User accepted. Fix applied (AC-1 clause).

---

### PF-008: Intrinsics catalog cycle metadata could later be cross-validated against the timing table 🔵 OBSERVATION

**Dimension:** 13 — Codebase Alignment
**Location:** RD-01 (absence); `core/src/intrinsics/catalog.ts:48, 99, 115, 125, 141` (`costMetadata: { cycles, bytes }` hand-stated per intrinsic)
**The Problem (opportunity, not defect):** Once F1 exists, a spec test could derive intrinsic costs from the table and catch drift in the hand-stated numbers. Not required for RD-01; a natural RD-06/blend65-ri/RD-08 enrichment.

**Recommendation:** Note as future work (no RD change required beyond an optional mention).

**User Decision:** Resolved — User accepted. Fix applied (Won't Have note).

---
---

# Preflight Report: RD-02 — Golden-Corpus Twin Audit + Scoreboard

> **Status**: ✅ PREFLIGHT PASSED — all 5 findings resolved (0 critical, 2 major, 3 minor, 0 observation); fixes applied to the RD at the user's direction
> **Iteration**: 1 (first scan of RD-02; numbering continues from the RD-01 scan → PF-009…PF-013)
> **Artifact**: Requirements document at `codeops/features/asm-parity/requirements/RD-02-golden-corpus-twin-audit.md`
> **Codebase Grounded**: 14 source/test files deep-read + 4 manifests/configs + 3 scripts + CI workflow; 31 references mapped — 29 verified, 2 failed (PF-009, PF-010); one live `yarn twin:diff` run
> **Last Updated**: 2026-07-18
> **CodeOps Skills Version**: 3.9.0

> Artifact authored in a prior session (no same-session banner). Same-model bias remains
> possible; one independent challenger was run over the MAJOR batch per the hardening
> protocol — it CONFIRMED both findings, widened PF-009 (balloon shares the defect), and
> amended PF-010's resolution (multi-disposition groups, manifest as routing home).

## Codebase Context Summary

**Tech Stack:** unchanged from the RD-01 scan (TypeScript ESM monorepo, ACME + VICE 3.10 local, ACME-only CI).
**Key Files Examined:** `test-harness/src/budgets.spec.test.ts`, `src/gate.spec.test.ts`, `src/fixture.ts`, `src/run/measure.ts`, `src/testing/{balloon,gate,rasterpoll}.ts`, `src/golden-rasterpoll.spec.test.ts`, `test/golden/{twins.json,budgets.json}`, `scripts/twin-diff.mjs`, root `test/` tier, `examples/balloon/balloon.asm` + all 14 `examples/` dirs, `ci.yml`, root `package.json`, `vitest.config.ts`, GitHub issues #49–#64 (all open).
**Key Observations:**
- Live `yarn twin:diff` reproduces the RD's headline exactly: balloon 3.26× bytes / 3.91× static cycles; ~20 fine-grained divergence rows for the single pair, detail strings embedding volatile instruction counts.
- All RD-01 instruments the RD consumes verified present and as described (`measureCycles`/`quiesce`, `budgets.json` measured ratchet 162, `twins.json` shape, CLI-gated script exports, informational CI step).
- `setupEmulator` already supports a bare `.prg` + label file (`fixture.ts:22-33`) — twin launching needs no driver changes, as the RD claims.
- VICE observable suites exist for gate + the 12 slices; **none** for rasterpoll or balloon (`buildRasterpoll`/`buildBalloon` consumed only by the budget tier; zero `assertMemory` there) → PF-009.
- `testing/<fixture>.ts` helpers are builders only; assertions live inline in the fixture spec tests, mixing observables with implementation probes (`gate.spec.test.ts:48,54-55`) → PF-011.
- Measured tier asserts ≤ budget, not equality (`budgets.spec.test.ts:311-317`) → PF-012.
- Scoreboard's generated sides build from on-disk `examples/` dirs while fixture tiers build inlined sources; no sync guard (gate verified currently in sync by hand) → PF-013.

## Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|------------------|
| 1 | Ambiguities | 2 (PF-010, PF-011) | 🟠 |
| 2 | Implicit Assumptions | 0 | — |
| 3 | Logical Contradictions | 0 (PF-010's generated-output-vs-human-judgment edge counted under 1) | — |
| 4 | Completeness Gaps | 0 (PF-009/PF-010 completeness edges counted at their primary dimensions) | — |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | 0 | — |
| 7 | Testability | 0 | — |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 1 (PF-012) | 🟡 |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | 0 | — |
| 13 | Codebase Alignment | 2 (PF-009, PF-013) | 🟠 |

**Ambiguity Register respected (not re-litigated):** AR #15–#19 all honored. PF-009 widens AR #16's recorded gap with new codebase information (neither pair side has observable coverage); PF-010 operates entirely inside AR #18's chosen two-layer design (storage/keying/enforcement were never decided); PF-012 extends AR #15's committed-data rule with an honesty mechanism. Addenda recorded in the register (AR-15, AR-16, AR-18).

## Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| MAJOR | 2 | all resolved, fixes applied |
| MINOR | 3 | all resolved, fixes applied |
| OBSERVATION | 0 | — |

---

### PF-009: Two of the 14 pairs have no fixture-side observable assertion set to share 🟠 MAJOR

**Dimension:** 13 — Codebase Alignment (Phantom Reference) + Completeness
**Location:** RD-02 §F2, §Twin authorship contract, §Twin verification tier, AC-2
**Codebase Evidence:** `buildRasterpoll`/`buildBalloon` consumed only by `budgets.spec.test.ts` (zero memory-observable assertions); `golden-rasterpoll.spec.test.ts` is emitted-text-only; VICE observable suites exist for gate + 12 slices only.
**The Problem:** F2/AC-2's "identical observable assertions as its golden fixture's spec test" (single-sourced, two consumers) is unsatisfiable for rasterpoll and balloon — no fixture-side assertion set exists to be identical to; the Technical Requirements' "assertion sets move into the shared helpers" premise is false for those two. Challenger widened the original rasterpoll-only draft to include balloon.
**Recommendation:** Option A — author the two observable sets in the shared helpers and add fixture-side VICE spec cases consuming them, so single-source/two-consumers holds for all 14 pairs. (Option B — twin tier runs both sides — viable but hides fixture coverage; exemption rejected as one-sided equivalence.)
**User Decision:** Resolved — User accepted recommendation (Option A). Fixes applied: F2 scope, twin contract, tier section, AC-2, affected areas, Scope Decisions row, AR-16 addendum.

---

### PF-010: Routing dispositions had no committed home, no defined granularity, and no enforcement mechanism 🟠 MAJOR

**Dimension:** 1 — Ambiguities (+ Completeness and an internal-contradiction edge)
**Location:** RD-02 §F6, §Divergence routing record, §Scoreboard generator, AC-3/AC-4/AC-5
**Codebase Evidence:** `twin-diff.mjs:97-168` emits flat per-row divergences with count-bearing detail strings (live run: `LDA: 107 generated vs 26 hand-written`), volatile under every codegen change.
**The Problem:** (1) The scoreboard is deterministic generated output (AC-3/AC-4) yet was to "record" human routing judgments — with no named committed input artifact. (2) "Divergence group" was undefined; detail-string keys would churn on every optimization landing, and one aggregate row can have multiple root causes (F8's unrolled-pokes case), making a singular disposition structurally unsatisfiable. (3) AC-5's "zero unclassified" had no enforcement point and would silently decay after the audit.
**Recommendation:** Option A (challenger-amended) — group = pair × mechanical category (details display-only); committed `routing` block per pair in `twins.json` (existing fail-loud loader); ≥1 disposition per group, each non-parity one linking an issue; generator exits non-zero naming unrouted groups, making AC-5 a permanent mechanism via the CI freshness step. (Per-row detail-hash keying rejected as churn-prone; hand-maintained scoreboard region rejected as conflicting with AR #17's whole-file freshness.)
**User Decision:** Resolved — User accepted recommendation (Option A). Fixes applied: F6, F4, manifest + generator + routing-record sections, AC-5, Scope Decisions row, AR-18 addendum.

---

### PF-011: "Identical observable assertions" didn't distinguish observables from implementation probes 🟡 MINOR

**Dimension:** 1 — Ambiguities
**Location:** RD-02 §F2, §Twin authorship contract, AC-2
**Codebase Evidence:** `gate.spec.test.ts:48` asserts `_main`'s first opcode byte (`$A9`); `:54-55` asserts PC at `_main` — generated-code probes that, applied literally to a twin, would force the mechanical translation F1 forbids.
**Recommendation:** Single viable path — boundary sentence: shared sets are memory observables only; implementation-coupled assertions stay fixture-suite-local.
**User Decision:** Resolved — User accepted. Fixes applied: F2, twin contract, AC-2, Scope Decisions row, AR-16 addendum.

---

### PF-012: Scoreboard "measured" columns read ratchet ceilings as measurements — slack budgets misreport silently 🟡 MINOR

**Dimension:** 9 — Edge Cases (+ Codebase Alignment)
**Location:** RD-02 §F4, §F7, AC-3/AC-6
**Codebase Evidence:** `budgets.spec.test.ts:311-317` asserts measurement ≤ budget only; an improvement landed without a deliberate tighten (AR #12) leaves the budget above reality, and the scoreboard would publish the stale ceiling as "measured". Twin-side manifest reference had the same audit-day-snapshot exposure.
**Recommendation:** Option A — local tiers assert exact equality (generated measurement == `budgets.json` value; twin measurement == manifest reference). (Option B — relabel the column — rejected as leaving the headline number stale.)
**User Decision:** Resolved — User accepted recommendation (Option A). Fixes applied: F4, F7, AC-6, Scope Decisions row, AR-15 addendum.

---

### PF-013: Nothing pinned the inlined fixture sources to the on-disk `examples/` dirs the scoreboard builds from 🟡 MINOR

**Dimension:** 13 — Codebase Alignment (drift risk)
**Location:** RD-02 §F3/§F4 (manifest `source` dirs)
**Codebase Evidence:** `twin-diff.mjs:176-197` builds generated sides from `examples/<fixture>/` dirs; fixture and budget tiers build the inlined sources in `testing/<fixture>.ts`; only `balloon.ts` reads from disk; no sync test exists (gate verified currently in sync by hand).
**Recommendation:** Single viable path — sync spec test asserting each inlined source equals its `examples/<fixture>/main.blend`. (Routing the generator through the TS helpers rejected: couples an `.mjs` script to test-internal modules.)
**User Decision:** Resolved — User accepted. Fixes applied: F3, AC-1, Scope Decisions row.

---

# Preflight Report: RD-04 — Compare-and-Branch Fusion

> **Status**: ✅ PREFLIGHT PASSED — all 4 findings resolved (0 critical, 2 major, 1 minor, 1 observation); fixes applied to the RD same-session at the user's direction
> **Iteration**: 1 (first scan of RD-04; numbering continues from the RD-02 scan → PF-014…PF-017)
> **Artifact**: Requirements document at `requirements/RD-04-compare-and-branch-fusion.md`
> **Codebase Grounded**: 9 source files deep-read (translate.ts, lower.ts, instruction.ts, model-adapter.ts, optimize-il.ts, peephole.ts, termination.ts survey, rasterpoll golden + twin) + spec/02-type-system.md + harness manifests; 23 references mapped — 21 verified, 2 failed (PF-014, PF-015)
> **Last Updated**: 2026-07-19
>
> ⚠️ **SAME-SESSION REVIEW**: this RD was authored earlier in the same session. Same-agent
> bias risk is elevated; the independent hardening challenger (one spawn, MAJOR batch per
> protocol) was run to counteract it — it CONFIRMED both MAJORs, sharpened PF-014 (found the
> `termination.ts:56` silent dangling-label path), and strengthened PF-015 (execution-tier
> coverage hole for the new short-circuit path).

## Codebase Context Summary

**Tech Stack:** TypeScript ESM monorepo (Yarn v1 + Turbo, Vitest, Node 22); `@blend65/codegen` IL → 6502 instr pipeline; ACME + VICE local tiers.
**Key observations:**
- Comparisons materialize 0/1 via four framings (`translate.ts:1022-1193`); `brcond` reloads/retests (`translate.ts:555-558`); the fusion seam is named in code comment `translate.ts:526-529`.
- `&&`/`||` are SFA-slot value diamonds (`lower.ts:1261-1285`); slot preorder counted position-independently in `frontend/src/sfa/model-adapter.ts:107-139` with loud drift verification.
- No IL-level validator exists (only `instr/validate.ts` stream legality + `termination.ts` analyses; dangling labels deliberately ignored at `termination.ts:56`) → PF-014.
- Corpus `&&`/`!`/signed-compare usage is value-context only (slice6); no condition-position compound/negated/signed shapes anywhere → PF-015.
- `peek` lowers to one constant-address `load` (`lower.ts:2303-2305`) — the RD's MMIO count/order claim verified.
- `spec/02-type-system.md:36` confirms N⊕V signed-comparison framing (RD citation valid).

## Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|-----------------|
| 7 | Testability | 1 (PF-015, w/ Completeness edge) | 🟠 |
| 12 | Consistency | 1 (PF-016) | 🟡 |
| 13 | Codebase Alignment | 2 (PF-014 phantom reference; PF-017 counted here) | 🟠 |
| others | 1–6, 8–11 | 0 | — |

**Ambiguity Register respected (not re-litigated):** AR #20–#25 all honored. PF-014 operates inside AR #23's chosen mechanism (the terminator's *verification* story was never decided); PF-015 extends AR #24's supersession with named test homes + one new pair (existing twins still never change); PF-016/PF-017 are wording-precision fixes.

## Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| MAJOR | 2 | all resolved, fixes applied |
| MINOR | 1 | resolved, fix applied |
| OBSERVATION | 1 | resolved, fix applied |

---

### PF-014: "IL validator" is a phantom component 🟠 MAJOR

**Dimension:** 13 (Codebase Alignment — Phantom Reference)
**Location:** RD-04 Technical Requirements (IL terminator touch set) + AC-10 + Security section
**Codebase Evidence:** no validator under `packages/codegen/src/il/`; `instr/validate.ts` checks opcode/mode legality post-translation only; AC-10's malformations are unrepresentable in the discriminated unions (`il/instruction.ts:102-109, 159-168`); the one representable hazard — a branch target resolving to no block — is silently ignored today (`termination.ts:56`) and surfaces only as an ACME symbol error.
**The Problem:** AC-10 asserted a mitigation that does not exist; the touch set sent the planner hunting for a component to invent or silently drop.
**Recommendation:** reword to the real mechanisms (type-level unrepresentability + translator ICE + framing×polarity spec tests) plus one targeted new requirement: translation-time ICE on a dangling terminator target — the tripwire the new branch-context recursion actually needs.
**User Decision:** Resolved — User accepted recommendation. Fix applied (touch set, Security section, AC-10 reworded; dangling-target ICE added).
`Confidence: High · Challenger: converged — and contributed the dangling-label finding`

### PF-015: AC-3/4/5/7 assert program shapes with no test home 🟠 MAJOR

**Dimension:** 7 (Testability) + 4 (Completeness Gaps)
**Location:** RD-04 Acceptance Criteria 3, 4, 5, 7
**Codebase Evidence:** no corpus program contains condition-position `&&`/`!`/signed compares — slice6's are all value-context (`testing/slice6.ts:51-60`); RD-01's ACs name their homes, RD-04's did not. After this RD, slice6's VICE evidence exercises only the old value-diamond path, leaving the new slot-free short-circuit path with zero execution-tier coverage — and no scoreboard row would evidence the "worst divergence" fix.
**Recommendation:** name the unit-tier homes (`il/control-flow-lowering.spec.test.ts`, `instr/translate.spec.test.ts`, `instr/generate.golden.spec.test.ts`) AND add one small corpus fixture (compound guard + `!` + signed compare + peek-in-right-clause) with golden, twin, observables, routing, and scoreboard row. (Lean alternative — unit homes only, fixture routed to RD-05 closeout — presented and not chosen.)
**User Decision:** Resolved — User accepted recommendation. Fix applied (new Must-Have "Acceptance shapes have named homes"; AC-8 and the RD-02 integration point amended).
`Confidence: Med-High · Challenger: converged on severity; pushed fixture inclusion`

### PF-016: Instruction-count inconsistency (11 vs 9) 🟡 MINOR

**Dimension:** 12 (Consistency)
**Location:** RD-04 Feature Overview vs AC-1
**Codebase Evidence:** `rasterpoll.asm.golden` loop blocks = 9 static instructions; executed poll path = 6 instructions ≈ 17 cycles (issue #50's "11" is a session-era count).
**User Decision:** Resolved — User accepted recommendation. Fix applied (overview grounded to 9 static / ≈17 cycles executed vs the twin's 3 / 9).

### PF-017: Rationale for the narrow condition-position definition 🔵 OBSERVATION

**Dimension:** 13 (Codebase Alignment — clarity guard)
**Location:** RD-04 "SFA slot preorder updated in step" Must Have
**User Decision:** Resolved — User accepted recommendation. Fix applied (one sentence: for-bounds are numeric; switch discriminants are value-position — the definition deliberately names only the three condition statements).
