# TypeScript Configuration: RD-01

> **Document**: 03-03-typescript-config.md
> **Parent**: [Index](00-index.md)

## Overview

Defines the TypeScript build: a shared `tsconfig.base.json`, a root solution
`tsconfig.json` that references every package, and per-package `tsconfig.json` files whose
`references` arrays model the dependency graph and drive `composite` build ordering.

> ⚠️ **Corrected by AR-P7 (2026-06-01).** This document originally claimed the tsc
> `references` graph was the **authoritative** R15 enforcement mechanism. Phase 3
> verification disproved that: under Yarn-classic workspace hoisting, a non-referenced
> `@blend65/codegen` import in `frontend`/`language-server` still resolves via
> `node_modules/@blend65/codegen/dist/*.d.ts`, so `tsc --build` does **not** fail. The
> reference graph is **necessary but not sufficient** for R15. The **authoritative** R15
> gate is now the ESLint `no-restricted-imports` rule (see `03-05-eslint-prettier-ci.md`
> and AR-P7). The `references` arrays below are still required for correct build ordering
> and an accurate dependency model, and `frontend`/`language-server` still correctly omit
> `codegen`.


## Architecture

### Proposed Changes

```
tsconfig.base.json        # compilerOptions shared by all packages (strict, composite, ESM)
tsconfig.json             # solution file: references all 10 packages (no files of its own)
packages/<pkg>/tsconfig.json
                          # extends ../../tsconfig.base.json; rootDir src; outDir dist;
                          # references → ONLY this package's direct @blend65 deps
```

## Implementation Details

### `tsconfig.base.json`

> **Decisions:** `strict` per RD-01 §4.3; `composite`/`declaration` required for project
> references; module settings per AR-P1 (ESM/NodeNext/ES2023).

```jsonc
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2023"],
    "types": ["node"],

    "strict": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,

    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "incremental": true,

    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  }
}
```

### Root solution `tsconfig.json`

```jsonc
{
  "files": [],
  "references": [
    { "path": "packages/core" },
    { "path": "packages/frontend" },
    { "path": "packages/codegen" },
    { "path": "packages/platforms" },
    { "path": "packages/config" },
    { "path": "packages/compiler" },
    { "path": "packages/cli" },
    { "path": "packages/language-server" },
    { "path": "packages/vscode" },
    { "path": "packages/test-harness" }
  ]
}
```

`yarn tsc --build` (or `turbo run build`) on this solution builds the whole graph in
dependency order.

### Per-package `tsconfig.json` — the reference graph IS the dependency graph

Each package extends the base, emits to `dist/`, and lists **only its direct
`@blend65` dependencies** in `references` (matching the 03-02 table exactly):

```jsonc
// packages/core/tsconfig.json   (no deps)
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src"],
  "references": []
}
```

```jsonc
// packages/frontend/tsconfig.json   → core ONLY (NOT codegen — R15)
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src"],
  "references": [{ "path": "../core" }]
}
```

```jsonc
// packages/codegen/tsconfig.json   → core, frontend
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src"],
  "references": [{ "path": "../core" }, { "path": "../frontend" }]
}
```

```jsonc
// packages/language-server/tsconfig.json   → core, frontend  (⛔ NO codegen — R15)
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src"],
  "references": [{ "path": "../core" }, { "path": "../frontend" }]
}
```

Complete reference map (mirrors 03-02):

| Package           | `references`                                        |
| ----------------- | --------------------------------------------------- |
| core              | (none)                                              |
| frontend          | core                                                |
| codegen           | core, frontend                                      |
| platforms         | core                                                |
| config            | core                                                |
| compiler          | core, frontend, codegen, platforms, config          |
| cli               | compiler, config                                    |
| language-server   | core, frontend                  **⛔ NOT codegen**  |
| vscode            | language-server                                     |
| test-harness      | core                                                |

### R15 enforcement: `references` model the graph, ESLint enforces the boundary (AR-P7)

> ⚠️ **Corrected by AR-P7.** The original theory here was that, under `composite`
> project-reference builds, a package could only resolve `@blend65/X` if `X` was in its
> `references`, so a `codegen` import in `frontend`/`language-server` would fail
> `tsc --build` with `TS6307`. **This does not hold in a Yarn-classic workspace.** Every
> workspace is symlinked into the root `node_modules/@blend65/*`, so NodeNext module
> resolution finds `@blend65/codegen`'s built `dist/*.d.ts` directly. tsc's `references`
> list only governs build ordering and which referenced projects are redirected to source
> — it never *forbids* resolving a non-referenced package through `node_modules`. Phase 3
> empirically confirmed the illegal import builds with `EXIT=0`.

What the `references` arrays still give us (and why they remain mandatory):

- correct `composite` **build ordering** for the whole graph via `tsc --build`,
- an accurate, machine-checked **dependency model** (each package declares only its direct
  `@blend65` deps), and
- `frontend`/`language-server` correctly omit `codegen`, keeping the model truthful.

The **authoritative** R15 gate is the ESLint `no-restricted-imports` rule (severity
`error`) defined in `03-05-eslint-prettier-ci.md`: it bans `@blend65/codegen` (and deep
paths) in `frontend` and `language-server`, making `eslint .` exit non-zero — a real CI
gate (Phase 7). `boundary.spec.test.ts` asserts that lint failure. dependency-cruiser is
the documented future upgrade (AR-P7) if transitive/dynamic-import enforcement is needed.


## Code Examples

### Example 1: Whole-graph build

```bash
yarn tsc --build tsconfig.json          # builds all 10 in dependency order
yarn tsc --build tsconfig.json --clean  # removes dist + tsbuildinfo
```

## Error Handling

| Error Case                                       | TS Behavior / Code                                                | AR Ref       |
| ------------------------------------------------ | ----------------------------------------------------------------- | ------------ |
| `codegen` import inside `frontend`/`language-server` | **Not** caught by tsc (resolves via `node_modules` — AR-P7). Caught by ESLint `no-restricted-imports` (`eslint .` exit ≠ 0). | AR-20, AR-P7 |
| Missing `composite: true` on a referenced project | `TS6306` "Referenced project must have composite: true"           | §4.3         |
| Relative import without `.js` (NodeNext)         | `TS2835` "relative import paths need explicit file extensions"     | AR-P1        |
| Cyclic project references                        | `tsc` reports a reference cycle; graph in 03-02 is acyclic by design | AR-20      |

## Testing Requirements

- ST-build: `tsc --build` of the solution succeeds and emits `dist/` for all ten.
- ST-R15 (`boundary.spec.test.ts`, corrected per AR-P7): injecting a `codegen` import into
  `frontend` makes **`eslint .` exit non-zero** (the authoritative gate), asserted by the
  test harness; see `07-testing-strategy.md`. tsc `--build` is **not** expected to fail on
  this violation.

