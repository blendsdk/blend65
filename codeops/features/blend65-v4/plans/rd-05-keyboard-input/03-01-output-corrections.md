# Three existing-consumer output corrections

> **Parent**: [Index](00-index.md)
> **Authority**: [AR-P12](00-ambiguity-register.md#ar-p12--named-existing-consumer-correction-scope)

## Common boundary

No new pass or IR kind. Retain only the narrow value/place/availability facts the
existing consumers need. Establish them before current SFA inventory/closure;
emission never discovers a storage home. Missing proof uses the current general
path. Preserve public diagnostics, source widths, evaluation order, effects,
alias/lifetime semantics and selected-machine bus behavior.

## Masked addressing and aggregate-byte delivery

Reuse the existing mask containment proof. A word-typed `column & 7` has a
provably zero high byte; that fact may narrow machine work without narrowing the
source type. A proved unsigned byte stride-one index can feed low-byte address
addition followed by carry into the existing pointer high byte. The pointer
remains a full 16-bit address. Do not allocate a widened/scaled word temporary
solely to carry known zero. Preserve signed/wider/stride fallback paths.

Owners: `machine/lower-scalar.ts`, `lower-state.ts`,
`lower-aggregate-index.ts`, `lower-aggregate.ts`. A byte aggregate load may remain
in A only for a proved adjacent single-use consumer. Reuse the existing
forwarding/retention machinery, not a second liveness model. Pointer setup must
finish before a volatile value read that it could clobber.

## Adjacent expression and zero-condition delivery

Extend the existing single-use, same-block forwarding window to proved byte
binary results and their next compatible consumers. No machine instruction,
observable effect or clobber may be skipped. Constants/conversions that emit no
instruction may be crossed only under the existing exact guard.

The ordered two-read PBON expression can consume A directly through OR/mask and
branch. A fresh byte zero test can use its valid Z flag rather than `EOR #0`.
Track A and flag validity separately: stores preserve flags but do not establish
them; calls and pointer setup can invalidate them. Multi-use/escaping values,
nonadjacent uses, different blocks and unknown clobbers retain stable homes.
Owners: `machine/lower-register-forwarding.ts`, `lower-scalar.ts` and their
existing state/retention consumer where necessary.

## Fixed-address arguments and immediate scalar-call results

Preserve an aggregate place's fixed storage/label identity through its existing
address producer to `machine/lower-call.ts`. For a proved constant fixed place,
marshal its low/high address bytes directly to the existing by-reference
parameter home. Do not reinterpret a captured dynamic pointer as a fixed address
from its spelling, request name or current numerical value. Offset, overlap,
nested argument effects, escaped/address-taken entries and interference remain
part of the existing proof/fallback.

A byte call result in A may flow directly to its sole adjacent fixed byte store
if no subsequent argument evaluation, pointer setup or other clobber occurs.
Keep callee argument order, ordinary JSR/RTS, caller-owned hidden aggregate
destination and all interrupt-domain/storage obligations. Word/AX and indirect
call variants retain their general behavior unless the same existing guard
already proves them; AR-P12 does not authorize a separate specialization system.
Owners: `machine/lower-aggregate.ts`, `lower-state.ts`, `lower-call.ts` and
`lower-register-forwarding.ts`.

## Qualification boundary

[ST-1–ST-9](07-testing-strategy.md#-specification-test-cases) own behavior and
expert instruction/cost expectations. Analytical local candidates are not a
full-body/package budget. Reassemble actual output and inventory code, data,
padding, BSS, SFA, ZP, scratch, stack, MMIO and path cycles. Do not select a
shorter sequence that changes flag, carry, page-wrap or volatile-bus behavior.
Any further necessary support mechanism requires a new exact runtime ruling;
RD-08 debt is not permission to pass a failing keyboard parity gate.

## Approved residual consumers

[AR-P25](00-ambiguity-register.md#ar-p25--finish-the-measured-missing-output-consumers)
extends the current consumers only at its exact narrowed scope. Specification
cases ST-25–ST-29 below own the independent local expectations; ST-23 still
owns complete input parity. Each residual unit is separately RED before code.

| Consumer                         | Smallest permitted correction                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Adjacent byte delivery           | Same-block sole-use byte load/read or byte bitwise result into complement or a byte `&`/`\|`/`^` with exact constant RHS. Complement/bitwise results may feed those bitwise consumers, a proved fixed byte store or scalar byte return. Existing forwarding/retention owners and all effect/flag guards remain; no general arithmetic, conversion or cross-block/call extension. |
| Branch-only short circuit        | Use existing CFG edges for an `&&`/`\|\|` result consumed only as a condition. Preserve source order and bypass; materialize escaping/multi-use values. Existing block layout/branch repair owns safe fallthrough.                                                                                                                                                               |
| Already proved index bound       | Hand an existing unsigned access maximum below256 to the existing stride-one byte-ordinal address form. Keep the source word home/update/condition and full16-bit pointer semantics; no recurrence or new range solver.                                                                                                                                                          |
| Eligible borrowed constant field | Use a byte displacement only when existing facts prove complete access/dummy-read footprint and alias/interference safety. Read-only alone is insufficient; keep full address formation for unknowns.                                                                                                                                                                            |
| Unused copy pointer setup        | Remove only the source-pointer setup already proved unobserved before an unchanged absolute-indexed copy. No destination/lifetime/alias expansion or additional copy elision.                                                                                                                                                                                                    |

The first unit owns new `source-library-byte-delivery-output.spec.test.ts` and
`source-library-byte-delivery-native.spec.test.ts`, existing
`machine/lower-register-forwarding.ts` and its implementation tests. Root
records other unit paths before each execution. No new pass, IR kind, runtime,
framework, dependency, API, protected-oracle edit or budget waiver follows.

[AR-P26](00-ambiguity-register.md#ar-p26--remove-the-reviewed-byte-chain-waste-at-the-existing-append-owner)
corrects the reviewed constant-chain waste at the existing instruction append
owner only. Three adjacent official immediate EOR/AND/EOR operations become
AND/EOR with the composed byte mask. Preserve memory/effect barriers, surviving
source spans and actual emission-site inventory independent of net array length.
ST-30 supplements the original unchanged delivery oracle; no new optimization
pass or transform metadata is needed.

The locally qualified [AR-P31](00-ambiguity-register.md#ar-p31--select-a-one-byte-a-test-before-direct-constant-byte-returns)
uses a one-byte transfer/test only before two direct constant byte returns,
outside startup and NMI domains. The ordinary caller's returned A, not its
callee's flags, owns truth. Existing block indexes supply the bounded proof;
no new liveness model or storage is introduced.

[AR-P32](00-ambiguity-register.md#ar-p32--reuse-the-existing-count-bound-at-a-byte-shift-consumer)
adds the exact runtime count as another consumer of the existing unsigned maximum.
Only a byte-result shift proven0..7 omits unreachable high-count/range/fill work.
Zero bypass, signed/logical loop, operand evaluation and all conservative fallbacks
stay intact. The existing proof's transfers and invalidation rules do not change.
Independent local-core costs charge all surrounding producer/guard/artifact costs
separately; neither unit replaces the complete input budget.

At the same bounded byte-shift selector, two private storage reads may load A
before X so the zero bypass consumes LDX's fresh Z without CPX#0. Labels,
register operands and deferred volatile reads keep their original order. The
existing sole-adjacent AND-mask-to-ordinal whitelist may also feed a byte shift
whose exact count is proven0..7. Preserve a word mask's existing zero-extended
representation; TAX its live low A before loading the value, then explicitly
test count zero. No cross-block count-register proof or general conversion
forwarding is added. ST-33 independently owns complete masked-leaf costs.

The same masked-count window may cross one sole-use unsigned word-to-byte
conversion only when the exact downstream shift bound proves the complete
masked value0..7. The conversion then preserves the existing low A exactly;
both mask and conversion use the existing retention whitelist. Preserve all
byte/word source homes. Any other conversion, second use, effect, emitted
barrier, count identity or non-byte shift keeps stable storage. This is not
general conversion forwarding or a separate liveness model.

[AR-P34](00-ambiguity-register.md#ar-p34--retain-the-checked-count-in-the-exact-guarded-shift-leaf)
selects only the complete pure private-parameter guard/shift topology in the
existing machine-function owner. A focused helper matches actual structured
instructions and unique direct edges before closure, keeps checked count X over
one private value load, and orients rejection branches for successful fallthrough.
Word high rejection is explicit; the value load still requires CPX#0. Additional
entries, effects, instructions, types, domains or return duties keep the original
selection. No generic register-availability model or new optimization stage.

The returned-predicate consumer uses existing condition edges only for unconverted
runtime comparison trees before ordinary Boolean returns; raw/mixed/stored values
stay on the original path. Its direct terminal companion omits LDA#0 only when
every direct zero-return predecessor proves freshly-zero A from its immediate
A/N/Z producer. Two pure0/1 return arms may share the existing RTS/fallthrough;
unknown or aliased entries reject. No new IR, storage or general flag facts.
Independent output/native/effect and fallback evidence is recorded in the live
journal. Local8/13-byte meet remains #108-owned whole-call optimization debt;
complete963/725 input budgets stay binding.

The later byte-arithmetic consumer keeps a sole adjacent constant-right byte
sum/difference in A for a private/constant AND/OR/XOR operand. One instruction-free
private load may intervene only without an existing staging home. The caller's
operation-loop index avoids repeated prefix scans. The exact arithmetic appender
may omit an identical private LDA after adjacent LDA/AND/ORA/EOR and STA of that
byte, preserving A/N/Z and explicit carry setup. NMOS decimal arithmetic, stale
flags, differing identities/offsets, raw effects and wider forms keep their path.

The focused terminal companion matches the complete4/5-instruction ordinary
main-domain byte/sbyte leaf before closure. LDX/STX preserves the original capture
home and source read; DEX/INX, TXA and the unchanged private bitwise operation meet
12/9-byte complete local floors. Outgoing X/C/V are unpromised by that byte ABI.
Startup, IRQ, all NMI domains, extra instructions/edges and indexed source modes
reject. No general register model, late storage or new pass is introduced. #110
owns the separately proved whole-call route beyond this local meet; whole gates
remain binding. Exact snapshots, immutable RED/GREEN oracles and actual artifact
accounting are recorded in the live journal.

The captured-comparison companion uses a fresh unsigned-byte LDA's N flag for
the exact bit-7 thresholds128/127. Its complete main-domain four-block leaf can
save the original capture only on the clobbering-call arm, then reload it there.
The bypass and shared return keep A. Both reload omission and conditional-store
motion require one conservative existing-fact guard: actual source/read identity,
valid complete domain/context coverage, exclusive-main ownership, full admitted
RAM/ZP windows and no independent raw/indexed/asynchronous observer or hardware
publication. Missing facts retain the original path; inherited arithmetic stays
unchanged. No provisional-home disjointness, new fact model or SFA change.

The existing debugger location schema describes the matched final local as
unavailable before capture, A at branch/save/shared-return entry, and certified
memory at call/reload entry. No general availability solver or new metadata is
needed. Three independent reviews clear the15-byte/13-bypass-cycle local meet;
called-owner26 plus helper18 cycles and page penalties remain charged. #111 owns
the analytical4-byte/12-cycle eligible sole-use helper-removal route to a beat.
The20 blind assembled observer controls,32 native groups/8,192 byte samples and
complete artifact identities are recorded in the live journal. They do not
qualify whole-input963/725-byte or saved-runtime bounds.

Fixed byte shifts with known counts1..7 can likewise deliver their sole result
directly to an adjacent fixed raw or unselected scalar byte store. One same-width
identity/reinterpret cast emits no instruction and may carry that byte. The
declared destination and parameter home remain; only unnamed expression staging
disappears. Unknown/saturated counts, words, calls, additional uses and selected
destinations retain their path. Existing dynamic terminal-return forwarding is
unchanged, and this handoff preserves all original shift flags.

The existing complete terminal-byte boundary additionally recognizes an ordinary
main-domain byte-parameter/void leaf containing only its original load, seven
same-source unsigned accumulator shifts, original fixed store and return. Left7
uses LSR/LDA#0/ROR and right7 ASL/LDA#0/ROL. Final A/N/Z and D/I/V are unchanged;
outgoing C differs, so every later observer, extra instruction/edge, startup and
interrupt-domain ABI keeps the old path. No storage, pass, fact model or ABI is
added. Three bounded reviews clear8/10/11-byte unsigned counts1/3/7 and10-byte
signed-right1 leaves, including RTS. #112 owns the separately proved whole-call
win path. Actual complete artifacts and immutable/native evidence are retained
in the live journal; whole-input and physical-hardware clearance do not follow.

For the ordinary byte `(value << 1) | 1` chain, the same sole-use adjacency
owner permits fixed count1 into immediately following OR literal1. One exact
same-width OR1 cast may deliver to a fixed store or ordinary return; all other
widths, casts, effects, uses and selected destinations retain their path.
The immediate byte-tail appender lives in the existing scalar owner, with its
older XOR composition unchanged. Exact adjacent memory-free ASL/ORA#1 selects
SEC/ROL using the selected CPU's official metadata and original source spans.
Final A/N/Z/C match; X/Y/V/D/I and stack are unchanged. Signed and unsigned
right shifts retain their appropriate shift/OR sequences. No observer or edge
is crossed and no support model, pass, helper, storage or ABI is introduced.
Complete return floors are6/7/9 bytes and14/14/16 nominal cycles; a fixed
absolute store adds3 bytes/four cycles. Full artifacts, independent native
values/effects and unchanged fallbacks are recorded in the live journal.
[#113](https://github.com/blendsdk/blend65/issues/113) owns the analytical
6-byte/8-cycle adjacent scalar-call delivery and subsequent4-byte/12-cycle
eligible whole-call removal routes. The former is implemented and independently
reviewed; the latter remains analytical, not an implemented win.

The existing direct-call owner can consume a sole live byte when its exact
known ordinary declaration has one scalar/enum byte parameter and the call has
one argument. Its unchanged marshaller stores that parameter before any return
address/result setup. Existing block-local sole-use selection permits at most
one same-width identity/reinterpret cast. Unknown/indirect calls, other arity,
wider or nonidentity conversions, extra uses and emitted gaps keep their stable
path. A sole final width-one memory read also uses the existing ordinary byte
return directly. No callee-preserved-register assumption, new ABI, fact model,
storage or optimizer pass is introduced. The unchanged byte-return-arm helper
moves to the existing terminal owner to keep the forwarding module bounded.
ST-44 independently charges the complete caller, producer, parameter and sink;
fresh whole-input bounds remain unchanged.
All12 output,32 native groups and111 private checks pass with three bounded
independent reviews clear. The ordinary nine-call artifact saves54 payload and
nine SFA bytes without changing parameter/stack duties. A terminal JMP wrapper
would save a further one complete byte/nine cycles under its own proved cleanup,
domain and observer contract; current JSR/RTS measurement is not a universal
wrapper floor. #113 owns that unimplemented whole-call opportunity too.
