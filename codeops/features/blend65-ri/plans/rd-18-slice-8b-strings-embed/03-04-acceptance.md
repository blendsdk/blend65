# Acceptance Fixture: RD-18 Slice 8b

> **Document**: 03-04-acceptance.md
> **Parent**: [Index](00-index.md)
> **Governs**: AR-14 (three-part bar per RD-18 §Acceptance Bar)

## The fixture — `examples/slice8b/main.blend` (+ `table.bin`)

```blend65
module Main;

const TITLE: byte[] = "HELLO C64!";        // 10 bytes, petscii (AR-3)
const TABLE: byte[] = embed("table.bin");  // 8 committed bytes: $01 02 04 08 10 20 40 80
let banner: byte[8] = ["HI"; '.'];         // bracketed string + char fill (AR-8 form 2)

function copyBytes(src: const byte[], len: byte, dst: word): void {
  for (let i: byte = 0 to len) {
    poke(dst + word(i), src[i]);
  }
}

function main(): void {
  copyBytes(TITLE, length(TITLE), $0400);  // screen RAM — the Ch 08 §14.3 shape
  copyBytes(TABLE, length(TABLE), $C000);  // embedded data staged to the observable block
  banner[0] = 'B';                         // STR-6 mutation via char literal (AR-9)
  copyBytes(banner, 8, $C010);
  if (TITLE[0] == 'H') {                   // char-literal comparison folds/compares encoded
    poke($C020, 1);
  }
}
```

`table.bin` is committed at `examples/slice8b/table.bin` — exactly 8 bytes
`01 02 04 08 10 20 40 80` (deterministic, hexdump-documented in the harness).

## Expected observables (VICE, C64, petscii)

| Range | Bytes | Proves |
|-------|-------|--------|
| `$0400..$0409` | `48 45 4C 4C 4F 20 43 36 34 21` | string→data→screen copy, `length()` fold, by-ref const param reuse |
| `$C000..$C007` | `01 02 04 08 10 20 40 80` | embed bytes end-to-end |
| `$C010..$C017` | `42 49 2E 2E 2E 2E 2E 2E` | bracketed init + char fill + STR-6 mutation (`B`,`I`,`.`×6) |
| `$C020` | `01` | char-literal comparison |

`main` terminates → the standard terminating shim (8a's analysis selects it; unchanged goldens
discipline).

## Harness pieces (test-harness package, slice-7b/8a conventions)

- `src/testing/slice8b.ts` — `SLICE8B_MAIN_SRC` verbatim + `buildSlice8b`/`emitAsmSlice8b`.
  **`outDir` MUST be absolute** (`join(cwd, "out")` — the 8a-documented double-resolve trap).
  The committed `table.bin` is copied beside the temp source so source-relative resolution
  (AR-10) is exercised for real.
- `src/slice8b.spec.test.ts` — assemble-clean + the VICE runtime suite
  (`describe.skipIf(!hasVice()||!hasAcme())`, `fileParallelism` conventions; assertions =
  direct memory reads of the table above).
- `src/slice8b-negatives.spec.test.ts` — facade-level negatives, one per code:
  E10200/E10201/E10202/E10205, E10116, E10124, E10127, format-arg E90001 (ST-41 rows).
- `src/golden-slice8b.spec.test.ts` + `test/golden/slice8b.asm.golden` — byte-exact golden
  with landmarks: `__data_Main_TITLE` + its `!byte $48, $45, …` row, `__data_Main_TABLE` +
  `!byte $01, $02, …` row, the banner initCode stores, `JSR _main` (terminating shim).
- Prior-goldens regression: the eleven existing goldens stay byte-exact (no fixture uses
  strings/embed; all changes are additive) — asserted every phase, not just here.

## The three-part bar (all required)

1. **Assemble-clean (CI)** — `buildSlice8b` through real ACME, zero undefined symbols.
2. **Golden (CI)** — `slice8b.asm.golden` byte-exact + landmark asserts.
3. **VICE runtime (local)** — the observables table on real VICE 3.10.
