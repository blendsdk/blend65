# Requirements: RD-18 Slice 8b — Strings & Embed

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-18](../../requirements/RD-18-codegen-language-completion.md) — the OWNING
> requirements doc (Slice 8 row: "string/char encoding, embed()"; acceptance items 7–9;
> Security Considerations §embed; Parked-Question Routing Q2)

## Scope of this plan (delta view)

### In this plan

- **String literals** (Ch 08 §5 STR-1/2/4/6, §4.3/4.5-partial/4.6/4.7) — platform-encoded
  `const byte[]` sugar, raw bytes/no terminator, mutable-array init, bracketed+fill forms,
  mixed-init rejection (AR-1/AR-8)
- **Char literals** (Ch 08 §6 CL-1/CL-3; Ch 01 §8) — encoded `byte` constants in every byte
  position, including case labels and fills (AR-9)
- **Escape decoding** (Ch 01 §7.2) — the full shipped escape set resolved to bytes, with
  encoding-dependent escapes routed through the platform encoder (AR-2/AR-7)
- **The encoding seam** (8a AR-28 successor) — core-resident encoders + `CharEncoder`
  derivation in `analyze()` (AR-5/AR-6/AR-7); fixes the wrong a800xl/a7800 encoder stubs
- **Raw `embed()`** (Ch 13 EMB-1..4; RD-18 item 7's traversal clause; ledger R106–R108) —
  const-context rule, source-relative traversal-safe resolution, size inference/mismatch,
  data emission through the shipped const-data path (AR-10/AR-11/AR-12/AR-13)
- **Retirements** — the E90001 string-init ICE (`statement-typing.ts:881-894`) and the 8a
  zeropage-string negative pin, both rewritten to green per the retired-row protocol (AR-8)
- **RD-18 rollout closure** — acceptance items 8–9 (AR-15)

### Deferred / out of this plan

- Encoding-intrinsic family + `encode()` + E10125 (Ch 08 STR-3/CL-2, §4.5 encoded-string forms;
  grammar §7.3) — AR-4; fail naturally as undeclared identifiers
- Format-aware embed (Ch 13 §2.2/EMB-5/EMB-6, E10203/E10204, Ch 15 `embedFormats`) — AR-11;
  `format` arg = loud E90001
- Full per-platform encoding-table fidelity (graphics chars, shifted sets) — AR-5; Ch 15
  marks encodings "provisional"
- The six 8a-deferred loud ICEs (8a AR-4..9) — unchanged
- `--asset-path` (EMB-2's second search root) — AR-10 deviation, recorded

## Plan-local decisions

All plan-local decisions are the 17 register rows — see `00-ambiguity-register.md`; the
Key-Decisions table in `00-index.md` is the one-line summary. No decisions exist outside the
register.

## Acceptance Criteria (plan-local)

1. [ ] The three-part bar (assemble-clean + byte-exact golden + real-VICE runtime) passes on
   `examples/slice8b/` per AR-14 / 03-04
2. [ ] All ST-cases in `07-testing-strategy.md` green; the two retirements assert success
3. [ ] All eleven prior slice goldens remain byte-exact (encoding/embed changes are additive)
4. [ ] RD-18 acceptance items 7 (embed-traversal clause), 8, and 9 ticked in the RD; RD-04/06/07
   ACs audited per AR-15
5. [ ] `git status --porcelain spec/` empty throughout (D3)
