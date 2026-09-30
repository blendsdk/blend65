# CIA1 Return-to-BASIC Closeout

> **Scope**: DEF-14 on four cooperative C64 PRG profiles; not whole-RD-05 closeout
> **Status**: Done — implementation, qualification and closeout verified
> **Date**: 2026-09-30
> **Implementation commit**: `886038d5`

## Delivered boundary

A qualified final exclusive `c64.system.restoreIRQ()` now returns CIA1 to stock
901227-03 KERNAL/BASIC Timer A service, inside the existing masked vector
transaction. It masks all CIA1 sources, stops both timers, consumes pending game
events once, writes the PAL/NTSC reload low then high, restores the exact saved
CINV, enables only Timer A, and loads/starts it before restoring caller status.
It preserves A/X/Y, I/D and stack obligations. There is no new source operation,
runtime flag, manager, helper, scratch or function-storage allocation.

The final exclusive release performs this handback even without typed writes.
Clean inner LIFO pops remain vector-only; changed inner owners and unproved
predecessors fail with source-linked E10278. Known raw CIA1 timer/control/ICR
effects, including mirrors and word-crossing writes, cannot silently become a
typed lease. AR-P10 retains their provenance before installation and between
leases, through calls and joins. Opaque runtime addresses retain the existing
explicit caller-owned hardware escape. Returning `main` still requires empty
ownership stacks. Arbitrary old write-only masks/latches and custom resident
IRQ/CIA1 service are not reconstructed; stock machine entry is required.

The independent [source](../../../../../test/rd05/cia-basic-return.spec.test.ts),
[provenance](../../../../../test/rd05/cia-basic-return-provenance.spec.test.ts),
[output](../../../../../test/rd05/cia-basic-return-output.spec.test.ts) and
[VICE](../../../../../test/rd05/cia-basic-return-vice.spec.test.ts) oracles are
green. Four sequential runtime cases cover PAL/NTSC with SID 6581/8580, an old
pending Timer A event, exact CINV and device order, status/stack, continuing jiffy
ticks and keyboard service after normal return. Handback writes no CIA2/SID;
the unchanged later startup exit restores captured CIA2 port A then its direction
register, with no other CIA2 or SID write. Final unrelated-state equality holds.
Status remains **VICE-verified / hardware-unverified**; physical CIA-edge and
revision-sensitive QA belongs to RD-10.

## Exact authority and evidence

Specification 4.0 normative digest:
`1c2a2d7544e263020c6b7c5b40dc15aa23178d15e6b12b4e0224b18667e48dcf`.
Expert `2.0.1`, qualified content
`1ce4852016e2a883cf1f733c6014c45e176bfc69`; release binding
`e063ef575d13c02c076c94e24616dd27ae4a75e2`.
The [authority evidence](06-authority-evidence.md) records the approved narrow
contract correction, Language Guard, qualification and activation before code.
No specification or expert file changed during compiler implementation.

Governing expert references: `c64-memory-and-runtime.md#stock-cia1-service-on-final-exclusive-release`,
`c64-memory-and-runtime.md#interrupt-entry-and-exit-contracts`,
`c64-hardware.md#cia-register-effects-and-ownership`, and
`sfa-and-abi.md#interrupt-route-completion-gate`. Primary keys:
`MOS-6526-1981`, `CBM-C64-KERNAL-03`, `MOS-PGM-1976`, `MOS-HW-1976`,
`ACME-097-R266`, `VICE-310-SOURCE`, `VICE-310-MANUAL`.
Published build/debug metadata names this exact approved authority. Its existing
schema hashes the specification identity string and expert content-commit string;
those sidecar hashes are not the raw normative-corpus digest.

The real `cia-return-ledger` fixture uses NMOS 6510, optimization `none`, ACME
0.97, stock KERNAL/I/O visibility (`$01` low bits `$06`) and CIA model 0. Source
SHA-256: `bab1d0b2ca09ba701b961d0b9f677aaee06794eb73f8b7c2d298d199e788c1eb`.
Fresh artifact/resource records:
`/tmp/blend65-cia-provenance-artifact-ledger.jsonl`; preceding independently
reviewed path records: `/tmp/blend65-cia-return-path-ledger-final.jsonl`.
These are session captures, not required repository inputs; permanent independent
tests and the exact recorded identities/costs remain in this checkout.

| Profile pair | PRG SHA-256 | PRG bytes |
|---|---|---:|
| PAL, either SID | `4e26ba4218c9ddf5a34a2535b23bee7fee48e20aa1151caf8e6ab4f15c701e1d` | 860 |
| NTSC, either SID | `65cc2945422689a33f898fa95f09915a0ec36ea6c65b900d728c7026ad73de31` | 860 |

Fresh post-AR-P10 artifacts reproduce these hashes and identical memory/cost
sidecars. The proof correction has zero emitted-byte/cycle/storage delta.

## Complete resource and route ledger

| Fixture resource | Qualified amount / ownership |
|---|---|
| Resident bytes | 916: 858 program + 50 existing platform-state + 8 existing closed RAM homes |
| PRG transport | 860: 858 program + two-byte load address |
| ZP / separate scratch / handback-added homes | 0 / 0 / 0 |
| Existing SFA homes | Saved link 2 bytes `$0B8D–$0B8E`; handler locals/retained values 4 `$0B8F–$0B92`; main 2 `$0B93–$0B94` |
| Hardware stack | Qualified peak 28/256: 6 entry + 20 platform reserve + 2 program route; headroom 228 |
| Saved predecessor | Exact private SFA-owned LIFO word; this fixture is page-safe, not `$xxFF`; `$xxFE` remains legal |
| IRQ source / acknowledgement | CIA1 Timer A/B under the exclusive route; one consuming ICR read, ordinary source branches handle returned bits |
| Entry / terminal | Stock 901227-03 CINV route; only the reachable exclusive callback variant; `$EA81` ROM restore tail ends with RTI |
| Re-entry / shared state | Handler has I set, no source CLI; IRQ frame is finite; complete interrupted status including D restored by RTI; no NMI ownership change |

The callback is not an ordinary JSR/RTS target. Helpers retain normal ABI/SFA
ownership; no link, local, spill or scratch is invented after storage closure.
Entry masks all peers before acknowledgement; final stock service enables only
Timer A. Banking makes the selected firmware vector, KERNAL and CIA1 visible.

| Code component | Output bytes | Nominal instruction cycles |
|---|---:|---:|
| BASIC stub | 12 | BASIC interpreter work not included |
| Startup entry | 345 | 463 |
| `main` | 146 | 210 |
| Selected IRQ variant | 68 | 63 / 70 / 70 / 77 for pending `$00/$81/$82/$83` |
| Startup captured-state restore | 287 | 393 |
| Final handback (within `main`, not additional residency) | 61 | 86 |
| Ordinary vector-only restore (unchanged) | 17 | 32 |

Complete IRQ paths add CPU entry 7 cycles, pinned ROM entry 29 cycles and ROM tail
22 cycles: **121 / 128 / 128 / 135 cycles** for those pending values. The firmware
entry is 16 existing-ROM bytes and its tail 6 existing-ROM bytes, both contributing
zero PRG bytes. The compiler CLD/JMP wrapper is 4 output bytes/5 cycles, already
inside the selected variant. CPU entry uses 3 stack bytes; KERNAL saves A/X/Y in
another 3. Pending-bit branches, acknowledgement, banking, status and terminal
owners are included rather than reduced to wrapper cost alone.

The measured return fragment from handback through NOP/JMP and startup restore
is 352 bytes/484 nominal cycles (61+1+3+287 bytes; 86+2+3+393 cycles). These are
instruction-core costs, not elapsed hardware time: interrupted-instruction
completion, VIC bus stalls and asynchronous interrupt counts are not constant.
Whole entry-to-return execution cost remains **Unknown**, not a sum of static
regions. Physical chip/revision behavior is not inferred from VICE.

## Expert parity and remaining debt

The same-contract expert absolute-link sequence is 61 bytes/86 cycles, so local
delta is **0 bytes / 0 cycles**. There are fourteen ordered memory effects:
twelve volatile device/vector effects and two saved-link reads. The protocol's
extra work compared with vector-only restore is required behavior, not an
equal-contract optimization comparison. No whole-program beat is claimed.

[Issue #93](https://github.com/blendsdk/blend65/issues/93) retains the RD-08 path
to a win: a proved two-byte ZP saved-link home could produce 59 bytes/84 cycles
(-2/-2), moving two existing RAM bytes to scarce ZP rather than adding storage.
Independent reference fragments assemble to 61 versus 59 bytes; the ZP variant
is not current generated or VICE-qualified optimized output. Page safety,
interrupt-domain/nested-link interference, SFA closure and whole-program ZP
opportunity cost must be proved first. The existing storage-operand seam keeps
that optimization reachable; this slice adds no allocator or optimizer.
[Issue #92](https://github.com/blendsdk/blend65/issues/92) separately owns CIA
register-value reuse while preserving volatile accesses.

PE-001 originally identified a minor compile-time debt: mutation-bearing deeply
nested helper diamonds duplicated memo contexts. That review's depth-16 probe
had 131,072 keys versus baseline 34 and roughly 1.28 seconds versus 1 ms; full
check used about 133 MB heap. There was no emitted output defect.

The subsequent [T-02 bounded fix](../cia-analysis-memoization/99-execution-plan.md)
shares untouched caller mutation prefixes while IRQ entry stays masked. Its
depth-16 evaluation count falls from 131,072 to 34; caller facts, diagnostics and
four-profile output hashes remain unchanged. Full verification passes 2,902 tests
and three independent reviews report no findings. IRQ-enabled or transitively
unmasking helpers deliberately retain exact contexts to preserve handler-entry
discovery. Their remaining worst-case repeated work stays owned by RD-05 analysis
hardening. Key serialization and prefix copying still scale with route depth;
this is not a universal linear-time claim. No generalized transfer framework
was added.

## Verification and review

`yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`, and `yarn test`
all pass: compiler 1,594; root 1,113; CLI 62; language server 14; VS Code 6 —
**2,789 tests**. VICE runs sequentially. Logs:
`/tmp/blend65-cia-provenance-checkpoint-{install,build,typecheck,test}.log`.
Directed source cases 152 and internal route/machine cases 33 also pass.
The AR-P10 independent regression is 40 expected-red cases/16 controls before
the fix, then all 56 green. Its frozen hash and every earlier oracle's approved
hash are recorded in the [execution plan](99-execution-plan.md).

Correctness, semantics and performance reviews cover the whole phase. SR-001 was
corrected only after explicit approval; the one permitted fix-only correctness
and semantics review cycle has no findings. RV-001 count bookkeeping is corrected;
PE-001's original review and subsequent bounded disposition are recorded above.
Sixteen touched TypeScript files pass formatting, and whitespace, local links
and exact frozen-authority checks pass.
Markdown follows the existing authored-documentation formatter exclusion.

## Deferral-expiry answer and remaining owners

**Did this slice's deliverables expire any deferral's stated rationale? Yes —
DEF-14's missing reverse-handoff proof is now delivered and qualified.** Close
DEF-14; no replacement backlog item is needed for completed work. No other
deferral rationale expires, and none names this closing slice as a future owner.

The walk covers the [requirements decisions](../../requirements/00-ambiguity-register.md),
RD-04 and all RD-05 ambiguity registers, this plan's scope decisions, the
[RD-05 Won't Have list](../../requirements/RD-05-c64-platform-profiles-and-game-workload-compiler-support.md#wont-have-out-of-scope),
[future reconsideration criteria](../../../../../spec/future-considerations.md),
and the [current expressiveness ledger](../../../../../test/rd04/expressiveness-ledger.json).
The ledger's sole active NMI limitation remains justified; its IRQ-update and
stack-overestimate entries are already retired. There is no DEF-14 ledger row
to rewrite and no new ledger framework.

| Remaining item | Why still open / owner |
|---|---|
| DEF-7 / CIA2 / NMI / RESTORE | No finite NMI re-entry or atomic-update/source handoff proof; RD-05 R5.15–R5.17. Counter reads remain allowed; CIA2 configuration and consuming ICR remain rejected. |
| Other RD-05 deliverables | This is a bounded slice, not RD-05 completion. Whole-RD portability/deferral audit R5.53 and AC-42 still apply at its final closeout. |
| PE-001 residual | T-02 fixes masked-helper diamonds. IRQ-enabled/unmasking exact contexts and their worst-case repeated work remain owned by RD-05 analysis hardening; no new runtime system. |
| Native assets / SpritePad | Native parsing/producer qualification remains RD-06; CIA1 release supplies no asset-format proof. |
| Delivery / optimization / tooling | D64/loaders RD-07, peepholes/allocation/expert-output RD-08, production editor/debugger RD-09; no new engine/framework surface. |
| Windows / physical hardware | DEF-1/DEF-3 native Windows and targeted CIA-edge/revision QA remain RD-10; no earlier access request. |

FUT-006/007 still lack demonstrated loop/range syntax need; FUT-011 lacks an
approved external-assembly ABI/link contract; FUT-012 remains redundant with
aggregate language semantics. FUT-015 conversion demand/algorithm proof is not
supplied by this device work. The 28/256 stack qualification does not trigger
FUT-016. No new cross-statement scheduling or distinct volatile-RAM contract
triggers FUT-017/018. Resolved entries remain resolved; rejected forms and future
machines are not revived. RD-05 stays Executing. The feature count remains 2/10;
portfolio numerical cascade is deferred until integration under branch policy.
