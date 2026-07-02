# RD-16 Compiler Configuration (`blend65.json`) Implementation Plan

> **Feature**: `@blend65/config` — locate, parse (JSONC), validate, and merge `blend65.json` into a fully populated `BlendConfig`
> **Status**: Planning Complete — ✅ plan preflighted 2026-07-02 (PF-015..PF-022 resolved & applied)
> **Created**: 2026-07-02
> **Implements**: blend65-ri/RD-16
> **CodeOps Skills Version**: 3.1.0

## Overview

Blend65 projects are configured by a single `blend65.json` file modeled on TypeScript's
`tsconfig.json` (AR-13): JSONC format (comments + trailing commas), discovered by walking
up from the working directory, always overridable by invocation options. RD-16 turns the
`@blend65/config` stub (today it exports only `VERSION`) into the real loader: a
synchronous `loadConfig()` that discovers the file, parses it tolerantly, validates every
key, applies the documented defaults, merges invocation overrides on top, and reports
every problem through the shared `DiagnosticBag` (AR-73 — accumulate, never throw).

This is the first Phase-A driver component after RD-17: RD-15's CLI/programmatic API
consumes `LoadConfigResult` directly, and RD-14's language server will reuse the same
loader. The plan also claims the config diagnostic band in `@blend65/core`
(E10240–E10246, W10240–W10241 — per AR-P3) and introduces the workspace's first external
runtime dependency, `jsonc-parser` (per AR-P1).

Scope is exactly RD-16 §2: the loader carries `include`/`exclude` patterns verbatim (glob
*expansion* is RD-15/RD-14's), defines no CLI flags (RD-15), and applies no severity
policy (RD-11). All contract-level decisions were settled by the RD's preflight
(PF-001..PF-014, 2026-07-02); the 9 plan-level decisions live in the Ambiguity Register
(AR-P9 added by the plan preflight, PF-015..PF-022 — see `00-preflight-report.md`).

## Document Index

| #   | Document                                            | Description                                 |
| --- | --------------------------------------------------- | ------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)      | Zero-Ambiguity Gate decisions (audit trail) |
| PF  | [Preflight Report](00-preflight-report.md)          | Plan preflight audit (PF-015..PF-022, resolved) |
| 00  | [Index](00-index.md)                                | This document — overview and navigation     |
| 01  | [Requirements](01-requirements.md)                  | Feature requirements and scope              |
| 02  | [Current State](02-current-state.md)                | Analysis of current implementation          |
| 03  | [Config Loader](03-01-config-loader.md)             | Technical specification (core codes + package) |
| 07  | [Testing Strategy](07-testing-strategy.md)          | Spec test cases (ST-*) and verification     |
| 99  | [Execution Plan](99-execution-plan.md)              | Phases, sessions, and task checklist        |

## Quick Reference

### Usage Examples

```typescript
import { createDiagnosticBag } from '@blend65/core';
import { loadConfig } from '@blend65/config';

const bag = createDiagnosticBag(); // default cap 20 — bootstrap note, RD-16 §4.3
const { config, hasErrors } = loadConfig({
  bag,
  cwd: process.cwd(),
  overrides: { platform: 'c64' },              // CLI flags or programmatic CompilerOptions
  knownPlatforms: ['c64', 'c64u', 'cx16', 'a800xl', 'a7800'],
});
if (hasErrors) {
  // render bag.getAll(), exit code 2 (RD-15 R43)
}
```

```jsonc
// blend65.json — minimal (AC-12)
{
  "platform": "c64"
}
```

### Key Decisions

| Decision | Outcome | Ref |
| -------- | ------- | --- |
| JSONC parsing | `jsonc-parser` dependency (workspace's first external runtime dep) | AR-P1 |
| Diagnostic locations | Synthetic spans, `CONFIG_SOURCE_ID = -2` sentinel, byte offsets into `blend65.json` | AR-P2 |
| Diagnostic codes | E10240–E10246 + W10240/W10241 (E10230s belong to enums in the frozen spec) | AR-P3 |
| Parse-error behavior | Report all parse errors, validate the recovered tree best-effort | AR-P4 |
| Root-escape check (R29) | Syntactic: reject absolute patterns or any `..` segment | AR-P5 |
| Module layout | 7 modules + `index.ts` entry | AR-P6 |
| Test strategy | Real temp dirs for integration; pure helpers unit-tested hermetically | AR-P7 |
| API shape | `loadConfig(options): { config, hasErrors }`, all diagnostics into caller's bag | RD-16 R26 (preflight PF-002) |
| Post-error config values | as-merged, `platform: ""` when unset; consumers gate on `hasErrors` | AR-P9 (plan preflight PF-022) |
| Span offsets & line/col | jsonc-parser code-unit offsets converted to UTF-8 bytes; line/col via core `LineMap`; negative-ordinal synthetic spans | Plan preflight PF-017/018/019 |

## Related Files

**Created:**
- `packages/config/src/types.ts`, `defaults.ts`, `discovery.ts`, `parse.ts`, `validate.ts`, `merge.ts`, `load-config.ts` (AR-P6)
- Spec/impl test files per module (see `07-testing-strategy.md`)

**Modified:**
- `packages/config/src/index.ts` — public API re-exports (replaces the stub)
- `packages/config/src/index.spec.test.ts` — updated smoke → public-API surface test
- `packages/config/package.json` — add `jsonc-parser` dependency
- `packages/core/src/diagnostics/diagnostic-codes.ts` — claim E10240–E10246, W10240–W10241
