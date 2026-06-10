# Current State: RD-08 Peephole Optimizer

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists (the shipped back end this stage plugs into)

The `Instr` back end is complete through RD-07c and RD-10 (slice). The peephole optimizer has
a clean, well-defined seam to occupy: it consumes `InstrProgram` and returns `InstrProgram`.

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/codegen/src/instr/instr-program.ts` | `InstrProgram` type (`preamble`, `streams`, `allocationPlan`); `generateInstr(ilProgram, cpuVariant, bag)`; `assembleProgram`; `programByteSize` | None — consumed as the input/output contract |
| `packages/core/src/instr-model/stream.ts` | `StreamEntry` union, `InstrStream`, `isInstr/isLabel/isDirective` guards | None — used for structural validation |
| `packages/core/src/instr-model/cpu-variant.ts` | Canonical `CpuVariant = "nmos6502" \| "wdc65c02"` | None — imported by the new module |
| `packages/codegen/src/instr/validate.ts` | `validateStream(stream, cpuVariant, bag)` (opcode legality) | None — remains the opcode-legality owner (R22) |
| `packages/core/src/diagnostics/diagnostic-codes.ts` | `IceCode.Unexpected = "E90001"` | None in v1 (no `E90002`; PF-005 deferral) |
| `packages/core/src/diagnostics/diagnostic-bag.ts` | `DiagnosticBag.addICE(code, span, message)` | None — used for structural-violation ICEs |
| `packages/codegen/src/instr/index.ts` | Public `instr/` barrel | **Add** peephole re-exports |
| `packages/codegen/src/il/optimizer/optimize-il.ts` | The reference passthrough seam (`optimizeIL(program, [], bag)`) | None — pattern to mirror |

### Code Analysis — the reference seam to mirror

`optimizeIL` (RD-06) is the precedent for an empty-rule-set passthrough:

```typescript
// packages/codegen/src/il/optimizer/optimize-il.ts
export function optimizeIL(
  program: ILProgram,
  passes: readonly ILPass[],   // v1 callers pass []
  bag: DiagnosticBag,
): ILProgram {
  let current = program;
  for (const pass of passes) {
    current = pass.run(current, bag);
  }
  return current;              // same reference when passes is empty
}
```

RD-08's `optimizeInstr` follows the same philosophy but, per the THIN-PASSTHROUGH decision,
does NOT even contain the (rule-driven) loop in v1 — it validates structure and returns the
program. The loop/scanner arrives with the first real rule.

The `InstrProgram` shape (the verbatim-passthrough target):

```typescript
export interface InstrProgram {
  readonly preamble: readonly StreamEntry[];   // plugin scaffolding — verbatim (PF-004)
  readonly streams: readonly InstrStream[];    // per-function; only .entries ever eligible
  readonly allocationPlan: AllocationPlan;     // carried from IL — verbatim (PF-004)
}
```

The `generateInstr` JSDoc states it takes "the bare `CpuVariant` primitive … no
`PlatformProfile` is fabricated" — the seam RD-08 mirrors (PF-003).

## Gaps Identified

### Gap 1: No peephole stage exists

**Current Behavior:** `generateInstr`/`assembleProgram` output flows directly toward RD-09;
there is no `optimizeInstr` stage and RD-09 lists RD-08 as a dependency.
**Required Behavior:** A `optimizeInstr` entry point exists, exported from `@blend65/codegen`,
that the RD-09 driver can call between codegen and the emitter.
**Fix Required:** Add `packages/codegen/src/instr/peephole.ts` + barrel re-export.

### Gap 2: The `PeepholeRule` contract is undefined in code

**Current Behavior:** Only described in the RD.
**Required Behavior:** `PeepholeRule` + `PeepholeOptions` interfaces exist so future rules
slot in without API change.
**Fix Required:** Declare the interfaces in `peephole.ts` (used by the internal `V1_RULES=[]`).

## Dependencies

### Internal (already shipped)
- `@blend65/codegen` `instr/` — `InstrProgram`, `generateInstr`, `programByteSize`, `printInstr`.
- `@blend65/core` — `CpuVariant`, `StreamEntry`, `InstrStream`, `isInstr/isLabel/isDirective`,
  `DiagnosticBag`, `IceCode`.

### External
- None beyond the existing toolchain (TypeScript, Vitest).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Over-building v1 (scanner/limit/ICE) → dead code | Med | Med | THIN-PASSTHROUGH decision; impl tasks explicitly exclude the scanner (PF-005/009) |
| Signature drift from the back-end seam | Low | High | Mirror `generateInstr`/`validateStream` exactly; spec test ST asserts arity/return type |
| Accidentally mutating/cloning the program (breaking byte-identity) | Low | Med | Return the input reference; golden snapshot ST asserts byte-identity |
| Re-validating opcodes (overlap with `validateStream`) | Low | Low | Structural check only; opcode legality explicitly left to `validateStream` (R22) |
