# Current State: RD-04 Language Completion

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

RD-03 provides one working four-package TypeScript 7 compiler/tooling graph. The public compiler
service loads a deterministic project snapshot, runs the shared frontend, lowers a target-neutral
program, closes SFA storage, lowers and validates NMOS machine operations, lays out a C64 PRG,
assembles it with ACME, creates evidence sidecars and publishes atomically. The M1 example passes a
complete generated-versus-expert VICE journey.

The compiler already contains typed scalar and partial aggregate representations, explicit semantic
blocks and effects, whole-program closure, deterministic storage allocation, structured machine
operations, branch repair, ACME serialization, layout and evidence validation. These are the seams
RD-04 extends; none is replaced (AR-P8).

### Relevant Files

| File | Purpose | Changes Needed |
|---|---|---|
| `packages/compiler/src/frontend/lexer.ts` | UTF-8 tokenization and spans | Complete the frozen token/literal/diagnostic inventory |
| `packages/compiler/src/frontend/parser.ts` | Parser orchestration and several declarations/types | Remove pending syntax and extract touched responsibilities before growth |
| `packages/compiler/src/frontend/statements.ts` | Statement parsing | Complete `for`, switch, jumps and recovery |
| `packages/compiler/src/frontend/semantic-types.ts` | Typed frontend payload | Add enums, function types, callable/provenance/domain and complete aggregate facts |
| `packages/compiler/src/frontend/analyzer.ts` | Declaration/body analysis | Complete scopes, types, effects and diagnostics; split touched responsibilities |
| `packages/compiler/src/semantic/operations.ts` | Target-neutral operations and CFG | Carry complete places, calls, aggregates, checks, machine-state effects and domains |
| `packages/compiler/src/semantic/whole-program.ts` | Roots, call graph, liveness and recursion | Add finite indirect targets, domains, retaining summaries and complete roots |
| `packages/compiler/src/storage/` | SFA inventory, interference, allocation and closure | Add every ABI home, domain instance, helper/scratch feedback and proof record |
| `packages/compiler/src/machine/` | Structured NMOS lowering and validation | Complete legal `none` sequences for every admitted semantic operation |
| `packages/compiler/src/layout/` | C64 layout/startup | Honor complete placement, entry variants and final resource reconciliation |
| `packages/compiler/src/artifacts/` | ACME and evidence sidecars | Populate complete type, ABI, SFA, cost, memory and debug evidence |
| `packages/cli/src/` | `check`, `build`, `run` | Preserve the shared compiler result and expanded diagnostics |
| `packages/language-server/src/` | Shared frontend diagnostics | Preserve byte-identical frontend behavior without backend imports |
| `test/m1/` | Public-pipeline and VICE precedent | Reuse the bounded subprocess/monitor protocol, not the M1 behavior oracle |

### Code Analysis

- `parser.ts`, `analyzer.ts`, `semantic/lower.ts` and `machine/lower.ts` are already above the
  project's approximate 700-line split point. AR-P8 requires a local responsibility split when a
  phase touches them.
- `syntax.ts` still exposes `UncheckedSyntax`; the parser retains function types, declarations and
  `for` loops as pending regions.
- Aggregate analysis explicitly defers whole assignment, return ABI, unsized parameter ABI and
  non-scalar nested layout.
- Direct calls defer aggregate argument and return handling. Function values and interrupt domains
  are not represented by the current `SemanticType` union.
- Current semantic operations cover direct calls and basic aggregates but lack indirect-call target
  sets, caller-owned return destinations, explicit safety stops, CPU controls and execution-domain
  entry variants.
- The public build service already enforces the desired successful path: analyze, close storage,
  lower, layout, serialize, assemble, reconcile evidence and publish. RD-04 must keep every error
  terminal before publication.

## Gaps Identified

### Gap 1: No complete authority accounting

**Current Behavior:** Tests cover implemented slices, but no artifact proves every normative
production, named rule, active diagnostic and applicable conformance clause has an owner.

**Required Behavior:** RD-04 R4.2 and AC-02 require complete checked accounting.

**Fix Required:** Add the single static crosswalk and direct validator approved by AR-P6.

### Gap 2: Frontend still accepts pending regions

**Current Behavior:** Several valid Specification 4 forms become non-diagnostic implementation
obligations and cannot reach code generation.

**Required Behavior:** Every form either succeeds through its applicable pipeline or emits its
authoritative public diagnostic.

**Fix Required:** Remove `UncheckedSyntax` family by family while keeping poison and bounded
recovery terminal.

### Gap 3: Semantic payload is incomplete

**Current Behavior:** Scalar and partial aggregate facts exist, but function values, caller-owned
aggregate results, address provenance, conditional memory correlation, compile-time execution and
interrupt domains are incomplete.

**Required Behavior:** Preserve each RD-04 R4.37 fact until its named consumer discharges it.

**Fix Required:** Extend the smallest existing typed/semantic records; add no generic IR framework.

### Gap 4: ABI and SFA cover only the M1 slice

**Current Behavior:** Direct scalar calls and existing machine scratch close correctly, but the full
aggregate, indirect-call, interrupt-domain and compile-time obligations are absent.

**Required Behavior:** One explicit ABI family and final storage closure for every reachable home.

**Fix Required:** Add exact ABI records and feed all new homes through the existing inventory,
interference, allocation and closure loop.

### Gap 5: `none` lowering and evidence are incomplete

**Current Behavior:** The current backend emits legal M1 operations but still returns unsupported
results for unimplemented semantic cases.

**Required Behavior:** Every admitted core-language case has a deterministic legal NMOS sequence,
complete cost/resource effects and ACME/VICE proof where runtime behavior applies.

**Fix Required:** Complete direct selection and helper contracts without optional search or
peepholes (AR-P4).

## Dependencies

### Internal Dependencies

- RD-01 frozen Specification 4 identity and expert baseline 2.0.0.
- RD-02 deterministic project snapshot and host/process safety.
- RD-03 connected compiler, artifact publication, ACME and VICE path.
- Later RD-05 through RD-09 capability ownership, used only for honest unavailable diagnostics.

### External Dependencies

- Node 22 and Yarn 1.
- TypeScript 7 and Vitest.
- ACME 0.97 for terminal assembly.
- VICE 3.10 `x64sc` for Linux C64 runtime qualification.
- Native Windows access during RD-10 only (AR-P5).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A language distinction is erased before lowering | High | High | Transition probes and component contracts preserve R4.37 facts |
| A late helper invents storage after closure | Medium | High | Closure certificate rejects or re-closes every new demand |
| Aggregate aliasing corrupts source or result | Medium | High | Caller-owned destination plus overlap-safe snapshot/copy cases |
| Interrupt entry variants share unsafe homes | Medium | High | Explicit domains, sink-selected roots and interference proof |
| `none` becomes a hidden optimizer | Medium | High | Direct predefined selections and empty decision evidence (AR-P4) |
| Qualification grows into a framework | Medium | Medium | One static crosswalk and existing Vitest/VICE topology (AR-P6, AR-P7) |
| Oversized central files become harder to change | High | Medium | Split only touched >700-line responsibilities (AR-P8) |
| Native host equality remains unexecuted | Certain until RD-10 | Medium | Pure deterministic cases now; explicit deferred native run (AR-P5) |
