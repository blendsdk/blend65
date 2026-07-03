# RD-15: Programmatic & CLI API — Implementation Plan

> **Feature**: The two public surfaces of the Blend65 compiler — the `@blend65/compiler`
> programmatic API (`compile`/`build`/`emitAsm`/`emitIl`) and the `@blend65/cli` `blendc`
> command — wiring every shipped pipeline piece into a runnable toolchain.
> **Status**: Planning Complete
> **Created**: 2026-07-03
> **Implements**: blend65-ri/RD-15
> **Source RD**: [RD-15](../../requirements/RD-15-programmatic-cli-api.md) (requirements
> preflight ✅ PASSED 2026-07-03, 10 findings fixed)
> **CodeOps Skills Version**: 3.1.0

## Overview

RD-15 turns the finished compiler pieces into a usable product. AR-77 mandates a
library-first design: `@blend65/compiler` exports a facade — `compile()` (frontend only,
the future LSP's API), `build()` (full pipeline through ACME), `emitAsm()` and `emitIl()`
(partial pipelines) — that returns structured result objects, never throws, and never
prints. `@blend65/cli` is one consumer of that facade: the `blendc` command adds yargs
argument parsing, terminal rendering (diagnostics → stderr, build summary/JSON report →
stdout), artifact writing, and the R50 exit-code classification (0 success / 1 compile
errors / 2 configuration errors / 3 ACME ICE).

Every consumable this RD needs is already shipped: RD-16's `loadConfig()`, RD-09's ACME
process layer (`emitBinary` + discovery/invocation/label parsing), RD-11b's `SourceMap`,
severity policy, diagnostic renderers and `ResourceReport`/`checkBinaryBudget`, RD-10's
platform registry, and RD-17's intrinsic registry. The facade is thin wiring (R2) — it
owns no compiler logic. This plan also discharges the two deferred RD-11 items assigned
to RD-15 (AC-16's `--quiet` half; E10034 wiring after `emitBinary`) and the PF-002 rename
of RD-09's internal `BuildResult` to `EmitBinaryResult`.

New surface introduced here: the `CompilerHost` abstraction in `@blend65/core` (R14),
its `DiskCompilerHost` implementation with three-tier file discovery and R47 glob
expansion (tinyglobby, AR-V3), the driver diagnostic band `E10250`/`E10251` (AR-V10),
and three new runtime dependencies overall (yargs@17, @types/yargs dev, tinyglobby —
AR-V1/AR-V3; chalk was **rejected** per AR-V2's zero-dependency color decision, a
user-ratified runtime amendment of requirements AR-17).

## Document Index

| #   | Document                                        | Description                                  |
| --- | ----------------------------------------------- | -------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)  | Zero-Ambiguity Gate decisions (audit trail)  |
| 00  | [Index](00-index.md)                            | This document — overview and navigation      |
| 01  | [Requirements](01-requirements.md)              | Requirements and scope (from RD-15)          |
| 02  | [Current State](02-current-state.md)            | What exists, gaps, and integration evidence  |
| 03-01 | [CompilerHost & Discovery](03-01-compiler-host.md) | Core `CompilerHost`, `DiskCompilerHost`, E10250/E10251 |
| 03-02 | [Compiler Facade](03-02-compiler-facade.md)   | Options/results, pipeline wiring, `compile`/`build`/`emitAsm`/`emitIl` |
| 03-03 | [CLI](03-03-cli.md)                           | `blendc`: args, rendering, color, exit codes |
| 07  | [Testing Strategy](07-testing-strategy.md)      | ST-1..ST-40 spec cases + verification        |
| 99  | [Execution Plan](99-execution-plan.md)          | 4 phases, 13 sessions, 50 tasks              |

## Quick Reference

### Usage Examples

```typescript
// Programmatic (the LSP path)
import { compile } from "@blend65/compiler";
const result = compile({ platform: "c64", sourceFiles: ["main.blend"] });
if (result.hasErrors) console.error(renderTerminal(result.diagnostics, result.sourceMap, { color: false }));

// Full build
import { build } from "@blend65/compiler";
const out = await build({ platform: "c64" });      // discovery via blend65.json / **/*.blend
out.binaryPath;                                     // ./build/<name>.prg
```

```bash
# CLI
blendc build game.blend --platform c64              # → ./build/game.prg + summary table
blendc check                                        # frontend only, exit 0/1/2
blendc build --emit-asm --platform c64              # .asm only, no ACME
blendc build --report=json --platform c64 > r.json  # machine-readable report on stdout
```

### Key Decisions

| Decision | Outcome | AR |
| -------- | ------- | -- |
| Argument parser | yargs@17 + @types/yargs (no v18 types exist) | AR-V1 |
| Color | Zero-dependency (amends requirements AR-17); one `color: boolean` computed in the CLI | AR-V2 |
| Glob engine | tinyglobby + sort + projectRoot containment | AR-V3 |
| Testing | Injectable `BuildDeps` + skipIf real-ACME E2E + ACME installed in CI | AR-V4 |
| E10034 | Facade calls core `checkBinaryBudget(report, bag)`; `emitBinary` not opted in | AR-V5 |
| Host wiring | Config-first; injected host verbatim; `sourceFiles` bypass; E10250/E10251 | AR-V6 |
| Diagnostics | Two bags (config cap 20, pipeline cap `config.maxErrors`), policy applied once over merge | AR-V7 |
| Exit mechanism | `process.exitCode` + custom yargs `.fail()` → 2 | AR-V13 |
| Exit-3 trigger | ICE band via `isIceCode` (no ACME-specific code); `E10035`→exit 1 | AR-V21 |
| `cwd` | `CompilerOptions.cwd` threads config discovery + relative-path base | AR-V20 |
| Startup/`!to` | additive `assembleProgram` override seam; `outName` derived once in `runFrontend` | PF-001 |

## Related Files

**New:** `core/src/host/{compiler-host,index}.ts` · `compiler/src/api/{options,results,run-frontend,compile,build,emit,index}.ts` · `compiler/src/host/{disk-host,index}.ts` · `cli/src/{bin,main,args,render,color}.ts` (+ rewritten `index.ts`) · spec/impl test files per 07.

**Modified:** `core/src/diagnostics/diagnostic-codes.ts` (E10250/E10251) · `core/src/index.ts` (host barrel) · `compiler/src/acme/emit-binary.ts` + `compiler/src/index.ts` (RD-09-preflight PF-002 rename) · `codegen/src/instr/instr-program.ts` (`assembleProgram` override seam — plan-preflight PF-001) · `cli/package.json` (bin, deps) + `cli/vitest.config.ts` ({spec,impl} include — PF-005) · `compiler/package.json` (tinyglobby) · `eslint.config.js` (AC-18 rules) · `.github/workflows` (ACME install, AR-V4) · `requirements/RD-15-programmatic-cli-api.md` + `requirements/00-ambiguity-register.md` (AR-V2/V20/V21/V22 back-propagation) · `requirements/RD-11-diagnostics-reporting.md` (AC-16 closure at completion).

> **Note on `PF-` numbering:** `PF-001/PF-002` cited in the RD-09/RD-15 *requirements*
> layer are the earlier **requirements**-preflight series (e.g. the `BuildResult`→
> `EmitBinaryResult` rename is requirements-PF-002). The **plan**-preflight series
> (this plan, `00-preflight-report.md`) reuses `PF-001…PF-013` independently — plan-PF-001
> is the codegen startup seam. Context disambiguates; both are called out where they appear.
