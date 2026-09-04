# Blend65 Domain Expert Release Record

> **Active construction version**: `0.2.0-evidence-foundation`
> **Target baseline**: `1.0.0`
> **Status**: Draft — unqualified; no release gate is claimed green
> **Recorded**: 2026-09-05

## Identity

| Field | Value |
|---|---|
| Untouched legacy Git commit | `d39ae459e02133d474d7157807d53d7e71fd6268` |
| Legacy tree source | `git archive d39ae459e02133d474d7157807d53d7e71fd6268 -- .agents/skills/blend65-domain-expert` |
| Legacy isolation | Fresh directory under `/tmp`; extracted tree made read-only before assessment; removed after evidence capture |
| Sorted legacy file-record digest | `a373271c41c9c2f50f38956c60d42a387d1da09e25e8d06c5cc61f16c7784fab` |
| Original router SHA-256 | `3865874b9f8fab03e5554e01098ed1ca4834c9470698bcc1729e06f2cca5d998` |
| Metadata SHA-256 | `94dc79f61ffc4f834f45d9e03353837089ab46f9a0fa52703aa5619e742c9370` |
| Legacy reference hashes | Pinned individually in `qualification/coverage-matrix.md` |
| Construction router | `0.2.0-evidence-foundation`; explicitly unqualified and non-authoritative |
| Construction router SHA-256 | `3d8e214bb5f9e252671a73264b744183ce4c414f685268c89e812335bfb8a4c2` |
| Qualified content commit | — |
| Superseded qualified version | None; the legacy prototype was never qualified |

## Gate State

| Gate | State | Evidence / blocker |
|---|---|---|
| Structural | Incomplete | Quarantine router and two Phase 2 construction references exist, but the accepted thirteen-reference final topology does not yet exist. |
| Coverage and traceability | Incomplete | The 100 case shells, 50 spec paths, source manifest, and Phase-2 source facets exist. Forty-seven external oracles are frozen after independent review; later replacement depth cells remain incomplete. |
| Behavioral | Incomplete | The Phase-2 evidence/recovery subset has 11 focused passes; later module cases and a definitive blind run remain outstanding. |
| Specification consistency prerequisite | Blocked | SC-001..SC-005 still require product rulings. SC-006 has an inclusive-`to` ruling. All six still require separately authorized reconciled spec commits. |

## Red-Baseline Method

The red baseline used one exact, isolated, read-only export of the untouched legacy identity. The
primary execution agent answered the selected case prompts using only that legacy router and its
four references, then graded the answers against the Phase-1 oracle fields. This is a baseline
capability inspection, not independent review and not final qualification. External-fact oracles
are still draft, so those rows are observations rather than release pass/fail evidence.

The isolated tree passed the existing `quick_validate.py` structural check. That check establishes
only valid skill packaging; it does not validate sources, routing depth, correctness, coverage, or
decision behavior.

## Red-Baseline Results

| Case | Result | Exact legacy evidence | What the result establishes |
|---|---|---|---|
| Q-R04 | Partial | `SKILL.md:28-39`; `compiler-engineering.md:47-58`; `c64-game-systems.md:57-69` | Relevant broad documents are discoverable, but there is no precise multi-module route or complete IRQ/SFA packet. |
| Q-R06 | Draft observation: partial | `c64-game-systems.md:99-110` | VICE versus hardware is bounded, but there is no explicit source-conflict authority procedure or pinned source manifest. |
| Q-R12 | Fail | `SKILL.md:28-39`; no `source-manifest.md`; ACME content is split across broad CPU/C64 references | A narrow ACME question cannot select the accepted ACME-plus-manifest-only route. |
| Q-L07 | Pre-passer | `compiler-engineering.md:47-58` | Recursion/reentrancy rejection and user-facing diagnosis are present at outline depth; exact diagnostic mapping is outside this frozen case field. |
| Q-L08 | Pre-passer | `compiler-engineering.md:49-57`; `c64-game-systems.md:64-68` | Mainline/IRQ reachability and non-reentrant scratch interference are explicitly recognized. |
| Q-C01 | Fail | `mos-6502-codegen.md:52-56` | The text says signed comparisons use `N xor V` but never says `CMP` leaves V stale; following it after `CMP` can miscompile. |
| Q-C07 | Draft observation: pre-passer | `mos-6502-codegen.md:58-60`; `c64-game-systems.md:64-65` | NMOS decimal-mode interrupt danger and ABI ownership are recognized, pending source freeze. |
| Q-C10 | Draft observation: pre-passer | `mos-6502-codegen.md:68`; `c64-game-systems.md:43-48` | Bus-visible RMW and VIC acknowledge hazards are recognized, pending source freeze. |
| Q-P01 | Draft observation: pre-passer | `c64-game-systems.md:19-34` | CPU banking, VIC bank selection, and bank-relative visibility are separated, pending source freeze. |
| Q-P07 | Draft observation: partial | `c64-game-systems.md:63-68` | Generic IRQ save/acknowledge/RTI duties exist, but KERNAL-vector versus raw-vector entry contracts do not. |
| Q-P21 | Draft observation: fail | `c64-game-systems.md:82-97` | The prototype lists game idioms but does not turn sprite multiplexing into deterministic compiler/API ownership, costs, hazards, and proof. |
| Q-A07 | Pre-passer | `evidence-and-parity.md:57-84` | Equivalent-work comparison and code/data/padding/ZP/frame/stack/helper costs are already explicit. |
| Q-A09 | Draft observation: partial | `evidence-and-parity.md:38-54,123-134` | The status vocabulary and salvage method exist, but no six-target constraint model supports the exact classification. |
| Q-A15 | Fail | Whole legacy tree; no semantic version, content commit, release binding, errata path, or dependency-targeted impact audit | A critical false fact could be silently patched and invalidate earlier decisions. |

The red subset therefore exposes material insufficiency even though several good high-level rules
pre-pass. Pre-passers stay recorded; they are not forced red and do not make legacy prose
authoritative.

## Phase-2 Source-to-Invariant Review

The independent source reviewer examined all 53 cases that originally crossed the external
authority gate. The first pass found six major precision/authority problems. Remediation replaced
dead datasheet links with identity-and-hash-pinned mirrors, added exact MOS/spec/ACME locations,
added revision-specific KERNAL and practitioner source symbols, removed placeholder citations, and
separated external facts from project method. Four cases—Q-C21, Q-A06, Q-A09, and Q-R06—were
correctly reclassified as project-policy oracles.

The second pass found two real frozen-spec conflicts, one overbroad signed-division case, and two
citation defects. Q-C13 is blocked by SC-005, Q-C19 by SC-006, and Q-C15 is now explicitly
quotient-only. ACME evaluation and evidence anchors were corrected. The final narrow re-review
returned no findings and authorized all 47 non-conflicted external cases as `frozen-external`.
No assembler, emulator, or physical-hardware observation was run or claimed.

## Phase-2 Focused Results

Each evaluator received only the named construction references and prompt, not the hidden oracle,
coverage matrix, plan, legacy conclusions, prior outputs, or author history.

| Cases | Result | What the result establishes |
|---|---|---|
| Q-R05 | Pass | Essential knowledge is locally usable; URLs remain provenance only. |
| Q-R06 | Pass | Manufacturer and configured-VICE claims stay bounded; silicon-sensitive physical behavior remains `Unknown` pending targeted hardware QA. |
| Q-R07 | Pass | Parser plus assembly-shape evidence yields only a precisely bounded `Verified partial`. |
| Q-R08 | Pass | One local rewrite does not justify a generalized pass registry. |
| Q-R09 | Pass | Imperative text inside an external source remains inert and untrusted. |
| Q-A07 | Pass | Table/helper/ZP costs reverse a false local win; unmeasured path/page timing stays unknown. |
| Q-A08 | Pass | An unexpressible program is `Incorrect` and outside any finite parity ratio. |
| Q-A11 | Pass | A no-unique-value readiness layer is deleted without creating a replacement meta-harness. |
| Q-A12 | Pass | One proven slice is `Verified partial`; salvage waits for contract/boundary/recovery-cost evidence. |
| Q-A13 | Pass | Local 1.0 parity and the 200-byte whole-program win are reported separately. |
| Q-A16 | Pass | Mutable compiler completeness is `Unknown` until the live pipeline is reinspected. |

## Migration

The coverage matrix pins every material legacy heading and its planned destination. All rows remain
incomplete until the replacement heading is independently sourced and qualified. The four old
references remain in the working tree as hash-checked read-only evidence until the Candidate
Pre-delete Gate.

## Verification

The initial Phase-1 verification passed on 2026-09-04, but the independent quality review
invalidated that result because its field-presence check did not detect malformed packet values.
The accepted remediation added meaningful-value, inline-code-delimiter, pipe-integrity,
module-conflict, and split legacy-router identity checks. Remediation verification passed on
2026-09-04: the existing skill validator, touched-file Prettier, all 100 eleven-field packets,
exact case/spec/topology sets, SC-001..SC-004, 40 legacy headings, both router identities, five
unchanged legacy-evidence files, local Markdown links, the strict phase allowlist, `spec/`
cleanliness, spec-test integrity, and `git diff --check` are green. The independent re-review
returned no findings. No compiler package, readiness, boundary, emulator, or full repository test
is applicable to this Markdown-only construction checkpoint.

Phase-2 content verification passed on 2026-09-05. The skill packaging validator and touched-file
Prettier check are green. The case files and matrix contain the same 100 unique case IDs; the live
specification and matrix contain the same 50 Markdown paths; all non-policy source-audit rows name
a defined stable source; all 47 non-conflicted external oracles are frozen; the four reclassified
project-policy oracles and two externally gated blocked conflicts have their exact expected states;
and all 11 focused evidence/recovery cases record a pass. The current construction-router identity,
five unchanged legacy-evidence hashes, strict Phase-2 path allowlist, roadmap links, `spec/`
cleanliness, spec-test integrity, and `git diff --check` also pass. This was content validation only:
no compiler build or test, assembler, VICE or other emulator executable, emulator probe, readiness
suite, or physical-hardware proof ran or is claimed.

## Post-phase Review

### Phase 1

| Finding | User ruling | Remediation state |
|---|---|---|
| RV-001 — Q-L21 packet and matrix row were truncated | Accepted 2026-09-04 | Implemented and verified; independent re-review found no remaining issue |
| RV-002 — Q-L23 ignored a frozen-spec contradiction | Accepted 2026-09-04 | SC-004 recorded and case blocked; independent re-review found no remaining issue |
| RV-003 — legacy-router identity rule contradicted quarantine replacement | Accepted 2026-09-04 | Historical/live identities split; independent re-review found no remaining issue |

### Phase 2

| Finding | Resolution authority | Remediation state |
|---|---|---|
| RV-001 — AC20 still required compiler/full-repository verification | User's explicit skill-only verification instruction, 2026-09-05 | Replaced with applicable content checks and an explicit no-executable boundary; re-review clear |
| RV-002 — requirements retained obsolete multi-release path and full-verification wording | Accepted single-active-release design | Topology, release prose, and AC17 now use only `qualification/release.md`; re-review clear |
| RV-003 — future-target precision was overstated and no manufacturer VIC-II source was pinned | Accepted source-depth and source-governance requirements | Added bounded hash-pinned CSG 6567 evidence, exact target locations/identities, and SRC-011; re-review clear |

The independent re-review found no remaining critical or major issue. Spec-test integrity remained
intact, and no compiler, assembler, readiness, emulator, or hardware execution was performed.

## Freeze Declaration

There is no freeze declaration yet. The single active construction version is explicitly
unqualified. The target `1.0.0` baseline becomes active only after all release gates pass and its
exact immutable content commit is recorded here.
