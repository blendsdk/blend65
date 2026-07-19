# Current State

Everything below was read from the tree at plan time, not inferred, with one stated exception:
**`balloon` has no committed golden**, so its block structure (`Main_main_L0` a trampoline,
`Main_main_L5` the post-poll frame body) is derived from a live compile at plan time rather than
read from a file. The same claims for `rasterpoll` and `guards` are read directly from their
goldens. Line numbers are as of commit `c06a10f` on `feat/asm-parity`, corrected at preflight.

## The three seams

| Seam | Where | State today |
|---|---|---|
| **A — IL pass pipeline** | `packages/compiler/src/api/emit.ts:108` → `optimizeIL(il, [], run.bag)` | Always runs; **zero** passes registered. `ILPass` contract at `codegen/src/il/optimizer/pass.ts:21-32`; runner folds passes left to right (`optimize-il.ts:27-37`). One call site only. |
| **B — Translation** | `packages/codegen/src/instr/translate.ts:264-284` (`for (const block of this.fn.blocks)`) | The only place block **adjacency** exists. `translate.ts` is 2250 lines against the project's 500-line guideline, which is why the tail decision is extracted rather than grown here (AR #33). |
| **C — Instruction peephole** | `optimizeInstr`, `packages/codegen/src/instr/peephole.ts:145-158`; called at `emit.ts:139-141` | `V1_RULES = []`, scanner explicitly deferred. Gated on `run.config.optimize` (default `true`, `packages/config/src/defaults.ts:38`). Ruled non-viable for layout (AR #26); it is RD-06's home. |

`emit.ts` is a **single choke point** — `optimizeIL`, `assembleProgram` and `optimizeInstr` each
have exactly one production caller, all in that file. `emitIl` and `emitAsm` share
`lowerProgram()` (`emit.ts:87-109`), so registering the IL passes there makes `--emit-il` honest
by construction (AC-11) with no second wiring.

## The four sites that emit a trailing jump

All in `packages/codegen/src/instr/translate.ts`:

| Site | Lines | Shape emitted today |
|---|---|---|
| `br` | 602-603 | `JMP <target>` |
| `brcond` | 605-608 | `BNE <true>` · `JMP <false>` |
| `emitCmpTail`, branch arm | 1141-1149 | `<branch> <true>` · `JMP <false>` |
| `wordUnsignedOrdered`, branch arm | 1250-1256 | …decision… · `JMP <false>` |

`emitCmpTail` serves four of the five framings — 8-bit unsigned/equality (`:1129`), 8-bit signed
(`:1199`), 16-bit equality (`:1229`), 16-bit signed (`:1326`). The fifth, 16-bit unsigned
ordered, ends in its own `JMP` at `:1254`. So four sites cover all five framings plus `br` and
`brcond`.

**Framing-internal branches must never be inverted**, and they are structurally distinguishable
only at this level: `wordUnsignedDecision` (`:1279-1300`) emits branches to *block* labels
mid-framing, `wordEquality` (`:1211-1219`) sends its low-byte early-out straight to a block edge,
and `byteSignedOrdered`/`wordSignedOrdered` branch over an `EOR` correction to a minted `_cmpN`
label. After translation none of these is distinguishable from a block tail by anything but
naming convention — which is the real reason elision cannot be a post-translation stage. Labels
themselves *do* survive the flat stream (`packages/core/src/instr-model/stream.ts:54-63`); what
is lost is branch-tail identity.

## Block labels

- Entry block: emits `sanitize(fn.name)` — `translate.ts:247` — and is skipped by the per-block
  label push (`:266-268`).
- Non-entry: `blockLabel()` at `:381-383` → `Main.main` + `_L0` → `Main_main_L0`.
- `blocks[0]` is always the entry block (`il/cfg.ts:88`), so the *next* block is never the entry
  and the adjacency comparison can be made on **IL labels** (`term.target === blocks[i+1].label`)
  without touching the emitted-name schemes at all. This sidesteps the mismatch the RD flags.
- Latent, pre-existing, out of scope: a terminator targeting `_entry` would render
  `JMP Main_main_entry`, a label never emitted. No lowering path produces it (loops mint
  dedicated header blocks), and it fails loudly at ACME rather than miscompiling. Threading
  cannot introduce it — it only forwards to targets that already existed.

## What the transforms do to the corpus — traced by hand

`rasterpoll.asm.golden`, blocks `_entry → L0 → L1 → L3 ⇄ L4, L3 → L5 → L0`, plus a dead `L2: RTS`:

```
threading   L4 (br L3) is a trampoline → the fused true edge retargets to L3
            _entry, L0, L1 are trampoline chains → all forward to L3
removal     L0, L1, L4, L2 unreachable → dropped
elision     _entry's br L3 → L3 is next → suppressed
            L3's false edge → L5 is next → the JMP is suppressed
```

leaving exactly the twin's idiom:

```
_main:
Main_main_L3:
    LDA $D012      ; 4
    CMP #$FB       ; 2
    BNE Main_main_L3   ; 3 taken
Main_main_L5:
    …frame body…
    JMP Main_main_L3
```

3 instructions, 7 bytes, **9 cycles** on the polling path (AC-3). The committed `pollIter`
window measures the whole static slice `L3 → L5` and reads **15** today
(`4+2+3+3+3`); after the change that slice *is* the three instructions, so it reads **9** too.

`guards.asm.golden` `compoundGuard` (`L7 → L9`) is the inversion showcase. Today
`LDA/CMP/BCS L11/JMP L10/LDA/CMP/BCC L9/JMP L10` = **24** static cycles. `L11` follows `L7`, so
`BCS L11 / JMP L10` inverts to `BCC L10`; `L9` follows `L11`, so `BCC L9 / JMP L10` inverts to
`BCS L10` — **18**. Both numbers are re-derived from the regenerated golden, never assumed.

## Artifacts this change invalidates

### Label-anchored (all four are `Main_main_L0`, a pure trampoline this change deletes)

| Artifact | Line | Mechanism |
|---|---|---|
| `test-harness/src/rasterpoll.spec.test.ts` | `:21` | `LOOP_HEAD_LABEL` → `loopHeadLabel` for an `arrivals` landmark |
| `test-harness/src/guards.spec.test.ts` | `:27` | same |
| `test-harness/src/balloon.spec.test.ts` | `:24` | same |
| `test-harness/test/golden/budgets.json` | `:56` | balloon `frameUpdate.toLabel` |
| **`test-harness/src/run/label-arrivals.spec.test.ts`** | `:54-69` | **not in the RD's list** — reads `_main`'s first 3 bytes, asserts `0x4C` (AR #35) |

The `arrivals` mechanism is `assertObservables` → `runUntilLabelArrivals`
(`src/testing/observables.ts:118-142`): it stops the machine at the n-th arrival of the label.
After threading, both the frame back-edge and the poll back-edge land on the **poll** block, so
anchoring there would count poll iterations and stop inside the first frame with no body run —
green tests asserting nothing. The surviving once-per-frame program point is the post-poll
frame-body block (`Main_main_L5`), which `budgets.json:55` already uses as balloon
`frameUpdate.fromLabel`.

### Spec / impl oracles

| File | Exposure | Disposition |
|---|---|---|
| `codegen/src/instr/translate-brcmp.spec.test.ts` | `fusedFn` (`:86-99`) builds `_entry`/`_L1`/`_L2` with `_L1` = true target **and** next block → inversion fires on the **41 fused cases** (of 47 expected arrays: 40 `it.each` matrix rows + 1 fused deferred-load case; the other 6 are `expectValue` single-block value tails, unaffected) | **Preserved** via an interposed non-target filler block; every per-row `expected` stays byte-identical, only `expectFused`'s scaffold (`:143-153`) grows (AR #31) |
| `codegen/src/instr/switch-translate.spec.test.ts` | `:63-64` regexes assert `CMP / BEQ / JMP` through the real pipeline | **Superseded in writing** to the post-layout shape (AR #24 procedure) |
| `codegen/src/instr/translate.impl.test.ts` | `:449-463` full-text `toBe` (carrying the branch pair at `:454-455`); `:526` `toContain` | **Filler block** (AR #36). The `:454-455` branch-pair lines and the `:526` `toContain` stay byte-identical; the `:449` full-text array grows by the filler's label and `RTS`, because unlike `translate-brcmp` this file has no shared scaffold helper |
| `codegen/src/il/multiblock-translate.spec.test.ts` | `:58` `toContain("JMP")`, `:70` `/JMP\s+Main_main_L\d+/` | **Unaffected** — back-edge jumps survive; re-checked at plan time |
| `codegen/src/instr/{generate.golden,translate}.spec.test.ts` | `JMP _cmp1` | **Unaffected** — value-form tail, not a block tail |
| `test-harness/src/golden-{guards,rasterpoll,slice8}.spec.test.ts` | structural `toContain`/`toMatch` | **Unaffected** — loose enough; `JMP _main` is the cross-function shim jump, deliberately kept |
| `compiler/src/acme/report-file.impl.test.ts:112` | the string `"JMP Indirect"` | **Unaffected** — an addressing-mode name |

### Budget windows (all four move)

`test/golden/budgets.json` + the two hand-derived constants in
`test-harness/src/budgets.spec.test.ts:73,86`, whose derivation comments must be re-transcribed
from the regenerated goldens:

| Program | Window | Kind | Today |
|---|---|---|---|
| `rasterpoll` | `pollIter` L3→L5 | perIteration | 15 |
| `guards` | `compoundGuard` L7→L9 | perIteration | 24 |
| `slice8b` | `copyLoop` L0→L3 | span | 60 |
| `balloon` | `frameUpdate` L5→L0 | span | static 235, **measured 133** |

`windowSlice` (`budgets.spec.test.ts:139-159`) has two modes: a plain address range when
`to > from`, and — for a back-edge window like balloon's — a forward walk to the first transfer
instruction whose operand is `to`'s address. Balloon's `toLabel` must therefore become the
threaded back-edge's new target, and the plan verifies no *earlier* transfer inside the frame
body also targets it.

### Routing

`test/golden/twins.json` carries seven affected rows: `guards` (#51 ×2, plus a #59
"unreachable epilogue" row that moves to #51), `rasterpoll` (#51 ×2), `balloon` (#51 ×2). Their
free-text notes ("JMP 23 vs 1", "JMP 7 vs 1", "JMP 21 vs 3") are **not** validated by the
freshness gate (`scripts/gen-parity-scoreboard.mjs:97-107` checks routing categories only), so
refreshing them is a hand-review item CI cannot catch.

## Report costing

`packages/compiler/src/api/build.ts:92-93` reads `assembled.program` for the cost summary and
`preambleOptions`. The relaxation stage therefore must return a program that becomes **both**
the serialized text and `AssembledAsm.program`, preserving `preamble`, `allocationPlan` and
`preambleOptions` — otherwise relaxed branches are under-reported.
