# RD-01 Project Scaffolding & Toolchain — Implementation Plan

> **Feature**: Stand up the Blend65 monorepo, toolchain, and ten `@blend65/*` package skeletons (infrastructure only — no compiler logic)
> **Status**: Planning Complete
> **Created**: 2026-05-31
> **CodeOps Version**: (unstamped — see note)
> **Source**: [RD-01](../../requirements/RD-01-project-scaffolding-toolchain.md)

## Overview

RD-01 is the **root of the entire requirements dependency graph**: nothing else can be
authored into running code until the workspace exists, the ten `@blend65/*` packages are
declared with their dependency boundaries, and the build/test/lint/CI machinery is in
place. This plan turns RD-01 into a concrete, file-by-file scaffold.

The plan produces an **empty-but-wired** monorepo: Yarn classic (v1) workspaces driven by
Turborepo, TypeScript project references that mirror (and enforce) the package dependency
graph, Vite per-package bundling where needed, a workspace-aware Vitest unit tier, ESLint
v9 flat config + Prettier, and a GitHub Actions CI pipeline running typecheck → lint →
build → test on Node 22. It writes **zero compiler logic** — each package ships only a
`VERSION` constant and a smoke test so the wiring is provably green.

The load-bearing architectural outcome is the **frontend/backend boundary** (R15/AR-20):
`@blend65/frontend` and `@blend65/language-server` must be buildable with **no edge to
`@blend65/codegen`**, enforced as a `tsc --build` compile error (plus an ESLint guard).
This plan makes that boundary a tested invariant from day one.

## Document Index

| #   | Document                                                            | Description                                          |
| --- | ------------------------------------------------------------------- | ---------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)                      | Plan-level Zero-Ambiguity Gate decisions (AR-P1..P6) |
| 00  | [Index](00-index.md)                                                | This document — overview and navigation              |
| 01  | [Requirements](01-requirements.md)                                  | Feature requirements and scope (cross-refs RD-01)    |
| 02  | [Current State](02-current-state.md)                                | Analysis of the current (pre-scaffold) repo          |
| 03-01 | [Repository Layout](03-01-repo-layout.md)                         | Top-level dirs + root config files                   |
| 03-02 | [Packages & Dependencies](03-02-packages-and-dependencies.md)     | The 10 packages, manifests, dependency edges         |
| 03-03 | [TypeScript Configuration](03-03-typescript-config.md)            | `tsconfig.base.json` + per-package references        |
| 03-04 | [Turbo · Vite · Vitest](03-04-turbo-vite-vitest.md)               | Task graph, bundling, test runner wiring             |
| 03-05 | [ESLint · Prettier · CI](03-05-eslint-prettier-ci.md)             | Lint/format config + GitHub Actions pipeline         |
| 07  | [Testing Strategy](07-testing-strategy.md)                          | Spec test cases (ST-*) derived from §6 criteria      |
| 99  | [Execution Plan](99-execution-plan.md)                              | Phases, sessions, and master task checklist          |

> **CodeOps version note:** No `package.json` with a `codeops-mcp` dependency exists yet
> (this plan *creates* the first `package.json`). The version stamp is intentionally left
> unstamped until the toolchain is installed; `upgrade_plan` may stamp it later.

## Quick Reference

### Key Decisions

| Decision                          | Outcome                                                                 | Ref         |
| --------------------------------- | ----------------------------------------------------------------------- | ----------- |
| Implementation language           | TypeScript                                                              | AR-1        |
| Package manager                   | Yarn classic (v1) workspaces                                            | AR-4        |
| Task runner                       | Turborepo                                                               | AR-6        |
| TypeScript build                  | `tsc` with project references                                          | AR-7        |
| Bundler                           | Vite (per-package: `cli` distributable + `vscode` webview)             | AR-8        |
| Unit test framework               | Vitest (workspace-aware)                                                | AR-9        |
| Node version                      | Node 22 (pinned)                                                        | AR-10       |
| CI                                | GitHub Actions (typecheck → lint → build → test; **no** emulator tier) | AR-11, AR-27 |
| Lint / format                     | ESLint v9 flat config + Prettier                                       | AR-12, AR-P5 |
| Module system                     | ESM (`type: module`, NodeNext, ES2023)                                 | AR-P1       |
| Publishable packages              | test-harness, cli, compiler, language-server, vscode                   | AR-P2       |
| Internal (private) packages       | core, frontend, codegen, platforms, config                             | AR-P2       |
| Version baseline                  | `0.1.0`; `export const VERSION = '0.1.0'`                              | AR-P3       |
| Test split                        | `index.spec.test.ts` per pkg + root `boundary.spec.test.ts`            | AR-P4       |
| R15 boundary enforcement          | tsconfig references (compile error) + ESLint `no-restricted-imports`    | AR-P6, AR-20 |

### Package Dependency Graph (R15 boundary is load-bearing)

```
core            (no @blend65 deps)
frontend        → core
codegen         → core, frontend
platforms       → core
config          → core
compiler        → core, frontend, codegen, platforms, config
cli             → compiler, config
language-server → core, frontend          ⛔ NOT codegen   (R15/AR-20)
vscode          → language-server
test-harness    → core (profile types only); NO compiler internals
```

## Related Files

Created by this plan (top level): `package.json`, `turbo.json`, `tsconfig.base.json`,
`tsconfig.json`, `.nvmrc`, `eslint.config.mjs`, `.prettierrc.json`, `.github/workflows/ci.yml`,
plus `packages/<pkg>/{package.json,tsconfig.json,src/index.ts,src/index.spec.test.ts}` for
each of the ten packages, and `examples/` (with the AR-43 gate program placeholder).
