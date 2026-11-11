# Ambiguity Register: RD-10 Production Qualification and C64U Handoff

> **Status**: ✅ GATE PASSED — all 14 items resolved
> **Last Updated**: 2026-11-11 10:10

Scope baseline: RD-10 R10.1–R10.39 and AC-01–AC-34. The user has stated that no physical C64 is
available and that every runtime test must still go through VICE. This register records that
constraint and the decisions needed to plan a truthful qualification run. No product capability,
external publication, or outward release action is decided here.

| #   | Category | Ambiguity / Gap | Options Presented | Decision | Status |
| --- | -------- | --------------- | ----------------- | -------- | ------ |
| 1 | Scope | No physical C64, drive, or SID hardware is available. How is physical qualification handled? | Block RD-10 / infer a pass / record `Unknown` with an owner | Record every physical row as `Unknown` under R10.8, add a named post-release hardware backlog row, and restrict every affected claim to `VICE-verified / hardware-unverified`. | ✅ Resolved — user environment constraint |
| 2 | Technical | Which runtime oracle is authoritative? | Physical hardware / VICE plus hardware / VICE only | VICE 3.10 `x64sc` is the sole runtime oracle for this candidate. All runtime tests run through VICE, sequentially. | ✅ Resolved — user directive |
| 3 | Scope | Which production hosts can be qualified? | Claim all hosts / claim Linux only / evidence-bound hosts | Claim only hosts with native end-to-end evidence. Linux x64 is the local host. Windows x64 and macOS arm64/x64 run only on real native hosts; otherwise they are `Unknown` and excluded from the support statement. | ✅ Resolved — evidence-bound claims |
| 4 | Integration | Where does the release record live and what shape does it have? | New evidence database / existing docs / one Markdown closeout | One Markdown record at `docs/releases/v4-production-qualification.md`, linking and hashing existing evidence. No readiness product or database. | ✅ Resolved — R10.6 |
| 5 | Behavioral | When is the production candidate frozen? | Freeze now / freeze after fixes / continuous | Freeze one clean commit after all qualification-blocking fixes. A later code change invalidates only intersecting evidence and forces the smallest affected rerun. | ✅ Resolved — R10.1, R10.7 |
| 6 | Integration | How are local packages and the VS Code extension qualified? | Publish / build only / pack locally | Build and `npm pack` the public packages and produce a local VSIX, then install/use them on the qualified host. No registry, Marketplace, tag, or announcement. | ✅ Resolved — R10.28, AC-26 |
| 7 | Technical | Which VICE suites constitute the release runtime boundary? | New all-purpose runner / existing suites in a documented order | Use the existing VICE suites and one documented sequential command order. No new orchestration service. | ✅ Resolved — R10.10, verification topology |
| 8 | Data & state | How is lower-RD evidence reused? | Reuse by claim / reuse by exact identity / rerun everything | Reuse only when source, manifest, compiler, specification, skill, profile, mode, safety, tool, host, and artifact identities match. Otherwise rerun the smallest intersecting family. | ✅ Resolved — R10.7 |
| 9 | Scope | Who owns the physical hardware backlog after RD-10? | RD-10 / no owner / new roadmap row | Add one `V4-HW-1` post-release hardware qualification row to the feature roadmap and name it in the release record. RD-10 does not close with an orphaned physical deferral. | ✅ Resolved — R10.35 |
| 10 | Behavioral | What ends the production transition? | Automatic on green / roadmap count / explicit user approval | The candidate is presented with the exact support statement. The roadmap becomes production-complete only after explicit user approval of that statement. | ✅ Resolved — R10.36, AC-34 |
| 11 | Integration | What is the C64U handoff artifact? | New feature / code stubs / discovery seed | Add `codeops/features/blend65-c64u/requirements/_draft/discovery-notes.md` with the eight required sections and no C64U implementation. | ✅ Resolved — R10.31 |
| 12 | Technical | How are emulator/hardware disagreements recorded with no hardware? | Skip silently / infer / record untested | Record that hardware disagreement is untested and keep the VICE observation as the only runtime result. No averaged or inferred hardware result. | ✅ Resolved — R10.25 |
| 13 | Non-functional | Do responsiveness observations gate release? | Gate / trend only / omit | Record phase-separated trends on qualified hosts. They never change pass/fail. | ✅ Resolved — R10.38 |
| 14 | Behavioral | How is a seeded missing VICE case reported? | Pass by skip / fail everything / `Unknown` | Report `Unknown` for that endpoint and block only the claim that requires it. No skip contributes a passing count. | ✅ Resolved — R10.8, AC-07 |

## Resolution Notes

**AR-1:** Physical rows are not deleted from the requirement set. They become conditional evidence:
a future run must satisfy R10.21–R10.25 and AC-20–AC-24. For this candidate, the closeout states
`Unknown` and the support statement says `VICE-verified / hardware-unverified`.

**AR-2:** VICE is a normal automated oracle, not proof of silicon. The release record names the exact
`x64sc` executable hash and ROM hashes already used by the VICE harness. Runs are sequential because
concurrent instances contend for monitor ports and host resources.

**AR-3:** A host is never synthesized through path fixtures, containers, or another operating system.
If a native host is unavailable, the closeout records it as `Unknown` and the support statement does
not name it.

**AR-5:** The candidate commit is created after the last qualification-blocking fix. Evidence that
depends on a changed file is invalidated by its owning freshness rule; unrelated families are reused.

**AR-7:** The release order is a documented list of existing package, root, and VICE commands. It is
not a new binary, daemon, dashboard, or test framework.

**AR-9:** `V4-HW-1` is a backlog row, not an RD. It owns the future physical run and cannot be used
to claim physical coverage now.

**AR-10:** Explicit approval is a user decision. Green tests or a completed checklist cannot replace
it, and approval does not authorize a push, publication, tag, or announcement.
