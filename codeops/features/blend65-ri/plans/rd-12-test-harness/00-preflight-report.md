# Preflight Report: RD-12 — Test Harness & Emulator Verification (plan)

> **Status**: ✅ PASSED — all 4 findings resolved (fixes applied 2026-07-03)
> **Iteration**: 1 (first scan)
> **Artifact**: Implementation plan at `codeops/features/blend65-ri/plans/rd-12-test-harness/`
> **Codebase Grounded**: 14 source/test files examined; live probes of VICE 3.10 + ACME 0.97; 1 live `--vicelabels` reproduction
> **Last Updated**: 2026-07-03
> **Review independence**: Fresh (post-`/clear`) session; not same-session as plan authoring. Advisor tool unavailable → one independent challenger subagent was run to reconcile the top finding (it refuted the initial "build-blocking" framing; severity was lowered on primary-source evidence).

### Codebase Context Summary

**Tech Stack:** TypeScript (ESM/NodeNext, ES2023, strict), Yarn v1 workspaces, Turborepo, Vitest, ESLint v9. 10 `@blend65/*` packages.
**Architecture:** AOT 6502 compiler pipeline. `@blend65/test-harness` is a clean-slate stub (`src/index.ts` = `VERSION` only) depending on `@blend65/core`. RD-15 facade (`build`/`BuildResult`), RD-09 `parseLabelFile`, RD-17 `RT_ROUTINES` (core) + `loadRuntimeModule` (codegen), and the interim `mos6502-interpreter` are all shipped.
**Key files examined:** `packages/compiler/src/acme/invoke-acme.ts`, `.../label-file.ts`, `.../api/results.ts` (`BuildResult`), `compiler/src/index.ts`, `packages/test-harness/{package.json,tsconfig.json,src/index.ts}`, `compiler/src/runtime-asm.{spec,impl}.test.ts`, `packages/cli/tsconfig.json`, `codegen/src/index.ts`, `core/src/intrinsics/index.ts`, RD-12 requirements (§4.1/§6).

**Live verification performed this session:**
- `x64sc (VICE 3.10)` and `acme 0.97` both on PATH — confirmed.
- `acme --help`: `-l/--symbollist` = ACME-native format; `--vicelabels FILE` = VICE format. **DEF-2 confirmed real.**
- Live `acme --vicelabels` reproduction: emits `al C:080d .__startup`, `al C:0811 ._main`, and **`al C:0002 .__zp_arg_0`** — i.e. zero-page addresses are emitted as **4 hex digits**, so `parseLabelFile`'s `C:([0-9a-fA-F]{4})` regex matches ZP symbols too. **The plan's DEF-2 fix and label-format claims are accurate.**

**Reference verification:** All major references verified. `BuildResult` public (`api/results.ts:45`, re-exported `compiler/src/index.ts:36`); `parseLabelFile` public (`compiler/src/index.ts:30`); `RT_ROUTINES` from `@blend65/core` (`core/src/intrinsics/index.ts:24`); `loadRuntimeModule` from `@blend65/codegen` only (`codegen/src/index.ts:17` → `runtime/embed.ts:99`), **not** re-exported by the compiler barrel; `EmulatorDriver`/`Registers`/`LaunchOptions` match RD-12 §4.1 verbatim; VICE binary-monitor opcodes match the real 3.7+ protocol; DEF-2 argv `-l` asserted only in `invoke-acme.impl.test.ts:49` (an impl test, handled by task 0.1.5) — no spec oracle pins it.

### Summary by Dimension

| # | Dimension | Findings | Highest |
|---|-----------|----------|---------|
| 1 | Ambiguities | 0 | — |
| 2 | Implicit Assumptions | 1 (PF-001) | 🟡 |
| 3 | Logical Contradictions | 1 (PF-001) | 🟡 |
| 4 | Completeness Gaps | 1 (PF-001) | 🟡 |
| 5 | Dependency Issues | 1 (PF-001) | 🟡 |
| 6 | Feasibility | 0 | — |
| 7 | Testability | 2 (PF-003, PF-004) | 🔵 |
| 8 | Security | 0 | — |
| 9 | Edge Cases | 1 (PF-002) | 🟡 |
| 10 | Scope Creep | 0 | — |
| 11 | Ordering | 0 | — |
| 12 | Consistency | 1 (PF-001) | 🟡 |
| 13 | Codebase Alignment | 1 (PF-001) | 🟡 |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 0 | — |
| 🟠 MAJOR | 0 | — |
| 🟡 MINOR | 2 | ✅ all resolved |
| 🔵 OBSERVATION | 2 | ✅ all resolved |

---

### PF-001: Undeclared `@blend65/codegen` dependency + omitted tsconfig references + inaccurate dep-budget claims 🟡 MINOR

**Dimension:** 5 (Dependency Issues) / 13 (Codebase Alignment) / 3 (Contradictions) / 12 (Consistency)
**Location:** `03-04-golden-package-runtime.md:72`; `00-ambiguity-register.md:37` (AR-H11); `03-04:98` + `00-index.md:117` (CLAUDE.md dep-table update); `99-execution-plan.md` tasks 1.1.1 / 3.3.2; `packages/test-harness/tsconfig.json`.
**Codebase Evidence:** `loadRuntimeModule` is exported **only** from `@blend65/codegen` (`packages/codegen/src/index.ts:17` → `runtime/embed.ts:99`); the compiler barrel (`packages/compiler/src/index.ts`) does **not** re-export it. The proven interpreter test imports it directly `from "@blend65/codegen"` (`compiler/src/runtime-asm.impl.test.ts:25`) — and `@blend65/compiler` declares codegen as a dep; the plan lifts that pattern into test-harness without carrying the edge. Repo convention: every package's `tsconfig.json` `references` mirrors its `package.json` deps 1:1 (`packages/cli/tsconfig.json` refs compiler/config/core for its three deps).

**The Problem:** The RD-17 routine-vector suite (`runtime-routines.spec.test.ts`, ST-30..33) assembles routines "via `@blend65/codegen` `loadRuntimeModule`" (`03-04:72`), but every dependency-wiring instruction in the plan adds **only** `@blend65/compiler`. Consequences:
1. `@blend65/test-harness` acquires an **undeclared** dependency on `@blend65/codegen` (used only in its own `.spec.test.ts`, so **test-scope**).
2. AR-H11 (`00-ambiguity-register.md:37`) affirmatively states *"The only new `@blend65` dep is `@blend65/compiler`"* — **internally contradicted** by the planned codegen import.
3. The planned CLAUDE.md dep-table edit writes `test-harness → core, compiler` (`03-04:98`) — inaccurate; the package also imports codegen.
4. `packages/test-harness/tsconfig.json` `references` (currently `[{path: ../core}]`) is never updated for the added dep(s), breaking the repo's 1:1 convention.
5. Minor doc slip: `03-04:72` implies `RT_ROUTINES` comes from codegen; it is exported from `@blend65/core` (`core/src/intrinsics/index.ts:24`).

**NOT build-blocking** (verified via challenger + primary sources): under Yarn-classic hoisting a bare cross-package import resolves through `node_modules`, and turbo `^build` builds codegen transitively via the compiler edge; the repo explicitly documents that neither package.json deps nor tsc project references gate these imports (`eslint.config.mjs:7-9`, `test/boundary.spec.test.ts:8` — the reason R15 needs an ESLint guard). So the plan would build/typecheck/lint/run. The defect is **manifest correctness + spec self-consistency** for a *publishable* package and the *load-bearing R15 dependency table*.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Declare `@blend65/codegen` as a **devDependency** (test-only), add `../codegen` + `../compiler` to `test-harness/tsconfig.json` references, and correct AR-H11 + the CLAUDE.md dep-table note to reflect the real edges | Honest manifest for a published pkg; matches the interpreter-test pattern exactly; keeps convention 1:1 | Adds a third `@blend65` edge (test-scope) that AR-H11's "zero extra deps" framing must concede |
| B | Re-export `loadRuntimeModule` from the `@blend65/compiler` public barrel so test-harness needs only compiler | test-harness stays two-dep; AR-H11 stays literally true | Widens compiler's public API to expose a codegen internal for one test's benefit; muddies the RD-09 barrel's purpose |
| C | Assemble `__rt_*` via the compiler `build()`/`emitAsm` facade (tiny program per intrinsic) instead of `loadRuntimeModule` | No codegen edge at all | More indirect/complex; diverges from the proven interpreter-test pattern; harder to isolate a single routine's bytes |

**Recommendation:** Option **A** — the harness genuinely uses a codegen function; declaring it (dev-scope) + fixing the two doc artifacts + the tsconfig refs is the truthful, lowest-surprise fix and mirrors exactly how `@blend65/compiler`'s own equivalent test is wired. B pays a permanent public-API cost to preserve a slogan; C adds indirection. (Confirm dev-vs-runtime by whether `dist` excludes `*.test.ts`; if test files ship, make it a regular dependency.)

**Confidence:** High on the facts (all live-verified); Medium on severity calibration (see below). **Hardening:** initial call was MAJOR/"build-blocking"; an independent challenger refuted build-blocking with repo primary sources, so lowered to MINOR (manifest/consistency defect, zero consumer-facing impact).

**User Decision:** ✅ Resolved — user: "fix all". Applied **Option A**: declared `@blend65/codegen` (test-scope devDep) + `../compiler`/`../codegen` tsconfig references; corrected AR-H11, AR-H17, the CLAUDE.md dep-table note, and the `RT_ROUTINES`-source wording across the plan.

---

### PF-002: Gate & RD-17 suites gate on `skipIf(!hasVice())` but also require ACME to assemble 🟡 MINOR

**Dimension:** 9 (Edge Cases) / 7 (Testability)
**Location:** `03-04-golden-package-runtime.md:63-83` (gate + runtime-routines suites); `07-testing-strategy.md:105-106`; `99-execution-plan.md` 3.1.3 / 3.1.4.
**Codebase Evidence:** The gate test runs `build(...)` (needs ACME) and the RD-17 test assembles each routine with ACME (mirroring `compiler/src/runtime-asm.impl.test.ts:64`, which **skips on `ACME === null`**, `runtime-asm.spec.test.ts:56`). Both harness suites are planned as `describe.skipIf(!hasVice("c64"))` only — no ACME guard.

**The Problem:** These suites need **both** VICE (run) and ACME (assemble). Gating only on VICE means: CI (ACME present, VICE absent) → skips cleanly ✅; local dev with both → runs ✅; but a dev with **VICE installed and ACME absent** → the suite runs and **errors** (no binary produced) instead of skipping. The interim interpreter test guards on ACME precisely for this reason; the harness suites drop that guard. Low likelihood, trivial to fix.

**Options:** (only one viable path; alternatives are strawmen)
- **A (recommended):** Gate the compile-bearing suites on `skipIf(!hasVice() || !hasAcme())` — reuse the `findAcme()` precedent from the interpreter test. One extra predicate; matches the established skip pattern.
- Considered and dropped: "leave as-is, both are present locally" — true today but silently brittle and contradicts the plan's own AC-13 graceful-skip intent; "assume ACME always co-installed with VICE" — no such guarantee.

**Recommendation:** Option **A**. **User Decision:** ✅ Resolved — user: "fix all". Applied **Option A**: gate + RD-17 suites now `skipIf(!hasVice() || !hasAcme())`; `hasAcme()` added as an exported sibling helper.

---

### PF-003: ST-02 pins build-sensitive exact addresses in an immutable spec oracle 🔵 OBSERVATION

**Dimension:** 7 (Testability)
**Location:** `07-testing-strategy.md:32` (ST-02: `symbolMap.get('_main') === 0x0819`, `__startup === 0x080d`); `03-01-def2-label-fix.md:53-60`.
**Codebase Evidence:** Live independent assemble placed `__startup` at `$080d` (matches) but `_main` at a different address than `$0819` for a *different* body — confirming `_main`'s address is a function of the BASIC-stub + `__startup` body length and ZP allocation, i.e. it shifts on unrelated codegen changes. The DEF-2 regression intent (non-empty map containing `_main`/`__startup`) is already fully covered by ST-01 (`07-testing-strategy.md:31`).

**The Problem:** ST-02 is an *immutable spec oracle* asserting a magic address that any future RD-07c/allocator change would break — for reasons unrelated to the label-format defect it guards. Since ST-01 covers the regression, ST-02's exact-address assertion adds fragility for little marginal value.

**Recommendation (single viable path):** Keep ST-01 as the DEF-2 oracle; either move ST-02's exact-address check to an **impl** test (mutable, fine to update when codegen shifts) or assert `_main`/`__startup` against the addresses the *same build's* report emits rather than hardcoded constants. Considered and dropped: deleting the address check entirely (loses a useful smoke check). Non-blocking; the values are live-pinned and will pass today.

**User Decision:** ✅ Resolved — user: "fix all". ST-02 reduced to a defined-address/load-region assertion (immutable); exact `$0819`/`$080d` values moved to a build-sensitive `vice-label.impl.test.ts` smoke check.

---

### PF-004: `runFrames` frame accuracy is approximate; ST-22 only checks "no timeout" 🔵 OBSERVATION

**Dimension:** 7 (Testability)
**Location:** `03-03-run-strategies-fixture.md:64-66` (runFrames via instructions-per-frame estimate); `07-testing-strategy.md:67` (ST-22).
**The Problem:** `runFrames(N)` is implemented as an instructions-per-frame estimate (`c64 ≈ 19656 cycles/frame`, coarse instruction batch), and its only spec case (ST-22) asserts it "resolves without timeout" — it never verifies that *N frames actually elapsed*. AC-04 ("runs N frames") is therefore weakly verified. The plan acknowledges the MVP-coarse approximation.

**Recommendation (single viable path):** Accept for MVP but record the imprecision explicitly, or strengthen ST-22 to check a frame-linked observable (e.g. VIC-II raster or a `DISPLAY_GET` frame delta) if a cheap one exists in the VICE monitor. Considered and dropped: building exact cycle-accurate frame counting now (scope creep beyond the MVP registry). Non-blocking.

**User Decision:** ✅ Resolved — user: "fix all". Documented the frame approximation explicitly in 03-03 + ST-22; a cycle-exact frame primitive recorded as a post-MVP refinement.

---

## Adversarial checklist (same-model bias)

- *Assumption I might be confirming:* that the DEF-2 live claims are true — **independently reproduced** `--vicelabels` this session rather than trusting the plan.
- *External standard risk:* VICE binary-monitor opcodes — cross-checked the plan's command table against the real 3.7+ protocol; they match (incl. `EXIT 0xaa`=leave monitor/continue, `QUIT 0xbb`=quit emulator).
- *What a dissenting expert would flag:* the codegen manifest edge (PF-001) — surfaced and reconciled with a challenger.

## Verdict

No CRITICAL or MAJOR findings. The plan is well-grounded, live-verified, and internally traceable. Pending user decisions on 2 minor + 2 observation findings → **PASSED** (if PF-001/PF-002 resolved) or **PASSED WITH NOTES** (if any accepted as-is).
