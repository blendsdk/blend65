# ESLint · Prettier · CI: RD-01

> **Document**: 03-05-eslint-prettier-ci.md
> **Parent**: [Index](00-index.md)

## Overview

Defines lint/format configuration (ESLint v9 flat config + Prettier, per AR-12/AR-P5) and
the GitHub Actions CI pipeline (AR-11). ESLint also carries the **secondary** R15 boundary
guard (`no-restricted-imports`) per AR-P6.

## ESLint (flat config `eslint.config.mjs`)

> **Decision per AR-P5:** ESLint v9 flat config (the legacy `.eslintrc.cjs` shown in
> RD-01 §4.1 is illustrative and superseded). Uses the official `typescript-eslint` flat
> preset + `eslint-config-prettier` to disable formatting rules (Prettier owns format).

```js
// eslint.config.mjs (repo root)
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/*.tsbuildinfo", "**/coverage/**"] },
  ...tseslint.configs.recommended,

  // R15 secondary guard (AR-P6): friendly early ban of @blend65/codegen
  // inside the frontend and language-server packages.
  {
    files: ["packages/frontend/**/*.ts", "packages/language-server/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@blend65/codegen", "@blend65/codegen/*"],
              message:
                "R15/AR-20 boundary: frontend & language-server must not depend on @blend65/codegen.",
            },
          ],
        },
      ],
    },
  },

  prettier,
);
```

> The tsconfig project-reference layer (03-03) remains the **authoritative**, spec-mandated
> enforcement (compile error). This ESLint rule is the friendlier, earlier signal.

## Prettier (`.prettierrc.json`)

> **Decision per AR-P5.**

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "endOfLine": "lf"
}
```

`prettier --check .` runs as part of `lint` (or a dedicated `format:check` script). A
`.prettierignore` excludes `dist/`, `coverage/`, and `*.tsbuildinfo`.

## GitHub Actions CI (`.github/workflows/ci.yml`)

> **Decision per AR-11:** GitHub Actions. **Per AR-27:** **no emulator tier** in CI for
> RD-01 (golden/emulator tiers arrive with RD-12). **Per §4.8:** frozen lockfile.
> **Per AR-10:** Node 22.

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "yarn"

      - name: Enable Corepack (Yarn classic)
        run: corepack enable

      - name: Install (frozen lockfile)
        run: yarn install --frozen-lockfile

      - name: Typecheck
        run: yarn turbo run typecheck

      - name: Lint
        run: yarn turbo run lint

      - name: Build
        run: yarn turbo run build

      - name: Test (unit tier)
        run: yarn turbo run test
```

Order is install → typecheck → lint → build → test, matching the §6 acceptance criteria.
No emulator/golden steps (AR-27); those are added by RD-12.

## Code Examples

### Example 1: Local lint + format check

```bash
yarn turbo run lint            # eslint (incl. R15 no-restricted-imports guard)
yarn prettier --check .        # formatting gate
```

### Example 2: The ESLint R15 guard firing

```ts
// inside packages/frontend/src/foo.ts
import { x } from "@blend65/codegen";
//                 ^ error  no-restricted-imports
//   "R15/AR-20 boundary: frontend & language-server must not depend on @blend65/codegen."
```

## Error Handling

| Error Case                                       | Handling Strategy                                                | AR Ref       |
| ------------------------------------------------ | ---------------------------------------------------------------- | ------------ |
| `codegen` import in frontend/language-server     | ESLint `no-restricted-imports` error (+ tsc compile error)       | AR-P6, AR-20 |
| Formatting drift                                 | `prettier --check` fails CI; `prettier --write` fixes locally    | AR-12        |
| Lockfile out of date in CI                       | `yarn install --frozen-lockfile` fails fast                      | §4.8         |
| Wrong Node version on runner                     | `setup-node` pins `22`; `engines` floor in manifests             | AR-10        |
| Lint rules conflict with Prettier                | `eslint-config-prettier` last in config disables formatting rules | AR-P5       |

## Testing Requirements

- ST-lint: `turbo run lint` exits 0 on the clean scaffold.
- ST-ci: the workflow file is valid YAML, pins Node 22, uses frozen lockfile, runs the
  five steps in order, and contains **no** emulator/golden job (AR-27 negative check).
- ST-R15-eslint: a `codegen` import in `frontend` produces a `no-restricted-imports` error.
