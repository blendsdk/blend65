# Boing-ball unreachable teardown — execution plan

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Owner**: #168, continuation after the bounded publication/poll checkpoint.
> **Progress**: 0/7 tasks (0%)
> **Status**: Preflight passed; predecessor green checkpoint and local commit required.
> **Reasoning**: high — startup/control-flow ownership, source observations and final artifact closure.

## Objective and scope

Remove only the proved-unreachable cooperative startup restore path and its dead main-return
reference. Keep startup entry instructions, snapshots, state size, source behavior, canonical
`none` policy and existing oracles unchanged. This is the next bounded reduction toward the
remaining 1,151-byte equal-contract gap, not a whole-program parity closeout.

**Planning target:** this dead-code specialization inside existing compiler seams.
**Context:** the parent boing-ball parity and publication-proof plans; closed returnability;
machine main-return lowering; existing startup construction, rebinding and layout.
**Modification set:** this task's artifacts and derived roadmap; focused additive tests; the
existing machine lowering/input handoff and cooperative startup/layout consumers; freshly measured
downward boing compiler cost pins only. No existing spec-test edit, source rewrite, `spec/`, frozen
expert, expressiveness-ledger, hidden configuration or other issue owner changes.

**Hard dependency:** finish and locally commit the publication-proof checkpoint first. Do not add
new RED test files or change implementation while that checkpoint's test discovery is running.
No push. Record the actual predecessor commit before this plan becomes executable.

## Grounded current state

| Fact                                               | Evidence                                                                                                                                                                                                               |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact closed main is nonreturning                  | Primary real frontend/semantic/whole-program probe: `interruptOwnership.returningBodies.get("src/main.blend:1485:5978") === false`. The semantic while-end return block remains present.                               |
| Startup restoration is still mandatory in layout   | `packages/compiler/src/layout/c64-layout.ts:242–249,454–475` requires, allocates and places `startup.restore`.                                                                                                         |
| Existing constructor owns both paths               | `layout/startup.ts:489–508,686–698` constructs restoration separately from unchanged entry. `C64StartupInput` already travels in `MachineProgram.c64Startup` and startup rebinding.                                    |
| Only main's dead return references restoration     | Fresh public canonical assembly: restore label `$0D2D`; one reference, the main while-end `jmp startup.restore`; no source-address materialization of that label. Restore ends at code end `$0E46`, exactly 281 bytes. |
| An unsafe shortcut would invalidate existing proof | Anonymous poll selection requires the actual original source blocks. Do not filter or replace semantic blocks before `lowerFunction`.                                                                                  |
| No new returnability solver is needed              | Existing `InterruptOwnershipAnalysis.returningBodies`; existing machine-successor graph queries can independently verify the selected return edge is unreachable.                                                      |

The assembly measurement is current evidence, not a future saving claim. Dead-reference removal,
layout repair and any incidental size changes still require fresh measurement. Startup entry/state
capture remains deliberately untouched even though it is another output opportunity.

## Smallest viable design and decisions

1. Require the exact actual call-free main/source/program class already admitted by the bounded
   publication certificate, plus the closed main returnability fact being explicitly `false`.
   A missing, stale or unsupported fact retains the existing full startup. The existing raw-read,
   publication, firmware-routing and identity barriers protect code/layout observations too.
2. After ordinary source-to-machine selection, use the actual main machine CFG to check that no
   reachable path targets `startup.restore`. Preserve semantic identity and all executed machine
   instructions. Replace only proved-dead main-return references with the existing unreachable
   terminator form; do not add a general dead-code pass or filter source blocks.
3. Carry one internal optional `restoreRequired` fact through the existing `C64StartupInput` /
   `MachineProgram.c64Startup` / rebinding path. Absence keeps today's restoration. No new
   startup-policy family, command-line option, source syntax, runtime, solver or public compiler API.
   Share the already-derived certificate when practical; never introduce per-read scans or a registry.
4. The existing cooperative constructor may omit its restore block only under that fact. Its
   entry instructions, capture reads/writes, status/stack behavior and snapshot data remain unchanged.
   Takeover constructors and returning programs retain their current paths.
5. Layout accepts the absent restore partition only for the matching internal fact, creates no
   zero/negative code interval, and rejects conflicting metadata or dangling restore references.
   Final binding, memory/debug evidence and packaging must reflect the same selected structure.
6. Preserve all original byte/word, volatile, ABI, MMIO, interrupt and placement rules. Unsupported
   source stays accepted with ordinary lowering. This adds no new source diagnostic or workaround.

These are compiler-owned technical decisions within #168 under the project workflow directive.
An independent challenger recommended **Simplify**: dead restore only, rather than a new snapshot-free
constructor or global ZP-mode flip. Confidence: medium-high. Strongest objection: this does not
reduce executed snapshots or improve steady-state frame cycles. Those remain separately owned debt.
If implementation needs a new constructor, general observer/control-flow engine, broader storage
model or observation waiver, stop at the reserved complexity gate; this plan authorizes none of them.

## Independent specification boundary

The independent author receives only the frozen startup/behavior contract, approved boundaries and
planned signatures. New specification files are authored only after the predecessor checkpoint:

### Signature-only author handoff

The only new declaration is an internal member of the existing `C64StartupInput`:

```typescript
/** False only after the compiler proves normal restoration unreachable and unobserved. */
readonly restoreRequired?: boolean;
```

`undefined` and `true` preserve the existing restore construction. `false` omits only cooperative
restoration; it changes no entry instructions, snapshot bytes or takeover behavior. It travels in
the existing `MachineProgram.c64Startup?: Omit<C64StartupInput, "profile">`. There is no new public
query, proof registry or test adapter. The producer derives this value from the existing closed
facts; direct constructor tests supply the internal fact deliberately.

| Existing entry point                 | Signature / result available to the author                                                                                                                                                                                                                                   |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Machine producer, `machine/lower.ts` | `lowerMachineProgram(input: MachineLoweringInput): MachineLoweringResult`; complete results expose `program: MachineProgram`, whose `c64Startup` carries the selected fact.                                                                                                  |
| Constructor, `layout/startup.ts`     | `createC64Startup(input: C64StartupInput): C64StartupResult`; success is `kind: "complete"` with `startup`, `stub`, `stackDemand` and optional takeover `entries`.                                                                                                           |
| State object, `layout/startup.ts`    | `createC64StartupStateData(input?: Pick<C64StartupInput, "displayIndependent" \| "startupPolicy" \| "borrowedZeroPage" \| "preserveY">, ownership?: C64ProfileOwnership): MachineDataObject`; its input and 49-byte full-policy baseline do not change.                      |
| Rebinding, `layout/startup.ts`       | `bindC64StartupState(program: MachineProgram, homes: readonly StorageHome[], profile: TargetProfile): MachineProgram \| null`.                                                                                                                                               |
| Layout, `layout/c64-layout.ts`       | `layoutC64Program(input: C64LayoutInput): C64LayoutResult`, where input is `{ program, certificate: StorageClosureCertificate, profile, draftFunctionStorage? }`; result is `kind: "complete"` with `program`, `intervals`, `spriteBlocks`, `loadRange`, or `kind: "error"`. |
| Public artifact build                | Existing `buildProject` / existing root fixture interfaces only; no new package export or test harness.                                                                                                                                                                      |

The author may read these type/interface declarations and supplied fixture signatures, not the
producer, constructor, rebinding, layout, selection or observer implementations. The primary
supplies excerpts instead of granting access to a mixed implementation file.

| Owned additive specification file                                | Assigned boundary                                                                                                                              |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/compiler/src/machine/lower-dead-restore.spec.test.ts`  | Real source-to-machine eligibility and conservative defaults; inspect the existing result only.                                                |
| `packages/compiler/src/layout/startup-dead-restore.spec.test.ts` | Direct constructor entry/state equivalence, normal defaults, takeover and rebinding.                                                           |
| `packages/compiler/src/layout/c64-dead-restore.spec.test.ts`     | Direct layout partition, malformed inputs and complete interval invariants.                                                                    |
| `test/rd05/nonreturning-startup.spec.test.ts`                    | Four-profile public assembly/cost acceptance and retained seven-byte poll. Existing source-derived VICE oracles remain separate and unchanged. |

| Permitted test mutation and stage                                                                                                                                                           | Required outcome                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Producer: omit `interruptOwnership`/`returningBodies`, omit the actual main's map entry, or supply a false entry only for another owner; use valid returning or unsupported-observer source | Keep restoration. This tests missing/mismatched ownership, not an invented ability to authenticate arbitrarily forged closed-program facts. Existing exact-program/body publication controls remain independent. |
| Constructor: vary only the new member over omitted / `true` / `false` on otherwise identical cooperative inputs                                                                             | Omitted/true retain restore. False removes only restore; compare entry structure, stub, stack demand and state data against the identical default input.                                                         |
| Rebinding: use valid startup-state data and certificate homes with false configuration                                                                                                      | Preserve false and regenerate absent restoration; entry/state reflect only the same existing borrowed-home binding.                                                                                              |
| Before rebinding: remove a restore block but leave omitted/true configuration and valid state data                                                                                          | Regeneration repairs the supplied startup to the normal restore form. This is not a partition-rejection test.                                                                                                    |
| Before rebinding: supply malformed snapshot bytes/size                                                                                                                                      | Existing `null` failure; do not overwrite malformed state merely to satisfy the new fact.                                                                                                                        |
| Layout without `c64Startup`: supply no restore block, duplicate/empty partition or a missing startup entry                                                                                  | Existing `kind: "error"`; no regeneration can hide this malformed direct-program input.                                                                                                                          |
| Layout with false configuration and valid state: put a machine jump or address operand naming `startup.restore` in a function                                                               | `kind: "error"`, never a successful dangling-label artifact. Do not mutate only the startup block list: rebinding regenerates it.                                                                                |
| Layout with valid false configuration, no restore references and valid state/certificate                                                                                                    | Complete, no restore partition and every interval satisfies `start <= end`; final rebind/build evidence agrees.                                                                                                  |

Expected failures are the existing typed `null` / `kind: "error"` boundary, not newly invented
diagnostic strings. Internal malformed-program controls are distinct from accepted source fallback.
PA-001's handoff clarification is compiler-owned under the project decision directive; it adds no
implementation, API or test authority beyond the four new files above.

| Input                                                                                            | Expected behavior / assembly-cost boundary                                                                                                                            |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact boing-ball, four cooperative profiles, proved nonreturning class                           | No emitted restore body or dangling main-return reference; original startup, source-derived traces/motion and seven-byte EOR poll unchanged; code strictly decreases. |
| Returning main or one reachable returning arm                                                    | Full restoration remains; caller state and normal return tests pass unchanged.                                                                                        |
| Missing returnability, stale source/block/program facts, reachable machine restore edge          | No omission. Prove fallback without inventing a new source restriction.                                                                                               |
| Helper/callable/interrupt/global-initializer or raw/firmware observer outside the admitted class | Existing startup and named/source observation protections remain conservative.                                                                                        |
| Constructor input with no new fact                                                               | Existing entry/restore construction and snapshot bytes unchanged.                                                                                                     |
| Conflicting absent-restore metadata, dangling target or malformed empty partition                | Fail closed through the existing internal artifact/layout failure contract, not an invalid PRG.                                                                       |
| Valid absent restore through provisional/final binding and packaging                             | No late function storage, mismatched regeneration, stale costs or zero/negative code interval; exact fresh ACME bytes and evidence agree.                             |

## Specialist Agents

**New specialist check: None.** Existing correctness, semantics, SFA/ABI, target-platform,
machine-code and host-performance roles cover these existing seams (`codeops/agent-routing.md`).
No additional role or infrastructure. Same qualified expert `2.0.4`, content
`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`; frozen Appendix A startup duties, SFA closure,
volatile/effect preservation and equivalent-work accounting govern. Physical status remains
VICE-verified / hardware-unverified only after actual execution.

## Tasks

- [ ] T-168-D1 After the predecessor is green and committed and this plan passes preflight, independently author/freeze new behavior and byte/cost specifications; record meaningful RED before code.
- [ ] T-168-D2 Carry the exact nonreturnability/observer/selected-machine eligibility fact through the existing lowering handoff; verify producer/fallback interface controls without claiming final layout GREEN.
- [ ] T-168-D3 Teach the existing constructor to omit only the restore block; verify unchanged entry, snapshots and default/returning/takeover controls.
- [ ] T-168-D4 Complete rebinding/layout/packaging and dead-reference handling; verify all new public specifications, unchanged boing startup/trace/frame/poll oracles and freshly measured downward code pins.
- [ ] T-168-D5 Add implementation controls for malformed/stale facts, side-entry/observer barriers and closure/scale; run affected regression tiers.
- [ ] T-168-D6 Obtain the six applicable independent review lenses, resolve and re-verify findings without broadening this unit.
- [ ] T-168-D7 Run the impact-based host and complete serialized checkpoint, record the measured residual and deferral-expiry assessment, sync roadmaps and make a green local checkpoint via the git-commit skill; never push or close #168 without its complete boundary.

**Verify:** directed new constructor/producer/layout tests, existing startup and boing suites;
`yarn test:changed --host`, then `yarn test`; phase checkpoint after frozen install/build/typecheck
with `yarn test:full`. VICE remains serialized. Plan-only work validates targeted formatting,
file links and source keys, not a premature compiler capability claim.
