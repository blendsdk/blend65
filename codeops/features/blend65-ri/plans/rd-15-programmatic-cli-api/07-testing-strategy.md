# Testing Strategy: RD-15 — Programmatic & CLI API

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals
- Spec tier: every RD acceptance criterion AC-01..AC-18/AC-20 witnessed by ≥1 ST case.
- Impl tier: edge cases per component (03-01/02/03 "Testing Requirements").
- E2E: fake-deps CLI runs in-process (deterministic, CI-safe) + one real-ACME E2E
  (skipIf-guarded locally, live in CI after the AR-V4 workflow change).

### Shared fixtures
- `GATE_SRC` — the MVP gate source: the **verbatim** content of
  `examples/gate/main.blend` — `module Main; function main(): void { poke(0xD020, 5); }`
  (single source of truth; note capital `Main`, hex `0xD020`, value `5` — PF-007).
- `memHost(files: Record<string, string>)` — in-memory `CompilerHost` (spec-legal:
  built from the R14 interface contract only).
- `fakeBuildDeps(opts)` — `BuildDeps` with an in-memory fs and a fake ACME invoke
  returning success/failure/`binarySize` as directed (mirrors the
  `emit-binary.spec.test.ts` fake pattern).
- `fakeIo()` — `CliIo` capturing stdout/stderr strings, with settable `isTTY`/`env`.
- Temp-dir fixtures for `DiskCompilerHost` (real fs — the host IS the fs boundary).

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived EXCLUSIVELY from RD-15 (R/AC numbers), RD-16/RD-11/RD-09 cross-contracts,
> and the Ambiguity Register (AR-V*). **IMMUTABLE ORACLE RULE** applies. Every case
> carries its source.

### Component 1 — CompilerHost & discovery (`03-01`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|------|----------------------------|----------------------------------------|-------------------|
| ST-1 | Import `CompilerHost` type from `@blend65/core`; implement an object with `listSourceFiles`/`readFile`/`resolvePath` | Type-checks; the interface has exactly these three members | R14, AR-V9 |
| ST-2 | `createDiskCompilerHost` over a temp dir; `readFile` on an existing file / a missing file | Content string / `undefined` (no throw) | R14, R12 |
| ST-3 | Temp dir with `b.blend`, `a.blend`, `sub/c.blend`, `skip/d.blend`; include `["**/*.blend"]`, exclude `["skip/**"]` | `listSourceFiles()` → absolute paths of `a.blend`, `b.blend`, `sub/c.blend` in lexicographic order | R47, R13, AR-V3/V6 |
| ST-4 | Include pattern `["../outside/**/*.blend"]` with a real `.blend` file planted outside `projectRoot` | Result does NOT contain the outside file (containment filter) | R47, RD-13 R37 |
| ST-5 | Facade path: `options.sourceFiles: ["missing.blend"]` | Diagnostic `E10250`, severity error, null span, message `Source file not found: 'missing.blend'`; no lexing occurred (no other diagnostics) | R48, AR-V10 |
| ST-6 | Facade path: empty temp project, no `sourceFiles` | Diagnostic `E10251`, message `No .blend source files found (project root: '<root>')` | R49, AR-V10 |
| ST-7 | `import { EmitBinaryResult } from "@blend65/compiler"`; the package exports no acme-layer `BuildResult` | Type-checks; `BuildResult` is the facade result type only | PF-002 |

### Component 2 — Programmatic API (`03-02`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|------|----------------------------|----------------------------------------|-------------------|
| ST-8 | `compile({platform:'c64', sourceFiles:['main.blend']}, memHost({'main.blend': GATE_SRC}))` | `hasErrors === false`; `diagnostics` has no errors; `config.platform === 'c64'`; `sourceMap.has(0)`; `semanticModel` and `allocationPlan` defined | R5, R51, AC-01 |
| ST-9 | Same but source `"module ; garbage"` | Returns (does not throw); `hasErrors === true`; ≥1 error diagnostic | R11, AC-06 |
| ST-10 | Spy on `process.stdout.write`/`process.stderr.write`/`console.log` around ST-8's call | Zero calls | R1/R4, AC-01 |
| ST-11 | memHost with two files; no `sourceFiles` option | Both files interned in `sourceMap` (injected host's `listSourceFiles` used verbatim) | R10, AC-05, AR-V6 |
| ST-12 | Temp project with `blend65.json` `{platform:'c64', outDir:'./out/'}`; `compile({platform:'cx16'})` from that cwd-rooted configPath | `config.outDir === './out/'` (file) and `config.platform === 'cx16'` (override wins) | R51, RD-16 R24/R25 |
| ST-13 | Source producing warning `W…` (an existing frontend warning code); `warnAsError: true` | That diagnostic has `severity: 'error'` and its original W-code; `hasErrors === true` | R26, AR-75, AR-Q8 |
| ST-14 | Same warning; `suppressWarnings: [<code>]` and `warnAsError: true` | Diagnostic absent entirely (suppression wins) | R28, R50(core R27–R31) |
| ST-15 | `emitIl` on GATE_SRC | `text` defined, contains the IL function header for `Main.main` (capital `Main` per the example — PF-007); no `.asm` markers | R8, AC-04 |
| ST-16 | `emitAsm` on GATE_SRC | `text` defined, matches `/JSR|STA/i` and contains the c64 preamble’s `!to` directive; no filesystem writes (memHost + spy) | R7, AC-03 |
| ST-17 | `build` on GATE_SRC with `fakeBuildDeps` (ACME success, binarySize 100) | `BuildResult`: `asmPath`/`binaryPath` set, `binary instanceof Uint8Array`, `symbolMap instanceof Map`, `resourceReport.binarySize === 100`, `hasErrors === false` | R6, AC-02 |
| ST-18 | `build` with fake binarySize > `c64` profile `maxBinarySize` | Diagnostics contain `E10034` with the platform-named message (`… platform 'c64' …`); `hasErrors === true` | AR-V5, RD-11 AC-17 |
| ST-19 | `build({platform:'nope'})` | Config-band error diagnostic (unknown platform); no pipeline diagnostics; `semanticModel` undefined | RD-16 R21/R22, R50 |
| ST-20 | Config file with a warning-producing entry (W10240 band) + source with a compile error | `result.diagnostics` contains both, config diagnostic first | AR-V7 |
| ST-21 | Source producing >3 errors; `maxErrors: 3` | Error count in `diagnostics` capped at 3 | R25 |
| ST-41 | `emitAsm({platform:'c64', outName:'game', sourceFiles:['main.blend']}, memHost(...))` | `text` contains `!to "game.prg"` (NOT `main.prg`) — the PF-001 `assembleProgram` override seam threads the real out-name into the preamble | PF-001, R21 |
| ST-42 | `emitAsm` on GATE_SRC with `startup:'bare'` | serialized preamble reflects the `bare` shim (no terminating shim body) — `toShimVariant('bare')==='bare'` reached codegen | PF-001, R46, RD-16 R18 |

### Component 3 — CLI (`03-03`)

All via `runCli(argv, fakeIo)` unless noted; project fixture in a temp dir.

| # | Input / Scenario | Expected Output / Behavior | Source |
|------|----------------------------|----------------------------------------|-------------------|
| ST-22 | `['build','main.blend','--platform','c64']`, fake ACME success | Returns 0; `.prg` path written via deps; stdout contains `=== Blend65 Build Summary ===`; stderr empty | AC-07, R38, R41 |
| ST-23 | `['check','main.blend','--platform','c64']` | Returns 0; no artifact writes; no summary table on stdout | R18, AC-08 |
| ST-24 | build with 2-error + 1-warning source | Returns 1; stderr contains both rendered diagnostics AND trailer `error: 2 errors, 1 warning emitted`; stdout empty | R42, AR-V11 |
| ST-25 | `['build','x.blend','--platform','c64']` with `x.blend` missing | Returns 2; stderr contains `E10250` | R43, R48, R50 |
| ST-26 | build, fake ACME failure (ICE) | Returns 3; `.asm` was written (retained); no `.prg` | R44 |
| ST-27 | `['build','main.blend','--platform','c64','--emit-asm']` | Returns 0; `<out>/main.asm` written; fake ACME invoke NOT called | R22, AC-10 |
| ST-28 | `--emit-il` | Returns 0; `<out>/main.il` written with IL text | R23, AC-11 |
| ST-29 | `--emit-report` on successful build | `<out>/main.report.json` written; parses as JSON with `platformName: 'c64'` | R24, §4.4 |
| ST-30 | `--quiet` on successful build with a warning | Returns 0; NO summary table on stdout; warning + trailer still on stderr | R34, AC-14, AR-V11; closes RD-11 AC-16 |
| ST-31 | `--report=json` on successful build | stdout is exactly the JSON report (parses; `targetName` ends `.prg`); no table | R36, AC-14 |
| ST-32 | `--diagnostics-format=json` with an error source | stderr parses as JSON array; NO trailer line; exit 1 | R29, AC-13, AR-V11 |
| ST-33 | Same error run under: (a) `isTTY:false`; (b) `--color`; (c) `env.NO_COLOR='1'`; (d) `--no-color` with `isTTY:true` | SGR `[` present only in (b); (a)/(c)/(d) clean | R35, R37, AC-15, AR-V16 |
| ST-34 | `['build','--bogus-flag']` | Returns 2; stderr contains a usage/failure message | R50, AR-V13 |
| ST-35 | `['--version']` → stdout contains `VERSION`; `['--help']` → stdout lists `build` and `check` | As stated; both return 0 | R32, R33, AR-V15 |
| ST-36 | `['main.blend','--platform','c64']` (no subcommand) | Behaves exactly as ST-22 (default = build) | R17, AR-V14 |
| ST-37 | `--out-dir custom/ --out-name game` on build | Artifacts under `custom/` named `game.*` | R20, R21, AC-09 |
| ST-38 | Config file sets `quiet: true`; run WITHOUT `--quiet`, then with explicit `--quiet=false`? — **No**: yargs boolean-negation form is `--no-quiet`. Run (a) plain → table suppressed (config wins); (b) `--no-quiet` → table prints (flag overrides config) | RD-16 R24, AC-20 |
| ST-43 | build with fake deps whose ACME invoke records `E10035` (`AcmeNotFound`) and returns failure | Returns **1** (not 3 — `E10035` is a normal error; exit 3 is ICE-band `isIceCode` only, PF-003 Decision 2); `.asm` retained; stderr shows `E10035` | PF-003, R50 |
| ST-39 | Static scan (root `test/` tier): sources of core/frontend/codegen/platforms/config/compiler contain no `console.` call and no `process.stdout`/`process.stderr` reference (test files excluded) | Scan is empty | AC-18, R4, AR-V18 |
| ST-40 | *(skipIf ACME undiscoverable)* Real E2E: `runCli(['build', <gate fixture>, '--platform','c64','--out-dir',<tmp>], realIo-capture)` with REAL deps | Returns 0; `.prg` exists, size > 2, first two bytes are the PRG load address `$01 $08` | AC-07, AR-V4 |

> **⚠️ AUTHORING RULE:** expectations above come from the RD/AR text (message strings
> from AR-V10/V11; geometry from shipped renderer contracts). Where an existing
> diagnostic code is needed (ST-13/14: a real frontend warning; ST-26: the ACME ICE
> code), the spec test references the code via the `DiagCode`/`IceCode` constant —
> not a hardcoded literal — exactly as `pipeline.impl.test.ts` already does.

## Test Categories

### Specification Tests (files)

| Test File | ST Cases | Component |
| --------- | -------- | --------- |
| `compiler/src/host/disk-host.spec.test.ts` | ST-2..ST-4 | DiskCompilerHost |
| `compiler/src/api/discovery.spec.test.ts` | ST-5, ST-6 | Discovery errors |
| `core/src/host/compiler-host.spec.test.ts` | ST-1 | Interface shape |
| `compiler/src/index.spec.test.ts` (extend) | ST-7 | PF-002 rename |
| `compiler/src/api/compile.spec.test.ts` | ST-8..ST-14 | compile() |
| `compiler/src/api/emit.spec.test.ts` | ST-15, ST-16, ST-41, ST-42 | emitAsm/emitIl (+ PF-001 `!to`/startup seam) |
| `compiler/src/api/build.spec.test.ts` | ST-17..ST-21 | build() |
| `cli/src/main.spec.test.ts` | ST-22..ST-26, ST-34..ST-36, ST-43 | Commands & exit codes (+ PF-003 ACME-not-found→1) |
| `cli/src/emit-flags.spec.test.ts` | ST-27..ST-31, ST-37, ST-38 | Emit/output flags |
| `cli/src/diagnostics-output.spec.test.ts` | ST-24, ST-32, ST-33 | Formats, trailer, color |
| `test/no-print.spec.test.ts` (root tier) | ST-39 | AC-18 |
| `cli/src/build-e2e.spec.test.ts` | ST-40 | Real-ACME E2E (CLI-level; `runCli` lives in cli — a compiler-side file importing `runCli` would be a compiler→cli cycle, PF-004) |

> **PF-005:** `packages/cli/vitest.config.ts` currently includes only
> `src/**/*.spec.test.ts`. It must be widened to `src/**/*.{spec,impl}.test.ts`
> (the pattern compiler/core already use) or the cli impl-test files below are
> silently never collected. Wired as a task-3.1.1 step.

### Implementation Tests (after green)

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `compiler/src/host/disk-host.impl.test.ts` | Fixture edges: nested excludes, empty include, TOCTOU readFile-undefined | High |
| `compiler/src/api/options.impl.test.ts` | `optionsToOverrides` full mapping table incl. explicit-undefined keys | High |
| `compiler/src/api/build.impl.test.ts` | outName derivation edges, binary read-back on failure paths, report absence pre-stage | High |
| `cli/src/args.impl.test.ts` | warn-as-error coercion (`""`→true, codes accumulate), flag→option mapping | High |
| `cli/src/render.impl.test.ts` | Trailer pluralization matrix, color matrix, emit-report without success, write-failure path | Med |

### Integration / E2E
- ST-22..ST-38 are integration by construction (real facade + real config loader +
  temp-dir fs; only ACME faked). ST-40 is the full E2E.

## Test Data / Mocks
- Real objects everywhere except: ACME invocation (fake `BuildDeps`/`EmitDeps` —
  a true external), `CliIo` (process boundary), in-memory hosts (interface-contract
  doubles, also exercising R10 for real).

## Verification Checklist
- [ ] All ST cases defined with concrete input/output pairs ✅ (ST-1..ST-43; ST-41/42 PF-001, ST-43 PF-003)
- [ ] Every ST traces to an R/AC/AR source ✅
- [ ] Spec tests written BEFORE implementation (per-phase red runs recorded in 99)
- [ ] Red phase verified per phase; green phase after implementation
- [ ] Impl tests after green; full workspace verify at each phase end
