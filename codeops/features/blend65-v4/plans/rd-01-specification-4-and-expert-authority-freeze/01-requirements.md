# Requirements: Specification 4.0 and Expert Authority Freeze

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**:
> [RD-01](../../requirements/RD-01-specification-4-and-expert-authority-freeze.md) — the OWNING
> requirements document

## Scope of This Plan (Delta View)

### In This Plan

- RD-01 R1.1–R1.4: verify inputs, create the single Spec 4 tree, publish its inventory, and freeze
  its identity.
- RD-01 R1.5–R1.14: reconcile the approved language semantics without implementing the compiler.
- RD-01 R1.15–R1.20: establish honest C64-only target authority, Guard results, and diagnostics.
- RD-01 R1.21–R1.25: qualify and atomically activate expert `2.0.0`, then freeze both authorities.
- RD-01 R1.26–R1.27: provide concise navigation and modern/game examples inside the owning clauses.

### Deferred / Out of This Plan

- Every compiler, package, CLI, LSP, editor, assembler, packager, and runtime change belongs to
  RD-02 or later.
- ACME, VICE, readiness, emulator, game-corpus, feasibility, and repository compiler suites do not
  validate this documentation-and-skill-only RD.
- C64U, X16, Atari 800XL, and Atari 7800 remain future constraints, not normative targets.

## Plan-Local Decisions

| Decision | Chosen | AR Ref |
|---|---|---|
| Scope and context boundary | Plan and later execute RD-01 only | AR-P1 |
| Phase structure | Eight bounded phases | AR-P2 |
| Test/evidence method | Existing Markdown qualification plus direct checks | AR-P3 |
| Verification boundary | Documentation, authority, and skill checks only | AR-P4 |
| Content identity | Normalized manifest-selected SHA-256 | AR-P5 |
| Durable artifact owners | Inventory, existing feature index, and one RD closeout | AR-P6 |

## Plan-Local Acceptance Criteria

1. [ ] Every execution task changes no more than three files, except explicit deletion/set-equality
   tasks whose complete path set is listed.
2. [ ] Shared grammar, diagnostics, and Guard files have section-level ownership and are verified
   after each phase that touches them.
3. [ ] Specification tests are authored and observed RED before each phase's candidate content.
4. [ ] No compiler or emulator command appears in the RD-01 verification log.
5. [ ] The last phase cannot activate expert `2.0.0` without the user approval required by R1.24.
