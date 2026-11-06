# Root-suite remediation findings

| Finding | Phase | Severity | Area | Ruling |
| --- | --- | --- | --- | --- |
| RV-001 | prior | CRITICAL | joystick-cycle-oracle | fixed |
| SM-001 | current | MAJOR | canonical-fallback | fixed |
| TP-001 | stack | MAJOR | retry-return-visibility | fixed |
| MC-001 | stack | MAJOR | stored-status-constructor | fixed |
| MC-002 | stack | MINOR | entry-path-cycle-composition | report-only |
| SM-002 | profile | MAJOR | mutually-exclusive-startup-oracles | fixed |
| SM-003 | retained-observers | MAJOR | initializer-capture-category | fixed in AR-P5; group66/66 |
| SM-004 | retained-observers | MAJOR | physical-PC-as-execution-order | fixed in AR-P5; group66/66 |
| RV-002 | parameter-debug | MINOR | entry-only-regression-coverage | fixed |
| SF-001 | parameter-debug | MAJOR | entry-alias-revisit | fixed |
| SF-002 | retained-observers | MAJOR | capture-to-call-retention-gap | fixed; final re-entry remedy execution-qualified |
| TP-002 | retained-observers | MAJOR | CPU-space-is-not-private-RAM | fixed; independent fix review clear |
| TP-003 | retained-observers | MAJOR | uncounted-volatile-memory-read | fixed; independent fix review clear |
| PE-001 | Boolean-proof | MINOR | unused-final-graph-reproof | report-only |
| OR-001 | startup-retry | MAJOR | obsolete-236-save-rejection | fixed by AR-P10; 20/20 + 11/11 pass |
| WC-001 | word-counter | MAJOR | nested-accumulator-containment | fixed; SM-001/RV-001–003 addressed; semantics confirms SM-001; root40/40 |
| DBG-001 | word-counter | MAJOR | narrowed-counter-source-symbols | fixed; debug33/33 and pinned3/3; RV-003 re-review clear |
| OR-002 | startup-retry | MAJOR | IRQ-held-byte-oracle-conflict | fixed by AR-P12; five RD-04 files35/35 unchanged, NMI20/20 |

## Canonical fixed-object ABI directed qualification

The approved object-only canonical representation now activates only for proved
returned-local groups and same-object borrowers. It retains the generic build as
fallback, compares against a metadata-only copy of that generic construction,
projects only replaced result/parameter demand with no actual access, and
constructs the fixed result and nested literal directly into caller backing.
The acquisition byte loop is admitted only through a bounded unchanged-control
proof in both actual layouts; optimized candidates are outside that scope.

Directed results: new independent spec **41/41**, unchanged returned-local oracle
**20/20**, exact saved/acquisition/`none` identities **3/3**, focused seal-scope
and byte-loop carry/initialization corruption tests pass. Old ordinary BSS49
and acquisition startup≤328 now hold. AR-P11 approved the two existing service/
aggregate owners required by the implementation. Independent correctness
(RV-001–004), SFA/ABI (SF-001–003) and machine-code (MC-001) fix reviews are
clear. Install/build/typecheck pass. The first complete root run then exposed
only the 26 stale RD-04 held-byte expectations; approved AR-P12 restored the
display-independent stored scope and re-derived the single IRQ188 NMI case to
195/188. Five RD-04 files35/35 unchanged and the combined directed set102/102
pass. The fresh complete root run passes **274 files / 6,248 tests / zero
failures** (compiler 3,512 + two existing skips). T-18 and DEF-17 are closed;
no oracle, limit, hash or hardware claim changed.

## Review and verification evidence

## AR-P3 stored-status scope and AR-P12 IRQ correction

The first AR-P3 implementation applied the stored-status retry to every
display-independent `none` program at the warning boundary. The complete root
inventory then exposed stale NMI expectations, and the retry was temporarily
restricted to programs without asynchronous or address-taken roots. That
restriction returned the held byte to all five RD-04 stack files and reproduced
their 26 stale-ledger failures, while the stored form is safe for IRQ programs:
its state lives in compiler-owned resident storage and is restored before main.

AR-P12 was approved. The retry now follows the approved AR-P3 scope again:
display-independent `none` programs at/above the 188-byte warning boundary,
regardless of asynchronous roots. The five RD-04 stack files pass **35/35
unchanged** (the held-byte failures disappear). Only the four-profile IRQ
188-save NMI case moved, from the compact held-P ledger 196/189 to the actual
stored-status **195/188**; interrupt-entry saves, external-NMI uncertainty and
finite accounting remain exact. AR-P10's 236→237 rejection move stays. The
combined directed set passes **102/102**. This removes no oracle and lowers the
true reported peak by one byte.

## Word-counter containment and debug evidence

The root fixture runs with `boundsCheck:false`, confirmed in its actual
`.build.json`; emitted runtime guards are therefore absent. The final observer
now proves the exact nested-loop accumulator shape and publishes a use-site
maximum, without changing source acceptance or the emitted low-byte candidate.
The proof is restricted to one constant initialization outside both loops, all
`local += 1` updates in one inner body, outer constant0/unit-step/exact trip8,
inner parent-next/unit-step/trip max7, and `K*B*(B-1)/2` updates. Extra writes,
address exposure or any other shape keep the existing containment rejection.
Focused accumulator cases pass **4/4**; the unchanged root file passes **40/40**
on four profiles in none/size.

Narrowed counters are byte/register representations with no source local in the
selected inventory. `evidence-records.ts` now emits the original source local
with its word type/width and a rematerializable location targeting the selected
counter symbol, so the debug schema remains truthful and `memoryBytes` is below2.
Source locations use the proof's actual execution context and its original
lifetime ranges; an unrepresentable register-held source symbol is omitted rather
than attached to another function context. Targeted evidence tests pass **33/33**;
the exact saved/acquisition/none identity suite passes **3/3** after this fix.

Independent review found the execution-multiplicity gap SM-001/RV-001: the loop
facts do not prove lexical outermost nesting, so an unrecognized enclosing loop
could repeat the triangular count. The proof now requires the outer preheader
chain to start at the function entry through top-level recognized loop exits,
exactly one semantic predecessor when it is not the entry, the inner preheader
to be the outer body, and the accumulator initialization to be the outer
preheader or entry. The repeated-inner counterexample is a passing rejection
regression. RV-002 now skips unrelated source comparisons instead of rejecting
them; RV-003 uses the actual execution-context index and source live ranges.
Focused cases pass **5/5**, root **40/40**, pinned identities **3/3**, evidence
**33/33** and build passes. Independent semantics review confirms SM-001 fixed;
the bounded correctness fix re-review clears RV-001/002/003. The unit is committed
locally as `a974998f`; no push and no full-root claim.

- Independent correctness review of `62e96209..8003d203` found no production
  correctness finding in its bounded lens, but found the joystick scaffold's
  added eight-cycle ceiling charge outside the exact exception.
- The fix restores the original ceiling and moves the common display-dependent
  read into an initializer. One independent fix re-review reports **no findings**
  and clears the exact oracle exception. The 24 affected sample cases pass;
  the other 196 cases were unselected in that directed run.
- The same fix review finds no issue in the empty-frontier authenticated
  canonical fallback, the unoptimized resource-diagnostic handoff, or the new
  implementation-tier service tests. Platform review remains separate.
- `yarn workspace @blend65/compiler vitest run
  src/services/canonical-fallback.impl.test.ts
  src/services/size-observers.impl.test.ts`: **31/31 pass**. Existing copied,
  stale, mutated and startup-visibility rejection guards remain unchanged.
- `yarn vitest run test/rd04/diagnostics-alternate-placement.spec.test.ts
  test/rd04/diagnostics-resource-boundaries.spec.test.ts
  test/rd04/provenance.spec.test.ts test/rd04/resource-accounting.spec.test.ts
  test/rd04/resource-exhaustion.spec.test.ts
  test/rd05/nmi-route-placement.spec.test.ts`: **61/61 pass**, six files.
- `yarn vitest run test/rd08/input-size-runtime.spec.test.ts
  test/rd08/input-object-facts.spec.test.ts`: **128/128 pass**, sequential
  four-profile VICE, including wrap/bus-order, dummy-read opcode guards, unknown
  raw alias, captured values and live returned-pair/IRQ behavior. Runtime was
  run against the fallback build before the separate diagnostic-only edit;
  that edit changes only failed unoptimized layout outcomes, not these
  successful machine artifacts.
- Independent platform review reports **no findings** in the bounded canonical
  acceptance seam. Exact object identity is accepted only after actual storage,
  stack, startup visibility, placement and producer/source checks. No raw/MMIO
  envelope is widened and no transformed winner is displaced. It makes no
  universal-silicon or external-NMI-bound claim.
- `yarn vitest run test/rd08/optimizer-exact-output.impl.test.ts`: **3/3 pass**.
  Saved709, acquisition943, balanced/speed size-quality selection and the
  2163-byte `none` output retain their pinned complete artifact hashes.
- `yarn workspace @blend65/compiler test`: **3,472 pass / two existing skips /
  zero failures**, 193 files. Install, build and typecheck pass.
- Seven remaining directed root files: **422 pass / 44 fail**. Startup selection
  passes104/104, corrected joystick passes220/220, and collision VICE passes16/16.
  Remaining failures are byte selection20, loop/storage8, profile pipeline8 and
  returned-local output8. This is a directed inventory, not a fresh full-root count.
- Independent new stack-pressure specifications have meaningful RED:236 source
  saves fail at237 total; tight-RAM compact and low-stack compact controls pass.
  Two initial fresh-fixture attempts did not establish compact feasibility and
  were corrected by the independent author before implementation: arbitrary raw
  output became typed output, then the immutable-data dependency became a live
  uninitialized RAM buffer with an explicitly contained masked index. All three
  test assertions remained unchanged; existing oracles were untouched. The
  corrected test is now frozen for implementation.

## Stack-pressure review boundary

The uncommitted stack unit is based on `aabb20fa`, tree
`d87b5cd7cd9fce072144369f2cad76f753ea3ed6`. Seven stack files pass44/44; unchanged
startup/register/whole-borrow/display and exact-identity regressions pass55/55.
The new native constant7/callable9 initializer case also passes (four new
pressure specifications total), including answer16 and balanced-main SP.
Independent correctness and SFA reviews find no issue in their bounded lenses.

TP-001 found that a geometrically feasible full replacement could place return
code/state behind BASIC ROM. The accepted fix exports/reuses the existing
visibility guard for actual requested retry tuples; rejected advisory full output
falls back to compact, and unsafe overflow replacements fail before publication.
The assembled187PHP/38000NOP regression passes in sequential PAL/6581 VICE with
visible state, bounded stack and genuine SYS return preserving P/SP. One
independent fix re-review clears TP-001 with no remaining finding. The
overflow-specific hidden-layout negative and fresh full-root checkpoint remain
unverified; static review confirms the same guard rejects before publication.
This is VICE-verified / hardware-unverified, not four-profile hardware proof.

The existing-full intermediate did not qualify MC-001. AR-P3's approved
stored-status remedy and the evidence below supersede it. No new optimizer
recipe is admitted; full-unit verification remains pending before a stack commit.

## Approved stored-status qualification (in progress)

AR-P3 is explicitly approved. The independently authored output/behavior files
ran before constructor implementation: **20 meaningful failures / three mode
policy passes**. RED reports actual1000 payload against477 and actual56 state
bytes against14 (seven base plus seven actually borrowed). No test was changed
to make the implementation pass.

The implemented `compact-stored` form now passes **23/23** new cases: four output,
three optimized-policy exclusions and16 four-profile VICE status/initializer/
register/banking/BASIC-borrow/no-display/no-PRA cases. Platform base state is7,
with held0/transient1. This is VICE-verified / hardware-unverified. Old-constructor
identity, complete startup regressions and independent final reviews are pending.

Measured sizing authorizes the exact one-literal exception:50600->50690 in the
new pressure test. At50600 stored status fits (payload514/resident51126/stack187,
state8); at50690 compact is selected (payload497/resident51195/stack188/state4).
The stored form adds21 resident bytes, so cannot fit the latter's four-byte
headroom. The independent author changes only this literal; every assertion and
other fixture token stays unchanged. No old specification oracle is amended.

Independent correctness/oracle, SFA/ABI and platform reviews report **no
findings** for this bounded stored-status unit. The independent author's fourth
pressure/native case was a recorded baseline PASS before stored-status work;
the checked exact exception changes only50600->50690. Its assertions/imports
and all other fixture content are unchanged.

Machine-code fix review closes MC-001 against the actual supplied emitted bytes:
entry54/restore32 bytes; startup82+53=135 nominal CPU cycles; PRG container479,
payload477, resident484, state `$09DE..$09E4` seven distinct bytes; stack188,
ZP0/scratch0. No display accesses, padding or hidden buffer occur. This meets
the conservative local floor, not a whole-program expert win. [Issue139](https://github.com/blendsdk/blend65/issues/139)
records the concrete unchanged-Y proof path to save6 executable bytes/8 nominal
cycles/one state byte (analytical next target471payload/477resident, not measured).

MC-002 is a separate MINOR reporting defect in the existing entry-path cycle
producer: a jump and its continuation are merged as alternatives rather than
summed. The complete PHP188 path is135+188*3+188*4+3=1454 nominal cycles, while
the public report says a maximum1451. Do not use that reported bound as timing
qualification. The constructor's86bytes/135nominalcycles remain separately
decoded and correct. Route a bounded producer correction and independent
regression separately; no deadline, VIC-stall or physical-hardware claim is made.

Knowledge lineage for these domain reviews: active frozen expert2.0.4, content
`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`, Specification4.0; normative SFA,
CPU stack/status, CPU address view, DDRA-only bank transaction and PRG startup
headings. Sources include `MOS-PGM-1976`, `MOS-6510-1982`, `MOS-6526-1981`,
`CBM-C64-KERNAL-03`, `CBM-C64-PRG-1982`, `BLEND65-STARTUP-BANK0-20261008`.
Reviewers consumed authorized normative excerpts, not qualification answers.

## Remaining root gates (not fixed by stored-status work)

Fresh profile/returned-local directed run:16 failures/14 passes across two files.
Fresh initializer-temporary/retained-call run:eight failures/eight passes. The
last byte/loop directed inventory remains20/eight failures respectively. No fresh
complete-root count or green result is claimed.

SM-002 (profile reviewer finding SM-001) confirms incompatible assertions for
identical empty source, profiles and none mode. Independent design challenge
recommends the exact one-file assertion/control correction in AR-P4. User then
explicitly approves that exact scope. The independent specification author
applies only those amendments. `yarn vitest run
test/rd05/profile-pipeline.spec.test.ts test/rd05/profiles-vice.spec.test.ts`
passes14/14: ten profile cases and four unchanged native loaded-byte/no-write/
return-state cases. Independent correctness/oracle and platform reviews clear
the checked exception. This is not a producer change or cost waiver.

The stored-status full compiler run reports3472pass/two existing skips/one
implementation fixture failure. The zero-headroom fixture used235 source saves
plus the former held byte. Its ONLY correction is saves235->236, retaining every
capacity/peak/headroom/cost/unproven-safety assertion. Targeted three cases pass;
independent implementation-fixture review reports no findings. Final full
compiler rerun now passes3473/two existing skips/zero failures across193 files
(`yarn workspace @blend65/compiler test`,881.77seconds). Install/build/typecheck,
45 import-boundary cases and targeted touched-file formatting pass. Together with
stored-status23/23, unchanged/boundary103/103 and four independent review lenses,
this verifies the bounded startup checkpoint; full root is still open.

Actual returned-local attribution, also identical at retained baseline3c2e9357:
ordinarySample payload704/resident768/ZP2/stack2/scratch0, only BSSstartup50
(49base+actualborrow `$03`), entry333/restore286, no initializers. Acquisition
payload1169/resident1248/ZP4/stack5/scratch0, BSSglobal1+startup52
(49base+actualborrows `$03..$05`), entry343/restore296, no initializers. Required
snapshots explain current output but do not prove that every smaller correct
representation is impossible. Keep returned-local cost gates open; no budget or
snapshot expectation is amended by AR-P4.

The loop/storage evidence throw is traced to the unused `first` parameter's
allocated home: its artificial declaration lifetime points only to operation0,
which has no final machine range after return shaping; the selected function
still has emitted entry-load and RTS ranges. Diagnose the producer/debug
attribution precisely before weakening any evidence check. No production debug
instrumentation or alternate debugger is retained in source.

SM-003/SM-004 (semantic review SM-002/003) are supported by actual PAL artifact
probes: initializer word-low2981 vs IRQ a2982/b2983, direct read/store and later
reload/write; finite Q's JSR2810->JMP2813->reload2793->store2796 with caller home3486
separate from callee parameter3485/local3484. They reveal representation/order
assumptions in the two old observers, not a demonstrated live-value corruption.
No native or universal allocation proof follows from this one-profile artifact.
Independent design challenge recommends AR-P5's exact two-file correction,
including strict capture/context/home checks and corrupt-evidence negatives.
User explicitly approves AR-P5's exact two-file scope on2026-11-06. Independent
authoring resumes with mandatory positive and corrupt-evidence negative cases;
neither finding is marked fixed before qualification. Source fixtures, compiler
producers, returned-local budgets and unrelated oracles remain unchanged.

## Unused-parameter debug correction (uncommitted)

Baseline3fc0bcd9. A minimal four-mode public-service regression establishes three
optimized ARTIFACT_EVIDENCE failures and one none baseline pass before the fix.
Declaration-only unused byte parameters retain real ABI values at entry even
when return shaping removes the source operation used by their artificial entry
lifetime. The first draft anchors that exact narrow case to a real entry range;
all other positive-home/no-range failures remain terminal. Four-mode tests and
the eight unchanged `input-loop-storage` surviving-value native cases pass.

Independent correctness review finds no production defect but asks for exact
entry-address/single-range and exclusion tests (RV-002). Independent SFA review
finds SF-001: an empty semantic entry can alias a loop header; after a local reuses
the unused parameter home, a backedge revisits the same PC/context and makes an
unconditional available-value record false. This necessary internal correction
is accepted, not waived; it introduces no new schema or storage representation.

Actual optimized source witness confirms unused parameter/local both at `$02`,
with the source entry aliased to the first loop-header instruction. The fix now
separates real range anchoring from availability: a proved single-visit machine
entry can expose its ABI home; a revisitable/unproved entry reports the existing
`unavailable/notRepresentable` state, never a false value or source rejection.
Unknown transfers fail the availability proof; the original missing-range guard
remains. The loop/backedge regression is meaningfully RED before this fix;
straight-line/used/longer-lifetime coverage is strengthened. Fresh implementation
tests pass8/8. One independent SFA fix re-review closes SF-001 with no findings;
the correctness reviewer closes RV-002 after checking exact assembled-entry and
exclusion assertions. Targeted formatting passes. The fresh unchanged 40-case
loop/storage suite passes36, including all eight surviving-value native cases
after the revisit guard; its four word-counter optimization gates remain open.
No parameter-debug commit is made yet; the fresh complete root command includes
the complete compiler checkpoint. The earlier compiler experiment failure is not
rewritten as a pass; that experiment was removed byte-exactly.

## AR-P5 final review and remaining proof gaps

The approved amendments pass60/60 after author-owned formatting and local
synthetic-fixture deduplication: initializer26, retained-call26, unchanged
initializer-lifetime8. Both formatted files are below700 lines (686/530), with
all source fixtures and original profile/helper/ABI/effect assertions preserved.
Independent correctness review clears the exact exception against the complete
first-file baseline and second-file diff supplied inline. The reviewer's native
external-directory denial was respected; no filesystem retry was made.

SFA review finds SF-002: capture and post-return checks leave argument staging
between them unchecked. A real marshal store retargeted to the saved caller home
would be accepted while debug parameter homes remain disjoint. The independent
author adds the precise corruption negative; its positive passes and mutated
store is meaningfully RED (`expected function to throw`). Repair stays within
AR-P5's existing capture/each-call/argument-preservation obligation, using the
smallest bounded local check rather than a general control-flow framework.

Platform review (its local TP-001/002 map here to TP-002/003) identifies two more
observer gaps: CPU address-space membership alone admits `$0001` as a private
home, and whitelisted BIT/CMP memory forms can hide an extra volatile input read.
Accept both necessary corrections under AR-P5's required private-home and exact
effect-count conditions. The independent author is adding exact same-width
CPU-port-home and duplicate-read negatives before tightening the observer. No
production or source-fixture defect is inferred, and no resource gate is waived.

Fresh remaining directed inventory: three files report84pass/32fail. Byte
selection20, word-counter storage4 and returned-local8 remain. All eight
surviving-value cases now pass after the final entry-revisit guard. No fresh
complete-root result or root-green claim is made.

Reviewers ran no shell commands. The primary execution owner supplied command
results. Their agreement is not runtime or physical-hardware proof.

## AR-P5 final correction evidence

Final directed command passes66/66: initializer28, retained-call30, unchanged
initializer-lifetime8. Prettier passes; the two protected files have699/698 lines.
Source fixtures, profiles, modes, helper-sharing, parameter/local separation,
transitive lifetime and volatile-count checks are retained. The independent
platform fix review closes TP-002/TP-003 after inspecting the actual RAM-ledger
and memory-read rejection guards plus their two meaningful RED corruptions.

The first SFA fix review retained SF-002: one static capture instruction can
execute again after A changes. Its exact re-entry negative is meaningfully RED.
The author's final remedy protects every byte of the actual source-entry/read/
capture prefix against external direct jumps, signed branches, fallthrough and
direct JSR targets, rejecting unknown indirect edges. Only the proved capture
may write the saved home; unresolved writes are rejected. Every source-body
entry reaches that capture before any helper, and every selected call retains
the independent post-return continuation check. Platform forwarding variants
are distinguished by their published source-body context, never by lowest PC
or unsupported-opcode skipping. The marshal positive and re-entry fixtures end
with explicit RTI; their outputs and corruption assertions are unchanged.
All66 pass after this remedy. No third whole-unit SFA review was requested;
the primary closes the specific re-entry obligation against the reviewer's
stated remedy, meaningful RED and final positive/negative execution evidence.

## Boolean producer qualification

The focused existing-proof extension passes12 private-home/dependency cases
and five independent final-physical reconstruction cases. Existing Boolean and
byte-window suites also pass. Embedded BNE/BRK corruptions are meaningfully RED
before the unsupported-transfer guard. Four unchanged native byte-pair cases
pass on PAL/NTSC6581/8580, each covering all65,536 pairs, exact CMP/AND prefix
and independent short-circuit effects. Closed now measures2535 bytes, down
from2541 and equal to Direct2535; the unchanged comparator selects Closed.
Zero page2, resident3118, stack4 and scratch0 remain unchanged; T is Unknown.
No capture/merge traffic or storage home is removed by this proof correction.

The complete exact-output suite passes3/3 after that guard: saved709,
acquisition943, balanced/speed baseline and none2163/hash remain pinned.
Independent correctness, SFA/ABI and CPU/output reviews find no defect in their
bounded lenses. The CPU review confirms the removed AND#$FF is2bytes/2cycles
per reached site but does not claim whole-routine expert parity. PE-001 remains
MINOR/report-only: final graph reproof is unnecessary when no certified call
is consumed; its analytical64x32-instruction witness adds2,048 transfers.
No measured latency failure or emitted-code defect follows.

## Sequential complement correction in qualification

The existing cache producer already handles two fixed sequential loops, but its
final validator demanded one source loop. The necessary correction stays inside
that existing correspondence proof: per-loop source/body chains, first-loop
unavoidable setup, one stable source/cache, exact unchanged instructions/control,
all destination/store anchors and whole-function source/cache write protection.
No producer, recipe, source fixture or resource oracle changes. Both bounds
settings are meaningfully RED before correction. New five-case positive/later-
loop-corruption coverage plus all33 existing guards pass38/38. Actual PAL root
source now selects Closed1574 versus Direct1575, ZP3 versus2 and resident1895
versus1896; both stack2/scratch0. Native, pinned identities and independent
reviews for this separate correction remain pending.

Install, build, typecheck and touched compiler/AR-P5 formatting pass at the
Boolean checkpoint. The running complete root command began before the later
sequential-cache correction; it supplies an inventory, not frozen final-tree
qualification. A fresh final command is still required before closeout.

Workflow evidence boundary: the primary accidentally read historical release
and semantic-reference preambles while refreshing guidance. They are not used
as compiler authority or blind qualification evidence. Reviewers receive only
bounded normative excerpts and release identity, not historical evaluator answers.
