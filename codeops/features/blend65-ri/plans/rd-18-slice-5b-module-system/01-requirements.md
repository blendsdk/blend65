# Requirements: RD-18 Slice 5b — Module System Completion

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-18](../../requirements/RD-18-codegen-language-completion.md) — the OWNING requirements doc (Slice 5 row, AC-4); RD-04 rules R17/R20–R23 via the deferred-semantics ledger

## Scope of this plan (delta view)

### In this plan

- **RD-18 AC-4 (closing half)** — module init order deterministic (topological,
  E10194 on cycle); multi-module program VICE-verifies. 5a shipped the
  calls/params/recursion/golden half; 5b ships merging + qualified access + init
  order and **closes AC-4**.
- **RD-04 R20** — module merging; cross-file duplicates → E10003 (AR-9).
- **RD-04 R21** — circular imports allowed (falls out: merging + Pass-1-before-Pass-3;
  witnessed by an impl test).
- **RD-04 R17** — qualified access `Module.name`, full value surface (AR-1/2/3).
- **RD-04 R23 (spec-corrected)** — per-variable init order per frozen Ch 10 §5.4
  (NOT R23's import-graph granularity; adjudicated at 5a AR-15, re-confirmed AR-5),
  E10194 per AR-6. Populates `SemanticModel.initOrder`.
- **RD-04 AC-16** — init cycle → E10194.
- **RD-04 AC-09 (scalar half)** — E10193 non-const const-initializer wired; E10192
  recorded parser-owned (AR-7).
- **Spec Ch 10 §5.3/§5.4 (runtime half)** — initializers run during startup before
  `main` via `__init` (AR-8); §5.4 const row (compile-time, never runtime-ordered)
  via const completion (AR-7).

### Deferred / out of this plan

- Call-bearing initializers → loud ICE (I-1, AR-4).
- Import aliasing `as` (I-2).
- Qualified function references (`Math.fn` as value / assignment target) → ICE until
  Slice 8 `&fn` (AR-13).
- Type-position qualified access `Math.SomeType` → Slice 7 (AR-1).
- W10190 use-before-init (RD-04 R111) → deferred (AR-5 note).
- Bare-startup `__init` invocation → user-owned, documented (AR-12).
- Promotion in initializers (Slice 6, I-3); zeropage initializers (Slice 8).

## Plan-local decisions

All decisions live in the register — see the Key Decisions table in
[00-index.md](00-index.md) and `00-ambiguity-register.md` AR-1…AR-13, I-1…I-3.
No decision in this plan lacks an AR back-reference.

## Acceptance Criteria (plan-local)

1. [ ] The 3-part bar on the slice5b fixture (AR-10): CI assemble-clean (real ACME →
       loadable PRG), CI byte-exact golden, local real-VICE memory asserts
       (07-testing-strategy ST-24…ST-26).
2. [ ] All six existing goldens (gate + the five prior slice goldens) remain
       byte-exact (AR-8 conditional emission).
3. [ ] Negatives reject via `compile()` with the exact codes: E10194 (cycle), E10012
       (qualified non-exported), E10100 (unknown head), ICE (call in initializer),
       E10003 (cross-file duplicate), E10193 (non-const const-init).
4. [ ] RD-18 AC-4 ticked; RD-04 ledger rows R17/R20/R21/R23 + AC-16 + AC-09(scalar)
       advanced; roadmaps cascaded.
5. [ ] `git status --porcelain spec/` empty throughout (D3).
