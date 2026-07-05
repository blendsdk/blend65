# Acceptance Fixtures: RD-18 Slice 3a

> **Document**: 03-03-acceptance-fixtures.md
> **Parent**: [Index](00-index.md)
> **Implements**: FR-3, FR-4, FR-5; AR-2, AR-8, AR-11

## Overview

The RD-18 per-slice acceptance bar has three parts, all required: **(1) CI assemble-clean**, **(2) CI
golden**, **(3) local VICE runtime**. This component defines the Slice 3a fixture program and the three
tests, plus the intentional re-mint of the existing constant-gate golden (AR-8).

## Architecture

### The fixture program — `examples/slice3a/main.blend`

```blend
module Main;
function main(): void {
    let x: byte = 5;
    poke(0xD020, x);
}
```

Chosen per AR-2 (use-the-local): the `poke` reads `x`'s frame slot, so the test proves
`__frame_Main_main_x` **resolves in a real `load`**, not merely appears in the symbol header.

**Why this lowers with no new codegen work** (verified in current-state recon):
- `let x: byte = 5` → `LetDecl` → `store 5 → loc(__frame_Main_main_x)` (`lower.ts:201-208`)
- `poke(0xD020, x)` → `IntrinsicCallExpr`; arg `x` → `IdentExpr` → `load loc(__frame_Main_main_x)`
  (`lower.ts:227-234, 268-273`)
- `poke` value arg is a non-literal → passes intrinsic validation (`intrinsic-validation.ts:166-169`)
- `0xD020` literal is range-checked and in range for `poke`'s address parameter

### Proposed test files

| File | Tier | Runs in CI? | Asserts |
| ---- | ---- | ----------- | ------- |
| `packages/test-harness/src/golden-slice3a.spec.test.ts` | Golden | ✅ yes (no VICE) | `--emit-asm` matches `test/golden/slice3a.asm.golden` |
| `packages/test-harness/src/slice3a.spec.test.ts` | Assemble-clean + VICE | assemble-clean ✅ / VICE ⛔ `skipIf` | build → loadable PRG, zero undefined symbols; VICE `$D020 == 0xF5` |
| `test/golden/slice3a.asm.golden` | Golden artifact | — | committed via `UPDATE_GOLDEN=1` |
| `test/golden/gate.asm.golden` (existing) | Golden artifact | — | **re-minted** (adds `__frame_Main_main`) |

## Implementation Details

### (1) Assemble-clean test (CI-runnable portion)

Follows `gate.spec.test.ts`'s build helper pattern but as a standalone assemble check that runs when
ACME is present:

```ts
describe.skipIf(!hasAcme())("Slice 3a — assemble-clean", () => {
  it("compiles the local-byte fixture to a loadable c64 PRG with zero undefined symbols", async () => {
    const built = await buildSlice3a();               // writes main.blend to a temp dir, build({platform:"c64",...})
    expect(built.result.diagnostics.some(isError)).toBe(false);
    expect(built.result.binary).toBeInstanceOf(Uint8Array);   // PRG read back (RD-15 build)
    const asm = await emitAsm3a();
    expect(asm.text).toContain("__frame_Main_main");
    expect(asm.text).toContain("__frame_Main_main_x");
  });
});
```

`buildSlice3a`/`emitAsm3a` mirror `packages/test-harness/src/testing/gate.ts:33-43` (`buildGate`),
substituting the fixture source. The "zero undefined symbols" guarantee is enforced by ACME itself:
an undefined `__frame_*` reference is an ACME error → non-loadable → the build surfaces a diagnostic.

### (2) CI golden test

```ts
it("matches the committed ASM golden", async () => {
  const result = await emitAsm({ platform: "c64", cwd, sourceFiles: ["main.blend"] });
  assertGolden(result.text!, "test/golden/slice3a.asm.golden");   // UPDATE_GOLDEN=1 regenerates
});
```

Same shape as `golden-gate.spec.test.ts:22-34`. The golden captures the exact `__frame_Main_main` /
`__frame_Main_main_x` addresses (deterministic per SFA layout).

### (3) Local VICE runtime test

```ts
describe.skipIf(!(hasVice("c64") && hasAcme()))("Slice 3a — VICE runtime", () => {
  it("drives $D020 to 0xF5 via the local's frame slot", async () => {
    const built = await buildSlice3a();
    const env = await setupEmulator({ build: built.result, platform: "c64" });
    await runUntilMemory(env.driver, 0xD020, 0xF5);
    assertMemory(env.driver, 0xD020, 0xF5);           // VIC-II unused nibble → 0xF5 (AR-11 / AR-H19)
  });
});
```

Same pattern as `gate.spec.test.ts:39-47`. `0xF5` (not `0x05`) because `$D020`'s high nibble reads
back as 1s on the VIC-II (RD-12 AR-H19).

### Gate golden re-mint (AR-8)

Once `main` is a real `FunctionInfo`, the existing gate gains a `__frame_Main_main` base symbol.
Execution steps:
1. Run the gate golden test — it will fail on the new `__frame_Main_main` line.
2. Regenerate: `UPDATE_GOLDEN=1 yarn workspace @blend65/test-harness test golden-gate`.
3. **Inspect the diff** — confirm the *only* change is the added `__frame_Main_main = $XXXX` line (no
   code drift).
4. Re-verify on VICE: the existing `gate.spec.test.ts` must still assert `$D020 == 0xF5`.
5. Commit the re-minted golden.

This is a legitimate immutable-oracle re-mint: the golden changes only because behavior was
re-proven on hardware (RD-18 acceptance bar part 3), not to paper over a regression.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| ACME absent (CI without ACME) | assemble-clean + VICE `skipIf`; golden tier still runs | AR-11 |
| VICE absent (CI) | VICE test `skipIf(!(hasVice && hasAcme))` — skipped, golden guards regression | RD-18 AC-3 |
| Golden drift from an unrelated change | `assertGolden` byte-exact diff; reviewer inspects before `UPDATE_GOLDEN` | AR-8 |
| Undefined `__frame_*` at assemble time (FQN mismatch) | ACME errors → build diagnostic → assemble-clean test fails loudly | AR-7 |

## Testing Requirements

- The three tests above (ST-5 assemble-clean, ST-6 golden, ST-7 VICE) in 07.
- The re-minted gate golden keeps the existing `gate.spec.test.ts` VICE assertion green (ST-8).
- SR-2: capture the `ResourceReport` delta (bytes/ZP) the local adds vs the constant gate, recorded in
  the execution plan's closeout note (living documentation, not a hard gate).
