# C64 Plugin & Codegen Hooks: RD-10 Platform Plugin System

> **Document**: 03-02-c64-plugin-and-hooks.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-10 R16–R22, R33, R37; spec Ch 15 §4 + appendix-c64; AR-64/65/69; decision D3

## Overview

The `c64` plugin (`packages/platforms/src/c64.ts`) is the MVP platform (R33) and the only one
with **bespoke hook bodies** in this slice (D4 — the other four reuse these). It implements the
full `PlatformPlugin` contract from 03-01: profile data + the six codegen hooks. Because the
hooks return `StreamEntry[]` and `getOutputDirective` returns an `AcmeDirective`, every hook
output is rendered to deterministic ACME text by the shipped `printInstr` (from
`@blend65/codegen`) — so the goldens in 07-testing-strategy verify real serialized output today.

## C64 Profile Data (R37, appendix-c64)

```typescript
import type { PlatformProfile } from "@blend65/core/platform";

const c64Profile: PlatformProfile = {
  // memory map
  codeStart: 0x0801, codeEnd: 0xcfff,
  dataStart: 0x0801, dataEnd: 0xcfff,
  ramStart: 0x0801, ramEnd: 0xcfff,
  zpStart: 0x02, zpEnd: 0x8f, stackReserve: 20,
  // budgets
  maxBinarySize: 26623, maxRam: 26623, maxZp: 142, stackBudget: 230,
  // output
  outputFormat: "prg", loadAddress: 0x0801,
  // cpu
  cpu: "nmos6502",
  // zp arg-block
  zpArgBlockSize: 8,
  // encoding
  defaultEncoding: "petscii", screenEncoding: "petscii",
  // warnings
  warnFrameSize: 64, warnArraySize: 256,
  // informational
  clockMhz: 0.985, cyclesPerFrame: 19656,
};
```

> `maxZp` (142) `=== zpEnd − zpStart + 1` (`0x8F − 0x02 + 1 = 142`) — so `validateProfile()`
> passes its own consistency check (FR-12 / R22).

## Codegen Hooks

### `getOutputDirective(projectName)` (R18, AR-65)

```typescript
getOutputDirective(projectName: string): AcmeDirective {
  return { kind: "outputFile", name: `${projectName}.prg`, format: "cbm" };
}
```

`printInstr` renders this `directive` entry (column 0) as: `!to "<projectName>.prg", cbm`
(verified against `print-instr.ts` `directiveText` → `outputFile`). Satisfies **AC-07**.

### `emitPreamble(options)` (R16, AR-64)

Builds, in order, as `StreamEntry[]`:

1. the `!to` output directive (from `getOutputDirective(options.projectName)`),
2. the origin `* = $0801`,
3. the **BASIC stub** (`10 SYS 2061`) — the RD-10 §4.5 byte/word/text directive sequence,
4. the startup shim (`...this.emitStartupShim(options.shimVariant)`).

```typescript
emitPreamble(options: PreambleOptions): StreamEntry[] {
  return [
    directive(this.getOutputDirective(options.projectName)),
    directive({ kind: "origin", address: 0x0801 }),
    // BASIC stub: 10 SYS 2061  (per RD-10 §4.5)
    directive({ kind: "word", values: [0x080b] }),  // pointer to next BASIC line
    directive({ kind: "word", values: [0x000a] }),  // line number 10
    directive({ kind: "byte", values: [0x9e] }),    // SYS token
    directive({ kind: "text", text: "2061" }),      // address as PETSCII text
    directive({ kind: "byte", values: [0x00] }),    // end-of-line
    directive({ kind: "word", values: [0x0000] }),  // end-of-program
    ...this.emitStartupShim(options.shimVariant),
  ];
}
```

**Expected `printInstr` rendering of the directive prefix** (the golden head; per the verified
`print-instr.ts` rules — origin/outputFile at column 0, `!byte`/`!word`/`!text` indented, hex
upper-case, words 4-digit, bytes 2-digit):

```
!to "main.prg", cbm
* = $0801
    !word $080B
    !word $000A
    !byte $9E
    !text "2061"
    !byte $00
    !word $0000
```

> **⚠️ Authoring note (golden derivation):** the exact byte/word values above are transcribed
> from the **RD-10 §4.5 sketch**. During Phase 2 the spec-test author derives the *expected
> golden string* purely from these directive values + `printInstr`'s documented rendering — NOT
> by running `emitPreamble`. The BASIC-stub byte sequence is the requirement's own example; if
> the implementer finds the §4.5 sketch's stub bytes need correction for a real loadable PRG,
> that is a **new ambiguity** → STOP and raise it as the next `D-N (runtime)` before changing
> the oracle (the stub is not re-derived from the implementation).

### `emitStartupShim(variant)` (R17, §4.6, AR-69)

Three variants returning `StreamEntry[]` (instr + label entries):

- **`terminating`** (default): `__startup:` label, `LDA #$36 / STA $01` (bank out BASIC),
  `[BSS zero if needsBssZero]`, `[DATA init if needsDataInit]`, `JSR _main`,
  `LDA #$37 / STA $01` (restore BASIC), `RTS`.
- **`non-terminating`**: same bank-out + inits, then `JMP _main` (never returns).
- **`bare`**: empty `StreamEntry[]` (no shim; `_main` is the entry point directly).

```typescript
emitStartupShim(variant: ShimVariant): StreamEntry[] {
  if (variant === "bare") return [];
  const entries: StreamEntry[] = [
    label("__startup"),
    instr("LDA", "Immediate", imm8(0x36)),
    instr("STA", "ZeroPage", /* $01 */ ...),
    // BSS zero / DATA init are emitted by RD-09/driver wiring when those segments exist;
    // in this slice they are absent (no initCode/constData in live IL) — see note.
  ];
  if (variant === "terminating") {
    entries.push(
      instr("JSR", "Absolute", symbolRef("_main")),
      instr("LDA", "Immediate", imm8(0x37)),
      instr("STA", "ZeroPage", /* $01 */ ...),
      instr("RTS", "Implied", none()),
    );
  } else { // non-terminating
    entries.push(instr("JMP", "Absolute", symbolRef("_main")));
  }
  return entries;
}
```

> **⚠️ Authoring note ($01 operand):** the shim writes the C64 processor-port at `$01`. The
> RD-07a `InstrOperand` model has no raw-address kind — addresses are `symbolRef`/`zpSlot`.
> The `$01` write is rendered via the same `$HEX`-named `symbolRef` convention RD-06/07b already
> use for `poke`/`peek` (a `symbolRef` whose name is the literal `$01`, kept symbolic, rendered
> verbatim). This is a real detail the Phase-2 author confirms against the existing
> `poke`-address handling; if the convention does not cover it, **STOP** and raise a `D-N
> (runtime)`. The BSS-zero / DATA-init bodies depend on segments that are empty in the live IL
> slice (no `initCode`/`constData`), so they emit nothing here and are documented as the RD-09
> seam.

### `encodeString` / `encodeChar` (R19/R20, D3)

PETSCII MVP subset, exactly the §4.5 table:

```typescript
encodeChar(char: string): number {
  const code = char.charCodeAt(0);
  if (code >= 0x41 && code <= 0x5a) return code;        // A-Z → $41-$5A
  if (code >= 0x61 && code <= 0x7a) return code + 0x60;  // a-z → $C1-$DA
  if (code >= 0x30 && code <= 0x39) return code;          // 0-9
  if (code === 0x20) return 0x20;                          // space
  if (char === "\n") return 0x0d;                          // newline → CR
  return code;                                             // pass-through
}
encodeString(text: string): number[] {
  return [...text].map((ch) => this.encodeChar(ch));
}
```

Worked examples (the ST oracle source): `encodeChar("A") === 0x41`, `encodeChar("a") === 0xc1`,
`encodeChar("0") === 0x30`, `encodeChar(" ") === 0x20`, `encodeChar("\n") === 0x0d`;
`encodeString("Hi") === [0x48, 0xc9]`. Satisfies **AC-06**.

### `getMainTerminationPolicy()` (R21, AR-69)

```typescript
getMainTerminationPolicy(): MainTerminationPolicy {
  return { canReturn: true };  // C64 main can return (restore BASIC) — AC-08
}
```

### `validateProfile()` (R22, R31)

```typescript
validateProfile(): ValidationError[] {
  return validateProfileFields(this.profile);  // shared core helper (FR-21)
}
```

For the valid C64 profile this returns `[]`. The negative ST case constructs a deliberately
inconsistent profile (`zpStart > zpEnd`) and asserts a non-empty `ValidationError[]` (**AC-09**).

## `runtimeModules` metadata (R26, D1 — bodies deferred)

```typescript
runtimeModules: [
  { name: "mul8",  asmPath: "runtime/mul8.asm",  exports: ["__rt_mul8"] },
  { name: "mul16", asmPath: "runtime/mul16.asm", exports: ["__rt_mul16"] },
  { name: "div8",  asmPath: "runtime/div8.asm",  exports: ["__rt_div8"] },
  { name: "div16", asmPath: "runtime/div16.asm", exports: ["__rt_div16"] },
],
intrinsics: [],  // RD-17 populates (D1)
```

The `.asm` files themselves are **not** written in this slice (RD-17/AR-30); only the metadata
is declared so the dead-strip/link seam (RD-09) is described.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| `emitStartupShim` with an unknown variant | Exhaustive `ShimVariant` union → compile-time guard (no runtime fall-through) | R17 |
| Inconsistent profile fields | `validateProfile()` → non-empty `ValidationError[]` | R22 / FR-12 |
| `$01` port / BSS-DATA codegen not covered by symbolRef convention | STOP → raise `D-N (runtime)` (surface-during-authoring) | D7 note |

## Testing Requirements

- Golden ST cases: `printInstr` of `emitPreamble({ projectName: "main", shimVariant:
  "terminating", needsBssZero: false, needsDataInit: false })` equals the expected ACME text
  (directive head above + terminating shim). Plus `non-terminating` and `bare` shim goldens.
- `encodeChar`/`encodeString` table cases (AC-06); `getOutputDirective` → `!to "main.prg", cbm`;
  `getMainTerminationPolicy().canReturn === true`; `validateProfile()` `[]` on valid, non-empty
  on a corrupted profile. (See 07-testing-strategy ST-C64*.)
