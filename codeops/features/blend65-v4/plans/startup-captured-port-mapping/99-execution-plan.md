# Cooperative startup — captured port mapping

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Owner**: #168 / TP-002; prerequisite of the byte-write unit's last checkpoint.
> **Progress**: 7/7 tasks (100%)
> **Status**: Done — complete checkpoint GREEN; included in the combined local checkpoint
> **Reasoning**: high — captured machine state, live register lifetime, firmware interleavings and frozen authority
> **Scope**: strict
> **Production lineage**: `27ebf448`, plus the declared uncommitted byte-write phase; no new clean baseline or green commit is claimed.

## Objective and approved boundary

Repair the full cooperative startup's mapping writes to use its captured port and direction
readbacks, not later live hardware values. Preserve startup snapshots, returning restoration,
source behavior and ordinary unmasked cooperative operation. `$A7` remains a legal input.

**Planning target:** the separately approved TP-002 startup correction, not further selector work
or whole-program parity. **Context:** frozen Appendix C64 §5.1, current startup construction and
status fragments, exact byte-write findings/probes and existing assembly/VICE fixtures.
**Modification set:** this mini-plan and its audit/evidence, parent dependency/roadmap links;
bounded changes in `packages/compiler/src/layout/startup.ts`, additive specification/implementation
tests below, and freshly measured implementation cost pins. Only exact user-recorded oracle
exceptions below are authorized; every other frozen assertion remains unchanged.

The user explicitly approved the bounded repair and ownership ruling on 2026-11-17:

| Decision           | Resolved meaning                                                                                                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compiler writes    | Use `(saved_port & $F8) \| $06`, then `saved_ddr \| $07`, as frozen §5.1 requires. No live-value substitution.                                                                          |
| Firmware ownership | Admitted stock firmware may independently change upper bits while cooperative IRQ service remains enabled. This does not grant the compiler an immutable whole-machine-state guarantee. |
| Existing oracles   | Remain frozen except for separately approved, exact exceptions recorded below. The previous TP-001 exception covers only its own adapter, not this unit.                                |
| Product surface    | No new input restriction, IRQ-route redesign, specification edit, helper/runtime, general analysis or support subsystem.                                                                |

Exclude changes to optimization modes, observer/SFA proofs, source, assets, the repaired twin,
compact/takeover behavior, snapshot sizes/offsets, public APIs, raw vector ownership, IRQ masks,
frozen `spec/`, expert content, the expressiveness ledger and hidden configuration. The existing
single-file task lane suffices: no new algorithm, framework, pass, dependency, runner or registry.
An actual need for material support reopens its reserved gate before tests or code.

## Grounding and decisive counterexample

`spec/appendix-c64.md:219–225` explicitly names saved readbacks. At the pre-repair baseline, full construction captured the
registers at `startup.ts:286–288,335–338`, but mapping re-reads them at `:345–377`. Full status
construction does not add SEI (`startup-status.ts:154–176`). Captured homes already exist, and
normal exit already restores those homes (`startup.ts:502–506`).

The primary's aligned CIA1 probe observes captured `$A7`, a stock-ROM change to live `$07`, then
the compiler's live-read mapping write `$06`. The required compiler write is `$A6`. Natural and
stable-sentinel runs do not refute this distinguishing case. DDR has the same structural reread
mismatch, but that original probe did not change DDR. Source/runtime/physical proof stay separate.

The independent challenge rejected the initial fixture-only recommendation. Changing the broad
canary to `$B7 → $B6` would make saved and live implementations agree and hide this defect unless
the distinguishing saved-value requirement is independently pinned and repaired. The user ruling
preserves the explicit formula; it does not authorize that canary change.

Current parent measurements are code 1,243, entry 328, snapshot 49, SFA 45, resident 7,261 and
payload 7,167. They are a starting point, not this unit's future costs. The first complete parent
gate failed in TP-001; its approved correction now passes and is independently reviewed. A later
directed run exposed TP-002. No green complete checkpoint or compiler commit covers this state.

## Smallest viable design

Reuse the existing full-constructor captures. Retain their exact values through the bounded,
call-free mapping window rather than reading the devices again. No new home or latch shadow.
Keep every snapshot store for normal restoration and keep latch-before-direction write order.

The full status prologue saves caller A/X/Y and the hardware-stack baseline before device capture.
Between the two CPU-port captures and their mapping writes, the full unrolled device/borrowed-byte
captures currently use A only (`saveDevice`, `startup.ts:219–233`). Initializers and any looped
compact capture occur after this window or in a different constructor. Therefore use the existing
free X/Y registers for direction/port captures, keep their existing state-home stores, and consume
the values with transfers into A at mapping. Extend only the existing private capture helper's
register choice if needed; no general register allocator or new module is required.

The equivalent expert local sequence is:

```asm
ldx $00
stx savedDirection
ldy $01
sty savedPort
; Existing A-only snapshots preserve X/Y here.
tya
and #$f8
ora #$06
sta $01
txa
ora #$07
sta $00
```

Its device reads and state stores have the same byte/cycle costs as the old A captures. Two
one-byte/two-cycle transfers replace two two-byte/three-cycle live loads at mapping: a local
two-byte/two-nominal-cycle improvement without omitted snapshot data. This is an independent
assembly expectation, not a measured future whole-program pin. If the actual lifetime cannot
support this sequence under the admitted contract, stop and re-evaluate rather than introduce
new scratch, hidden storage, an entry restriction or a silent cost exception.

The existing pinned returning IRQ/NMI paths preserve interrupted A/X/Y; no new route or saved
link is introduced. Keep the prior entry assumptions: no new `$FE47` requirement for no-hook
programs. Nonreturning RESTORE/STOP, arbitrary external handler guarantees, aggregate stack,
firmware reentrancy/completion, whole-frame timing and silicon remain outside the proof.

Preserve the compact/takeover branches and all return construction. Full startup's internal X/Y
contents at main need not equal the caller's registers: caller snapshots and normal restoration
must remain exact, and language entry has no incoming register arguments. Verify this boundary
against consumers rather than infer it from current code shape.

## Independent specification handoff

The implementation-blind author may write only these new oracles:

| File                                                              | Independent contract                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/compiler/src/layout/startup-captured-port.spec.test.ts` | Full construction reads each CPU register once for capture, keeps both snapshot stores, uses those values for ordered mapping, and leaves other construction contracts intact. Four cooperative profiles; restore enabled/omitted and borrowed snapshots.                                                        |
| `test/rd05/startup-captured-port-vice.spec.test.ts`               | Existing public build and monitor: after capturing known readbacks, change live values before mapping; verify the compiler writes the captured-derived values, exact order/count and retained D/I/stack/vector state. PAL/6581 runtime; source-derived expected values, not optimized-vs-unoptimized comparison. |

Supply the existing `createC64Startup`/state-layout/type signatures, profile selector and public
build/monitor fixture interfaces as excerpts. The author may read approved requirements and pure
types, known example inputs and its assigned test files. Forbidden: startup/status/selection or
storage implementation bodies, generated artifacts, implementation tests, other oracle bodies
as expectation authority, qualification cases/graders/oracle maps. No old spec/helper edits.
The primary owns all command/emulator execution and formatting. No new emulator driver, CPU
interpreter or general instruction/dataflow analyzer is allowed; use existing observation seams.

| Case                                                                                | Independent expected result                                                                                                                                                                           |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Saved DDR `$FF`, port `$A7`; later live port `$07`                                  | Compiler's mapping store is exactly `$A6`, not `$06`; data write precedes direction write. Keep `$A7` as the distinguishing legal input.                                                              |
| Saved DDR differs from a later live direction byte with low mapping pins kept valid | Compiler's direction store is `saved_ddr \| $07`, not the later byte's value. A controlled host interleaving is a provenance probe, not a claim of a new stock firmware DDR writer.                   |
| Values preserved only in X/Y                                                        | Snapshot bytes remain the original reads; all intervening captures preserve the chosen holds. No unproved hold across an initializer, loop, call or return.                                           |
| No live mutation                                                                    | Same source-visible mapping, bank-zero selection, snapshot state and restoration as before. D=0 and original I at the application boundary.                                                           |
| Normal return                                                                       | Restore the same captured caller A/X/Y/P and observable machine state; no additional hardware-stack byte, ZP, helper or function scratch.                                                             |
| Compact/takeover constructors                                                       | Unchanged behavior and emitted obligations; they do not enter the full-only specialization.                                                                                                           |
| Expert output                                                                       | One read per CPU register, existing snapshot stores, two transfer-based consumers; no second volatile device read or new scratch. Measure complete entry/code/data/padding/resident costs separately. |

For runtime setup, an execute stop after the relevant snapshot store establishes that capture
finished before a controlled live-value change. Derive the point from actual typed/public evidence;
do not assume a stopping store watch leaves the CPU in the mainline. Verify captured bytes before
injecting changes. Temporary input-phase control is diagnostic only, not a source workaround.
Keep the existing source accepted and use the exact selected public profile/PRG. Host-controlled
input changes isolate saved-value provenance; physical hardware and unrestricted external
interleavings are not inferred. Record meaningful RED before any startup production edit.

## Exact existing-oracle authority gate

The user separately approved these two surfaces before implementation; these original hashes
identify the pre-exception bytes, and [verification](08-verification.md) binds the active freezes:

| Existing file / boundary                                                                                                | Current status                                                                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test/rd05/boing-ball-startup.spec.test.ts`, hash `7662d056defb2ec251b38fb03a9e30df08ab658813a52df774b78125773a6d49`    | Only the broad canary seed `$A7→$B7`, exact expected `$A6→$B6` and adjacent sentinel comment are approved/applied. New distinguishing `$A7` regression coverage stays intact. |
| `test/rd05/byte-write-forwarding.spec.test.ts`, hash `b5a9560acb4433dbcb8282dc5e4fa140dd7e3c3d52a17cf37806790b553399e1` | Only exact full-entry extent `328→326` is approved/applied, derived from the independent two-byte-shorter assembly expectation rather than matching implementation output.    |

Existing `<=328` caps in returned-local/fixed-object specifications are not invalidated by a
smaller entry and need no amendment. Other original behavior assertions stay frozen. Before
implementation, present the exact affected expressions and independently justified replacement
expectations for user approval; preserve the original hashes, record the ruling and re-freeze.
If approval is absent, stop at that task rather than narrow source behavior, retain needless code,
pad the output, weaken an assertion or mark a known failing impacted tier verified.

The later RV-001 ruling authorizes only the new constructor oracle's expected selected-read
array `[0,1,$DD02,$D018,$D015]→[0,1,$D018,$D015,$DD02]`, preserving the baseline chronology.
Its original and active hashes, exact-byte validation and independent fix-review are recorded in
[findings](05-findings.md). This is no permission to move production MMIO or relax another check.

The host-impact discovery adds one separately approved exact exception in
`test/m1/pipeline.spec.test.ts`: only `paddingBeforeBytes: 2936→2938`. The unchanged sprite stays
at `$2000`; the two-byte code saving increases its preceding gap. Original hash
`c2a738a96f6cfe9670c66e8142ad819d7a3f203c446d96ea93bed4691b947321` and active hash
`dc11c7f1ca1dc782089e699b31fa0441742f3492d263320c13cdfee978cea04d` bind that exception.
Exact reconstruction and independent application check pass; every other M1/expert-floor check
is unchanged. Seventeen current-output implementation snapshots in seven RD-04 cost files and
the RD-08 exact-output file are also reconciled under the measured-pin scope, not spec authority.

RV-002 adds only the separately user-approved saved-none payload2,161→2,159 and PRG hash in
`test/rd05/canonical-fixed-object-abi-fallback.spec.test.ts`. Original SHA
`de1900b7b209bbf1d76c5ba64b9ff19b60ec2c31698c253855a860dd03c712fc` becomes active
`414f14a0ae4d7051633cd0ee105b259a47cb33efce8305e29bce08cdf3051296`; exact reconstruction and
independent fix-review pass. All other assertions, especially runtime20-second waits, stay unchanged.

## Evidence, review and integration

The working tree contains the declared uncommitted parent phase, including the approved TP-001
adapter correction. Do not reset, stash, commit a broken tree or pretend `27ebf448` represents that
state. Before implementation, record an exact allowlisted hash/diff manifest for this unit's
starting startup files and owned test paths; review the new correction against that boundary.
Keep parent and dependency evidence separately attributed. A coherent green integration commit
may include both units only after their actual required gates pass; use the git-commit skill,
never push or close #168 automatically.

**Specialist check: None.** Existing correctness, semantics/DX, SFA/ABI, target-platform,
machine-code and host-performance roles cover register preservation, platform state, actual bytes
and the bounded constructor cost. Use those six lenses without adding a specialist or support
system. Expert authority remains qualified frozen 2.0.4, content
`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`; saved-state/ownership ruling is explicit product
authority. References: SFA/ABI storage/interrupt completion, CPU register/flag effects, startup and
pinned IRQ/NMI entry/exit, expert equivalent-cost accounting. Source keys
`BLEND65-SPEC-4-038b70e9`, `MOS-PGM-1976`, `MOS-6510-1982`, `CBM-C64-KERNAL-03`.

## Tasks

- [x] T-168.22 After independent preflight, author/freeze the new specification files from requirements and signatures only; validate observation adapters and meaningful saved-versus-live RED before implementation. All 51 cases are independently authored/frozen: constructor 32 intended failures/16 controls pass; VICE validates observation points and fails only saved-versus-live write expectations after a pre-freeze tail-entry SP clarification. The author corrected that single fixture assumption without implementation exposure; no existing oracle or startup production edit. Active hashes and exact actual results are in [verification](08-verification.md).
- [x] T-168.23 Obtain exact separate user rulings for any existing-oracle amendments required by the full-entry change and broad canary. On 2026-11-17 the user explicitly approved only `$A7→$B7` / expected `$A6→$B6` plus the sentinel comment, and the entry pin `328→326`. Primary verified exact reconstruction from preserved original bytes, formatting and unchanged new `$A7` freezes. Active old-oracle hashes are re-frozen in [verification](08-verification.md). No other assertion changed; no broader oracle permission. This gate is closed before startup implementation.
- [x] T-168.24 Implement only the bounded full-constructor capture/consumer correction using existing state and proved register lifetimes; pass new specifications and all approved affected expectations, without changing compact/takeover or IRQ ownership. Constructor48/48, fresh compiler build, public22/22 and serialized VICE5/5 pass. RV-001's exact user-approved one-array correction is independently fix-reviewed/re-frozen; all other assertions and production chronology remain unchanged. Private-helper/lifetime comments pass the documentation self-check. No new storage or route. Wider regression/resource proof and the complete gate remain separate tasks; see [verification](08-verification.md).
- [x] T-168.25 Run directed public/serialized VICE startup, restoration and boing regressions; measure complete actual bytes/resources and reconcile any downward implementation pins without deriving the oracle from observed output. Layout139/139, integration67/67 and serialized runtime89/89 pass, including exact cooperative return, borrowed-state and raw-takeover controls plus source-ordered boing/frame/sampler oracles. Actual code1,241/entry326/returning607, SFA45/resident7,261/payload7,167/padding4,890; twin442, remaining gap799. Only two downward implementation pins changed. Frozen expectations and source are unchanged. No whole-frame/physical/external-aggregate or complete-gate claim.
- [x] T-168.26 Add implementation controls for full/compact/takeover isolation, intervening capture liveness and final layout/state closure; run the affected compiler and host tiers. Controls18/18 and affected9files/22cases pass. Exact approved M1 scalar and measured implementation snapshots are reconstructed/independently checked/re-frozen as applicable. Fresh changed+host passes fast1,282/layout146/machine1,033/changed integration45/serialized VICE6 and complete host248files/5,183tests;491.58s. Original failed run remains recorded. No new production change, historical body-byte identity or complete-gate claim.
- [x] T-168.27 Complete all six independent bounded execution reviews, dispose findings within exact authority and fix-review once where required. All six independent execution lenses report no findings. Emitted-code review directly inspects the primary's fresh bounded actual assembly/byte/symbol handoff and closes the final-placement endpoint; no denied external-log read is retried or bypassed. Exact prior erratum/exception rulings remain fixed and bounded. Fresh changed+host is GREEN. Full gate, whole-program parity/timing and external/hardware guarantees remain separate.
- [x] T-168.28 Verify frozen install/build/typecheck, changed+host and a fresh complete workspace/host/serialized VICE checkpoint after dependency repairs. Completed2026-11-17 18:44: actual `yarn test:full` exits0 in4,784.128s; host248files/5,183tests and serialized VICE132files/2,383tests pass (existing1file/4test skips). Workspace cache replays compiler250/4,166+2existing skips, CLI70/server21/editor18; all7Turbo tasks pass. Fresh formatting/install/build/typecheck pass; all40 guarded inputs unchanged and VICE marker present. Original runtime20-second waits stay unchanged and safe-return passes. Prior failure/Unknown cause and restart-cleared raw evidence remain documented, not retrospectively explained. All six reviews already clear, no new production/oracle change; scoped deferral assessment reconfirmed. Combined green local commit follows; no push or #168 closure.

**Verify:** plan-only formatting, links, source keys and exact scope/authority bindings first.
During implementation, new constructor specs and affected existing startup/layout tests, real
public builds and serialized VICE; then `yarn test:changed --host`. At the combined green phase
checkpoint run `yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`, `yarn test:full`.
The full command includes workspace/host then serialized VICE; no duplicate outer host gate or
concurrent emulator. An isolated rerun never replaces a passing complete run. Keep owned logs and
scratch under `$CODEOPS_TMPDIR` and clean them after persistent evidence/checkpoint. No sensitive
file/configuration access or hidden writes; native denials remain binding for every owner.
