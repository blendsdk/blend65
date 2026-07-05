# Component: Width-Aware Lowering + Module-Var Access (codegen)

> **Document**: 03-03-width-aware-lowering.md
> **Parent**: [Index](00-index.md)
> **Implements**: FR-7; AR-8

## Overview

Two codegen edits, both small and localized (the rest of the 3b surface already lowers/translates):
1. **Width awareness** — thread the model's `typeMap` into lowering so literals and binary results get
   their real IL width (word scalars/literals stop being byte-hardcoded).
2. **Module-var access** — identifier reads / assignment writes that resolve to a **module** variable
   lower to `load`/`store` against the `__var_*` symbol (paralleling the `__frame_*` local path).

No `initCode`, no `br`/`brcond`/`call`, no new ops. R15 boundary preserved (codegen imports the
`SemanticModel`/`Type` **types from `@blend65/core`** only; no `frontend`←`codegen` edge).

## Part 1 — Thread `typeMap` into `LowerCtx` (AR-8)

**Files:** `packages/codegen/src/il/lower.ts` (+ its input type) and the compiler pipeline seam that
calls `lowerToIL`.

- **The model is already threaded (PF-008).** `LowerCtx` already carries `model: SemanticModel` and
  `LowerInput` already passes it (`emit.ts:97–105`), so **no new input plumbing is needed** — Slice 3a
  added the field; only *consumption* is new. Read the expression type via `ctx.model.typeOf(expr)`
  (optionally add a thin `ctx.typeOf = (e) => ctx.model.typeOf(e)` convenience if it reads cleaner).
- **`lowerNumericLit`** (`lower.ts:261–265`) — replace the `IL_BYTE` hardcode:
  ```ts
  const t = ctx.model.typeOf(expr);               // real type from the model (already on ctx)
  const ilType = ilTypeOfType(t);                 // byte/sbyte→IL_BYTE, word/sword→IL_WORD
  return imm(expr.value, ilType);
  ```
  Fallback to `IL_BYTE` if the type is `ErrorType`/absent (poisoned program won't reach a clean build).
- **`lowerBinary`** (`:276–289`) — result IL type from the model's type for the binary node (via
  `ilTypeOfType(ctx.model.typeOf(expr))`) rather than `operandType(left)`, so `word * word → IL_WORD`
  and reaches `__rt_mul16` in translate. Operands already carry width from their own typing.
- **Reuse `ilTypeOfType` (PF-007) — do NOT add a new `ilTypeOf`.** `ilTypeOfType(t: Type): ILType`
  already exists (`codegen/src/il/il-type.ts`, word→IL_WORD) and is already used by `slotIlType`. Reuse
  it (DRY); a parallel `ilTypeOf` would be dead duplication.

**Why this is the whole width fix:** frame-slot `load`/`store` already derive width from the SFA slot
type (`slotIlType`), so a `word` **local** already round-trips; the only byte-locked spots are
**literals** and the **binary result type**, both fixed above. Translate reads width from
`ins.type.width` / operand `.type.width` — once lowering tags them `IL_WORD`, word arithmetic and
`__rt_mul16`/`__rt_div16` engage with no translate change.

## Part 2 — Module-variable read / write

**File:** `packages/codegen/src/il/lower.ts`.

- A **`__var_*` symbol scheme** paralleling `frameSymbol` (`lower.ts:537–540`):
  ```ts
  function moduleVarSymbol(moduleName: string, varName: string): string {
    return `__var_${moduleName.replaceAll(".", "_")}_${varName}`;
  }
  ```
  matching SFA's `symbols.ts:74–80` emission exactly (so the `load`/`store` target resolves at ACME).
- **Resolution:** in `lowerIdent` (`:267–273`) and `lowerAssign` (`:291–304`), decide whether the
  identifier is a **local/param** (→ `frameSymbol(fqName, name)`, existing) or a **module var** (→
  `moduleVarSymbol(module, name)`). The discriminator comes from the plan: the AllocationPlan carries
  `moduleVariables` (with `moduleName`/`variableName`); a name present there (and absent from the
  function frame) is a module var. Build a lookup `Set<"Module.name">` / per-name map from
  `plan.moduleVariables` once per program in `lowerToIL` and consult it.
  - *Alternative* (cleaner if the model is threaded per Part 1): consult `symbolMap` to get the
    identifier's `Symbol`, and branch on `sym.scope.kind === "module"`. Prefer whichever keeps
    lowering's existing name/frame-keyed style; decide during implementation and record it.
- The IL op is unchanged: `load __var_… → temp` for a read, `store value → __var_…` for a write —
  identical to the frame path, only the symbol differs. `translate.ts` re-emits `__var_*` as a
  symbolic operand (like `__frame_*`) with no change.

**`lowerToIL` walks module-var access, not module-var *items*:** top-level `let` items still emit no
IL of their own (no initializer, AR-2). The vars come into being purely as `__var_*` **symbol
definitions** from SFA; codegen only ever *reads/writes* them from within function bodies.

## Edits summary

| File | Edit |
|------|------|
| `codegen/src/il/lower.ts` | width-aware `lowerNumericLit`/`lowerBinary` (consume `ctx.model.typeOf`, reuse existing `ilTypeOfType`); `moduleVarSymbol`; module-vs-frame resolution in `lowerIdent`/`lowerAssign`; build the module-var lookup in `lowerToIL`. |
| ~~`codegen/src/il/<lower input type>`~~ | **No change** — `LowerInput`/`LowerCtx` already carry `model: SemanticModel` (PF-008). |
| ~~`packages/compiler/src/api/*` (IL stage seam)~~ | **No change** — `emit.ts:97–105` already passes the model into `lowerToIL` (PF-008). |

## Tests to extend

- `lower.spec.test.ts` / `lower.impl.test.ts` — a word-literal lowers to `imm(_, IL_WORD)`; a module-var
  read/write lowers to `load`/`store __var_*`; `word * word` result is `IL_WORD` (reaches `__rt_mul16`).
- `translate.spec.test.ts` — already covers `__rt_mul16`/`__rt_div16`; the acceptance golden (03-04)
  is the end-to-end proof.
