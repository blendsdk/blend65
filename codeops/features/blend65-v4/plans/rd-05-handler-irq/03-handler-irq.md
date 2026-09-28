# Handler IRQ Design

> **Parent**: [Index](00-index.md)
> **Decision owner**: AR-P2 in the [ambiguity register](00-ambiguity-register.md)
> **Status / claim kind**: Verified partial / Inference — grounded design, not implemented capability

## 1. Context and Authority

The target is the NMOS 6510 in the four existing cooperative C64 PAL/NTSC, 6581/8580 profiles,
with KERNAL and I/O visibility retained. Source semantics come from frozen Specification 4,
especially Chapter 6 §7.8. Initial qualification uses `optimization: "none"`; it must preserve
the legality of later optimization. Existing selected safety options retain their meaning.

Expert lineage: `skillVersion=2.0.0`, content commit
`c9e70fab6039e9ced3108e88f0ea9730d4fd3007`; the exact frozen Specification 4 identity is recorded
in the register's authority section. Governing references
are `sfa-and-abi.md#interrupt-route-completion-gate`,
`c64-memory-and-runtime.md#interrupt-entry-and-exit-contracts` and
`c64-hardware.md#interrupt-control`; keys are `MOS-PGM-1976`, `CBM-C64-KERNAL-03`,
`MOS-6526-1981`. ACME 0.97 and VICE 3.10 provide the existing artifact/runtime path. Physical
silicon qualification remains outside this slice (AR-P4/P5).

## 2. Three Distinct Identities

| Identity | Meaning | Lifetime |
|---|---|---|
| Installation slot | One saved two-byte predecessor for a particular owner's local stack position | While installed, and for every pending chain continuation needing that predecessor |
| Handler root | The source interrupt function whose body and ordinary callees are executing | Body activation, including suspended ordinary callees and their private values |
| Entry wrapper | Selected handler + entry ABI + installation slot | One immutable machine address; its predecessor binding never changes with later vector depth |

The mainline owner keeps its bounded depth slots. Each handler root starts its **temporary**
ownership depth at zero. A helper inherits the caller's root and local depth; helper return may
transfer locally installed frames to its caller. A handler must restore the exact incoming prefix
before returning. It may not pop that prefix, even if it later installs the same source handler.

When B chains to older A, B can remain the current vector. A's temporary install saves the actual
B vector in A's local slot, but A's eventual chain jump still uses the older installation's saved
predecessor. Never derive that older predecessor from the current vector depth.

Globals, hardware state and asset addresses retain their source identities. Only invocation-private
parameters, results, locals, temporaries, spills and helper scratch receive root-specific requests.
Sequential repeated A entries may share A's private homes. Concurrent A/B activations may not
share live private storage. See §4 for actual recurrence rather than repeated installation.

## 3. Finite Context Construction

Extend `InterruptExecutionContext` in `semantic/interrupt-contexts.ts` with optional
`activationRoot: string`, using stable source binding identity. Keep `domain` for the established
main/IRQ/NMI boundary; IRQ-root identity is an
additional compiler-only distinction, not a new source feature or runtime value.

1. Reuse the acyclic ordinary call graph and exact ownership summaries. Compute each root's
   finite local slot demand, including helper entry offsets. A loop backedge must return the same
   ownership state; repeated balanced loops do not allocate new identities.
2. Enumerate mainline contexts and handler-root contexts separately. An installation discovers
   an entry wrapper `(handler binding, ABI variant, installing slot ID)` and that handler's
   root-local body at depth zero. It does not propagate an ever-growing total depth into it.
3. Deduplicate stable tuples in the existing context worklist. Finite roots × finite local slots
   × finite selected variants/targets bound expansion. Mutually installing masked A and B revisit
   this finite set. No recursion-count setting or arbitrary expansion cap is introduced.
4. Ordinary call variants depend on root-private operands, local ownership depth when used, and
   selected callee labels. Retain canonical source function addresses for stored values and
   comparisons; the existing finite indirect-target selector chooses the correct call variant.
   Do not emit a runtime context selector or registry.

Do not merge distinct live installation positions just because the selected handler is identical.
Conversely, keep existing equivalent-choice canonicalization when slot, ABI, target choices and
relevant activation state are identical. That preserves the existing branch-context scaling test.

## 4. Exact IRQ Execution Proof

Extend the existing `storage/irq-stack.ts` walk; do not add a second reachability or instruction
analysis framework. It consumes the selected instruction sites and helper demands, plus the
finite context/slot bindings from §3. Keep the current NMOS `enabled` versus `eligible` distinction,
PHP/PLP state, ordinary JSR/RTS effects, nonreturning paths and CFG mask joins.

Its state additionally identifies the current root, suspended body roots, pending entry/chain
continuations and actual installation slots. At every reachable IRQ-recognition opportunity:

1. Walk the installed chain in order, respecting exclusive entries and nonreturning bodies.
2. Record the roots whose private homes overlap and the slots still live across that execution.
3. Before descending, detect recurrence of an already suspended handler root or an equivalent
   pending-entry cycle. Return an unbounded/unproved result, not another larger vector history.
4. Sequential chain traversal retires completed body-private liveness, but does **not** pretend
   the hardware frame, saved status or pending wrapper continuation has disappeared.

The recurrence proof is conservative, not a claim about every concrete run: each entry starts
masked; the incoming ownership prefix is immutable; the same conservatively reachable choices
and local balanced installs can repeat above that prefix; the external source has no event-count
bound. Thus suspended-root recurrence has no proved finite maximum. A source-level global counter
does not become an invented IRQ-source bound. This is the existing E10245 proof obligation, not
a ban on repeated finite installation.

Finite nesting such as A temporarily installing **exclusive** B, enabling IRQs, then masking and
restoring, remains legal when B cannot re-enter. Changing B to a chain that reaches suspended A
exposes a repeatable overlap cycle. A masked A/B installation cycle alone exposes no such cycle.

Cache keys must include the activation/continuation and installation distinctions on which the
result depends. Preserve canonical equivalent branches. Track deterministic witnesses for the
winning stack peak and root conflicts. Because a successful path has no repeated suspended root,
and each root has finite local slot demand, the installation/activation universe of this walk is
finite. Arbitrarily many sequential IRQ events reuse the same summaries.

## 5. SFA and Phase Order

The existing pipeline remains:

```text
exact source ownership + finite root/slot contexts
  → provisional inventory/placement → one symbolic instruction selection
  → IRQ overlap/stack facts → interference + finite SFA closure
  → binding → existing shared-RAM reclosure/rebinding → layout/serialization
```

Extend `StorageRequest` and `FunctionResultLocation` with optional `activationRoot: string`
metadata; absence retains the existing single-domain/direct-test contract. Use the same stable
key in machine request IDs, source call variants and selected helper demands. Hash it in the
existing inventory fingerprint. Do not change artifact schema versions for this internal fact.

The IRQ analysis returns the existing stack peak plus finite root-overlap, co-live-link and
link-versus-root facts. Feed these into `buildInterference` **before** allocation in `closeStorage`.
Preserve same-function lifetimes, call-live conflicts, main/IRQ/NMI isolation and helper conflicts.
Do not mark every new link permanently live merely for convenience: installation lifetimes own
their conflicts. Two slots may overlay only when the proof excludes simultaneous use; `$xxFE`
is a valid two-byte indirect pair, `$xxFF` is not.

The new compiler-only overlap record contains three deterministic sets: root-key pairs, saved-link
request-ID pairs, and link-ID/root-key pairs. The IRQ walk retains its source spans and route
witnesses for warnings; interference does not need a second witness store.
Carry it as optional `irqOverlap` on the existing analysis/complete-closure results; absence keeps
synthetic and non-IRQ inputs compatible. Real selected IRQ closure must supply it. The existing
`simultaneousIRQStackPeak` entry point and stack fields remain available, and `buildInterference`
accepts the optional overlap record alongside its existing arguments. No new public service export
or serialized schema is introduced. Certificate interference remains the final physical proof.

### Direct internal interface contract

`IrqOverlapFacts` is an internal readonly value in `storage/storage-types.ts` with
`rootPairs`, `linkPairs`, and `linkRootPairs`, each a readonly array of readonly two-string
tuples. The first two contain unordered pairs in canonical lexical order; `linkRootPairs` stores
`[savedLinkRequestId, activationRoot]` in that order. Each array is deduplicated and sorted
lexically. An empty array means the proof found no such conflict, not that all roots or links are
permanently live. `rootPairs` use the stable handler-root keys from §3; `linkPairs` use the exact
two-byte saved-link request IDs; `linkRootPairs` connects each live link to the private homes of
the named root. Global objects never acquire a root key.

Keep `simultaneousIRQStackPeak(program, helpers, startupBytes, instructionSites)` callable as-is.
Its optional fifth argument is the selected inventory's `readonly StorageRequest[]`, needed to
name link request IDs. Its result adds optional `irqOverlap: IrqOverlapFacts` without changing
`program`, `system`, or `route`. `buildInterference(inventory, helperCalls = [], irqOverlap?)`
consumes that record before allocation: root pairs conflict across root-private requests, link
pairs conflict by ID, and link/root pairs conflict between that link and the root's private
requests. It retains all existing lifetime, call, domain, and helper edges. `closeStorage` keeps
its three-argument signature; for selected IRQ inputs it derives the overlap from its existing
`StorageBinder.instructionSites` and inventory, passes it to interference before allocation,
and exposes optional `irqOverlap` on its complete result. No extra binder field or synthetic
selected-instruction adapter is introduced.

The direct selected fixture is a typed `WholeProgram` with main, chained A, and exclusive B;
`interruptRoutes` identify both installation operations and their profile-selected variants.
The same operation objects occur in the functions' blocks and in `instructionSites`; each
handler's binding identity is its root key, while the inventory names any saved links. The
main/A/B bodies use balanced `asm_php`/`asm_plp`, installs/restores, and explicit CLI/SEI
recognition boundaries. Set `startupStackBytes` to zero and change only
`hardwareStackCapacity - hardwareStackReserve` between 31 and 30. No fabricated runtime IRQ
context input is needed; the existing route/context analysis derives it from this program.
Select sink entries by `capability` (`c64.system.setIRQ` for A,
`c64.system.setIRQExclusive` for B) from `TargetProfile.interrupts.sinks`, then match each sink's
`variant` ID against `TargetProfile.interrupts.variants`. Each install is a `PlatformOperation`
whose single staged `arguments` value names a preceding `function-address` operation of
`interrupt-handler` type; restore has no arguments. `InterruptRoute.installation` is the exact
install operation object in the containing block. The direct stack probe needs no saved-link
request. For synthetic interference and binding probes, arbitrary stable request IDs are valid
when the same IDs occur in the overlap facts, inventory and symbolic operands; tests need not
guess a generated link-ID spelling.

For final-home tests, retain one symbolic `MachineProgram` and its binder. Close the same
inventory against two legal RAM windows, bind the unchanged symbolic program with each final
certificate through `bindMachineProgram`, and exercise `closeSharedStorage` for the existing
shared-RAM suffix path. A fixture with a preselected long-branch terminator tests that neutral
relaxation preserves the source instruction sites and IRQ effects. Compare the final bound
operands with that run's certified homes, and compare source sites, opcode/effect order,
call/chain boundaries, branch target, and scratch identities across the two results. The
already-owned machine and shared-storage functions are the observation points; this contract
does not add a re-lowering entry point.
The symbolic call is a `jsr` instruction with an absolute label operand. The predecessor chain
is a `jmp` instruction in indirect mode with a storage operand naming its two-byte link; the
link request is page-safe. A preselected `long-branch` terminator retains its inverse branch,
fallthrough, absolute jump target, flag use and five-byte cost. A complete
`closeSharedStorage(symbolic, binder, provisionalClosure, profile)` result contains
`certificate` (the new complete storage closure), `machine` (the program bound to that
certificate), and `layout`; compare `machine.program` against `certificate.certificate.homes`.

All candidate request identities exist before closure. Helpers may introduce only declared finite
candidates through the existing binder. No emitter invents storage after the final certificate.
Provisional homes are not safety or alias evidence: selection retains symbolic request identity;
required region and page-safe constraints survive specialization and are checked at final binding.
No value or link is copied merely to compensate for incorrect allocation.

Selected operations, call/return/chain boundaries, vector transactions, mask effects and stack
effects are stable through binding. Address-mode changes preserve instruction recognition sites.
Neutral branch-relaxation jumps must preserve that site's ownership, activation and stack state.
Exact duplicate helper sharing is valid only with identical physical scratch and equivalent stack
effects. Reuse the same selected facts during shared-RAM closure; retain its code-shape check.
Regression checks must demonstrate these semantic invariants at final emission. A later pass that
changes them must refresh the proof before acceptance. This slice adds no speculative re-lowering
loop or future optimizer framework.

For direct synthetic storage inputs without selected instruction sites, retain the existing
conservative behavior. Public check/build must use actual selected sites. No frontend import may
reach this backend analysis; existing import-boundary tests remain intact.

## 6. Machine Integration and Route Contract

Reuse `interrupt-specialize.ts`, `lower-platform.ts`, `lower.ts`, `lower-function.ts` and the finite
indirect-call path. Their context key must agree with inventory and the IRQ walker. Each setter
names its exact selected wrapper and installing slot; each restore names the current local top.
The wrapper binds its own predecessor ID, never an ambient depth recomputed later.

Extract only the touched entry/transaction functions from oversized `lower-c64.ts` to
`machine/lower-c64-interrupt.ts`; keep the existing public module seam through imports/re-exports
where needed. This is file-size containment of existing behavior, not another backend layer.
No other C64 operation is redesigned.

| Boundary | Required contract |
|---|---|
| Source identity | Callback-only interrupt functions; only reachable compatible entry variants emitted |
| Chain CINV | Preserve entry status around a binary-mode body; tail-jump through that installation's saved predecessor; no extra hardware frame for chaining |
| Exclusive CINV | Binary-mode body, pinned KERNAL restore tail at `$EA81`, final RTI restoring complete interrupted P including D |
| Ordinary helper | JSR/RTS, with every private home and helper scratch assigned to the invoking root |
| Vector transaction | Existing safe two-byte update, complete required status/register preservation and exact volatile access order; no hidden global mask policy |
| Completion | Account for recognition during epilogue instructions, including final source CLI; do not release a live frame early |
| Source/visibility | Selected cooperative KERNAL/I/O contract retained; deliberate source acknowledgement remains with the selected source owner, not invented by the compiler |

## 7. Shared State, Diagnostics and Evidence

Extend the existing effect-based warning logic to proved overlapping IRQ roots using the §4
witness. Emit W10211 for visible lost-update RMW and W10212 for visible multi-byte tearing, with
source-related evidence. Keep existing main/IRQ/NMI warnings stable and avoid duplicate messages.
Single-byte shared values remain one global; do not clone globals or silently mask a body.

| Failure | Existing handling | Authority |
|---|---|---|
| Restore below the handler-local prefix, unequal join, wrong top or raw-write-invalidated ownership | E10278, source-linked, no artifact | AR-P2/P3; Chapter 6 §7.8 |
| Unbounded/unproved overlap, ownership growth or unbalanced repeated self-install | E10245 with relevant execution-path evidence; retain existing exact diagnostic regressions | AR-P2; R5.17 |
| Proved finite stack/resource demand exceeds selected capacity | E10238 with used/available values, no artifact | AR-P2/P5 |
| Internal context, certificate or binding inconsistency | Existing compiler failure path, no partial publication; never label it source success | AR-P2/P5 |
| NMI source/update proof absent | Existing rejection unchanged | AR-P4/P6 |

Use current `.asm`, `.labels`, `.memory.json`, `.costs.json`, `.debug.json` and public generation
results. Adjust existing source-to-machine mapping only where specialized labels require it.
Do not invent a route-report schema or validator. The bounded closeout document records each
introduced route's source, entry, acknowledgement, terminal, enabled peers, nesting, bank visibility,
link homes, private interference and actual artifact references.

## 8. Output Quality and Completion

Complete costs must separate emitted body/wrapper/installer/restore/data bytes, RAM/ZP/link bytes,
hardware-stack peak and path cycles. Existing ROM contributes time and retained stack, not output
bytes: report the 16-byte PULS-to-CINV sequence and applicable 6-byte `$EA81` tail separately.
Include startup/restoration and nested-route costs; do not add mutually exclusive chain maxima.
New exact artifact sizes and measured totals remain **Unknown** until execution.

Root/context identity itself has zero runtime instruction cost. Keep literal link/entry references
and direct ordinary calls. Do not create duplicate helper bodies when the existing specialization/
sharing path can use identical homes and targets. No new optimization barrier, forced volatile
private memory, blanket masking or hidden copying is allowed.

For ordinary root-specialized bodies that become byte-identical after binding, extend the existing
exact-physical sharing pattern in `bind.ts` narrowly: equal opcodes, operands, control targets,
scratch and stack effects may share one body. Do not merge wrappers with different predecessor
tails or canonical source function identities. No equivalence optimizer or new pass is needed.

Independent behavior and hand-derived assembly/cost expectations are owned by
[ST-1–ST-30](07-testing-strategy.md#specification-test-cases). Generated-versus-unoptimized comparison
alone is insufficient. Compare like-for-like routes and preservation obligations against expert
assembly; pursue a beat, and record a measured, actionable GitHub gap whenever only meeting is
possible, under AGENTS.md authority. Do not declare a worse result qualified or silently convert
a discrepancy into a source restriction. Any required larger remedy reopens the complexity gate.

Bounded completion requires those tests, full verification, independent phase review, exact
AR-P3/P6 oracle edits and the DEF-8 retirement evidence. NMI stays open, and RD-05 stays incomplete.
Use `VICE-verified / hardware-unverified` for the new executed routes, never universal silicon proof.
