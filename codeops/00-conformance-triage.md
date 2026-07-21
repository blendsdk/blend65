# Conformance & Expressiveness Triage — 2026-07-21

> **Status**: Proposed — not yet accepted into any roadmap
> **Scope**: Everything needed to make Blend65 a language a game developer can actually
> use, excluding the *content* of the future gaming/music libraries (the library
> **mechanism** is in scope; its helpers are not).
> **Supersedes**: nothing. Feeds `codeops/00-roadmap.md` and both feature roadmaps.

## How this was produced

A working session traced three expressiveness gaps to their origin, then four independent
audits ran in parallel on a different model family, each with a distinct lens: spec
conformance, unbuilt promises, expired deferrals, and game-developer expressiveness. Their
findings were merged here and de-duplicated.

**Verification legend** — every row carries one:

| Mark | Meaning |
|------|---------|
| ✅✅ | Verified twice — by an audit **and** independently re-probed at triage time |
| ✅ | Probe-verified: a program was compiled and its output inspected |
| 📖 | Read-verified only: traced in source/spec, not executed |
| ❓ | Asserted by an audit, not independently confirmed — **treat as a lead, not a fact** |

Nothing below is actionable until its row is at least ✅. Rows marked ❓ need a
confirmation pass before they earn a task.

---

## P0 — Silent miscompiles

Legal source, no diagnostic, wrong machine code. This class outranks everything else in this
document: a developer cannot work around a bug they cannot see, and on a C64 there is no
debugger to catch it.

> **Post-challenger corrections (2026-07-21).** An independent ordering review on a different
> model family produced four changes, all verified before adoption. (1) A **fourth silent
> miscompile** was found — see M1b. (2) The sequencing premise "more zeropage relieves the
> aggregate spill ICE" is **mechanically wrong**: the ceiling is `mainTempBytes: 4`
> (`packages/core/src/semantics/platform-profile.ts:83`), not the ZP budget, and the canonical
> c64 plugin profile carries no such field at all — so R10 splits into a behaviour-neutral half
> and a behavioural one. (3) R9 becomes a permanent registry↔emitter agreement test rather than
> a one-time sweep, since R7/R8 mint codes after it. (4) **#70** and **U9** had no home in the
> first sequencing draft and now do. The executable ordering lives in
> `codeops/features/blend65-conformance/00-roadmap.md`; this document remains the findings record.

### M1 — `for (i = <n> downto 0)` compiles to an infinite loop ✅✅

The canonical 6502 countdown loop hangs.

```blend65
for (let i: byte = 9 downto 0) { poke($D020, i); }
```
```asm
    LDA i
    CMP #$00
    BCC exit        ; carry is ALWAYS set after CMP #$00 — never taken
```

The counter runs 9…0, wraps `0 → $FF`, and loops forever. Same hole is reachable ascending
via a named-const bound, because the guard at `lower.ts:717` only inspects `NumericLitExpr`.

- Site: `packages/codegen/src/il/lower.ts:715-728`, `branchOnCounter` at `:841-859`
- Spec: `spec/05-statements-control-flow.md:228,236` — "`9 downto 0` visits 0"
- Governance: **none found** — unnoticed drift, not a deferral

### M1b — `for (i = 0 to MAX)` with a named-const `MAX = 255` also loops forever ✅✅

```blend65
const MAX: byte = 255;
for (let i: byte = 0 to MAX) { poke($D020, i); }
```
```asm
    LDA #$FF
    CMP i
    BCC exit        ; carry clears only if $FF < i — impossible for a byte. Never taken.
```

The same defect as M1 at the opposite end of the type. The ascending guard at `lower.ts:717`
inspects only `NumericLitExpr`, so the **literal** `0 to 255` ICEs loudly and safely while the
**named-const** spelling compiles clean and hangs — the more readable spelling is the dangerous
one, which is the inverse of what a compiler should do.

This is why U1 (below) moves into the silent-miscompile RD rather than the loop RD: they are one
bug, one guard, one committed ICE-expectation test.

### M2 — `poke(addr, <word>)` silently writes two bytes ✅✅

```blend65
let w: word = 300;
poke($D020, w);        // spec signature is (word, byte)
```
```asm
    STA $D020
    STX $D020+1        ; ← writes $D021 too
```

A border-colour write silently corrupts the background colour. Any MMIO register with a live
neighbour is exposed. The value operand's width is never checked; the range check at
`intrinsic-validation.ts:177-188` only inspects numeric literals.

- Site: `packages/frontend/src/semantics/type-check/expression-typing.ts:1608-1620`
- Spec: `spec/12-intrinsics.md:127` (`(word, byte): void`); narrowing must be an explicit
  cast error per `spec/02-type-system.md` §5.3
- Governance: **none found** — unnoticed drift

### M3 — Flat function scope: same-named locals share one frame slot ✅

A local shadowing a parameter, or two nested `for` loops both using `i`, compile silently and
collapse onto **one** name-keyed frame address, producing wrong values.

- Site: `packages/frontend/src/semantics/function-collection.ts:186-194,213-233,307-325`;
  slots keyed by name at `lower.ts:2782`
- Spec: `spec/03-variables.md:131-153` (E10101/E10003), `spec/05:270` (E10062)
- Governance: documented deferral to "a later cleanup slice" — but the *consequence* recorded
  was a missing diagnostic, not a miscompile. The deferral was taken on wrong information.

### M4 — Interrupt/mainline shared-frame corruption has no diagnostic ❓

Under static frame allocation a helper reachable from both `main` and an interrupt handler can
corrupt its own frame. `computeIrqClassification`
(`packages/frontend/src/sfa/model-adapter.ts:443-481`) already computes `irqReachable` and
`mainlineReachable`; the hazard set is their intersection. No warning is emitted.

FUT-004 deferred this as "a significant compiler feature"; its own reconsideration criterion
("the SFA call graph is already computed") is now met verbatim.

**Unconfirmed**: an audit probe could not demonstrate actual corruption (zero-size frames). The
*absence of the diagnostic* is confirmed; the *exploitability* is not. Confirm before sizing.

---

## P1 — Cannot write a game at all

### B1 — `peek`/`poke`/`peekw`/`pokew` accept only a bare numeric literal ✅✅

Three distinct rejections, all from one shortcut at `lower.ts:2729` testing
`arg.kind === "NumericLitExpr"`:

| Form | Result | Note |
|------|--------|------|
| `const BORDER: word = $D020; poke(BORDER, 5)` | E10045 | A named constant **is** compile-time constant |
| `poke($0400 + 5, 1)` | E10045 | A **fully literal** constant expression |
| `poke($0400 + i, 32)` | E10045 | The runtime form the spec mandates |

The diagnostic reads *"requires a compile-time-constant address"* and rejects two kinds of
compile-time constant. The spec signature (`spec/12-intrinsics.md:127`) carries no constraint,
and `spec/12-intrinsics.md:159` **mandates the runtime form**, naming the lowering strategy:

> "When the address is a runtime expression, it uses zero-page indirect addressing (2 ZP bytes)."

**Consequences**: no loop can write screen RAM, colour RAM, or a bitmap. No hardware register
can be named — all 18 examples use magic numbers, violating Prime Directive clause 3. Drawing
anything is impossible; `examples/boing-ball` documents the workaround in its own comment
("clearing it would mean writing a thousand cells of screen RAM… so instead the background is
painted the same light blue as the text").

Governance: the runtime half is AR-101 (2026-07-02), a sound deferral whose stated rationale
("genuinely new codegen surface") **expired** when RD-18 slice 7b shipped `(zp),Y` with runtime
pointer formation. The constant halves were never authorised by any decision.

### B2 — No path to C64 screen codes ✅

Text written to `$0400` renders wrong glyphs. PETSCII `'A'` = `$41`; the screen code is `$01`.

- `CharEncoding` is `petscii | atascii | ascii` only
  (`packages/core/src/platform/platform-profile.ts:34`) — no screen-code table exists anywhere
- `screenEncoding` (`:103`) is populated by all five platforms and **read by nothing**
- The four encoding intrinsics `petscii()` / `screen_codes()` / `atascii()` /
  `internal_codes()` (`spec/08-arrays-strings.md:217-278`, STR-3) resolve as undeclared
  identifiers
- `to_screen_code()` is delegated to the unbuilt platform library (`spec/appendix-c64.md:189`)
- The spec self-contradicts on the C64 default (Ch 08 says `screen_codes`; the appendix profile
  says `petscii`) — **both halves promise a capability with no implementation**

Every C64 game renders text. Today it requires hand-computed byte arrays.

### B3 — No way to call code at an address ✅

- `let f: word = handlers[state]; f();` → E10175 "not a function"
- No `call`/`callAddress` intrinsic exists in `spec/12-intrinsics.md` or the catalog

`spec/evaluations/F015-data-inclusion.md:583-596` builds its embedded-SID example entirely on
`callAddress(MUSIC_INIT, 0)` — a platform-library helper that **cannot be implemented in the
language as specified**, because typed function pointers (FUT-003) and `extern function`
(FUT-011) are both deferred. The SID format handler's `.init_address` / `.play_address`
selectors feed a call mechanism that does not exist.

**Net: tracker-authored music cannot be used, and no KERNAL routine is reachable.** For a
commercial-quality game this is close to disqualifying on its own.

### B4 — Array-of-struct idioms ICE ✅

The sprite-record pattern — the reason structs exist in a game — fails four ways, each with an
`E90001` internal compiler error naming IR nodes rather than user concepts:

| Source | Error |
|--------|-------|
| `let tmp: Spr = sprites[i];` | "unsupported aggregate initialiser node 'IndexExpr'" |
| `sprites[i] = sprites[j];` | "unsupported struct assignment target node 'AssignExpr'" |
| `sprites[i].x = sprites[j].x;` (word field) | "word indexed load not consumed by a store" |
| field-by-field swap via 3 temps | "register binder: spill demand exceeds the plan's ZP 'temp' runs (4 available)" |
| `map[y][x]` (2D array) | "unsupported nested runtime indexes in one access chain" |

`spec/07-structs.md:588,611` uses these exact shapes as its own examples. The parallel-array
(SoA) form does compile well — near hand-parity — so the workaround exists, but the language
sells a feature a game cannot use, and the failure mode is an ICE rather than a diagnostic.

Governance: partly a documented deferral (slice-7b ST-40), partly drift. The 4-slot ZP spill
ceiling firing on straight-line code is unrecorded anywhere.

---

## P2 — Forced un-idiomatic code (Prime Directive clause 4)

Each of these makes a competent developer write something they would not write by hand.

| ID | Gap | Evidence | Governance |
|----|-----|----------|------------|
| U1 | `for (i = 0 to 255)` ICEs — the canonical page loop | `lower.ts:717-726`; spec `05:253` explicitly promises "✅ 256 iterations — uses INX/BNE-wrap codegen" ✅ | Slice-4a AR-6, deferred to "a follow-up" that **no longer exists** — RD-18 closed over it |
| U2 | `until` range form absent — exclusive bounds unwritable | `parse-stmt.ts:176-192` (E10309); grammar + `spec/05:208-234` ✅ | Slice-4a AR-3, deferred to "alongside Slice 7"; Slice 7 shipped without it — **orphaned** |
| U3 | Constant strength reduction missing: `x / 2` and `x % 8` emit `JSR __rt_div8` (~150-200 cyc) where the spec promises `LSR` (2 cyc) / `AND #7`. `y * 40` — the screen-row stride — emits `JSR __rt_mul16` | `translate.ts:1613-1678` (mul: byte-only pow2; div/mod: **no** constant handling). Spec `04:70-78` + `F017:251-299` normative tier table ✅ | None found — drift. F017 **passed its Guard on this cost model** |
| U4 | Array fill-init fully unrolled: `let buf: byte[40] = [; 0];` emits 43 `STA`s where the spec normatively shows a 7-byte loop | `spec/08:587-621` ✅ | Semi-documented; the spec divergence is unruled |
| U5 | `switch` is always a compare chain — no jump table | `lower.ts:746-747`. `F009:266,318,538` passed C3/P4 on "compiler selects optimal strategy incl. jump tables" 📖 | Deferred, no owner |
| U6 | ZP budget is 46 bytes, not the profile's 142 — `E10032` fires ~100 bytes early | `run-frontend.ts:163,192` always passes `DEFAULT_PROFILE`; c64 plugin has the right values at `platforms/src/c64.ts:51-57`. Confirmed in a real build summary: "Total: 10 / **46** bytes" ✅✅ | Documented interim in code; no AR |
| U7 | Signed `/` and `%` ICE — `sbyte`/`sword` are frozen-spec types with normatively defined division | `lower.ts:1292,2308` 📖 | AR-P16 → "a future arithmetic slice" that was **never scheduled** |
| U8 | `arr[i] += 1` with a runtime index ICEs | `lower.ts:1599-1610` 📖 | Slice-8 register, resolved "OUT" |
| U9 | Cast syntax: spec documents `byte(expr)` (`02:302-313`) and `expr as type` (grammar); the parser accepts only `<byte>(expr)` — every cast example in the spec is a parse error | `pratt.ts:241-253` ✅ | No ruling found — needs one |
| U10 | `hi()`/`lo()` of a computed word ICEs — e.g. `hi($0400 + off)`, the screen-pointer idiom | `lower.ts:2684,2711` ✅ | None found — drift |

---

## P3 — Hollow surfaces

Things that exist on paper and do nothing. Individually cosmetic; collectively they mean the
documented compiler and the real one are different products.

### H1 — Dead diagnostic codes (17)

Registered in `packages/core/src/diagnostics/diagnostic-codes.ts`, referenced by no emitting
code. Verified by name-grep plus a string-literal re-check for computed references.

| Code | Name | Why it never fires |
|------|------|--------------------|
| E10010 | ExecAtModuleLevel | Enforced as parser E10310 |
| E10112 | ArraySizeExceedsMax | Fires as E10152 |
| E10133 | NonExhaustiveSwitch | Unreachable — `default` is mandatory |
| E10140 | EmptyEnum | Enforced as parser E10315 |
| E10141 | TooManyEnumMembers | Fires as E10143 |
| E10142 | DuplicateEnumValue | **Contradicts the spec** — `spec/09-enums.md:145` EN-5 *allows* duplicates |
| E10150 | MissingTypeAnnotation | Enforced as parser E10303 |
| E10163 | EmptyStruct | Enforced as parser E10316 |
| E10192 | ConstWithoutInit | Enforced as parser E10314 |
| E10203 | EmbedUnknownSelector | Format handlers unbuilt |
| E10204 | EmbedFormatParseError | Format handlers unbuilt |
| E10302 | ExpectedStatement | Never wired |
| W10121 | BrkInRelease | **No debug/release build mode exists** — fell through RD-17 → RD-16 |
| W10130 | UnreachableCode | Constant-condition folding is silent |
| W10172 | ShiftAndAddMultiply | The lowering it describes doesn't exist (U3) |
| W10190 | UseBeforeInit | Definite-assignment analysis never built |
| W10191 | UnusedVariable | Never built |

**Inverse gap** — promised by the spec, absent from the registry entirely: `W10070` (switch
width hint), `W10173` (possible division by zero), `W10150`/`W10151` (data budget),
plus `E10062`, `E10095`, `E10125`, `W10060`, `W10100`, `W10110`, `W10111`, `W10181`.

### H2 — Declared-but-never-read fields

| Field | Declared | Consequence |
|-------|----------|-------------|
| `warnFrameSize` | `platform-profile.ts:111` | No frame-size warning exists at all |
| `warnArraySize` | `:113` | W10143 hardcodes `maxRam * 0.25` instead — fires at 9,728 B on C64 where the profile says 256 |
| `screenEncoding` | `:103` | The data half of B2 |
| `clockMhz`, `cyclesPerFrame` | `:117,119` | Cost reports never convert cycles to frames — the one number a game dev budgets against |
| `MainTerminationPolicy.warningOnReturn` | `platform-plugin.ts:56` | a7800's authored warning can never be shown |

`spec/15-platform-profile.md:161` makes these normative: "budget warnings must fire at the
thresholds defined in the profile."

### H3 — `--optimize` is a no-op

Help text says "Enable the peephole optimizer" (`cli/src/args.ts:125`); its only effect is
`optimizeInstr` over `V1_RULES = []`. Output is byte-identical either way. This is a corollary
of the documented Phase-B scope, but the **flag-level dishonesty** is its own small defect.

### H4 — Diagnostic renumbering drift

Dozens of chapter-assigned codes carry different meanings in the implementation (spec E10072
case-type-mismatch → impl missing-default; spec E10161/2 → impl struct-field codes; spec
E10200-03 → impl embed family). The registry documents this as accepted deviation awaiting an
errata pass. Behaviour is present; the numbers lie. Painful for `--suppress-warning` and any
tooling keyed on spec codes.

### H5 — The platform library and its mechanism

Already established in session; restated for completeness:

- No library module exists (25 `.blend` files repo-wide, all examples/research)
- No module search path — sources are globs over the project root
  (`compiler/src/api/options.ts:34`, `run-frontend.ts:246`)
- `--library` (`spec/10-modules.md:176`) is not wired into the CLI or compiler options
- No function inlining → a wrapper costs `JSR`+`RTS` (~12 cyc) on a 6-cyc operation
- `spec/00-introduction.md:113` uses "Escape Hatch Tier 2 — Platform Library" to justify
  keeping features out of the core language; it is invoked across `appendix-c64.md:189`,
  `appendix-a800xl.md:292`, `appendix-c64u.md:63,80,109,187`, `F007`, `F015:573`
- **`appendix-c64u.md`**: the C64 Ultimate target's entire differentiator (REU via `c64u.reu`)
  is delegated to the unbuilt library — as shipped, c64u is a c64 clone

Format handlers / `embed(...).selector` / `PlatformProfile.embedFormats` are the same shape:
specified (EMB-5), no `FormatHandler` type anywhere, field never populated or read.

---

## P4 — Governance and process

### G1 — The Prime Directive needs two clauses, not a rewrite

It is not the cause of any finding above — it is the instrument that detected them (clause 3
condemns the magic-number examples; clause 4 names the unrolled-poke anti-pattern). It should
not be rewritten. Two additions:

> **Input is judged as the target user would.** Output is judged as an expert 6502 programmer
> would; the source is judged as the game developer writing it would — someone who knows their
> game, not the VIC's block granularity. Lore the hardware demands belongs in the platform
> library, not in every user's source.

> **A program the language cannot express at all is the limiting parity failure — an infinite
> ratio.** Such gaps live in the expressiveness ledger, not the scoreboard.

### G2 — The parity scoreboard is structurally blind

It measures generated vs hand-written bytes/cycles over programs that **compile**. It therefore
cannot surface any P0/P1 finding above, and did not, across six green RDs. Needs:

- An **expressiveness ledger**: a committed list of idioms a game developer cannot express,
  each with its governing decision (AR / Won't-Have / FUT) and an owning issue. Enforced with
  a manifest + agreement test on the T-02 pattern, not "reviewed periodically"
- A capability row in `docs/game-feasibility-matrix.json` for indexed hardware writes — the
  matrix scores 100 titles across 12 rows and models none of this
- Eventually: parity pairs written in *library* style, since today all 15 pairs are
  raw-Blend65 vs asm and say nothing about the ratio a real game would score

### G3 — Expired deferrals need a trigger, not goodwill

The AR-101 pattern recurred at least six times. Every P0/P1/P2 item whose governance reads
"deferred to a later slice" was orphaned **simultaneously** when RD-18 closed, and the closure
audit's tick-with-annotation recorded them without re-opening ownership.

| Deferral | Stated reason | What invalidated it | Verdict |
|----------|---------------|---------------------|---------|
| AR-101 | "new codegen surface beyond the MVP gate" | Slice 7b shipped `(zp),Y` | **EXPIRED** |
| FUT-004 | "requires a complete call graph" | `computeIrqClassification` ships it | **EXPIRED** |
| Slice-4a AR-6 (U1) | "until a follow-up adds Pattern B" | No follow-up remains | **EXPIRED, orphaned** |
| Slice-4a AR-3 (U2) | "most useful alongside Slice 7" | Slice 7 shipped without it | **EXPIRED, orphaned** |
| AR-P16 (U7) | "a future arithmetic slice" | Never scheduled; RD-17 built the machinery | **EXPIRED, orphaned** |
| AR-111 | "until the language is fully lowered" | RD-18 closed | **EXPIRED (trigger met)** |
| FUT-009 | "requires runtime pointer arithmetic" | Slice 7b shipped exactly that | **EXPIRED** |
| FUT-012 `copy()` | "not essential for MVP" | Demand now measured on `balloon` | WEAKENED |
| FUT-011 `extern` | "requires a linker + object format" | RD-17 proved textual inlining suffices | WEAKENED |
| FUT-014 `@align` | "no attribute syntax" | Deliberately re-examined and declined by RD-15 | **STILL VALID** — the process working |

**Fix**: an RD-closeout gate question — *"did this RD's deliverables expire any deferral's
rationale?"* — plus a rule that a rollout RD may not close while any deferral names one of its
own future slices as the landing place.

**Live deadlock to break deliberately**: asm-parity RD-06 Rules 2–3 are deferred over MMIO
concerns; FUT-018 (the volatility discriminator that would resolve them) is deferred because
"no optimizer needs it". Each waits on the other.

### G4 — A roadmap claim is false and must be corrected

`codeops/features/blend65-ri/00-roadmap.md` states RD-18 closed with "the whole frozen v3
language now compiles end-to-end". Contradicted by U1, U2, U7, U8, B4 and the cast-syntax
divergence — all legal frozen-spec surface that ICEs or fails to parse. The claim needs
correcting in the same change set that files the work.

### G5 — Spec errata (no `spec/` edit; D3 holds — record only)

Internal contradictions found, to be logged for the eventual v3.1 errata pass:

- Division by zero: `spec/15:174` says "returns 0 (defined)"; `spec/04:91` says max value; the
  runtime says "unspecified" (`codegen/runtime/div8.asm:11`)
- C64 default string encoding: `spec/08` says `screen_codes`; `appendix-c64.md` says `petscii`
- `E10142 DuplicateEnumValue` exists for a rule `spec/09-enums.md:145` explicitly permits
- Cast syntax: Ch 02 vs `grammar.ebnf.md:305` vs the implementation — three different answers

---

## Proposed work breakdown

### Immediate (hours, no dependencies)

| ID | Work | Notes |
|----|------|-------|
| T-A | `constAddress` accepts any const-foldable expression (reuse `constantOperandValue`, `lower.ts:2541`) | Fixes two-thirds of B1. Zero corpus impact — const folds to the same address, so the 14 goldens are a free proof. No test pins the current behaviour (both E10045 tests use a *variable*) |
| T-B | Migrate all 18 examples to named hardware registers | Discharges Prime Directive clause 3. Output must be byte-identical |

### New RDs proposed

| # | Title | Covers | Spec change? | Why it earns an RD |
|---|-------|--------|--------------|--------------------|
| **R1** | **Silent-miscompile eradication** | M1, M2, M3, (M4 if confirmed) | No | Wrong runtime behaviour with no diagnostic. Must ship first and alone — nothing else matters if the compiler lies |
| **R2** | **Memory-access conformance** | B1 runtime half | **No — spec mandates it** (`12-intrinsics.md:159`) | Unblocks all screen/colour/bitmap work. Design note: `poke(BASE + i, v)` must lower to absolute-indexed `STA base,X` (4 cyc); `(zp),Y` reserved for genuinely dynamic addresses — uniform ZP-indirect would itself be a clause-1 defect |
| **R3** | **Loop and range completion** | U1, U2, U7, U8, U10 | No | The orphaned RD-18 remainder. Groups cleanly — all loop/expression lowering |
| **R4** | **Constant strength reduction** | U3, U4, U5 | No | F017's Guard pass rests on a cost model that isn't implemented. `y * 40` is the hottest expression in a scrolling game |
| **R5** | **Aggregate lowering completion** | B4 | No | Makes structs usable for entity arrays; closes six ICE classes |
| **R6** | **Text output: screen codes** | B2 | No — implements existing spec | Every C64 game renders text |
| **R7** | **Call-an-address** | B3 | **Likely yes** — needs a decision on intrinsic vs FUT-003 pointers | Gates all music. Start with `grill_me`, not `make_plan` |
| **R8** | **Platform-library mechanism** | H5 — module resolution, `--library`, inlining/zero-cost calls | No | The spec's designated home for *all* ergonomics. Library **content** is explicitly out of scope here |
| **R9** | **Diagnostics registry reconciliation** | H1, H4, and the profile-threshold half of H2 | No | Retire or wire 17 dead codes; register the missing ones; errata the renumbering |
| **R10** | **Platform-profile plumbing** | U6, H2 | No | ZP budget 46→142 is a real resource lie on the scarcest resource an asm dev budgets |

### Issues to file

| Issue | Content |
|-------|---------|
| I-1 | M1 — `downto 0` infinite loop, with the two-probe repro |
| I-2 | M2 — `poke` word-value corrupts the adjacent register |
| I-3 | M3 — flat scope frame-slot collision |
| I-4 | B1 — E10045's three facets, with the false-diagnostic note |
| I-5 | M4 — IRQ reentrancy hazard has no diagnostic (blocked on confirmation) |
| I-6 | G3 deadlock — RD-06 Rules 2-3 ↔ FUT-018 mutual wait |
| I-7 | H3 — `--optimize` help text promises an effect it cannot have |

Existing issues to update: **#49** (placement — the runtime-`poke` half is now R2),
**#58**/#70/#71 unchanged, **#67** (padding visibility) unchanged.

### Documents to update

| Artifact | Change |
|----------|--------|
| `CLAUDE.md` Prime Directive | Add G1's two clauses. No rewrite |
| `codeops/features/blend65-ri/00-roadmap.md` | Correct the false "whole frozen v3 language compiles end-to-end" claim (G4); re-open the orphaned deferrals as owned rows |
| `codeops/features/asm-parity/00-roadmap.md` | Note that R1/R2 pre-empt #70 as next pick |
| `codeops/00-roadmap.md` | Add the new feature(s) this triage spawns |
| `docs/game-feasibility-matrix.json` | Add the indexed-hardware-write capability row; re-score (`/update_capability`) — several "Now"/"Soon" verdicts are likely optimistic |
| **New**: expressiveness ledger | G2 — with manifest + agreement test |
| **New**: spec errata log | G5 — record only; `spec/` stays frozen under D3 |
| `exec_plan` closeout step | G3's expired-deferral gate question |

---

## Recommended sequencing

```
NOW      T-A, T-B                      (hours — unblocks named registers)
   │
   ├─▶ R1  silent miscompiles          ← ship first and alone
   │
   ├─▶ R2  memory-access conformance   ← the single largest unblock
   │
   ├─▶ R3  loops/ranges  ─┐
   ├─▶ R5  aggregates     ├─ the orphaned RD-18 remainder; parallelisable
   ├─▶ R6  screen codes  ─┘
   │
   ├─▶ R4  strength reduction          ← biggest cycle win
   ├─▶ R10 profile plumbing            ← small, unblocks honest budgets
   │
   ├─▶ R7  call-an-address             ← grill_me first; may need v3.1
   └─▶ R8  library mechanism           ← then, and only then, library content
```

Governance items (G1, G2, G3, G4) land alongside T-A/T-B — they are cheap and they are what
stops the next recurrence.

**This displaces #70 (local constant propagation) as the next asm-parity pick.** #70 improves
ratios on programs that already work; R1 and R2 decide whether programs can be written at all.
#70 remains the largest *measured* gap and should follow R2.

---

## Open questions for the user

1. **Structure** — do these become a third portfolio feature (e.g. `blend65-conformance`), or
   rows inside the existing `blend65-ri` feature whose closure claim they correct?
2. **R7 scope** — a `call(addr)` intrinsic (small, needs a spec decision) vs typed function
   pointers (FUT-003, larger, more general). This is a `grill_me` conversation.
3. **D3** — R7 and possibly U9 (cast syntax) need `spec/` edits. Does D3 relax now that RD-18
   has closed, or do they wait for a formal v3.1?
4. **Confirmation pass** — M4 and the 📖 rows need probes before they earn tasks. Worth one
   focused session.
5. **Issue filing** is outward-facing — confirm before anything is posted to GitHub.
