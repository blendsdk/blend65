import {
  armFailureCandidateViceShimV1,
  diagnoseFailureCandidateVicePreparationV1,
  synchronizeFailureCandidateViceShimV1,
  type FailureCandidateViceLocalControllerV1,
} from "./failure-candidate-vice-local-support.js";
import type {
  FailureExecutionSpecApiV1,
  FailureExecutionSpecDataV1,
  FailureExecutionSpecResultV1,
} from "./failure-execution-spec-types.js";

type Api = FailureExecutionSpecApiV1;
type Data = FailureExecutionSpecDataV1;
type Result<T> = FailureExecutionSpecResultV1<T>;

interface FailureExecutionSpecReportInputV1 {
  readonly localVice: boolean;
  readonly controller: FailureCandidateViceLocalControllerV1;
  readonly executionApi: Api;
  readonly internals: Api;
  readonly parent: object;
  readonly execution: object;
  readonly oracle: object;
  readonly campaign: object;
  readonly executionPolicy: object;
  readonly routeItems: readonly unknown[];
  readonly subjectIndex: number;
  readonly controlIndex?: number;
}

/** Genuine report and optional local-runtime evidence produced for one controlled fixture. */
export interface FailureExecutionSpecReportV1 {
  readonly report: Data;
  readonly confirmationControlPosition?: object;
  readonly localViceEvidence?: Data;
}

function call<T>(api: Api, name: string, ...arguments_: readonly unknown[]): T {
  const callable = api[name];
  if (typeof callable !== "function") throw new TypeError(`missing callable ${name}`);
  return Reflect.apply(callable, undefined, arguments_) as T;
}

function success<T>(result: Result<T>): T {
  if (!result.ok) throw new TypeError(JSON.stringify(result.issues ?? result.diagnostics ?? []));
  return result.value;
}

function recordValue(value: unknown, message: string): Data {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(message);
  }
  return value as Data;
}

function routeRecords(selectedReport: Data): readonly unknown[] {
  const records = Reflect.get(selectedReport, "routeRecords");
  if (Array.isArray(records)) return records;
  const shape = (value: unknown): Data => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return Object.freeze({ kind: typeof value });
    }
    const data = value as Data;
    const issues = Reflect.get(data, "issues");
    const results = Reflect.get(data, "results");
    const nestedRecords = Reflect.get(data, "routeRecords");
    return Object.freeze({
      keys: Object.keys(data).sort(),
      revision: Reflect.get(data, "revision") ?? null,
      ownOk: Object.hasOwn(data, "ok") ? Reflect.get(data, "ok") : null,
      issues: Array.isArray(issues)
        ? issues.map((issue) => ({
            code:
              typeof issue === "object" && issue !== null
                ? (Reflect.get(issue, "code") ?? null)
                : null,
            path:
              typeof issue === "object" && issue !== null
                ? (Reflect.get(issue, "path") ?? null)
                : null,
          }))
        : null,
      resultsPresent: Object.hasOwn(data, "results"),
      resultsLength: Array.isArray(results) ? results.length : null,
      routeRecordsPresent: Object.hasOwn(data, "routeRecords"),
      routeRecordsLength: Array.isArray(nestedRecords) ? nestedRecords.length : null,
      summaryPresent: Object.hasOwn(data, "summary"),
    });
  };
  throw new TypeError(
    JSON.stringify({
      report: shape(selectedReport),
      value: Object.hasOwn(selectedReport, "value")
        ? shape(Reflect.get(selectedReport, "value"))
        : null,
    }),
  );
}

function publicResult(value: unknown): Data {
  const result = recordValue(value, "public execution result");
  const usage = result.usage;
  return Object.freeze({
    status: result.status ?? null,
    code: result.code ?? null,
    tier: result.tier ?? null,
    stage: result.stage ?? null,
    cleanupBlocker: result.cleanupBlocker ?? null,
    usage: Object.freeze({
      launchAttempts:
        typeof usage === "object" && usage !== null && !Array.isArray(usage)
          ? ((usage as Data).launchAttempts ?? null)
          : null,
    }),
  });
}

function leaseProjection(
  lease: Data,
  records: readonly unknown[],
  routeItems: readonly unknown[],
): Data {
  const viceResults = routeItems.flatMap((item, index) => {
    const routeItem = recordValue(item, "VICE route item");
    if (routeItem.terminalTier !== "vice") return [];
    const record = recordValue(records[index], "VICE route record");
    return [
      Object.freeze({
        position: index + 1,
        caseIdentity: String(routeItem.caseIdentity),
        ...publicResult(record.result),
      }),
    ];
  });
  return Object.freeze({
    state: lease.state ?? null,
    generation: lease.generation ?? null,
    nonce: lease.nonce ?? null,
    childAbsent: lease.childAbsent ?? null,
    evidenceDigest: lease.evidenceDigest ?? null,
    viceResults: Object.freeze(viceResults),
  });
}

/** Executes the genuine report and proves local VICE preparation and cleanup when requested. */
export async function createFailureExecutionSpecReportV1(
  input: FailureExecutionSpecReportInputV1,
): Promise<FailureExecutionSpecReportV1> {
  const executeReport = async (): Promise<Data> =>
    success(
      await call<Promise<Result<Data>>>(input.executionApi, "executeReadinessCampaign", {
        parent: input.parent,
        execution: input.execution,
        oracle: input.oracle,
        campaign: input.campaign,
        target: "c64",
        policy: input.executionPolicy,
        capabilities: {
          acme: { available: true, version: "0.97" },
          vice: { available: true, version: "3.10" },
        },
      }),
    );
  if (!input.localVice) return { report: await executeReport() };

  const controlIndex = input.controlIndex;
  if (controlIndex === undefined) throw new TypeError("fixture VICE control route unavailable");
  const preparations = await diagnoseFailureCandidateVicePreparationV1();
  if (!preparations.ok || !preparations.controlPreparation.ok) {
    throw new TypeError("local VICE pair preparation");
  }
  const baseline = await executeReport();
  const baselineRecords = routeRecords(baseline);
  const baselineSubject = publicResult(
    recordValue(baselineRecords[input.subjectIndex], "baseline subject record").result,
  );
  const baselineControl = publicResult(
    recordValue(baselineRecords[controlIndex], "baseline control record").result,
  );
  if (
    baselineSubject.status !== "pass" ||
    baselineControl.status !== "pass" ||
    baselineSubject.cleanupBlocker !== null ||
    baselineControl.cleanupBlocker !== null
  ) {
    throw new TypeError(JSON.stringify({ subject: baselineSubject, control: baselineControl }));
  }
  const baselineLease = success(
    await call<Promise<Result<Data>>>(
      input.executionApi,
      "inspectViceLeaseV1",
      "c64",
      AbortSignal.timeout(15_000),
    ),
  );
  if (baselineLease.state !== "clear" || baselineLease.childAbsent !== true) {
    throw new TypeError(
      JSON.stringify(leaseProjection(baselineLease, baselineRecords, input.routeItems)),
    );
  }
  const baselinePositions = success(
    call<Result<readonly object[]>>(
      input.internals,
      "getExecutionAuthorityReportPositionsV1",
      baseline,
    ),
  );
  const confirmationControlPosition = baselinePositions[input.subjectIndex];
  if (confirmationControlPosition === undefined) {
    throw new TypeError("local VICE baseline control position");
  }

  armFailureCandidateViceShimV1();
  const report = await executeReport();
  const injectedRecords = routeRecords(report);
  const injectedShim = await synchronizeFailureCandidateViceShimV1();
  if (
    injectedShim.injectionCount !== 1 ||
    injectedShim.markerPresent ||
    !injectedShim.consumedPresent
  ) {
    throw new TypeError("local VICE report injection");
  }
  const injectedLease = success(
    await call<Promise<Result<Data>>>(
      input.executionApi,
      "inspectViceLeaseV1",
      "c64",
      AbortSignal.timeout(15_000),
    ),
  );
  if (injectedLease.state !== "clear" || injectedLease.childAbsent !== true) {
    throw new TypeError(
      JSON.stringify({
        ...leaseProjection(injectedLease, injectedRecords, input.routeItems),
        injection: {
          auditCategory: "route-launch",
          count: injectedShim.injectionCount,
          transitions: input.controller.activity.viceLauncherArmTransitions,
        },
      }),
    );
  }
  return {
    report,
    confirmationControlPosition,
    localViceEvidence: Object.freeze({
      preparations,
      baselineSubject,
      baselineControl,
      baselineLease,
      injectedLease,
    }),
  };
}
