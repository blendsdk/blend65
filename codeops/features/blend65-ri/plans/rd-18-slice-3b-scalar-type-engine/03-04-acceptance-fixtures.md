# Acceptance Fixtures: RD-18 Slice 3b

> **Document**: 03-04-acceptance-fixtures.md
> **Parent**: [Index](00-index.md)
> **Implements**: FR-8; AR-1, AR-4, AR-6

## Overview

The three-part per-slice bar: **(1) CI assemble-clean**, **(2) CI golden**, **(3) local VICE**. Plus a
negative test asserting **E10081** (the AC-2 headline). Mirrors the Slice-3a fixture pattern
(`testing/gate.ts`, `slice3a.spec.test.ts`, `golden-slice3a.spec.test.ts`).

## The fixture program — `examples/slice3b/main.blend`

```blend
module Main;

let accB: byte;              // module-level scalar (no init — spec VAR-2, AR-2) → __var_Main_accB
let accW: word;              // module-level scalar → __var_Main_accW

function main(): void {
    let a: byte = 5;
    let b: byte = 3;
    let c: byte = 2;
    accB = a * b + c;        // byte: (5*3)+2 = 17 = $11  (a*b via __rt_mul8)
    poke(0xC000, accB);      // observable: $C000 == $11

    let x: word = 300;       // word literal (>255 → IL_WORD, the width fix)
    let y: word = 2;
    accW = x * y;            // word: 300*2 = 600 = $0258  (via __rt_mul16)
    pokew(0xC001, accW);     // observable: $C001 == $58, $C002 == $02  (little-endian)
}
```

**Why this exercises the whole 3b surface:**
- **Module-level scalars** `accB`/`accW` (allocation `__var_*`, cross-scope write from `main`, read by `poke`).
- **Local scalars** `a,b,c,x,y` (frame slots, Slice-3a path).
- **Same-type byte arithmetic** `a*b+c` (`__rt_mul8` + inline add) and **word arithmetic** `x*y`
  (`__rt_mul16`), proving the **width fix** (word literal `300`, word result typing).
- **`poke`/`pokew`** to plain RAM `$C000–$C002` (always-free c64 RAM) → **exact** VICE assertions.
- **Total vars ≈10 bytes** (accB 1 + accW 2 + a,b,c 3 + x,y 4) < 13 → within the AR-1 dead-stub shadow.

## The negative fixture — mixed signedness (inline source, not a file)

```blend
module Main;
function main(): void {
    let a: byte = 5;
    let s: sbyte = -1;
    let r: byte = a + s;     // ❌ E10081: cannot mix byte and sbyte in expression
}
```
Asserted via `compile()` (frontend-only): `diagnostics` contains **E10081**, `hasErrors === true`,
**no binary emitted**, **never throws**.

## Proposed test files

| File | Tier | Runs in CI? | Asserts |
|------|------|-------------|---------|
| `packages/test-harness/src/golden-slice3b.spec.test.ts` | Golden | ✅ yes | `--emit-asm` matches `test/golden/slice3b.asm.golden` |
| `packages/test-harness/src/slice3b.spec.test.ts` | Assemble-clean + VICE | assemble ✅ / VICE ⛔ `skipIf` | loadable PRG, zero undefined symbols; VICE `$C000==$11`, `$C001==$58`, `$C002==$02` |
| `packages/frontend/src/semantics/…mixed-sign.spec.test.ts` | Negative (frontend) | ✅ yes | `byte + sbyte` → E10081, no throw |
| `test/golden/slice3b.asm.golden` | Golden artifact | — | committed via `UPDATE_GOLDEN=1` (must contain `__var_Main_accB/accW`, `__rt_mul8`, `__rt_mul16`) |

`buildSlice3b`/`emitAsmSlice3b` mirror `testing/slice3a.ts` (`buildSlice3a`/`emitAsmSlice3a`),
substituting the fixture source (a new `testing/slice3b.ts`).

## (3) Local VICE runtime test (shape)

```ts
describe.skipIf(!(hasVice("c64") && hasAcme()))("Slice 3b — VICE runtime", () => {
  it("computes byte a*b+c and word x*y into module vars, poked to plain RAM", async () => {
    const built = await buildSlice3b();
    const env = await setupEmulator({ build: built.result, platform: "c64" });
    await runUntilMemory(env.driver, 0xC000, 0x11);   // byte result settled
    await assertMemory(env.driver, 0xC000, 0x11);      // 17
    await assertMemory(env.driver, 0xC001, 0x58);      // 600 low byte
    await assertMemory(env.driver, 0xC002, 0x02);      // 600 high byte
  });
});
```

## Golden re-mints (expected, immutable-oracle)

Landing real typing + module vars will legitimately change committed goldens that snapshot the empty
path:
- `gate.asm.golden` / `slice3a.asm.golden` — **re-check**; they should be **unchanged** (those
  programs have no module vars and their locals already typed correctly). If the width-threading
  alters byte-typed output, inspect the diff and re-mint only if behavior is re-proven (as AR-8 in 3a).
- SFA `plan-allocation.golden` / codegen IL goldens that assert `moduleVariables: []` — unaffected by
  the fixtures (those goldens use empty-module-var inputs); only the **new** `slice3b` golden adds vars.
- **Discipline:** every golden change is inspected before `UPDATE_GOLDEN=1`; a re-mint is valid only
  when the changed bytes are re-proven on VICE (bar part 3), never to paper over a regression.

## Error handling

| Case | Handling | Ref |
|------|----------|-----|
| ACME absent (CI) | assemble-clean + VICE `skipIf`; golden tier still runs | AR-11 (3a) |
| VICE absent (CI) | VICE `skipIf(!(hasVice&&hasAcme))`; golden guards regression | RD-18 AC-3 |
| Undefined `__var_*`/`__frame_*` at assemble | ACME errors → build diagnostic → assemble-clean fails loudly | AR-9 |
| Fixture var footprint grows >13 bytes | **guard**: keep the fixture ≤13 bytes; document the AR-1 ceiling in the closeout | AR-1 |

## Testing requirements

- ST-5 assemble-clean, ST-6 golden, ST-7 VICE (`$C000/1/2`), ST-8 mixed-sign E10081 negative
  (see [07-testing-strategy.md](07-testing-strategy.md)).
- SR-2: capture the `ResourceReport` delta (module-var bytes + `__rt_*` call sites) vs Slice 3a.
- SR-3: the AR-1 collision ceiling recorded in the execution-plan closeout.
