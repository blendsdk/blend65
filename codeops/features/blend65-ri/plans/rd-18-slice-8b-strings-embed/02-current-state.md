# Current State: RD-18 Slice 8b — Strings & Embed

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)
> Two-agent codebase reconnaissance, 2026-07-17 (lexer/AST/semantics + platforms/config/codegen).
> Line numbers are as-of the 8a completion commit (`b341d3e`).

## Existing Implementation

### Lexer — COMPLETE, Ch 01-conformant (nothing to change)

`packages/frontend/src/lexer/lexer.ts`: `"` → `scanString()` (:577-580), `'` → `scanChar()`
(:581-584). `validateEscape()` (:369-396) accepts exactly `\\ \" \' \n \r \t \0` + `\xNN`
(2-digit enforced). Escapes are **validated but not decoded** — `Token.value` holds raw
inter-quote text (:419-423, :453-457). Diagnostics live: E10217 newline-in-string (:415-418),
E10218 unterminated (:428), E10219 unknown escape (:394-395), E10220 short hex (:383-392),
E10221/E10222/E10223 char-literal errors (:463-473). Recovery always emits the token.

### AST + Parser — COMPLETE (nothing to change)

`packages/core/src/ast/nodes.ts`: `StringLitExprNode{raw}` (:424-428), `CharLitExprNode{raw}`
(:430-434), `EmbedExprNode{path, pathSpan, format: string|null, formatSpan}` (:466-473) — no
selector field; `format` is a plain identifier. Parser: literals at `pratt.ts:287-302`;
`embed` name-special-cased before the intrinsic path (:333-354); `parseEmbed` (:356-393)
accepts `embed("path" [, formatIdent])`, no content validation.

### Semantics — THE GAP (silent poison everywhere)

- `type-check/expression-typing.ts:153-156`: `StringLitExpr`/`CharLitExpr`/`EmbedExpr` hit the
  `default` arm → `ERROR_TYPE` with **no diagnostic**.
- `type-check/statement-typing.ts:881-894` `rejectStringArrayInit`: bare `StringLitExpr`
  initialiser on an array decl → **E90001 ICE** "string array initialisers are not supported
  yet…" (invoked :811 and the const path). **Escape hole (challenger-verified):** the bracketed
  form `["HELLO"; 0]` does NOT match (:886 checks the initialiser node only) and slips into
  silent poison / E10193 / codegen ICE.
- `const-eval.ts:153-195`: no arms for the three nodes → `{kind:"nonConst"}` (:192-193).
  `const-type-engine.ts` likewise. `const SPACE: byte = ' '` currently dies as E10193.
- Array machinery that 8b REUSES (all AST-pattern-matched): `typeArrayLit`
  (`expression-typing.ts:1176-1232` — element typing/spans, E10126 fill-unsized, inference
  :1223-1229), `checkArrayInitCoverage` (`statement-typing.ts:843-874` — W10140/W10141, runs
  BEFORE initializer typing at :808), `inferUnsizedArray` (:896-908), `buildConstImage`
  (`const-images.ts:40-45`; `writeArray` hard-requires `ArrayLitExpr` :82-88; scalars fold via
  `ctx.engine.evalExpr` :166), codegen `lowerAggregateInit` (`lower.ts:2013`, E90001 arm
  :2043-2052) and `lowerInitCode` module-let/zeropage AST re-walk (:258-270).

### Platform encoding — one encoder, two wrong stubs, zero callers

- Types (core): `CharEncoding = "petscii"|"atascii"|"ascii"` (`platform-profile.ts:34`);
  `defaultEncoding?`/`screenEncoding?` (:101/:103 — "absent ⇒ raw ASCII bytes"); plugin hooks
  `encodeString`/`encodeChar` (`platform-plugin.ts:145-159`).
- Profiles: c64/c64u/cx16 `petscii` (`c64.ts:66-67` etc.); a800xl `atascii` (`a800xl.ts:53-54`);
  a7800 `ascii` (`a7800.ts:59-60`).
- ONE implementation: algorithmic PETSCII (`platforms/shared-hooks.ts:30-58` — A-Z pass,
  a-z→+$60, `\n`→$0D, unconditional passthrough tail). **All five platforms delegate to it**,
  including a800xl (:91,:95) and a7800 (:98,:102) — wrong bytes for lowercase/`\n` there (AR-5).
- The hooks have **zero compile-path callers**; string literals reach no encoder anywhere.

### embed() backend — parsed, then nothing

- No typing/lowering/reading. E10200–E10204 defined with zero emit sites
  (`diagnostic-codes.ts:248-252`). `ConstDataEntry.type` pre-types an `"embed"` arm
  (`codegen/src/il/cfg.ts:64-71`) that nothing produces — `lower.ts:229` derives
  `struct?"struct":"array"` from the symbol type only.
- No config surface: `BlendConfig` (`config/src/types.ts:33-62`) has `projectRoot` but no
  asset/embed fields. Traversal-guard precedent: `codegen/src/runtime/embed.ts:97-111`
  (resolve + prefix containment — for runtime `.asm` modules, not user assets).
- `CompilerHost.readFile` returns `string|undefined` (utf8) — **unusable for binary assets**
  (challenger-verified corruption for bytes ≥ $80). `BuildDeps.readBinary` exists but only at
  the emit layer (`build.ts:32-45`).

### Const-data emission — COMPLETE, the reuse target

`buildConstImage` → `ctx.constValues.set(sym, {type, value:0, bytes})`
(`statement-typing.ts:322-331`) → `lower.ts:223-231` → `ILProgram.constData` → labeled `!byte`
rows, 16/row, `data` segment (`instr-program.ts:114-116,179-186`; `print-instr.ts:154-155`).
Labels: `__data_<Module>_<name>` (`lower.ts:1702-1706`). No `!bin`/`incbin` anywhere.

### Seam-relevant boundaries

- frontend deps: `@blend65/core` ONLY (no platforms, no codegen, no fs — grep-verified).
  ESLint `no-restricted-imports` is the authoritative R15 gate; `test/boundary.spec.test.ts`
  ST-R15a/b/c pin it.
- `analyze()` input already carries optional `targetProfile: CanonicalPlatformProfile`
  (`analyze.ts:60-77`), used today only for W10143 array-budget + intrinsic validation;
  `TypeCheckContext` has **no** platform access; typing reaches the const engine via
  `ctx.engine`.
- language-server: stub, deps core+frontend — the AR-6 core-residence decision exists for it.
- `run-frontend.ts` pipeline order: config → host → discover (sorted) → lex/parse per file →
  `analyze({programs, bag, profile: DEFAULT_PROFILE, registry, targetProfile: plugin.profile})`
  (:153-159) → SFA. File reads only via the host (:139).

## Gaps Identified (summary — designs in the 03 docs)

| # | Gap | Current | Required | Owner |
|---|-----|---------|----------|-------|
| G1 | No encoders for atascii/ascii; petscii platforms-resident | wrong stub delegation | three core encoders, hooks delegate | 03-01 (AR-5/6) |
| G2 | Escapes never decoded | raw text in AST | segment decoder (code points + raw bytes) | 03-01 (AR-7) |
| G3 | No encoder reachable from typing/const-eval | no ctx access | `CharEncoder` on `ConstTypeEngine` via `analyze()` | 03-01 (AR-6) |
| G4 | String/char literals silently poison | ERROR_TYPE, no diag | AST desugar + E10116/E10124/E10127/E10080 | 03-02 (AR-8/9) |
| G5 | Bracketed `["S"; f]` escapes the pin | silent poison | desugar covers; retirement matrix | 03-02 (AR-8) |
| G6 | embed() untyped/unread | poison | `AssetReader` seam, EMB-1..4, E10200/01/02/05 | 03-03 (AR-10/11/12) |
| G7 | No binary read path | utf8 host | `Uint8Array` reader at compiler layer | 03-03 (AR-12) |
| G8 | `"embed"` ConstData arm unreachable | type-derived tag | `ConstValue` provenance | 03-03 (AR-12/13) |
| G9 | RD-18 items 8–9 unticked | — | closure audit | 03-05 (AR-15) |

## Dependencies

- **Internal**: 8a's shipped surface (const images, `__data_*` emission, zeropage fields,
  by-ref const params for the fixture); the frozen `spec/` (D3); the retired-row protocol.
- **External**: VICE 3.10 + ACME locally for the acceptance tier (AR-27 precedent — CI skips
  emulator tests); a small committed binary asset `examples/slice8b/table.bin`.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Desugar splice breaks an existing array-init pin | Med | Med | Splice BEFORE :808 coverage; run the full 7a/7b suites per phase; goldens byte-exact gate |
| Encoder move (platforms→core) breaks platform unit tests | Med | Low | Hooks keep their exact API; platform tests keep passing through delegation |
| Binary-asset read portability (CRLF/utf8 corruption) | Low | High | `Uint8Array` contract (AR-12); byte-identity impl test on a ≥$80-byte fixture |
| Prior goldens drift (no program uses strings/embed) | Low | High | Additive-only emission; the eleven-golden regression task each phase |
| LS/compiler divergence on absent seams | Low | Med | AR-7/AR-12 pinned absent-injection semantics; documented in the seam contracts |
