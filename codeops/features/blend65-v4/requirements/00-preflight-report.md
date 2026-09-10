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

### PF-002: Cross-platform project names and path identities are undefined 🟠 MAJOR

**Dimension:** 1 — Ambiguities
**Location:** `RD-02-clean-v4-foundation-and-deterministic-project-model.md:110-131,298-315,501-515`
**The Problem:** “Platform-independent validation” and “case-sensitive ASCII order” do not define a
project-name grammar, Unicode normalization, non-ASCII ordering, reserved Windows names, or
normalization/case collisions. Linux and Windows can accept different identities and AC-13/AC-16
have no exact oracle.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Use a portable ASCII grammar for the artifact/project `name`; allow Unicode physical paths; derive logical identities in specified NFC form with `/`; sort unsigned UTF-8 bytes; reject normalization and host-case collisions. | Modern path support with deterministic portable identities. | Requires careful collision and filesystem-alias tests. |
| B | Restrict all project names and paths to portable ASCII. | Smallest path model. | Needlessly rejects ordinary modern filesystem paths. |

**Recommendation:** Option A. It keeps the public artifact name safe without forcing developers to
rename normal Unicode project directories.

**Confidence:** High. **Hardening:** Challenger selected Option A and refined physical versus
logical normalization.
**User Decision:** Pending

### PF-003: Unknown indirect calls have two conflicting outcomes 🟠 MAJOR

**Dimension:** 3 — Logical Contradictions
**Location:** `00-ambiguity-register.md:213-236`;
`RD-04-complete-language-correct-unoptimized-compiler.md:211-216,267-271`
**The Problem:** AR-018 and R4.30 require a finite compiler-proven target set and reject unknown or
escaped targets. R4.39 also permits an undefined “explicit conservative contract.” No raw callable
address, external ABI, dynamic loader, runtime registry, or SFA contract can close that alternative.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A — only viable in current scope | Remove the conservative alternative and reject calls whose finite target set cannot be proved. | Matches the approved finite function-value model and closes SFA/effect/stack analysis. | Does not provide unrestricted raw calls, which were already rejected. |

**Recommendation:** Option A. Defining the other path would create a new ABI/runtime language feature.

**Confidence:** High. **Hardening:** Challenger confirmed Option A.
**User Decision:** Pending

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
| A | Keep RD-04 as the start gate, require RD-05–RD-08 before final RD-09 closeout, promote consumed handoffs to Must, and establish schema-first milestones. | Preserves useful parallel frontend work and makes closure truthful. | RD-09 remains a long-lived parallel stream. |
| B | Split early editor work and later debug/build integration into separate RDs. | Makes dependencies visually simple. | Adds another lifecycle boundary without reducing product work. |

**Recommendation:** Option A. It corrects the dependency truth with less workflow structure.

**Confidence:** High. **Hardening:** Challenger selected Option A.
**User Decision:** Pending

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
| A — only viable for approved scope | Add explicit owner-supplied evidence gates before RD-03 and RD-06 planning, including provenance, expected decoded meaning, retention/redistribution status, and fail-closed behavior. | Prevents guessed proprietary formats and keeps the approved scope. | Progress depends on external producer evidence. |

**Recommendation:** Option A. Reducing native-format scope would reverse an approved product decision.

**Confidence:** High. **Hardening:** Challenger confirmed the finding and fail-closed gate.
**User Decision:** Pending

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
| A | Publish immutable build-ID generation directories, then atomically replace one small current-generation record. A run pins its own generation. Failed work cleans only its staging directory; retained generations cannot be removed while in use. | Portable one-entry commit; no mixed set; correct concurrent run identity. | Changes output layout and needs direct Windows proof plus a bounded retention rule. |
| B | Serialize same-project builds and define another portable whole-set publication protocol. | Simpler concurrency. | Serialization alone does not make sibling replacement atomic; the set protocol remains missing. |

**Recommendation:** Option A, implemented directly rather than as a generic transaction framework.
Begin with conservative retention; add cleanup only with explicit ownership and active-run safety.

**Confidence:** High. **Hardening:** Challenger selected and narrowed Option A.
**User Decision:** Pending

### PF-007: Automatic PATH discovery can execute project-controlled tools 🟠 MAJOR

**Dimension:** 8 — Security Blind Spots
**Location:** `00-ambiguity-register.md:1118-1132`;
`RD-09-developer-tooling-and-debug-evidence.md:63-76,596-607,769-774`
**Codebase Evidence:** v3's `packages/compiler/src/acme/discover-acme.ts:102-119` joins every
non-empty PATH component without rejecting relative or project-contained entries.
**The Problem:** PATH may contain `.`, an empty or relative component, `node_modules/.bin`, a project
directory, or a symlink into one. A hostile project can supply `acme` or `x64sc`; checking its
claimed version already executes it, and a later hash does not establish trust.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | For automatic discovery reject empty, relative, drive-relative, and canonically project-contained PATH entries/candidates, including symlinks. Permit an explicit absolute machine-local tools-file path to authorize a deliberate project-local tool. | Retains normal PATH convenience without violating the stated trust boundary. | Project-local tool users must configure it explicitly. |
| B | Remove PATH discovery and allow only fixed host locations or explicit configuration. | Smallest trust model. | Worse developer experience on ordinary Linux/Windows installs. |

**Recommendation:** Option A, with qualification cases for `.`, empty components,
`node_modules/.bin`, drive-relative Windows paths, and symlink-to-project candidates.

**Confidence:** High. **Hardening:** Challenger selected Option A.
**User Decision:** Pending

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
**User Decision:** Pending

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
**User Decision:** Pending

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

**Recommendation:** Option A, coordinated with PF-006's generation model.

**Confidence:** High. **Hardening:** Challenger selected Option A.
**User Decision:** Pending

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
**User Decision:** Pending

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
**User Decision:** Pending

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
**User Decision:** Pending

### PF-014: D64 makes the `size` objective constant unless allocated cost is defined 🟠 MAJOR

**Dimension:** 1 — Ambiguities
**Location:** `RD-07-loadable-assets-and-d64-delivery.md:92-96,235-239`;
`RD-08-optimization-and-expert-output.md:66-73,90-93,418-430`
**The Problem:** Every standard D64 is 174,848 bytes. If `B` counts every shipped physical byte, all
candidates tie and `size` cannot prefer a smaller program or asset set. If free-sector fill is
excluded, the current “each physical shipped byte” wording and directory/BAM/sector overhead
attribution remain undefined.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Count reachable allocated payload plus attributable directory, BAM, link, tail, and sector-allocation overhead in `B`; exclude deterministic unallocated fill from selection and report the full image size separately. | Measures actual C64 storage consumption and preserves a meaningful size mode. | Shared filesystem overhead needs exact no-double-count attribution. |
| B | Optimize compressed host archive size. | Produces variable numbers. | Measures distribution compression, not the generated C64 artifact. |

**Recommendation:** Option A.

**Confidence:** High. **Hardening:** Challenger confirmed Option A.
**User Decision:** Pending

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
**User Decision:** Pending

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
