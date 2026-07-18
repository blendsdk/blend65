# Preflight Report: RD-01 Parity Measurement Infrastructure — Implementation Plan

> **Status**: ✅ PREFLIGHT PASSED — all 11 findings resolved (1 critical, 1 major, 7 minor, 2 observation); user accepted every recommendation 2026-07-18 02:01; fixes applied to the plan documents same-session (all 11 docs updated; task total 50 → 52; ST-32/ST-33 added).
> **Iteration**: 1 (first scan of the plan; the requirements scan is `../../requirements/00-preflight-report.md`)
> **Artifact**: Implementation plan at `codeops/features/asm-parity/plans/rd-01-parity-measurement-infrastructure/` (11 documents)
> **Codebase Grounded**: 25+ source files examined; all ~27 of the plan's file/line references verified correct
> **Last Updated**: 2026-07-18
> **CodeOps Skills Version**: 3.9.0

> ⚠️ **SAME-MODEL REVIEW**: The plan was authored earlier today by the same model family;
> this scan ran in a fresh context (post-`/clear`) with independent reconnaissance, and a single
> independent challenger agent reviewed the CRITICAL/MAJOR batch per the hardening protocol
> (verdicts folded into PF-009/PF-010).

> **Numbering**: continues the feature's PF sequence. The requirements report ended at PF-008,
> and the plan documents cite "PF-001…PF-008" meaning those findings — restarting at PF-001
> here would collide, so this report starts at **PF-009**.

## Codebase Context Summary

**Tech Stack:** TypeScript ESM monorepo (Node 22, Yarn v1 workspaces, Turbo, Vitest, ESLint 9); ACME 0.97 + VICE 3.10 local; ACME-only CI (AR-27).
**Architecture:** 10 `@blend65/*` packages; test-harness drives VICE `x64sc` over the binary monitor (`vice-driver.ts` + pure codec `protocol.ts`); goldens byte-exact under `packages/test-harness/test/golden/`; resource report assembled in `compiler/src/api/build.ts:86` from owner-grouped inputs.
**Key Files Examined:** `test-harness/src/emulator/vice/{vice-driver,protocol}.ts`, `emulator/driver.ts`, `run/strategies.ts`, `fixture.ts`, `testing/slice8b.ts`, `golden-slice8b.spec.test.ts`, `test/golden/slice8b.asm.golden`, `core/src/report/{resource-report,build-resource-report,render-report-terminal,render-report-json}.ts`, `core/src/instr-model/{opcode,addressing-mode}.ts`, `core/src/index.ts` + `core/package.json` (exports map), `codegen/src/instr/{cpu-table,instr-program,opcode}.ts`, `platforms/src/shared-hooks.ts`, `compiler/src/acme/invoke-acme.ts`, `examples/balloon/{main.blend,balloon.asm}`, root `package.json`, `.github/workflows/ci.yml`, `test-harness/vitest.config.ts`, `scripts/gen-capability-matrix.mjs`, repo-root `test/`.
**Key Observations:**
- Every line-number claim in `02-current-state.md` verified exact (buildArgs :83, advanceInstructions :211, CMD table :27-42, withTimeout :40, hasVice :55, startup fields :86-88, terminal startup line :111-112, W65C02 select :181, fileParallelism :18, ACME install :39-40, …).
- `advanceInstructions`/`executeUntilReturn` await only the response frame (`vice-driver.ts:211,238`) — the race-fix premise is consistent with the code; `resume()` correctly waits for STOPPED.
- Neither budget-window program carries interrupt discipline: the startup shim is `LDA #$36 / STA $01` only (`platforms/src/shared-hooks.ts:137-140`, `slice8b.asm.golden:36-43`); `balloon.asm` has no `SEI` → KERNAL CIA-1 IRQ is live in all measured-window programs (basis of PF-009).
- `Opcode`/`AddressingMode` live in `core/src/instr-model/` surfaced via the **`@blend65/core/platform` subpath** (core `package.json` exports; root barrel does not export them); `AddressingMode` values are **PascalCase** (`"AbsoluteX"`).
- `NMOS_OPCODES` (56, as-const) already exists (`opcode.ts:25-33`) — `NmosOpcode` is derivable directly.
- Every real build already emits `--vicelabels` AND `--report` (`compiler/src/acme/invoke-acme.ts` `acmeArgv`) — relevant to PF-010's resolution.
- `setupEmulator` allocates the monitor port ephemerally via `freePort()` (`fixture.ts:69-79,133`); `withTimeout` is module-private (`strategies.ts:40`); `memorySetBody` hardcodes the side-effects byte to 0 (`protocol.ts:147`).

**Reference Verification:** ~27 plan references mapped to code — all verified; no phantom references found.

## Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|------------------|
| 1 | Ambiguities | 1 (PF-015) | 🟡 |
| 2 | Implicit Assumptions | 2 (PF-013, PF-019) | 🟡 |
| 3 | Logical Contradictions | 1 (PF-009) | 🔴 |
| 4 | Completeness Gaps | 2 (PF-010, PF-012) | 🟠 |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | 0 | — |
| 7 | Testability | 0 standalone (PF-009 secondary) | — |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 1 (PF-017) | 🟡 |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | 1 (PF-011) | 🟡 |
| 13 | Codebase Alignment | 3 (PF-014, PF-016, PF-018) | 🟡 |

**Ambiguity Registers respected (not re-litigated):** req-AR #1…#14 and plan-AR #1…#11. PF-009 does not challenge plan-AR #10's phase-locking contract — it shows the chosen budget windows do not satisfy that contract's own definition (new information: CIA-vs-raster phase drift and badline-count-vs-start-phase, which the PF-003/plan-AR #10 reasoning did not consider). PF-010's recommended resolution extends req-AR #8's own rationale rather than contradicting it.

## Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 1 | resolved — recommendation accepted |
| MAJOR | 1 | resolved — recommendation accepted |
| MINOR | 7 | resolved — recommendations accepted |
| OBSERVATION | 2 | resolved — recommendations accepted |

---

### PF-009: Measured budget windows are not phase-locked — the determinism contract does not cover the two windows it gates 🔴 CRITICAL

**Dimension:** 3 — Logical Contradictions (also 7 — Testability, 13 — Codebase Alignment)
**Location:** `03-03-budget-tier.md` §Proposed ("Windows are phase-stable by construction (plan-AR #10…)"), `07-testing-strategy.md` ST-19, `00-ambiguity-register.md` plan-AR #10 resolution note
**Codebase Evidence:** `slice8b.asm.golden:36-43` — startup shim is `LDA #$36 / STA $01 / JSR __init / JSR _main`; no `SEI`, no `$DC0D`, no `$D011` anywhere in the file. `examples/balloon/main.blend` / `balloon.asm` — no interrupt discipline either. `platforms/src/shared-hooks.ts:130-157` — the shim cannot emit `SEI` in any variant.
**The Problem:** `03-02` defines phase-locked as "interrupts disabled + display state settled, or the program installs its own raster IRQ", and plan-AR #10 grants cross-process determinism **only** to such windows. Neither budget window qualifies: both programs run with the KERNAL CIA-1 timer IRQ live, and the slice8b `copyLoop` window executes during active display (badline territory). The CIA period (16421) drifts 3235 cycles/frame against the PAL raster (19656), and VICE autostart lands at a different absolute cycle per process (plan's own spike) — so a KERNAL IRQ lands *inside* a given window with p ≈ windowLen/16421 per launch (~2% balloon, ~3–10% slice8b, which also risks ±1 badline ≈ ±40 cycles). Consequence: `03-03`'s "phase-stable by construction" claim is false under the plan's own definition, ST-19's "identical across two runs" is probabilistically false, and the exact-ratchet measured gate (req-AR #12) becomes a rarely-but-genuinely flaky gate — the precise defect class PF-003/plan-AR #10 were introduced to eliminate. Spec-first ordering would bake the false oracle into an immutable test before implementation could reveal it.
**Related:** plan-AR #10 (contract respected; its *application* to these windows is the gap), req-AR #12 (exact ratchet — preserved by the recommended fix), RD AC-4 (measured budgets on both windows — preserved).

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | **Harness-side quiesce**: before measuring a budget window, the tier masks CIA-1 IRQs and, for display-area windows (slice8b), blanks the display (DEN off) + settles ≥1 frame; then measures. Mechanism candidates: set the I flag via `REGISTERS_SET` at the from-stop (extend `writeRegisters` to accept `FL` — `vice-driver.ts:221`), or write `$DC0D = $7F` (needs a side-effects-enabled `MEMORY_SET` variant — `protocol.ts:147` hardcodes 0). Document budget-measured numbers as "quiesced machine cycles"; the IRQ-demo fixture (ST-9/ST-10) remains the IRQ-inclusive proof | ST-19 becomes true as written; RD AC-4 and the exact ratchet stay intact; applies the plan's own live-verified phase-lock idiom externally; no changes to example programs or goldens; quiesced measured still catches dynamic regressions static cannot (loop trip counts, branch paths, actual page crossings) | Measured numbers exclude badline/IRQ environment effects; small driver/protocol extensions + contract rewording + amended ST-19 wording |
| B | Keep windows as-is; seed budgets from a worst-case (IRQ-inclusive) observation; document variance | No harness changes | Defeats req-AR #12's exact ratchet; worst case unforceable/unverifiable; tail (IRQ + badline together) still fails eventually — strictly dominated |
| C | Measured ratchets only on the phase-locked IRQ-demo fixture; slice8b/balloon windows become static-only | Simple, honest determinism | Contradicts RD AC-4 (requires measured budgets on both windows) → RD amendment + re-decision; surrenders measured coverage of *generated* code — the point of the RD |

**Recommendation:** Option A — the only option that keeps ST-19, RD AC-4, and the exact-ratchet decision all intact, using the phase-lock idiom the plan itself live-verified (three fresh processes, identical counts). Rejected as non-viable: leaving the plan as written (a determinism gate that is probabilistically flaky by design).
Confidence: High — every load-bearing claim is verified in the tree or in the plan's own spike numbers. Hardening: independent challenger CONFIRMED (real, CRITICAL) and independently picked A, contributing the I-flag/`$DC0D` mechanism analysis, the slice8b-only DEN-blank refinement, and the rebuttal of A's "measured becomes static" cost. Challenger: converged.

**User Decision:** Resolved — User accepted the recommendation (2026-07-18)

---

### PF-010: Instruction-stream & byte-size acquisition is undesigned for two of the three cost consumers 🟠 MAJOR

**Dimension:** 4 — Completeness Gaps (also 13 — Codebase Alignment)
**Location:** `03-03-budget-tier.md` §static windows ("sum straight-line min–max over the window's instructions via `getTiming`"), `03-04-parity-scripts.md` ("parse both instruction streams"; byte ratios), `99-execution-plan.md` tasks 4.2.3 / 5.2.2–5.2.3
**Codebase Evidence:** No parser/classifier component is named anywhere in the plan, and no task creates one. Meanwhile: zeropage-vs-absolute is **undecidable from asm text with symbolic operands** — `LDA __frame_Main_copyBytes_last` (absolute, `$201F`) and the twin's `sta xlo` (zeropage) are syntactically identical shapes with different bytes AND cycles (`slice8b.asm.golden:3-27`, `balloon.asm`). Every real build already produces the exact data needed: `compiler/src/acme/invoke-acme.ts` (`acmeArgv`) passes `--vicelabels` **and** `--report` on every ACME invocation, and `parseLabelFile` is already exported and consumed by the harness (`fixture.ts:17,105`).
**The Problem:** ST-17, ST-18, ST-20, ST-21, and ST-25 — all immutable-oracle spec tests — depend on turning windows of asm text into (opcode, mode) pairs and on assembled byte sizes for both sides of a twin pair, but the plan never says how, where the logic lives, or that twin-diff must run ACME at all. Discovered mid-execution this yields 2–3 improvised parsers, each independently carrying the zp/abs defect, and Phase 4/5 scope is underestimated.
**Related:** req-AR #8 (ACME-report input chosen for the annotator *because* raw-asm parsing of twins is fragile — the same rationale applies to the other two consumers).

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | **ACME-artifact acquisition, homed in `compiler/src/acme/`** (challenger's variant): one `report-file.ts` parser + (opcode, mode) classifier beside `label-file.ts`, typed against core's `instr-model` unions. Budget tier slices the report its bytes-assertion build already produced, by `.lbl` window addresses; twin-diff assembles the hand-written side the same way (ACME in CI; `hasAcme()` guard locally) and takes byte ratios from assembled PRG sizes; annotator consumes the same parser | Final addresses make mode classification AND page-cross detection exact; zero new invocation machinery (`--report` already emitted per build); one strictly-parsed, loudly-failing module serves all three consumers with no new dependency edges (test-harness + both scripts already import the built compiler); extends req-AR #8's own rationale coherently; strengthens ST-17/ST-25 | Makes ACME's report format load-bearing in three consumers (it already is for the annotator; concentrated in one version-gated module); budget tier re-derives modes ACME already resolved |
| B | Pure-text instruction-line classifier in `@blend65/core` (beside `timing/`), consumed by tier + both scripts | One shared component; no ACME needed for static sums | **Defective by construction**: zp/abs undecidable from symbolic operands without assembler-grade symbol resolution (or fragile golden-header mining); ACME text parsing is out of core's domain (core is pure compiler-model data, no tool formats) |
| C | Per-consumer parsers made explicit (tier-local, script-local, annotator report parser), each documented + tasked | Smallest coordination | Duplicates the mode classifier 2–3×, each copy carrying the zp/abs defect under five immutable STs — the worst version of the gap |

**Recommendation:** Option A — resolve the gap by pinning ACME artifacts (report + vicelabels) as the universal acquisition path and homing the parser in `compiler/src/acme/`; amend 03-03/03-04 wording, state twin-diff's ACME invocation + byte-size source explicitly, and add the parser/classifier tasks (+ spec tests) to Phases 4/5.
Confidence: High that the finding is real; Med-High on the homing choice (compiler vs elsewhere is judgment; the zp/abs undecidability favoring report-based acquisition is hard fact). Hardening: challenger CONFIRMED (real, MAJOR) and **diverged constructively** — it refuted the lead's original core-homed text classifier (option B) with the zp/abs argument and proposed A, which the lead adopted after verifying `--report`/`--vicelabels` are emitted on every build and `label-file.ts` is the established precedent. Challenger: diverged — its variant adopted as the recommendation.

**User Decision:** Resolved — User accepted the recommendation (2026-07-18)

---

### PF-011: `getTiming` mode literals are camelCase; the actual `AddressingMode` union is PascalCase 🟡 MINOR

**Dimension:** 12 — Consistency (also 13 — Stale Assumptions)
**Location:** `03-01-timing-table.md` §Code Example, `00-index.md` §Quick Reference, `07-testing-strategy.md` ST-1/ST-2/ST-3
**Codebase Evidence:** `core/src/instr-model/addressing-mode.ts:24-38` — values are `"AbsoluteX"`, `"Relative"`, `"Implied"`, …; the plan writes `getTiming("LDA", "absoluteX")`, `getTiming("BNE", "relative")`.
**The Problem:** 03-01 says "Keys are the existing `instr-model` types", but the pinned spec-test expectations use literals that don't exist in the union. Authoring ST-1…ST-3 as written produces compile errors (caught immediately, but the oracle tables should be correct as written).
**Single viable resolution** (a parallel camelCase key-space was considered and rejected — it would duplicate the mode vocabulary core already owns): correct the literals to the PascalCase union values in 03-01, 00-index, and 07.

**Recommendation:** Apply the correction.

**User Decision:** Resolved — User accepted the recommendation (2026-07-18)

---

### PF-012: Startup-figures plugin→compiler wiring is unnamed 🟡 MINOR

**Dimension:** 4 — Completeness Gaps (also 13 — Impact Blindness)
**Location:** `03-05-resource-report.md` §Proposed item 3–4; `00-index.md` §Related Files (Modified list)
**Codebase Evidence:** `BuildResourceReportInputs.startupSize/startupCycles` exist (`build-resource-report.ts:44-46`) but `build.ts:86-92` never passes them and nothing anywhere produces them; the shim is built per-call by `c64StyleStartupShim(variant, hasInitCode)` (`shared-hooks.ts:130-157`), so its cost is a function of the same runtime arguments. The platform-plugin interface (core `platform/`) has no member carrying startup figures, and no core-platform interface file appears in the Modified list.
**The Problem:** "The platforms package supplies the existing `startupCycles` input" skips the actual design decision: which interface member exposes the figures, computed where, and how `build.ts` threads them. Small but cross-package (core interface + platforms + compiler), and currently invisible in the Modified-files list.

**Recommendation:** Pin the path in 03-05: the plugin computes `{ startupSize, startupCycles }` for its emitted shim (same args as the shim builder, summed via `getTiming` — bytes from `InstrTiming.bytes`), exposed via a small optional member on the platform-plugin contract; `build.ts` threads it into the existing inputs. Add the core platform-interface file to the Modified list.

**User Decision:** Resolved — User accepted the recommendation (2026-07-18)

---

### PF-013: `remoteMonitorPort ?? monitorPort + 1` collides with the fixture's ephemeral port allocation 🟡 MINOR

**Dimension:** 2 — Implicit Assumptions (also 9 — Edge Cases)
**Location:** `03-02-cycle-measurement.md` §Proposed item 2; plan-AR #11 item 3
**Codebase Evidence:** `fixture.ts:69-79` — `setupEmulator` acquires ONE free ephemeral port and passes it as `monitorPort` (`:133`); nothing checks `monitorPort + 1`. The plan's "default 6503" only holds for direct driver use with the 6502 default.
**The Problem:** In the real test path the +1 port is an unchecked ephemeral neighbor; a collision makes the (correctly loud) text-connect launch failure a flaky one. `fixture.ts` is also absent from the Modified-files list even though the remote port must flow through `setupEmulator`.

**Recommendation:** `setupEmulator` acquires a second free port and passes `remoteMonitorPort` explicitly; keep `monitorPort + 1` only as the default for direct driver construction. Add `fixture.ts` to the Modified list.

**User Decision:** Resolved — User accepted the recommendation (2026-07-18)

---

### PF-014: `measureCycles` needs `withTimeout`, which is module-private 🟡 MINOR

**Dimension:** 13 — Codebase Alignment (Impact Blindness)
**Location:** `03-02-cycle-measurement.md` §Proposed item 3 ("withTimeout-guarded end to end"); `00-index.md` Modified list
**Codebase Evidence:** `strategies.ts:40` — `withTimeout` is a non-exported function; its doc header (`:5-7`) states the three strategies "are the ONLY entry points". `run/measure.ts` is a sibling new file.
**The Problem:** The guard the plan mandates is unreachable from `measure.ts` without either exporting it (modifying `strategies.ts` — not in the Modified list, and its "only entry points" doc claim needs updating) or duplicating it (DRY violation).

**Recommendation:** Export `withTimeout` from `strategies.ts` (it is already impl-tested), update that file's doc comment, and add `strategies.ts` to the Modified list.

**User Decision:** Resolved — User accepted the recommendation (2026-07-18)

---

### PF-015: Twin-diff's cycle parity ratio doesn't say which end of the min–max span it uses 🟡 MINOR

**Dimension:** 1 — Ambiguities
**Location:** `03-04-parity-scripts.md` ("byte + straight-line-cycle parity ratios (generated ÷ hand-written, two decimals)"); `07` ST-20
**Codebase Evidence:** Straight-line sums are min–max ranges by definition (branch-taken/page-cross variance — RD AC-2/AR #7); a single two-decimal ratio needs a defined numerator/denominator. Unable to verify a precedent in issue #56's method beyond "bytes & static-cycle ratios" (req-AR #9 wording).
**The Problem:** ST-20 is an immutable oracle; "the" cycle ratio is currently ambiguous (min÷min? max÷max?). Note: under PF-010 option A, page-cross becomes exact from final addresses, so the residual spread is branch-variance only — smaller, but still a range.

**Recommendation:** Pin max÷max as the headline ratio (worst-case cost is the conservative parity metric), with the JSON output carrying both min and max sums per side; state it in 03-04 and ST-20.

**User Decision:** Resolved — User accepted the recommendation (2026-07-18)

---

### PF-016: Where `timing/` surfaces — the root barrel vs the `./platform` subpath its key types live on 🟡 MINOR

**Dimension:** 13 — Codebase Alignment (Convention)
**Location:** `03-01-timing-table.md` ("exported from the core barrel")
**Codebase Evidence:** `core/package.json` exports map has two entries: `.` and `./platform`; `Opcode`/`AddressingMode` are exported ONLY via `./platform` (root barrel `core/src/index.ts:1-11` has no instr-model line); codegen/frontend already import `@blend65/core/platform` (`codegen/src/instr/opcode.ts:11-12`).
**The Problem:** "The core barrel" hides a two-entry-point reality. Exporting `getTiming` from the root while its key types live on `./platform` splits the API across entry points; adding instr-model to the root barrel is a larger surface change with collision risk.

**Recommendation:** Surface `timing/` via the `./platform` subpath, co-located with the types it is keyed by (all planned consumers either already import that subpath or import the built package where the subpath works identically — plan-AR #5 unaffected). State it in 03-01.

**User Decision:** Resolved — User accepted the recommendation (2026-07-18)

---

### PF-017: `measureCycles` leaves its checkpoints armed — second measurement in the same launch breaks 🟡 MINOR

**Dimension:** 9 — Edge Cases
**Location:** `03-02-cycle-measurement.md` §Proposed item 3 (checkpoint lifecycle unstated)
**Codebase Evidence:** `protocol.ts:30-31` — `CHECKPOINT_DELETE` (0x13) exists in the codec but the driver never exposes deletion; `EmulatorDriver` has no delete method. A second `measureCycles` (or any `resume`-based strategy) after the first would stop at the stale checkpoints; the PC assert turns it into a loud-but-confusing error.
**The Problem:** Today's windows are one-per-program, but budgets.json's schema explicitly allows multiple windows per program — the second window in one launch hits this immediately.

**Recommendation:** Specify cleanup: `measureCycles` deletes its two checkpoints on exit (capture ids from the `CHECKPOINT_SET` responses; expose a small driver-specific delete like `writeRegisters` precedent), stated in 03-02 with an impl test.

**User Decision:** Resolved — User accepted the recommendation (2026-07-18)

---

### PF-018: `NmosOpcode` should be derived from the existing `NMOS_OPCODES` tuple 🔵 OBSERVATION

**Dimension:** 13 — Codebase Alignment (near-Redundancy)
**Location:** `03-01-timing-table.md` §Types ("union of the 56 documented NMOS mnemonics, derived from instr-model's `Opcode`")
**Codebase Evidence:** `core/src/instr-model/opcode.ts:25-33` — `NMOS_OPCODES` (56, as-const) already exists precisely for variant partitioning; `NmosOpcode = (typeof NMOS_OPCODES)[number]` is a one-liner with zero new data.
**The Problem (wording only):** "derived from Opcode" invites re-enumerating the subset; the value tuple to derive from already exists.

**Recommendation:** Name `NMOS_OPCODES` as the derivation source in 03-01.

**User Decision:** Resolved — User accepted the recommendation (2026-07-18)

---

### PF-019: The spike evidence underpinning the central mechanism exists only as session artifacts 🔵 OBSERVATION

**Dimension:** 2 — Implicit Assumptions (evidence durability; surfaced by the same-agent adversarial checklist)
**Location:** `00-ambiguity-register.md` plan-AR #1 Resolution Notes ("Spike artifacts live in the session scratchpad")
**The Problem (opportunity):** The stopwatch/coexistence/determinism ground truth — the basis for plan-AR #1/#2/#10 — is recorded only as prose + numbers in the register; the probe scripts themselves are gone when the scratchpad is. If a future VICE breaks the text stopwatch (the named risk in 02 §Risks), re-running the probes is a rebuild-from-prose exercise. ST-7's canned buffers preserve the parsing formats, not the protocol behavior probes.

**Recommendation:** Preserve the probe scripts (or a consolidated `probe-stopwatch.mjs`) under `research/` with a short README of the measured numbers — cheap insurance, not an RD deliverable.

**User Decision:** Resolved — User accepted the recommendation (2026-07-18)
