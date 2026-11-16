# Boing-ball equal-contract parity — execution plan

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Owner**: issue [#168](https://github.com/blendsdk/blend65/issues/168).
> **Progress**: 8/8 tasks (100%)
> **Status**: Complete — first bounded unit; #168 remains open
> **Reasoning**: high — volatile reads, machine startup and independently qualified assembly costs
> **Baseline**: clean local `c0201e86`; no push.

## Objective

Deliver the issue's preserved boing-ball behavior, decreasing compiler costs and a raster poll no
larger than seven bytes / nine nominal taken-loop cycles. Whole-program parity must compare the
same startup, source-order hardware effects, state, storage and timing obligations. The original
402-byte twin is not an equivalent-contract total and must not be used to claim a parity win.

**Planning target:** #168's first bounded unit: qualify the benchmark and remove the adjacent
volatile-byte comparison's private capture/reload. Later allocation or control-flow changes need
their own grounded unit before implementation; this unit alone does not close whole-program debt.

**Context:** the existing boing-ball example, twin and tests; the issue-wave delivery plan;
machine register forwarding, capture observers, comparison and retention; selected C64 profile.

**Modification set:** this task's artifacts and derived roadmap summaries; new specification and
implementation tests; the existing forwarding/retention seam; the exact user-approved twin repair
and twin-cost-pin correction below. No existing behavior assertion, `spec/`, frozen expert skill,
expressiveness ledger, source program behavior, or optimization-mode contract may change.

## Smallest viable design

1. Repair the expert twin against the frozen selected-profile and source contract, not against
   current compiler inefficiencies. Preserve source-order writes, initialize all sprite pointers
   before enable, and remove the nonreturning `JSR pointers` path. Account for startup, borrowed
   zero page, stack and asset/padding costs separately.
2. Add source-derived motion/state and startup/write-order expectations using the existing
   ACME/VICE fixtures. Keep the old sampled-state comparison unchanged.
3. Extend existing adjacent A forwarding only for a fixed-address, unsigned byte read whose
   sole use is an adjacent byte-constant equality/inequality consumed by the terminal branch.
   Domain and storage-closure protections exist, but the existing named-capture observer predicate
   does not admit this anonymous sample in a sprite-publishing program. The approved standalone
   publication proof now supplies the narrow handoff; independent review and the actual complete
   checkpoint pass, closing PF-001 within that bounded class. Keep EOR: it meets the poll
   byte/cycle floor without introducing CMP's different A/N/C contract. Zero-flag reuse stays
   separately proved. Wider, signed, dynamic, materialized, multi-use and effect-barrier cases
   retain the general lowering.
4. Retain manifest `optimization: "none"` in every canonical measurement. Optional mode probes
   must be separately labelled and never replace it. No new pass, framework, dependency, runtime,
   blanket private-memory observer waiver or game-specific source rewrite.

## Decisions and findings

| ID     | Finding / decision                                                                                                                                     | Authority and disposition                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MC-001 | Twin omits selected-profile startup, including binary arithmetic and cooperative mapping.                                                              | Independent machine-code audit. Correct under Appendix A §5.1; do not charge unreachable restoration automatically.                                                                                                                                                                                                                                                                                                                                                                                     |
| MC-002 | Twin enables before pointer initialization, duplicates initial positions, changes X-coordinate write order, and leaves a two-byte return address live. | Independent machine-code audit plus independent design challenge; source `main.blend:78–102,161–164`, twin `68–73,195–214,238–243`. Preserve source order; no semantic relaxation.                                                                                                                                                                                                                                                                                                                      |
| MC-003 | Endpoint comparison alone is not independent behavior/trace or complete cost proof.                                                                    | Add independent expectations; preserve all existing assertions.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| AR-P1  | Exact benchmark-oracle repair.                                                                                                                         | User selected **Approve correction (Recommended)** on 2026-11-16: correct `examples/boing-ball/twin.asm` for source hardware-write order, selected-profile startup and the nonreturning JSR defect; update **only twin cost pins** in `test/rd05/boing-ball-parity-cost.impl.test.ts` to freshly verified values; add independent behavior/startup/trace tests; keep existing behavior assertions and `none` mode unchanged. Original 402 is recorded as non-equivalent, not a relaxed compiler target. |
| AR-P2  | First compiler unit keeps EOR and forwards only A.                                                                                                     | Independent challenge recommends this existing-seam correction: six bytes / eight nominal cycles saved at the poll; no user-owned semantic choice. Compiler output pins may decrease only after measured implementation evidence; AR-P1 alone authorizes no compiler-pin change.                                                                                                                                                                                                                        |
| PF-001 | Existing observer proof rejects boing-ball's sprite publications and its adapter requires a source-backed store.                                       | Resolved, not waived: the specifically approved standalone publication proof passed preflight, independent reviews and actual `yarn test:full`. The anonymous consumer has a mandatory identity-bound certificate; named-source protections and observation rules remain unchanged.                                                                                                                                                                                                                     |
| AR-P3  | Bounded asset-relative publication proof support.                                                                                                      | User selected **Approve proof (Recommended)** on 2026-11-16 for the exact reserved complexity packet in the preflight report. A standalone feasibility-grounded plan and passing preflight precede support implementation. No general hardware analyser, observer relaxation, runtime/framework, `none` policy change or broader analysis is authorized.                                                                                                                                                |

## Specialist Agents

**New specialist check: None.** Existing machine-code, SFA/ABI and target-platform auditors own
all affected contracts (`codeops/agent-routing.md:52–59`); dynamic bounded packets suffice.
Base correctness review remains required. Specification authors remain implementation-blind.
Read-only native-charter restrictions are binding; provide parent-authorized normative excerpts
where a role cannot read a hidden authority path. No permission bypass.

Expert lineage: `2.0.4`, immutable content `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`;
`6502-lowering-casebook.md#loads-stores-and-moves`, `#equality-and-unsigned-comparison`;
`mos-6502-family.md#instruction-effects`; `evidence-parity-and-recovery.md#equivalent-work-accounting`;
`c64-memory-and-runtime.md#startup-contracts`. Governing keys: `BLEND65-SPEC-4-038b70e9`,
`MOS-PGM-1976`, `CBM-C64-PRG-1982`. PAL NMOS 6510, cooperative KERNAL 6581 PRG, ACME 0.97,
VICE 3.10. Physical status remains `VICE-verified / hardware-unverified` only after runtime proof.

## Tasks

- [x] T-168.1 Independently audit twin equivalence and challenge the first lowering unit; obtain exact oracle-edit authority for surviving benchmark defects.
- [x] T-168.2 Preflight this bounded plan; independently author new behavior/startup/trace and seven-byte poll specifications; record meaningful RED before edits. Preflight completed with PF-001 open, not passed for compiler execution. Poll 9/9 RED at the unexpected capture STA; twin startup/order RED; compiled startup and 100-checkpoint trace positive controls pass. New oracle freeze and commands: [evidence](08-evidence.md).
- [x] T-168.3 Repair and assemble the twin; verify the new contract tests, unchanged frame comparison and freshly measured twin costs. Directed VICE 5/5 and cost 1/1 pass; three independent bounded reviews find no findings. Twin 442 code bytes, 7,167 payload, 12 ZP, zero retained / two transient mainline stack bytes. This task-level proof is not a full checkpoint or #168 closeout.
- [x] T-168.4 Implement the bounded adjacent volatile-read forwarding; verify the poll oracle and unchanged boing-ball behavior. Child proof tasks 1.2.1–1.2.3 pass; public 41/41 and serialized VICE 5/5 pass. Canonical code 1,599→1,593, poll 7 bytes / 9 nominal cycles. No observer guard is waived.
- [x] T-168.5 Add implementation controls for uses, adjacency, flags, observers and storage closure; measure code/resources without changing the canonical mode. Child hardening and necessary fixes pass 79 directed compiler / 42 output-cost checks. Canonical costs remain 1,593 code / 7,167 payload / 0 ZP.
- [x] T-168.6 Independently review correctness, semantics, SFA/ABI, target-platform, emitted-code costs and affected host scaling; resolve and re-verify findings. All six lenses clear; child TP-001 and PE-001/002 fixed and independently fix-reviewed without scope expansion. Complete checkpoint pending.
- [x] T-168.7 Run the required install/build/typecheck, changed/host checks and complete serialized VICE checkpoint; document any failure honestly and do not claim a green run from a rerun alone. Actual sequential `yarn test` and `yarn test:full` both exit zero; full gate 5,101.66 s, host 246/5,153, VICE 130 files/2,379 passed with existing skips. This is a green complete run, not an isolated rerun substituted for one.
- [x] T-168.8 Record measured closeout, deferral-expiry result and remaining whole-program gap; synchronize roadmaps and make a coherent green local commit using the git-commit skill. First bounded unit closes at 1,593 compiler code bytes versus equivalent twin 442; 1,151-byte gap and steady-state cycle parity remain #168-owned. Scoped deferral assessment is recorded; next dead-teardown unit is preflighted at 0/7 and waits for this local checkpoint commit. No push or issue closure.

**Verify:** targeted new contract/poll tests first; unchanged boing-ball VICE frame comparison
after each executable slice; relevant compiler forwarding/capture tests; `yarn test:changed --host`
then `yarn test` before a commit; `yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`
and `yarn test:full` at closeout. VICE executions are serialized. Markdown-only maintenance
uses targeted formatting/link/source-key checks rather than the compiler suite.
