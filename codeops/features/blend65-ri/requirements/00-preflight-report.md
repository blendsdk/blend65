# Preflight Report: RD-16 — Compiler Configuration (`blend65.json`)

> **Status**: ✅ PASSED — all 14 findings resolved (0 critical, 2 major, 10 minor, 2 observations); user accepted all recommendations 2026-07-02; **fixes applied 2026-07-02** to RD-16 (PF-001/002/005/006/007/008/009/010/011/012/013-note), RD-15 (PF-003 flag rows R45/R46, PF-004 CompilerOptions extension, PF-010 outName derivation), RD-11 (PF-012 R50 suppression-wins), and RD-13 (PF-013 R35 qualification). PF-014 needs no edit — carried as a note in RD-16 §5's RD-14 row for RD-14 planning.
> **Iteration**: 1 (first scan)
> **Artifact**: Requirement document at `codeops/features/blend65-ri/requirements/RD-16-compiler-configuration.md`
> **Codebase Grounded**: ✅ ~15 source files examined across config/core/platforms/frontend/language-server + spec/ + 5 sibling RDs + the ambiguity register; ~35 references verified
> **Last Updated**: 2026-07-02
>
> Note: this file previously held the RD-17 requirements audit (all 13 findings resolved,
> PASS 2026-07-02). That report is preserved in git history; per convention this path holds
> the latest requirements-level audit. PF numbering restarts per artifact.
>
> Same-agent note: RD-16 was authored 2026-05-31 in a prior session — this is NOT a
> same-session review. Both MAJOR findings were hardened with an independent challenger
> (blind to the auditor's picks) per `_shared/recommendation-hardening.md`; the challenger
> also recalibrated PF-003 from MAJOR to MINOR, which was accepted.

### Codebase Context Summary

**Tech Stack:** TypeScript (ESM/NodeNext, strict), Yarn v1 workspaces + Turborepo, Vitest.
**Architecture:** AOT compiler pipeline; `@blend65/config` is one of 10 packages and is
currently a stub (`packages/config/src/index.ts` exports only `VERSION`), so RD-16 is
greenfield for the package itself — grounding focused on cited ARs, sibling RDs, the frozen
spec, and the already-shipped consumer code.

**Key files examined:**
- `packages/config/package.json` — deps: `@blend65/core` only; `packages/config/src/index.ts` — stub.
- `packages/platforms/src/registry.ts:20-51` — `PLATFORM_REGISTRY` (c64, c64u, cx16, a800xl, a7800), `DEFAULT_PLATFORM = "c64"`, `loadPlatform()` throws a plain Error listing available platforms; doc comment defers diagnostic wiring to "RD-15/16".
- `packages/core/src/diagnostics/diagnostic-bag.ts:98-165` — `createDiagnosticBag({maxErrors})`, default cap 20, E10000 TooManyErrors.
- `packages/core/src/diagnostics/diagnostic-codes.ts` — E10xxx/W10xxx bands; codes claimed additively (RD-09 precedent: E10035).
- `packages/core/src/platform/platform-plugin.ts:18-40` — `ShimVariant = "terminating" | "non-terminating" | "bare"`; `PreambleOptions.shimVariant`.
- `packages/frontend/src/parser/parser.ts:54`, `packages/frontend/src/semantics/analyze.ts:43` — established pattern: phases carry `readonly bag: DiagnosticBag` in a context object; `analyze.ts` also injects registry/profile deps.
- `packages/language-server/package.json:17-18` — deps: core + frontend only (no config edge today).
- `spec/14-diagnostics.md` §4 — `--warn-as-error`, `--suppress-warning=WXXXXX`, `--max-errors=N` (default 20) all verified.
- `spec/15-platform-profile.md` §3 — Platform Profile Contract.
- Sibling RDs: RD-15 (R9 CompilerOptions, R13 discovery, R19-R36 flags, R43 exit 2), RD-13 (R35/R37/R38, config-deps policy row), RD-11 (R5 code format, §4 SeverityPolicy), RD-14 (R38 LSP file discovery), RD-10 (registry).
- Ambiguity register: AR-13, AR-20, AR-37, AR-38, AR-39, AR-62, AR-69, AR-73, AR-75, AR-76, AR-77, AR-83 — all read in full.

**Reference Verification:** ~35 references mapped. Verified faithful: AR-13 (JSONC config),
AR-39 (include tiers + `**/*.blend` default), AR-62 (acmePath tier 1), AR-69 (startup key
`auto|terminating|minimal|bare` + `--startup`), AR-73 (bag, default 20 per Ch 14 §4), AR-75,
AR-76, AR-83, RD-13 R38, RD-15 R43 (exit 2), spec Ch 14 §4 flags/defaults. Mismatches became
the findings below.

### Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|------------------|
| 1 | Ambiguities | 2 (PF-009, PF-010) | 🟡 |
| 2 | Implicit Assumptions | contributes to PF-002 | 🟠 |
| 3 | Logical Contradictions | 2 (PF-004, PF-006) | 🟡 |
| 4 | Completeness Gaps | 2 (PF-003, PF-007) | 🟡 |
| 5 | Dependency Issues | contributes to PF-001, PF-014 | 🟠 |
| 6 | Feasibility Concerns | 1 (PF-001) | 🟠 |
| 7 | Testability | contributes to PF-006 (AC-14), PF-009 (AC-10) | 🟡 |
| 8 | Security Blind Spots | 2 (PF-011, PF-013) | 🟡 |
| 9 | Edge Cases | 3 (PF-007, PF-008, PF-012) | 🟡 |
| 10 | Scope Creep | contributes to PF-009 | 🟡 |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | 2 (PF-005, PF-010 shared) | 🟡 |
| 13 | Codebase Alignment | 3 (PF-001, PF-002, PF-005) | 🟠 |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| MAJOR | 2 | all resolved (recommendations accepted) |
| MINOR | 10 | all resolved (recommendations accepted) |
| OBSERVATION | 2 | all resolved (recommendations accepted) |

---

## MAJOR findings

### PF-001: Platform-name validation inside `loadConfig()` is architecturally infeasible 🟠 MAJOR

**Dimension:** 13 Codebase Alignment / 6 Feasibility / 5 Dependency
**Location:** RD-16 §4.3 step 6, R21 (§3.6), R22, AC-07
**Codebase Evidence:** `packages/config/package.json` (deps: `@blend65/core` only);
`packages/platforms/src/registry.ts:20-51` (`PLATFORM_REGISTRY`, `loadPlatform` — doc
comment at lines 33-36: wiring the unknown-platform message into diagnostics "is
RD-15/16's job"); RD-16 §4.2 `LoadConfigOptions` has no field for platform names; AR-20
package layout (config → core only).
**The Problem:** R21/AC-07 and algorithm step 6 require `loadConfig()` to verify `platform`
against registered plugin names and list the available platforms on error — but the registry
lives in `@blend65/platforms`, which `@blend65/config` must not (and does not) depend on,
and the declared `LoadConfigOptions` provides no channel to receive the names. As written
the requirement is unimplementable without a dependency-boundary violation.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add `knownPlatforms?: readonly string[]` to `LoadConfigOptions`; the caller (`@blend65/compiler`/CLI) passes `[...PLATFORM_REGISTRY.keys()]`; check skipped when omitted | Keeps R21/R22/AC-07 in-package and load-time; matches the existing dependency-injection pattern (`analyze.ts:43-56` injects registry/profile the same way); serves RD-14's LSP (core+frontend only) by simply omitting the check | AC-07 must be qualified "when knownPlatforms is provided" |
| B | Move semantic platform validation into `@blend65/compiler` (which deps both); config does shape-only validation | Reuses `loadPlatform()`'s existing available-platforms message | Splits config validation across two packages; reworks R21/R22/AC-07; weakens R22's "all validation at load time" |

**Recommendation:** Option A — dependency injection preserves the single validation locus
and mirrors the codebase's established pattern.
**Confidence:** High. **Hardening:** independent challenger (blind) independently chose A
and confirmed MAJOR; reconciled with no changes.

**User Decision:** Resolved — user accepted the recommendation (2026-07-02)

---

### PF-002: `loadConfig()` has no diagnostics channel for the W/E diagnostics it must emit 🟠 MAJOR

**Dimension:** 13 Codebase Alignment / 2 Implicit Assumptions
**Location:** RD-16 §4.2 (`loadConfig(options?: LoadConfigOptions): BlendConfig`), R19–R22 (§3.6), §4.3 steps 2–3/6
**Codebase Evidence:** AR-73 (accumulate-not-throw into `DiagnosticBag`);
`packages/core/src/diagnostics/diagnostic-bag.ts:98-110` (`createDiagnosticBag`);
established phase pattern `readonly bag: DiagnosticBag` at
`packages/frontend/src/parser/parser.ts:54` and `packages/frontend/src/semantics/analyze.ts:43`.
**The Problem:** R19 (unknown-key warnings), R20 (type errors), R21 (platform error) and
§4.3 require the loader to emit `W10xxx`/`E10xxx` diagnostics, and AR-73 forbids
throw-on-error — but the declared signature returns a bare `BlendConfig` with no way to
surface any diagnostic. The contract is unimplementable as declared.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add `readonly bag: DiagnosticBag` to `LoadConfigOptions` (making options required) and return `LoadConfigResult { config: BlendConfig; hasErrors: boolean }`, mirroring the parser's `{ ast, hasErrors }` shape | Consistent with the repo-wide shared-bag pattern; bag policies (dedup, ordering, max-errors) apply uniformly; `hasErrors` lets the caller implement R22's stop-with-exit-2 without re-scanning | Bootstrap wrinkle must be specified: the bag is created (default cap 20) *before* the config's own `maxErrors` is known — `maxErrors` applies to the downstream pipeline bag, not to config loading itself |
| B | Return `{ config, diagnostics: Diagnostic[] }` with a loader-private array | Self-contained | Breaks AR-73's shared-accumulator model — dedup/ordering/cap are `DiagnosticBag` policies and would be bypassed |

**Recommendation:** Option A — pattern-consistent and AR-73-conformant; spell out the
`maxErrors` bootstrap note in §4.3.
**Confidence:** High. **Hardening:** independent challenger (blind) chose A and contributed
the `{ config, hasErrors }` refinement and the bootstrap wrinkle; reconciled, refinement adopted.

**User Decision:** Resolved — user accepted the recommendation (2026-07-02)

---

## MINOR findings

### PF-003: RD-16 references CLI flags (`--config`, `--startup`) that RD-15 never defines 🟡 MINOR

**Dimension:** 4 Completeness (cross-document) / 5 Dependency
**Location:** RD-16 R4 (§3.1), R18 (§3.5), §5 RD-15 row
**Codebase Evidence:** RD-15 flag tables R19–R36 define neither flag; "startup" does not
appear anywhere in RD-15; `configPath?` exists only in the programmatic `CompilerOptions`
(RD-15 R9). AR-69 explicitly mandates the `--startup` flag.
**The Problem:** RD-16's override semantics for R4/R18 depend on flags that are phantom in
the flag-owning document. If RD-15 is planned without them, R4/R18 become dead references.

**Recommendation (single viable path):** Amend RD-15 with two flag rows — `--config <path>`
(source: AR-13/Design) and `--startup <variant>` (source: AR-69). RD-15 is the
non-conforming document: AR-69 names `--startup` verbatim, and RD-16's own scope (§2)
assigns flag definitions to RD-15. Considered and dropped: softening RD-16 to not name
flags — it would contradict the explicitly resolved AR-69.
**Hardening:** challenger verified the premise, chose the same fix, and recalibrated
severity MAJOR→MINOR (RD-15 is not yet planned; the fix is two table rows) — accepted.

**User Decision:** Resolved — user accepted the recommendation (2026-07-02)

---

### PF-004: Merge model (R24/R25) doesn't match the CLI-wraps-compiler architecture, and RD-15's `CompilerOptions` covers only a subset of properties 🟡 MINOR

**Dimension:** 3 Logical Contradictions / 12 Consistency (cross-document)
**Location:** RD-16 R24, R25 (§3.7), AC-09
**Codebase Evidence:** RD-15 R9: `CompilerOptions { platform, sourceFiles?, configPath?,
acmePath?, maxErrors?, warnAsError?, suppressWarnings?, optimize? }` — no `outDir`,
`outName`, `include`/`exclude`, `quiet`, `startup`, `diagnosticsFormat`. RD-15 R2: the CLI
is a thin wrapper that drives `@blend65/compiler`.
**The Problem:** (1) R25's four-layer order `defaults ← blend65.json ← CLI flags ←
programmatic API` implies CLI flags and programmatic options are simultaneous layers, but in
the real architecture the CLI *translates* flags into `CompilerOptions` — the two layers can
never coexist in one invocation, so "programmatic API overrides CLI defaults" (R24) has no
operational meaning. (2) Even taken as a subset relation, `CompilerOptions` cannot override
half the schema (no outDir/outName/quiet/startup/diagnosticsFormat/include/exclude), so
AC-09 is unsatisfiable "for every property".

**Recommendation:** Reword R24/R25 to a three-layer model — `defaults ← blend65.json ←
invocation overrides`, where the CLI's flag parser and a programmatic caller both deliver
the same `overrides` object — and amend RD-15 R9 so `CompilerOptions` covers every
overridable `BlendConfig` property. Considered and dropped: documenting `CompilerOptions`
as an intentional subset — it would silently make outDir/startup/etc. unreachable from the
programmatic API, contradicting AR-77's library-first commitment.

**User Decision:** Resolved — user accepted the recommendation (2026-07-02)

---

### PF-005: `startup: "minimal"` has no defined mapping to the shipped `ShimVariant` vocabulary 🟡 MINOR

**Dimension:** 12 Consistency / 13 Codebase Alignment
**Location:** RD-16 R18 (§3.5), §4.1/§4.2 (`'auto' | 'terminating' | 'minimal' | 'bare'`)
**Codebase Evidence:** `packages/core/src/platform/platform-plugin.ts:27` —
`ShimVariant = "terminating" | "non-terminating" | "bare"` (shipped in RD-07c); AR-69 names
the variants "terminating / non-terminating fall-through / bare" but spells the config key
`auto | terminating | minimal | bare`.
**The Problem:** RD-16 is faithful to AR-69's key spelling, but neither AR-69 nor RD-16
states the mapping config-`"minimal"` → core-`"non-terminating"`, nor that `"auto"` is
resolved (by the AR-69 CFG termination analysis) into a concrete `ShimVariant` before
reaching `PreambleOptions.shimVariant`. An implementer passing the config string through
verbatim gets a type mismatch or a silent wrong variant.

**Recommendation (single viable path):** Add a mapping note to R18/§4.2: `"minimal"`
selects core `ShimVariant "non-terminating"`; `"auto"` is resolved via the AR-69 analysis
and never reaches the plugin as-is. Considered and dropped: renaming either vocabulary —
AR-69 fixed the config spelling and `ShimVariant` is shipped, tested code.

**User Decision:** Resolved — user accepted the recommendation (2026-07-02)

---

### PF-006: Traceability contract contradicts the document's own contents (10 "Design" rows + 3 mis-cites) 🟡 MINOR

**Dimension:** 3 Logical Contradictions / 7 Testability
**Location:** RD-16 §2 traceability rule, AC-14; rows R3, R8, R9, R10, R19, R20, R22, R25, R28 ("Design"); R8, R21, R24 (mis-cites)
**Codebase Evidence:** AR-39 (register) defines include-tiers only — no `exclude` key and no
`node_modules` default (R8 cites AR-39); AR-37 is platform *ordering* — the
available-platforms error listing actually ships via RD-10 R29/R30
(`packages/platforms/src/registry.ts:42-51`), yet R21 cites AR-37; AR-77 is the
library-first commitment and says nothing about precedence, yet R24 cites it for
"overrides both".
**The Problem:** §2 says "Every decision below must cite the AR entry … or the frozen spec
section … No decision may be invented here", and AC-14 says "All decisions trace to an
`AR-NN` or a frozen spec section" — but 10 rows are sourced "Design" (a category the rule
doesn't admit; RD-15 uses the same convention in 8 rows), making AC-14 unsatisfiable as
written. Separately, three rows cite ARs that don't contain the cited decision.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Amend the §2 rule + AC-14 to admit "Design" as a documented third category, and fix the three mis-cites (R8 → "AR-39 (include) + Design (exclude)"; R21 → "RD-10 R29/R30 + Design"; R24 → "AR-77 + Design") | Proportionate; matches RD-15's existing practice; the Design rows are uncontroversial defaults | "Design" decisions stay outside the register's audit trail |
| B | Register the 10 design decisions as runtime ARs per the runtime-ambiguity protocol | Full register traceability | Heavy ceremony for defaults like `outDir: "./build/"`; the protocol targets genuine ambiguities, not settled conventions |

**Recommendation:** Option A — proportionate, and it also repairs RD-15's identical latent
AC problem when applied there.

**User Decision:** Resolved — user accepted the recommendation (2026-07-02)

---

### PF-007: Missing-`platform` behavior is unspecified (and `DEFAULT_PLATFORM` invites accidental defaulting) 🟡 MINOR

**Dimension:** 9 Edge Cases / 4 Completeness
**Location:** RD-16 R3, R6, §4.2 (`platform: string`, non-optional, no default), §4.3
**Codebase Evidence:** RD-15 R43 classifies "missing platform" as an exit-2 config error;
`packages/platforms/src/registry.ts:29` ships `DEFAULT_PLATFORM = "c64"` (an RD-10 R33
internal convenience, not a config default).
**The Problem:** R3/R6 say `platform` is required when absent from both config and CLI, but
the §4.3 algorithm never emits the missing-platform error, and `BlendConfig.platform` is a
non-optional `string` with no stated value for the not-provided case. It's also unstated
that the registry's `DEFAULT_PLATFORM` must NOT be consulted as a config default — an
implementer could reach for it and silently violate R6.

**Recommendation (single viable path):** Add to §4.3 (after step 5): if `platform` is still
unset → emit `E10xxx "no platform specified"` (config error, exit 2 per RD-15 R43) and
document `BlendConfig.platform` as validated non-empty; add a note that
`DEFAULT_PLATFORM` is a registry-internal convenience, never a config default. Considered
and dropped: making `platform` optional in the type — it would push null-checks into every
consumer for a value R6 declares mandatory.

**User Decision:** Resolved — user accepted the recommendation (2026-07-02)

---

### PF-008: Loader edge cases unspecified: explicit-path-not-found, non-object top level, `maxErrors` range, empty `include` 🟡 MINOR

**Dimension:** 9 Edge Cases
**Location:** RD-16 §4.3 steps 1–3, R12, R7
**Codebase Evidence:** `packages/core/src/diagnostics/diagnostic-bag.ts:104`
(`maxErrors ?? DEFAULT_MAX_ERRORS` — no range guard at the bag level, so validation must
happen in config).
**The Problem:** (a) `options.configPath` pointing to a nonexistent file — error or silent
defaults? (Discovery-miss = defaults per R3, but an *explicit* path that's missing should be
an error; unstated.) (b) A file whose top level is not an object (`[]`, `"x"`, `null`) —
step 3 validates keys, which presupposes an object. (c) `maxErrors: 0` / negative /
non-integer — R20 covers wrong *types* only. (d) `include: []` — matches nothing; error,
warning, or silently empty program?

**Recommendation (single viable path):** Add a validation-edge table to §4.3: explicit
`configPath` not found → `E10xxx` error; top-level non-object → `E10xxx` parse-shape error;
`maxErrors` must be an integer ≥ 1 → `E10xxx`; `include: []` → the config loader accepts it
(file-set emptiness is diagnosed by the RD-15 discovery tier, which owns "no source files").
Considered and dropped: leaving these to the implementation plan — they are contract
decisions, not implementation details.

**User Decision:** Resolved — user accepted the recommendation (2026-07-02)

---

### PF-009: AC-10 pulls glob *expansion* into a package scoped to carry glob *patterns* 🟡 MINOR

**Dimension:** 1 Ambiguities / 10 Scope Creep
**Location:** RD-16 AC-10; §2 scope ("locating, parsing, validating, and merging")
**Codebase Evidence:** File discovery is owned by the hosts: RD-15 R13 (CLI three-tier
strategy per AR-39) and RD-14 R38 (LSP `CompilerHost` per AR-40). No glob library exists as
a direct dependency anywhere in the workspace (`minimatch`/`tinyglobby` in `yarn.lock` are
transitive only).
**The Problem:** AC-10 — "The `include`/`exclude` glob patterns correctly select `.blend`
files" — is untestable inside `@blend65/config` as scoped: the package carries the patterns
but never expands them. It also implicitly demands a glob-library decision RD-16 never makes.

**Recommendation (single viable path):** Reword AC-10 to "the `include`/`exclude` values
are validated (array-of-string) and carried into `BlendConfig` verbatim for the RD-15/RD-14
discovery tier to expand". Considered and dropped: moving glob expansion into
`@blend65/config` — it would duplicate the AR-40 `CompilerHost` boundary and force a glob
dependency into a package both the CLI and LSP consume.

**User Decision:** Resolved — user accepted the recommendation (2026-07-02)

---

### PF-010: `outName` default is ambiguous, undeterminable at load time, and drifts from RD-15 🟡 MINOR

**Dimension:** 1 Ambiguities / 12 Consistency
**Location:** RD-16 R10 (§3.2) vs §4.1 (`"outName": ""` — "empty = auto"); RD-15 R21
**Codebase Evidence:** RD-15 R21: default "derived from the first source file **or project
name**" (drift from RD-16's "derived from first source file"); RD-13 determinism NFRs make
"first" ordering load-bearing.
**The Problem:** `loadConfig()` performs no file discovery, so it cannot "derive from the
first source file" — the actual load-time default is `""` with derivation deferred to the
build pipeline, which R10 doesn't say. "First source file" is itself undefined (first by
what ordering? glob-result order is not inherently deterministic). And the two RDs state
different fallbacks.

**Recommendation (single viable path):** R10 → "Default: `''` (= derive downstream)";
specify in RD-15 that derivation happens after discovery, from the first file in the
**sorted** file list (deterministic), and align RD-15 R21's wording with whichever fallback
chain is intended. Considered and dropped: deriving in `loadConfig()` — impossible without
file discovery.

**User Decision:** Resolved — user accepted the recommendation (2026-07-02)

---

### PF-011: `include`/`exclude` patterns are not constrained to the project root 🟡 MINOR

**Dimension:** 8 Security Blind Spots / 9 Edge Cases
**Location:** RD-16 R7/R8 (§3.2), §3.6
**Codebase Evidence:** RD-13 R37 — "The compiler reads from the project directory … It
never writes outside the project/output directory."
**The Problem:** Nothing forbids `include: ["/etc/**", "../../other/**"]`. Expanded by the
discovery tier, such patterns read files outside `projectRoot`, violating RD-13 R37's
scoped-file-system guarantee. Path canonicalization/`..`-rejection is a baseline input-
validation requirement.

**Recommendation (single viable path):** Add a validation rule to §3.6: `include`/`exclude`
entries must be relative patterns that resolve within `projectRoot`; absolute paths or
patterns escaping the root → `E10xxx` at load time. Considered and dropped: enforcing only
at discovery time (RD-15) — load-time rejection matches R22 and fails faster with a better
message.

**User Decision:** Resolved — user accepted the recommendation (2026-07-02)

---

### PF-012: Same code in both `warnAsError` and `suppressWarnings` — precedence undefined 🟡 MINOR

**Dimension:** 9 Edge Cases
**Location:** RD-16 R13/R14 (§3.4), §4.3 step 6
**Codebase Evidence:** RD-11 §4 `SeverityPolicy { warnAsError, promoteWarnings,
suppressWarnings }` + `applySeverityPolicy()` — no conflict rule defined there either;
AR-75 mandates one central layer but is silent on overlap.
**The Problem:** `{ "warnAsError": ["W10130"], "suppressWarnings": ["W10130"] }` is
accepted by the schema, and no document says which wins. The behavior would be decided
silently by implementation order inside `applySeverityPolicy`.

**Recommendation (single viable path):** Two-part fix: (1) RD-16 §4.3 step 6 emits a
`W10xxx` "code both promoted and suppressed" validation warning on overlap; (2) the
precedence itself belongs to RD-11/AR-75 — add "suppression wins over promotion" (the
conventional, least-surprising rule: an explicitly silenced code stays silent) to RD-11's
severity-policy section with a cross-reference. Considered and dropped: making the overlap
a hard error — over-strict for a forward-compatible config surface (R19 sets the tone:
tolerate, warn).

**User Decision:** Resolved — user accepted the recommendation (2026-07-02)

---

## OBSERVATION findings

### PF-013: `acmePath` + up-tree discovery = config-controlled code execution; RD-13 R35's "ACME is not user-controlled" is only true modulo `acmePath` 🔵 OBSERVATION

**Dimension:** 8 Security Blind Spots
**Location:** RD-16 R4 (walk-up discovery), R11 (`acmePath`)
**Codebase Evidence:** RD-13 R35: "The only executed external process is ACME (an
assembler, not user-controlled code)".
**The Problem (noted, not a defect):** A `blend65.json` in any ancestor directory (or a
cloned repo) chooses which executable the build runs. This is the same trust model as
`tsconfig.json`/npm scripts and is ecosystem-standard, but R11 should acknowledge that
`acmePath` is trusted input, and RD-13 R35's claim should be qualified.

**Recommendation:** Add a one-line trust-model note to R11 and qualify RD-13 R35
("…not user-controlled code beyond the configured `acmePath`").

**User Decision:** Resolved — user accepted the recommendation (2026-07-02)

---

### PF-014: The language-server → config dependency edge RD-16 §5 implies is not in the sanctioned package graph 🔵 OBSERVATION

**Dimension:** 5 Dependency Issues (future)
**Location:** RD-16 §5 RD-14 row ("the language server reads `blend65.json`")
**Codebase Evidence:** `packages/language-server/package.json:17-18` — deps are core +
frontend only; AR-20's diagram shows no language-server → config edge; the R15 boundary
test (`test/boundary.spec.test.ts`) forbids only codegen, so adding config is *permissible*
but currently unblessed.
**The Problem (noted, not a defect):** When RD-14 lands, the server needs `@blend65/config`
(or must re-implement JSONC loading). The edge should be added deliberately — AR-20's
layout and the CLAUDE.md dependency table updated — rather than appearing ad hoc.

**Recommendation:** No RD-16 change; carry a note into RD-14 planning to bless the
`language-server → config` edge explicitly.

**User Decision:** Resolved — user accepted the recommendation (2026-07-02)
