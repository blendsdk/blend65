# Turbo · Vite · Vitest: RD-01

> **Document**: 03-04-turbo-vite-vitest.md
> **Parent**: [Index](00-index.md)

## Overview

Wires the three runtime tools: **Turborepo** (task graph + caching across the workspace),
**Vite** (per-package bundling — only where a distributable artifact is needed), and
**Vitest** (the unit test tier discovering `*.spec.test.ts`). All three are ESM-native and
align with AR-P1.

## Turborepo (`turbo.json`)

> **Decision per AR-6:** Turborepo is the task runner; per AR-5 it orchestrates the
> workspace. Tasks: `build`, `typecheck`, `lint`, `test`.

```jsonc
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "*.tsbuildinfo"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "lint": {},
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

- `^build` means "build my dependencies first" — Turbo walks the same graph the tsconfig
  references describe, so build order is automatic.
- `typecheck` and `test` depend on `^build` so consumers see fresh `.d.ts` from deps.
- Build outputs are cached; re-running with no source changes is a cache hit.
- The `test` task declares **no `outputs`** at scaffold stage (no coverage is produced
  yet); adding `outputs: ["coverage/**"]` with no coverage emitted triggers Turbo
  "no output files found" warnings (AR-P8). Re-add it when coverage lands in a later RD.

## Vite (per-package — only `cli` and `vscode`)

> **Decision per AR-8:** Vite is the bundler. **Per the 02-current-state risk note:**
> library packages (`core`, `frontend`, `codegen`, `platforms`, `config`, `compiler`,
> `language-server`, `test-harness`) build with **`tsc` only** — they ship `dist/*.js` +
> `.d.ts` and need no bundling. Vite configs exist only for the two packages that produce
> a bundled distributable, avoiding dead config (the §4.5 "where needed" qualifier).

| Package  | Needs Vite? | Why                                                       |
| -------- | ----------- | --------------------------------------------------------- |
| `cli`    | Yes         | Bundle `blendc` into a single self-contained Node binary  |
| `vscode` | Yes         | Bundle the extension/webview (VS Code expects a bundle)   |
| others   | No          | Library packages consumed via workspace; `tsc` emit only  |

At scaffold stage these two Vite configs are **minimal placeholders** (correct `build.lib`
/ target wiring, no real entry logic yet — the CLI/extension code arrives in RD-15/RD-14):

```ts
// packages/cli/vite.config.ts  (placeholder — Node library build)
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "node22",
    lib: { entry: "src/index.ts", formats: ["es"], fileName: "index" },
    outDir: "dist",
  },
});
```

> Until RD-15 fills in the CLI, `cli` may also simply use `tsc` like the libraries; the
> Vite config is staged now so the bundling path is reserved. This is a Should-Have at
> scaffold stage, not a blocker.

## Vitest (workspace-aware unit tier)

> **Decision per AR-9:** Vitest is the unit test framework. **Per AR-P4:** it discovers
> `*.spec.test.ts`. This is the **unit tier only** — golden/emulator tiers (AR-25/AR-26)
> are out of scope (RD-12).

> ⚠️ **Corrected by AR-P8 (2026-06-01).** A single root `vitest.config.ts` is **not
> sufficient** for `turbo run test`. Turbo fans out to each package's `vitest run`, and
> Vitest loads the **nearest** config — the root one — whose root-relative `include` globs
> match nothing from inside a package dir, so every package reports "No test files found"
> and exits 1 under `passWithNoTests: false`. The fix is two layers of config (below).

**Layer 1 — per-package `vitest.config.ts`** (one in each of the ten packages); this is
what `turbo run test` / a package's own `vitest run` uses:

```ts
// packages/<pkg>/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.spec.test.ts"],
    environment: "node",
    passWithNoTests: false,
  },
});
```

**Layer 2 — root `vitest.config.ts`** for a single whole-workspace `yarn vitest` run
(also discovers the root-level boundary test):

```ts
// vitest.config.ts (repo root)
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.spec.test.ts", "test/**/*.spec.test.ts"],
    environment: "node",
    passWithNoTests: false,
  },
});
```

- Per-package config `src/**/*.spec.test.ts` → that package's smoke test (03-02), resolved
  relative to the package dir so `turbo run test` works.
- Root config `packages/*/...` + `test/**/...` → all ten smoke tests + the root-level
  `boundary.spec.test.ts` (R15 test, 07) in one process.
- `passWithNoTests: false` keeps both suites honest (an empty run is a failure).

`turbo run test` fans out to each package's `vitest run` (Layer 1); the root `yarn test`
can also run the whole workspace in one Vitest process (Layer 2). Both paths are wired.

## Code Examples

### Example 1: Full pipeline locally

```bash
yarn turbo run build      # tsc --build across the graph (cached)
yarn turbo run typecheck  # tsc --noEmit per package
yarn turbo run lint       # eslint per package
yarn turbo run test       # vitest run per package (smoke tests green)
```

### Example 2: Cache behaviour

```bash
yarn turbo run build      # MISS — builds everything
yarn turbo run build      # HIT  — "FULL TURBO", no work done
```

## Error Handling

| Error Case                                   | Handling Strategy                                                  | AR Ref  |
| -------------------------------------------- | ------------------------------------------------------------------ | ------- |
| Stale dep `.d.ts` during typecheck           | `typecheck`/`test` `dependsOn: ["^build"]` forces fresh deps       | AR-6    |
| Vitest finds no tests                        | `passWithNoTests: false` → non-zero exit (fail fast)               | AR-9    |
| Vite config present but package uses tsc only | Library packages have NO vite config; only cli/vscode do           | AR-8    |
| Turbo cache poisoning across Node versions   | CI pins Node 22 (03-05); `.nvmrc` locally                          | AR-10   |

## Testing Requirements

- ST-pipeline: `turbo run build|typecheck|lint|test` all exit 0 on the clean scaffold.
- ST-discovery: Vitest discovers and runs all ten smoke tests + the boundary test.
