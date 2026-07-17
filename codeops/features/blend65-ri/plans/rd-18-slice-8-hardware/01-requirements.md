# Requirements: RD-18 Slice 8a — Hardware

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-18](../../requirements/RD-18-codegen-language-completion.md) — the OWNING
> requirements doc (Slice 8 row of the Slice Map; acceptance items 7–9)

## Scope of this plan (delta view)

### In this plan (8a)

- **`&` address-of** — Ch 04 §8 operand surface, `word` result, rejection codes, `&fn`/`&Module.fn`,
  `isEscaped` marking, lowering onto the shipped `addr` operand [AR-10, AR-11]
- **By-ref argument places** — runtime-indexed and pair-relative places marshal instead of ICE;
  the two 7b pins retire per the loud-never-silent retired-row protocol [AR-29]
- **`interrupt` functions** — optional `: void` syntax completion, E10050, spec-verbatim
  save-A/X/Y + RTI ABI, E10051 unchanged [AR-12, AR-13, AR-14]
- **SFA interrupt-path correctness** — irq-reachability classification with three consumers:
  always-live frames/pairs, irq-only spill pool, `__zp_irq_ptr_scratch` [AR-15]
- **`zeropage {}` blocks** — full surface (scalars + aggregates), cross-file merge, module-var
  parity semantics, user-ZP allocator category, 2-digit-equate emission [AR-17, AR-18]
- **Non-terminating `main`** — conservative termination analysis behind `startup: "auto"`,
  platform `canReturn` folded in [AR-25]
- **T1 intrinsics end-to-end** — fixture usage + per-opcode coverage [AR-26]
- **Acceptance** — the hardened raw-vector raster fixture, three-part bar (assemble-clean +
  golden + local VICE) [AR-16; RD-18 §Acceptance Bar]

### Deferred / out of this plan

- **Strings/char encoding, `embed()`, the encoding seam** → the 8b plan
  `rd-18-slice-8b-strings-embed` [AR-19..24, AR-28 — named deferrals]; RD-18 acceptance item 7's
  `embed()`-traversal clause ticks at 8b, as does the rollout-closure phase (items 8–9) [AR-3]
- **Six unassigned deferrals stay loud ICEs / unregistered** — indexed compound-assign through a
  runtime index or pair; runtime `--bounds-check`; W10181; Pattern-B full-range `for`;
  caller-frame-scratch ICEs + `import {X as Y}`; block-scope shadowing R11 [AR-4..AR-9]
- **`export interrupt`** stays rejected (E10311) [AR-13]; **user-facing `&` on fields/elements**
  stays rejected (E10042, FUT-001) [AR-10]; **interrupt reentrancy diagnosis** stays out (FUT-004,
  documented hazard) [AR-15]

## Plan-local decisions

| Decision | Chosen | AR Ref |
| -------- | ------ | ------ |
| Slice split + ordering | 8a hardware first; 8b data later; closure rides 8b | AR-1, AR-3 |
| Names | `rd-18-slice-8-hardware`, `examples/slice8/` | AR-2 |
| New diagnostic codes (additive; `spec/` frozen per D3) | E10047 AddressOfConstScalar, E10048 AddressOfParameter, E10049 AddressOfNonAddressable, E10050 InterruptWrongSignature; wire dormant E10042 | AR-10, AR-14 |
| Recorded spec deviations | Ch 06 §7.7's `$0314` install example (crashes; raw-vector fixture instead); Ch 06 EBNF `: void` mandatory (optional here); F005 one-block rule (blocks merge); F005 ZP-5 per-variable export (unsupported — parse error) + E10031 unminted / E10033 spent on `RamBudgetExceeded` (PF-008); F004/Ch 10 §5.3 fall-through entry (shipped `JSR`/`JMP _main` shims — pre-existing, PF-010); Ch 03 §5.1 ZP-first init order (shipped: topological per Ch 10 §5.4) | AR-16, AR-12, AR-17, PF-008, PF-010 |
| Interrupt SFA policy | Irq-reachable set always-live; irq-only spill pool AND irq-only scratch twin (same key — PF-002); both-path fns = main pool + main scratch + documented hazard; mainline roots = `main`, `__init`, escaped non-interrupt fns (exports via real call edges only — PF-001) | AR-15 |
| Startup analysis bias | Conservative: claim non-terminating only when NO `ret` is reachable (false-terminating is 5 dead bytes; false-non-terminating is a crash) | AR-25 |

## Acceptance Criteria

Plan-local (the RD owns the slice-level criteria; item 7's non-embed clauses are proven here):

1. [ ] The `examples/slice8/` raster fixture passes the three-part bar on real VICE 3.10: the
       ZP frame counter (mirrored to RAM) reaches its saturation threshold under `runFrames`,
       and `$D020 & $0F` shows the border changed [AR-16; 03-06]
2. [ ] `zeropage {}` variables land inside the ZP range as 2-digit equates (the semantics
       `DEFAULT_PROFILE` range, $02–$2F, until per-platform semantics profiles land — PF-015);
       budget overflow rejects with the existing E10032 [AR-18]
3. [ ] A `while (true)` `main` compiles under `startup: "auto"` to the `JMP _main` shim; a
       returning `main` keeps the terminating shim; explicit overrides win [AR-25]
4. [ ] All four new codes reject with tests through the public facades; the two 7b by-ref
       arg-place ICE pins are retired loud-never-silent [AR-10, AR-14, AR-29]
5. [ ] All ten prior slice goldens stay byte-exact, or every re-mint is individually justified
       by an SFA-layout change from this slice's features (expected: `isEscaped`/interference
       effects are additive-only for programs with no interrupts and no `&`)
6. [ ] `git status --porcelain spec/` stays empty (D3)
