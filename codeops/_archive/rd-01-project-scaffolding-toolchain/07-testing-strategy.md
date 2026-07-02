# Testing Strategy: RD-01 Project Scaffolding & Toolchain

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Overview

RD-01 is pure infrastructure, so its "specification" is the §6 acceptance criteria. Under
the spec-first protocol, this document enumerates the **specification tests (ST-*)** that
encode those criteria. Because there is no internal logic with edge cases yet, there are
**no `*.impl.test.ts` files** at scaffold stage (per AR-P4 / `code.md` rule 4 — no dead
test code). The naming convention `*.spec.test.ts` is adopted now so RD-02+ slices slot in
cleanly.

## Test Layers

| Layer            | Tooling                | In Scope for RD-01? | Notes                                          |
| ---------------- | ---------------------- | ------------------- | ---------------------------------------------- |
| Unit (spec)      | Vitest                 | ✅ Yes               | Per-package smoke + root boundary test         |
| Golden (asm)     | Test harness (RD-12)   | ❌ No                | No codegen exists yet                          |
| Emulator         | VICE/x16emu/Altirra    | ❌ No (AR-27)        | Explicitly excluded from RD-01 CI              |

## Specification Test Cases (ST-*)

> Each maps to a §6 acceptance criterion and the AR it traces to. "Spec test" = derived
> from the requirement, written to fail until the scaffold satisfies it.

### Per-package smoke tests (`packages/<pkg>/src/index.spec.test.ts`)

| ID    | Package          | Assertion                                  | Trace          |
| ----- | ---------------- | ------------------------------------------ | -------------- |
| ST-1  | core             | `VERSION === "0.1.0"`                       | AR-P3, §6.8    |
| ST-2  | frontend         | `VERSION === "0.1.0"`                       | AR-P3, §6.8    |
| ST-3  | codegen          | `VERSION === "0.1.0"`                       | AR-P3, §6.8    |
| ST-4  | platforms        | `VERSION === "0.1.0"`                       | AR-P3, §6.8    |
| ST-5  | config           | `VERSION === "0.1.0"`                       | AR-P3, §6.8    |
| ST-6  | compiler         | `VERSION === "0.1.0"`                       | AR-P3, §6.8    |
| ST-7  | cli              | `VERSION === "0.1.0"`                       | AR-P3, §6.8    |
| ST-8  | language-server  | `VERSION === "0.1.0"`                       | AR-P3, §6.8    |
| ST-9  | vscode           | `VERSION === "0.1.0"`                       | AR-P3, §6.8    |
| ST-10 | test-harness     | `VERSION === "0.1.0"`                       | AR-P3, §6.8    |

These prove (a) Vitest discovery/wiring is green across the workspace and (b) every
package's entry point builds and exports the baseline constant.

### Root boundary test (`test/boundary.spec.test.ts`) — the load-bearing one

> ⚠️ **Corrected by AR-P7.** ST-R15a/b originally asserted that the injected import made
> **`tsc --build`** fail. Phase 3 proved that false (Yarn-classic hoisting → resolves via
> `node_modules` → `tsc --build` exits 0). The authoritative gate is **ESLint**
> `no-restricted-imports`, so the test now runs **`eslint`** on the violating fixture and
> asserts a **non-zero** exit.

| ID      | Assertion                                                                                            | Trace               |
| ------- | ---------------------------------------------------------------------------------------------------- | ------------------- |
| ST-R15a | With a `@blend65/codegen` import injected into `packages/frontend/src`, `eslint` exits ≠ 0            | R15, AR-20, AR-P7   |
| ST-R15b | With the same import in `packages/language-server/src`, `eslint` exits ≠ 0                            | R15, AR-20, AR-P7   |
| ST-R15c | The clean tree (no injected import) lints with `eslint` exit 0 **and** builds with `tsc --build` exit 0 | §6.2, §6.3, §6.4 |

**Mechanism:** the test writes a temporary `__boundary_violation__.ts` into the target
package, runs **`eslint`** on that file as a child process, captures the exit code, then
deletes the temp file. A non-zero exit (the `no-restricted-imports` rule firing) passes the
test; a zero exit **fails** it (meaning the boundary leaked).

```ts
// test/boundary.spec.test.ts (shape — AR-P7: ESLint is the authoritative gate)
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";

const violation = `import { VERSION } from "@blend65/codegen";\nexport const x = VERSION;\n`;

function lintFails(pkgDir: string): boolean {
  const f = `packages/${pkgDir}/src/__boundary_violation__.ts`;
  writeFileSync(f, violation);
  try {
    execFileSync("yarn", ["eslint", f], { stdio: "pipe" });
    return false; // lint passed → boundary leaked → test should fail
  } catch {
    return true; // lint failed (no-restricted-imports) → boundary enforced → good
  } finally {
    rmSync(f, { force: true });
  }
}

describe("R15 frontend/backend boundary (AR-20, AR-P7)", () => {
  it("ST-R15a: frontend cannot import @blend65/codegen", () => {
    expect(lintFails("frontend")).toBe(true);
  });
  it("ST-R15b: language-server cannot import @blend65/codegen", () => {
    expect(lintFails("language-server")).toBe(true);
  });
});
```


### Pipeline / structural spec checks (CI-asserted)

| ID     | Assertion                                                                       | Trace            |
| ------ | ------------------------------------------------------------------------------- | ---------------- |
| ST-INS | `yarn install --frozen-lockfile` resolves all 10 workspaces, exit 0             | §6.1, AR-4       |
| ST-BLD | `yarn turbo run build` builds all 10 via `tsc --build`, exit 0                  | §6.2             |
| ST-TYP | `yarn turbo run typecheck` exits 0 on clean tree                                | §6.3             |
| ST-LNT | `yarn turbo run lint` (ESLint + Prettier) exits 0                               | §6.4, AR-12      |
| ST-TST | `yarn test` (= `turbo run test` + root `vitest run test/`, AR-P10) runs ST-1..ST-10 + ST-R15* green | §6.5    |
| ST-CI  | CI workflow valid, Node 22, 5 ordered steps, **no** emulator job                | §6.6, AR-11, AR-27 |
| ST-LAY | Top-level layout matches §4.1 (`spec docs plans requirements research examples packages`) | §6.7, AR-19 |
| ST-ESL | `no-restricted-imports` fires on a `codegen` import in frontend (authoritative R15 gate) | AR-P7   |


## Coverage Goals

- **Every §6 acceptance criterion has at least one ST-* test.** (Traceability table above.)
- No coverage-percentage target at scaffold stage (there is no logic to cover); the goal is
  **wiring provably green** + **R15 boundary provably enforced**.

## Test Data / Fixtures

- The only fixture is the transient `__boundary_violation__.ts` written and removed by the
  boundary test. No persistent fixtures, no golden files (those belong to RD-12).
- `examples/gate/main.blend` (AR-43) is a static asset, **not** consumed by any RD-01 test
  (no compiler exists yet).

## Out of Scope (deferred)

- Golden assembly comparison and emulator execution → RD-12 + codegen RDs.
- Any test of compiler behaviour (lexing, parsing, codegen) → RD-02+.
