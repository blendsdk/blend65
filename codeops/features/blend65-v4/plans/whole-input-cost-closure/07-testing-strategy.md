# Testing strategy

> **Parent**: [Index](00-index.md)
> **Authority**: AR-P1–AR-P4; specification first, independent behavior and cost oracles

## Verification and coverage

AR-P2 imports the user's existing command approval. During tasks use directed
Vitest/ACME and existing VICE helpers. The single complete phase checkpoint runs
`yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`, `yarn test` and
targeted touched-code formatting. Linux is the compiler host; Windows/macOS and
silicon QA remain final-release owners. VICE cases run sequentially under one
root verification owner, never from parallel reviewers.

Cover every admitted positive rule, smallest counterexample, invalidation,
fallback, composition and publication failure. No invented percentage, source
workaround, optimized-versus-none-only oracle or new runner. Full source/runtime
E2E uses the existing public compiler, ACME and VICE debugger route. Native chip
and external unbounded guarantees are explicitly N/A for this emulator tier.

## 🚨 Specification Test Cases

Expectations derive from the frozen language/CPU/platform contracts and approved
component rules, not current compiler implementation. Each behavior case has a
separate selected assembly/resource check. GREEN baseline negatives are retained
and justified in RED evidence; no expectation is weakened to force RED.

| Case | Input → expected behavior and independent output expectation | Source |
| --- | --- | --- |
| ST-1 | Same ordinary byte-return project: explicit none/size API and size CLI build → same defined result; artifact mode matches request. None has no optional decisions; size uses only qualified decisions. | AR-P4; 03-03 public mode; R8.2/R8.11 |
| ST-2 | Unknown/injection-like mode string; check with a build flag → existing option/CLI rejection, no tool execution or new generation. Default helper callers still request none. | AR-P4 exact exception; existing host contracts |
| ST-3 | Two clean size builds with identical source/tool identities → identical portable semantic/artifact evidence and stable selections; host/UUID fields retain frozen comparison rules. | 03-03 evidence; R8.10/R8.51; RD-03 build v1 |
| ST-4 | Fixed two-byte Pair forwarded through two ordinary const parameters → correct original field bytes, no copy/MMIO; qualified symbolic absolute access and no unused pointer setup. Distinct dynamic arguments and scalar effects retain left-to-right order. | 03-01 whole objects; FN-10; R8.29 |
| ST-5 | Same function called with two different objects, an address-taken entry, unsized/member borrow or opaque route → correct generic ABI, no false unique-root selection. | 03-01 whole objects; 03-02 fixed-object-address |
| ST-6 | Indexed field crossing a page or source raw word access wrapping FFFF → exact complete access/volatile count; unsafe dummy/MMIO/bank footprint forbids address narrowing. | 03-03 observers; MOS bus rules; R8.32 |
| ST-7 | Unique caller-owned returned Pair with fields 7/9 and disjoint observers → 7/9 directly in destination, no staging copy/home. A handler/alias that can see early writes keeps original publication semantics. | FN-4; 03-01 effects; direct-fixed-result |
| ST-8 | Nested result calls, overlap, failed/early return and alternate interrupt domain → exact source values/order and disjoint live destinations or generic fallback; complete storage/stack charged. | FN-10; 03-02 recipes; R8.38–R8.40 |
| ST-9 | All byte x/y for `x != y && (x & y) != 0`: examples 3/1→true, 1/1→false, 0/1→false → exact truth and short circuit. Qualified comparison keeps x through CMP/branch/AND without temp store/reload. | Ch04; byte-window-reuse; MOS flags |
| ST-10 | Intervening call/load/PLP or source-visible raw observer between byte producer/use → correct captured value/flags; do not reuse invalid A/Z or erase observed stores. Incoming C/D and high-bit byte values included. | 03-02 byte-window-reuse; R8.27 |
| ST-11 | Ordinary helper returns false/true on all exits → caller gets canonical 0/1 and only proved exits permit direct returned-Z branch. One exit restoring unrelated P requires caller retest. | Boolean exit rule; Ch06 scalar ABI |
| ST-12 | Stable byte g across fixed loops: reuse ~g; g=00/FF→FF/00. A body write, volatile producer, unknown alias/handler mutation or effectful zero-trip path preserves original reads/effects and forbids invariant reuse. | Ch02 byte wrap; invariant-byte-complement |
| ST-13 | Word counter0..7 accumulating its ordinals → sum28 and eight iterations; nested other=column+1 visits28 ordered pairs. Qualified byte/X/Y route preserves counter type, exits and exact observations. | Ch05 for semantics; fixed-word-induction |
| ST-14 | Word counter crosses255, address escapes, break at3, continue at3 or visible word live-out8 → exact original behavior; reconstruct wider values or retain generic word home, never byte-wrap early. | 03-01 induction; R8.21 |
| ST-15 | Exact-eight flat body with ordered volatile stores/reads → eight events in original order, same values and checks. Body return/unknown bound, register collision or timing contract forbids unsafe expansion. | fixed-word-induction; R8.32/R8.35 |
| ST-16 | Caller grounds defined after helper may share proved disjoint homes; live values/links may not. Dead whole/member writes still conflict with surviving contents: a=0, observe a, b=7, a=9, observe b →7. An unused f(7,9) second parameter may not overwrite returned first parameter7. Deferred a += (b=7), a initially1 →a8/b7; last-use call arguments survive all earlier marshal writes. Check selected accesses/homes and count actual physical resources once. | PF-001; 03-01 access-complete lives; SFA overlay/route gates |
| ST-17 | Eligible compact startup with varied incoming P/SP/DDR/port/DDRA and actually borrowed bytes → exact normal restoration; original-I binary main entry, no CIA2 PRA/ICR access; heldP is one charged platform stack byte. | 03-03 startup; AR-P4 |
| ST-18 | Seven contiguous borrowed BASIC bytes and a discontiguous/unsafe variant → all bytes restored. Indexed loop only with safe full/dummy footprint; fallback keeps unrolled/full saves. No assumed four-byte-only preservation. | 03-03 startup; MOS bus rules |
| ST-19 | Stack-page raw observer, display dependence, opaque initializer, unsupported source bank write or nested stack-clobber → conservative safe startup; no new source restriction or false restoration certificate. | 03-03 startup/final observers |
| ST-20 | NMI during each reachable publication/removal/restore boundary → callback-only correct variant, status-before-A, exact PA-before-marker sequence, one immutable page-safe prior-link chain and source quality. External aggregate stays Unknown. | Frozen Ch06/15; 03-03 route closure |
| ST-21 | Recipe/home removed or moved while raw/alias observer can see old/reference storage → candidate rejected; after final disjoint reference/candidate proof, unrelated C100/C110 reads/writes remain unchanged. | 03-03 observer order; R8.17 |
| ST-22 | Full startup alternatives whose local byte saving is absorbed by callback padding → compare actual complete B/R/T, not local size. Same B/R needs comparable path-cycle choice; decisive Unknown is not zero or a stable-ID tie. | R8.4–R8.10; AR-P4 complete ledger |
| ST-23 | A later admitted whole recipe beats the first → considered before success; reverse traversal selects the same B/R/T result. Repeated32/64 ordinary eligible sites do not multiply recipe choices: at most36 recipes +1 reference attempt. A no-loop/full-only two-bundle case has exactly2 construction recipes and at most3 outer attempts including reference (reuse may reduce actual closures). Nested/sibling register collisions keep original nests; flat policies retain the dynamic raw saved-load loop. Count internal closure iterations separately. | PF-003; R8.51; 03-03 fixed frontier |
| ST-24 | Late spill/retest/long branch or failed certificate/cost/ACME consistency → include all costs and re-close or reject before publication; keep last-good generation and publish no partial attempt on internal failure. | R8.39/R8.52; frozen publication contract |
| ST-25 | Existing full caller on all four cooperative profiles under explicit size → unchanged original 963 payload/984 general/14 ZP/998 combined/10 stack limits and every old accounting assertion. | AR-P4 exact exception; original full/acquisition output tests |
| ST-26 | Existing saved caller on all four profiles under explicit size → unchanged 725 payload/745 general/14 ZP/759 combined/5 stack limits, saved input bytes preserved and all old accounting assertions. | AR-P4 exact exception; original saved output test |
| ST-27 | All 76 original input behavior cases retained in none, plus size-mode independent released/key/ghost/grounded/invalid/joystick/coexistence/return cases → original defined answers, effects, no fresh saved-query MMIO, preserved bytes/state; size saved-simple stays within original100million cycles. | AR-P1/P2; keyboard ST-11–ST-24; frozen model |
| ST-28 | Register/elided word/object recipes at final PCs → correct version-1 word width/context/ranges and rematerialization or honest unavailable status. No stale memory home, unknown field, dangling index or new schema tag. | RD-03 debug v1; R8.58; 03-02 recipes |
| ST-29 | Checked ordinary72-function Pair-return chain with one final destination →none retains its existing resource failure/no generation; size independently returns7/9 and proves an admitted fit. Costs reference the exact resource-rejected canonical candidate without a vector; selected candidate is feasible. A source error or incomplete mandatory operation is never rescued. Missing reference intervals plus a real raw/borrow observer keep the rewrite rejected unless source/envelope proof closes. | PF-002; FN-4; R8.11; 03-03 reference outcome |
| ST-30 | v1 records with feasible baseline remain unchanged; rejected baseline +feasible selected round-trips using existing tags. Missing/duplicate IDs, rejected selected, fabricated rejected vector, unknown fields, wrong totals, nonexistent path/resource component or unequal stable-ID tie still fail. Older reader rejection is not forward compatibility; no-generation/last-good publication stays intact. | Approved RD-03 PF-002 paragraph; 03-03 evidence/compatibility |

## Files and execution packets

| New specification file (`test/rd08/` unless qualified) | Cases |
| --- | --- |
| `input-size-mode.spec.test.ts` | ST-1–ST-3 |
| `input-object-facts.spec.test.ts` | ST-4–ST-8 ordinary object/alias/return facets, ST-21; hardware-edge facets additionally in runtime file |
| `input-byte-selection.spec.test.ts` | ST-9–ST-12 ordinary-source facets; handler mutation additionally in runtime; invalid selected-exit certificate additionally in logic tier |
| `input-loop-storage.spec.test.ts` | ST-13–ST-16, ST-28 |
| `input-startup-selection.spec.test.ts` | ST-17–ST-20 |
| `packages/compiler/src/services/input-size-frontier.spec.test.ts` | ST-22–ST-24, ST-29–ST-30 |
| `input-size-runtime.spec.test.ts` | ST-27; ST-6 wrapped/dummy-bus, ST-8 alternate-domain and ST-12 handler-mutation observations; ST-16 held-link coverage |

ST-25/ST-26 reuse the exact existing three whole-output files amended only by
AR-P4. The helper exception is separate and defaults to none. Runtime tests reuse
`test/rd05/profile-fixture.ts`, `source-library-fixture.ts` and `test/m1` monitor
helpers; no new harness or generated fixture registry. Freeze independently
derived raw source/expected values and expert sequences before implementation.

Execution grouping clarification, 2026-10-12: the wrapped-bus and interrupt-domain
observations use the already planned runtime file so the ordinary object oracle
stays focused. This changes only case placement, not the seven-file boundary,
37 tasks, original expectations, verification tier or implementation ordering.
Those facets are mandatory in 1.1.7/1.1.9; they are not deferred or counted covered
by the first object file. Root supplies the exact platform/monitor protocol
before its independent author writes them; no guessed device state is accepted.

Source/machine clarification: a helper containing `asm_plp()` can legally reload
canonical A afterwards and thereby re-establish returned Z. ST-11's caller-retest
negative applies to actual unproved selected exits, not the source keyword alone;
task 1.3.2 independently rejects invalid exit certificates. Handler mutation and
held-link interleavings use the existing runtime file. Timing-sensitive machine
certificate rejection remains in 1.3.2; no nonexistent source timing annotation
or identical optional-loop overhead is assumed. All named facets remain mandatory.

Execution placement correction: the frontier/evidence file resides inside the
compiler package so its exact version-1 encoder/reader checks use ordinary
intra-package imports. The existing reader is not a public package export;
neither a new export nor a cross-package `src`/`dist` reach-through is added.
There are still seven new specification files and 37 tasks, with unchanged
cases and old-test exceptions. Directed verification for this one file uses
the existing compiler workspace Vitest configuration; no new runner is needed.

Spec-author packets contain these ST rows, frozen excerpts and planned interface
signatures only. FORBIDDEN: all implementation logic under compiler/machine/
semantic/storage/layout/services/artifacts, and CLI args/render; qualification/grader maps.
Allow the existing helper signatures, exact four exception files and explicitly
named public source/expert input fixtures as oracle inputs, not implementation.

Logic-tier `.impl.test.ts` files follow implementation beside the focused owners.
Exercise finite facts, joins/invalidations, selected exits, stale identity rejection,
candidate permutations, resource discovery, cancellation and observational scaling.
Public behavior/source/assembly tests cannot be rewritten to match these internals.

## Completion

Record each requested endpoint separately: source legality, selected instructions,
ACME bytes, final SFA/layout, runtime, timing and hardware. Document first RED and
GREEN identities, no-generation failures and exact old-oracle diff; do not
re-clear historical Unknowns. All new and original input files must be GREEN,
then complete the full phase and independent reviews. Partial implementation
tasks may be locally verified but no RED composite checkpoint is committed.
