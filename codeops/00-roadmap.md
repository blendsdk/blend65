# Portfolio Roadmap: blend65.ri

> **Status**: Active
> **Last Updated**: 2026-07-17
> **Features**: 0 / 1 done
> **CodeOps Skills Version**: 3.0.0
>
> Per-feature detail — including the full per-slice/per-phase history — lives in each
> feature's own roadmap (linked below) and in the plan directories under
> `codeops/features/<feature>/plans/` and `codeops/_archive/`. This portfolio file keeps
> only the current stage summary and recent milestones.

## Legend

⬜ Backlog · 🔄 In progress · ✅ Done · ⛔ Blocked · ⏸️ Deferred · 📦 Archived

## Features

| Feature | Roadmap | Stage Summary | Progress | Status | Last Updated |
|---------|---------|---------------|----------|--------|--------------|
| blend65-ri | [→](features/blend65-ri/00-roadmap.md) | **RD-18 Slice 7b ✅ COMPLETE (2026-07-12, exec_plan 58/58) — SLICE 7 CLOSED, RD-18 acceptance item 6 ticked.** The pointer surface ships end-to-end (by-ref/const struct/array params + FN-3 frame home + chain-max-colored `__zp_ptr_*` pairs; unsized params + element-list inference; tier-2 `(zp),Y` with runtime formation through the conditional scratch pair; the IL `addr` operand; translate `(zp),Y` framings + regY mirror), GREEN on real VICE 3.10 first run (`examples/slice7b/` → `$C000..$C006 = 00 2A 0F 1D 11 0B 16`; 212-line golden; nine prior goldens byte-exact). RD-01..RD-17 are all complete; RD-18 is the active language-completion rollout. **Next: Slice 8 split 8a/8b at its gate — the 8a hardware plan (`&`, interrupts, `zeropage`, non-terminating `main`, T1) was created 2026-07-17: preflight → exec_plan; 8b (strings/encoding, `embed()`, RD-18 closure) needs `make_plan` after; RD-13 (non-functional sweep) and RD-14 (VS Code/LSP) queued.** Recent: Slice 7a ✅ (64/64) aggregates · Slice 6 ✅ (52/52) expressions · Slice 5b ✅ (42/42) modules · Slice 5a ✅ (46/46) functions · Slice 4b ✅ (26/26) switch · Slice 4a ✅ (35/35) control-flow + CFG · Slice 3b ✅ (45/45) scalar types · Slice 3a ✅ (21/21) model seam. Full history in `features/blend65-ri/00-roadmap.md`. | 18/20 | 🔄 | 2026-07-17 |

## Archived

| Feature | Roadmap | Completed | Last Updated |
|---------|---------|-----------|--------------|
| — | — | — | — |

## Notes

> Recent milestones only. Full per-slice/per-phase history lives in
> `features/blend65-ri/00-roadmap.md`, the plan directories, the completed-plan archive
> `codeops/_archive/`, and git history.

- 2026-07-17: **RD-18 Slice 8 gate** — split 8a/8b; the 8a hardware plan created via `make_plan`
  (`features/blend65-ri/plans/rd-18-slice-8-hardware/`).
- 2026-07-12: **RD-18 Slice 7b ✅ COMPLETE** (exec_plan 58/58) — pointer surface end-to-end;
  SLICE 7 CLOSED, RD-18 acceptance item 6 ticked. GREEN on real VICE 3.10.
- 2026-07-12: **RD-18 Slice 7a ✅ COMPLETE** (exec_plan 64/64) — aggregates (arrays/structs/enums)
  through the direct-addressing surface.
- 2026-07-11: **RD-18 Slice 6 ✅ COMPLETE** (52/52) — full expression system + mixed-width
  promotion; closes RD-18 AC-5.
- 2026-07-11: **RD-18 Slice 5b ✅ COMPLETE** (42/42) — module system (merging, qualified access,
  init order, consts); closes RD-18 AC-4.
- 2026-07-10: **RD-18 Slice 5a ✅ COMPLETE** (46/46) — user functions/params/calls/recursion/
  imports; Phase 0 moved the data base `$0800`→`$2000`.
- 2026-07-07: **RD-18 Slice 4b ✅ COMPLETE** (26/26) — `switch`/`case`/`fallthrough`; closes AC-3.
- 2026-07-07: **RD-18 Slice 4a ✅ COMPLETE** (35/35) — conditionals + loops + the first
  multi-block CFG codegen keystone.
- 2026-07-06: **RD-18 Slice 3b ✅ COMPLETE** (45/45) — scalar type/scope engine end-to-end.
- 2026-07-05: **RD-18 Slice 3a ✅ COMPLETE** (21/21) — the `modelToFunctionInfo` model seam.
- 2026-07-04: **RD-18 🔎 RD-Preflighted** — thin reference-only rollout over RD-04/06/07 + `spec/`;
  supersedes the phantom RD-04b.
- 2026-07-03: **RD-12 ✅ COMPLETE** (44/44) — `@blend65/test-harness` emulator-verification
  framework; all 16 ACs ticked + RD-17 AC-14 discharged on real VICE; DEF-2 fixed.
- 2026-07-03: **RD-15 ✅ COMPLETE** (50/50) — `compile`/`emitIl`/`emitAsm`/`build` facade +
  the full `blendc` CLI; latent RD-09 DEF-1 (headerless PRG) fixed.
- 2026-07-03: **RD-11b ✅ COMPLETE** (39/39) — diagnostics remainder (`SourceMap`, severity
  policy, terminal/JSON renderers, `ResourceReport`).
- 2026-07-02: **RD-16 ✅ COMPLETE** (36/36) — compiler configuration (`blend65.json` loader).
- 2026-07-02: **RD-17 ✅ COMPLETE** (47/47) — intrinsics & runtime ABI (all four tiers).
- 2026-07-02: migrated from the flat layout to the nested CodeOps layout via `setup_codeops`;
  codegen was complete through RD-09 at that point (13/20 items done).
