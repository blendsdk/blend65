# Rollout Closure: RD-18 Slice 8b

> **Document**: 03-05-closure.md
> **Parent**: [Index](00-index.md)
> **Governs**: AR-15 (RD-18 acceptance items 8–9); runs LAST, after the acceptance bar is green.

## Overview

The closure phase formally ends the RD-18 rollout: every parent-RD acceptance criterion RD-18
promised to drive is audited against shipped evidence and ticked, the RD-04b phantom is retired,
and the security item is verified. Doc-only phase — no compiler code changes.

## Audit protocol (tick-with-annotation, AR-15)

For each AC below: locate the shipped evidence (test file / slice plan / golden), tick the
checkbox (or annotate the table row) in the OWNING requirements doc, and where behavior is
covered by a **documented deferral**, tick with a one-line annotation naming it (precedent:
RD-06 AC-02's 7a annotation). If evidence is missing and no deferral covers it → STOP, runtime
ambiguity per the register protocol.

| Target | Items | Known annotation cases |
|--------|-------|------------------------|
| `requirements/RD-04-semantic-analysis.md` | AC-02..AC-20 (table rows :830-848) | AC-18 diagnostic golden-snapshots — evidence is the slice negative suites; annotate |
| `requirements/RD-06-il-optimizer.md` | AC-02 (:582) | six 8a-deferred loud ICEs + format-aware embed = documented boundaries; extend the existing 7a annotation |
| `requirements/RD-07-codegen-instr.md` | AC-07..AC-09 (:460-462) | AC-07/AC-08 shipped (5a / 8a); AC-09 Pattern-A shipped, Pattern-B full-range = 8a-deferred ICE — tick with annotation |
| `requirements/RD-18-codegen-language-completion.md` | items 7, 8, 9 (:412-419) | item 7's `pokew($0314,…)` sketch — annotate with the 8a AR-16 raw-vector supersession |

## RD-04b phantom retirement

Annotate the three references with the AR-114 supersession (RD-18 superseded the phantom
`RD-04b-semantic-checker`; the ledger was consumed slice-by-slice):

- `requirements/RD-04-semantic-analysis.md:21`
- `requirements/RD-06-il-optimizer.md:23`
- `requirements/RD-07-codegen-instr.md:5` (mentions the naming pattern only — verify context,
  annotate only if it implies a live RD-04b)

## Security verification (item 9)

One recorded checklist in the RD (tick item 9) citing: diagnostic-not-crash negative suites per
slice; bounded const-eval/recursion (E10174, depth/step bounds); the 8b embed traversal
rejection (E10205 ST rows) + stat-before-read cap. Evidence = existing green tests; no new code.

## Bookkeeping

- Roadmaps: RD-18 row → ✅ Done (feature roadmap headline/milestones/Current Position; portfolio
  cascade per the roadmap skill). RD-13/RD-14 become the queue head.
- `08-resource-report.md` minted for this plan (fixture ZP/RAM/data/golden-size deltas, 8a
  precedent).
- `git status --porcelain spec/` empty — verified in the same closing task.
