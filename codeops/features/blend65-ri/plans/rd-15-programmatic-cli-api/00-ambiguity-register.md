# Ambiguity Register: RD-15 — Programmatic & CLI API

> **Status**: ✅ GATE PASSED — all 22 items resolved (V20–V22 added by plan preflight, 2026-07-03)
> **Last Updated**: 2026-07-03
> **Feature**: blend65-ri · **Implements**: RD-15
>
> V1–V3 were presented with the scope confirmation and resolved per-item
> (2026-07-03). V4–V7 were presented as Batch B and resolved by the user's
> explicit "all as recommended". V8–V19 were presented as Batches C/D and
> resolved by per-question selection ("Adopt as proposed/recommended" on each),
> followed by the user's final confirmation: **"I have reviewed and confirmed
> all items"** (2026-07-03).
>
> **Hardening disclosure** (per `_shared/recommendation-hardening.md`): one
> independent challenger was spawned for the high-stakes cluster (V1/V2/V3,
> V4, V5) blind to the author's picks. Verdict: **converged** on V2/V3/V4/V5;
> on V1 the challenger supplied the decisive registry evidence (yargs@18 ships
> no root-export types; no `@types/yargs@18` exists) that settled the author's
> open 17-vs-18 question. Confidence: High across the register after user
> ratification.
>
> **V2 amends requirements-level AR-17** (chalk → zero-dependency color). The
> amendment is back-propagated to `requirements/RD-15-programmatic-cli-api.md`
> (R35/R37/§4.5) and logged in the requirements register as the next runtime
> AR — this is a Phase-1 execution task (task 1.1.1 in `99-execution-plan.md`).
>
> **V20–V22 were added by the plan preflight (2026-07-03, iteration 1)** as
> resolutions to findings PF-002/PF-003/PF-008 — the user accepted the
> recommended option on each. V20 (`cwd`) and V21 (exit-3 wording) carry RD
> amendments back-propagated via task 1.1.1; V22 records the config-caret
> deferral. Full finding detail lives in `00-preflight-report.md`.

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| V1 | Technical | yargs major for `@blend65/cli` (AR-16 mandates yargs; version open) | (a) yargs@17 + `@types/yargs`; (b) yargs@18 | **(a) yargs@17.x + @types/yargs@17.** Challenger-verified: yargs@18's `exports` map carries no `types` condition and no `@types/yargs@18` exists — v17 types would lie about a v18 runtime under strict NodeNext. Migrate when DT catches up | ✅ Resolved |
| V2 | Technical | CLI color: AR-17 says "conditional chalk", but core already hand-rolls ANSI (`core/src/diagnostics/ansi.ts`) and `renderTerminal` takes an explicit `{color}` boolean; `renderReportTerminal` is uncolored by design | (a) chalk@5 per AR-17; (b) zero-dep — CLI computes one `color: boolean` (explicit flag > `NO_COLOR` > `isTTY`), passes it to `renderTerminal`, paints its own accents with local SGR helpers | **(b) zero-dependency; AR-17 runtime-amended (user-ratified).** The CLI must own color detection regardless (core takes a boolean); chalk becomes a second opinion that must be suppressed (`chalk.level = 0`) to avoid disagreement (e.g. `FORCE_COLOR` on a pipe). Back-propagation to RD-15 R35/R37/§4.5 + requirements register | ✅ Resolved |
| V3 | Technical | Glob engine for R47 (`DiskCompilerHost.listSourceFiles()`) | (a) tinyglobby; (b) Node 22 `fs.globSync` (experimental); (c) picomatch + hand-rolled walk | **(a) tinyglobby** (the RD's own R47 example). `fs.globSync` is Stability-1 in Node 22 and prints an `ExperimentalWarning` on every `blendc` run; hand-rolling means owning symlink/ordering/dotfile semantics. tinyglobby is Vitest's engine (vetted transitively); deps only `fdir`+`picomatch`. Post-expansion **sort + projectRoot containment filter** added regardless of engine | ✅ Resolved |
| V4 | Technical | Testing strategy for `build()`/CLI — CI installs no ACME (verified: `.github/workflows` has no ACME step; dev box has `/usr/bin/acme`) | (i) injectable deps seam on `build()`; (ii) real-ACME E2E behind `describe.skipIf`; (iii) add ACME to CI (`apt-get install -y acme`); (iv) defer real E2E to RD-12 | **(i)+(ii)+(iii) combined.** (i) mirrors the `EmitDeps` precedent (`compiler/src/acme/emit-binary.ts:95`); (ii) reuses the shipped skipIf pattern (`compiler/src/runtime-asm.spec.test.ts:56`); (iii) one CI line makes AC-07 CI-verified and wakes three RD-17 suites that currently skip silently. Not an AR-27 violation (ACME is an assembler, not an emulator). (iv) rejected: leaves an acceptance criterion unverified for an RD cycle when verification costs one line | ✅ Resolved |
| V5 | Integration | E10034 wiring in `build()`: `emitBinary` has an inline check (opt-in via `maxBinarySize`); core's `checkBinaryBudget` (RD-11b) is the platform-named canonical helper | (a) pass `maxBinarySize` into `emitBinary`; (b) omit it; facade calls `checkBinaryBudget(report, bag)` after report assembly | **(b).** Shipped design intent — `checkBinaryBudget`'s JSDoc says "RD-15 calls this after emitBinary" (`core/src/report/build-resource-report.ts`); richer message; RD-09's immutable spec tests untouched (they opt in explicitly). Obligations: thread `acme.binarySize` into `buildResourceReport` (else the check no-ops), derive failure from final diagnostics, cross-referencing comments on both emission sites | ✅ Resolved |
| V6 | Integration | Host/discovery circularity: the default host needs the resolved config, but config loads inside the facade (R10 vs R47) | (a) config-first — injected host used verbatim, else `DiskCompilerHost` built from resolved config; (b) host-factory callback `(config) => CompilerHost` | **(a) config-first.** `loadConfig` runs first (overrides mapped from `CompilerOptions`); custom host's `listSourceFiles()` used verbatim (the LSP owns its file set); else `DiskCompilerHost({projectRoot, include, exclude})`. Explicit `options.sourceFiles` bypasses discovery — each existence-checked (missing → E10250, R48); empty final set → E10251 (R49); `outName: ""` → basename of lexicographically-first discovered file minus extension (R21) | ✅ Resolved |
| V7 | Data & state | Diagnostic-bag strategy across config→pipeline (`maxErrors` bootstrap — cap fixed at bag creation, unknown until config loads) | (a) two bags, merged result; (b) single bag at default cap | **(a) two bags.** Config bag at cap 20 (documented bootstrap contract, `config/src/types.ts:76-80`), pipeline bag at `config.maxErrors`; result diagnostics = config diags then pipeline diags; `applySeverityPolicy` applied **once** over the merged array (R31/PF-005); `hasErrors` from the final array. Config errors short-circuit before the pipeline bag exists (RD-16 R22) | ✅ Resolved |
| V8 | Naming | Plan folder name | `rd-15-programmatic-cli-api` / alternatives | `rd-15-programmatic-cli-api` (mirrors the RD filename; consistent with `rd-16-compiler-configuration`) | ✅ Resolved |
| V9 | Technical | Module layouts across the three packages | proposed layout vs adjustments | **Adopted as proposed.** Core: new `core/src/host/` module (`compiler-host.ts` + barrel, re-exported from root — mirrors the `report/` precedent). Compiler: new `api/` module (`options.ts`, `results.ts`, `run-frontend.ts`, `compile.ts`, `build.ts`, `emit.ts`, barrel) + `host/disk-host.ts`; PF-002 rename in `acme/emit-binary.ts`. CLI: `bin.ts`/`main.ts`/`args.ts`/`render.ts`/`color.ts`/`index.ts` + `"bin": {"blendc": "./dist/bin.js"}` | ✅ Resolved |
| V10 | UX | Driver diagnostic codes for the R49 `E10250+` band claim + message texts | proposed codes/messages vs adjust | **`E10250 DriverSourceFileNotFound`** — `Source file not found: '<path>'` (R48); **`E10251 DriverNoSourceFiles`** — `No .blend source files found (project root: '<projectRoot>')` (R49). Added to core `DiagCode` (`core/src/diagnostics/diagnostic-codes.ts`) | ✅ Resolved |
| V11 | UX | Error/warning-count trailer — rd-11b Q8 removed the renderer footer because "RD-15 owns the 'N errors' summary", but RD-15 text never pins it | proposed format vs adjust | **Adopted:** terminal-format only (never emitted with `--diagnostics-format=json`), printed to **stderr** after the diagnostics, NOT suppressed by `--quiet` (R34 suppresses only the summary table). Severity word colored per AR-Q9 (bold red/yellow). Errors present → `error: 2 errors, 1 warning emitted` (warning clause omitted when 0 warnings); warnings only → `warning: 1 warning emitted`; clean → no trailer. Counts pluralize naturally (`1 error` / `2 errors`) | ✅ Resolved |
| V12 | Technical | `BuildResult.binary` read-back mechanism (PF-002: "binary is read back from disk after a successful ACME run") | extend `EmitDeps` vs facade-owned read | **Facade-owned:** read `binaryPath` into a `Uint8Array` on ACME success through the V4 `BuildDeps` seam (`readBinary` member); no `EmitDeps` change | ✅ Resolved |
| V13 | Behavioral | Process exit mechanism + yargs failure routing (R50 requires overriding yargs' default exit-1) | `process.exit(n)` vs `process.exitCode = n`; `.fail()` handler | **`process.exitCode` assignment only** (never `process.exit()` — stream-flush safety); `bin.ts` awaits `runCli` and assigns. Custom yargs `.fail()` handler routes usage/flag errors to exit 2 (R50) | ✅ Resolved |
| V14 | Behavioral | Default command form for R17 ("build … (default)") | `$0` alias vs required subcommand | **`.command(['$0 [files..]', 'build [files..]'], …)`** — bare `blendc file.blend` = build | ✅ Resolved |
| V15 | Behavioral | `--version` source | yargs auto package.json lookup vs explicit `.version(VERSION)` | **Explicit `.version(VERSION)`** from the cli package's `VERSION` const (every package already keeps one synced to its manifest — dist-safe, no runtime path lookup) | ✅ Resolved |
| V16 | Behavioral | Color precedence when `--color` is passed explicitly (§4.5 tree only covers the negative) | precedence orders | **Explicit `--color` forces ON > `--no-color` forces OFF > `NO_COLOR` env OFF > `isTTY` decides.** yargs `color` option declared with `default: undefined` so explicitness is detectable | ✅ Resolved |
| V17 | UX | Diagnostic path display form (`--> path:line:col`) | absolute vs projectRoot-relative | **projectRoot-relative with forward slashes** — deterministic output (RD-13); absolute paths retained internally for host resolution | ✅ Resolved |
| V18 | Technical | AC-18 enforcement mechanism (no compile-path package prints) | lint-only vs lint + spec-test witness | **ESLint `no-console` + `no-restricted-properties` (`process.stdout`/`process.stderr`)** on compile-path packages' `src/` (tests excluded) as the authoritative gate, **plus** a root `test/` tier spec test scanning compile-path sources — the AR-P7/R15-boundary precedent | ✅ Resolved |
| V19 | Behavioral | Does `--no-optimize` gate `optimizeIL` too, or only the peephole? | peephole-only vs both | **Peephole only:** `optimize: false` skips `optimizeInstr`; `optimizeIL` always runs. R31 names the peephole optimizer specifically | ✅ Resolved |
| V20 | Technical | `CompilerOptions` had no `cwd`, but `loadConfig` needs one for walk-up discovery + `projectRoot` fallback (`config/src/load-config.ts:80,144`); CLI temp-dir tests can't bind the base dir (plan preflight PF-002) | (a) add `cwd?` routing field; (b) `process.chdir`/absolute paths | **(a)** — add `cwd?: string` to `CompilerOptions` §4.1 (a routing option, not a config override); facade threads it to `loadConfig`; CLI maps `io.cwd`. RD §4.1 amendment back-propagated (task 1.1.1). (b) rejected: fragile coupling to the vitest pool, doesn't fix ST-6's projectRoot message or the RD-14 discovery gap | ✅ Resolved (PF-002) |
| V21 | Behavioral | The exit-3 rule assumed an ACME-specific ICE code; none exists — `E90001` is generic (6+ emitters), ACME-not-found is `E10035` (normal band) (plan preflight PF-003) | (a) `isIceCode` band + `E10035`→1; (b) mint `E90002` ACME code + `E10035`→2 | **(a)** — exit 3 = any ICE-band code via the shipped `isIceCode`; `E10035` (ACME not found) → exit 1 (R50-literal, an ordinary user-actionable error). Matches R44's "internal compiler error" rationale; zero shipped-code change. R44/R50 wording clarified. (b) rejected: touches shipped RD-09 code + its immutable spec test, and leaves genuine compiler ICEs mislabeled as user errors | ✅ Resolved (PF-003) |
| V22 | UX | Config-file diagnostics carry `CONFIG_SOURCE_ID = -2` spans, which `SourceMap.has()` rejects (id ≥ 0) → header-only rendering, no caret (plan preflight PF-008) | (a) accept degraded v1 + AR-P2 follow-up; (b) partial intern for explicit `--config` | **(a)** — accept header-only config diagnostics for v1 (the `@blend65/config` surface is out of scope — RD-16 shipped); the AR-P2 `sourceId` seam (`config/src/validate.ts:47`) is the follow-up. (b) rejected: asymmetric (discovery case still degrades) for little gain | ✅ Resolved (PF-008) |
| V23 | Integration (runtime) | **RD-09 defect surfaced by ST-40 (DEF-1):** the shipped `invokeAcme` passes `-o <binaryPath>` on the ACME command line, which forces ACME's **plain** (headerless) format and warns "Output file already chosen", overriding the serializer's `!to "<name>.prg", cbm` directive. Result: the production `.prg` lacks the 2-byte c64 load-address header that `LOAD"*",8` requires (real output starts `$0B $08`, not `$01 $08`). RD-09's golden test didn't catch it — it invokes ACME with just the asm path (no `-o`), letting `!to,cbm` drive → header-bearing PRG; it asserts only `size > 2`. | (a) fix `invokeAcme` — drop `-o`, let `!to` drive (aligns with the golden path); (b) relax ST-40 to structural facts + file the bug for RD-12; (c) defer ST-40 to RD-12 (AR-V4 rejected deferral) | **(a) fix `invokeAcme`** (user-approved 2026-07-03). Dropped `-o`/`binaryPath` from `acmeArgv` (`invoke-acme.ts:91`); ACME now uses the `!to`-directive output (basename resolved against `cwd = outDir` → lands at `binaryPath`), producing a header-bearing cbm PRG. Updated the RD-09 impl test assertion (`invoke-acme.impl.test.ts:45` — an impl test, not an immutable spec oracle) to `not.toContain("-o")`. ST-40 now passes as authored (`$01 $08`). Tracked as roadmap **DEF-1**. | ✅ Resolved (DEF-1) |

### Resolution Notes

**Scope confirmation (Phase 1.3, resolved before the gate):** IN — compiler
facade (R1–R11, R51) incl. PF-002 rename; core `CompilerHost` + compiler
`DiskCompilerHost` with three-tier discovery (R12–R14, R47–R49); the full
`blendc` CLI (R15–R50); the two deferred RD-11 items RD-15 owns (AC-16's
`--quiet` half; E10034 wiring after `emitBinary`). OUT — LSP buffer-overlay
host (RD-14), emulator verification (RD-12), peephole rule catalog (RD-08
Phase B), any `blend65.json` schema change (RD-16 shipped).

**Pre-resolved context (not a new ambiguity):** `modelToFunctionInfo` is the
RD-05-documented deferred adapter (`frontend/src/sfa/model-adapter.ts:34`
returns `[]`; its doc assigns the fill-in to RD-04b, not RD-15). The facade
calls it as-is; `lowerToIL` tolerates missing frames
(`codegen/src/il/lower.ts:154` optional-chains), so the MVP gate program
compiles end-to-end and SFA report numbers render as zeros per AR-102. No
options exist here — implementing the adapter in RD-15 would contradict the
recorded RD-05 deferral and RD-15's "wire finished pieces" scope.

**V5 addendum:** with (b), `emitBinary` returns `success: true` for an
over-budget binary on the facade path (its inline check never fires because
`maxBinarySize` is not passed); build failure is derived from the final
policy-applied diagnostics array — which the never-throwing result API does
anyway (R11).

**V10 addendum:** `E10250`/`E10251` are emitted with a `null` span (no source
file to point into); they classify as **driver/configuration errors → exit 2**
per R48/R49 (R43 class).
