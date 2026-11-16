# Publication proof — independent review findings

> **Baseline**: `c0201e86`; the earlier separately reviewed twin repair is excluded from this compiler phase.
> **Status**: all findings fixed and independently fix-reviewed; complete checkpoint passed.

## TP-001 — firmware-mediated aliases are not excluded — MAJOR

**Location:** `sprite-publication-proof.ts` fixed raw-write checks and the counter alias callback.
**Authority:** AR-2/AR-5 and the component's conservative publication/observer contract.

The proof excludes direct writes to admitted SFA windows but does not exclude source writes to
firmware workspace that redirects a retained stock IRQ's indirect reads/writes. Main-only generated
execution domains do not establish that firmware has no such access. The platform auditor's cursor
example uses `$D1/$D2`, `$CE` and a capture home H. This is a missing proof, not a reproduced
miscompilation or a claim that every entry state takes the cursor path.

Primary-source confirmation: `mist64/c64rom`, `kernal/editor.2.s`, labels `key`/`repdo`/`key5`
read `(pnt),Y`, store the original character in `gdbln`, then call `dspp2`, which writes `(pnt),Y`.
`kernal/declare.s` defines the editor's pointer/saved-character state. These are published KERNAL
sources; the inspected text alone is not an attestation of the local ROM or a runtime reproduction.

**Necessary correction:** decline the new proof and new anonymous selector for unproved
source writes into low firmware/stack/screen workspace, retaining only exact default sprite-pointer
slots when their asset provenance is proved. Check every addressed byte, including word/wrap cases.
No existing named-source observer policy, source acceptance, runtime or general analyzer changes.
The independent challenger converged on mandatory certification and low-RAM/CIA fallback.

**Disposition:** accepted and fixed under AR-P11; platform fix review clear with no related findings. Mandatory certificate
handoff closes the no-publication/helper/initializer bypass; per-byte low-RAM and CIA barriers retain
ordinary lowering. Two new admission controls failed before the fix and pass afterwards. This is an implementation correction within
the explicitly approved conservative fallback contract, not a new material support surface or
observation-contract change. The full checkpoint must follow the correction and its fix review.

## PE-001 — retained initialization reachability can grow quadratically — MAJOR

The per-initializer `avoiding` cache retains one CFG set per candidate block, potentially O(B²)
block identities. Root memoization does not prevent this. Repeated stores and loads also allow
equivalent initialization checks to multiply. The performance reviewer recommends grouping checks
by candidate block, retaining only Boolean root outcomes and discarding each reachability traversal.
This preserves the already-approved reachability method; it needs no general analysis engine.

**Disposition:** accepted and fixed under AR-P12/R-7; performance and semantic fix reviews clear.
No source semantics or observation policy changes. Regression evidence includes a
multi-root/multi-block shape, not only the existing single-block 8,000-operation chain.

## PE-002 — worklists replay unchanged joined inputs — MINOR

Both counter and pointer-initialization worklists enqueue on individual edge changes, even when
the target's joined input is unchanged. Incremental monotone joined inputs can avoid those replays
and predecessor rescans. This is the existing finite-lattice algorithm, not a broader optimizer.

**Disposition:** fixed under AR-P12; directed fan-in control verifies exactly two operation visits
per operation for an unchanged 500-predecessor / 5,000-load suffix. A 600-root/conditional-block
provenance case passes. No noisy timing threshold or new benchmark harness is introduced.
Performance fix review confirms finite-height replay bounds and linear retained initialization
indexes plus one traversal; per-block reachability time remains explicit, not globally linear.

## Other completed bounded reviews

| Role                    | Result / limits                                                                                                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| semantics-reviewer      | No findings in scalar/counter/provenance value semantics or DX. Parent-authorized expert excerpts clear the authority gap; no execution or whole-phase qualification.                                     |
| sfa-abi-auditor         | No findings through producer, retention, inventory and final binding. Named-source query unchanged. External NMI aggregate peak/firmware completion remain Unknown.                                       |
| correctness-reviewer    | No findings in bounded standards/maintainability/oracle integrity; specialist contracts separately owned. Freeze hashes independently rechecked by primary, not reviewer.                                 |
| target-platform-auditor | TP-001 fixed at conservative eligibility boundary. Rejected firmware routes need no new qualification; cursor ROM binding/runtime counterexample remain Unknown, not a demonstrated miscompile.           |
| performance-auditor     | PE-001/002 fixed. Initialization retains linear indexes and one temporary traversal; finite dataflows requeue only on joined-input changes. No execution or peak-heap claim.                              |
| machine-code-auditor    | No findings in the six-byte poll-removal unit. Independent static effects/cost review uses primary-executed byte evidence; denied artifact access was not retried. Whole-program parity remains unproved. |

Lineage: qualified expert `2.0.4`, immutable content
`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`; parent-authorized normative excerpts and frozen
specification. Reviewers did not execute tests. The primary subsequently passed the actual complete
checkpoint; physical hardware and whole-program parity remain unqualified.
