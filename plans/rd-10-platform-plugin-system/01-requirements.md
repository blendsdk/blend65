# Requirements: RD-10 Platform Plugin System

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-10](../../requirements/RD-10-platform-plugin-system.md) · frozen spec Ch 15 + appendix-{c64,c64u,cx16,a800xl,a7800}

## Feature Overview

The platform plugin system lets the Blend65 compiler target multiple 6502 platforms with
**no platform assumptions in core** (Language Guard P3). Each platform is a **plugin** =
profile *data* (Ch 15 §3 fields) + behavior *hooks* (codegen-strategy callbacks, AR-18). This
plan implements the data types, the plugin interface, the full `c64` plugin (MVP), the static
registry + loader, and profile data + validation for the four remaining built-in platforms —
all **end-to-end verifiable today** because the codegen hooks emit `StreamEntry[]` that the
shipped RD-07a `printInstr` serializer renders to deterministic, golden-snapshottable ACME text.

## Functional Requirements

### Must Have (in scope — RD-10 R-IDs in parentheses)

- [ ] **FR-1** Canonical `CpuVariant = "nmos6502" | "wdc65c02"` defined in `@blend65/core`, exported from the `@blend65/core/platform` subpath barrel; `@blend65/codegen` re-exports it (R10; AR per D2/D6).
- [ ] **FR-2** `PlatformProfile` data type with all Ch 15 §3.1 required fields — memory map (`codeStart`/`codeEnd`/`dataStart`/`dataEnd`/`ramStart`/`ramEnd`/`zpStart`/`zpEnd`/`stackReserve`), budgets (`maxBinarySize`/`maxRam`/`maxZp`/`stackBudget`), output (`outputFormat`/`loadAddress`), `cpu`, and `zpArgBlockSize`; plus optional §3.2 fields (`defaultEncoding`/`screenEncoding`/`embedFormats`/`warnFrameSize`/`warnArraySize`/`clockMhz`/`cyclesPerFrame`) (R6–R15).
- [ ] **FR-3** `OutputFormat = "prg" | "bin" | "rom" | "xex" | "a78"` and `CharEncoding = "petscii" | "atascii" | "ascii"` (R9, R11).
- [ ] **FR-4** `PlatformPlugin` interface with `id`, `displayName`, `profile`, `intrinsics`, `runtimeModules`, and the codegen-hook methods (R1–R3, R16–R22).
- [ ] **FR-5** Hook types: `PreambleOptions`, `ShimVariant`, `MainTerminationPolicy`, `RuntimeModule`, `ValidationError` (R16–R22, §4.3).
- [ ] **FR-6** `c64` plugin: complete profile data from appendix-c64 (R37) — `codeStart: $0801`, `zp: $02–$8F`, `maxBinarySize: 26623`, `outputFormat: "prg"`, `cpu: "nmos6502"`, `defaultEncoding: "petscii"` (R37).
- [ ] **FR-7** `c64.emitPreamble(options)` → `!to` directive + `* = $0801` origin + BASIC stub (`10 SYS 2061`) + startup shim, as `StreamEntry[]` (R16, AR-64).
- [ ] **FR-8** `c64.emitStartupShim(variant)` → all three variants `terminating` / `non-terminating` / `bare` per §4.6 (R17, AR-69).
- [ ] **FR-9** `c64.getOutputDirective(name)` → `{ kind: "outputFile", name: "<name>.prg", format: "cbm" }` (R18, AR-65).
- [ ] **FR-10** `c64.encodeString(text)` / `encodeChar(char)` → PETSCII MVP subset (D3): A–Z `$41–$5A`, a–z `+$60`, 0–9/space ASCII, `\n`→`$0D`, pass-through (R19/R20).
- [ ] **FR-11** `c64.getMainTerminationPolicy()` → `{ canReturn: true }` (R21, AR-69).
- [ ] **FR-12** `c64.validateProfile()` → `ValidationError[]`; catches `zpStart > zpEnd`, `codeStart >= codeEnd`, `maxZp != zpEnd − zpStart + 1` (R22, R31).
- [ ] **FR-13** `PLATFORM_REGISTRY: ReadonlyMap<string, PlatformPlugin>` mapping the five IDs to plugin instances (R28).
- [ ] **FR-14** `loadPlatform(id)` returns the plugin or throws an actionable error listing the available IDs (R29).
- [ ] **FR-15** `DEFAULT_PLATFORM = "c64"` (R33).
- [ ] **FR-16** Profile data + `validateProfile` + registry entries for `c64u` (R38), `cx16` (`cpu: "wdc65c02"`, R36/R39), `a800xl` (R40), `a7800` (`outputFormat: "a78"`, `getMainTerminationPolicy().canReturn === false`, R41/AC-15).
- [ ] **FR-17** Non-MVP plugins reuse the c64 hook implementations as the shared default behavior in this slice (D4); each declares its own profile + termination policy.
- [ ] **FR-18** Plugins ship `intrinsics: []` (RD-17 seam) and `runtimeModules: RuntimeModule[]` *metadata* (name/asmPath/exports) for the c64 `__rt_mul8/mul16/div8/div16` modules (R26 metadata only; bodies deferred).
- [ ] **FR-19** No platform-specific address, chip name, or encoding leaks into core compiler packages (P3, R4, AC-18) — enforced by keeping all such data inside `@blend65/platforms` plugin modules.
- [ ] **FR-20** `@blend65/core/platform` subpath export added to `packages/core/package.json` `exports` (D6 mechanical consequence).

### Should Have

- [ ] **FR-21** A shared `validateProfileFields(profile)` helper in core that all five plugins' `validateProfile()` delegate to (avoids per-plugin duplication; R22).

### Won't Have (Out of Scope — deferred)

- **T4 intrinsic descriptors** (R23–R25) — `IntrinsicDescriptor` is RD-17's type. Plugins ship `intrinsics: []`. **→ RD-17**
- **Runtime `.asm` routine bodies** (R26–R27) — the hand-written ACME modules. Only `runtimeModules` metadata is declared. **→ RD-17/AR-30**
- **`--platform` CLI flag** — **→ RD-15**
- **`blend65.json` `"platform"` selection** — **→ RD-16**
- **ACME serialization of the preamble + post-ACME binary-size check** — RD-10 produces `StreamEntry[]`, golden-tested via `printInstr`; the emitter/assembler is **→ RD-09**
- **Emulator configuration from the profile** — **→ RD-12**
- **Reconciling/replacing the interim `PlatformProfile` stub + wiring profiles into RD-04/RD-05 passes** — **→ deferred migration (D6)**; RD-10 adds the canonical type, never breaks the interim.
- **Bespoke non-MVP hook bodies** — ATASCII encoding, `.a78` cartridge header, CX16 banked-RAM startup (D4).

## Technical Requirements

### Compatibility

- The canonical `CpuVariant` value is `"wdc65c02"` (not the spec's prose `"65c02"`), matching shipped RD-07a codegen (D2). Zero change to RD-07a/07b code values.
- The interim `PlatformProfile` (`core/src/semantics/platform-profile.ts`) and its root-barrel export remain byte-for-byte unchanged (D6). `git`-visible churn to `frontend`/`sfa` is zero.
- All artifacts honor the AR-20 boundary: types in `@blend65/core`, plugin implementations in `@blend65/platforms` (which already depends only on core). No new package edges. `frontend`/`language-server` never import `@blend65/codegen` (R15 boundary unaffected).

### Performance

- Profiles are compile-time-constant records; `loadPlatform` is a `Map.get`. No runtime cost concerns.

## Scope Decisions

| Decision   | Options Considered | Chosen | Rationale | AR Ref |
| ---------- | ------------------ | ------ | --------- | ------ |
| Build strategy | slice / full / RD-17-first | slice | Build what's verifiable today; defer RD-17/15/16/09-coupled parts | D1 |
| `CpuVariant` spelling | keep `"wdc65c02"` / adopt `"65c02"` / two types | keep `"wdc65c02"` in core | No churn to shipped, tested codegen | D2 |
| PETSCII depth | MVP subset / full table | MVP subset | Satisfies AC-06; non-breaking to extend | D3 |
| Non-MVP depth | profiles+validation / full bespoke | profiles+validation+registry | No consumer to verify bespoke hooks yet | D4 |
| Commit mode | ask / no-commit / auto | no-commit | Consistent with all prior RD plans | D5 |
| Interim profile | new type / superset-replace / split-migrate | new type, subpath barrel, stub untouched | No-rework; additive | D6 |

> **Traceability:** Every decision references the Ambiguity Register (`00-ambiguity-register.md`).

## Acceptance Criteria

Mapped to RD-10's AC list (the deferred ACs are carried by RD-17/15/16/09):

1. [ ] **AC-01** `PlatformPlugin` interface defined in `@blend65/core` with all required methods + properties.
2. [ ] **AC-02** `PlatformProfile` includes all Ch 15 §3.1 required fields.
3. [ ] **AC-03** `c64` plugin implemented with all appendix-c64 profile values.
4. [ ] **AC-04** `emitPreamble()` produces a valid BASIC stub + startup shim for C64 (golden-verified via `printInstr`).
5. [ ] **AC-05** All three startup-shim variants implemented for C64.
6. [ ] **AC-06** `encodeString()` correctly encodes PETSCII (A–Z, a–z, 0–9, space, newline).
7. [ ] **AC-07** `getOutputDirective()` produces `!to "<name>.prg", cbm` for C64.
8. [ ] **AC-08** `getMainTerminationPolicy()` returns `canReturn: true` for C64.
9. [ ] **AC-09** `validateProfile()` catches inconsistent profile fields (e.g. `zpStart > zpEnd`).
10. [ ] **AC-10** The registry maps platform IDs to plugin instances.
11. [ ] **AC-11** Unknown platform ID → actionable error listing available platforms.
12. [ ] **AC-12** CPU variant from the profile is the same `CpuVariant` RD-07 uses for opcode validation (shared canonical type, D2).
13. [ ] **AC-13** `c64u` profile present (extends C64 base values).
14. [ ] **AC-14** `cx16` sets `cpu: "wdc65c02"`.
15. [ ] **AC-15** `a7800` sets `canReturn: false`.
16. [ ] **AC-19** Unit tests validate profile data for all 5 built-in platforms.
17. [ ] **AC-20** All decisions trace to an `AR-NN`/`D-N` or a frozen spec section.
18. [ ] **AC-18** No platform-specific address/chip/encoding appears in core compiler code (P3).
19. [ ] Deferred (RD-17): AC-16 (intrinsic merge), AC-17 (`.asm` JSR-link/dead-strip) — `intrinsics: []` + `runtimeModules` metadata seam present.
20. [ ] All verification passing; the interim stub + RD-04/RD-05 tests remain green (D6).
