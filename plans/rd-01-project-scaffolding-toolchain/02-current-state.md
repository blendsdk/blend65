# Current State: RD-01 Project Scaffolding & Toolchain

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

The repository is currently a **documentation-and-specification-only** repo. There is
**no toolchain, no `package.json`, no `node_modules`, no packages directory, and no
TypeScript at all**. All prior work has produced the frozen language spec and the
requirements/ambiguity artifacts that this plan implements.

Top-level contents today:

```
blend65.ri/
├── CHANGELOG.md
├── .clinerules/
│   └── language-guard.md        # the 23-rule language quality gate
├── requirements/                # RD-01..RD-17, ambiguity register (AR-1..93), preflight
├── research/                    # feasibility / strategy notes
└── spec/                        # frozen spec-v3.0 (00–15, appendixes, grammar, build-plan)
```

### Relevant Files

| File                                            | Purpose                                              | Changes Needed                          |
| ----------------------------------------------- | ---------------------------------------------------- | --------------------------------------- |
| `requirements/RD-01-*.md`                       | The requirement this plan implements                 | None (read-only source)                 |
| `requirements/00-ambiguity-register.md`         | Upstream decisions AR-1..AR-93                        | None (read-only source)                 |
| `spec/` (00–15, appendixes, grammar)            | Frozen normative spec; **never edited by tool work** | None — must remain untouched (D3)       |
| `.clinerules/language-guard.md`                 | Language feature quality gate                        | None                                    |
| *(repo root)*                                   | No toolchain files exist                             | **Create** all toolchain + 10 packages  |

### Code Analysis

There is no code to analyze — this plan is greenfield infrastructure. The "specification"
being implemented is RD-01 §3 (decisions R1–R16), §4 (design detail), and §6 (acceptance
criteria), all tracing to AR-1..AR-93 plus the plan-level AR-P1..AR-P6.

A `.clinerules/project.md` does **not** exist yet; only `language-guard.md` is present.
This plan creates the toolchain that a future `analyze_project` run would describe, so
generating `project.md` is a sensible post-completion step (see execution plan Success
Criteria).

## Gaps Identified

### Gap 1: No workspace / package manager wiring

**Current Behavior:** No `package.json`, no Yarn workspace, no lockfile.
**Required Behavior:** Yarn classic (v1) workspace resolving ten `@blend65/*` packages.
**Fix Required:** Create root `package.json` with `workspaces`, install Yarn classic, generate lockfile.

### Gap 2: No TypeScript build system

**Current Behavior:** No TypeScript, no `tsconfig`, no project references.
**Required Behavior:** `tsconfig.base.json` + solution `tsconfig.json` + per-package configs with `references` enforcing the dependency graph (incl. R15 boundary).
**Fix Required:** Author the full project-reference graph.

### Gap 3: No packages

**Current Behavior:** No `packages/` directory.
**Required Behavior:** Ten package skeletons (`core`, `frontend`, `codegen`, `platforms`, `config`, `compiler`, `cli`, `language-server`, `vscode`, `test-harness`), each with manifest, tsconfig, `VERSION` export, and smoke test.
**Fix Required:** Scaffold all ten.

### Gap 4: No test / lint / CI machinery

**Current Behavior:** None.
**Required Behavior:** Vitest unit tier, ESLint flat config + Prettier, Turborepo task graph, GitHub Actions CI on Node 22.
**Fix Required:** Author each config + the workflow.

## Dependencies

### Internal Dependencies

- **None upstream** — RD-01 is the root of the RD dependency graph. Every other RD depends on *it*, not the reverse.

### External Dependencies

- Node 22 (must be installed locally and on CI runners).
- Yarn classic (v1) — installed via `corepack` or globally.
- npm packages (dev): `typescript`, `turbo`, `vite`, `vitest`, `eslint` (v9), `typescript-eslint`, `prettier`, `eslint-config-prettier`, `@types/node`. (Exact versions pinned at install time; all ESM-compatible.)

## Risks and Concerns

| Risk                                                              | Likelihood | Impact | Mitigation                                                                                          |
| ----------------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------------------------------- |
| ESM + `tsc` project references + Vitest interop friction          | Med        | Med    | Use NodeNext consistently (AR-P1); keep library packages on `tsc` (Vite only for cli/vscode bundling) |
| R15 boundary not actually enforced (silent convention)            | Low        | High   | Two-layer enforcement (AR-P6) + a dedicated `boundary.spec.test.ts` that asserts the tsc failure    |
| Accidentally editing the frozen `spec/`                           | Low        | High   | Plan touches only repo root + `packages/` + `examples/`; `spec/` is explicitly read-only (D3)       |
| Yarn classic deprecation / corepack quirks on Node 22             | Low        | Med    | Pin Yarn 1.x; CI uses `--frozen-lockfile`; document the corepack enable step                        |
| ESLint v9 flat-config churn vs `typescript-eslint`                | Med        | Low    | Use the official `typescript-eslint` flat preset; keep config minimal at scaffold stage             |
| Vite config unused for library packages → dead config             | Low        | Low    | Only add Vite config to `cli` and `vscode` (the bundling consumers); libraries build with `tsc` only |
