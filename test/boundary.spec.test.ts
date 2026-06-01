import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";

// ST-R15a/b/c — the load-bearing R15 frontend/backend boundary test.
//
// AR-P7: ESLint `no-restricted-imports` is the AUTHORITATIVE gate, NOT `tsc`.
// Phase 3 proved that under Yarn-classic hoisting an illegal `@blend65/codegen`
// import in `frontend` still resolves via `node_modules/.../dist/*.d.ts`, so
// `tsc --build` exits 0. The real invariant is enforced by ESLint, so this test
// drives `eslint` against an injected violation fixture and asserts the rule fires.

const VIOLATION = `import { VERSION } from "@blend65/codegen";\nexport const x = VERSION;\n`;
const ALLOWED = `import { VERSION } from "@blend65/core";\nexport const x = VERSION;\n`;

/**
 * Write `source` into a throwaway file inside the given package's `src`, run
 * `eslint` on just that file as a child process, and return whether eslint
 * exited non-zero (i.e. reported a lint error). The fixture is always removed.
 */
function eslintFails(pkgDir: string, source: string): boolean {
  const fixture = `packages/${pkgDir}/src/__boundary_violation__.ts`;
  writeFileSync(fixture, source);
  try {
    execFileSync("yarn", ["eslint", fixture], { stdio: "pipe" });
    return false; // exit 0 → no lint error → boundary leaked
  } catch {
    return true; // non-zero exit → no-restricted-imports fired → boundary enforced
  } finally {
    rmSync(fixture, { force: true });
    // AR-P4: prove the transient fixture never lingers in the tree.
    expect(existsSync(fixture)).toBe(false);
  }
}

describe("R15 frontend/backend boundary (AR-20, AR-P7)", () => {
  it("ST-R15a: frontend cannot import @blend65/codegen", () => {
    expect(eslintFails("frontend", VIOLATION)).toBe(true);
  });

  it("ST-R15b: language-server cannot import @blend65/codegen", () => {
    expect(eslintFails("language-server", VIOLATION)).toBe(true);
  });

  it("ST-R15c: a legal dependency import does not trip the boundary rule", () => {
    // The guard must be precise: importing an ALLOWED package (`@blend65/core`)
    // into `frontend` must lint clean, proving the rule is not over-broad.
    expect(eslintFails("frontend", ALLOWED)).toBe(false);
  });
});
