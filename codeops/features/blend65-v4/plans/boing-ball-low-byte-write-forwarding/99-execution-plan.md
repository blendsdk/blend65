# Boing-ball low-byte extraction write forwarding

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Owner**: [#168](https://github.com/blendsdk/blend65/issues/168), not whole-program closeout
> **Progress**: 6/6 tasks (100%)
> **Status**: Done — six reviews and actual complete checkpoint GREEN; bounded local checkpoint
> **Qualified checkpoint**: `sh_1eb38546b001YqIr0lDUtvYty1` — actual `yarn test:full` exits zero; all 41 guarded inputs unchanged
> **Baseline**: `ee9bb67d`; clean local green checkpoint, never pushed
> **Phase baseline tree**: `d93fc479e9fc34899fe0d4a01a9fa0d3092be81e` — complete clean worktree at task entry, before all plan/specification work
> **Scope**: strict
> **Reasoning**: high — anonymous storage observation and pre-emission register lifetime

## Objective and authority

Remove the anonymous byte capture between an ordinary word's `lo` extraction and its sole,
immediately adjacent, fixed-address volatile byte write. Preserve the original named-word read,
every named store, all device accesses, source behavior and canonical `optimization: "none"`.
Keep #168 open for equivalent whole-program code and whole-frame timing.

**Planning target:** the next bounded #168 lowering handoff. **Context:** completed byte-write
and startup units, unchanged publication certificate, extraction lowering, SFA retention and
the boing source/equivalent 442-byte twin. **Modification set:** this mini-plan and its review/
execution evidence, derived roadmap summaries, the existing `byte-write-forwarding.ts` selector,
additive tests listed below and only freshly measured downward compiler implementation-cost pins.
No existing specification-test edit is authorized.

Do not change the publication proof, capture-observer queries, named-source guards, extraction/
memory lowerers, startup/layout, optimization policy, source/example/twin, target APIs, frozen
specification/expert, ledger, hidden configuration or shared test infrastructure. No new pass,
analyzer, solver, cache, registry, runtime, harness, dependency or IRQ contract. A need for such
support stops this unit for the reserved complexity/scope decision; do not widen silently.

## Grounded current state and selection

Fresh public build `3b3986bc-6600-4ff4-810a-745944bf5b99` from unchanged boing inputs reproduces
PRG SHA-256 `a078f81092528beff9388204690ff67a207a6082a3b3c84f791385a5cd41ec58`.
Actual costs: code 1,241, startup entry 326, assets 1,024, padding 4,890, BASIC stub 12,
payload 7,167, CPU16 SFA 45, platform snapshot 49, resident RAM 7,261, ZP/scratch 0.
The equivalent twin remains 442 code bytes: gap 799. Whole-frame timing is Unknown.

The primary traced all 52 original blocks of owner `src/main.blend:1485:5978`, counting operation
and branch/return occurrences independently. Each listed unary result has one total use, its
immediately following one-byte volatile write. Its immediately preceding operation is the exact
ordinary scalar-word load supplying that unary operand, also used once.

| Result | Original block/index | Current CPU16 home | Fixed consumer |
| --- | --- | --- | --- |
| `v36` | 0/56 | `$244C` | `$D000` |
| `v39` | 0/60 | `$244D` | `$D002` |
| `v42` | 0/64 | `$244E` | `$D004` |
| `v45` | 0/68 | `$244F` | `$D006` |
| `v206` | 45/6 | `$2446` | `$D000` |
| `v209` | 45/10 | `$2447` | `$D002` |
| `v212` | 45/14 | `$2448` | `$D004` |
| `v215` | 45/18 | `$2449` | `$D006` |

The unchanged certificate succeeds with nine publications. All actual homes are inside its complete
RAM `[$0801,$CFFF]` window; ZP is `[$02,$8F]`. CPU16 memory records identify all eight as distinct
one-byte `retained-value` requests, not named locals. Actual assembly has eight
`LDA named-low; STA anonymous; LDA anonymous; STA fixed` cores.

Removing those absolute pairs predicts 48 local code bytes and eight capture demands removed.
Four occur at startup and four per loop: 32 nominal CPU cycles per group, before layout,
DMA, firmware or interrupt effects. These are expected local deltas, not measured future totals,
payload savings, deadlines or whole-frame timing. Remeasure all complete costs after implementation.

Independent challenge selected this same low-byte-to-write unit, with medium confidence until
the semantic trace/certificate was supplied. The trace above closes that factual prerequisite.
High-byte branches need separate flag/terminal-use proof; arithmetic into named destinations needs
destination tracing; repeated immediate reuse gives less demonstrated benefit. Reload-only
removal is viable but leaves the anonymous stores/homes and needs the same freshness proof.
These are compiler-owned technical choices under AGENTS.md, not new product decisions.

## Smallest viable design and exact contract

Extend the existing selector's producer predicate, without changing its exported signature or
caller union:

```typescript
selectAnonymousByteWriteValues(
  input: MachineLoweringInput,
  source: SemanticFunction | undefined,
  blocks: readonly SemanticBlock[],
  singleUseValues: ReadonlySet<string>,
): ReadonlySet<string>
```

Existing wrapping byte-addition selection and every old oracle remain unchanged. Add only:

1. Producer is `unary` `lo`, scalar `byte` result.
2. Its operand definition is the exact immediately preceding ordinary `load`, scalar `word`,
   with an empty place path and scalar-word root type. No computed, constant, symbolic, converted,
   signed, byte-width, indexed, aggregate, raw-read or platform operand under this new arm.
3. Both the load result and extraction result have one complete operand/terminator occurrence
   and membership in the supplied single-use set. Count all original blocks, including cold uses.
4. The next operation is the existing exact one-byte volatile write of the extraction result,
   with a direct numeric address constant in `[0,65535]`. No gap, named store, comparison,
   branch/return consumer, dynamic/wide destination or second use.
5. Reuse unchanged actual-source/program/main association, original block identity/order,
   reachable-producer and whole-window publication-certificate requirements. Missing, stale or
   unsupported facts return no added IDs, never a diagnostic or source rejection.

Share existing definitions, use counts, reachability and final certificate query. At most one
certificate query per selector invocation with any candidates, never per extraction. No refactor
of other selectors or proof machinery. Keep the selector small and linear apart from the already
owned certificate's existing complexity.

`lower-unary.ts:538–548` already loads the selected source byte into A and sets N/Z.
`lower-state.ts:680–687` bypasses its anonymous retention when forwarded; the existing caller
union is `lower-function.ts:335–345`. `lower-memory.ts:472–494` emits the fixed store.
No new lowerer/state field is needed. Omitting `STA H; LDA H` leaves A/N/Z/C/V identical:
the original extraction load establishes N/Z, STA changes no flags and the deleted reload would
re-establish the same N/Z. No arithmetic, source read or source device store moves or disappears.
No new register clobber, stack, helper, data or post-closure storage is introduced.

## Independent specification handoff

The implementation-blind author owns only these new files:

| File | Required expectations |
| --- | --- |
| `packages/compiler/src/machine/low-byte-write-forwarding.spec.test.ts` and `low-byte-write-forwarding-barriers.spec.test.ts` | Exact new selector arm and producer/address shapes; separate complete-use/identity/observer barriers. Preserve all independently authored 49 cases and old addition selection. |
| `test/rd05/low-byte-write-forwarding.spec.test.ts` | Public canonical-none assembly and actual CPU bytes on all four cooperative profiles; complete boing cost/resource bounds and continued fallback source acceptance. |
| `test/rd05/low-byte-write-forwarding-vice.spec.test.ts` | Independent low-byte values, A/flags, exact 257 ordered device writes and unchanged stack through existing serialized monitor. |

Supply only governing contract, allowed semantic/type declarations and fixture signatures.
Forbidden to author: all machine/semantic/storage implementation bodies, generated output,
implementation tests, existing qualification cases/graders/maps and prior review answers.
Allowed imports do not authorize reading tested implementations. The execution owner supplies
mixed-file declaration excerpts and runs RED/adapter validation. Formatting expanded the original
selector specification to 573 lines. Extract only its already-authored source-to-closure and
mutation adapter, unchanged, into component-local `low-byte-write-forwarding-test-support.ts`,
shared by the two immediately owned selector specifications. This test-only fixture replaces
duplication; it is not shared test infrastructure, a new harness, runner or analyzer. The native
spec author writes only specification files; the execution owner mechanically extracts the adapter
before freeze, with independent structural fit recheck and all 49 expectations unchanged.

| Input/control | Independent expectation |
| --- | --- |
| Ordinary initialized private `word`, `poke($D005,lo(value))` in a closed nonreturning main | Select exactly the extraction ID; direct original named-byte load followed by one fixed store, no anonymous pair. |
| `hi`, signed/byte operand, constant/computed/converted operand, field/index path, wrong result/root type, foreign definition, missing preceding load | No new selection; ordinary legal source remains accepted by general lowering. |
| Extra operation/terminator/cold use of either load or extraction, forged single-use set, gap, merge, named store, dynamic/wide/nonvolatile write | No new selection; do not change existing source restrictions or named-source operations. |
| Missing/foreign main, cloned/reordered blocks, metadata-only, helper/initializer/IRQ, raw-home access, address escape, low-RAM/CIA routing write | No new selection through unchanged conservative proof premises. |
| Boing source unchanged | Eight extraction-write pairs gone; code strictly below 1,241, SFA at most 37, resident RAM at most 7,253, entry 326/snapshot 49/assets 1,024/BASIC 12/payload 7,167/ZP 0/scratch 0 unchanged. Preserve seven-byte EOR poll and the four high-byte comparison captures. |
| Runtime seed `$12A5`, each iteration `value=value+257; poke($D005,lo(value))` | At ordinal `i=0..256`, full word is `($12A5+257*(i+1))&$FFFF`; device/A is its low byte, N/Z match it, D=0, C/V match the preceding independent 16-bit addition, I/SP unchanged at corresponding points. Includes carry/word wrap and different high/low bytes. |

Behavior and output expectations are independent. Use exact post-store execute sampling, a
non-stopping write trace, final pre-next-store drain and exactly 257 writes, as established in the
prior adapter ruling; no shared-monitor edit or timing-limit increase. Arm `waitForStop` before
resume. Keep safe-return test/helper and their original 20-second waits unchanged.
The new runtime source must have one unique application `STA $D005`; locate only actual CPU16
code (exclude device projections/assets), not coincidental bytes or assumed offsets.

Existing signatures: `buildProfileSource(source,target,optimization?)` returns assembly/labels/
PRG and detached memory/cost/build records; public `buildProject({project,target,optimization})`
returns a generation on success. Public memory intervals use exclusive ends; VICE reads use
inclusive ends. `startVice`/`stopVice` and monitor execute checkpoints, access tracepoints,
register/I/O reads, `takeCheckpointHits` and cleanup already exist. No adapter extension.
Public behavior/source acceptance may already pass; selector/output shape must show meaningful
RED, not a missing module, illegal source or setup failure. Freeze additive oracles before code.

## Context, review and specialist check

Lens: compiler/language. No format/schema migration, server/auth boundary or new concurrency route.
C64 PAL NMOS6510, cooperative KERNAL/6581 PRG is the measured workload; public output checks also
cover PAL/NTSC and 6581/8580 cooperative profiles. ACME 0.97, VICE 3.10. Existing stock firmware
IRQ/NMI contracts remain unchanged; unrestricted external firmware completion/stack/deadlines and
physical timing are unproved. No generated hook/loader is added. BASIC/KERNAL owns loading;
load time, initialization cycles and whole-frame timing are Unknown unless separately measured.
Code/storage evidence is not runtime or physical proof.

**New specialist check: None.** Existing correctness, semantics/DX, SFA/ABI, platform,
machine-code and host-performance roles cover this same seam; bounded packets suffice. All six
lenses review execution. Independent preflight uses the five dimension clusters plus compiler
semantics, not another full audit team. Expert `2.0.4`, content
`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`; references:
`6502-lowering-casebook.md#loads-stores-and-moves`,
`mos-6502-family.md#instruction-effects`,
`evidence-parity-and-recovery.md#transformation-proof`/`#equivalent-work-accounting`,
`c64-game-engineering.md#machine-bound-workload-completion-gate`.
Source keys: `BLEND65-SPEC-4-038b70e9`, `MOS-PGM-1976`, `CBM-C64-PRG-1982`.

## Tasks

- [x] T-168.29 Preflight this bounded plan; independently author/validate additive specifications, record meaningful RED and freeze before implementation. Completed 2026-11-17 21:05: six preflight clusters clear; independent author preserves 49 selector cases across 29 producer/address + 20 barrier cases, 16 public and four runtime cases. Actual RED: two missing-selection positives and eight anonymous-pair output failures; 55 negative/acceptance controls pass. Corrected prefreeze async/monitor signature adapters, no changed semantic expectation; all four 257-write runtime cases pass. Local fixture extraction independently fit-rechecked. Five spec/fixture hashes frozen in verification before production code. Compiler/helper and directed spec static checks pass with the separately reproduced pre-existing optional-root typing defect disclosed.
- [x] T-168.30 Extend only the existing producer predicate and pass selector/public assembly specifications; preserve all old contracts and frozen hashes. Completed 2026-11-17 21:07: one producer arm in the existing selector; shared counts/reachability/certificate and old addition contract unchanged. New and old selector specifications107/107, public output38/38 and compiler reference build pass. All five new frozen hashes match; no existing-oracle edits. Documentation self-check clear.
- [x] T-168.31 Run independent runtime and unchanged boing behavior/startup/trace/frame/poll checks; measure complete current costs and update only verified downward implementation pins. Completed 2026-11-17 21:11: fresh canonical code1,193/SFA37/resident7,253; exactly eight capture homes gone, payload7,167/entry326/snapshot49/ZP0/scratch0 unchanged. Actual selected six-byte cores and identical326-byte startup verified. Downward implementation pin passes in80/80 host output/cost regressions. Affected serialized VICE13/13 pass across six files, including four-profile257-write behavior and unchanged boing trace/startup/frame comparison. Gap751; whole-frame timing still Unknown.
- [x] T-168.32 Add implementation controls for complete uses, stale identity, no post-closure capture demand and bounded shared scans/query count; run directed regression tiers. Completed 2026-11-17 21:11: all eight implementation controls pass, covering nonmutation, malformed graphs, conflicting definitions, iterative6,000-block chain,256 extractions sharing one real certificate query and absent capture demands in closed inventory/required storage. Ten directed compiler files178/178 and five host files80/80 pass. Frozen hashes and documentation self-check remain clear.
- [x] T-168.33 Obtain six independent execution reviews; resolve and reverify findings within exact authority. Completed 2026-11-17: correctness, semantics/DX, SFA/ABI, machine-code, target-platform and host-performance all return no findings. Exact code/storage/flag/MMIO and resource boundaries reviewed; five-field current release metadata and bounded authority excerpts supplied where requested. Host reviewer received exact patch/new-file delta after initial packet insufficiency; no verdict inferred before completed review. No fix, wider support or old-oracle exception needed. Directed GREEN unchanged; final host/complete checkpoint remains due.
- [x] T-168.34 Run frozen install/build/typecheck, changed+host and actual complete workspace/host/serialized VICE checkpoint; record scoped residual/deferral assessment, sync roadmaps and commit locally through the git-commit skill. Completed 2026-11-17 22:50: changed+host and fresh host checkpoint passed; final formatting/frozen install/build/typecheck pass. Actual complete job sh_1eb38546b001YqIr0lDUtvYty1 exits0 in4,533.332s: cached compiler253files/4,223passed+2existing skips and CLI70/server21/editor18 replay the immediately preceding fresh host checkpoint; fresh complete host249files/5,199tests and serialized VICE133files/2,387tests pass, with only existing1file/4test VICE skips. All41 inputs and five frozen oracle/fixture hashes unchanged. Safe-return passes with original waits; old timeout cause remains Unknown. Scoped deferral assessment reconfirmed; feature roadmap updated, portfolio cascade remains integration-owned on v3. Coherent green local commit follows; no push or #168 closure.

**Task verify:** new selector specifications with unchanged byte-write selector specs; new public
output spec with unchanged byte-write/publication/poll/dead-teardown/cost cases; affected serialized
VICE; compiler implementation controls. Run `yarn test:changed --host` then `yarn test` before a
normal checkpoint; phase closeout runs `yarn install --frozen-lockfile`, `yarn build`,
`yarn typecheck`, `yarn test:full`. No competing VICE, full corpus per edit or isolated-pass
replacement for a complete green gate. A new safe-return timeout requires bounded diagnosis
before another complete invocation, never an automatic retry. Plan-only work validates targeted
formatting, links and source keys, not the compiler suite. Temps stay under `$CODEOPS_TMPDIR`
and are cleaned after durable evidence; sensitive paths and native denials remain protected.
