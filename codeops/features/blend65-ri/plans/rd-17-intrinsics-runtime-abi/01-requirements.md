# Requirements: RD-17 — Intrinsic Functions & Runtime-Routine ABI

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-17](../../requirements/RD-17-intrinsics-runtime-abi.md) (preflighted ✅ 2026-07-02)

## Feature Overview

Implement RD-17 in full (AR-P1): the four-tier intrinsic taxonomy (AR-28), the typed
descriptor registry (AR-29), the hybrid body strategy (AR-30/AR-100), the import
boundary + reserved names (AR-31/AR-97), CPU/platform conditioning (AR-32), the
runtime-routine ABI with call-site marshalling (AR-33/AR-98), ZP arg-block sizing
(AR-34), and the semantic-validation rules RD-04 deferred to this RD (PF-001:
RD-04 R95–R100, R19, R59).

## Functional Requirements

### Must Have

- [ ] `IntrinsicDescriptor` + `IntrinsicSignature` + `CostMetadata` + `TypeRef` types in `@blend65/core` per RD-17 §4.1, replacing BOTH shipped placeholders (RD-17 §4.1 migration note)
- [ ] `IntrinsicRegistry` (`register/get/isReserved/getAvailable/getAll`) + `createIntrinsicRegistry(platformDescriptors?)` (RD-17 §4.2, AR-P3); duplicate `register()` throws (AR-P9)
- [ ] Complete core catalog: 23 descriptors — 9 memory T2 + 13 CPU-control T1 + `asm_wai` (RD-17 §4.3, AC-01); internal T3 routine descriptors for `__rt_mul8/__rt_mul16/__rt_div8/__rt_div16` (AR-98)
- [ ] Diag codes `E10043 IntrinsicUnavailable`, `E10044 ZpArgBlockExceeded`, `E10045 NonConstantIntrinsicAddress`, `E10046 IntrinsicNotImported` with AR-P11/AR-P14 message formats
- [ ] `asm_wai` in `RESERVED_BUILTINS` (set grows 22→23); `WAI` in `W65C02_OPCODES` (RD-17 R2)
- [ ] Semantic validation pass (frontend): arg-count checks (E10040/E10041), literal-arg type/range checks (AR-P6), availability (E10043, R22), reserved-name shadowing (E10101, R20/R21), T4 import boundary (R19/AC-05/AC-06), W10120 (R40, AR-P12)
- [ ] Minimal declaration collection (structs/enums → `StructType`) sufficient for `sizeof`/`offsetof`/`length` folding (AR-P13, AC-09)
- [ ] Descriptor-driven IL lowering: T2 `peek/poke/peekw/pokew` → `load`/`store`; `lo/hi/sizeof/offsetof/length` → folds; T1 → `intrinsic` IL op; non-constant address → E10045 (AR-P5, R39)
- [ ] T1 Instr emission: exactly one opcode per T1 intrinsic (AC-07); T2 inline patterns (AC-08)
- [ ] Four `.asm` runtime modules in `packages/codegen/runtime/` per RD-17 §4.6 convention (AR-P8)
- [ ] Textual embedding of *referenced* modules into the single `.asm` output + dead-strip of unreferenced ones (AR-100, R15/R16, AC-11)
- [ ] ABI-correct call-site marshalling: byte ops a→A, b→X; word ops a→A/X, b→ZP arg bytes 0–1; div16 remainder in ZP arg bytes 0–1 (AR-33, AR-98, AR-P7, AC-10); ZP arg-block overflow → E10044 (R35)
- [ ] `%` consumes the div routine's remainder (no `__rt_mod*` symbols — AR-98)
- [ ] `PlatformPlugin.intrinsics` typed as `readonly IntrinsicDescriptor[]` (real type); plugin descriptors merged into the registry (R11, AC-16); T4 mechanism proven via a fixture plugin (AR-P2)
- [ ] `validateProfile()` enforces `zpArgBlockSize >= 4` (R34, AC-12); interim `zpArgBlockMin` default 0→4 (AR-P10)
- [ ] Platform `runtimeModules` stubs (mul8/mul16/div8/div16 × 5 plugins) migrate to codegen-owned T3 modules (AR-98)
- [ ] End-to-end: a program using `*`/`/`/`%` on byte and word operands assembles with no unresolved symbols (AC-19)

### Should Have

- [ ] Hover-oriented `description` strings on every descriptor (feeds RD-14 R23)
- [ ] Cost metadata per Ch 12 figures with the fuller-accounting note (PF-005)

### Won't Have (Out of Scope)

- End-user `extern function` (FUT-011, AR-36)
- Non-constant T2 addresses beyond the E10045 diagnostic (R39, AR-101)
- Full expression type inference (RD-04b — literal args only, AR-P6)
- Emulator-tier functional verification of routine math (RD-12 — AC-14 deferred, AR-P4)
- W10121 `asm_brk`-in-release (needs build modes — RD-16, AR-P12)
- Real T4 intrinsic content (petscii etc. — undesigned; fixture only, AR-P2)
- `compile()`/`build()` orchestration (RD-15 — registry threading via parameters, AR-P3)
- **Signed `*` / `/` / `%` runtime routines** (AR-P16, PF-022): frozen spec Ch 04 §3.2
  defines signed division ("truncated toward zero — for both signed and unsigned
  operands"), but RD-17's four routines are unsigned-only per the RD §4.3 internal
  table (two's-complement multiply is width-safe; division is not). `__rt_sdiv*` /
  signed semantics are explicitly deferred to a future arithmetic slice — this RD's
  AC-19 covers unsigned `byte`/`word` operands only.

## Technical Requirements

### Performance
- Registry lookups are `Map`-backed O(1); catalog construction happens once per compile invocation. No measurable compile-time budget concern at this scale.

### Compatibility
- R15 boundary preserved: frontend/language-server never import codegen; the catalog and registry live in core (AR-P3).
- RD-09 R4 single-file `.asm` output preserved (AR-100).
- NodeNext ESM; `.asm` assets read via `import.meta.url` so paths resolve from `dist/` (AR-P8).

### Security
- Runtime-module paths come only from compiled-in plugin/catalog data (never user input); `embed.ts` resolves them against the owning package root and rejects escapes (canonicalize; no `..` traversal past the package root).
- All user-facing inputs (source programs) reach this feature through the lexer/parser; the validation pass emits diagnostics, never throws, and never interpolates unsanitized source text into file paths or shell commands.

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|--------------------|--------|-----------|--------|
| Plan coverage | Full / slice | Full RD-17 | ACs interdependent | AR-P1 |
| T4 content | Fixture / real intrinsic | Fixture only | No designed T4 semantics | AR-P2 |
| Registry threading | Param / singleton | Parameter injection | Testability, R15 | AR-P3 |
| Routine verification | Assemble-level / mini-emulator | Assemble-level; math → RD-12 | RD boundaries | AR-P4 |
| E10045 site | Lowering / semantic | Codegen lowering | Const-ness decided there | AR-P5 |
| Type-check depth | Literal-only / full inference | Literal-only | RD-04b owns inference | AR-P6 |
| Word marshalling | A/X + ZP | a→A/X, b→ZP; remainder overwrites b | Only viable layout | AR-P7 |
| Layout & names | (proposal) | `core/src/intrinsics/`, `codegen/runtime/` | Convention fit | AR-P8 |
| Duplicate register | Throw / last-wins | Throw | Setup bug, not user error | AR-P9 |
| `zpArgBlockMin` | Raise / retire | Raise 0→4 | Minimal change | AR-P10 |
| Message formats | (proposal) | AR-P11 formats | Actionable (L6/L7) | AR-P11 |
| W10121 | Now / defer | Defer to RD-16 | No build modes exist | AR-P12 |
| sizeof folding | Minimal pass / primitives-only | Minimal decl-collection | AC-09 needs structs | AR-P13 |
| T4 boundary codes | E10043+new E10046 / E10043 for both | E10043 (wrong platform) + E10046 (unimported) | Distinct actionable codes; AC-05/06 distinguishable | AR-P14 |

> **Traceability:** every scope decision references the Ambiguity Register entry that
> resolved it (`00-ambiguity-register.md`); RD-level decisions cite RD-17 R-numbers and
> the global AR-NN entries.

## Acceptance Criteria

RD-17 §6 AC-01..AC-19 apply verbatim, with two dispositions decided at the gate:

1. [ ] AC-01..AC-13, AC-15..AC-19 — verified by this plan's test tiers (see 07-testing-strategy.md)
2. [x] **AC-14 — DISCHARGED by RD-12** (emulator tier; AR-P4). RD-12's `runtime-routines.spec.test.ts` (ST-30..33) verifies `__rt_mul8/div8/mul16/div16` on real VICE 3.10 (edge crosses + 25 seeded vectors/routine, AR-H5) — green 2026-07-03. The interim in-process interpreter (AR-P17) retains the exhaustive 500-sample coverage.
3. [ ] Full verify passes (`yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`)
