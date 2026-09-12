# Expert Authority: Specification 4.0 and Expert Authority Freeze

> **Document**: 03-05-expert-authority.md
> **Parent**: [Index](00-index.md)

## Overview

This component reconciles the single active `blend65-domain-expert` skill with the frozen Spec 4
candidate and advances its public authority version from `1.0.0` to `2.0.0`. RD-01 R1.21 owns the
knowledge, product-boundary, source-governance, and optimization requirements.

## Architecture

### Current Architecture

The active skill uses a compact router, 13 selectively loaded references, five Markdown casebooks,
one coverage matrix, and one release record. That topology is qualified under P3 and already
supports focused reruns plus a complete isolated blind sample.

### Proposed Changes

Preserve the topology unless an RD-01 obligation demonstrably requires a new case in an existing
casebook. Update only changed knowledge and its dependency closure. Do not introduce a runner,
framework, database, duplicate release directory, compiler dependency, or game-policy API. See
AR-P3 and RD-01 R1.21–R1.23.

## Implementation Details

### Router and Metadata

`SKILL.md` and `agents/openai.yaml` identify version `2.0.0`, the candidate Spec 4 identity, and the
same selective-loading boundary. Routing changes only where C64-only authority, modern source
ergonomics, product-boundary rules, or optimizer/evidence questions need a different reference.

### Reference Ownership

| Reference | RD-01 change boundary |
|---|---|
| `blend65-semantics.md` | Spec 4 semantic crosswalk and no compiler-shaped restrictions |
| `compiler-architecture.md` | Obligations for new semantics; no current-code authority |
| `sfa-and-abi.md` | Aggregate return, addresses, function/handler storage, no post-closure storage |
| `il-and-optimization.md` | Complete AR-045/AR-046 modes, frontier, proof, and cost inventory |
| `6502-lowering-casebook.md` | Five intrinsics, safety boundaries, expert instruction/cost oracles |
| `c64-hardware.md` | Exact qualified C64 profile hardware facts |
| `c64-memory-and-runtime.md` | Placement, loadable state, KERNAL loader, `HLE-010` |
| `c64-game-engineering.md` | Assets and game workloads as user-authored policy |
| `acme-and-artifacts.md` | D64/1541/KERNAL source and artifact facts |
| `target-portability.md` | C64-only active authority and future-target constraints |
| `evidence-parity-and-recovery.md` | Spec 4 evidence binding and composed qualification |
| `mos-6502-family.md` | Only affected CPU/flag/stack facts |
| `source-manifest.md` | Spec identity, primary source keys, provenance, and status |

Unlisted sections and unaffected references remain byte-stable unless a direct stale-identity field
must change.

### Product Boundary

Expert workload and optimization knowledge remains available, but every active statement must
distinguish compiler/toolchain support from user-authored gameplay and renderer policy. Asset
handling stops at compile-time data, metadata, symbols, placement/package facts, and exact external
ABIs. This boundary is checked across router, references, casebooks, and release evidence.

### Qualification Cases

Preserve all 107 existing unique IDs. Add only discriminating AR-046 cases not already covered,
placing them in the existing CPU/optimization or cross-cutting casebook. Strengthen an existing case
when it already owns the exact behavior; never remove or weaken a case to preserve the old total.
Every new or changed case retains the established eleven fields.

### Source Governance

Add or reconcile primary records for D64 geometry/directory/BAM/data chains, the selected KERNAL
loader ABI/resource effects, application quiescence, and `HLE-010`. Each factual claim cites a
stable source key. Spec 4 semantics remain project authority and are not inferred from hardware,
current code, tests, feasibility, or readiness artifacts.

## Integration Points

| Component | Contract |
|---|---|
| Frozen Spec candidate | Sole language/target identity consumed by the skill |
| Coverage matrix | Exact reference, case, source, and semantic dependency closure |
| Qualification | Existing composed-evidence method with new/affected cases |
| Release record | Remains v1.0 active until the approved Phase 8 tail |
| Later RDs | Bind audits to the released `2.0.0` content commit and Spec identity |

## Error Handling

| Error case | Handling strategy | AR Ref |
|---|---|---|
| Skill text contradicts frozen Spec 4 | Fix candidate knowledge and invalidate affected evidence | AR-P3 |
| A case ID disappears or expectation weakens | Block qualification | AR-P3 |
| New source key lacks admissible provenance | Mark claim unqualified; do not activate | AR-P4 |
| Proposed helper becomes game/application policy | Remove it from the toolchain surface | AR-P2 |
| Generalized evaluator infrastructure is proposed | Use the existing Markdown/composed method | AR-P3 |

## Testing Requirements

- ST-29–ST-33 cover version/identity routing, product boundary, optimization inventory, source
  governance, and case preservation/addition.
- `tests/expert-authority.spec.test.md` is authored before candidate skill edits.
- `tests/expert-authority.impl.test.md` records topology, field, source-key, link, stale-claim,
  content-set, and negative product-boundary checks.
