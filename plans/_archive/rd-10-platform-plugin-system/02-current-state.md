# Current State: RD-10 Platform Plugin System

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)
> **Purpose**: The as-built code RD-10 builds **on** and **around**, and the gaps the slice
> (D1/D6) addresses. Everything here was read from the live tree on 2026-06-09.

## What RD-10 builds ON (the stable foundation)

### `@blend65/platforms` — the package to fill (currently a stub)

`packages/platforms/src/` contains exactly two files:

- **`index.ts`** — one line: `export const VERSION = "0.1.0";`
- **`index.spec.test.ts`** — a smoke test asserting `VERSION === "0.1.0"`.

`package.json` (`@blend65/platforms`, private, ESM): `main`/`types` → `dist/index.*`; `exports`
maps `"."`; **dependencies: only `@blend65/core@0.1.0`**. `tsconfig.json` extends the base,
`rootDir: "src"`, `references: [{ path: "../core" }]`. The package edge `platforms → core` is
exactly the AR-20 placement RD-10 R2/R3 require — RD-10's plugin implementations land here and
import the interface/types from core. No new dependency is introduced.

### RD-07a `instr/` model — the hook output target (consume read-only)

The codegen hooks (`emitPreamble`/`emitStartupShim`/`getOutputDirective`) emit RD-07a's
`StreamEntry[]`, and the goldens serialize them via `printInstr`. Relevant exports from
`packages/codegen/src/instr/`:

- **`stream.ts`** — `export type CpuVariant = "nmos6502" | "wdc65c02";` (**the type D2/D6
  promote to core**); `type AcmeDirective` (the union with `origin`/`symbolDef`/`byte`/`word`/
  `text`/`fill`/`outputFile`); `type StreamEntry` (`instr | label | directive`);
  `interface InstrStream { symbol; segment: "code"|"data"|"zp"; entries }`; constructors
  `instr(...)`, `label(name)`, `directive(d)`; guards `isInstr`/`isLabel`/`isDirective`.
- **`print-instr.ts`** — `printInstr(stream): string` (deterministic ACME text — the golden
  surface) and `instrByteSize(entry): number`. Directive rendering (verified from source):
  - `origin` → `* = $0801` (column 0)
  - `outputFile` → `!to "name.prg", cbm` (column 0)
  - `symbolDef` → `name = $XXXX` (column 0)
  - `byte` → `    !byte $0B, $08` (indented; 2-digit hex, masked to 8 bits)
  - `word` → `    !word $080B` (indented; 4-digit hex, masked to 16 bits)
  - `text` → `    !text "2061"` (indented)
  - `fill` → `    !fill 256, $00` (indented)
  - labels → `name:` at column 0; instructions → `    OPCODE operand`.

> **Key consequence:** the C64 `emitPreamble` can be built **entirely** from existing
> `AcmeDirective` kinds (`outputFile`, `origin`, `byte`, `word`) plus `instr`/`label` entries
> for the startup shim, and the result is a golden-snapshottable string today. No new model
> additions to RD-07a are required.

### RD-07a `CpuVariant` consumers (the D2 re-export targets)

`CpuVariant` is imported by `stream.ts` (defn), `validate.ts` (`isLegalMode`/`validateStream`),
`cpu-table.ts` (`cpuTableFor` → `cpuVariant === "wdc65c02" ? W65C02_TABLE : NMOS_6502_TABLE`),
`instr-program.ts` (`generateInstr` arg), `translate.ts` (`translateFunction` arg), and the
`instr/index.ts` barrel re-export. **Under D2/D6, `stream.ts` changes from *defining*
`CpuVariant` to *re-exporting* it from `@blend65/core/platform`** — a one-line change with no
value change, so every keyed comparison (`"wdc65c02"`, `"nmos6502"`) and all those consumers
keep working unchanged.

## What RD-10 builds AROUND (the interim profile — leave untouched, D6)

`packages/core/src/semantics/platform-profile.ts` defines the **interim** `PlatformProfile`
(RD-04 D4 + RD-05 D2) and `DEFAULT_PROFILE`. Its fields are a *different shape* from RD-10's
Ch 15 profile:

- Identity/encoding: `name` (not `id`), `charEncoding` (not `defaultEncoding`).
- Memory/budget: `ramStart`, `ramEnd` (exclusive), `zpStart`, `zpEnd` (inclusive),
  `stackBudget`, `zpArgBlockMin` (not `zpArgBlockSize`).
- **Planner-tuning fields with no Ch 15 equivalent:** `mainTempBytes`, `irqTempBytes`,
  `zpWarnThreshold`, `ramWarnThreshold`, `stackWarnThreshold`.

It is consumed by shipped, **passing** code:

| Consumer | File |
| -------- | ---- |
| RD-04 passthrough analyzer | `packages/frontend/src/semantics/analyze.ts` (`readonly profile: PlatformProfile`) |
| RD-05 ZP allocator | `packages/frontend/src/sfa/zp-allocator.ts` |
| RD-05 stack analysis | `packages/frontend/src/sfa/stack-analysis.ts` |
| RD-05 budgets | `packages/frontend/src/sfa/budgets.ts` |
| RD-05 plan allocation | `packages/frontend/src/sfa/plan-allocation.ts` |
| RD-05 test fixture (`C64_FIXTURE_PROFILE`) | `packages/frontend/src/sfa/test-fixtures.ts` |
| Spec tests | `core/src/semantics/platform-profile.spec.test.ts`, `core/src/sfa/records.spec.test.ts` |

Exported from the **root** barrel via `core/src/semantics/index.ts`
(`export type { PlatformProfile }; export { DEFAULT_PROFILE }`).

> **D6 resolution:** RD-10 does **not** touch this file or its root-barrel export. The
> canonical RD-10 `PlatformProfile` is a **new** type under `core/src/platform/`, exported from
> a **new `@blend65/core/platform` subpath barrel**. The two coexist; migration (folding the
> SFA tuning fields into a companion and switching the root barrel) is deferred to when RD-05's
> profile consumption is actually wired. This keeps every shipped RD-04/RD-05 test green.

## Core diagnostics & spans (consume read-only)

- `SourceSpan` (used by `StreamEntry.instr.sourceSpan`) — already imported by `stream.ts`.
- RD-10 needs no `DiagnosticBag`: `validateProfile()` returns `ValidationError[]` (a plain data
  array, R22), and `loadPlatform` throws a plain `Error` (R29) — neither is a compiler
  diagnostic. (Wiring profile-validation errors into the diagnostics engine is RD-15/RD-16's
  job at the driver boundary.)

## The gaps that scope RD-10 (why it is a slice)

| Dependency | Status | Effect on RD-10 |
| ---------- | ------ | --------------- |
| RD-17 `IntrinsicDescriptor` + ABI | **Absent** | Plugins ship `intrinsics: []`; `runtimeModules` declared as metadata only (D1) |
| RD-09 ACME emitter | **Absent** | Hooks emit `StreamEntry[]`; goldens verify via `printInstr` (no assembler/binary check) |
| RD-15 CLI / RD-16 config | **Absent** | `loadPlatform`/`DEFAULT_PLATFORM` exist; the `--platform`/`blend65.json` wiring is theirs |
| RD-05 profile consumption | **Interim stub in use** | New canonical type added alongside; migration deferred (D6) |

## R15 / AR-20 boundary (inherited unchanged)

RD-10 adds types to `@blend65/core` and implementations to `@blend65/platforms` (which depends
only on core). No package gains an edge to `@blend65/codegen`; `frontend`/`language-server`
still never import codegen (R15/AR-20, spec-tested by `test/boundary.spec.test.ts`). The
codegen→core edge already exists (codegen depends on core), so re-exporting `CpuVariant` from
`@blend65/core/platform` introduces no new edge.

## Frozen `spec/`

`spec/` is the frozen v3.0 baseline (project decision D3). RD-10 reads Ch 15 + the five
platform appendices for the profile field set and concrete platform values but **modifies
nothing** under `spec/`; `git status --porcelain spec/` must stay empty.
