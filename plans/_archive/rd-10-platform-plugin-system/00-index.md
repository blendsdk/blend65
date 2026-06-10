# RD-10 Platform Plugin System — Implementation Plan

> **Feature**: Implement the **platform plugin system** — the architecture that lets the
> Blend65 compiler target multiple 6502 platforms with **zero** platform assumptions in core
> (Language Guard P3). Defines the `PlatformProfile` data type and `PlatformPlugin` interface
> (+ hook types) in `@blend65/core`, the **canonical `CpuVariant`** type (resolving the
> RD-07a vs spec spelling conflict, D2), the full **`c64` plugin** with all codegen hooks
> (preamble / 3 startup-shim variants / `getOutputDirective` / PETSCII `encodeString` /
> termination policy / `validateProfile`), the static **registry + `loadPlatform`** loader,
> and **profile data + validation** for the other four platforms (`c64u`, `cx16`, `a800xl`,
> `a7800`). Scoped as a **slice** (D1): the RD-17-coupled T4 intrinsic descriptors and the
> hand-written `.asm` routine bodies, and the RD-15/16/09 consumption wiring, are deferred.
> Implements RD-10 R1–R22, R28–R41 (slice), and frozen spec Ch 15 + the 5 platform appendices.
> **Status**: 🟡 Planned (authoring complete; awaiting execution)

> **Created**: 2026-06-09
> **CodeOps Version**: (unstamped — no `codeops-mcp` dependency in this repo; consistent with RD-01..RD-07b)
> **Source**: [RD-10](../../requirements/RD-10-platform-plugin-system.md) · spec Ch 15 + appendix-{c64,c64u,cx16,a800xl,a7800} · master register AR-18/AR-20/AR-37/AR-43/AR-64/AR-65/AR-69

## Overview

The platform plugin system is the mechanism behind Language Guard **P3** ("no platform
assumptions in core"). Each target platform is a **plugin** = profile *data* (Ch 15 §3 fields)
+ behavior *hooks* (codegen-strategy callbacks, AR-18). The core compiler never names a memory
address, hardware chip, character encoding, or binary format — the active plugin provides them.

RD-10's only hard dependency is **RD-01**, which is complete. Crucially, RD-10 is
**end-to-end verifiable today** without RD-09: the codegen hooks emit `StreamEntry[]`, and the
already-shipped RD-07a serializer `printInstr` turns those into deterministic ACME text — so
the C64 preamble (`!to`/origin/BASIC-stub/startup-shim), the three shim variants, the `!to`
directive, and PETSCII string encoding are **golden-snapshot testable now**. This is the
keystone that later converts most of the blocked RD-07c surface (platform hooks, `preamble`)
from "fixture-only" into "end-to-end verifiable."

This plan builds, spec-tests-first:

1. **Core types + interface** (R1–R22 surface; D2/D6) — the canonical `CpuVariant`
   (`"nmos6502" | "wdc65c02"`, in core, re-exported by codegen), `PlatformProfile`,
   `PlatformPlugin`, and the hook types (`PreambleOptions`, `ShimVariant`,
   `MainTerminationPolicy`, `RuntimeModule`, `ValidationError`, `OutputFormat`,
   `CharEncoding`) — all **new** under `core/src/platform/`, exported from a **new
   `@blend65/core/platform` subpath barrel**. The interim `PlatformProfile` stub
   (`core/src/semantics/platform-profile.ts`, root-barrel export) is left **untouched**
   so shipped RD-04/RD-05 code and tests keep passing; reconcile/migrate is deferred (D6).
2. **The `c64` plugin** (R33, MVP) — full profile data (appendix-c64) + every codegen hook;
   golden-tested by serializing the emitted preamble/shim `StreamEntry[]` through `printInstr`.
3. **Registry + built-in profiles** (R28–R41) — the static `Map<string, PlatformPlugin>`,
   `loadPlatform(id)` (with the unknown-platform error), `DEFAULT_PLATFORM`, and profile data
   + `validateProfile` for `c64u`/`cx16`/`a800xl`/`a7800` (correct CPU variant + termination).

Following the AR-20 boundary, the interface + profile types live in `@blend65/core` (so both
`frontend` budget checks and `codegen` hooks consume them without a cycle); the plugin
*implementations* live in `@blend65/platforms`. The frozen `spec/` is never touched.

> **D1/D2 (load-bearing):** RD-10 here is a **slice**. Deferred to RD-17: T4 intrinsic
> descriptors (R23–R25; plugins ship `intrinsics: []`) and `.asm` routine **bodies** (R26–R27;
> only `runtimeModules` *metadata* is declared). Deferred to their own RDs: `--platform` CLI
> (RD-15), `blend65.json` `"platform"` (RD-16), ACME serialization + binary check (RD-09),
> emulator config (RD-12). The **canonical `CpuVariant` keeps RD-07a's shipped value
> `"wdc65c02"`** (D2) — codegen is not churned.

## Document Index

| #     | Document                                                                  | Description                                                                 |
| ----- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| AR    | [Ambiguity Register](00-ambiguity-register.md)                            | Plan-level Zero-Ambiguity Gate decisions (D1–D6)                            |
| 00    | [Index](00-index.md)                                                      | This document — overview and navigation                                      |
| 01    | [Requirements](01-requirements.md)                                        | In-scope (types + c64 plugin + registry + 5 profiles) vs deferred (RD-17/15/16/09); R/AC mapping |
| 02    | [Current State](02-current-state.md)                                      | The `@blend65/platforms` stub, the interim core `PlatformProfile`, RD-07a `CpuVariant`/`StreamEntry`/`printInstr` this builds on |
| 03-01 | [Profile & Plugin Interface](03-01-profile-and-plugin-interface.md)       | `CpuVariant` (canonical, in core), `PlatformProfile`, `PlatformPlugin`, hook types; new `@blend65/core/platform` subpath barrel (interim stub untouched, D6) |
| 03-02 | [C64 Plugin & Codegen Hooks](03-02-c64-plugin-and-hooks.md)               | c64 profile data + `emitPreamble`/shim variants/`getOutputDirective`/PETSCII/termination/`validateProfile`; printInstr goldens |
| 03-03 | [Registry & Built-in Profiles](03-03-registry-and-builtin-profiles.md)    | `PLATFORM_REGISTRY`/`loadPlatform`/`DEFAULT_PLATFORM`; c64u/cx16/a800xl/a7800 profile data + validation |
| 07    | [Testing Strategy](07-testing-strategy.md)                                | Spec/impl ST-cases incl. golden ACME-text snapshots of the C64 preamble via `printInstr` |
| 99    | [Execution Plan](99-execution-plan.md)                                    | Phases, sessions, and master task checklist                                 |

## Quick Reference

### Key Decisions

| Decision                          | Outcome                                                                                                  | Ref |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- | --- |
| Build strategy                    | **Slice**: types + full c64 plugin + registry + 5 profiles; defer RD-17 intrinsics/`.asm` bodies + RD-15/16/09 wiring | D1  |
| `CpuVariant` conflict             | **Canonical type in `@blend65/core/platform`, value `"nmos6502" \| "wdc65c02"`**; codegen re-exports; no codegen churn | D2  |
| PETSCII encoding                  | **MVP subset** per RD-10 §4.5 sketch (A–Z/a–z/0–9/space/`\n`/pass-through)                                | D3  |
| Non-MVP platform depth            | **Profile data + `validateProfile` + registry** now; bespoke per-platform hooks later                    | D4  |
| Commit mode                       | `--no-commit`                                                                                            | D5  |
| Interim profile (no-rework)       | **New canonical `PlatformProfile` under `core/src/platform/` + `@blend65/core/platform` subpath barrel**; interim stub untouched; migration deferred | D6  |

### Public API surface added by this plan

```typescript
// @blend65/core/platform (subpath barrel) — canonical CPU variant (D2/D6; codegen re-exports this)
export type CpuVariant = "nmos6502" | "wdc65c02";

// @blend65/core/platform — platform profile data (Ch 15 §3) — NEW; interim root-barrel profile untouched (D6)
export interface PlatformProfile { /* memory map, budgets, output, cpu, encoding, … */ }
export type OutputFormat = "prg" | "bin" | "rom" | "xex" | "a78";
export type CharEncoding = "petscii" | "atascii" | "ascii";

// @blend65/core — plugin contract + hook types
export interface PlatformPlugin { /* id, displayName, profile, intrinsics, runtimeModules, hooks */ }
export interface PreambleOptions { projectName: string; shimVariant: ShimVariant;
  needsBssZero: boolean; needsDataInit: boolean; }
export type ShimVariant = "terminating" | "non-terminating" | "bare";
export interface MainTerminationPolicy { canReturn: boolean; warningOnReturn?: string; }
export interface RuntimeModule { name: string; asmPath: string; exports: string[]; }
export interface ValidationError { field: string; message: string; }

// @blend65/platforms — registry + loader
export const PLATFORM_REGISTRY: ReadonlyMap<string, PlatformPlugin>;
export const DEFAULT_PLATFORM: string;            // "c64"
export function loadPlatform(id: string): PlatformPlugin;   // throws listing available IDs
export const c64Plugin: PlatformPlugin;           // + c64uPlugin, cx16Plugin, a800xlPlugin, a7800Plugin
```

### What is explicitly NOT implemented (deferred)

1. **T4 intrinsic descriptors** (R23–R25) — `IntrinsicDescriptor` is RD-17's type; plugins ship `intrinsics: []`.
2. **Runtime `.asm` routine bodies** (R26–R27) — only `runtimeModules` *metadata* declared; bodies are RD-17/AR-30.
3. **`--platform` CLI flag** (RD-15), **`blend65.json` `"platform"`** (RD-16) — consumption wiring.
4. **ACME serialization of the preamble + post-ACME binary check** (RD-09) — RD-10 produces `StreamEntry[]`, golden-tested via `printInstr`; the emitter is RD-09.
5. **Bespoke non-MVP hook bodies** — ATASCII, `.a78` cartridge header, CX16 banked startup (D4).

## Related Files

Created/modified by this plan (interface/types in `@blend65/core`, plugins in `@blend65/platforms`; nothing in `spec/`):

- **New (`@blend65/core`):** `packages/core/src/platform/cpu-variant.ts`,
  `platform/platform-profile.ts`, `platform/platform-plugin.ts` (+ hook types),
  `platform/index.ts` (the new subpath barrel), plus `*.spec.test.ts`/`*.impl.test.ts`.
- **Modified (`@blend65/core` packaging):** `packages/core/package.json` — add the
  `"./platform"` subpath to `exports` (D6); `tsconfig` include already covers `src/`.
- **New (`@blend65/platforms`):** `packages/platforms/src/c64.ts`, `c64u.ts`, `cx16.ts`,
  `a800xl.ts`, `a7800.ts`, `registry.ts`, plus `*.spec.test.ts`/`*.impl.test.ts` and the
  `printInstr` preamble goldens.
- **Untouched (`@blend65/core`):** the interim `PlatformProfile` stub
  (`core/src/semantics/platform-profile.ts`) and its root-barrel export are **left as-is**
  so shipped RD-04/RD-05 code + tests keep passing; reconcile/migrate deferred (D6). The
  canonical profile is a NEW type — it does **not** replace the stub.
- **Modified (`@blend65/codegen`):** `packages/codegen/src/instr/stream.ts` — re-export the
  canonical `CpuVariant` from `@blend65/core/platform` instead of defining it locally (D2).
- **Modified (`@blend65/platforms`):** `packages/platforms/src/index.ts` — export the registry,
  loader, and plugins (replacing the `VERSION`-only stub export surface).
- **Annotated (requirements, not frozen):** `requirements/RD-10-platform-plugin-system.md`
  (status banner: slice done; RD-17/15/16/09 carry the deferred remainder).
