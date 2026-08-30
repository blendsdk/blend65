import { describe, expect, it } from "vitest";

import {
  decodeCanonicalHistoricalRecordV1,
  decodeFailureEnvelopeCanonicalV1,
  encodeFailureEnvelopeCanonicalV1,
  failureEnvelopeDigestV1,
  readFailureEnvelopeDataPropertyV1,
} from "./failure-envelope-codec.js";
import {
  normalizeFailureEnvelopeToolsV1,
  validateFailureEnvelopeIdentityV1,
} from "./failure-envelope-identity.js";
import {
  createFailureClaimWitnessesV1,
  failureWitnessEntailsRuleV1,
  validateFailureClaimWitnessesV1,
} from "./failure-claim-witness.js";
import { validateGeneratorIr } from "./generator-ir-validator.js";

import type { FailureHistoricalAuthorityRecordV1 } from "./failure-envelope-model.js";

const DIGEST_A = `sha256:${"a".repeat(64)}` as const;
const DIGEST_B = `sha256:${"b".repeat(64)}` as const;

function historicalRecord(bytes: Uint8Array): FailureHistoricalAuthorityRecordV1 {
  return Object.freeze({
    revision: "failure-historical-authority-record-v1",
    kind: "oracle",
    contentRevision: "test-revision",
    bytes,
    digest: failureEnvelopeDigestV1(bytes),
  });
}

function identityEnvelope(
  authorityDigests: unknown = [DIGEST_A],
  digestOverride?: string,
): { readonly value: Readonly<Record<string, unknown>>; readonly bytes: Uint8Array } {
  const withoutDigest = Object.freeze({
    revision: "failure-envelope-v1",
    family: "raw-malformed",
    replay: {},
    routePlanBytes: new Uint8Array(),
    routePlanDigest: DIGEST_A,
    predicate: {},
    policy: {},
    observationBytes: new Uint8Array(),
    toolVersions: [],
    initialCandidate: {},
    authorityDigests,
  });
  const value = Object.freeze({
    ...withoutDigest,
    digest:
      digestOverride ?? failureEnvelopeDigestV1(encodeFailureEnvelopeCanonicalV1(withoutDigest)),
  });
  return { value, bytes: encodeFailureEnvelopeCanonicalV1(value) };
}

describe("failure envelope canonical helper hardening", () => {
  it("should preserve stable keys, arrays, binary values, and bigint values", () => {
    const encoded = encodeFailureEnvelopeCanonicalV1({
      z: [2n, Uint8Array.from([0, 255])],
      a: { present: true },
    });

    expect(new TextDecoder().decode(encoded)).toBe(
      '{"a":{"present":true},"z":[{"$bigint":"2"},{"$bytes":"AP8="}]}\n',
    );
    expect(decodeFailureEnvelopeCanonicalV1(encoded)).toEqual({
      a: { present: true },
      z: [2n, Uint8Array.from([0, 255])],
    });
  });

  it("should reject cyclic and accessor-backed canonical input without invoking accessors", () => {
    const cyclic: { self?: object } = {};
    cyclic.self = cyclic;
    let invoked = false;
    const accessor = Object.defineProperty({}, "hostile", {
      enumerable: true,
      get() {
        invoked = true;
        return "unsafe";
      },
    });

    expect(() => encodeFailureEnvelopeCanonicalV1(cyclic)).toThrow(TypeError);
    expect(() => encodeFailureEnvelopeCanonicalV1(accessor)).toThrow(TypeError);
    expect(invoked).toBe(false);
  });

  it("should retain malformed wrapper-shaped data and reject invalid UTF-8 or JSON", () => {
    expect(
      decodeFailureEnvelopeCanonicalV1(
        new TextEncoder().encode('{"badBigint":{"$bigint":"01"},"badBytes":{"$bytes":"%%%"}}\n'),
      ),
    ).toEqual({ badBigint: { $bigint: "01" }, badBytes: { $bytes: "%%%" } });
    expect(() => decodeFailureEnvelopeCanonicalV1(Uint8Array.from([0xff]))).toThrow();
    expect(() => decodeFailureEnvelopeCanonicalV1(new TextEncoder().encode("not-json"))).toThrow();
  });

  it("should accept only historical bytes that already use the canonical encoding", () => {
    const canonical = encodeFailureEnvelopeCanonicalV1({ value: 3n });
    const nonCanonical = new TextEncoder().encode('{"value":{"$bigint":"3"}}');

    expect(decodeCanonicalHistoricalRecordV1(historicalRecord(canonical))).toEqual({ value: 3n });
    expect(decodeCanonicalHistoricalRecordV1(historicalRecord(nonCanonical))).toBeUndefined();
    expect(
      decodeCanonicalHistoricalRecordV1(historicalRecord(Uint8Array.from([0xff]))),
    ).toBeUndefined();
  });

  it("should read only own enumerable ordinary data properties", () => {
    const nullPrototype = Object.create(null);
    Object.defineProperty(nullPrototype, "safe", { value: 4, enumerable: true });
    const inherited = Object.create({ inherited: true });
    Object.defineProperty(inherited, "safe", { value: 5, enumerable: true });
    const accessor = Object.defineProperty({}, "safe", { get: () => 6, enumerable: true });
    const throwingProxy = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error("hostile proxy");
        },
      },
    );

    expect(readFailureEnvelopeDataPropertyV1(nullPrototype, "safe")).toBe(4);
    expect(readFailureEnvelopeDataPropertyV1(inherited, "safe")).toBeUndefined();
    expect(readFailureEnvelopeDataPropertyV1(accessor, "safe")).toBeUndefined();
    expect(readFailureEnvelopeDataPropertyV1(throwingProxy, "safe")).toBeUndefined();
    expect(readFailureEnvelopeDataPropertyV1([], "safe")).toBeUndefined();
    expect(readFailureEnvelopeDataPropertyV1(null, "safe")).toBeUndefined();
  });
});

describe("failure envelope identity helper hardening", () => {
  it("should reject invalid schemas and canonical structures", () => {
    expect(validateFailureEnvelopeIdentityV1({}, new Uint8Array())).toMatchObject({
      ok: false,
      code: "execution.invalid-schema",
      path: "/envelope",
    });
    const cyclic = identityEnvelope().value;
    const hostile: Record<string, unknown> = { ...cyclic };
    hostile.replay = hostile;
    expect(validateFailureEnvelopeIdentityV1(hostile, new Uint8Array())).toMatchObject({
      ok: false,
      code: "execution.invalid-schema",
    });
  });

  it("should distinguish noncanonical bytes, bad digests, and invalid authority sets", () => {
    const valid = identityEnvelope();
    expect(validateFailureEnvelopeIdentityV1(valid.value, valid.bytes)).toMatchObject({ ok: true });
    expect(validateFailureEnvelopeIdentityV1(valid.value, valid.bytes.slice(0, -1))).toMatchObject({
      ok: false,
      code: "execution.invalid-schema",
    });

    const badDigest = identityEnvelope([DIGEST_A], DIGEST_B);
    expect(validateFailureEnvelopeIdentityV1(badDigest.value, badDigest.bytes)).toMatchObject({
      ok: false,
      code: "execution.identity",
      path: "/envelope/digest",
    });

    for (const authorityDigests of [
      "not-an-array",
      ["not-a-digest"],
      [DIGEST_B, DIGEST_A],
      [DIGEST_A, DIGEST_A],
      Array.from({ length: 33 }, (_, index) => `sha256:${index.toString(16).padStart(64, "0")}`),
    ]) {
      const envelope = identityEnvelope(authorityDigests);
      expect(validateFailureEnvelopeIdentityV1(envelope.value, envelope.bytes)).toMatchObject({
        ok: false,
        code: "execution.invalid-schema",
        path: "/envelope/authorityDigests",
      });
    }
  });

  it("should deeply normalize, sort, and reject malformed or duplicate tools", () => {
    const tools = normalizeFailureEnvelopeToolsV1([
      { kind: "emulator", name: "vice", version: "3.10", digest: DIGEST_B },
      { kind: "compiler", name: "blendc", version: "0.1", digest: DIGEST_A },
      { kind: "assembler", name: "acme", version: "0.98", digest: DIGEST_A },
    ]);
    expect(tools?.map((tool) => tool.kind)).toEqual(["assembler", "compiler", "emulator"]);
    expect(Object.isFrozen(tools)).toBe(true);
    expect(Object.isFrozen(tools?.[0])).toBe(true);

    const validTool = { kind: "compiler", name: "blendc", version: "0.1", digest: DIGEST_A };
    for (const input of [
      "not-an-array",
      new Array(65),
      [{}],
      [{ ...validTool, kind: "linker" }],
      [{ ...validTool, name: "bad name" }],
      [{ ...validTool, version: "" }],
      [{ ...validTool, digest: "bad" }],
      [validTool, { ...validTool }],
    ]) {
      expect(normalizeFailureEnvelopeToolsV1(input)).toBeUndefined();
    }
  });
});

describe("failure claim witness hardening", () => {
  const byteRule = "rule.ch02.2-primitive-types.byte.range.0-255";

  it("should recognize scalar containers and every modeled memory width", () => {
    const byte = { kind: "literal", type: "byte", value: 1n };
    expect(failureWitnessEntailsRuleV1(byteRule, { kind: "return", value: byte })).toBe(true);
    expect(failureWitnessEntailsRuleV1(byteRule, { kind: "assign", value: byte })).toBe(true);
    expect(
      failureWitnessEntailsRuleV1(byteRule, {
        kind: "local",
        type: "word",
        initializer: byte,
      }),
    ).toBe(true);
    expect(failureWitnessEntailsRuleV1(byteRule, { kind: "return" })).toBe(false);
    expect(failureWitnessEntailsRuleV1("rule.unmodeled", byte)).toBe(false);
    for (const [ruleId, value] of [
      ["rule.memory-access.peek-byte", { kind: "memory-read", width: 1 }],
      ["rule.memory-access.peekw-word", { kind: "memory-read", width: 2 }],
      ["rule.memory-access.poke-byte", { kind: "memory-write", width: 1 }],
      ["rule.memory-access.pokew-word", { kind: "memory-write", width: 2 }],
    ] as const) {
      expect(failureWitnessEntailsRuleV1(ruleId, value)).toBe(true);
      expect(
        failureWitnessEntailsRuleV1(ruleId, { ...value, width: value.width === 1 ? 2 : 1 }),
      ).toBe(false);
    }
    expect(failureWitnessEntailsRuleV1(byteRule, null)).toBe(false);
    expect(failureWitnessEntailsRuleV1(byteRule, [])).toBe(false);
  });

  it("should derive exact paths and reject hostile witness pointers", () => {
    const validated = validateGeneratorIr({
      kind: "module",
      path: ["Witnesses"],
      constants: [],
      functions: [
        {
          kind: "function",
          name: "main",
          parameters: [{ name: "input", type: "byte" }],
          returnType: "byte",
          body: [{ kind: "return", value: { kind: "literal", type: "byte", value: 1n } }],
        },
      ],
    });
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    const witnesses = createFailureClaimWitnessesV1(validated.module, [byteRule], "module");
    expect(witnesses).toEqual([{ ruleId: byteRule, path: "/module/functions/0/parameters/0" }]);
    expect(
      createFailureClaimWitnessesV1(validated.module, ["rule.unmodeled"], "module"),
    ).toBeUndefined();
    expect(validateFailureClaimWitnessesV1(validated.module, witnesses ?? [], "module")).toBe(true);
    for (const path of [
      "/baseline/functions/0/parameters/0",
      "/module/functions/~0/parameters/0",
      "/module/functions/x/parameters/0",
      "/module/functions/9/parameters/0",
      "/module/functions/0/missing/0",
      "/module/functions/0/parameters/0/name/child",
    ]) {
      expect(
        validateFailureClaimWitnessesV1(validated.module, [{ ruleId: byteRule, path }], "module"),
      ).toBe(false);
    }
  });
});
