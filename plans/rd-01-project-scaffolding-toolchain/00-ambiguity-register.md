# Ambiguity Register: RD-01 Project Scaffolding & Toolchain (Plan Level)

> **Status**: ✅ GATE PASSED — all 6 plan-level items resolved (2026-05-31)
> **Last Updated**: 2026-05-31
> **Source RD**: [RD-01](../../requirements/RD-01-project-scaffolding-toolchain.md)
> **Upstream register**: [requirements/00-ambiguity-register.md](../../requirements/00-ambiguity-register.md) — AR-1..AR-93 (discovery closed)

---

## Purpose & Scope

RD-01 and the upstream requirements register (AR-1..AR-93) already resolve all
**language- and architecture-level** decisions. This register captures only the
**plan/implementation-level** ambiguities that surfaced when turning RD-01 into a
concrete, file-by-file execution plan — decisions RD-01 deliberately left to the
implementer (e.g. illustrative filenames, module system, version baseline).

Every plan-level entry is prefixed `AR-P` to distinguish it from the upstream
`AR-NN` entries it builds on.

---

## Register

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| AR-P1 | Technical | JS module system for all packages (not fixed by RD-01; drives `package.json` `type`, `tsconfig` `module`/`moduleResolution`/`target`) | ESM (NodeNext/ES2023) / CommonJS (Node16) / dual ESM+CJS | **ESM** — `"type": "module"`, `module`/`moduleResolution`: `NodeNext`, `target`: `ES2023` | ✅ Resolved |
| AR-P2 | Technical | Which of the 10 packages are publishable vs `private: true` (RD-01 §4.2 says "private where unpublished" without enumerating) | all-private-except-public-surfaces / only test-harness public / all public | **Publishable: `test-harness`, `cli`, `compiler`, `language-server`, `vscode`. Private: `core`, `frontend`, `codegen`, `platforms`, `config`** | ✅ Resolved |
| AR-P3 | Technical | Initial version baseline + shape of the placeholder export (RD-01 §4.2 "e.g. a version constant") — fixes the value smoke tests assert | 0.0.0 / 0.1.0 / 0.0.1 | **`0.1.0`; each `src/index.ts` exports `export const VERSION = '0.1.0';`** | ✅ Resolved |
| AR-P4 | Testing | Test-file structure for a pure-infra plan under the spec-first protocol (`*.spec.test.ts` vs `*.impl.test.ts`) | per-pkg spec smoke + root boundary spec / single root spec / plain index.test + CI-script boundary | **Per-package `index.spec.test.ts` (assert `VERSION === '0.1.0'`) + root `boundary.spec.test.ts` (assert R15 violation fails `tsc --build`); no impl tests at scaffold stage** | ✅ Resolved |
| AR-P5 | Technical | ESLint config style — RD-01 §4.1 shows legacy `.eslintrc.cjs`, which collides with the ESM + Node 22 choice (ESLint v9 default = flat config) | flat `eslint.config.mjs` / legacy `.eslintrc.cjs` | **ESLint v9 flat config `eslint.config.mjs` (supersedes the illustrative `.eslintrc.cjs`); Prettier as `.prettierrc.json`** | ✅ Resolved |
| AR-P6 | Architecture | R15 frontend/backend boundary enforcement mechanism ("compile error, not a convention") | both (tsc refs + ESLint) / tsc only / ESLint only | **Both layers: tsconfig `references` omit `codegen` from `frontend`/`language-server` (spec-mandated `tsc --build` compile error, asserted by `boundary.spec.test.ts`) PLUS ESLint `no-restricted-imports` ban for friendly early detection** | ✅ Resolved |

---

## Resolution Notes

**AR-P1:** ESM chosen for alignment with Node 22, Vite, and Vitest (all ESM-native).
`tsconfig.base.json` will set `module: "NodeNext"`, `moduleResolution: "NodeNext"`,
`target: "ES2023"`. Every `package.json` sets `"type": "module"`. Consistent with
AR-1 (TypeScript) and AR-10 (Node 22).

**AR-P2:** The public-facing surfaces (the published harness AR-24, the `blendc` CLI,
the programmatic `compiler` façade AR-77, and the editor tooling) are publishable; the
internal compiler libraries stay `"private": true` until a publish decision is made in a
later RD. Publishable packages additionally declare `"publishConfig": { "access": "public" }`
(required for scoped `@blend65/*` packages). No package is actually published in RD-01 —
this only sets the `private`/`publishConfig` fields correctly from day one.

**AR-P3:** `0.1.0` is the shared baseline for the root manifest and all ten workspaces.
The single placeholder export per package is `export const VERSION = '0.1.0';`. This is
the concrete, spec-derived value every per-package smoke test asserts (feeds AR-P4).

**AR-P4:** RD-01 is infrastructure-only, so its "specification" is the §6 acceptance
criteria. Per-package `src/index.spec.test.ts` smoke tests prove the Vitest wiring is
green and assert the AR-P3 `VERSION` constant. A root `boundary.spec.test.ts` encodes the
most load-bearing criterion — the R15 boundary — by asserting that a deliberately
violating fixture (a `codegen` import inside `frontend`) **fails** `tsc --build`. No
`*.impl.test.ts` files are created at scaffold stage because there is no internal logic
with edge cases yet (avoiding dead test code per `code.md` rule 4). The `.spec.test.ts`
naming is adopted now so RD-02+ slices slot in cleanly.

**AR-P5:** The user chose ESM + modern tooling (AR-P1), so the ESLint v9 flat config
(`eslint.config.mjs`) is used; RD-01 §4.1's `.eslintrc.cjs` is treated as illustrative and
superseded. This carries zero semantic ambiguity against RD-01 (the decision RD-01 fixed
was "ESLint + Prettier" per AR-12, not the config-file dialect). Prettier configured via
`.prettierrc.json`.

**AR-P6:** Both enforcement layers are implemented. The **authoritative** layer is
tsconfig project `references`: `frontend` and `language-server` simply do not reference
`codegen`, so under `composite` project-reference builds `tsc --build` cannot resolve a
`@blend65/codegen` import and the build fails — satisfying RD-01 §4.2's "compile error,
not a convention" literally. The **secondary** layer is an ESLint `no-restricted-imports`
rule that bans `@blend65/codegen` in those two packages, producing a friendly,
rule-named diagnostic earlier in the workflow. `boundary.spec.test.ts` asserts the tsc
layer (the spec-mandated one).

---

## Traceability

Every decision in the plan documents traces either to an upstream `AR-NN`
(language/architecture, in `requirements/00-ambiguity-register.md`) or to an `AR-PN`
above (plan-level). Universally-obvious facts (`.ts` extension, markdown formatting) are
exempt per the Zero-Ambiguity Gate exception clause.

**Runtime entries:** if implementation surfaces a new ambiguity, STOP, add it here as the
next `AR-PN` tagged `(runtime)`, resolve it with the user, then resume.
