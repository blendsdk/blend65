# Component: Expert Candidate and Activation

> **Parent**: [Index](00-index.md)
> **Owns**: Phases 4–5
> **Requirements**: R1.21–R1.25

## Isolated Candidate

Create the candidate at this plan's `_candidate/blend65-domain-expert/`, outside
`.agents/skills/blend65-domain-expert/`. Seed it from the active 1.0.0 tree and change only the
router, references, source governance, cases, coverage, and prepared release evidence affected by
Specification 4. Commit that exact candidate as the qualification checkpoint. The live skill
remains byte-unchanged until explicit approval.

The candidate must identify expert 2.0.0 and the exact Specification 4 digest. It reconciles:

- modern source semantics, SFA/ABI, diagnostics, and the C64-only target boundary;
- exact C64/D64/KERNAL/Koala claims and admissible source keys;
- the compiler-versus-game-policy product boundary;
- AR-045 optimizer modes/cost ordering and AR-046's sourced modern-plus-6502 technique inventory;
- routing so each question loads the smallest sufficient reference set.

## Qualification Impact

Derive a dependency record from changed router/reference/source/oracle bytes to affected case IDs.
Qualification then uses the smallest evidence set that still proves the candidate:

1. Validate all case IDs and required fields across all five casebooks.
2. Add or strengthen the required AR-046 cases without deleting an ID or weakening an expectation.
3. Rerun every changed or transitively dependent case in an isolated evaluator.
4. Rerun one predeclared unchanged control from each casebook.
5. Inherit earlier green evidence only when every referenced candidate and oracle input is
   byte-identical.
6. Run deterministic topology, links, anchors, source-key, packaging, identity, stale-claim, and
   product-boundary checks.
7. Obtain one final independent review of changed knowledge, dependency closure, controls, and the
   complete evidence packet. Critical or major findings must be resolved and re-reviewed.

This does not rerun all 107 cases through a model when the byte-level dependency proof closes.

Each model evaluator runs once inside the already-proven filesystem isolation method: only its
read-only candidate packet and prompt are visible, a repository read must fail, and a separate
grader receives the oracle. `bwrap` or an evidenced equivalent must pass both positive packet-read
and negative repository-read controls; otherwise qualification stops. No runner is added.

## Approval Packet

The packet presented to the user contains the exact candidate digest and content list, Spec 4
digest, change summary, removed support/product claims, Guard result, impact map, case results,
control results, independent review, remaining future constraints, and zero unresolved material
findings. Requirements or plan approval is not activation approval.

## Atomic Activation

After explicit approval only:

1. reject symlinks or non-regular candidate entries, copy the qualified candidate bytes into the
   live skill path, compare the complete copied tree with the approved candidate, and commit that
   content while its release record still says candidate/not active;
2. update only the release record to bind the preceding immutable content commit and Specification
   4 digest, mark expert 2.0.0 as the sole active baseline, rerun deterministic checks, and commit
   the bookkeeping record;
3. after bookkeeping, require every file except `qualification/release.md` to remain byte-identical
   to the approved candidate and require that file to contain only the approved binding change;
   if either verification or checkpoint commit fails, restore the prior live skill tree and keep
   1.0.0 active;
4. remove the plan-local candidate only after the release tail passes, then finalize closeout
   hashes, freeze proof, deferral-expiry ownership, and feature-roadmap state.

The two checkpoints avoid asking a release record to contain its own commit hash. Binding the
already-qualified content commit is bookkeeping and does not cause another semantic-version bump.
