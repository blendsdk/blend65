# Testing Strategy: RD-10 Production Qualification and C64U Handoff

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

RD-10 is a qualification boundary, not a new feature suite. It reuses the owning package and root
tests, runs the existing VICE journeys sequentially, and records evidence in one release document.
Every runtime observation comes from VICE 3.10 `x64sc`; physical-only rows are `Unknown`.

### Coverage Goals

| Code type | Target |
| --------- | ------ |
| Candidate/release evidence | Every required field present and identity-bound |
| Host/public path | Full claimed-host journey |
| C64 profiles/artifacts | All nine profile IDs; eight resident VICE runs; one D64 run |
| Language/assets/optimizer | Every required family reaches final bytes and applicable VICE behavior |
| C64U readiness | Twelve rows with real files/types and no speculative abstraction |
| Physical status | All rows `Unknown` with `V4-HW-1` owner |
| Security/deferrals | Full negative boundary and disposition scan |

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived from RD-10 and the frozen prerequisite contracts. Do not weaken an expectation to match
> the current implementation. A missing physical unit produces `Unknown`, never a pass.

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-1 | One clean candidate commit with exact SPEC/expert/tool/host/profile identities | Release record names every fact; dirty tree or mismatch blocks the claim | R10.1, AC-01 |
| ST-2 | Prerequisite closeout inventory | RD-01–RD-09 each link approved requirements, completed plan, evidence, and zero unresolved critical/major findings | R10.2, AC-02 |
| ST-3 | Installed packages in a clean prefix | Compiler library, `blendc`, LSP, and VSIX perform their public operations without source-tree paths | R10.3, AC-03 |
| ST-4 | Seeded compiler, ACME, packager, VICE, cancellation, and hash failures before publication | No new generation, no prior artifact launch | R10.4, AC-04 |
| ST-5 | Post-commit VICE failure or cancellation | Committed generation survives; build success reported separately; only owned execution stops | R10.4, AC-04 |
| ST-6 | Release record inspection | `docs/releases/v4-production-qualification.md` contains all required sections and no readiness percentage | R10.6, AC-05 |
| ST-7 | One unchanged family plus one changed family | Unchanged evidence is reused by identity; only the changed family's dependents rerun | R10.7, AC-06 |
| ST-8 | Missing VICE, hardware, producer fixture, and optional host | Each endpoint is `Unknown`; only its dependent claim is blocked | R10.8, AC-07 |
| ST-9 | Sample language, asset, optimizer, artifact, and runtime cases | Independent behavior and assembly/bytes/cost oracles are identified | R10.9, AC-08 |
| ST-10 | Release command/evidence log | Directed prerequisite checks, one complete candidate boundary, only dependency-justified reruns | R10.10, AC-09 |
| ST-11 | Native Linux x64 host journey | Install/build/package/check/build/run/LSP/VSIX/discovery/cancellation/publication all pass | R10.11, AC-10 |
| ST-12 | Native Windows/macOS host journey, or absence | Native evidence passes, or the host is `Unknown` and absent from the support statement | R10.11–R10.14, AC-10–AC-13 |
| ST-13 | Two or more native hosts | Normalized outputs are byte-identical; only declared provenance differs | R10.12, AC-11 |
| ST-14 | Tool discovery matrix per claimed host | Config precedence, `PATH`, exact names, versions, malformed output, missing tools, no shell/download | R10.13, AC-12 |
| ST-15 | Eight resident profile builds and VICE runs | Byte-validated PRGs and exact VICE observations; no dimension substitutes for another | R10.15, AC-14 |
| ST-16 | One D64 build and VICE run | Exact image, BAM/directory/chains, drive-8 boot/load, canaries, publication, quiescence, BASIC return, `HLE-010` | R10.16, AC-15 |
| ST-17 | Complete language family sample | Positive, boundary, negative, diagnostic, final bytes, and applicable VICE behavior through the public compiler | R10.17, AC-16 |
| ST-18 | Exact asset producer/format fixtures | Selectors, provenance, composition, placement, bytes, runtime consumer, negative cases | R10.18, AC-17 |
| ST-19 | Four optimizer modes | Independent behavior and cost evidence; no local loss; meet-only issues linked; whole-program win recorded | R10.19, AC-18 |
| ST-20 | User-authored game workloads | Compile/run without any public or injected renderer, entity/state, scheduler, mixer, or gameplay system | R10.20, AC-19 |
| ST-21 | Physical qualification rows | Every row is `Unknown`, `V4-HW-1` is named, and no physical coverage is claimed | R10.21–R10.25, AC-20–AC-24 |
| ST-22 | Documentation and support statement | Every claimed command runs on its host; physical limits and unsupported targets are stated honestly | R10.26–R10.28, AC-25–AC-26 |
| ST-23 | C64U readiness audit | Twelve rows name real files/types and a present C64 consumer; no fake package, stub, or runtime dispatch | R10.29–R10.32, AC-27–AC-30 |
| ST-24 | C64U handoff packet | All eight sections exist with exact evidence, explicit unknowns, sources, activation gates, and one native proof seed | R10.31–R10.33, AC-29 |
| ST-25 | Deferral and limitation scan | Every item is valid, due/owned, satisfied, or superseded; none points to RD-10 or an absent owner | R10.34–R10.35, AC-31 |
| ST-26 | Security negative matrix | Path/symlink, malformed input, output collision, injection, hostile tool/monitor output, trust, cancellation, stale artifact, corrupted record/D64, loopback | AC-32 |
| ST-27 | Responsiveness observations | Phase-separated durations/peak memory with complete identity and no pass/fail threshold | R10.38, AC-33 |
| ST-28 | Explicit production decision | Exact support statement and all evidence presented; roadmap changes only after user approval | R10.36, AC-34 |

## Test Categories

### Reused Owning Suites

| Suite | Role in RD-10 |
| ----- | ------------- |
| `packages/compiler` | Language, SFA, lowering, assets, optimizer, publication, evidence |
| `packages/cli` | Public command, JSON envelope, evidence, cancellation |
| `packages/language-server` | Real stdio protocol and diagnostics |
| `packages/vscode` | Manifest, commands, trust, CLI adapter, status |
| `test/rd03-import-boundary.spec.test.ts`, `test/import-boundary.spec.test.ts` | Editor/backend boundary |
| `test/rd05/*vice*`, `test/rd06/vice-*`, `test/rd07/d64-vice`, `test/rd08/input-startup-selection` | Runtime observations |
| `test/rd09/` | Tooling and debug evidence boundary |

### Release-Boundary Cases

| Case | Evidence |
| ---- | -------- |
| Candidate freeze | `git status --porcelain` empty + exact HEAD |
| Host journey | `docs/releases/v4-production-qualification.md` host section |
| Package/VSIX | Temporary installed prefix + local `.vsix` |
| VICE matrix | Sequential command log and identity record |
| C64U readiness | Readiness table with file/type evidence |
| Physical status | `Unknown` table + `V4-HW-1` roadmap row |
| Approval | User decision recorded in the release record |

## Test Data

- Existing frozen release projects under `examples/`.
- Nine profile manifests.
- Exact RD-06 producer fixtures, including the CharPad 3.80/3.88 gap disclosure.
- RD-07 D64 fixture.
- RD-08 optimizer fixtures.
- Release/package temporary directories outside the repository.
- A clean temporary install prefix and a local VSIX.

### Mock Requirements

- No compiler, CLI, LSP, or release service is mocked in a qualification case.
- The VS Code host may be faked only where a real extension host is unavailable; a real VSIX
  activation is required for the final extension claim.
- VICE is real. A missing VICE produces `Unknown`, not a fake pass.

## Verification Checklist

- [ ] Every ST case traces to an RD requirement or acceptance criterion
- [ ] Candidate identity is recorded before evidence reuse
- [ ] All claimed-host journeys pass natively
- [ ] Eight resident VICE runs and one D64 VICE run are recorded sequentially
- [ ] Language, assets, optimizer, and compiler-not-engine cases pass
- [ ] Physical rows are `Unknown` and `V4-HW-1` exists
- [ ] C64U readiness and handoff are complete without implementation
- [ ] Deferral scan is complete
- [ ] Security and responsiveness records exist
- [ ] Explicit user approval is recorded
