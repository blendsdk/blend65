# Current State: RD-07a Instr Model, CPU Table & Canonical Serializer

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

`@blend65/codegen` already ships the **RD-06 Intermediate Language** under
`packages/codegen/src/il/` — the complete typed IL model (`il-type.ts`, `operand.ts`,
`instruction.ts`, `cfg.ts`, `intrinsic-descriptor.ts`), the AST→IL lowering (`lower.ts`,
`builder.ts`, slice-2 surface), the deterministic textual printer (`print-il.ts`), and the
passthrough optimizer (`optimizer/`). The package barrel `src/index.ts` exports
`VERSION = "0.1.0"` plus the whole `il/` surface.

RD-07a adds a **sibling** `instr/` domain to that same package. It builds *on top of* the
core diagnostics layer and *alongside* (not depending on) the IL — 07a's model and
serializer are independent of the lowering.

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/codegen/src/index.ts` | Package barrel | **Modify** — add `export * from "./instr/index.js"` |
| `packages/codegen/src/il/*` | RD-06 IL surface | **None** — consumed conceptually, not imported by `instr/` |
| `packages/core/src/diagnostics/index.ts` | Core diagnostics barrel | **None** — consumed (`SourceSpan`, `DiagnosticBag`, `IceCode`) |
| `packages/codegen/src/instr/*` | The new Instr domain | **Create** — model, table, validator, serializer, fixtures, barrel |
| `requirements/RD-07-codegen-instr.md` | Parent requirements (non-frozen) | **Annotate** — status banner noting the 07a/07b split |
| `test/boundary.spec.test.ts` | R15 cross-package boundary tier | **None** — re-run to confirm still green |

### Code Analysis — the surfaces 07a consumes

**Core diagnostics (consumed by the validator, `instr/validate.ts`):**

```typescript
// packages/core/src/diagnostics/index.ts (already shipped)
export type { SourceSpan } from "./source-span.js";
export { IceCode, isIceCode } from "./diagnostic-codes.js";   // IceCode.Unexpected = "E90001"
export type { DiagnosticBag } from "./diagnostic-bag.js";
// DiagnosticBag.addICE(code: string, span: SourceSpan | null, message: string): void
```

`IceCode.Unexpected` (`"E90001"`) and `bag.addICE(...)` are exactly what FR-15/D6 require —
no new diagnostic code is added.

**RD-06 IL operand/printer conventions 07a mirrors (for consistency, not import):**

- `il/operand.ts` uses a `kind`-discriminated readonly union with small constructor
  functions (`imm`/`temp`/`loc`) and type guards (`isImmediate`/…). 07a's `InstrOperand`
  follows the identical shape and constructor/guard convention (code.md rule 16 —
  consistency).
- `il/instruction.ts` exports opcode *tuples* (`IL_OPS as const`) so the string union can
  never drift from the runtime value set, and the printer enumerates them. 07a's
  `OPCODES`/`ADDRESSING_MODES` tuples follow this exact pattern — the CPU table and
  serializer can enumerate them exhaustively.
- `il/print-il.ts` is a pure deterministic `ILProgram → string` function with a single
  type-tag rendering path. 07a's `printInstr` mirrors this (one rendering path per entry
  kind, deterministic output, golden-tested).

### Build/test conventions (project.md)

- Files kebab-case; tests `*.spec.test.ts` (spec tier, immutable oracle) and
  `*.impl.test.ts` (edge cases). Vitest. ESM with `.js` relative imports.
- Canonical verify:
  `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`.
- `spec/` is frozen — `git status --porcelain spec/` must stay empty.

## Gaps Identified

### Gap 1: No Instr (target-specific) model exists

**Current Behavior:** The back end has only the target-*independent* IL. There is no typed
representation of real 6502 instructions, no opcode/addressing-mode enums, no symbolic
instruction operand, and no instruction stream container.
**Required Behavior:** A typed `StreamEntry`/`InstrStream` model (FR-1..FR-13).
**Fix Required:** Create `instr/opcode.ts`, `instr/addressing-mode.ts`, `instr/operand.ts`,
`instr/stream.ts`.

### Gap 2: No CPU legality knowledge

**Current Behavior:** Nothing knows which opcode+mode combinations are legal on which CPU.
**Required Behavior:** A full NMOS-6502 opcode→legal-modes table with a gated 65C02 set,
and a `validateStream` checker raising `E90001` on violations (FR-14..FR-16).
**Fix Required:** Create `instr/cpu-table.ts` + `instr/validate.ts`.

### Gap 3: No canonical pre-ACME text form

**Current Behavior:** IL has a printer (`printIL`), but there is no serializer for real
6502 instructions — nothing renders the eventual `.asm`.
**Required Behavior:** A deterministic `printInstr(stream)` in ACME syntax, reused verbatim
by RD-09 (FR-17..FR-19).
**Fix Required:** Create `instr/print-instr.ts` (+ `instrByteSize`).

## Dependencies

### Internal Dependencies (all already shipped)

- `@blend65/core` — `SourceSpan`, `DiagnosticBag`, `IceCode` (the validator's diagnostics).
- `@blend65/codegen` package scaffolding (`index.ts` barrel, tsconfig, vitest config).

### External Dependencies

- None beyond the existing toolchain (TypeScript, Vitest, Turborepo).

### Downstream (not yet built — 07a is their foundation)

- **RD-07b** — IL→`Instr` translation, register binding, `generateInstr`; consumes 07a's
  model + validator + `instrByteSize`.
- **RD-08** — peephole optimizer; rewrites `StreamEntry` windows in the 07a model.
- **RD-09** — ACME emitter; reuses 07a's `printInstr` verbatim and adds process invocation.
- **RD-10** — platform plugins; supply `cpuVariant` + the directives/hooks 07b assembles.

## Risks and Concerns

| Risk   | Likelihood   | Impact       | Mitigation |
| ------ | ------------ | ------------ | ---------- |
| CPU table transcription error (wrong legal modes for an opcode) | Medium | Medium | Derive the table from the canonical NMOS 6502 opcode matrix; spec tests assert representative legal/illegal pairs (ST-V*); table is reference data, reviewable | 
| Serializer/ACME-syntax drift vs RD-09 expectations | Low | Medium | 07a *is* the single serializer (D4/AR-60); golden snapshots pin the exact text; RD-09 imports it rather than re-implementing |
| `byteSelect`/operand-shape divergence from RD-07b translation needs | Low | Low | Operand union is transcribed verbatim from RD-07 §4.2; 07b consumes it unchanged | 
| Over-building (modeling 07b concerns early) | Low | Low | Scope gate in `01-requirements.md` "Won't Have" — 07a stops at model+table+serializer | 
| `instr/` accidentally importing `il/` lowering (coupling) | Low | Medium | 07a needs nothing from `il/`; ESLint + review keep `instr/` independent of `il/` | 
