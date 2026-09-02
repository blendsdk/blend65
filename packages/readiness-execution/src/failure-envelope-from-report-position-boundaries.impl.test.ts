import { afterEach, describe, expect, it, vi } from "vitest";

interface PositionStub {
  readonly positioned?: {
    readonly report: ReportStub;
    readonly occurrence: Record<string, unknown>;
  };
}

interface ReportStub {
  readonly routePlanDigest: string;
  readonly provenance?:
    | {
        readonly report: ReportStub;
        readonly routePlanBytes: Uint8Array;
        readonly toolIdentities: readonly Record<string, unknown>[];
      }
    | undefined;
}

afterEach(() => {
  vi.doUnmock("@blend65/readiness");
  vi.doUnmock("./execution-report-provenance.js");
  vi.resetModules();
});

describe("report-position envelope authorization boundaries", () => {
  it("rejects every incomplete source, predicate, observation, report, and tool association", async () => {
    const authorize = vi.fn((input: object) => ({ ok: true, value: { input } }));
    vi.doMock("@blend65/readiness", () => ({
      authorizeFailureEnvelopeV1: authorize,
      deriveFailurePredicateIdentityV1(input: Record<string, unknown>) {
        return input.invalid === true
          ? { ok: false, issues: [] }
          : { ok: true, value: { predicate: { resultCode: "compiler-ice" } } };
      },
    }));
    vi.doMock("./execution-report-provenance.js", () => ({
      getExecutionReportPositionStateV1(position: PositionStub) {
        return position.positioned;
      },
      getExecutionAuthorityReportProvenanceStateV1(report: ReportStub) {
        return report.provenance;
      },
      getExecutionReportOccurrenceObservationBytesV1(occurrence: Record<string, unknown>) {
        return occurrence.normalizedObservationBytes;
      },
    }));
    const bridge = await import("./failure-envelope-from-report-position.js");
    const policy = {};
    const report: ReportStub = {
      routePlanDigest: "route-plan",
      provenance: undefined,
    };
    const reportState = {
      report,
      routePlanBytes: new Uint8Array([1]),
      toolIdentities: [{ digest: "tool" }],
    };
    Object.defineProperty(report, "provenance", { value: reportState, enumerable: true });
    const occurrence = (overrides: Record<string, unknown> = {}) => ({
      request: { kind: "valid-envelope", executionCase: {} },
      sidecarProjection: {
        kind: "ordinary-route-facts",
        predicateBasis: { kind: "failure-ingredients", value: {} },
      },
      result: { status: "failure" },
      normalizedObservationBytes: new Uint8Array([1]),
      completion: { toolContractDigests: ["tool"] },
      ...overrides,
    });
    const position = (selectedOccurrence: Record<string, unknown>, selectedReport = report) => ({
      positioned: { report: selectedReport, occurrence: selectedOccurrence },
    });
    const invoke = (selectedPosition: object) =>
      bridge.authorizeFailureEnvelopeFromReportPositionV1(
        selectedPosition as never,
        policy as never,
      );

    expect(invoke({})).toMatchObject({ ok: false, issues: [{ code: "unbound-capability" }] });
    expect(
      invoke(position(occurrence(), { routePlanDigest: "missing", provenance: undefined })),
    ).toMatchObject({ ok: false, issues: [{ code: "unbound-capability" }] });

    for (const [request, sourceKind] of [
      [{ kind: "valid-envelope", executionCase: {} }, "typed-valid"],
      [{ executionCase: {} }, "typed-valid"],
      [{ kind: "invalid-diagnostic", diagnosticCase: {} }, "typed-invalid"],
      [{ kind: "raw-malformed", malformedCase: {} }, "raw-malformed"],
    ] as const) {
      expect(invoke(position(occurrence({ request })))).toMatchObject({ ok: true });
      expect(authorize.mock.lastCall?.[0]).toMatchObject({ source: { kind: sourceKind } });
    }

    for (const incomplete of [
      occurrence({ result: { status: "pass" } }),
      occurrence({
        sidecarProjection: { kind: "ordinary-route-facts", predicateBasis: { kind: "pass" } },
      }),
      occurrence({ sidecarProjection: { kind: "candidate-full-predicate" } }),
      occurrence({ request: { kind: "reduction-candidate-internal" } }),
      occurrence({ normalizedObservationBytes: undefined }),
      occurrence({ completion: { toolContractDigests: ["missing"] } }),
    ]) {
      expect(invoke(position(incomplete))).toMatchObject({
        ok: false,
        issues: [{ code: "invalid-evidence-input" }],
      });
    }
    expect(
      invoke(
        position(
          occurrence({
            sidecarProjection: {
              kind: "ordinary-route-facts",
              predicateBasis: { kind: "failure-ingredients", value: { invalid: true } },
            },
          }),
        ),
      ),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-evidence-input", path: "/position/predicate" }],
    });
  });
});
