# RD-01: Blend65 Developer Skill and Slither Port

> **Document**: RD-01-developer-skill-and-slither-port.md
> **Status**: Draft
> **Created**: 2026-10-15
> **Project**: Blend65 Developer Validation
> **Depends On**: blend65-v4/RD-01–RD-04 authority and public compiler foundation; individual later capabilities only when required by the assessed pilot
> **CodeOps Artifact Schema**: 1

## Feature Overview

Provide a reusable Blend65 game-developer skill and prove its practical value
by porting **one complete game: Slither**. The upstream candidate is
[`skrasser/slither_c64`](https://github.com/skrasser/slither_c64), a small C64
assembly game whose repository publishes an MIT licence. This is a candidate
assessment fact, not a claim that its build, dependencies, assets or Blend65
port have passed qualification. (AR-001, AR-003, AR-004)

The companion skill helps a modern programmer express game behavior in normal
Blend65. It consumes the frozen language and expert authority rather than
creating another authority. The port supplies application-level evidence across
source, compilation, assembled artifacts and execution. The original game is an
independently authored reference, but not automatically an optimal expert cost
baseline. Neither a plausible screenshot nor agreement between two compiler
modes proves correctness. (AR-002, AR-005–AR-008)

Work proceeds beside, not inside, the active compiler implementation. Source
assessment and skill preparation may advance while required compiler work is
unfinished; dependent runtime or output qualification remains blocked. This RD
does not close or enlarge any v4 RD, change its acceptance bounds, or introduce
a compiler-owned game engine. (AR-006, AR-009–AR-012)

## Functional Requirements

### Must Have

#### Source assessment and immutable reference — complexity M

- [ ] **R1.1 — Assess exactly Slither.** Record the upstream URL, exact commit,
      selected source/assets, licence text and notices, dependencies, build
      command, assembler identity and expected entry artifact. Inspect referenced
      code and data before executing any upstream build action. A licence or
      source/build failure blocks the pilot; no substitute is selected without
      the user's explicit decision. (AR-003, AR-004)
- [ ] **R1.2 — Reproduce the original before porting.** Build the same recorded
      inputs twice in separate owned output directories using the recorded
      tools. Compare executable and relevant data hashes; explain any generated
      metadata excluded from the comparison. An unexplained executable difference
      is a blocker, not permission to normalize it away. Record both build
      outcomes before any Blend65 gameplay implementation. (AR-003, AR-009)
- [ ] **R1.3 — Fix the machine and behavior contract.** Record CPU, PAL/NTSC and
      VIC/SID/CIA assumptions as applicable, banking/visibility, ROM identity,
      loader/startup, controls, input sampling, game states, movement, collision,
      scoring/randomness when present, all reachable IRQ/NMI routes and exit
      behavior. Mark genuinely absent features absent, not zero-cost guesses.
      Match this contract to one qualified Blend65 profile before a dependent
      port build; missing support is an owned blocker. (AR-007, AR-010)
- [ ] **R1.4 — Preserve the upstream reference.** Keep source/asset identity and
      the original baseline immutable through a comparison. Observation-only
      instrumentation, if necessary, is separately identified and must not change
      the measured behavior or costs. A patched original cannot silently replace
      the selected original. (AR-004, AR-008, AR-009)

#### Companion authoring skill — complexity L

- [ ] **R1.5 — Supply one focused developer skill.** Deliver one discoverable
      `blend65-game-developer` skill with a concise router and only necessary
      references/examples. It covers the authoring responsibilities in the
      capability table below, using public source APIs and normal language
      constructs. Do not create a new agent, model policy, service, package,
      automatic installer or test runner. (AR-001, AR-002, AR-011)
- [ ] **R1.6 — Preserve authority and source ergonomics.** Reference the frozen
      normative specification and the current qualified expert release identity.
      Keep implementation availability separate from language legality. Ordinary
      nested calls, variable addresses, aggregates, modules and reusable helpers
      must not be replaced with assembly-shaped source to hide compiler gaps.
      Never amend frozen authority or import its qualification-case answers into
      developer instructions. (AR-002, AR-005, AR-006)
- [ ] **R1.7 — Teach the complete development loop.** Guide project setup,
      decomposition into readable modules, explicit target selection, source
      checking, public build/run, diagnostics, artifact inspection, behavior
      debugging and complete cost review. Explain necessary platform contracts
      using named operations and short examples, not unexplained addresses or
      promises that unavailable APIs exist. (AR-002, AR-005, AR-007)
- [ ] **R1.8 — Qualify skill claims with unseen work.** Before skill authoring,
      independently define application-writing exercises and expected outcomes
      for the claimed subset. Include an exercise distinct from Slither and not
      copied into the skill's teaching examples. Evaluate the final skill in a
      fresh authoring context without evaluator answers or compiler internals.
      Keep the author and the reviewer of each exercise independent. A topic
      lacking executed proof remains knowledge-only or blocked, never qualified
      by prose coverage. (AR-005, AR-008, AR-011)

#### Complete ordinary-source port — complexity L

- [ ] **R1.9 — Port game intent, not instructions.** Reconstruct algorithms and
      observable behavior, then implement the complete assessed game in ordinary
      Blend65. Use suitable types, arrays/structs, functions, control flow and
      named platform operations. No embedded original gameplay machine code,
      hidden assembly implementation, fixture-name recognition or manual
      compiler workaround counts as a Blend65 port. (AR-002, AR-006)
- [ ] **R1.10 — Preserve the assessed game.** Include every reachable gameplay
      state, input mode, transition, rendering/audio behavior, asset and exit
      obligation identified by R1.3. Do not remove a difficult feature, alter
      collision rules, cap a source-supported range, change cadence or replace
      an algorithm's observable behavior merely to obtain a build. Intentional
      product differences require a new explicit ruling and remain visible in
      the comparison. (AR-003, AR-006, AR-007)
- [ ] **R1.11 — Use the pinned public compiler.** A clean application project
      must check/build/run using the public compiler API or CLI from an exact
      recorded compiler source/package identity. Do not import compiler internals
      into the game, modify generated output or consume another worktree's live
      `dist`, dependency links or publication directory. A requested but
      unqualified compiler mode cannot silently fall back. (AR-009, AR-010)
- [ ] **R1.12 — Hand off compiler defects.** For each encountered compiler
      failure, retain the ordinary-source intent, smallest reproduction,
      diagnostic/artifact identity, expected behavior authority and existing
      owner or required owner decision. Existing v4/conformance owners decide and
      implement compiler fixes under their own gates. This feature neither edits
      their code/tests/plans nor teaches the failure as a language law.
      (AR-005, AR-009, AR-010)

#### Independent behavior and expert costs — complexity L

- [ ] **R1.13 — Establish independent expectations first.** Before port code,
      freeze deterministic input traces and expected game outcomes derived from
      the assessed game rules/source and governing language/platform semantics.
      Cover all R1.3 states/transitions, idle and sustained input, relevant
      boundaries, failure/game-over/restart/exit paths when present, and memory,
      device and timing effects required by the contract. Expected answers must
      not be generated from the Blend65 port or compiler. (AR-007, AR-008)
- [ ] **R1.14 — Execute the real artifacts.** Run the independently built
      original and public-compiler-built port through VICE 3.10 `x64sc` with the
      fixed machine and inputs. Compare the independent state/behavior answers,
      rendered output and required device/timing effects at the frozen
      observation points. Different layouts need semantic observation mappings;
      do not demand equal private addresses or byte-identical executables.
      Report original/port differential results separately from independent
      behavior proof. (AR-007, AR-008)
- [ ] **R1.15 — Account for the complete result.** Compare code, data/assets,
      padding/reservations, resident RAM, ZP, SFA, hardware stack, scratch,
      startup/loading/exit and applicable frame/path cycles. Include every
      reachable interrupt route and retained external player/loader obligation.
      Unknown figures remain individually Unknown. Never compare an original
      packed file with an unpacked port without also reporting equivalent loaded
      and resident costs. (AR-007, AR-008)
- [ ] **R1.16 — Retain the project's expert bar.** Independently review
      equivalent expert assembly/cost expectations for the implemented port
      capabilities. Worse generated output is an owned defect, not an acceptable
      production showcase. Local meets require the project's measured debt and
      path-to-win treatment; whole-program wins are reported only for measured
      equivalent work and the applicable objective. A direct `none` execution
      result or win over weak upstream assembly does not prove general RD-08
      optimization or universal expert superiority. (AR-008, AR-010, AR-011)
- [ ] **R1.17 — Prove that the checks discriminate.** Demonstrate meaningful
      failure when a representative expected game result, required device
      effect, artifact identity or cost limit is wrong. Retain the independent
      oracle's expected answer; do not amend an existing protected expectation
      to accommodate output. Use the existing test tier and smallest local
      controls, not a generalized mutation or validation framework.
      (AR-005, AR-008, AR-011)

#### Isolation, handoff and bounded completion — complexity M

- [ ] **R1.18 — Bootstrap in the requested order.** Locally commit this RD and
      its directly supporting feature documents on the current branch before
      invoking the existing `git-worktree` command. Create the separate
      `feature/blend65-developer-validation` branch/worktree from that exact
      documentation commit and continue there. Preserve all unrelated staged,
      unstaged and untracked work; stop on a name/path conflict. No push is
      authorized. (AR-009, AR-012)
- [ ] **R1.19 — Pin and refresh evidence deliberately.** Record compiler,
      specification, expert-skill content, authoring-skill version/content,
      upstream, tools, source/assets, options, profile, inputs and final artifact
      identities. A documentation bootstrap commit is not a qualified compiler
      release. Before changing a pinned compiler or input, retain the prior
      result and re-run affected proof; do not label mixed identities current.
      No production-host or other-profile claim follows from this Linux pilot.
      (AR-005, AR-008, AR-009)
- [ ] **R1.20 — Coordinate shared host resources.** Agree non-overlapping VICE
      ownership windows across sessions; run emulator cases sequentially even
      when worktrees differ. Use independent output and task-owned temporary
      paths. If ownership is unavailable, wait without killing another session's
      processes or starting a second emulator. Do not build a scheduling service
      merely to coordinate two sessions. (AR-009, AR-011)
- [ ] **R1.21 — Deliver an honest local showcase.** Supply the skill, readable
      complete source, permitted assets/notices, public build/play instructions,
      independent tests, exact evidence identities and a concise result record.
      State exercised capabilities, compiler blockers, cost findings and
      `VICE-verified / hardware-unverified` where applicable. Unresolved required
      behavior, ordinary-source or expert-output defects block completion; a
      preparation milestone must not be labelled a completed port. External
      publication remains a separate user action. (AR-004, AR-008, AR-011)
- [ ] **R1.22 — Close ownership and deferral expiry.** At RD closeout, answer the
      project's deferral-expiry question, reconcile all encountered blockers with
      their actual owners and leave no deferral pointing to a finished slice.
      Evidence can be offered to v4 owners, but cannot advance their roadmap or
      acceptance status by itself. (AR-010, AR-011)

### Skill capability coverage

Each row needs concise authoring guidance referencing existing authority. Its
evaluation status is recorded separately: exercised/qualified with exact proof,
knowledge-only, or blocked with an owner. The first port need not contain every
technique, and cannot qualify techniques it does not exercise. (AR-002, AR-005,
AR-008, AR-011)

| Area | Required authoring guidance |
| --- | --- |
| Language and decomposition | Types/widths, modules, arrays/structs, ordinary calls/returns, finite function values, compile-time composition and explicit lifetime rules. |
| Game flow | Source-owned update/render order, state transitions, input handling, bounded loops and deliberate overflow policy. |
| Rendering and data | Source-owned sprite/character rendering, scrolling/buffering techniques, resource placement and hardware visibility without compiler-owned engines. |
| Input and concurrency | Saved input interpretation, application-owned repeat/debounce, explicit publication, shared-state hazards and qualified interrupt ownership. |
| Entities and collision | Application-owned fixed-capacity data, word-capable indexing, deterministic collision/state behavior and boundary tests. |
| Audio and assets | Named hardware operations, exact supported imported-player contracts, externally authored asset ingestion and source-owned cue/tick policy. |
| Evidence and debugging | Public diagnostics, source reduction, values/effects, full artifacts/resources, expert comparisons and evidence limits. |

### Should Have

- [ ] **S1.1 — Explain one completed gameplay path.** Provide a short annotated
      walkthrough linking readable Blend65 intent to the measured assembly and
      behavior evidence, without requiring assembly knowledge to write the
      source. (AR-002, AR-008)

### Won't Have (Out of Scope)

- A second pilot, automatic replacement, commercial-game disassembly or a
  catalogue of unfinished ports. A later title needs a separate scope decision.
- Compiler/stdlib/LSP implementation changes, new intrinsics, inline-assembly
  escape mechanisms, specification changes or a second expert baseline.
- Engine, renderer, pool, state, collision, buffering or audio-policy libraries
  supplied by the compiler. Game systems remain self-contained application code.
- New native agent roles, permissions, global configuration, dependency/runtime
  frameworks, general harnesses, automatic tool downloads, CI or infrastructure.
- Full RD-08 mode qualification, all C64 profiles, native Windows/macOS release
  qualification, physical silicon proof, C64U support or an external release.
- Claims that one model's agreement with itself replaces independent expected
  behavior, or that a single successful game proves compiler completeness.

## Technical Requirements

### Minimal implementation shape

Use the existing repository/toolchain and public compiler boundary. The
implementing plan owns the exact source/test layout; the intended companion entry
is `.opencode/skills/blend65-game-developer/SKILL.md`, with adjacent references
only when needed. Game source belongs under one isolated example owner, tests
under one existing Vitest owner, and qualification evidence beside that example.
Do not change unrelated hidden guidance, native agents or configuration.
(AR-005, AR-006, AR-009–AR-011)

Reuse existing public project, artifact and VICE facilities where appropriate;
[`test/m1/vice.spec.test.ts`](../../../../test/m1/vice.spec.test.ts) demonstrates
the independent-game/public-build pattern, while
[`test/rd05/profile-fixture.ts`](../../../../test/rd05/profile-fixture.ts)
demonstrates exact-generation artifact inspection. These are reusable patterns,
not immutable Slither answers or authorization to amend their existing tests.
Do not read frozen expert evaluator answers as developer-skill inputs. (AR-005,
AR-008, AR-011)

### Required records, not a new schema system

| Record | Minimum information |
| --- | --- |
| Source assessment | Upstream commit, source/assets and hashes, rights/notices, dependencies, tool invocations, two original build results and machine/behavior assessment. |
| Behavior contract | Source-derived states and transitions, fixed inputs/time coordinates, independent answers, observation mapping and negative/boundary cases. |
| Qualification result | Exact skill/compiler/tool/input/artifact identities, source/assembly/byte/runtime endpoints, costs, skips, findings and evidence limits. |
| Compiler handoff | Reduced source, expected authority, observed failure, exact identity, affected boundary and owner/blocker. |

Use ordinary versioned documents, existing sidecars and focused test fixtures.
Before parsing any retained data, validate its actual fields and bounds through
the existing consuming tier. Raw logs and intermediate downloads remain in
task-owned temporary storage unless explicitly selected as durable evidence.
No new public compiler-evidence schema is authorized. (AR-004, AR-008–AR-011)

### Verification and compatibility

Requirements-only changes validate targeted Markdown formatting, links,
requirement/acceptance traceability and protected-path preservation, with an
independent bounded review. They do not require or claim a fresh compiler suite.
Implementation plans must retain specification-first ordering: independent
expectations, meaningful RED evidence where applicable, implementation, GREEN,
and the required reviews/full relevant checkpoint. (AR-005, AR-008, AR-010)

Reusing evidence after a compiler, source, skill, tool, mode, profile or fixture
change requires checking the intersecting identities and re-verifying affected
boundaries. If a new compiler fails, preserve the previous pinned result and
report the new attempt separately; no automatic fallback can count as success
for the requested identity. No migration of existing sidecar formats is owned
here. (AR-009, AR-010)

## Integration Points

| Owner | Relationship |
| --- | --- |
| [blend65-v4/RD-01](../../blend65-v4/requirements/RD-01-specification-4-and-expert-authority-freeze.md) | Frozen Specification 4 and current expert-release governance; no edits granted. |
| [blend65-v4/RD-03](../../blend65-v4/requirements/RD-03-playable-m1-complete-pipeline.md) and [RD-04](../../blend65-v4/requirements/RD-04-complete-language-correct-unoptimized-compiler.md) | Public compiler/pipeline foundation and ordinary-source semantics. Existing closeouts are scoped evidence, not a promise every pilot case is defect-free. |
| [blend65-v4/RD-05](../../blend65-v4/requirements/RD-05-c64-platform-profiles-and-game-workload-compiler-support.md) | Owns platform/input/interrupt capabilities and applicable compiler blockers. |
| [blend65-v4/RD-06](../../blend65-v4/requirements/RD-06-native-assets-compile-time-composition-and-resident-layout.md) and [RD-07](../../blend65-v4/requirements/RD-07-loadable-assets-and-d64-delivery.md) | Required native-asset or delivery gaps return to these owners; this pilot does not silently add those features. |
| [blend65-v4/RD-08](../../blend65-v4/requirements/RD-08-optimization-and-expert-output.md) | Owns general optimization and expert-output repairs; port observations are input, not mode closeout. |
| [blend65-v4/RD-09](../../blend65-v4/requirements/RD-09-developer-tooling-and-debug-evidence.md) and [RD-10](../../blend65-v4/requirements/RD-10-production-qualification-and-c64u-handoff.md) | Own tooling and production/native-host/hardware gates; no new release claim. |

## Scope Decisions

| Decision | Chosen boundary | Rationale | AR ref |
| --- | --- | --- | --- |
| Deliverable | One companion skill and one complete Slither port | Real application evidence without a new compiler workstream | AR-001–AR-003 |
| Baseline | Assessed, rights-cleared, reproducibly built original | An available source file is not an established runnable oracle | AR-003, AR-004, AR-007 |
| Skill authority | Reference frozen specification/expert; never replace them | Avoid circular doctrine and compiler-convenience restrictions | AR-002, AR-005 |
| Implementation | Ordinary Blend65 application source | Test the product modern programmers actually receive | AR-006, AR-010 |
| Proof | Independent behavior plus equivalent complete expert costs | Differential or screenshot-only success is insufficient | AR-008 |
| Parallel work | Isolated checkout and outputs, pinned compiler, serial VICE | Prevent interference with active implementation and measurements | AR-009, AR-012 |
| Larger alternative | No engine/runner/service/new agent | Existing tools and role packets cover the approved pilot | AR-010, AR-011 |

## Security Considerations

| Concern | Required treatment |
| --- | --- |
| Inputs and paths | Treat upstream source/assets/manifests and downloaded archives as untrusted. Use exact approved sources, bounded files and owned destinations; reject traversal/escaping links and malformed metadata. |
| Process execution | Inspect commands/scripts first; invoke identified tools with literal argument arrays or reviewed fixed commands, never interpolate source-controlled text into shell/eval. No automatic dependency installation from upstream scripts. |
| Secrets and permissions | No credentials are needed. Protected files/aliases remain inaccessible without exact current approval; native denials are binding and cannot be bypassed through Git, shell or delegation. A skill is instruction text, not a security sandbox. |
| Rights and distribution | Preserve notices and separately establish code, asset and dependency rights. An unclear asset licence blocks its copying/distribution; do not replace it silently or publish externally. |
| Isolation and cleanup | Own output/temp locations and launched processes. Do not delete another session's files, release its pins, stop its emulator or alter shared configuration. |
| Network and encryption | HTTPS for source retrieval. No authentication/public API, server, database, personal data or sensitive persistent store is introduced; web auth/CSRF/rate limiting and at-rest encryption infrastructure are N/A. |
| Security verification | Before execution, check the actual input/path/process boundaries and relevant rejection cases in the existing tier. Do not create a network service or a new security framework just to satisfy a checklist. |

## Acceptance Criteria

1. [ ] **AC-01 — Isolated ownership:** the RD and supporting feature documents
       are committed before `git-worktree` creates the dedicated branch. The
       original session's unrelated changes and protected authorities are
       unchanged; no push occurs. (R1.18, R1.20)
2. [ ] **AC-02 — Original established:** the assessment binds one Slither commit,
       every consumed source/asset/dependency right and exact build/tool facts.
       Two isolated original builds have equal executable/data hashes or the
       pilot is blocked. A replacement is not selected automatically. (R1.1–R1.4)
3. [ ] **AC-03 — Contract before code:** machine/profile, all assessed game
       states/transitions, fixed inputs, independent answers and behavior/cost
       observation boundaries are recorded before port implementation. Missing
       facts, support or required outcomes are explicit blockers. (R1.3, R1.13)
4. [ ] **AC-04 — Companion, not authority:** exactly one developer skill is
       discoverable; its scope covers every capability-table row with an honest
       qualification status. Frozen specification/expert bytes and evaluator
       answers are not changed or incorporated into teaching material. (R1.5–R1.8)
5. [ ] **AC-05 — Unseen authoring proof:** fresh-context exercises include work
       distinct from Slither and absent from the skill's teaching examples.
       Independent expected results precede authoring, and the author does not
       review its own oracle. Unexecuted topics are not marked qualified. (R1.8)
6. [ ] **AC-06 — Complete public-source port:** a clean application build uses
       the pinned public compiler, with all R1.3 gameplay/content/exit obligations
       preserved. No gameplay assembly blob, generated-file edit, private API,
       fixture-specific compiler path or undocumented source workaround supplies
       the missing behavior. (R1.9–R1.12)
7. [ ] **AC-07 — Independent runtime:** the original and port run sequentially
       in the recorded VICE 3.10 configuration. Every frozen independent
       behavior answer and contractual display/device/timing observation passes;
       failures and skips are not converted into success by differential
       agreement. (R1.13, R1.14, R1.20)
8. [ ] **AC-08 — Complete expert comparison:** a reconciled ledger covers each
       R1.15 cost component for equivalent work. Known worse output blocks the
       completed expert showcase and has an owner. Local meets and any measured
       whole-program win follow the root parity rules; no general optimization
       or other-profile claim is inferred. (R1.15, R1.16)
9. [ ] **AC-09 — Discriminating checks:** controlled wrong behavior, device
       effect, identity and cost expectations each cause meaningful failure.
       Required expected answers and existing protected tests remain intact.
       (R1.17)
10. [ ] **AC-10 — Reproducible handoff:** source, notices, public build/play
        instructions, exact identity-bound qualification, skill coverage and
        defect handoffs exist. Required unresolved blockers prevent completion;
        changing a pin invalidates affected current claims until re-verification.
        (R1.12, R1.19, R1.21)
11. [ ] **AC-11 — Security and bounded claims:** source/asset path and tool
        invocation checks pass; no secret exposure, foreign-process cleanup or
        external publication occurs. Emulator-only results use the exact label
        `VICE-verified / hardware-unverified`. (R1.1, R1.19–R1.21)
12. [ ] **AC-12 — Owner closure:** independent applicable reviews, full relevant
        verification and deferral-expiry reconciliation pass. This feature alone
        changes no v4 completion or production status. (R1.22)

## Non-Functional Requirements

- **Maintainability:** keep source readable to a modern programmer and split
  modules/tests by responsibility. Prefer existing facilities to abstractions
  built solely for this pilot.
- **Performance:** satisfy the assessed game's frame/path contracts and the
  project's expert-output bar. Record compiler build duration and host memory
  as observations, not an invented universal latency threshold.
- **Recovery:** preserve previous pinned evidence on a failed attempt. Resume
  from the owning plan rather than another session's mutable state.
- **Accessibility and UX:** use plain-language setup/play instructions, name
  controls and diagnostics explicitly, and provide textual qualification results
  rather than screenshot-only proof. No new web/mobile UI is introduced.
- **Completion honesty:** this RD is a bounded application/skill qualification,
  not proof of all games, all language compositions, all optimization modes or
  all physical C64 revisions.
