# Current State: RD-12 — Test Harness & Emulator Verification

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

**`@blend65/test-harness` is a clean-slate stub.** `packages/test-harness/src/index.ts`
exports only `export const VERSION = "0.1.0";`. The package manifest declares a single
dependency (`@blend65/core`), `type: module`, `publishConfig.access: public`, and the
standard build/typecheck/lint/test scripts. There is one placeholder spec test
(`src/index.spec.test.ts`). No emulator code, no driver, no strategies.

**Every upstream consumable RD-12 needs is shipped:**

- **RD-15 facade `BuildResult`** (`packages/compiler/src/api/results.ts`) — carries
  `symbolMap?: Map<string, number>`, `binaryPath?: string`, `binary?: Uint8Array`, plus
  `asmText`/`asmPath`/`resourceReport`. Publicly exported from `@blend65/compiler`
  (`src/index.ts:36`, `export * from "./api/index.js"`). This is the R27/R28 binding (AR-H2).
- **RD-09 `parseLabelFile`** (`packages/compiler/src/acme/label-file.ts`) — total
  text→`Map<string,number>` parser; regex `^al\s+C:([0-9a-fA-F]{4})\s+\.(.+)$` (VICE
  format: strips the leading `.` and `C:` prefix). Publicly exported (`src/index.ts:30`).
- **RD-15 `build()`** (`packages/compiler/src/api/build.ts`) — the full compile→ACME
  pipeline; verified to build `examples/gate/main.blend` to a 32-byte c64 PRG.
- **VICE 3.10** (`/home/gevik/.local/bin/x64sc`) with `-binarymonitor` /
  `-binarymonitoraddress` support, and **ACME** (`/usr/bin/acme`) with `--vicelabels`
  — both on `PATH`. The emulator tier is buildable and runnable locally now.
- **The interim in-process interpreter** (`packages/compiler/src/testing/mos6502-interpreter.ts`,
  `runRoutine(bin, input): CpuState`) and its functional test
  (`packages/compiler/src/runtime-asm.impl.test.ts`) — self-declared "RD-12 supersedes
  this," ACME-gated `skipIf`. Stays in place (PF-001/AR-H5); RD-12's Tier-3 discharges its
  AC-14 role on real silicon.

### Relevant Files

| File                                                        | Purpose                                             | Changes Needed                                                        |
| ----------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------- |
| `packages/test-harness/src/index.ts`                        | Package stub (`VERSION` only)                       | Rewrite as the public barrel (driver/strategies/assertions/fixture/golden) |
| `packages/test-harness/package.json`                        | Deps: `@blend65/core` only                          | Add `@blend65/compiler` (runtime) + `@blend65/codegen` (**devDependency**, RD-17 vectors — PF-001); keep publishable config |
| `packages/test-harness/tsconfig.json`                       | `references: [../core]` only                        | Add `../compiler` + `../codegen` refs (1:1 deps↔references convention — PF-001)  |
| `packages/test-harness/src/**` (new)                        | —                                                   | Add the full module tree (AR-H13)                                    |
| `packages/compiler/src/acme/invoke-acme.ts`                 | ACME argv builder — uses `-l` (**DEF-2**)           | `-l` → `--vicelabels` (AR-H7)                                        |
| `packages/compiler/src/acme/invoke-acme.impl.test.ts`       | Asserts the argv                                    | Update the flag assertion (impl test, not an oracle)                 |
| `packages/compiler/src/acme/vice-label.spec.test.ts` (new)  | —                                                   | New DEF-2 regression oracle (real build → non-empty `symbolMap`)     |
| `CLAUDE.md`                                                 | Dependency table (test-harness → core)              | Row → `core, compiler` (+ `codegen` dev-only) (AR-H17)               |
| `codeops/features/blend65-ri/00-roadmap.md`                 | Status tracker                                      | Update on completion                                                 |

### Code Analysis

The RD-12 §4 interface signatures (`EmulatorDriver`, `LaunchOptions`, `Registers`,
`BreakReason`, the run-strategy and assertion functions, `setupEmulator`) are the
**published contract** — the harness implements them verbatim (including `Registers.flags.break_`,
AR-H16). The VICE §4.5 implementation notes name the exact monitor commands to use.

## Gaps Identified

### Gap 1: Empty `symbolMap` from every real build (DEF-2 — BLOCKING)

**Current behavior:** `invoke-acme.ts:101` builds the ACME argv as
`["-l", inv.labelPath, "--report", inv.reportPath, inv.asmPath]`. ACME's `-l`
(`--symbollist`) writes its **native** format:

```
	__startup	= $80d	; unused
	_main	= $819	; ?
```

`parseLabelFile`'s regex only matches the VICE format `al C:xxxx .name`, so **none** of
these lines match → `symbolMap` is empty. Verified live: a `build({platform:'c64',
sourceFiles:['examples/gate/main.blend']})` returns `hasErrors: false`, a 32-byte
`main.prg`, and `symbolMap.size === 0`.

**Required behavior:** `symbolMap` populated with the real symbols. ACME's `--vicelabels`
flag emits exactly what `parseLabelFile` expects (verified live):

```
al C:080d .__startup
al C:0819 ._main
al C:0002 .__zp_arg_0
...
```

**Fix required (AR-H7):** in `acmeArgv`, replace `-l` with `--vicelabels` (same output
path). Add a regression spec test that runs a real gate build (skipIf-ACME) and asserts
`symbolMap` contains `_main` (`$0819`) and `__startup` (`$080d`). Update the RD-09 impl
test's argv assertion. This is Phase 0 — every later phase relies on a populated map.

> **Why it slipped:** `parseLabelFile`'s own unit tests feed synthetic VICE-format text
> (so the parser is correct in isolation), and RD-15's real-ACME E2E (ST-40) asserted the
> PRG header but not `symbolMap` contents. The label-file.ts header comment even claims
> "ACME's -l/--labeldump output is a VICE-format symbol file" — factually wrong for this
> ACME. The fix corrects the comment too.

### Gap 2: No `__startup_done` / epilogue label for terminating-program sync

**Current behavior:** codegen emits only `_main` and `__startup` as program labels; the
`__startup` body is `... JSR _main / LDA #$37 / STA $01 / RTS` with no post-`main` label.

**Required behavior:** the gate test needs a sync point. **Fix (AR-H9):** use
`runUntilMemory(0xD020, 5)` as the primary proof (no epilogue label needed) and
`runUntilLabel('_main')` to exercise AC-03; do **not** add a codegen label (out of scope).

### Gap 3: The harness does not exist

All framework code (driver, protocol codec, strategies, assertions, registry, fixture,
golden helper, PNG encoder) is net-new, built against the shipped interfaces above.

## Dependencies

### Internal Dependencies

- `@blend65/compiler` — `BuildResult` (type), `parseLabelFile`, `build` (for compile-and-test
  and the DEF-2 oracle). **New** runtime test-harness dependency (AR-H2/AR-H17).
- `@blend65/codegen` — `loadRuntimeModule` (to assemble the `__rt_*` routines for the RD-17
  vectors, exactly as `compiler/src/runtime-asm.impl.test.ts` does; `RT_ROUTINES` comes from
  `@blend65/core`). Used **only** in `runtime-routines.spec.test.ts` → a **test-scope
  devDependency** (PF-001). Not re-exported by the compiler barrel, so it must be declared
  directly; R15/AR-20 forbids only frontend/language-server→codegen, so test-harness→codegen
  is clean.
- `@blend65/core` — existing dependency (kept); also supplies `RT_ROUTINES`.
- The Phase-0 DEF-2 fix must land **before** any harness code depends on a populated
  `symbolMap` (sequencing constraint).

### External Dependencies

- **VICE `x64sc` 3.10** (local, `PATH`) — binary-monitor protocol; local-only tier (AR-27).
- **ACME** (local, `PATH`) — assembler; already CI-installed for the compiler suites.
- **Node built-ins only** for runtime: `net` (monitor socket), `zlib` (PNG),
  `child_process` (spawn VICE) — no new npm runtime deps (AR-H11).

## Risks and Concerns

| Risk                                                                 | Likelihood | Impact | Mitigation                                                                                              |
| -------------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------ |
| VICE binary-monitor body layouts differ subtly from the spec doc     | Medium     | Medium | Split a pure codec (AR-H14) with byte-exact CI tests; validate live against VICE 3.10 during exec; resolve register ids via `REGISTERS_AVAILABLE` (AR-H15) rather than hardcoding |
| DEF-2 fix breaks an RD-09/RD-15 test that pins the argv               | Medium     | Low    | Only `invoke-acme.impl.test.ts` asserts the argv (an impl test); update it; run the full workspace verify in Phase 0 |
| Emulator tests flake on process spawn / socket connect timing        | Medium     | Medium | Relaunch-per-binary determinism (AR-H6); connect-retry with the mandatory timeout guard; skipIf keeps CI unaffected |
| `EXECUTE_UNTIL_RETURN` semantics differ for the routine ABI          | Low        | Medium | Validate against the interim interpreter's known-good vectors; the bounded subset (AR-H5) cross-checks real VICE vs interpreter results |
| Screenshot PNG encoding produces an invalid file                     | Low        | Low    | Debug-only artifact (never asserted); a small impl test decodes the header/IHDR to confirm validity    |
| Published harness pulls in the whole `@blend65/compiler`             | High       | Low    | Accepted (AR-H2); a test harness legitimately depends on the compiler it tests output from             |
