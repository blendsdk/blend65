# Ambiguity Register: Blend65 Developer Validation

> **Status**: ✅ GATE PASSED — all 12 decisions resolved
> **Created**: 2026-10-15
> **Last Updated**: 2026-10-15 22:38 CEST
> **CodeOps Artifact Schema**: 1

## Approval and authority

The user proposed an expert Blend65 game-development skill and ports of existing
C64 programs as evidence that the compiler can support real application work.
The subsequent discussion bounded the first deliverable to one companion skill
and one licensed game, with independent behavior and complete cost evidence.

The user then explicitly ordered: create the full RD on the current branch,
commit that RD, create a worktree with the existing worktree command, and
continue there. After a pause, the user confirmed this exact scope:

> A new `blend65-developer-validation` feature containing the companion Blend65
> game-developer skill and one complete Slither port. Slither must first pass
> source, licence and reproducible-build checks; if it fails, stop for a
> replacement decision. Compiler fixes stay in their existing owners, and
> larger ports stay out of this RD.

The answer was **“Approve scope (Recommended)”**. The user also clarified that
the existing command is **`git-worktree`**, on `PATH`, without a `.sh` suffix.
The rows below record that approval, the preceding scope discussion, and the
unchanged governing project rules. They do not claim approval of an unseen
implementation plan, qualification oracle, new compiler capability or publication.

## Decisions

| ID | Category | Decision and authority | Status |
| --- | --- | --- | --- |
| AR-001 | Scope | Create the separate `blend65-developer-validation` feature with one RD for a companion developer skill and one pilot game. User explicitly approved the named feature and scope. | ✅ Resolved |
| AR-002 | Actors and presentation | The user supplies product decisions and playtesting; the assistant writes application source and evidence. Another human programmer is not a prerequisite. The skill is for modern programmers, not an assembly-shaped source dialect. User's stated two-person setting and approved developer-skill scope; root project directives remain governing. | ✅ Resolved |
| AR-003 | Pilot and failure behavior | Slither, from `skrasser/slither_c64`, is the only pilot. Assess exact source, rights, dependencies and reproducible original build first. Failure stops pilot implementation; only the user can select a replacement. Explicit scope approval. | ✅ Resolved |
| AR-004 | Security and compliance | Preserve attribution and inspect the rights to code, assets and dependencies separately. Availability on GitHub is not permission. Unknown rights block copying or distributing the affected material. Approved licence gate and existing sensitive-path rules. | ✅ Resolved |
| AR-005 | Semantic authority | The companion references frozen Specification 4 and the single active qualified expert baseline. It cannot change either, copy qualification answers into author guidance, or teach compiler defects as language rules. Approved companion-only design and root authority/independence rules. | ✅ Resolved |
| AR-006 | Application boundary | Reconstruct game intent and write ordinary Blend65 application code. Do not embed the original gameplay assembly, create an engine API, or inject gameplay policy into the compiler. Approved port methodology and frozen product boundary. | ✅ Resolved |
| AR-007 | Behavior and machine facts | Recover and record the original's behavior, exact machine context, input timing, startup, interrupts and exit before fixing port expectations. Match a qualified Blend65 profile; incompatible behavior or missing support is a blocker, not authority to change the game. Approved source-assessment gate and machine-bound evidence rules. | ✅ Resolved |
| AR-008 | Oracles and costs | Freeze independent behavior expectations and separate expert assembly/cost expectations before implementation. Original-versus-port execution supports, but does not replace, those expectations. Account for the whole artifact and machine resources. Approved measured-port scope and root optimization rules. | ✅ Resolved |
| AR-009 | Concurrency and compatibility | Use a separate branch/worktree, independent outputs and a pinned compiler identity. Never consume the other session's mutable build output. Coordinate non-overlapping VICE windows on the host. Explicit worktree request and preceding parallel-work boundary. | ✅ Resolved |
| AR-010 | Integration ownership | Compiler bugs return to existing compiler/conformance owners with a reduced reproduction. This feature cannot patch compiler implementation, existing protected tests, other execution plans or release gates. Explicit scope approval. | ✅ Resolved |
| AR-011 | Extent and completion claims | Deliver one complete game, with skill capability claims limited to actual qualification. Larger games, commercial-game disassembly, new runners/frameworks/services, new agents and external publication are excluded. Approved bounded pilot and existing evidence/permission rules. | ✅ Resolved |
| AR-012 | Bootstrap and lifecycle | Write and locally commit only the RD and its directly supporting feature documents on the current branch; then use `git-worktree` and continue in the isolated checkout. Do not push or include the concurrent session's changes. Explicit numbered user instruction and command clarification. | ✅ Resolved |

## Facts established later without changing scope

The selected upstream commit, original assembler invocation, exact original
machine state, game transitions, fixed input traces and equivalent expert cost
bounds are outputs of the approved source-assessment and oracle work. They are
not invented here. The implementing plan must bind these facts before dependent
source/test implementation starts. If investigation presents a genuine choice
between different game behavior, target contracts, rights, APIs or support
machinery, reopen this register and obtain the appropriate ruling.

There is no approved pilot replacement, new compiler API, assembly escape,
gameplay library, generalized evidence schema or automatic hardware-test claim.
No unresolved choice is made executable by calling it a later assessment.

## Systematic ambiguity and specialist check

All twelve shared categories were considered: feature, behavior, scope,
technical, edge cases, integration, data/state, security/compliance,
non-functional, UX, stakeholder and naming concerns. Failure to establish an
original baseline, an unavailable compiler capability, changed inputs or
identities, concurrent emulator ownership, an unexpected outcome and unknown
asset rights all stop the affected proof rather than silently weakening it.

Selected domain lenses are compiler/language, distributed/concurrent and
data/migration. They apply respectively to authored source and independent
oracles, parallel sessions/emulator ownership, and immutable upstream/compiler/
artifact identities. There is no database migration or network service.

**Specialist check: None** — no additional role is justified. The configured
correctness, semantics/DX, SFA/ABI, target-platform, machine-code and security
review responsibilities cover this feature through bounded packets. The
requested skill is a companion authoring deliverable, not a new native agent,
new authority or extra review service. No specialist configuration is changed.

## Requirements-authoring checkpoint

The four new feature Markdown files pass targeted Prettier, local-link,
requirement/acceptance-ID and whitespace checks. All 16 local links resolve;
the RD has 22 Must Have requirements, one Should Have requirement and 12
acceptance criteria. Frozen specification/expert status guards remain clean.
These checks do not claim a fresh compiler or emulator result.

Independent correctness and semantics/DX reviewers report **no findings** on
the four-file addition against baseline
`3faf5569a31cd624c9b51751d1d5cb3a5d13b271`. Both establish only the requirements
boundary; upstream eligibility, original builds, machine selection and eventual
skill/port qualification remain unproved. Both disclose incidental exposure to
historical routing smoke summaries and exclude those summaries from evidence;
neither review is a blind behavioral qualification. This authoring review is
not formal requirements preflight, so the roadmap remains **RD Drafted**.
