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
| ST-23 | Exact installed source in an ordinary caller and saved-query-only program → independently derived whole equivalent expert acquisition/query/caller baselines; all complete path/code/data/padding/BSS/SFA/ZP/scratch/stack/MMIO costs reported, no ratio above the expert floor silently accepted. Local meets have a measured owned path-to-beat issue; RD-08 is not a waiver.                                | prime directive; AR-P12                                                                     |
| ST-24 | Full ordinary source build/run, normal return to BASIC, M1 and existing joystick/NMI suites → unchanged unrelated APIs, diagnostics, package/path/hash/overlay protections and no generation on existing errors. Raw/D64 profiles gain no new admission claim; no frozen/old oracle change except AR-P6/AR-P13.                                                                                                       | R5.25; AR-P6/AR-P13; existing profile/product boundary                                             |

## Coverage and qualification

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
