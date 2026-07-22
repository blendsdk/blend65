# Requirements: RD-01 Silent miscompiles

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-01](../../requirements/RD-01-silent-miscompiles.md) — the OWNING requirements doc

This is a **delta view**. RD-01 owns every requirement (R1…R9), design resolution (AR-1…AR-10),
and acceptance criterion (AC-1…AC-16). Nothing there is restated here — this document records only
what this plan carries versus defers, and the plan-local decisions the RD did not make.

## Scope of this plan (delta view)

### In this plan (all of RD-01's Must-Have set)

- **R1, R2, R3** — loop termination across the five-axis wrap class, all four bound spellings, no
  ICE on full range → Phase 1 (§03-01).
- **R4** — `poke`/`pokew` wide-value diagnostic, every spelling → Phase 2 (§03-02).
- **R5** — VAR-7/VAR-8/E10062 diagnostics (nested reuse, shadowing) → Phase 3 (§03-03).
- **R6** — spec-legal sibling reuse compiles, shared slot sized to the widest, each use lowered at
  its own width → Phase 3 (§03-03).
- **R7** — IRQ/mainline shared-frame warning with false-positive filter → Phase 4 (§03-04).
- **R8** — no example source edits; committed fixtures audited → Phases 2–4 (audit) + Phase 5.
- **R9** — X-07/X-08 retired in the fixing change → Phase 1 (co-located with the M-01 fix per AR-P8).

### Deferred / out of this plan

Per RD-01 "Won't have" — block-scoped allocation, register-resident counters, `until` / signed
`/` `%` / `arr[i] += 1` / `hi()`-of-computed-word / non-literal `step` folding / handler∩handler
hazard (all RD-04), and any `spec/` edit (D3). The fused increment-and-branch terminator that
would recover M-01's +1-cycle cost is RD-filed to the asm-parity lane. This plan adds no further
deferrals.

## Plan-local decisions

Only decisions **not** already in the RD. Full context in the register.

| Decision | Chosen | AR Ref |
| -------- | ------ | ------ |
| Phase decomposition | 5 phases, M-01 first, dedicated closeout | AR-P1 |
| Verify cadence | targeted during tasks; full root verify at phase close | AR-P2 |
| Wrap-check form (⚠ reopened at preflight it.1) | reconstruction-immediate `brcmp next` vs type/step immediate — translatable today | AR-P3 |
| M-03 pop-3 per-declaration-type mechanism | per-use type resolution; allocation stays positional; sizing at the retention seam | AR-P4 |
| Emission-gating predicate location/shape | frontend-stamped wrap-safe bit (resolver-backed eval); guard only when absent | AR-P5 |
| Diagnostic message text | drafted in the 03 docs following registry phrasing | AR-P6 |
| Component-doc / spec-test file layout | one 03-doc per surface | AR-P7 |
| Mechanical re-golden placement | forcing phase (P1), not P5 | AR-P8 |
| M-04 spill-state proxy (added at preflight it.1) | no params/locals AND a syntactically spill-free body | AR-P9 |
| Step range-check narrowing (added at preflight it.2) | extend `E10061` for `step > typeMax`; record in errata | AR-P10 |

## Acceptance Criteria

RD-01 AC-1…AC-16 are the acceptance oracle and are **not** restated here. This plan adds no
plan-local acceptance criteria; §07 maps each RD criterion to concrete ST-cases and each ST-case
back to its AC.

**Delta note on AC-4 (PF-043).** AC-4's parenthetical names the wrap check as a `brcmp` of the
post-step counter "against the pre-step counter". AR-1 explicitly sanctions the reconstruction
family ("a compare reconstructed from `next ∓ step`"), and AR-P3 chose the immediate form of it, so
the comparand differs from AC-4's literal text while the criterion's substance — a value-level wrap
check *supplementing* the bound compare — is unchanged. AC-4 is discharged in that sanctioned form;
recorded here so the closeout does not read as a divergence.
