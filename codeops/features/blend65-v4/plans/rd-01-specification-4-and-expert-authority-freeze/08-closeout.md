# RD-01 Execution Closeout

> **Status**: In progress
> **Last Updated**: 2026-09-13 12:35
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
