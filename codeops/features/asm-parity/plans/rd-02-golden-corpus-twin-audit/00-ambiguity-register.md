# Ambiguity Register: RD-02 Golden-Corpus Twin Audit + Scoreboard (plan)

> **Status**: ✅ GATE PASSED — all 12 items resolved · preflight addenda appended (plan-PF-001…010 accepted per recommendation, see `00-preflight-report.md`)
> **Last Updated**: 2026-07-18
> **Scope**: Implementation plan for asm-parity/RD-02 (`../../requirements/RD-02-golden-corpus-twin-audit.md`)
> **CodeOps Skills Version**: 3.9.0
>
> Requirement-level decisions live in the feature register
> (`../../requirements/00-ambiguity-register.md`) and are cited as **req-AR #N**; they import as
> pre-resolved context and are NOT re-confirmed here: twin convention + pair manifest
> (req-AR #10), ratios + mechanical taxonomy (req-AR #9), measured-where-phase-stable scoreboard
> (req-AR #15 + PF-012 addendum), permanent twin tier (req-AR #16 + PF-009/PF-011 addendum),
> scoreboard location/freshness (req-AR #17), two-layer routing (req-AR #18 + PF-010 addendum),
> surface names `gen-parity-scoreboard.mjs` / `yarn gen:scoreboard` / `twins.spec.test.ts` /
> `SCOREBOARD.md` (req-AR #19). Preflight decisions PF-009…PF-013 are recorded in the RD's Scope
> Decisions table.
>
> **Hardening**: recon was verified by one independent challenger agent (per
> `recommendation-hardening.md`) before these items were presented; plan-AR #1, #3, #4 and the
> refinements inside #2, #6, #8 originate from its findings.

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Behavioral | **Balloon source↔twin are NOT functionally identical today**: `main.blend:96-103` steps ±2 with `>=`/`<=` bounces; `balloon.asm:57-105` steps ±1 with exact-equality compares. F2's identical-assertion contract is unsatisfiable until one side changes | (a) Fix the twin to the source's ±2 / `>=`-`<=` semantics — generated side, budgets.json, and the user-facing example stay untouched; the twin's bytes/cycles baseline and F7 measured reference are being (re)established in this RD anyway; the cited 3.26×/3.91× shift slightly when the scoreboard lands / (b) fix `main.blend` to ±1 — changes the user-facing example, invalidates budgets.json (772 bytes / 162 measured) and RD-01's baselines | ✅ Resolved — User chose (a): fix the twin to the source's ±2 / `>=`-`<=` semantics | ✅ Resolved |
| 2 | Technical | Shared observable-assertion shape (deferred to plan by RD F2/tech-req) | (a) Data-first: `testing/observables.ts` defines `ProgramObservables` = ordered `landmarks` (memory-condition \| loop-head Nth-arrival, label supplied per consumer) + `checks` (byte {address,value} \| block {address,bytesFile}); one shared `assertObservables()` runner; each `testing/<fixture>.ts` exports its `OBSERVABLES` table; both suites consume it. Includes a new `runUntilLabelArrivals(driver, symbols, label, n)` strategy with set-once/resume-n/delete checkpoint lifecycle + a live VICE probe spec pinning Nth-arrival semantics (today unproven; `runUntilLabel` also leaks its checkpoint — `strategies.ts:81-89`) / (b) per-fixture exported assertion functions — boundary held by convention only, probes can smuggle in | ✅ Resolved — User accepted recommendation: (a) data-first `testing/observables.ts` + `runUntilLabelArrivals` with live VICE probe | ✅ Resolved |
| 3 | Behavioral | Shared-set boundary vs compiler-allocated addresses: slice8's counter/mirror observables live at allocator-chosen addresses parsed from equates at test time (`slice8.spec.test.ts:64-66`); pinning the twin to them contradicts "internals are free" | (a) Shared sets carry **source-mandated addresses only** (addresses literal in the `.blend` source: $C000…, $D020, $0400…); compiler-allocated-address assertions are implementation-coupled and stay fixture-local (principled extension of PF-011) / (b) twin adopts the generated allocation addresses for shared asserts | ✅ Resolved — User chose (a): shared sets carry source-mandated addresses only; allocator-chosen assertions stay fixture-local | ✅ Resolved |
| 4 | Behavioral | Slice8's border check is a masked inequality (`(mem&0x0f) != boot` — `slice8.spec.test.ts:81-82`), inexpressible as {address,value} and weaker than the fixture's documented behavior ((14+100) mod 16 = 2 → readback $F2) | (a) Strengthen to exact `$D020 == 0xF2` in the shared set (deliberate, user-approved assertion change) / (b) keep the masked inequality fixture-local; slice8's shared set holds landmarks only | ✅ Resolved — User chose (a): strengthen to exact `$D020 == 0xF2` in the shared set (deliberate assertion change) | ✅ Resolved |
| 5 | Behavioral | Content of the two newly authored observable sets (PF-009) | rasterpoll: stop at 2nd arrival of the frame-loop head → `$0400 == 1`, `$D020` readback `0xF1`. balloon (after #1(a)): 2nd arrival → `$D000 == 174`, `$D010 == 0`, `$D001 == 141`, `$07F8 == 13`, `$D015 == 1`, `$D027` readback `0xF1`, `$D017/$D01C/$D01D == 0`, block `$0340..$037E` == `balloon.bin` bytes. Running-machine landmarks are racy for these two (state mutates every frame; a frame is shorter than the 20 000-instruction poll batch, `strategies.ts:25`) — stopped-machine landmarks are the only deterministic form | ✅ Resolved — User accepted recommendation: sets and 2nd-arrival landmarks as stated (balloon values per the source's ±2 semantics) | ✅ Resolved |
| 6 | Data | Manifest schema for `twins.json` (deferred to plan by RD/PF-010) | Pair entries keep `{source, twin}` and gain optional `measured` `{window, fromLabel, toLabel, cycles}` (cycles = the TWIN's reference; window name cross-checked against the same program's `budgets.json` window) and optional `routing`: keys = exactly twin-diff's five mechanical category strings (exported as a `CATEGORIES` constant from `twin-diff.mjs` — single vocabulary source); values = arrays of `{disposition, issue?, sourceForced?, note?}`; disposition ∈ {structural, peephole, data/placement, ceremony, parity}; issue (positive int) required unless parity, forbidden with parity; `sourceForced` whitelisted for F8; unknown keys rejected; errors name file + JSON path and which vocabulary (category vs disposition) was violated | ✅ Resolved — User accepted recommendation: schema as stated, `CATEGORIES` exported from `twin-diff.mjs` | ✅ Resolved |
| 7 | Edge case | Stale routing entries: a `routing` key whose category has zero computed divergence rows | (a) Error, before any output is written — same fail-loud/golden-freshness posture; categories derive deterministically from repo state, so staleness only appears when code/twins change, exactly when a routing refresh is right; also catches category-string renames / (b) warn and ignore | ✅ Resolved — User accepted recommendation: (a) stale routing is an error, checked before any output | ✅ Resolved |
| 8 | Technical | Code sharing across scripts and the TS tier | (a) Extract `loadManifest`/`buildGeneratedSide`/`assembleTwin` into `scripts/lib/twin-corpus.mjs` (shared by `twin-diff.mjs` + `gen-parity-scoreboard.mjs`); lib functions **throw**, each CLI maps to exit 1 under its own stderr prefix (the `twin-diff:` prefix gains its spec pin in Step 2.4 — `test/twin-diff.spec.test.ts:114` pins the path-rejection message only; see #8 addendum); fix `buildGeneratedSide` to enumerate staged `.blend` files (main.blend first, rest sorted) — today it hardcodes `["main.blend"]` (`twin-diff.mjs:187`), which breaks the 4 multi-module pairs (slice5a/5b/7/7b); `assembleTwin` stages only the named twin + `.bin` assets (not all 13 co-located twins); `classifyDivergences` + `CATEGORIES` stay exported from `twin-diff.mjs` (`test/twin-diff.impl.test.ts:10` imports from there). TS side: harness-internal `twin-manifest.ts` loader on the `budget-loader.ts` pattern, off-barrel (`index.ts:10-11` excludes test-only helpers; cross-package `dist/` imports banned). Accepted duplication, named: one `.mjs` + one `.ts` validator over `twins.json`, and the `!to`-directive handling repeated in `testing/twin-assemble.ts` / (b) export the TS loader from the barrel and import the package from scripts — expands the stable public surface with dev tooling | ✅ Resolved — User accepted recommendation: (a) `scripts/lib/twin-corpus.mjs` extraction + harness-internal `twin-manifest.ts`; named duplications accepted | ✅ Resolved |
| 9 | Scope / workflow | Routing dispositions and GitHub writes during execution (F6: append #52 catalog, reference #49/#59, file new issues) | (a) Executor computes divergence groups and *proposes* dispositions; the full routing table is presented for user confirmation BEFORE committing to `twins.json` and BEFORE any GitHub write / (b) executor routes and files autonomously | ✅ Resolved — User chose (a): routing table reviewed and confirmed by the user before manifest commit and any GitHub write | ✅ Resolved |
| 10 | Behavioral | Sync-test coverage (PF-013) is wider than the RD's "main.blend" wording: 4 fixtures inline multiple modules (slice5a +math; slice5b +math,math2; slice7 +gfx; slice7b +game) | Pin EVERY inlined `.blend` module source byte-for-byte to its `examples/<fixture>/` counterpart; balloon exempt (builds from `examples/` directly — `testing/balloon.ts:22-30`); `.bin` assets exempt (copied, never inlined) | ✅ Resolved — User accepted recommendation: pin every inlined module source; balloon and `.bin` assets exempt | ✅ Resolved |
| 11 | Naming | New surface names (batch; beyond req-AR #19) | `testing/observables.ts` (`ProgramObservables`, `assertObservables`) · `runUntilLabelArrivals` in `run/strategies.ts` · new VICE suites `rasterpoll.spec.test.ts`, `balloon.spec.test.ts` · sync test `examples-sync.spec.test.ts` · `testing/twin-assemble.ts` (`assembleTwin`) · `twin-manifest.ts` (`loadTwinManifest`) + its spec/impl tests · `scripts/lib/twin-corpus.mjs` · `test/gen-parity-scoreboard.spec.test.ts` / `.impl.test.ts` · balloon twin window labels `update` → `mainloop` · CI step name "Scoreboard freshness" · plan folder `rd-02-golden-corpus-twin-audit` | ✅ Resolved — User accepted recommendation: names as listed | ✅ Resolved |
| 12 | Technical | Verify command for every plan Verify line | Detected from project CLAUDE.md (and cited verbatim by RD AC-10): `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test` | ✅ Resolved — User accepted recommendation: verify command as detected | ✅ Resolved |

### Resolution Notes

**Plan-AR #1:** Found by the independent challenger, verified against source: the twin's header
comment claims functional identity but the movement/bounce semantics differ. (a) is recommended —
the twin is precisely the artifact this RD re-verifies and re-measures; (b) would ripple into
RD-01's committed baselines and a user-facing example. Consequence of (a): the balloon observable
values in plan-AR #5 use the source's ±2 semantics, and the F7 measured reference is recorded
from the corrected twin.

**Plan-AR #2:** The data-first table makes the PF-011 boundary structural (a data row cannot run
driver probes), gives F2 its single-source-two-consumers shape for free, and 11 of the 12 existing
suites translate verbatim (their assertions are already runUntilMemory/assertMemory constant
pairs; slice8 is the exception — #3/#4). The Nth-arrival strategy needs a live probe because no existing test exercises
same-address re-arrival semantics on real VICE (`measure.spec.test.ts` only covers from ≠ to).

**Plan-AR #5:** First arrival at the frame-loop head precedes the first poll on both sides
(generated: `_main: JMP Main_main_L0` before the poll — `rasterpoll.asm.golden:33-35`; twin:
`mainloop:` after init), so the 2nd arrival is deterministically "exactly one frame body ran".

**Plan-AR #9:** GitHub issue writes are outward-facing; the routing table is also the plan's main
judgment call (expert-assembly assessment of each divergence group), which the user may want to
sanity-check before it becomes the committed audit record.

### Preflight addenda (plan preflight 2026-07-18 — all accepted per recommendation)

**Plan-AR #6 (addendum — plan-PF-006):** `CATEGORIES` is DEFINED in `scripts/lib/twin-corpus.mjs`
and re-exported from `twin-diff.mjs` — the decided export surface is unchanged
(`test/twin-diff.impl.test.ts`'s import point holds) while avoiding a lib↔CLI import cycle. The
TS loader cannot import across the package boundary and carries a local frozen copy of the five
strings (#8's named duplication); rename drift is caught mechanically by #7's stale-routing error.

**Plan-AR #8 (addendum — plan-PF-005):** factual correction — no spec pins the `twin-diff:`
stderr prefix today (`test/twin-diff.spec.test.ts:114` pins the path-rejection message). The
Step 2.4 spec amendment adds the `twin-diff:` prefix pin; ST-19 pins `gen-parity-scoreboard:`.

**Plan-AR #10 (addendum — plan-PF-003):** inlined-source drift direction: `examples/` is the
oracle. Known at plan time: `SLICE3B_SRC` drifts from `examples/slice3b/main.blend` by trailing
comments (the other 17 modules verified byte-identical). ST-4 enters red for slice3b; Phase 1's
green phase updates the constant to the example's exact text.

**Plan-AR #11 (addendum — plan-PF-002, plan-PF-007):** two surface decisions: the scoreboard
generator gains `--manifest <path>` / `--budgets <path>` (committed-file defaults, repo-inside
canonicalization — required by ST-16/17/19/20 and used for Phase 5's draft-routed preview);
`runUntilLabelArrivals` stays OFF the package barrel (ST-27/`index.ts` untouched; promote
deliberately if an external consumer appears).

**Sequencing (plan-PF-001):** the execution plan was re-staged at preflight so every committed
state is verify-green: scripts-lib extraction + multi-module fix moved to Step 2.4 (before the
corpus); pair-entry + twin authorship atomic per task; two-stage twin-diff `unpaired` amendment
(computed consistency at Phase 3 start, empty at completion); ST-10 split into ST-10a/ST-10b;
ST-18/ST-20 authored + green in Phase 5. Full audit trail: `00-preflight-report.md`.
