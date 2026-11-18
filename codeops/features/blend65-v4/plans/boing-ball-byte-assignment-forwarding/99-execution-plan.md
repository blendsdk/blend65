# Boing-ball byte arithmetic assignment forwarding

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Owner**: [#168](https://github.com/blendsdk/blend65/issues/168); bounded continuation, not parity closeout
> **Progress**: 0/6 tasks (0%)
> **Status**: Executing — independent preflight passed; additive specification authoring
> **Baseline**: `ec8a696e`, clean green local checkpoint; no push
> **Phase baseline tree**: `d9fb65a8ddf111f5f1cb2e8c01179e35c6d04e8e`
> **Scope**: strict
> **Reasoning**: high — anonymous storage observation, arithmetic flags and pre-emission lifetime
> **Created**: 2026-11-18

## Objective and scope

Remove only the anonymous capture/reload between an unsigned wrapping byte `+`/`-` result and
its sole immediately adjacent whole-variable byte assignment. Preserve every original operand
evaluation, named load/store, volatile access, flag outcome and canonical `optimization: "none"`.
Ordinary unsupported source retains existing lowering, without a new diagnostic or restriction.

**Planning target:** the next bounded #168 unit. **Context:** the completed low-byte unit,
current source/lowering/storage interfaces, unchanged publication/observer certificate, exact
fresh boing baseline and equivalent 442-byte twin. **Modification set:** this mini-plan and its
review/evidence records, derived feature roadmap, existing `byte-write-forwarding.ts` selector,
its one caller in `lower-function.ts`, additive specification/implementation tests and one
freshly measured downward boing implementation-cost pin. Existing specification tests have no
edit authority.

Do not alter arithmetic/store/retention lowerers, proof/observer machinery, source/assets/twin,
startup/layout/IRQ contracts, frozen specification/expert, shared helpers/timeouts, hidden
configuration or optimization policy. No new pass, analyzer, solver, runtime, framework,
dependency, cache, harness or cross-cutting refactor. A demonstrated need for a material support
mechanism or upstream oracle correction stops this unit for exact user-owned authority.

## Grounded baseline and smallest viable design

Fresh canonical public generation `87f78493-2811-43e1-9072-b56462a096d0` reproduces PRG SHA-256
`b8f5771116ba30b40851604c0a714954dc6970e19ce7c28d4534d0a4fc659d77`.
Code 1,193, SFA37, resident RAM7,253, entry326, snapshot49, assets1,024, BASIC12, padding4,938,
payload7,167, ZP/scratch0, reported hardware-stack resource1. Equivalent twin442; remaining
code gap751. Hardware stack1 is not an unrestricted firmware/interrupt aggregate bound.

The primary traversed all52 original blocks and complete operation/branch/return uses.
Seven reachable byte arithmetic results have one total use and an immediate empty-path byte
store. Their integer semantics are width8, unsigned, wrapping. Two are variable-plus-variable;
five use direct constants. The unchanged certificate succeeds with nine publications.
Each baseline CPU16 home is a distinct one-byte retained-value request:

| Result | Block/index | Operator | Anonymous → named destination | PC of `STA H; LDA H; STA named` | Actual bytes |
| --- | --- | --- | --- | --- | --- |
| `v80` |6/9 | `+`, runtime RHS | `$244B→$2455` | `$0A4D` | `8D 4B 24 AD 4B 24 8D 55 24` |
| `v112` |16/2 | `+2` | `$243D→$244D` | `$0BBC` | `8D 3D 24 AD 3D 24 8D 4D 24` |
| `v115` |17/2 | `-2` | `$243E→$244D` | `$0AB6` | `8D 3E 24 AD 3E 24 8D 4D 24` |
| `v134` |30/2 | `+1` | `$243F→$2452` | `$0AFF` | `8D 3F 24 AD 3F 24 8D 52 24` |
| `v142` |33/2 | `+1` | `$2440→$2450` | `$0C52` | `8D 40 24 AD 40 24 8D 50 24` |
| `v159` |39/2 | `-1` | `$2443→$2450` | `$0BE0` | `8D 43 24 AD 43 24 8D 50 24` |
| `v186` |44/6 | `+`, runtime RHS | `$2445→$2455` | `$0C1F` | `8D 45 24 AD 45 24 8D 55 24` |

Each exact nine-byte core occurs once in actual CPU16 code, not in device projections/assets.
Removing its first two instructions predicts42 code bytes and seven capture demands saved;
each executed site saves eight nominal CPU cycles. Sites occur on different paths: neither
56 cycles/frame nor a whole-frame improvement is established. Code can turn into padding, not
payload savings. Complete post-change costs and any branch-layout effects must be measured.

Independent Astra challenge `ses_e10ffcb40ffeUsLKeOnvdWT7QF` converges on this unit:
same byte emitter and store consumer, but word assignments change low/high scheduling and need
a separate proof. Constants-only loses two same-seam sites without avoiding the observer proof.
Reload-only saves half the traffic and no homes. Shifts/multiplication and high-byte branches
have different producer or flag ownership. They remain outside this unit.
Confidence: high in the traced seam; measured future benefit remains unverified.

### Existing seam

`lower-arithmetic.ts:57–86` already produces the byte result in A with binary `CLC/ADC` or
`SEC/SBC`. `lower-state.ts:680–687` bypasses capture allocation for selected IDs.
`lower-operation.ts:512–522` consumes A directly for an empty-path byte store.
The existing caller union is `lower-function.ts:335–345`. No new lowerer or state field is needed.

Extend the existing selector signature with an optional internal opt-in:

```typescript
selectAnonymousByteWriteValues(
  input: MachineLoweringInput,
  source: SemanticFunction | undefined,
  blocks: readonly SemanticBlock[],
  singleUseValues: ReadonlySet<string>,
  includeNamedArithmeticStores?: boolean, // defaults false
): ReadonlySet<string>
```

The only production caller passes `true`. Four-argument callers retain the exact current raw-write
contract, including named-store rejection. This is not a user option or optimization mode.
Reuse the same definitions, complete-use/reachability scans, candidate set and one final unchanged
publication-certificate query. No second selector traversal/query or generic policy engine.

### Exact new arm

1. Explicit opt-in is true.
2. Producer is binary `+` or `-`, scalar `byte`, integer width8, unsigned and wrapping.
   Both runtime operands and constants are supported; no operand read or materialization is
   removed by this arm. BCD, signed, word, other operations and conversion chains are excluded.
3. Producer result belongs to supplied single-use values and has exactly one independently counted
   operand/terminator use over all original blocks, including cold blocks and hidden place indices.
4. The immediately following operation is `store` of that result, scalar `byte`, empty place path
   with scalar-byte root type. No gap, indexed/field destination, width conversion, merge,
   raw destination, branch or return consumer.
5. Existing actual-source/program/main association, exact block identity/order, graph validity and
   reachable-producer requirements hold. The unchanged whole-window publication certificate
   excludes globals/parameters, escaping roots, helpers, source-installed interrupts and uncertain
   raw/hardware/firmware observers. Missing/stale proof facts select ordinary lowering.
6. Add only the arithmetic result ID to the existing forwarding set. Named binding/storage/store
   and operand operations remain; no binding elision, INC/DEC/RMW substitution or flag-forwarding
   authority is introduced.

For binary arithmetic, A/N/Z already describe the byte result. Removing an anonymous `STA/LDA`
pair preserves A/N/Z/C/V, X/Y/SP/D/I. STA does not change flags. This reasoning does not extend
to NMOS decimal arithmetic. Named-store order stays exactly where the source store was;
there is no low/high-byte scheduling change. Selection happens before capture storage discovery,
not after allocation.

## Independent specifications and acceptance

Implementation-blind Sol author receives only this contract, allowed type declarations,
public fixture signatures and normative excerpts; no implementation bodies, generated artifacts,
implementation tests, old test/oracle bodies, qualification cases/maps/graders or prior verdicts.
Imports do not grant read authority. Primary owns all shell/RED/VICE execution.

Author only additive `byte-assignment-forwarding*.spec.test.ts` files under
`packages/compiler/src/machine/` and `test/rd05/`, split by concern near200–300lines.
A small component-local source-to-closure/mutation adapter may be mechanically extracted before
freeze by the primary if needed; reuse existing local fixture public signatures where practical.
No new shared test infrastructure or runner. Freeze all new oracles and consumed fixture hashes
before implementation. No existing oracle edits, skips or weakened thresholds.

| Boundary | Independent expected result |
| --- | --- |
| Opt-in positive | Both byte `+` and `-`, direct constants including0/255 and runtime RHS, same or different private destination: select only the arithmetic result, never an operand or named binding. |
| Default control | Four-argument call keeps named-store rejection; old raw byte-add and low-byte-write cases remain selected exactly as before. Opt-in does not extend raw subtraction/runtime arithmetic or low-byte named stores. |
| Negative shapes | Signed/word/BCD/other operators, wrong result/store/root types, nonwrapping arithmetic, indexed/field/converted/gapped/multiple-use/branch/return consumers keep ordinary lowering. |
| Graph/use/proof barriers | Cold/terminal/hidden-index extra use, forged single-use set, foreign/cloned/reordered body, cold producer, malformed entry/successors, missing domain/context, metadata-only, global/parameter/helper/initializer/IRQ, escaping address, raw-home/unknown address/CIA/low-RAM routing observation: no new IDs. |
| Public output, four cooperative profiles, canonical none | Preserve original operand loads and carry establishment; ADC/SBC result goes directly to original named STA without anonymous pair, alternate scratch or named-store removal. Independently check assembly and actual CPU16 code bytes. Unsupported legal source still compiles. |
| Boing, unchanged source | All seven selected capture homes gone; complete code at most1,151, SFA at most30, resident at most7,246. Entry326/snapshot49/assets1,024/BASIC12/helper0/payload7,167/ZP0/scratch0/reported stack1 remain; reconcile code+assets+padding+BASIC+helpers=payload. Preserve EOR raster poll, four hi-branch captures, word arithmetic staging, source trace and frame state. |
| Independent runtime | For addition/subtraction with seed `$A5`, constant37 or runtime `step:byte=37` increasing by1 after publication, calculate each of257 modulo256 results and C/V/N/Z independently. Named byte memory, A and MMIO value agree; D=0 and I/SP stable. Exact257 named destination stores and257 device writes in source order during the measured interval. |

Runtime source `module Game; function main():void {let value:byte=$A5; let step:byte=37;
while(true){value=value+step;poke($D005,value);step+=1;}}`, with separate `-` and constant37 forms.
Locate unique application `STA $D005` only within actual CPU16 code; derive named destination
from the immediately preceding ordinary named-byte load and cross-check its SFA interval.
Pre-first-store stop is before the **first named assignment store**, so the traced interval includes
the first assignment. Trace that named address and `$D005` with non-stopping store tracepoints.
Sample post-device-store via execute stops, armed before resume; collect independent257 state
observations. After sample257, stop before the next named assignment store and drain exactly257
named/257 device writes, verifying alternating event order. Do not advance to a boundary that
already executes the258th assignment. Exclude initialization from traces.

Keep shared monitor/source helper/safe-return and original20-second waits unchanged.
No register `.pc` member: `waitForStop` returns the exact PC; registers expose A/X/Y/P/SP.
Existing30-second directed stop wait/300-second test envelope may be reused, never increased
to hide a failure. If a new source/address adapter rejects, classify setup separately from
meaningful RED. Selector/output must fail for the missing behavior, not a nonexistent export.
The optional fifth-argument contract can be expressed by a typed wider callable declaration:
TypeScript accepts the current four-argument function as that callable before implementation.
Do not create a missing-module RED or implement selection before oracle freeze.

## Review, verification and authority

Compiler/language lens. Existing six roles cover correctness/oracle integrity, semantics/DX,
SFA/ABI, emitted code, platform and host scaling. **Specialist check: None** — existing
specialists plus bounded packets cover this same seam; no new capability/charter is needed.
Preflight assigns all13 dimensions once in five clusters and an additional compiler-domain lens.
No new host-input/process/security mechanism, format migration or concurrency route.

Context: C64 PAL NMOS6510, VIC6569, KERNAL cooperative6581 PRG, bank0/screen `$0400`/pointers `$07F8`;
public/runtime qualification also covers NTSC/VIC6567 and6581/8580. ACME0.97/VICE3.10.
BASIC/KERNAL owns loading and existing startup; no generated interrupt route/loader is added.
Existing stock routes remain unchanged. Loading time, elapsed initialization, whole-frame
timing, external IRQ/NMI aggregate stack/completion/deadlines and physical behavior remain Unknown
unless separately measured. Runtime result is VICE-verified / hardware-unverified.

Expert2.0.4, active qualified/frozen, immutable content
`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`; router SHA-256
`0760ec9d73fc7ed0e8575eb22d3fa9e5bdd2388d27b3989233239342c0b35ad8`;
specification `BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b`.
Normative headings: `6502-lowering-casebook.md#addition-and-subtraction`,
`mos-6502-family.md#status-flags-as-dataflow`, `sfa-and-abi.md#final-storage-closure`,
`blend65-semantics.md#semantic-preservation-checklist`,
`evidence-parity-and-recovery.md#transformation-proof`/`#equivalent-work-accounting`,
`c64-game-engineering.md#machine-bound-workload-completion-gate`.
Source keys `BLEND65-SPEC-4-038b70e9`, `MOS-PGM-1976`, `CBM-C64-PRG-1982`.
Historical crosswalk preambles incidentally read during primary navigation are excluded from
decisive authority. No qualification answer maps or cases are used.

## Tasks

- [ ] T-168.35 Independently preflight this bounded plan, author additive specifications, validate setup, establish meaningful RED and freeze before production implementation.
- [ ] T-168.36 Add only the opt-in selector arm and one caller opt-in; pass new/old selector/public specifications with frozen hashes and no lowerer/proof changes.
- [ ] T-168.37 Verify independent runtime plus unchanged boing startup/source trace/frame/poll; measure complete output/storage/padding costs and update only the downward implementation pin.
- [ ] T-168.38 Add implementation controls for complete uses/identity, one certificate query, bounded traversal and absent final capture demands; run directed compiler/host regressions.
- [ ] T-168.39 Obtain all six independent execution reviews against the actual baseline/delta; resolve/reverify findings only within exact authority, stopping for reserved scope/oracle decisions.
- [ ] T-168.40 Run final frozen install/build/typecheck/formatting, changed+host, fresh host and actual complete serialized VICE checkpoint; record residual/deferral evidence, sync feature roadmap, commit green locally via git-commit skill and clean owned temps. Never push or close #168.

**Task verify:** explicit new selector specification files plus existing byte-/low-byte-write and
publication tests; new public output with unchanged poll/cost cases; affected VICE serially.
Use scoped Vitest commands declared by existing configs. `yarn test:changed --host`, then
`yarn test` before normal checkpoint; final `yarn install --frozen-lockfile`, `yarn build`,
`yarn typecheck`, `yarn test:full`. Full corpus is not per-edit verification. A further safe-return
timeout requires bounded diagnosis before another complete invocation, never automatic retry.
Protect frozen `spec/`, expert, old tests and source with recorded hashes. All scratch/logs under
owned `$CODEOPS_TMPDIR` root, cleaned after durable recording. Native denials/secret boundaries
apply to every role; a permission allow never expands task authority.
