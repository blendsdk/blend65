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
| 2 | Technical | Which runtime oracle is authoritative? | Physical hardware / VICE plus hardware / VICE only | VICE 3.10 `x64sc` is the sole runtime oracle for this candidate. All runtime tests run through VICE, sequentially. The team accepts VICE as sufficiently accurate for the functional/runtime scope; this is not a claim of universal hardware equivalence. | ✅ Resolved — user directive and team consensus |
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
| 15 | Verification | Two specification oracles conflict on the VS Code `Run in VICE` title. | Change the product title / amend the older foundation oracle / leave the boundary red | Amend the foundation oracle so the VICE product name is not treated as forbidden toolchain configuration; keep R9.27 and its extension oracle unchanged. | ✅ Resolved — user-approved oracle ruling |
| 16 | Verification | RD-09 R9.5 tool discovery is missing from the implementation. | Reopen RD-09 / fix in RD-10 / drop the requirement | Fix in RD-10 as a qualification-blocking prerequisite: tools-file schema 1, explicit ACME/VICE paths, relative PATH resolution, exact probes, and tests. | ✅ Resolved — user-approved RD-10 fix |
| 17 | Verification | R9.5 asks for the matched version line in build evidence, but the frozen build schema allows only name, canonicalPath, and sha256. | Version the schema / keep it frozen / drop the line | Keep `.build.json` version 1 frozen. Capture the line in the discovery result, tests, and release record, and record this interpretation here. | ✅ Resolved — user-approved interpretation |
| 18 | Scope | Four takeover resident profiles are not executable and have no runtime harness. | Implement takeover / defer with a named owner / remove takeover from the product | Defer the four takeover profiles for this candidate. Qualify four KERNAL profiles plus D64; record takeover as `Unknown` under `V4-TAKEOVER-1`; narrow the support statement. | ✅ Resolved — user-approved deferral |

## Resolution Notes

**AR-1:** Physical rows are not deleted from the requirement set. They become conditional evidence:
a future run must satisfy R10.21–R10.25 and AC-20–AC-24. For this candidate, the closeout states
`Unknown` and the support statement says `VICE-verified / hardware-unverified`.

**AR-2:** VICE is a normal automated oracle, not proof of silicon. The team consensus is that it is
sufficiently accurate for the functional, instruction-level, memory/MMIO, and bounded timing scope
of this candidate, so RD-10 does not wait for hardware. It does not prove analog SID behavior, real
drive/serial timing, board/chip revisions, or silicon-sensitive edges. The release record names the
exact `x64sc` executable hash and ROM hashes already used by the VICE harness. Runs are sequential
because concurrent instances contend for monitor ports and host resources.

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

**AR-15:** The foundation check still rejects a general linter, an alternate TypeScript compiler, a
bundler outside the editor bundles, readiness/scoreboard surfaces, and skip flags. It no longer
rejects the user-facing VICE product name, which the editor requirement mandates in the extension
manifest. The RD-09 title and its extension oracle remain unchanged.

**AR-16:** RD-09 closed with R9.5 unimplemented: the CLI and services discovered tools from `PATH`
only. RD-10 owns the qualification-blocking correction. The CLI loads the optional tools file only
for `build` and `run`, validates its schema before any build work, and passes explicit executable
paths to the compiler services. A configured path wins and never falls back. `check` and ordinary
language-server analysis remain tool-free. The tools-file parser and reader live in the compiler's
`./tools` entry; the CLI imports that entry only for `build` and `run`, and the compiler root and
`frontend` entries never load it.

**AR-17:** The matched ACME version line is captured by discovery and recorded in qualification
evidence and tests. The frozen `.build.json` version-1 `HostToolRecord` keeps its exact
`name`/`canonicalPath`/`sha256` shape, so the line is not added to that schema.

**AR-18:** The four takeover IDs remain recognized manifest inventory but `loadProject` rejects
them as incomplete executable profiles, and no takeover VICE harness exists. This candidate
qualifies the four KERNAL resident profiles and the one D64 profile only. The four takeover rows
stay `Unknown` under `V4-TAKEOVER-1`; no takeover runtime, banking, vector, or interrupt claim is
made. Implementing takeover is a separate approved feature, not a qualification fix.
