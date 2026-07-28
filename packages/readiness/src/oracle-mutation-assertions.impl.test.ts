import { describe, expect, it } from "vitest";

import {
  evaluateOracleMutationAssertion,
  impossibleOracleMutationAssertion,
  resolveOracleMutationAssertionRow,
  runOracleMutationVectorForConformance,
} from "./oracle-mutation-assertions.js";
import {
  oracleMutationIdForPath,
  oracleMutationPathRegistry,
  oracleMutationVectorIdForPath,
} from "./oracle-mutation-model.js";
import {
  loadOracleMutationAssertionPacket,
  normalizeOracleMutationAssertionData,
} from "./oracle-mutation-packet.js";
import { hydrateOracleMutationSuite } from "./oracle-mutation-suite.js";

describe("oracle mutation assertion internals", () => {
  it("normalizes closed decimal and boolean data without accepting hostile values", () => {
    expect(
      normalizeOracleMutationAssertionData({
        integer: { value: "-1" },
        nonCanonical: { value: "01" },
        literals: [
          { kind: "literal", type: "boolean", value: true },
          { kind: "literal", type: "boolean", value: false },
        ],
      }),
    ).toMatchObject({
      ok: true,
      value: {
        integer: { value: -1n },
        nonCanonical: { value: "01" },
        literals: [
          { kind: "literal", type: "boolean", value: 1n },
          { kind: "literal", type: "boolean", value: 0n },
        ],
      },
    });
    expect(
      normalizeOracleMutationAssertionData(new Uint8Array(new SharedArrayBuffer(1))),
    ).toMatchObject({ ok: false });
  });

  it("rejects malformed assertions and observations before exact comparison", () => {
    const invalidAssertions: readonly unknown[] = [
      null,
      { kind: "other", expected: null },
      { kind: "exact-observation", expected: null, extra: true },
    ];
    for (const assertion of invalidAssertions) {
      expect(evaluateOracleMutationAssertion(assertion, null)).toMatchObject({ ok: false });
    }
    expect(
      evaluateOracleMutationAssertion(
        { kind: "exact-observation", expected: { value: "1" } },
        new Uint8Array(new SharedArrayBuffer(1)),
      ),
    ).toMatchObject({ ok: false });
    expect(
      evaluateOracleMutationAssertion(
        { kind: "exact-observation", expected: { value: "1" } },
        { value: "1" },
      ),
    ).toEqual({ ok: true, passed: true });
    expect(
      evaluateOracleMutationAssertion(
        { kind: "exact-observation", expected: { value: "1" } },
        { value: "2" },
      ),
    ).toEqual({ ok: true, passed: false });
  });

  it("closes unknown vectors, mismatched selections, and impossible assertions", async () => {
    await expect(resolveOracleMutationAssertionRow("vector.unknown.v1")).resolves.toMatchObject({
      ok: false,
    });
    await expect(runOracleMutationVectorForConformance("vector.unknown.v1")).resolves.toMatchObject(
      { ok: false },
    );

    const path = oracleMutationPathRegistry().paths[0]!;
    const vectorId = oracleMutationVectorIdForPath(path);
    const resolved = await resolveOracleMutationAssertionRow(vectorId);
    expect(resolved).toMatchObject({ ok: true });
    if (!resolved.ok) throw new TypeError("expected mutation assertion row");
    expect(impossibleOracleMutationAssertion(resolved.row)).toMatchObject({
      kind: "exact-observation",
      expected: { diagnosticCode: `impossible.${vectorId}` },
    });
    await expect(
      runOracleMutationVectorForConformance(vectorId, {
        mutantId: `${oracleMutationIdForPath(path)}.wrong`,
        operationId: path.operationId,
        pathId: path.pathId,
        variantId: path.variantId,
      }),
    ).resolves.toMatchObject({
      ok: false,
      diagnostics: [{ path: "/selection" }],
    });
  });

  it("rejects stale semantic-suite descriptors and replay configuration", async () => {
    const packet = await loadOracleMutationAssertionPacket();
    expect(packet).toMatchObject({ ok: true });
    if (!packet.ok) throw new TypeError("expected mutation assertion packet");
    const row = packet.rows.find(({ fixture }) => fixture.kind === "semantic-relation");
    if (row?.fixture.kind !== "semantic-relation") {
      throw new TypeError("expected semantic relation fixture");
    }
    const { suite, request } = row.fixture;
    const configuration = request.sourceProvenance.configuration;
    await expect(
      hydrateOracleMutationSuite({ ...suite, suiteId: "unknown" as never }, configuration),
    ).resolves.toMatchObject({ ok: false });
    await expect(
      hydrateOracleMutationSuite(
        { ...suite, inventoryDigest: `sha256:${"0".repeat(64)}` },
        configuration,
      ),
    ).resolves.toMatchObject({ ok: false });
    await expect(
      hydrateOracleMutationSuite(suite, {
        ...configuration,
        caseCount: configuration.caseCount + 1,
      }),
    ).resolves.toMatchObject({ ok: false });
    await expect(
      hydrateOracleMutationSuite(
        {
          ...suite,
          replayRevisions: {
            ...suite.replayRevisions,
            generator: `sha256:${"0".repeat(64)}`,
          },
        },
        configuration,
      ),
    ).resolves.toMatchObject({ ok: false });
    await expect(hydrateOracleMutationSuite(null as never, configuration)).resolves.toMatchObject({
      ok: false,
    });
    await expect(hydrateOracleMutationSuite(suite, null as never)).resolves.toMatchObject({
      ok: false,
    });
  });
});
