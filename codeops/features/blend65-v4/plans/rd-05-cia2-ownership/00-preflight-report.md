# Preflight report: CIA2 ownership

> **Status**: ✅ PREFLIGHT PASSED — all 3 findings resolved
> **Iteration**: 2 complete scans; scoped iteration 3 for PF-001 and its direct interfaces
> **Artifact**: seven planning documents in this directory; report and continuity notes excluded
> **Codebase**: `cc57fe6bff4d82ff1f471b96c8858c3a4dc00a00`; target content was uncommitted
> **Last Updated**: 2026-10-06
> **Scope**: strict; existing four cooperative C64 KERNAL PRG profiles
> **CodeOps Artifact Schema**: 1

⚠️ SAME-SESSION REVIEW: the primary created the plan. Five independent read-only
cluster auditors checked the complete dimension partition, with one separate
packet-only challenger. Reviewer agreement is not behavioral proof.

## Exact reviewed target

These hashes bind the final planning boundary. Execution later changes task
progress; it does not retroactively change this preflight evidence.

| Document                                             | SHA-256                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| [00-ambiguity-register.md](00-ambiguity-register.md) | `5e90210f8b09e10dbcdbf59b929e1faaa9a48be300bea0f728a49734ae8143ab` |
| [00-index.md](00-index.md)                           | `9aa479ccdcdf56a926c873efc1d8445a8042eb49d6bf24b126d8b92b479fada3` |
| [01-requirements.md](01-requirements.md)             | `dd8fd724e32e013088b1e84068ade324c9a59ddd1daaac69c1eff0cb92b42ada` |
| [02-current-state.md](02-current-state.md)           | `505a8b4c110bb34397ffff900b9b31ba08b8aec41dba2621cc9b6afa9488257b` |
| [03-cia2-ownership.md](03-cia2-ownership.md)         | `0f367f6d9edd3c1a7188bbe2e14dfe42a4bce59e4f944274d9ea320c67a51d2e` |
| [07-testing-strategy.md](07-testing-strategy.md)     | `32aeb1556b3980480c520ba12756e8498a5f2237b3d80823eac73089fc5c1778` |
| [99-execution-plan.md](99-execution-plan.md)         | `f79ea152376a7f005c5d7ad6fd66e82abbfbe09c33ea883ee91906da37e4fa9d` |

## Codebase context

The TypeScript/Node/Yarn compiler already owns the API, semantic vector/context
worklist, machine selection, SFA closure, layout and public artifact services.
The current guard still rejects exclusive NMI; CIA2 lowering permits counter
observations but stops before mutations and consuming reads. No positive
exclusive capability is established by this report.

Key inspected owners: `semantic/interrupt-routes.ts`, `cia-ownership.ts`,
`interrupt-context-proof.ts`, `interrupt-context-facts.ts`,
`interrupt-context-walk.ts`, `interrupt-contexts.ts`, `whole-program.ts`;
`machine/lower-c64-cia.ts`, `lower-c64-interrupt.ts`, `lower-platform.ts`,
`lower-register-forwarding.ts`, `interrupt-specialize.ts`, `lower.ts`;
`storage/nmi-private-storage.ts`; `layout/c64-layout.ts`; public profile and
VICE fixtures. Context documents are the frozen governing chapters, selected
normative expert references, RD-05 and routing. They are not modification targets.

Machine boundary: NMOS 6510, PAL/later NTSC × SID 6581/8580, KERNAL 901227-03,
CIA model 0, visible KERNAL/I/O, optimization none, ACME 0.97, pinned VICE 3.10.
Primary MOS/KERNAL sources govern register and firmware behavior. Reset alone
does not prove idle CIA2 at every later SYS entry.

## Complete dimension scan

| #   | Dimension              | Finding / final disposition                                         | Independent cluster |
| --- | ---------------------- | ------------------------------------------------------------------- | ------------------- |
| 1   | Ambiguities            | PF-001 resolved                                                     | Soundness           |
| 2   | Implicit assumptions   | PF-002 resolved                                                     | Grounding           |
| 3   | Logical contradictions | PF-001 resolved                                                     | Soundness           |
| 4   | Completeness           | None                                                                | Delivery            |
| 5   | Dependencies           | None                                                                | Delivery            |
| 6   | Feasibility            | None; native proof remains executable work                          | Risk                |
| 7   | Testability            | PF-003 resolved; PF-002 cross-reference                             | Fit                 |
| 8   | Security               | None; device ownership/provenance assessed, web/auth not applicable | Risk                |
| 9   | Edge cases             | None                                                                | Risk                |
| 10  | Scope creep            | None; no new solver/runtime/API/harness                             | Fit                 |
| 11  | Ordering               | None; spec-first and qualification-before-ledger preserved          | Delivery            |
| 12  | Consistency            | PF-001 resolved                                                     | Soundness           |
| 13  | Codebase alignment     | PF-002 resolved                                                     | Grounding           |

Compiler/language and concurrent-interrupt lenses were integrated into these
clusters through semantics, SFA/ABI, platform and emitted-output responsibilities.
There was no second duplicate full review team. Final severity totals: 0
critical, 3 major resolved, 0 minor, 0 observations, 0 accepted risks.

## PF-001 — Ordinary release-helper reuse 🟠 MAJOR — resolved

**Location:** 03 §Source ownership / §Producer-to-consumer transport; ST-7.
A source-operation-only handback set would reject a release helper used at nested
depths. The first correction preserved existing emitted contexts but still
rejected sequential chained/exclusive leases at equal depth. The same root
finding remained open in iteration 2.

**Evidence:** `interrupt-context-walk.ts:31`,
`machine/interrupt-specialize.ts:91` and `:147`,
`machine/lower.ts:261`, `interrupt-context-facts.ts:120`.
Current specialization preserves relevant depths but does not distinguish
release policy at equal depth. Frozen Chapter 06 §§7.5/7.8 permits ordinary
helpers and finite balanced interprocedural ownership.

**Best resolution:** keep the existing specialization owner and add only finite,
proved per-operation/call-edge release variants. Preserve transitive callers,
canonical reuse, finite convergence, actual predecessor facts, physical links,
domain/ABI homes and final closure. E10278 remains for unresolved ownership,
not compiler emission-key limitations. ST-7 independently exercises nested and
same-depth direct/wrapped calls and their actual selected bodies.

A blanket rejection and source duplication were rejected because both effects
are provable; runtime selection or a general new pass is unnecessary.
**Authority:** compiler-owned correction under AGENTS.md PRIME DIRECTIVE item 4,
within the user's authorized CIA2 implementation batch. No product fork or new
material support surface is approved.
**Verification:** soundness and SFA scoped iteration 3 report no findings.
Confidence: high in the corrected contract; implementation remains Unknown.
Hardening: the second counterexample strengthened the first fix.
Challenger: converged; its source facts were supplied, not personally opened.

## PF-002 — Missing native RESTORE input surface 🟠 MAJOR — resolved

**Location:** 07 §Independent oracles / §Files and verification; task 1.1.3.
The complete `test/m1/vice-monitor.ts:66` surface has no RESTORE-input command;
`vice-runtime.ts:269` supplies no alternate keyboard-control surface. Requiring
genuine RESTORE solely through this fixture would invent an interface.

**Best resolution:** retain the binary fixture for CIA2 timers and explicitly
assign RESTORE/STOP/boundary qualification to the existing GDB/text-monitor
mechanism. Define independent scenarios before production. The inspected
protocol intercepts `mon_keyboard_feed`, applies a keyboard matrix, and calls
`machine_set_restore_key(0/1)`. Installed GDB exists; the pinned VICE binary
delegates to `c64keyboard_restore_key`, which updates timed CPU interrupt
state, not the emulated PC. The previous temporary script is a protocol example,
not a durable dependency or oracle.

A speculative binary RESTORE adapter was rejected: no supported primitive was
established, and the existing mechanism avoids a new API/harness/dependency.
**Authority:** the same compiler-owned, in-scope qualification correction.
**Verification:** grounding iteration 2 clears the missing-interface assumption.
Fresh input success, genuine entry, boundary fidelity, ordered accesses, bounded
failing exits and exact scripts/tool/model/artifact identities remain mandatory.
Confidence: medium for eventual native fidelity until its fresh probe.
Hardening: distinguished available mechanism from successful qualification.
Challenger: converged; no prior runtime verdict is decisive.

## PF-003 — Avoidable final-release load 🟠 MAJOR — resolved

**Location:** 03 §Final CIA2 shutdown; ST-10.
The final predecessor is exactly proved `$FE47`, yet the original 39-byte/
58-cycle requirement forced an absolute load of the immutable saved high byte.

**Evidence:** existing immediate emission at `lower-c64-interrupt.ts:280`;
nonvolatile captured load at `:329`; exact stock proof in AR-P4.
**Best resolution:** only for that exact final stock handback, emit
`LDA #$FE; STA $0319`. The complete planned sequence is **38 bytes/56 nominal
cycles**, two temporary stack bytes, zero RAM/ZP scratch. It preserves A/P,
X/Y, vector-first publication and identical MMIO effects. Nonfinal releases keep
captured loads. Calls, ROM, intervening NMI, DMA and placement remain separate.

No cost exception justifies the slower form; no optimizer or IR is necessary.
**Authority:** the same compiler-owned direct-lowering correction.
**Verification:** fit iteration 2 independently recounts the sequence and clears
the finding. Actual emitted cost and whole-PRG savings remain Unknown.
Confidence: high under the exact stock proof.
Hardening: removed an unnecessary load before independent oracle authoring.
Challenger: converged.

## Checks and evidence limits

The unchanged source controls passed 76/76 before production. Forced targeted
formatting, local Markdown links, whitespace, and the read-only plan parser pass.
The parser finds 20 tasks and no structural problems. Frozen specification and
expert paths, production and old oracles remain unchanged.

Adversarial checks covered suspended post-pop observers, repeated equal captures,
same-depth/transitive helpers, masks/latches being unreadable, stock ENABL/RS-232
writers, application writers during shutdown, simultaneous RESTORE, generated
versus stock ICR counts, final selected private homes and artifact publication.
The plan now assigns each decisive probe; none is claimed complete here.

Required routing/AR reads displayed some historical setup/review summaries.
The primary also saw previous native assertion counts during a mechanism search.
These are excluded from decisive evidence. No evaluator/grader payload was used.

Knowledge lineage: expert 2.0.3, immutable content
`22cc5f00f381c82d347cf342be4fcff16bc291c6`, Specification
`BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b`.
Applied interrupt-route completion/final storage closure, C64 entry/control,
semantic preservation, instruction-grid, equivalent-work and artifact headings.
Source keys MOS-PGM-1976, MOS-6526-1981, CBM-C64-KERNAL-03, ACME-097-R266 and
VICE-310-MANUAL/SOURCE. Primary documentation:
[MOS 6526](https://myoldcomputer.nl/Files/mos_6526_cia.pdf),
[pinned KERNAL NMI](https://raw.githubusercontent.com/mist64/cbmsrc/01bd60f162ef92212ef0cb67546ae8f42be34168/KERNAL_C64_03/rs232nmi),
[VICE monitor](https://vice-emu.sourceforge.io/vice_13.html).

**Status: Verified partial.** Only the plan boundary passes. Exclusive
source/storage/bytes/native qualification, unrestricted external stack/firmware/
deadlines and physical silicon remain Unknown. RD-05/DEF-7 stay open.
