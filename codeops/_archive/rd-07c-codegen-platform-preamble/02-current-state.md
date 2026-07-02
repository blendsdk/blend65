# Current State: RD-07c Codegen Platform Preamble

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)
> **Purpose**: The as-built RD-07b + RD-10 surfaces RD-07c builds on, and the precise gaps it
>   closes. Read from the live tree on 2026-06-10.

## What RD-07c builds ON

### RD-07b back end (`packages/codegen/src/instr/` — extend)

- **`instr-program.ts`** — `interface InstrProgram { preamble: readonly StreamEntry[];
  streams: readonly InstrStream[]; allocationPlan }` and
  `generateInstr(ilProgram, cpuVariant, bag): InstrProgram`. **`preamble` is hard-coded to
  `Object.freeze([])`** today (the documented RD-07c seam). `programByteSize(program)` already
  sums `program.preamble` then every stream entry — so a populated preamble is counted with no
  code change. **RD-07c adds `assembleProgram` here** (D2), leaving `generateInstr` untouched.
- **`translate.ts`** — `translateFunction(fn, plan, cpuVariant, bag): InstrStream`. `run()`
  does `this.out.push(label(sanitize(this.fn.name)))` and returns `{ symbol: this.fn.name,
  segment: "code", entries }`. **`sanitize(name)` is an identity stub** (`return name;`). So
  the gate stream is currently labelled `Main.main` (illegal ACME label; not `_main`).
  **RD-07c makes `sanitize()` real and special-cases the entry function to `_main`** (D4).
- **`print-instr.ts`** — `printInstr(stream): string`, the canonical ACME serializer
  (consumed read-only; RD-07c adds no serialization).
- **`generate.golden.spec.test.ts`** — the ST-G1..G3 end-to-end goldens. ST-G2 (the gate
  `slice2Fixture`) currently renders `Main.main:` … `STA $D020` … `RTS`. **RD-07c's entry
  relabel changes this to `_main:`** — the RD-07b golden must be updated in lockstep (it is an
  RD-07b oracle, but D4 supersedes the label; recorded as an expected, traced change).

### RD-10 platform plugin (`@blend65/core` types + `@blend65/platforms` c64 — consume)

- **`@blend65/core/platform`** — `interface PlatformPlugin` with `profile`,
  `emitPreamble(options: PreambleOptions): StreamEntry[]`,
  `emitStartupShim(variant): StreamEntry[]`, `getOutputDirective`, `getMainTerminationPolicy`,
  `encodeString`/`encodeChar`, `validateProfile`. `PreambleOptions = { projectName;
  shimVariant; needsBssZero; needsDataInit }`. `PlatformProfile` carries `cpu` (the
  `CpuVariant`). **RD-07c imports the `PlatformPlugin` type from core** (no codegen→platforms
  production edge).
- **`@blend65/platforms` `c64Plugin`** — `emitPreamble({projectName:"main",
  shimVariant:"terminating", needsBssZero:false, needsDataInit:false})` produces (verified by
  ST-C64-2 via `printInstr`):

  ```
  !to "main.prg", cbm
  * = $0801
      !word $080B
      !word $000A
      !byte $9E
      !text "2061"
      !byte $00
      !word $0000
  __startup:
      LDA #$36
      STA $01
      JSR _main
      LDA #$37
      STA $01
      RTS
  ```

  `getMainTerminationPolicy()` → `{ canReturn: true }`. `profile.cpu` → `"nmos6502"`. This is
  the exact preamble RD-07c's `assembleProgram` will attach for the gate.

### The gate program (live, end-to-end)

`examples/gate/main.blend` = `module Main; function main(): void { poke(0xD020, 5); }`.
Its lowering fixture (`slice2Fixture`, used by ST-G2) currently produces, via
`generateInstr` → `printInstr`:

```
Main.main:
    LDA #$05
    STA __frame_Main_main_c
    LDA __frame_Main_main_c
    STA $D020
    RTS
```

## Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/codegen/src/instr/instr-program.ts` | program container + `generateInstr` | **Add** `assembleProgram(ilProgram, plugin, bag)`; `generateInstr` unchanged |
| `packages/codegen/src/instr/translate.ts` | per-function translation | **Make `sanitize()` real**; entry function → `_main` (D4) |
| `packages/codegen/src/index.ts` | barrel | **Export** `assembleProgram` |
| `packages/codegen/src/instr/generate.golden.spec.test.ts` | RD-07b goldens | **Update** ST-G2/G1/G3 labels (`Math.add`→`Math_add`, `Main.main`→`_main`, `Math.eq`→`Math_eq`) per D4 |
| `packages/codegen/package.json` | deps | **Add** `@blend65/platforms` as a **devDependency** (test-only) for the golden |
| `packages/codegen/tsconfig.json` | refs | **Add** a test-only project reference to `../platforms` if required by the golden import |

## Gaps Identified

### Gap 1: Empty preamble

**Current:** `generateInstr` returns `preamble: []` — no origin/`!to`/shim, output not assemblable.
**Required:** the program carries the plugin's preamble.
**Fix:** `assembleProgram` calls `plugin.emitPreamble(options)` and returns a program with the populated preamble (FR-1/FR-2).

### Gap 2: Entry label is the raw fqName

**Current:** entry stream labelled `Main.main` (illegal ACME; the shim's `JSR _main` would not resolve).
**Required:** entry function labelled `_main`; other functions sanitized `.`→`_`.
**Fix:** real `sanitize()` + entry special-casing in `translate.ts` (FR-6/FR-7, D4).

## Dependencies

### Internal

- `@blend65/codegen` RD-07b (`generateInstr`, `translateFunction`, `printInstr`, `InstrProgram`).
- `@blend65/core` — `PlatformPlugin`/`PreambleOptions` types, `DiagnosticBag`.
- `@blend65/platforms` — `c64Plugin` (test-only, for the end-to-end golden).

### External

- None.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Relabelling entry to `_main` breaks RD-07b goldens | High (expected) | Low | Update the three RD-07b goldens in lockstep; the change is traced to D4 and re-verified green |
| codegen→platforms production edge violates layering | Low | Med | `PlatformPlugin` type comes from `@blend65/core`; platforms is **test-only** (devDependency), no production import |
| R15/AR-20 boundary regression | Low | High | No frontend/language-server change; boundary tier (`test/boundary.spec.test.ts`) re-run at closeout |
| `sanitize` collision with `__`-prefixed compiler symbols | Low | Med | Sanitization only maps `.`→`_` on fqNames; `__`-prefixed symbols are generated separately and unaffected |

## Frozen `spec/`

`spec/` is the frozen v3.0 baseline (project decision D3). RD-07c reads RD-09 R15/R19 and
RD-10 §4.5/§4.6 (authored requirements, not frozen) for the `_main`/preamble convention but
**modifies nothing** under `spec/`; `git status --porcelain spec/` must stay empty.
