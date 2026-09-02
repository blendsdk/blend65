# Testing Strategy: RD-08 Complete C64 Rule Coverage

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
|---|---|
| Generator/oracle/terminal joins | 90% branch coverage |
| Publication, migration and smoke selectors | 90% branch coverage |
| Route/CLI glue | 80% branch coverage |

Tests use real immutable data and public routes. Compiler, filesystem, ACME and VICE are treated as
true external boundaries only where existing adapters already do so. Normal test selection obeys
AR-7; explicit exhaustive/local VICE acceptance is separate.

## 🚨 Specification Test Cases

> Expectations below come from RD-08, its frozen citations and AR-1–AR-8. Implementation must not
> weaken them. In-code traceability comments restate behavior in plain language and never cite
> CodeOps paths or IDs.

### Vertical structured programs

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-01 | Closed IR for `let values: byte[4] = [1,2,3,4]; return values[2];` | Validation succeeds; canonical source contains that declaration and index; independent return value is byte `3` | RD-08 AC3; 03-01 §Array semantics; AR-2 |
| ST-02 | Same fixed array with constant index `4` | Case is an invalid neighbor with family `array-index-constant-out-of-range`; compiler execution must reject or record a diagnostic mismatch, never pass silently | RD-08 AC3; 03-01 §Array semantics |
| ST-03 | Fixed array at base `$FFF0`, computed word index `$20`, one-byte read | IR remains valid; independent effective address is `$0010` after 16-bit wrapping | RD-08 AC3; 03-01 §Array semantics |
| ST-04 | Declared `byte[0]` versus legal `byte[4] = []` declaration context | Extent zero returns E10111 invalid-neighbor evidence; legal empty initializer retains extent 4 | RD-08 AC3; 03-01 §Array semantics |
| ST-05 | Functions `add(a,b)` and `nested(v) = add(add(v,1),2)`, invoke `nested(4)` | Canonical source contains two nested calls; independent return is byte `7` | RD-08 AC3/5; 03-01 §Call semantics |
| ST-06 | Callee assigns `a = 9` after caller passes local `a = 4` | Callee returns `9`; caller's local remains `4` | RD-08 AC3/5; first-vertical scalar-copy rules |
| ST-07 | Two argument expressions write observable bytes before returning | Effects are recorded left-to-right; a reversed-order oracle mutation is rejected | RD-08 AC5; 03-01 §Call semantics |
| ST-08 | `if (flag) { poke($C000,1); } else { poke($C000,2); }` with true and false cases | True case ends with `$C000=1`; false case ends with `$C000=2` | RD-08 AC3/5; 03-01 §Branch semantics |
| ST-09 | Nested branch whose inner false arm returns `3` | Independent result is `3`; branch-selection mutation produces a mismatch | RD-08 AC3/5; 03-01 §Branch semantics |
| ST-10 | `while(false)` increments a byte | Body executes zero times; result remains `0` | RD-08 AC3; first-vertical while rule |
| ST-11 | `do { n=n+1; } while(false)` | Body executes once; result is `1` | RD-08 AC3; first-vertical do-while rule |
| ST-12 | `for i: byte = 0 until 3` and `for j: byte = 0 to 2` each increment a byte | Both execute three iterations; result is `6` | RD-08 AC3/5; first-vertical bounded-loop rules |
| ST-13 | Valid loop consumes exactly `maxLoopWork`; next case requires one more iteration | Exact-bound case succeeds; first over-bound event returns loop-work budget evidence with no partial pass | RD-08 AC3; 03-01 §Branch and loop semantics |
| ST-14 | Combined array/call/branch/loop program from 00-index with four input values | Independent final `$C000` byte is `12`; existing public routes return either matching passing evidence or one exact typed compiler/emit/assembly failure with all identities retained | RD-08 first-phase Must Have; AR-1, AR-2 |
| ST-15 | The 16 IDs in 03-01, shuffled, duplicated, unknown, or with one omitted | Only the exact lexical unique list succeeds; each mutation fails at its exact member path | RD-08 AC8; 03-01 §Exact population; AR-3 |
| ST-33 | Unroll a three-iteration pure loop, then try the same transform where volatile reads/writes have unproven ordering | Pure original and unrolled observations are identical; volatile case is proof-incomplete, and forced application is rejected by the mutation assertion | RD-08 AC5; 03-01 §Branch and loop semantics |
| ST-35 | C64 fixed byte extent 65,535 and word extent 32,767, followed by byte 65,536 and word 32,768 | Exact maxima validate; each next extent returns the bounded generation/resource result before compiler invocation | RD-08 AC3; 03-01 §Array semantics |
| ST-36 | Seed a production readiness import from `@blend65/compiler`, a production compiler import from `@blend65/readiness`, and oracle expectations copied from compiler output, unoptimized output and a golden | Each import is detected at its owning boundary; all three circular expectation sources fail oracle acceptance | RD-08 AC6; 03-01 §Integration Points; AR-8 |

### Complete families and dispositions

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-16 | Selected inventory and v2 authority with exactly the same 2,112 IDs | Join succeeds with 2,112 terminal rows; removing, duplicating or adding one ID fails | RD-08 AC1/2; 03-02 §Family expansion |
| ST-17 | One reviewed family with two members and one construction/boundary/spelling set | Both members keep distinct rule results while sharing the family handler; deleting either member fails completeness | RD-08 AC4; 03-02 §Family expansion |
| ST-18 | Mandatory semantic rule with source route and passing digest; same row missing route/result or carrying cost role | First joins as passing; every malformed combination joins as blocking | RD-08 AC2; 03-02 §Proposed data model |
| ST-19 | Mandatory non-source rule with accepted named handler result; same row with classification only | Accepted handler joins decisively; classification-only row blocks | RD-08 AC2; 03-02 §Non-source evidence |
| ST-20 | Reviewed correctness obligation, reviewed byte/cycle-only obligation, and unreviewed obligation | First gates semantic readiness; second appears only in secondary quality; third blocks closure | RD-08 AC13; 03-02 §Quality-obligation review |
| ST-21 | Allowlisted embed fixture digest for bytes `[1,2,3]`; traversal, absolute, symlink, missing and 65,537-byte variants | Valid ID materializes exactly three bytes inside the existing workspace; every unsafe/over-limit variant rejects before read/compile | RD-08 independent-generator technical requirement; 03-02 §Embed fixture mapping |
| ST-34 | `function first(data: const byte[], i: byte): byte { return data[i]; }` invoked with `[1,2,3,4]` and `i=2`; same unsized form used for a local | Parameter form renders and independently returns byte `3`; unsized local is rejected before compiler invocation | RD-08 AC3; 03-01 §Array semantics |

### Publication and declared execution

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-22 | Resolve every existing v1 publication before and after v2 support | Exact v1 bytes and digest resolve identically; no migration rewrites stored v1 | RD-08 AC9/14; 03-03 §Publication evolution |
| ST-23 | Deterministic migration of eligible v1 facts twice; historical implementation missing | Both migrations produce identical v2 bytes; missing implementation makes replay unavailable without current substitution | RD-08 AC9/14; 03-03 §Publication evolution |
| ST-24 | Change one family/case/handler/implementation revision after accepted review | Selection rejects the stale review and leaves prior selected release current | RD-08 AC9; 03-03 §Publication evolution |
| ST-25 | Inject failure before/after release promotion pointer operation | Prior or complete new release is selected; partial/mixed parent bytes never resolve | RD-08 AC9; 03-03 §Publication evolution |
| ST-26 | Select v2 parent before compatible child, then select its exact child | Intermediate resolution is explicitly unavailable; final pair resolves; neither historical v1 release changes | RD-08 AC14; 03-03 §Publication evolution |
| ST-27 | Modeled rule declaring frontend/compiler/emit/ACME/VICE obligations with ACME or VICE absent | Available routes return typed evidence; absent tool route is unavailable/blocking, never skipped/passing | RD-08 AC7; 03-03 §Public execution obligations |
| ST-37 | Consumer fixture reads one first-vertical case/expectation/execution envelope | It receives byte-identical source/expectation plus exact rule, case, parent and execution digests; it receives no cost result and imports no readiness code into production optimizer/compiler modules | RD-08 AC8; 03-03 §First accepted publication |

### Smoke, ownership and closeout

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-28 | Smoke list with 4 cases in each of 4 families (16 total), then add a fifth to one family | First list validates; second rejects at the fifth family entry | RD-08 AC10; 03-04 §Bounded smoke selection; AR-7 |
| ST-29 | Smoke list with 16 cases across families, then add case 17 | First validates; second rejects at entry 17 | RD-08 AC10; 03-04 §Bounded smoke selection; AR-7 |
| ST-30 | Inspect root readiness smoke command graph | It reaches only explicit smoke configs/cases and cannot reach exhaustive or production readiness VICE commands | RD-08 AC10; 03-04 §Bounded smoke selection |
| ST-31 | Seed valid rejection, invalid acceptance, wrong diagnostic, ICE, semantic mismatch, assembler failure, VICE failure, timeout and cost-only divergence | Each retains distinct typed result/identity/owner; only cost divergence enters secondary quality | RD-08 AC11; 03-04 §Result summaries and ownership |
| ST-32 | Closeout fixture with one expired RD-08 deferral lacking an owner, then add an explicit replacement owner | First closeout blocks; second succeeds only when every other RD acceptance criterion is satisfied | RD-08 Deferral-Expiry Gate; 03-04 §Closeout |

## Test Categories

### Specification Tests

| Test File | ST Cases Covered | Component |
|---|---|---|
| `packages/readiness/src/structured-generated-programs.spec.test.ts`, `test/readiness-boundary.spec.test.ts` | ST-01–ST-13, ST-33, ST-35, ST-36 | IR/render/oracle/relation/boundary |
| `packages/readiness-execution/src/structured-generated-programs.spec.test.ts` | ST-14 | Existing public routes |
| `packages/readiness/src/first-vertical-publication.spec.test.ts` | ST-15 | Exact initial list |
| `packages/readiness/src/rule-family-dispositions.spec.test.ts` | ST-16–ST-21, ST-34 | Denominator authority |
| `packages/readiness/src/rule-family-publication.spec.test.ts` | ST-22–ST-26, ST-37 | Evolution/publication/consumer |
| `packages/readiness-execution/src/complete-rule-routes.spec.test.ts` | ST-27 | Declared routes |
| `packages/readiness/src/readiness-smoke-selection.spec.test.ts` | ST-28–ST-30 | Fast gate |
| `packages/readiness/src/terminal-evidence-routing.spec.test.ts` | ST-31–ST-32 | Ownership/closeout |

### Implementation Tests

| Test File | Description | Priority |
|---|---|---|
| `structured-ir-validation.impl.test.ts` | Hostile shapes, depths, cycles, types and budget edges | High |
| `structured-source-renderer.impl.test.ts` | Deterministic formatting and source-byte ceilings | High |
| `structured-oracle-evaluator.impl.test.ts` | Frames, wrap, effect order and proof-incomplete paths | High |
| `rule-family-validator.impl.test.ts` | Missing/duplicate/member/route/result combinations | High |
| `rule-family-publication.impl.test.ts` | Version dispatch and failure injection | High |
| `readiness-smoke-selection.impl.test.ts` | Manifest hostile input and deterministic identity | High |

### Integration and End-to-End

| Scenario | Steps | Expected Result |
|---|---|---|
| First vertical | Generate → render → oracle → public compiler/emit/ACME route | Exact independent observation or typed failing evidence |
| Complete non-emulator | Select full population → run by family/tier | 2,112 terminal rows with no hidden/unmodeled result |
| Local emulator | Run bounded declared VICE cases with local VICE/ACME | Every VICE obligation receives decisive typed evidence |
| Historical replay | Resolve v1 and v2 by digest | Exact historical implementation or explicit unavailable |

## Test Data

- Existing frozen inventory and selected v1 publications.
- Reviewed v2 family/disposition data authored incrementally by category.
- Fixed content-addressed embed fixture bytes; no caller-provided paths.
- Deterministic generated-case seeds/identities; bulk source remains reproducible and ephemeral.

## Verification Checklist

- [ ] ST-01–ST-37 implemented before their corresponding production changes.
- [ ] Each phase records a genuine red result or documents pre-existing behavior precisely.
- [ ] Specification expectations remain unchanged during implementation.
- [ ] Targeted tests, Prettier on touched files, `spec/` cleanliness and AR-7 full verify pass.
- [ ] Explicit complete non-emulator and local VICE acceptance run only in their named phases.
