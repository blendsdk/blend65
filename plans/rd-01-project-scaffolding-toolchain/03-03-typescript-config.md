# TypeScript Configuration: RD-01

> **Document**: 03-03-typescript-config.md
> **Parent**: [Index](00-index.md)

## Overview

Defines the TypeScript build: a shared `tsconfig.base.json`, a root solution
`tsconfig.json` that references every package, and per-package `tsconfig.json` files whose
`references` arrays **are** the enforced dependency graph. The reference graph is the
**authoritative** mechanism for the R15 frontend/backend boundary (AR-P6).

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

### Why this enforces R15 (AR-P6, authoritative layer)

Under `composite` project-reference builds, a package can only resolve `@blend65/X`
types/declarations if `X` is in its `references`. Because `frontend` and `language-server`
do **not** reference `codegen`, any `import ... from "@blend65/codegen"` inside them fails
`tsc --build` with `TS6307` ("File is not listed within the file list of project … It is
not part of the project because …") / unresolved-module errors — i.e. a **compile error,
not a convention** (RD-01 §4.2). The secondary ESLint guard (03-05) catches it earlier
with a friendlier message.

## Code Examples

### Example 1: Whole-graph build

```bash
yarn tsc --build tsconfig.json          # builds all 10 in dependency order
yarn tsc --build tsconfig.json --clean  # removes dist + tsbuildinfo
```

## Error Handling

| Error Case                                       | TS Behavior / Code                                                | AR Ref       |
| ------------------------------------------------ | ----------------------------------------------------------------- | ------------ |
| `codegen` import inside `frontend`/`language-server` | `tsc --build` fails (unresolved project ref / `TS6307`)        | AR-20, AR-P6 |
| Missing `composite: true` on a referenced project | `TS6306` "Referenced project must have composite: true"           | §4.3         |
| Relative import without `.js` (NodeNext)         | `TS2835` "relative import paths need explicit file extensions"     | AR-P1        |
| Cyclic project references                        | `tsc` reports a reference cycle; graph in 03-02 is acyclic by design | AR-20      |

## Testing Requirements

- ST-build: `tsc --build` of the solution succeeds and emits `dist/` for all ten.
- ST-R15 (`boundary.spec.test.ts`): injecting a `codegen` import into `frontend` makes
  `tsc --build` exit non-zero (asserted by the test harness; see `07-testing-strategy.md`).
