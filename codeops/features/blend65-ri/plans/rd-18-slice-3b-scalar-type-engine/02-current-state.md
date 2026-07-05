# Current State: RD-18 Slice 3b — Scalar Type Engine

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)
> **Basis**: three parallel codebase-recon agents (2026-07-05), all cites verified against source.

## Summary — where the work is

| Stage | State for Slice 3b |
|-------|--------------------|
| **Semantic analysis (type engine)** | **The bulk of the build.** No expression/literal typing; `isAssignableTo`/`commonType` are stubs; `typeMap`/`symbolMap` empty; top-level vars collected nowhere. |
| **Module-var allocation (SFA)** | Infrastructure **exists + unit-tested**; only the *feed* is missing (`run-frontend.ts:158` = `moduleVars: []`). A projection + wire. |
| **Width-aware lowering (codegen)** | One gap: literals hardcode `IL_BYTE`. Thread `typeMap` into lowering + add module-var read/write path. |
| **IL→Instr, ACME, VICE** | **Unchanged, consumed.** Same-type `+ - * / %`, `__rt_*`, `poke(w)` all present. |

## 1. Frontend semantics (`packages/frontend/src/semantics/`)

`analyze()` (`analyze.ts:70`) orchestrates: `createEmptyModel()` → `collectDeclarations` (structs/enums)
→ `collectFunctions` (Slice 3a: module+function scopes, function `Symbol`s with **`type=ERROR_TYPE`**,
body-local `let`s, `mainFunction`) → `checkBodies` (intrinsic validation only) → assemble model →
`resolveTypes`/`postCheck` (**no-ops**, `passes.ts:42,83`). `symbolMap`/`typeMap` stay the empty maps
(comment `analyze.ts:90–91`: "Slice 3b populates them"); `typeOf`→`ERROR_TYPE`, `symbolOf`→`null`.

**Exists (real):** structural type helpers `isInteger`/`isSigned`/`isUnsigned`/`bitWidth`/`byteSize`/
`typeName` (`core/src/semantics/type-utils.ts`); the descriptor-driven intrinsic validator
(`intrinsic-validation.ts` — peek/poke/pokew/peekw descriptors in `core/src/intrinsics/catalog.ts:93–129`);
`function-collection.ts` (Slice 3a) building module/function scopes + body-local vars.

**Stub / no-op / missing (the Slice-3b build):**
- `isAssignableTo(_s,_t) → true` (`type-utils.ts:165–167`); `commonType(_a,_b) → null` (`:182–184`). Replace.
- `resolveTypes` (Pass 2) + `postCheck` (Pass 4): empty (`passes.ts:42–44, 83–85`). Build Pass 4 (`main()`);
  Pass 2 struct/enum sizing is **not** needed for scalars (skip for 3b).
- **No expression/literal typing anywhere** (grep for `inferType`/`typeOfExpr` → nothing). Build it; populate `typeMap`.
- **No top-level `let`/`const` collection** — `declaration-collection.ts` handles only Struct/Enum;
  `function-collection.ts` only Function/Interrupt + body-local `let`. Build module-var collection.
- `function-collection.ts` sets `type=ERROR_TYPE` on function symbols (fine for 3b — nothing reads it yet).

**AST:** `LetDeclNode`/`ConstDeclNode` (`core/src/ast/nodes.ts:166–183`) are members of both `TopLevelItem`
and `StmtNode`; `LetDecl.initialiser: ExprNode|null` (**optional** — spec VAR-2). `ConstDecl.initialiser`
required.

## 2. SFA + model-adapter (`packages/frontend/src/sfa/`, `packages/core/src/sfa/`)

> **PF-009 file-location note:** `model-adapter.ts`, `zp-allocator.ts`, `symbols.ts`, and
> `plan-allocation.ts` live under **`packages/frontend/src/sfa/`**; only `allocation-plan.ts` is under
> `packages/core/src/sfa/`. The translator is `packages/codegen/src/instr/translate.ts` (not `il/`).
> The planner input type is `PlanInput`; `ModuleVarInput.size` is **required**; `moduleVars: []` is at
> `run-frontend.ts:159`. (Cosmetic citation corrections; the symbol-format strings all verified exact.)

`modelToFunctionInfo` (`model-adapter.ts:43–58`) iterates **only** `model.callGraph.functions`;
`collectLocals` (`:89–97`) reads body-scope `kind:"variable"` symbols; `fqName` (`:76–80`) reads the
declaring module off `fn.scope.node`. **No module-var projection.**

**Module-var infrastructure already exists + is unit-tested:**
- `ModuleVariableAllocation` (`core/src/sfa/allocation-plan.ts:27–40`); `AllocationPlan.moduleVariables`
  (`:172`) + `moduleVariablesSize` (`:174`) — **first-class fields, no core change needed**.
- `ModuleVarInput` (`zp-allocator.ts:36–41`); `layoutModuleVariables(vars, ramStart)` (`:55–73`).
- `plan-allocation.ts:96` already calls `layoutModuleVariables(input.moduleVars, …)`; frame region base
  = `ramStart + moduleLayout.totalSize` (`:99`); `__var_<Module>_<name>` emission (`symbols.ts:74–80`).
- **Tested:** `symbols.spec.test.ts` ST-A3 (`__var_Game_score`→`0x0820`), ST-A4 (order frames→vars→ZP);
  `plan-allocation.impl.test.ts:15–35` (frame region after module block).

**The single gap:** `run-frontend.ts:155–164` calls `planAllocation({ functions: modelToFunctionInfo(…),
moduleVars: [], zpUserVars: [], … })` — **`moduleVars: []` is hardcoded**. Slice 3b fills it via a new
`modelToModuleVars(model)` projection.

## 3. Codegen (`packages/codegen/src/`)

**Lowered + translated end-to-end for the 3b surface:** `let` (`lower.ts:200–208`), `=` (only `"="` +
`IdentExpr` target, `:291–304`), `return` (`:210–218`), same-width `+ - * / %` (`lowerBinary:275–289`;
op map `:78–95`), `peek`/`poke`/`pokew`/`peekw`/`lo`/`hi` (`:396–483`). Translate: `add`/`sub`/bitwise/
shift/6 comparisons/`mul`→`translateMul:634`/`div`·`mod`→`translateDivMod:680` (→ `__rt_mul8/div8/
mul16/div16`, `translate.ts:634–703`). **`br`/`brcond`/`call` are absent — 3b never emits them.**

**The one codegen gap (width):** `lowerNumericLit` → `imm(expr.value, IL_BYTE)` **hardcoded**
(`lower.ts:260–265`; comment: "No live typed model yet (D5)"). `lowerBinary` result type =
`operandType(left)`. So word literals/results don't get `IL_WORD` until lowering reads a real
`typeMap`. Frame-slot loads/stores already get width from `slotIlType` (frame slot type), so a
`word` **local** already round-trips; the gap is **literals** (e.g. `x = 300`) and word arithmetic
result typing.

**Module-var lowering: none.** `lowerToIL` (`:125–135`) walks only `FunctionDecl`/`InterruptDecl`
items (`:128`); a top-level `let` is skipped. `ILProgram.initCode` is shape-present but hardcoded
empty (`lower.ts:138`; `cfg.ts:82–86`) — **not needed** (AR-2 defers initializers). Slice 3b adds a
module-var **read/write** path (identifier/assignment resolving to `__var_*` instead of `__frame_*`).

## 4. The RAM placement reality (AR-1)

SFA lays module vars at `ramStart` then frames after; `DEFAULT_PROFILE.ramStart = 0x0800`
(`platform-profile.ts:74`), which `run-frontend` uses (not the platform plugin profile). The c64 PRG
loads code at `$0801`; the Slice-3a golden shows `__startup` at **`$080D`** (after the 12-byte BASIC
stub `$0801–$080C`). So `$0800–$080C` (13 bytes) is a **dead-stub shadow**; a variable region that
stays ≤13 bytes does not corrupt live code. Spec `appendix-c64.md:41` intends code+data+vars
sequential in `$0801–$CFFF`; the leading-equate placement at `$0800` is a walking-skeleton
simplification. **AR-1: 3b keeps the fixture within the 13-byte shadow and defers the general fix.**

## 5. Diagnostic codes (mostly present — `core/src/diagnostics/diagnostic-codes.ts`)

**Present:** E10003, E10010, E10020, E10021, E10080 (InvalidOperandType), **E10081
(MixedSignedUnsignedOperands)**, E10082 (ConstDivisionByZero), E10100 (UndeclaredIdentifier), E10101,
E10150 (MissingTypeAnnotation), **E10151 (`UnknownType`)**, E10152 (TypeMismatchAssignment), E10153
(SignedUnsignedMismatch), E10154 (WidthNarrowingNoCast), E10172, E10173, E10191, E10192, E10193.

> **⚠️ Preflight correction (PF-001/002/003, see [AR-11](00-ambiguity-register.md)).** Two codes the
> plan first assumed present are **absent** from both `diagnostic-codes.ts` and canonical
> `spec/14-diagnostics.md` — they must be **registered** (additive, Language-Guard-approved per RD-18
> AR-115): **E10084** (out-of-range literal) and **E10022** (`main` signature). Also **E10151** in the
> registry means **`UnknownType`**, NOT boolean-in-arithmetic — boolean-in-arith uses **E10080** (ledger
> R34). Assignment-compat codes come from the canonical registry, **not** frozen spec §5.3 (which is
> stale): narrowing = **E10154**, cross-sign = **E10153**, boolean-assign = **E10152**. Full table in AR-11.

> Note the code split confirmed during recon: **E10081** = mixed signedness in *operands*
> (arithmetic — RD-18 AC-2's headline, matches Ch 14 + ledger R49); **E10153** = signed/unsigned
> mismatch in *assignment* context (ledger R33). The fixture's `byte + sbyte` (arithmetic `+`) case is
> **E10081**. ⚠️ RD-04 **AC-05** text says E10153 for `byte + sbyte` — that is **wrong** (RD-04 is
> internally inconsistent: R49 = E10081); Phase 5 corrects AC-05 rather than ticking it as-is (PF-004).

## Technical debt / risks carried into the plan

- **AR-1 collision ceiling** (`>13` var bytes corrupts code) — documented, deferred; the fixture is ~10 bytes.
- **AR-5** signed `*`/`/`/`%` routes to unsigned `__rt_*` — pre-existing; out-of-surface for 3b.
- Threading `typeMap` into `LowerCtx` is new wiring between `@blend65/compiler` (owns the model) and
  `@blend65/codegen` (owns lowering) — must respect the **R15 boundary** (codegen may depend on core;
  the model type lives in core). No `frontend`←`codegen` edge is introduced.
