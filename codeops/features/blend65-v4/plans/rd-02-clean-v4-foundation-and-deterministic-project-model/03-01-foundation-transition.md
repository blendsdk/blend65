# Foundation Transition

> **Parent**: [Index](00-index.md)
> **Decisions**: AR-P1–AR-P3, AR-P6, AR-P7

## Inventory Before Change

Execution creates `04-salvage-inventory.md` in this plan directory, using RD-02's
exact inventory schema. Enumerate every inherited production package and its
independently reusable units, test/fixture/example families, codecs, ACME/VICE
adapters, scripts, workflows, docs, and CodeOps features. A package-level row does
not authorize every unit inside it. Every port/adaptation needs its own dependency
closure and proof. Record exact baseline and final landing/checkpoint identities.

The recovery audit may explain risk. Only frozen Specification 4 and RD-02 define
valid behavior. In particular, native codecs have no current-producer proof and
are reference-only evidence for their later owners, not RD-02 implementation.

Preferred small candidates are the upward walk and UTF-8 offset conversion.
The schema, IDs, secure filesystem operations, snapshot orchestration, diagnostic
registry, and CLI must not inherit old semantics. If independent proof shows that
rewriting a candidate is smaller, record `rewrite`; do not port for its own sake.
See ST-01–ST-04 and ST-09–ST-12.

## First Green Checkpoint

Prepare inventory-approved removals and the real minimal toolchain in one working
transition. Do not commit deletion-only or failing scaffolding states. The first
foundation checkpoint exports and tests complete pure manifest validation,
basename validation, and structured diagnostics from `@blend65/compiler`.
This is useful behavior, not an empty compiler facade. `loadProject` is added
only in Phase 2; the CLI package is added only in Phase 3.

Before a checkpoint, install from the lockfile, build, typecheck, and run the
complete currently owned foundation tests. Use the git-commit skill at coherent
green checkpoints; never push. Commit behavior otherwise belongs to exec-plan.

## Packages and Files

| Final owner | Responsibility and exports |
|---|---|
| `packages/compiler` / `@blend65/compiler` | `.` exports documented project types, `parseManifest`, `validateProjectName`, `loadProject`, position conversion, and build metadata as each real behavior lands |
| `packages/cli` / `@blend65/cli` | `.` exports testable `runCli`; `blendc` executes `dist/bin.js`; runtime dependency only on the compiler public export |

The final dependency graph is `cli -> compiler -> jsonc-parser`. Node built-ins
provide filesystem operations, hashing, decoding, and argument parsing. The CLI
does not import private project modules. No `core`, `config`, `frontend`, target,
codegen, editor, harness, or readiness package is created in RD-02.

Keep focused modules under `compiler/src/project/`: manifest/types, basename,
diagnostics/positions, discovery/paths, inventory/reads, and snapshot. These are
ordinary implementation files, not layers or a public host framework. Split a
file only when its actual responsibility/size requires it. New exported APIs need
the project's teaching-tone JSDoc; no plan identifiers belong in source comments.

## Root Toolchain

Adapt existing `package.json`, lockfile, `.nvmrc`, TS configs, Turbo and Vitest
configs, `.gitignore`, and the existing CI job. Preserve unrelated user content.

| Tool | Ownership |
|---|---|
| Node | Major 22 in `.nvmrc` and engines |
| Yarn | Classic 1.22.22; ordinary workspace version dependencies, one lockfile |
| TypeScript | Exact stable normal `typescript` 7.x, `tsc --build`; ESM/NodeNext/ES2023, strict, declarations/maps, source maps and composite references |
| Turbo | Root build/typecheck/test invocation; build depends on dependency builds; typecheck and tests receive fresh dependency declarations |
| Vitest | Real nonempty owned tests; no pass-with-no-tests escape or inherited readiness tier |
| Prettier | Targeted formatting checks, not a semantic replacement linter |

Keep the existing compatible Turbo/Vitest/Prettier versions unless a demonstrated
TypeScript 7 or Node 22 incompatibility requires an explicit correction. Retain
`jsonc-parser` 3.3.1 from the existing dependency graph. Do not add a bundler,
parser library, TypeScript 6 API compatibility package, or replacement linter.
Project references are updated as real packages appear, not prepopulated.
Enable unused-local/parameter checking where compatible with documented APIs.

Root `build`, `typecheck`, and `test` retain their command names. `test` runs the
new workspace suites and root direct structural/import tests only. No lint task,
ACME/VICE invocation, readiness filter/smoke, scoreboard, or game corpus remains.
No tracked dist/cache output is retained. Local generated outputs are ignored;
the check does not falsely ban the outputs a real TypeScript build just created.

## Rejected Surface Removal

Exact removal targets come from the completed inventory, not broad globs or an
unreviewed recursive deletion. Remove rejected packages, inherited tests and
fixtures, compiler examples, obsolete scripts/workflows, unused Vite/ESLint
configuration/dependencies, and generated/cached output. Preserve accepted new
tests and frozen authority. Git and the parked worktree preserve removed v3 code;
do not create a legacy tree.

Active CodeOps ownership is v4, the expert skillset, and the C64U successor.
Other historical feature material may stay only with an explicit reference-only
authority label, not a current v4 status claim. Prefer keeping linked historical
CodeOps evidence with that label to moving it and repairing many links. Do not
redesign sibling requirements. On this non-integration branch, portfolio numeric
rollup waits for integration; the feature roadmap and current root guidance must
tell the truth locally.

## Direct Boundary Test

Re-author `test/import-boundary.spec.test.ts`, with at most a small focused
`test/import-boundary.ts` helper. Read actual workspace manifests and source
imports/re-exports, including type-only and literal dynamic imports; resolve
relative `.js` imports to their TypeScript sources and exported workspace entries.
Reject undeclared/private cross-package edges and workspace cycles.

The test-only helper's planned signature is
`inspectImportBoundary(root: string): Promise<readonly string[]>`.
It reads a real repository or synthetic directory tree and returns no violations
for a valid graph, otherwise concise violations. This private test utility is
not a package export or configurable policy API. The signature is a plan-owned
execution clarification under project directive 4, with no change to predicates.

For every actual frontend/editor package and shared frontend source area as it
appears, follow transitive source/dependency edges to backend lowering, codegen,
serialization, packaging, or emulator ownership. Synthetic allowed/forbidden
fixtures make the check non-vacuous now. The direct test must include indirect
edges and a forbidden import hidden in a re-export. Do not merely search for one
package string or invoke ESLint. Do not use TypeScript's unavailable 7.0 API.

Scope the import reader to static ESM syntax and literal dynamic imports used in
this repository. Ignore comments and non-import strings. Nonliteral dynamic
imports in boundary-owned code fail closed; they cannot hide a backend edge.
Update the focused implementation helper when real owning source areas appear;
the specification oracle remains the same. No generated registry, architectural
DSL, configurable policy engine, empty production package, or custom runner.

## Failure and Proof

Worktree/authority mismatch stops execution without repair/reset. Inventory gaps
block port/deletion. A salvaged unit with missing proof becomes rewrite/reference
evidence rather than gaining a dependency on discarded code. New spec-test
failures are fixed in implementation, never by weakening expected behavior.
See ST-01–ST-08 and the phase verification rules in `99-execution-plan.md`.
