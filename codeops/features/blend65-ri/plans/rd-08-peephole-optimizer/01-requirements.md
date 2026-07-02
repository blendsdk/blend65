# Requirements: RD-08 Peephole Optimizer (passthrough v1)

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-08](../../requirements/RD-08-peephole-optimizer.md) +
>   [Preflight report](../../requirements/00-preflight-report.md) (PF-001..PF-009)

## Feature Overview

The peephole optimizer is the second and final optimization stage of the Blend65 back end
(the first is the IL optimizer, RD-06, also passthrough v1). It consumes the `InstrProgram`
produced by codegen (`generateInstr`, RD-07b; `assembleProgram`, RD-07c) and returns an
`InstrProgram` for the ACME emitter (RD-09).

**v1 is a deliberate thin passthrough.** It establishes the public entry point and the rule
*type contract* (`PeepholeRule`) so future optimization rules can be added without
architectural change, but it applies **zero** rules: it validates the program's structure and
returns it unchanged.

## Functional Requirements

### Must Have

- [ ] FR-1: Export `optimizeInstr(program, cpuVariant, bag, options?)` from `@blend65/codegen`
  returning an `InstrProgram`. *(RD R1; PF-001/PF-003)*
- [ ] FR-2: The second parameter is the bare `CpuVariant` primitive imported from
  `@blend65/core` — NOT a `PlatformProfile`. *(PF-002/PF-003)*
- [ ] FR-3: v1 returns the input program **structurally unchanged**: `preamble`, `streams`,
  and `allocationPlan` all carried through verbatim (byte-identical serialization). *(RD R5,
  R25; PF-004)*
- [ ] FR-4: When `options.enabled === false` (the `--no-optimize` surface), the optimizer is a
  guaranteed passthrough that returns the input reference directly. *(RD R26/R27)*
- [ ] FR-5: Before returning, v1 runs `validateProgramStructure(program, bag)` asserting the
  enumerated structural predicates (see Technical Requirements). *(RD R6; PF-006)*
- [ ] FR-6: Define the `PeepholeRule` interface (`name`, `windowSize`, `priority`, `cpuCompat`,
  `match()`, `replace()`) and the `PeepholeOptions` interface, plus the internal
  `V1_RULES: PeepholeRule[] = []`. *(RD R8, §4.1; PF-001)*
- [ ] FR-7: The optimizer never adds or removes streams; the count of `InstrStream` entries in
  the program is preserved. *(RD R25)*
- [ ] FR-8: Any structural violation is reported as an ICE (`E90001`, `IceCode.Unexpected`) on
  the `DiagnosticBag`; the optimizer emits NO user-band (`E10xxx`/`W10xxx`) diagnostics. *(RD
  R30; PF-006)*

### Should Have

- [ ] FR-9: JSDoc on every exported symbol documenting purpose, params, returns, and the
  preflight/AR source — matching the house style of `optimize-il.ts`/`instr-program.ts`.

### Won't Have (Out of Scope — deferred to the rules milestone / other RDs)

- The sliding-window scanner (`optimizeStream`, `extractInstrWindow`). *(PF-009; RD §4.3)*
- The fixed-point iteration limit (R18) and its ICE code (`E90002`). *(PF-005)*
- Any concrete optimization rule from the §4.5 catalog (redundant-load, dead-store, etc.).
- `cpuCompat` rule filtering at runtime (no rules to filter). *(RD R13)*
- `PeepholeStats` emission / RD-11 resource-report wiring (Phase-B seam). *(PF-007; RD §4.8)*
- `--optimize-level` rule subsets. *(RD R28)*
- IL-level optimization → RD-06. ACME serialization → RD-09. CLI flag surface → RD-15.
  Config default → RD-16.

## Technical Requirements

### Structural predicates (`validateProgramStructure`, the concrete R6 contract — PF-006)

1. `program.streams` is a present, non-null array.
2. Each `StreamEntry` within each stream is a valid discriminated union — exactly one of
   `isInstr` / `isLabel` / `isDirective` (from `@blend65/core`) returns `true`.
3. No `null` / `undefined` entries appear in any stream's `entries`.

Opcode/addressing legality is NOT re-checked here — that remains `validateStream`'s
responsibility (RD R22), already executed inside `generateInstr`.

### Compatibility

- ESM/NodeNext, TypeScript strict. Intra-package relative imports carry the `.js` extension.
- Lives in `@blend65/codegen` (R15/AR-20: never imported by frontend/language-server).
- Cross-package import of `CpuVariant`/`DiagnosticBag`/guards is from `@blend65/core` by
  package name (not a relative path).

### Security

- N/A (AOT compiler stage; no external/user input at runtime beyond the in-memory
  `InstrProgram`, which is already validated by codegen). Input robustness is covered by the
  structural validation (FR-5/FR-8).

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
| -------- | ------------------ | ------ | --------- | ------ |
| v1 scope | thin passthrough / full-engine-zero-rules | thin passthrough | Matches roadmap "near-trivial no-op"; no dead code | Preflight keystone |
| Signature | bare `CpuVariant` / `PlatformProfile` | bare `CpuVariant` | Mirrors `generateInstr`/`validateStream` seam | AR-P1, AR-P3 (PF-001/003) |
| `CpuVariant` source | import core / local redefinition | import core | One canonical type (D2) | AR-P2 (PF-002) |
| Preamble | verbatim / scan | verbatim | Plugin-emitted platform scaffolding | AR-P4 (PF-004) |
| Limit + ICE | add now / defer | defer | Unreachable in v1 (no scanner) | AR-P5, AR-P9 (PF-005/009) |
| Structural check | enumerate / drop | enumerate | Makes R6 testable | AR-P6 (PF-006) |
| Stats | return only program / `{program,stats}` | return only program | v1 emits no stats | AR-P7 (PF-007) |

## Acceptance Criteria

Traced to the RD's AC list (the deferred scanner ACs are noted). See
[07-testing-strategy.md](07-testing-strategy.md) for the ST-cases.

1. [ ] AC-01: `optimizeInstr()` accepts an `InstrProgram` + `CpuVariant` and returns an
   `InstrProgram`. *(RD AC-01, corrected per PF-003)*
2. [ ] AC-02: v1 passthrough returns the input program unchanged (byte-identical golden
   snapshot via `programByteSize` + serialized form). *(RD AC-02)*
3. [ ] AC-03: `options.enabled === false` bypasses the optimizer entirely (guaranteed
   passthrough). *(RD AC-03)*
4. [ ] AC-04: `optimizeInstr` runs with the default-enabled path (even with zero rules). *(RD
   AC-04)*
5. [ ] AC-05: The `PeepholeRule` interface is defined with `name`, `windowSize`, `priority`,
   `cpuCompat`, `match()`, `replace()`. *(RD AC-05)*
6. [ ] AC-08: Labels are never deleted or modified by the optimizer (verbatim passthrough).
   *(RD AC-08)*
7. [ ] AC-09: Directives are never deleted or modified by the optimizer. *(RD AC-09)*
8. [ ] AC-10: The number of `InstrStream` entries in the program is preserved. *(RD AC-10)*
9. [ ] AC-PA: `preamble` and `allocationPlan` pass through verbatim. *(new — PF-004)*
10. [ ] AC-12: Source spans on instructions are preserved (verbatim passthrough). *(RD AC-12)*
11. [ ] AC-13: Determinism: same input → same output. *(RD AC-13)*
12. [ ] AC-16: A golden-snapshot test confirms v1 passthrough output is identical to codegen
    output. *(RD AC-16)*
13. [ ] AC-SV: `validateProgramStructure` enforces the three predicates and emits an ICE
    (`E90001`) on violation, with no user-band diagnostics. *(new — PF-006; RD R30)*
14. [ ] AC-17: All decisions trace to an `AR-NN`/`PF-NNN` or a frozen spec section. *(RD
    AC-17)*

> **Deferred ACs (rules milestone, NOT in v1):** AC-06/AC-07 (window scanner skips
> labels/directives) and AC-11 (post-optimization CPU re-validation) and AC-14 (iteration
> limit ICE) require the scanner and rules, which are out of scope here per PF-005/PF-009.
> AC-15 (scanner barrier unit tests) likewise defers. They are tracked for the rules
> milestone, not this plan.
