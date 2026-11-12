# Closeout — RD-05 Takeover Resident Profiles

> **Status**: Done — 30/30 tasks after the local checkpoint and review fix cycle
> **Updated**: 2026-11-12
> **Plan**: [99-execution-plan.md](99-execution-plan.md)
> **Owner**: `V4-TAKEOVER-1`

## Delivered boundary

The four `c64-{pal|ntsc}-prg-takeover-{6581|8580}` identities are executable. They share
the frozen `$0801` BASIC stub and `$080D` entry, save the caller and compiler-owned machine
state, install complete default raw IRQ/NMI vectors in underlying RAM, perform the single
`$05` mapping change under owned mask `$07`, select VIC bank zero through `$DD02`, and run
initializers then `main` without a KERNAL call path. A normal return restores `$DD02`,
borrowed BASIC zero-page bytes, `$0001`, `$0000`, status, registers and stack pointer and
executes `RTS` to BASIC.

The raw IRQ source sink is `c64.system.setRawIRQ`/`restoreRawIRQ`. A handler must consume
or fully disable every enabled CIA1 source on every path; installation captures both
predecessor bytes and writes both new vector bytes inside the IRQ-masked transaction.
Balanced LIFO restores write the exact predecessor back. Source-installed raw NMI remains
deferred under `V4-TAKEOVER-F2`; the compiler-owned default NMI entry is installed,
placed at low `$47`, and uses `BIT $DD0D` so it consumes inherited CIA2 pending state
without changing A.

The full frozen `$0801–$CFFF` range remains available. The prescribed `$05` mapping
exposes RAM at `$A000–$BFFF`; a VICE read/write probe under the running mapping confirmed
it. Direct source writes to the compiler-owned processor port, VIC-bank and hardware-vector
bytes are rejected with `E10278` rather than silently invalidating the ownership proof.

## Runtime matrix

Fresh runtime-fixture artifacts, one process per identity, sequential VICE 3.10 `x64sc`
with the pinned 901227-03/BASIC/chargen ROM hashes:

| Profile | PRG SHA-256 | Observation | Status |
|---|---|---|---|
| `c64-pal-prg-takeover-6581` | `70cb56efc9e424086d241f4a85b805c9f93af155727dae27e0f74d4959a539ed` | 6569 / 6581 / rev 3; vectors, `$05`, default IRQ+NMI, return | `VICE-verified / hardware-unverified` |
| `c64-pal-prg-takeover-8580` | `a6e10a359a45c07905bbb2783c5a71d84a85cecc242f1998d9f2e8bc465d2982` | 6569 / 8580 / rev 3; vectors, `$05`, default IRQ+NMI, return | `VICE-verified / hardware-unverified` |
| `c64-ntsc-prg-takeover-6581` | `1ddb14d8d0b336bee15eb9d2601ab35e44960d28b26a0719be38f983aa6133c9` | 6567 / 6581 / rev 3; vectors, `$05`, default IRQ+NMI, return | `VICE-verified / hardware-unverified` |
| `c64-ntsc-prg-takeover-8580` | `4e554f61405114f10f80db866758e7a6f04dbc3b1e3dc0442c823703ba894743` | 6567 / 8580 / rev 3; vectors, `$05`, default IRQ+NMI, return | `VICE-verified / hardware-unverified` |

Each case observes the startup entry, `$0000/$0001/$DD02`, `$FFFA–$FFFF` before and after
the mapping change, the default IRQ entry from stock CIA1 Timer A, the default NMI entry
from a monitor-injected CIA2 Timer A NMI, `main`, the restore block and the caller return.
The NMI case confirms A is unchanged across the default handler. The separate raw IRQ case
observes the installed `$FFFE/$FFFF` handler, its entry, the CIA1 acknowledgement, the
restored default predecessor and the caller return.

## Costs

| Item | Emitted cost |
|---|---:|
| Empty takeover PRG | 332 bytes (program 330, resident 338) |
| Startup entry / restore | 77 bytes / 107 cycles; 36 bytes / 59 cycles |
| Default raw IRQ entry | 12 bytes / 25 nominal cycles |
| Default raw NMI entry | 4 bytes / 10 nominal cycles (`BIT $DD0D; RTI`) |
| Raw IRQ wrapper | 12 bytes / 37 cycles plus body; 6 stack bytes |
| Raw IRQ install / restore | 27 bytes / 44 cycles; 17 bytes / 32 cycles |
| Always-installed default frames | 4-byte default IRQ + 3-byte default NMI = 7 when no source IRQ route replaces the default; a source raw-IRQ route adds the default NMI 3 bytes to the selected route peak |

Hardware acceptance adds seven cycles and three stack bytes to each raw entry. These are
instruction-derived local costs, not whole-program timing proof.

## Negative admission

| Case | Result |
|---|---|
| Raw IRQ handler with no CIA1 consume | `E10278` |
| Raw IRQ handler with a conditional consume that can return without acknowledging | `E10278` |
| Raw IRQ install/restore mismatch or raw write after install | `E10278` |
| Source write to `$0000/$0001/$DD00/$DD02/$FFFA–$FFFF` | `E10278` |
| `setRawNMI`/`restoreRawNMI` source use | `E10012` (deferred capability) |
| Cooperative KERNAL sink under takeover | frontend unknown-name diagnostic |
| Returning takeover path with a typed CIA1 change | `E10278` |

## Review disposition

Independent SFA/ABI, target-platform, machine-code and semantics reviews were run against
the takeover diff. Material findings fixed:

- optimized/size/speed modes keep both compiler-owned default entries;
- default NMI preserves A with `BIT $DD0D`;
- the finite stack proof includes the always-reachable default IRQ/NMI and source wrapper
  frames;
- `restoreRawIRQ` closes the IRQ link/handler lifetime;
- takeover-owned port/vector/bank writes are rejected by the ownership proof;
- CIA1 consumption is proved on every handler path (must-consume, not may-consume);
- the startup entry holds the port bytes in X/Y, saving 4 bytes and 4 cycles;
- default NMI vectors target the function entry label so a low-`$47` adapter remains valid;
- the `$A000–$BFFF` reservation was removed after confirming the `$05` RAM view;
- release/README/plan wording no longer claims a nonexistent map discrepancy or
  source-installed raw NMI.

Residual findings are `V4-TAKEOVER-F2` (source raw NMI authority/finite-bound decision) and
`V4-TAKEOVER-F3` (raw-MMIO interrupt source boundary). Physical timing, analogue SID,
real-drive and board/chip revision rows remain `Unknown` under `V4-HW-1`.

## Deferral-expiry check

This slice does not expire a prior deferral. The takeover plan's own raw-NMI item remains
owned by `V4-TAKEOVER-F2`, and raw-MMIO containment by `V4-TAKEOVER-F3`. Physical,
native-host and producer/adapter deferrals keep their existing owners. No oracle, limit or
behavior assertion was waived.

## Verification

| Check | Result |
|---|---|
| `yarn build` | 4/4 Turbo tasks pass |
| `yarn typecheck` | 7/7 Turbo tasks pass |
| Affected compiler cluster | 17 files / 287 tests pass, including startup, closure, ownership, interrupt domains, target composition, size observers/selection and profile constants |
| Takeover public smoke | 44/44 pass: four profiles, all four optimization modes, raw IRQ install/restore, nested LIFO, owned-byte and CIA1 negatives, high fixed object/function |
| Takeover VICE matrix | 5/5 pass: four raw profiles plus the source raw IRQ case, sequential |
| Cooperative VICE regression | 4/4 pass |
| Profile pipeline regression | 10/10 pass |
| `spec/` | Clean; no file changed |

A complete compiler-suite run was attempted after the main changes: 218/219 files and
3,700/3,703 tests passed with two skips; the only failure was the intermediate
`compact-stored` startup regression, fixed and re-run at 9/9. Later changes are
takeover-only or optional profile fields, and the affected 287-test cluster above passes.
A final full-suite rerun was stopped in this environment after the pre-existing slow
size-observer files exceeded the bounded session; no failure appeared before the stop.
The previous production-boundary full suite remains the last completed whole-tree run.

Local implementation commit `d73e002c`; no push.
