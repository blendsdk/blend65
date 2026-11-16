# Boing-ball anonymous byte-write forwarding

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Owner**: #168 continuation, not whole-program parity closeout.
> **Progress**: 0/6 tasks (0%)
> **Status**: Preflight passed — ready for independent specifications before code
> **Baseline**: `4e116829` — predecessor complete checkpoint green and locally committed; no push.
> **Scope**: strict
> **Reasoning**: high — anonymous memory observation, accumulator/flags and pre-emission storage closure

## Objective and boundaries

Forward an unsigned wrapping byte `+ nonzero constant` result directly from accumulator A into its
immediately adjacent fixed-address byte write. Remove only its anonymous temporary store/reload;
preserve every named-source load/store, volatile access and existing observation rule. This is
ordinary deterministic lowering in canonical `none`, not optional candidate search.

**Planning target:** the next bounded #168 lowering handoff. **Context:** frozen Specification 4,
RD-08, the qualified publication proof, existing register retention/raw-write lowering, current
boing source and equivalent 442-byte twin. **Modification set:** this mini-plan and derived roadmap;
one focused `packages/compiler/src/machine/byte-write-forwarding.ts` module and its import/selection
union in `lower-function.ts`; additive tests listed below; freshly measured downward boing compiler
cost pins. No existing specification edit is authorized.

Exclude changes to `sprite-publication-proof.ts`, `byte-capture-observers.ts`, named-source guards,
startup/layout, optimization policy, source syntax, target APIs, frozen specification/expert,
expressiveness ledger, hidden configuration, other issues or shared test infrastructure. No new
observer theorem, general solver, pass, registry, cache, harness, runtime or dependency. If any such
surface becomes necessary, stop for the reserved support-scope gate before tests or implementation.

## Grounded evidence and minimum-sufficient decision

The predecessor's actual full gate exited zero in 5,006.38 s: compiler 245 files / 4,046 passed
(2 skipped), root host 247/5,161, serialized VICE 130/2,379 (existing 1-file/4-test skips).
Canonical code is 1,309 versus equivalent twin 442: 867 bytes remain, with whole-frame timing open.

| Actual candidate              | Complete use trace                                | Current anonymous home / consumer |
| ----------------------------- | ------------------------------------------------- | --------------------------------- |
| `v53`, entry operation 79     | One operation occurrence at 80; no terminator use | `$2455` → `$D005`                 |
| `v57`, entry operation 84     | One operation occurrence at 85; no terminator use | `$2456` → `$D007`                 |
| `v223`, block 45 operation 29 | One operation occurrence at 30; no terminator use | `$244D` → `$D005`                 |
| `v227`, block 45 operation 34 | One operation occurrence at 35; no terminator use | `$244E` → `$D007`                 |

Primary traced all 52 original blocks of owner `src/main.blend:1485:5978`. Both existing operation
operand inventories agree, with branch/return operands counted separately. Every candidate is
8-bit unsigned wrapping `+21`, immediately followed by its sole one-byte write. The unchanged
certificate succeeds with nine publications. Complete profile storage windows are RAM
`[$0801,$CFFF]` and ZP `[$02,$8F]`; all four actual homes are covered.

Fresh generation `8695ce70-b928-48d4-a161-cbfa3e6b3cfe` has the exact retained-value CPU16
records and four `LDA $245F; CLC; ADC #$15; STA H; LDA H; STA $D005/$D007` cores.
These are baseline measurements, not future savings. The removable absolute pair costs 6 bytes /
8 nominal cycles locally. Future workload, resident storage and whole-frame costs require fresh
measurement; code savings can become padding rather than shorter payload.

**Smallest viable design:** select exact producer IDs once per source owner, then union them into
the existing `forwardedRegisterValues` set before retention. Byte arithmetic already produces A
(`lower-arithmetic.ts:57–85`); that set both suppresses a home (`lower-state.ts:680–687`) and
authorizes raw A consumption (`lower-operation.ts:1000–1005`). Fixed byte writes already emit the
single required store (`lower-memory.ts:472–494`). No scalar/memory lowerer rewrite is required.

The focused module avoids expanding the existing 641-line publication proof or refactoring legacy
large lowering files. The caller change is one import and one bounded selection union.

**Independent challenge:** the initial recommendation was conditional on this trace. After the
trace and green predecessor commit, the challenger returned **Justified — existing class is
sufficient**, confidence high. Whole-window raw-access disjointness, private unindexed roots,
single main-only ownership, no executable initializer/helper/IRQ, firmware-routing vetoes and
immutable asset fetch containment are producer-independent premises. Arithmetic requires no
initial-read exemption. This does not generalize the read-specific `hasUnobservedByteCapture`
query, fabricate a read or expand the accepted class. A reload-only alternative remains viable
but retains unnecessary anonymous traffic and requires the same fresh-A/observer proof.

These are compiler-owned technical decisions under the repository workflow directive. No new
product choice, support subsystem or exception is inferred from broad #168 approval.

## Selection contract and handoff

The new internal signature is:

```typescript
export function selectAnonymousByteWriteValues(
  input: MachineLoweringInput,
  source: SemanticFunction | undefined,
  blocks: readonly SemanticBlock[],
  singleUseValues: ReadonlySet<string>,
): ReadonlySet<string>;
```

Return an empty set for missing/stale/unsupported evidence, never a source diagnostic. Require:

1. Actual source/program/main association and original block identities, no metadata-only mode.
   Candidates belong to the certified reachable body; counting includes all original blocks.
2. Complete operand occurrence counts using existing queries, plus branch and nonvoid-return
   operands. Require one total use and membership in the supplied single-use set. Never count only
   memory-write consumers or trust the supplied set without the full count.
3. Producer is `binary` `+`, scalar `byte`, integer `{width:8,signed:false,wrap:true}`. Its right
   definition is an ordinary numeric `constant` in `[1,255]`. Do not admit conversions, signed/word
   arithmetic, subtraction or other operators under this selector.
4. The very next operation is `memory-write` of that result, width one, with a direct numeric
   address constant in `[0,65535]`. No gap, code-free conversion, cross-block use, dynamic address,
   named `store`, merge, call or second use qualifies. Existing proof must admit the destination.
5. After collecting candidates, require the unchanged complete `proveSpritePublications` result,
   even with no publications. No provisional-home special case or initial-read waiver. Preserve
   every named-source operation and every source MMIO width/order/count.

Use indexed linear scans and existing definition/literal/reachability helpers, not repeated block
prefix scans or recursive graph walks. At most one extra certificate query per owner with
candidates, never per expression; the old comparison and teardown consumers remain unchanged.
This is a fixed additional query, not a new memoization mechanism. Reassess if scaling evidence
requires material support beyond this bound.

The forwarded result remains A. Removing `STA H; LDA H` preserves A and all flags: stores change
none; in binary mode ADC's N/Z already describe the same byte LDA would reload, and C/V are
unchanged by LDA. Keep the existing explicit carry establishment and cooperative D=0 contract.
No new IRQ route, stack operation, helper or function storage is introduced. Selection runs before
inventory/binder closure; absent anonymous homes must not reappear during final binding/evidence.

## Independent specification handoff and acceptance

Only these new files may be authored by the implementation-blind spec author:

| Owned file                                                         | Boundary                                                                                                                      |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `packages/compiler/src/machine/byte-write-forwarding.spec.test.ts` | Signature-only selector positives and conservative barriers, including malformed/missing identity facts and all-use counting. |
| `test/rd05/byte-write-forwarding.spec.test.ts`                     | Public `none` assembly and complete costs; four cooperative profiles; returning/unsupported sources stay accepted.            |
| `test/rd05/byte-write-forwarding-vice.spec.test.ts`                | Independent byte-wrap/flags/MMIO behavior through the existing serialized monitor, PAL/6581.                                  |

The author may read governing requirements, semantic/type declarations, known boing source and
manifest, and supplied existing fixture signatures. Forbidden: new selector, transformation and
storage implementations, generated artifacts, implementation tests, qualification cases/graders/
oracle maps. Imports of tested entry points are allowed; reading their bodies is not. Supply mixed
file signatures as excerpts. Do not change existing specifications or test helpers.

| Case                                                                                                                                                              | Independent expectation                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Actual boing candidates and simple no-publication source                                                                                                          | Exact single-use candidates selected; adjacent arithmetic→fixed write has no anonymous STA/LDA pair. Preserve arithmetic/carry and one original device store.                                                                                                                              |
| Signed/word/nonwrapping/subtraction, zero/runtime right operand, dynamic/wide write, any gap or named store                                                       | Selector declines; ordinary source remains accepted where valid. Preserve named-source stores rather than teaching a source workaround.                                                                                                                                                    |
| Second operation occurrence, repeated operand, branch/return use, merge use, forged single-use set                                                                | Selector declines even when one adjacent write exists. Full counts include unreachable extra uses; candidates themselves must be reachable.                                                                                                                                                |
| Missing/foreign source, cloned/replaced block, metadata-only, missing domains/context, helper/IRQ/initializer, alias/raw-home access or low-RAM/CIA routing write | Selector declines through unchanged conservative premises. No new diagnostic and no read-specific query workaround.                                                                                                                                                                        |
| Private byte counter starts at zero, writes `counter+21` to `$D005`, then wraps `counter+=1` forever                                                              | At 257 successive write checkpoints, value and A are `(counter+21)&255`; N/Z/C/V match independent 8-bit addition, D stays zero, SP stays bounded/unchanged at corresponding points. The wrap exercises a prior carry of one without injecting an unsupported source asm operation.        |
| Complete real boing build                                                                                                                                         | Code strictly below 1,309 after qualification, seven-byte/nine-nominal-cycle EOR poll retained; asset 1,024, BASIC stub 12, payload 7,167. Entry 328/snapshot 49 and accepted source behavior unchanged; no new ZP/scratch/helper demand. Fresh storage/cost evidence, not predicted pins. |
| Existing source-derived startup/100-checkpoint trace and frame comparison                                                                                         | Run unchanged and pass. Preserve original register-write order/count, source-derived motion, SP/state and frame behavior. No whole-frame cycle or physical proof inferred.                                                                                                                 |

Existing signatures supplied to author: public `buildProject({project,target,optimization:"none"})`
returns success with generation directory/primary artifact; `buildProfileSource(source,target,
optimization?)` and `withProfileProject(source,target,callback)` in `profile-fixture.ts`;
`readProfileArtifacts(BuildSuccess)` returns detached assembly/labels/PRG and parsed evidence.
Public memory JSON uses **exclusive ends** (`size=end-start`); program cost entries use component
`startup` for the 12-byte BASIC stub. Internal layout intervals are not this JSON interface.
CPU16 code filtering must exclude overlapping device projections when reconciling bytes.

VICE uses only existing `startVice`/`stopVice`, `setExecuteCheckpoint`, `setStoreCheckpoint`,
`readIo`, `readCpuRegisters`, `waitForStop` armed before `resume`, and checkpoint cleanup. Monitor
memory/I/O read ranges are inclusive, unlike public JSON intervals. The execution owner supplies
exact signatures; no monitor extension, injected CPU-register API or new runner. Semantic
expectations may already pass before implementation; selector/output assertions must demonstrate
meaningful RED. Frozen expectations never follow measured future output.

## Specialist Agents

**New specialist check: None.** Existing correctness, semantics/DX, SFA/ABI, platform,
machine-code and host-performance roles cover this same handoff (`codeops/agent-routing.md:52–59`).
No new domain or recurring gap needs another role. All six lenses review the bounded execution;
independent preflight uses the existing five dimension clusters, not another full audit team.
Expert authority remains qualified `2.0.4`, content `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`;
Optimization Contract, Loads/Stores, Addition/Subtraction and CPU Instruction Effects govern.
Source keys: `BLEND65-SPEC-4-038b70e9`, `MOS-PGM-1976`, `CBM-C64-PRG-1982`.

## Tasks

- [ ] T-168.16 Independently author the three assigned specifications from this contract/signatures after preflight; validate adapters, record meaningful RED and freeze before code.
- [ ] T-168.17 Implement the focused selector and existing forwarding-set union; pass selector and public assembly specifications without changing old observation helpers or source.
- [ ] T-168.18 Verify independent byte/flags behavior and unchanged boing startup/trace/frame/poll suites; measure complete costs and update only downward implementation pins.
- [ ] T-168.19 Add implementation controls for stale/cold/multiple uses, retention/binder closure and bounded query/scan costs; run affected regression tiers.
- [ ] T-168.20 Obtain all six independent phase reviews; resolve findings within exact authority and reverify, without widening this unit.
- [ ] T-168.21 After install/build/typecheck and changed+host, run the actual complete workspace/host/serialized VICE checkpoint; record residual/deferral assessment, sync roadmap and commit a coherent green checkpoint through the git-commit skill. Never push or close #168 without its complete boundary.

**Verify:** directed compiler and public integration suites; affected serialized VICE; then
`yarn test:changed --host`. At phase checkpoint `yarn install --frozen-lockfile`, `yarn build`,
`yarn typecheck`, `yarn test:full` (includes complete workspace/host and serialized VICE). No
competing emulator processes or full-suite runs per edit. Temps belong under `$CODEOPS_TMPDIR`
and are deleted after persistent evidence; no secrets/environment/credential/uncertain hidden
access. Plan-only work checks formatting, links and source keys, not compiler qualification.
