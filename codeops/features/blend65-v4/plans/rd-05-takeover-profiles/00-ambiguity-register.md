# Ambiguity Register — RD-05 Takeover Resident Profiles

> **Status**: Closed for implementation; findings tracked separately
> **Updated**: 2026-11-12

The frozen Specification 4.0 and the qualified expert baseline are authority. This
register records implementation-shape decisions that the frozen text leaves to the
compiler, plus discrepancies that must not be silently repaired. Each decision is
grounded in the cited files.

## AR-T1 — Executable profile inventory

**Decision:** Add exactly the four already-recognized takeover IDs to the executable
closed profile table. Do not add aliases, runtime composition, or independently mixed
video/ownership/SID switches. The manifest keeps its nine recognized IDs (eight PRG plus
the PAL D64).

**Rationale:** RD-05 R5.1/AC-01 and `packages/compiler/src/project/manifest.ts:21–30`
already recognize the IDs; only `C64_KERNAL_PROFILES` and `selectTargetProfile` exclude
them.

**Rejected:** synthesizing takeover IDs from a `kernal` ID plus a user-owned ownership
switch (violates R5.1's indivisible identity rule).

## AR-T2 — Takeover startup and normal return

**Decision:** Keep the shared 12-byte `$0801` BASIC stub and `$080D` entry. At
`$080D` the takeover constructor:

1. saves A/X/Y, original status and stack pointer;
2. executes `SEI` and `CLD`;
3. saves `$0000` (DDR) and `$0001` (latch);
4. writes the complete default raw NMI (`$FFFA/$FFFB`) and raw IRQ (`$FFFE/$FFFF`)
   vectors **into underlying RAM while KERNAL ROM still supplies the active read path**;
5. writes `(saved_latch & $F8) | $05` to `$0001`, then `saved_ddr | $07` to `$0000`;
6. executes `CLI` and runs initializers then `main`;
7. on normal return executes `SEI`, restores `$0001` then `$0000`, restores the saved
   stack pointer, status and registers, and executes `RTS` to BASIC.

**Rationale:** Specification appendix C64 §5.1 (raw takeover profiles) and §2/§3;
`spec/appendix-c64.md:217–231,271–281`. Writes to `$E000–$FFFF` reach the underlying RAM
even while ROM supplies reads, so the vector bytes can be installed before the single
mapping change. Both sides of that change are valid: the ROM vector before, the complete
RAM vector after.

**Rejected:** changing `$01` twice (one temporary exposure plus one final switch), which
would expose an incomplete vector between the writes.

**Rejected:** using `$34` or `$07` for the mapping. The frozen contract prescribes
`$05` under owned mask `$07` (`spec/appendix-c64.md:1081`).

## AR-T3 — Default raw vectors and source ownership

**Decision:** Startup installs two compiler-generated default entries:

- default raw IRQ: preserve A, read CIA1 ICR once (`$DC0D`), read VIC `$D019` and write
  the observed bits back to clear them, restore A, `RTI`;
- default raw NMI: `BIT $DD0D` (consume inherited CIA2 pending state once without changing
  A), then `RTI`.

The default IRQ entry is the valid baseline route when source installs no raw IRQ
handler. It acknowledges the only stock-enabled source (CIA1 Timer A) and the VIC raster
source, without changing any write-only CIA mask or timer latch. The default NMI entry
explicitly replaces RESTORE/NMI behavior with "ignore"; CIA2 NMI sources remain disabled
until source code proves a raw NMI owner (AR-T7). `BIT` preserves the interrupted A, which
`LDA` would clobber.

**Rationale:** the takeover contract requires a complete valid RAM vector on the exposed
side, and explicitly says a takeover must define RESTORE behavior or prove the source
absent (`spec/appendix-c64.md:271–281`; expert `c64-memory-and-runtime.md:425–433,475–479`).
Not writing CIA masks avoids an unrecoverable write-only state and keeps the return path
honest.

**Rejected:** masking all CIA sources at startup. The write-only mask cannot be captured,
and a non-stock mask left behind would break BASIC's timer after return.

**Rejected:** a default NMI handler that uses `LDA $DD0D` (clobbers A) or a bare `RTI`
that leaves inherited CIA2 pending flags unowned. A future source raw NMI install replaces
this default entry before it can run.

## AR-T4 — Raw source surface

**Decision:** Takeover profiles expose exactly:

- `c64.system.setRawIRQ(&handler)`
- `c64.system.restoreRawIRQ()`

Cooperative and D64 profiles continue to expose `setIRQ`, `setIRQExclusive`,
`restoreIRQ`, `setNMI`, `setNMIExclusive`, `restoreNMI` and not the raw names. Profile
constants become `hasRawInterrupts = true` and `usesKernal = false` on takeover.

`c64.system.setRawNMI` and `c64.system.restoreRawNMI` are **not exposed** in this slice.
Startup still installs a complete default raw NMI entry and the profile still owns the
NMI vector and all enabled NMI behavior. Source-installed raw NMI is deferred as
`V4-TAKEOVER-F2` because the frozen text withholds the cooperative unbounded-NMI
exception from takeover (`spec/06-functions.md:777–797`; RD-05 R5.17) and no finite
external NMI arrival bound exists. Exposing an installer whose admission rule could not be
satisfied would be a false capability claim.

**Rationale:** appendix C64 §9.2 names the raw installers; `spec/06-functions.md:842–859`
requires each recognized sink to have a matching restore and a per-sink LIFO proof. The
existing frontend declaration table is the single source of source-visible names. The raw
IRQ sink has a proven IRQ-masked transaction and a finite entry bound; the raw NMI sink
does not have an authorized unbounded-route proof for takeover.

**Rejected:** a generic `installVector(address, handler)` sink (runtime dispatch and
unproved ABI); exposing both families in one build (the frozen routing maps replace rather
than extend: `spec/appendix-c64.md:1017–1070`); implementing raw NMI by reusing the
cooperative exception, which the frozen text explicitly withholds.

## AR-T5 — Raw NMI publication

**Decision:** The startup default NMI stub is placed at low byte `$47` by the existing
`nmiPublicationEntry` layout mechanism. A future source raw NMI installer would use the
same rule: install captures the two-byte predecessor and writes only the vector high byte
(`$FFFB`); restore writes only `$FFFB` from the captured word. All intermediate vectors
therefore select a complete old or new entry. A fixed or automatic placement that cannot
satisfy the matching low byte is rejected rather than adapted. Source raw NMI is deferred
(AR-T6), so this slice exercises the startup stub only.

**Rationale:** `SEI` does not mask NMI (`spec/appendix-c64.md:273–281,790–799`); the
expert contract allows a high-byte-only update only after a complete matching-low,
predecessor-capture and live-link proof
(`c64-memory-and-runtime.md:463–479`). The existing cooperative layout already implements
this mechanism for stock `$47`.

**Rejected:** writing both raw NMI vector bytes inside `SEI` (torn intermediate vector);
a runtime dispatcher or table (forbidden); assuming no NMI can arrive.

## AR-T6 — Raw NMI source-installer deferral

**Decision:** Source-installed raw NMI is deferred (`V4-TAKEOVER-F2`). The default raw
NMI entry reads CIA2 ICR once (`$DD0D`) to clear any inherited pending flag, then
executes `RTI`. It changes no write-only CIA2 mask. A program that performs a typed CIA2
state or source operation without a proved raw NMI owner fails `E10278`; the default
entry is not an "owner" for source-enabled CIA2 sources.

**Rationale:** NMI is non-self-masking and externally unbounded. The frozen text permits
an unbounded private-home-free NMI route only under the four cooperative PRG exception and
explicitly withholds it from takeover (`spec/06-functions.md:777–797`; RD-05 R5.17). The
default entry is not an unbounded source-installed route: it is the compiler's complete
baseline behavior, it consumes inherited CIA2 pending state exactly once, and it does not
promise a source handler. A source-installed raw NMI needs a finite arrival/completion
proof or a governing change, neither of which exists in this slice.

**Rejected:** admitting `setRawNMI` through the cooperative private-home-free proof (it is
explicitly withheld); a blanket `setRawNMI` that ignores the unbounded overlap (unsafe);
leaving the NMI vector empty (violates the complete-vector transition).

## AR-T7 — Raw IRQ admission and CIA1 return

**Decision:** A raw IRQ route counts as an exclusive IRQ owner for the existing CIA1
analysis. A source-installed raw IRQ handler must prove it handles or disables every
enabled CIA1 source before the route can be installed: either the CIA1 possible-source
set is empty at the install, or **every path through the handler** executes a
`readAndClearPendingSources`/full `disableInterruptSources` effect before returning. A
consume in the entry block or an all-path helper proves the requirement; a conditional or
early-return consume does not. Otherwise the install is `E10278`. The final pop must be
clean because takeover receives no cooperative
stock-handback exception. A takeover program that leaves CIA1 timer or mask state changed
on a returning path fails `E10278`. CIA2 typed operations require a proved exclusive raw
NMI owner; because source raw NMI is deferred, they are rejected in this slice.

**Rationale:** appendix C64 §5.1 excludes takeover from the cooperative CIA1 handback
(`spec/appendix-c64.md:241–261`); the release record rejects a raw raster-only handler
until CIA1 is handled or disabled (`qualification/release.md:2840–2848`). Leaving the
stock Timer A source unacknowledged would re-enter the raw handler forever.

**Rejected:** accepting a VIC-only raw handler (unacknowledged CIA1 livelock); reusing
the cooperative stock Timer A handback on takeover (not authorized by the frozen text).

## AR-T8 — `$A000–$BFFF` under the prescribed `$05` mapping

**Resolution:** There is no memory-map discrepancy. The qualified expert selection table
states that with `HIRAM=0, LORAM=1` the `$A000–$BFFF` CPU view is **RAM**, not BASIC ROM
(`c64-memory-and-runtime.md:72–77`). The prescribed takeover latch `$05` is exactly
`LORAM=1, HIRAM=0, CHAREN=1`, so the frozen `$0801–$CFFF` range remains fully usable and
BASIC ROM is banked out for CPU accesses. A VICE probe under the running `$05` mapping
writes and reads back `$A000`, confirming RAM. No takeover-only reservation is
implemented; ordinary code, data, default entries, handler wrappers and SFA may use the
full range. `startupVisibilityFailure` remains the existing guard for the restore path
where the cooperative caller banking is restored.

**Rejected:** reserving `$A000–$BFFF` (would shrink the frozen budget for no hardware
reason); switching to `$34` (contradicts the prescribed latch and is not needed).

## AR-T9 — VICE harness shape

**Decision:** Reuse the existing sequential VICE 3.10 harness and autostart PRG loading.
Autostart uses BASIC only to load and `SYS` into `$080D`; after the takeover mapping
change the program runs raw. The observation sets execute checkpoints on the startup
entry, default raw entries, `main`, raw handler wrappers and startup restore, and reads
`$0000/$0001`, `$FFFA–$FFFF`, `$0314/$0318`, CIA/VIC registers and the caller return
address. Each of the four profiles runs in a separate process, sequentially.

**Rationale:** the existing harness already attests the exact executable, ROMs, monitor
socket, profile resources and caller-return pattern
(`test/m1/vice-runtime.ts`, `test/rd05/profiles-vice.spec.test.ts`). No second emulator or
loader is introduced.

**Rejected:** a custom raw-load tool or cartridge image. The frozen artifact contract is a
PRG with the shared BASIC stub; autostart exercises that actual artifact.

## AR-T10 — Evidence and physical boundary

**Decision:** Record profile, artifact hash, VICE identity/ROM hashes, selected resources,
initial/stop state, vector/mapping observations and normal return. Report
`VICE-verified / hardware-unverified`. Do not reopen `V4-HW-1`, `V4-HOST-1` or
`V4-ASSET-1`.

**Rationale:** no physical C64, drive or SID exists for this candidate; RD-10 owns those
boundaries (`docs/releases/v4-production-qualification.md`).

## Open follow-ups recorded by this plan

| ID | Description | Owner |
|---|---|---|
| `V4-TAKEOVER-F2` | Source-installed raw NMI (`setRawNMI`/`restoreRawNMI`) is deferred: the frozen text withholds the cooperative unbounded-NMI exception from takeover and supplies no finite external arrival bound. Startup's default NMI entry is qualified. Needs a governing NMI-boundary decision and a finite/reentrancy proof before the sink is exposed. | RD-05 future slice |
| `V4-TAKEOVER-F3` | Raw MMIO IRQ/NMI source enablement (direct `$D01A`, `$DC0E`, `$DD0E` writes) is an explicit unsafe hardware boundary the compiler cannot certify. Typed operations are checked; raw writes retain the existing opaque-boundary contract. | RD-05 future slice |
