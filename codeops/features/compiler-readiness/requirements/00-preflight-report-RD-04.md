# Preflight Report: RD-04 Tiered Compiler, ACME and VICE Execution

> **Status**: ✅ PREFLIGHT PASSED — all 9 findings resolved
> **Iteration**: 3 (full re-scan after the first correction set; bounded re-scans after late corrections)
> **Artifact**: Single requirement at `RD-04-tiered-execution.md`
> **Starting Git Blob**: `600a832e176b71d32ae9b8a1cedb42e648303f34`
> **Passing Artifact Revision**: `sha256:71c9143c60605f53dad85c5b830bc1edeece3ba58a8c87365ef7c38f5ead8c3d`
> **Mode**: Auto-design
> **Root Invocation**: `preflight-rd04-20260821-01`
> **Last Updated**: 2026-08-21

## Audit Scope

- **Audit target**: `RD-04-tiered-execution.md`
- **Context only**: the compiler-readiness ambiguity register; RD-01 through RD-03 requirements,
  plans and closeouts; authoritative inventory and publications; readiness, compiler, CLI and
  test-harness APIs; CI; and repository instructions
- **Scope mode**: strict; no adjacent RD or implementation work was absorbed
- **Authorized modification set**: RD-04 plus this workflow-owned report and roadmap lifecycle
  surfaces
- **Domain lenses**: compiler/language, concurrent execution, data/publication evolution and
  security

## Codebase Context Summary

The current selected compiler-readiness release contains nine generator/oracle/transform bindings,
while all six RD-04 evidence-capability declarations remain in their required pre-binding `unbound`
state. The readiness package has no compiler, CLI or test-harness dependency. The compiler, CLI,
ACME and VICE surfaces are distinct; VICE exposes two loopback monitor protocols, requires explicit
shutdown, and accepts a bounded instruction count on its wire protocol.

RD-02 generated functions are semantic probes rather than programs: they have no `main`, some need
external parameters, and memory-read cases touch C64 VIC-II registers `$D020..$D022`. RD-03 keeps
expectations host-side and treats absent initial memory cells as oracle-unmodeled. CI installs ACME
but does not provide VICE, so real-emulator acceptance remains a required local tier and tool absence
must remain a readiness blocker.

## Summary

Dimension counts overlap because one finding may affect several dimensions.

| Dimension | Findings | Highest severity |
|---|---:|---|
| 1. Ambiguities | 4 | 🟠 Major |
| 2. Implicit assumptions | 6 | 🟠 Major |
| 3. Logical contradictions | 2 | 🔴 Critical |
| 4. Completeness gaps | 8 | 🔴 Critical |
| 5. Dependency issues | 1 | 🟠 Major |
| 6. Feasibility concerns | 4 | 🟠 Major |
| 7. Testability | 9 | 🔴 Critical |
| 8. Security blind spots | 2 | 🟠 Major |
| 9. Edge cases | 5 | 🟠 Major |
| 10. Scope creep | 2 | 🔴 Critical |
| 11. Ordering and sequencing | 3 | 🟠 Major |
| 12. Consistency | 3 | 🟠 Major |
| 13. Codebase alignment | 7 | 🔴 Critical |

| Severity | Count | Status |
|---|---:|---|
| Critical | 1 | Resolved and verified |
| Major | 8 | Resolved and verified |
| Minor | 0 | — |
| Observation | 0 | — |

## Findings

### PF-001: Runtime success quantified over an unimplemented population 🔴 CRITICAL

**Dimensions:** Logical Contradiction, Completeness, Testability, Scope Creep, Codebase Alignment<br>
**Location:** original feature overview and AC-2<br>
**Evidence:** the selected publication models nine rules; 2,103 inventory rules remain explicitly
unmodeled and RD-08 owns their expansion.

**Problem:** requiring runtime evidence for every mandatory runtime-semantic inventory rule made
RD-04 impossible without silently absorbing RD-08.

**Resolution:** RD-04 now closes execution only for the selected modeled mandatory-C64 population,
requires each selected `vice` rule to reach real execution, preserves all remaining blockers, and
states that completion is not RD-06 readiness.

### PF-002: Every-case execution contradicted bounded VICE selection 🟠 MAJOR

**Dimensions:** Logical Contradiction, Testability, Scope Creep, Consistency<br>
**Location:** original feature overview, AR-7 route requirement and acceptance criteria

**Problem:** one clause sent every case through every obligation while AR-7 required a bounded
expensive-tier subset.

**Resolution:** a deterministic pre-execution route plan sends every case through its cheapest
decisive tier and uses a revision-bound stratified selector for additional costly obligations. At
least one bounded case per selected modeled `vice` rule reaches ACME and VICE regardless of cheaper
success.

### PF-003: Generated probes were not executable or independently observable 🟠 MAJOR

**Dimensions:** Ambiguity, Implicit Assumption, Completeness, Feasibility, Testability, Edge Cases,
Codebase Alignment<br>
**Evidence:** RD-02 emits `scalarCase`/`memoryCase` functions without `main`; some require parameters.

**Problem:** the requirement omitted entry-point construction, complete arguments, separate
execution identity, collision-safe observation storage and completion ordering. Its expected-value
wording could also embed the oracle in the executable.

**Resolution:** valid cases receive a closed revisioned envelope with `main(): void`, complete
recorded arguments, separate identity, collision-proven actual-value storage and a completion-last
marker. Expectations remain host-side; invalid cases are never wrapped.

### PF-004: Diagnostic comparison omitted required compiler phase 🟠 MAJOR

**Dimensions:** Implicit Assumption, Completeness, Testability, Consistency, Codebase Alignment<br>
**Problem:** code and severity alone could accept a diagnostic from the wrong pipeline phase, while
RD-03's reviewed projection requires phase.

**Resolution:** diagnostic evidence compares directly observed code, compiler phase and severity
and proves absence of IL, assembly and executable output. Phase may not be inferred from expected
metadata.

### PF-005: Failure categories overlapped and lacked stable identities 🟠 MAJOR

**Dimensions:** Ambiguity, Completeness, Testability, Edge Cases, Ordering<br>
**Problem:** simultaneous failures could produce different labels between runs, and unavailable
tools were not cleanly separated from failed launches.

**Resolution:** RD-04 defines a closed discriminated stage/result machine, stable stage-scoped
codes, first-terminal-stage precedence and deterministic budget precedence. Tool absence is
`tier-unavailable`; discovered-process failure belongs to its execution stage.

### PF-006: Route bindings lacked authoritative atomic publication semantics 🟠 MAJOR

**Dimensions:** Implicit Assumption, Completeness, Dependency, Testability, Ordering, Consistency,
Codebase Alignment<br>
**Evidence:** evidence declarations and handler declarations are separate; current binding validation
expects a declaration's published binding state, while all six evidence capabilities remain unbound.

**Problem:** ephemeral route bindings could disagree with immutable compiler-readiness authority.
The first correction still left the parent's six unbound blockers visible after child resolution.

**Resolution:** one reviewed content-addressed child execution publication references an exact
immutable parent digest and is selected atomically. Composite resolution treats parent `unbound` as
the required pre-binding state and clears exactly the blockers backed by accepted child bindings;
parent-only, missing, stale and rejected children fail closed. Historical four- and nine-binding
parents remain byte-identical.

### PF-007: VICE endpoint and crash ownership were not recoverable 🟠 MAJOR

**Dimensions:** Ambiguity, Implicit Assumption, Completeness, Feasibility, Testability, Security,
Edge Cases, Ordering, Codebase Alignment<br>
**Evidence:** VICE uses two loopback monitor endpoints and current cleanup requires a live caller to
invoke shutdown; the readiness package already demonstrates PID/token-based dead-owner locking.

**Problem:** concurrent campaigns, killed owners, PID reuse and the spawn-before-child-record window
could leave an orphan emulator, reclaim the wrong owner or permanently strand the lease.

**Resolution:** the lease uses checksummed generations, boot/session and process-start identities,
owner nonce, durable pre-launch child token, atomic fencing and immediate pre-signal revalidation.
It never identifies a child by PID/port/command substring alone. Ambiguity retains the lease and
returns stable `emulator-lease-recovery-blocked`; unsupported hosts fail closed.

### PF-008: Numerically safe budgets were operationally unbounded 🟠 MAJOR

**Dimensions:** Ambiguity, Implicit Assumption, Completeness, Feasibility, Testability, Security,
Edge Cases, Codebase Alignment<br>
**Problem:** JavaScript safe integers still permit effectively infinite waits, captures and monitor
chunk counts. Retry multiplication and retained metadata could evade nominal caps.

**Resolution:** a versioned identity-bound policy defines finite maxima for wall time, output,
instructions, cycles, attempts and retained evidence. The route deadline dominates all stages and
cleanup; counters are cumulative across retries; monitor chunks stay in `1..65535`; stdout/stderr
are continuously drained with deterministic bounded evidence; every serialized artifact counts
toward the cap; overflow cannot publish partial success.

### PF-009: Runtime reads lacked initial machine-state authority 🟠 MAJOR

**Dimensions:** Ambiguity, Implicit Assumption, Completeness, Feasibility, Testability, Edge Cases,
Codebase Alignment<br>
**Evidence:** current `peek`/`peekw` cases read `$D020` or start at `$D021`; the oracle returns
unmodeled when any cell is absent, and C64 color-register readback is not ordinary RAM behavior.

**Problem:** output observation was defined, but the initial semantic input was neither established
in VICE nor supplied identically to RD-03. The first correction also omitted `$D022`, the high byte
of `peekw($D021)`.

**Resolution:** every stateful executable case has a closed identity-bound initial-machine-state
fixture, established and verified before each attempt and evaluated identically by RD-03. The
current target profile covers every touched cell `$D020..$D022`, defines address-relative
little-endian word reads, and becomes authoritative only after real-VICE proof for all registers and
both word-read starts. Unknown semantics remain oracle-unmodeled.

## Decisions and Hardening

All nine corrections are internal execution, evidence, concurrency, security and compatibility
mechanisms within the approved RD-04 behavior. They were therefore eligible for the user's
`--auto-design` delegation. Authority, evidence, rejected alternatives, counterarguments, policy
version and reopen triggers were recorded during the audit.

The first independent challenger converged on PF-001 through PF-008 and strengthened stable failure
identity. A second, late-finding challenger required stronger process fencing, cumulative resource
accounting and the `$D022` projection; all corrections were applied. Its final verdict was **PASS**
with high confidence in the requirements contract. Implementation must still prove supported-host
process identity and real-VICE projection acceptance.

Rejected alternatives included absorbing RD-08, running every case in VICE, embedding expectations,
mutating publication-v1, a persistent VICE broker, PID-only orphan cleanup, identity-free budget
overrides and changing RD-02's established probe addresses.

## Iteration Verification

| Iteration | Result |
|---|---|
| 1 | Five canonical clusters completed the 13-dimension scan; 1 critical and 7 major findings merged. |
| 2 | Full 13-dimension re-scan reopened PF-006, PF-007 and PF-008 and raised PF-009. |
| 3 | Bounded re-scans verified PF-006 through PF-009; independent challenger refinements were applied and confirmed clean. |

## Verdict

✅ **PREFLIGHT PASSED** — all 9 findings are resolved, every dimension has been re-scanned, no
critical or major finding remains, and no scope expansion was accepted.
