# Physical Status and Release Record: RD-10

> **Document**: 03-05-physical-and-release-record.md
> **Parent**: [Index](00-index.md)

## Overview

No physical C64 is available. This document defines the truthful physical record, the bounded
support statement, the release documentation, and the approval boundary. It never converts an
unavailable physical endpoint into a pass.

## Physical status

| Row | Required future evidence | Current status | Owner |
| --- | ------------------------ | -------------- | ----- |
| PAL timing and machine state | Named base-C64 PAL unit, representative KERNAL/takeover artifacts | `Unknown` | `V4-HW-1` |
| Later NTSC timing and machine state | Named later-NTSC unit | `Unknown` | `V4-HW-1` |
| 6581 analogue SID | Named 6581 unit, music/SFX/cue fixtures | `Unknown` | `V4-HW-1` |
| 8580 analogue SID | Named 8580 unit, music/SFX/cue fixtures | `Unknown` | `V4-HW-1` |
| Real D64 drive path | Stock PAL C64, pinned KERNAL, named 1541-compatible drive | `Unknown` | `V4-HW-1` |
| Emulator/hardware disagreement | Both raw observations when hardware exists | Untested; VICE observation only | `V4-HW-1` |

Add one feature-roadmap row:

```text
| ↳ V4-HW-1 | Physical C64 release qualification | RD-10 requirements | — | Post-release hardware backlog | ⏸️ | 2026-11-11 | Owns the exact targeted physical matrix: PAL, later NTSC, 6581, 8580, real-drive D64, and VICE/hardware reconciliation. No unit is available now; no physical claim is made by RD-10. |
```

`V4-HW-1` is a backlog owner, not an RD and not a passing endpoint. RD-10 may close without it only
because the support statement is explicitly narrowed to VICE-verified evidence.

## Bounded support statement

The release record contains one statement with this shape:

```text
Qualified: <language identity>, <compiler candidate>, <profiles>, <modes>, <qualified hosts>,
ACME 0.97, VICE 3.10 x64sc.
Runtime status: VICE-verified / hardware-unverified.
Not claimed: physical PAL/NTSC timing, analogue SID behavior, serial/real-drive behavior,
silicon-sensitive behavior, any unqualified host, C64U, or any game engine/runtime.
```

The statement names only evidence that exists. A missing host, profile, asset producer, or physical
row is `Unknown` and does not appear as qualified.

## Documentation reconciliation

- `docs/tooling.md`: editor, CLI, evidence, and debug boundaries.
- `docs/platform-libraries.md`: profile APIs and target restrictions.
- `docs/loadable-assets.md`: D64, trusted media, `HLE-010`, and load behavior.
- `docs/c64-cia2.md`: interrupt/device claims.
- `README`/installation guidance: qualified hosts, ACME/VICE discovery, and unsupported targets.

Every command and path example must be exercised on its claimed host. Do not document
compiler-convenience restrictions as hardware facts.

## Deferrals and limitations

The closeout scans every ambiguity, Won't Have, future consideration, expert deferral/erratum,
hardware limitation, expressiveness entry, parity issue, and C64U unknown. Each item is recorded as
still valid with reason, due with owner, satisfied, or superseded. No item names RD-10, a completed
RD, an absent feature, or unspecified later work.

## Approval

Present the exact support statement, release record, limitations/debt, physical `Unknown` rows, C64U
readiness/handoff, and local package result to the user. Do not mark v4 production-complete until the
user explicitly approves that candidate and claim. Approval authorizes only the internal lifecycle
transition; it does not authorize push, publication, tag, signing, notarization, or announcement.

## Error handling

| Case | Handling |
| ---- | -------- |
| Physical row treated as pass | Reject the record |
| Support statement names an unqualified host | Reject and correct |
| Documentation claims physical proof | Correct to `VICE-verified / hardware-unverified` |
| Deferral points to RD-10 | Reassign to `V4-HW-1`, an RD, or an authorized issue |
| User does not approve | Keep RD-10 in review; do not change the production lifecycle |
