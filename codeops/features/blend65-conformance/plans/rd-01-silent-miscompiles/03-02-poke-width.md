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

The check must run where the argument's inferred type is available. Two viable seams; the executor
picks per the code (both reach the same behavior):

- in `intrinsic-validation.ts` value-arg loop (`:179-188`), querying the arg's inferred type; or
- in `expression-typing.ts` poke handling (`:1608-1620`), where the arg types are already known.

### Accepted vs rejected value types (AR-5 — load-bearing)

| Value type | Result | Rationale |
| ---------- | ------ | --------- |
| `byte` | accept | exact width |
| `sbyte` | accept | same-width reinterpret — matches the `lo`/`hi` precedent (`expression-typing.ts:1543-1546`) |
| enum (byte backing) | accept | `poke($D020, Color.White)` is *the* idiomatic MMIO write; compiles correctly today |
| in-range literal | accept | existing literal path |
| `word` / `sword` | **reject `E10154`** | the two-byte store that clobbers the neighbour |
| `boolean` | reject | not a numeric write |

> **Do NOT reuse `checkAssignable` unmodified** — it rejects same-width `sbyte` with `E10153`,
> which would turn a fixed miscompile into a broken build (RD AR-5). The accepted set above is the
> contract; implement it directly.

## Implementation Details

### Diagnostic

- **Code:** `E10154 WidthNarrowingNoCast` — already registered, matches `spec/14-diagnostics.md:92`
  (note the spec assigns `E10154` twice — errata E-07; the Ch 14 meaning is the one in use)
  (RD AR-4).
- **Message (draft, AR-P6):** `` `poke` value of type `word` is wider than parameter `value` of
  type `byte`; a cast is required `` — final wording follows the registry's existing phrasing;
  no `codeops`/RD id in the message.
- Emitted **once** per offending call; no second store is produced (the diagnostic blocks codegen
  of the call, as other arg-type errors do).

### Integration points

- Diagnostic lives entirely in `frontend` (R15). AC-6's "no second store" assertion runs in the
  `test-harness` tier via `emitAsm`, because the frontend may not see emitted asm.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| `word` variable / expression / `peekw` result / named `word` const | `E10154`, no second store | RD AR-4, AC-6 |
| `sbyte` / enum / in-range literal value | accept, compile unchanged (negative control) | RD AR-5, AC-7 |
| `boolean` value | reject | RD AR-5 |

> **Traceability:** code and accepted-set decisions are RD AR-4/AR-5; message wording is AR-P6.

## Testing Requirements

- Spec (`[CI]`, frontend tier): `E10154` for each of the four wide spellings — `word` var,
  word-valued expression (`w + 1`), `peekw` result, named `word` const (AC-6, ST-17…ST-20).
- Spec (`[CI]`, test-harness tier): `emitAsm` shows a single store, no `STX addr+1` (AC-6).
- Spec (`[CI]`): one accepted case per type — `byte`, `sbyte`, enum member, in-range literal —
  compiles clean (AC-7, ST-21…ST-24).
