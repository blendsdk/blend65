# Poke Width (M-02): `E10154` on a wide value operand

> **Document**: 03-02-poke-width.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-01 R4; AR-4, AR-5; AC-6, AC-7

## Overview

`poke(addr, value)` / `pokew(addr, value)` — spec signature `(word, byte)` for `poke` — never
check the **value** operand's width. A `word` value emits a second store (`STX $D020+1`) that
clobbers the neighbouring MMIO register. The fix makes a value operand wider than the intrinsic's
declared parameter a diagnostic (`E10154`), for **every** value spelling.

## Architecture

### Current Architecture

- Poke value typing returns `void` without inspecting the value width
  (`expression-typing.ts:1608-1620`).
- The only range check (`intrinsic-validation.ts:178-188`) fires solely for
  `arg.kind === "NumericLitExpr"` — a variable, expression, `peekw` result, or named `word`
  constant passes through unchecked.

### Proposed Changes

Add a **width** check on each value-argument intrinsic parameter that compares the argument's
**inferred type width** (from the type-checker) against the declared parameter type, independent
of the argument's syntactic kind. On a widening (value wider than the parameter), emit `E10154`.
This supplements — does not replace — the existing literal-range check (`E10084`/`ArgTypeMismatch`
path stays for in-range literal validation).

The check must run where the argument's inferred type is available. The **only viable seam is
`expression-typing.ts` poke handling (`:1608-1620`)**, where the arg types are already known
(PF-028). The `intrinsic-validation.ts` value-arg loop (`:179-188`) is **not** viable: it runs
before type-checking (`analyze.ts:170` runs `validateIntrinsics` before `typeCheckPrograms` at
`:179`) and its `ValidationContext` (`:39-54`) carries no type map — no inferred types exist there
yet. The literal-range check stays in `intrinsic-validation.ts`; the new width check lives in
typing.

### Accepted vs rejected value types (AR-5 — load-bearing)

| Value type | Result | Rationale |
| ---------- | ------ | --------- |
| `byte` | accept | exact width |
| `sbyte` | accept | same-width reinterpret — matches the `lo`/`hi` precedent (`expression-typing.ts:1543-1546`) |
| enum (byte backing) | accept | `poke($D020, Color.White)` is *the* idiomatic MMIO write; compiles correctly today |
| in-range literal | accept | existing literal path |
| `word` / `sword` | **reject `E10154`** (width narrowing) | the two-byte store that clobbers the neighbour |
| `boolean` | **reject as a kind mismatch**, `E10152` family — **not** `E10154` | boolean is 1 byte (`frame-computation.ts:35`), so a *width* code is semantically wrong (PF-027); it is a type-kind mismatch, not a narrowing |

> **Do NOT reuse `checkAssignable` unmodified** — it rejects same-width `sbyte` with `E10153`,
> which would turn a fixed miscompile into a broken build (RD AR-5). The accepted set above is the
> contract; implement it directly. Two distinct rejections: `word`/`sword` → `E10154` (a width
> narrowing); `boolean` → the `E10152` kind-mismatch family (a same-width non-numeric).

## Implementation Details

### Diagnostic

- **Code:** `E10154 WidthNarrowingNoCast` — already registered, matches `spec/14-diagnostics.md:92`
  (note the spec assigns `E10154` twice — errata E-07; the Ch 14 meaning is the one in use)
  (RD AR-4).
- **Message (draft, AR-P6):** `` `poke` value of type `word` is wider than parameter `value` of
  type `byte`; a cast is required `` — final wording follows the registry's existing phrasing;
  no `codeops`/RD id in the message.
- Emitted **once** per offending call. Because any frontend error makes `emitAsm().text`
  `undefined` (`compiler/src/api/emit.ts:94-104` short-circuits on `hasErrors()`), the erroneous
  program produces **no asm at all** — so the test-harness oracle asserts *absence of emitted asm*,
  not "a single store" (PF-006). The two-byte store is prevented because codegen never runs.

### Integration points

- Diagnostic lives entirely in `frontend` (R15). AC-6's emission check runs in the `test-harness`
  tier via `emitAsm`: on the wide poke, `E10154` is present **and `emitAsm` yields no text**. Any
  positive "exactly one store" assertion is made against an **accepted** control program (ST-21's
  `byte` case), not the erroring one.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| `word` variable / expression / `peekw` result / named `word` const | `E10154`; whole-program asm emission blocked | RD AR-4, AC-6, PF-006 |
| `sbyte` / enum / in-range literal value | accept, compile unchanged (negative control) | RD AR-5, AC-7 |
| `boolean` value | reject — `E10152` kind-mismatch family (not `E10154`) | RD AR-5, PF-027 |

> **Traceability:** code and accepted-set decisions are RD AR-4/AR-5; message wording is AR-P6.

## Testing Requirements

- Spec (`[CI]`, frontend tier): `E10154` for each of the four wide spellings — `word` var,
  word-valued expression (`w + 1`), `peekw` result, named `word` const (AC-6, ST-17…ST-20); plus a
  `boolean` value → `E10152` kind mismatch (PF-027, ST-24b).
- Spec (`[CI]`, test-harness tier): on the wide poke, `emitAsm` yields **no text** (emission blocked
  by the error); the "exactly one store, no `STX addr+1`" assertion is made on the **accepted**
  `byte` control (ST-21) — never on the erroring program (AC-6, PF-006, ST-20A).
- Spec (`[CI]`): one accepted case per type — `byte`, `sbyte`, enum member, in-range literal —
  compiles clean (AC-7, ST-21…ST-24).
