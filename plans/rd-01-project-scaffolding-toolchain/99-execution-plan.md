# Execution Plan: RD-01 Project Scaffolding & Toolchain

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)

## Overview

Ordered, resumable plan to build the Blend65 monorepo scaffold. The work is grouped into
phases that each end at a **green checkpoint** (something runnable/verifiable). Because
RD-01 is the root of the RD graph, this plan is greenfield — every step *creates* files;
none modify the frozen `spec/`.

The guiding sequence: **root wiring → packages → build graph → tooling → tests → CI → verify**.

## Spec-First Reminder

Per the spec-first protocol and AR-P4, write the **spec tests (ST-*) first** where they can
fail meaningfully (the boundary test, the smoke tests), then make them pass. There are no
`*.impl.test.ts` files at this stage (no internal logic). See `07-testing-strategy.md`.

## Phase 1 — Root Workspace Wiring

**Goal:** an installable, empty Yarn workspace.

- [ ] Create root `package.json` (ESM, Node 22 engines, `workspaces: ["packages/*"]`, dev deps, turbo scripts) — `03-01`
- [ ] Create `.nvmrc` (`22`), `.gitignore`, `.prettierignore` — `03-01`
- [ ] Create top-level dirs: `packages/`, `examples/`, `docs/` (empty placeholder) — `03-01`
- [ ] `corepack enable` + `yarn install` → generates `yarn.lock`, exit 0
- **Checkpoint:** `yarn install` resolves with zero workspaces-not-found errors.

## Phase 2 — Package Skeletons (×10)

**Goal:** ten `@blend65/*` packages with manifest + entry + smoke test.

- [ ] For each of `core, frontend, codegen, platforms, config, compiler, cli, language-server, vscode, test-harness`:
  - [ ] `packages/<pkg>/package.json` (correct `private`/`publishConfig` per AR-P2; deps per 03-02 table; `0.1.0`)
  - [ ] `packages/<pkg>/src/index.ts` → `export const VERSION = "0.1.0";`
  - [ ] `packages/<pkg>/src/index.spec.test.ts` → asserts `VERSION === "0.1.0"` (ST-1..ST-10)
- [ ] `yarn install` again to link the workspace dependency graph
- **Checkpoint:** `yarn workspaces info` shows the expected `@blend65/*` edges (incl. NO frontend→codegen / language-server→codegen edge).

## Phase 3 — TypeScript Build Graph

**Goal:** the whole graph builds via project references; R15 boundary enforced by `tsc`.

- [ ] Create `tsconfig.base.json` (strict, composite, NodeNext/ES2023) — `03-03`
- [ ] Create root solution `tsconfig.json` referencing all 10 packages — `03-03`
- [ ] Create each `packages/<pkg>/tsconfig.json` with `references` per the 03-03 map (frontend & language-server **omit** codegen)
- [ ] `yarn tsc --build tsconfig.json` → all 10 emit `dist/`, exit 0 (ST-BLD)
- **Checkpoint:** clean build succeeds; manually injecting a `codegen` import into `frontend` makes `tsc --build` fail (manual pre-check of ST-R15a).

## Phase 4 — Task Runner, Bundler, Test Runner

**Goal:** Turbo orchestrates; Vitest discovers; Vite staged for cli/vscode.

- [ ] Create `turbo.json` (build/typecheck/lint/test, `^build` deps, outputs) — `03-04`
- [ ] Create root `vitest.config.ts` (discovers `*.spec.test.ts`, `passWithNoTests: false`) — `03-04`
- [ ] Create `packages/cli/vite.config.ts` + `packages/vscode/vite.config.ts` (placeholders) — `03-04`
- [ ] `yarn turbo run build` and `yarn turbo run test` → green (ST-1..ST-10 pass)
- **Checkpoint:** `turbo run test` runs all ten smoke tests green.

## Phase 5 — Lint & Format

**Goal:** ESLint flat config + Prettier green, incl. the R15 ESLint guard.

- [ ] Create `eslint.config.mjs` (typescript-eslint preset + `no-restricted-imports` R15 guard + prettier) — `03-05`
- [ ] Create `.prettierrc.json` — `03-05`
- [ ] `yarn turbo run lint` + `yarn prettier --check .` → exit 0 (ST-LNT)
- [ ] Verify ST-ESL: a temporary `codegen` import in `frontend` triggers `no-restricted-imports`
- **Checkpoint:** lint + format gates pass on the clean tree.

## Phase 6 — Spec Tests (boundary) & Examples

**Goal:** the load-bearing R15 spec test exists and passes; AR-43 example seeded.

- [ ] Create `test/boundary.spec.test.ts` (ST-R15a/b/c) — `07`
- [ ] Wire the root tier into CI's test command (AR-P10): root `test` script = `turbo run test && vitest run test/` so the root `test/` dir actually runs (Turbo's `test` task only fans out to per-package `src/**`)
- [ ] `yarn test` → per-package suites + boundary test green
- [ ] Create `examples/gate/main.blend` (AR-43 gate program, static asset) — `03-01`
- **Checkpoint:** ST-R15* green — the frontend/backend boundary is a tested invariant.

## Phase 7 — CI

**Goal:** GitHub Actions runs the full gate on Node 22, no emulator tier.

- [ ] Create `.github/workflows/ci.yml` (install→typecheck→lint→build→test, Node 22, frozen lockfile) — `03-05`
- [ ] Push branch / open PR → CI green (ST-CI); confirm no emulator/golden job (AR-27)
- **Checkpoint:** CI is green end-to-end.

## Phase 8 — Verification & Handoff

**Goal:** all §6 acceptance criteria + ST-* satisfied; project metadata generated.

- [ ] Walk the §6 / ST-* traceability (01-requirements + 07) — every criterion has a passing test
- [ ] Confirm `spec/` is untouched (D3) via `git status`
- [ ] (Recommended) Run `analyze_project` to generate `.clinerules/project.md` now that the toolchain exists
- [ ] Update `CHANGELOG.md` with the scaffold entry
- **Checkpoint:** RD-01 complete; RD-02 (Lexer) can begin against a green skeleton.

## Master Task Checklist (condensed)

- [ ] **P1** Root workspace installs
- [ ] **P2** Ten package skeletons linked
- [ ] **P3** `tsc --build` graph green + R15 compile-error verified
- [ ] **P4** Turbo/Vitest/Vite wired; smoke tests green
- [ ] **P5** ESLint + Prettier green (incl. R15 guard)
- [ ] **P6** `boundary.spec.test.ts` green; AR-43 example seeded
- [ ] **P7** GitHub Actions CI green (no emulator tier)
- [ ] **P8** §6/ST-* verified; `project.md` generated; CHANGELOG updated

## Success Criteria (maps to §6 / ST-*)

| # | Criterion                                                            | Verified by      |
| - | -------------------------------------------------------------------- | ---------------- |
| 1 | `yarn install` resolves all 10 workspaces                            | ST-INS / P1      |
| 2 | `turbo run build` builds all 10 via project references               | ST-BLD / P3      |
| 3 | `typecheck` passes; codegen import in frontend/LS **fails** build     | ST-TYP, ST-R15* / P3,P6 |
| 4 | `turbo run lint` passes (ESLint + Prettier)                          | ST-LNT, ST-ESL / P5 |
| 5 | `yarn test` (`turbo run test` + root `vitest run test/`, AR-P10) runs smoke + boundary tests green | ST-TST / P4,P6 |
| 6 | CI green on Node 22, no emulator tier                                | ST-CI / P7       |
| 7 | Top-level layout matches §4.1                                        | ST-LAY / P1      |
| 8 | All 10 packages exist with no compiler logic                        | ST-1..ST-10 / P2 |
| 9 | All decisions trace to AR-NN or AR-PN                               | 00-ambiguity-register |

## Risks at Execution Time

See `02-current-state.md` Risks table. The two to watch: (1) ESM + NodeNext + Vitest
interop — mitigated by keeping libraries on `tsc`; (2) ensuring the R15 boundary is a real
compile error, not just lint — mitigated by ST-R15* asserting the `tsc --build` exit code.

> **Runtime ambiguities:** if any new decision surfaces during execution, STOP, add it to
> `00-ambiguity-register.md` as the next `AR-PN (runtime)`, resolve with the user, resume.
