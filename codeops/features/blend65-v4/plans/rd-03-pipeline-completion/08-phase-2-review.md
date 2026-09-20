# Phase 2 Review: Semantic CFG and Whole Program

> **Phase baseline tree**: `72de8f80050130febcd1df14f2bd8ae45b3e6ee5`
> **Scope mode**: strict
> **Reviewed**: 2026-09-20
> **Result**: accepted after corrections; no unresolved finding

## Result

Phase 2 now produces one target-neutral semantic program with explicit reachable control flow,
root-based call closure, preserved frontend effects, exact CFG liveness and referenced-asset
closure. It adds no pass framework, backend fact, target registry or runtime.

| Check | Result |
|---|---|
| Correctness review | Complete; five major findings corrected |
| Semantics review | Complete; four major/moderate findings corrected |
| Simplicity | Pass; direct records, one CFG builder and one local liveness worklist |
| Immutable specification tests | Unchanged and green |
| Frozen `spec/` | Unchanged |

## Findings and Corrections

| Finding | Correction | Final evidence |
|---|---|---|
| RV-001 / SR-001: constant-false loops retained impossible body/update edges | Lower the condition once, then route every proved-false condition directly to loop exit; omitted/literal-true conditions route to the body | Folded-comparison loop cases pass; immutable loop routing case remains green |
| RV-002: an asset referenced through a constant global was omitted | Follow reachable place roots through global initializer graphs and collect only referenced embedded assets | Referenced asset included; unrelated asset excluded |
| RV-003: dead unknown calls or recursion rejected the program | Close from initializer/main roots first; validate unknown edges and recursion only in the reachable graph | Dead unknown/cycle case completes with only `main` reachable |
| SR-002: construction-order intervals falsely overlapped sibling CFG arms | Use a direct backwards CFG fixed point with merge inputs attributed to predecessor edges | Mutually exclusive merge inputs have disjoint live positions |
| SR-003 / RV-005: semantic closure lost reads/writes and dead paths polluted effects | Preserve frontend transitive summaries, prune proved-dead frontend paths, filter summaries to reachable functions and reject missing proof for effect-bearing graphs | Read/write preservation and dead profile-effect cases pass |
| SR-004: fallback diagnostics exposed internal identity keys and incomplete wording | Retain source display names and use the normative recursion/E10277 message forms; invalid roots remain internal failures | Diagnostic specification cases pass |

The one permitted re-review found the remaining folded-false loop and effect-pruning gaps. The
primary agent applied those final direct corrections and re-ran the complete directed and repository
gates; the review protocol does not run a third independent pass.

## Verification

| Gate | Result |
|---|---|
| Directed semantic/frontend suites | 7 files, 33 tests passed |
| Compiler suite | 43 files, 863 tests passed |
| CLI suite | 61 tests passed |
| Root boundary suite | 52 tests passed |
| Full command | `yarn install --frozen-lockfile && yarn build && yarn typecheck && yarn test` passed |
| Touched-file Prettier check | Passed |

Immutable Phase 2 oracle hashes remain:

| Oracle | SHA-256 |
|---|---|
| `operations.spec.test.ts` | `46c2adec9e4295503f7b4ba7b55fe6f612804a6bb97091e57b767b8df895b25d` |
| `cfg.spec.test.ts` | `49dc4598ac56613cbe627d52f3b5e3017e82cd6c4d3feac4af732a18eb6d11b1` |
| `whole-program.spec.test.ts` | `b4352c0deefb970f1f2ae49bf21428b87bc4d46f8f643d13d576f286c51c2220` |

## Domain Lineage

`blend65-domain-expert` version `2.0.0`, content commit
`c9e70fab6039e9ced3108e88f0ea9730d4fd3007`; references
`blend65-semantics.md#Semantic-Preservation-Checklist`,
`il-and-optimization.md#Control-Flow-and-Layout` and
`sfa-and-abi.md#Lifetime-Model`.
