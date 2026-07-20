# Current State — measured at planning time

Every figure and line reference below was re-derived on `e43b32f` (branch `feat/asm-parity`) by
running the real compiler and the real assembler, not read from the RD.

## What balloon compiles to today

```
Total binary: 677 bytes      __data_Main_BALLOON = $0A67
```

63 unrolled `poke($0340…$037E, BALLOON[n])` statements (`examples/balloon/main.blend:11-73`), each
`LDA abs` + `STA abs`, staging the embedded sprite into block 13 so the VIC can find it. The bytes
exist twice.

Rewritten (pokes deleted, `poke($07F8, hi(&BALLOON) * 4)`) and re-measured:

| Build | Bytes | Symbol |
|---|---|---|
| unaligned | 312 | `$08FA` |
| `!align 255, 0, 0` prepended | **318** | **`$0900`** |

`$0900 / 64 = 36` and `hi($0900) * 4 = 36`. The mechanism is proven end to end **before a line of
compiler code is written** — what remains is making the compiler emit what was hand-inserted.

## The pieces that already exist

| Piece | Where | State |
|---|---|---|
| `AcmeDirective` union | `core/src/instr-model/stream.ts:37-44` | 7 variants — `origin`, `symbolDef`, `byte`, `word`, `text`, `fill`, `outputFile`. **No alignment variant** |
| `&` lowering | `codegen/src/il/lower.ts:1807` (`lowerAddressOf`) | Works. Emits `LDA #<sym` / `LDA #>sym`. Const aggregates routed at `:1817-1818` via `sym.kind === "constant"` |
| Const-data entries | `codegen/src/il/lower.ts:237-249` | Built from `model.constValues`; `ConstDataEntry` (`il/cfg.ts`) carries `symbol`, `data`, `type` |
| Const-data streams | `codegen/src/instr/instr-program.ts:191-198` (`constDataStream`) | Emits `label` + `!byte` rows, 16 per row |
| Serialization | `codegen/src/instr/serialize-acme.ts:125-131` | Concatenates data streams after code, one comment header each |
| Layout invariants | `test-harness/src/golden-layout.spec.test.ts:63-113` | ST-B39/B40/B43/B44, 43 assertions |
| Balloon build helper | `test-harness/src/testing/balloon.ts:44-58` | Real `build()` + real ACME in a temp dir; **commits no generated output** |

## The ordering fact the design rests on

`lowerToIL` lowers **all functions first** (`lower.ts:213-220`), **then module init code**
(`:229-231`), then builds `constData` (`:237-249`). A symbol set filled during `lowerAddressOf` is
therefore **already complete** when the data entries are constructed — no second pass, no plumbing
through serialization (AR #72). That covers completeness *in time*; see trap 5 for the separate
question of whether the set is *reachable* from both lowering units.

## Traps, verified

Five things will silently do the wrong thing if the implementer trusts the obvious reading.

**1. `&X` and a by-reference argument are the same IL operand.**
`lower.ts:1022-1029` emits the same `addrOf` constructor for a static aggregate argument that
`lowerAddressOf` emits for `&X`. Already committed proof: `slice7b.asm.golden:89,91` contains
`LDA #<__data_Game_TABLE` / `LDA #>__data_Game_TABLE`, produced by the plain call
`poke($C002, sum(TABLE, length(TABLE)))` at `examples/slice7b/main.blend:19` — `sum`'s
*declaration* is `examples/slice7b/game.blend:15`, and it is the **call** that emits the pair. The
*same instruction pair* the RD once cited as its verification. Marking must happen **inside
`lowerAddressOf`**, whose eight call sites (`:336, :485, :1042, :1466, :1607, :2473, :2494, :2528`)
are all `isAddressOfExpr`-gated, so the by-ref path can never reach it.

**2. `slice8` takes addresses too — of functions.**
`examples/slice8/main.blend:27-28` has `pokew($FFFE, &onIRQ)`. `lowerAddressOf` handles
`variable`, `constant` and `function` symbols through one path, so the `sym.kind === "constant"`
filter is load-bearing, not defensive.

**3. ACME's `!align` is a bitmask, not a modulus.** Verified against ACME 0.97:

| Written | Result |
|---|---|
| `!align 256, 0` | **assembles silently, aligns nothing** |
| `!align 255, 0` | correct page alignment |
| `!align 256` | syntax error |
| `!align 255, 0` (no fill) | pads with **`$EA`** |
| `!align 255, 0, 0` | pads with `$00` |

"It assembles" cannot distinguish the right directive from the silently-wrong one, which is why
every alignment assertion in this plan goes through the **resolved symbol address**.

**4. Balloon's observable table is shared.** `testing/balloon.ts:73,79` holds
`{ address: 0x07f8, value: 13 }` and `{ address: 0x0340, bytesFile: … }`, and the same object is
consumed by the twin tier (`twins.spec.test.ts:87`) against a twin that still stages at `$0340`.
`Check` (`observables.ts:38-41`) has no symbol-relative form.

**5. `LowerCtx` is built twice, and the second one is easy to miss.**
`lower.ts:161-198` is an all-`readonly` interface constructed at `:294` (`lowerInitCode`,
`fqName: "__init"`) and `:363` (`lowerFunction`) — per lowering *unit*, not per program. Adding an
`addressTakenConsts` field forces both literals to supply one but **not to share one**. The init
path is live: a module-scope `let ptr: word = &TABLE;` reaches `lowerAddressOf` via `:336`
(verified by compiling a probe on this tree). Since every planned spec test but ST-C19b puts `&`
inside a function body, a per-context set passes the whole suite while that array never aligns.

## Refuted — checked, so nobody re-checks

| Worry | Verdict |
|---|---|
| Deleting 63 pokes renumbers balloon's label anchors | **No.** `Main_main_L5`/`L3` are present and identical before and after — the budget window survives |
| RD-05's invariants need to cover the aligned emission | **They cannot, and it does not matter.** They scan jump shapes inside function sections; padding is inserted by ACME and appears in no golden (AR #70) |
| `@blend65/platforms` needs a new switch arm | **No.** Plugins construct `outputFile` directives; they never switch over the union |
| Branch relaxation / per-function costs could be corrupted by a data directive | **No.** Both iterate `segment: "code"` streams only |
| A hidden runtime const-data copy exists | **No.** `needsDataInit` (set at `instr-program.ts:233`) is declared on `PreambleOptions` (`core/src/platform/platform-plugin.ts:40`) and passed *to* plugins — it is not a `PlatformPlugin` member. The load-bearing half holds: no plugin consumes it (`c64.ts:89-93` drops it) |
| `origin`/`fill` could substitute for an align directive | **No.** Both take literal numbers |
