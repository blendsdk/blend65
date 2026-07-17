# RD-18 Slice 8b — Strings & Embed Implementation Plan

> **Feature**: String/char literals with platform encoding, the frontend↔platform encoding seam,
> raw-binary `embed()` with traversal-safe path resolution, and the RD-18 rollout-closure phase —
> the data half of RD-18 Slice 8 and the LAST slice of the rollout.
> **Status**: Planning Complete
> **Created**: 2026-07-17
> **Implements**: blend65-ri/RD-18
> **CodeOps Skills Version**: 3.8.0

## Overview

Slice 8b completes the RD-18 codegen rollout. Per 8a AR-1 the slice-8 surface was split; this
plan delivers the deferred data half: string literals → platform-encoded `const byte[]` data,
char literals → encoded `byte` constants, escape decoding per Ch 01 §7.2, and raw-binary
`embed()` per Ch 13 EMB-1..4 with the Parked-Q2 traversal policy — plus the RD-18 closure phase
(acceptance items 8–9) that formally ends the rollout.

The lexer, AST, and parser already cover this entire surface; everything downstream is
unimplemented (silent-poison typing, no const-eval arms, five dormant `Embed*` diagnostic codes).
The architectural core of the plan is two core-defined injection seams that keep the R15
boundary intact: a **`CharEncoder`** derived from the platform profile (encoders move to
`@blend65/core`, AR-5/AR-6) and an **`AssetReader`** implemented at the compiler layer over the
filesystem (AR-12). Both literals reach the existing array-init/const-image/codegen machinery via
**AST desugar** into synthetic `ArrayLitExpr`/`NumericLitExpr` nodes (AR-8/AR-9), so codegen and
the shipped `__data_*` emission path are reused untouched (AR-13). Two shipped loud rejections
are retired to green under the retired-row protocol (the E90001 string-init ICE and the 8a
zeropage-string pin).

The acceptance program is a C64 fixture (`examples/slice8b/`) that writes an encoded string to
screen RAM and verifies embedded binary data byte-for-byte on real VICE 3.10 under the standard
three-part bar (AR-14).

## Document Index

| #   | Document                                         | Description                                    |
| --- | ------------------------------------------------ | ---------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)   | Zero-Ambiguity Gate decisions (17 rows)        |
| 00  | [Index](00-index.md)                             | This document — overview and navigation        |
| 01  | [Requirements](01-requirements.md)               | Scope delta view over RD-18                    |
| 02  | [Current State](02-current-state.md)             | Pipeline-stage analysis per feature            |
| 03-01 | [Encoding Seam](03-01-encoding-seam.md)        | Core encoders, escape decoding, seam threading |
| 03-02 | [Literal Desugar](03-02-literal-desugar.md)    | Char/string desugar, diagnostics, retirements  |
| 03-03 | [Embed](03-03-embed.md)                        | AssetReader seam, path security, typing, data  |
| 03-04 | [Acceptance Fixture](03-04-acceptance.md)      | Fixture, golden, VICE, negatives               |
| 03-05 | [Rollout Closure](03-05-closure.md)            | RD-18 items 8–9 audit protocol                 |
| 07  | [Testing Strategy](07-testing-strategy.md)       | ST-cases and verification                      |
| 99  | [Execution Plan](99-execution-plan.md)           | Phases, sessions, task checklist               |

## Quick Reference

### Usage Examples

```blend65
module Main;

const TITLE: byte[] = "HELLO C64!\0";     // petscii-encoded, size 11 incl. \0 (AR-3/AR-8)
const SINE: byte[] = embed("sine.bin");   // raw bytes, size = file size (AR-11/AR-12)
let banner: byte[40] = ["READY"; ' '];    // string + char fill, space-padded (AR-8)

function main(): void {
  for (let i: byte = 0 to length(TITLE)) {   // length() folds from inferred size
    poke($0400 + word(i), TITLE[i]);
  }
  if (peek($0400) == 'H') { }                // char literal = encoded byte (AR-9)
}
```

### Key Decisions

| Decision | Outcome |
| -------- | ------- |
| Lexical canon | Shipped lexer/Ch 01; STR-5 + grammar §9.6 = superseded deviations (AR-2) |
| Default encoding | Ch 15/shipped profiles win (`petscii`/`atascii`/`ascii`); Ch 08 STR-2 = byte-level deviation (AR-3) |
| Encoding intrinsics | OUT — platform-default only; family + `encode()` + E10125 deferred (AR-4) |
| Encoders | Three core-resident algorithmic encoders; a800xl/a7800 stubs fixed (AR-5); fallible, E10127 on unmappable (AR-7) |
| Seam | Core `CharEncoder` derived from `targetProfile.defaultEncoding` in `analyze()`; threaded into `ConstTypeEngine` (AR-6) |
| Literal mechanism | AST desugar to synthetic `ArrayLitExpr`/`NumericLitExpr`; mint E10116/E10124 (AR-8/AR-9) |
| embed() | Raw-only, const-initializer-only; source-relative + project-root containment; mint E10205; 64 KiB stat-before-read cap (AR-10/AR-11) |
| embed() placement | Core `AssetReader` (Uint8Array contract) injected into `analyze()`; provenance + asset-path map (AR-12) |
| Emission | Shipped `__data_*` `!byte` path; no `!bin` (AR-13) |
| Closure | Tick-with-annotation audit of RD-04/06/07 ACs; RD-04b phantom retired (AR-15) |

## Related Files

- `packages/core/src/platform/` — new `encoding.ts` (three encoders + `CharEncoder` contract)
- `packages/core/src/text/` (new) — escape-decode utility (segment model)
- `packages/core/src/host/` — `AssetReader` contract
- `packages/core/src/diagnostics/diagnostic-codes.ts` — E10116/E10124/E10127/E10205 (additive)
- `packages/platforms/src/shared-hooks.ts` + 5 platform files — hooks delegate to core encoders
- `packages/frontend/src/semantics/analyze.ts`, `type-check/{context,statement-typing,expression-typing}.ts`, `const-type-engine.ts`, `const-eval.ts`, `const-images.ts` — seam threading + desugar + embed typing
- `packages/codegen/src/il/lower.ts` — embed provenance passthrough (`ConstDataEntry.type:"embed"`)
- `packages/compiler/src/api/run-frontend.ts` — encoder derivation + disk `AssetReader`
- `examples/slice8b/` + `packages/test-harness/src/testing/slice8b*` + goldens — acceptance tier
- `codeops/features/blend65-ri/requirements/RD-{04,06,07,18}-*.md` — closure-phase ticks
