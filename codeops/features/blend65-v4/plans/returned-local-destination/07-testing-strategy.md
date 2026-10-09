# Testing: proved returned-local destination

> **Parent**: [Index](00-index.md)
> **Authority**: [AR-1](00-ambiguity-register.md), [A-1–A-6](01-requirements.md#plan-local-acceptance)

## Independent oracles

Use the existing public `checkProject`/`buildProject`, artifact readers and
`test/m1` VICE monitor/runtime. New files are ordinary tests, not a new harness.
The specification author receives the following cases, frozen normative excerpts
and public/helper signatures only. Compiler implementation, old test assertions,
private qualification answers and the discovery capture script are forbidden
authoring inputs. Do not weaken any existing specification test.

Behavior expectations come from source values, alias/effect rules and selected
CPU/platform semantics, not comparison with another compiler mode. Independent
output expectations prove destination reuse and its complete costs. Differential
runs are supporting evidence only. Baseline byte measurements below are the
approved upstream artifact evidence, not an imagined optimized result.

## 🚨 Specification Test Cases

### Values, effects and lifetime

| ID    | Concrete input / scenario                                                                                                                                                                                                                                                                                                                           | Expected result                                                                                                                                                                                                                                                                                                                                      | Source                                                      |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| ST-1  | `Sample` contains `values:byte[8]`, `first`, `second`, `quality`; initialize `[1,2,3,4,5,6,7,8],9,10,2`, assign `values[0]=17`, return the local into a fresh declaration.                                                                                                                                                                          | Complete result bytes `[17,2,3,4,5,6,7,8,9,10,2]`; public check/build succeeds.                                                                                                                                                                                                                                                                      | A-1/A-2; FN-4/FN-5                                          |
| ST-2  | Same local is fully initialized before a branch; scalar parameter zero returns early, nonzero writes element 7 to 23 before returning. Call with 0 and 1 into separate fresh locals.                                                                                                                                                                | Early result has element 7 equal to 8; other result has 23; all other bytes equal ST-1's initial literal, and neither result is overwritten by the other call.                                                                                                                                                                                       | A-2; whole-function eligibility §1–2                        |
| ST-3  | Exact upstream ordinary `sample` witness: eleven-byte zero/quality-2 literal, `values[0]=peek($D020)`, fresh `received`, then `poke($D021, received.values[0])`. Trace at the routine boundary with a controlled initial color.                                                                                                                     | One source `$D020` read, then one `$D021` write carrying that observed byte; all other result bytes zero except quality 2. No duplicated/speculated read. Count startup/restore separately.                                                                                                                                                          | A-2; frozen volatile/effect contract                        |
| ST-4  | `make(source:const Pair)` initializes `{x:1,y:2}`, sets `r.y=source.x`, returns `r`; caller starts `v={x:7,y:9}` and performs `v=make(v)`.                                                                                                                                                                                                          | `v={x:1,y:7}`, not `{x:1,y:1}`; compilation remains legal.                                                                                                                                                                                                                                                                                           | A-2/A-3; FN-4/FN-5 alias preservation                       |
| ST-5  | Same `make` has both `let fresh:Pair=make(v)` and `v=make(v)`, with initial `v.x=7`.                                                                                                                                                                                                                                                                | Both captured results have y=7; one unproved caller leaves the entire callee on its existing separate-local/copy path. No new call-specific entry variant.                                                                                                                                                                                           | A-3; whole-function eligibility §5                          |
| ST-6  | Fully initialized returned `Pair` branches on `lo(&r)==0`, changing y to 99 only on that branch; the address is not published or returned.                                                                                                                                                                                                          | Legal source remains on the separate-local path. Returned y matches the branch computed from the actual local home, not the caller object's address.                                                                                                                                                                                                 | A-2/A-3; whole-function eligibility §3                      |
| ST-7  | A legal `byte[2]` local uses partial initializer `[7]` and is returned into a fresh declaration.                                                                                                                                                                                                                                                    | Public frontend analysis accepts it with W10140/W10190 and preserves indeterminate remainder semantics. T-14 must not introduce a new source restriction. Its unchanged backend currently fails before runtime; that separate defect and the pending independent byte-0-equals-7 runtime expectation belong to T-15. No value is assigned to byte 1. | A-3; frozen VAR-2 and partial-array rules; T-15             |
| ST-8  | Fully initialized eight-byte local rows; loop writes row `column & 7` for columns 0 through 7, then returns the same local.                                                                                                                                                                                                                         | Final rows `[0,1,2,3,4,5,6,7]`; complete index footprints are eligible without a general range solver.                                                                                                                                                                                                                                               | A-1/A-2; whole-function eligibility §4                      |
| ST-9  | Eight-byte local rows are written at runtime index 8 with safety off; stop before the write and place a sentinel at the original local base+8.                                                                                                                                                                                                      | Existing fallback remains. The unchecked write targets `(original local base+8) mod 65536`, not caller base+8; no new bounds error or assumed in-range proof. Do not assert unrelated indeterminate memory.                                                                                                                                          | A-2/A-3; frozen AR-8                                        |
| ST-10 | Returned local is otherwise suitable, but body reads `peek(addressParameter)` where the address is unknown to the proof; execute with a valid fixed device address.                                                                                                                                                                                 | Legal source and one read are preserved; whole-function fallback retains the separate local. A particular runtime address does not replace static proof.                                                                                                                                                                                             | A-3; whole-function eligibility §6                          |
| ST-11 | Otherwise suitable callee writes `$D018` while constructing; separately, a generated IRQ path reads an unknown raw address during the callee. Add the baseline-admitted live cooperative `setNMI` handler that performs `poke($D018,$18)` while the fresh caller invokes the otherwise suitable callee under `asm_php(); asm_sei(); ... asm_plp()`. | All three missing-observer-proof cases retain the entire separate-local/copy path and existing legal source/diagnostics. IRQ masking does not discard the live NMI observer. No assumed private-RAM invisibility, new masking, route implementation or firmware bound. Restore the installed NMI route through the existing API.                     | A-2/A-3; whole-function eligibility §6; frozen NMI contract |
| ST-12 | Outer returned local survives an ordinary nested call whose own fresh `Pair` result is read before updating the outer row. Use fixed independent scalar values 31 and 47.                                                                                                                                                                           | Outer selected row is 47, its other bytes unchanged, and the inner result remains `{x:31,y:47}`; destination pointers and live homes do not overwrite one another.                                                                                                                                                                                   | A-2/A-4; FN-4/FN-5 and SFA nested-call rules                |
| ST-13 | Repeated calls initialize a fresh loop-local result in four iterations, then a normal borrowed reader consumes it after each return.                                                                                                                                                                                                                | Four independently expected values are observed in order; legal post-return borrowing does not become an admission error or false early observer. Existing lifetime/interference remains sound.                                                                                                                                                      | A-2/A-3; whole-function eligibility and SFA lifetime        |
| ST-14 | Take `&make` as an ordinary typed function value and call the otherwise suitable aggregate-returning function indirectly; also retain a reachable direct call.                                                                                                                                                                                      | Existing stable canonical/indirect ABI and values remain valid; the whole callee retains its separate local/copy. No destination specialization from direct calls alone.                                                                                                                                                                             | A-3; whole-function eligibility §5                          |

### Output, storage and applicability

| ID    | Concrete input / scenario                                                                                                                                                                                                                                      | Expected result                                                                                                                                                                                                                                                                                                                                                                                | Source                                                                        |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| ST-15 | Assemble ST-3 on PAL/NTSC × 6581/8580 cooperative PRG profiles, optimization none, safety off. Decode its actual `sample` routine and complete storage report.                                                                                                 | No separate eleven-byte callee result, no terminal eleven-byte copy or unused source-pointer setup; completed return delivery is only the existing RTS, 1 byte/6 nominal cycles. Nested constant bytes are constructed in place, with no eight-byte child staging/copy.                                                                                                                        | A-1/A-4; destination/root consumers                                           |
| ST-16 | The same exact ST-3 witness, including main, startup, restore, container and resident storage.                                                                                                                                                                 | Actual sample is below baseline 70 bytes/272 nominal cycles on the measured path; complete generated local work below 90 bytes/299 cycles. Ordinary SFA at most 12 bytes, ZP at most 4, generated call stack unchanged at 2, platform state unchanged at 49, no added helper scratch. Report payload/container/padding/residency separately and require no hidden net storage growth.          | A-5; approved ordinary artifact and whole-cost directive                      |
| ST-17 | Fully and explicitly initialize a returned `byte[257]`, write indices 255/256 to 3/5 and inspect its complete fresh result. Separately initialize returned `word[129] = [;0]`, write indices 127/128 to `$1234`/`$5678` and inspect its complete fresh result. | Byte result indices 255/256 are 3/5, all others zero. Word result byte offsets 254–257 are `$34,$12,$78,$56`, all earlier bytes zero. Preserve both bytes, two-byte stride, full fill coverage and restored root base after page advancement. Neither result has a complete second object/terminal copy; all pointer/scratch use is SFA-accounted.                                             | A-1/A-2/A-4; complete root binding, packed word layout and CPU page semantics |
| ST-18 | Build the actual approved PA-only acquisition-shaped source with its real fresh-declaration caller and retained normal saved-data consumer. Compare against the same source's uncorrected artifact.                                                            | Record exact source/hash, eligibility and all function/caller/ingress/startup/restore/resource costs. No extra returned-local/child copy if qualified, no destination variants/runtime support, and no net copy-elision regression. Failure to qualify stops the claimed prerequisite; it does not approve a broader optimizer. No public keyboard or route runtime qualification is inferred. | A-6; AR-1 and accepted acquisition direction                                  |

ST-18 is an applicability obligation, not permission to implement the public
library. Use a retained diagnostic source conforming exactly to the accepted
PA-only contract; the historical DDR-writing scanner is not a passing fixture.
Establish that source and its baseline before production changes. Do not create
a framework or change an old oracle to make it qualify.

ST-7 does not claim a working baseline runtime fallback. The preflight's public
check/build probe reproduces `COMPILER_LOWERING: Fixed array construction is missing
an element` while frontend analysis is complete with W10140/W10190. T-15 owns
the separate backend repair and the pending independent runtime oracle: initialized
byte 0 is 7, and byte 1 remains indeterminate. That runtime portion is unproved,
not skipped or counted as a T-14 pass. T-14's internal guard test must prove no
certificate and unchanged semantic operations and complete local inventory for
this ineligible function; absence of a certificate alone is insufficient.

The added ST-11 NMI witness and ST-17 word witness were admitted by public
check/build on all four selected profiles at the baseline. Preserve the word
case's existing W10143 size warnings; the NMI case has no diagnostics. Admission
does not establish runtime or transformed output. Both remain independent new
behavior/output oracles using existing fixtures, not new route qualification.

Pair ST-11's live-NMI-under-I=1 case with the otherwise identical I=1 source
without a live generated NMI installation. The no-live-NMI control must bind the
otherwise eligible returned local to its fresh destination; the live NMI case
must retain its complete separate-local/copy path. Both deliver the independently
expected `Pair { x:1, y:7 }`. This distinguishes the observer guard from an
unrelated fallback. The control also passes baseline public check/build on all
four selected profiles with only the existing W10181 unused-observer warning.
Preserve that warning rather than adding or suppressing a diagnostic. It does not claim external NMI is
impossible, nor certify retained firmware or full-program stack/completion.

## Files, ordering and execution

| New specification file                           | Cases                  |
| ------------------------------------------------ | ---------------------- |
| `test/rd05/returned-local-behavior.spec.test.ts` | ST-1–ST-5, ST-12–ST-13 |
| `test/rd05/returned-local-safety.spec.test.ts`   | ST-6–ST-11, ST-14      |
| `test/rd05/returned-local-output.spec.test.ts`   | ST-15–ST-18            |

The implementation owner then writes focused internal tests in
`packages/compiler/test/returned-local-destination.impl.test.ts` and
`packages/compiler/test/aggregate-place-proof.impl.test.ts`: missing metadata,
incomplete initializer coverage and its structurally unchanged fallback,
bad/mixed value-use chains, byte/word footprint,
mask conversions, address wrap, deterministic certificate order, unknown effects,
variant propagation and bounded long/shared definition walks. These do not become
the independent behavior oracle.

Some safety/value cases should already pass: record that as baseline protection,
not a failed RED phase. The new destination/output assertions must fail before
implementation. The spec author must not derive machine expectations from current
backend logic. Preserve all existing tests and fixtures without exceptions.

Directed verification uses `yarn vitest run <named-new-files>` from the root.
After production edits, run `yarn build` before every directed test command that
imports the public compiler package: its exports resolve to `dist`, not source.
Run VICE cases sequentially. Phase verification is the imported project rule in
the register. Before a documentation checkpoint: forced touched-file Markdown
formatting, local links, source keys, task/order/gate checks, foundation suite and
immutable-path/whitespace guards. Existing fixture temp lifecycles remain bounded;
remove only task-owned unused evidence, never other `/tmp` items.

Native ACME/VICE are real externals, not mocked successful compilation/execution.
Skipped or unavailable runtime cases remain unproved. Normal source behavior may
be VICE-qualified, never universal hardware proof. Security testing is existing
source/config validation and no-generation protection; this task changes none of
those boundaries and introduces no credentials, network endpoint or process API.
