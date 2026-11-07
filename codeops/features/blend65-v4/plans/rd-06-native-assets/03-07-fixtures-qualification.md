# Fixtures and Qualification: RD-06 Native Assets

> **Document**: 03-07-fixtures-qualification.md
> **Parent**: [Index](00-index.md)

## Overview

This component owns the data-only fixture manifest, the public PSID/Koala/raw fixtures, the
producer-evidence checkpoints, malformed/adjacent-version derivations, bounded VICE checks, public
status text, host observations and the closeout evidence. It never invokes SpritePad, CharPad or
GoatTracker on Linux, and it never labels a handmade or comparative file as producer evidence.

## Architecture

### Fixture manifest

`test/rd06/fixtures/manifest.json` is the single source of truth (AR-7, AR-15). Helper tools live in
`test/rd06/fixture-tools/`, not under the fixture media folders. Schema version 1:

```json
{
  "schemaVersion": 1,
  "fixtures": [
    {
      "id": "psid-v1-fixed-pal-6581",
      "family": "psid",
      "path": "public/psid/psid-v1-fixed-pal-6581.sid",
      "provenance": {
        "kind": "constructed",
        "source": "HVSC SID_file_format.txt",
        "sourceSha256": "b89a78d3c1d90d0b8c6b4cfd2001be026ad6c2c31b73cdbab857c627a60779f0",
        "author": "Blend65 compiler team",
        "date": "2026-11-07"
      },
      "producer": null,
      "producerVersion": null,
      "settings": {},
      "license": {
        "disposition": "redistributable",
        "text": "Synthetic public-format fixture; no third-party content."
      },
      "sha256": "<lowercase sha-256>",
      "expected": {
        "parse": "accept",
        "selectors": {
          "data": { "type": "byte[]", "length": 1234, "sha256": "<lowercase sha-256>" },
          "init_address": { "type": "word", "value": 40960 },
          "play_address": { "type": "word", "value": 40963 }
        }
      },
      "malformedOf": null,
      "derivation": null
    }
  ]
}
```

Producer fixtures add `provenance.kind: "producer-save"`, exact producer version, save settings,
operator/date/machine, original-save confirmation, redistribution approval and attribution.
Malformed fixtures add `malformedOf` and a derivation recipe naming the exact byte or block change.
The manifest validator checks that every file under `test/rd06/fixtures/public/**` and every
producer family folder has exactly one entry, every entry resolves to a file, every SHA-256 matches,
and every expected selector hash matches the committed bytes. Helper tools are excluded by path.

### Fixture families

| Family | Source | Gate |
| --- | --- | --- |
| `raw` | Deterministic public bytes | None |
| `psid` | Constructed from the pinned HVSC format description | None |
| `koala` | Deterministic public 10,003-byte files | None |
| `spritepad` | SpritePad 3.80 SPD v5 producer saves | AR-1 / AR-37 / AR-50 |
| `charpad` | CharPad 3.88 CTM v9 producer saves | AR-1 / AR-37 / AR-50 |
| `goattracker` | GoatTracker 2.77 exports and player identity | AR-2 / AR-44 |

### Public fixture construction

Public PSID and Koala fixtures are authored by the compiler implementation owner (RD-06 R6.1). They
are not producer evidence, and their manifest `provenance.kind` is `constructed`, not
`producer-save`. Construction must be deterministic and committed as bytes; tests do not generate
fixtures at run time.

- PSID: one fixed-load and one payload-load-address file for each accepted version, with valid
  PAL/NTSC/model combinations and all negative classes. Headers are big-endian; payloads are tiny,
  readable 6502 routines with a nonzero play address. Spec tests hardcode the spec-derived header
  values; the manifest supplies the committed bytes and SHA-256.
- Koala: zero-pattern, patterned, Color-RAM high-nibble and background high-nibble files, each
  exactly 10,003 bytes with `$6000` load address. Spec tests hardcode the component lengths and
  high-bit expectations; the manifest supplies the committed bytes and SHA-256.
- Raw: nonempty, empty, 511/513-byte boundary and unregistered-extension files.

### Producer evidence checkpoints

The Windows checklist is [00-rd-06-producer-evidence-handoff.md](../../00-rd-06-producer-evidence-handoff.md).
A checkpoint passes only when:

1. a named owner records completion in the manifest;
2. the exact producer version screenshot is present;
3. every required `MIN`/`ALL`/`WIDE`/optional or display × color × tile fixture is present;
4. `provenance.txt` states the save settings, operator/date/machine and original-save confirmation;
5. retention/redistribution approval is explicit;
6. SHA-256 values match the received bytes; and
7. expected selector outputs are recorded from the producer exports, not guessed.

The Linux side then derives v4/v6 or v8/v10, truncation, count/index and trailing-byte cases and
records the derivation recipe in the manifest.

### VICE checks

- Reuse the existing pinned harness: `test/m1/vice-runtime.ts`, `test/m1/vice-monitor.ts` and
  `test/rd05/profile-fixture.ts`. Do not add a second process-spawning harness.
- Use the pinned VICE 3.10 `x64sc` and the four cooperative profiles.
- Run sequentially so concurrent `x64sc` instances do not contend.
- Check only hardware-facing consumption: PSID data at the effective load address, Koala bitmap/
  screen visibility and derived fields, Color RAM transfer, Q-P15 draw order/occlusion/update, and
  player calls/effects when a contract exists.
- VICE observation supports but does not replace the typed/byte behavior oracle or the final
  artifact/cost oracle.
- Report `VICE-verified / hardware-unverified`.

### Public status

The status text names each handler, exact accepted identity, completed fixture roles, supported
selectors, selected profiles and evidence level. Missing producer/player evidence is a blocker, not
`Verified partial`. Optional physical listening evidence may remain explicitly bounded.

### Host observations

Record per-handler parse/type/layout/build duration and peak host memory against the named fixtures.
These are trends, not wall-clock gates, and they do not authorize an incremental cache. Refresh them
at closeout so the blocked handlers are covered once their evidence lands.

### Deferral expiry

Before RD-06 closes, answer whether its deliverables invalidated any deferral rationale, walk the
ambiguity registers, Won't Have lists, Specification 4 future considerations and the expressiveness
ledger, and re-own every due item. No deferral may name closed RD-06 work as its future owner.

## Error handling

| Error case | Handling strategy | AR Ref |
| --- | --- | --- |
| Manifest missing/duplicate/unlisted file | Test failure naming the path | AR-15 |
| Hash mismatch | Test failure with expected/actual | AR-15 |
| Producer evidence incomplete | Family blocked; no decoder task executes; owner/completion recorded | AR-1, AR-51 |
| Different producer version | Reject the checkpoint; never relabel | AR-1 |
| Third-party content not redistributable | Local-only evidence path with committed manifest and hashes | AR-15 |
| VICE unavailable | Report the blocked check; do not claim runtime proof | AR-38 |
| Host timing threshold | Not a correctness gate; trend only | AR-43 |

## Testing Requirements

- Manifest completeness, hash equality, selector inventory and expected output hashes.
- Public fixture construction determinism and exact bytes.
- Producer checkpoint validator with a negative "missing MIN" and "wrong version" case.
- Sequential VICE smoke for PSID and Koala.
- Status text includes exact identities and the VICE/hardware boundary.
- Deferral-expiry checklist with no orphaned item.
