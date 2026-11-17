# Captured startup mapping — bounded execution-review packet

This is shared factual input for six independent read-only roles, not a review verdict or
specification-author packet. Review only the startup dependency's delta; the parent selector is
separately owned and already reviewed. Scope is **strict**. No optional framework/refactor follows.

## Goal, design and review boundary

Preserve modern source and meet the expert local output contract while fixing the full cooperative
startup's saved-readback mapping. User-approved ownership permits independent stock-firmware
upper-bit changes with IRQ service enabled; compiler mapping writes still use captured readbacks.
`$A7` remains legal. No new source/API restriction, storage, pass, runtime or IRQ redesign.

The sole new production file is `packages/compiler/src/layout/startup.ts`. Its unit-start bytes
match `27ebf448`, SHA-256 `b11a8ed32b9f2adcfd5db260654ff0a39175416cfce04adcfcb28667460412d5`.
The complete tree is deliberately dirty with the declared parent phase; do not treat that commit
as its complete state or review unrelated parent changes as startup work.

Exact production change:

- The existing private `saveDevice` accepts A/X/Y, default A, and emits the matching load/state
  store with the same effects. Existing A callers remain unchanged.
- Full cooperative capture retains DDR in X and port in Y, keeping the same state homes/stores.
  Other full captures and borrowed-byte snapshots use A. Existing chronology is preserved.
- The full mapping consumes Y via TYA and X via TXA instead of rereading both CPU registers.
  Port mask/store still precedes direction mask/store. Compact's existing TXA is factored only
  syntactically; compact/takeover/status/normal restoration are otherwise unchanged.
- The helper and lifetime comments explain register ownership. No exported API changes.

Relevant consumers are startup status/state layouts, final borrowed-byte rebinding, machine
register/effect derivation, final C64 layout/resource binding and language main-entry semantics.
Inspect only those consumers necessary for your assigned lens. Baseline status/layout hashes
and parent starting hashes are in `08-verification.md`; parent lower-function/selector bytes have
not changed during this dependency. No clean baseline or historical per-case binary is invented.

## Added tests and measured implementation maintenance

| Surface                                                           | Assigned delta                                                                                                                                                                 |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/compiler/src/layout/startup-captured-port.spec.test.ts` | 48 independent constructor cases, frozen after meaningful RED before implementation. Only the separately approved read-order erratum later changes one array.                  |
| `test/rd05/startup-captured-port-vice.spec.test.ts`               | Three independent saved-versus-live runtime cases; original frozen bytes unchanged. Controlled host DDR mutation is a provenance probe, not a stock-firmware DDR-writer claim. |
| `packages/compiler/src/layout/startup-captured-port.impl.test.ts` | Seven internal controls: final borrowed-state rebinding with/without restore, X/Y holds, no new function homes, four compact forms and separate takeover vector/mapping path.  |
| `packages/compiler/src/layout/startup.impl.test.ts`               | Only full-returning current-output byte pin609→607.                                                                                                                            |
| `test/rd05/boing-ball-parity-cost.impl.test.ts`                   | Startup-unit delta only code1,243→1,241; earlier parent pin maintenance is excluded.                                                                                           |
| Seven RD-04 cost implementation files                             | Only PRG/program/code fields reduce two for16 cases (48 scalar changes). Resources/sources/all other bytes unchanged, verified against preserved originals.                    |
| `test/rd08/optimizer-exact-output.impl.test.ts`                   | Only saved-none payload2,161→2,159 and measured PRG hash; optimized pins unchanged.                                                                                            |

The seven RD-04 stems are `block-index-immediate-cost`, `callable-field-helper-cost`,
`constant-index-callable-cost`, `impossible-mask-fold-cost`, `interprocedural-kill-cost`,
`ordinal-write-straight-line-cost` and `private-element-forwarding-cost`, all `.impl.test.ts`.
No old per-case body binaries survive for exact binary comparisons. The bounded producer delta,
independent behavior/core-cost expectations and fresh measurements justify current implementation
snapshots; they do not establish whole-program historical body-byte identity. No new comparison
harness/compiler fork or code swapping is authorized or necessary for that claim ceiling.

## Exact user-approved oracle exceptions

No generic repair approval authorizes another oracle edit. Primary preserved original bytes and
verified each full-file reconstruction from only these replacements; independent bounded checks
cover the exact applications. Other assertions stay frozen.

| File                                           | Only authorized change                                                                                                                                                                                   | Active SHA-256                                                     |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| New constructor oracle                         | Expected selected reads `[0,1,$DD02,$D018,$D015]→[0,1,$D018,$D015,$DD02]`; exact ordered equality/counts and all other assertions retained. RV-001 authoring erratum corrected by blind original author. | `17a5a7b7436915fa06956511f9778a70c9455be24f7bb15b34858da358522852` |
| `test/rd05/boing-ball-startup.spec.test.ts`    | Broad sentinel seed `$A7→$B7`, expected `$A6→$B6`, adjacent rationale comment only. New distinguishing `$A7` regression remains.                                                                         | `12e5a7229e2d73b1e2ef54947c6ee110fd59c55c4b9821796e43e8e4a3ebb8c8` |
| `test/rd05/byte-write-forwarding.spec.test.ts` | Only full-entry byte pin328→326, independently derived from two shorter transfers.                                                                                                                       | `649dfa89f18ad4cef991c550be387aa94aa6f13b3dab497117e0bb3de39fcae2` |
| `test/m1/pipeline.spec.test.ts:134`            | Only preceding-padding scalar2,936→2,938. Fixed sprite placement/hash/copies/alignment/payload and expert-floor checks unchanged.                                                                        | `dc11c7f1ca1dc782089e699b31fa0441742f3492d263320c13cdfee978cea04d` |

The new VICE oracle freeze remains
`79e7cdaefaaedba7e15d040e60c37a2f58b0dbe0f199fd5c1f22de8c8c241e5e`.
Parent TP-001's approved sampler adapter is separate, hash
`0e9b9c91e0838aec509f3e7538db1b0d841b1b0c4ead8689d32a9af9c9a8c2a8`.
No changes to frozen `spec/`, expert content, qualification oracles or the ledger.

Post-complete-gate RV-002 is a further **exact user-approved exception**, not implicit authority
from this earlier packet: in `test/rd05/canonical-fixed-object-abi-fallback.spec.test.ts`, only
saved-none payload2,161→2,159 and its measured PRG hash change. Original file SHA
`de1900b7b209bbf1d76c5ba64b9ff19b60ec2c31698c253855a860dd03c712fc` becomes
`414f14a0ae4d7051633cd0ee105b259a47cb33efce8305e29bce08cdf3051296`. Exact reconstruction and
one independent correctness fix-review pass. All other assertions and the runtime timeout test/
helper remain unchanged; affected24/24 pass. This does not explain the old timeout or waive the
required fresh complete checkpoint. The separate original failure remains recorded as Unknown.

## Actual evidence available to the review

Primary executed commands; auditors do not execute. Command detail, chronology and owned log names
are in `08-verification.md`. Treat supplied runtime/cost evidence as supplied, not your own run.

- Initial constructor RED32 failures/16 controls and VICE saved-port/DDR RED precede production.
  Before freeze, the author corrected one unprovided tail-main SP assumption to caller.sp; no
  other expectations changed. It reports no forbidden implementation exposure.
- Corrected constructor48/48, fresh compiler build, public22/22 and startup VICE5/5 pass.
- Broader layout139, integration67 and serialized VICE89 pass, including exact cooperative return,
  borrowed state, four profiles, takeover, source-ordered boing, frame comparison and sampler.
- New implementation controls plus old startup controls18/18 pass.
- First changed+host selected fast1,282/layout146/machine1,033/integration23/VICE6 pass; full host
  fails18 artifact expectations, 5,165 other tests pass. This failure remains in the record.
- Bounded emitted-code diagnosis finds no regression in that artifact drift. Exact exception and
  snapshot maintenance are then applied; all nine affected files/22 tests pass, including formerly
  unreached M1 assertions. No skip/relaxation/retry-until-pass or source change is used.
- Fresh changed+host and the later complete checkpoint remain execution-owner gates. Pending or
  failed verification is not waived by a static review. Review completion does not advance them.

| Actual cost boundary          | Result and limit                                                                                                                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full capture and mapping core | Capture10B/14 nominal cycles unchanged; mapping12B/16 nominal cycles versus old14B/18. Independent expert expectation, no added storage/stack/helper.                                              |
| Returning full startup        | Entry326 + restore280 + RTS1 =607B; instruction sums439 +379 +RTS6 nominal cycles. Platform-held stack0/transient1; no wall-clock/deadline claim.                                                  |
| Real boing none               | Code1,241 + asset1,024 + padding4,890 + BASIC stub12 =payload7,167; snapshot49/SFA45/ZP0/scratch0/resident7,261 unchanged. Twin442, remaining code gap799; whole-frame timing unknown.             |
| M1 none                       | Code3,153 +asset512 +initializedData24 +padding2,954 +stub12 =payload6,655. One512B sprite at `$2000–$2200`, alignment64, unchanged input hash and copies; preceding padding2,938. No payload win. |
| Saved-input none identity     | Payload2,159; PRG `f40c0fa82e77b7ab74fc932d8267d84934724851be65170c71282f757271f6e6`; size701/hash unchanged.                                                                                      |

## Supplied qualified authority — no hidden reads required

These excerpts authorize domain judgment without opening hidden qualification cases or grader maps.
The primary extracted only the five current release metadata fields before the next section:

- Active qualified version:2.0.4.
- Status: Active qualified and frozen — exact approval, byte-identical migration and immutable content binding complete.
- Router:2.0.4, SHA-256 `0760ec9d73fc7ed0e8575eb22d3fa9e5bdd2388d27b3989233239342c0b35ad8`.
- Specification:`BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b`, all45 files unchanged.
- Immutable content commit:`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`.

**Expert router stance/sequence:** modern ergonomics in, expert assembly out. Separate semantics,
storage, assembly, artifact, runtime, timing and physical endpoints. Existing compiler/tests/status
are audit subjects, not doctrine. Fix language/API contract and observation effects; inventory
named raw evidence before claiming absence; trace only affected producer/consumer boundaries;
check width/carry/page/bank/pointer/visibility; quantify complete code/data/padding/ZP/frame/stack/
scratch/cycles; compare equivalent work using independent behavior and assembly-cost oracles.
Differential execution is supporting evidence only. Missing decisive facts stay Unknown. Never
add runtime/heap/manager/pass/framework/harness when the direct existing seam suffices.

**SFA/ABI normative excerpts:** SFA owns all general function execution storage and closes params,
returns, locals, temporaries, spills and helper scratch before emission. Platform snapshots,
assets/layout/packing are separate. Caller/callee register/flag, stack and entry/exit ownership are
explicit. Main is parameterless; this nonreturning entry tail-enters main with no extra call frame.
Caller A/X/Y/P/SP snapshots remain for normal return, not incoming source-main register arguments.

**MOS instruction-effects excerpts:** official NMOS6510 load forms set their destination/NZ;
stores preserve flags, accesses exact. LDX/LDY zp and STX/STY absolute have the same2B/3c and3B/4c
costs as corresponding A captures. TYA/TXA are1B/2c and define A/NZ, preserving C/V/D/I; LDA zp
is2B/3c. AND/ORA define A/NZ. No RMW/indexed dummy-access substitution, new scratch or flags-to-source
promise is introduced. Snapshot status restores original observable flags at normal exit.

**C64 memory/startup excerpts:** low3 effective port pins govern LORAM/HIRAM/CHAREN. Cooperative06
keeps KERNAL/I/O visible and BASIC out. Frozen §5.1 requires saved-port formula then saved-DDR|07;
restore captured port before captured direction. Input readbacks are not hidden latch shadows.
User ruling admits independent stock firmware changes, not live-value substitution by compiler.
CIA2 bank-zero pull-ups use DDRA low-two clear; preserve hidden PRA by not reading/writing it.

**Complete interrupt/SFA gate excerpt and scope:** source interrupt functions are callback-only;
recognized sinks select only reachable raw/firmware variants. Default chain preserves entry P
around CLD/body and restores before one page-safe immutable saved-link jump; raw/exclusive CLD
then RTI restores full P/D without redundant PHP. Link start `$xxFE` valid, `$xxFF` relocates/rejects.
Source acknowledgement/count, helper JSR/RTS, storage interference, banking/vector visibility,
publication/removal, prior-link lifetime and final terminal owner require proof. Existing ROM
bytes are not output bytes. No new handler/route/link/ack/vector transaction is introduced here.

Pinned901227-03 IRQ: CPU7cycles/3stack, ROM PULS29cycles/16 existing-ROM bytes saves A/X/Y then
CINV; normal CIA1 service restores Y/X/A and RTI. Pinned NMI: CPU7cycles/3stack then FE43 stub
7cycles/4 existing-ROM bytes with no register save; returning stock predecessor saves/restores
AXY around variable handling. No-hook programs acquire no new FE47 entry condition. I does not
mask NMI. Arbitrary external handlers, unrestricted aggregate IRQ/NMI stack, ROM reentrancy/
completion, nonreturning RESTORE/STOP and deadlines stay unproved even without generated hooks.
Finite platform components are not full-machine peak/headroom guarantees.

Sources:`BLEND65-SPEC-4-038b70e9`, `MOS-PGM-1976`, `MOS-6510-1982`, `CBM-C64-KERNAL-03`,
`CBM-C64-PRG-1982`. Context: four cooperative PAL/NTSC6581/8580 NMOS6510 PRG profiles, pinned
ROM901227-03, ACME0.97, VICE3.10; runtime claims bounded to executed profiles, hardware-unverified.

## Reviewer safety and response

No shell, edits, children, commits, push or issues. Do not read secrets/env/credentials/keys or
aliases, uncertain hidden configuration, qualification cases, grader/oracle maps or expert-ledger
content. Native denials remain binding; never switch tools to bypass. Supplied non-secret router
excerpts avoid hidden reads. If a decisive authority excerpt is missing, name it for the primary.
M1's expert-floor assertions may remain unchanged without reading their protected data as doctrine.

Return surviving findings with severity, exact location, violated contract, witness/refutation and
smallest remedy, or explicit no findings. Separate semantic preservation from DX where assigned;
report oracle integrity and evidence limits. Do not infer a pass, completed task, complete parity,
universal silicon behavior or external interrupt bound from another role's agreement.
