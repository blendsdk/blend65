# Boing-ball unreachable teardown — execution plan

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Owner**: #168, continuation after the bounded publication/poll checkpoint.
> **Progress**: 7/7 tasks (100%)
> **Status**: Complete — bounded teardown checkpoint green; #168 continues
> **Predecessor**: `46292b77` — actual full checkpoint exit zero; local commit, no push.
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
No push. The recorded predecessor now satisfies this gate; no teardown tests or implementation
were present in that checkpoint.

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

- [x] T-168.9 D1 — After the predecessor is green and committed and this plan passes preflight, independently author/freeze new behavior and byte/cost specifications; record meaningful RED before code. Four independently authored files frozen at 44 cases. Meaningful RED: compiler 10 failures/26 passing controls, public 4 failures/4 passing returning controls. Before freeze, the author added the legal IRQ adapter, corrected two CIA controls to configuration writes and split producer versus constructor assertions for staged verification, preserving every assertion. No forbidden input exposure or teardown implementation at freeze; see [verification](08-verification.md).
- [x] T-168.10 D2 — Carry the exact nonreturnability/observer/selected-machine eligibility fact through the existing lowering handoff; verify producer/fallback interface controls without claiming final layout GREEN. Producer-only selection and conservative controls pass 13/13; the constructor-integration case is deliberately excluded until D3. Compiler reference build passes. Existing source identities survive selection; only dead machine return references change. No final layout GREEN claimed.
- [x] T-168.11 D3 — Teach the existing constructor to omit only the restore block; verify unchanged entry, snapshots and default/returning/takeover controls. New producer/constructor plus existing startup/cooperative/takeover controls pass 79/79 and compiler build passes. Existing constructor partition only; no new family or snapshot change.
- [x] T-168.12 D4 — Complete rebinding/layout/packaging and dead-reference handling; verify all new public specifications, unchanged boing startup/trace/frame/poll oracles and freshly measured downward code pins. All 44 new specifications pass after exact AR-P1/P2 sampler corrections; 41 unchanged poll controls pass. Serialized startup/100-checkpoint source trace/original frame VICE 5/5 pass. Fresh compiler cost pin 1,593→1,309 (281 restore + 3 dead jump), payload 7,167/ZP 0; equivalent-twin gap 867. Entry 328 and snapshot 49 unchanged. No complete new checkpoint or whole-program parity claim.
- [x] T-168.13 D5 — Add implementation controls for malformed/stale facts, side-entry/observer barriers and closure/scale; run affected regression tiers. Fifteen new implementation cases cover cold/live restore edges, address materialization, calls, duplicate/missing/foreign graph identities, metadata-only fallback, 6,001-block iterative traversal and all four existing cooperative constructor policies. Six directed compiler files pass 98/98; existing startup/profile and layout controls also pass. Public output/cost 9/9 and directed VICE 5/5 pass.
- [x] T-168.14 D6 — Obtain the six applicable independent review lenses, resolve and re-verify findings without broadening this unit. Correctness, semantics/DX, SFA/ABI, platform, emitted-code and host-performance reviews are clear. RV-001's exact approved sampler fixes are independently fix-reviewed. No transformation finding or new scope survives; see [findings](05-findings.md). Primary-supplied execution/byte/hash evidence is distinguished from independent static review; runtime remains bounded PAL/6581 and hardware-unverified.
- [x] T-168.15 D7 — Run the impact-based host and complete serialized checkpoint, record the measured residual and deferral-expiry assessment, sync roadmaps and make a green local checkpoint via the git-commit skill; never push or close #168 without its complete boundary. Install/build/typecheck and changed+host pass. Actual `yarn test:full` exits zero in 5,006.38 s: compiler 245 files/4,046 passed + 2 skipped; host 247/5,161; serialized VICE 130 passed files/2,379 passed tests + existing 1-file/4-test skips. It includes complete workspace and host checks; no duplicate outer `yarn test`. Deferral assessment and measured residual are recorded; coherent local checkpoint commit follows immediately. No push or issue closure.

## Runtime ambiguity register

### AR-P1 — frozen public test sampler key — user-owned oracle exception

The primary supplied the independent author an incorrect evidence-field name: BASIC-stub bytes
are accounted under component `startup`, not `stub`. The frozen new public test at
`test/rd05/nonreturning-startup.spec.test.ts:86` therefore fails before its unchanged 12-byte
expectation can inspect the actual record. The admitted component set in
`packages/compiler/src/artifacts/costs-evidence-validator.ts:51–64` includes `startup`, not `stub`.
Fresh artifact `c96c66d5-143b-4047-aa2b-65050fd03f6b` records
`{ id: "program:basic.stub", component: "startup", bytes: 12 }`.

**Recommended correction:** change only that new frozen test's sampler argument `"stub"` to
`"startup"`, preserving the 12-byte expectation and every source/behavior/cost assertion. Do not
change the evidence schema or emit a fake alias to satisfy the sampler. This is a primary handoff
error, not authority to edit a frozen oracle silently. Record the exact user decision before any
test edit, then re-freeze and rerun all four specification files. No test has been changed after
freeze; no new behavior failure, green public run, runtime result or new-unit commit is claimed.

**User decision:** user selected **Approve correction (Recommended)** in this conversation for
the exact one-argument change in the named new specification file. Applied only `"stub"` →
`"startup"`; the 12-byte expectation and every other assertion remain unchanged. Re-freeze and
complete rerun follow; no evidence-schema or compiler behavior change is authorized by this ruling.

### AR-P2 — half-open public interval adapter — user-owned oracle exception

After AR-P1's authorized key fix, four public positives reach the snapshot assertion and report
50 versus 49. The implementation's state is still 49 bytes. Public memory intervals use exclusive
ends (`memory-evidence-validator.ts:160–165`, `size === end - start`), unlike inclusive internal
layout intervals. The independent correctness reviewer reports RV-001 MAJOR: the new adapter both
adds one to snapshot size and includes one byte beyond each code interval in its poll sampler.

**Recommended exact correction in `test/rd05/nonreturning-startup.spec.test.ts` only:**
line 70 `byteCount(interval.end) - loadAddress + 3` → `... + 2`; line 95
`byteCount(state.end) - byteCount(state.start) + 1` → `byteCount(state.end) - byteCount(state.start)`.
Keep the 49-byte expectation, seven-byte poll, code-only filtering and every other assertion.
The independent challenger converges, confidence high. Reading the reported `size` field instead
is viable but would drop the existing independent endpoint-derived check; changing 49 to 50 or
altering the evidence schema is not a valid remedy. No such edit is authorized by AR-P1.

**User decision:** user selected **Approve two fixes (Recommended)** in this conversation for
these exact two expressions in the named new test. Applied only `+3` → `+2` at the code-slice
boundary and removed the snapshot `+1`; 49 and every other expectation remain unchanged.

**Verify:** directed new constructor/producer/layout tests, existing startup and boing suites;
`yarn test:changed --host`, then the complete workspace and host checks included in `yarn test:full`
after frozen install/build/typecheck. This subsumes a duplicate outer `yarn test`; it does not omit
any host or emulator test. VICE remains serialized. Plan-only work validates targeted formatting,
file links and source keys, not a premature compiler capability claim.
