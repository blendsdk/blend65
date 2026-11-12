# Requirements Delta — RD-05 Takeover Resident Profiles

> **Parent**: [RD-05 requirements](../../requirements/RD-05-c64-platform-profiles-and-game-workload-compiler-support.md)
> **Roadmap row**: `V4-TAKEOVER-1`
> **Updated**: 2026-11-12

This plan implements the takeover half of the already-approved RD-05 requirements. It
adds no new product concept and changes no frozen acceptance criterion. The cooperative
half is already qualified; this delta makes the same contract executable for the raw
ownership mode.

## Requirement mapping

| RD-05 requirement | Current state | Plan deliverable |
|---|---|---|
| R5.1 — exactly eight resident-PRG identities | Four cooperative IDs executable; four takeover IDs recognized but rejected with `E10279` | Add four closed takeover fact rows and executable selection; preserve manifest rejection of unknown/partial/mixed IDs |
| R5.2 — exact evidence facts | Cooperative rows carry video/SID/timing; takeover identity and ROM/ownership facts absent | Add ownership, port mapping, raw vector addresses, zero stack reserve and machine identity |
| R5.3 — compile-time-visible profile differences | `hasRawInterrupts=false`, `usesKernal=true` on every accepted profile | Flip both constants on takeover; add no runtime probe or dispatcher |
| R5.5 — takeover startup and return | Not implemented; cooperative constructor always emitted | Raw constructor: save state, install complete RAM vectors, single mapping change, run without KERNAL, restore and return |
| R5.7 — qualify every complete identity | Four cooperative profiles have fresh VICE cases | Four fresh takeover builds and sequential VICE observations |
| R5.9 — complete selected-profile memory map | Cooperative map only | Reserve raw vector bytes and default entries; keep the full frozen `$0801–$CFFF` range (`$05` exposes RAM at `$A000–$BFFF`) |
| R5.10 — scoped banking operations | Cooperative path only | Takeover startup/restore uses the same owned `$0000/$0001` mask and a single mapping transition; no general banking manager |
| R5.15 — every Specification 4 interrupt sink | KERNAL CINV/NMINV variants only | Add `c64_raw_irq`, `setRawIRQ` and `restoreRawIRQ`; the default raw NMI route is owned, but source `setRawNMI` is deferred under `V4-TAKEOVER-F2` because the frozen text withholds the unbounded-NMI exception |
| R5.16 — reversible installation | Cooperative LIFO stacks | Per-sink LIFO for raw vectors; raw NMI matching-low publication; raw writes invalidate provenance |
| R5.17 — close every interrupt route before emission | Cooperative route closure and NMI private-home proof | Apply the same consumed/generated-route proof to raw routes; raw NMI requires no private homes |
| AC-05 — takeover startup/return | Fails at selection | Four-profile source/output/runtime proof; torn-vector and unhandled-NMI negatives |
| AC-06 — eight profile smokes | Four cooperative smokes | Four takeover smokes join the matrix |
| AC-12/AC-13 — variant and reversible installation | Cooperative variants only | Raw variant wrappers and balanced raw install/restore cases |

## Explicit non-goals

- No cooperative CIA1 stock handback on a takeover return (AR-T7).
- No physical-hardware claim; the status remains `VICE-verified / hardware-unverified`.
- No C64U, native-host, CharPad or GoatTracker work.
- No `spec/` edit. The prescribed `$05` mapping exposes RAM at `$A000–$BFFF`; the full
  frozen `$0801–$CFFF` range stays available (AR-T8).
- No new game API, runtime, dispatcher, scheduler, manager, heap or optimizer change.

## Acceptance for this plan

1. `parseManifest` and `checkProject`/`buildProject` accept all eight resident PRG IDs and
   still reject unknown, partial and mixed IDs.
2. A takeover build's PRG begins with the frozen 12-byte BASIC stub; its startup entry is
   `$080D`; it writes complete `$FFFA–$FFFF` RAM vectors before the `$0001` mapping change
   to `$05`; it executes initializers then `main`; a normal return restores `$0000/$0001`,
   status, registers and stack and reaches the caller's `RTS`.
3. Raw sink ownership is compile-time LIFO; unbalanced, cross-sink, torn and unsafe
   configurations fail before ACME.
4. Each of the four takeover IDs builds a fresh PRG and runs only that PRG in VICE 3.10,
   sequentially, with the expected state/exit observation.
5. Evidence records the bounded status and the follow-up findings; the roadmap row moves
   to Done and the release statement gains the eight-profile matrix only after all
   verification passes.
