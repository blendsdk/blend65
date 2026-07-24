# Task T-01: Manual remediation of rejected inventory rules

> **Type**: Task (lightweight) · **Feature**: compiler-readiness · **CodeOps Artifact Schema**: 1
> **Progress**: 6/6 tasks (100%) — ✅ complete 2026-07-24
> **Created**: 2026-07-24
> **Mode**: auto-design · auto-commit

## Objective

Correct only the rule records rejected by the independent RD-01 inventory review, then produce
review evidence without rerunning or changing the broad inventory generator.

## Scope

**In:** 24 explicitly named records: four Chapter 03 ROM-cost evidence corrections; six Chapter
05 runtime-semantics evidence corrections; two Chapter 06 rejection-polarity corrections; one
Chapter 07 allocation-cost evidence correction; ten Chapter 08 unsupported-platform polarity
corrections; and one Chapter 10 wildcard-import polarity correction. Focused regression tests,
review evidence, execution-plan reconciliation, and roadmap/traceability updates are included.

**Out:** adding, deleting, splitting, merging, or renaming rules; changing the identity ledger;
rerunning the broad inventory generator; modifying any non-allowlisted rule; reviewing accepted
rules again; changing `spec/`; or implementing later compiler-readiness RDs.

The earlier review report called the Chapter 08 group “eleven,” but a direct query of the current
authority finds ten positive records whose requirement text contains an unsupported-platform
cross. The ten record IDs are the controlling scope.

## Exact allowlist

### Evidence obligations

- `rule.ch03.5-2-startup-cost.struct-initializer-n-bytes.rom-cost.4n-bytes`
- `rule.ch03.5-2-startup-cost.fill-array-n-bytes.rom-cost.7-bytes-loop`
- `rule.ch03.5-2-startup-cost.explicit-array-n-values.rom-cost.4n-bytes`
- `rule.ch03.5-2-startup-cost.uninitialized-variable.rom-cost.0-bytes`
- `rule.ch05.5-2-rules.condition-evaluated-before-each-iteration-false`
- `rule.ch05.6-2-rules.body-executes-least-once-condition-evaluated`
- `rule.ch05.7-2-direction-bounds.until.meaning.loop-visits-start-end`
- `rule.ch05.7-2-direction-bounds.requirement.meaning.loop-visits-start-end`
- `rule.ch05.7-2-direction-bounds.downto.meaning.loop-visits-start-end`
- `rule.ch05.7-7-6502-code-generation.comparing-against-256-impossible-8-bits`
- `rule.ch07.6-cost-summary.zp-per-active-struct.cost.2-bytes`

### Rejection polarity

- `rule.ch06.fn-4.struct-type.allowed.root`
- `rule.ch06.fn-4.array-type.allowed.root`
- `rule.ch08.str-3.petscii.atari-800xl.root`
- `rule.ch08.str-3.petscii.atari-7800.root`
- `rule.ch08.str-3.screen-codes.atari-800xl.root`
- `rule.ch08.str-3.screen-codes.atari-7800.root`
- `rule.ch08.str-3.atascii.c64.root`
- `rule.ch08.str-3.atascii.cx16.root`
- `rule.ch08.str-3.atascii.atari-7800.root`
- `rule.ch08.str-3.internal-codes.c64.root`
- `rule.ch08.str-3.internal-codes.cx16.root`
- `rule.ch08.str-3.internal-codes.atari-7800.root`
- `rule.ch10.4-3-import-rules.bit-you-import-multiply.explicit-bit.value`

## Tasks

- [x] T-01.1 Add focused immutable specification assertions for the exact allowlist and confirm
      they fail against the rejected records. ✅ 2026-07-24 — focused test failed on the first
      frontend-only Chapter 03 record.
- [x] T-01.2 Apply a compare-and-set mutation that refuses unexpected source values, changes only
      the 24 named records, and proves every other rule and top-level inventory field unchanged.
      ✅ 2026-07-24 — 24 changed, 2,088 rules structurally unchanged.
- [x] T-01.3 Run the focused specification and implementation suites; confirm the identity ledger
      and rule-ID set are unchanged. ✅ 2026-07-24 — focused specification green; no rule-ID or
      identity-ledger mutation performed.
- [x] T-01.4 Obtain independent correctness and semantic reviews restricted to the 24 changed
      records and the focused assertions; resolve at most one re-review cycle. ✅ 2026-07-24 —
      semantic audit accepted; correctness review's assertion-coverage finding resolved and
      accepted on the one permitted re-review.
- [x] T-01.5 Generate review-digest evidence from the prior whole-inventory reviews plus this
      focused accepted remediation; run readiness coverage and the full repository verification.
      ✅ 2026-07-24 — 20 current accepted review records; 95.23% branch coverage; full verify exit 0.
- [x] T-01.6 Reconcile the parent RD-01 execution plan, traceability, and roadmaps; commit and push
      the verified task with no `spec/` diff. ✅ 2026-07-24

**Verify**:
`yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`
