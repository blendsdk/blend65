# Packages & Dependencies: RD-01

> **Document**: 03-02-packages-and-dependencies.md
> **Parent**: [Index](00-index.md)

## Overview

Defines the ten `@blend65/*` package skeletons, their `package.json` manifests, their
dependency edges (R15 boundary load-bearing), and the placeholder entry + smoke test each
ships. No compiler logic — `src/index.ts` exports only `VERSION` (AR-P3).

## The Ten Packages & Dependency Edges (AR-20, AR-24)

| Package           | Depends on (`@blend65`)                       | Publish (AR-P2) | Notes                                              |
| ----------------- | --------------------------------------------- | --------------- | -------------------------------------------------- |
| `core`            | — (none)                                       | private         | shared types, diagnostics, Instr model, span utils |
| `frontend`        | core                                           | private         | lexer/parser/AST/sema/SFA — ⛔ never codegen        |
| `codegen`         | core, frontend                                 | private         | IL, 6502 codegen, peephole, ACME emitter            |
| `platforms`       | core                                           | private         | platform plugins                                   |
| `config`          | core                                           | private         | blend65.json loading                               |
| `compiler`        | core, frontend, codegen, platforms, config     | **public**      | façade wiring (programmatic API, AR-77)            |
| `cli`             | compiler, config                               | **public**      | `blendc` (yargs+chalk later)                       |
| `language-server` | core, frontend                                 | **public**      | ⛔ NOT codegen (R15/AR-20)                          |
| `vscode`          | language-server                                | **public**      | extension client; bundles LSP                      |
| `test-harness`    | core (profile types only)                      | **public**      | NO compiler internals (AR-24)                      |

> **Critical boundary (R15/AR-20/AR-P6):** `frontend` and `language-server` MUST build
> with no edge to `codegen`. This is enforced by (a) tsconfig `references` omitting
> `codegen` and (b) an ESLint `no-restricted-imports` ban (see 03-03 / 03-05).

## Implementation Details

### Per-package files (every package, identical shape)

```
packages/<pkg>/
├── package.json
├── tsconfig.json            # extends ../../tsconfig.base.json; references its deps (see 03-03)
└── src/
    ├── index.ts             # export const VERSION = '0.1.0';
    └── index.spec.test.ts   # smoke test asserting VERSION === '0.1.0'
```

### `src/index.ts` (identical in all ten)

> **Decision per AR-P3:** single `VERSION` placeholder export; no logic.

```ts
export const VERSION = "0.1.0";
```

### `src/index.spec.test.ts` (identical in all ten)

> **Decision per AR-P4:** `.spec.test.ts` naming; asserts the AR-P3 constant.

```ts
import { describe, expect, it } from "vitest";
import { VERSION } from "./index.js";

describe("@blend65/<pkg> smoke", () => {
  it("exposes VERSION 0.1.0", () => {
    expect(VERSION).toBe("0.1.0");
  });
});
```

> Note the `./index.js` import specifier — NodeNext ESM resolution requires the `.js`
> extension on relative imports of `.ts` sources (decision per AR-P1; not a separate
> ambiguity — it is the mechanical consequence of NodeNext).

### Manifest — private library package (e.g. `core`)

> **Decision per AR-P1** (ESM), **AR-P2** (`private: true`), **AR-P3** (`0.1.0`).

```jsonc
{
  "name": "@blend65/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "scripts": {
    "build": "tsc --build",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run"
  }
}
```

### Manifest — package with workspace deps (e.g. `frontend`)

```jsonc
{
  "name": "@blend65/frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "dependencies": { "@blend65/core": "0.1.0" },
  "scripts": {
    "build": "tsc --build",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run"
  }
}
```

> **Yarn-classic note:** Yarn v1 (AR-4) does NOT support the `workspace:*` protocol
> (that is Yarn Berry / pnpm). Yarn classic links a workspace by **semver match** — so the
> dependency is declared with the shared baseline version `"0.1.0"` (AR-P3), which Yarn v1
> satisfies from the in-repo workspace rather than the registry. This is a mechanical
> consequence of AR-4, not a design choice.

> `frontend` lists ONLY `@blend65/core` — NOT `@blend65/codegen` (R15/AR-20).
> `language-server` likewise lists only `@blend65/core` + `@blend65/frontend`.

### Manifest — publishable package (e.g. `test-harness`)

> **Decision per AR-P2:** publishable surfaces add `publishConfig.access: public`
> (required for scoped packages). `test-harness` depends only on `core` profile types
> (AR-24) — never compiler internals.

```jsonc
{
  "name": "@blend65/test-harness",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "publishConfig": { "access": "public" },
  "dependencies": { "@blend65/core": "0.1.0" },
  "scripts": {
    "build": "tsc --build",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",

    "test": "vitest run"
  }
}
```

The other publishable packages (`compiler`, `cli`, `language-server`, `vscode`) follow
the same pattern (no `private`, with `publishConfig.access: public`) with their
respective dependency lists from the table above.

## Code Examples

### Example 1: Workspace resolution check

```bash
yarn install                     # resolves all 10 packages/*
yarn workspaces info             # shows the @blend65/* dependency graph
```

### Example 2: A deliberate R15 violation (the boundary fixture)

```ts
// packages/frontend/src/__boundary_violation__.ts (created ONLY by the boundary test fixture)
import { VERSION } from "@blend65/codegen"; // must fail tsc --build (codegen not referenced)
export const x = VERSION;
```

## Error Handling

| Error Case                                        | Handling Strategy                                                          | AR Ref       |
| ------------------------------------------------- | -------------------------------------------------------------------------- | ------------ |
| `frontend`/`language-server` imports `codegen`    | `tsc --build` fails (codegen not in `references`); ESLint also errors      | AR-20, AR-P6 |
| Scoped publishable package missing `access:public`| Manifest template includes `publishConfig.access: public`                  | AR-P2        |
| `test-harness` imports compiler internals         | Only `@blend65/core` is a declared dep; ESLint restricted-import guard      | AR-24        |
| Workspace dep version drift                       | Yarn v1 semver-matches `"0.1.0"` to the in-repo workspace (not registry)   | AR-4         |


## Testing Requirements

- ST-1..ST-10 per-package smoke tests assert `VERSION === '0.1.0'` (`07-testing-strategy.md`).
- ST-R15 boundary test asserts the violation fixture fails `tsc --build`.
