# Anonymous byte-write forwarding — independent review

> **Baseline**: clean plan checkpoint `27ebf448`, tree `f76728aeef90f81e5fad917d2c9e28c4140c2c09`.
> **Status**: TP-001 fixed/reviewed; TP-002 repaired and independently reviewed. Complete checkpoint GREEN; bounded unit complete, #168 remains open.

The production baseline is unchanged from `4e116829`. This review owns only the focused selector,
existing forwarding-set union, additive tests/fixture and measured downward implementation pin.
No existing observer, named-source guard, source, scalar/memory lowerer, startup/layout or `none`
policy changes. No oracle exception is requested or applied.

| Role                    | Disposition and evidence endpoint                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| correctness-reviewer    | No findings. Supplied raw execution-owner comparison confirms all five frozen spec/fixture hashes match and no tracked existing specification differs from the phase baseline. Reviewer inspected current code and bounded caller/pin diff; did not execute hashing/tests.                                                                                                             |
| semantics-reviewer      | No findings in semantic preservation or modern DX. Complete uses plus exact source/reachability and old observer premises gate A lifetime; fallback preserves ordinary accepted source. Independent 257-value arithmetic and original source-derived boing sequence remain separate from output expectations.                                                                          |
| sfa-abi-auditor         | No findings through selected A lifetime, alias/asynchronous exclusion, pre-emission demand suppression, inventory/binder, final rebinding and layout interfaces. Named storage, parameters, returns, spills and helpers gain no omission rule. Reported SFA/RAM reconciliation is execution-owner evidence.                                                                            |
| target-platform-auditor | No findings in source/current assembly platform review. Directly inspected the ten current arithmetic/device/pointer cores and labels; entry/banking/asset placement and single volatile store remain. Before/after raw-byte reproduction was not performed; its baseline artifact was unavailable to that review and PRG bytes were outside its allowlist.                            |
| machine-code-auditor    | No findings at static + current-byte-excerpt endpoint. Independently decoded all ten owner-supplied 9-byte/12-nominal-cycle cores and the actual `$0A96` seven-byte poll; reconciled current complete cost/resource vector. Did not run the build or validate all 1,243 bytes. Independent baseline-byte comparison remains Unknown; historical delta attribution is primary evidence. |
| performance-auditor     | No findings on exact inline production patch. Extra work is expected O(N+U+B+E), or O(N+B+E) for bounded-arity inputs; zero/one additional unchanged proof cost P, never candidate-count times P. Temporary input-sized maps/sets only, no blocking I/O/cache/new attempt loop. Native external diff read was denied and not retried; authorized source excerpts supplied instead.     |

Execution-owner evidence is in [verification](08-verification.md), not independently rerun by
read-only auditors. Global install/build/typecheck and changed+host pass; the new complete
checkpoint is still required. Whole-frame timing, external aggregate interrupt/firmware bounds
and physical hardware remain unqualified. No whole-program expert parity or issue closure.

Expert lineage: qualified frozen `2.0.4`, content `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`;
Optimization Contract, fixed-width memory effects, CPU/lowering instruction effects, SFA closure,
startup/VIC/interrupt contracts and equivalent-work accounting. Source keys
`BLEND65-SPEC-4-038b70e9`, `MOS-PGM-1976`, `CBM-C64-PRG-1982`. Incidental historical routing
smoke summaries were excluded from substantive review. No new generated IRQ route or `$FE47`
entry condition; reported bounded stack is not an external firmware/NMI aggregate bound.

## TP-001 — MAJOR: store-watchpoint stop is not a mainline-state boundary

**Location:** `test/rd05/byte-write-forwarding-vice.spec.test.ts:97–108`.
**Ruling:** User explicitly approved the single recommended adapter-only correction on 2026-11-17,
including independent review, re-freeze and a fresh complete checkpoint. This permission covers
only the named file/hash and remedy below, not other assertions, oracles, production or helpers.
**Frozen SHA-256:** `7b71bff50e5da06dc54747e1ee99bf2f02cac17b3da46938d26c25872ba26873`.

The full gate fails at ordinal 252: stop PC `$FF48`, expected `$0963`. An admitted stock IRQ
can enter after STA but before VICE delivers the stopping watchpoint. The monitor reports the
current PC, not a guarantee that SP/I still describe the mainline. Merely allowing `$FF48` at
the assertion would sample the wrong machine state. Earlier passes do not refute this race.

A primary controlled existing-API probe, without source/CPU-register/program-byte changes,
reproduces the exact transition by aligning the existing CIA1 timer IRQ after the first store:

| Boundary                              | PC      | A   | SP  | P     | Device      |
| ------------------------------------- | ------- | --- | --- | ----- | ----------- |
| Before STA                            | `$0960` | 21  | 246 | `$00` | Not sampled |
| Store-watch stop after IRQ acceptance | `$FF48` | 21  | 243 | `$04` | 21          |
| Execute stop after stock RTI          | `$0963` | 21  | 246 | `$20` | 21          |

Stack bytes `$20,$63,$09` prove a hardware status/return frame with B clear and continuation
`$0963`. Independent platform review confirms an observation-contract defect, not evidence
establishing a compiler fault. The original ordinal-252 register/frame snapshot is absent;
the controlled reproduction corroborates its cause, rather than reconstructing that run.

### Exact approved remedy

The user authorizes changes **only to this test's observation adapter**:

1. Keep the initial execute stop before the first STA and clear setup hits.
2. Sample all 257 states with an execute checkpoint at `store + 3`. Retain exact PC, device, A,
   N/V/D/Z/C, SP and I assertions and the independent arithmetic oracle without relaxing values.
3. Use the existing non-stopping `$D005` store tracepoint; count only that checkpoint ID.
4. After the last state sample, stop before the next STA and drain pending trace events. Require
   exactly 257 writes before deleting checkpoints; never execute a 258th write.

VICE processes execute breakpoints before pending watchpoints. The temporary probe confirms the
final drain contributes one deferred event, not another write. Immediate per-sample trace delivery
is therefore not a valid replacement assertion. Both natural and deliberately aligned IRQ probes
pass all 257 state samples and exactly 257 writes; see [verification](08-verification.md).

No production/source/shared-monitor change, IRQ masking, retry-until-pass, accepted-PC widening,
skip, weakened behavior assertion or new framework is proposed. This is not a broader interrupt
route qualification or a new compiler entry condition. After approval, independently review the
adapter diff, re-freeze its exact hash, and rerun the required complete checkpoint. An isolated
pass cannot replace it. Other frozen files and the three old teardown exceptions remain untouched.

**Authority:** qualified expert 2.0.4/content `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`,
`c64-memory-and-runtime#Interrupt entry and exit contracts`; `MOS-PGM-1976`,
`CBM-C64-KERNAL-03`, `VICE-310-SOURCE`; source-order contract `spec/12-intrinsics.md:180–183`.
The independent reviewer inspected repository/upstream source and supplied trace; it ran no code.
Physical hardware and external aggregate interrupt bounds remain unproved.

### Approved correction result

The independent original specification author changed only the approved adapter, reporting no
forbidden implementation exposure. Primary verified the source/arithmetic prefix and every
original assertion line are unchanged, the 257 loop remains and exact trace-count 257 is added.
Correctness and platform fix reviewers report no findings on this bounded diff. The corrected
specification passes 1/1 in the subsequent directed serialized run; its active frozen hash is
`0e9b9c91e0838aec509f3e7538db1b0d841b1b0c4ead8689d32a9af9c9a8c2a8`.
No production or shared-monitor edit occurred. Full-checkpoint closure remains pending.

## TP-002 — MAJOR: full startup mapping does not use the captured readbacks

The same four-file/six-test command reports five passes and one failure in the **unchanged**
`test/rd05/boing-ball-startup.spec.test.ts:167`, compiled case: `$0001` reads `$06` rather than
the expected `$A6`. Twin startup, both old source-contract cases, the frame comparison and the
corrected sampler pass. TP-001 approval does not cover this file or startup production code.
No new edit or waiver is authorized. This distinct diagnosis is not another iteration of TP-001
fix review. The independent challenge below identifies a concrete compiler/specification mismatch.

### Controlled evidence and unresolved preservation boundary

The primary reproduced `$A7 → $07 → $06`: after startup captures `$A7`, an aligned admitted
CIA1 IRQ reaches stock ROM port handling, then the compiler's unchanged fresh-read/mask write
produces `$06`. A released-sense `$B7` sentinel instead reaches exact `$B6` under both natural
and aligned IRQ phases while retaining D/I, mapping, CIA2/VIC and vector checks.

The initial platform diagnosis proposed changing only the two input/expected canary values plus
their comment, but explicitly reserved the ownership interpretation. The frozen contract at
`spec/appendix-c64.md:219–231` names **saved** port/DDR values and preservation “throughout”.
Full startup currently re-reads both hardware registers at mapping rather than loading its
captured values (`startup.ts:345–377`). The independent challenger rejects fixture-only
qualification: with saved `$A7` and live `$07`, the specified mapping write is `$A6`, not the
current `$06`. This mismatch does not depend on interpreting “throughout”. The DDR reread has
the same structural defect; no runtime DDR-changing witness is claimed.

### Approved ruling — separate implementation still required

On 2026-11-17 the user explicitly authorized a **separate bounded startup correction**, with independent saved-versus-live regression
specifications before implementation, using existing captured storage/register facts rather than
new infrastructure. Keep `$A7` legal. Resolve AR-P1: independent stock-firmware mutations may occur
with cooperative IRQ service enabled, while compiler mapping writes must use captured readbacks.
Do not reinterpret the explicit formula as live-readback preservation or claim a global immutable
hardware state. Fixing that write alone does not prove literal preservation “throughout”.

A stable `$B7 → $B6` canary can be considered only with a separately authorized exact oracle
exception and the distinguishing saved-readback regression/repair; it cannot conceal this defect.
No old startup-oracle edit is currently approved. The frozen specification remains untouched.

**Strongest objection:** preserving the latest firmware decision may be better cooperative
behavior. That is a product-contract discussion, not authority to disregard the saved-value
formula. Captured-state replay can overwrite a newer firmware decision, so the ownership ruling
is material and cannot be selected silently.

**Confidence:** High on the source/specification mismatch; the runtime observations are primary
evidence, and the original failure's intermediate state remains absent. **Hardening:** rejected the
initial fixture-only remedy after independent challenge. **Challenger:** diverged from the initial
platform recommendation; a repair plus explicit ownership ruling is required. No production cost
delta or complete interrupt-route/hardware qualification is claimed before implementation/proof.

The user approved the compiler-versus-firmware ownership ruling and bounded repair scope, not any
old startup-oracle expectation change, frozen specification edit, IRQ redesign or input restriction.
The new dependency needs its own plan/preflight/specification-first sequence before code. Probe
details and exact identities are in [verification](08-verification.md); no fresh full run has started.

## Final disposition

The subsequent startup dependency delivers the separately approved saved-value correction,
independent provenance/constructor specifications and all exact exception/fix reviews. Parent and
dependency each have six clear execution lenses. The actual post-restart complete checkpoint
passes as recorded in [verification](08-verification.md#bounded-closeout--complete-checkpoint-green):
cached workspace results disclosed, fresh host/serialized VICE pass and all40 inputs unchanged.
TP-001 and TP-002 are resolved within their exact authority, without new source restrictions or
shared-monitor/timeout changes. Earlier failures and lost historical raw evidence remain documented.
No residual production finding blocks these units. The799-byte whole-program gap and timing stay
#168-owned; no push, issue closure or unrestricted hardware/interrupt guarantee follows.
