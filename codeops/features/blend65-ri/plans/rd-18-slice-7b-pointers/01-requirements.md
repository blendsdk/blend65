# Requirements: RD-18 Slice 7b — Pointer surface

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-18](../../requirements/RD-18-codegen-language-completion.md) — the OWNING
> requirements doc (slice map row 7 + acceptance item 6)
> **Sibling**: `plans/rd-18-slice-7-aggregates/01-requirements.md` — 7a's delta view, whose
> "Deferred / out" section this plan consumes

## Scope of this plan (delta view)

Per 7a's AR-1, RD-18 Slice 7 = 7a (direct surface, ✅ complete 2026-07-12) + **7b (this plan)**.
The boundary is addressing-mode-shaped: 7b is everything requiring a ZP pointer + `(zp),Y`.

### In this plan (7b)

- **By-reference struct/array parameters** — spec FN-2/FN-3 (Ch 06 §3), SR-3 (Ch 07);
  ledger R70 (`Symbol.byRef` finally set); calling convention per AR-2 (frame home +
  colored pair + prologue copy; dead/pass-through pair skip); the 7a aggregate-param
  E90001 rejection retired
- **Sized array params** — exact size/type match via structural assignability → E10171
  reuse (Ch 08 §8.1, AR-9); `length(sizedParam)` folds to the compile-time constant
- **Unsized array params** (`T[]`) — Ch 08 §8.2; `ArrayType.size: number | null` (AR-5);
  byte AND word indexes (byte fast path element-size-1 only — multi-byte elements route through
  word formation, PF-007); `length()` unavailable → E10080 reuse (AR-10)
- **Unsized-declaration size inference (narrowed — AR-15, preflight PF-002)** — the spec's own
  ✅ forms `let/const T: byte[] = […]` (Ch 02 type-inference example; Ch 08 §4/§8) compile by
  inferring the size from a FULL element-list initializer (infer-before-check; const images
  sized from the initializer); the fill form keeps **E10126**, and a non-param unsized
  annotation WITHOUT an initializer is **E10126** with a bespoke message
- **Const parameters** — Ch 08 §7 CP-1..5 + Ch 06 FN-3; parser `[const] type` in param
  position (grammar drift recorded, AR-6); E10122/E10123 wired; CP-4 zero runtime cost;
  CP-5 propagation through chains; scalar const params legal read-only (AR-6)
- **Tier-2 arrays** (>256 bytes, incl. const aggregates) — Ch 08 AR-3/§10.3; the 7a
  >256-byte E90001 rejection retired; word-index rule (E10118 emission becomes reachable;
  E10117 keeps guarding tier-1); runtime pointer formation through the conditionally-reserved
  scratch pair (AR-4); W10142/W10143 advisories (AR-9/AR-11)
- **Whole-struct copy through by-ref params** — `p = q` per-byte `(pair),Y` copy, mixed
  direct/indirect bases included (7a copy-semantics precedent extended)
- **`load_indirect`/`store_indirect` translation** — the 7a documented ICE seam replaced by
  real `(zp),Y` framings; regY mirror; offset >255 scratch-add fold (AR-7); translate ICE
  backstop for unreserved scratch (AR-4)
- **IL `addr` operand** — the address-of-symbol store source (AR-12)
- **Aliasing advisory** — W10112, same root symbol ≥2 by-ref args in one call (AR-8)
- **Three-part acceptance bar** — assemble-clean + ASM golden + real-VICE run of the two-file
  `examples/slice7b/` fixture (AR-13); all nine prior committed goldens byte-exact (AR-4 golden safety)
- **RD-18 acceptance item 6 closes**; roadmaps + ledger reconciled at rollout

### Deferred / out of this plan

- **Slice 8**: `&` address-of (and with it the deferred by-ref argument classes — AR-3's
  runtime-indexed and pair-relative places), string/char initialisers + encoding, `embed()`,
  `zeropage` blocks (W10110), interrupt functions — and the **`__zp_irq_ptr` scratch twin**
  the challenger flagged (Ch 06 §7.6 requires IRQ-separate temps; recorded in AR-4)
- **Runtime `--bounds-check` flag** — still deferred (7a AR-8; no trap ABI, no config key)
- **Optimizers** — passthrough (RD-18 Won't-Have); the AR-2 note records the legal Phase-B
  C→A rewrite for the param-passing cost
- **E10112/E10116/E10124/E10125** — stay unregistered/unwired (string band → Slice 8;
  count>size stays on the 7a E10152 reuse — AR-9)

## Plan-local decisions

All 15 decisions live in [00-ambiguity-register.md](00-ambiguity-register.md) (14 at the gate +
AR-15 pinned at preflight-fix application); the load-bearing ones: AR-2 (calling convention —
challenger-hardened), AR-3 (argument forms), AR-4 (scratch predicate + golden safety), AR-5
(unsized model, PF-002-corrected), AR-6 (const model), AR-9 (code table), AR-12 (`addr`
operand), AR-15 (narrowed unsized inference). The preflight report's 15 accepted findings are
folded into these docs (see the register's Preflight-corrections section).

## Acceptance Criteria (plan-local; RD-18 item 6 ticks here)

1. [ ] `examples/slice7b/` (two files, AR-13) assembles clean through real ACME to a loadable
       PRG (zero undefined symbols — `__zp_ptr_*` included) and VICE-verifies the `$C000..`
       band: by-ref mutation, const-param sum, unsized-param sum (witnessing the AR-15
       inferred-size `const TABLE: byte[]`), tier-2 cross-boundary write/read at a **runtime
       word index** ≥256 (the `(zp),Y` formation path must execute — PF-001), pass-through
       chain, whole-struct copy through params
2. [ ] Byte-exact ASM golden committed (incl. the formation landmark); **all nine prior
       committed goldens unchanged** (gate + eight slices)
3. [ ] Negative surface proven via the public facades: E10122, E10123 (direct + CP-5 nested +
       compound assign), E10117/E10118 tier errors, E10080 length-on-unsized, E10171 size
       mismatch, the two loud AR-3 lowering ICEs; W10112/W10140-band/W10142/W10143 compile
       WITH warnings
4. [ ] The two 7a E90001 rejections are gone; no silent path replaces them (every deferred
       form still rejects loudly)
5. [ ] Full verify green; `git status --porcelain spec/` empty
