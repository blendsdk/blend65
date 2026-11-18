# Boing-ball byte arithmetic assignment forwarding

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Owner**: [#168](https://github.com/blendsdk/blend65/issues/168); bounded continuation, not parity closeout
> **Progress**: 6/6 tasks (100%)
> **Status**: Done — GREEN implementation committed locally; owned cleanup complete; #168 remains open
> **Implementation commit**: `9bbc9ead` — no push
> **Completed checkpoint**: `sh_1f0ca5405001VwYtT4PvOtS3t5` — actual `yarn test:full` exits0 in4,428.818s;44 inputs unchanged
> **Prior failed checkpoint**: `sh_1f004276f001RhNIj0UrSIh2jh` — exits1;42 inputs unchanged; retained historical evidence
> **Baseline**: `ec8a696e`, clean green local checkpoint; no push
> **Phase baseline tree**: `d9fb65a8ddf111f5f1cb2e8c01179e35c6d04e8e`
> **Scope**: strict
> **Reasoning**: high — anonymous storage observation, arithmetic flags and pre-emission lifetime
> **Created**: 2026-11-18

## Objective and scope

Remove only the anonymous capture/reload between an unsigned wrapping byte `+`/`-` result and
its sole immediately adjacent whole-variable byte assignment. Preserve every original operand
evaluation, named load/store, volatile access, flag outcome and canonical `optimization: "none"`.
Ordinary unsupported source retains existing lowering, without a new diagnostic or restriction.

**Planning target:** the next bounded #168 unit. **Context:** the completed low-byte unit,
current source/lowering/storage interfaces, unchanged publication/observer certificate, exact
fresh boing baseline and equivalent 442-byte twin. **Modification set:** this mini-plan and its
review/evidence records, derived feature roadmap, existing `byte-write-forwarding.ts` selector,
its one caller in `lower-function.ts`, additive specification/implementation tests and one
freshly measured downward boing implementation-cost pin. Existing specification tests have no
edit authority.

Do not alter arithmetic/store/retention lowerers, proof/observer machinery, source/assets/twin,
startup/layout/IRQ contracts, frozen specification/expert, shared helpers/timeouts, hidden
configuration or optimization policy. No new pass, analyzer, solver, runtime, framework,
dependency, cache, harness or cross-cutting refactor. A demonstrated need for a material support
mechanism or upstream oracle correction stops this unit for exact user-owned authority.

## Grounded baseline and smallest viable design

Fresh canonical public generation `87f78493-2811-43e1-9072-b56462a096d0` reproduces PRG SHA-256
`b8f5771116ba30b40851604c0a714954dc6970e19ce7c28d4534d0a4fc659d77`.
Code 1,193, SFA37, resident RAM7,253, entry326, snapshot49, assets1,024, BASIC12, padding4,938,
payload7,167, ZP/scratch0, reported hardware-stack resource1. Equivalent twin442; remaining
code gap751. Hardware stack1 is not an unrestricted firmware/interrupt aggregate bound.

The primary traversed all52 original blocks and complete operation/branch/return uses.
Seven reachable byte arithmetic results have one total use and an immediate empty-path byte
store. Their integer semantics are width8, unsigned, wrapping. Two are variable-plus-variable;
five use direct constants. The unchanged certificate succeeds with nine publications.
Each baseline CPU16 home is a distinct one-byte retained-value request:

| Result | Block/index | Operator | Anonymous → named destination | PC of `STA H; LDA H; STA named` | Actual bytes |
| --- | --- | --- | --- | --- | --- |
| `v80` |6/9 | `+`, runtime RHS | `$244B→$2455` | `$0A4D` | `8D 4B 24 AD 4B 24 8D 55 24` |
| `v112` |16/2 | `+2` | `$243D→$244D` | `$0BBC` | `8D 3D 24 AD 3D 24 8D 4D 24` |
| `v115` |17/2 | `-2` | `$243E→$244D` | `$0AB6` | `8D 3E 24 AD 3E 24 8D 4D 24` |
| `v134` |30/2 | `+1` | `$243F→$2452` | `$0AFF` | `8D 3F 24 AD 3F 24 8D 52 24` |
| `v142` |33/2 | `+1` | `$2440→$2450` | `$0C52` | `8D 40 24 AD 40 24 8D 50 24` |
| `v159` |39/2 | `-1` | `$2443→$2450` | `$0BE0` | `8D 43 24 AD 43 24 8D 50 24` |
| `v186` |44/6 | `+`, runtime RHS | `$2445→$2455` | `$0C1F` | `8D 45 24 AD 45 24 8D 55 24` |

Each exact nine-byte core occurs once in actual CPU16 code, not in device projections/assets.
Removing its first two instructions predicts42 code bytes and seven capture demands saved;
each executed site saves eight nominal CPU cycles. Sites occur on different paths: neither
56 cycles/frame nor a whole-frame improvement is established. Code can turn into padding, not
payload savings. Complete post-change costs and any branch-layout effects must be measured.

Independent Astra challenge `ses_e10ffcb40ffeUsLKeOnvdWT7QF` converges on this unit:
same byte emitter and store consumer, but word assignments change low/high scheduling and need
a separate proof. Constants-only loses two same-seam sites without avoiding the observer proof.
Reload-only saves half the traffic and no homes. Shifts/multiplication and high-byte branches
have different producer or flag ownership. They remain outside this unit.
Confidence: high in the traced seam; measured future benefit remains unverified.

### Existing seam

`lower-arithmetic.ts:57–86` already produces the byte result in A with binary `CLC/ADC` or
`SEC/SBC`. `lower-state.ts:680–687` bypasses capture allocation for selected IDs.
`lower-operation.ts:512–522` consumes A directly for an empty-path byte store.
The existing caller union is `lower-function.ts:335–345`. No new lowerer or state field is needed.

Extend the existing selector signature with an optional internal opt-in:

```typescript
selectAnonymousByteWriteValues(
  input: MachineLoweringInput,
  source: SemanticFunction | undefined,
  blocks: readonly SemanticBlock[],
  singleUseValues: ReadonlySet<string>,
  includeNamedArithmeticStores?: boolean, // defaults false
): ReadonlySet<string>
```

The only production caller passes `true`. Four-argument callers retain the exact current raw-write
contract, including named-store rejection. This is not a user option or optimization mode.
Reuse the same definitions, complete-use/reachability scans, candidate set and one final unchanged
publication-certificate query. No second selector traversal/query or generic policy engine.

### Exact new arm

1. Explicit opt-in is true.
2. Producer is binary `+` or `-`, scalar `byte`, integer width8, unsigned and wrapping.
   Both runtime operands and constants are supported; no operand read or materialization is
   removed by this arm. BCD, signed, word, other operations and conversion chains are excluded.
3. Producer result belongs to supplied single-use values and has exactly one independently counted
   operand/terminator use over all original blocks, including cold blocks and hidden place indices.
4. The immediately following operation is `store` of that result, scalar `byte`, empty place path
   with scalar-byte root type. No gap, indexed/field destination, width conversion, merge,
   raw destination, branch or return consumer.
5. Existing actual-source/program/main association, exact block identity/order, graph validity and
   reachable-producer requirements hold. The unchanged whole-window publication certificate
   excludes globals/parameters, escaping roots, helpers, source-installed interrupts and uncertain
   raw/hardware/firmware observers. Missing/stale proof facts select ordinary lowering.
6. Add only the arithmetic result ID to the existing forwarding set. Named binding/storage/store
   and operand operations remain; no binding elision, INC/DEC/RMW substitution or flag-forwarding
   authority is introduced.

For binary arithmetic, A/N/Z already describe the byte result. Removing an anonymous `STA/LDA`
pair preserves A/N/Z/C/V, X/Y/SP/D/I. STA does not change flags. This reasoning does not extend
to NMOS decimal arithmetic. Named-store order stays exactly where the source store was;
there is no low/high-byte scheduling change. Selection happens before capture storage discovery,
not after allocation.

## Independent specifications and acceptance

Implementation-blind Sol author receives only this contract, allowed type declarations,
public fixture signatures and normative excerpts; no implementation bodies, generated artifacts,
implementation tests, old test/oracle bodies, qualification cases/maps/graders or prior verdicts.
Imports do not grant read authority. Primary owns all shell/RED/VICE execution.

Author only additive `byte-assignment-forwarding*.spec.test.ts` files under
`packages/compiler/src/machine/` and `test/rd05/`, split by concern near200–300lines.
A small component-local source-to-closure/mutation adapter may be mechanically extracted before
freeze by the primary if needed; reuse existing local fixture public signatures where practical.
No new shared test infrastructure or runner. Freeze all new oracles and consumed fixture hashes
before implementation. No existing oracle edits, skips or weakened thresholds.

| Boundary | Independent expected result |
| --- | --- |
| Opt-in positive | Both byte `+` and `-`, direct constants including0/255 and runtime RHS, same or different private destination: select only the arithmetic result, never an operand or named binding. |
| Default control | Four-argument call keeps named-store rejection; old raw byte-add and low-byte-write cases remain selected exactly as before. Opt-in does not extend raw subtraction/runtime arithmetic or low-byte named stores. |
| Negative shapes | Signed/word/BCD/other operators, wrong result/store/root types, nonwrapping arithmetic, indexed/field/converted/gapped/multiple-use/branch/return consumers keep ordinary lowering. |
| Graph/use/proof barriers | Cold/terminal/hidden-index extra use, forged single-use set, foreign/cloned/reordered body, cold producer, malformed entry/successors, missing domain/context, metadata-only, global/parameter/helper/initializer/IRQ, escaping address, raw-home/unknown address/CIA/low-RAM routing observation: no new IDs. |
| Public output, four cooperative profiles, canonical none | Preserve original operand loads and carry establishment; ADC/SBC result goes directly to original named STA without anonymous pair, alternate scratch or named-store removal. Independently check assembly and actual CPU16 code bytes. Unsupported legal source still compiles. |
| Boing, unchanged source | All seven selected capture homes gone; complete code at most1,151, SFA at most30, resident at most7,246. Entry326/snapshot49/assets1,024/BASIC12/helper0/payload7,167/ZP0/scratch0/reported stack1 remain; reconcile code+assets+padding+BASIC+helpers=payload. Preserve EOR raster poll, four hi-branch captures, word arithmetic staging, source trace and frame state. |
| Independent runtime | For addition/subtraction with seed `$A5`, constant37 or runtime `step:byte=37` increasing by1 after publication, calculate each of257 modulo256 results and C/V/N/Z independently. Named byte memory, A and MMIO value agree; D=0 and I/SP stable. Exact257 named destination stores and257 device writes in source order during the measured interval. |

Runtime source `module Game; function main():void {let value:byte=$A5; let step:byte=37;
while(true){value=value+step;poke($D005,value);step+=1;}}`, with separate `-` and constant37 forms.
Locate unique application `STA $D005` only within actual CPU16 code; derive named destination
from the immediately preceding ordinary named-byte load and cross-check its SFA interval.
Pre-first-store stop is before the **first named assignment store**, so the traced interval includes
the first assignment. Trace that named address and `$D005` with non-stopping store tracepoints.
Sample post-device-store via execute stops, armed before resume; collect independent257 state
observations. After sample257, stop before the next named assignment store and drain exactly257
named/257 device writes, verifying alternating event order. Do not advance to a boundary that
already executes the258th assignment. Exclude initialization from traces.

Keep shared monitor/source helper/safe-return and original20-second waits unchanged.
No register `.pc` member: `waitForStop` returns the exact PC; registers expose A/X/Y/P/SP.
Existing30-second directed stop wait/300-second test envelope may be reused, never increased
to hide a failure. If a new source/address adapter rejects, classify setup separately from
meaningful RED. Selector/output must fail for the missing behavior, not a nonexistent export.
The optional fifth-argument contract can be expressed by a typed wider callable declaration:
TypeScript accepts the current four-argument function as that callable before implementation.
Do not create a missing-module RED or implement selection before oracle freeze.

## Review, verification and authority

Compiler/language lens. Existing six roles cover correctness/oracle integrity, semantics/DX,
SFA/ABI, emitted code, platform and host scaling. **Specialist check: None** — existing
specialists plus bounded packets cover this same seam; no new capability/charter is needed.
Preflight assigns all13 dimensions once in five clusters and an additional compiler-domain lens.
No new host-input/process/security mechanism, format migration or concurrency route.

Context: C64 PAL NMOS6510, VIC6569, KERNAL cooperative6581 PRG, bank0/screen `$0400`/pointers `$07F8`;
public/runtime qualification also covers NTSC/VIC6567 and6581/8580. ACME0.97/VICE3.10.
BASIC/KERNAL owns loading and existing startup; no generated interrupt route/loader is added.
Existing stock routes remain unchanged. Loading time, elapsed initialization, whole-frame
timing, external IRQ/NMI aggregate stack/completion/deadlines and physical behavior remain Unknown
unless separately measured. Runtime result is VICE-verified / hardware-unverified.

Expert2.0.4, active qualified/frozen, immutable content
`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`; router SHA-256
`0760ec9d73fc7ed0e8575eb22d3fa9e5bdd2388d27b3989233239342c0b35ad8`;
specification `BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b`.
Normative headings: `6502-lowering-casebook.md#addition-and-subtraction`,
`mos-6502-family.md#status-flags-as-dataflow`, `sfa-and-abi.md#final-storage-closure`,
`blend65-semantics.md#semantic-preservation-checklist`,
`evidence-parity-and-recovery.md#transformation-proof`/`#equivalent-work-accounting`,
`c64-game-engineering.md#machine-bound-workload-completion-gate`.
Source keys `BLEND65-SPEC-4-038b70e9`, `MOS-PGM-1976`, `CBM-C64-PRG-1982`.
Historical crosswalk preambles incidentally read during primary navigation are excluded from
decisive authority. No qualification answer maps or cases are used.

## Tasks

- [x] T-168.35 Independently preflight this bounded plan, author additive specifications, validate setup, establish meaningful RED and freeze before production implementation. Completed 2026-11-18 15:46: six preflight clusters clear. Fresh blind author114 cases across six files:67 internal/30 public/16 runtime/one cost. Exact prefreeze setup/contract corrections recorded, no implementation input or semantic weakening. Meaningful RED16 selector+16 output+one cost;51 internal/14 public controls and16 independent runtime cases pass. Directed internal/root strict typing and formatting pass in declared modes. Six new oracle files plus consumed unchanged fixture hashes frozen before production; original27 boundaries unchanged.
- [x] T-168.36 Add only the opt-in selector arm and one caller opt-in; pass new/old selector/public specifications with frozen hashes and no lowerer/proof changes. Completed 2026-11-18 19:28:174 selector and69 public checks pass after the exact user-approved AR-P1 expression correction. Reverse reconstruction reproduces the original frozen hash, proving no extra test edit; cost oracle re-frozen as4a2569f18f82839cfb5fd8e490a3b1b90698cf44fff01cbe648b26174accfeeb. Other six consumed oracle/fixture hashes unchanged; no lowerer/proof change or wider authority.
- [x] T-168.37 Verify independent runtime plus unchanged boing startup/source trace/frame/poll; measure complete output/storage/padding costs and update only the downward implementation pin. Completed 2026-11-18: code1,151/SFA30/resident7,246/payload7,167 measured; seven exact capture homes absent and actual direct ADC/SBC-to-named-STA cores verified. Startup326 bytes identical. Downward implementation pin passes; seven affected serialized VICE files29/29 pass in121.128s, including16 independent257-pair cases and unchanged startup/source/frame tests. Remaining code gap709; whole-frame timing Unknown.
- [x] T-168.38 Add implementation controls for complete uses/identity, one certificate query, bounded traversal and absent final capture demands; run directed compiler/host regressions. Completed 2026-11-18: eight controls pass, including original-object preservation, default no-proof path, malformed graphs,6,000-block iterative traversal,256 assignments/one real query and absent inventory/required capture requests. Directed14 compiler files253/253 and seven host files111/111 pass. Seven current oracle/fixture hashes match; only approved AR-P1 exception.
- [x] T-168.39 Obtain all six independent execution reviews against the actual baseline/delta; resolve/reverify findings only within exact authority, stopping for reserved scope/oracle decisions. Completed 2026-11-18: correctness, semantics/DX, SFA/ABI, emitted code, platform and host performance return no findings. Direct code/schema authority and exact AR-P1 boundary checked; artifact/test execution remains primary-owned. Required current metadata/router/SFA excerpts supplied with explicit limits. No fix or expanded exception needed. Host and complete gates remain due.
- [x] T-168.40 Run final frozen install/build/typecheck/formatting, changed+host, fresh host and actual complete serialized VICE checkpoint; record residual/deferral evidence, sync feature roadmap, commit green locally via git-commit skill and clean owned temps. Complete 2026-11-19: final prechecks pass; actual full exits0 in4,428.818s, fresh host5,230 and serialized VICE2,403 pass/4existing skips. Workspace results replay prior fresh compiler4,298/2existing skips, CLI70/server21/editor18. All44 inputs unchanged; AR-P2 normal3/controlled12/fault18/protocol6 and three fix reviews clear. GREEN implementation committed locally as `9bbc9ead`; owned temporary tree and baseline dependency symlink removed safely. No push; #168 remains open.

**Task verify:** explicit new selector specification files plus existing byte-/low-byte-write and
publication tests; new public output with unchanged poll/cost cases; affected VICE serially.
Use scoped Vitest commands declared by existing configs. `yarn test:changed --host`, then
`yarn test` before normal checkpoint; final `yarn install --frozen-lockfile`, `yarn build`,
`yarn typecheck`, `yarn test:full`. Full corpus is not per-edit verification. A further safe-return
timeout requires bounded diagnosis before another complete invocation, never automatic retry.
Protect frozen `spec/`, expert, old tests and source with recorded hashes. All scratch/logs under
owned `$CODEOPS_TMPDIR` root, cleaned after durable recording. Native denials/secret boundaries
apply to every role; a permission allow never expands task authority.

## Runtime ambiguity register

### AR-P1 — frozen CPU-code versus cost-component accounting (runtime)

**Status:** Resolved — exact user-approved accounting correction re-verified and frozen.
**Owner:** primary/user; no implementation or review delegate can grant the exception.
**Location:** `test/rd05/byte-assignment-forwarding-cost.spec.test.ts:112`.

The frozen test sums every CPU16 `kind: "code"` interval, including the BASIC stub, but compares
that sum only to program cost component `code`. Baseline actual intervals total1,205 =
code1,193+BASIC12; current total1,163 = code1,151+BASIC12. The artifact format/classification
did not change. The intended42-byte code/seven-home savings and all earlier resource bounds
already pass. Altering compiler accounting/classification or dropping BASIC bytes would change
an unrelated contract to satisfy a test mistake.

Candidate exact correction: compare the same chunk sum to `sum("code") + sum("startup")`;
retain every other assertion, all code/resource/payload bounds, source behavior and oracle
files unchanged. This candidate has no edit authority until the user's explicit ruling.
An independent challenge assesses classification/minimum correction before presentation.
No future task is qualified or full checkpoint launched while this frozen oracle is failing.

Independent challenge `ses_e10df2b96ffe8YTXV7wAhkJH09` confirms an accounting-domain error:
the platform requires BASIC12; memory evidence classifies that interval as `code`, while
cost evidence classifies it as `startup`. Both classifications predate this unit. It recommends
the one-line code+startup expected expression, with high confidence, keeping all bounds unchanged.
The larger viable alternative separately attributes BASIC and machine-code intervals but needs
more frozen-test changes. Altering production schema/classification is outside scope and would
not be an authorized fix. **User decision:** “i approve”, in direct response to the exact
line112 correction request. The approved expected expression is applied; every resource bound,
actual-byte extraction, raster assertion and other oracle stays unchanged. No further edit
authority is inferred. The original freeze remains historical evidence; record the new cost-file
hash after formatting and successful directed verification.

### AR-P2 — complete-gate NMI stacked-PC failures (runtime)

**Status:** Resolved — approved amendment qualified/reviewed/frozen; actual complete checkpoint GREEN, with original failed-run limits retained.
**Owner:** primary, with independent platform diagnosis.
**Failure locations:** `test/rd08/nmi-boolean-mask-materialization-vice.spec.test.ts:243`
and `test/rd08/nmi-bounded-retention-vice.spec.test.ts:266`.

The actual complete command fails after5,000.427s. Saved return PCs are59,953(`$EA31`) and
63,133(`$F69D`), above the respective main-range ends2,504/2,532. The two tests match `ec8a696e`
byte-for-byte. Current42 guarded inputs match throughout; this establishes no cause by itself.
Do not call this a compiler regression, test defect, emulator flake or host-load failure before
the decisive route/status/stack and selection-impact probes.

No full retry or green checkpoint is authorized while this failure is unexplained.
Diagnosis may inspect the unchanged tests/routes and run bounded observations without modifying
repository tests, source contracts, helpers, timeouts, interrupts or generated output.
The existing AR-P1 approval covers only its accounting expression, never these NMI oracles.
An isolated rerun is supporting evidence, not replacement for actual complete GREEN.

Fresh isolated `ec8a696e` and current builds produce identical complete PRGs for all three NMI
fixtures; both default and opt-in selector results are empty in the corresponding source bodies.
Nine initial plus 36 fixed diagnostic observations all interrupt main and restore its state.
None captures nested IRQ execution, so the original failure mechanism remains Unknown.
The independent platform diagnosis establishes a missing IRQ-exclusion premise in the two
assertions, retains TP-001 (major), and recommends stopping passive sampling.

The proposed exact user decision is recorded in
[full-gate diagnosis](09-full-gate-diagnosis.md#independent-follow-up-and-reserved-decision):
amend only the two NMI test observers to prove main-or-positively-observed-stock-IRQ continuation,
including full inner/outer restoration, with every original behavioral/device/handback check
and 20-second wait retained. Separately authorize controlled CIA timing only in a temporary
deterministic overlap/negative-case witness; production fixture source/IRQ behavior, compiler
and shared helpers remain unchanged. Both parts are unapproved.
Native external-directory denial prevents the reviewer's direct raw-file follow-up; its
assessment uses the already-supplied summary and does not claim independent raw inspection.
No further passive sample, amendment, full retry, commit or push occurs pending the decision.

**User decision:** “ok, let's go”, following the exact AR-P2 proposal and status recommendation
to finish this checkpoint before another optimization. This approves the two observer-file
amendment and separate temporary controlled-CIA-timing witness described above. It does not
approve a blanket ROM allowance, original fixture/source/IRQ change, compiler/shared-helper
change, timeout increase, skipped checks, new general harness, or automatic push.

Implementation proceeds only after a bounded observer design and independent acceptance cases.
The deterministic witness must exercise nested completion and mismatched-frame/route/return
rejection, not just another mainline success. Freeze the two approved amended oracles after
directed green and independent review; preserve all original hashes as historical records.
The original failure mechanism remains Unknown until direct evidence establishes it.

**Approved-scope execution evidence:** the isolated controlled witness reaches genuine
stock IRQ→NMI overlap once in each of the three unchanged fixture images. It saves `$F69F`,
validates the live JSR/register/outer-frame layout and both actual RTI returns, and reaches BASIC
with correct results. The old main-only assertion would reject all three valid executions.
This is meaningful pre-amendment counterexample evidence, not recovery of the original failed runs.

Fresh independent acceptance author `ses_e0f7b74b5ffegNJ9q08j2XjiqB` reports no forbidden
exposure and derives positive/negative frame, route, link, inner/outer restoration, behavior and
bounded-wait cases. The earlier author is retired after reported routing-history exposure and
makes no edits. Design challenge requires complete reachable stock IRQ coverage, not silently
accepting only the demonstrated UDTIM prefix. The primary supplies targeted pinned-ROM excerpts
while checking whether a small fixed route/stack table fits the approved two-file scope.
The independent author now implements only the two approved observers (659/695 lines);
verification and independent review are pending. No new production change exists.
The original source literals, behavioral/device assertions, 20-second waits and actual
120-second per-test timeouts remain unchanged. Controlled positive/negative execution, strict
typing, formatting, unchanged-source/guard checks and review are required before freezing.
Do not launch the complete gate yet.

First directed setup check: formatting passes; normal runtime cases stop before NMI observation
because the new local instruction-width adapter omits official LDA-immediate `$A9`. The
independent author owns this pre-freeze adapter correction; no semantic expectation changes.
An extra root exact-optional typing attempt reports the already documented unchanged monitor
helper diagnostic. Use the established root strict profile; compiler package exact-optional
checks remain required. No shared helper edit or successful amended-oracle qualification claimed.

After the table fixes, normal amended cases pass 3/3 in 9.279s. Static correctness review is
clear. Platform review identifies the same already-corrected branch transcription. SFA review
finds SF-001: resuming a pending first PHA at an already-observed `$FF48` must not create a new
IRQ activation. The author fixes this necessary technical detail within the exact approved
pending-transition contract, at capture and return; no new user-owned scope choice or relaxed
oracle is involved. Files are 663/699 lines; dedicated positive/negative validation and one
fix re-review remain required. A temporary wrapper's boot IRQ stops cause setup exhaustion;
its controls now arm after the actual source timer is armed. No full retry yet.

**Qualification complete:** current normal3/3, controlled real VICE overlap12/12, expected
frame/link/route/return/register fault rejections18/18. Focused protocol replay discriminates
SF-001 before repair (one intended failure/five controls pass), then all six pass after repair.
Replay is observer-logic evidence, not actual hardware/VICE reachability of that pre-PHA ordering.
One fix re-review by correctness, platform and SFA/ABI clears all findings. No waiver or broader
scope exception. Reversing only the approved observer additions/adaptations reconstructs both
original test files byte-for-byte; original sources/assertions/waits are unchanged.

Freeze after AR-P2: nine consumed oracle/fixture files, manifest SHA-256
`8d2ebd09eac06cffdc9ae3fdb148873ba55f9ed40e22bd6b8a751a69921be450`.
The complete checkpoint guards44 inputs, manifest SHA-256
`632ef3ca367fb51b158907204ffec236083a2a0c0fbaab4ba7ebf754c6d8dbc5`.
The original42 inputs remain unchanged. Only the two exactly approved NMI observers join that
set; all original freezes and the failed complete log remain historical evidence.
This diagnosed, remediated and independently qualified correction now permits one actual
complete invocation, not automatic retries. Any failure stops again for diagnosis.

### Actual complete checkpoint — GREEN

Completed 2026-11-19 after the approved correction, without further source/oracle edits.
Frozen install, build, typecheck and formatting pass; build/typecheck use their normal cache.
Actual `yarn test:full` exits0 in4,428.818s (complete precheck chain4,430.755s):
fresh root host251files/5,230pass and serialized VICE134files pass/one existing skipped,
2,403tests pass/four existing skipped. Seven workspace tasks replay the prior verified cache;
the previously fresh compiler4,298/2existing skips and CLI70/server21/editor18 are not
misrepresented as rerun. All44 guarded input hashes remain unchanged.

Full-log SHA-256 `cc44d2615abfec1ff21f456009319534527034b58f0cb31129076b7197b6347e`;
result-record SHA-256 `f2b3452df463e17f32e4031cf02ece7730541eed330c3e000eca718a9d3c9f37`.
This is the successful complete invocation, not an isolated-pass substitute. The earlier failed
gate remains historical evidence. The original failed runs' raw frame mechanism is still not
recovered. Local checkpoint and cleanup follow; #168 remains open for the709-byte gap and
equivalent whole-frame timing.

### Local closeout — complete

GREEN implementation commit `9bbc9ead` contains the17 owned files. The worktree was clean
after that commit, and all44 guarded inputs were checked again before cleanup.
The owned temporary tree
`/tmp/opencode/codeops/runtime-008dc7dd-b8e9-44f8-b007-488e536fa932/issue168-arithmetic-5jvUID/`
is removed. Its baseline dependency symlink was unlinked without following it; repository
dependencies and other runtime files were untouched. Raw logs, manifests and temporary witnesses
no longer exist; durable summaries and hashes remain in the committed evidence documents.

This final documentation update records6/6 without changing source or frozen oracles.
Only Markdown formatting, links, checklist consistency and the documentation-only diff need
revalidation; the completed full checkpoint remains the applicable runtime evidence.
No push or #168 closeout. Remaining work is the709-byte equivalent code gap and whole-frame timing.
