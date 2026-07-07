# 03-03 — Acceptance Fixtures (Phase 3)

The 3-part acceptance bar for Slice 4b (AR-13): CI assemble-clean + CI golden + local VICE, plus
negative fixtures via `compile()`. Mirrors the 4a acceptance structure.

## §1 — The positive fixture — `examples/slice4b/main.blend`

Exercises every 4b codegen path in one deterministic program: a **multi-value** case, an explicit
**`fallthrough`**, a plain **auto-break** case, and the **`default`** path (RD-03-required, AR-5).

```blend
module Main;

let out1: byte;
let out2: byte;

function main(): void {
    let sel: byte = 2;
    let acc: byte = 0;

    // Switch A — multi-value + fallthrough + auto-break.
    switch (sel) {
        case 1:
            acc = 10;
        case 2, 3:              // multi-value: sel==2 matches
            acc = 20;
            fallthrough;        // falls into the case-4 body (skips its test)
        case 4:
            acc = acc + 5;      // reached via fallthrough → 25
        default:
            acc = acc + 1;      // NOT executed (auto-break ended case 4)
    }
    out1 = acc;                 // 25
    poke($C000, out1);

    // Switch B — the default path.
    let sel2: byte = 9;
    switch (sel2) {
        case 1:
            acc = 100;
        default:
            acc = 7;            // sel2 matches no case → default
    }
    out2 = acc;                 // 7
    poke($C001, out2);
}
```

### Expected outcome (hand-traced)

- **Switch A**, `sel == 2`: matches the multi-value `case 2, 3` → `acc = 20`, then `fallthrough`
  transfers into the **case-4 body** (AR-9, skipping the `case 4` test) → `acc = 20 + 5 = 25`; case 4
  has no `fallthrough` → auto-break to the join; `default` is **not** executed. `out1 = 25` (`$19`).
- **Switch B**, `sel2 == 9`: no case matches → `default` → `acc = 7`. `out2 = 7` (`$07`).

**VICE assertion (ST, real VICE 3.10):** `$C000 == $19` (25) and `$C001 == $07` (7).

Footprint (SFA `$0800` region): `out1`/`out2` module vars (2 B) + frame `sel`/`acc`/`sel2` (3 B) =
5 B — within the AR-1 13-byte dead-BASIC-stub shadow (inherited constraint). No ZP, no `__rt_*`
routines (switch is branch-only).

## §2 — The three parts

1. **Assemble-clean (CI, real ACME)** — `buildSlice4b` assembles the fixture through ACME to a
   loadable c64 PRG with zero undefined symbols (`hasErrors === false`). *(ST-19-analogue.)*
2. **CI golden** — `emitAsmSlice4b` → `assertGolden` against a committed
   `packages/test-harness/test/golden/slice4b.asm.golden`. The golden pins the full dispatch chain
   (per-case `eq`+`brcond`, multi-value shared body, the `fallthrough` `br` into the next body, the
   `default` tail) — proving codegen byte-exact in CI (no VICE). Mint with `UPDATE_GOLDEN=1`; inspect
   the diff before committing. *(ST-20-analogue.)*
3. **VICE (local)** — a `describe.skipIf(!hasVice())` test asserts `$C000 == $19` && `$C001 == $07`
   on real VICE 3.10 (≥250 frames for c64 boot+autostart, per the 4a/3b precedent). *(ST-21-analogue.)*

## §3 — Negative fixtures (via `compile()`, no binary — AR-13, FR-13)

Frontend-only (`compile()`), CI-runnable, must set `hasErrors`, emit the code, produce no binary, and
never throw:

| Fixture | Source (essence) | Expected |
|---------|------------------|----------|
| Non-const case value | `switch (x) { case y: ... default: ... }` (`y` a runtime var) | **E10071** |
| Duplicate case value | `switch (x) { case 1: ... case 1: ... default: ... }` | **E10132** |
| Boolean switch operand | `switch (b) { case true: ... default: ... }` (`b: bool`) | **E10075** |

*(All negative fixtures include a `default` so the parser's E10072/MissingDefaultClause — AR-5 —
doesn't mask the code under test. Each uses locals only, no params — params are Slice 5.)*

## §4 — Harness plumbing (`@blend65/test-harness`)

Mirror the 4a `testing/slice4a.ts` shape: `SLICE4B_SRC`, `buildSlice4b`, `emitAsmSlice4b`; suites
`slice4b.spec.test.ts` (assemble + VICE), `golden-slice4b.spec.test.ts` (golden),
`slice4b-negatives.spec.test.ts` (the three negatives). Golden file
`test/golden/slice4b.asm.golden`.
