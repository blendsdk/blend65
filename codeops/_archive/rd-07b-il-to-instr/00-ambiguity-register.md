# RD-07b IL→Instr Translation, Register Binding & `generateInstr` — Ambiguity Register

> **Document**: 00-ambiguity-register.md
> **Parent**: [Index](00-index.md)
> **Status**: ✅ GATE PASSED — D1–D8 resolved at planning (2026-06-06) / D9 resolved during execution (2026-06-07) / D10 resolved during execution (2026-06-07 — Phase 2)


> **Last Updated**: 2026-06-07


> **Purpose**: Plan-level Zero-Ambiguity Gate. Every RD-07b plan decision that is *not*
> already fixed by the frozen `spec/` (Ch 04, 05, 06, 11), by the (authored, non-frozen)
> `requirements/RD-07-codegen-instr.md`, or by the completed RD-07a plan, is recorded here
> — with its resolution — before any document or code depends on it.

## Scope of this register

RD-07 (`requirements/RD-07-codegen-instr.md`) specifies the **whole** 6502 code generator.
RD-07a already shipped its **stable core** (the `Instr`/`Label`/`Directive` model R1–R13, the
NMOS-6502 CPU validation table + validator R14–R16, and the canonical ACME serializer
R52–R54) under `@blend65/codegen/src/instr/`, taking a `cpuVariant` primitive (RD-07a D2).

RD-07b is the **consumer-coupled remainder**: IL→`Instr` translation (R17–R39), register
binding (R40–R45), `InstrProgram` assembly + `generateInstr` (R55–R58), and source-span
propagation (R50–R51). Per RD-07's own banner, this remainder lands *"once RD-10
(`PlatformProfile`) and RD-06's full lowering land."* **Neither is ready:**

1. **RD-10 (platform plugin system) still does not exist.** `@blend65/platforms` is the empty
   `VERSION = "0.1.0"` stub — no `PlatformProfile` type (only the interim RD-04/RD-05 core
   stub, explicitly marked `DEFERRED(RD-10)`), no CPU-variant declaration, no codegen hooks
   (startup stub, binary format, char encoding). The platform-hook requirements (R46–R49)
   therefore have no concrete input to consume.
2. **RD-06's lowering is a walking-skeleton slice** (RD-06 D1/D5). `lowerToIL` emits IL only
   for the **gate/slice-2 surface**; the wider IL op space is model-complete but not produced
   by any live lowering. A "full" R17–R39 translation would translate ops no live lowering
   emits — fixtures-only code with no end-to-end verification.

This is the same "feature sits between two not-yet-finished stages" situation the **AR-38
walking-skeleton methodology** governs, and which the project already resolved for
RD-04→RD-04b, RD-11→RD-11a, and **RD-07→RD-07a/RD-07b** itself. The user's standing
strategic direction is *"I don't want to come back and refactor — give me the best,
no-rework path."* RD-07b therefore follows the **slice** discipline: build exactly what the
**live** lowering + the **stable** RD-07a foundation can support end-to-end today, defer the
genuinely-blocked remainder (platform hooks; ops no live lowering emits) to a later
**RD-07c**, and take a `cpuVariant` primitive — never a fabricated `PlatformProfile`.

Items D1–D8 below were resolved on 2026-06-06 during plan authoring, before any plan
document depended on them. D1 (the slice scope) was presented to the user as Options A–D and
the user selected **Option A (slice matching RD-06's live lowering)** and explicitly
delegated the sub-scoping to the planner's recommendation. The gate is **PASSED**.

---

| # | Category | Ambiguity / Gap | Options Presented | Decision | Status |
|---|----------|-----------------|-------------------|----------|--------|
| D1 | Scope / Strategy | RD-07b's stated deps (RD-10 profile, RD-06 full lowering) are absent. How much of R17–R58 to build now? | A: **slice matching RD-06's live lowering** — translate only the IL ops lowering emits today + register binding + `InstrProgram`/`generateInstr` taking `cpuVariant`; defer platform hooks (R46–R49) and not-yet-lowered ops to RD-07c · B: full R17–R39 against the interim core profile stub + complete IL model · C: build RD-10 first · D: reconsider | **A** — live-lowering slice; defer the blocked remainder to RD-07c | ✅ Resolved (user-selected) |
| D2 | Dependency / API | RD-07 §4.7 entry point is `generateInstr(ilProgram, profile, bag)`; RD-10's `PlatformProfile` does not exist. What does the entry point take? | A: **`generateInstr(ilProgram, cpuVariant, bag): InstrProgram`** — extend RD-07a D2 forward; `cpuVariant: CpuVariant` primitive picks the validation table; the `AllocationPlan` is already carried inside `ilProgram.allocationPlan` (RD-06 cfg.ts), so no separate plan arg. When RD-10 lands, the caller passes `profile.cpuVariant` additively · B: fabricate/consume the interim core `PlatformProfile` stub · C: thread the real RD-10 profile (blocked) | **A** — `cpuVariant` primitive; `AllocationPlan` read from `ilProgram` | ✅ Resolved |
| D3 | Scope / Translation set | Which exact IL ops does the first slice translate? `lowerToIL` emits: `load`, `store`, `const`, the `lowerBinary` set (`add/sub/mul/div/mod`, `and/or/xor/shl/shr`, `eq/ne/lt/le/gt/ge`), and the `ret` terminator. | A: **translate exactly that live set** — `load`/`store`/`const`, arithmetic/bitwise/shift/comparison binary ops, `ret`. Ops the live lowering never emits (`neg`/`not`, `load_indexed`/`store_indexed`, `load_indirect`/`store_indirect`, `copy`, `call`, `intrinsic`, `source_span`; the `br`/`brcond`/`unreachable` terminators) reach a translation **default arm** that raises an `E90001` ICE and is **deferred to RD-07c** · B: translate the whole R17–R39 model now | **A** — translate the live set; ICE-default + defer the rest | ✅ Resolved |
| D4 | Scope / mul·div·mod | `lowerBinary` maps `*`/`/`/`%` to `mul`/`div`/`mod`, which per R21/R22 lower to `JSR __rt_mul8`/`__rt_div8`/… runtime routines whose **bodies** are RD-17's domain (not yet built). Include or defer? | A: **include the *call-site* codegen now** — constant-fold (both operands known) → no code; constant power-of-2 `mul` → shift sequence; otherwise emit `JSR __rt_<name>` + the W10170/W10171/W10172 cost warning (R21/R22/R60). Emitting the `JSR` to a symbol resolved at link time needs **no** RD-17 routine present; the routine body links later (RD-17, AR-30) · B: defer all of mul/div/mod to RD-07c | **A** — emit call-site (fold / shift / `JSR __rt_*` + warning); routine bodies remain RD-17 | ✅ Resolved |
| D5 | Scope / width | The live lowering is byte-dominant but params/addresses are `IL_WORD` (16-bit). Cover 16-bit now? | A: **cover both widths for the translated ops** — 8-bit (`LDA`/`STA`/`CLC`+`ADC`/`SEC`+`SBC`) and the 16-bit lo/hi sequences (R19), driven off each operand's own `ILType`. 16-bit is unavoidable because word-typed frame slots already flow through `load`/`store` live · B: byte-only first, defer word to RD-07c | **A** — both widths for the in-scope ops (per the operand `ILType`) | ✅ Resolved |
| D6 | Naming / layout | Where do the translator, register binder, and program assembler live in `@blend65/codegen`? | A: **`instr/` directory (extend RD-07a's)** — `instr/translate.ts` (IL→`Instr`), `instr/register-binding.ts` (temp→A/X/Y+ZP), `instr/instr-program.ts` (`InstrProgram` + `generateInstr`), each < 500 lines (code.md r21). Reuses RD-07a's `stream`/`operand`/`validate`/`print-instr` siblings, consumes `il/` read-only · B: a new `codegen/` directory · C: nest under `il/` | **A** — extend `instr/`; consume `il/` read-only | ✅ Resolved |
| D7 | Process / Diagnostics | Unsupported (deferred) IL op during translation, and a translation that produced an illegal opcode+mode. Which diagnostics? | A: **reuse `IceCode.Unexpected` (`E90001`)** for both the deferred-op default arm (mirrors RD-06 D6 / RD-07a D6) and post-translation validation (run RD-07a `validateStream` over each emitted `InstrStream`). Cost warnings use the existing user-band W10170/W10171/W10172 (R60). No new diagnostic codes · B: add dedicated `E9xxxx`/`W10xxx` codes now | **A** — reuse `IceCode.Unexpected` + existing W-codes | ✅ Resolved |
| D8 | Process | Commit mode for execution. | ask / no-commit / auto-commit | **no-commit** (consistent with RD-01..RD-06/RD-07a/RD-11a) | ✅ Resolved |
| D9 | API / Binder (runtime) | The binder's `locationOf(temp)` was spec'd to return `InstrOperand`, but A/X/Y registers are **not** expressible as an `InstrOperand` (the union is `none`/`immediate`/`symbolRef`/`labelRef`/`zpSlot` — a register is *implied* by the opcode, never an operand). ST-R3 (⇒A) / ST-R4 (⇒X) / ST-R5 (⇒zp) cannot be satisfied by an `InstrOperand` return. | A: **minimal honest `TempLocation` union** `{kind:"reg"; reg:"A"\|"X"\|"Y"} \| {kind:"zp"; slot:string}`; `locationOf` returns it; a separate `operandFor(temp): InstrOperand` converts a `zp` location to `zpSlot(name)` for ALU-source use and ICEs if asked to use a reg temp as a memory source · B: keep `InstrOperand`, return `none()` for reg temps + a side `regOf()` accessor · C: bare untagged union | **A** — minimal honest `TempLocation` union + `operandFor` converter (user-selected) | ✅ Resolved (runtime, user-selected) |
| D10 | Translator / value-flow (runtime) | The authored ST oracles are inconsistent under any *fixed per-op* translation: ST-T1 (`load`→eager `LDA sym`) + ST-T7 (`add`→`LDA;CLC;ADC;STA t2`, result materialised) vs the ST-G1/G2/G3 goldens (`r=a+b` → `LDA a / CLC / ADC b / STA r` — **no** zp temp, **no** `STA t2`), which demand right-operand **load-source folding** and **ALU-result-stays-in-A** propagation. RD-06's `ILFunction` exposes only `tempCount`, not per-temp use counts, so the fold the goldens assume is not free. | A: **conservative materialise** (every `load`→`LDA`+`STA temp-home`, every ALU→`STA dest-home`; RD-08 peephole tightens later) — simpler, but ST-G1/G2/G3 must be re-derived to longer forms · B: **fold model matching the goldens** — a one-pass single-use scan over the block defers/folds the right-operand `load` into the ALU operand and keeps ALU results in A so the consuming `store`/`ret`/next-ALU provides the only `STA`; produces the exact tight goldens and honours every ST-T/ST-G oracle · C: user specifies a different value-flow contract | **B** — fold model matching the goldens (user-selected) | ✅ Resolved (runtime, user-selected) |

---



## Resolution Notes

### D1 — Slice matching RD-06's live lowering (the no-rework path, user-selected)

The user was shown four options and selected **A**. Building the full R17–R39 set against the
**interim** core `PlatformProfile` stub (Option B) is exactly the rework trap RD-07a D2 was
created to avoid: the stub is explicitly `DEFERRED(RD-10)` and will be replaced, so any code
threading it churns when RD-10 lands. It would also mean writing translation for ops
(`call`, `load_indexed`, `br`/`brcond`, …) that **no live lowering emits**, leaving them
verifiable only on hand-built fixtures — the v2 "100%-before-a-consumer" mistake AR-38
exists to prevent. Building RD-10 first (Option C) is the inverse trap.

**Resolution:** RD-07b builds the consumer-coupled logic *for the live set only*, end-to-end
verifiable from real `.blend` source through RD-02→RD-06→RD-07b→`printInstr`. The genuinely
blocked remainder — platform codegen hooks (R46–R49, blocked on RD-10) and the IL ops no
live lowering emits — is deferred to **RD-07c**, which grows alongside the lowering it serves.
Each in-scope deliverable is real and complete; nothing built here is thrown away.

### D2 — `generateInstr(ilProgram, cpuVariant, bag)`; plan read from the IL program

RD-07a D2 established that core codegen's only real profile need is the **CPU variant**.
RD-07b extends that forward unchanged: the entry point takes `cpuVariant: CpuVariant`, not a
`PlatformProfile`. Crucially, the `AllocationPlan` is **already carried inside the IL
program** (`ILProgram.allocationPlan`, `il/cfg.ts`), so register binding reads frame/ZP/symbol
data from there — no separate plan argument, no new coupling. When RD-10 introduces the real
`PlatformProfile`, the *caller* (the RD-15 compiler driver) passes `profile.cpuVariant`; the
`generateInstr` signature is unchanged. The platform-preamble argument the full RD-07 §4.3
`InstrProgram.preamble` envisions (origin/`!to`/symbol defs from a plugin) is **deferred to
RD-07c** — RD-07b emits an empty `preamble` and documents the seam.

### D3 — Translate the live set; ICE-default + defer the rest

The exact ops `lowerToIL` emits today (read from `il/lower.ts`):

- **Instructions:** `load`, `store` (direct memory, byte + word); `const` (materialise);
  the `lowerBinary` family — arithmetic `add`/`sub`/`mul`/`div`/`mod`, bitwise/shift
  `and`/`or`/`xor`/`shl`/`shr`, comparison `eq`/`ne`/`lt`/`le`/`gt`/`ge`.
- **Terminator:** `ret` (with or without a value).
- **Operands:** `imm` (→ `Immediate`), `temp` (→ register/ZP-scratch via binding), `loc`
  (→ `SymbolRef`; the `$HEX` address-symbol form `poke`/`peek` produce is a `SymbolRef`
  whose name is the literal `$D020`, kept symbolic per RD-06 D9 — it renders verbatim).

Every **other** `ILInstruction`/`ILTerminator` kind (`neg`, `not`, the indexed/indirect
memory ops, `copy`, `call`, `intrinsic`, `source_span`; `br`, `brcond`, `unreachable`)
reaches a translator **default arm** that raises an `E90001` ICE (D7) and is listed in
01-requirements.md "Won't Have (RD-07c)". This mirrors `lowerToIL`'s own ICE-default
discipline (RD-06 R69), so the back end fails deterministically and never silently
mis-translates. As the lowering widens (RD-06 follow-on slices), RD-07c lights up the
matching translation arms.

### D4 — mul/div/mod: emit the call-site now, link the routine later

`*`/`/`/`%` are already in `BINARY_OP_TO_IL`, so the live lowering **does** emit `mul`/`div`/
`mod` whenever source uses them. R21/R22 fully specify their codegen *at the call site*:
constant-fold when both operands are known, a shift sequence for a constant power-of-2
`mul`, otherwise `JSR __rt_mul8`/`__rt_div8`/… plus the cost warning (W10170 runtime
multiply, W10171 runtime divide, W10172 shift-and-add). Emitting a `JSR` to a symbolic
routine name resolved by ACME at link time requires **no** RD-17 routine to exist now — the
hand-written `__rt_*` bodies link later (RD-17, AR-30), and dead-stripping drops unused ones.
So mul/div/mod are *in scope as call-site codegen* (keeping the slice honestly matching live
lowering) while their **bodies** stay RD-17's domain. This is spec-determined (R21/R22), not
a guess.

### D5 — Both widths, driven by the operand `ILType`

Word-typed frame slots already flow through `load`/`store` live (e.g. a `word` param), and
addresses are `IL_WORD`, so 16-bit cannot be deferred without ICE-ing real live IL. The
translator therefore selects 8-bit vs 16-bit sequences off each operand's own `ILType`
(`IL_BYTE`/`IL_SBYTE` vs `IL_WORD`/`IL_SWORD`), per R18/R19/R20/R27/R28: 8-bit `add` →
`LDA`/`CLC`/`ADC`/`STA`; 16-bit `add` → lo then hi-with-carry; `load`/`store` → `LDA`/`STA`
(8-bit) or `LDA`+`LDX`/`STA`+`STX` (16-bit).

### D6 — Extend `instr/`, consume `il/` read-only

The translator/binder/assembler are the *consumers* of RD-07a's `instr/` model, so they live
in the same `instr/` directory (`translate.ts`, `register-binding.ts`, `instr-program.ts`),
each kept under the 500-line split threshold (code.md r21). They import RD-07a's
`stream`/`operand`/`validate`/`print-instr` siblings and read the `il/` model
(`ILProgram`/`ILFunction`/`BasicBlock`/`ILInstruction`/`ILOperand`) **without modifying it** —
the IL must never depend on Instr. The R15/AR-20 boundary is inherited unchanged
(language-server still never imports `@blend65/codegen`).

### D7 — Reuse `IceCode.Unexpected`; existing cost-warning codes

Two failure classes, both already covered by the one-registry rule: (1) a deferred/unknown IL
op at the translator default arm, and (2) a translation that somehow produced an illegal
opcode+mode (caught by re-running RD-07a's `validateStream` over each emitted stream). Both
are compiler bugs in the `E9xxxx` band → `bag.addICE(IceCode.Unexpected, span, msg)`,
identical to RD-06 D6 and RD-07a D6. Cost warnings reuse the existing user-band W10170/W10171/
W10172 (R60). No new diagnostic codes are introduced.

### D8 — Commit mode: `--no-commit`

The agent implements, verifies, and updates the execution plan, but performs **no** git
operations. The user handles all commits. Identical to every prior RD plan.

### D9 — Minimal honest `TempLocation` union (runtime, user-selected)

Surfaced while writing the Phase-1 binder spec tests: `03-02-register-binding.md` declared
`locationOf(temp): InstrOperand`, but the RD-07a `InstrOperand` union
(`none`/`immediate`/`symbolRef`/`labelRef`/`zpSlot`) **cannot** express "the value is in
register A/X/Y" — on the 6502 a register operand is *implied by the opcode*, never carried as
an operand. So ST-R3 (`locationOf ⇒ A`), ST-R4 (`⇒ X`), and ST-R5 (`⇒ zp slot`) are
unsatisfiable with an `InstrOperand` return.

A temp is consumed two distinct ways: (1) as the **ALU accumulator** (in A, or its high byte
in X) — a register-state fact used for redundant-load suppression; (2) as an **addressable
source** (a spilled temp `zpSlot(name)`, or a folded load-source `symbolRef`) — which *is* an
`InstrOperand`. The honest model is therefore a small union, exactly as the design doc's own
*"reg-as-operand or zpSlot"* wording intended.

**Resolution (user-selected Option A):**
```typescript
type TempLocation =
  | { readonly kind: "reg"; readonly reg: "A" | "X" | "Y" }
  | { readonly kind: "zp"; readonly slot: string };
```
- `locationOf(temp): TempLocation` — returns where the temp currently lives (satisfies
  ST-R3 ⇒`{kind:"reg",reg:"A"}`, ST-R4 ⇒`{kind:"reg",reg:"X"}`, ST-R5 ⇒`{kind:"zp",slot}`).
- `operandFor(temp): InstrOperand` — the converter the translator calls when it needs the
  temp **as a memory source**: a `zp` location → `zpSlot(slot)`; a `reg` location → an
  `E90001` ICE (asking to address a register as memory is a codegen bug, H5 — no undefined
  behavior).
- Word values are handled as two temps (lo in A, hi in X), per D5; no `regPair` variant is
  introduced in this slice.

This is additive to the RD-07a model (no `InstrOperand` change) and the rest of the binder
seam (`ensureInA`/`bindResultToA`/`bindResultToX`/`reset`/`spill`) is unaffected.

### D10 — Fold value-flow model matching the goldens (runtime, user-selected)

Surfaced while preparing the Phase-2 translator spec tests: the authored ST oracles cannot
all hold under a *fixed per-op* translation. ST-T1 wants a bare `load` to emit `LDA sym`
eagerly; ST-T7 wants `add t2,t0,t1` to materialise its result (`LDA t0; CLC; ADC t1; STA t2`);
but the ST-G1/G2/G3 **goldens** for the very same shapes (`r = a + b` → `LDA a / CLC / ADC b /
STA r`) show **no** intermediate `STA t2` and **no** ZP temp — the second `load` is folded into
the `ADC` operand and the `add` result stays in A until the consuming `store` provides the
single `STA`. On a one-accumulator 6502 these are different machines; the design doc
(`03-02` §"Redundant-load suppression") already flags the fold as conditional on single-use
information that RD-06's `ILFunction` does not directly expose (only `tempCount`).

**Resolution (user-selected Option B):** the translator implements the **fold model** the
goldens assume.
- A **one-pass pre-scan** over the (single) block counts each temp's uses, so the translator
  knows which temps are single-use load-results eligible to fold.
- A `load dest,[sym]` whose `dest` is **single-use and consumed by the immediately following
  ALU/store** is **deferred**: it is not emitted as a standalone `LDA`; instead its source
  symbol becomes the ALU's right operand (`ADC sym`) or, when it is the value of a `store`,
  the `LDA sym` that precedes the `STA`. A **multi-use** load-result, or one not immediately
  consumed, is materialised conservatively (emit `LDA`, bind to A; spill if pressure).
- **ALU results stay in A** (R41) — no eager `STA dest`. The consumer that needs the value in
  memory (`store`, the next ALU's left operand if it must be reloaded, or `ret`) emits the
  store. This yields the exact tight goldens and honours ST-T7's materialised form too: when
  an `add`'s `dest` *is* consumed by a following `store t2,[r]`, the `STA r` is that store's
  emission — the ST-T7 oracle's `STA t2` is the dest-home store the consumer provides.
- The model degrades safely: if the fold pre-scan is ever uncertain it **materialises** (never
  mis-folds), so the result is at worst one `LDA`/`STA` longer than optimal — RD-08 peephole
  closes any residual gap — and **never incorrect** (H5).

This is internal to `translate.ts` (no model or binder-seam change); the binder's
redundant-load suppression (R44) and `operandFor` (D9) are exactly the primitives the fold
uses. Determinism (R17) is preserved: the pre-scan is a deterministic left-to-right walk and
fold decisions depend only on the IL.

---


## Surface-during-authoring rule


If authoring or implementation surfaces a *new* ambiguity, **STOP**, add it here as the next
`D-N` (tagged `(runtime)` if found during execution), resolve it with the user,
back-propagate the resolution into the affected plan documents, then resume. Do not fill gaps
by guessing.
