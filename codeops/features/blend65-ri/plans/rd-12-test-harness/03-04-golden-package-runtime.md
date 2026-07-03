# Golden Snapshots, Publishable Package & Runtime Verification

> **Document**: 03-04-golden-package-runtime.md
> **Parent**: [Index](00-index.md)
> **Covers**: AC-10/12/13/14/15 · RD-17 inherited AC-14 · R2/R29–R35 · AR-H2/H5/H10/H11/H17

## Overview

The closing component delivers the golden-snapshot helper (`assertGolden` + `UPDATE_GOLDEN`,
AC-10), turns `@blend65/test-harness` into a documented publishable package with a stable
public barrel (AC-14 *own* / AC-15), and lands the two runtime-verification suites that are
the whole point of RD-12: the **gate-program** emulator test and the **RD-17 AC-14**
runtime-routine vectors (AR-P4). It also updates the CLAUDE.md dependency table (AR-H17).

## Architecture

### Module layout (AR-H13)

```
src/golden.ts             # assertGolden(actual, goldenPath, updateMode?)
src/index.ts              # public barrel — the stable API surface (AC-14/AC-15)
src/**/*.spec.test.ts     # gate + RD-17 emulator suites (local, skipIf-VICE)
test/golden/*.golden      # committed golden fixtures (e.g. gate .asm.golden)
```

## Implementation Details

### Golden-snapshot helper (`golden.ts`, R29–R32, AC-10)

```typescript
/** Byte-exact golden comparison (R30). When update mode is on, write `actual` to
 *  `goldenPath` instead of asserting (R31, manual developer action).
 *  Update mode := explicit `updateMode` arg OR `process.env.UPDATE_GOLDEN` truthy (AR-H10). */
export function assertGolden(actual: string, goldenPath: string, updateMode?: boolean): void;
```

- **Compare (default):** read `goldenPath`; if missing, fail with "golden file not found —
  run with UPDATE_GOLDEN=1 to create it". Byte-for-byte compare (R30); on mismatch throw an
  `AssertionError` with a unified-diff-style excerpt (first differing line + context).
- **Update (`UPDATE_GOLDEN=1` or `updateMode`):** write `actual` to `goldenPath` (creating
  parent dirs), log the path, and pass. Net-new helper — the 7 existing inline
  `*.golden.spec.test.ts` suites are **not** migrated (PF-007).
- **Security:** reads/writes only the caller-supplied path; update mode is an explicit opt-in.

A demonstrating golden test compiles the gate program to `.asm` (via `emitAsm`) and
`assertGolden`s it against a committed `gate.asm.golden`, proving the helper end-to-end in CI
(no emulator needed).

### Publishable package (R33–R35, AC-14/AC-15)

- **`src/index.ts` public barrel** re-exports the stable API only: `EmulatorDriver`,
  `LaunchOptions`, `Registers`, `BreakReason`, `ViceDriver`, `runUntilLabel`, `runFrames`,
  `runUntilMemory`, `assertRegister`, `assertMemory`, `assertGolden`, `setupEmulator`,
  `hasVice`, `hasAcme` (PF-002), `EMULATOR_REGISTRY`/`emulatorFor`, and `DEFAULT_TIMEOUT_MS`. Internal VICE
  protocol details (`protocol.ts`, socket plumbing) are **not** exported (R34).
- **JSDoc** on every exported symbol (project convention).
- **`package.json`:** add `@blend65/compiler` to `dependencies` (AR-H2) and `@blend65/codegen`
  to `devDependencies` (test-scope — `loadRuntimeModule` for the RD-17 vectors below, PF-001);
  keep `publishConfig.access: public`, `main`/`types`/`exports` as-is. Version stays `0.1.0`.
- **`tsconfig.json`:** add `{ "path": "../compiler" }` and `{ "path": "../codegen" }` to
  `references` (the repo's 1:1 deps↔references convention — `cli/tsconfig.json` precedent, PF-001).
- **Any-binary guarantee (AC-15):** `setupEmulator({ binary, labelFile })` works with any
  `.prg` + VICE label file — no Blend65 coupling (a spec test loads a hand-authored PRG).

### Gate-program emulator test (AR-H9, MVP gate AR-43/44)

`src/gate.spec.test.ts` (local, `describe.skipIf(!hasVice("c64") || !hasAcme())` — `build()`
compiles via ACME, so the suite needs both ACME and VICE, PF-002): `build()` the gate →
`setupEmulator` → `runUntilMemory(0xD020, 5)` → `assertMemory(0xD020, 5)` +
`assertMemory("_main", 0xA9, symbols)` + `runUntilLabel("_main")`. Proves a real
Blend65 program pokes the VIC-II border register on real VICE.

### RD-17 inherited AC-14 — runtime-routine vectors (AR-P4, AR-H5)

`src/runtime-routines.spec.test.ts` (local, `describe.skipIf(!hasVice("c64") || !hasAcme())`
— assembling the routines needs ACME as well as VICE, PF-002): assemble each `__rt_*` routine
via `@blend65/codegen`'s `loadRuntimeModule` over the `RT_ROUTINES` catalog from
`@blend65/core` (`loadRuntimeModule` from codegen, `RT_ROUTINES` from core — the exact split
`compiler/src/runtime-asm.impl.test.ts` uses; PF-001), then invoke ACME to produce each
routine binary, load once into a single VICE session, and for each **bounded** vector
(AR-H5 — all edge crosses + ~25 seeded-random/routine):

1. `writeMemory` the ZP inputs (`__zp_arg_0..3 = $02..$05`) and `REGISTERS_SET` A/X per the
   ABI (`__rt_mul8`: a→A, b→X; `__rt_div16`: a→A/X, b→zp[2..3]; etc.).
2. set PC to the routine entry, `EXECUTE_UNTIL_RETURN` (the routines are RTS-terminated).
3. `readRegisters`/`readMemory` the outputs and assert against the reference math
   (product/quotient/remainder), reusing the ABI table from `runtime-asm.impl.test.ts`.

This discharges RD-17's *inherited* AC-14 on real silicon (distinct from RD-12's own AC-14).
The interim interpreter test stays as the fast exhaustive in-process check (PF-001).

> **Seeded randomness:** vectors use a deterministic LCG seeded from a constant (mirroring
> `runtime-asm.impl.test.ts`) — no `Math.random`/`Date` (reproducible, and compatible with
> the repo's determinism rules).

### CI policy (AC-12/AC-13)

- The package `test` script (`vitest run`) runs in CI via turbo. Protocol-codec, assertion,
  strategy-timeout, registry, golden, and PNG tests run **for real in CI** (no VICE).
- Emulator/RD-17 suites are `describe.skipIf(!hasVice())` → **skipped** in CI (AR-27, AC-13),
  **run green locally** on VICE 3.10 before ticking (AR-H3).

### Bookkeeping (AR-H17)

- Update the CLAUDE.md package dependency table: `@blend65/test-harness` row `Depends on`
  → `core, compiler` (+ `codegen` **dev-only**, RD-17 vectors — PF-001).
- Tick RD-17's inherited AC-14 in the RD-17 plan / roadmap once the vectors pass locally.

## Error Handling

| Error Case                                          | Handling Strategy                                                        | AR Ref |
| --------------------------------------------------- | ------------------------------------------------------------------------ | ------ |
| Golden file missing (compare mode)                  | Fail with a "run UPDATE_GOLDEN=1 to create" message                      | R31    |
| Golden mismatch                                     | `AssertionError` with a diff excerpt (first divergence + context)        | R30    |
| `UPDATE_GOLDEN` set unexpectedly in CI              | Documented as a manual dev action; CI never sets it (deterministic pass) | AR-H10 |
| Routine vector output ≠ reference math              | `AssertionError` naming routine, inputs, expected vs actual              | AR-H5  |
| VICE absent                                         | Suite `skipIf` skips cleanly (AC-13); local run required to tick         | AR-H3  |

> **Traceability:** `assertGolden`/update mode → R29–R32/AR-H10; publishable barrel →
> R33–R35; gate sync → AR-H9; RD-17 vectors → AR-P4/AR-H5; CI policy → AR-27/AC-12/13;
> dep-table update → AR-H17.

## Testing Requirements

- **Spec tests (CI):** `assertGolden` compare-pass, compare-fail-with-diff, and update-mode
  behavior against a temp golden (ST-24/ST-25/ST-26); the public barrel exports exactly the
  documented API (ST-27); `setupEmulator` accepts a `BuildResult` shape and a binary-path
  shape (type-level + logic, ST-28).
- **Spec tests (local, skipIf-VICE):** the gate emulator test (ST-29) and the RD-17 routine
  vectors (ST-30..ST-33 per routine).
- **Impl tests:** golden diff formatting edge cases; barrel tree-shake/no-internal-leak.
