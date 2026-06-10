# Requirements: RD-01 Project Scaffolding & Toolchain

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-01](../../requirements/RD-01-project-scaffolding-toolchain.md)

## Feature Overview

Stand up the Blend65 monorepo skeleton: a Yarn classic (v1) workspace at the repo root
driven by Turborepo, ten `@blend65/*` package directories wired with TypeScript project
references that mirror and enforce the dependency graph, Vite per-package bundling where
needed, a workspace-aware Vitest unit tier, ESLint v9 flat config + Prettier, and a
GitHub Actions CI pipeline. The deliverable is **infrastructure only** — *empty but
wired*: no lexer, parser, semantic, codegen, diagnostics, or config logic is written
here. Each package ships a single `VERSION` constant and a smoke test so the build/test
machinery is provably green and the vertical walking skeleton (AR-38) has a place to grow.

## Functional Requirements

### Must Have

- [ ] Yarn classic (v1) workspace at repo root resolving all ten packages (R2/AR-4)
- [ ] Monorepo structure with Turborepo `turbo.json` task graph (R3/R4, AR-5/AR-6)
- [ ] Ten `@blend65/*` packages, each with `package.json`, `tsconfig.json`, `src/index.ts` (`VERSION` export), `src/index.spec.test.ts` (R12, AR-20/AR-24, AR-P3/AR-P4)
- [ ] Root `tsconfig.base.json` (`strict`, `composite`, `declaration`) + solution `tsconfig.json` referencing all packages (R5, §4.3)
- [ ] Per-package `tsconfig.json` `references` mirroring the §4.2 dependency edges (R5/R15)
- [ ] `tsc --build` pipeline builds all ten packages with references intact (§4.3)
- [ ] **R15 frontend/backend boundary**: `frontend` and `language-server` have NO edge to `codegen`; a violation is a `tsc --build` compile error (R15/AR-20, AR-P6)
- [ ] Vite per-package config where bundling is needed (`cli` distributable, `vscode` webview) (R6/AR-8, §4.5)
- [ ] Workspace-aware Vitest unit-tier configuration discovering `*.spec.test.ts` (R7/AR-9, §4.6)
- [ ] ESLint v9 flat config (`eslint.config.mjs`) + Prettier (`.prettierrc.json`), repo-wide, as a Turborepo task and CI gate (R10/AR-12, AR-P5, §4.7)
- [ ] GitHub Actions `ci.yml`: install (frozen lockfile) → typecheck → lint → build → test (unit tier), Node 22, **no emulator tier** (R9/R16, AR-11/AR-27, §4.8)
- [ ] Node 22 pin via `.nvmrc` and `engines` (R8/AR-10)
- [ ] Top-level layout: `/spec`, `/docs`, `/plans`, `/requirements`, `/research`, `/examples`, `/packages` (R13/AR-19, §4.1)
- [ ] ESM module system throughout (`"type": "module"`, NodeNext, ES2023) (AR-P1)
- [ ] Publishable/private flags set per AR-P2

### Should Have

- [ ] `examples/` seeded with the AR-43 gate program (`module Main; function main(): void { poke(0xD020, 5); }`) as a placeholder asset (no compiler consumes it yet)
- [ ] Root `README` pointer / minimal package READMEs for the publishable packages (AR-24 notes test-harness needs its own README/examples; a stub is acceptable at scaffold stage)

### Won't Have (Out of Scope)

- `blend65.json` config schema/loading → RD-16 (only the empty `config` package shell is created)
- CLI command surface (`blendc`, yargs) → RD-15 (only the empty `cli` package shell)
- Emulator driver / harness implementation → RD-12 (only the empty `test-harness` shell)
- Any lexer/parser/semantic/codegen/IL logic → RD-02..RD-09, RD-17
- The diagnostics engine implementation → RD-11 (only the `core` shell)
- Golden + emulator test tiers → RD-12 and codegen RDs (only the unit tier is wired here)
- Actual npm publishing (only `private`/`publishConfig` fields are set)

## Technical Requirements

### Performance

- `tsc --build` incremental builds via `composite: true` + `*.tsbuildinfo`; Turborepo caches `build` outputs (`dist/`, `*.tsbuildinfo`) (§4.3/§4.4).

### Compatibility

- Node 22 only (pinned). ESM module resolution (NodeNext). Yarn classic (v1) workspace layout.

### Security

- CI installs with a **frozen lockfile** (`yarn install --frozen-lockfile`) to prevent dependency drift (§4.8). No secrets are introduced by this scaffold; no user input paths exist (pure build infrastructure).

## Scope Decisions

| Decision                    | Options Considered                          | Chosen                                                    | Rationale                                                          | AR Ref  |
| --------------------------- | ------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------- | ------- |
| Module system               | ESM / CommonJS / dual                       | ESM (NodeNext, ES2023)                                    | Aligns with Node 22 + Vite + Vitest (ESM-native)                  | AR-P1   |
| Publishable packages        | all-private-except-public / only harness / all | test-harness, cli, compiler, language-server, vscode      | Only public-facing surfaces published; internal libs stay private | AR-P2   |
| Version baseline            | 0.0.0 / 0.1.0 / 0.0.1                        | 0.1.0 (`export const VERSION = '0.1.0'`)                  | Concrete value for smoke-test assertions                          | AR-P3   |
| Test-file structure         | per-pkg spec + root boundary / single / plain | `index.spec.test.ts` per pkg + root `boundary.spec.test.ts` | Honest spec-first mapping of §6 acceptance criteria               | AR-P4   |
| ESLint config style         | flat / legacy `.eslintrc.cjs`               | flat `eslint.config.mjs` + `.prettierrc.json`             | ESLint v9 default; matches ESM; §4.1 filename was illustrative    | AR-P5   |
| R15 boundary enforcement    | both / tsc only / eslint only               | both (tsc references + ESLint `no-restricted-imports`)    | Compile error (spec-mandated) + friendly early detection          | AR-P6   |

> **Traceability:** Every scope decision references the plan-level Ambiguity Register
> (`00-ambiguity-register.md`, AR-PN) or the upstream requirements register (AR-NN).

## Acceptance Criteria

Derived verbatim from RD-01 §6:

1. [ ] `yarn install` at the repo root resolves all ten workspaces with no errors.
2. [ ] `yarn turbo run build` builds all ten packages via `tsc --build` with project references intact.
3. [ ] `yarn turbo run typecheck` passes; an artificially added `codegen` import inside `frontend` or `language-server` **fails** the build (proves R15/AR-20 boundary).
4. [ ] `yarn turbo run lint` passes (ESLint + Prettier).
5. [ ] `yarn turbo run test` runs the per-package Vitest smoke tests green (unit tier).
6. [ ] GitHub Actions CI runs install → typecheck → lint → build → test on Node 22 and is green; no emulator tier present (AR-27).
7. [ ] Top-level layout matches §4.1 (`/spec`, `/docs`, `/plans`, `/requirements`, `/research`, `/examples`, `/packages`).
8. [ ] All ten `@blend65/*` packages exist with manifest, tsconfig, placeholder entry, and smoke test; no compiler logic present.
9. [ ] All decisions trace to an `AR-NN` (upstream) or `AR-PN` (plan-level).
10. [ ] All specification tests (ST-*) pass; the R15 boundary spec test fails the violating fixture as designed.
