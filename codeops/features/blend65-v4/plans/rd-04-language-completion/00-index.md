# RD-04 Language Completion Implementation Plan

> **Feature**: Complete Specification 4 and the correct `optimization: none` compiler
> **Status**: Planning Complete
> **Created**: 2026-09-23
> **Implements**: blend65-v4/RD-04
> **CodeOps Artifact Schema**: 1

## Overview

This plan completes every RD-04 core-language form through the existing compiler path: project
snapshot, frontend, semantic operations, whole-program analysis, SFA, NMOS 6510 lowering, ACME,
PRG packaging, evidence, CLI and shared language-service diagnostics. Each language family is
implemented vertically and qualified before the next family starts.

The plan deliberately adds no second compiler, optimizer framework, runtime, readiness product,
or test package. Focused tests stay beside their owners. Only cross-stage qualification lives under
`test/rd04/`. Native Windows execution remains deferred to RD-10 under AR-P5.

## Minimum-Sufficient Baseline

**Original goal:** Complete the frozen Specification 4 language and a correct expert-grade
`optimization: none` compiler for the first qualified C64 surface.

**Smallest viable design:** Extend the connected RD-03 pipeline with the missing typed syntax,
semantic payload, ABI/SFA facts, direct NMOS sequences, artifact evidence and focused qualification.

**Excluded machinery:** New packages, alternate frontend/backend paths, a pass or plugin framework,
generic runtime, software stack, readiness service, dashboard, broad game corpus and speculative
future-target implementations.

**Approved complexity:** AR-P2 and AR-P6 through AR-P8.

## Document Index

| # | Document | Description |
|---|---|---|
| AR | [Ambiguity Register](00-ambiguity-register.md) | Nine resolved planning decisions |
| 00 | [Index](00-index.md) | Scope and navigation |
| 01 | [Requirements](01-requirements.md) | RD-04 delta view |
| 02 | [Current State](02-current-state.md) | Existing pipeline and gaps |
| 03-01 | [Authority and Frontend](03-01-authority-and-frontend.md) | Coverage, lexing, parsing, modules and diagnostics |
| 03-02 | [Values and Memory](03-02-values-and-memory.md) | Scalars, control flow, aggregates, addresses and effects |
| 03-03 | [Calls, ABI and SFA](03-03-calls-abi-and-sfa.md) | Calls, function values, domains, compile time and storage closure |
| 03-04 | [Machine and Artifacts](03-04-machine-and-artifacts.md) | `none` lowering, layout, ACME and evidence |
| 03-05 | [Qualification](03-05-qualification.md) | Independent behavior and expert-output proof |
| 07 | [Testing Strategy](07-testing-strategy.md) | Specification cases and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Nine ordered implementation phases |

## Quick Reference

### Usage Examples

The completed compiler must accept ordinary source forms without hardware-shaped workarounds:

```blend65
let pixels: byte[320] = [; 0];

function choose(flag: boolean): byte[320] {
  return flag ? pixels : [; 0];
}

function main(): void {
  for (let i: word = 0; i < length(pixels); i += 1) {
    pixels[i] = byte(i);
  }
}
```

### Key Decisions

| Decision | Outcome |
|---|---|
| Plan boundary | All RD-04 requirements in one nine-phase plan; no RD-05 through RD-09 work (AR-P1, AR-P2) |
| Compiler shape | Extend the current pipeline; split only oversized files that a phase touches (AR-P8) |
| Completion proof | One static checked crosswalk, existing test topology and v4 expressiveness gate (AR-P6, AR-P7, AR-P9) |
| Output floor | Direct `none` lowering must meet or beat equal-contract expert output (AR-P4) |
| Host coverage | Linux now; native Windows evidence at RD-10 (AR-P5) |

## Related Files

- `codeops/features/blend65-v4/requirements/RD-04-complete-language-correct-unoptimized-compiler.md`
- `spec/00-normative-inventory.md`
- `packages/compiler/src/frontend/`
- `packages/compiler/src/semantic/`
- `packages/compiler/src/storage/`
- `packages/compiler/src/machine/`
- `packages/compiler/src/artifacts/`
- `test/rd04/`
