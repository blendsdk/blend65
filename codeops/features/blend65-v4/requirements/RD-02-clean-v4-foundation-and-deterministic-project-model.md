# RD-02: Clean V4 Foundation and Deterministic Project Model

> **Document**: RD-02-clean-v4-foundation-and-deterministic-project-model.md
> **Status**: Draft
> **Created**: 2026-09-10
> **Project**: Blend65 v4
> **Depends On**: RD-01
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

Blend65 v4 foundation work continues in the sibling Git worktree prepared before RD-01 and turns it
into a small, buildable TypeScript 7 monorepo. It does not inherit v3's package count, pass topology,
readiness product, tests, or false platform implementations. Before anything is ported, a component
inventory decides whether each v3 unit is cheaper and safer to reuse, adapt, rewrite, discard, or
keep only as evidence. Every retained unit must satisfy the frozen Specification 4 and expert
`2.0.0` authorities from RD-01.

This requirement also establishes the one deterministic project model used by every later compiler,
CLI, LSP, editor, asset, and packaging capability. A JSONC `blend65.json` manifest defines the
project root, source root, entry module, exact target profile, asset search paths, output directory,
optimization goal, and optional safety checks. The foundation reads a coherent, contained source
snapshot and exposes it through one typed host-facing service. It does not pretend to parse or
compile Blend65 before RD-03 supplies the first real frontend and complete pipeline.

> **Decisions:** AR-004, AR-005, AR-011, AR-012, AR-014, AR-021 through AR-023, AR-025,
> AR-026, AR-028, AR-030, AR-032, AR-033, AR-035, AR-036, and AR-048.

---

## Functional Requirements

### Must Have

#### Safe clean-slate creation — complexity L

- [ ] **R2.1 — Consume and verify the approved sibling worktree.** Verify that
  `/home/gevik/workdir/github/blend65.ri/v4` is on `feature/v4-rebuild`, that the branch descends from
  the recorded exact final v3 source commit, that its current head contains the closed RD-01
  authority, and that the parked v3 evidence worktree remains unchanged. RD-02 must not create,
  relocate, reset, or overwrite either worktree or the branch. (AR-005, AR-025)
- [ ] **R2.2 — Reach the first green RD-02 foundation checkpoint.** The first RD-02 foundation
  commit must contain the minimal root toolchain and at least one buildable package with a truthful
  purpose. The frozen RD-01 authority must remain in its ancestry. The checkpoint cannot be a
  deletion-only broken tree, an empty architecture skeleton, or a copied v3 package graph. No
  incomplete deletion or scaffolding state may be committed. (AR-025, AR-033)
- [ ] **R2.3 — Inventory before porting or deletion.** Produce a component-level salvage inventory
  covering v3 production packages, tests, examples, scripts, workflows, fixtures, native-format
  codecs, ACME/VICE adapters, documentation, and CodeOps artifacts. Classify every candidate as
  `port`, `adapt`, `rewrite`, `discard`, or `reference-only`, with one owner and evidence for the
  choice. (AR-004, AR-025)
- [ ] **R2.4 — Admit salvage only under proof.** A `port` or `adapt` decision must name its v4
  requirement, show Specification 4 compatibility, pass a focused implementation-independent
  contract test, have no dependency on discarded v3 architecture, and demonstrate less risk and
  work than replacement. Line count, existing tests, or historical completion status alone cannot
  justify reuse. (AR-004, AR-025)
- [ ] **R2.5 — Remove rejected v3 surfaces.** Before RD-03 implementation begins, remove the v3
  compiler implementation and package topology, readiness/readiness-execution code and workflows,
  inherited tests not re-authored from v4 authority, false C64U/X16/Atari packages, unused
  placeholder optimizers, and any generated or cached build output from the v4 branch. Git history
  is the archive; do not create a `legacy/` copy. (AR-004, AR-012, AR-025, AR-035)
- [ ] **R2.6 — Keep only active CodeOps ownership.** The v4 branch must clearly identify
  `blend65-v4`, the expert skillset, and the owned C64U successor as active work. Historical v3
  plans may remain only as explicitly reference-only evidence or Git history; they cannot appear as
  current v4 delivery status or requirements authority. (AR-004, AR-024, AR-025)

#### Minimal monorepo toolchain — complexity L

- [ ] **R2.7 — Use stable TypeScript 7.** Pin one stable `7.x` release from the normal
  `typescript` package and use its `tsc` executable. Do not use `@typescript/native-preview`,
  `tsgo`, a nightly channel, or a TypeScript 6 compatibility compiler in the production v4
  toolchain. TypeScript project references own TypeScript compilation dependencies. (AR-036)
- [ ] **R2.8 — Retain the approved monorepo foundation.** Use Node 22, Yarn classic workspaces,
  Turborepo, TypeScript project references, and Vitest. Yarn owns installation/linking and workspace
  relationships; TypeScript owns typed project dependencies; Turbo owns cross-workspace task
  orchestration and caching. These roles must not be represented as interchangeable or maintained
  as conflicting build graphs. (AR-036)
- [ ] **R2.9 — Remove linting.** The root and every v4 package must contain no ESLint dependency,
  configuration, script, Turbo task, CI step, or replacement general linter. TypeScript strictness,
  tests, direct boundary checks, and targeted formatting checks remain distinct quality controls.
  (AR-036)
- [ ] **R2.10 — Add no unused bundler.** RD-02 must not copy the v3 Vite placeholders or configure
  another bundler. A later package may add the smallest suitable bundler only when it owns a real
  packaged artifact—most likely the VS Code extension in RD-09. (AR-036)
- [ ] **R2.11 — Keep the package graph consumer-driven.** Create only packages that own behavior
  used in this RD. Do not create one package per compiler pass or empty packages for the frontend,
  IR, target, optimizer, assets, C64U, X16, Atari, debugger, readiness, or plugins. Internal modules
  may later become packages only after at least two real consumers require an enforceable public
  boundary. (AR-012, AR-025, AR-033)
- [ ] **R2.12 — Preserve real public boundaries.** The compiler remains consumable as a library and
  `blendc` remains a CLI executable. Their exact internal package decomposition is a planning
  decision, but the CLI must consume the documented compiler/project service rather than importing
  internal files. Cross-package imports use package exports; relative imports never reach another
  package's `src/` or `dist/`. (AR-021, AR-025)
- [ ] **R2.13 — Establish the frontend/editor boundary without empty packages.** A small direct
  import-graph specification test must reject a synthetic shared-frontend or language-server
  dependency on target lowering, code generation, assembly serialization, packaging, or emulator
  control. It must also scan every real shared frontend/editor package as each one appears, starting
  in RD-03. RD-02 must not create empty frontend or language-server packages merely to make this
  check non-vacuous, and it must not add a replacement linter or generalized architecture
  framework for this one boundary. (AR-012, AR-021, AR-036)

#### One deterministic project model — complexity L

- [ ] **R2.14 — Use one JSONC manifest.** A production project is defined by one
  `blend65.json` object supporting comments and trailing commas. Its public keys are
  `schemaVersion`, `name`, `sourceRoot`, `entry`, `target`, `assetPaths`, `outDir`, `optimization`,
  `boundsCheck`, and `divisionZeroCheck`. Unknown keys, duplicate keys, unsupported schema versions,
  missing required keys, and wrong value types are errors. There is no parallel single-file
  production configuration model. (AR-022, AR-028)
- [ ] **R2.15 — Define exact key behavior.** `schemaVersion` initially accepts only `1`; `name`,
  `sourceRoot`, `entry`, `target`, and `outDir` are required; `assetPaths` is an optional ordered
  list of contained directories; `outDir` is a contained directory; `optimization` is exactly
  `none`, `balanced`, `speed`, or `size`; and both safety keys are booleans. When omitted,
  `optimization` is `balanced`, `assetPaths` is empty, and both safety switches are `false`. The
  project name and all path values must satisfy documented, platform-independent validation.
  (AR-022, AR-023, AR-028)
- [ ] **R2.16 — Discover the nearest project predictably.** Without `--project`, project discovery
  starts at the caller's working directory and walks upward to the nearest `blend65.json`. With
  `--project`, the supplied relative or absolute manifest path is authoritative. The manifest's
  directory—not the process working directory—is always the project root. Failure to find or read a
  manifest is a structured diagnostic. (AR-022, AR-028)
- [ ] **R2.17 — Resolve contained paths from the manifest.** `sourceRoot`, `assetPaths`, and
  `outDir` are relative to the manifest directory. Canonicalization must reject absolute values,
  `..` escape, symlink escape, type mismatch, unreadable paths, and paths whose resolved identity
  falls outside the project root. The explicit `--project` path itself may be absolute because it
  selects the root rather than declaring project content. (AR-022, AR-028)
- [ ] **R2.18 — Inventory source files deterministically.** Recursively enumerate only regular
  `.blend` files under `sourceRoot`, using canonical project-relative paths in case-sensitive ASCII
  order. Ignore no file through globs or hidden implicit rules. Diagnose duplicate canonical
  identity, case-only collision on a case-insensitive host, symlink cycles, unreadable entries, and
  files that disappear during collection. (AR-022, AR-028)
- [ ] **R2.19 — Separate file inventory from language meaning.** RD-02 supplies exact source bytes,
  paths, hashes, and stable source identities but does not invent a second scanner for module
  headers. RD-03's real lexer/parser builds the module index, permits legal multi-file merged
  modules, and follows only the selected entry's reachable imports. Filenames never become module
  names. (AR-028, AR-033)
- [ ] **R2.20 — Keep target selection exact.** The manifest target must be one normative
  Specification 4 C64 profile. RD-02 validates the identity but implements no C64 code generation.
  Recorded `--target` and `--entry` overrides may select another qualified profile or entry for one
  invocation; they do not mutate the manifest or create named build variants. Unknown, C64U, X16,
  or Atari target IDs are errors. (AR-030, AR-035)
- [ ] **R2.21 — Exclude executable configuration.** `blend65.json` cannot declare scripts, hooks,
  plugins, packages, environment interpolation, shell commands, ACME/VICE executable paths, source
  globs, or arbitrary host tools. Machine-local tool discovery belongs to explicit invocation or
  editor/user settings in the RD that owns that integration. (AR-012, AR-022)

#### Coherent host snapshot and diagnostics — complexity L

- [ ] **R2.22 — Read one coherent input snapshot.** One project load must bind the exact manifest,
  source-file inventory, bytes, canonical paths, and hashes it observed. If any file changes,
  disappears, changes identity, or escapes containment while the snapshot is being created, the
  complete load retries from the manifest or fails; it cannot return mixed old/new input. A retry
  remains bounded and cannot become a watcher, persistent cache, or incremental compiler. (AR-011,
  AR-022, AR-028)
- [ ] **R2.23 — Use stable source identities.** Source identities and diagnostic ordering derive
  from canonical project-relative paths and UTF-8 byte spans, never JavaScript UTF-16 indexes,
  filesystem enumeration order, absolute checkout paths, locale, or process working directory.
  Host/LSP coordinate conversion remains explicit at the consumer boundary. (AR-021, AR-025)
- [ ] **R2.24 — Expose one typed project-loading service.** The foundation library returns either a
  complete immutable project snapshot plus structured non-error observations, or structured
  diagnostics with no usable snapshot. Expected user/configuration failures are values rather than
  process crashes. The CLI uses this service for truthful `--help`, `--version`, and project-load
  diagnostics; it does not claim semantic `check`, `build`, or `run` completion before RD-03.
  (AR-021, AR-022, AR-033)
- [ ] **R2.25 — Fail without publishing compiler artifacts.** RD-02 creates no `.asm`, labels,
  binary, memory/assets/cost/debug reports, or emulator output. Invalid input cannot leave a
  runnable-looking artifact or a partially published project snapshot. Temporary host data is
  cleaned or remains outside the configured output directory. (AR-022, AR-025, AR-032)

#### Focused proof without readiness machinery — complexity M

- [ ] **R2.26 — Re-author tests from v4 authority.** Specification tests derive only from this RD
  and RD-01; implementation tests cover parser/host internals without redefining outcomes. Do not
  copy tests merely because they passed in v3. Every salvaged behavior receives a new focused proof
  against the v4 contract. (AR-004, AR-025)
- [ ] **R2.27 — Use impact-based commands.** During work, run only the affected package's typecheck,
  build, and directed tests. At the RD-02 checkpoint, run the complete new v4 foundation build,
  typecheck, focused test set, and direct package-boundary test. Do not run ACME, VICE, compiler
  pipeline, readiness, game-corpus, or emulator suites because RD-02 owns none of those behaviors.
  (AR-025, AR-026)
- [ ] **R2.28 — Establish an observational host baseline.** Record separately attributable project
  discovery, JSONC validation, source inventory/snapshot, TypeScript build, test, and peak host
  memory observations on the real RD-02 example. These measurements cannot fail tests or release
  and cannot justify a synthetic scale project or second readiness system. (AR-011, AR-026)

### Should Have

- [ ] **R2.29 — Explain salvage decisions — complexity S.** For every rewritten or discarded v3
  component that appears reusable at first glance, include a short reason tied to the recovery
  audit so later contributors do not unknowingly restore it. (AR-025)
- [ ] **R2.30 — Provide one minimal example project — complexity S.** Check in a contained
  `blend65.json`, one `.blend` file, and an empty output directory declaration that demonstrate
  discovery and snapshot loading. The file is input evidence only until RD-03 gives it real
  language behavior. (AR-022, AR-028)

### Won't Have (Out of Scope)

- Blend65 lexing, parsing, module-header interpretation, semantic analysis, SFA, IL, target
  lowering, ACME serialization, PRG/D64 packaging, or VICE execution — RD-03 owns the first real
  pipeline slice.
- A copied v3 package graph, one package per compiler pass, future-target packages, public plugins,
  or a generic service/container architecture. (AR-012, AR-025, AR-033)
- ESLint, another general linter, pre-emptive Vite configuration, or an alternate TypeScript
  compiler distribution. (AR-036)
- A remote Turbo cache service, CI cache infrastructure, custom task runner, or duplicate build
  dependency graph. Turbo may use its ordinary local cache; any remote service requires a later
  explicit need and approval. (AR-036)
- Incremental Blend65 analysis, filesystem watchers, a persistent project daemon, content-addressed
  build cache, synthetic scale suite, or readiness framework. TypeScript's own project-reference
  incrementality is not Blend65 incremental compilation. (AR-011, AR-026)
- Source globs, a source-file list, path-based language imports, preprocessors, conditional
  declarations, named build variants, executable manifest hooks, or package management. (AR-022,
  AR-028, AR-030)
- Compiler artifact publication or claims that any C64 program compiles. (AR-033)

---

## Technical Requirements

### Worktree and salvage sequence — complexity L

The transition order is mandatory:

1. Verify the Phase 0 record, branch ancestry, v4 worktree identity, and unchanged parked v3
   worktree.
2. Verify RD-01 is closed and record its Specification 4 and expert `2.0.0` identities.
3. Produce the component inventory before deleting or porting a candidate.
4. Prepare removal of rejected implementation, test, readiness, target, workflow, and generated
   surfaces together with the minimal toolchain and first behavior-owning package(s); do not commit
   an incomplete or broken intermediate state.
5. Run the complete relevant RD-02 foundation checks.
6. Commit the first green RD-02 foundation checkpoint and bind it in the inventory.
7. Port only inventory-approved units with focused independent proof, preserving green checkpoints.

If the branch, path, ancestry, RD-01 head, or worktree identity differs from the Phase 0 record,
execution stops and reports the exact conflict. It must not reset, overwrite, merge, move, or delete
the existing state. (AR-005, AR-025)

### Salvage inventory schema — complexity M

| Field | Required content |
|---|---|
| Candidate | Exact component, file group, fixture family, script, workflow, or package |
| Current responsibility | What it demonstrably does in v3, separated from status claims |
| V4 owner | Requirement and concrete behavior that would consume it |
| Specification compatibility | Exact frozen clauses and any conflict |
| Recovery-audit evidence | Relevant boundary and finding identifiers |
| Dependency closure | Every retained and rejected dependency needed by the candidate |
| Proof | Focused independent test or inspection that validates the reusable contract |
| Relative cost/risk | Why port/adapt is safer and smaller than rewrite, or why it is not |
| Disposition | `port`, `adapt`, `rewrite`, `discard`, or `reference-only` |
| Removal/landing point | Exact v4 destination or Git-only preservation statement |

No aggregate package score or passing-test count substitutes for these fields. (AR-004, AR-025)

### Host toolchain contract — complexity L

- Node is pinned to major 22 in `.nvmrc` and `engines`.
- Yarn classic is pinned and owns one lockfile; workspace dependencies use ordinary compatible
  versions rather than the unsupported `workspace:*` protocol.
- Stable TypeScript 7 is pinned in the lockfile and invoked as `tsc`; all v4 projects use ESM,
  NodeNext module resolution, ES2023 or later Node-22-compatible output, `strict`, declarations,
  declaration maps, source maps, and composite project references where cross-project builds need
  them.
- Turbo owns the root `build`, `typecheck`, and `test` task graph. `build` follows package
  dependencies, `typecheck` cannot silently accept stale dependency declarations, and tests can be
  directed to one package without running all workspaces.
- No `lint` task exists. Formatting is a separate presentation concern and cannot become a
  replacement semantic gate.
- Vite or another bundler is absent until a package owns a bundle artifact and its requirement
  selects the smallest tool that produces it.

TypeScript 7 is available through the standard `typescript` package and `tsc` according to the
[official TypeScript 7.0 release](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/).
(AR-036)

### Package dependency rules — complexity M

The exact package count is selected by the implementation plan from real RD-02 consumers. The
following direction rules are required regardless of that count:

```text
CLI -> public compiler/project service -> project host and shared diagnostics

future language server -> shared frontend/project service
future language server -X-> target lowering/codegen/packaging/emulator
```

- A package exports only its supported public entry points.
- A consumer cannot import another package's private files or generated directory.
- Shared code moves behind a package boundary only when two real consumers require it; otherwise it
  remains a module owned by its first consumer.
- Cyclic workspace dependencies are invalid.
- The direct import-graph test reads manifests and source imports only; it is not a general linter,
  dependency framework, or readiness service.

(AR-012, AR-021, AR-025, AR-036)

### `blend65.json` schema — complexity L

| Key | Required | Initial contract |
|---|---|---|
| `schemaVersion` | Yes | Integer `1`; any other value is unsupported |
| `name` | Yes | Non-empty, platform-independent artifact-safe project name |
| `sourceRoot` | Yes | One relative contained directory holding recursively discovered `.blend` files |
| `entry` | Yes | Qualified Blend65 module identity, never a filesystem path |
| `target` | Yes | Exact normative Specification 4 C64 profile identity |
| `assetPaths` | No | Ordered list of relative contained directories; omitted means `[]` |
| `outDir` | Yes | Relative contained output directory; it cannot overlap source input files |
| `optimization` | No | `none`, `balanced`, `speed`, or `size`; omitted means `balanced` |
| `boundsCheck` | No | Boolean; omitted means `false` |
| `divisionZeroCheck` | No | Boolean; omitted means `false` |

JSONC permits comments and trailing commas but not duplicate keys. Unknown keys are errors rather
than warnings so misspelled safety, target, and path settings cannot be silently ignored. The
schema contains no generic extension map. (AR-022, AR-023, AR-028)

### Path and snapshot model — complexity L

All project content paths follow this sequence:

```text
manifest text
  -> typed JSONC value
  -> manifest-relative lexical path
  -> canonical filesystem identity
  -> containment/type/readability check
  -> stable project-relative identity
  -> bytes + SHA-256 hash in one coherent snapshot
```

The loader must bound file count, individual file size, total input bytes, directory depth, and
retry work with documented host-safety limits. Exceeding a limit is a diagnostic naming the limit
and observed value, not a crash or partial snapshot. Limits protect the host compiler; they do not
change Blend65 array or target-memory semantics. (AR-022, AR-028)

### Diagnostic foundation — complexity M

Each project diagnostic contains a stable code, severity, concise message, primary UTF-8 source
span when available, related spans for conflicts, and actionable correction. Ordering is stable by
canonical source identity, byte offset, severity, code, and message tie-break. Root causes suppress
causal cascades where a trustworthy fact is unavailable. Diagnostics never expose a host stack
trace for expected input errors and never convert an invalid project into a usable partial
snapshot. (AR-021, AR-022, AR-025)

### Verification topology — complexity M

RD-02 uses only direct proof:

| Surface | Required proof |
|---|---|
| Toolchain | Clean install, TypeScript 7 identity, package build order, strict typecheck, no lint task |
| Workspaces | Public exports resolve; dependency cycles and forbidden frontend/backend imports fail |
| Manifest | Valid JSONC plus each missing, duplicate, unknown, wrong-type, and unsupported-version case |
| Discovery | Nearest/explicit manifest behavior from several working directories |
| Paths | Relative resolution, absolute rejection for content, `..`/symlink escape, case collision, unreadable/wrong-type paths |
| Inventory | Stable `.blend` ordering, empty source root, deep tree limit, file replacement/disappearance |
| Snapshot | Identical hashes for identical input and no mixed result under a controlled mid-read change |
| Salvage | One focused proof per port/adaptation and a structural check that rejected packages/workflows are absent |
| Boundary | Synthetic forbidden-edge proof now; automatic scans of each real frontend/editor package as it appears, without ESLint or another general linter |

No item in this table requires compiling Blend65 source, generating assembly, invoking ACME, or
starting VICE. (AR-025, AR-026, AR-036)

---

## Integration Points

### With RD-01 (Specification 4.0 and Expert Authority Freeze)

RD-02 consumes the frozen normative-file hashes, Specification 4 identity, expert `2.0.0` release,
and target inventory. Any mismatch stops setup; the foundation cannot silently update or select a
different authority.

### With RD-03 (Playable M1 Complete Pipeline)

RD-03 consumes the immutable project snapshot, diagnostic foundation, package boundaries, CLI
shell, and toolchain. It adds the first real lexer/parser/module graph, semantic path, target path,
ACME/PRG/VICE behavior, and truthful `check`, `build`, and `run` commands. It may refine internal
modules but cannot restore discarded v3 topology or bypass the project service.

### With RD-09 (Developer Tooling and Debug Evidence)

RD-09 reuses the same project discovery and snapshot semantics for LSP/VS Code. It may add a
bundler for the extension's real artifact, but ordinary editor analysis remains unable to import
backend or emulator code.

### With blend65-c64u/RD-01

The foundation records C64U as an owned future feature but creates no C64U workspace package,
profile, manifest target, or implementation. (AR-024, AR-035)

---

## Non-Functional Requirements

### Determinism and portability — complexity M

- Identical manifest and file bytes produce identical canonical project-relative identities,
  ordering, hashes, diagnostics, and snapshot identity regardless of checkout path or working
  directory.
- Path behavior is production-qualified on Node 22 for `linux/x64` and `win32/x64` without
  weakening containment on symbolic links, case-insensitive filesystems, Windows drive/UNC syntax,
  or POSIX paths. macOS, Linux ARM64, and other Node 22 hosts remain best-effort until they pass the
  same complete qualification; 32-bit/unknown architectures and hosts outside the declared Node 22
  range are unsupported. (AR-048)
- Locale, wall-clock time, directory enumeration, Turbo scheduling, and CPU concurrency cannot
  change observable outputs.

### Host responsiveness — complexity S

- Measurements are phase-separated and recorded for observation only.
- No wall-clock duration or peak-memory number fails a test, CI job, RD closeout, or release.
- Noticeable delay is investigated at its measured source before incremental Blend65 compilation,
  persistent caching, or additional orchestration is proposed. Turbo's existing cache is not
  evidence that Blend65 needs an incremental compiler. (AR-011, AR-026, AR-036)

### Maintainability — complexity M

- Production source stays below the project's file-size guidance and exposes documented public
  APIs.
- Tool roles, package ownership, and dependency direction are visible without a generated
  architecture registry.
- No retained component requires a discarded package solely to avoid rewriting a small unit.

---

## Security Considerations

- **Data sensitivity:** Projects may contain proprietary game source and assets. The compiler reads
  them locally and must not transmit, upload, or log their contents outside explicit diagnostic
  excerpts.
- **Input validation:** Treat the manifest, paths, directory entries, symlinks, source bytes, and
  command-line values as untrusted. Apply allowlisted keys/enums, bounded sizes/counts/depth, file
  type checks, canonical containment, and UTF-8 validation.
- **Authentication and authorization:** N/A; RD-02 adds no service or multi-user boundary.
- **Injection risks:** The manifest cannot execute commands. No project value is evaluated as shell,
  JavaScript, a glob, environment expansion, or Turbo configuration. Later subprocess integrations
  must use argument arrays rather than constructed shell programs.
- **Encryption:** N/A; no network transport or compiler-managed persistent secret store exists.
- **Rate limiting:** N/A; there are no endpoints. Bounded filesystem work prevents local resource
  exhaustion from hostile projects.
- **Infrastructure:** No remote cache, telemetry, network service, container, credential, or secret
  is required. Turbo remains local unless a later explicit requirement approves a remote service.

---

## Scope Decisions

| Decision | Options considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| V4 location | Same checkout / new repository / sibling worktree | Sibling worktree | Preserves v3 evidence while sharing history and avoiding duplication. | AR-005 |
| Compatibility | Preserve v3 / preserve spec only / preserve none | No v3 compatibility | There are no v3 users; current code is audit evidence. | AR-004 |
| Recovery | Repair in place / duplicate legacy / inventory-led clean branch | Inventory-led clean branch | Keeps only independently proven components and deletes the readiness product. | AR-025 |
| Package design | Copy 12 packages / one package per pass / consumer-driven boundaries | Consumer-driven boundaries | Prevents horizontal placeholder architecture while keeping real public consumers separate. | AR-012, AR-025, AR-033 |
| Monorepo orchestration | Yarn/TypeScript only / Yarn + TypeScript + Turbo | Retain Turbo | User explicitly chose the useful v3 monorepo setup while rejecting unused Vite placeholders. | AR-036 |
| Linting | ESLint / replacement linter / no general linter | No general linter | Approved TypeScript 7 direction; direct tests enforce required boundaries. | AR-036 |
| Project model | Globs/overrides / one deterministic manifest / scriptable build | One deterministic manifest | One source of configuration with contained declarative inputs. | AR-022 |
| Source discovery | Path imports / explicit inventory / source-root module index | Source-root inventory, then real module index | Keeps module identity independent of filenames without duplicate configuration. | AR-028 |
| Multi-profile source | Preprocessor / named variants / entry plus profile facts | Entry plus profile facts | Avoids conditional-compilation machinery and runtime profile branches. | AR-030 |
| Host performance | Hard timing gates / ignore / observational measurements | Observational measurements | Exposes regressions without flaky readiness gates. | AR-026 |

---

## Acceptance Criteria

1. [ ] **AC-01 — Worktree identity and ancestry:** `git worktree list --porcelain` reports the
   unchanged parked v3 worktree and `/home/gevik/workdir/github/blend65.ri/v4` on
   `feature/v4-rebuild`; Git ancestry proves that the branch descends from the recorded final v3
   source commit, and its current head contains the closed RD-01 authority. No unrelated worktree or
   branch was changed.
2. [ ] **AC-02 — First green RD-02 foundation checkpoint:** The first RD-02 foundation commit
   installs from the lockfile, typechecks, builds, and runs its directed tests with no empty
   pass/package placeholder and no committed broken deletion-only interval.
3. [ ] **AC-03 — Complete salvage inventory:** Every v3 package, root workflow, test/fixture family,
   example family, script family, and CodeOps feature has one inventory row containing all fields in
   the required schema and exactly one disposition.
4. [ ] **AC-04 — Proven reuse:** Every `port` or `adapt` row links a focused v4 contract test that
   fails when its required behavior is intentionally violated; no retained unit depends on a
   `discard` row or retired Specification 3 behavior.
5. [ ] **AC-05 — Rejected surfaces absent:** Structural checks find no readiness or
   readiness-execution production package/workflow, inherited unselected test suite, false target
   package, empty optimizer catalog presented as capability, duplicated legacy tree, or generated
   build output in the v4 branch.
6. [ ] **AC-06 — Tool versions:** A clean install uses Node major 22, Yarn classic, a stable
   `typescript` package whose reported major is 7, Turborepo, and Vitest; no preview/nightly
   TypeScript package is installed.
7. [ ] **AC-07 — No lint/bundler placeholders:** Repository search finds no ESLint dependency,
   configuration, script, Turbo task, CI step, or replacement linter, and no Vite/bundler dependency
   or configuration exists in RD-02 output.
8. [ ] **AC-08 — Honest task ownership:** TypeScript project references determine TypeScript build
   dependencies; Turbo invokes workspace tasks and caching without a conflicting manually ordered
   package list; Yarn owns one workspace/lockfile graph.
9. [ ] **AC-09 — Consumer-driven packages:** Every created package exports behavior exercised by an
   RD-02 test or CLI path. No package name represents a future compiler pass, target, optimizer,
   asset handler, debugger, readiness service, or plugin framework.
10. [ ] **AC-10 — Public imports:** All cross-package imports resolve through declared package
    exports, no source imports another package's private `src/` or `dist/` path, and workspace
    dependency cycles are rejected.
11. [ ] **AC-11 — Editor boundary:** A direct specification test fails against synthetic
    frontend/language-server forbidden-edge fixtures, passes against allowed-edge fixtures, and
    automatically scans every matching real package that exists. The proof uses no empty production
    package and no general linter.
12. [ ] **AC-12 — Manifest positive case:** A JSONC manifest containing all ten public keys,
    comments, and trailing commas loads to the exact typed values and defaults defined by R2.15.
13. [ ] **AC-13 — Manifest negative cases:** Separate tests reject every missing required key,
    duplicate key, unknown key, unsupported `schemaVersion`, wrong JSON type, invalid enum, and
    invalid project-name/path value with a stable diagnostic and source span.
14. [ ] **AC-14 — Project discovery:** Tests from the project directory, a nested directory, an
    unrelated directory, and with an explicit relative and absolute `--project` path prove that the
    nearest or explicit manifest wins and that its directory is always the project root.
15. [ ] **AC-15 — Path containment:** Native Node 22 tests on `linux/x64` and `win32/x64` reject
    absolute manifest content paths, lexical `..` escape, symlink escape, symlink cycle, wrong file
    type, unreadable path, case-only collision, and canonical identity outside the project root.
    Linux simulation of Windows paths is supporting evidence only, not Windows qualification.
16. [ ] **AC-16 — Source inventory:** A fixture tree returns only regular `.blend` files under
    `sourceRoot` in canonical case-sensitive ASCII order, independent of creation/enumeration order;
    zero files and limit excess each produce their specified diagnostic.
17. [ ] **AC-17 — No filename semantics:** Renaming a `.blend` file without changing its bytes
    changes only path/source identity, not a fabricated module name; RD-02 contains no module-header
    scanner or path-based import rule.
18. [ ] **AC-18 — Exact target selection:** Each of the nine normative C64 profile IDs is accepted
    as configuration identity, while `c64u`, `cx16`, `a800xl`, `a7800`, unknown IDs, and arbitrary
    profile flag combinations are rejected without invoking code generation.
19. [ ] **AC-19 — Declarative manifest only:** Schema and tests prove that source globs, file lists,
    scripts, hooks, plugins, environment interpolation, tool paths, package declarations, and
    arbitrary extension keys cannot enter the project model.
20. [ ] **AC-20 — Coherent snapshot:** A controlled file replacement during loading produces either
    one complete pre-change snapshot, one complete post-retry snapshot, or a structured failure;
    it never returns manifest/source bytes or hashes from different states.
21. [ ] **AC-21 — Path-independent identity:** Two byte-identical project copies at different
    absolute paths and invoked from different working directories produce identical stable
    project-relative ordering, input hashes, and diagnostics after absolute host roots are removed.
22. [ ] **AC-22 — UTF-8 source coordinates:** Fixtures with ASCII, multi-byte BMP characters, and
    astral characters prove source spans use UTF-8 byte offsets and convert explicitly to host/LSP
    coordinates without shifting the next diagnostic.
23. [ ] **AC-23 — Typed failure:** Invalid JSONC, invalid paths, changed files, and host read errors
    return structured diagnostics with no usable snapshot, stack-trace leak, process crash, or file
    written under `outDir`.
24. [ ] **AC-24 — Truthful CLI foundation:** `blendc --help` and `blendc --version` succeed through
    the public package entry. Project-load failure uses the shared typed diagnostic service. The CLI
    does not claim that `check`, `build`, or `run` is implemented before RD-03.
25. [ ] **AC-25 — Bounded hostile input:** Tests cover file-count, file-size, total-byte,
    directory-depth, and retry limits and assert the diagnostic names the configured limit and
    observed value without excessive allocation, unbounded traversal, or partial snapshot.
26. [ ] **AC-26 — Focused verification:** The recorded RD-02 verification runs the new foundation's
    install, typecheck, build, directed project/host tests, and direct boundary test. It runs no
    Blend65 compiler pipeline, ACME, VICE, readiness, game corpus, or emulator suite.
27. [ ] **AC-27 — Observational measurements:** The closeout records separate discovery, JSONC,
    source-inventory/snapshot, TypeScript-build, test, and peak-memory observations with host and
    input identity; no numeric threshold controls pass/fail.
28. [ ] **AC-28 — Frozen authority consumed:** Build metadata and the salvage inventory record the
    exact Specification 4 and expert `2.0.0` identities from RD-01, and `spec/` remains unchanged.
29. [ ] **AC-29 — Deferral-expiry closeout:** The closeout answers whether RD-02 invalidates any
    deferral reason in the v4 register, Specification 4 future considerations, or expert-skill
    records. Every expired deferral is reopened with an owner before this RD closes.
