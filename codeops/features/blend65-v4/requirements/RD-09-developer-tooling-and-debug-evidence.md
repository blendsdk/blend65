# RD-09: Developer Tooling and Debug Evidence

> **Document**: RD-09-developer-tooling-and-debug-evidence.md
> **Status**: Draft
> **Created**: 2026-09-10
> **Project**: Blend65 v4
> **Depends On**: RD-04 to start; RD-05, RD-06, RD-07, and RD-08 to close
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

RD-09 completes the public compiler, command-line, language-server, and VS Code experience around
the compiler semantics and project model established by RD-02 through RD-04. A modern developer can
edit versioned unsaved source, receive the same authoritative diagnostics as `blendc check`, inspect
language and target information, navigate and safely rename symbols, format a document, explicitly
build, and launch only a freshly built artifact in VICE. Editor convenience never creates a second
parser, type system, project model, asset model, or compiler path. The complete workflow is initially
production-qualified on Node 22 for Linux x64 and Windows x64. (AR-003, AR-021, AR-022, AR-047,
AR-048)

The language server remains a frontend consumer: ordinary editor requests never import or execute
target lowering, optimization, code generation, ACME, packaging, or VICE. The thin VS Code client
owns editor integration and explicit trusted command execution. The compiler also emits portable,
versioned `.debug.json` evidence that preserves final source-to-machine mappings, function context,
symbols, SFA variable homes, types, live ranges, bank identity, and optimized-location state. This
evidence enables a later source-debugger decision without adding a Blend65-owned debug adapter or
any target runtime cost now. The bounded frontend/editor milestone may start after RD-04. Final
build/debug integration and RD-09 closeout require RD-05 through RD-08's platform, asset, load-unit,
optimizer, and final-location handoffs. (AR-008, AR-010, AR-021, AR-025)

> **Decisions:** AR-002 through AR-005, AR-008 through AR-012, AR-014, AR-020 through AR-028,
> AR-030, AR-032, AR-033, AR-036, AR-038, and AR-045 through AR-048.

---

## Functional Requirements

### Must Have

#### One compiler service and truthful CLI — complexity L

- [ ] **R9.1 — Expose one typed host service.** The public compiler package exposes cancellable
  project `check`, `build`, and `run` operations plus the shared frontend queries needed by the
  language server. Each operation accepts explicit invocation state, consumes RD-02's project or
  document snapshot, and returns structured diagnostics, evidence, or cancellation rather than
  terminating the host process. The CLI and editor adapters translate this service; they do not
  reimplement it. (AR-012, AR-021, AR-022)
- [ ] **R9.2 — Preserve one project contract.** CLI, API, language server, and VS Code use the same
  upward `blend65.json` discovery, explicit project selection, `sourceRoot` module index, target and
  entry overrides, contained paths, profile facts, asset declarations, and stable identities.
  Editor use adds in-memory source overlays but no second manifest, workspace file list, glob model,
  or single-file production mode. (AR-022, AR-028, AR-030)
- [ ] **R9.3 — Keep CLI commands behaviorally complete.** `blendc check` stops before target
  lowering and output publication; `blendc build` runs the complete selected pipeline and
  publishes one immutable build generation through the approved staging/current-record protocol;
  `blendc run` performs its own successful fresh build, durably pins that invocation's generation
  before releasing the publication lock, and launches only its primary artifact after pin
  acquisition succeeds. All three report the same stable diagnostics as the host service for the
  same saved snapshot. (AR-009, AR-022, AR-032)
- [ ] **R9.4 — Distinguish operation outcomes.** The typed API and CLI distinguish successful
  completion, source/project/compiler diagnostics, external-tool failure, and user cancellation.
  Expected failures have stable machine-readable categories and concise human output without a
  stack trace. A failed or pre-publication-cancelled build publishes no new generation. A run result
  distinguishes a successfully published build from later emulator cancellation and never launches
  an older or unpinned artifact. (AR-022, AR-025)
- [ ] **R9.5 — Keep tool discovery machine-local and deterministic.** `blend65.json` cannot contain
  executable paths. CLI and VS Code share one optional JSONC tools file at
  `${XDG_CONFIG_HOME:-$HOME/.config}/blend65/tools.jsonc` on Linux and
  `%APPDATA%\blend65\tools.jsonc` on Windows. A present file requires integer `schemaVersion: 1`
  and permits only optional absolute-string `acmePath` and `x64scPath`; unknown or duplicate keys,
  wrong types, a missing version, and unsupported versions are stable configuration diagnostics. A
  configured path wins and must resolve to a canonical regular executable with the pinned compatible
  identity; an invalid configured path fails without fallback. For each omitted key or an absent
  file, use only normal process-`PATH` lookup and its native ordering. `PATH` is host execution
  authority; there is no fixed-install-location registry or special rejection of a project-contained
  `PATH` entry. Record canonical path and version in normal build evidence; an executable hash is
  qualification provenance outside portable reproducibility comparison. Never download or install a tool,
  invoke a shell, or accept a path, argument, option, or monitor command from project/source/asset/
  diagnostic content. Compiler-library use, assembly emission, `check`, and ordinary LSP analysis do
  not load or validate the tools file and require no external tool; binary production requires ACME,
  and `run` requires ACME plus `x64sc`. Missing or incompatible tools fail only the operation that
  needs them with an actionable diagnostic. (AR-022, AR-048)
- [ ] **R9.6 — Preserve exact cancellation ownership.** Cancelling `check` stops outstanding
  analysis; cancellation observed before build publication terminates owned ACME work and removes
  only that invocation's unpublished staging directory. Publication is the no-return point: after
  the current-generation record commits, the valid build remains published and a later `run`
  cancellation terminates only its owned VICE/monitor work. Cancellation waits for owned child
  cleanup and releases exactly its pin under the project lock only after that work stops. A failed
  pin release leaves the conservative pin in place and reports manual recovery; it never guesses
  from PID, age, or process existence. No lock or owned process/monitor may remain. The structured
  result reports build success separately from later run cancellation. (AR-021, AR-022)

#### Versioned editor snapshots and diagnostics — complexity L

- [ ] **R9.7 — Analyze versioned unsaved source.** The language server combines one coherent
  project snapshot with the latest versioned in-memory contents of every open `.blend` document in
  that project. It never reads an older disk copy in place of a newer open version. Closing an
  unsaved document removes its overlay and deterministically restores the saved project view.
  (AR-021, AR-022)
- [ ] **R9.8 — Associate documents by the project rule.** Each open `.blend` document uses the
  nearest containing `blend65.json` found by AR-022/AR-028 discovery. Documents resolving to the
  same resolved manifest share one project context; documents in different projects remain
  isolated. A project-wide operation never crosses a manifest root, and a document with no valid
  project receives the shared project diagnostic rather than an invented implicit project.
  (AR-021, AR-022, AR-028)
- [ ] **R9.9 — Cancel and discard stale analysis.** Every document change increments its version
  before analysis. A superseded or cancelled result may complete internally but cannot publish
  diagnostics, symbols, edits, completion, hover, or navigation for an older version. Project,
  manifest, source, asset, profile, or settings changes invalidate only affected contexts and
  schedule a new authoritative result. (AR-011, AR-021, AR-026)
- [ ] **R9.10 — Convert coordinates explicitly.** Compiler spans retain exact host-exposed
  project-relative spelling, a separate resolved identity, and UTF-8 byte offsets. The
  language-server boundary converts them to and from
  protocol line/character coordinates without changing compiler identity. ASCII, multibyte UTF-8,
  astral Unicode, CRLF, LF, empty files, and end-of-file spans must not shift the following token or
  edit. (AR-021, AR-022)
- [ ] **R9.11 — Publish authoritative diagnostics.** Live diagnostics include lexical, syntax,
  module/import, semantic, effect, profile-capability, asset-handler, placement-constraint, and
  project failures provable before target lowering. They preserve Specification 4 code, severity,
  message, primary/related spans, deterministic order, and cascade suppression. Final addresses,
  sizes, branch repair, whole-program placement/no-space, ACME, packaging, and VICE failures remain
  build/run results rather than guessed editor diagnostics. (AR-014, AR-021, AR-022)
- [ ] **R9.12 — Keep partial analysis poison-safe.** Syntax recovery may support nearby
  diagnostics and editor queries, but recovered or poisoned nodes never become valid symbols,
  rename targets, code-action edits, SFA input, or backend input. A response whose requested fact
  depends on poison is absent or explicitly unavailable; it is never fabricated. (AR-002, AR-021)
- [ ] **R9.13 — Keep ordinary editor requests frontend-only.** Diagnostics, completion, hover,
  signature help, definition, references, rename, symbols, semantic tokens, code actions, and
  formatting may load the project, lexer, parser, semantic model, profiles, and asset metadata.
  They must not import or invoke target lowering, optimization, code generation, ACME, packaging,
  artifact publication, VICE, or their process adapters. (AR-012, AR-021)

#### Production language-server operations — complexity XL

- [ ] **R9.14 — Complete context-aware source completion.** Completion proposes only declarations,
  fields, types, functions, modules, keywords, literals, and platform APIs legal at the cursor's
  recovered syntactic and typed context. It includes reachable import members, named parameters
  where the language permits them, `embed()` paths and handler selectors, profile constants, and
  typed `place(... region: ...)` values. It does not propose inaccessible, wrong-kind, unsupported-
  profile, generated, or unqualified future-target members. (AR-003, AR-020, AR-021)
- [ ] **R9.15 — Bound asset-path completion.** `embed()` path completion searches only the
  declaring source directory and configured contained asset paths, applies the same canonical
  containment and file rules as compilation, and returns project-relative choices. Missing,
  unreadable, symlink-escaping, excessive, or malformed directories produce bounded diagnostics or
  no items; they never trigger unbounded traversal or expose files outside the project. (AR-021,
  AR-022)
- [ ] **R9.16 — Provide exact hover information.** Hover reports the resolved declaration kind,
  exact Blend65 type and fixed aggregate shape, `const`/mutability and borrow meaning, function
  signature and effects, compile-time value when available, module identity, platform availability,
  volatile/MMIO meaning, asset selector/type/provenance summary, or placement constraint relevant
  to the symbol. It does not expose guessed final addresses or costs before a build proves them.
  (AR-008, AR-015 through AR-021)
- [ ] **R9.17 — Provide signature help from semantic candidates.** At calls and intrinsic uses,
  signature help identifies the active parameter and every type-compatible declared or built-in
  signature retained by semantic analysis. It preserves `const`, fixed/outer-unsized array shape,
  function-value, callback-only, address, and selected-profile constraints. Poisoned or ambiguous
  calls never display one guessed winner. (AR-015 through AR-019, AR-021)
- [ ] **R9.18 — Navigate to authoritative declarations.** Definition resolves source symbols,
  merged-module members, imports, platform APIs, and asset declarations to their canonical source
  or bundled read-only declaration location. References return only semantically identical uses in
  the current project, including callable values and recognized callback sinks; spelling matches,
  distinct shadowed bindings, generated labels, and another project are excluded. Before, inside,
  and after a shadowing child scope, definition and references follow the nearest visible stable
  declaration identity rather than its spelling. (AR-014, AR-018, AR-021, AR-028)
- [ ] **R9.19 — Rename only when it is provably safe.** Project-wide rename is available for
  user-owned source declarations whose complete semantic reference set is known. It rejects names
  that are invalid, reserved, colliding, ambiguous, generated, platform-owned, asset-selector
  schema names, external/read-only declarations, or dependent on poisoned analysis. Before
  returning edits it revalidates the requested document version and all affected file identities;
  every edit is non-overlapping and remains inside the project. A rename edits only the selected
  stable declaration identity and its references; it must reject a result that would capture, hide,
  or merge another binding even when the original spellings differ. (AR-014, AR-021, AR-022)
- [ ] **R9.20 — Return structured symbols.** Document symbols preserve source nesting and order for
  modules, declarations, functions, parameters, locals, fields, constants, variables, and relevant
  assets. Workspace symbols search the current project only, return deterministic qualified names
  and locations, and obey a documented result bound without changing semantic identity. Generated
  machine labels are build evidence, not source symbols. (AR-008, AR-021)
- [ ] **R9.21 — Publish semantic tokens without inventing syntax.** Tokens distinguish language
  kinds and stable semantic modifiers such as declaration/reference, mutable/read-only,
  compile-time, volatile, platform-owned, and interrupt-only where supported by the selected
  protocol/client. Lexical fallback is allowed for invalid regions, but a recovered guess cannot
  misclassify a symbol as semantically resolved. (AR-003, AR-021)
- [ ] **R9.22 — Limit code actions to compiler-proved edits.** A code action exists only when a
  Specification 4 diagnostic or an exact semantic fact supplies a closed, behavior-preserving edit.
  The response identifies its diagnostic/fact and versions; applying it after relevant input
  changes is rejected or recomputed. No broad refactoring, hardware-policy rewrite, generated-code
  edit, source workaround for missing lowering, or speculative conversion is offered. (AR-002,
  AR-021)
- [ ] **R9.23 — Provide one canonical full-document formatter.** Formatting is deterministic and
  idempotent, preserves every non-trivia token, literal value, comment, declaration, and source
  behavior, and returns either one complete non-overlapping edit set for the requested version or
  no edits. It has no style options, per-project configuration, partial-range mode, import
  reordering, semantic rewrite, or formatter plugin surface. Invalid input may be rejected with an
  actionable result rather than being structurally guessed. (AR-011, AR-012, AR-021)
- [ ] **R9.24 — Keep protocol failures bounded.** Unknown methods, invalid messages, oversized
  payloads, missing documents, bad versions, cancelled requests, and internal failures produce the
  protocol-appropriate bounded error or empty result. They cannot crash the server, leak a host
  path or stack, publish stale output, or mutate source/project files. (AR-021, AR-022)

#### Thin VS Code integration — complexity L

- [ ] **R9.25 — Keep the extension a thin client.** The extension contributes Blend65 language
  registration, file association, comments, brackets, indentation, syntax highlighting, automatic
  language-server startup, command registration, status, Problems, Output, and artifact-opening
  integration. It contains no lexer, parser, symbol table, type checker, asset decoder, target
  model, lowering, optimizer, packager, or VICE protocol implementation. (AR-012, AR-021)
- [ ] **R9.26 — Show truthful project status.** For the active Blend65 document, status shows no
  project, invalid project, analyzing, ready, error, or cancelled state plus the canonical project
  name and exact effective target profile when known. It never labels a stale, poisoned, failed, or
  partial analysis as ready and never infers profile state from filename or prior build output.
  (AR-021, AR-022)
- [ ] **R9.27 — Expose exactly two execution commands.** Register `Blend65: Build` and
  `Blend65: Run in VICE`; do not register `Build and Run` or a no-build rerun alias. Before either
  command, request saving every dirty open project input consumed by that operation. If saving is
  declined or any save fails, abort before build or launch and identify the unsaved input.
  `Run in VICE` invokes the same fresh-build `run` contract as the CLI. (AR-009, AR-022, AR-047)
- [ ] **R9.28 — Require trust and explicit intent for execution.** Untrusted workspaces may start
  the language server and use ordinary read-only analysis/navigation. Build, run, executable
  discovery, child processes, monitor connections, and artifact-open commands that can invoke an
  external application require VS Code workspace trust and an explicit user command. No file open,
  save, edit, diagnostic, completion, or formatter request automatically executes a tool or VICE.
  (AR-021, AR-022)
- [ ] **R9.29 — Route commands through the authoritative operation.** The extension supplies the
  active project identity, cancellation, and an output sink to the public compiler/CLI adapter. For
  a tool-requiring command only, the adapter loads the shared version-1 machine-local tools file and
  applies its config-or-`PATH` rule. The extension does not reconstruct command arguments from
  diagnostic text, invoke a shell, publish artifacts itself, or mark success before the operation's
  structured result confirms it. (AR-012, AR-021, AR-022)
- [ ] **R9.30 — Provide cancellable progress and useful output.** Build and run show one progress
  operation with project, profile, phase, and cancellation. Problems receives compiler diagnostics;
  the dedicated Blend65 Output channel receives bounded phase/tool summaries and the final artifact
  path or failure category. Neither surface logs complete source/asset contents, VICE monitor data,
  absolute paths when a project-relative identity is sufficient, or raw stack traces for expected
  failures. (AR-021, AR-022, AR-026)
- [ ] **R9.31 — Refresh from real changes.** Source edits use document versions; saved manifest,
  source, asset, and relevant editor-setting changes invalidate affected project facts. Refresh is
  cancellable and coalesces superseded events without requiring a persistent compiler daemon or
  content-addressed build cache. File creation, deletion, rename, or module-header change rebuilds
  the contained module index before publishing a new result. (AR-011, AR-021, AR-028)
- [ ] **R9.32 — Open generated evidence without creating an artifact browser.** After a successful
  build, explicit commands can open the emitted assembly, labels, memory map, asset map, cost report,
  debug map, and build record, and reveal the primary deployable artifact. Paths come from a valid
  contained `.build.json` in one immutable generation and must match its artifact hashes. The UI
  identifies the record's generation and whether it is current; opening old
  evidence does not claim that it matches current unsaved source.
  (AR-008, AR-021, AR-022, AR-032)
- [ ] **R9.33 — Package one self-contained supported extension.** The release extension starts the
  matching language server and uses the matching protocol/API schema without asking users to clone
  compiler sources or install an editor-side semantic package. ACME and VICE remain separately
  discovered host tools for explicit build/run. Version mismatch yields an actionable error rather
  than silently degraded semantics. (AR-021, AR-022)

#### Portable compiler debug evidence — complexity XL

- [ ] **R9.34 — Consume the first-producer debug contract.** Every successful build emits
  `.debug.json` under the complete version-1 contract frozen by RD-03 before its first tests and
  implementation. It resides in the same immutable build generation as the primary artifact,
  assembly, labels, maps, costs, and `.build.json`. It records its schema version,
  compiler/specification/expert-skill identities,
  target profile, CPU, optimization/safety settings, source/asset hashes, final artifact hash, and
  address-space model. A failed or pre-publication-cancelled build publishes no replacement debug
  artifact. (AR-008, AR-010, AR-022)
- [ ] **R9.35 — Keep source identity portable and exact.** Debug sources preserve exact
  host-exposed project-relative spellings, content hashes, and UTF-8 byte spans with optional line
  indexes for consumers. The compiler validates containment and alias identity separately but does
  not serialize host-specific resolved identities into debug evidence. Rebuilding a project with
  the same relative spellings and bytes under a different absolute root produces the same debug
  artifact. Host absolute paths, process working directory, timestamps, random IDs, and traversal
  order do not affect semantic identity. (AR-010, AR-022, AR-026)
- [ ] **R9.36 — Map final machine ranges to source meaning.** Each reachable final instruction or
  contiguous machine range records its address-space/bank/load-unit identity, address interval,
  originating source span or explicit compiler-generated classification, containing function and
  call/inlining context, and applicable optimization provenance. Mappings use post-layout,
  post-branch-repair addresses and can represent one source span mapping to zero, one, or multiple
  non-contiguous ranges. (AR-008, AR-010, AR-023)
- [ ] **R9.37 — Describe symbols and function contexts.** Debug evidence records source name,
  qualified identity, kind, exact Blend65 type/shape, scope, declaration span, linkage/visibility,
  entry variants, machine labels/ranges, bank/address-space identity, and relevant calling or
  interrupt context for every emitted source-owned function and stored object. Compiler-generated
  helpers, startup, loader, and platform objects remain separately classified and source-linked
  where a source operation caused them. Distinct declarations with the same spelling have distinct
  stable identities and scopes and are never merged in the debug map. (AR-008, AR-010, AR-014,
  AR-018)
- [ ] **R9.38 — Describe SFA variables without inventing runtime state.** For parameters, returns,
  locals, temporaries exposed by source mapping, and helper scratch needed for call context, record
  exact type, function/domain instance, final static home, byte width, valid live intervals, aliases
  or composed locations, and availability state. The schema distinguishes available, optimized
  away, constant, rematerializable, split, and unavailable values rather than claiming a stale home.
  Same-spelling bindings remain distinct by stable declaration identity; hiding never proves the
  outer binding dead or permits an invalid overlay. It never adds a runtime descriptor, stack frame,
  shadow memory, or instrumentation. (AR-010, AR-014, AR-016, AR-018, AR-023)
- [ ] **R9.39 — Preserve banked and loadable identity.** A location is never just a flat 16-bit
  number when the selected profile requires CPU-visible, banked, overlay, load-unit, or transfer-
  only identity. The debug map records the selected address space, bank/visibility condition,
  load-unit/publication state, and any final residence interval needed to interpret an address.
  Core Blend65 `word` remains 16-bit; wider physical identity belongs to the platform evidence.
  (AR-010, AR-024, AR-029, AR-031)
- [ ] **R9.40 — Keep labels and debug ranges coherent.** Every emitted public/machine label resolves
  to the same final object/range and bank identity in `.labels`, `.memory.json`, and `.debug.json`.
  Every debug machine range lies inside an emitted/loadable object recorded by the memory/build
  evidence, does not overlap incompatibly, and corresponds to bytes in the hashed primary or
  packaged artifact. (AR-008, AR-010, AR-022, AR-032)
- [ ] **R9.41 — Charge zero target runtime cost.** Debug evidence is host-side build output. Enabling
  its required production emission adds zero bytes to the PRG/D64 payload, zero resident RAM/ZP/SFA
  or hardware-stack demand, zero startup/loader work, zero target cycles, and no debug-cart,
  breakpoint trap, polling loop, monitor stub, or runtime library. (AR-002, AR-010)
- [ ] **R9.42 — Run the bounded adapter interoperability probe.** Test whether at least one
  maintained VICE-capable debugger adapter can consume or be translated from the required debug
  artifact for source breakpoints, instruction/source stepping, and available variable inspection.
  Record supported, lossy, and unsupported mappings with exact adapter/VICE/schema versions. The
  result may recommend later adapter integration or reopen an owned-adapter decision, but this RD
  does not implement, bundle, or promise a Blend65-owned Debug Adapter Protocol service. (AR-010)

#### Independent qualification without a tooling framework — complexity XL

- [ ] **R9.43 — Derive specification tests before implementation families.** Author immutable
  `*.spec.test.ts` cases from Specification 4, this RD, the selected project/target contracts, and
  the pinned protocol/client contracts. Consume all five complete first-producer version-1 sidecar
  contracts frozen by RD-03 without replacing or extending them. Test every closed root, tagged
  union, required/forbidden field, stable array order, digest rule, local invariant, and
  cross-artifact relationship. Apply RD-03's validation precedence exactly: E10267 diagnoses a
  malformed envelope or supported-version payload, while E10268 diagnoses only a correct kind with
  an unsupported positive integer schema version and does not inspect that payload. Cover each
  language-server operation, stale/cancel edge, trust boundary, command flow, and schema invariant
  with positive, boundary, negative, and interaction cases. Add no shared schema registry, service,
  framework, or database. Implementation tests remain separate and cannot weaken these oracles.
  (AR-014, AR-021, AR-025)
- [ ] **R9.44 — Prove shared semantics structurally and behaviorally.** Direct dependency tests
  forbid frontend/language-server imports of codegen, optimizer, packager, VICE, or process-adapter
  packages. Paired CLI/LSP fixtures prove identical diagnostics, symbol/type facts, profile/asset
  meaning, and project identities for the same saved bytes; unsaved overlays change only their
  versioned editor context. (AR-012, AR-021, AR-022)
- [ ] **R9.45 — Verify protocol behavior through real boundaries.** Use the real language-server
  transport and packaged VS Code client for bounded activation, diagnostics, every advertised
  request, document changes, cancellation, trust, commands, output, and artifact opening. Mock only
  the editor or operating-system boundary that cannot run in the test host; never mock the compiler
  service whose sharing is under proof. (AR-021, AR-025)
- [ ] **R9.46 — Qualify evidence independently.** Validate every public JSON sidecar against its own
  frozen schema and unsupported-major behavior, then validate identity hashes, all range/location
  invariants, labels/maps/artifact cross-links, `none` plus every optimized mode, inlining/removal/
  rematerialization, direct/finite calls, SFA overlays, interrupt variants, banked assets, and load
  units. Separately inspect the target artifact to prove that debug emission adds no bytes, storage,
  initialization, or cycles. (AR-008, AR-010, AR-023)
- [ ] **R9.47 — Keep verification impact-based.** During implementation run only affected
  compiler-service, language-server, extension, formatter, command, or debug-evidence cases. At the
  RD closeout run the complete tooling boundary once, including package/build qualification and
  only the small ACME/VICE paths needed to prove editor `Build`/`Run in VICE`. Do not rerun unrelated
  compiler, asset, game, or readiness corpora and do not create a tooling-readiness product.
  (AR-025, AR-026, AR-033)
- [ ] **R9.48 — Observe responsiveness without a timing gate.** Record diagnostics, completion,
  hover, definition, references, rename, formatting, cold/warm check/build, ACME, run startup, and
  peak host-memory observations for real qualified projects with full host/project/tool identity.
  No wall-clock threshold fails a test or release. Reopen incremental analysis only under AR-011's
  measured-need rule. (AR-011, AR-026)
- [ ] **R9.49 — Recheck deferrals and expressiveness.** At closeout, scan the ambiguity register,
  all RD Won't Have sections, Specification 4 future considerations, and the expressiveness ledger.
  Reopen any deferral whose reason expired, record any modern-developer workflow restriction, and
  assign a new owner before this RD closes. RD-09 cannot close until RD-05 through RD-08 have
  completed the required platform, frontend-asset, load-unit, optimizer, final-location, and evidence
  schema handoffs and the final build/debug integration milestone has consumed them. (AR-002,
  AR-003, AR-010, AR-033)

### Should Have

- [ ] **R9.50 — Keep editor explanations source-first — complexity S.** Hover, diagnostics, status,
  and code actions explain Blend65 declarations and selected-profile constraints in modern source
  terms. Hardware details appear when they are the real cause; compiler package names, pass names,
  SFA implementation shortcuts, and v3 history do not become user guidance. (AR-002, AR-003)
- [ ] **R9.51 — Make generated evidence easy to correlate — complexity M.** Opened assembly and
  reports use stable source-related labels and build identities so a developer can move from a
  source function or diagnostic to the relevant function, asset, memory, cost, or debug entry
  without a custom visual browser. This adds no semantic operation or target runtime cost. (AR-008,
  AR-021)
- [ ] **R9.52 — Keep extension activation economical — complexity S.** Activate for Blend65
  documents or projects, share one language-server process per VS Code extension host where safe,
  release closed project contexts, and bound retained snapshots and outputs. These are host resource
  practices, not wall-clock acceptance thresholds or permission for a daemon/cache framework.
  (AR-011, AR-021, AR-026)

### Won't Have (Out of Scope)

- A Blend65-owned Debug Adapter Protocol implementation, debugger UI, breakpoint manager, watch
  window, disassembler, memory editor, or guaranteed integration with a specific third-party
  adapter. This RD preserves evidence and runs the bounded interoperability probe only. (AR-010)
- Visual sprite, charset, bitmap, map, music, memory-layout, profile, or game editors; gameplay,
  renderer, scene, entity, collision, audio, or engine tooling. Blend65 remains a compiler and
  asset consumer, not a game engine or content-authoring suite. (AR-038)
- A package manager, plugin marketplace, public compiler/asset/target extension API, build scripts,
  hooks, task runner, remote service, telemetry pipeline, cloud build, or remote cache. (AR-012,
  AR-022)
- A configurable formatter framework, style profiles, range formatter, import organizer, broad
  refactoring engine, source generator, or AI code-action system. (AR-011, AR-021)
- Automatic build/run on open, edit, save, diagnostics, or completion; a no-build VICE rerun; or a
  duplicate `Build and Run` command. Execution remains explicit and fresh. (AR-021, AR-047)
- Mandatory incremental compilation, persistent compiler daemon, cross-session semantic cache,
  filesystem database, synthetic-scale readiness suite, or host timing pass/fail gate. (AR-011,
  AR-026)
- Editor-side target lowering, optimization, code generation, assembly, packaging, emulator
  control, or duplication of compiler semantics. (AR-012, AR-021)
- V3 compatibility, v3 editor behavior, v3 tests as authority, feasibility-matrix integration, or
  readiness dashboards/gates. (AR-004, AR-025)
- C64U, X16, Atari, another CPU, another assembler, or another editor implementation. The shared
  tooling contracts must not block later qualified consumers, but no empty package or speculative
  adapter is created here. (AR-012, AR-024)

---

## Technical Requirements

### Tooling responsibility boundary — complexity L

```text
saved project snapshot + versioned open-document overlays
                         |
                         v
              shared frontend/project service
              /                            \
     blendc check / host API          language server
              |                            |
     explicit build / run only        thin VS Code client
              |
   lowering -> optimization -> ACME -> packaging -> optional VICE
```

The language-server branch ends at frontend, profile, and asset metadata. Only explicit host/CLI or
trusted VS Code commands enter the backend branch. Package dependency tests enforce this boundary;
convention and code review alone are insufficient. One concrete module may serve several adjacent
responsibilities, but a convenience import cannot create a frontend-to-codegen edge.

### Build generation and evidence identity — complexity L

Each artifact-producing build assigns the lowercase canonical UUID v4 returned by Node
`crypto.randomUUID()` as one unique opaque `generationId`, writes and validates a unique staging
directory, renames it once to that immutable generation, then atomically replaces one small
current-generation record containing the `generationId` and the SHA-256 of its `.build.json`. An
existing target generation fails publication rather than being overwritten or reused. A short
per-project lock coordinates only generation publication, current-record replacement, pinning, and
cleanup. Every compiler-owned reader that keeps a generation after releasing the lock first creates
its distinct RD-03 pin; each run creates its pin before its publication critical section ends and
keeps it until all owned VICE/monitor work ends. Failed work removes only its staging directory.
Publication cleanup retains the current generation, the current record's immediate predecessor, and
every pinned generation; it deletes only other provably unpinned generations while holding the same
lock. Normal released-pin retention is bounded to current plus one predecessor. Uncertain or
crash-left pins fail closed, are diagnosed, and remain until deliberate manual recovery. This is one
direct host-side routine, not a transaction, liveness, or storage framework, and adds no target
bytes, storage, startup work, or cycles.

The configured relative `outDir` is compiler-owned output state, never an input or input-identity
source. Discovery excludes the output subtree before walking sources/assets even when `sourceRoot`
is `.`, and the directory may contain prior generations. Publication validates the nearest existing
canonical parent and creates only missing contained components; absolute/escaping paths, a file in
place of a required directory, symlink escape, and declared input inside the output tree fail before
staging or child-process launch.

`generationId` is only an operational publication and pin identity. It appears only in the
directory name, `<outDir>/current.json`, run pins, and invocation-specific `.build.json`; it never
enters deterministic outputs or reproducibility comparison and is never used to reuse a generation
as a cache entry. `.build.json` records it, canonical semantic inputs, portable tool identities,
host provenance, and hashes for every other generated artifact, explicitly excluding itself.
Reproducibility compares the recorded semantic inputs, portable tool identities, and deterministic
output hashes.
Host-specific executable paths and hashes, duration, peak memory, and `generationId` are
invocation provenance outside that comparison. `.assets.json`, `.memory.json`, `.costs.json`, and
`.build.json` evolve independently under the producer contracts frozen by RD-03 and consumed by
R9.43; no reader guesses an unsupported major.

Publication is the build no-return point. Cancellation observed before the current record commits
publishes nothing. Once it commits, the immutable generation remains a successful valid build;
later run cancellation releases its pin after terminating only the owned VICE process tree and
monitor connection. A race at the commit boundary is resolved by the observed commit order and can
never report the generation as both unpublished and current.

### Snapshot and request model — complexity L

| Identity | Required behavior |
|---|---|
| Project | Resolved `blend65.json` identity and RD-02 coherent saved snapshot |
| Document | Exact host-exposed project-relative spelling plus resolved identity and monotonically increasing open-document version |
| Overlay set | Latest open bytes for every document in that project at request start |
| Request | Project snapshot, overlay versions, requested document/version, method, and cancellation token |
| Publication | Allowed only if all response-dependent identities and document versions remain current |
| Build/run | Saved coherent filesystem snapshot only; dirty consumed open inputs are saved or the command aborts; each successful run pins its committed immutable generation |

Full project re-analysis is permitted. Incremental text synchronization does not imply an
incremental compiler. The implementation may coalesce superseded work and retain bounded in-memory
facts, but correctness is defined by immutable request identity and stale-result rejection, not by
a cache strategy.

### Language-server capability boundary — complexity XL

| Capability | Authoritative input | Required negative boundary |
|---|---|---|
| Diagnostics | Shared frontend/project/profile/asset facts | No guessed final layout, ACME, or VICE result |
| Completion | Recovered syntax plus legal visible typed candidates | No inaccessible, unsupported, or outside-project path |
| Hover/signature | Resolved semantic declaration/call/intrinsic | No guessed overload, final address, or cost |
| Definition/references | Exact symbol identity and project graph | No spelling-only or cross-project match |
| Rename | Complete safe user-owned reference set | Reject collision, poison, stale input, generated/platform identity |
| Symbols | Source declaration graph | No generated machine-label substitution |
| Semantic tokens | Lexical kind plus proven semantic modifiers | No semantic guess in poisoned regions |
| Code actions | Diagnostic or exact fact with closed safe edit | No general refactoring or workaround for compiler defects |
| Formatting | Parsed non-trivia/comment structure for one version | No semantic rewrite, option surface, or guessed invalid structure |

### VS Code command flow — complexity L

```text
explicit Build / Run in VICE
  -> require trusted workspace
  -> resolve active Blend65 project
  -> identify dirty open inputs consumed by the operation
  -> save every such input or abort
  -> invoke authoritative build / fresh-build run
  -> stream bounded progress and structured diagnostics
  -> publish success only from the operation result
  -> enable contained, hash-bound artifact access
```

The extension never shells out through a command string. Whether the final adapter invokes the
public compiler in-process or starts the matching `blendc` executable is a packaging decision; in
either case it uses a typed/versioned operation boundary, argument arrays for child processes, and
the same behavior as the public CLI. It cannot implement a third build pipeline.

### Debug artifact consumer map — complexity XL

The normative root, exact records, tagged unions, index rules, ordering, encoding, and rejection
behavior are frozen in RD-03's **Debug JSON version 1 — first-producer contract**. This table only
maps those records to RD-09 consumers; it does not redefine them.

| Record | Required facts |
|---|---|
| Header | Schema/compiler/specification/skill/profile/CPU/mode/safety identities and artifact hashes |
| Sources | Project-relative identity, content hash, UTF-8 span basis, optional deterministic line index |
| Address spaces | CPU-visible/banked/overlay/load-unit/transfer-only identity and profile visibility conditions |
| Functions | Qualified source identity, declaration, entry variants, call/inlining context, machine ranges |
| Symbols | Kind, exact type/shape, source scope, linkage, storage/address-space identity, final labels/ranges |
| Variable locations | Function/domain, SFA home or composed location, live interval, availability state |
| Range map | Final bank-qualified half-open machine range, source span/generated cause, function context, optimization provenance |
| Load state | Load unit, destination/address space, publication/residence interval needed to interpret a location |

All address intervals are half-open and validated after final layout. RD-09 implements consumers,
artifact access, validation, and the bounded adapter probe against the frozen contract. A missing
representational fact blocks its producing RD and requires explicit schema evolution; neither an
implementation nor the RD-09 plan may silently add a version-1 field. Readers reject unsupported
schema majors rather than guessing.

### Diagnostic and output ownership — complexity M

| Failure | Owning surface |
|---|---|
| Manifest, source inventory, lexical, syntax, import, type/effect, profile capability, asset schema | Shared frontend; identical in CLI/LSP |
| Unsaved document parse/semantic issue | LSP overlay context only until saved |
| Save declined/failed | VS Code command result; no build/run |
| Final SFA, legalization, placement, branch, memory, optimizer, ACME, packaging | Build/API/CLI/VS Code command output |
| VICE discovery, launch, monitor, timeout, cancellation | Run/API/CLI/VS Code command output |
| LSP protocol/version/request failure | Language-server protocol response and bounded server log |
| Artifact schema/hash/path mismatch | Artifact-open command and build-evidence validation; never execute the artifact |

### Verification topology — complexity XL

| Tier | Normal trigger | Evidence |
|---|---|---|
| Shared service | Public operation, project, diagnostic, or cancellation contract changes | Typed result and CLI/API parity cases |
| LSP unit | One query or coordinate mapper changes | Rule-specific positive/boundary/negative/stale cases |
| LSP transport | Protocol startup, synchronization, cancellation, or failure changes | Real message exchange and malformed/bounded input cases |
| VS Code client | Activation, trust, command, status, Problems/Output, or artifact access changes | Packaged extension-host boundary with compiler service real |
| Debug evidence | Mapping, SFA, optimizer, bank/load identity, or schema changes | JSON schema plus cross-artifact and zero-target-cost proof |
| Build/run | Explicit editor command integration changes | One small ACME build and one sequential VICE launch/cleanup case |
| RD closeout | Once after all focused families pass | Complete tooling boundary and deferral/expressiveness rescan |

No tooling test uses compiler output as its own semantic oracle. Protocol and extension tests assert
the independently required result, and debug tests derive expected source/machine relationships
from controlled source, assembly, layout, and artifact evidence.

---

## Integration Points

### With RD-01 (Specification 4 and Expert Authority)

Tooling consumes the frozen grammar, symbol/type rules, diagnostics, platform declarations,
intrinsic signatures, asset selectors, placement regions, and expert `2.0.0` knowledge identity.
Editor behavior cannot create a language rule or silently retain Specification 3 syntax.

### With RD-02 (Foundation and Project Model)

RD-09 reuses the public package boundaries, typed project loader, upward discovery, source index,
contained path rules, coherent saved snapshot, stable UTF-8 identities, TypeScript/Turbo/Vitest
toolchain, and direct boundary tests. It adds in-memory document overlays and editor adapters rather
than replacing the project host.

### With RD-03 and RD-04 (M1 and Complete Language)

RD-03 supplies the first real LSP transport, bundled VS Code client, and debug map; RD-04 completes
the source language, shared symbol/type/diagnostic service, and correct unoptimized compiler. RD-09
expands those real consumers to the production tooling surface. It does not defer or redefine any
source semantics.

### With RD-05 through RD-07 (C64, Assets, and Loading)

These RDs expose typed platform APIs, profile constants/regions, native asset handler metadata,
placement constraints, banked/loadable objects, and build evidence. RD-09 presents those facts and
their diagnostics without importing their backend implementation into the language server. Final
addresses, residency, and costs come only from successful build artifacts.

### With RD-08 (Optimization and Expert Output)

RD-08 preserves final source/machine mappings, optimized-away/rematerialized/final-home evidence,
costs, and transformation identities. RD-09 serializes and exposes that evidence. Ordinary LSP
requests never run optimization, and debug convenience never blocks a legal winning transform when
the value's unavailability is represented honestly.

### With RD-10 (Production Qualification and C64U Handoff)

RD-10 qualifies the complete public CLI/editor journey, packaged extension, bounded host
responsiveness evidence, debug schema, trust and injection boundaries, and each base-C64 profile's
build evidence. The debug/address-space schema must pass the C64U-readiness gate without claiming
C64U implementation.

---

## Non-Functional Requirements

### Correctness and determinism — complexity XL

- Identical project bytes, open-document versions, settings, and request identity produce identical
  normalized diagnostics, query results, edits, debug evidence, and command selection regardless of
  absolute checkout path, working directory, filesystem enumeration, locale, concurrency, or Turbo
  scheduling.
- No stale, cancelled, poisoned, incomplete, or wrong-project result may be published as current.
- No editor surface may make unsupported source compile, hide an authoritative diagnostic, or
  change compiler behavior independently of the shared service.

### Host responsiveness — complexity M

- Document edits and requests remain cancellable; superseded work is discarded and retained
  snapshots, project contexts, diagnostics, output, and protocol messages are bounded.
- Responsiveness measurements are observational. There is no duration assertion in tests, CI,
  milestone acceptance, or release qualification.
- The first response to measured delay is attribution and focused repair, not a daemon, cache,
  worker pool, readiness harness, or broad incremental framework.

### Target cost — complexity S

- Language-server and editor features add no target code, data, runtime, startup, storage, or cycle
  cost.
- Required `.debug.json` emission is host-side only and cannot change assembly, placement, package
  bytes, artifact hash, or VICE behavior.

### Maintainability and portability — complexity L

- Public APIs, protocol/schema boundaries, and non-trivial snapshot, cancellation, coordinate,
  safety, and mapping invariants are documented for junior maintainers.
- The extension remains a client; compiler semantics have one owner; package dependency tests make
  the forbidden backend edge durable after ESLint removal.
- Protocol and schema versions are explicit. A later editor, target, assembler, or debugger can
  consume public evidence without changing Blend65 source semantics, but no speculative adapter or
  plugin framework is built.

### Accessibility — complexity S

- Diagnostics, commands, status, progress, and evidence access work through standard keyboard-
  accessible VS Code surfaces. Semantic meaning is not communicated by color alone: Problems,
  hover, status text, and source locations provide textual equivalents.

---

## Security Considerations

- **Data sensitivity:** Source, assets, manifests, compiler evidence, and local paths may be private
  project data. They remain local and are never uploaded, telemetered, or sent to a network service.
- **Input validation:** Treat workspace folders, document text/version, JSONC, source/asset paths,
  settings, protocol messages, `.build.json`, `.debug.json`, tool output, and monitor data as
  untrusted. Validate schemas, enums, lengths, bounds, canonical containment, symlink identity,
  hashes, versions, and result limits before use.
- **Authentication and authorization:** There is no account or remote API. VS Code workspace trust
  is the authorization boundary for external execution; ordinary local text analysis remains
  available without trust.
- **Injection risks:** Use argument arrays and canonical executable paths, never a shell or `eval`.
  Project/input text cannot create process options, commands, ACME includes, monitor frames, URIs,
  or artifact paths. Escape untrusted text in Markdown/hover/output and reject `..`, encoded escape,
  absolute content paths, or symlink traversal outside the project.
- **Encryption needs:** No network transport or credential store is introduced. Encryption at rest
  is delegated to the user's operating system/workspace because the compiler creates ordinary local
  files and holds no secrets.
- **Rate limiting:** N/A for remote abuse because there is no server endpoint. Locally, bound and
  coalesce document changes, protocol payloads, directory traversal, search results, diagnostics,
  output, retries, and concurrent owned operations to prevent resource exhaustion.
- **Infrastructure:** The extension and language server run with user privileges, open no listening
  network service for ordinary language features, inherit no project-provided environment, and
  clean up owned child processes and loopback VICE monitor sessions. No container or production
  server is introduced.
- **Security testing:** Include malicious paths/symlinks, crafted JSONC/source/asset names,
  malformed/oversized protocol and artifact JSON, hover/output escaping, untrusted-workspace command
  denial, executable/argument injection attempts, stale edits, cancellation cleanup, and unrelated
  loopback-service rejection.

---

## Scope Decisions

| Decision | Options considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| Editor architecture | Duplicate compiler logic / shared frontend service | Shared frontend service | One semantic authority prevents CLI/editor drift. | AR-012, AR-021 |
| Editor scope | Syntax only / focused production tooling / full IDE | Focused production tooling | Supplies modern core workflow without creating another product. | AR-021 |
| Backend access | Backend in normal LSP / explicit command boundary | Explicit trusted command boundary | Keeps editing responsive and preserves architecture/security. | AR-021, AR-022 |
| Build inputs | Build unsaved overlay / save-or-abort coherent disk input | Save-or-abort | The artifact and build hashes bind one coherent filesystem snapshot. | AR-022, AR-047 |
| VS Code commands | Build + Run + duplicate Build and Run / Build + fresh Run | Build + fresh Run | One run path is deterministic and never launches stale output. | AR-047 |
| Formatting | Configurable framework / one canonical formatter | One canonical formatter | Meets ordinary DX without a second tool ecosystem. | AR-011, AR-021 |
| Debugging | No metadata / metadata plus probe / owned DAP now | Metadata plus probe | Preserves future source debugging while avoiding unproved adapter complexity. | AR-010 |
| Performance | Mandatory incremental compiler / measured-need trigger | Measured-need trigger | Avoids recreating infrastructure before real latency evidence. | AR-011, AR-026 |
| Verification | Full corpus after every edit / impact-based families | Impact-based families | Gives direct confidence without repeating unrelated expensive suites. | AR-025, AR-026 |

> **Traceability:** Every scope decision references
> [00-ambiguity-register.md](00-ambiguity-register.md). Exact protocol method shapes, public API
> types and client packaging are fixed at R9.43's schema-first tooling milestone. Sidecar and debug
> schemas are already frozen by RD-03 before their first producers and are consumed unchanged; all remain
> within these approved behavioral boundaries and cannot expand the product surface.

---

## Acceptance Criteria

1. [ ] **AC-01 — One semantic authority:** For one saved valid project and one saved invalid
   project, public API, `blendc check`, and language server return identical normalized project,
   source, type, profile, asset, diagnostic-code, severity, message, and span facts; structural
   tests prove the language server has no codegen/optimizer/packager/VICE/process-adapter import.
2. [ ] **AC-02 — Project isolation:** Opening documents under two different manifests creates two
   isolated project contexts. Definition, references, rename, symbols, diagnostics, overlays, and
   status for either document contain no source or result from the other project.
3. [ ] **AC-03 — Unsaved authority:** After opening saved version 1, changing it to unsaved version
   2, and issuing diagnostics/hover/definition, every response reflects version 2. Closing without
   saving removes the overlay and the next response reflects saved version 1.
4. [ ] **AC-04 — Stale-result rejection:** A controlled slow request for version 1 followed by
   version 2 cannot publish version-1 diagnostics, edits, tokens, symbols, navigation, completion,
   or hover after version 2 becomes current, whether version 1 completes normally or after
   cancellation.
5. [ ] **AC-05 — Coordinate correctness:** Fixtures containing ASCII, two-byte and three-byte UTF-8,
   an astral character, tabs, LF, CRLF, empty content, and EOF prove round-trip compiler-byte to
   protocol coordinates for diagnostics, definitions, references, rename, tokens, and formatting
   without shifting the following token.
6. [ ] **AC-06 — Diagnostic boundary:** A frontend error appears identically in `blendc check` and
   the language server and prevents backend entry. A seeded final-layout failure appears only during
   build/run, not as a guessed live diagnostic. Neither case publishes a runnable-looking artifact.
7. [ ] **AC-07 — Poison safety:** An independently recoverable syntax error still permits a valid
   nearby diagnostic, but hover/rename/code-action requests whose answer depends on the poisoned
   node return unavailable/no edit and never invoke SFA or backend code.
8. [ ] **AC-08 — Completion:** Focused cases cover local/module/platform symbols, expected type,
   struct field, call argument, `embed()` contained path and qualified selector, and typed placement
   region. Each case excludes at least one inaccessible, wrong-kind, outside-project, or unsupported-
   profile candidate.
9. [ ] **AC-09 — Hover and signature help:** Scalar, nested fixed array, outer-unsized parameter,
   function value, interrupt sink, volatile register, compile-time value, embedded asset, and placed
   object fixtures expose their exact required types/effects/constraints; an ambiguous or poisoned
   call shows no guessed winning signature.
10. [ ] **AC-10 — Definition and references:** Merged-module, imported, shadowed, finite function-
    value, callback-sink, platform declaration, and same-spelling/different-project fixtures return
    exactly the semantic definition/reference set required by R9.18. Before, inside, and after a
    shadowing scope, same-spelling bindings remain separate and resolve to the nearest visible stable
    identity.
11. [ ] **AC-11 — Safe rename:** A user-owned symbol rename updates every semantic project reference
    with non-overlapping contained edits. Invalid spelling, collision, platform/generated/read-only
    identity, poisoned analysis, stale document version, changed file hash, and cross-project
    request each return no edits and an actionable reason. Same-spelling shadowed declarations are
    not edited together, and a rename that would capture, hide, or merge another binding is rejected.
12. [ ] **AC-12 — Symbols and semantic tokens:** Document/workspace symbol fixtures preserve exact
    scope, source order, qualification, result bounds, and project boundary. Semantic-token fixtures
    distinguish the supported declaration/reference and proven modifiers while invalid regions use
    lexical fallback or no semantic modifier.
13. [ ] **AC-13 — Bounded code actions:** Every advertised action maps to one authoritative
    diagnostic or exact semantic fact, produces the independently expected source edit, and rejects
    stale applicability. A missing compiler lowering and a hardware-policy choice produce no source-
    workaround action.
14. [ ] **AC-14 — Canonical formatter:** Formatting representative complete valid documents twice
    yields byte-identical second output with zero edits. Token/literal/comment comparison proves no
    non-trivia value, declaration order, import meaning, or behavior changed. Invalid structural
    input returns the documented rejection rather than guessed source.
15. [ ] **AC-15 — Protocol robustness:** Unknown methods, malformed/oversized messages, absent
    documents, bad versions, cancellation, and injected internal failure return bounded protocol
    outcomes without crash, stack/absolute-path leak, stale publication, file mutation, or retained
    unbounded output.
16. [ ] **AC-16 — Thin extension:** Package inspection finds only client/configuration/UI/adapter
    responsibilities in the VS Code extension. Opening a Blend65 project starts the matching server,
    registers the advertised capabilities, displays Problems/status, and requires no compiler source
    checkout or editor-side semantic install.
17. [ ] **AC-17 — Truthful status and refresh:** No-project, invalid, analyzing, ready, error, and
    cancelled fixtures display the matching state and effective profile when known. Manifest,
    source, asset, settings, file-create/delete/rename, and module-header changes each invalidate and
    refresh only affected contexts without presenting stale ready state.
18. [ ] **AC-18 — Exact command surface:** The packaged extension registers `Blend65: Build` and
    `Blend65: Run in VICE` and registers no `Build and Run`, no-build rerun, or automatic execution
    on open/edit/save/diagnostic/format event.
19. [ ] **AC-19 — Save-or-abort:** With one dirty consumed source input, accepting save makes Build
    consume the saved bytes. Declining or forcing save failure starts no compiler child/build and no
    VICE process and identifies the input. A dirty unrelated file outside the project does not block
    the command.
20. [ ] **AC-20 — Trusted execution:** In an untrusted workspace, diagnostics, hover, navigation,
    symbols, and formatting work, while Build, Run, tool discovery/execution, external artifact open,
    and VICE monitor creation are denied before process launch. Granting trust still requires the
    explicit command.
21. [ ] **AC-21 — Fresh run:** `Blend65: Run in VICE` saves relevant inputs, completes one fresh
    successful build, durably pins its immutable generation before releasing the publication lock,
    and launches exactly its hash-bound primary artifact only after pin acquisition. Seeded save,
    compiler, ACME, packaging, pin-acquisition, and pre-publication cancellation failures launch
    nothing; a prior or unpinned artifact is never used.
22. [ ] **AC-22 — Cancellation cleanup:** Cancelling check, ACME build, VICE startup, and a running
    owned VICE session terminates all owned processes and monitor connections and removes only
    unpublished staging. Deterministic cases on both sides of the commit boundary prove that
    pre-commit cancellation publishes nothing, while post-commit cancellation preserves the valid
    generation, reports build success plus cancelled run, and releases its exact run pin only after
    owned execution stops. A seeded release failure retains and diagnoses that pin rather than
    reclaiming it from PID, age, or process-existence evidence.
23. [ ] **AC-23 — Problems, progress, and output:** One successful and one failing Build/Run case
    show project/profile/phase progress, structured Problems diagnostics, bounded Output summary,
    final artifact or failure category, and no complete source/asset content, raw stack trace,
    unrelated monitor data, or unnecessary absolute path.
24. [ ] **AC-24 — Artifact access:** For a valid successful build record, every R9.32 command opens
    or reveals the exact contained hash-matching artifact from one immutable generation. Missing,
    malformed, path-escaping, symlink-escaping, hash-mismatched, mixed-build, or stale current-record
    cases execute nothing and report the failed validation. Historical evidence is identified by
    its generation rather than called current.
25. [ ] **AC-25 — Debug identity and portability:** `.debug.json` validates against its frozen
    schema and matches the recorded compiler, specification, skill, profile, CPU, mode, safety,
    source, asset, portable-tool, and artifact identities. Two byte-identical projects at different
    roots produce byte-identical normalized debug evidence and contain no host absolute path,
    timestamp, `generationId`, or other random identity.
26. [ ] **AC-26 — Final range mapping:** Controlled code covering ordinary calls, inlining,
    elimination, split ranges, branch repair, generated helper/startup code, and multiple
    non-contiguous source mappings proves every recorded half-open range uses final bytes and lies
    inside the corresponding bank-qualified emitted object.
27. [ ] **AC-27 — SFA location truth:** Nested calls, aggregate return, overlays, mainline/IRQ
    variants, constant propagation, optimized-away value, rematerializable value, and unavailable
    value fixtures record exact type, domain, location/live interval, and availability without
    claiming an invalid static home. Same-spelling shadowed bindings retain distinct stable
    identities, and an outer binding live across an inner shadow is not incorrectly overlaid.
28. [ ] **AC-28 — Bank/load identity:** Resident, banked, overlay, and loadable fixtures record the
    address space, bank/visibility, load unit, publication, and residence facts needed to interpret
    each location without widening language `word` or flattening distinct physical identities.
29. [ ] **AC-29 — Cross-artifact coherence:** Every debug symbol/range agrees with `.labels`,
    `.memory.json`, `.assets.json`, `.build.json`, and the hashed PRG/D64 bytes. Each JSON sidecar
    validates independently under its versioned schema; `.build.json` hashes every other artifact
    but not itself. Deliberately changing any address, bank, range, hash, generation identity, required
    field, or schema major fails validation.
30. [ ] **AC-30 — Zero target debug cost:** Building the same frozen project with required debug
    evidence validation disabled only in the test observer produces byte-identical assembly,
    primary artifact, maps, target symbols, memory/ZP/SFA/stack totals, startup path, and VICE
    behavior; only host-side evidence observation differs.
31. [ ] **AC-31 — Adapter probe:** A checked-in report identifies the tested VICE, adapter, and
    debug-schema versions and separately records source-breakpoint, source/instruction-step, and
    available-variable results as supported, lossy, or unsupported with reproducing evidence. No
    Blend65-owned DAP or implied support claim is shipped.
32. [ ] **AC-32 — Injection and containment:** Tests reject project/setting/protocol/artifact values
    attempting shell metacharacters, option injection, `..`, absolute content paths, encoded or
    symlink escape, hostile Markdown, monitor-command injection, and unrelated loopback connection;
    no outside file, command, process, or unescaped rendered output is produced.
33. [ ] **AC-33 — Focused verification:** Closeout records family-directed checks, one complete
    tooling boundary, the packaged extension check, debug cross-artifact validation, one small ACME
    build, and one sequential VICE run/cleanup case. It records no unrelated full compiler, game,
    asset, readiness, or feasibility-matrix suite.
34. [ ] **AC-34 — Observational responsiveness:** The required real-project operations record
    phase-separated duration and peak-memory observations with complete host/project/tool identity;
    no wall-clock assertion appears in unit tests, CI, milestone, or release gates.
35. [ ] **AC-35 — Deferral-expiry closeout:** The closeout explicitly answers whether RD-09 expired
    any deferral rationale. Any newly due debugger integration, incremental-analysis, editor,
    portability, or expressiveness work has an owned backlog row before RD-09 is marked complete.
36. [ ] **AC-36 — Deterministic tool discovery:** On clean production Linux x64 and Windows x64
    hosts, cases cover an absent file; required integer `schemaVersion: 1`; each omitted key,
    single-key override, and both overrides; normal `PATH` ordering; wrong or missing version;
    missing executable; non-file path; valid and broken symlinks; duplicate/unknown keys; wrong
    types; missing/unsupported schema version; and invalid configured paths. They prove direct
    config-then-`PATH` precedence, no fallback from an invalid explicit path, and no fixed-location
    registry. `check` and ordinary LSP cases prove that they do not load or validate the file.
37. [ ] **AC-37 — Complete production host workflow:** Native Node 22 qualification on both
    `linux/x64` and `win32/x64` covers the packaged compiler/CLI/LSP/VS Code extension, `check`,
    `build`, fresh `run`, ACME/VICE discovery and invocation, cancellation/process-tree cleanup,
    path semantics, immutable-generation publication/current-record replacement, concurrent build
    and reader pinning, normal bounded retention, and fail-closed cleanup. It covers opposing
    cleanup/pin interleavings, multiple holders, process death at acquisition/start/release
    boundaries, malformed or unreadable pin state, PID reuse, clock change, and deliberate orphan
    recovery; no time advance or liveness hint permits automatic deletion. Emulated Windows paths
    on Linux cannot satisfy the Windows case. macOS and other Node 22 results are reported as
    best-effort until the same boundary passes.
