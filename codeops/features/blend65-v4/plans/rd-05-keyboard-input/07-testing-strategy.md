# Test strategy: keyboard and combined input

> **Parent**: [Index](00-index.md)

## Independent oracle and fixture boundary

New `*.spec.test.ts` files derive expectations from frozen language/CPU/platform
semantics, the accepted register and component contracts, never compiler output.
Independent authors receive only those excerpts and existing public fixture
interfaces. Production/compiler implementation, prior output expectations and
historical reviewer/grading answers are forbidden author inputs. They do not
review their own oracle. Root owns expensive verification; VICE runs sequentially.

Existing specification tests stay unchanged except AR-P6's exact nine-name
inventory extension and AR-P13's exact two Timer-A setup sites. The latter stops
only the inherited counter before each source's initial ICR read, preserving
other CRA bits and every source, assertion, injection, timeout and observed
interval. No added acknowledgement or shared-harness correction is authorized.

Use existing `profile-fixture`/VICE interfaces from [02](02-current-state.md).
Check actual PRG bytes, not only assembly text. A pure electrical reference in a
test may construct endpoint reachability from declared contacts independently
of the production residual-mask algorithm; it is not a product solver/framework.
Small finite-domain enumeration supports, but does not replace, the accepted
full 8×8 proof. Runtime tests invoke actual generated ordinary-source functions.
Saved-data test inputs may be constructed; hardware-acquisition claims may not
substitute patched rows or pin/frame memory for real matrix/RESTORE events.

## 🚨 Specification Test Cases

The table below owns expected behavior and intended output. Local expert
candidates preserve the diagnostic's stated storage/address/register contract;
their exact source, final bytes and page assumptions must be captured before
production edits. They are not full-package targets.

| ID    | Concrete input → expected output                                                                                                                                                                                                                                                                                                                                                                               | Authority                                                                                   |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| ST-1  | Borrowed `byte[8]`, `column & 7`, byte load returned immediately; column 0/7/255 and base $30FC → bytes at base+0/+7/+7, with carry; no widened zero-high staging. Equal-contract diagnostic query meets or beats 23 bytes/37 nominal cycles.                                                                                                                                                                  | AR-P8/AR-P12; Ch08 §3.4; MOS-PGM-1976                                                       |
| ST-2  | Target row address formed from masked ordinal, followed by one volatile PB read and byte store → one PB read after the PA write, one correct row store; diagnostic address/write segment meets or beats 23 bytes/34 nominal cycles. Base $FFFC plus 7 wraps to $0003 under the actual map, not an 8-bit address wrap.                                                                                          | AR-P12; Ch08 §3.4; MOS-6510-1982                                                            |
| ST-3  | Signed ordinal -1, unmasked word ordinal 265, stride-two index and an escaping/multi-use loaded byte → exact existing sign/width/scale/retention semantics. Known negative/out-of-extent cases retain E10240; bounds-on runtime failure still reaches the labelled nonreturning stop. No fabricated narrow certificate.                                                                                        | Ch08 §3.4; AR-P12                                                                           |
| ST-4  | CRA=$00/CRB=$00 and CRA=$02/CRB=$00 or CRA=$00/CRB=$02 → predicate false/true/true; both volatile reads occur once, CRA before CRB. Diagnostic predicate meets or beats `LDA CRA; ORA CRB; AND #2; BNE` at 10 bytes, 12/13 cycles excluding page crossing.                                                                                                                                                     | AR-P12; MOS-6526-1981                                                                       |
| ST-5  | Fresh marker byte 0/1/$80 followed immediately by `==0` → true/false/false from valid Z; no redundant EOR #0. Insert a flag/A-clobbering operation, another use or a block boundary → no stale flag/value forwarding. Preserve C/V/X/Y/D/I when observable.                                                                                                                                                    | AR-P12; MOS-PGM-1976                                                                        |
| ST-6  | Byte expression saved then used twice, or used after another volatile read/call → both results and ordered effects remain correct, stable retention where required. No duplicated, dropped, reordered or NMOS-RMW device access.                                                                                                                                                                               | AR-P12; Ch06 evaluation order; MOS-HW-1976                                                  |
| ST-7  | Fixed caller-owned snapshot passed to a const aggregate query, byte return stored immediately to fixed RAM → same two calls and hidden-result ABI, direct low/high argument address stores, no disposable result spill/reload. Diagnostic caller meets or beats 41 bytes/55 nominal cycles.                                                                                                                    | AR-P12; Ch06 FN-3/FN-4 and §5.4; SR-2                                                       |
| ST-8  | Dynamic aggregate pointer, fixed nonzero field offset, aliased nested argument and call-result use after another call/pointer setup → original address and left-to-right effects, no false fixed-place identity or lost A value; general fallback when proof is missing.                                                                                                                                       | Ch06 FN-3/FN-10 and §5.4; AR-P12                                                            |
| ST-9  | Actual generated masked-read/write, expression and caller fixtures across four profiles → actual byte legality, complete SFA/ZP/stack/scratch closure and equal-contract behavior; no storage invented after closure. Code/path/resource deltas are reported separately, not subtracted into a guessed package budget.                                                                                         | AR-P12; frozen ABI; expert equivalent-work contract                                         |
| ST-10 | Import each public name from installed `c64.input` → exactly six unchanged masks plus nine approved names. Struct size/offsets are 11/(0,8,9,10); enums/members and all 64 Key values match [03-02](03-02-saved-input.md#declarations), with no RESTORE/SHIFT_LOCK member. Byte casts with unnamed values remain legal.                                                                                        | AR-P3/AR-P6; Ch07 SR-2; Ch09 EN-1/EN-10                                                     |
| ST-11 | COMPLETE released snapshot ($FF rows/raw ports), each of 64 keys and five controls on both ports → OBSERVED_UP. For each single key (c,r), only row[c] has bit r LOW and raw ports remain $FF → that key DOWN, all other keys UP. All 32 no-key active-low control combinations per port, and both-port combinations, match the declared electrical model rather than assuming impossible opposite directions. | R5.24/R5.25; AR-P3/AR-P10                                                                   |
| ST-12 | COMPLETE, no joystick grounds, rows[0]=rows[1]=$FC → all four positions in that 2×2 component UNCERTAIN; unaffected HIGH positions UP. One-column/two-row and two-column/one-row components → every component edge DOWN (the rule is OR, not AND).                                                                                                                                                             | AR-P10 full-matrix proof                                                                    |
| ST-13 | COMPLETE, A={PA5}, B={PB0,PB5} → both grounded star keys DOWN. A={PA5}, B={PB0,PB1} → each star key UNCERTAIN. A={PA0}, B={PB0} gives k=2, not 1; the two joystick-source answers remain UNCERTAIN. Opposite baseline empty → queried LOW joystick source DOWN.                                                                                                                                                | AR-P10 grounded/sole-source proof                                                           |
| ST-14 | COMPLETE raw ports $FF/$FF, rows $FC,$FD,$FB,$FF,$FF,$FF,$FF,$FF → queried D (PA2/PB2) UNCERTAIN, directly HIGH key/joystick queries UP; raw bytes/quality unchanged. Missing baseline B in any row, grounded A with residual lows, or high-only impossible grounding → inferred LOW result UNCERTAIN.                                                                                                         | AR-P10 six-condition/nonempty policy                                                        |
| ST-15 | Every named query on INTERRUPTED/UNAVAILABLE, quality 3/$FF, Key 64/$FF, port 0/3/$FF or control 5/$FF → UNCERTAIN, no out-of-range row access/control shift and zero fresh MMIO. Modifying hardware after saving does not change saved-query results. Snapshot bytes remain unchanged; saved-only imports retain no scanner marker/wrapper/link.                                                              | AR-P3/AR-P7; Ch09 EN-10                                                                     |
| ST-16 | Compatible stock prior owner, PBON clear, released contacts → COMPLETE, all raw bytes $FF, exact DDRA/DDRB restored; own ordered MMIO is 14 reads/15 writes, PB latch unchanged and never written; no timer/ICR/CIA2 mutation. Repeat through ordinary helper/loop calls and both initial I states.                                                                                                            | AR-P2/AR-P3; R5.25/AC-20                                                                    |
| ST-17 | Either CRA/CRB PBON set, including both → UNAVAILABLE with the initialized zero raw placeholders; exactly two ordered control reads, no CIA1 write or scoped NMI publication, balanced original status. Running timers with PBON clear remain enabled/configured.                                                                                                                                              | AR-P3; [03-03](03-03-acquisition.md#source-transaction)                                     |
| ST-18 | Real held native matrix position for each of 64 coordinates, then native two-joystick combinations with keys/ghosting → exact driven-column raw bytes and accepted saved-model answers. RESTORE is never treated as a matrix key. Cases run separately on all four profiles; record input/emulator/ROM identities.                                                                                             | R5.24/R5.25; pinned C64 matrix; AR-P3/AR-P10                                                |
| ST-19 | Returning NMI at each protected publication/sample/final-idle boundary → ingress writes idle PA then marker, chains through the actual predecessor once, final quality INTERRUPTED and all named queries UNCERTAIN. Generated route preserves entry P/A/X/Y/D, uses page-safe immutable link and no invocation-private RAM/ZP; zero callback CIA2 ICR reads.                                                   | AR-P2/AR-P3; frozen Ch15 and NMI ABI                                                        |
| ST-20 | NMI before publication, during removal and after removal/restoration → valid old/new route at every transition, no lost predecessor or reused live link, no scan-induced invented STOP/key. Own final PA=$7F handoff occurs before route removal/DDR restoration; later legitimate UD60 PA=$7E is not a failed exact-at-RET promise.                                                                           | AR-P2; pinned NNMI/UD60; existing matching-low proof                                        |
| ST-21 | Two generated overlapping entries; genuine STOP+RESTORE; changing-key false-STOP witness → monotonic interruption marker, no generated private overlap; genuine STOP remains reachable and false scan-induced STOP is absent under the compatible-owner condition. No finite external nesting/ROM deadline is inferred.                                                                                        | AR-P2/AR-P3; T-04/T-05 method; frozen cooperative exception                                 |
| ST-22 | Actual compatible generated chained predecessor and compatible exclusive terminal owner → composed scan works without a no-custom-handler ban or per-call FE47 gate. Known unproved generated storage/vector mutation keeps existing rejection/no-generation behavior. A port-DDR writer outside the accepted coherent-owner precondition is not falsely certified by SEI.                                     | AR-P2; existing program/vector proof; [03-03](03-03-acquisition.md#preconditions-and-scope) |
| ST-23 | Exact installed source in an ordinary caller and saved-query-only program, explicitly optimized for size → independently derived whole equivalent expert acquisition/query/caller baselines; all complete path/code/data/padding/BSS/SFA/ZP/scratch/stack/MMIO costs reported, no ratio above the expert floor silently accepted. None retains canonical correctness/accounting. Local meets have a measured owned path-to-beat issue; RD-08 is not a waiver. | prime directive; AR-P12; [whole-input AR-P4](../whole-input-cost-closure/00-ambiguity-register.md#ar-p4--exact-approved-complexity-decision) |
| ST-24 | Full ordinary source build/run, normal return to BASIC, M1 and existing joystick/NMI suites → unchanged unrelated APIs, diagnostics, package/path/hash/overlay protections and no generation on existing errors. Raw/D64 profiles gain no new admission claim; no frozen/old oracle change except AR-P6/AR-P13.                                                                                                | R5.25; AR-P6/AR-P13; existing profile/product boundary                                      |

## Residual consumer specification cases

These local cases implement the exact approved AR-P25 scope, not a replacement
for ST-23's complete input limits. New independent concern-specific specifications
are RED first. Use current public build/artifact/VICE helpers; no new harness.

| Case  | Independent contract and cost boundary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ST-25 | Adjacent sole-use byte complement/bitwise/fixed-store/scalar-return values match language results without needless staging. Fixed absolute RAM complement/store leaf costs at most9 bytes/16 nominal cycles; three immediate operations cost at most13/20. Absolute-home byte parameter complement return costs at most6/12 and may beat it with ZP. Ordered volatile accesses and wider/multi-use/call/effect/block fallbacks remain correct; no unpromised outgoing A/X/Y obligation.                                                                                                                                                                     |
| ST-26 | Condition-only nested `&&`/`\|\|` preserve every left-to-right read/call and bypass path without a Boolean home solely for branching. Escaping/stored/multi-use Boolean values remain canonical and correct. Independent complete routine costs include all branches, merge/repair and return paths.                                                                                                                                                                                                                                                                                                                                                        |
| ST-27 | Existing unsigned guards proving a stride-one access ordinal below256 allow byte ordinal formation with full pointer carry/wrap. Unproved/stale/signed/alias/call/join cases retain generic semantics. Source word state and loop updates are unchanged; no new counter/recurrence proof.                                                                                                                                                                                                                                                                                                                                                                   |
| ST-28 | Eligible borrowed constant offsets preserve the exact addressed byte, dummy-read/bank/effect footprint and interference contract. Unknown runtime-address/footprint cases retain full displacement; read-only is not a RAM proof.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ST-29 | Omitting an existing proved-unused copy source pointer changes no source/destination byte, alias direction, volatile effect, ABI or scratch closure; the absolute-indexed copy itself remains. Complete code/setup cost is included.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ST-30 | The bounded immediate EOR/AND/EOR identity preserves all byte results and final flags/state without crossing effects or intermediate uses. Complete fixed-store leaves meet11 bytes/18 nominal cycles; parameter returns meet8/14 or beat it with ZP. Exhaustive256 values, two nontrivial masks, ordered volatile reads/writes and saved/call/word fallbacks are independent. Actual source emission inventory remains valid when append shrinks the list. The old13/20 delivery expectation stays unchanged and is not an expert-floor claim.                                                                                                             |
| ST-31 | Ordinary branch-only call results before two direct constant byte returns independently test A, including every nonzero Boolean representation and opposite callee Z. Complete wrapper12/18–19 excludes the separately charged callee4/10. Startup, NMI-domain, materialized, delayed, wider and effectful continuations retain conservative behavior; no extra homes/stack/register-save growth. Original branch-negation oracles stay unchanged.                                                                                                                                                                                                          |
| ST-32 | A byte-result variable shift with an exact unsigned0..7 count bound omits only high-count/range/saturation work. Byte/word count homes retain declared widths. Masks, conversions and reaching guards are separate from unknown/invalidated reloads. Zero bypass, wrapping left/logical right/arithmetic right, wide-count saturation and ordered effects have independent native expectations. The bounded absolute-load core including return is15 bytes/19 zero cycles or17+7k positive cycles; signed right17 bytes/19 zero or17+9k. Producer/guard bytes and final-layout penalties remain separately charged; no whole-leaf or complete-input waiver. |

ST-33 supplements, rather than changes, ST-32: complete masked byte/word count
leaves for byte/sbyte left and right shifts meet18 bytes (20 for signed right),
including mask, count/value loads, zero bypass, complete loop and RTS. Nominal
zero cost is23 cycles; positive k1..7 costs21+7k, or21+9k for signed right.
Actual branch-page penalties are accounted separately. The source word count
retains its two-byte home; only the proved mask's low byte is needed. A new
implementation-blind oracle derives these whole-leaf expectations before code.
The old guard/native/fallback programs, limits and assertions remain unchanged.
This is not a complete guarded-leaf or input-library parity waiver.

ST-34 independently charges the complete word-mask→byte-conversion→byte/sbyte
shift leaf. The exact0..7 masked value survives conversion, so complete leaves
meet the same18-byte/20-byte limits as ST-33. All four profiles and shift forms
run through the existing public build/accounting helpers. Existing native
conversion, effect, source-home-width and fallback cases remain unchanged.

ST-35 charges the complete guarded byte/sbyte shift leaf, including both guard
widths, all rejection/zero/loop/return bytes and full parameter-home widths.
Four profiles meet22/24 bytes for byte counts and27/29 for word counts; signed
right is the larger value. Accepted nominal paths are byte zero23 cycles,
positive21+7k/9k; a word's zero-high rejection check adds6. These cycles are
analytical in the supplemental byte oracle, not a new CPU evaluator. Existing
native/core expectations stay unchanged; actual-byte output review separately
checks complete paths and branch-page penalties. No complete input waiver.

ST-36 charges complete ordinary returned byte-zero predicates and comparison-leaf
short-circuit trees using existing public build/VICE fixtures. Direct LDA/branch
and two constant-return arms fit11 bytes/15 nominal cycles; two ordered tests fit
16 bytes/21 cycles. Charge any actual jumps/padding and taken-branch page penalty.
No staging writes, stack traffic or private scratch is allowed for these leaves.
Native cases verify zero/nonzero truth, exact right-side bypass/read order, no
input writes, balanced SP and unchanged I/D. Raw Boolean returns preserve exact
bytes0/1/$80/$FF and retain their existing value path. This is no general
canonical-Boolean requirement, arbitrary logical-return rewrite or whole-input
budget waiver. A blind author freezes both new oracles before production.

ST-37 freezes a separate stronger public output oracle: ordinary zero inequality
fits8 bytes/14 nominal cycles; the two ordered logical forms fit13 bytes/20
cycles. Conjunction's one-read path fits13 cycles and disjunction's15. Every
complete path charges RTS, jumps, padding and actual branch-page penalties,
preserves canonical0/1 for these selected comparison idioms, and has one ordered
input read or exactly input-then-right reads. No scratch, staging writes or stack
traffic. All earlier output/native/effects files remain immutable. Native/effects
regressions remain the independent behavior oracle; no general Boolean encoding
or whole-input waiver follows from these stronger local costs.

ST-38 supplements the unchanged earlier oracles with ordinary two/three-test
early-return chains selecting byte2 or byte1. Complete16/21-byte floors charge
every arm, return, jump and padding byte; one/two/three-read nominal paths fit
15/21/27 cycles plus actual taken-branch page penalties. Independent sequential
native groups cover320 combinations of0/1/$80/$FF operands across four profiles,
selected result1/2, exact ordered prefixes/right bypass, no input writes, one
result write followed by marker, balanced SP and unchanged I/D. No copied input,
private scratch or explicit stack saves are permitted for these leaves. Sharing
must preserve all labels and never admit memory effects or extra instructions.

ST-39 freezes two independent ordinary-byte arithmetic/bitwise oracles. Captured
`m & (m - 1)` and its reversed form, plus wrapping addition with OR/XOR, fit13
complete bytes/22 nominal cycles and at most one private byte. An already-owned
byte parameter fits10 bytes/18 cycles, with its parameter home charged. Whole
accounting still includes callers, argument setup and startup. Sequential native
groups exhaust256 inputs for eight byte witnesses per profile and nine word
boundary patterns. Values, exact capture/mutation/result/marker order, no extra
input writes, balanced SP and unchanged I/D are independent expectations. Calls,
multiple arithmetic uses, later mutation of a second capture and word operations
retain their required stable values; no tight local cost is imposed on fallbacks.
No old oracle or whole-input ceiling changes.

ST-40 freezes the stronger32-case pure terminal companion before code. All four
profiles cover captured AND subtraction, OR/XOR addition in both operand orders,
and an already-owned parameter AND subtraction in both orders. Complete captured
12-byte/22-cycle and parameter9-byte/18-cycle floors include RTS and charge every
home, caller, marshalling and startup byte. The original ST-39 output/native
files stay immutable. Official instruction costs allow A/X/Y alternatives without
prescribing a sequence. Only ordinary terminal byte-return state is unpromised;
startup, IRQ/NMI, surviving nonterminal register/flag obligations and extra effects
must not borrow this eligibility. Existing independent native samples still own
behavior, and private tests own exact gates, metadata and conservative fallbacks.

## Coverage and qualification

ST-41 freezes the captured unsigned-byte comparison's independent output,
native and debugger oracles before production. Four bit-7 threshold forms on
four profiles fit15 complete owner bytes,13 nominal bypass cycles and26 called
owner cycles plus18 helper cycles; actual branch-page penalties are separate.
The local's instruction-entry locations must be truthful, not a stale private
home on the bypass. An unchanged returned-call companion exhausts byte values
without assuming callee-preserved flags. Together32 native groups cover8,192
samples, exact read/write order, return values and stack/I/D obligations.

The later blind20-case observer companion reaches meaningful RED before its
guard repair. Runtime raw/unchecked-index readers, IRQ readers/writers and
persistent RAM publication must retain unconditional capture save/reload on all
four profiles. These are assembled fallback controls, not exhaustive native
interleaving evidence. The exact initial-read exemption needs actual ownership
and exclusive-main execution; full-window checks must survive final reallocation.
No old oracle, source admission or complete-input ceiling changes.

ST-42 freezes the fixed-shift delivery's28 complete output cases and48 native
groups before production. Unsigned left/right counts1/3/7 fit8/10/11 bytes and
16/20/20 nominal cycles; signed right1 fits10 bytes/18 cycles. Every leaf charges
its declared parameter and RTS, with no unnamed expression home. Exact seven-bit
endpoint extraction may change C only at an ordinary main-domain void return
without a later observer; all other register/flag/effect obligations remain.
The native mathematical oracle exhausts256 byte inputs per shape and adds word
boundaries, dynamic/saturated counts, intervening calls, multiple uses and
branch-selected destinations. The latter is not an indexed-place control;
focused private tests independently retain that fallback. Source read/write
order/count, unchanged input and unselected output, markers and SP/I/D remain
observable. Complete caller, startup and storage costs are separately charged.
Whole saved relocation can add or remove taken branch-page penalties, so local
cycle savings are not a uniform whole-path claim. No old oracle changes.

ST-43 freezes36 complete one-bit-shift/OR1 output cases and56 native groups
before production. Unsigned left/right and signed right return leaves meet
6/7/9 bytes and14/14/16 nominal cycles, including parameter load and RTS.
Each fixed absolute store adds3 bytes/four cycles. Exact ASL/ORA#1→SEC/ROL
must preserve every final register/flag, including C; source spans and official
selected-CPU effects/costs remain truthful. Same-width casts only reinterpret
bits. Full caller, parameter, startup and resource costs stay charged. Native
expectations exhaust256 byte inputs and263 word samples, plus dynamic counts,
multi-use, clobbering calls and an actual indexed destination. Values, ordered
source reads and result/marker writes, unchanged inputs/unselected output and
SP/I/D are independent of instruction selection. These groups do not measure
outgoing C/V, whole timing, silicon or exhaustive interrupt interleavings.
No old oracle or whole-input ceiling changes.

ST-44 freezes12 complete scalar-byte call-delivery output cases and32 native
groups/8,220 source-derived invocations before production. An ordinary direct
caller with one byte argument fits10 bytes/20 nominal cycles, or10/22 when a
separately charged4-byte/10-cycle function produces the byte. The sink costs
7 bytes/14 cycles including its declared parameter load, fixed store and RTS.
One exact parameter home remains; expression-only caller/producer homes do not.
Calls, complete bodies, startup, markers, physical overlays and stack routes are
charged separately, never treated as a free register ABI. Same-width signed
reinterpretation preserves bits. Native expectations cover all256 byte inputs,
two effectful arguments in source order, wider boundaries, reused captures
across mutation, zero extension and a nonvacuous two-target indirect call.
Ordered reads/writes, unchanged or deliberately changed input, output/markers
and SP/I/D remain observable. These cases do not promise outgoing C/V, external
interrupt bounds, whole timing or silicon proof. The author's preimplementation
draft-only observer-identity correction, refrozen hashes and meaningful RED are
recorded in the journal; no existing oracle or whole-input ceiling changes.

Cover all named coordinates, both ports' full 32-control domains, both-port
ground interactions, ungrounded stars/rectangles, eligible/ineligible grounded
stars, inconsistent observations, all byte-enum guard classes and every scoped
transaction boundary. A bounded property sample of full-matrix contact graphs
adds independent soundness checks; a reduced 3×3 exhaustive set is supporting
evidence only. Complete-domain reasoning remains the accepted analytical proof.
No speed, atomicity or physical-switch certificate is inferred from COMPLETE.

For ST-18–ST-22 retain exact-source native qualification logs using the existing
GDB/VICE injection procedure. Execute genuine device/RESTORE paths, not synthetic
CPU frames or source byte substitution. The automated new specs and native
evidence jointly qualify the endpoint; any unavailable/skipped native case leaves
that endpoint incomplete. Record returning and nonreturning paths separately.

ST-23 must derive the complete expert source/assembly contract before accepting
library output. Partial diagnostic local floors do not prove full decoder parity.
If the approved corrections are insufficient, record the actual residual defect
and use the normal runtime gate for necessary extra support, not a source workaround
or deferred-output waiver. Physical edge/settling QA is RD-10, with bounded status
VICE-verified / hardware-unverified when actual execution supports it.

Implementation tests follow GREEN and cover narrow facts, adjacency, clobber
rejection, fixed-place propagation and fallback determinism. No general validator
or new test harness. Existing source-format/path/security boundaries stay under
their complete suites; no web/network service is introduced.

## Verification

Each session's [execution](99-execution-plan.md) Verify line selects its new
directed tests. Rebuild before tests importing the public compiler package after
production edits. At every phase checkpoint run, from the root:

```text
yarn install --frozen-lockfile
yarn build
yarn typecheck
yarn test
```

Also check targeted formatting, whitespace, immutable spec/expert guards and
old-oracle scope. Runtime cases are sequential. Only root runs expensive checks.
Expected RED tests are uncommitted evidence, not a green checkpoint. All new
tests must execute; two unrelated existing skips do not qualify a new endpoint.
