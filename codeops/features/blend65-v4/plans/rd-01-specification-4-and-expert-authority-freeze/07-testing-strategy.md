# Testing Strategy: Specification 4.0 and Expert Authority Freeze

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

RD-01 changes Markdown authorities and qualification evidence, not executable compiler code. Tests
therefore use implementation-blind Markdown oracle files, exact direct checks, isolated expert
evaluation, and independent grading. No compiler, ACME, VICE, readiness, emulator, or unrelated
repository test command is in scope. See AR-P3 and AR-P4.

### Coverage Goals

| Artifact type | Target |
|---|---|
| Normative path/identity/crosswalk sets | 100% exact membership and fields |
| Changed semantic/platform/diagnostic/Guard areas | 100% of RD-01 AC-06–AC-18 |
| Expert cases | All 107 existing IDs plus every required new AR-046 ID |
| Activation/freeze/deferral records | 100% required fields and negative controls |

Test names state observable authority behavior. End-to-end compiler execution is N/A because RD-01
explicitly excludes implementation; the end-to-end authority lifecycle is covered by ST-34–ST-40.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> These cases derive only from RD-01, its cited v4 AR decisions, and resolved AR-P1–AR-P6. They are
> written before candidate content and are immutable. A candidate that disagrees is wrong; do not
> weaken the case. During execution, the spec-test author receives these rows without candidate
> implementation content.

### Authority, Inventory, and Identity

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-01 | Run bootstrap checks from any directory/branch/ancestry other than the exact Phase 0 handoff, or with a changed parked v3 worktree. | The phase stops before editing `spec/` or the skill and records the mismatched fact. | RD-01 R1.1, AC-01; AR-P1 |
| ST-02 | Run bootstrap checks in the recorded v4 worktree with the recorded source commit, P3 identity, skill v1.0, and content commit. | Every input authority matches and `08-closeout.md` records the fresh evidence; current compiler behavior is absent from the authority list. | RD-01 R1.1, AC-01 |
| ST-03 | Compare inventory rows with all retained `spec/**/*.md` paths; inject one duplicate, one undeclared file, one missing path, one unknown role, and one `../` path separately. | The valid inventory has exact one-row membership; every mutation fails with its specific set/role/path defect. | RD-01 R1.2–R1.3, AC-02–AC-03; AR-P5 |
| ST-04 | Normalize the one fixed identity field in every inventory-marked normative file, derive the digest, stamp it, and recompute; then mutate the field label, duplicate it, alter one normative byte, and alter one non-normative byte separately. | The stamped candidate reproduces `BLEND65-SPEC-4-<64hex>`; malformed/multiple fields fail; a normative-byte change changes the identity; a non-normative-byte change leaves the Spec identity unchanged but changes its raw closeout hash. | RD-01 R1.4, AC-05, AC-25; AR-P5 |
| ST-05 | Compare all P3 normative paths and all Spec 4 additions with `08-closeout.md` crosswalk rows; delete and duplicate one row separately. | The unmodified crosswalk has exactly one complete row per required source/addition and all required fields; either mutation fails. | RD-01 R1.5, Required transition crosswalk, AC-04; AR-P6 |
| ST-06 | Inspect the feature index and closeout after transition. | The index is a concise non-normative retained/changed/removed navigation table; the closeout contains, rather than duplicates elsewhere, the full crosswalk, raw hashes, approval, freeze, future constraints, findings result, and deferral answer. | RD-01 R1.26, Freeze and change control; AR-P6 |

### Core Language Reconciliation

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-07 | Check positive and invalid examples for ordinary three-clause `for`, omitted clauses, increasing/decreasing word induction, byte wrap-before-termination, `continue`, `break`, return, and side effects. | Grammar admits only the approved three-clause form; ordering is explicit; the provably impossible finite-looking byte case has its owned diagnostic; intentional modular loops remain legal; old range syntax is absent. | RD-01 R1.6, AC-07; AR-002, AR-003 |
| ST-08 | Resolve module, parameter, function-body, child-block, `for` header/body, nested-loop, and sibling same-spelling bindings, including lookup inside a shadowing initializer. | Every binding resolves to the specified stable declaration identity; legal nested shadowing is silent; same-scope/reserved duplicates fail; E10101 is retired/reserved; manual renaming preserves behavior/resources. | RD-01 R1.6, AC-07; AR-003 |
| ST-09 | Evaluate fixed-width arithmetic at wrap boundaries and direct array subscripts containing every integer-producing operator, explicit narrow casts, typed narrow assignments, and completed calls. | Ordinary fixed-width values wrap deterministically; the direct unbarriered ordinal context promotes as specified; every explicit/earlier narrow barrier retains the narrowed result. | RD-01 R1.6–R1.7, AC-07–AC-08; AR-002, AR-016–AR-017 |
| ST-10 | Check fixed arrays below/at/above extent 255, nested rectangular initializers, exact copies/returns, outer-unsized parameters, queries, and dynamic/jagged/view declarations. | Valid fixed arrays retain exact contiguous shape and word query results; only the parameter outer extent may be unsized; unsupported dynamic/jagged/view forms fail with owned diagnostics. | RD-01 R1.7, AC-08; AR-016–AR-017 |
| ST-11 | Assign and return fixed structs/arrays through direct construction, overlapping/aliased copies, nested calls, and caller-owned destinations. | Value semantics and effect order are exact; caller-owned hidden destinations are required through SFA; alias-safe behavior is defined; no heap or generic runtime is introduced. | RD-01 R1.8, AC-09; AR-018–AR-019 |
| ST-12 | Take addresses of parameters, fields, elements, and locals through single-evaluation expressions; copy/derive local addresses and attempt each allowed contained use and prohibited escape. | Address evaluation occurs once; provenance/const/lifetime rules are explicit; contained use extends liveness; return, longer-lived publication, retaining/unknown calls, and opaque escape fail at the first possible escape. | RD-01 R1.9, AC-09; AR-015, AR-019 |

### Closed Program and Effect Semantics

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-13 | Form, store, return, widen, compare, erase, and call function values with singleton, finite multi-target, mismatched-signature, handler-kind, raw-word, and unbounded target sets. | Precise finite sets are callable and retain eligible direct/devirtualized lowering; mismatches, raw calls, and genuinely unbounded targets fail; erasure to `word` removes callability. | RD-01 R1.10, AC-10; AR-021–AR-022 |
| ST-14 | Install/restore handlers per sink through nested LIFO paths, joins, bounded nesting, raw vector writes, and helper restoration. | Balanced per-sink ownership and exact predecessor-word/static costs are defined; raw mutation invalidates helper ownership; unbalanced, unbounded, mismatched, or invalidated restores fail. | RD-01 R1.10, AC-10; AR-021–AR-022 |
| ST-15 | Evaluate `sin8`/`cos8` over the complete byte domain and `sin16`/`cos16` at the specified boundary vectors using the recorded reproducible rule. | Every byte input and every required word vector has one deterministic exact result on Linux and Windows. | RD-01 R1.11, AC-11; AR-026, AR-030 |
| ST-16 | Meter reduced-limit expressions, statements, loops, calls, aggregate bytes, short-circuit branches, alias/copy cases, shared roots, cache-equivalent work, and depths 512/513 at N and N+1. | The three production constants and pre-operation charging rules yield exact deterministic success/failure; exhausted work poisons the root and emits no output; forbidden effects fail. | RD-01 R1.11, AC-11; AR-026, AR-030 |
| ST-17 | Apply every `place(...)` key alone and in valid combinations, then use illegal target, collision, unsatisfied region, and conflicting constraints. | Valid constraints have one exact merge/placement meaning; invalid or unsatisfied constraints fail with the owned diagnostic and no silent relocation rule. | RD-01 R1.12, AC-12; AR-020, AR-029 |
| ST-18 | Use a `loadable const` at compile time, attempt direct runtime read/address/pass, load into compatible/incompatible destinations, branch on success/failure, mutate aliases/indexes, repeat/overlap loads, and join flow. | Compile-time use is legal; runtime access needs proven successful publication; exact captured ranges govern initialization/must-alias facts; failure invalidates only the affected range; unselected candidates retain incoming state; no runtime validity state exists. | RD-01 R1.12, AC-12; AR-020, AR-029, AR-031 |
| ST-19 | Compare the intrinsic inventory with `asm_sei`, `asm_cli`, `asm_php`, `asm_plp`, `asm_nop`; try any other opcode-shaped name, inline assembly, external assembly function, and `POKE(variableAddress,value)`. | Exactly the five `asm_*` operations are admitted with complete effects/costs; all other assembly surfaces fail; variable-address `POKE` remains legal and volatile ordered. | RD-01 R1.13, AC-13; AR-006 |
| ST-20 | Divide/index with constant-invalid, runtime-invalid checked, and runtime-invalid unchecked inputs under each independent build option. | Constant invalidity fails at compile time; enabled checks have exact inline/profile behavior and cost; disabled behavior follows the stated hardware limitation; no hidden trap/runtime is mandatory. | RD-01 R1.14, AC-14; AR-002, AR-023 |

### C64 Authority, Guard, and Diagnostics

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-21 | Compare the normative target inventory with the eight `c64-{pal|ntsc}-prg-{kernal|takeover}-{6581|8580}` identities plus `c64-pal-d64-kernal-6581`. | Set equality passes for exactly nine profiles; `c64-pal-prg-kernal-6581` is first; CPU/video/startup/banking/IRQ/SID/artifact/exit/loader fields are complete and consistent. | RD-01 R1.15, AC-15; AR-013, AR-024, AR-032, AR-035 |
| ST-22 | Search the normative inventory and active target IDs for C64U, X16, Atari 800XL, Atari 7800, unknown IDs, and the four prior appendices. | All are absent as normative/selectable targets; retained future text is explicitly non-normative, unqualified, and non-supporting. | RD-01 R1.16–R1.18, AC-16; AR-024, AR-035 |
| ST-23 | Compare native asset entries with SPD v5, CTM v9, the approved PSID subset, classic Koala, and raw fallback; feed Koala Color RAM/background bytes with nonzero high nibbles. | The set is exact; full Koala bytes are accepted and preserved while only low nibbles have VIC-II color meaning. | RD-01 R1.15, AC-15; AR-039–AR-041 |
| ST-24 | Inspect the D64 profile for standard 35-track geometry, directory/BAM/data chains, boot-device reuse, `SETLFS`/`SETNAM`/relocating `LOAD`, quiescence, success/failure publication, trusted-media boundary, and a longer replacement file. | Every required contract and resource effect is explicit; `HLE-010` states stock `LOAD` cannot contain the longer replacement before returned-end validation; no fastloader/plugin framework is claimed. | RD-01 R1.15, AC-15; AR-042–AR-044 |
| ST-25 | Search C64 normative modules and expert-facing summaries for compiler-supplied game loops, renderers, collision, scenes, sprite multiplexers, scrolling, buffering, audio scheduling/mixing, or gameplay policy. | No such API/product claim remains; hardware operations and exact external adapters remain, while application policy is user-authored Blend65. | RD-01 R1.15, R1.21, AC-15, AC-19; AR-038 |
| ST-26 | For every changed feature, compare recorded Guard results with the 23 rule IDs; inject one missing, failed, and condition-without-authority result. | The valid set has all 23 results and no failures; each condition cites authority; each mutation blocks the candidate. | RD-01 R1.19, AC-17; AR-014, AR-035 |
| ST-27 | Compare invalid classes and normative owners with the diagnostic registry; duplicate a code, omit an owner, unretire E10101, conflate E10267/E10268, and omit E10269–E10271/load invalidation separately. | The valid registry has unique live/retired ownership, examples, templates, and corrections; every mutation fails the integrity check. | RD-01 R1.20, AC-18; AR-002, AR-003, AR-031 |
| ST-28 | Search active normative and expert files after candidate reconciliation for active Spec 3, expert v1.0, five-target support, obsolete range loops, and current aggregate-return rejection as law. | No stale active claim remains; historical evidence is labelled historical and cannot override Spec 4. | RD-01 AC-05, AC-19 |

### Expert Candidate

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-29 | Route representative language, compiler/SFA, optimization, C64 hardware, assets/D64, evidence, and future-target questions through the candidate. | `SKILL.md`/metadata identify v2.0 and the same Spec 4 identity; each prompt selects the minimum correct reference set with no v1.0/P3 authority leak. | RD-01 R1.21, AC-19 |
| ST-30 | Ask for a game loop, renderer, sprite multiplexer, collision system, double buffer, scene runtime, or audio mixer as a Blend65 built-in. | The candidate explains how users can implement/optimize the workload but does not invent a compiler/platform-library policy API; asset guidance stops at the authorized boundary. | RD-01 R1.21, AC-19; AR-038 |
| ST-31 | Inspect optimizer knowledge for `none`, `balanced`, `speed`, `size`, B/R/T definitions/order, hard budgets, finite frontier/fixed point/search, required modern/6502/C64 technique families, and per-technique proof/cost/oracle fields. | Every required item exists and is internally consistent; D64 container bytes are excluded from B/R/T preference; no weights, PGO, tuning DSL, broad pass framework, or borrowed architecture appears. | RD-01 R1.21, AC-19; AR-045, AR-046 |
| ST-32 | Resolve every changed C64/D64/KERNAL/Koala/optimizer factual claim to source-manifest keys; inject one missing, stale, or unsupported key. | Valid claims resolve to admissible primary/project authority with exact scope; each mutation blocks qualification rather than becoming inferred knowledge. | RD-01 R1.21, AC-19; AR-034, AR-039–AR-046 |
| ST-33 | Derive unique case IDs/eleven fields across all casebooks before and after candidate changes. | All 107 existing IDs remain exactly once; every required AR-046 case is added or an existing owning case is strengthened; no expectation is weakened and every case has eleven fields. | RD-01 R1.22, AC-20; AR-046, AR-P3 |

### Qualification, Activation, and Freeze

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-34 | Run formatting, packaging smoke, set equality, fields, links/anchors, source keys, topology, identity/hash, crosswalk, Guard, diagnostics, and evidence checks on the candidate; run each required negative mutation. | All positive checks pass and each negative control fails for its intended reason before model evaluation begins. | RD-01 R1.22–R1.23, AC-20–AC-23; AR-P4 |
| ST-35 | Give an evaluator only the allowlisted candidate packet for one complete blind sample; try a permitted packet read and a repository-path read; give the oracle only to the grader. | All cases produce recorded outputs/grades; packet read succeeds, repository read fails, and no evaluator sees the oracle or repository. | RD-01 R1.22, AC-20–AC-21; AR-P3 |
| ST-36 | Introduce one knowledge/oracle defect and one evaluator-only omitted answer in separate controlled trials. | The defect invalidates affected/dependency-traced evidence and requires repair, independent re-review, focused reruns, and a regression; the omission may receive only a fresh response capture. | RD-01 R1.22; AR-P3 |
| ST-37 | Complete independent changed-surface and blast-radius review with one critical/major finding, then with none unresolved. | The first state blocks qualification; only the zero-critical/major state can reach the content checkpoint. | RD-01 R1.22–R1.23, AC-21 |
| ST-38 | Attempt to change the active release record before presenting evidence or without a fresh explicit user approval. | Activation is blocked and v1.0 remains the sole active release; plan/requirements acceptance is not treated as release approval. | RD-01 R1.24, AC-24; AR-P6 |
| ST-39 | After explicit approval, bind the exact immutable candidate commit and Spec identity in the sole release record; mutate one candidate byte during the release tail. | The unmodified tail activates exactly v2.0 and passes hashes/topology; the mutation invalidates activation and returns to qualification. | RD-01 R1.23–R1.24, AC-22, AC-24; AR-P3, AR-P6 |
| ST-40 | At closeout, compare raw spec/skill hashes and all deferrals with their current rationales; remove one rationale without assigning an owner. | Exact freeze hashes reproduce and `spec/` is unchanged; every expired deferral has a named owner; the ownerless mutation blocks RD-01 closeout and RD-02. | RD-01 R1.25, AC-25–AC-26; AR-P6 |

## Test Categories

### Specification Tests

> Written before each implementation phase. Files are immutable after their RED result.

| Test file | ST cases covered | Component |
|---|---|---|
| `tests/bootstrap-authority.spec.test.md` | ST-01–ST-02 | Bootstrap and input authority |
| `tests/identity-freeze.spec.test.md` | ST-03–ST-06 | Inventory, identity, crosswalk, closeout |
| `tests/core-language.spec.test.md` | ST-07–ST-12 | Core semantics |
| `tests/closed-program-semantics.spec.test.md` | ST-13–ST-20 | Whole-program/effect semantics |
| `tests/c64-guard-diagnostics.spec.test.md` | ST-21–ST-28 | C64, Guard, registry |
| `tests/expert-authority.spec.test.md` | ST-29–ST-33 | Expert v2.0 candidate |
| `tests/qualification.spec.test.md` | ST-34–ST-37 | Qualification and review |
| `tests/activation-freeze.spec.test.md` | ST-38–ST-40 | Release, approval, and freeze |

### Implementation Tests

> Written only after the corresponding candidate content is green.

| Test file | Description | Priority |
|---|---|---|
| `tests/bootstrap-authority.impl.test.md` | Worktree, ancestry, source, and parked-tree records | High |
| `tests/identity-freeze.impl.test.md` | Inventory, identity, crosswalk, and mutation results | High |
| `tests/core-language.impl.test.md` | Grammar, examples, diagnostics, stale syntax, links | High |
| `tests/closed-program-semantics.impl.test.md` | Effect/resource/flow/diagnostic consistency | High |
| `tests/c64-guard-diagnostics.impl.test.md` | Exact target/asset/Guard/diagnostic sets | High |
| `tests/expert-authority.impl.test.md` | Topology, fields, source keys, product boundary | High |
| `tests/qualification.impl.test.md` | Isolation, grades, review, hashes, and negative controls | High |
| `tests/activation-freeze.impl.test.md` | Approval, allowlist, release, raw hashes, and deferrals | High |

### Integration Tests

| Test | Components | Description |
|---|---|---|
| Spec authority closure | Inventory, clauses, grammar, diagnostics, Guard | ST-03–ST-28 pass against one candidate identity |
| Expert binding closure | Router, references, cases, coverage, sources | ST-29–ST-37 pass against that same identity |
| Atomic authority activation | Candidate commit, release record, closeout, roadmap | ST-38–ST-40 prove approval and no content drift |

### End-to-End Tests

| Scenario | Steps | Expected result |
|---|---|---|
| Authority lifecycle | Verify bootstrap → reconcile/freeze Spec → reconcile/qualify expert → request approval → activate/freeze | One Spec 4 identity and expert v2.0 content commit are active; all evidence is reproducible; RD-02 is unblocked |
| Compiler execution | N/A | Excluded by RD-01; implementing a harness would violate AR-P1/AR-P3 |

## Test Data

### Fixtures Needed

- Frozen P3 path/hash manifest and active expert v1.0 topology/case inventory.
- The exact Phase 0 branch/worktree/source facts.
- Small positive and negative Markdown snippets embedded in the spec-test case records.
- Isolated candidate packets and evaluator/grader outputs for qualification.

### Mock Requirements

No mocks. Direct filesystem data and real model evaluation are used. The evaluator sandbox is an
isolation boundary, not a mock.

### Security and Trust Boundary

Authentication, rate limiting, TLS, database encryption, web output, and container hardening are
N/A because this RD creates no service, endpoint, credential flow, database, or infrastructure.
Path containment, undeclared-file rejection, shell-safe NUL-delimited hashing, source-key validation,
and evaluator repository isolation are required by ST-03, ST-04, ST-32, ST-34, and ST-35.

## Verification Checklist

- [ ] All ST cases exist verbatim in their `*.spec.test.md` file before candidate edits.
- [ ] Each phase records an intentional RED result against the P3/v1.0 or pre-activation baseline.
- [ ] Candidate content makes every applicable ST case green without changing its expectation.
- [ ] Every `*.impl.test.md` file contains positive and required negative-control evidence.
- [ ] All 107 existing expert case identities plus new required cases have applicable green evidence.
- [ ] Independent review has zero unresolved critical or major finding.
- [ ] The final command log contains no excluded compiler/emulator/readiness command.
- [ ] The release tail changes no qualified candidate byte.
