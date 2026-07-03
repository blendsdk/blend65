// eslint.config.mjs (repo root)
//
// ESLint v9 flat config (AR-12 / AR-P5). Uses the official typescript-eslint flat
// preset and eslint-config-prettier (Prettier owns formatting — it must be last).
//
// This file also carries the AUTHORITATIVE R15 frontend/backend boundary guard
// (no-restricted-imports) per AR-P7: tsc project references do NOT block a
// @blend65/codegen import in frontend/language-server (Yarn-classic hoisting resolves
// it via node_modules), so this ESLint rule is the spec-enforcing R15 gate.

import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/*.tsbuildinfo", "**/coverage/**"] },
  ...tseslint.configs.recommended,

  // Intentionally-unused-binding convention (RD-04 D15). The TypeScript convention
  // for a deliberately unused parameter is the leading-underscore name (code.md
  // rule 4). `tsc --noUnusedParameters` already honours that convention, but
  // typescript-eslint's `no-unused-vars` does NOT by default — so deferred-seam
  // signatures (e.g. RD-04's passthrough pass functions and policy stubs, whose
  // params document a future checker's API) would fail `yarn lint`. Aligning
  // ESLint with tsc via `argsIgnorePattern: "^_"` makes the `_`-prefix the single,
  // canonical mechanism for an intentionally-unused parameter across both gates.
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },

  // R15 AUTHORITATIVE guard (AR-P7): hard ban of @blend65/codegen inside the
  // frontend and language-server packages. `eslint .` exits non-zero on violation,
  // wired into CI as a hard gate. (tsc references alone do NOT block this — AR-P7.)
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

  // AC-18 AUTHORITATIVE no-print guard (RD-15 R4, AR-V18): the compile-path
  // packages MUST NOT print — they return structured diagnostics; only
  // @blend65/cli prints. `no-console` bans console.*, and `no-restricted-properties`
  // bans `process.stdout`/`process.stderr` (writing to the process streams).
  // Test + test-support files are excluded (they legitimately spy on the streams).
  // A root-tier spec test (test/no-print.spec.test.ts, ST-39) is the second witness.
  {
    files: [
      "packages/core/**/*.ts",
      "packages/frontend/**/*.ts",
      "packages/codegen/**/*.ts",
      "packages/platforms/**/*.ts",
      "packages/config/**/*.ts",
      "packages/compiler/**/*.ts",
    ],
    ignores: [
      "**/*.test.ts",
      "**/test-fixtures.ts",
      "**/test-fixtures/**",
      "**/testing/**",
    ],
    rules: {
      "no-console": "error",
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "stdout",
          message:
            "AC-18/R4: compile-path packages must not print — return diagnostics; the CLI prints.",
        },
        {
          object: "process",
          property: "stderr",
          message:
            "AC-18/R4: compile-path packages must not print — return diagnostics; the CLI prints.",
        },
      ],
    },
  },

  prettier,
);
