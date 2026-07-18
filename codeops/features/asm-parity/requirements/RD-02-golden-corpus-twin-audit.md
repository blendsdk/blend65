# RD-02: Golden-Corpus Twin Audit + Scoreboard

> **Document**: RD-02-golden-corpus-twin-audit.md
> **Status**: Draft
> **Created**: 2026-07-18
> **Project**: blend65 — asm-parity feature
> **Source**: GitHub issue [#61](https://github.com/blendsdk/blend65/issues/61) (Sweep E); umbrella program [#56](https://github.com/blendsdk/blend65/issues/56)
> **Depends On**: RD-01 (instruments: twin-diff, timing table, measureCycles, budgets; done 2026-07-18)
> **CodeOps Skills Version**: 3.9.0

---

## Feature Overview

The Prime Directive's benchmark — "goldens should read like a competent asm dev wrote them" —
is only checkable against an actual competent-asm-dev version of each program. Today exactly
one such pair exists (`examples/balloon`: generated 3.26× bytes / 3.91× static cycles vs the
hand-written twin, both VICE-verified). This RD applies the method that started the whole
program to the **entire golden corpus**: author an expert hand-written twin for every golden,
make each twin *earn* functional equivalence on real VICE through the same observable
assertions its fixture uses, categorize and route every divergence, and commit the parity
scoreboard — the number the compiler is trying to drive to 1.00×, and the permanent
regression baseline every codegen change is judged against.

RD-01 shipped the instruments (twin-diff taxonomy + ratios, timing table, `measureCycles`,
budget ratchets); this RD supplies the corpus those instruments were built for. It changes no
compiler code: the deliverables are test assets (twins), a test tier, a committed scoreboard
with a CI freshness gate, and a fully routed divergence inventory feeding #49–#53/#59.

**Affected areas**: `packages/test-harness` (twins, twin tier, pair manifest + routing block,
scoreboard, new fixture-side observable cases for rasterpoll/balloon, measured-equality
amendment to the budget tier, fixture-source sync test), `scripts/` (scoreboard generator),
`.github/workflows/ci.yml` (freshness step), `examples/balloon` (twin window labels). No
`@blend65/*` compiler package changes.

---

## Functional Requirements

### Must Have

- [ ] **F1 — Twin corpus** *(complexity: XL)*: 13 new hand-written twins as `<fixture>.twin.asm`
  beside the goldens in `packages/test-harness/test/golden/` (AR #10): `gate`, `slice3a`,
  `slice3b`, `slice4a`, `slice4b`, `slice5a`, `slice5b`, `slice6`, `slice7`, `slice7b`,
  `slice8`, `slice8b`, `rasterpoll` (the raster-poll fixture's twin was explicitly deferred
  here by RD-01). Each twin reproduces its fixture's observable behavior — the same memory
  observables the VICE tier asserts — written as a commercial-game developer would, **not** as
  a mechanical translation of the generated code. Twins follow the repo's ACME conventions and
  the fixtures' doc standard (plain-language comments; no invented cleverness that changes
  observables).
  > **Per AR #10 (RD-01):** location/naming; `examples/balloon/balloon.asm` stays put. The
  > issue's older `test/golden/twins/` wording is superseded.
- [ ] **F2 — Twin verification tier** *(complexity: M)*: a permanent local suite
  `packages/test-harness/src/twins.spec.test.ts` under `skipIf(!hasVice() || !hasAcme())`:
  every twin (all 14 pairs — the balloon twin retrofitted) assembles via ACME and passes the
  **identical** observable assertions as its golden fixture's spec test. Assertion logic has a
  single source per fixture, shared between the fixture suite and the twin suite — never
  duplicated. The shared set comprises **memory observables only** (hardware/state addresses +
  expected bytes); implementation-coupled assertions (symbol-relative opcode probes,
  PC-at-label checks) stay fixture-suite-local and are outside the twin contract (preflight
  PF-011). For the two corpus programs with no fixture-side observable suite today —
  `rasterpoll` (covered only by the golden-text and budget tiers) and `balloon` (covered only
  by the budget tier) — this RD **authors** the observable assertion set in the shared helper
  and adds a fixture-side VICE spec case consuming it, so single-source/two-consumers holds
  for all 14 pairs (preflight PF-009).
  > **Decision per AR #16:** permanent tier, not one-time audit verification — twins are test
  > assets and a live regression baseline; a bit-rotted twin must never silently corrupt the
  > scoreboard.
- [ ] **F3 — Pair manifest completion** *(complexity: S)*: the pair manifest
  (`packages/test-harness/test/golden/twins.json`) registers all 14 golden↔twin pairs;
  `yarn twin:diff` reports zero unpaired programs. Because the generated sides build from the
  on-disk `examples/<fixture>/` directories while fixture verification builds the helpers'
  inlined sources, a sync spec test asserts each inlined fixture source equals its
  `examples/<fixture>/main.blend` byte-for-byte — the scoreboard can never score a program
  that drifted from the one the twin earned equivalence against (preflight PF-013).
- [ ] **F4 — Parity scoreboard** *(complexity: M)*: a committed
  `packages/test-harness/test/golden/SCOREBOARD.md`, generated by
  `scripts/gen-parity-scoreboard.mjs` (alias `yarn gen:scoreboard`). Per pair: bytes
  (generated, twin, ratio), static straight-line cycles (generated, twin, ratio), ratios to
  two decimals; plus corpus totals. Measured generated-vs-twin columns appear **only** where a
  phase-stable measured window exists (today: the balloon frame-update body); measured values
  are sourced from committed data — the generated side from `budgets.json`'s measured
  ratchets, the twin side from a measured reference recorded in the pair manifest — so the
  scoreboard regenerates byte-identically without VICE. The local measured tiers keep those
  committed values honest: fresh measurements must equal them exactly (F7, AC-6), so an
  untightened improvement fails locally instead of the scoreboard publishing a stale ceiling
  as a measurement (preflight PF-012). The manifest's committed routing block (F6) is the
  third generator input alongside `budgets.json` and the pair entries.
  > **Decisions per AR #15 (metric set), AR #17 (location), AR #19 (names).**
- [ ] **F5 — CI freshness gate** *(complexity: S)*: CI regenerates the scoreboard and fails
  when the committed file differs (golden-style: the scoreboard changes exactly when goldens
  change, and a stale committed number is a build failure, not drift).
  > **Decision per AR #17:** CI-checked freshness. The RD-01 informational twin-diff step
  > remains as-is.
- [ ] **F6 — Divergence audit + routing** *(complexity: L)*: every divergence group reported by
  `yarn twin:diff` carries **two** classifications: the tool's mechanical category (AR #9 —
  instruction selection, layout, data placement, addressing modes, register usage) and one or
  more routing dispositions: `structural` → #50/#51/#53 or a new issue, `peephole` → appended
  to #52's catalog, `data/placement` → #49, `ceremony` → #59, `parity` → none. A **divergence
  group** is a pair × mechanical category; the tool's per-row detail strings (which embed
  volatile instruction counts) are display-only evidence, never routing keys. A group may
  carry multiple dispositions — one aggregate row set can have several root causes (the
  balloon's inflated LDA/STA counts are part source-forced `data/placement`, part `peephole`).
  Routing lives in a committed `routing` block per pair in the pair manifest (schema
  plan-level; the loader's fail-loudly posture applies) and is rendered — with issue links —
  in the scoreboard. The generator **exits non-zero naming any group that lacks a routing
  entry**, before writing output, so "zero unclassified" is enforced permanently by the CI
  freshness step, not just on audit day. Every non-`parity` disposition links a GitHub issue
  (existing or newly filed).
  > **Decision per AR #18:** two layers — mechanical taxonomy stays in the tool, routing lives
  > in the audit/scoreboard. **Per preflight PF-010:** group granularity, manifest as the
  > committed routing home, multi-disposition groups, generator-enforced completeness.
- [ ] **F7 — Balloon twin measured window** *(complexity: S)*: `examples/balloon/balloon.asm`
  gains labels bounding its frame-update body; its quiesced measured cycle count (identical
  across two fresh VICE processes, per RD-01's `measureCycles` + `quiesce`) is recorded as the
  manifest's twin measured reference, giving the scoreboard its measured ratio. The twin tier
  asserts a fresh local measurement **equals** the recorded reference exactly, and the budget
  tier's balloon measured case asserts equality against `budgets.json`'s measured value
  (amending RD-01's within-budget check) — both sides of the measured ratio stay live, not
  audit-day snapshots (preflight PF-012).
  > **Per AR #15:** measured columns only where phase-stable; the balloon window is the proven
  > phase-stable case (measured 162 cycles on the generated side in RD-01).

### Should Have

- [ ] **F8 — Un-idiomatic-source annotations** *(complexity: S)*: where a fixture's *source* is
  itself un-idiomatic because of a known language gap (the balloon's unrolled pokes → #49),
  the twin shows the idiomatic form and the scoreboard row annotates the affected divergence
  as source-forced (`data/placement` → #49), so it is not read as a codegen defect.

### Won't Have (Out of Scope)

- **Fixing any divergence** — this RD is the audit; fixes land via RD-03…RD-07 (structural,
  peephole, data placement) and are measured against this baseline.
- **The post-optimization re-sweep** — re-running the audit after #50–#53 land is *scheduled*
  here (tracked on #56) but executed as its own later pass.
- **Measured columns for phase-unstable windows** — physics, not policy (RD-01 AR #12
  addendum; slice8b's boot-frame window cannot be externally quiesced to determinism).
- **Twin budgets in `budgets.json`** — budgets ratchet *generated* output only; twins are the
  comparison baseline, not budget subjects.
- **65C02 / Commander X16 twins** — the corpus is the C64 golden set; X16 parity work brings
  its own timing data first (RD-01 Won't-Have).
- **New harness/tooling capabilities beyond the scoreboard generator** — RD-01 shipped the
  instruments; this RD consumes them.

---

## Technical Requirements

### Twin authorship contract

A twin is a standalone ACME program assembling to a runnable C64 `.prg`. Its equivalence
contract is its fixture's **observable assertion set** — the memory addresses and
expected bytes the fixture's spec test asserts after `main` completes (or, for `rasterpoll`,
at its poll landmark). Observables only: implementation-coupled fixture assertions
(symbol-relative opcode probes, PC-at-label checks) are outside the contract (PF-011). For
`rasterpoll` and `balloon` — which have no fixture-side observable suite today — F2 authors
the assertion sets (PF-009). Internals are free: the twin uses whatever registers, addressing modes,
layout, and data placement an expert would — that freedom is precisely what the diff measures.
Twins carry plain-language comments to the fixtures' doc standard.

### Twin verification tier

`twins.spec.test.ts` follows the established local-tier conventions
(`skipIf(!hasVice() || !hasAcme())`, sequential VICE execution). Per pair it assembles the twin
and runs the same assertion functions the fixture suite calls. Achieving the single-source
requirement means the per-fixture assertion sets for gate and the twelve slices move from
their existing fixture suites into the shared `testing/<fixture>.ts` helpers (those spec
tests already build through them); for `rasterpoll` and `balloon` the sets are **authored**
in the helpers and gain new fixture-side VICE spec cases as their first consumer (PF-009).
The exact refactoring shape is a plan-level detail — the requirement is: one assertion
source per fixture, two consumers.

### Pair manifest

`twins.json` grows from 1 to 14 pairs, keeping its existing `{ source, twin }` shape. It also
carries the twin-side measured reference for pairs with a phase-stable window (today balloon
only) — window name, labels, and the locally measured cycle count — and the per-pair
`routing` block, the committed home for F6's routing dispositions (PF-010). Schema details are
plan-level; the manifest loader keeps the fail-loudly posture of RD-01's data loaders
(unknown keys and malformed entries error, naming file and path).

### Scoreboard generator

`scripts/gen-parity-scoreboard.mjs` reuses the twin-diff build path: generated sides compiled
from source via the built compiler + real ACME, twins assembled honoring their own directives.
Ratios come from assembled bytes and the timing table's straight-line sums (the same numbers
`twin-diff` reports); measured columns and routing sections read committed data only
(`budgets.json` + the manifest, including its routing block); an unrouted divergence group
aborts generation (F6).
Output is deterministic — content depends only on repo state, no timestamps — so a CI diff is
meaningful. The script follows the RD-01 script conventions: repo-root path canonicalization
and rejection, argv-array spawns, "run 'yarn build' first" guidance on missing dist, CLI-gated
exports so the classification logic stays unit-testable.

### CI

One new step after build: regenerate the scoreboard and fail on any difference from the
committed file (ACME and the built compiler are already present in CI; no VICE needed thanks
to the committed-data rule for measured values). The RD-01 informational twin-diff step is
unchanged.

### Divergence routing record

The scoreboard carries, per pair, the divergence groups (pair × mechanical category) with
their mechanical classification, routing disposition(s), and issue links, sourced from the
manifest's committed routing block (PF-010). Routing targets: `structural` → [#50](https://github.com/blendsdk/blend65/issues/50)
/ [#51](https://github.com/blendsdk/blend65/issues/51) /
[#53](https://github.com/blendsdk/blend65/issues/53) or a newly filed issue; `peephole` →
[#52](https://github.com/blendsdk/blend65/issues/52) (catalog append); `data/placement` →
[#49](https://github.com/blendsdk/blend65/issues/49); `ceremony` →
[#59](https://github.com/blendsdk/blend65/issues/59); `parity` → no action.

---

## Integration Points

### Within asm-parity

- **RD-01 (instruments)** — consumes `yarn twin:diff` (taxonomy, ratios, JSON output),
  `yarn annotate:cycles` (evidence for divergence analysis), the timing table,
  `measureCycles`/`quiesce` (F7), and `budgets.json` measured ratchets (F4). The manifest and
  twin-file conventions are RD-01's AR #10.
- **RD-04…RD-07 (optimization RDs)** — the scoreboard is their before/after baseline; each
  landing tightens budgets and moves ratios toward 1.00×; the re-sweep after #50–#53 is
  tracked on #56.
- **RD-03 (memory & hardware epic, #49)** — receives the `data/placement` routing dispositions
  (the balloon poke-unrolling is the canonical case).
- **RD-09 (Sweep D re-sweep)** — the routed `structural` inventory is its evidence base.

### Cross-feature (blend65-ri)

- **blend65-ri/RD-12 (test harness)** — the twin tier follows the established local emulator
  tier patterns (`skipIf`, sequential VICE, fixture helpers); no driver changes expected.
- **blend65-ri/RD-09 (ACME emitter)** — untouched; twins are inputs to ACME, not emitter work.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Scoreboard cycle metric | static-only / static + measured where phase-stable | Static ratios for all 14 pairs + measured columns where phase-stable (balloon), from committed data | Honors issue #61's measured-upgrade intent within RD-01's phase-stability physics; CI stays VICE-free | AR #15 |
| Twin verification permanence | permanent VICE tier / one-time audit | Permanent `twins.spec.test.ts` local tier; balloon retrofitted | Twins are test assets and a live regression baseline; rot must fail loudly | AR #16 |
| Scoreboard location + freshness | beside goldens vs `docs/`; CI-checked vs manual | `packages/test-harness/test/golden/SCOREBOARD.md`, CI-checked freshness | "Committed alongside" the twins per the issue; golden-style freshness keeps the number honest | AR #17 |
| Divergence routing | two-layer (mechanical + routing) / rework tool to issue taxonomy | Two-layer: AR #9 mechanical categories in the tool, routing disposition in the audit | The vocabularies answer different questions; AR #9 shipped in RD-01 | AR #18 |
| Surface names | — | `scripts/gen-parity-scoreboard.mjs`, `yarn gen:scoreboard`, `twins.spec.test.ts`, `SCOREBOARD.md` | Matches `gen:matrix` and test-tier conventions | AR #19 |
| Twin file convention | *(inherited)* | `<fixture>.twin.asm` beside goldens; balloon stays in `examples/` | Decided at RD-01 | AR #10 |
| Ratio + mechanical taxonomy | *(inherited)* | generated ÷ twin, two decimals; five mechanical categories | Decided at RD-01 | AR #9 |
| Corpus contents | *(inherited)* | 12 slice goldens + rasterpoll + balloon = 14 pairs, 13 new twins | rasterpoll's twin explicitly deferred to RD-02 by RD-01 | RD-01 Won't-Have |
| Fixture-side observable coverage | exempt rasterpoll+balloon / author sets + fixture-side VICE cases / twin tier runs both sides | Author the sets in shared helpers + new fixture-side VICE cases for rasterpoll and balloon | Today's only observable-untested corpus programs; one-sided equivalence is no equivalence | PF-009 |
| Routing storage & enforcement | manifest `routing` block / separate routing file / hand-maintained scoreboard region | `routing` block per pair in `twins.json`; group = pair × mechanical category; ≥1 disposition per group; generator fails on unrouted groups | One committed carrier with an existing fail-loud loader; stable keys; AC-5 becomes a permanent mechanism | PF-010 |
| Assertion-set boundary | — | Shared sets are memory observables only; implementation probes stay fixture-local | Literal "identical assertions" would force mechanical twin translation | PF-011 |
| Measured-value honesty | ≤ budget (ceiling) / exact equality | Local tiers assert fresh measurement equals the committed value, both sides | A slack ratchet must never publish as a measurement | PF-012 |
| Fixture-source sync | — | Spec test pins each inlined source to `examples/<fixture>/main.blend` | The scoreboard must score the program the twin was verified against | PF-013 |

---

## Security Considerations

- **Data sensitivity**: none — repo-local assembly sources, listings, and emulator state; no
  PII, credentials, or user data.
- **Input validation**: `gen-parity-scoreboard.mjs` canonicalizes input paths and rejects any
  path resolving outside the repository root; malformed manifest/budget input fails loudly
  (file + JSON path named) before any output is written — same posture as RD-01's scripts and
  loaders.
- **Injection risks**: ACME/VICE are spawned via argv arrays only (never shell interpolation);
  no `eval`, no dynamic code from data files. Twins are static assembly sources consumed by
  ACME — they execute only inside the emulator sandbox.
- **Authentication & authorization / secrets**: none added. The freshness gate is a local diff
  in the CI job — no PR comments, no new token permissions, no new secrets.
- **Encryption / rate limiting / infrastructure**: N/A — local dev tooling and CI test steps
  only.
- **Security testing**: spec tests cover path-traversal rejection and malformed-manifest
  failure for the scoreboard generator.

---

## Acceptance Criteria

1. [ ] The 13 twin files exist beside the goldens (`gate.twin.asm`, `slice3a.twin.asm`,
   `slice3b.twin.asm`, `slice4a.twin.asm`, `slice4b.twin.asm`, `slice5a.twin.asm`,
   `slice5b.twin.asm`, `slice6.twin.asm`, `slice7.twin.asm`, `slice7b.twin.asm`,
   `slice8.twin.asm`, `slice8b.twin.asm`, `rasterpoll.twin.asm`); each assembles via ACME
   with zero errors; `yarn twin:diff` lists zero unpaired programs; `twins.json` registers
   all 14 pairs. A sync spec test asserts each fixture's inlined source equals its
   `examples/<fixture>/main.blend` byte-for-byte.
2. [ ] `twins.spec.test.ts` runs under `skipIf(!hasVice() || !hasAcme())` and, for each of the
   14 pairs, executes the twin binary on VICE and passes the identical observable assertions
   (same addresses, same expected bytes — memory observables only, implementation probes
   excluded) as the fixture's spec test; the assertion functions are imported from the same
   module in both suites (no duplicated assertion bodies). New fixture-side VICE spec cases
   exist for `rasterpoll` (asserting at its poll landmark) and `balloon`, consuming the same
   shared assertion modules as their twin cases. Negative case: flipping one expected
   observable byte in a twin makes exactly that twin's case fail, naming the twin.
3. [ ] `packages/test-harness/test/golden/SCOREBOARD.md` is committed and contains, for every
   pair, bytes (generated, twin, ratio to two decimals) and static straight-line cycles
   (generated, twin, ratio to two decimals) plus a corpus totals row; the balloon row
   additionally shows measured frame-update cycles (generated from `budgets.json`, twin from
   the manifest reference, ratio to two decimals). Running `yarn gen:scoreboard` twice
   produces byte-identical output.
4. [ ] A CI step regenerates the scoreboard and fails when the committed file differs;
   locally, editing any golden (or budget/manifest value) without regenerating makes the
   freshness check fail, and `yarn gen:scoreboard` clears it.
5. [ ] Every divergence group (pair × mechanical category) carries at least one routing
   disposition — `structural`, `peephole`, `data/placement`, `ceremony`, `parity` — in the
   manifest's committed routing block, rendered with issue links in the scoreboard; peephole
   findings are appended to #52's catalog, `data/placement` items reference #49, `ceremony`
   items reference #59, `structural` items reference #50/#51/#53 or a newly filed issue.
   Enforcement is mechanical: the generator exits non-zero naming any unrouted group
   (demonstrated by a spec test), so the CI freshness step keeps the invariant permanent.
6. [ ] The balloon twin's frame-update window is labeled; its quiesced measured cycle count is
   identical across two fresh VICE processes and recorded as the manifest's twin measured
   reference; the scoreboard's measured ratio equals `budgets.json`'s balloon frameUpdate
   measured value divided by that reference, to two decimals. The twin tier asserts a fresh
   measurement equals the reference exactly, and the budget tier's balloon measured case
   asserts equality against `budgets.json`'s measured value (not merely ≤) — an untightened
   improvement on either side fails locally.
7. [ ] Source-forced divergences (fixture source un-idiomatic due to a known language gap) are
   annotated as such in the scoreboard and routed `data/placement` → #49, not counted as
   codegen defects (the balloon unrolled-pokes case demonstrates this).
8. [ ] Security requirements verified: spec tests demonstrate the scoreboard generator rejects
   a path outside the repo root and fails loudly on malformed manifest input; no shell
   interpolation appears in any new spawn call.
9. [ ] The post-optimization re-sweep is scheduled: umbrella #56 carries a checklist item to
   re-run the Sweep E audit after #50–#53 land.
10. [ ] The full verify command passes (`yarn install --frozen-lockfile && yarn turbo run build
    && yarn turbo run typecheck && yarn turbo run lint && yarn test`) including the local
    emulator tier with the new twin suite, and the area report (examined / found / deferred +
    why) is posted on issue #61 when the RD closes.
