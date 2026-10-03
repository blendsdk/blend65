# Task T-05: Scan-aware NMI ingress proof

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Progress**: 1/1 tasks (100%)
> **Last Updated**: 2026-10-03 09:55 CEST
> **Phase baseline tree**: 7a9c3f20dbfc6a830893a8c5f853e03ea6ec9123
> **Scope mode**: strict

## Objective

Test the approved developer-facing direction without accepting new compiler semantics:
ordinary saved-input operations, with the minimum hardware/firmware coordination hidden at
the existing platform boundary. [NMI AR-P8](../rd-05-nmi-cia2/00-ambiguity-register.md)
and [keyboard AR-P5](../rd-05-keyboard-input/00-ambiguity-register.md) authorize this proof.
The remaining RD-05 effort handoffs are waived; recommended effort is xhigh for this task.

**Smallest viable design:** One temporary direct-assembly probe, assembled with pinned ACME
and observed sequentially with pinned VICE and its existing debugger facilities. Two deliberate
shared bytes describe scan activity and interference; an immutable two-byte predecessor link
has program lifetime. The ingress preserves only registers it changes, restores status before
chaining and never reads CIA2 ICR. It establishes the declared CIA1 idle drive before the stock
handler scans, rather than suppressing RESTORE. No queue, scheduler, callback dispatcher,
dynamic activation storage, latch-shadow manager or reusable probe framework.

**Expected modification set:** This mini-plan, the existing NMI and keyboard decision registers,
and the feature roadmap. Temporary assembly, binaries and debugger logs are diagnostic evidence,
not shipped compiler/library code. No upstream requirement, spec, expert, production or test
oracle changes. Portfolio synchronization waits for integration.

## Task

- [x] T-05.1 Test the minimal ingress and record its bounded contract, costs and remaining unknowns. ✅ (completed: 2026-10-03 09:49)
      **Deliverable:** Record independent predictions first; observe a stock false-STOP control,
      no-interference acquisition, returning RESTORE during acquisition, genuine STOP behavior,
      and a bounded nested ingress case. Inspect the one-byte publication/removal protocol,
      incoming registers/status, known-state restoration and the final interference check.
      Include eight saved matrix rows and the two raw port observations, without claiming atomic
      input, uniquely decoded joystick states or all-64-key qualification. Report failed or
      inaccessible cases honestly; this task finishes with evidence, not positive NMI acceptance.
      **Verify:** ACME report/symbols/bytes, sequential VICE observations against the predictions,
      component resource accounting, targeted Markdown/link/source/frozen-path checks and
      independent correctness review. The compiler suite is not required for a docs-only result.

## Contract and predictions before replay

Authority: MOS-6526-1981 port effects; CBM-C64-KERNAL-03 content
`01bd60f162ef92212ef0cb67546ae8f42be34168`, `time::UD60` and
`rs232nmi::NNMI19/TIMB`; MOS-PGM-1976 official NMOS instructions;
VICE-310-SOURCE commit `4d283a2e7dd59b7e378524878e81ecc7826b700c` for the
emulator input mechanism. Expert baseline `2.0.1`, content
`1ce4852016e2a883cf1f733c6014c45e176bfc69`; references
`c64-hardware.md#ports-and-data-direction`,
`c64-memory-and-runtime.md#interrupt-entry-and-exit-contracts`,
`sfa-and-abi.md#final-storage-closure` and
`evidence-parity-and-recovery.md#equivalent-work-accounting`.

The probe requires stock predecessor $FE47, known DDRA=$FF/DDRB=$00, known
PA/PB latches $7F/$A5 and disabled timer PBON. It does not recover arbitrary hidden
latches from pin reads. CIA2 remains firmware-owned. Only the ingress modifies A
and flags, so its wrapper is `PHP; PHA; CLD; body; PLA; PLP; JMP (link)`; X/Y need
no generated saves. The link is not at an NMOS indirect-JMP page boundary.

The hook shares the stock vector's low byte $47. Its entire image and immutable
link exist before publication. A single high-byte store publishes it; a single
high-byte store restores $FE47. The old link is never reused. This covers only the
known stock predecessor, not arbitrary prior vectors or handler-side installation.

The acquisition clears the old interference flag before its first column drive,
then marks the scan active. It restores idle PA before clearing activity and
reading the interference flag. A returning ingress during that window marks the
attempt invalid and establishes idle PA before chaining. Saved rows are never
certified merely because a later PA pin read matches. There is no automatic retry
or approved public acquisition-quality representation in this proof.

| Case                                                                 | Independent expectation                                                                                                                                                                                                      |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stock control; only Cursor U/D held; PA=$FE; RESTORE before row read | PB=$7F is mistaken for STOP by the stock path; observe TIMB without claiming that the probe returns.                                                                                                                         |
| Hook installed, no NMI                                               | Same saved matrix observations as the direct scan; interference remains zero; known idle state restored.                                                                                                                     |
| Same Cursor U/D case with active ingress                             | Ingress writes idle PA=$7F before firmware scans; no false STOP from that interrupted column; returning path marks interference and the acquired rows are not certified.                                                     |
| STOP genuinely held during active ingress                            | Stock STOP/RESTORE warm-start path remains reachable; the hook must not convert it into an ordinary return.                                                                                                                  |
| Ingress inactive                                                     | No generated CIA1 write and no interference flag change; exact stock predecessor still runs.                                                                                                                                 |
| Two genuine RESTORE edges overlapping generated ingress              | Generated stack saves and immutable link survive the bounded overlap; shared interference stores are idempotent. This is not a bound on arbitrary external nesting or ROM reentrancy.                                        |
| Entry/exit and transitions                                           | Generated ingress preserves entry A/X/Y and status at the predecessor boundary; stock RTI restores the CPU-saved status. Publication/removal select only whole old/new vectors. Restoration precedes the final quality read. |

Separate shape/cost prediction: the absolute-address ingress is 23 code bytes,
with zero ZP or invocation-private SFA bytes, two shared bytes and a two-byte link.
It uses two temporary hardware-stack bytes beyond the CPU's three-byte NMI frame.
Same-page generated ingress costs are 28 cycles inactive and 39 active, before the
stock predecessor. Add CPU entry and stock vector stub separately. Layout padding,
acquisition, setup/removal and retained-ROM work must not be hidden in these figures.

## Completion boundary

One bounded proof ends this task. A positive component result does not approve
[AR-P7](../rd-05-nmi-cia2/00-ambiguity-register.md), alter E10245/E10278, qualify a
finite aggregate hardware stack, prove retained-ROM completion, accept arbitrary
storage-bearing NMI callbacks, or close RD-05. Keyboard AR-P2/AR-P3 remain open for
the final ownership and user-visible certainty contract. Unmeasured full acquisition
costs, simultaneous-source cases and physical behavior remain Unknown.

## Results

**Verified partial — VICE-verified / hardware-unverified.** The minimal component
works in these bounded PAL/6569R3, SID6581, old-CIA, stock KERNAL revision-3 cases.
This is hand-written diagnostic assembly, not generated Blend65 output or positive
compiler qualification. No installed product code or test was changed.

| Case                                  | Observed result                                                                                                                                                                                                                                                  | Boundary                                                                                                                                                                                                                        |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stock false-STOP control              | At $20A5, PA/PB pins were $FE/$7F with only Cursor U/D held. Genuine RESTORE reached stock TIMB $FE66 and STKEY=$7F.                                                                                                                                             | Confirms the earlier source inference at this emulator endpoint. The non-return path was stopped before RESTOR/IOINIT; BASIC warm-start completion was not tested.                                                              |
| Installed hook, no event              | Raw PB/PA=$FF/$FF; rows=$7F,$FF,$FF,$FF,$FF,$FF,$FF,$FF; quality=$00; caller pushed P=$30; SP=$F3.                                                                                                                                                               | Correct isolated key observation and no interference. Raw ports are not decoded or uniquely certified joystick states.                                                                                                          |
| Active returning RESTORE              | Before the stock entry, ingress wrote PA=$7F. The stock path returned, quality=$01 and rows were all $FF. No TIMB entry occurred.                                                                                                                                | Prevents this false STOP; a contaminated attempt is explicitly not certified. It does not manufacture a correct row or retry.                                                                                                   |
| State at predecessor                  | Seeded A=$5A/X=$00/Y=$96 with N/V/D/I/C set survived to $215B and $FE47; generated CLD did not leak into firmware.                                                                                                                                               | Architectural N/V/D/I/Z/C are preserved; PHP's pushed B/reserved bits are not extra hardware flags. CPU RTI, not the generated body, restores the interrupted I bit.                                                            |
| Two nested generated entries          | Outer stopped at $2148, SP=$EE. A second RESTORE edge was accepted after its PHA, before CLD: inner $2148 SP=$E9. Inner RTI resumed outer $2149 with A/X/Y=$FE/$00/$96, SP=$ED; outer RTI resumed $2324, SP=$F2. Final quality=$01, caller pushed P=$30, SP=$F3. | A bounded overlapping ingress case, not merely two sequential events. No invocation-private RAM was used. Retained ROM was not preempted in this schedule; arbitrary ROM reentrancy and aggregate stack safety remain unproved. |
| Event during final restoration window | Event injected at $2335 after idle PA restoration but before activity clears. Saved row 0 remained $7F, yet final quality=$01; caller pushed P=$38.                                                                                                              | The window includes restoration and conservatively rejects this attempt. Caller D=1/I=0 is restored.                                                                                                                            |
| Event after activity clears           | Event at $233A took the inactive ingress: no generated PA write, both flags remained zero. RTI resumed $233D with A/X/Y=$00/$08/$96 and P=$27. Saved rows remained the no-event values, quality=$00.                                                             | A later event does not corrupt the completed saved rows or the already loaded quality byte.                                                                                                                                     |
| Publication boundary                  | With old vector $FE47, an edge injected at $2035 ran the stock predecessor before the high-byte publication store. A=$21 survived; $203A observed vector $2147 and the following acquisition completed normally.                                                 | Known-stock predecessor only. Entire hook/link were loaded first; no two-byte transaction was used.                                                                                                                             |
| Removal boundary                      | An edge injected at $2080 ran inactive ingress before removal. RTI resumed the high-byte store at $2082 with A=$FE, X/Y=$08/$96, P=$E9, SP=$F3. $2085 observed vector $FE47; the immutable link stayed $FE47.                                                    | Directly observes D=1/I=0 restoration and old-link lifetime across this transition. Arbitrary prior vectors, handler-side updates and every instruction boundary are not runtime-qualified.                                     |
| Genuine STOP                          | With only STOP held, active ingress marked interference and established idle PA; stock code still reached TIMB $FE66 with STKEY=$7F.                                                                                                                             | STOP/RESTORE was not converted to a normal return. The complete warm-start path and its banking/output behavior remain Unknown.                                                                                                 |
| Known state                           | Read-only debugger inspection after the active returning case: CIA1 PA/PB latches=$7F/$A5, DDRA/DDRB=$FF/$00. CPU DDR/port=$2F/$36 throughout scored cooperative-mapping cases.                                                                                  | Exact declared fixture state, not arbitrary-latch restoration.                                                                                                                                                                  |

All scored events used the genuine VICE RESTORE source through
$FFFA → $FE43 → ($0318), with immutable stock ROM. The temporary hook, not the
debugger, wrote the vector high byte. Each observed stock entry performed its
consuming CIA2 ICR read at $FE51; the ingress performed none. No source bit was
consumed or acknowledged on behalf of firmware. Simultaneous five-source
dispatch and complete retained-firmware timing remain Unknown.

### Resource ledger

These are component costs for the retained diagnostic, not a generated/expert
parity ratio. The wrapper avoids unnecessary X/Y saves; any later compiler
implementation must still meet the equivalent expert sequence.

| Component                        | Exact resource / cost                                                                                                                                                     | Qualification limit                                                                                                                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ingress at $2147–$215D           | 23 bytes; inactive 28 cycles, active 39 cycles, including indirect chain jump; two hardware-stack bytes; zero ZP/private SFA bytes                                        | Branch remains in one page. CPU entry adds 7 cycles/3 bytes; stock SEI/JMP stub adds 7 cycles. Thus arrival-to-predecessor is 42/53 core cycles before DMA or nested events.                                                     |
| Shared coordination and link     | Two deliberate shared flag bytes plus immutable two-byte link                                                                                                             | Not activation-private homes. The link at $3002 avoids NMOS indirect-JMP page wrap and is never reused.                                                                                                                          |
| Publication/removal              | Each LDA-immediate/STA-high pair: 5 bytes/6 cycles                                                                                                                        | Two diagnostic JMP continuations add 6 bytes/6 cycles. No generic arbitrary-vector protocol is claimed.                                                                                                                          |
| Fixture setup                    | 53 bytes/69 core cycles before publication                                                                                                                                | Includes one caller-status stack byte, binary-mode setup, CIA1 ownership setup, known latches and cooperative CPU-port mapping. This is not an accepted public initialization ABI.                                               |
| Acquisition                      | 70 bytes/294 no-event core cycles from $2300 to $2346; eight-byte column table                                                                                            | Includes eight two-NOP settling gaps (32 cycles total), port samples, eight rows, restoration, marker and status/result stores. Physical settling and all-input behavior are unqualified; it is not a production timing promise. |
| Saved observations               | 12 bytes: two raw ports, eight rows, quality and caller-status evidence                                                                                                   | These are deliberate snapshots/test evidence, not hidden interrupt-private scratch. Public result shape remains undecided.                                                                                                       |
| Complete diagnostic image        | 174 instruction bytes + eight table bytes + four initialized shared/link bytes; 3,914 zero gap bytes in the $2000–$3003 payload; 12 result bytes outside the loaded image | PRG payload is 4,100 bytes plus its two-byte load header. Fixed sparse addresses are debugger fixtures, not a production layout recommendation. A later matching-low-byte placement must charge its actual padding.              |
| Stock firmware / aggregate stack | CPU frame is three bytes per accepted NMI; generated save peak is two more per live ingress; stock saves/calls and interrupted mainline remain additional                 | Complete firmware path peak, arbitrary nesting peak, settling-loop completion and physical edge behavior remain Unknown. No finite whole-route stack number is certified.                                                        |

### Identity and reproduction

Current source checkpoint: `aa109785`. ACME 0.97 used
`--cpu 6502 --strict-segments -f cbm` with explicit output/report/symbol paths.
The CBM header is $2000; symbols and bytes confirm ingress $2147, link $3002 and
payload end $3003. Both owned emulator runs exited normally; no user process was stopped.

| Artifact                          | SHA-256                                                                                                                                 |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Assembly                          | `8f3044f732ad598e78b74cf7d40abac53145e30bbe81721ac20daff93042357d`                                                                      |
| PRG                               | `10984d1c1f7dccf4216809cf4e4e4da3b1b430c04a36934ff6736e34eba5b70d`                                                                      |
| Stock-control monitor log         | `2e2de37447c22ccfd3585b884431d40264cef73fd031941b217af71fa0d37139`                                                                      |
| Bridge monitor log                | `a881e204d205a638ddf402780bb14588874f13ac3f1a57108ee70459f5a53598`                                                                      |
| Debugger output / command history | `70a065a64f813d84061a85ddde43a9960d4d2c014b05d94b7f4f76d068965c1a` / `dd7491cc0df58575b7a4a5802897d77895c0782ec0d42e3f6db45b85d727883e` |
| VICE executable                   | `f148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74`                                                                      |
| KERNAL revision 3                 | `83c60d47047d7beab8e5b7bf6f67f80daa088b7a6a27de0d7e016f6484042721`                                                                      |

Raw evidence: `/tmp/blend65-input-bridge.N57PAW`. BASIC and chargen use the
[unchanged T-04 identities](../keyboard-scan-proof/99-execution-plan.md#identity-and-observation-method).
Observed resources: MachineVideoStandard=1, VICIIModel=0, SidModel=0,
CIA1Model=0, CIA2Model=0, KernalRev=3; control ports configured as no device.
No pressed joystick, host key mapping, NTSC, SID8580 or physical-machine case ran.

Reuse T-04's exact GDB/VICE launch. At native BASIC readiness, load `probe.prg`
with device 0. Use native execute breakpoints at the symbols above, trace stock
entry $FE43–$FE47, CIA1 stores and the stock $FE51 ICR read. Native `keybuf ""`
only reaches the host `mon_keyboard_feed` breakpoint. On that emulation thread:

```text
set $matrix = {int[16]} {128,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0}
call keyboard_event_playback(0, $matrix)
call machine_set_restore_key(0)
return
continue
```

The sole nonzero entry is Cursor U/D at PA0/PB7. Genuine STOP instead uses
`[7]=128` with all other entries zero. For an event, call
`machine_set_restore_key(1)` before returning; release then press for the second
nested edge. CPU `r fl=$20/$28/$2C` seeds caller status before `g $2000`.
The active-state diagnostic additionally seeds A=$5A/Y=$96/P=$ED at $2323;
the inactive-removal diagnostic seeds P=$69 before $2080. No live CPU frame,
ROM, CIA pin or physical line was directly patched. GDB's read-only
`machine_context.cia1->c_cia[0..3]` checks hidden latch/DDRs without pretending
that an application MMIO read can obtain those latches.

The control run stops at TIMB and exits before restarting VICE for bridge cases.
Both runs deliberately initialize STKEY=$FF and known CIA1 state. They are not
production keyboard APIs, automatic startup installation or finite-source proofs.

### Decision consequence

**Best option remains the approved direction:** ordinary library-facing input,
with a narrow internal coordination primitive. This proof supports that shape;
it does not justify a general NMI manager or storage-bearing callback ABI.
The immediate blocker is now the explicit frozen proof-scope decision in NMI
AR-P7, not another attempt to invent a physical nesting bound.

After that authority decision, a positive plan must prove the actual generated
route, consistent external-memory-safety reporting, complete startup/shutdown,
remaining source paths, four-profile behavior, and public acquisition uncertainty.
Keyboard AR-P2/AR-P3 are still open. This one proof and its independent review are
complete; RD-05 is not complete.

## Verification and review

The exact four-document scope, unchanged frozen/spec-test paths, 79 local links
and anchors, source keys, retained diagnostic source, six capture identities,
actual PRG bytes, costs and all eight scored bridge-run NMI entries pass the
targeted artifact check. Targeted Markdown formatting and whitespace checks pass.
The roadmap engine reports only its pre-existing portfolio 1/10-versus-4/10 drift,
whose cascade waits for integration; the feature count remains 4/10. No compiler
suite was run or claimed for this documentation-only diagnostic task.

The progress helper displays `1/1 tasks (100%)` but exits 1 because lightweight
plans have no index document, as previously recorded for T-04. Direct task/header
validation passes; no unnecessary index was created to satisfy that helper.

Independent whole-task correctness review (`input_ingress_proof_review`, base
correctness/maintainability/standards lenses) reports **no findings**. The reviewer
independently checked raw logs, hashes, complete image accounting and path costs,
then reran the artifact, formatting and whitespace checks. Security/performance
auditors are skipped because the persistent diff is docs-only. A compiler
implementation will need its own code reviews and complete output qualification.

## Reproducible diagnostic source

The exact diagnostic source is retained below rather than adding a persistent
test harness or shipped support file.

```asm
; Isolated diagnostic. Firmware still owns all CIA2 interrupt acknowledgement.
; The stock predecessor and idle CIA1 state are explicit fixture preconditions.
!cpu 6502
CIA1_PA = $dc00
CIA1_PB = $dc01
CIA1_DDRA = $dc02
CIA1_DDRB = $dc03
CIA1_ICR = $dc0d
CIA1_CRA = $dc0e
CIA1_CRB = $dc0f
NMINV_HIGH = $0319
STKEY = $91
ACTIVE = $3000
INTERFERED = $3001
PRIOR = $3002
RAW_PB = $3010
RAW_PA = $3011
QUALITY = $3012
CALLER_P = $3013
ROWS = $3020

* = $2000
entry:
php
sei
cld
lda #$36
sta $01
lda #$1f
sta CIA1_ICR
lda #0
sta CIA1_CRA
lda #$08
sta CIA1_CRB
lda CIA1_ICR
lda #$ff
sta CIA1_DDRA
sta STKEY
lda #0
sta CIA1_DDRB
sta ACTIVE
sta INTERFERED
lda #$a5
sta CIA1_PB
lda #$7f
sta CIA1_PA
before_publish:
lda #>(ingress)
publish:
sta NMINV_HIGH
after_publish:
jmp acquire

; A single high-byte write restores the unchanged low byte $47.
* = $2080
remove:
lda #$fe
before_remove:
sta NMINV_HIGH
after_remove:
jmp done

; The negative control deliberately gives stock firmware a non-idle column.
* = $20a0
stock_control:
lda #$fe
sta CIA1_PA
stock_before_nmi:
nop
jmp done

; No register except A is modified. PHP/PLP restores the stub-entry flags.
; Idempotent shared writes and the immutable link need no activation-private RAM.
* = $2147
ingress:
php
after_php:
pha
cld
lda ACTIVE
beq chain
lda #1
sta INTERFERED
after_marker:
lda #$7f
sta CIA1_PA
chain:
pla
plp
at_predecessor:
jmp (PRIOR)
ingress_end:

* = $2300
acquire:
lda #0
sta INTERFERED
lda #1
sta ACTIVE
lda #$ff
sta CIA1_PA
lda CIA1_PB
sta RAW_PB
lda CIA1_PA
sta RAW_PA
ldx #0
column:
lda columns,x
sta CIA1_PA
before_row:
nop
nop
lda CIA1_PB
sta ROWS,x
inx
cpx #8
bne column
before_restore:
lda #$7f
sta CIA1_PA
after_restore:
lda #0
sta ACTIVE
before_quality:
lda INTERFERED
sta QUALITY
plp
php
pla
sta CALLER_P
done:
jmp done
acquire_end:

* = $2400
columns:
!byte $fe,$fd,$fb,$f7,$ef,$df,$bf,$7f

* = $3000
!byte 0,0
!word $fe47
```
