# Identity, Deterministic Choices and Replay

> **Document**: 03-03-identity-replay.md
> **Parent**: [Index](00-index.md)

## Overview

Every case-shaping input is explicit, canonical and content-addressed. Random selection is
random-access by generation path rather than a mutable global stream (AR-P4, AR-P5).

## Identity contracts

`CampaignIdentityInput` carries exactly the fields owned by RD-02, including inventory schema/
version/digest/spec revision, rule-model version/digest, generator and boundary-transform binding
identities, renderer revision, target, PRNG ID/version, seed and configuration digest.

Canonical encoding uses a closed field sequence, length-prefixed UTF-8 values, decimal BigInt
strings and LF. Domain tags are distinct for configuration, campaign, draw and case digests.

```ts
interface CaseIdentity {
  readonly campaignDigest: Sha256Digest;
  readonly generationPath: readonly number[];
  readonly ordinal: number;
  readonly digest: Sha256Digest;
}
```

The implementation retains canonical preimages during a campaign and rejects an unequal-preimage
digest collision.

## Deterministic choice source

`blend65-sha256-ctr-v1` computes each block from campaign seed, generation path and draw ordinal.
Bounded integers use rejection sampling, never modulo bias. A sibling-path insertion cannot alter
draws on an existing path.

## Replay

```ts
type ReplayResult =
  | { readonly ok: true; readonly case: GeneratedCase; readonly source: Uint8Array }
  | { readonly ok: false; readonly kind: "replay-incompatible"; readonly missing: IdentityComponent }
  | { readonly ok: false; readonly kind: "replay-invalid"; readonly diagnostics: readonly ReplayDiagnostic[] };
```

The replay envelope carries the complete closed normalized generation configuration as well as the
identities and path/ordinal. Replay verifies its bytes against the configuration digest, then
resolves every exact digest/revision before generation. Any missing component, missing
configuration or digest/content mismatch returns `replay-incompatible`; it never substitutes
current implementations, consults ambient process configuration or emits partial source (AR-P6).
Bulk cases remain ephemeral; identity plus digest-verified configuration reconstructs them under
the current supported revision.

## Input safety

Replay JSON is parsed with byte/depth/string/count limits, closed properties and duplicate-key
rejection. Target, algorithm, identity and logical path values use allowlists. No replay field is
joined to a host path (AR-P12).

## Tests

- Official deterministic vectors for counter blocks and rejection sampling.
- Fresh-process byte equality.
- Field-by-field identity mutation, including inventory content and boundary transform.
- Path-local stability when unrelated branches are inserted.
- Collision fixture with injected digest function.
- Missing exact revision with no fallback calls.
- Fresh-process replay with no ambient campaign configuration.
- Missing configuration and configuration digest/content mismatch.
