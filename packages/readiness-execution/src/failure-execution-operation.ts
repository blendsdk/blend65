import type { ExecutionOperationIssueCodeV1, ExecutionOperationResultV1 } from "@blend65/readiness";

import type { FailureExecutionOperationResultV1 } from "./failure-execution-types.js";

/** Creates one frozen closed execution issue result. */
export function failureExecutionIssueV1<T>(
  code: ExecutionOperationIssueCodeV1,
  path: string,
  message: string,
): ExecutionOperationResultV1<T> {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([Object.freeze({ code, path, message })]) as readonly [
      Readonly<{ code: typeof code; path: string; message: string }>,
    ],
  });
}

/** Creates one frozen successful execution operation result. */
export function failureExecutionSuccessV1<T>(value: T): ExecutionOperationResultV1<T> {
  return Object.freeze({ ok: true, value });
}

/** Creates one frozen failure when exact historical authority is unavailable. */
export function historicalFailureExecutionIssueV1<T>(
  path: string,
  message: string,
): FailureExecutionOperationResultV1<T> {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([
      Object.freeze({ code: "historical-authority-unavailable" as const, path, message }),
    ]) as readonly [
      Readonly<{ code: "historical-authority-unavailable"; path: string; message: string }>,
    ],
  });
}

/** Snapshots one hostile record only when it exposes the exact requested data properties. */
export function snapshotExactFailureExecutionInputV1(
  input: unknown,
  keys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  try {
    if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
    const prototype = Object.getPrototypeOf(input);
    const ownKeys = Reflect.ownKeys(input);
    if (
      (prototype !== Object.prototype && prototype !== null) ||
      ownKeys.length !== keys.length ||
      ownKeys.some((key) => typeof key !== "string" || !keys.includes(key))
    ) {
      return undefined;
    }
    const output: Record<string, unknown> = {};
    for (const key of keys) {
      const descriptor = Reflect.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return undefined;
      }
      output[key] = descriptor.value;
    }
    return output;
  } catch {
    return undefined;
  }
}
