# Preflight Report: Blend65 v4 Requirements

> **Status**: BLOCKED — REVIEW IN PROGRESS — 19 pending findings (13 major, 6 minor); PF-001 resolved
> **Iteration**: 1 — first scan
> **Artifact**: requirements set at `codeops/features/blend65-v4/requirements/`
> **Artifact Commit**: `e7a9f09a30d503de2fb14d90ec111fbb2f06aa45`
> **Artifact Digest**: `47d78bfe759199cbc95497bced857741181b615bff65168987fbe5650df07846`
> **Codebase Grounded**: 31 representative source/config/test files examined; all 12 workspaces and
> five external tool/filesystem source families checked
> **Expert Lineage**: `blend65-domain-expert` 1.0.0, content commit
> `a96cfd3c41a456d4d4f983021cf43535a1d5bdaa`
> **Last Updated**: 2026-09-10

> **SAME-SESSION REVIEW:** This artifact was created in the current logical session. Same-agent bias
> risk is elevated. Parallel independent audit clusters and one independent design challenger were
> used, but a fresh-session or human compiler/C64 review remains valuable before implementation.

## Codebase Context Summary

**Actual stack:** Node 22, Yarn classic, TypeScript 5.9, Turbo 2, Vitest 2, ESLint 9, and Vite 5.
Stable TypeScript 7 is now available from the normal `typescript` package, so the approved migration
is feasible; TypeScript 7 currently has no stable programmatic compiler API, which does not conflict
with the requirements' `tsc --build` ownership. See the official
[TypeScript 7 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/).

**Actual architecture:** The parked v3 evidence has 12 packages and working lexer/parser, semantic,
SFA, codegen, compiler, CLI, config, platform, test-harness, and readiness surfaces. The language
server and VS Code packages are stubs, and the machine peephole catalog is empty. No v4 branch or
`/home/gevik/workdir/github/blend65.ri/v4` worktree exists yet.

**Key evidence examined:** root/workspace manifests; `turbo.json`; TypeScript and CI configuration;
compiler/CLI/frontend/codegen/platform/LSP/VS Code/test-harness entry points; Pratt parser; SFA entry;
peephole optimizer; ACME discovery/invocation; direct import-boundary tests; Specification 3 and
future-target appendices; Language Guard; active expert release and task-relevant expert references.

**External grounding:** ACME 0.97 and VICE `x64sc` remain viable host tools. The filesystem claim in
PF-006 was checked against [Node `fs.rename`](https://nodejs.org/api/fs.html),
[Microsoft `MoveFileEx`](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexa),
and [POSIX `rename`](https://pubs.opengroup.org/onlinepubs/9799919799/functions/rename.html): one
rename publishes one entry, and replacing an existing non-empty directory is not a portable
Linux/Windows set-transaction primitive.

## Summary by Dimension

| # | Dimension | Findings | Highest severity |
|---|---|---:|---|
| 1 | Ambiguities | 7 | 🟠 MAJOR |
| 2 | Implicit Assumptions | 0 | — |
| 3 | Logical Contradictions | 3 | 🟠 MAJOR |
| 4 | Completeness Gaps | 3 | 🟠 MAJOR |
| 5 | Dependency Issues | 1 | 🟠 MAJOR |
| 6 | Feasibility Concerns | 1 | 🟠 MAJOR |
| 7 | Testability | 0 | — |
| 8 | Security Blind Spots | 1 | 🟠 MAJOR |
| 9 | Edge Cases | 0 | — |
| 10 | Scope Creep | 0 | — |
| 11 | Ordering and Sequencing | 1 | 🔴 CRITICAL |
| 12 | Consistency | 2 | 🟡 MINOR |
| 13 | Codebase Alignment | 1 | 🟡 MINOR |

## Summary by Severity

| Severity | Count | Status |
|---|---:|---|
| 🔴 CRITICAL | 1 | 1 resolved |
| 🟠 MAJOR | 13 | 13 pending |
| 🟡 MINOR | 6 | 6 pending |
| 🔵 OBSERVATION | 0 | — |

## Findings

### PF-001: V4 worktree is created one phase too late 🔴 CRITICAL

**Dimension:** 11 — Ordering and Sequencing
**Location:** `README.md:66-68,79-104`; `RD-01-specification-4-and-expert-authority-freeze.md:38-46,361-364`;
`RD-02-clean-v4-foundation-and-deterministic-project-model.md:38-45,222-235`
**Codebase Evidence:** `spec/00-introduction.md:3-5` is Specification 3; the active expert release is
1.0.0; `git worktree list` has no v4 worktree or `feature/v4-rebuild` branch.
**The Problem:** RD-01 must modify and freeze the specification and expert skill before RD-02 may
create the v4 worktree. Yet RD-01 relies on the parked v3 worktree to preserve the old authority,
and RD-02 says the current checkout remains that parked evidence tree. Running RD-01 here destroys
the promised checkout state; waiting for RD-02 provides nowhere authorized to run RD-01. A
pre-RD-01 authority commit also contradicts R2.2's literal “first v4 commit” toolchain requirement.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A — only viable | Add a minimal Phase 0 that records the final v3 commit and creates the v4 branch/worktree before RD-01. Run RD-01 there. Redefine R2.2 as the first green **RD-02 foundation checkpoint**, not the first v4 commit. | Preserves the parked tree and gives authority work one correct home. | Requires coordinated wording changes in the index, RD-01, RD-02, and roadmap. |

**Recommendation:** Option A. Relying only on Git history or mutating the parked checkout breaks an
explicit project promise and leaves the clean-slate boundary ambiguous.

**Confidence:** High. **Hardening:** Independent challenger confirmed the finding and Option A.
**User Decision:** Accepted Option A on 2026-09-10.

**Resolution:** Resolved. The requirements index now defines a mandatory pre-RD-01 Phase 0; RD-01
verifies and records the prepared worktree before changing authority; RD-02 consumes that worktree,
proves its source ancestry and RD-01 head, and names its first green **RD-02 foundation checkpoint**
rather than the first v4 commit. AR-025 and the feature roadmap carry the same ordering. No worktree
was created while applying this requirements correction.

### PF-002: Source paths and artifact names have no exact preservation contract 🟠 MAJOR

**Dimension:** 1 — Ambiguities
**Location:** `RD-02-clean-v4-foundation-and-deterministic-project-model.md:110-131,298-315,501-515`
**The Problem:** “Platform-independent validation” and “case-sensitive ASCII order” do not define
whether Blend65 preserves or rewrites host-exposed source paths, how it orders them without changing
their identity, or which separate safety rule keeps the manifest `name` from becoming an output
path. The original finding incorrectly assumed that Blend65 should police cross-host filename
equivalence. The user clarified that source filenames must be read as the host exposes them, without
a compiler-imposed casing or Unicode portability policy.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A — accepted | Preserve source path spelling, casing, spaces, and Unicode exactly as exposed by the host; apply no Unicode normalization, case folding, or case-collision rejection. For repeatable processing only, sort exact host-exposed project-relative path identities after representing separators as `/`. Validate manifest `name` separately as one literal output basename: non-empty, no path separators or NUL, not `.` or `..`, and incapable of escaping `outDir`; never rewrite it. Report a host filesystem rejection normally. | Reads filenames as supplied, keeps filename semantics out of Blend65, preserves deterministic processing, and retains output containment. | A filename set representable on one host is not promised to be representable on another; that is explicitly outside the compiler contract. |

**Recommendation:** Revised Option A. Deterministic ordering is an internal compiler operation, not
a filename policy. Cross-host filename equivalence was rejected as an invented compiler concern;
only output-path containment remains required.

**Confidence:** High. **Hardening:** The recommendation changed after the user clarified the product
boundary. The original challenger conclusion depended on the broader portability assumption and no
longer governs this refined decision.
**User Decision:** Accepted revised Option A on 2026-09-10. Blend65 reads filenames as the host
exposes them and imposes no casing or Unicode portability restriction.
**Correction Status:** Queued for the accepted-fixes batch; PF-002 remains open until the affected
requirements and acceptance criteria are corrected and verified.

### PF-003: Unknown indirect calls have two conflicting outcomes 🟠 MAJOR

**Dimension:** 3 — Logical Contradictions
**Location:** `00-ambiguity-register.md:213-236`;
`RD-04-complete-language-correct-unoptimized-compiler.md:211-216,267-271`
**The Problem:** AR-018 and R4.30 require a finite compiler-proven target set and reject genuinely
unknown or escaped targets. R4.39 also permits an undefined “explicit conservative contract.” The
wording does not distinguish a safe finite over-approximation of known source functions from a
genuinely unbounded raw or external target, so implementations could either reject ordinary typed
function-value flows too early or admit calls that SFA/effect/stack analysis cannot close.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A — accepted | First track precise target provenance through assignments, aggregates, parameters, returns, and merges. When exact provenance becomes imprecise but the closed program still supplies a finite set, conservatively include every address-taken source function with the exact signature. Treat that finite superset as proved input to call-graph, effect, recursion, stack, interrupt, and SFA analysis. Reject only when no finite source target set can be proved. Add no raw callable address, runtime registry, dynamic frame, or universal dispatcher. | Preserves ordinary modern function-value use and makes the compiler widen safely before rejecting source. | A conservative superset may reserve more static storage or require a larger measured dispatch until analysis becomes more precise. |

**Recommendation:** Revised Option A. A finite conservative superset is still consistent with
AR-018 and requires no runtime feature. It is the compiler's required fallback before diagnosing a
genuinely unknown target.

**Confidence:** High. **Hardening:** Deeper review added the missing finite-superset option. The
original challenger correctly rejected unbounded calls but did not distinguish them from a safe
closed-world over-approximation.
**User Decision:** Accepted revised Option A on 2026-09-10.
**Correction Status:** Queued for the accepted-fixes batch; PF-003 remains open until AR-018, R4.30,
R4.39, and their acceptance evidence use the same finite-set rule.

### PF-004: RD-09 can close before its required producers 🟠 MAJOR

**Dimension:** 5 — Dependency Issues
**Location:** `README.md:74-96`; `RD-09-developer-tooling-and-debug-evidence.md:106-140,238-312,516-528`;
RD-06 R6.55, RD-07 R7.48, and RD-08 R8.58
**Codebase Evidence:** `packages/language-server/src/index.ts` and `packages/vscode/src/index.ts` are
stubs; final emission and optimization evidence are backend/compiler responsibilities, while the
frontend/LSP boundary correctly cannot import codegen.
**The Problem:** RD-09 may start and apparently close after RD-04, but mandatory tooling/debug
behavior consumes platform, asset, load-unit, bank, optimization, and final-location evidence from
RD-05 through RD-08. The corresponding producer handoffs are only Should requirements.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A — accepted | Keep RD-04 as the start gate, require RD-05–RD-08 before final RD-09 closeout, promote consumed handoffs to Must, and establish schema-first milestones. | Preserves useful parallel frontend work and makes closure truthful. | RD-09 remains a long-lived parallel stream. |
| B | Split early editor work and later debug/build integration into separate RDs. | Makes dependencies visually simple. | Adds another lifecycle boundary without reducing product work. |

**Recommendation:** Option A. It corrects the dependency truth with less workflow structure.

**Confidence:** High. **Hardening:** Challenger selected Option A.
**User Decision:** Accepted Option A on 2026-09-10. RD-09 has a bounded frontend/editor milestone
after RD-04 and a final build/debug integration milestone after RD-05 through RD-08.
**Correction Status:** Queued for the accepted-fixes batch; PF-004 remains open until the dependency
graph, RD-09 closeout gate, and producer handoffs are corrected and verified.

### PF-005: Native asset evidence gates have no complete owner 🟠 MAJOR

**Dimension:** 4 — Completeness Gaps
**Location:** `README.md:79-95`; `00-ambiguity-register.md:740-765`;
`RD-03-playable-m1-complete-pipeline.md:171-180`;
`RD-06-native-assets-compile-time-composition-and-resident-layout.md:103-107,137-141`
**Codebase Evidence:** `.agents/skills/blend65-domain-expert/references/c64-game-engineering.md:675-700`
keeps the complete SpritePad/CharPad schemas and fixture matrices unqualified; v3 format-aware
`embed()` is rejected at `packages/frontend/src/semantics/type-check/statement-typing.ts:951-956`.
**The Problem:** The user-owned M1 SpritePad handoff covers one sample, not RD-06's complete
SpritePad modes, any CharPad matrix, or their authoritative schema/manual evidence. Missing inputs
can block planning, but the dependency graph names no owner or checkpoint.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A — accepted | Before RD-03 planning, require the user-supplied SpritePad 3.80 M1 project, native file, relevant exports/settings, provenance, hashes, distinguishable expected records, and retention status; qualify only the SPD v5 surface M1 consumes. Before RD-06 plans each full handler, require the corresponding complete current-producer SpritePad 3.80 or CharPad 3.88 fixture matrix, expected decoded values, provenance, hashes, and retention/redistribution decision. Missing evidence pauses only that format and never authorizes guessed parsing or silent scope reduction. | Prevents guessed proprietary formats, preserves the approved surface, and delays the larger evidence burden until its actual consumer. | Format-dependent planning still depends on external producer evidence. |

**Recommendation:** Option A. Reducing native-format scope would reverse an approved product decision.

**Confidence:** High. **Hardening:** Challenger confirmed the finding and fail-closed gate.
**User Decision:** Accepted Option A on 2026-09-10. The M1 SpritePad evidence is due before RD-03
planning; complete SpritePad and CharPad matrices are due only before their RD-06 handler plans.
**Correction Status:** Queued for the accepted-fixes batch; PF-005 remains open until the dependency
graph, ownership, evidence gates, and fail-closed acceptance cases are corrected and verified.

### PF-006: Sibling files cannot be published as one atomic set 🟠 MAJOR

**Dimension:** 6 — Feasibility Concerns
**Location:** `RD-03-playable-m1-complete-pipeline.md:217-222,415-421`;
`RD-07-loadable-assets-and-d64-delivery.md:87-96`;
`RD-09-developer-tooling-and-debug-evidence.md:53-61,543-546,603-607`
**Codebase Evidence:** v3 writes artifacts separately (`packages/compiler/src/acme/emit-binary.ts:98,170-171`)
and supplies no reusable set transaction. Official Node, POSIX, and Windows APIs publish one rename
target; Windows rejects replacement when that target is an existing directory.
**The Problem:** A temporary “sibling set” followed by one rename cannot atomically replace several
files. The requirements also do not define ownership when concurrent builds/runs target one
`outDir`. A run can otherwise launch another invocation's stable `<name>.prg` or `.d64`.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A — accepted | Build and validate in a unique staging directory; rename it once to an immutable build-ID generation; then atomically replace one small current-generation record. A short per-project lock coordinates only publication, run pinning, and cleanup. Each run pins its own generation. Failed work cleans only its staging directory. Retain the current generation, every actively pinned generation, and the most recent unpinned predecessor; delete only older unpinned generations under the same lock. | Portable one-entry commit; no mixed set; correct concurrent run identity; bounded inactive retention; previous-good recovery. | Changes output layout and needs direct Linux/Windows publication, failure, concurrency, and cleanup proof. |
| B | Serialize same-project builds and define another portable whole-set publication protocol. | Simpler concurrency. | Serialization alone does not make sibling replacement atomic; the set protocol remains missing. |

**Recommendation:** Option A, implemented directly rather than as a generic transaction framework.
Bound inactive retention while exempting current and actively pinned generations from cleanup.

**Confidence:** High. **Hardening:** Challenger selected and narrowed Option A.
**User Decision:** Accepted Option A on 2026-09-10. The publication mechanism is one direct
host-side routine and adds no target bytes, storage, startup work, or cycles.
**Correction Status:** Queued for the accepted-fixes batch; PF-006 remains open until the artifact
layout, current record, lock/pin protocol, retention rule, and Linux/Windows acceptance cases are
corrected and verified.

### PF-007: Tool discovery trust boundary was defined too broadly 🟠 MAJOR

**Dimension:** 8 — Security Blind Spots
**Location:** `00-ambiguity-register.md:1118-1132`;
`RD-09-developer-tooling-and-debug-evidence.md:63-76,596-607,769-774`
**Codebase Evidence:** v3's `packages/compiler/src/acme/discover-acme.ts:102-119` demonstrates
ordinary process-`PATH` discovery, but v4 deliberately assigns discovery to the CLI rather than the
compiler library.
**The Problem:** The requirements mixed portable project input, host-controlled process `PATH`, and
extra fixed-location discovery into one security boundary. This invited special rejection rules for
ordinary `PATH` entries and a qualified-install-location registry even though the intended product
contract is only a machine-local override followed by normal host `PATH` lookup. It also obscured
that ACME and VICE are optional CLI capabilities rather than compiler-core dependencies.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Make the CLI use an explicit machine-local `tools.jsonc` path first and otherwise normal process-`PATH` lookup. Treat `PATH` as host execution authority, remove fixed-location discovery and special project-contained-entry rejection, and keep all executable paths/commands out of portable project, source, and asset input. | Matches normal command-line behavior, preserves deliberate host configuration, and keeps the compiler library independent of external tools. | A user-controlled `PATH` may deliberately select a local executable, as with other CLI programs. |
| B | Permit only explicit machine-local configuration and remove automatic `PATH` discovery. | Minimizes discovery behavior. | Adds needless setup and contradicts the approved automatic-discovery experience. |

**Recommendation:** Option A. A configured path wins and an invalid configured path fails clearly
without fallback. Otherwise the CLI uses normal OS `PATH` ordering and validates the selected
tool's compatible identity. It spawns the executable directly with an argument array, never through
a shell. No-tools operation still permits compiler-library use, source checking, LSP analysis, and
assembly emission; ACME adds PRG/D64 production, while VICE adds emulator execution only. An
explicit operation fails only when its required capability is absent and never publishes partial or
stale success. Canonical path and version are normal build evidence; an executable hash may remain
qualification evidence without becoming a discovery trust framework.

**Confidence:** High. **Hardening:** The initial challenger recommendation was superseded after the
user clarified the intended CLI-owned config-or-`PATH` boundary.
**User Decision:** Accepted revised Option A on 2026-09-10. The user explicitly rejected additional
discovery machinery: the CLI looks only at machine-local configuration and then normal `PATH`.
**Correction Status:** Queued for the accepted-fixes batch; PF-007 remains open until RD-09, RD-10,
AR-048, and their acceptance cases consistently express the revised capability matrix and discovery
boundary.

### PF-008: Public evidence sidecars have no versioned schemas 🟠 MAJOR

**Dimension:** 4 — Completeness Gaps
**Location:** `README.md:151-155`; `RD-03-playable-m1-complete-pipeline.md:417-421`;
RD-06 R6.46; RD-07 R7.34; RD-08 R8.12; `RD-09-developer-tooling-and-debug-evidence.md:224-228,445-462`
**Codebase Evidence:** The v4 compiler/editor do not exist yet; v3 LSP/VS Code are stubs and cannot
supply a compatible public schema precedent. Only `.debug.json` has an explicit evolution rule.
**The Problem:** `.assets.json`, `.memory.json`, `.costs.json`, and `.build.json` are parsed across
compiler/editor/release boundaries but lack schema identities, exact types, required/optional
fields, `Unknown` representation, unknown-field behavior, canonical encoding, and unsupported-major
failure rules.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Freeze one small direct versioned schema per public sidecar before its specification tests. | Independent consumers can evolve safely; no new framework. | Several compact schemas must be coordinated deliberately. |
| B | Combine all evidence into one versioned schema/file. | One envelope/version. | Couples unrelated consumers and makes partial evidence harder to use. |

**Recommendation:** Option A. Do not add a registry, schema service, or evidence database.

**Confidence:** High. **Hardening:** Challenger selected and bounded Option A.
**User Decision:** Accepted Option A on 2026-09-10. Each sidecar receives one compact independent
versioned contract with exact field types, required/optional rules, unavailable-value
representation, unknown-field behavior, canonical encoding where determinism requires it, and an
unsupported-major diagnostic. This creates no shared schema framework, registry, service, or
database.
**Correction Status:** Queued for the accepted-fixes batch; PF-008 remains open until the four
schemas and their consumer-focused qualification requirements are made explicit and consistent.

### PF-009: Build identity can hash itself and absorb host-specific data 🟠 MAJOR

**Dimension:** 3 — Logical Contradictions
**Location:** `RD-03-playable-m1-complete-pipeline.md:217-222,420-421`;
`RD-09-developer-tooling-and-debug-evidence.md:63-72,238-248`;
`RD-10-production-qualification-and-c64u-handoff.md:105-110`
**The Problem:** Every evidence file binds `buildId`, while `buildId` covers every output hash. If
`.build.json` contains the ID and its own hash participates, the identity is circular. The set also
does not state whether host-specific executable path/hash fields affect the portable ID, which can
break required Linux/Windows output identity.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Derive `buildId` only from canonical semantic inputs and portable tool identities. Let `.build.json` hash every other artifact, explicitly exclude itself, and keep host path/executable hash/duration/memory as provenance outside portable identity. Name an output digest separately if needed. | Acyclic and easy to explain; preserves cross-host semantics. | Must document three related concepts clearly: build identity, output digests, host provenance. |
| B | Use an explicit two-level identity where one semantic ID points to a separately hashed artifact-set manifest. | Also acyclic and flexible. | Adds a less intuitive public identity layer. |

**Recommendation:** Option A. It is the smallest model that supports stale-artifact checks without
self-reference.

**Confidence:** High. **Hardening:** Challenger selected and refined Option A.
**User Decision:** Accepted Option A on 2026-09-10. `buildId` covers canonical semantic inputs and
portable tool identities, artifact digests cover generated outputs other than `.build.json`, and
host-specific paths, executable hashes, timings, and memory measurements remain provenance outside
the portable identity. `.build.json` never contributes to the identity it contains.
**Correction Status:** Queued for the accepted-fixes batch; PF-009 remains open until the identity,
artifact-digest, and host-provenance boundaries are stated consistently with qualification cases.

### PF-010: `outDir` lifecycle and containment are undefined 🟠 MAJOR

**Dimension:** 1 — Ambiguities
**Location:** `RD-02-clean-v4-foundation-and-deterministic-project-model.md:110-125,191-194,298-317`
**The Problem:** `outDir` is treated like a readable contained input path even though an initial
output directory may not exist. The set does not say whether the compiler creates it, how it proves
containment for a missing leaf, whether it enters input hashes, or what happens for an existing
file, symlink, source overlap, or stale generation.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Treat `outDir` as output state, not hashed input. Validate its lexical path and nearest existing canonical parent, exclude it from discovery, create only missing contained components during publication, and reject escape/file/input collisions. | Normal first-build experience with safe containment. | Must defend directory creation against filesystem races. |
| B | Require a pre-existing empty contained directory and diagnose absence/non-empty state. | Simpler host logic. | Unnecessarily hostile for normal builds and repeated builds. |

**Recommendation:** Refined Option A, coordinated with PF-006's generation model. Treat `outDir`
exclusively as compiler-owned output state. It is a relative contained path that the compiler may
create, is excluded from all input discovery and identity hashes, and may hold valid prior
generations. Reject absolute or escaping paths, a required directory occupied by a file, symlink
escape, and any explicitly declared source/asset inside the output tree. A nested output directory
remains valid when `sourceRoot` is `.`, because discovery excludes the output subtree before
walking inputs.

**Confidence:** High. **Hardening:** Challenger selected Option A.
**User Decision:** Accepted refined Option A on 2026-09-10. Directory creation and validation stay
one bounded filesystem responsibility rather than becoming a workspace or storage framework.
**Correction Status:** Queued for the accepted-fixes batch; PF-010 remains open until the manifest,
path/snapshot model, generation publication, and first/repeated-build qualification cases express
this lifecycle consistently.

### PF-011: Cancelling a running VICE session cannot undo its completed build 🟠 MAJOR

**Dimension:** 3 — Logical Contradictions
**Location:** `RD-09-developer-tooling-and-debug-evidence.md:53-61,77-81,714-720`;
`RD-10-production-qualification-and-c64u-handoff.md:56-60,565-569`
**The Problem:** VICE starts only after `run` successfully builds and publishes its fresh artifact.
AC-22 nevertheless says cancelling an already-running VICE session leaves no newly published set.
That requires destructive rollback of a valid build and races readers/concurrent operations.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Make publication the no-return point: cancellation observed before commit publishes nothing; after commit the build stays valid, and later run cancellation stops VICE/monitor only. | Deterministic and preserves valid artifacts. | UI must distinguish build success from later run cancellation. |
| B | Keep run output provisional until VICE exits. | Makes cancellation remove provisional work. | Incorrectly makes compiler artifact validity depend on emulator lifetime. |

**Recommendation:** Option A, with acceptance cases on both sides of the publication boundary.

**Confidence:** High. **Hardening:** Challenger selected Option A.
**User Decision:** Accepted Option A on 2026-09-10. Publication is the no-return point: cancellation
before its atomic commit publishes nothing; cancellation after it preserves the valid build and
terminates only the owned VICE/monitor execution. The result distinguishes successful build from
cancelled run, including a deterministic race case at the commit boundary.
**Correction Status:** Queued for the accepted-fixes batch; PF-011 remains open until cancellation,
publication, CLI/LSP result reporting, and qualification cases share this exact boundary.

### PF-012: Interrupt install/restore has no closed ownership lifecycle 🟠 MAJOR

**Dimension:** 1 — Ambiguities
**Location:** `RD-05-c64-platform-profiles-and-game-workload-compiler-support.md:148-168,661-673`;
`RD-07-loadable-assets-and-d64-delivery.md:596-600`
**The Problem:** The requirements promise predecessor preservation and stale-owner rejection but do
not define repeated or nested installation, conditional install/restore, duplicate restore, or an
intervening raw vector write. Different choices change source legality, storage, SFA routes,
quiescence, return behavior, and emitted bytes.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Define compile-time per-sink ownership with provable LIFO nesting. Each restore must match its exact active installation; branch joins must agree. Raw vector writes remain legal low-level MMIO but invalidate helper guarantees, so later helper restore is rejected. No hidden runtime state. | Expert-correct, supports useful temporary replacement, and costs only explicit predecessor storage. | Highly dynamic takeover patterns must use explicit low-level management. |
| B | Add runtime owner flags/tokens and result-bearing APIs. | Handles dynamic paths. | Consumes scarce target bytes/cycles and creates runtime behavior not otherwise needed. |

**Recommendation:** Option A. The limitation is hardware/resource driven and remains statically
diagnosed; ordinary typed use stays safe.

**Confidence:** Medium-high. **Hardening:** Challenger selected Option A and refined it from a
single-state rule to provable LIFO nesting.
**User Decision:** Accepted Option A on 2026-09-10. Each interrupt sink has a statically proved
LIFO installation stack; restores must match the active top installation and branch joins must
agree. Repeated or nested use is legal when maximum depth and balance are finite and provable, with
only the required predecessor words allocated. A raw vector write remains legal low-level access
but invalidates helper ownership, so a later helper restore is diagnosed. No runtime registry,
token, flag, scheduler, or hidden lifecycle is emitted.
**Correction Status:** Queued for the accepted-fixes batch; PF-012 remains open until installation,
restore, storage, control-flow, raw-vector, quiescence, and qualification rules share this model.

### PF-013: Loader destinations reject valid addressable places 🟠 MAJOR

**Dimension:** 4 — Completeness Gaps
**Location:** `RD-01-specification-4-and-expert-authority-freeze.md:82-86`;
`00-ambiguity-register.md:164-177`; `RD-07-loadable-assets-and-d64-delivery.md:52-60,550-552`
**Codebase Evidence:** v3 has no qualified loadable-value path to preserve. Its parser/semantic
surface already represents fixed fields, indexed elements, and unsized parameters as addressable
forms; the v4 place doctrine explicitly admits their compositions.
**The Problem:** RD-07 rejects partial fields and unsized aggregate parameters even when they denote
mutable, exact-sized, lifetime-valid storage with a completely provable destination interval. That
is compiler-convenience leakage, not a 6510 or KERNAL restriction.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A — only viable | Permit every mutable, lifetime-valid, exact-typed place whose full interval, visibility, alignment, overlap, and publication state are statically proved. Evaluate the place expression once. Continue rejecting temporaries, constants, MMIO, expired storage, mismatched extents, and unproved ranges. | Modern source behavior with expert target code. | Parameter-alias and interval proof is substantial compiler work. |

**Recommendation:** Option A. A root-only rule violates the project's modern-input prime directive.

**Confidence:** High. **Hardening:** Challenger confirmed Option A.
**User Decision:** Accepted Option A on 2026-09-10. A loader destination may be any mutable,
lifetime-valid, exact-typed place whose complete interval, visibility, alignment, overlap, and
publication state are statically proved. This includes fields, indexed elements, compositions, and
aggregate parameters when the caller/alias proof closes. The place expression evaluates once.
Constants, temporaries, MMIO, expired storage, mismatched extents, and unproved ranges remain
invalid. Loading stays direct to final storage with no descriptor, staging buffer, or hidden copy.
**Correction Status:** Queued for the accepted-fixes batch; PF-013 remains open until RD-01,
AR-015/AR-016, RD-07, and loader qualification cases consistently admit the complete place model.

### PF-014: Optimizer size and packaging cost domains are conflated 🟠 MAJOR

**Dimension:** 1 — Ambiguities
**Location:** `RD-07-loadable-assets-and-d64-delivery.md:92-96,235-239`;
`RD-08-optimization-and-expert-output.md:66-73,90-93,418-430`
**The Problem:** The requirements allow fixed D64 container and filesystem-allocation properties to
enter `B`, even though `optimization: size` is intended to minimize generated target-program bytes
and target-memory use. Every standard D64 is 174,848 bytes, so its physical length is constant; its
sector allocation is packaging capacity/evidence rather than a measure of generated program
quality. The current `B -> T -> R` order also lets equal-byte candidates prefer speed before lower
target-memory pressure, contrary to the intended size goal.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Define `B` as compiler-generated target-loadable program/data bytes, `R` as the selected profile's ordered target-memory resource vector, and `T` as qualified comparable cycle costs. Select `size` by `B -> R -> T`, `speed` by `T -> R -> B`, and `balanced` only by no-regression dominance. Keep D64 length/allocation/overhead outside these orderings as fit constraints and packaging evidence. | Matches developer intent, preserves distinct physical resources, and keeps packaging from steering code generation. | Requires precise component definitions and mode-specific qualification cases. |
| B | Let D64 allocated blocks and filesystem overhead participate in `B`. | Can prefer a disk representation using fewer blocks. | Makes compiler optimization depend on packaging granularity rather than program quality and contradicts the intended meaning of `size`. |

**Recommendation:** Option A. For a PRG build, `B` corresponds to the target PRG bytes, including
generated code, initialized data, embedded payload, reachable helpers/tables, loader, padding, and
branch repair. For D64, it covers logical compiler-generated target payloads, never the fixed image,
BAM/directory/link/tail/fill, host evidence, or archive compression. A byte may contribute to both
`B` and `R` because shipped program size and simultaneous target residency are distinct resources;
they are never added into one weighted score. Hard correctness, timing, memory, banking, stack,
zero-page, and disk-capacity limits filter candidates before any mode preference. `none` performs
required deterministic correct lowering without optional optimization. All optimized modes exhaust
the same finite qualified candidate frontier; only their final ordering differs.

**Confidence:** High. **Hardening:** The original challenger result was reopened after the user
clarified the intended size goal. Independent re-review confirmed revised Option A and rejected
D64 allocation as an optimizer objective.
**User Decision:** Accepted revised Option A on 2026-09-10. The user explicitly confirmed that
`size` means generated program/PRG size and target-memory usage; known D64 container size is
irrelevant to optimization.
**Correction Status:** Queued for the accepted-fixes batch; PF-014 remains open until RD-07, RD-08,
AR-023, AR-045, the cost schemas, and mode qualification cases consistently define `B`, `R`, `T`,
the corrected orderings, and the packaging exclusion.

### PF-015: M1 explosion update counting is ambiguous 🟡 MINOR

**Dimension:** 1 — Ambiguities
**Location:** `RD-03-playable-m1-complete-pipeline.md:368-385,616-625`
**The Problem:** The explosion lasts exactly two updates, but the update order advances only an
existing explosion before resolving a new hit. The requirements do not say whether the hit update
is explosion update one, so the pure oracle and VICE trace may disagree by one frame.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | The hit update publishes frame 1/count 1; the next update publishes frame 2/count 2; the following update becomes idle. | Immediate, unsurprising visual feedback and exact two-update lifetime. | Tests must name collision frame versus following frame. |
| B | Create explosion state on hit but begin its two counted updates on the next update. | Keeps “advance existing” literal. | Adds a surprising uncounted creation update. |

**Recommendation:** Option A.

**Confidence:** High. **Hardening:** Challenger retained the finding but downgraded it to minor and
selected Option A.
**User Decision:** Accepted Option A on 2026-09-10. The collision update immediately publishes
explosion frame 1/count 1, the next update publishes frame 2/count 2, and the following update makes
the explosion idle. This freezes only the M1 Blend65 fixture, independent behavior oracle, and VICE
frame expectations; it adds no compiler intrinsic, runtime support, game abstraction, or engine.
**Correction Status:** Queued for the accepted-fixes batch; PF-015 remains open until the RD-03
state table, update order, predetermined trace, pure oracle, and VICE criteria share this count.

### PF-016: `optimization: none` needs deterministic backend policy, not frozen assembly 🟡 MINOR

**Dimension:** 1 — Ambiguities
**Location:** `RD-04-complete-language-correct-unoptimized-compiler.md:291-312`;
`RD-08-optimization-and-expert-output.md:49-53,94-98,308-314,418-423`
**The Problem:** `none` still performs legal instruction and helper selection, but no deterministic
backend policy resolves incomparable legal forms. Freezing every pattern into Specification 4 would
overconstrain future compiler improvement; reusing `balanced` would make `none` misleading.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Define `none` as disabling optional optimization/rewrite passes while a deterministic backend policy and stable tie-breakers select legal code. Bind reproducibility to compiler identity and allow that policy to improve between compiler versions. | Stable per build identity without fossilizing codegen. | Assembly may intentionally change after a compiler upgrade. |
| B | Freeze every canonical lowering pattern in Specification 4/expert authority. | Maximally stable assembly. | Turns backend engineering into permanent language semantics. |

**Recommendation:** Option A.

**Confidence:** High. **Hardening:** Challenger downgraded the issue to minor and replaced the
initial freeze recommendation with Option A.
**User Decision:** Pending

### PF-017: V3 has no qualified native asset codec to salvage 🟡 MINOR

**Dimension:** 13 — Codebase Alignment
**Location:** `00-ambiguity-register.md:417-431`
**Codebase Evidence:** `packages/frontend/src/semantics/type-check/statement-typing.ts:951-956`
rejects every format-aware embed. The active expert baseline keeps full SpritePad/CharPad parsers
and producer fixtures unqualified at `references/c64-game-engineering.md:675-700`.
**The Problem:** AR-025 lists “qualified asset codecs/fixtures” as likely salvage candidates. The
checkout contains raw asset/embed mechanics, not that qualified native-format implementation.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A — only viable | Name raw asset-reader/embed mechanics as the actual candidates and state that native codecs/fixtures are new RD-03/RD-06 work. | Makes the inventory truthful. | Small wording correction. |

**Recommendation:** Option A.
**User Decision:** Pending

### PF-018: Embedded-data warning refers to an impossible configuration 🟡 MINOR

**Dimension:** 12 — Consistency
**Location:** `RD-06-native-assets-compile-time-composition-and-resident-layout.md:292-299,723-727`;
`RD-02-clean-v4-foundation-and-deterministic-project-model.md:104-115,298-315`
**The Problem:** W10150 uses a profile's “configured threshold” with a 75% fallback, but no profile
requirement or permitted project key owns that configuration.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A — only viable in current scope | Make the initial threshold exactly 75% of the selected profile's binary budget. | Deterministic; adds no configuration. | Changing it later requires an explicit requirement update. |

**Recommendation:** Option A. Adding a new user option would be unjustified scope.
**User Decision:** Pending

### PF-019: `tools.jsonc` has an undefined schema version 🟡 MINOR

**Dimension:** 1 — Ambiguities
**Location:** `00-ambiguity-register.md:1118-1132`;
`RD-09-developer-tooling-and-debug-evidence.md:63-76,569-575,769-774`
**The Problem:** The file permits `schemaVersion` but never says whether it is required, its accepted
type/value, or the missing/unsupported-version outcomes. The separate project-manifest version
cannot be assumed.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A — only viable | Require integer `schemaVersion: 1`, reject missing/unsupported versions with stable diagnostics, and add AC-36 cases. | Exact and fail closed. | Small extra negative-test surface. |

**Recommendation:** Option A.
**User Decision:** Pending

### PF-020: AR-023 retains a superseded hot-path speed rule 🟡 MINOR

**Dimension:** 12 — Consistency
**Location:** `00-ambiguity-register.md:365-368,923-942`;
`RD-08-optimization-and-expert-output.md:86-89,390-393`
**The Problem:** AR-023 says `speed` prioritizes declared hot paths. AR-045 and RD-08 later require
frequency-free minimax and forbid hotness annotations, but the register does not mark the earlier
text superseded.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A — only viable | Rewrite AR-023's speed sentence to the AR-045 minimax rule and explicitly record that AR-045 supersedes the old wording. | One consistent active optimizer policy. | Small cross-reference edit. |

**Recommendation:** Option A.
**User Decision:** Pending

## Audit Guardrails and Result

- No compiler, ACME, VICE, readiness, or feasibility-matrix suite was run.
- Only the user-approved PF-001 requirements correction has been applied; PF-002 through PF-020
  remain pending.
- The scan found no unapproved game engine, runtime, readiness product, plugin framework, or
  nondeterministic performance gate.
- Optimizer fixed-point qualification, tooling breadth, physical QA, and C64U readiness are large
  but bounded by explicit user-approved scope and testable evidence.
- The roadmap does not advance while any critical or major finding is unresolved.

**Current Result:** **BLOCKED** with 19 findings pending user decisions and correction/rescan.
