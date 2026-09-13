# RD-01 Execution Closeout

> **Status**: In progress
> **Last Updated**: 2026-09-13 13:09
> **Scope**: Specification and expert-authority evidence only; compiler and runtime artifacts are
> excluded.

## Phase 1: Baseline and Exact Semantic Oracles

### Bootstrap and input authority

The execution entry check passed before any Specification or live expert-skill edit.

| Boundary | Verified value |
|---|---|
| Working directory | `/home/gevik/workdir/github/blend65.ri/v4` |
| Branch | `feature/v4-rebuild` |
| Clean execution-start commit | `5e07ad736a95728a0d84ed3e0732bb464f61d2ea` |
| Phase baseline tree | `80803ebbebc89f82e482b1652e74531c2b25aae4` |
| Recorded final-v3 ancestor | `4c2f27f54273a713c0bbf398bf6c56be45f4aae3` |
| Parked v3 worktree | `/home/gevik/workdir/github/blend65.ri/blend65-asm-parity`; clean on `feature/domain-expert-skill` at `4c2f27f54273a713c0bbf398bf6c56be45f4aae3` |
| Specification 3 identity | `BLEND65-SPEC-P3-4bf8a989`; exact 50-path digest `4bf8a98934df6282febe013c31a16d89dd73f8e8bbbce9e87b6678e1b75013fe` |
| Active expert | `blend65-domain-expert` 1.0.0; qualified content commit `a96cfd3c41a456d4d4f983021cf43535a1d5bdaa` |
| Expert runtime payload | `bb05def96d180926bbc2cb57131550f633d2c87369a2b34c97b55d148d2cdf82` |
| Expert content-checkpoint tree | `4379f1d0a7d6e8c3523c647591994a86fb5bfc99d66f75edf5b9a16b3c925e00` reproduced from the qualified content commit |
| Accepted v4 decisions | AR-001–AR-050: 50 rows, all resolved; register SHA-256 `f6ebe65771b5ea3a658f3ffe891540ea1030dfe45d9307802b0241c6c1618002` |

#### Direct verification record

| Command | Exit | Result |
|---|---:|---|
| `pwd` and `git branch --show-current` | 0 | Expected v4 directory and `feature/v4-rebuild` |
| `git merge-base --is-ancestor 4c2f27f54273a713c0bbf398bf6c56be45f4aae3 HEAD` | 0 | The v4 branch descends from the recorded final-v3 source |
| `git worktree list --porcelain` plus parked-worktree branch, HEAD, and status checks | 0 | The recorded parked v3 worktree is present, clean, and unchanged |
| `find spec -type f -name '*.md' -print0 \| LC_ALL=C sort -z \| xargs -0 sha256sum \| sha256sum` | 0 | 50 paths; digest `4bf8a98934df6282febe013c31a16d89dd73f8e8bbbce9e87b6678e1b75013fe` |
| `git cat-file -e a96cfd3c41a456d4d4f983021cf43535a1d5bdaa^{commit}` and ancestry check | 0 | The qualified expert content commit exists and is an ancestor of this execution |
| Runtime-payload digest over `SKILL.md`, `agents`, and `references` | 0 | Matches `bb05def96d180926bbc2cb57131550f633d2c87369a2b34c97b55d148d2cdf82` |
| Full skill-tree digest from `git archive a96cfd3c41a456d4d4f983021cf43535a1d5bdaa` | 0 | Matches `4379f1d0a7d6e8c3523c647591994a86fb5bfc99d66f75edf5b9a16b3c925e00` |
| Decision-register row count and unresolved-row search | 0 | Exactly 50 rows; no open or deferred decision |
| `git diff --quiet 5e07ad7 -- spec .agents/skills/blend65-domain-expert` | 0 | No Specification or live expert-skill edit occurred during this task |

### Frozen Specification 3 path baseline

Authority roles follow the current P3 hierarchy: chapters, grammar, and platform appendices own
normative behavior; evaluations are subordinate rationale; navigation, future, and historical
workflow records are non-normative. This classification is frozen before content changes.

| P3 relative path | Raw SHA-256 | Authority role | Normative |
|---|---|---|---|
| `00-feature-index.md` | `69a59b32ffcbfaeb20df710a5e180bb89c52a7ac440355dd03594de7b9d29be3` | Non-normative navigation | No |
| `00-introduction.md` | `4b4383a5c1aed474362b3fdd5b70415c3361fff081e6510f77a85439f2c9584c` | Primary chapter | Yes |
| `01-lexical-structure.md` | `2cfbae064ee7d25cfe797e1bce71242915c35853e8c336fa0c5032e6fadcc237` | Primary chapter | Yes |
| `02-type-system.md` | `0cbbbdc4d33336b977fb8129bf0667b247caec665002d6fb4e6b7523d259e92b` | Primary chapter | Yes |
| `03-variables.md` | `62e89c259e6926771008674ac22099bee2dbc4f8ff8e12a3808531f4ebf13623` | Primary chapter | Yes |
| `04-expressions-operators.md` | `1b90cdde575c0d6bb044d0470ce71cc600fd96faeefa3fef856b94079c6a99e1` | Primary chapter | Yes |
| `05-statements-control-flow.md` | `88c5f440944fdb0b6c3f56dc73a12a26976668a8bda7b55f9b4e2b0c8f18fe57` | Primary chapter | Yes |
| `06-functions.md` | `835df78f83673c7aab2a5a4a5c23698a370a328b45caaf561a5e44e09f8f7122` | Primary chapter | Yes |
| `07-structs.md` | `2cdb9c4cfbe8ff7860fd94be0d2fa76311f187e003d8de1e7d9b5dc60d4fe3df` | Primary chapter | Yes |
| `08-arrays-strings.md` | `a81151e18cab3b4905f2384e9585a05ecf2f8f008002edcda73ad7f516475ece` | Primary chapter | Yes |
| `09-enums.md` | `ee8c53eabdf272d8628a43d5fa6ff399ac8ebf833040ec731d56b5ab6e87f81f` | Primary chapter | Yes |
| `10-modules.md` | `65a051644de9708b649ccc2ce5a9f90cb5f185cf3f5600b3375d70d4ac55157b` | Primary chapter | Yes |
| `11-memory-model.md` | `d11d9503c6c3d47390878bbb44706276e9ced26f6e81ad6140a1d0b378626584` | Primary chapter | Yes |
| `12-intrinsics.md` | `6ffe7e2cfa0ab8d03246079b11469ebb5fbcfb8bd43633456226ef8f146a24a6` | Primary chapter | Yes |
| `13-data-inclusion.md` | `1ccbbd51aac25b49c3da65e925ed7064381a0b8c0b966b65a7816a74d74af1c2` | Primary chapter | Yes |
| `14-diagnostics.md` | `c6adb3bc6c56f669897eb627b1233adcf1a5c64d8dfc14c9da1257dda2fd70bf` | Primary chapter | Yes |
| `15-platform-profile.md` | `c3bfc60f7b228008963d14fb08cbd0db451e75154ec66e86905836f99f088691` | Primary chapter | Yes |
| `appendix-a7800.md` | `3964cdc8edeca9166fa2de09d278c7feafe343661eaf1d833f83701d9df1afd0` | Primary platform appendix | Yes |
| `appendix-a800xl.md` | `66998b1df4d28fabba331cb6bbc330ff3e7fa1b47458e0cf08c25d7f69354059` | Primary platform appendix | Yes |
| `appendix-c64.md` | `45303c3781330be4c1526d4be983a4a34a6bda57913f8a9bb0b8a595194f016f` | Primary platform appendix | Yes |
| `appendix-c64u.md` | `7b5aca722dd8729e2d5114e1ff84bb42a0889f39b80c7c583e8e677a64694ef3` | Primary platform appendix | Yes |
| `appendix-cx16.md` | `b3c4dcbb0f40e88e84e9996a722667b592264f5900b4c0459d75584ac160a97b` | Primary platform appendix | Yes |
| `build-plan.md` | `e1f091ebd224decc287298ef9021599eb42f3d1aaaceb6afe19cfbf64b1d3029` | Non-normative workflow/history | No |
| `evaluations/F001-multi-file.md` | `1ac353a27e3d0896130505e47af6e46f263f7c400319a6e99214554d36f90623` | Subordinate evaluation | No |
| `evaluations/F002-modules.md` | `427f434a0ab7d4803ee73139cb9c126542b13e15d1f8146a38a715049c4551a0` | Subordinate evaluation | No |
| `evaluations/F003-module-contents.md` | `0c7ed05c8a3c55e90364497ba618770c51683ba2e5ba7f55f79aa820aa9f4351` | Subordinate evaluation | No |
| `evaluations/F004-entry-point.md` | `68447e4869d4c214c8f591a083f8d30771541aa5a5551b4b42c57b1609ca129d` | Subordinate evaluation | No |
| `evaluations/F005-memory-placement.md` | `e3a745a7a4c24dd5fab701d4dcb49b50ccdd15a121559a716bbeb3e1c1935c66` | Subordinate evaluation | No |
| `evaluations/F006-address-of.md` | `7dcc9fa3ac1d25bcebe19944d5bd0432684ca7f814af66a1b8ac558a84c5b2f7` | Subordinate evaluation | No |
| `evaluations/F007-interrupt-functions.md` | `138d9de8048cef7cf4df5534d59d2fee603262940d6f6ba442819c666e9f4930` | Subordinate evaluation | No |
| `evaluations/F008-for-loop.md` | `87abd325432e402629dcc722b11e3f19e719169957f9782489f6794ad6dedefa` | Subordinate evaluation | No |
| `evaluations/F009-switch-statement.md` | `3658d379f7948c4f59f7aad6ea0c5bc6ca200386e30520ce1091f155bcff33a4` | Subordinate evaluation | No |
| `evaluations/F010-signed-types.md` | `9de2457b49b9267e4b40c78c8b458de36bbaadce8a1fcd28d7d96a29565eba27` | Subordinate evaluation | No |
| `evaluations/F011-structs.md` | `6497b85374ae668d3c5093405c4a26807cb0cab7450b2dc37be30e0be6cfe99d` | Subordinate evaluation | No |
| `evaluations/F012-cpu-control-intrinsics.md` | `aa1d4550868d5fa3354b65818f9dee560b18f2b3c75cd1562028dee87c65e01c` | Subordinate evaluation | No |
| `evaluations/F013-control-flow.md` | `d55469dc4de5f52d32896bec8f32bb5ae21ada506737c18b79b8a77f1629fbb9` | Subordinate evaluation | No |
| `evaluations/F014-arrays.md` | `eadc729d20483d47f15586ec800b0c9bcfc3fe74e1ab10121ba3633a2d725254` | Subordinate evaluation | No |
| `evaluations/F015-data-inclusion.md` | `1afc8d09fbd8127e4d328d7ec86d68c30e16d3ac831998e67cafa0bfc354a8c5` | Subordinate evaluation | No |
| `evaluations/F016-type-system.md` | `b89ade22bd92b5e02535642b7905717b26acc5b7d9c0fd570d5cb5010b14c66f` | Subordinate evaluation | No |
| `evaluations/F017-operators.md` | `6c31c4aa21caab78bcd4211201e353358bcabdccdb6ee0867309e265b00c9430` | Subordinate evaluation | No |
| `evaluations/F018-functions.md` | `81d24cfd5b7d4cf7412be71b2469bf16f10293645826c5a435587822b26830d9` | Subordinate evaluation | No |
| `evaluations/F019-variables.md` | `0c97883fc6e8394ee784ba81be499a24209f257bb384ecb44c66354dd6badf0c` | Subordinate evaluation | No |
| `evaluations/F020-memory-intrinsics.md` | `25c5b0d380080f05c80c0156a04b12138b184bdddbd958e229e4265d21b9ecb7` | Subordinate evaluation | No |
| `evaluations/F021-lexical-structure.md` | `1ec8bee4d0391624fb7c172dad594ab8ad206c49a3d0bc0e84f674d51b0428e2` | Subordinate evaluation | No |
| `evaluations/F022-enums.md` | `1a326523061f55657954afff7b144c94bb0fb08e8aad2bcca24105c2909ae270` | Subordinate evaluation | No |
| `evaluations/F024-conditional-operator.md` | `533dd0b6c44ae18f475b6b83f158477242ec6cb4614cb751fd1b9538093e0084` | Subordinate evaluation | No |
| `future-considerations.md` | `2ab1564497cb695ce111220a7f221740520ce9ea5752f3c603010ae4e37e8273` | Non-normative future register | No |
| `grammar.ebnf.md` | `1f4408b200a097e29fed9a6ab4f6738b277dbc30a3fe63881bd12ebd5722e85c` | Primary grammar | Yes |
| `preflight-report.md` | `5cea653e346c03f3fcb1acf05a4e8d27828ad348a8bdbbcde582e596862deedb` | Non-normative workflow/history | No |
| `v2-to-v3-migration.md` | `881eca2b359ff183452b335df6ce2044de517810db28a55ff90f422e692a269c` | Non-normative workflow/history | No |

### Exact integer trigonometry oracle

For `k` in `{8,16}`, let `N = 2^k`, `A = 2^(k-1)-1`, and let unsigned phase `p`
denote `p/N` turns. The observable results are:

```text
sin_k(p) = roundNearestAwayFromZero(A × sin(2πp/N))
cos_k(p) = sin_k((p + N/4) mod N)
```

This fixes results without prescribing a compiler algorithm.

| Function | Range | Canonical sine-stream encoding | SHA-256 |
|---|---|---|---|
| `sin8` | `-127..127` | Phases `0..255`; one two's-complement byte per result | `fec3247a063767c499a18d6efdb1e5f86f96f859e2e98a859d621e93af013259` |
| `sin16` | `-32767..32767` | Phases `0..65535`; little-endian two's-complement words | `e0313f89310605acaa740fa67cf9fb157e363c9bd4af10fea66d8846735c5a50` |

| Representative input | Result |
|---|---:|
| `sin8(0)` | 0 |
| `cos8(0)` | 127 |
| `sin8(32)` | 90 |
| `sin8(64)` | 127 |
| `sin8(128)` | 0 |
| `sin8(192)` | -127 |
| `sin16(8192)` | 23170 |
| `sin16(16384)` | 32767 |
| `sin16(32768)` | 0 |
| `sin16(49152)` | -32767 |

An independent one-shot Node calculation using `node:crypto`, phase-by-phase `Math.sin`, explicit
half-away-from-zero rounding, and the stated encodings exited 0. It reproduced both ranges, all ten
representative results, and both canonical fingerprints exactly.

### `comptime-budget-v1` oracle

One fixed, non-configurable counter set is shared by every compile-time root in one `check` or
`build`, consumed in deterministic semantic evaluation order.

| Resource | Exact limit | First rejected attempt |
|---|---:|---|
| Abstract steps | 16,777,216 | Step 16,777,217 |
| Peak live logical Blend65 value storage | 16,777,216 bytes | Any allocation that would raise live storage above 16,777,216 bytes |
| Active compile-time calls | 512, with the root at depth 1 | A call that would enter depth 513 |

Every rejected operation fails before that operation, mutation, argument evaluation, allocation,
or function body executes. The failed root is poisoned and no target artifact is emitted.

#### Charging and lifetime rules

- Charge one step before each selected expression node, statement node, loop iteration, function
  entry, and each logical aggregate byte initialized, copied, or materialized.
- Charge nothing for short-circuited expressions or unselected branches.
- Caching may reduce host work but must charge the same abstract steps as uncached evaluation.
- Count scalars at their language byte width and arrays/structs at normative `sizeof`.
- Count live parameters, locals, expression temporaries, in-progress aggregates, return values, and
  retained generated constants.
- An alias adds no memory charge. Reading an existing immutable constant or validated embedded
  asset without copying adds no second charge. A real copy or materialization charges its logical
  bytes.
- Release storage at its defined full-expression, block, call, or evaluation-phase lifetime
  boundary. Released bytes may be reused by later deterministic work.
- Host allocator overhead and caching strategy cannot change source acceptance. A host OOM is a
  bounded compiler failure, not E10270, and publishes no artifact when it can report or clean up.

#### Boundary examples

| Case | Required result |
|---|---|
| Exactly 16,777,216 charged steps | Allowed |
| A selected node would charge step 16,777,217 | E10269 before the node or any effect |
| Exactly 16,777,216 logical bytes are live | Allowed |
| An allocation would make 16,777,217 logical bytes live | E10270 before allocation or mutation |
| Storage is released at its specified lifetime boundary before a later allocation | The later allocation uses the reduced live total |
| A second name aliases existing storage | No extra memory charge |
| The same value is explicitly copied | Charge the copied logical bytes and their aggregate-byte steps |
| A right-hand expression is skipped by short-circuiting | No step or temporary-memory charge for that expression |
| A memoized result replaces host recomputation | Charge as though the uncached semantic evaluation ran |
| Earlier and later roots run in one `check` or `build` | They consume the same counters in deterministic semantic order |
| Root plus nested calls reach depth 512 | Allowed |
| A call would enter depth 513 | E10271 before argument evaluation or callee entry |

E10269, E10270, and E10271 each name `comptime-budget-v1`, the exact limit and attempted usage, the
root invocation, the failing source span, and a related root span.

### Pinned C64 source records

These three records are the complete external-source packet for the Phase 3 D64/KERNAL/Koala
clauses. They freeze source facts only; they add no loader framework, allocation policy, or asset
runtime.

#### `CBM-1541-D64-35` — standard 35-track disk and D64 geometry

- **Authority and pins:** Commodore's *VIC-1541 Floppy Drive User's Manual*, manufacturer
  publication preserved at
  <https://www.commodore.ca/wp-content/uploads/2018/11/commodore_vic_1541_floppy_drive_users_manual.pdf>,
  SHA-256 `b98f28916579d63c5f18ded32c04ed07d3e87c9fb3155abc988c2fdd41b3fd97`;
  recovered original Commodore DOS 2.6 source `DOS_1541_05` at `mist64/cbmsrc` commit
  `01bd60f162ef92212ef0cb67546ae8f42be34168`, with `romtblsf.src` SHA-256
  `f0938ecdee9d3d8dd39443a2d106f6714ebbc3b3fcec643d13c62ab491448b1c`, `tst2.src`
  SHA-256 `9e18edc1f3ccb3b8c383b3d4f47f780c716c9bf9daefe26f953ac736332711f4`, and
  `tst4.src` SHA-256 `e6ca75b5f84317269585945ff6c1d0f4c66353d15f742779436000efb6952a46`.
  VICE 3.10 tag `3.10.0`, commit `4d283a2e7dd59b7e378524878e81ecc7826b700c`, pins the
  host-image mapping: `vice/src/diskimage.h` SHA-256
  `f611ef0b3059edd57859d0ef39231ee0421825a470b4cc32df447def92c64588`,
  `vice/src/diskimage/diskimage.c` SHA-256
  `ddc53b5ebc6bf181dda9f1088b26a760aca4df9f5cba138a9cfa730cea42e251`, and
  `vice/src/diskimage/fsimage-check.c` SHA-256
  `ffdcac825ed79140885fd8e1d872d762fa65f4ffdcd1cd92711f0108164153c3`.
- **Exact facts:** tracks 1–17 have 21 sectors, 18–24 have 19, 25–30 have 18, and 31–35
  have 17: 683 sectors total. A headerless, error-table-free D64 stores the 256-byte sectors in
  track/sector order and is 174,848 bytes. Track 18 is the system track, leaving 664 data blocks.
  BAM is 18/0 and the directory begins at 18/1. Each directory sector has eight entries, so the
  18 available directory sectors hold at most 144 entries. A closed PRG entry has type byte `$82`.
  File-sector bytes 0–1 are the next track/sector and bytes 2–255 hold up to 254 data bytes. In the
  final sector, byte 0 is zero and byte 1 is the last used byte index, so its payload count is
  `byte1 - 1`.
- **Precise locations:** manual printed pages 10, 24–27, and 55–57; DOS
  `romtblsf.src::numsec/maxtrk`, `tst4.src::nxtbuf`, and `tst2.src::rdbyt`; VICE
  `D64_FILE_SIZE_35`, `sector_map_d64`, `disk_image_speed_map`, and
  `fsimage_check_sector`.
- **Limit:** these records define geometry and interpretation. They do not select RD-07's later
  measured sector allocation/interleave policy.

#### `CBM-C64-KERNAL-LOAD-03` — KERNAL 901227-03 loader ABI

- **Primary ABI authority and pin:** _Commodore 64 Programmer's Reference Guide_, Commodore
  Business Machines, 1982, ISBN 0-672-22056-3, Chapter 5 scan at
  <https://www.commodore.ca/wp-content/uploads/2018/11/c64-programmers_reference_guide-05-basic_to_machine_language.pdf>,
  SHA-256 `58262099fc7ef9e95e0b6d2cd9f50de12ed48f0a30625456269bcda7f8a6436a`.
  Printed pages 286, 297, and 299 define `LOAD`, `SETLFS`, and `SETNAM`, including addresses,
  inputs, setup order, relocation behavior, and the returned end address.
- **ROM-exact implementation cross-check:** `mist64/cbmsrc` commit
  `01bd60f162ef92212ef0cb67546ae8f42be34168` contains a verified reconstruction of KERNAL
  901227-03, manually patched from the revision-03 listing and 1987 BSO source rather than an
  untouched original source. Its `README.md` has SHA-256
  `db3e44cdcd3a9e99f53e5e352128c5ea67dabccc8732b99288e3bc7b5c677d6c`. Exact source-file hashes are
  `init` `a19581404b6a7bddaac322c06f3bc5c7f5b442b81175c50acdfd6c48a0dcd180`,
  `load` `c4ee7c1abb358a6caa4e91f30937e7d71b099f621a8f7e8388cd4e10c37ad6c7`,
  `vectors` `7e5a1954d592b4ff48ace641f9432795a6a9a37c1f3b97d4b52333f5324ef714`,
  `declare` `d7ea21632b3a4e2d2282bf12a284325267a3eca39f6d24f2759e78a14b182fe2`,
  and `errorhandler` `5282c6bffaa68db16105858ca8437c969294a1271e8255eeed5a5f14d63a0db1`.
- **Exact facts:** jump-table entries are `SETLFS` `$FFBA`, `SETNAM` `$FFBD`, and `LOAD` `$FFD5`.
  `SETLFS` takes logical file/device/secondary address in A/X/Y; `SETNAM` takes length in A and
  filename address in X/Y. `LOAD` takes 0 in A for load and, when the secondary address is 0, the
  relocating destination in X/Y. Successful serial load writes directly from that address until
  end-of-information, returns the one-past-end address in X/Y, and clears carry. Errors return an
  error number in A with carry set. The manual's “highest RAM location loaded” wording conflicts
  with revision 901227-03: the ROM-exact `LD50`–`LD64` path increments `EAL/EAH` after each stored
  byte, and `LD180`–`LD190` returns that one-past-end value, which therefore governs this selected
  ROM contract. The current device is `FA` at `$BA`; reusing it for the boot device is project
  policy built on that recorded state, not a ROM requirement.
- **Resources and integrity bound:** the path uses KERNAL state including `STATUS`, `VERCK`,
  `MEMUSS`, `EAL/EAH`, `FNLEN`, `FNADR`, `LA`, `SA`, and `FA`, plus serial/KERNAL service calls.
  `LOAD` has no destination-length parameter and stores each received byte before testing the final
  returned address. This is the source fact behind `HLE-010`: a readable longer replacement can
  overwrite beyond the expected range before the wrapper detects the wrong end address.
- **Precise locations:** manual Appendix B entries B-15, B-28, and B-30; reconstructed-source
  `vectors` jump table; `init::SETNAM/SETLFS`; `load::LOADSP/NLOAD`, `LD25`–`LD90`, and
  `LD180`–`LD190`; `declare` `$90` workspace; `errorhandler::ERROR1`–`EREXIT`.

#### `KOALA-NATIVE-003` — classic Koala layout

- **Authority and pins:** Codebase64 graphics-formats list v0.03 raw record, retrieved
  2026-09-13 from
  <https://codebase64.net/doku.php?id=base:c64_grafix_files_specs_list_v0.03&do=export_raw>,
  SHA-256 `e544700ddff4288239260d14a5c5be3ee5fa956e0132cbdf345ff02f0b1077e0`;
  independently pinned Retropixels producer at commit
  `a5caf5b889eff11528768cf6b1d16585c47b4122`, `cli/README.md` SHA-256
  `ef1cd543b019f972286bcc6b872a7038d68ec92427aaaf62e87eb52fdd605945`.
- **Exact facts:** the accepted uncompressed file is exactly 10,003 bytes: little-endian `$6000`,
  8,000 bitmap bytes, 1,000 screen bytes, 1,000 Color RAM bytes, and one background byte, in that
  order.
- **Precise locations:** Codebase64 “Koala Painter 2” address table and Retropixels
  `cli/README.md` “Output formats” table.
- **Limit:** neither source is the original Koala Painter manual. They establish the classic byte
  layout, not selector names or unused-high-nibble behavior. Exact full-byte preservation with only
  low-nibble VIC-II color meaning is the separately approved AR-039/AR-041 project policy.

### Phase 1 verification

| Command | Exit | Result |
|---|---:|---|
| `npx prettier --check codeops/features/blend65-v4/00-roadmap.md codeops/features/blend65-v4/plans/rd-01-specification-4-and-expert-authority-freeze/{08-closeout.md,99-execution-plan.md}` | 0 | All touched Markdown is formatted |
| `python3 /home/gevik/.codex/plugins/cache/codeops-marketplace/codeops/1.2.0/scripts/validate_markdown_links.py codeops/features/blend65-v4` | 0 | All local links resolve |
| `python3 /home/gevik/.codex/plugins/cache/codeops-marketplace/codeops/1.2.0/scripts/codeops_plan.py --root . --plan codeops/features/blend65-v4/plans/rd-01-specification-4-and-expert-authority-freeze --json` | 0 | 31 tasks; 5 verified; 26 pending; no parse problem |
| Literal one-shot Node block below | 0 | Both trigonometric tables regenerated; fingerprints and representative values match; every budget boundary phrase is present |
| Literal `sha256sum` block below | 0 | Every recorded external-source SHA-256 value reproduces, including the manufacturer manual and reconstruction README |
| `git diff --name-only 80803ebbebc89f82e482b1652e74531c2b25aae4` plus `git diff --quiet 5e07ad7 -- spec .agents/skills/blend65-domain-expert` | 0 | Only the closeout, plan, and feature roadmap differ from baseline; `spec/` and the live expert skill are unchanged |
| `git diff --check` | 0 | No whitespace error |

The semantic-oracle row used this one-shot command; it creates no validator or repository artifact:

```bash
node --input-type=module <<'NODE'
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const roundAway = (x) => x < 0 ? -Math.floor(-x + 0.5) : Math.floor(x + 0.5);
const generate = (k) => {
  const n = 2 ** k;
  const a = 2 ** (k - 1) - 1;
  const values = Array.from({ length: n }, (_, p) => roundAway(a * Math.sin(2 * Math.PI * p / n)));
  const bytes = k === 8 ? Buffer.from(values.map((v) => v & 0xff)) : Buffer.from(values.flatMap((v) => [v & 0xff, (v >> 8) & 0xff]));
  return { values, hash: createHash('sha256').update(bytes).digest('hex') };
};
const a = generate(8);
const b = generate(16);
if (a.hash !== 'fec3247a063767c499a18d6efdb1e5f86f96f859e2e98a859d621e93af013259') throw new Error('sin8 hash');
if (b.hash !== 'e0313f89310605acaa740fa67cf9fb157e363c9bd4af10fea66d8846735c5a50') throw new Error('sin16 hash');
for (const [actual, expected] of [[a.values[0],0],[a.values[32],90],[a.values[64],127],[a.values[128],0],[a.values[192],-127],[b.values[8192],23170],[b.values[16384],32767],[b.values[32768],0],[b.values[49152],-32767]]) if (actual !== expected) throw new Error(`vector ${actual} != ${expected}`);
const closeout = readFileSync('codeops/features/blend65-v4/plans/rd-01-specification-4-and-expert-authority-freeze/08-closeout.md', 'utf8');
for (const phrase of ['Step 16,777,217','16,777,217 logical bytes','depth 513','short-circuited expressions','An alias adds no memory charge','same counters in deterministic semantic order','Caching may reduce host work','Release storage at its defined']) if (!closeout.includes(phrase)) throw new Error(`missing budget phrase: ${phrase}`);
NODE
```

The external-source row used this literal command after retrieving the pinned sources:

```bash
sha256sum /tmp/commodore-vic-1541-users-manual.pdf \
  /tmp/cbmsrc-01bd60/DOS_1541_05/{romtblsf.src,tst2.src,tst4.src} \
  /tmp/blend65-p6-0J7BIF/vice-3.10/vice/src/diskimage.h \
  /tmp/blend65-p6-0J7BIF/vice-3.10/vice/src/diskimage/{diskimage.c,fsimage-check.c} \
  /tmp/c64-prg-ch5.pdf /tmp/cbmsrc-01bd60/README.md \
  /tmp/cbmsrc-01bd60/KERNAL_C64_03/{init,load,vectors,declare,errorhandler} \
  /tmp/codebase64-koala-v003.txt /tmp/retropixels-cli-readme.md
```

The independent phase review corrected one provenance label: the KERNAL source is now accurately
recorded as a ROM-exact reconstruction, while the manufacturer manual owns the public ABI. This
required no new artifact, validator, or implementation mechanism.

The final independent correctness re-review found no remaining issue. It confirmed the literal
verification commands, the manual/ROM return-address reconciliation, the unchanged specification
test tier, and the strict three-document Phase 1 scope.

Phase 1 therefore meets V-01, V-06, V-07, and V-16. It creates evidence only and introduces no
implementation mechanism.

## Phase 2: Complete Language Reconciliation

Phase 2 started from tree `6fef4ce0d7848bc3e14c175045866364cc6986ed` (commit `003cba8`).
Its seven authoring tasks reconciled only the accepted AR-006, AR-014–AR-020, AR-031, and AR-050
language decisions. The final pass repaired derived copies of those decisions; it added no syntax,
runtime, framework, generator, schema, dependency, or test harness.

### V-05 semantic, grammar, and diagnostic evidence

| Changed language group | Consistency result |
|---|---|
| Three-clause loops and scopes | One grammar and semantic model; ordinary nested shadowing; same-scope E10003; E10101 and range-loop diagnostics retired |
| Fixed arithmetic and arrays | Width and direct-subscript rules agree; fixed arrays have exact-shape value assignment/return; extents and size diagnostics agree |
| Aggregates and addresses | Caller-owned aggregate return and alias-safe value copies agree; parameters, fields, and indexed elements are addressable places; E10041/E10042 restrictions are retired |
| Function values and interrupts | Typed finite target sets, distinct handler kinds, and per-sink LIFO ownership agree across types, functions, grammar, examples, and E10277/E10278; E10267/E10268 retain their reserved public-artifact meanings |
| Compile-time functions | Typed source form, deterministic root order, exact integer trigonometry, and E10269–E10271 agree |
| Placement and loadable data | The closed `place(...)` keys, package-only `loadable const`, captured-range publication, and E10272–E10276 agree |
| Intrinsics and safety | Exactly five CPU controls remain; variable-address memory access is ordered; bounds and division modes are explicit; no runtime is introduced |
| Deferred-feature register | FUT-001, FUT-002, FUT-003, FUT-009, FUT-010, FUT-013, and FUT-014 now record their approved Specification 4 resolutions |

The active diagnostic set in Chapter 14 and the feature-index discovery table contain the same
181 codes. Searches over the live semantic corpus found old range, address, aggregate, intrinsic,
and BRK spellings only where rejection or retirement history intentionally names them. Phase 3
still owns target/version statements and deletion of the obsolete build, preflight, and migration
records; this pass did not pull that separate work forward.

### V-06 and V-07 oracle reproduction

The Phase 1 trigonometry command was run twice. Both runs reproduced the canonical `sin8` and
`sin16` SHA-256 fingerprints and all ten representative sine/cosine values. The Phase 2 normative
text carries those same formulas, encodings, ranges, values, and fingerprints.

Direct inspection of Chapter 06, F025, and Chapter 14 confirmed one `comptime-budget-v1` meaning
for every selected-node charge, aggregate byte, short-circuit, alias/copy, cache-equivalent charge,
lifetime release, exact N/N+1 boundary, and call depth 512/513. E10269–E10271 reject before the
failed operation and a failed build publishes no target artifact.

### Phase 2 direct verification

| Command | Exit | Result |
|---|---:|---|
| `if rg -n 'for_range\|range_for\|E10101\|E10041\|E10042\|E10093\|E10119\|E10120\|brk_contract\|asm_(pha\|pla\|brk\|sed\|cld\|clv\|clc\|sec)\(' spec/0[1-9]-*.md spec/1[0-3]-*.md spec/grammar.ebnf.md; then exit 1; fi` | 0 | No obsolete Phase 2 restriction remains in active normative chapters or the master grammar |
| Literal diagnostic-set Node block below | 0 | Chapter 14 and the feature index contain the same 181 active codes |
| Literal V-06 Node block below | 0 | Two runs reproduce both fingerprints and ten representative values |
| Literal V-07 Node block below | 0 | All required `comptime-budget-v1` clauses are present |
| `git diff --name-only 003cba8 -- '*.md' \| xargs npx prettier --check` | 0 | Every Phase 2 changed Markdown file is formatted |
| `python3 /home/gevik/.codex/plugins/cache/codeops-marketplace/codeops/1.2.0/scripts/validate_markdown_links.py spec codeops/features/blend65-v4` | 0 | All local links resolve |
| `python3 /home/gevik/.codex/plugins/cache/codeops-marketplace/codeops/1.2.0/scripts/codeops_plan.py --root . --plan codeops/features/blend65-v4/plans/rd-01-specification-4-and-expert-authority-freeze --json` | 0 | 31 tasks parse; 13 verified; no plan problem |
| `if git diff --name-only 003cba8 -- '*.spec.test.*' \| grep -q .; then exit 1; fi` | 0 | The immutable specification-test tier is untouched |
| `if find spec -type l -print -quit \| grep -q .; then exit 1; fi` | 0 | The specification contains no symlink |
| `git diff --check` | 0 | No whitespace error |

The diagnostic-set check was:

```bash
node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';
const chapter = readFileSync('spec/14-diagnostics.md', 'utf8').split('## 5. Retirement')[0];
const index = readFileSync('spec/00-feature-index.md', 'utf8').split('Retired codes, former draft')[0];
const codes = (source) => new Set([...source.matchAll(/^\| ([EW]\d{5}) \|/gm)].map((match) => match[1]));
const chapterCodes = codes(chapter);
const indexCodes = codes(index);
if ([...chapterCodes].some((code) => !indexCodes.has(code)) || [...indexCodes].some((code) => !chapterCodes.has(code))) throw new Error('diagnostic mismatch');
console.log(chapterCodes.size);
NODE
```

The V-06 check was:

```bash
node --input-type=module <<'NODE'
import { createHash } from 'node:crypto';
const roundAway = (value) => value < 0 ? -Math.floor(-value + 0.5) : Math.floor(value + 0.5);
const generate = (width, cosine = false) => {
  const count = 2 ** width;
  const amplitude = 2 ** (width - 1) - 1;
  const values = Array.from({ length: count }, (_, phase) => roundAway(amplitude * (cosine ? Math.cos(2 * Math.PI * phase / count) : Math.sin(2 * Math.PI * phase / count))));
  const bytes = width === 8 ? Buffer.from(values.map((value) => value & 0xff)) : Buffer.from(values.flatMap((value) => [value & 0xff, (value >> 8) & 0xff]));
  return { values, hash: createHash('sha256').update(bytes).digest('hex') };
};
for (let run = 0; run < 2; run += 1) {
  const sin8 = generate(8);
  const sin16 = generate(16);
  const cos8 = generate(8, true);
  if (sin8.hash !== 'fec3247a063767c499a18d6efdb1e5f86f96f859e2e98a859d621e93af013259') throw new Error('sin8 hash');
  if (sin16.hash !== 'e0313f89310605acaa740fa67cf9fb157e363c9bd4af10fea66d8846735c5a50') throw new Error('sin16 hash');
  for (const [actual, expected] of [[sin8.values[0],0],[cos8.values[0],127],[sin8.values[32],90],[sin8.values[64],127],[sin8.values[128],0],[sin8.values[192],-127],[sin16.values[8192],23170],[sin16.values[16384],32767],[sin16.values[32768],0],[sin16.values[49152],-32767]]) if (actual !== expected) throw new Error('representative value');
}
NODE
```

The V-07 check was:

```bash
node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';
const source = ['spec/06-functions.md','spec/evaluations/F025-comptime-functions.md','spec/14-diagnostics.md'].map((path) => readFileSync(path, 'utf8')).join('\n');
for (const phrase of ['comptime-budget-v1','16,777,216','16,777,217','depth 512','depth 513','Short-circuited','An alias adds no','copied, or materialized','Caching','released at its','before argument evaluation','emits no target artifact','E10269','E10270','E10271']) if (!source.includes(phrase)) throw new Error(`missing: ${phrase}`);
NODE
```

### Phase 2 quality-review corrections

The first independent review reported six major consistency findings and one minor evidence
finding. The user authorized the following direct corrections on 2026-09-13:

| Finding | Resolution |
|---|---|
| RV-001 | Restored E10267/E10268 to their required public-artifact meanings; moved the two language errors to unused E10277/E10278 |
| RV-002 | Permitted exact-signature function values and same-kind handler values in conditional expressions |
| RV-003 | Added optional `place_clause` to ordinary and interrupt function fragments; compile-time functions remain unplaceable |
| RV-004 | Defined install/restore ownership as an interprocedural state transformation; consistent net installs transfer to the caller, while selected-profile termination owns the final boundary |
| RV-005 | Extended E10080 to incompatible exact aggregate assignment and return and added owning examples/tables |
| RV-006 | Made the read primary and the governing load plus blocking flow/alias fact related spans for E10276 |
| RV-007 | Replaced shorthand verification evidence with the literal commands and numeric exits above |

The first re-review confirmed RV-001–RV-007 resolved and found one minor example mismatch: a
returning C64 `main` installed an IRQ handler without restoring entry ownership. The example now
imports and calls `restoreIRQ()` before returning to BASIC. The final bounded re-review reported no
findings. It also reconfirmed formatting, links, plan parsing, 181-code equality, V-06/V-07, clean
whitespace, and that no `*.spec.test.*` file changed.

The review used `blend65-domain-expert` 1.0.0 at qualified content commit
`a96cfd3c41a456d4d4f983021cf43535a1d5bdaa`, including the interrupt route-completion gate in
`knowledge/sfa-and-abi.md`.

Phase 2 therefore satisfies the assigned portions of V-05, V-06, V-07, and V-16. The remaining
target, corpus-freeze, source-authority, and final all-23 Guard checks stay in Phase 3 as planned.

## Phase 3: C64 Authority and Specification Freeze

### Native assets and D64/KERNAL source reconciliation

The Specification 4 clauses were checked directly against the three source records pinned before
the specification edit. No source was added or substituted.

| Frozen source record | Specification result |
|---|---|
| `KOALA-NATIVE-003` | Classic 10,003-byte order is exact. All 1,001 color source bytes are preserved; only their low nibbles have VIC-II color meaning. This behavior comes from the accepted project policy because the layout sources do not define unused-bit policy. |
| `CBM-1541-D64-35` | One 174,848-byte, 35-track, 683-sector image; exact track sector counts, 18/0 BAM, 18/1 directory start, 664 data blocks, 144-entry limit, closed `$82` PRG entries, 254-byte sector payloads, and final-sector length rule are normative. The later packager still owns its measured allocation/interleave policy. |
| `CBM-C64-KERNAL-LOAD-03` | The selected 901227-03 wrapper uses `$FFBA`/`$FFBD`/`$FFD5`, secondary address zero, boot-device reuse, relocating X/Y destination, clear-carry success, and the ROM-exact one-past-end result. Application quiescence, direct destination write, captured-range publication/invalidation, and `HLE-010` trusted-media scope are explicit. |

The active native asset set is exactly raw fallback, SPD v5, CTM v9, the qualified PSID v1–v4
subset, and classic Koala. No loader plugin, fastloader, compressor, staging buffer, checksum,
runtime registry, or extra native format was introduced.
