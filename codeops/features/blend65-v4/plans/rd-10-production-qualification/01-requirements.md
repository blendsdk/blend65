# Requirements: RD-10 Production Qualification and C64U Handoff

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-10](../../requirements/RD-10-production-qualification-and-c64u-handoff.md) — the OWNING requirements doc

## Scope of this plan (delta view)

### In this plan

- R10.1–R10.10 — candidate identity, prerequisite closure, shipped public path, atomic failure,
  bounded support statement, one release record, exact-identity evidence reuse, visible skips,
  independent oracles, and one complete release boundary.
- R10.11–R10.14 — native host qualification where hardware exists, cross-host output identity,
  deterministic tool discovery, and honest best-effort host boundaries.
- R10.15–R10.20 — eight resident profiles, one D64 profile, complete language, native assets,
  four optimizer modes, and the compiler-not-engine boundary.
- R10.21–R10.25 — physical qualification rows, recorded as `Unknown` for this candidate with the
  `V4-HW-1` post-release owner; no physical claim is made.
- R10.26–R10.28 — production documentation, user-facing restrictions, and local package/VSIX
  artifacts without external publication.
- R10.29–R10.33 — C64U architecture readiness, C64 preservation, handoff packet, activation gates,
  and ownership transfer without C64U implementation.
- R10.34–R10.39 — deferral-expiry scan, no orphaned landing place, explicit production approval,
  concise reproduction, responsiveness trends, and optional best-effort host observations.

### Deferred / out of this plan

- Physical C64, 1541-compatible drive, SID, serial, and analogue qualification. No unit is
  available. It is recorded `Unknown`, not performed, and assigned to `V4-HW-1`.
- Native Windows and macOS qualification when no native host is available. The plan records
  `Unknown` for that host and omits it from the support statement.
- NPM publication, Marketplace publication, release tags, signing, notarization, and announcements.
  These remain user-owned outward actions.

## Plan-local decisions

| Decision | Chosen | AR Ref |
| -------- | ------ | ------ |
| Physical evidence | `Unknown` + `V4-HW-1`; no physical claim | AR-1, AR-9 |
| Runtime oracle | VICE 3.10 `x64sc`, sequential only | AR-2 |
| Host claims | Native evidence only; otherwise `Unknown` | AR-3 |
| Release record | `docs/releases/v4-production-qualification.md` | AR-4 |
| Candidate freeze | One clean commit after blocking fixes | AR-5 |
| Local packaging | `npm pack` + local VSIX; no publish | AR-6 |
| Runtime suite order | Existing suites in one documented sequence | AR-7 |
| Evidence reuse | Exact identity; smallest intersecting rerun | AR-8 |
| Physical backlog owner | `V4-HW-1` feature-roadmap row | AR-9 |
| Production transition | Explicit user approval of the support statement | AR-10 |
| C64U handoff | Discovery seed under the existing feature | AR-11 |
| Hardware disagreement | Record untested; VICE-only observation | AR-12 |
| Responsiveness | Trends only; no pass/fail threshold | AR-13 |
| Missing VICE | `Unknown`; blocks only the dependent claim | AR-14 |

## Acceptance Criteria

The RD owns AC-01 through AC-34. This plan adds no acceptance criterion and narrows none. Physical
criteria AC-20–AC-24 are satisfied by the recorded `Unknown` path and the restricted support
statement defined by the owning RD. The execution plan traces every phase to its governing RD
requirements and to the ST cases in [07-testing-strategy.md](07-testing-strategy.md).
