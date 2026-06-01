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

  prettier,
);
