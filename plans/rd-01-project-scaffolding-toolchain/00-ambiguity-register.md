# Ambiguity Register: RD-01 Project Scaffolding & Toolchain (Plan Level)

> **Status**: ✅ GATE PASSED — 6 plan-level items resolved (2026-05-31); +1 runtime item AR-P7 resolved (2026-06-01)
> **Last Updated**: 2026-06-01

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
| AR-P6 | Architecture | R15 frontend/backend boundary enforcement mechanism ("compile error, not a convention") | both (tsc refs + ESLint) / tsc only / ESLint only | **Both layers** — _superseded by AR-P7._ Original decision named tsc `references` the authoritative layer; AR-P7 demotes tsc to build-ordering only and promotes ESLint to authoritative. tsconfig `references` still omit `codegen` from `frontend`/`language-server` (correct dependency graph), and the ESLint `no-restricted-imports` ban is retained — but now as the **enforcing** gate, not merely "friendly". | ✅ Resolved (amended by AR-P7) |
| AR-P7 (runtime) | Architecture | **AR-P6's "authoritative" tsc-references layer does NOT fire.** Phase 3 verification: injecting `import { VERSION } from "@blend65/codegen"` into `frontend` builds with **EXIT=0** — no `TS6307`. Cause: Yarn classic hoists every workspace into the root `node_modules/@blend65/*`, so NodeNext module resolution resolves `codegen`'s built `dist/*.d.ts` directly; tsc's project-`references` list only governs which referenced projects are rebuilt/redirected, it does **not** forbid resolving non-referenced packages via `node_modules`. Therefore omitting `codegen` from `references` is necessary but **not sufficient** to make the R15 violation a compile error. | (1) ESLint `no-restricted-imports`=error as authoritative gate, `boundary.spec.test.ts` asserts ESLint exits non-zero, CI lint = hard gate / (2) dependency-cruiser or eslint-plugin-boundaries / (3) tsc `paths` stub hack / (4) custom grep scanner | **Option 1** — ESLint `no-restricted-imports` (error) on `@blend65/codegen` in `frontend`+`language-server` is the **authoritative** R15 gate; `boundary.spec.test.ts` asserts a violating fixture makes `eslint .` exit non-zero; CI runs lint as a hard gate. tsc `references` retained for correct build ordering (necessary, not sufficient). **dependency-cruiser noted as the F1/F3 future upgrade** for transitive/dynamic-import enforcement. | ✅ Resolved |



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

> ⚠️ **Amended by AR-P7 (2026-06-01).** The premise above — that omitting `codegen`
> from `references` makes `tsc --build` reject a `@blend65/codegen` import in
> `frontend`/`language-server` — proved **false** under Yarn-classic workspace hoisting
> (the import resolves via `node_modules/@blend65/codegen/dist/*.d.ts`, which tsc's
> reference list does not police). See AR-P7 below for the corrected design.

**AR-P7:** Verified during Phase 3 that the illegal import builds clean (`EXIT=0`). The
authoritative R15 gate is therefore **ESLint** `no-restricted-imports` (severity `error`)
banning `@blend65/codegen` (and deep paths) in `frontend` and `language-server`. The
tsconfig `references` graph is retained because it is still required for correct
`composite` build ordering and an accurate dependency model — it is simply **necessary but
not sufficient** for R15. `boundary.spec.test.ts` is re-aimed at the ESLint layer: it
writes a violating fixture into `frontend/src`, runs `eslint`, and asserts a non-zero exit
with the rule firing, then removes the fixture. CI runs `lint` as a hard gate (Phase 7).
**dependency-cruiser** (or `eslint-plugin-boundaries`) is recorded as the future upgrade
(F1/F3) if/when transitive or dynamic-import enforcement becomes necessary; it is
intentionally **not** added in RD-01 to keep the scaffold minimal (L4).

---


## Traceability

Every decision in the plan documents traces either to an upstream `AR-NN`
(language/architecture, in `requirements/00-ambiguity-register.md`) or to an `AR-PN`
above (plan-level). Universally-obvious facts (`.ts` extension, markdown formatting) are
exempt per the Zero-Ambiguity Gate exception clause.

**Runtime entries:** if implementation surfaces a new ambiguity, STOP, add it here as the
next `AR-PN` tagged `(runtime)`, resolve it with the user, then resume.
