# Testing Strategy: RD-10 Platform Plugin System

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

All ST-cases are derived from `01-requirements.md`, the `03-*` component specs, the frozen spec
(Ch 15 + appendices), and the ambiguity register (D1–D7) — **not** from running the
implementation. Golden ACME strings are derived from each hook's documented `StreamEntry`/
`AcmeDirective` output + the verified `printInstr` rendering rules (see 02-current-state and
03-02), never by executing the hook first (IMMUTABLE ORACLE RULE, testing.md Rule 10).

### Coverage Goals

- Unit (spec) tests for every public type, hook, and the registry/loader.
- Golden-snapshot tests for the C64 preamble + all three shim variants (via `printInstr`).
- The relocation (D7) is covered by **re-running the existing codegen `instr` tests** unchanged
  after the model move — they must stay green (no new oracle; the move is value-preserving).

## 🚨 Specification Test Cases (MANDATORY — derived from spec, not implementation)

### Phase 1 — Core types + model relocation (`@blend65/core`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|---------------------------|--------|
| ST-CP1 | Construct a `PlatformProfile` literal with all required fields | Type-checks; all required §3.1 fields present | FR-2 / R6–R10 |
| ST-CP2 | `validateProfileFields` on a consistent profile (c64 values) | returns `[]` | FR-12 / R22 |
| ST-CP3 | `validateProfileFields` on `{...c64, zpStart: 0x90, zpEnd: 0x02}` | returns non-empty; an entry has `field: "zpStart"` | FR-12 / R22 |
| ST-CP4 | `validateProfileFields` on `{...c64, codeStart: 0xD000, codeEnd: 0x0801}` | non-empty; entry `field: "codeStart"` | R22 |
| ST-CP5 | `validateProfileFields` on `{...c64, maxZp: 99}` (mismatch) | non-empty; entry `field: "maxZp"` | R22 |
| ST-CP6 | The canonical `CpuVariant` union | exactly `"nmos6502" \| "wdc65c02"` (assignment test) | FR-1 / D2 |
| ST-CP7 | `@blend65/core/platform` subpath resolves and exports `PlatformProfile`/`PlatformPlugin`/`CpuVariant` | imports succeed; root barrel still exports the interim `PlatformProfile` | FR-20 / D6 |
| ST-RELOC1 | Existing codegen `instr` spec/impl tests after the model move | **all remain green, unchanged** | D7 |
| ST-RELOC2 | `import { StreamEntry, AcmeDirective } from "@blend65/codegen"` (re-export) and from `@blend65/core/platform` | both resolve to the same types | D7 |

### Phase 2 — C64 plugin + hooks (`@blend65/platforms`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|---------------------------|--------|
| ST-C64-1 | `c64Plugin.getOutputDirective("main")` | `{ kind: "outputFile", name: "main.prg", format: "cbm" }` | FR-9 / AC-07 |
| ST-C64-2 | `printInstr({symbol:"_pre",segment:"code",entries: c64Plugin.emitPreamble({projectName:"main",shimVariant:"terminating",needsBssZero:false,needsDataInit:false})})` | the exact ACME text in 03-02 (`!to "main.prg", cbm` / `* = $0801` / the BASIC-stub directive lines / the `__startup:` terminating shim) | FR-7/FR-8 / AC-04/05 |
| ST-C64-3 | `emitPreamble` with `shimVariant:"non-terminating"` → `printInstr` | preamble head identical; shim ends `JMP _main` (no `RTS`/restore) | FR-8 / AC-05 |
| ST-C64-4 | `emitPreamble` with `shimVariant:"bare"` → `printInstr` | preamble head only; no `__startup:` label/shim lines | FR-8 / AC-05 |
| ST-C64-5 | `c64Plugin.encodeChar("A"/"a"/"0"/" "/"\n")` | `0x41 / 0xC1 / 0x30 / 0x20 / 0x0D` | FR-10 / AC-06 |
| ST-C64-6 | `c64Plugin.encodeString("Hi")` | `[0x48, 0xC9]` | FR-10 / AC-06 |
| ST-C64-7 | `c64Plugin.getMainTerminationPolicy()` | `{ canReturn: true }` | FR-11 / AC-08 |
| ST-C64-8 | `c64Plugin.validateProfile()` | `[]` (valid profile) | FR-12 / AC-09 |
| ST-C64-9 | `c64Plugin.profile` fields | match appendix-c64 (codeStart `0x0801`, zpEnd `0x8F`, maxZp `142`, outputFormat `"prg"`, cpu `"nmos6502"`, defaultEncoding `"petscii"`) | FR-6 / AC-03 |
| ST-C64-10 | `c64Plugin.intrinsics` / `runtimeModules` | `intrinsics === []`; `runtimeModules` lists `mul8/mul16/div8/div16` with `__rt_*` exports | FR-18 / R26 |

### Phase 3 — Registry + built-in profiles (`@blend65/platforms`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|---------------------------|--------|
| ST-REG1 | `loadPlatform("c64")` | returns `c64Plugin` (identity) | FR-14 / AC-10 |
| ST-REG2 | `loadPlatform("nope")` | throws `Error`; message contains `c64, c64u, cx16, a800xl, a7800` | FR-14 / AC-11 |
| ST-REG3 | `DEFAULT_PLATFORM` | `=== "c64"` | FR-15 / AC-10 |
| ST-REG4 | `PLATFORM_REGISTRY` keys | exactly `["c64","c64u","cx16","a800xl","a7800"]` | FR-13 / R28 |
| ST-PROF1 | `validateProfile()` for all 5 plugins | each returns `[]` (internally consistent) | FR-16 / AC-19 |
| ST-PROF2 | `cx16Plugin.profile.cpu` | `=== "wdc65c02"` | FR-16 / AC-14 |
| ST-PROF3 | `a7800Plugin.getMainTerminationPolicy().canReturn` | `=== false` | FR-16 / AC-15 |
| ST-PROF4 | `a7800Plugin.profile.outputFormat` | `=== "a78"` | FR-16 / R41 |
| ST-PROF5 | `a800xlPlugin.profile.defaultEncoding` | `=== "atascii"` | FR-16 / R40 |
| ST-PROF6 | `c64uPlugin.profile` present + consistent | constructible; `validateProfile() === []` | FR-16 / AC-13 |

> **⚠️ AUTHORING RULE:** ST-C64-2/3/4 golden strings are written from the directive/instr values
> in 03-02 + `printInstr`'s documented rendering, **before** `emitPreamble` exists. If an
> expected line cannot be derived from the spec/§4.5 sketch, it is an ambiguity → register a
> `D-N (runtime)` and resolve with the user before writing the case.

## Test Categories

### Specification Tests (written BEFORE implementation)

| Test File | ST Cases | Component |
| --------- | -------- | --------- |
| `core/src/platform/platform-profile.spec.test.ts` | ST-CP1..CP7 | profile/interface types |
| `codegen/src/instr/*.spec.test.ts` (existing, re-run) | ST-RELOC1/2 | model relocation (D7) |
| `platforms/src/c64.spec.test.ts` | ST-C64-1..10 | c64 plugin + hooks |
| `platforms/src/registry.spec.test.ts` | ST-REG1..4 | registry + loader |
| `platforms/src/profiles.spec.test.ts` | ST-PROF1..6 | built-in profiles |

### Implementation Tests (written AFTER implementation)

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `platforms/src/c64.impl.test.ts` | encode edge cases (empty string, non-ASCII pass-through), shim with `needsBssZero/needsDataInit` flags | Med |
| `core/src/platform/validate-profile.impl.test.ts` | multiple simultaneous validation errors; boundary `zpStart === zpEnd` | Med |

## Verification Checklist

- [ ] All ST-cases defined with concrete input/output pairs
- [ ] Every ST case traces to an FR/AC/spec/AR
- [ ] Spec tests written BEFORE implementation; verified RED first
- [ ] Goldens derived from spec + `printInstr` rules, not from running hooks
- [ ] All spec tests pass after implementation (GREEN)
- [ ] **The existing codegen `instr` tests stay green after the D7 relocation** (no edits)
- [ ] The interim `PlatformProfile` tests in `core/src/semantics/` stay green (D6)
- [ ] R15 boundary tier (`test/boundary.spec.test.ts`) stays green
- [ ] `git status --porcelain spec/` empty
- [ ] No dead code; no unused params (except spec'd-signature hooks)
