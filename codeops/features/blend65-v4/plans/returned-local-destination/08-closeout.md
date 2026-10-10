# Qualification: proved returned-local destination

> **Parent**: [Index](00-index.md)
> **Date**: 2026-10-10
> **Status**: Qualified — 19/19 tasks; full verification and independent review complete
> **Boundary**: T-14 only; RD-05, DEF-7 and the positive keyboard gate remain open
> **CodeOps Artifact Schema**: 1

## Qualified bounded implementation

One immutable whole-function certificate allows a completely initialized returned
local to use the existing caller-owned result directly. All admitted construction,
contained scalar accesses and terminal returns use that same hidden pointer.
SFA omits only the redundant complete local; caller storage, pointer homes,
necessary scalars and existing domain interference remain closed before emission.
Missing body, caller, containment or observer proof retains the entire old path.
These are optimization guards, not new source restrictions or diagnostics.

No pass, IR kind, ABI variant, general solver, forced temporary, runtime, public
API, schema, dependency or harness is added. [AR-2–AR-5](00-ambiguity-register.md)
record necessary corrections in existing consumers and the real test locations.
AR-4 removes a newly exposed word-construction size regression with a local
constant-construction selection; it is not a general register optimizer.

AR-5 corrects persistent source-established hardware observation. Independent
TP-001 then finds a distinct incoming-state gap: startup leaves bitmap mode
unchanged, so bank-zero VIC fetches may observe the caller result during direct
construction. This disproves blanket physical invisibility; it does not alone
establish a specified semantic failure. The initial disposition required fallback
under the plan's literal physical-observer wording.
[AR-6](00-ambiguity-register.md#ar-6-runtime--incoming-bitmap-display-invalidates-hardware-disjointness)
records the user's approved narrow plan clarification: required source/platform
observations stay equivalent, but legal allocation/copy elision need not preserve
the incidental pixel trace of unpublished compiler-private storage. All existing
guards stay unchanged. The [T-16 assessment](09-entry-observation-assessment.md)
does not authorize startup/layout support, a source-entry restriction, baseline
rebasing or a qualification waiver. Final verification and all independent
review gates pass, including the base review's final consistency check.
This records the coherent green local implementation checkpoint. No public
keyboard, full-body parity or user-host release qualification follows.

## Acceptance and verification

| Acceptance | Evidence and current boundary                                                                                                                                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-1        | Fresh ordinary and selected artifacts retain no redundant returned-local home or final copy. All seventeen exact-source generations reproduce byte-for-byte under the approved observer boundary.                                 |
| A-2        | Fresh unchanged four-profile oracles pass 88/88, including runtime values, aliases and ordered effects. Independent semantics/platform disposition is clear under AR-6; the complete repository checkpoint passes.                |
| A-3        | Whole-function fallbacks cover mixed callers, existing/global/borrowed/forwarded destinations, address observation, unknown/escaping accesses and asynchronous observers. The separate partial-array backend defect remains T-15. |
| A-4        | Independent SFA/ABI review reports no finding: caller/result-pointer demands and every existing domain remain closed. Fresh assembly and memory/debug reports are unchanged.                                                      |
| A-5        | Fresh exact-source artifacts reproduce all measured code/storage improvements without startup/layout changes or baseline rebasing. Complete nominal-path costs stay bounded; full-body expert parity is not claimed.              |
| A-6        | Fresh actual PA-only artifacts reproduce the measured improvements on all four profiles. This is artifact/cost evidence, not public keyboard or acquisition runtime qualification.                                                |

Baseline: **60 PASS / 28 intended RED / 88**; no fixture failures or skips.
Activated binding: **88 PASS**, no skips. After AR-4, the directed package run
passes **41/41**: 31 new internals and ten unchanged construction-barrier tests.
After AR-5, **44/44** pass: 34 new internals and ten unchanged barriers. Its
three observer-context cases first failed independently before the fix.
Strict TypeScript checking of both normally build-excluded internal test files
also passes. The fresh post-AR-5 install/build/typecheck pass. The compiler suite
passes **1,944** cases with two existing skips. The complete root run was
intentionally halted on TP-001; it is not a full checkpoint pass.

After the exact AR-6 ruling, fresh four-profile oracles pass **88/88**, no skips:
output 20, safety 40 and behavior 28. The fresh complete repository checkpoint
exits zero: **6,043 passed**, with **two existing unrelated compiler skips**.
The root suite passes 4,010 tests in 181 files, taking 1,356.50 seconds. Owned
packages pass 1,944 compiler, 62 CLI, 21 language-server and six VS Code tests.
Install, build and typecheck pass. No new case is skipped. Earlier interrupted
runs remain historical supporting evidence, not the successful checkpoint.

The first full run exposed one old internal Y-barrier expectation. The existing
helper was narrowed to the hidden-return target; its unchanged old tests now pass.
Later runs were deliberately interrupted when the current AR-4/AR-5 corrections
and TP-001 invalidated their checkpoint claims. Only verified owned VICE descendants
were stopped. No user process was stopped; relevant raw evidence is retained.

The three independent specification oracles remain byte-identical to RED:

| Oracle   | SHA-256                                                            |
| -------- | ------------------------------------------------------------------ |
| Behavior | `3c7ec37c396c79f5944203470440b9cdd7aff4e58b14c6076d90ef3bebd3eb5f` |
| Safety   | `925f59f26e796758cd5ddde2294e658c2f4f5a742dd61907203d108278c0b02c` |
| Output   | `f0b8e481de35ce2d6c01a42736dac83f42e52e70360cf88c1ef972a990b6f986` |

No existing test, frozen specification or expert file changed. Runtime uses pinned
VICE 3.10 sequentially; no physical-hardware, deadline or external nesting claim follows.

## Independent actual-byte costs

These are the retained **post-AR-4 artifact costs**, reproduced byte-for-byte by
seventeen fresh post-AR-5 generations after the approved AR-6 clarification.
The ordinary runtime proof used normal text-mode entry; no bitmap-at-entry
pixel/timing probe was run. Physical private-storage overlap remains real, not
a promised invariant pixel trace. No startup/layout cost is introduced, and no
protected baseline is rebased. Runtime, artifact and review evidence are distinct;
none establishes external hardware or all-entry timing guarantees.

The output auditor reconciled actual PRG bytes, labels and all build/report hashes.
Nominal cycles are independently counted from those bytes, not taken from the
compiler's unknown cycle-report field. They exclude VIC stalls, external IRQ/NMI,
BASIC/SYS entry and retained-firmware execution. Source PLP remains separate;
ordinary function flags are clobberable, not an entry/exit preservation promise.

### Exact ordinary witness

| Component                                  |                            Before |                 Final |
| ------------------------------------------ | --------------------------------: | --------------------: |
| Sample routine                             |             70 bytes / 272 cycles | 53 bytes / 118 cycles |
| Main caller, own cycles including JSR      |              20 bytes / 27 cycles |  20 bytes / 27 cycles |
| Both ordinary routines                     |             90 bytes / 299 cycles | 73 bytes / 145 cycles |
| Startup / restoration                      | 328 / 281 bytes; 441 / 385 cycles |             Unchanged |
| Startup-through-restoration, measured path |                      1,125 cycles |            971 cycles |
| PRG payload / container                    |                   711 / 713 bytes |       694 / 696 bytes |
| Resident occupancy                         |                         787 bytes |             757 bytes |
| General SFA / ZP                           |                      23 / 4 bytes |          12 / 2 bytes |
| BSS / generated call stack / scratch       |                  49 / 2 / 0 bytes |             Unchanged |

### Actual selected PA-only acquisition-shaped witness

This source keeps PA-only idle publication and its one-byte marker, not the old
DDR-writing candidate. It retains eight rows, its COMPLETE/UNAVAILABLE outcomes,
saved-row borrowed query, source PHP/SEI/PLP and existing scoped NMI route.
The comparison assumes no interrupt and marker zero on COMPLETE. The generated
ingress remains 18 bytes/33 cycles to the predecessor jump; firmware is excluded.

| Component                                |                                             Before |                                     Final |
| ---------------------------------------- | -------------------------------------------------: | ----------------------------------------: |
| Acquisition                              | 397 bytes; 1,790 COMPLETE / 308 UNAVAILABLE cycles |             363 bytes; 1,654 / 154 cycles |
| Saved-row reader                         |                               63 bytes / 91 cycles |                                 Unchanged |
| Main caller, own cycles including JSRs   |                               55 bytes / 75 cycles |                                 Unchanged |
| Three ordinary routines                  |                      515 bytes; 1,956 / 474 cycles |             481 bytes; 1,820 / 320 cycles |
| Startup / restoration                    |                  328 / 281 bytes; 441 / 385 cycles |                                 Unchanged |
| Startup-through-restoration              |                               2,782 / 1,300 cycles |                      2,646 / 1,146 cycles |
| Placement padding                        |                                          239 bytes |                                  17 bytes |
| PRG payload / container                  |                                1,393 / 1,395 bytes |                       1,137 / 1,139 bytes |
| Resident occupancy                       |                                        1,498 bytes |                               1,227 bytes |
| General SFA / ZP                         |                                      45 / 10 bytes |                              34 / 6 bytes |
| BSS / scratch                            |                                       50 / 0 bytes |                                 Unchanged |
| Generated mainline / NMI per-entry stack |                                        5 / 5 bytes | Unchanged; not an external aggregate peak |

The eleven-byte omitted object does not imply eleven net RAM bytes by subtraction:
baseline homes overlay, ZP changes, and matching-low ingress padding absorbs code
layout. Complete regenerated totals establish the win. COMPLETE's fourteen CIA1
reads/fifteen writes and UNAVAILABLE's two control reads are static ordered path
inventories, not a runtime bus trace. The existing warning W10211 remains.

### Page-crossing witnesses and MC-001

The identical preflight `word[129]` source demonstrates that AR-4 fixes the new
size growth, rather than trading more code for the removed copy:

| Exact-source word witness            |                   Before |                    Final |
| ------------------------------------ | -----------------------: | -----------------------: |
| Make                                 | 829 bytes / 5,207 cycles | 827 bytes / 2,152 cycles |
| Main / startup / restoration cycles  |           43 / 441 / 385 |                Unchanged |
| Complete nominal path                |             6,076 cycles |             3,021 cycles |
| PRG payload / container              |      1,482 / 1,484 bytes |      1,480 / 1,482 bytes |
| Resident occupancy                   |              2,053 bytes |              1,793 bytes |
| General SFA / ZP                     |            518 / 4 bytes |            260 / 4 bytes |
| BSS / generated call stack / scratch |         49 / 2 / 0 bytes |                Unchanged |

The interim make was 1,086 bytes. The bounded selection removes 259 bytes and
two nominal cycles; MC-001 is corrected. Preflight generations use NTSC profiles;
all four final profiles have identical bytes. This proves nominal NMOS output
costs, not equivalent video timing.

The separate full-observed-object ST-17 fixtures also retain complete artifacts
on all four profiles. Byte[257]: make 56 bytes/2,899 cycles; main 46 bytes/3,640
own cycles; full path 8,393 cycles; payload/container 1,494/1,496; resident 2,063;
SFA/ZP 257/6 bytes. Word[129]: make 827 bytes/2,152 cycles; main 46 bytes/3,663
own cycles including sixteen actual indexed-read page penalties; full path 7,673;
payload/container 2,268/2,270; resident 2,839; SFA/ZP 258/6 bytes. Both advance
the hidden pointer at the page boundary and restore its base before later stores
and RTS. W10143 remains. These fixtures differ from the exact preflight source;
their complete program costs are not interchangeable.

## Remaining expert-output defects

Terminal delivery meets the local **one-byte/six-cycle RTS** floor. This is not
whole-routine or whole-program expert parity. The existing RD-08 owners remain
[#89](https://github.com/blendsdk/blend65/issues/89) for index/address selection and
[#103](https://github.com/blendsdk/blend65/issues/103) for the return witness's
remaining path to the whole-program win. They are defects, not output waivers.

| Measured residual                                             | Generated                                           | Equivalent expert / required seam                                                |
| ------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------- |
| Ordinary D020 read-to-store                                   | 13 bytes / 20 cycles; one retained logical RAM byte | 7 bytes / 12 cycles; zero RAM; propagate the value to the final store            |
| Ordinary complete sample, without dead initialization removal | 53 bytes / 118 cycles                               | 46 bytes / 110 cycles; existing forwarding and construction-offset seams         |
| Masked row address/read/store                                 | 63 bytes / 88 cycles per row                        | 11 bytes / 18 cycles; retain the already-proved 0–7 ordinal at address selection |
| Saved-row query, same borrowed-pointer ABI                    | 63 bytes / 91 cycles                                | 19 bytes / 33 cycles; the same existing index seam                               |
| Offset +256 pointer setup                                     | 30 cycles                                           | 16 cycles; omit a proved-zero low-half addition                                  |

The masked-row difference is 560 cycles over eight rows. A general word-fill loop
could reduce construction bytes at greater cycle cost; no timing budget makes
either shape universally optimal here. No general optimization is added to this
bounded correction. These remaining deficiencies must be addressed before
optimized/production game-grade closeout; modern source must not work around them.

## Retained evidence and lineage

Primary-owned raw root:
`/home/gevik/workdir/github/blend65.ri/blend65/.git/worktrees/v4/returned-local-execution.ljm6xa`.
`final-artifacts.log` binds all seventeen post-AR-4 public generations. Each
`final-*/current.json` resolves preserved assembly, labels, debug, costs, memory,
build, assets and PRG files. Originals and failed/interrupted logs are retained.
`final-*` retain the earlier interrupted checkpoint; `y-selection-*` own directed
AR-4 verification. `persistent-observer-red.log`, `persistent-observer-green.log`
and `persistent-observer-types.log` retain AR-5's RED/GREEN and strict typing.
`qualified-{install,build,typecheck,test}.log` own the earlier post-AR-5 checkpoint,
whose complete test run was halted on TP-001. Fresh `resumed-artifacts.log` binds
all seventeen current generations to their immutable original generation paths.
PRG, assembly, labels, costs, memory and debug bytes are identical; diagnostic
codes are unchanged. Original files remain retained even though normal public
builds advance generated `current.json` pointers. `resumed-source.sha256` pins
the thirteen production modules, two internal tests and three immutable oracles.
`resumed-{install,build,typecheck,test}.log` all exit zero. The terminal test
summary establishes 6,043 combined passes and two existing unrelated skips.
Explicit strict checking of both internal tests passes in
`resumed-internal-types2.log`; the first invocation's TS5112 command-option
error is retained in `resumed-internal-types.log`, not counted as a code failure
or verification pass.

| Fixture                     | Exact source SHA-256                                               | Final PRG SHA-256                                                  |
| --------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Ordinary                    | `fcfc95346d78c7ff104c7d7fd7fc490e6eec136b468847ee2e627a1443af69fd` | `7387d991733b44439ca6cbcb8f9b4914aed492b0490ca2fa153014c5a80472f6` |
| Selected input module       | `860a0c523355e544a0d47da99089e2d74994a78c67dfd1efdb65e1cb4aa314f0` | `dea6714d5d9916c1a3fecfeb981852209944c97aadbc4e350817a0907c083401` |
| Selected main module        | `a5d2ec4473b267366695a01e3ede9f45cf3659e1ec312965916669611c3466c2` | Same selected PRG                                                  |
| Exact preflight word source | `ea49acf14cb44af1c79ef6070a2215b8f5321446e0249aca4377112c1d93294a` | `4c2420ba50b75a9069b55c391e43f807454913c888f0ee9f451a638b2f128abc` |
| Full-observed byte fixture  | Recorded in its final build manifests                              | `aa2070123588c90eaf6156ef00c72e5fbfad69cf85c7eb85aa90427fc13ccff8` |
| Full-observed word fixture  | Recorded in its final build manifests                              | `2d3f5f22383b416124950fa3fe8b3027c450801df88eb5bf80b9ada34632aee4` |

Context: Node 22.23.1/Linux x64, Yarn 1.22.22, NMOS 6510, four cooperative
C64 PAL/NTSC × SID 6581/8580 profiles; ACME 0.97; VICE 3.10.
Optimization `none`, bounds/division safety off. Expert `2.0.4`, immutable
content `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`; frozen Specification 4.0.
Normative references: `sfa-and-abi.md#final-storage-closure`,
`blend65-semantics.md#semantic-preservation-checklist`,
`il-and-optimization.md#memory-effects-and-volatility`,
`6502-lowering-casebook.md#aggregates-copies-and-layout`,
`evidence-parity-and-recovery.md#transformation-proof` and the CPU instruction
grid. TP-001 also uses `c64-memory-and-runtime.md#kernal-loaded-prg` and
`c64-hardware.md#control-bases-raster-and-interrupts`. Source keys:
BLEND65-SPEC-4-038b70e9, MOS-PGM-1976, CSG-6567-318014, ACME-097-R266.
No authority content changed; physical hardware and external timing remain unproved.

## Independent review and deferral boundary

Review baseline tree: `8ff0ebe0091b9ed6890509371b01f6373b90348d`. Six independent
lenses are required; no reviewer runs tests or mutates the repository.

| Lens                                               | Current result                                                                                                                                                                |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Correctness / standards / scope / oracle integrity | No findings; final base-review consistency clear. All six new files inspected and all eighteen code/test hashes match verified evidence.                                      |
| Semantics / modern DX                              | SM-001 resolved by AR-5; final static supplement finds no missed defined observer or new restriction under exact approved AR-6. Full root run now passes.                     |
| SFA / ABI                                          | No findings; final storage and hidden-pointer ABI traced to retained assembly. Fresh assembly/memory/debug byte identity preserves that reviewed closure.                     |
| Platform / asynchronous effects                    | No surviving finding under approved AR-6: TP-001's physical overlap remains real, not an invariant private-layout pixel promise. No source/platform guard removed.            |
| Actual emitted output                              | No new findings; MC-001 corrected. Independently verified 17 fresh generations, 102 byte comparisons, all artifact hashes, legal opcodes and exact costs; RD-08 debts remain. |
| Host performance                                   | No surviving finding; no introduced realistic bottleneck found; full verification completes successfully                                                                      |

The initial recommendation challenger supported fallback and a separate
startup/layout assessment. The approved T-16 assessment and fresh challenge
recommended a precise observer-contract ruling first: physical overlap is proved,
but no defined semantic failure follows from overlap alone. The user approved
that exact ruling on 2026-10-10. D011 save/mask/restore cannot recover an arbitrary
hidden compare bit, and placement brings capacity/span costs without hiding all
private implementation traffic. The independent semantics/platform supplements
complete the exact ruling's disposition without a code or oracle change. Fresh
full qualification and the base correctness supplement pass. See the assessment for exact
cost bounds, strongest counterargument and evidence limits.

Deferral-expiry check: **did this task's deliverables expire any deferral's stated
rationale?** The keyboard AR-P11 returned-local prerequisite is now qualified;
the separate positive keyboard plan remains RD-05-owned and becomes the next work.
No other rationale expires, and no owner becomes orphaned.
RD-05/DEF-7 still own keyboard/coexistence and remaining platform/workload proof.
RD-05's Won't-Have owners remain RD-06 assets, RD-07 delivery, RD-08 general
optimization, RD-09 tools and RD-10 user-host/physical QA. FUT-012's reason to
avoid a duplicate array-copy intrinsic is strengthened by direct construction,
not invalidated. T-10 callable assignment, T-13 host cloning and T-15 partial-array
lowering remain separately owned; none is silently repaired or waived.

The repository is not opted into managed technical documentation (`docs/index.md`
is absent); no architecture-document scaffold is added. The feature roadmap keeps
four of ten RDs Done. The portfolio's existing one-of-ten arithmetic drift is
deferred to integration by the feature-branch policy; the read-only engine check
reports that known drift, not a portfolio synchronization PASS. No portfolio write
is made here. The green local implementation checkpoint includes the exact
approved clarification, verified code/oracles and completed review/progress
records. No automatic push.
