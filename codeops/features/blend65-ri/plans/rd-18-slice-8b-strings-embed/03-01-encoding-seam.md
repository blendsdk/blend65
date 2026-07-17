# Encoding Seam: RD-18 Slice 8b

> **Document**: 03-01-encoding-seam.md
> **Parent**: [Index](00-index.md)
> **Governs**: AR-2, AR-3, AR-4, AR-5, AR-6, AR-7

## Overview

Everything that turns literal source text into bytes: the escape decoder (Ch 01 §7.2), the three
core-resident algorithmic encoders, the fallible `CharEncoder` contract, and how the encoder
reaches typing/const-eval without violating the frontend's core-only dependency rule.

## Architecture

### Current

See `02-current-state.md` §Platform-encoding: one PETSCII encoder in
`packages/platforms/src/shared-hooks.ts:30-58`, all five platform hooks delegate to it (two
wrongly), zero compile-path callers, no decode step anywhere.

### Proposed

```
core/src/platform/encoding.ts          (NEW — encoders + contract, keyed by CharEncoding)
core/src/text/literal-decode.ts        (NEW — escape decoder, pure, segment model)
        ▲                    ▲
        │ analyze() derives  │ desugar decodes
platforms/shared-hooks.ts    frontend/semantics (ConstTypeEngine + statement/expression typing)
  (hooks now delegate to core; public hook API unchanged)
```

`analyze()` derives the encoder from the `targetProfile.defaultEncoding` it already receives
(`analyze.ts:76`); an optional `encoder` input overrides it (third-party plugin seam). The
derived encoder is passed to `ConstTypeEngine` at construction — typing reaches it via
`ctx.engine`, so `TypeCheckContext` needs no new platform field (AR-6). The future
language-server gets byte-identical encoding for free because the encoders are core-resident.

## Implementation Details

### New types (core, `platform/encoding.ts`)

```ts
/** Encodes one Unicode code point to a single target byte, or null if unmappable. */
export interface CharEncoder {
  /** The profile encoding this encoder implements, for diagnostics. */
  readonly name: CharEncoding | "raw";
  encodeCodePoint(cp: number): number | null;
}

/** Returns the encoder for a profile encoding; `undefined` profile ⇒ the raw-ASCII encoder. */
export function encoderFor(encoding: CharEncoding | undefined): CharEncoder;
```

### The three encoders + the raw default (AR-5, AR-7)

All are total over their mapped domain and return `null` outside it; code points > `$FF` are
unmappable in every encoder (AR-7).

| Encoder | Mapping | Control chars |
|---------|---------|---------------|
| `petscii` | shipped algorithm (A–Z/digits/space/symbols pass, a–z → +$60), passthrough tail NARROWED to `$20–$7E` — outside it `null` | `\n`→`$0D`, `\r`→`$0D`, `\t`→`$09` (today's implicit passthrough made explicit) |
| `atascii` | identity for printable ASCII `$20–$7E` **except** `` ` `` `{` `}` `~` → `null` (not in ATASCII) | `\n`→`$9B`, `\r`→`$9B` (Ch 01 §7.2's normative ATASCII example), `\t`→`null` (deliberately unmapped — ATASCII's `$7F` TAB control exists but is not baked; `\x7F` stays available) |
| `ascii` | identity `$20–$7E` | `\n`→`$0A`, `\r`→`$0D`, `\t`→`$09` |
| raw (no profile) | ≡ the `ascii` encoder: identity `$20–$7E`; every other code point — incl. `$00–$1F` and `$7F` — → `null` | `\n`→`$0A`, `\r`→`$0D`, `\t`→`$09` — the fallible reading of `platform-profile.ts:101` "absent ⇒ raw ASCII bytes" (`\xNN` covers any raw byte) |

The platforms package keeps its hook API: `petsciiEncodeChar/String` in `shared-hooks.ts` become
thin delegates over the core `petscii` encoder (their unit tests keep passing); `a800xl.ts` /
`a7800.ts` hooks are repointed to the `atascii`/`ascii` encoders — this removes the
silent-wrong-bytes class (inverse-video ATASCII, wrong `\n`) entirely.

### Escape decoder (core, `text/literal-decode.ts`) — the segment model (AR-7)

```ts
export type LiteralSegment =
  | { kind: "codePoint"; cp: number }   // goes through the encoder
  | { kind: "rawByte"; value: number }; // bypasses the encoder

/** Decodes raw inter-quote text (lexer Token.value) into segments. Pure; never throws.
 *  The lexer has already validated the escape set — unknown escapes cannot reach here. */
export function decodeLiteral(raw: string): LiteralSegment[];
```

- `\xNN` → `rawByte NN`; `\0` → `rawByte $00`; `\\` → `rawByte $5C` (Ch 08 STR-5 pins the
  backslash byte; PETSCII passthrough agrees, so no deviation) — all bypass the encoder.
- `\n` `\r` `\t` `\"` `\'` → `codePoint` of the LF/CR/TAB/quote character — resolved through
  the encoder per Ch 01 §7.2.
- Everything else iterates **by code point** (`for..of`), never `charCodeAt` (astral chars must
  not split into surrogate halves — they become one unmappable code point).

Byte production: `codePoint` segments map via `encoder.encodeCodePoint(cp)`; a `null` result is
the E10127 case (03-02 owns the emit sites). `rawByte` segments are used verbatim.

### Seam threading (AR-6)

- `AnalyzeInput` gains optional `encoder?: CharEncoder`. Resolution inside `analyze()`:
  `input.encoder ?? encoderFor(input.targetProfile?.defaultEncoding)`.
- `ConstTypeEngine` construction gains the encoder; it exposes it (readonly) so
  statement/expression typing use one instance via `ctx.engine`.
- `run-frontend.ts` passes nothing new — derivation from `plugin.profile.defaultEncoding`
  happens inside `analyze()`. (The plugin `encodeString`/`encodeChar` hooks stay for platform
  tests/tools but remain compile-path-uncalled; noted in their doc comment.)

## Error Handling

| Error case | Strategy | AR |
|------------|----------|----|
| Unmappable code point in string/char literal | E10127 `UnencodableCharacter` at the literal's span, naming the char (as `U+XXXX`) and the encoding; poison the declaration | AR-7 |
| Code point > `$FF` (any encoder) | same E10127 path | AR-7 |
| No `targetProfile` (LS/tests) | raw-ASCII encoder — deterministic, documented | AR-6/AR-7 |
| Ch 08 STR-2 / grammar §9.6 / STR-5 conflicts | recorded deviations; no code impact | AR-2/AR-3 |

## Testing Requirements

- Spec tier: ST-1..ST-9 (encoder tables incl. the `\n` forks, segment decoding, unmappable
  policy, seam derivation) — `07-testing-strategy.md`.
- Impl tier: passthrough-tail narrowing vs the shipped petscii behavior; astral-code-point
  iteration; hook-delegation equivalence (platforms tests unchanged).
