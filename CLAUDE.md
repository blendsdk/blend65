# blend65 — the Blend65 compiler & toolchain

## Overview

- **Name:** blend65
- **Description:** Blend65 is a statically-typed systems language and ahead-of-time
  compiler that targets 6502-based retro platforms (C64, C64 Ultimate, Commander X16,
  Atari 800XL, Atari 7800). This repository hosts the language specification, the
  requirements documents (RD-01..RD-18), and the TypeScript monorepo that implements
  the compiler, CLI, and VS Code tooling. Consumed as `@blend65/*` packages plus the
  `blendc` CLI.
- **Type:** compiler (consumed as a library — `@blend65/*` packages + the `blendc` CLI)

## Toolchain

- **Language(s):** TypeScript (ESM, NodeNext, ES2023, `strict`)
- **Framework(s):** Turborepo (monorepo orchestration)
- **Package Manager:** Yarn classic (v1) workspaces — **no** `workspace:*` protocol
- **Bundler:** Vite (per-package builds where applicable); `tsc --build` for type output
- **Test Framework:** Vitest
- **Linter/Formatter:** ESLint v9 (flat config) + Prettier
- **Runtime:** Node 22 (pinned via `.nvmrc` + `engines`)

**Manifest files:** package.json, tsconfig.json, turbo.json

## Commands

All commands run from the repo root.

### Build

```bash
# Build all 10 packages (tsc --build across the workspace)
yarn build          # turbo run build
```

### Typecheck / Lint

```bash
yarn typecheck      # turbo run typecheck
yarn lint           # turbo run lint  (ESLint + Prettier)
```

### Test

```bash
# Run all tests (per-package unit tier ST-1..ST-10, THEN root R15 boundary tier) — AR-P10
yarn test           # turbo run test  →  then vitest run test/

# Run tests for a single package
yarn workspace @blend65/<pkg> test
```

### Verify (before commit)

```bash
# Full verification — run this before any git commit
yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test
```

### Clean

TODO: no `clean` script is defined (root, packages, or turbo.json). Clean manually, e.g.
`git clean -xdf packages/*/dist packages/*/*.tsbuildinfo`, or add a `clean` task to `turbo.json`.

## Project structure

**Layout:** Monorepo — Yarn workspaces + Turbo.

```
.github/workflows/   # CI (install → typecheck → lint → build → test; Node 22; no emulator tier)
codeops/             # CodeOps nested layout (marker + portfolio roadmap; see below)
docs/
examples/            # per-slice acceptance fixtures (gate + slice3a…slice6), VICE-verified
packages/            # 10 @blend65/* packages
research/
scripts/             # repo tooling / helper scripts
spec/                # frozen spec-v3.0 — DO NOT MODIFY during compiler implementation (D3)
test/                # repo-root cross-package tier (boundary.spec.test.ts)
```

CodeOps artifacts live under the nested `codeops/` layout (marker `codeops/.codeops.yml`):

```
codeops/00-roadmap.md                          # portfolio roadmap
codeops/features/blend65-ri/00-roadmap.md      # feature roadmap (implementation status)
codeops/features/blend65-ri/requirements/      # RD-01..RD-18 requirements documents
codeops/features/blend65-ri/plans/<rd-slug>/   # implementation plans (rd-08, rd-09, …)
codeops/_archive/<rd-slug>/                     # completed/archived plans
```

### The 10 packages and their dependency edges (R15 boundary is load-bearing)

| Package                    | Depends on                                  | Publish  |
| -------------------------- | ------------------------------------------- | -------- |
| `@blend65/core`            | —                                           | private  |
| `@blend65/frontend`        | core                                        | private  |
| `@blend65/codegen`         | core, frontend                              | private  |
| `@blend65/platforms`       | core                                        | private  |
| `@blend65/config`          | core                                        | private  |
| `@blend65/compiler`        | core, frontend, codegen, platforms, config  | public   |
| `@blend65/cli`             | compiler, config, core                      | public   |
| `@blend65/language-server` | core, frontend  (**NEVER codegen** — R15)   | public   |
| `@blend65/vscode`          | language-server                             | public   |
| `@blend65/test-harness`    | core, compiler (+ codegen **dev-only**)     | public   |

> **R15 / AR-20 (load-bearing):** `frontend` and `language-server` MUST NOT import
> `@blend65/codegen`. Enforced authoritatively by ESLint `no-restricted-imports`
> (AR-P7) and spec-tested by `test/boundary.spec.test.ts` (ST-R15a/b/c).

### Source & test locations

- **Source code:** `packages/*/src/`
- **Test files:** co-located in `packages/*/src/**` and the repo-root `test/` tier
- **Test file convention:** `*.spec.test.ts` (spec tier), `*.impl.test.ts` (logic tiers, RD-02+)

## Conventions

### Import & module resolution

- **ES Modules** — `import { x } from 'module'` (ESM throughout: `"type": "module"`, NodeNext).
- **Cross-package:** import from package names — `import { x } from '@blend65/core'`.
  Never import from another package's `dist/` or `src/` relative path.
- **Intra-package:** relative imports MUST carry the `.js` extension (NodeNext) —
  `import { x } from './foo.js'`.
- **Type imports:** use `import type { X }` for type-only imports.

### Naming

- **Files:** kebab-case (`foo-bar.ts`); test files `*.spec.test.ts` (spec tier),
  `*.impl.test.ts` reserved for logic tiers (RD-02+).
- **Components/Classes:** PascalCase
- **Functions/Methods:** camelCase
- **Constants:** UPPER_SNAKE_CASE
- **Types/Interfaces:** PascalCase
- **Modules/packages:** `@blend65/<lowercase>`

### Architecture

- **Large classes (>500 lines):** Split into modules / use composition; prefer pure
  functions and small focused modules over monolithic classes.
- **Component pattern:** Compiler pipeline stages (Lexer → Parser → Analyzer → SFA →
  IL/Optimizer → Codegen → Emitter), each independently testable.
- **State management:** N/A (AOT compiler; no UI runtime state). SFA = static frame
  allocation, all allocation decided at compile time.

### Documentation

- **Doc format:** JSDoc on exported symbols.
- **Required for:** All exported functions, types, and public package APIs.

### Grounded options & recommendations

> **Grounded Options & Recommendations** — follow the always-on directive in the coding standards:
> filter out non-viable options (no strawmen), second-guess each, ground any code-modifying option
> in the real code, and lead with a recommendation and its reason; match ceremony to stakes.

## Git conventions

### Commit scope

```
# Monorepo — use package or RD/area as scope:
#   feat(frontend): ...      fix(cli): ...      chore(rd-01): ...
```

### Branch strategy

- **Main branch:** `master` (active development on `v3`). <!-- analyze_project: project.md said "main", but no `main` branch exists; the repo default is `master` -->
- **Feature branches:** `feature/[name]`
- **Convention:** keep `spec/` untouched in any commit during compiler implementation (D3).

## Special rules

### Environment & dependencies

- Node.js 22 (pinned via `.nvmrc` + `engines`).
- Yarn classic (v1) — workspaces, no `workspace:*` protocol.
- Turbo (installed via yarn workspace dev dependency).
- Emulators (VICE, x16emu, Altirra, Stella/7800) — VICE 3.10 + ACME are needed locally
  for the RD-12/RD-18 acceptance tiers; CI has NO emulator tier (AR-27) but does
  install ACME.
- **Environment variables:** none required for build/test. No `.env` file is used by
  the compiler/CLI.

### Project-specific

- `spec/` is the FROZEN spec-v3.0 baseline. Do NOT modify any file under `spec/` during
  compiler implementation (decision D3). `git status --porcelain spec/` must stay empty.
- Honor the Blend65 Language Guard (`.clinerules/language-guard.md`) for any language-
  feature work: no feature enters the spec without passing all 23 rules.
- Runtime-ambiguity protocol: if an implementation decision is undetermined, STOP, log
  it in the active plan's Ambiguity Register as the next AR-PN (runtime), resolve with
  the user, then resume and back-propagate the resolution into the affected plan docs.
- Compiler logic implementation is underway (RD-02+). The codegen pipeline is complete
  through **RD-17**: `@blend65/codegen` ships the RD-07a Instr core, the RD-07b IL→Instr
  slice, RD-07c platform preamble, RD-08 peephole (passthrough v1), RD-09's
  `serializeToAcme`, and RD-17's runtime embedding (`src/runtime/embed.ts` + the four
  `runtime/*.asm` T3 routines, functionally verified); `@blend65/compiler` ships the RD-09
  ACME process layer (`discoverAcme`, `parseLabelFile`, `invokeAcme`, `emitBinary`).
  `@blend65/core/intrinsics` carries the RD-17 descriptor registry/catalog, and the
  frontend runs its first real semantic pass (intrinsic validation + the T4 import
  boundary). The MVP gate `poke` compiles and assembles. RD-16 is complete:
  `@blend65/config` ships `loadConfig()` (walk-up discovery, tolerant JSONC via
  `jsonc-parser` — the workspace's only external runtime dependency — schema/semantic
  validation over the E10240–E10246/W10240–41 band, defaults←file←overrides merge).
  RD-11b is complete (2026-07-03, 39/39 tasks): `@blend65/core` ships the full
  diagnostics remainder — the `SourceMap` registry (path-keyed intern, cached
  `LineMap`s, AR-104 `has()`), the severity policy (`createSeverityPolicy`/
  `applySeverityPolicy`, R50 suppression-wins, W-code preserved on promotion),
  the Ch 14 §1 terminal renderer (byte-column carets, R51 degradation, R52
  excerpt sanitization, hand-rolled ANSI) with a verbatim-span JSON renderer,
  and the new `report/` module (`ResourceReport` on the shipped `SfaResourceData`,
  `buildResourceReport`, post-ACME `checkBinaryBudget` E10034, the Ch 11 §6
  `renderReportTerminal` build summary with AR-102 zero-staging, and
  `renderReportJson`). RD-11 §6 acceptance is fully closed (AC-16's `--quiet`
  flag half + AC-10/AC-21 closed by RD-15, 2026-07-03).
  RD-15 is complete (2026-07-03, 50/50 tasks): `@blend65/compiler` ships the
  programmatic facade `api/` — `compile` (frontend-only, the LSP path), `emitIl`/
  `emitAsm` (partial pipelines, with the PF-001 `assembleProgram` override seam
  threading `--out-name`/`--startup`), and `build` (full ACME pipeline: injectable
  `BuildDeps`, canonical `checkBinaryBudget` E10034, binary read-back) over one
  `runFrontend` core with two-bag config/pipeline diagnostics and a single R21
  `outName` derivation; plus the core `CompilerHost` abstraction + compiler
  `DiskCompilerHost` (tinyglobby R47 globs + projectRoot containment) and driver
  codes E10250/E10251. `@blend65/cli` ships the full `blendc` command — yargs@17
  parsing, zero-dependency color (AR-V2, no chalk), diagnostics/trailer → stderr +
  summary/JSON report → stdout, `--emit-asm/-il/-report` artifact writes, and the
  R50 exit ladder (0/1/2/3; ICE band via `isIceCode`, ACME-not-found→1). AC-18
  no-print is ESLint-enforced + ST-39-witnessed; CI installs ACME so the ST-40
  real-ACME build E2E runs live. RD-15 also fixed a latent RD-09 defect (DEF-1/
  AR-V23): `invokeAcme` dropped `-o` so the `!to ...,cbm` directive drives a
  header-bearing, loadable c64 PRG.
  RD-12 is complete: `@blend65/test-harness` ships the emulator-verification
  framework — the abstract `EmulatorDriver` (+`advanceInstructions`), the pure VICE
  binary-monitor codec (CI byte-exact) + `ViceDriver` (real VICE 3.10) + zero-dep PNG,
  three timeout-guarded run strategies, register/memory assertions, the R7a
  platform→emulator registry, the `setupEmulator` fixture (+`hasVice`/`hasAcme`), and
  `assertGolden`. All 16 own ACs are ticked; RD-17's inherited AC-14 is discharged on
  real VICE (the `__rt_*` math vectors), and DEF-2 was fixed as Phase 0 (`invokeAcme`
  now emits `--vicelabels`, so real builds populate `symbolMap`).
  RD-18 (codegen language-feature completion) is a thin per-slice vertical rollout, each
  slice gated by the 3-part bar (CI assemble-clean + CI golden + local VICE). **Slice 3a
  (2026-07-05, 21/21)** closed the `modelToFunctionInfo` seam: `@blend65/frontend`'s
  `semantics/function-collection.ts` builds a per-module `Scope` + function symbols +
  ordered locals + `mainFunction`, and `sfa/model-adapter.ts` projects a populated model
  into real `FunctionInfo[]` (`name="Module.function"`, FQN from `fn.scope.node.name`).
  **Slice 3b (2026-07-06, 45/45)** shipped the scalar type/scope engine end-to-end — real
  RD-04 Pass 3 (`type-check/*` expression/literal typing → `typeMap`/`symbolMap`, real
  `isAssignableTo`/`commonType`, poison) + Pass 4 (`post-check.ts` `main()` validity) +
  `module-variable-collection.ts` (`__var_*`) + width-aware lowering (word literals →
  `__rt_mul16`); `examples/slice3b/main.blend` VICE-verifies `$C000==$11`/`$C001==$58`/
  `$C002==$02`; mixed-sign `byte+sbyte`→E10081. **Slice 4a is complete (2026-07-07, 35/35
  + DEF-1)**: conditionals + loops + the first **multi-block CFG codegen keystone**.
  `function-collection.ts` recurses into control-flow bodies (flat body-local + for-counter
  collection); `type-check/statement-typing.ts` gains `loopDepth` + `typeCondition`
  (E10134) + if/while/do-while/for/break/continue + `typeFor` (E10065/E10064/E10061);
  `post-check.ts` `checkAllPathsReturn` (E10102). `@blend65/codegen`'s `il/lower.ts` gains a
  loop-context stack + `lowerIf/While/DoWhile/For`(Pattern A)/`Break/Continue`, and
  `instr/translate.ts` `run()` now loops **all** `fn.blocks` with `prescanAll()` + per-block
  `resetBlockState()` + block labels (`br`→JMP, `brcond`→conditional, `unreachable`→∅).
  `examples/slice4a/main.blend` (for-loop with `break`/`continue` + a while + a two-armed
  if/else) computes `21` on real VICE (`$C000==$15`, `$C001==$01`); a non-void function
  missing a return path → E10102. New codes **E10134/E10061/E10065/E10102** minted
  additively; `break`/`continue` outside a loop → E10130/E10131. A latent RD-07b comparison
  bug was fixed as **DEF-1/AR-16** (`translateComparison` clobbered the Z flag → `eq`/`ne`
  always 0; fixed eq/ne only). **Slice 4b (2026-07-07, 26/26)** shipped `switch`/`case`/
  `default`/`fallthrough` — `typeSwitch` (E10075/E10071/E10084/E10077/E10132/E10074/E10073)
  + `lowerSwitch` as a `brcond` compare-chain over the 4a CFG keystone (no new terminator/
  translate work); closed RD-18 AC-3. **Slice 5a (2026-07-10, 46/46)** shipped user
  functions/params/calls: param collection (E10003/E10101), the `typeCall` ladder
  (E10100→E10051→E10023→E10175 + E10170/E10171), return completion (E10172), iterative
  Tarjan → ONE E10174 per cycle with path, `import-resolution.ts` (E10012, same-Symbol
  aliasing), SFA params-first frames + argument-window interference, `lowerCall`
  store-per-arg + translate `call` (JSR + A/A:X bind, two never-miscompile ICE guards);
  Phase 0 moved the data base `$0800`→`$2000` + the post-ACME overlap check (E10033 band).
  **Slice 5b (2026-07-11, 42/42)** completed the module system, **closing RD-18 AC-4**
  (Slice 5 fully done): module merging (name-keyed shared scopes; cross-file duplicate
  top-level names → E10003; the 5a dup-module ICE removed), the full qualified-access
  value surface (`semantics/type-check/name-resolution.ts` `resolveQualified` value-first
  ladder — E10100/E10012; `typeFieldAccess` + one shared `typeCall` callee ladder +
  `typeAssign` qualified arm; function-member-as-value → loud ICE until Slice 8 `&fn`),
  call-free module-variable initializers (any call — `CallExpr` or non-`lo`/`hi`
  `IntrinsicCallExpr` — is a loud unsupported ICE) with per-variable topological init
  order (`semantics/init-order.ts` — import-edge module order then declaration order; ONE
  **E10194** per cycle with the full path), scalar const completion (declaration-order-
  independent const-eval → `SemanticModel.constValues`, **E10193**, use-site inlining — a
  module const owns NO storage symbol), and the `__init` startup stream (`ILProgram.
  initCode` + `initTempCount` realized; `generateInstr` translates it FIRST; additive
  `PreambleOptions.hasInitCode` → conditional `JSR __init` after banking through the
  shared shim + all five plugins; initializer-free output byte-identical — all prior
  goldens unchanged; `--startup bare` is user-owned). `examples/slice5b/` (a module
  spanning two files) verifies `$C000..$C006 = 05/08/07/02/01/03/01` on real VICE.
  **Slice 6 (2026-07-11, 52/52)** shipped the full expression system, **closing RD-18
  AC-5**: the complete binary matrix + TS-4 mixed-width promotion under ONE
  `isAssignableTo` rule (args/returns too — the 5a strict-arg interim superseded), unary
  `- ! ~` (E10087), FR-40 `<type>(expr)` casts (E10086/E10155), the ternary
  (E10134/E10088), TS-17 compound assignment, width-aware const-eval (`const-eval.ts`
  gains a `ConstTypeLookup` seam + exported `toBits`/`fromBits`; lazy `&&`/`||`/
  selected-arm-ternary folds), the short-circuit **guarantee** lowered as CFG diamonds
  over synthetic `0sc<N>` SFA frame slots (`model-adapter.ts` preorder collection +
  `__init` pseudo-frame; name + byte-size parity ICE guards), comparisons stamped with
  the promoted OPERAND type at all three emission sites + all four byte/word ×
  unsigned/signed translate framings (fixing the latent word-compare low-bytes-only
  miscompile), signed `/`/`%` → loud lowering ICE, non-const `lo`/`hi`, word +
  variable-count shifts, zext as a zero-cost fold, and warnings
  W10160/W10161/W10101/W10174. `examples/slice6/main.blend` verifies
  `$C000..$C008 = E7 04 DA 05 07 00 01 44 00` on real VICE incl. the short-circuit
  suppression proof ($C005==$00, $C006==$01). Bonus defect fix: accumulator ops now
  render as the bare mnemonic (`ASL`, not `ASL A` — ACME parsed the `A` as a symbol).
  **Slice 7a (2026-07-12, 64/64)** shipped the aggregate DIRECT-addressing surface —
  arrays/structs/enums end-to-end. Frontend: array literals parse everywhere aggregate
  literals are legal (new `ArrayLitExpr`, 50→51 node kinds; `parseConstDecl` gained the
  aggregate-literal flag; dotted `Mod.Type` annotations parse); module-keyed FQN
  declaration tables (fixing the latent bare-name struct-collision defect); the unified
  lazy memoised **const/type engine** (`semantics/const-type-engine.ts` — constants ⇄
  struct layouts ⇄ enum values in ONE in-progress stack, one path-carrying E10165/E10194
  per definition cycle; `sizeof`/`offsetof`/`length` fold through an injected
  `ConstIntrinsicFolder` seam on `evalConst`, result typed by representability ≤255→byte,
  ≥256→word); annotation resolution finalizes `Symbol.type` in place post-import (the
  field is deliberately mutable); full aggregate typing (index E10114/E10115/E10117,
  struct-literal declaration order E10097, nominal enum semantics with enum→byte the only
  implicit, switch-on-enum E10077, W10140/W10141 advisories, E10157 statement-head
  literals, permanent E10093/E10120 aggregate returns, loud aggregate-param rejection
  pending 7b); aggregate const IMAGES (`ConstValue.bytes`, little-endian). Codegen:
  `lowerPlace` resolves chains to base+offset(+scaled byte-index temp; pow-2 scales →
  ASL+W10172, else `__rt_mul8`+W10170), literal-init stores/fill/per-byte struct copies
  incl. the `__init` stream, `constData` → labeled `!byte` data streams after code;
  translate gained the tier-1 `abs,X` framings under per-arm state obligations (prescan
  def/read fixes for the load ops; X-mirror cleared before every LDX; byte-load results
  homed via store-fold or binder ZP spill; register-resident word stores reject loudly;
  `protectA()` spills live unhomed A temps at mul/const). Two-file `examples/slice7/`
  verifies `$C000..$C009 = 0E 2A 08 02 06 02 01 14 0B 03` on real VICE (first run);
  184-line golden.
  **Slice 7b (2026-07-12, 58/58 — SLICE 7 CLOSED, RD-18 item 6 ticked)** shipped the pointer
  surface end-to-end. Frontend: `ArrayType.size: number | null` (unsized, param-only) +
  `T[N]→T[]` binding, param symbols finalized like variables (`finalizeParameter` patches
  `byRef`; struct/array → by-ref per FN-3, enums by value), const params CP-1..5 through ONE
  root-symbol predicate (E10122 const-arg→mutable-by-ref incl. forwarded const params;
  E10123 writes through const params — direct/nested/indexed/compound), the tier index rules
  key on the known total (E10117 kept, E10118 now emittable, unsized takes both widths,
  tier-matched literal adaptation), `length()` on unsized → E10080, the narrowed
  unsized-declaration inference (`let/const T: byte[] = […]` infers from a full element list;
  fill/no-initializer → E10126), advisories W10112 (same root twice in one call's by-ref
  args), W10142 (fixed 256-byte tier boundary), W10143 (≥25% of `targetProfile.maxRam`,
  skipped without a profile), and `SemanticModel.pairAccessedParams` — the single
  classification (element/field chains, whole-copy endpoints; dead/pass-through excluded)
  shared by SFA and lowering. SFA: chain-max pair coloring over the interference graph in
  caller-first topo order (`sfa/pointer-pairs.ts`) overlays `__zp_ptr_<Module_fn>_<param>`
  aliases onto the peak-sized pool (sequential callees share addresses), plus the
  conditional `__zp_ptr_scratch` (pair-accessed params OR a transitive >256-byte array);
  pointer-free ZP layouts stay byte-identical. Codegen: the IL `addr` operand (`&sym+off`,
  legal as a store source AND an ALU right operand — `#<sym`/`#>sym` byte selects; loud ICE
  everywhere else), marshalling stores static-place addresses into the callee's 2-byte frame
  home (whole pass-through = a frame-word copy, no pair; runtime-indexed/pair-relative args
  ICE "needs address-of" until Slice 8), one-time prologue frame→pair byte copies, pair-base
  places with the straddle-aware fast path (`offset+size−1 ≤ 255`), the pair byte-index path
  gated to 1-byte elements (multi-byte routes word-domain), pair scalar compound as an
  indirect RMW (never the pointer bytes), and runtime pointer formation through scratch with
  every word intermediate homed by the fused-store discipline. Translate: `(zp),Y` framings
  (byte fast paths, word lo/INY/hi with a >254-offset ICE backstop), the regY mirror
  (invalidated by INY/JSR/block boundaries), and the unreserved-pair staging ICE. Gotcha
  minted at exec: ACME sizes symbols by equate DIGIT COUNT — `(zp),Y` operands need 2-digit
  equates, done additively via `SymbolDefinition.zeroPage` (prior goldens untouched).
  Two-file `examples/slice7b/` verifies `$C000..$C006 = 00 2A 0F 1D 11 0B 16` on real VICE
  3.10 first run (incl. the runtime-word-index-260 formation proof); 212-line golden; nine
  prior goldens byte-exact.
  **Next: RD-18 Slice 8** (hardware & advanced — `&` address-of, interrupts, `zeropage`
  blocks, strings/`embed()`; needs `make_plan`). RD-13 (non-functional sweep) / RD-14
  (VS Code/LSP) remain queued. See
  `codeops/features/blend65-ri/00-roadmap.md` for authoritative status.
- CI still has NO emulator tier (AR-27): the RD-12 emulator/RD-17 suites are
  `describe.skipIf(!hasVice()[||!hasAcme()])` — they skip in CI and are proven green
  locally on VICE 3.10. The codec/assertion/registry/golden/PNG tiers DO run in CI.
  Local emulator suites run sequentially (`fileParallelism:false`) so concurrent
  `x64sc` instances don't contend.
- This repository keeps a living implementation tracker at
  `codeops/features/blend65-ri/00-roadmap.md` (rolled up into the portfolio roadmap
  `codeops/00-roadmap.md`). Read it at the start of a task to determine the current position,
  and update it at every lifecycle stage transition (RD done, plan created, etc.). The
  `roadmap` skill drives this.

<!-- migrated from .clinerules/project.md on 2026-07-02 -->
<!-- analyze_project: refreshed Toolchain/Commands/Project-structure/Git against the live repo on 2026-07-02 — corrected clean command (none defined), main branch (master, not main), added scripts/ dir, added Grounded-Options pointer -->
<!-- analyze_project: refreshed 2026-07-11 — examples/ line (per-slice fixtures through slice5b), requirements range RD-01..RD-18, emulator note (RD-12 shipped; CI installs ACME), and the RD-18 current-position narrative (slices 4b/5a/5b complete, AC-4 closed; Next: Slice 6). Toolchain/Commands verified unchanged against package.json; clean-script TODO still applies. -->
<!-- analyze_project: refreshed 2026-07-11 (post Slice 6) — examples/ line (fixtures through slice6); the RD-18 current-position narrative was already updated by the Slice-6 rollout (Slice 6 complete, AC-5 closed; Next: Slice 7). Toolchain/Commands/packages/CI verified unchanged against package.json, turbo.json, ci.yml (install → typecheck → lint → build → ACME install → test, Node 22, no emulator tier); clean-script TODO still applies. -->
