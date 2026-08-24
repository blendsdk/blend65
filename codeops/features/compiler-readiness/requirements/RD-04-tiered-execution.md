# RD-04: Tiered Compiler, ACME and VICE Execution

> **Document**: RD-04-tiered-execution.md
> **Status**: Complete
> **Created**: 2026-07-23
> **Amended**: 2026-08-24 — implemented, independently reviewed, selected and closed
> **Project**: Compiler Readiness
> **Depends On**: RD-02, RD-03
> **CodeOps Artifact Schema**: 1

## Feature Overview

Execute the cases supported by the selected RD-02/RD-03 publication through deterministic,
capability-defined evidence routes. Every case receives a route plan before execution: all cases
reach their cheapest decisive tier, while a versioned stratified selector chooses bounded cases
for higher-cost obligations. Every modeled, mandatory-C64 rule with a `vice` obligation must have
at least one selected case reach real assembled C64 execution. Invalid diagnostic cases prove the
exact reviewed diagnostic projection and absence of executable output.

RD-04 establishes execution evidence for the currently selected modeled population. Rules that
remain unmodeled, not generatable, oracle-unmodeled or capability-unbound remain explicit blockers;
RD-04 completion is not an RD-06 readiness claim. RD-08 expands the same execution invariant to the
remaining C64 denominator.

## Functional Requirements

### Must Have

- [x] Support capability-defined tiers `frontend`, `compiler-api`, `cli`, `emit`, `acme` and
  `vice`, with a closed versioned execution-capability registry. Unknown tiers fail validation;
  future tiers require an explicit compatible version or migration. (AR-7)
- [x] Bind all six executable routes to their RD-01 capability declarations with content-derived
  implementation revisions. Reject unreviewed, undeclared, duplicate, stale and
  contract-incompatible bindings.
- [x] Publish route bindings as one independently reviewed, content-addressed execution
  publication that references one exact immutable compiler-readiness publication digest. Select
  it atomically, resolve capabilities only through its opaque snapshot, and preserve the prior
  selection on validation, review, staging or commit failure. Existing four-binding and
  nine-binding compiler-readiness releases remain byte-identical and independently resolvable.
- [x] Treat each parent evidence declaration's `unbound` value as its required pre-binding state.
  The composite resolver projects that declaration as bound only when the selected child execution
  publication supplies its exact accepted binding. Parent-only resolution, or a missing, stale or
  rejected child binding, retains the corresponding `unbound-evidence-capability` blocker; an
  accepted child clears exactly the blockers for the bindings it contains without changing parent
  bytes or making the child authoritative outside execution resolution.
- [x] Derive a deterministic route plan before execution. The plan stratifies valid/invalid,
  spelling and boundary families, binds selection to campaign/case and selector revisions, and
  records the exact cases chosen for every rule/obligation. Every case reaches its cheapest
  decisive tier; selected subsets satisfy additional expensive obligations without heuristic
  failure-triggered escalation.
- [x] Treat each declared obligation as independently required: a rule is incomplete until every
  obligation has passing selected evidence. Each selected route runs its declared prerequisite
  stages in order and records the terminal tier actually reached.
- [x] Preserve the distinct public contracts of the frontend, compiler API and CLI routes. The CLI
  route observes exit status and rendered diagnostics; it is not treated as an alias for the
  programmatic compiler result.
- [x] Require diagnostic cases to match RD-03's exact `code`, directly observed compiler `phase`
  and `severity`, and prove that no IL, assembly or executable artifact was produced at or after
  the rejecting stage. Phase evidence must come from compiler pipeline provenance, never be
  inferred from the expected code or diagnostic manifest. Invalid cases retain their original
  generated source and are never wrapped in an executable envelope.
- [x] Transform every selected valid executable case through a closed, versioned execution
  envelope. Preserve the RD-02 source-case identity; derive a separate execution identity over the
  source digest, complete external parameter bindings, envelope and selector revisions, target,
  route budgets, initial-machine-state fixture, observation layout and participating
  handler/capability revisions. The envelope adds a valid `main(): void`, invokes the generated case
  and never embeds an RD-03 expected value.
- [x] Supply every executable case that reads pre-existing machine state with a closed, versioned
  initial-machine-state fixture. Establish and verify the fixture before entry, and evaluate RD-03's
  expectation from the identical fixture. Missing cells, unsupported fixture semantics or a seeded
  state mismatch remain non-passing. For the current C64 `$D020..$D022` read set, an independently
  reviewed and real-VICE-verified MMIO projection writes each fixture byte's low nibble and reads it
  as `0xF0 | lowNibble`; `peekw(address)` combines the projected byte at `address` with the projected
  byte at `address + 1` in little-endian order. A touched cell without authoritative target
  semantics remains oracle-unmodeled rather than assuming RAM or zero behavior.
- [x] Publish actual computed values/effects into a deterministic ordinary-RAM observation layout.
  Prove the allocation is disjoint from generated code/data, the case's semantic memory footprint,
  stack, MMIO and the completion cell. Initialize a non-success state, write observed values first
  and commit a distinct completion marker last. When projecting an observable into RAM would
  change the rule's semantics, declare and compare the exact direct memory/register observable
  instead; the independent expectation always remains host-side.
- [x] Require every currently modeled, mandatory-C64 rule in the selected composite publication with a
  `vice` obligation to contribute at least one bounded executable case that reaches ACME and VICE,
  regardless of cheaper-tier success. Preserve every population record that remains unmodeled or
  effectively unbound after composite resolution as a non-passing blocker for RD-06.
- [x] Require `acme` cases to assemble successfully and expose the declared binary, label and
  report artifacts. Missing ACME is `tier-unavailable`; a discovered ACME process that fails is an
  assembler-stage failure.
- [x] Run VICE behind one crash-recoverable cross-process C64 execution lease. Durable lease
  metadata uses checksummed generations and records the host boot/session identity, owner PID and
  process-start identity, lease nonce, child PID and process-start identity, endpoint pair and
  lifecycle state. A durable pre-launch intent carries a unique child token in a canonical launch
  artifact path passed to VICE, closing the spawn-before-child-record window. Acquisition fences a
  stale generation before atomically reclaiming only a proven-dead owner, revalidates exact child
  identity immediately before signaling, never identifies a child by PID, port or command substring
  alone, and fails closed with `emulator-lease-recovery-blocked` while retaining the lease when
  identity or termination is ambiguous. Each supported host must implement these positive identity
  checks; otherwise VICE is unavailable. Use two distinct loopback-only monitor endpoints, bounded
  collision retry, child-liveness plus protocol/target/version handshakes. No two readiness campaigns
  may concurrently control VICE through this route.
- [x] Normalize execution into a closed discriminated stage/result state machine with stable
  stage-scoped codes. It distinguishes invalid evidence input, invalid/unbound capability,
  unavailable tier, diagnostic mismatch, unexpected emission, compiler ICE, emission failure,
  assembler failure, emulator launch/handshake failure, instruction/cycle/wall-time exhaustion,
  emulator-lease-recovery-blocked, semantic mismatch and pass. The first terminal state in the
  declared pipeline wins; budget exhaustion uses the deterministic precedence defined below.
- [x] Make missing ACME/VICE a `tier-unavailable` result that blocks the relevant readiness gate,
  never a pass, skip or launch failure.

### Won't Have

- Heuristic escalation only after failure.
- VICE execution for every generated case or every frontend-only invalid case.
- Model, generator or oracle expansion beyond the selected RD-02/RD-03 population; RD-08 owns it.
- Performance measurement in the semantic readiness result.
- Additional platform emulators in this first target-scoped feature. (AR-10)
- An upgrade to the existing compiler-readiness publication-v1 member or handler-binding format.

## Technical Requirements

### Execution envelope and identity

The envelope is a separately revisioned transformation, not a mutation of RD-02 case identity.
It uses only a closed independently validated primitive set: complete recorded arguments, one
entry call, actual-observable stores and a completion-last store. Its source and observation-layout
digests participate in execution identity. Replay rejects unavailable historical revisions rather
than substituting current ones. Specification tests prove that no RD-03 expected value is present
in executable source and that an envelope cannot turn an invalid diagnostic case into an executable
case.

### Resource budgets and deterministic failure

Compiler, assembler and emulator operations have separate positive-safe-integer wall-time and
captured-output limits. VICE additionally has positive-safe-integer total instruction and cycle
budgets. Invalid, zero, fractional, negative or unsafe-integer limits fail before filesystem or
process work.

A closed execution-policy revision imposes these inclusive hard maxima before work:

| Resource | Maximum |
|---|---:|
| Compiler or assembler wall time | 60,000 ms per operation |
| VICE launch/handshake wall time | 15,000 ms per attempt |
| VICE route wall time | 120,000 ms total |
| Captured child output | 1,048,576 bytes aggregate per process |
| VICE instructions | 10,000,000 total |
| VICE cycles | 100,000,000 total |
| VICE launch attempts | 8 total |
| Retained failure evidence | 16,777,216 bytes per case |

The canonical policy values and every selected lower limit participate in execution identity.
Selected limits must not exceed the applicable maximum. The 120,000 ms route deadline includes
compile, assemble, every launch attempt, execution, observation and cleanup; each stage consumes its
own smaller limit and the remaining route time. Launch attempts and instruction/cycle consumption
are cumulative across the route, so retries cannot multiply a limit. Termination has a bounded
grace within cleanup; failure to prove termination retains the lease and fails closed.

Captured output combines stdout and stderr per child. Both streams remain continuously drained
after the retention cap, while evidence retains a deterministic head/tail sample plus total-byte,
truncation and content-hash metadata. Every serialized artifact and metadata record counts toward
the per-case retained-evidence cap. Crossing either cap produces only the stable bounded
resource-limit result, never partial passing evidence, and never allocates from the declared maximum
eagerly. A future maximum requires a new compatible policy revision.

The VICE wire count is always validated in `1..65535`; larger total instruction budgets execute as
a versioned sequence of bounded chunks. No passing evidence may exceed any declared total;
exactly-at-bound succeeds and the next consuming event exhausts the budget. Before each chunk and
at each completion observation, the route evaluates instruction exhaustion before cycle exhaustion
and records all exhausted totals; an asynchronous wall-time watchdog is terminal whenever it fires
before a route returns. Pending monitor commands, checkpoints and the child process are cancelled
during timeout cleanup. These rules make repeated execution produce the same stable primary result
code.

### Filesystem, process and monitor lifecycle

Every execution owns one unique canonical temporary directory and deletes it on every outcome after
retaining only policy-authorized failure evidence. All paths are canonicalized beneath that root;
absolute paths, traversal, symlinks and non-regular inputs are rejected before reads, writes or
process launch. Subprocess arguments are arrays, never interpolated shell strings. Captured output
is bounded and process timeouts terminate the owned process tree.

VICE uses binary and text monitor TCP endpoints bound only to `127.0.0.1`. The cross-process lease,
port-pair allocation, child process, monitor connections and every checkpoint share one top-level
all-outcomes lifecycle. Endpoint collision or a live-child/handshake mismatch retries only within
the declared launch bound, then fails as `emulator-launch-failure`; ambiguous monitor evidence can
never satisfy readiness.

Before allocating ports, lease acquisition validates its durable ownership record. A dead-owner
record is reclaimed only after atomically fencing its checksummed generation and proving through
supported-host boot/session and process-start identities that the owner ended. A recorded or
pre-launch-intent child is terminated with a bounded graceful-then-forced sequence only after its
exact identity and launch token are revalidated immediately before signaling; otherwise acquisition
retains the lease, returns `emulator-lease-recovery-blocked` and reports the exact manual recovery
action. Normal cleanup clears the record only when its generation and ownership nonce still match.

## Scope Decisions

| Decision | Chosen | AR |
|---|---|---|
| Evidence route | Pre-execution deterministic plan per case and rule obligation | AR-7 |
| Expensive-tier population | Versioned stratified bounded selection; at least one VICE case per selected modeled runtime rule | AR-7 |
| Execution source | Revision-bound envelope with separate identity; invalid cases remain unwrapped | RD-04 preflight |
| Capability authority | Atomic child execution publication keyed to an immutable compiler-readiness publication | RD-04 preflight |
| First runtime target | C64 through exclusively leased VICE | AR-10 |
| Performance | Excluded from semantic gate | AR-3 |

## Security Considerations

Canonicalize every path beneath the allocated temporary root and reject absolute, traversal,
symlink and non-regular-file inputs before filesystem or subprocess work. Pass subprocess arguments
without shell evaluation, cap output capture, enforce operation-specific timeouts, terminate owned
process trees and never permit generated source to choose host paths or monitor arguments.

VICE does expose two local network services: its binary and text monitors. Both bind to loopback
only and are protected from cross-campaign confusion by the exclusive lease, distinct port pair,
bounded collision handling and live-child protocol/target/version handshake. There is no remote
network, authentication, credential, PII, encryption or rate-limiting surface.

## Acceptance Criteria

1. [x] A frontend-only case invokes neither compiler API, CLI, emit, ACME nor VICE; compiler-API
   and CLI fixtures observe their distinct public contracts; an ACME-terminal route invokes its
   declared prerequisite stages and ACME but not VICE; a VICE-terminal route reaches both in order.
2. [x] The route plan is byte-identical for the same selected publication, campaign and selector
   revision in two fresh processes; it covers every declared obligation and stratifies validity,
   spelling and boundary families without inspecting prior outcomes.
3. [x] Every currently modeled, mandatory-C64 rule whose selected inventory record declares a
   `vice` obligation has at least one generated executable case whose recorded terminal tier is
   `vice`. Every remaining unmodeled, not-generatable, oracle-unmodeled or effectively
   capability-unbound rule remains visible and cannot satisfy RD-06.
4. [x] Replaying a selected valid runtime case produces a valid `main(): void`, complete recorded
    arguments and the same execution identity. Changing the envelope revision, argument binding,
    initial-machine-state cell or fixture revision, observation allocation, route budget, selector
    revision or capability revision changes that identity or returns explicit
    historical-unavailable; the RD-02 source-case identity is unchanged.
5. [x] A seeded expected-value leak into executable source, observation/code/data collision, stale
    success sentinel, completion-before-result write, absent required input cell, pre-entry fixture
    mismatch or wrapper around an invalid case fails before readiness evidence is accepted. `peek`
    and `peekw` cases independently match the declared `$D020..$D022` write/read projection. Real
    VICE acceptance proves the unused-high-nibble behavior for each touched register and both direct
    and computed word-read start addresses before the projection can be authoritative.
6. [x] A diagnostic case compares directly observed code/phase/severity. The correct code from the
   wrong phase, the wrong severity, or any IL/assembly/binary artifact fails; emitted executable
   output is classified `unexpected-emission`.
7. [x] Deliberate invalid evidence input, unbound route, compiler throw, invalid assembly, missing
   VICE executable, monitor-handshake failure, never-reached completion marker and wrong memory
   byte produce distinct stable stage-scoped result codes. Seeded multi-symptom cases follow the
   declared pipeline and budget precedence identically in repeated runs.
8. [x] Exact-limit instruction, cycle, wall-time and output-capture tests pass at the bound and
    fail immediately beyond it. Every policy maximum accepts its exact bound and rejects the next
    integer before work. Retries share cumulative route time, attempts, instructions and cycles;
    totals above 65,535 use only validated `1..65535` wire chunks and cannot wrap or truncate.
    Captured stdout/stderr continues draining after its combined retention cap and records stable
    head/tail, count, hash and truncation metadata; every serialized artifact counts toward the
    per-case cap and overflow can never retain partial passing evidence.
9. [x] A VICE timeout or injected failure at each launch/run/observation boundary leaves no child
    process, pending monitor command, checkpoint, leased port pair, cross-process lease or temporary
    directory. A concurrent readiness process cannot acquire the VICE lease. A subprocess killed
    after recording each lifecycle state, including pre-launch intent and pre-child-record, is
    recoverable by the next process only when fenced generation, host session, owner/child process
    start identities and child launch token are proven. Identity is revalidated immediately before
    signaling; ambiguous identity or termination returns `emulator-lease-recovery-blocked`, retains
    the lease and never terminates an unrelated process. Cleanup can clear only its matching
    generation and nonce.
10. [x] A generated path containing `..`, an absolute prefix, a symlink component or a non-regular
    input is rejected before any file or subprocess operation.
11. [x] A six-route candidate rejects undeclared, duplicate, stale and contract-incompatible
    bindings. Failed review/publication leaves the previous execution publication selected; a
    successful selection resolves all six routes only with the exact referenced nine-binding
    compiler-readiness publication, while both historical compiler-readiness releases remain
    byte-identical and resolvable. Parent-only resolution retains all six
    `unbound-evidence-capability` blockers; the valid child clears exactly those six without changing
    parent bytes, while each missing, stale or rejected child binding retains its corresponding
    blocker.
12. [x] Local acceptance runs at least one selected runtime case through real ACME and VICE. In an
    environment without either tool, the same campaign reports the exact unavailable capabilities
    and the readiness gate remains blocked rather than skipped or passed.
