# RD-01: Project Scaffolding & Toolchain

> **Status**: 🟢 Authored
> **MVP Phase**: A
> **Depends On**: — (root of the dependency graph; every other RD depends on this)
> **Implements**: repository/toolchain architecture decisions, not a language chapter
> **Owning package(s)**: repo root + all `@blend65/*` packages (skeletons)
> **Created**: 2026-05-31
> **Last Updated**: 2026-05-31

---

## 1. Purpose

This document specifies the **monorepo, toolchain, and package skeleton** that every
subsequent RD builds on. It is the root of the RD dependency graph: nothing else can be
authored into running code until the workspace exists, the ten `@blend65/*` packages are
declared with their dependency boundaries, and the build/test/lint/CI machinery is in
place.

RD-01 is deliberately **infrastructure only**. It stands up the *empty but wired*
monorepo — package manifests, TypeScript project references, the Turborepo task graph,
Vitest, ESLint+Prettier, and a GitHub Actions pipeline — so that the vertical walking
skeleton (AR-38) has a place to grow one slice at a time. It writes **no compiler logic**;
the lexer (RD-02), platform plugins (RD-10), diagnostics (RD-11), etc., fill these
skeletons later. The first end-to-end MVP gate program (AR-43) cannot compile until the
packages defined here exist.

## 2. Scope

**In scope:**
- Yarn classic (v1) workspace at the repo root with Turborepo (`turbo.json`).
- The ten `@blend65/*` package directories (AR-20 nine + `test-harness` AR-24), each with
  `package.json`, `tsconfig.json`, and a placeholder entry module.
- Root TypeScript configuration with project references mirroring the dependency graph.
- `tsc` build pipeline; Vite per-package bundling configuration (AR-8).
- Vitest configuration (workspace-aware) for the unit tier (AR-22).
- ESLint + Prettier configuration (AR-12), repo-wide.
- GitHub Actions CI running build + lint + unit/golden tiers (AR-11, AR-27).
- Node version pin (`.nvmrc` / `engines`) to Node 22 (AR-10).
- Repo top-level directory layout: `/spec`, `/docs`, `/plans`, `/research`, `/examples`,
  `/packages` (AR-19).

**Out of scope (and where it lives instead):**
- `blend65.json` config schema/loading → RD-16.
- CLI command surface (`blendc`, yargs) → RD-15.
- Emulator driver / harness implementation → RD-12 (this RD only creates the empty
  `@blend65/test-harness` package shell).
- Any lexer/parser/semantic/codegen logic → RD-02..RD-09, RD-17.
- The actual diagnostics engine implementation → RD-11 (this RD only creates the
  `@blend65/core` shell where it will live).

> **Traceability rule:** Every decision below cites the Ambiguity Register entry
> (`AR-NN`, in `00-ambiguity-register.md`) that resolved it. No decision is invented here —
> discovery is closed (Zero-Ambiguity Gate PASSED).

## 3. Decisions & Requirements

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R1 | Implementation language | TypeScript everywhere | AR-1 |
| R2 | Package manager | Yarn classic (v1) workspaces | AR-4 |
| R3 | Repository structure | Monorepo | AR-5 |
| R4 | Task runner | Turborepo (`turbo`) | AR-6 |
| R5 | TypeScript build | `tsc` (project references) | AR-7 |
| R6 | Bundler | Vite, repo-wide, per-package; bundles CLI distributable + VS Code webview UI | AR-8 |
| R7 | Unit test framework | Vitest | AR-9 |
| R8 | Node version | Node 22 (pinned LTS) | AR-10 |
| R9 | CI | GitHub Actions | AR-11 |
| R10 | Lint / format | ESLint + Prettier | AR-12 |
| R11 | npm scope | `@blend65/*` | AR-21 |
| R12 | Package layout | 9-package frontend/backend split + `test-harness` = 10 | AR-20, AR-24 |
| R13 | Top-level repo layout | `/spec`, `/docs`, `/plans`, `/packages` (+`/research`, `/examples`) | AR-19 |
| R14 | Build methodology constraint | Skeletons must support additive growth (vertical walking skeleton); no package boundary forces a later reshape | AR-38 |
| R15 | Frontend/backend boundary | `@blend65/language-server` and `@blend65/frontend` must NOT depend on `@blend65/codegen` | AR-20 |
| R16 | CI emulator policy | Unit + golden tiers run in GH Actions; emulator tier is local-only for now | AR-27 |

## 4. Design Detail

### 4.1 Top-level repository layout (AR-19)

```
blend65/                      (repo root — Yarn workspaces + turbo.json)
├── spec/                     → frozen spec-v3.0 (normative; never edited by compiler work)
├── docs/                     → reserved for make_techdocs VitePress site
├── plans/                    → make_plan output (committed)
├── requirements/             → RD documents + ambiguity register (this file lives here)
├── research/                 → research notes
├── examples/                 → sample .blend programs (incl. the AR-43 gate program)
├── packages/                 → the ten @blend65/* packages
├── package.json              → root: workspaces, dev tooling, turbo scripts
├── turbo.json                → task graph (build, test, lint, typecheck)
├── tsconfig.base.json        → shared compiler options
├── tsconfig.json             → solution file referencing all packages
├── .nvmrc                    → 22
├── .eslintrc.cjs             → ESLint config (extends per package)
├── .prettierrc               → Prettier config
└── .github/workflows/ci.yml  → GitHub Actions pipeline
```

> `requirements/` is added to the AR-19 set as the home of these RD documents and the
> ambiguity register; this is an organizational location for the discovery/authoring
> artifacts and carries no semantic ambiguity (it neither contradicts nor extends AR-19's
> committed `/spec`, `/docs`, `/plans`, `/packages` decisions).

### 4.2 The ten packages and their dependency edges (AR-20, AR-24)

```
packages/
├── core            → shared types, diagnostics engine, Instr model, span utils      (no @blend65 deps)
├── frontend        → lexer, parser, AST, semantic analysis, SFA planner             → core
├── codegen         → IL, IL optimizer, 6502 codegen, peephole, ACME emitter         → core, frontend
├── platforms       → platform plugins (c64, c64u, cx16, a800xl, a7800)              → core
├── config          → blend65.json loading + validation (JSONC)                      → core
├── compiler        → thin façade wiring frontend+codegen+platforms+config           → core, frontend, codegen, platforms, config
├── cli             → blendc command (yargs + chalk)                                 → compiler, config
├── language-server → LSP server (keep-ready; not built in MVP)                       → core, frontend   ⛔ NOT codegen
├── vscode          → VS Code extension client; bundles language-server               → language-server
└── test-harness    → published emulator test harness (EmulatorDriver)               → core (profile types only); NO compiler internals
```

**Critical boundary (R15, AR-20):** the **frontend/backend split** is the load-bearing
architectural line. `language-server` and `frontend` must be buildable and testable with
**no edge to `codegen`**. CI and `tsconfig` project references must make a violation a
**compile error**, not a convention. `test-harness` (AR-24) operates on any binary +
profile and must not import compiler internals.

Each package ships, at scaffolding time, only:
- `package.json` — name `@blend65/<pkg>`, `private` where unpublished, workspace deps.
- `tsconfig.json` — extends `tsconfig.base.json`, declares `references` to its deps.
- `src/index.ts` — placeholder export (e.g. a version constant) so `tsc` + Vitest have a
  real target. No logic.
- `src/index.test.ts` — a trivial smoke test so the Vitest wiring is proven green.

### 4.3 TypeScript configuration

- `tsconfig.base.json`: `strict: true`, `composite: true`, `declaration: true`,
  `target`/`lib` aligned to Node 22, `moduleResolution` per the Yarn-classic layout.
- Each package `tsconfig.json` sets `references` matching its dependency edges in §4.2,
  so `tsc --build` enforces the boundary (R15) and gives incremental builds.
- Root `tsconfig.json` is a solution file referencing all ten packages.

### 4.4 Turborepo task graph (`turbo.json`)

Pipeline tasks: `build` (depends on upstream `^build`), `typecheck`, `lint`, `test`
(unit + golden tiers; the emulator tier is a separate, non-CI task per R16/AR-27).
`build` outputs (`dist/`, `*.tsbuildinfo`) are cached.

### 4.5 Vite (AR-8)

Per-package Vite config is provided where bundling is needed (the `cli` distributable and
the `vscode` webview UI). Library packages build with `tsc`; Vite is configured
repo-wide and applied per-package as AR-8 specifies (both roles, decided per-package).

### 4.6 Vitest (AR-22 unit tier)

Workspace-aware Vitest configuration discovers `*.test.ts` across packages. RD-01 only
establishes the **unit tier** wiring and a placeholder smoke test per package; the
**golden** and **emulator** tiers are defined by RD-12 and the codegen RDs, but the
runner they plug into is created here.

### 4.7 ESLint + Prettier (AR-12)

Shared root config; per-package overrides allowed. `lint` is a Turborepo task and a CI
gate.

### 4.8 GitHub Actions CI (AR-11, AR-27)

A single `ci.yml` on push/PR: install (Yarn classic, frozen lockfile) → `typecheck` →
`lint` → `build` → `test` (unit + golden only). **No emulator tier in CI** (R16/AR-27);
a headless-VICE job on a self-hosted runner is deferred. Node pinned to 22 (R8).

## 5. Interactions With Other RDs

| RD | Relationship |
|----|--------------|
| RD-02..RD-09, RD-17 | Fill the `frontend` / `codegen` package skeletons created here. |
| RD-10 | Implements the `platforms` package; first profile (c64) is MVP. |
| RD-11 | Implements the diagnostics + resource-report engine inside the `core` shell. |
| RD-12 | Implements `test-harness` (EmulatorDriver) inside the package shell created here; adds golden + emulator tiers to the Vitest/Turbo wiring. |
| RD-13 | Non-functional requirements (performance, portability, maintainability) constrain the toolchain choices ratified here. |
| RD-14 | Builds `language-server` / `vscode`; relies on the frontend/backend boundary (R15) being enforced from day one. |
| RD-15 | Implements the `cli` (`blendc`) on top of the `compiler` façade package. |
| RD-16 | Implements `config` (`blend65.json`) inside the package shell created here. |

## 6. Acceptance Criteria

- [ ] `yarn install` at the repo root resolves all ten workspaces with no errors.
- [ ] `yarn turbo run build` builds all ten packages via `tsc --build` with project
      references intact.
- [ ] `yarn turbo run typecheck` passes; an artificially added `codegen` import inside
      `frontend` or `language-server` **fails** the build (proves R15/AR-20 boundary).
- [ ] `yarn turbo run lint` passes (ESLint + Prettier).
- [ ] `yarn turbo run test` runs the per-package Vitest smoke tests green (unit tier).
- [ ] GitHub Actions CI runs install → typecheck → lint → build → test on Node 22 and is
      green; no emulator tier present (AR-27).
- [ ] Top-level layout matches §4.1 (`/spec`, `/docs`, `/plans`, `/requirements`,
      `/research`, `/examples`, `/packages`).
- [ ] All ten `@blend65/*` packages exist with manifest, tsconfig, placeholder entry, and
      smoke test; no compiler logic present.
- [ ] All decisions in §3 trace to an `AR-NN`.

## 7. Open Questions

> Discovery is **closed** (Zero-Ambiguity Gate PASSED). One organizational note was made
> in §4.1 (`requirements/` as the RD home) which is consistent with AR-19 and introduces
> no new ambiguity. If implementation surfaces a genuinely new ambiguity, STOP, add it to
> `00-ambiguity-register.md` as the next `AR-NN` (tagged `(runtime)`), resolve it with the
> user, then resume.

[None.]
