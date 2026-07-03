# Compiler Facade: RD-15

> **Document**: 03-02-compiler-facade.md
> **Parent**: [Index](00-index.md)
> **Covers**: R1–R11, R51 · AR-V5, AR-V6, AR-V7, AR-V12, AR-V17, AR-V19 · PF-002

## Overview

The `api/` module of `@blend65/compiler`: four public functions over one shared
pipeline core. Thin wiring only (R2) — every stage is a shipped entry point (see
02-current-state.md's integration table). No printing, no `process.exit`, no throwing
(R1/R4/R11).

## Implementation Details

### `api/options.ts` — `CompilerOptions`

Transcribed from RD-15 §4.1 (preflighted contract): `platform` required; optional
`sourceFiles`, `configPath`, `include`, `exclude`, `acmePath`, `outDir`, `outName`,
`maxErrors`, `warnAsError: boolean | string[]`, `suppressWarnings`, `diagnosticsFormat`,
`optimize`, `quiet`, `startup`, plus **`cwd?: string`** — the base directory for config
walk-up discovery, the `projectRoot` fallback, and relative-path resolution (PF-002/
AR-V20; added to RD §4.1 via task 1.1.1; defaults to `process.cwd()`).

Mapping to `ConfigOverrides` (R9 → RD-16 R24) is a pure function
`optionsToOverrides(options)`: every overridable `BlendConfig` key copied through
(explicit `undefined` legal per `config/src/types.ts:71` — "not set, never overrides");
`configPath`, `sourceFiles`, and `cwd` are NOT config keys (they route to `loadConfig`
options, tier-1 discovery, and the `loadConfig` `cwd` respectively).

### `api/results.ts` — result types

Transcribed from RD-15 §4.1: `CompileResult` (`hasErrors`, `diagnostics`,
`config: BlendConfig` (R51), `sourceMap`, `semanticModel?`, `allocationPlan?`),
`BuildResult extends CompileResult` (`asmText?`, `asmPath?`, `binaryPath?`,
`binary?: Uint8Array`, `symbolMap?`, `resourceReport?`), `EmitResult extends
CompileResult` (`text?`).

PF-002: this `BuildResult` owns the public name; `acme/emit-binary.ts`'s aggregate is
renamed `EmitBinaryResult` (03-01 session); the facade maps its `symbols` →
`symbolMap` and reads `binary` back from disk (AR-V12).

### `api/run-frontend.ts` — the shared pipeline core

Internal (not exported from the package barrel). One function both `compile()` and the
emit/build paths call:

```typescript
interface FrontendRun {
  config: BlendConfig;
  configDiagnostics: Diagnostic[];      // config bag contents (AR-V7)
  sourceMap: SourceMap;
  bag: DiagnosticBag;                   // pipeline bag (cap = config.maxErrors)
  plugin?: PlatformPlugin;              // absent on config error
  registry?: IntrinsicRegistry;
  programs?: ProgramNode[];
  semanticModel?: SemanticModel;
  allocationPlan?: AllocationPlan;
  outName: string;                      // R21-derived effective base name (PF-001/PF-010)
  aborted: boolean;                     // config error or discovery error → true
}
function runFrontend(options: CompilerOptions, host?: CompilerHost): FrontendRun;
```

Normative sequence (each step cites its decision source):

1. **Config**: `configBag = createDiagnosticBag()` (default cap 20 — bootstrap
   contract, AR-V7); `loadConfig({ bag: configBag, cwd: options.cwd ?? process.cwd(),
   configPath: options.configPath, overrides: optionsToOverrides(options),
   knownPlatforms: [...PLATFORM_REGISTRY.keys()] })` — `cwd` threads the base dir for
   walk-up discovery + the `projectRoot` fallback (PF-002/AR-V20;
   `config/src/load-config.ts:80,144`). `hasErrors` → return aborted (RD-16 R22
   short-circuit; exit-2 class).
2. **Pipeline bag**: `createDiagnosticBag({ maxErrors: config.maxErrors })` (AR-V7).
3. **Host**: injected host used verbatim; else
   `createDiskCompilerHost({ projectRoot, include, exclude })` from the resolved
   config (AR-V6).
4. **File set**: tier 1 `options.sourceFiles` (each `host.resolvePath`ed — resolving
   against `projectRoot`/cwd — + existence-check → E10250 each missing, then abort) else
   `host.listSourceFiles()`; empty → E10251, abort (R48/R49). Then derive `outName`
   **once** here (R21, AR-V6): `config.outName` when non-empty, else basename of the
   lexicographically-first discovered file minus its extension. Stored on `FrontendRun`
   so `emitAsm`/`build`/CLI all consume one derivation — the CLI never re-derives
   (PF-001/PF-010).
5. **Platform**: `loadPlatform(config.platform)` — cannot throw here: unknown names
   were rejected in step 1 via `knownPlatforms` (R11 preserved).
   `registry = createIntrinsicRegistry(plugin.intrinsics, plugin.id)`.
6. **Sources**: for each file — `content = host.readFile(path)`; `undefined` → E10250
   (TOCTOU); `sourceId = sourceMap.intern(displayPath, content)` where `displayPath`
   is projectRoot-relative with forward slashes (AR-V17).
7. **Lex/parse** each file (`lex(sourceId, content, bag)` → `parse({tokens, source,
   sourceId, bag})`); collect `programs`.
8. **Semantic**: `analyze({ programs, bag, profile: plugin.profile, registry,
   targetProfile: plugin.profile })` (the shipped RD-17 call shape).
9. **SFA**: `planAllocation({ functions: modelToFunctionInfo(model), moduleVars: [],
   zpUserVars: [], upstreamErrors: bag.hasErrors() }, plugin.profile, bag)` — the
   adapter is the RD-05-documented deferral (register: Pre-resolved context; empty
   inputs today are correct for the gate slice).

### `api/compile.ts` — `compile(options, host?): CompileResult` (R5)

`runFrontend` + result assembly. Severity policy applied **once** here (R31/PF-005):

```typescript
const policy = createSeverityPolicy({ warnAsError: config.warnAsError,
                                      suppressWarnings: config.suppressWarnings });
const diagnostics = applySeverityPolicy(
  [...run.configDiagnostics, ...run.bag.getAll()], policy);   // config first (AR-V7)
const hasErrors = diagnostics.some((d) => d.severity === "error");
```

`semanticModel`/`allocationPlan` included when the frontend reached them. The returned
`config.outName` carries the R21-derived **effective** name (`run.outName`, never left
`""`), so consumers read the resolved name from `config` per R51 (PF-001/PF-010). Sync
(R5 — no ACME, no I/O beyond host reads).

### `api/emit.ts` — `emitIl` / `emitAsm` (R7/R8, AR-V19)

- `emitIl(options, host?)`: frontend → `lowerToIL` → `optimizeIL` (always runs,
  AR-V19) → `text = printIL(il)`. No codegen (R8/AC-04).
- `emitAsm(options, host?)`: emitIl pipeline → `assembleProgram(il, plugin, bag,
  { projectName: run.outName, shimVariant: toShimVariant(config.startup) })` (PF-001 —
  see below) → peephole `optimizeInstr` only when `config.optimize` (AR-V19) →
  `collectReferencedRoutines` → `buildRuntimeSection` → `text = serializeToAcme(program,
  { runtimeSection })`. No ACME invocation, no file writes (R7/AC-03 — the CLI writes
  the file, R22).

> **Startup / output-name seam (PF-001).** The shipped `assembleProgram(il, plugin,
> bag)` hardcodes `projectName: "main"` and `shimVariant: "terminating"` in
> `derivePreambleOptions` (`codegen/src/instr/instr-program.ts:157-158`), whose comment
> already reserves the override for "the RD-15 driver". This plan adds the promised
> additive 4th param `overrides?: Partial<Pick<PreambleOptions, "projectName" |
> "shimVariant">>`, merged over `derivePreambleOptions` (non-breaking for RD-08/09
> consumers). Without it, `--out-name game` emits an `.asm` whose `!to` still names
> `main.prg`, and `--startup`/R46 is inert. `toShimVariant` maps the config `startup`
> (`auto|terminating|minimal|bare`) → core's `ShimVariant`
> (`terminating|non-terminating|bare`): `terminating→"terminating"`,
> `minimal→"non-terminating"` (RD-16 R18), `bare→"bare"`, `auto→undefined` (falls
> through to the Half-A default — the AR-69 CFG-analysis deferral).

Both return `EmitResult` with the same policy-applied diagnostics assembly as
`compile()`. Errors before the emit stage → `text` absent.

### `api/build.ts` — `build(options, host?, deps?): Promise<BuildResult>` (R6)

```typescript
/** Injectable seam for tests (AR-V4/AR-V12) — mirrors the EmitDeps precedent. */
export interface BuildDeps {
  readonly emitDeps: EmitDeps;                       // forwarded to emitBinary
  readonly readBinary: (path: string) => Uint8Array; // binary read-back (AR-V12)
}
export const defaultBuildDeps: BuildDeps;            // defaultEmitDeps + fs.readFileSync
```

Sequence after the emitAsm pipeline (asm text in hand):

1. `outName = run.outName` — the single derivation already produced in `runFrontend`
   step 4 (R21, AR-V6; PF-001/PF-010), not re-derived here.
2. `emitBinary(asmText, { outDir: config.outDir, projectName: outName, emitAsmOnly:
   false, acmePath: config.acmePath || undefined }, bag, deps.emitDeps)` — note:
   **`maxBinarySize` deliberately not passed** (AR-V5).
3. Assemble the report: `buildResourceReport({ platformName: config.platform,
   targetName: basename(binaryPath), plan, binaryBudget: plugin.profile.maxBinarySize,
   binarySize: emit.binarySize })` — `binarySize` threaded so the budget check cannot
   silently no-op (AR-V5 obligation); segment sizes/ranges stay absent → AR-102 zeros.
4. `checkBinaryBudget(report, bag)` (AR-V5 — the RD-11b canonical E10034, platform-named
   message). Cross-reference comments on both this call site and `emitBinary`'s inline
   check.
5. Result: policy-applied merged diagnostics (as in `compile()`); `symbolMap =
   emit.symbols`; on ACME success `binary = deps.readBinary(binaryPath)` (AR-V12);
   `resourceReport` always present when the pipeline reached step 3; failure derived
   from the final diagnostics array, not `emit.success` (AR-V5 addendum).

`--emit-asm`/`--emit-il` never reach `build()` — the CLI dispatches to
`emitAsm()`/`emitIl()` (R22/R23).

## Error Handling

| Error Case | Handling Strategy | Source |
| ---------- | ----------------- | ------ |
| Config invalid / unknown platform | Abort after step 1; result has config diagnostics, `config` (merged-with-defaults), empty sourceMap; exit-2 class | RD-16 R22, R50 |
| Discovery errors (E10250/E10251) | Abort before lexing; exit-2 class | R48/R49, AR-V10 |
| Frontend errors | Pipeline continues per stage tolerance (analyze/SFA receive `upstreamErrors`); codegen stages skipped when `bag.hasErrors()` after semantic — `text`/artifacts absent | R11 |
| ACME discovery/invocation failure | `emitBinary` records the ICE diagnostic; `.asm` retained; `binaryPath`/`binary` absent; exit-3 class (CLI maps via the ICE code, see 03-03) | R44, AR-68 |
| Over-budget binary | E10034 via `checkBinaryBudget`; `binary` still read back (artifact exists); `hasErrors` true → exit-1 class | AR-V5 |
| Any unexpected throw from a stage | Not caught-and-swallowed: a throw here is an ICE-grade bug; R11's "never throw" is satisfied by design (no stage throws on user input — verified per stage), not by a blanket try/catch that would mask defects | R11 + Design |

## Testing Requirements

- Spec: ST-8..ST-21 (facade contract, never-throw, policy application, two-bag merge,
  E10034-through-facade, fake-deps build).
- Impl: multi-file programs, option-to-override mapping table, `outName` derivation
  edge (explicit list with non-`.blend` extension), config-error result shape.
