# Preflight session notes — RD-15 plan (resume file)

> **Saved**: 2026-07-03 · **Iteration**: 1 · **State**: ✅ COMPLETE — PASSED.
> All 13 findings resolved (user "apply all as recommended"), fixes applied to the
> plan docs + register (V20/V21/V22) + report + both roadmap tiers. Iteration-2
> coherence pass clean (no PF-014+). RD-15's next step is **exec_plan**. This file
> is retained as an audit trail; nothing further to resume. See `00-preflight-report.md`
> (Decision Log + Iteration 2 section) for the authoritative record.

## Where we are

1. ✅ Artifact loaded: all 8 plan docs + source RD (`requirements/RD-15-programmatic-cli-api.md`) + Ambiguity Register (19 items, gate passed).
2. ✅ Codebase reconnaissance complete (4 parallel verification agents + targeted follow-ups). ~60 references mapped; details and file lists are in the report's Codebase Context Summary.
3. ✅ 13-dimension scan complete.
4. ✅ Report compiled and saved: `00-preflight-report.md` (same directory) — **13 findings: 0 CRITICAL, 3 MAJOR (PF-001..003), 7 MINOR (PF-004..010), 3 OBSERVATION (PF-011..013)**, each with options + recommendation, all `**User Decision:** Pending`.
5. ✅ Hardening: one independent challenger stress-tested the MAJORs (converged; recalibrated ST-40 finding from MAJOR→MINOR, corrected two framing details — already reflected in the report).
6. ⏸️ **NEXT STEP: collect the user's decision on each PF finding** (they were asked: per-finding or "all as recommended"). Then record decisions in the report, determine pass tier, apply fixes only if explicitly instructed, and if fixes are applied, run iteration 2 starting at PF-014.

## Status: ❌ BLOCKED — 3 MAJOR unresolved (PF-001, PF-002, PF-003)

## One-line finding index (full detail + options in 00-preflight-report.md — read it on resume)

- PF-001 🟠 `--startup` inert + `.asm` `!to` always "main" — missing `assembleProgram` override seam (`codegen/src/instr/instr-program.ts:157` FR-3 comment). Rec: A (additive 4th param + outName hoist into `runFrontend` + startup mapper `minimal→non-terminating` per RD-16 R18 + 2 STs).
- PF-002 🟠 No `cwd` on `CompilerOptions`; `CliIo.cwd` dead; temp-dir STs (ST-6/22/37/38) unimplementable as specified (`config/src/load-config.ts:80,144` already supports cwd). Rec: A (add `cwd?` routing option, RD §4.1 amendment via task-1.1.1 pattern).
- PF-003 🟠 Exit-3 rule false premise: no ACME ICE code exists; `discoverAcme` emits `AcmeNotFound E10035` (normal band); `E90001` generic w/ 6+ non-ACME emitters. Rec: Decision 1 = `isIceCode()` band → 3; Decision 2 = E10035 → exit **1** (R50-literal; alt: 2 with R50 amendment — genuinely user's call). + new ST for not-found path; fix 03-03 text.
- PF-004 🟡 ST-40 in compiler calls `runCli` → package cycle. Rec: relocate to `cli/src/build-e2e.spec.test.ts`.
- PF-005 🟡 `packages/cli/vitest.config.ts` include misses `*.impl.test.ts` → cli impl tests silently never run. Rec: extend include to `{spec,impl}`.
- PF-006 🟡 Plan's `globSync({patterns,…})` is tinyglobby@0.2.17's deprecated overload. Rec: `globSync(include, {ignore, cwd, absolute:true})`.
- PF-007 🟡 GATE_SRC ≠ `examples/gate/main.blend` (`module Main;` + `poke(0xD020, 5)`); ST-15 should expect `Main.main`. Rec: verbatim example content.
- PF-008 🟡 Config diags render header-only (CONFIG_SOURCE_ID=-2 fails `SourceMap.has`). Rec: accept for v1 + runtime AR (AR-P2 seam = follow-up).
- PF-009 🟡 yargs help/version/fail output bypasses `CliIo` under `.exitProcess(false)`; ST-35 breaks with naive parseSync. Rec: pin parse-callback form in 03-03.
- PF-010 🟡 CLI outName re-derivation for `--emit-asm/il` has no data source. Rec: resolved by PF-001-A's hoisting; standalone fix only if PF-001→B.
- PF-011 🔵 CI: add `sudo apt-get update` before `install -y acme`.
- PF-012 🔵 AR-V15 "VERSION synced to manifest" overstated (hardcoded literal assertions only).
- PF-013 🔵 CLAUDE.md package-edge table stale once cli gains `@blend65/core` — fold into task 4.2.4.

## Recon notes (do NOT repeat — key verified facts beyond the report)

- `SourceMap.intern` ids start at 0 (ST-8's `has(0)` fine); `has()` requires id ≥ 0.
- `projectRoot` = `dirname(configPath)` else cwd (`load-config.ts:144`).
- `LowerInput.program` is `readonly ProgramNode[]` — multi-file lowering safe.
- `invokeAcme` passes `-o binaryPath` (invoke-acme.ts:93-94) — binary naming correct regardless of `!to`.
- `ShimVariant` = `"terminating"|"non-terminating"|"bare"` (platform-plugin.ts:27); all platforms implement all three (shared-hooks.ts).
- compiler & core vitest configs already include `{spec,impl}`; only cli doesn't.
- AR-V1 yargs@18-types claim NOT re-verifiable offline — respected, not re-litigated.
- No `sudo` precedent in `.github/`; runner ubuntu-latest.

## Post-resolution obligations (after decisions)

- Record each decision in `00-preflight-report.md` (`**User Decision:** …`), update Status header.
- Apply fixes ONLY if explicitly instructed; then iteration 2 re-scan (verify fixes, regression check), findings continue at PF-014 — numbers never reuse.
- On pass: roadmap sync — plan row → `Plan Preflighted` (🔬) via the roadmap skill (feature roadmap `codeops/features/blend65-ri/00-roadmap.md` + portfolio cascade).
