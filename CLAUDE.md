# blend65 — the Blend65 compiler & toolchain

## Overview

- **Name:** blend65
- **Description:** Statically-typed systems language + AOT compiler targeting 6502 retro platforms
  (C64, C64 Ultimate, Commander X16, Atari 800XL, Atari 7800). Hosts the language spec, the
  requirements (RD-01..RD-18), and the TypeScript monorepo implementing compiler/CLI/VS Code tooling.
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

- **Build:** `yarn build` (turbo run build — `tsc --build` across all 10 packages)
- **Typecheck:** `yarn typecheck`  •  **Lint:** `yarn lint` (ESLint + Prettier)
- **Test:** `yarn test` (per-package unit tier, THEN the root R15 boundary tier — AR-P10);
  single package: `yarn workspace @blend65/<pkg> test`
- **Verify (run before every commit):**
  `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`
- **Clean:** TODO — no `clean` script defined (root, packages, or `turbo.json`); clean manually
  (`git clean -xdf packages/*/dist packages/*/*.tsbuildinfo`) or add a `clean` task to `turbo.json`.

## Project structure

Monorepo — Yarn workspaces + Turbo. Source in `packages/*/src/`; tests co-located as
`*.spec.test.ts` (spec tier) / `*.impl.test.ts` (logic tier, RD-02+), plus the repo-root `test/` cross-package boundary tier (`boundary.spec.test.ts`).

- `packages/` — the 10 `@blend65/*` packages (edges below)
- `spec/` — frozen spec-v3.0; DO NOT MODIFY during compiler implementation (D3)
- `examples/` — per-slice acceptance fixtures (gate + slice3a…slice8b), VICE-verified
- `codeops/` — nested CodeOps layout (marker `.codeops.yml`): `00-roadmap.md` (portfolio) + `features/blend65-ri/` (`00-roadmap.md`, `requirements/`, `plans/<rd-slug>/`) + `_archive/` (completed plans)
- `.github/workflows/` — CI (install → typecheck → lint → build → test; Node 22; no emulator tier)
- `docs/` — incl. the C64 game-feasibility matrix: `game-feasibility-matrix.json` (source of truth) rendered to an interactive `game-feasibility-matrix.html` by `scripts/gen-capability-matrix.mjs` (`yarn gen:matrix`); manual refresh via the `update_capability` skill
- `research/`, `scripts/` — research notes, repo tooling

### Package dependency edges (R15 boundary is load-bearing)

Private — `core` ← — · `frontend` ← core · `codegen` ← core, frontend · `platforms`, `config` ← core.
Public — `compiler` ← core, frontend, codegen, platforms, config · `cli` ← compiler, config, core · `language-server` ← core, frontend (**NEVER codegen** — R15) · `vscode` ← language-server · `test-harness` ← core, compiler (+ codegen **dev-only**).

> **R15 / AR-20 (load-bearing):** `frontend` and `language-server` MUST NOT import `@blend65/codegen`
> — enforced by ESLint `no-restricted-imports` (AR-P7) + `test/boundary.spec.test.ts` (ST-R15a/b/c).

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
- **Casing:** PascalCase (classes, types/interfaces) · camelCase (functions/methods) ·
  UPPER_SNAKE_CASE (constants)
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

- **Main branch:** `master` (active development on `v3`).
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
- **Implementation status:** never restated here — the authoritative, living status is
  `codeops/features/blend65-ri/00-roadmap.md` (portfolio roll-up `codeops/00-roadmap.md`). Read it
  at the start of every task; update it at each lifecycle transition (the `roadmap` skill drives this).
- CI has NO emulator tier (AR-27): the RD-12/RD-17 emulator suites are
  `describe.skipIf(!hasVice()||!hasAcme())` — they skip in CI and are proven green locally on
  VICE 3.10; the codec/assertion/registry/golden/PNG tiers DO run in CI. Local emulator suites
  run sequentially (`fileParallelism:false`) so concurrent `x64sc` instances don't contend.

<!-- analyze_project: refreshed 2026-07-17 (post-RD-18-closure) — Project structure: examples now gate+slice3a…slice8b; docs line names the game-feasibility matrix + update_capability skill. Toolchain/Commands re-verified unchanged against package.json (10 packages, yarn@1.22.22, scripts build/typecheck/lint/test), .nvmrc (22), turbo.json; no clean script — TODO still applies. -->
