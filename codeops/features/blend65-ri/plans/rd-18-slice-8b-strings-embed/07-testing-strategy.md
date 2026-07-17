# Testing Strategy: RD-18 Slice 8b — Strings & Embed

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

Coverage follows the repo norm (spec tier exhaustive on behavior; impl tier on internals;
facade/golden/VICE tiers per the three-part bar). Test names state behavior. Byte values below
are the SPEC-derived oracle (petscii per AR-3/AR-5 unless stated) — the immutable-oracle rule
applies.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived exclusively from spec Ch 01/08/13/15, RD-18, and the Ambiguity Register. Do NOT
> modify expectations to match the implementation. In-code traceability comments quote the
> behavior in plain language, never ST/AR ids or plan paths (Documentation ban).

### Encoders & decoder (03-01)

| # | Input / Scenario | Expected | Source |
|---|------------------|----------|--------|
| ST-1 | petscii: `A`→`$41`, `a`→`$C1`, `1`→`$31`, ` `→`$20`, `\n`→`$0D`, `\r`→`$0D`, `\t`→`$09` | exact bytes | AR-5 / Ch 01 §7.2 |
| ST-2 | atascii: `A`→`$41`, `z`→`$7A`, `\n`→`$9B`, `\r`→`$9B`; `\t`, `` ` ``, `{`, `}`, `~` → unmappable (null) | exact bytes / null | AR-5 / Ch 01 §7.2 (ATASCII `\n`=`$9B`) |
| ST-3 | ascii: `A`→`$41`, `~`→`$7E`, `\n`→`$0A`, `\r`→`$0D`, `\t`→`$09`; cp `$80` → null | exact bytes / null | AR-5 |
| ST-4 | every encoder + raw default: cp>`$FF` → null; raw: `é`→null, `A`→`$41` | null / `$41` | AR-7 |
| ST-5 | `decodeLiteral("H\xFF\0\\I")` | segments: cp `H`, rawByte `$FF`, rawByte `$00`, rawByte `$5C`, cp `I` | AR-7 / Ch 01 §7.2 / STR-5 (`\\`=`$5C`) |
| ST-6 | `decodeLiteral` of `\n \t \" \'` escapes | codePoint segments LF/TAB/`"`/`'` (encoder-resolved) | Ch 01 §7.2 |
| ST-7 | `decodeLiteral("💾")` | ONE codePoint segment (>`$FFFF`), never two surrogate halves | AR-7 (challenger amendment 2) |
| ST-8 | `encoderFor(undefined)` / `encoderFor("atascii")` | raw encoder / atascii encoder (names match) | AR-6 |
| ST-9 | `analyze()` with c64 profile: `const X: byte = 'a';` folds to `$C1`; same source, no targetProfile: `$61` | encoding derived from `targetProfile.defaultEncoding` | AR-6 |

### Char literals (03-02, AR-9)

| # | Input / Scenario | Expected | Source |
|---|------------------|----------|--------|
| ST-10 | `const SPACE: byte = ' ';` (c64) | const folds to `$20`; usable where a const byte is required | CL-1 / AR-9 |
| ST-11 | `let ch: byte = 'A';` in a function | compiles; store of `$41` | CL-1 |
| ST-12 | `switch` with `case 'A':` and `case $41:` (c64) | the existing duplicate-case diagnostic (encoded fold collides) | CL-3 / AR-9 |
| ST-13 | `let c: byte = 'é';` (c64) | E10127 naming `U+00E9` and `petscii` | AR-7 |
| ST-14 | `label[0] = 'H';` on a mutable byte array | compiles; stores `$48` | STR-6 / CL-3 |

### String initializers (03-02, AR-8)

| # | Input / Scenario | Expected | Source |
|---|------------------|----------|--------|
| ST-15 | `const MSG: byte[] = "HELLO";` (c64) | size 5; const image `48 45 4C 4C 4F`; emits `__data_Main_MSG` | STR-1 / §4.3 / AR-8 |
| ST-16 | `let n: byte[10] = "HELLO";` | W10140 partial-init | §4.3 |
| ST-17 | `let o: byte[10] = ["HELLO"; 0];` | bytes `48 45 4C 4C 4F 00 00 00 00 00`; no warning | §4.3 / AR-8 form 2 |
| ST-18 | `let p: byte[8] = ["HI"; '.'];` | `48 49 2E 2E 2E 2E 2E 2E` (char fill) | §4.3/§4.4 / AR-9 |
| ST-19 | `let q: byte[3] = "HELLO";` | E10124 "String literal (5 bytes) exceeds array size (3)" | §4.3 / AR-8 (mint) |
| ST-20 | `["HELLO","WORLD"]` and `[1,"HI",3]` initialisers | E10116 each | §4.6 / AR-8 (mint) |
| ST-21 | `let y: byte[5] = [1, 2; "HI"];` | E10116 (fill variant) | §4.6 / AR-8 (folds spent-E10115 case) |
| ST-22 | `poke($0400, "A");` | E10080 (string outside array-initialiser position) | AR-8 form 4 |
| ST-23 | `zeropage { msg: byte[6] = "HELLO\0"; }` | compiles; 6 ZP bytes `48 45 4C 4C 4F 00` via init — **retires the 8a pin** | AR-8 / 8a AR-18 boundary pin |
| ST-24 | `const Z: byte[] = "HI\0";` size 3 ends `$00`; `let label: byte[] = "SCORE:";` mutable, size 6 | STR-4 no auto-terminator; STR-6 + inference | STR-4/STR-6 |

### embed() (03-03)

| # | Input / Scenario | Expected | Source |
|---|------------------|----------|--------|
| ST-25 | `const D: byte[] = embed("table.bin");` (8-byte file beside the source) | size 8; bytes = file bytes; `length(D)` folds to 8 | EMB-1/EMB-4 / AR-11/AR-12 |
| ST-26 | same with `byte[8]` → OK; with `byte[4]` → E10202 "(8 bytes … 4 bytes)" | exact-size rule | EMB-4 |
| ST-27 | `embed("missing.bin")` | E10201 naming the path (no `--asset-path` clause) | EMB-3 / AR-10 |
| ST-28 | `embed("../../outside.bin")` resolving outside `projectRoot` | E10205 (mint) — file existence irrelevant | AR-10 / RD-18 item 7 + Security §embed |
| ST-29 | `embed("/etc/hostname")` (absolute) and `embed("a\x2Eb.bin")` (escape in path) | E10201 invalid-path rejection | AR-10 |
| ST-30 | `let D: byte[] = embed("t.bin");` · local/zeropage/expression positions | E10200 each | EMB-1 / AR-11 |
| ST-31 | `embed("t.bin", spritepad)` | loud E90001 "format-aware embed() is not supported yet…" | AR-11 |
| ST-32 | file of 65537 bytes (test-generated) | E10202-family too-large naming the 65536 cap; file NOT read (stat only) | AR-11 |
| ST-33 | lowering of ST-25's program | `ConstDataEntry{symbol:"__data_Main_D", type:"embed"}`; `!byte $01, $02, …` rows in the data segment | AR-12/AR-13 |
| ST-34 | `analyze()` with NO assetReader on ST-25's source | silent poison — zero diagnostics, symbol type is error; no fabricated size | AR-12 |
| ST-35 | `SemanticModel.embeddedAssets` after ST-25 | maps `Main.D` → the resolved absolute path | AR-12 |

### Acceptance tier (03-04)

| # | Input / Scenario | Expected | Source |
|---|------------------|----------|--------|
| ST-36 | `buildSlice8b` (absolute outDir) | assemble-clean PRG, zero undefined symbols | AR-14 / RD-18 bar 1 |
| ST-37 | VICE run of the fixture | the 03-04 observables table byte-for-byte (`$0400..$0409`, `$C000..$C007`, `$C010..$C017`, `$C020`) | AR-14 / RD-18 bar 3 |
| ST-38 | emitted ASM vs `slice8b.asm.golden` | byte-exact + landmarks (03-04) | RD-18 bar 2 |
| ST-39 | the eleven prior slice goldens | byte-exact, unchanged | AR-1 (additive-only) |
| ST-40 | negatives facade suite | one test per code: E10200/01/02/05, E10116, E10124, E10127, format E90001 | AR-14 |

## Test Categories

### Specification Tests (before implementation, per phase)

| Test File | ST Cases | Component |
|-----------|----------|-----------|
| `packages/core/src/platform/encoding.spec.test.ts` | ST-1..4, ST-8 | encoders |
| `packages/core/src/text/literal-decode.spec.test.ts` | ST-5..7 | decoder |
| `packages/frontend/src/semantics/encoding-seam.spec.test.ts` | ST-9 | seam |
| `packages/frontend/src/semantics/type-check/char-literals.spec.test.ts` | ST-10..14 | char desugar |
| `packages/frontend/src/semantics/type-check/string-init.spec.test.ts` | ST-15..24 | string desugar |
| `packages/frontend/src/semantics/embed.spec.test.ts` | ST-25..32, ST-34, ST-35 | embed typing |
| `packages/codegen/src/il/lower-embed.spec.test.ts` | ST-33 | embed lowering |
| `packages/test-harness/src/slice8b.spec.test.ts` | ST-36, ST-37 | facade + VICE |
| `packages/test-harness/src/golden-slice8b.spec.test.ts` | ST-38, ST-39 | goldens |
| `packages/test-harness/src/slice8b-negatives.spec.test.ts` | ST-40 | negatives |

### Implementation Tests (after green, per phase)

| Test File | Description | Priority |
|-----------|-------------|----------|
| `packages/core/src/platform/encoding.impl.test.ts` | passthrough-tail narrowing vs shipped petscii; boundary cps (`$1F`/`$20`/`$7E`/`$7F`) | High |
| `packages/frontend/src/semantics/type-check/literal-desugar.impl.test.ts` | conversion idempotence; converted nodes keep the original span (same object); typeMap integrity; the four consumers on synthetics | High |
| `packages/compiler/src/api/asset-reader.impl.test.ts` | byte identity on a fixture containing `$00`/`$80`/`$FF`; stat-cap ordering (oversize never read) + post-read size re-check; canonical containment incl. a symlink-escape probe | High |
| `packages/frontend/src/semantics/embed.impl.test.ts` | provenance field; unsized-inference patch path parity with arrays | Med |

### Retirement rewrites (retired-row protocol — rewritten in the SPEC-test step of their phase)

| Shipped pin | New assertion |
|-------------|---------------|
| frontend string-init ICE pin `aggregate-typing.spec.test.ts:228-231` ("ST-44b" — asserts `isIceCode`; carries neither the identifier nor the message, so name it explicitly rather than grep) | ST-15/16/19 success/diagnostic oracles (bare form + W10140) |
| 8a zeropage-string negative — frontend `zeropage.spec.test.ts:131-136` + test-harness `slice8-negatives.spec.test.ts:117-123` twins | ST-23 success |

## Test Data

- `examples/slice8b/table.bin` — 8 committed bytes `01 02 04 08 10 20 40 80`.
- Temp binary fixtures (impl tier): ≥`$80`-byte identity file; 65537-byte generated file (tmp,
  not committed); outside-root probe files under the test tmp dir.
- No mocks — real lexer/parser/analyze, real fs via temp dirs, real ACME/VICE in their tiers.

## Verification Checklist

- [ ] All ST-cases defined with concrete input/output pairs (above)
- [ ] Every ST case traces to spec §/RD/AR (Source column)
- [ ] Spec tests written BEFORE implementation, verified RED, then GREEN
- [ ] Impl tests after green; full verify per phase
- [ ] No regressions: eleven prior goldens + full suites green every phase
