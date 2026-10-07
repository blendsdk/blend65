# Qualification and closeout: CIA2 ownership

> **Parent**: [Index](00-index.md)
> **Date**: 2026-10-07
> **Status**: Complete — bounded CIA2 slice qualified; RD-05 and DEF-7 remain open
> **Boundary**: This bounded plan, not RD-05 or DEF-7 closeout
> **Qualification**: VICE-verified / hardware-unverified
> **CodeOps Artifact Schema**: 1

## Delivered boundary

The existing four cooperative C64 PRG profiles admit an exclusive, private-home-free
NMI route when source ownership and the qualified idle entry are proved. Existing
CIA2 operations lower directly; source syntax, public APIs and profiles do not change.
Finite device facts extend the existing ordered interrupt-context proof. Ordinary
helpers, nested leases and finite release variants retain their existing ABI and
storage owners. No second solver, runtime manager, shadow, scheduler, general
optimizer, new dependency or qualification harness is introduced.

The final typed-device handback publishes stock NMINV first, clears all source
masks, stops both timers while preserving their unrelated control bits, and performs
one generated consuming read. An older returning generated writer completes before
mainline handback resumes. An arrival after publication follows the stock firmware
policy. A stock STOP/RESTORE warm-start is terminal to the interrupted application;
it is not required to return through an abandoned application RTI.

## Fresh native qualification

All cases execute sequentially on the current generated artifacts, pinned ACME
0.97 and VICE 3.10. No unknown case or skip contributes to qualification.

| Family                   |   Cases | Independently checked endpoint                                                                                                                                                    |
| ------------------------ | ------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CIA2 timers              |      12 | A `$81`, B `$82`, simultaneous `$83`; one CPU ICR read, ordinary source bit tests, real NMI/RTI and exact final device/return state                                               |
| Instruction boundaries   |     528 | 66 actual instruction/end boundaries × no-key/STOP × four profiles; complete old/new entry, immutable predecessor capture, actual acceptance PC and completed-instruction history |
| Overlapping entries      |      16 | Generated-writer and stock companions × no-key/STOP × four profiles; exactly two timed inputs and actual hardware frames; returning RTIs or the terminal ROM route                |
| No-RESTORE controls      |       8 | No-key/STOP × four profiles; zero hardware NMI acceptance, normal source completion and captured BASIC return                                                                     |
| Decimal-state companions |       4 | Interrupt real `bcd_add` immediately after SED; stacked D=1, ordinary body D=0, RTI restores D=1, source result `$12+$34=$46`                                                     |
| **Total**                | **568** | **Zero skips; bounded operation proof, not universal hardware/startup qualification**                                                                                             |

Models are observed, not inferred from project filenames: PAL video standard 1/
MOS6569R3 model 0; later NTSC standard 2/MOS8562 model 4; SID model 0/1 for
6581/8580; both CIA models 0; KERNAL revision 3. Each of the 36 GDB/text-monitor
runs attests these resources and logs the same exact PRG path as its launch script.
The twelve timer cases independently use the existing binary-monitor fixture.

### Timed-input protocol and evidence limits

Public source/debug ranges and a fixed NMOS instruction decoder identify all
boundaries from actual PRG bytes. The driver stops before the preceding instruction,
plays a physical keyboard matrix through `keyboard_event_playback`, then calls
`machine_set_restore_key(0/1/0)`. No CPU PC, frame, vector, ROM, generated instruction,
ICR pending bit or timer latch is patched. `IK_NMI` bit 1 and the recorded NMI clock
attest input plumbing; the CPU-pushed frame and actual instruction history prove
acceptance. No-RESTORE controls never assert the RESTORE input.

Real BASIC keyboard-buffer `keybuf sys2061\x0d` re-enters through SYS after stock
warm-start. Its stack contains `$E146`; RTS resumes at pinned `$E147`. No manual
jump substitutes for this continuation. The stock ROM entry at `$FE43` executes
`SEI; JMP ($0318)`. Every terminal case has its own clock-scoped ordered trace
through `$FE66`, `$FD15`, `$FDA3`, `$E518`, and BASIC warm start `$E37B`.

Each case compares A/X/Y/SP, complete stacked status, immutable link bytes and
all four internal CIA2 port/DDR bytes across the operations. Generated and stock
ICR reads are attributed separately. Final release executes its ordered vector,
mask, controls and drain effects once. Returning cases preserve caller state and
source reload latches, leave masks/pending clear, timers stopped and `ENABL=0`.
Terminal cases do not require abandoned markers or normal release completion.

Each expected stop is bounded to 15 wall-clock seconds; each process to 60 seconds
and 80,000,000 emulated cycles. The stock stub costs seven nominal CPU cycles;
observed elapsed time may be longer because VIC bus stalls are retained. One
NTSC/8580 boundary observes 50 elapsed cycles. That is not a changed instruction
cost or a stable raster/deadline guarantee. External aggregate stack, unrestricted
arrival/nesting, retained-firmware completion/deadlines, cartridges and physical
CIA edge behavior remain unproved. Report only VICE-verified / hardware-unverified.

### Exact artifacts and retained inputs

Primary-owned evidence root: `/tmp/blend65-cia2-native.GjRTpE`.
`build.log`/`decimal-build.log` bind source, public generation and all eight artifact
digests per profile. `inventory.jsonl`/`decimal-inventory.jsonl` retain the actual
source-correlated instruction and boundary lists. Final run names are
`boundary-<profile>-none|stop`, `overlap-final-<profile>-writer|stock-none|stop`,
`control-<profile>-none|stop`, and `decimal-<profile>`. Each retains `.gdb`, `.mon`,
`.cases.json`, raw `.log`/`.monitor.log` and final `.checked.json`.
Failed/manual pilots and superseded diagnostic logs remain distinct and are not
counted as passing evidence. VICE monitor logs append; final runs use fresh names.

| Profile                    | Base generation                        | Decimal generation                     |
| -------------------------- | -------------------------------------- | -------------------------------------- |
| `c64-pal-prg-kernal-6581`  | `ed7f4b8a-1529-400c-8723-fcaa87f9fba3` | `54a40023-ca18-49c9-83c7-c5276cfaed62` |
| `c64-pal-prg-kernal-8580`  | `c53b9959-497b-4f91-8fec-6396f6be3a76` | `28ea9f79-67a8-4a7e-9e4b-085444d3128f` |
| `c64-ntsc-prg-kernal-6581` | `0d87fcc3-6cc3-40da-9246-38e474f9045e` | `90077eaa-87cb-479c-b9f8-52f7efb24bab` |
| `c64-ntsc-prg-kernal-8580` | `7c57d92e-52df-448f-a8fb-cb400f83fba7` | `0ca11238-7d12-4614-8fd4-03273034c901` |

Base source SHA-256 is
`e3631ddc2de953823c6500a4a7f71b77bff489adc150db6b6b7628e960b3f636`;
all four base PRGs hash
`b7de39bd2fb863e37de8f33073449d6e03d8a2b83ba8f23a725b48347e7cb8fb`.
Decimal source SHA-256 is
`9fcb416ee48deea58a03689bc21130ea0bba0bcc2cd78ac5f9d7227521443210`;
all four decimal PRGs hash
`17863e2d1d0d23bfa6c40e1d30d10a32db24a6647513b4d297777a96fc74495e`.

`identities-resources.json` SHA-256
`472d7d2f2d6a0792a14ac4f4277d9f4fd699f41602613d418444913e01d9abec`
binds all 64 artifact hashes, 216 final run/input/report hashes, model observations,
full resource reconciliation and the separate retained startup failures.
It is supporting evidence, not a behavior oracle. Checker SHA-256 identities:

| Temporary checker         | SHA-256                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| `validate-boundaries.mjs` | `9fd50c085bcbf7c99afc0ec77680cdf5ae3ef225cd11d7c9f57cb1e5a9ea4dbf` |
| `validate-overlap.mjs`    | `6b85669ca42fa4e9dd4d7915ab331f25a8a09559012a75c1b101f77ae32074c7` |
| `validate-control.mjs`    | `86df870572483ab537d1ad48491fd2383a84e654e5dd52e6a4f7e671aeed0126` |
| `validate-decimal.mjs`    | `6b3c99101ede9399599926483b09f1191c8ce60f0454830664c20945a8036f41` |
| `validate-identities.mjs` | `f35fe1469c369ecfd01c82d9ae44cd053d310420f89dc22eb4d638121153b319` |

The exact unchanged tool/ROM SHA-256 identities are:

| Tool/ROM                | SHA-256                                                            |
| ----------------------- | ------------------------------------------------------------------ |
| VICE 3.10 `x64sc`       | `f148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74` |
| KERNAL 901227-03        | `83c60d47047d7beab8e5b7bf6f67f80daa088b7a6a27de0d7e016f6484042721` |
| BASIC 901226-01         | `89878cea0a268734696de11c4bae593eaaa506465d2029d619c0e0cbccdfa62d` |
| Character ROM 901225-01 | `fd0d53b8480e86163ac98998976c72cc58d5dd8eb824ed7b829774e74213b420` |

The independent bounded native audit checks actual matrices, hardware frames,
partial/full predecessor captures, clock-scoped terminal routes, model identities
and artifact hashes. The full independent phase and authorized fix-only reviews
are complete in [the phase-review record](09-phase-review.md).

## Complete resource account

Public memory/cost records reconcile with actual ACME bytes on every profile.
The code figure includes the 12-byte BASIC stub and 632 bytes of existing startup/
return code. Platform data and immutable links are resident but not loaded PRG
bytes. Padding is charged, not hidden behind a local instruction count.

| Resource                                  | Base writer | Decimal companion |
| ----------------------------------------- | ----------: | ----------------: |
| Code, including startup/stub              |       897 B |             925 B |
| Loaded padding                            |       487 B |             715 B |
| PRG file, including two-byte load address |     1,386 B |           1,642 B |
| Startup platform state                    |        50 B |              50 B |
| Immutable predecessor links               |         4 B |               4 B |
| Other SFA function storage                |         0 B |               1 B |
| Total occupied resident memory            |     1,438 B |           1,695 B |
| Zero page / private NMI scratch           |         0 B |               0 B |

Base main occupies `$0966–$0A3C`; selected entries are writer `$0A47–$0A6A`,
clean successor `$0B47–$0B48` and chained successor `$0C47–$0C4A`.
Live links are `$0D9B–$0D9F`. Decimal main ends at `$0A58`; its writer moves
to `$0B47`, and the two live links move to `$0E9B–$0E9F`.
Matching-low placement is the coherent-publication constraint; it does not prove
that the present whole-program packing is optimal. Independent output review
must assess complete layout and ordinary-output debt, not certify the whole PRG
from these local sequences alone.

| Local endpoint                                      | Actual nominal cost  | Stack/RAM boundary                                                                                                                                                |
| --------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Writer, including preservation/binary entry and RTI | 35 B / 53 CPU cycles | Three hardware-frame bytes plus one generated save; zero private scratch                                                                                          |
| Final typed-device restore                          | 38 B / 56 CPU cycles | Two temporary stack bytes; zero RAM/ZP scratch                                                                                                                    |
| Two overlapping generated writers                   | Two genuine entries  | Eight observed bytes above interrupted SP; no external aggregate bound                                                                                            |
| Two returning stock entries                         | Two genuine entries  | Fourteen additional observed bytes above interrupted SP; two already-saved transaction bytes make sixteen above pre-transaction SP; no general firmware guarantee |

The direct final sequence is
`PHP; PHA; SEI; LDA #$FE; STA $0319; LDA #$1F; STA $DD0D;`
`LDA $DD0E; AND #$C6; ORA #$08; STA $DD0E;`
`LDA $DD0F; AND #$86; ORA #$08; STA $DD0F; LDA $DD0D; PLA; PLP`.
The unchanged stock transfer and hardware-entry cycles are separately attributed,
not charged as generated PRG bytes. Local meeting versus a whole-program win
remains subject to independent output review and existing RD-08 issue ownership.

## Existing startup defect — not waived

TP-003 is a **MAJOR, pre-existing R5.4 defect**, not a CIA2 timer failure. Genuine
STOP/RESTORE warm-start then SYS exposes a CIA2 PRA internal latch change
`$D7→$97` with DDRA `$3F`. Startup reads the pins, then writes that captured value;
an input-direction latch bit cannot be inferred from that read. Each full STOP
matrix retains the exact raw difference. All four port/DDR bytes are unchanged
across the new CIA2 operations, and startup restores its exact captured readback,
but this does not prove preservation of the original hidden latch.

[AR-P9](00-ambiguity-register.md#ar-p9--separate-operation-proof-from-the-real-existing-startup-gap)
assigns the mandatory repair to roadmap **T-09 / RD-05 R5.4**. The original failing
predicate remains in `validate-boundaries-before-scope.mjs`; raw pilot and final
logs are retained. Startup blob `bf9ab47c6a4e976e9aa115e51cb5d2d763641a26`
is identical at the phase baseline and current tree. No general preservation
waiver or unapproved startup/specification fix is included. **RD-05 cannot close
until this obligation is resolved.**

## Checkpoint history and remaining closeout work

The pre-correction complete diagnostic checkpoint has **4,973 PASS, two FAIL and two
existing compiler SKIP**. Install/build/typecheck and all package suites pass;
the root suite's only failures are the two AR-P10 negative-mutation setups.
All new CIA2 tests and the repeated twelve timer cases pass. This is not a GREEN
checkpoint or permission to commit a broken tree. Full logs and exact package
counts are retained in [execution evidence](99-execution-plan.md#current-checkpoint-diagnostics).

The exact ledger retirement and approved
[AR-P10 two-case negative-test setup correction](00-ambiguity-register.md#ar-p10--explicit-negative-test-state-after-ledger-retirement)
pass all eleven gate cases without skips. Exact diff checks preserve every
assertion, source fixture and other ledger row. The fresh full checkpoint passes
install/build/typecheck and **4,975 tests**, with two existing compiler skips and
zero failures. The root suite passes all 3,091 cases in 157 files. Code/forced
Markdown formatting, 70 local links, documentation, exact oracle exceptions,
unchanged native artifact identities and frozen authorities pass. This is the
original checkpoint, not the final review verdict. Six independent full reviews
and one fix-only round have since completed. The corrections pass a fresh full
checkpoint of **5,017 tests**, zero failures and two existing compiler skips;
the eight original native artifact families rebuild byte-identically. The
[phase review](09-phase-review.md#fix-only-review-and-remaining-necessary-corrections)
retains the new evidence and the remaining SM-004/SM-005 MAJOR and SM-006 MINOR
findings. AR-P11 was approved and its bounded additional correction/review is now
complete. The three semantic findings are corrected; the final full checkpoint
passes **5,086 tests**, with zero failures and two existing compiler skips.
The independent platform review finds TP-004 MAJOR: actual NMI/RTI return
incorrectly retains CLI's old-I IRQ delay, permitting a falsely exact copied
mask before a pending IRQ writes its home. Source/admission/assembly and pinned
CPU-model evidence confirm the defect; native corruption is not claimed.
At that historical checkpoint task 1.3.6 was blocked on
[AR-P12](00-ambiguity-register.md#ar-p12--actual-interrupt-return-ends-the-prior-old-i-delay),
which was subsequently explicitly approved. The public
CIA2 note and deferral-expiry check remain pending. RD-05, DEF-7,
keyboard certainty/coexistence, raw/takeover and other platform obligations remain
open. User-host and physical-hardware QA stay with RD-10. Specification 4 remains
frozen at `BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b`;
expert 2.0.3 remains bound to `22cc5f00f381c82d347cf342be4fcff16bc291c6`.

The additional output audit records the fixed scalar-borrow witness as
Incorrect parity under existing RD-08/#70 ownership; [#99](https://github.com/blendsdk/blend65/issues/99)
retains exact source, equivalent expert sequences and complete resource/cost
accounts. Current `clear` costs 29 bytes/45 cycles/four pointer ZP bytes versus
the closed expert witness's seven bytes/14 cycles/zero pointer ZP. With the same
caller setup and call this is 37/15 bytes and 57/26 cycles. Fixed entry placement
turns removed code into padding: projected PRG remains 872 bytes, occupied memory
falls from 927 to 923 bytes and nominal whole entry/return CPU path from 1,014 to
983 cycles. The replacement is unassembled/unexecuted, not a delivered saving.
This ordinary-lowering debt is not a production-grade waiver or CPU safety fix.

### Current CPU-return checkpoint

AR-P12 changes only actual-return IRQ eligibility in the existing context proof;
the no-arrival old-I delay is untouched. An independent author freezes twenty
public cases before production: four intended RED and sixteen legal controls.
All 108 focused public, 38 internal and four sequential native companions pass.
The successful internal command is `internal-green-retry.log`; the earlier
file-selection failure is diagnostic only. Three additional PAL CPU-order
probes independently prove the post-NMI IRQ ordering, no-arrival delay and
restored-I masking. The former unsafe source now fails check/build with E10278;
its retained pre-fix PRG is diagnostic evidence, not a newly accepted program.
Exact hashes, scripts, source/PRG and model boundaries are in
[the fix-review record](09-phase-review.md#approved-cpu-return-fix-review-cycle).

Fresh install/build/typecheck/full tests complete at 18:04 CEST: compiler
1,814 PASS/two existing SKIP; CLI 62, language server 21, VS Code six, root
3,203 PASS in 163 files. Total **5,106 PASS, zero FAIL, two existing SKIP**;
root duration 683.99 seconds. Logs `final-{install,build,typecheck,test}.log`
are under `/tmp/blend65-cia2-rti-fix.Muxd4B`. New frozen-oracle hashes, exact
old-oracle modification set, unchanged other ledger rows, forced touched
formatting, local links and frozen specification/expert all pass.

All eight original source, assembly, labels, PRG, memory, cost, debug and assets
hashes match fresh current builds (`rebuild-original.jsonl` and
`rebuilt-metadata-identities.jsonl`). Normal publication retired the earlier
generation directories. Their build/inventory/hash and native run records remain;
this is a comparison to original recorded hashes, not deleted original files.
Current generations are listed in `rebuild-original.jsonl`; new `.build.json`
generation/measurement identities differ normally. The 568-case native matrix
is not rerun by this identity check. No added emitted bytes, instructions,
MMIO, runtime storage or new optimization barrier in the correction.

All six final fix-review responsibilities are clear, including the documented
thread-limit fallback with separate full role charters. The planned public note is
[C64 CIA2 timers and interrupt ownership](../../../../../docs/c64-cia2.md).
RD-05/DEF-7, mandatory TP-003/T-09 and all existing RD-08 output debts stay open.

## Deferral-expiry check

**Did this RD's deliverables expire any deferral's stated rationale?** Yes, for
the bounded CIA2 slice. This is not whole-RD closeout. The obsolete exclusive NMI
blanket rejection has positive source, output, storage, native and independent
review evidence. Only the approved `v4-nmi-installation` ledger row retires;
every other ledger row is unchanged. No user-visible restriction is silently
treated as a hardware law or moved to an unowned future slice.

| Inspected owner                                                    | Current disposition                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RD-04 AR-P16 / DEF-7; CIA plan's exclusive consuming-read deferral | Both stock-chained and exclusive cooperative generated routes now have bounded qualification. The old blanket guard rationale expires. DEF-7 stays RD-05-owned for remaining keyboard/coexistence and route obligations; external nesting/stack/firmware guarantees are still unproved.                                                                                                                                                      |
| Prior NMI closeout's exclusive CIA2 handoff row                    | Delivered by this plan; its earlier statement is historical, not an outstanding CIA2 implementation owner. This closeout and the derived roadmap replace that status.                                                                                                                                                                                                                                                                        |
| Keyboard AR-P2/AR-P3; RD-05 R5.24/R5.25                            | The blanket NMI guard no longer prevents the next keyboard contract assessment. Exact port-latch restoration, acquisition certainty and scan-aware stock coordination remain open. The existing keyboard decision register owns that now-due assessment; no new input API is approved here.                                                                                                                                                  |
| TP-003 / T-09 / RD-05 R5.4                                         | Mandatory startup preservation repair before RD-05 closeout. CIA2 operation proof does not expire or waive its real hidden-latch failure.                                                                                                                                                                                                                                                                                                    |
| Public-note ordinary NMI forms / RD-08 / #70 / #100                | Global assignment of a consumed byte and a direct bit condition expose a private-scratch admission limitation. The existing ordinary register/value optimization owner now has an exact issue and an expressiveness-ledger follow-up; this is not a permanent source restriction or permission to weaken SFA.                                                                                                                                |
| RD-05 Won't Have / requirements decisions                          | Native assets remain RD-06, delivery RD-07, general optimization RD-08, tooling RD-09 and user-host/physical QA RD-10. No deliverable here removes their separate prerequisites. Game-policy systems remain excluded, not deferred compiler capabilities.                                                                                                                                                                                    |
| Frozen future-consideration triggers                               | FUT-006/007/011/012/015/016/017/018 are not activated: no new loop/range demand, assembly linker, copy optimization, image conversion, measured stack-overflow solution, general scheduling or pure-RAM volatility contract is supplied. FUT-016's retained wording discrepancy remains T-07-owned; CIA2 per-entry costs are not a finite aggregate stack proof. Previously resolved entries and rejected language forms gain no new ruling. |

The scan includes the RD-04 and CIA/NMI ambiguity owners, the existing keyboard
register, RD-05's requirements register and Won't Have section, the expressiveness
ledger, and frozen `spec/future-considerations.md`. No deferral relies on this
completed slice as an unnamed future landing place. RD-05 itself remains open;
all still-due work has the existing named owner above.

## Public-note validation and newly observed source debt

The note documents only the existing signatures, supported flags, ownership,
release order and qualified limits. Public declarations export shared CIA bit
constants under `c64.cia1`; the note does not invent a `c64.cia2` constant binding.
The rejected draft examples are removed, not presented as working source or
rewritten into manual-address POKE workarounds.

Both ordinary NMI forms are checked and built through public services on all
four profiles: sixteen canonical E10245 failures, no generation publication.
Assignment source SHA-256 is
`3fa5fd35b81093e90e959019b95d123f8cf9c7c11461c1efc0c10f176331b335`;
conditional source SHA-256 is
`d03386c454f57ddfe35d58df616daadd3d08a76ca256d6002c328891f6de6b9e`.
Exact sources and `limits.jsonl` SHA-256
`460460ef197939487d81aa6926d0cef0e067b6a6c6240e36bfd5befb5feb1a36`
remain under `/tmp/blend65-cia2-doc.ili4ZL`. Earlier single-profile draft failures
are diagnostic only. None are added to the 5,106 passing test count or claimed
as runtime qualification.

[Issue #100](https://github.com/blendsdk/blend65/issues/100) owns the ordinary
register-only producer/consumer repair under RD-08/#70, including its ledger
follow-up through the normal scope/oracle gate before optimized or production
closeout. The expert assignment target is 10 bytes/23 nominal cycles including
the A-only wrapper, zero private RAM/ZP and one consuming read; hardware and
stock entry add fourteen cycles separately. It is unassembled/unexecuted, not a
delivered saving. Current rejection is an infinite expressiveness ratio, not a
finite cost comparison. No extra production change or unauthorized ledger row
is added here. Other ledger rows remain unchanged; the existing genuine
private-storage negatives and qualified selected routes retain their evidence.

Final touched Markdown formatting, local links, public signature/constant keys,
sixteen diagnostic source probes, exact old-oracle exceptions, five frozen new
oracle hashes and unchanged spec/expert checks pass. Snapshot comparison to the
reviewed checkpoint shows only plan/roadmap/public-note changes and removal of an
empty generated monitor log; production and test content are unchanged from the
5,106-test checkpoint. This qualifies only the bounded CIA2 slice, not whole-RD
readiness or production-game output.
