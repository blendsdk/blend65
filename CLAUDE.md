# blend65 — the Blend65 compiler & toolchain

## Overview

- **Name:** blend65
- **Description:** Blend65 is a statically-typed systems language and ahead-of-time
  compiler that targets 6502-based retro platforms (C64, C64 Ultimate, Commander X16,
  Atari 800XL, Atari 7800). This repository hosts the language specification, the
  requirements documents (RD-01..RD-17), and the TypeScript monorepo that implements
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
examples/            # examples/gate/main.blend (AR-43 gate program; not yet consumed)
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
codeops/features/blend65-ri/requirements/      # RD-01..RD-17 requirements documents
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
- Emulators (VICE, x16emu, Altirra, Stella/7800) — only needed once RD-12 lands;
  CI currently has NO emulator tier (AR-27).
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
  RD-18 (codegen language-feature completion) is a thin per-slice vertical rollout;
  **Slice 3a is complete (2026-07-05, 21/21 tasks)**: the `modelToFunctionInfo` seam is
  closed — `@blend65/frontend` ships `semantics/function-collection.ts` (a Pass-1
  collector building a per-module `Scope` + function symbols declared in it + ordered
  locals in body scopes + `mainFunction`), `analyze()` invokes it alongside
  `collectDeclarations` (`passes.ts` untouched), and `sfa/model-adapter.ts` projects a
  populated model into real `FunctionInfo[]` (`name="Module.function"`; FQN module read
  from `fn.scope.node.name`). A one-local-`byte` program (`examples/slice3a/main.blend`)
  now assembles through the real populated-model path to a loadable PRG
  (`__frame_Main_main_x`) and drives `$D020==0xF5` on real VICE 3.10. Each slice is gated
  by the 3-part bar (CI assemble-clean + CI golden + local VICE). Parent ACs advanced:
  RD-05 AC-22 superseded (empty model still `[]`), RD-04 deferred-ledger R7/R8 real scope
  construction begun, RD-18 AC-1 ✅. **Next: RD-18 Slice 3b** (scalar type/scope engine —
  extends `function-collection.ts` with real Passes 1/3/4; needs `make_plan`). RD-13
  (non-functional sweep) / RD-14 (VS Code/LSP) remain queued. See
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
