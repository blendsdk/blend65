# 03-04 — Acceptance Fixtures (3-Part Bar)

> The assemble-clean + golden + VICE fixture and the E10102 negative. Traces: FR-10…FR-13, AR-13.
> **CodeOps Skills Version**: 3.2.0

## 1. Positive fixture — `examples/slice4a/main.blend`

```blend65
module Main;

let result: byte;               // module scalar → __var_Main_result

function main(): void {
    let sum: byte = 0;

    // for-loop (to, Pattern A) with an inner if + break + continue
    for (let i: byte = 1 to 10) {
        if (i == 7) {
            break;              // stop before adding 7,8,9,10
        }
        if (i == 3) {
            continue;          // skip adding 3
        }
        sum = sum + i;         // adds 1,2,4,5,6 = 18
    }

    // while-loop
    let n: byte = 3;
    while (n > 0) {
        sum = sum + 1;         // adds 1 three times = +3
        n = n - 1;
    }

    result = sum;              // 18 + 3 = 21 = $15
    poke(0xC000, result);      // observable: $C000 == $15

    // if/else (two-armed — proves both arms' codegen)
    if (result > 20) {
        poke(0xC001, 1);       // taken (21 > 20) → $C001 == $01
    } else {
        poke(0xC001, 2);       // not taken
    }
}
```

**Hand-trace (the immutable oracle):**
- `for i = 1 to 10`: i=1→sum1; i=2→sum3; i=3→`continue`; i=4→sum7; i=5→sum12; i=6→sum18; i=7→`break`.
  ⇒ `sum = 18`.
- `while (n>0)` with n=3: +1,+1,+1 ⇒ `sum = 21`.
- `result = 21 = $15`; `poke($C000, 21)`.
- `21 > 20` true ⇒ `poke($C001, 1)`; else arm not executed.

**VICE assertions:** `$C000 == $15` (21) and `$C001 == $01`.

Coverage: `for`(`to`, sub-max ⇒ Pattern A), `break`, `continue`, `while`, one-armed `if`, two-armed
`if/else`, comparisons (`==`,`>`,`>0`... all boolean), module + local scalars, arithmetic — the full
4a surface. `main` is `void` (no all-paths-return obligation).

## 2. Test support — `packages/test-harness/src/testing/slice4a.ts`

Mirror `testing/slice3b.ts`: `SLICE4A_SRC` (verbatim above), `buildSlice4a()` (real ACME →
`BuildResult` + cleanup), `emitAsmSlice4a()` (`emitAsm`, no ACME, for the golden). Test-only.

## 3. Spec tests

- `slice4a.spec.test.ts` — **ST-19 assemble-clean** (`skipIf(!hasAcme())`): `build()` → `hasErrors
  false`, `binary instanceof Uint8Array`; emitted ASM contains multi-block labels (`Main_main_L`) and
  a branch (`JMP`/`BNE`) and `__var_Main_result`. **ST-21 VICE** (`skipIf(!(hasVice&&hasAcme))`):
  `$C000==$15`, `$C001==$01`.
- `golden-slice4a.spec.test.ts` — **ST-20**: `emitAsmSlice4a()` `assertGolden` vs
  `test/golden/slice4a.asm.golden` (byte-exact; minted with `UPDATE_GOLDEN=1`, inspected for the loop
  labels + branch instructions + Pattern-A compare/increment).

## 4. Negative fixture — all-paths-return (ST-22, FR-13)

`slice4a-missing-return.spec.test.ts` via the frontend-only `compile()` facade (no ACME, no binary):

```blend65
module Main;
function f(): byte {
    let x: byte = 5;
    if (x > 0) {
        return 1;
    }
    // falls through with no return → E10102
}
function main(): void { }
```

Assert: `compile()` never throws; `hasErrors === true`; `diagnostics.map(d=>d.code)` contains
`DiagCode.NotAllPathsReturn` (**E10102**); no `binary` property. *(Uses a local `x`, not a parameter —
parameters are not yet in scope until Slice 5, so a param reference would raise a spurious E10100.)*

## 5. Regression guard (ST-23)

`golden-gate` / `golden-slice3a` / `golden-slice3b` must remain **byte-exact** — the multi-block loop
in `translate.run()` degenerates to today's behavior for single-`_entry` functions (AR-13). Run the
full `@blend65/test-harness` suite to confirm.
