# Root-suite remediation findings

| Finding | Phase | Severity | Area | Ruling |
| --- | --- | --- | --- | --- |
| RV-001 | prior | CRITICAL | joystick-cycle-oracle | fixed |
| SM-001 | current | MAJOR | canonical-fallback | fixed |
| TP-001 | stack | MAJOR | retry-return-visibility | fixed |
| MC-001 | stack | MAJOR | stored-status-constructor | fixed |
| MC-002 | stack | MINOR | entry-path-cycle-composition | report-only |
| SM-002 | profile | MAJOR | mutually-exclusive-startup-oracles | fixed |
| SM-003 | retained-observers | MAJOR | initializer-capture-category | approved fix pending |
| SM-004 | retained-observers | MAJOR | physical-PC-as-execution-order | approved fix pending |

## Review and verification evidence

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

Reviewers ran no shell commands. The primary execution owner supplied command
results. Their agreement is not runtime or physical-hardware proof.
