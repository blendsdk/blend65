# Repository Layout & Root Config: RD-01

> **Document**: 03-01-repo-layout.md
> **Parent**: [Index](00-index.md)

## Overview

Defines the top-level directory structure and the repo-root configuration files. This is
the container into which the ten packages (03-02) and the tooling configs (03-03 ..
03-05) are placed.

## Architecture

### Current Architecture

Doc-only repo: `CHANGELOG.md`, `.clinerules/`, `requirements/`, `research/`, `spec/`.
No root manifest or toolchain files.

### Proposed Changes

Add the §4.1 layout, preserving all existing directories untouched:

```
blend65/                          (repo root — Yarn workspaces + turbo.json)
├── spec/                         → EXISTS — frozen spec-v3.0 (read-only; D3)
├── docs/                         → NEW (empty placeholder; reserved for make_techdocs)
├── plans/                        → EXISTS (this plan lives here)
├── requirements/                 → EXISTS — RD docs + ambiguity register
├── research/                     → EXISTS
├── examples/                     → NEW — sample .blend programs (AR-43 gate program)
├── packages/                     → NEW — the ten @blend65/* packages (see 03-02)
├── package.json                  → NEW — root: workspaces, dev tooling, turbo scripts
├── turbo.json                    → NEW — task graph (see 03-04)
├── tsconfig.base.json            → NEW — shared compiler options (see 03-03)
├── tsconfig.json                 → NEW — solution file referencing all packages
├── .nvmrc                        → NEW — "22"
├── eslint.config.mjs             → NEW — ESLint v9 flat config (AR-P5; see 03-05)
├── .prettierrc.json              → NEW — Prettier config (AR-P5)
├── .gitignore                    → NEW — node_modules, dist, *.tsbuildinfo, coverage
└── .github/workflows/ci.yml      → NEW — GitHub Actions pipeline (see 03-05)
```

> `requirements/` is part of the AR-19 set as the home of the RD documents (RD-01 §4.1
> note). `docs/` is created empty as a reserved placeholder; no techdocs are authored in
> RD-01.

## Implementation Details

### Root `package.json` (shape)

> **Decision per AR-P1:** ESM — `"type": "module"`. **Per AR-10:** Node 22 `engines`.
> **Per AR-4/AR-5:** Yarn classic workspaces. **Per AR-P3:** version `0.1.0`.

```jsonc
{
  "name": "blend65",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "packageManager": "yarn@1.22.22",
  "engines": { "node": ">=22 <23" },
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "turbo run build",
    "typecheck": "turbo run typecheck",
    "lint": "turbo run lint",
    "test": "turbo run test && vitest run test/"
  },
  "devDependencies": {
    "turbo": "^2",
    "typescript": "^5",
    "vite": "^5",
    "vitest": "^2",
    "eslint": "^9",
    "typescript-eslint": "^8",
    "eslint-config-prettier": "^9",
    "prettier": "^3",
    "@types/node": "^22"
  }
}
```

> Exact minor/patch versions are pinned by the generated `yarn.lock` at install time.
> Versions above are floors known to be ESM/Node-22 compatible.

> **AR-P10 (runtime):** `test` is `turbo run test && vitest run test/`. Turbo's `test`
> task only fans out to the 10 per-package suites (each scoped to `src/**` per AR-P8), so a
> second root Vitest pass is appended to run the root `test/` tier (the load-bearing
> `boundary.spec.test.ts`, and future cross-package integration specs). CI runs `yarn test`,
> making ST-R15* a hard gate.

### `.nvmrc`

```
22
```

### `.gitignore` (additions)

```
node_modules/
dist/
*.tsbuildinfo
coverage/
.turbo/
```

### `examples/` seed (AR-43 gate program — placeholder asset only)

`examples/gate/main.blend`:

```blend65
module Main;

function main(): void {
    poke(0xD020, 5);   // VIC-II border color; literal lives in the example, not core (P3)
}
```

> **Decision per AR-43:** this is the canonical MVP gate program. It is placed now as a
> static asset so RD-02+ slices have a real target; **no compiler consumes it in RD-01**.

## Code Examples

### Example 1: Verifying layout

```bash
ls -1 ./                # spec docs plans requirements research examples packages + root files
test -d packages && test -d examples && test -f turbo.json && echo "layout OK"
```

## Error Handling

| Error Case                                  | Handling Strategy                                                        | AR Ref  |
| ------------------------------------------- | ------------------------------------------------------------------------ | ------- |
| `spec/` accidentally modified               | Plan scope excludes `spec/`; reviewer/diff check before commit (D3)      | AR-19   |
| `docs/` created with content                | `docs/` is an empty reserved placeholder in RD-01; techdocs are out of scope | AR-19   |
| Node version mismatch on contributor machine | `.nvmrc` + `engines` floor; `yarn install` warns on engine mismatch      | AR-10   |

## Testing Requirements

- Layout assertion (ST-7): directories exist as specified (`07-testing-strategy.md`).
- Root manifest is valid JSON and declares the `packages/*` workspace glob.
