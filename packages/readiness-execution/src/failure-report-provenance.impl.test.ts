import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { afterEach, describe, expect, it, vi } from "vitest";

interface SidecarStub {
  readonly projection?: object;
  readonly bytes?: Uint8Array | undefined;
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

afterEach(() => {
  vi.doUnmock("./failure-predicate-evidence.js");
  vi.resetModules();
});

describe("execution report provenance authority", () => {
  it("retains exact positions and rejects incomplete report, route, sidecar, and tool joins", async () => {
    vi.doMock("./failure-predicate-evidence.js", () => ({
      getFailurePredicateEvidenceStateV1(sidecar: SidecarStub) {
        return sidecar.projection;
      },
      getFailurePredicateEvidenceProjectionV1(sidecar: SidecarStub) {
        return sidecar.projection;
      },
      getFailurePredicateEvidenceObservationBytesV1(sidecar: SidecarStub) {
        return sidecar.bytes;
      },
    }));
    const provenance = await import("./execution-report-provenance.js");
    const routePlanBytes = new TextEncoder().encode("route plan");
    const result = { status: "failure" };
    const route = Object.freeze({
      caseIdentity: "case",
      ruleId: "rule",
      obligation: "frontend",
      terminalTier: "frontend",
      prerequisiteTiers: Object.freeze([]),
    });
    const retainedRequest = Object.freeze({ kind: "valid-envelope", route });
    const report = (selectedResult: object = result) => ({
      routePlanDigest: sha256(routePlanBytes),
      results: [selectedResult],
      routeRecords: [
        {
          caseIdentity: route.caseIdentity,
          ruleId: route.ruleId,
          obligation: route.obligation,
          terminalTier: route.terminalTier,
          result: selectedResult,
        },
      ],
    });
    const occurrence = (overrides: Record<string, unknown> = {}) => ({
      parent: {},
      execution: {},
      route,
      request: retainedRequest,
      payload: {},
      completion: { oracleContractDigest: "oracle", toolContractDigests: [] },
      ...overrides,
    });
    const sidecar = (overrides: SidecarStub = {}): SidecarStub => ({
      projection: { kind: "ordinary-route-facts" },
      bytes: new Uint8Array([1]),
      ...overrides,
    });
    const retain = (
      selectedReport: object,
      sidecars: readonly unknown[],
      occurrences: readonly unknown[],
      bytes: unknown = routePlanBytes,
    ) =>
      provenance.retainExecutionAuthorityReportProvenanceV1(
        selectedReport as never,
        sidecars as never,
        occurrences as never,
        bytes as never,
      );

    const retainedReport = report();
    expect(retain(retainedReport, [sidecar()], [occurrence()])).toBe(true);
    const retained = provenance.getExecutionAuthorityReportProvenanceStateV1(
      retainedReport as never,
    );
    expect(retained).toMatchObject({ report: retainedReport });
    expect(retained?.occurrences).toHaveLength(1);
    expect(retained?.positions).toHaveLength(1);
    expect(retained?.routePlanBytes).not.toBe(routePlanBytes);
    expect(retained?.occurrences[0]?.route).toBe(route);
    expect(Object.isFrozen(retained?.occurrences[0]?.route.prerequisiteTiers)).toBe(true);
    expect(retain(retainedReport, [sidecar()], [occurrence()])).toBe(false);
    expect(
      provenance.getExecutionReportPositionStateV1(retained?.positions[0] as never),
    ).toMatchObject({ report: retainedReport });
    const positionedRequest = provenance.getExecutionReportPositionRequestV1(
      retained?.positions[0] as never,
    );
    expect(positionedRequest).toEqual({ ok: true, value: retainedRequest });
    if (!positionedRequest.ok) throw new TypeError("retained position request");
    expect(positionedRequest.value).toBe(retainedRequest);
    expect(Object.isFrozen(positionedRequest.value)).toBe(true);
    expect(Object.keys(positionedRequest)).toEqual(["ok", "value"]);
    expect(provenance.getExecutionAuthorityReportProvenanceStateV1(null as never)).toBeUndefined();
    expect(provenance.getExecutionAuthorityReportProvenanceStateV1({} as never)).toBeUndefined();
    expect(provenance.getExecutionReportPositionStateV1(null as never)).toBeUndefined();
    expect(provenance.getExecutionReportPositionStateV1({} as never)).toBeUndefined();
    for (const position of [null, {}, { ...retained?.positions[0] }]) {
      expect(provenance.getExecutionReportPositionRequestV1(position as never)).toMatchObject({
        ok: false,
        issues: [{ code: "unbound-capability", path: "/position" }],
      });
    }

    vi.resetModules();
    const foreignProvenance = await import("./execution-report-provenance.js");
    expect(
      foreignProvenance.getExecutionReportPositionRequestV1(retained?.positions[0] as never),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "unbound-capability", path: "/position" }],
    });

    const withoutBytes = report();
    expect(retain(withoutBytes, [sidecar({ bytes: undefined })], [occurrence()])).toBe(true);
    expect(
      provenance.getExecutionReportOccurrenceObservationBytesV1(
        provenance.getExecutionAuthorityReportProvenanceStateV1(withoutBytes as never)!
          .occurrences[0]!,
      ),
    ).toBeUndefined();

    expect(retain(report(), [], [occurrence()])).toBe(false);
    expect(retain(report(), [sidecar()], [])).toBe(false);
    expect(retain(report(), [sidecar()], [occurrence()], {})).toBe(false);
    expect(retain(report(), [sidecar()], [occurrence()], new Uint8Array())).toBe(false);
    expect(
      retain(
        { ...report(), routePlanDigest: sha256(new Uint8Array([9])) },
        [sidecar()],
        [occurrence()],
      ),
    ).toBe(false);
    expect(
      retain(
        report(),
        [sidecar()],
        [
          occurrence({
            completion: { oracleContractDigest: "oracle", toolContractDigests: ["unknown"] },
          }),
        ],
      ),
    ).toBe(false);

    const missingOccurrence = new Array<unknown>(1);
    expect(retain(report(), [sidecar()], missingOccurrence)).toBe(false);
    const missingResult = report();
    missingResult.results = new Array<object>(1);
    expect(retain(missingResult, [sidecar()], [occurrence()])).toBe(false);
    const missingSidecar = new Array<unknown>(1);
    expect(retain(report(), missingSidecar, [occurrence()])).toBe(false);
    expect(retain(report(), [{}], [occurrence()])).toBe(false);
    expect(
      retain(
        report(),
        [sidecar()],
        [occurrence({ request: { kind: "valid-envelope", route: {} } })],
      ),
    ).toBe(false);
    expect(
      retain(
        report(),
        [sidecar()],
        [occurrence({ request: { kind: "reduction-candidate-internal", route } })],
      ),
    ).toBe(false);
  });

  it("keeps exact position request access on the package-private surface", async () => {
    const [publicBarrel, internalApi] = await Promise.all([
      readFile(new URL("./index.ts", import.meta.url), "utf8"),
      import("./failure-execution-internals.js"),
    ]);
    expect(publicBarrel).not.toContain("getExecutionReportPositionRequestV1");
    expect(typeof internalApi.getExecutionReportPositionRequestV1).toBe("function");
  });
});
