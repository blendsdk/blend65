# RD-17: Intrinsic Functions & Runtime-Routine ABI — Implementation Plan

> **Feature**: The compiler's uniform model for all built-in/platform callable operations — a typed descriptor registry, semantic validation, T1/T2 Instr emission, T3 runtime `.asm` modules with call-site marshalling, and the T4 platform contribution mechanism.
> **Status**: Planning Complete
> **Created**: 2026-07-02
> **Implements**: blend65-ri/RD-17
> **CodeOps Skills Version**: 3.1.0

## Overview

RD-17 closes the gap between what Blend65 offers as built-in primitives (frozen spec
Ch 12) and how the compiler generates code for them. Today the pipeline special-cases
`peek`/`poke` (lowered directly to `load`/`store`, literal addresses only), ICEs on every
other intrinsic, emits `JSR __rt_mul8/__rt_mul16/__rt_div8/__rt_div16` call sites whose
`.asm` bodies do not exist, and performs **zero** semantic validation (the RD-04 analyzer
shipped as a passthrough skeleton with all intrinsic rules deferred to this RD).

This plan builds: the `IntrinsicDescriptor`/`IntrinsicRegistry` core (replacing two
shipped placeholders), the complete 23-descriptor catalog (22 Ch 12 intrinsics +
65C02-gated `asm_wai`), the first real semantic-validation pass (arity, literal arg
types, availability, reserved-name shadowing, T4 import boundary, W10120), descriptor-
driven IL lowering and T1/T2 Instr emission, the four hand-written T3 runtime routines
with textual embedding + dead-strip into the single RD-09 `.asm` output, ABI-correct
call-site marshalling (AR-33/AR-98), and the T4 plugin contribution mechanism proven via
a test fixture. After this RD, no individual intrinsic name is special-cased anywhere
(AC-17) and a program using `*`/`/`/`%` assembles with no unresolved symbols (AC-19).

## Document Index

| #   | Document                                            | Description                                     |
| --- | --------------------------------------------------- | ----------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)      | Zero-Ambiguity Gate decisions AR-P1..P16        |
| PF  | [Preflight Report](00-preflight-report.md)          | Plan preflight PF-014..PF-024 (all resolved)    |
| 00  | [Index](00-index.md)                                | This document — overview and navigation         |
| 01  | [Requirements](01-requirements.md)                  | Requirements and scope (from RD-17)             |
| 02  | [Current State](02-current-state.md)                | What exists / gaps (preflight-grounded)         |
| 03-01 | [Core Registry & Catalog](03-01-core-registry.md) | Descriptor types, registry, catalog, diag codes |
| 03-02 | [Semantic Validation](03-02-semantic-validation.md) | The frontend intrinsic-validation pass        |
| 03-03 | [IL & T1/T2 Codegen](03-03-il-t1-t2-codegen.md)   | Descriptor-driven lowering, folds, inline emission |
| 03-04 | [T3 Runtime & Marshalling](03-04-t3-runtime-marshalling.md) | `.asm` bodies, embedding, dead-strip, ABI marshalling |
| 03-05 | [T4 Platform Mechanism](03-05-t4-platform-mechanism.md) | Plugin descriptor contribution + fixture   |
| 07  | [Testing Strategy](07-testing-strategy.md)          | ST cases and verification                       |
| 99  | [Execution Plan](99-execution-plan.md)              | Phases, sessions, task checklist                |

## Quick Reference

### Usage Examples

```blend65
// T2 — ambient, inline (the MVP gate program)
poke($D020, 5);                    // STA $D020 (constant address; else E10045)
let v: byte = peek($D021);         // LDA $D021

// T2 — compile-time folds
let n: byte = sizeof(Sprite);      // folds to the struct's byte size
let o: byte = offsetof(Sprite, y); // folds to the field offset

// T1 — ambient, one opcode each (all 13 Ch 12 names)
asm_sei();  asm_nop();  asm_cli();

// T1 — CPU-gated: E10043 on nmos6502 targets
asm_wai();                          // requires wdc65c02 (cx16)

// T3 — operator-backing runtime routines (never user-called)
let p: word = a * b;               // JSR __rt_mul8, a→A, b→X, result A/X

// T4 — explicit import from the platform pseudo-module (AR-97)
import { fix_probe } from c64;     // without the import: compile-time error
```

### Key Decisions

| Decision | Outcome | AR |
|----------|---------|----|
| Plan scope | Full RD-17, one plan | AR-P1 |
| T4 content | Mechanism + test fixture only | AR-P2 |
| Registry threading | Parameter injection; core hosts catalog | AR-P3 |
| Routine verification | Assemble-level now; emulator math deferred to RD-12 | AR-P4 |
| E10045 site | Codegen IL lowering (replaces ICE) | AR-P5 |
| Type-check depth | Arity full; literal-arg types only | AR-P6 |
| Word marshalling | a→A/X, b→ZP block; div16 remainder overwrites b | AR-P7 |
| Layout & names | `core/src/intrinsics/`, `codegen/runtime/*.asm` | AR-P8 |
| sizeof folding | Minimal declaration-collection pass | AR-P13 |
| Analyzer target threading | `AnalyzeInput.targetProfile?` (canonical) | PF-014 |
| T4 platform identity | Canonical profile gains `platformId` | PF-015 |
| Codegen threading | Optional `opts` on `generateInstr`/`serializeToAcme` | PF-016 |
| T4 asset resolution | `RuntimeModule.baseUrl` (`import.meta.url`) | PF-017 |
| `length` boundary | ≤255 → `byte` (deliberate spec deviation) | AR-P15 |
| Signed `*`//`%` | Explicitly deferred (unsigned-only routines) | AR-P16 |

## Related Files

**Created:** `packages/core/src/intrinsics/{descriptor,registry,catalog}.ts`,
`packages/codegen/runtime/{mul8,mul16,div8,div16}.asm`, `packages/codegen/src/runtime/embed.ts`,
`packages/frontend/src/semantics/intrinsic-validation.ts` (+ test files per tier).
**Modified:** `core/src/diagnostics/diagnostic-codes.ts`, `core/src/ast/reserved-builtins.ts`,
`core/src/instr-model/opcode.ts`, `core/src/platform/platform-plugin.ts` (placeholder → real type;
`RuntimeModule` +`baseUrl`), `core/src/platform/platform-profile.ts` (+`platformId`),
`core/src/platform/validate-profile.ts`, `core/src/semantics/platform-profile.ts` (`zpArgBlockMin` 0→4),
`frontend/src/semantics/{analyze,passes}.ts` (+`registry`/`targetProfile`),
`codegen/src/il/{lower,intrinsic-descriptor}.ts`,
`codegen/src/instr/{translate,instr-program,serialize-acme}.ts` (optional `opts` threading),
`platforms/src/*.ts` (runtimeModules migration; profiles +`platformId`).
