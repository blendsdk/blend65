# Blend65 Domain Expert Release Record

> **Active construction version**: `0.1.0-legacy-quarantine`
> **Target baseline**: `1.0.0`
> **Status**: Draft — unqualified; no release gate is claimed green
> **Recorded**: 2026-09-04

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
| Construction router | `0.1.0-legacy-quarantine`; explicitly unqualified and non-authoritative |
| Quarantine router SHA-256 | `35e495fbc6e18665dfdf3c09b3b0e1b039a2da8ebd06291e6832523bab2e92ae` |
| Qualified content commit | — |
| Superseded qualified version | None; the legacy prototype was never qualified |

## Gate State

| Gate | State | Evidence / blocker |
|---|---|---|
| Structural | Incomplete | Quarantine router validates, but the accepted thirteen-reference final topology does not yet exist. |
| Coverage and traceability | Incomplete | 100 case shells and 50 spec-path rows exist; replacement depth/source cells are intentionally incomplete. |
| Behavioral | Incomplete | Red baseline recorded below; no candidate focused or definitive blind run exists. |
| Specification consistency prerequisite | Blocked | SC-001..SC-004 in the coverage matrix require product rulings and separately authorized reconciled spec commits. |

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

## Post-phase Review

| Finding | User ruling | Remediation state |
|---|---|---|
| RV-001 — Q-L21 packet and matrix row were truncated | Accepted 2026-09-04 | Implemented and verified; independent re-review found no remaining issue |
| RV-002 — Q-L23 ignored a frozen-spec contradiction | Accepted 2026-09-04 | SC-004 recorded and case blocked; independent re-review found no remaining issue |
| RV-003 — legacy-router identity rule contradicted quarantine replacement | Accepted 2026-09-04 | Historical/live identities split; independent re-review found no remaining issue |

## Freeze Declaration

There is no freeze declaration yet. The single active construction version is explicitly
unqualified. The target `1.0.0` baseline becomes active only after all release gates pass and its
exact immutable content commit is recorded here.
