# Init Codegen — `initCode`, `__init` & Startup Wiring: RD-18 Slice 5b

> **Document**: 03-03-init-codegen.md
> **Parent**: [Index](00-index.md)
> Governs: `packages/codegen/src/il/` (lower, cfg, print-il), `packages/codegen/src/
> instr/` (instr-program), `packages/core/src/platform/platform-plugin.ts`,
> `packages/platforms/src/` (shared-hooks + the five plugins).
> Decisions: AR-8, AR-12 (+ AR-7 inlining consumed from 03-02 §3).

## 1. IL production — populate the seam (lower.ts)

After the existing functions loop, when `model.initOrder` is non-empty:

1. **Initializer lookup:** Pass 3's `typeModuleLet` records `symbolMap.set(item,
   sym)` for each top-level `LetDecl` (03-02 §1) — lowering walks the programs'
   top-level `LetDecl`s with initialisers and builds `Map<Symbol, ExprNode>` via
   `model.symbolOf(item)`; emission then follows `model.initOrder` exactly.
2. **Builder:** one `IlFunctionBuilder("__init", [], "void", false)`. Per symbol in
   `initOrder`: `value = lowerExpr(init, ctx)` → `store` to
   `loc(moduleVarSymbol(moduleName, varName), ilTypeOfType(sym.type))` (the same
   helpers `lowerAssign` uses; `moduleName` from `sym.scope.node`). `finish({kind:
   "ret"})`.
3. **Init lowering context:** the `LowerCtx` carries a `moduleInit: true` flag —
   in this context a `lowerIdent`/`lowerFieldAccess` miss on the module-var/const
   paths is an ICE (never the frame-slot fallback: there is no frame; typing
   guarantees only module vars/consts appear, the guard is defense-in-depth against
   the byte-defaulting `slotIlType` hole).
4. **`ILProgram` shape:** `initCode` = the builder's blocks; NEW additive field
   `readonly initTempCount: number` (the builder's temp count; `0` when empty) —
   `BasicBlock[]` alone loses the temp count the translator's prescan needs.
   Initializer-free programs keep `initCode: []`/`initTempCount: 0` — the frozen
   `Object.freeze([])` producer becomes conditional. Mechanical sweep: every test
   literal constructing an `ILProgram` gains `initTempCount: 0` (the 5a `dataBase`
   sweep precedent); `lower.spec.test.ts:127`'s empty pin narrows to the
   initializer-free case.
5. **`printIL`:** additive `__init` section when `initCode` is non-empty (existing
   output byte-identical when empty).
6. **Optimizer:** untouched — identity passthrough already preserves `initCode`.

## 2. Instr consumption — the `__init` stream (instr-program.ts)

`generateInstr`, when `ilProgram.initCode.length > 0`:

```ts
const initFn: ILFunction = {
  name: "__init", params: [], returnType: "void",
  blocks: ilProgram.initCode, tempCount: ilProgram.initTempCount,
  isInterrupt: false,
};
// translate with the existing FunctionTranslator + validateStream, then
// UNSHIFT the stream — __init serializes FIRST, before _main (AR-8).
```

- `sanitize("__init")` is identity (no dot; `__` reserved for compiler labels —
  collision-free by construction); `isEntryFunction` is false → label `__init:`;
  the `ret` terminator emits `RTS`. Word initializer stores ride the existing
  `translateConst` (`LDA #lo/LDX #hi`) + `translateStore` (`STA`/`STX sym+1`) paths.
  `sanitize`'s doc comment ("the `__` prefix … is never produced here") goes stale
  once `__init` flows through it — update that comment in plain language (the
  reservation intent is preserved: `__init` IS a compiler-generated symbol).
- `derivePreambleOptions` gains `hasInitCode: ilProgram.initCode.length > 0`.
  `needsDataInit` is NOT touched (AR-8 amendment — it belongs to the future
  constData slice).
- **Runtime-routine collection must include the `__init` stream**: an initializer
  like `SCALE * 2` emits `JSR __rt_mul8` inside `__init`; whatever mechanism selects
  the embedded `runtime/*.asm` routines (the RD-17 embed scan) must see the unshifted
  init stream exactly like function streams — verify at RED phase (the fixture's
  `scaled` initializer witnesses it end-to-end).

## 3. Startup wiring — shared shim + five plugins (AR-8, AR-12)

- `PreambleOptions` (core, platform-plugin.ts) gains additive
  `hasInitCode?: boolean`.
- `c64StyleStartupShim(variant, hasInitCode = false)` (shared-hooks.ts) — the
  second parameter is optional-with-default so the five plugins' standalone
  `emitStartupShim(variant)` delegations stay valid; `PlatformPlugin.
  emitStartupShim` gains the same optional parameter and the five delegations
  thread it through (the live pipeline consumes only `emitPreamble`, but the
  public shim seam must be able to express init):

| Variant | Emission with initializers | Without |
|---------|---------------------------|---------|
| `terminating` | `__startup: LDA #$36 / STA $01 / JSR __init / JSR _main / LDA #$37 / STA $01 / RTS` | unchanged (no `JSR __init`) |
| `non-terminating` | banking + `JSR __init` + `JMP _main` | unchanged |
| `bare` | NOTHING (unchanged) — **AR-12**: the user owns the entire entry sequence; the `__init` label is present in the emitted ASM to `JSR` exactly as they own calling `_main`. Stated in the shim's and the build API's doc comments (plain language). | unchanged |

- `c64StylePreamble` threads the flag; each of the five plugins passes
  `options.hasInitCode ?? false` through its `emitPreamble` delegation.
- `JSR __init` sits AFTER banking (`LDA #$36/STA $01`) so initializers run in the
  same memory configuration as `main`.

## 4. Golden impact (AR-8 conditional emission)

Initializer-free programs emit a byte-identical stream — the six existing goldens
(gate, slice3a/3b/4a/4b, slice5a) and both compiler-level assemble goldens stay
byte-exact with NO re-mint (regression ST-29). Only the new slice5b golden is minted.

## Error Handling

| Error Case | Handling | AR Ref |
|------------|----------|--------|
| Frame-path reference inside `__init` lowering | ICE (defense vs the byte-default hole) | AR-8 / AR-7 |
| Poisoned model (E10194/E10193/ICE upstream) | never reaches lowering — 5a `hasErrors` driver gate | AR-5 |
| `bare` startup + initializers | documented user-owned; no diagnostic | AR-12 |
| Init temp spill beyond register/`__zp_tmp` shapes | if a spike shows this, STOP → back to the user (the seam agreement is binding) | AR-8 note |

## Testing Requirements

Spec: ST-19…ST-23 (07-testing-strategy). Impl: `initTempCount` propagation, printIL
`__init` section, empty-`initCode` byte-identity at the instr layer, per-plugin
preamble pass-through, word-store shape inside `__init`.
