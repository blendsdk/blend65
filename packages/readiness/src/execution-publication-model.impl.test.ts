import { describe, expect, it } from "vitest";

import {
  EXECUTION_BINDINGS_V1_FILENAME,
  EXECUTION_PUBLICATION_MEMBER_LIMIT,
  EXECUTION_SEMANTIC_REVIEW_V1_FILENAME,
  computeExecutionPublicationDigest,
  createExecutionPublicationV1,
  digestExecutionPublicationBytes,
  equalExecutionPublicationBytes,
  executionPublicationFailure,
  parseExecutionBindingsV1,
  parseExecutionManifestV1,
  parseExecutionParentReferenceV1,
  parseExecutionPublicationPointerV1,
  parseExecutionSemanticReviewV1,
  renderExecutionPublicationJson,
  renderExecutionPublicationPointer,
  sortExecutionPublicationText,
} from "./execution-publication-model.js";

const PARENT_DIGEST = `sha256:${"1".repeat(64)}`;
const SPEC_DIGEST = `sha256:${"2".repeat(64)}`;

function bindingsBytes(): Uint8Array {
  return renderExecutionPublicationJson({
    schemaVersion: 1,
    kind: "execution-bindings-v1",
    bindings: ["acme", "cli", "compiler-api", "emit", "frontend", "vice"].map(
      (capabilityId, index) => ({
        capabilityId,
        contractVersion: "1.0.0",
        implementationRevision: `sha256:${String(index + 3).repeat(64)}`,
      }),
    ),
  });
}

function reviewBytes(bindingBytes: Uint8Array): Uint8Array {
  const accepted = (digit: string): object => ({
    digest: `sha256:${digit.repeat(64)}`,
    outcome: "accepted",
  });
  return renderExecutionPublicationJson({
    schemaVersion: 1,
    kind: "execution-semantic-review-v1",
    specRevision: SPEC_DIGEST,
    parentDigest: PARENT_DIGEST,
    bindingDigest: digestExecutionPublicationBytes(bindingBytes),
    ciSafe: accepted("a"),
    coverage: accepted("b"),
    localAcmeVice: accepted("c"),
    unresolvedCritical: 0,
    unresolvedMajor: 0,
    reviewer: "publication implementation reviewer",
    outcome: "accepted",
  });
}

describe("execution publication model", () => {
  it("should fail closed across malformed schemas and stale review joins", () => {
    expect(executionPublicationFailure("execution.io", "", "x".repeat(600))).toMatchObject({
      ok: false,
      issues: [{ message: `${"x".repeat(509)}...` }],
    });
    expect(parseExecutionBindingsV1("not bytes" as never)).toMatchObject({ ok: false });
    expect(
      parseExecutionBindingsV1(new Uint8Array(EXECUTION_PUBLICATION_MEMBER_LIMIT + 1)),
    ).toMatchObject({ ok: false });
    expect(parseExecutionBindingsV1(new TextEncoder().encode("{not-json\n"))).toMatchObject({
      ok: false,
    });

    const badContract = JSON.parse(new TextDecoder().decode(bindingsBytes()));
    badContract.bindings[0].contractVersion = "2.0.0";
    expect(parseExecutionBindingsV1(renderExecutionPublicationJson(badContract))).toMatchObject({
      ok: false,
      issues: [{ path: "/bindings/0/contractVersion" }],
    });
    const badRevision = JSON.parse(new TextDecoder().decode(bindingsBytes()));
    badRevision.bindings[0].implementationRevision = "bad";
    expect(parseExecutionBindingsV1(renderExecutionPublicationJson(badRevision))).toMatchObject({
      ok: false,
      issues: [{ path: "/bindings/0/implementationRevision" }],
    });

    const parentBytes = renderExecutionPublicationJson({
      schemaVersion: 1,
      kind: "execution-parent-publication-v1",
      parentDigest: PARENT_DIGEST,
    });
    expect(parseExecutionParentReferenceV1(parentBytes)).toMatchObject({ ok: true });
    expect(parseExecutionParentReferenceV1(renderExecutionPublicationJson({}))).toMatchObject({
      ok: false,
    });

    const bindingBytes = bindingsBytes();
    const review = JSON.parse(new TextDecoder().decode(reviewBytes(bindingBytes)));
    expect(
      parseExecutionSemanticReviewV1(
        reviewBytes(bindingBytes),
        `sha256:${"0".repeat(64)}`,
        digestExecutionPublicationBytes(bindingBytes),
      ),
    ).toMatchObject({ ok: false, issues: [{ path: "/parentDigest" }] });
    expect(
      parseExecutionSemanticReviewV1(
        reviewBytes(bindingBytes),
        PARENT_DIGEST,
        `sha256:${"0".repeat(64)}`,
      ),
    ).toMatchObject({ ok: false, issues: [{ path: "/bindingDigest" }] });
    for (const report of ["ciSafe", "coverage"] as const) {
      const invalid = structuredClone(review);
      invalid[report].outcome = "rejected";
      expect(
        parseExecutionSemanticReviewV1(
          renderExecutionPublicationJson(invalid),
          PARENT_DIGEST,
          digestExecutionPublicationBytes(bindingBytes),
        ),
      ).toMatchObject({ ok: false, issues: [{ path: `/${report}` }] });
    }

    expect(
      createExecutionPublicationV1({
        parentDigest: PARENT_DIGEST,
        bindingBytes: renderExecutionPublicationJson({}),
        semanticReviewBytes: reviewBytes(bindingBytes),
      }),
    ).toMatchObject({ ok: false });
  });

  it("should reconstruct canonical release identity from exact accepted members", () => {
    const bindingBytes = bindingsBytes();
    const created = createExecutionPublicationV1({
      parentDigest: PARENT_DIGEST,
      bindingBytes,
      semanticReviewBytes: reviewBytes(bindingBytes),
    });

    expect(created.ok).toBe(true);
    if (!created.ok) throw new TypeError(created.issues[0].message);
    expect(created.value.digest).toBe(
      computeExecutionPublicationDigest(created.value.manifestBytes),
    );
    expect(parseExecutionManifestV1(created.value.manifestBytes)).toMatchObject({ ok: true });
    expect(created.value.members.size).toBe(3);

    const malformedManifest = JSON.parse(new TextDecoder().decode(created.value.manifestBytes));
    malformedManifest.kind = "wrong";
    expect(
      parseExecutionManifestV1(renderExecutionPublicationJson(malformedManifest)),
    ).toMatchObject({ ok: false });
    const malformedMember = JSON.parse(new TextDecoder().decode(created.value.manifestBytes));
    malformedMember.members[0].byteLength = 0;
    expect(parseExecutionManifestV1(renderExecutionPublicationJson(malformedMember))).toMatchObject(
      {
        ok: false,
        issues: [{ path: "/members/0" }],
      },
    );
  });

  it("should reject noncanonical JSON and extra binding keys before authority joins", () => {
    const pretty = new TextEncoder().encode(
      JSON.stringify(JSON.parse(new TextDecoder().decode(bindingsBytes())), null, 2),
    );
    expect(parseExecutionBindingsV1(pretty)).toMatchObject({
      ok: false,
      issues: [{ code: "execution.invalid-schema", path: "/bindings" }],
    });

    const document = JSON.parse(new TextDecoder().decode(bindingsBytes()));
    document.bindings[0].extra = true;
    expect(parseExecutionBindingsV1(renderExecutionPublicationJson(document))).toMatchObject({
      ok: false,
      issues: [{ code: "execution.invalid-schema", path: "/bindings/0" }],
    });
  });

  it("should distinguish duplicate rows from stale declared capability rows", () => {
    const duplicate = JSON.parse(new TextDecoder().decode(bindingsBytes()));
    duplicate.bindings[1] = { ...duplicate.bindings[0] };
    expect(parseExecutionBindingsV1(renderExecutionPublicationJson(duplicate))).toMatchObject({
      ok: false,
      issues: [{ code: "execution.invalid-schema", path: "/bindings/1" }],
    });

    const stale = JSON.parse(new TextDecoder().decode(bindingsBytes()));
    stale.bindings[0].capabilityId = "link";
    expect(parseExecutionBindingsV1(renderExecutionPublicationJson(stale))).toMatchObject({
      ok: false,
      issues: [{ code: "execution.stale-authority", path: "/bindings/0/capabilityId" }],
    });
  });

  it("should parse only an exact canonical selected pointer", () => {
    const digest = `sha256:${"d".repeat(64)}`;
    expect(parseExecutionPublicationPointerV1(renderExecutionPublicationPointer(digest))).toEqual({
      ok: true,
      value: {
        schemaVersion: 1,
        kind: "execution-publication-pointer-v1",
        publicationDigest: digest,
      },
    });
    expect(
      parseExecutionPublicationPointerV1(
        renderExecutionPublicationJson({
          schemaVersion: 1,
          kind: "execution-publication-pointer-v1",
          publicationDigest: digest,
          extra: true,
        }),
      ),
    ).toMatchObject({ ok: false });
  });

  it("should reject a review whose accepted report or issue counts are not closed", () => {
    const bindingBytes = bindingsBytes();
    const review = JSON.parse(new TextDecoder().decode(reviewBytes(bindingBytes)));
    review.localAcmeVice.outcome = "rejected";
    expect(
      createExecutionPublicationV1({
        parentDigest: PARENT_DIGEST,
        bindingBytes,
        semanticReviewBytes: renderExecutionPublicationJson(review),
      }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "execution.invalid-schema", path: "/localAcmeVice" }],
    });
  });

  it("should bound inputs before copying and retain one defensive byte snapshot", () => {
    const bindingBytes = bindingsBytes();
    const semanticReviewBytes = reviewBytes(bindingBytes);
    const created = createExecutionPublicationV1({
      parentDigest: PARENT_DIGEST,
      bindingBytes,
      semanticReviewBytes,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new TypeError(created.issues[0].message);
    const retainedBindings = new Uint8Array(
      created.value.members.get(EXECUTION_BINDINGS_V1_FILENAME)!,
    );
    const retainedReview = new Uint8Array(
      created.value.members.get(EXECUTION_SEMANTIC_REVIEW_V1_FILENAME)!,
    );
    bindingBytes.fill(0);
    semanticReviewBytes.fill(0);
    expect(created.value.members.get(EXECUTION_BINDINGS_V1_FILENAME)).toEqual(retainedBindings);
    expect(created.value.members.get(EXECUTION_SEMANTIC_REVIEW_V1_FILENAME)).toEqual(
      retainedReview,
    );

    expect(
      createExecutionPublicationV1({
        parentDigest: PARENT_DIGEST,
        bindingBytes: new Uint8Array(EXECUTION_PUBLICATION_MEMBER_LIMIT + 1),
        semanticReviewBytes: retainedReview,
      }),
    ).toMatchObject({ ok: false, issues: [{ code: "execution.invalid-schema" }] });
  });

  it("should compare exact bytes and sort text without mutating callers", () => {
    const source = ["vice", "acme"];
    expect(equalExecutionPublicationBytes(new Uint8Array([1]), new Uint8Array([1, 2]))).toBe(false);
    expect(equalExecutionPublicationBytes(new Uint8Array([1]), new Uint8Array([2]))).toBe(false);
    expect(equalExecutionPublicationBytes(new Uint8Array([1]), new Uint8Array([1]))).toBe(true);
    expect(sortExecutionPublicationText(source)).toEqual(["acme", "vice"]);
    expect(source).toEqual(["vice", "acme"]);
  });
});
