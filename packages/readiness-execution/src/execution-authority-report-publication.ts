import { randomUUID } from "node:crypto";
import { lstatSync, renameSync } from "node:fs";
import { chmod, lstat, mkdir, realpath } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

import type { ExecutionOperationResultV1 } from "@blend65/readiness";

import { serializeExecutionAuthorityReportForPublicationV1 } from "./execution-authority-report.js";
import {
  consumeExecutionReportFaultV1,
  getPendingExecutionReportFaultV1,
  observeExecutionReportBoundaryV1,
  recordExecutionReportReconciliationV1,
  type ReportFaultPointV1,
} from "./execution-orchestration-conformance-v1.js";
import type { ExecutionAuthorityReportV1 } from "./execution-orchestration.js";
import {
  cleanupSecureSelectionFileV1,
  commitSecureSelectionFileNoClobberV1,
  pinSecureSelectionDirectoryV1,
  readSecureSelectionFileV1,
  synchronizeSecureSelectionDirectoryV1,
  verifySecureSelectionDirectoryV1,
  writeSecureSelectionFileV1,
  type SecureSelectionDirectoryIdentityV1,
} from "./execution-publication-secure-filesystem.js";

/** Canonical repository-relative report location. */
export const EXECUTION_AUTHORITY_REPORT_PATH_V1 =
  "readiness/execution-evidence/rd-04-local-v1.json";

const MAX_REPORT_BYTES = 64 * 1024 * 1024;

function failure<T>(
  code: "execution.invalid-schema" | "execution.io" | "execution.reconciliation",
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

function success<T>(value: T): ExecutionOperationResultV1<T> {
  return Object.freeze({ ok: true, value });
}

function secureExistingBytes(
  repositoryRoot: string,
  path: string,
  directory: SecureSelectionDirectoryIdentityV1,
): Uint8Array | undefined {
  if (!verifySecureSelectionDirectoryV1(directory)) {
    throw new TypeError("Report directory identity changed before read.");
  }
  try {
    lstatSync(path);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      if (!verifySecureSelectionDirectoryV1(directory)) {
        throw new TypeError("Report directory identity changed while checking absence.");
      }
      return undefined;
    }
    throw error;
  }
  const retained = readSecureSelectionFileV1(repositoryRoot, path, MAX_REPORT_BYTES);
  if (!retained.ok) throw new TypeError(retained.issues[0].message);
  observeExecutionReportBoundaryV1("after-existing-report-read");
  if (!verifySecureSelectionDirectoryV1(directory)) {
    throw new TypeError("Report directory identity changed while reading evidence.");
  }
  return retained.value;
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.byteLength === right.byteLength && left.every((value, index) => value === right[index])
  );
}

async function ensureDirectory(path: string, create: boolean): Promise<void> {
  if (create)
    await mkdir(path, { mode: 0o700 }).catch((error: unknown) => {
      if (
        typeof error !== "object" ||
        error === null ||
        !("code" in error) ||
        error.code !== "EEXIST"
      ) {
        throw error;
      }
    });
  const status = await lstat(path, { bigint: true });
  if (status.isSymbolicLink() || !status.isDirectory()) {
    throw new TypeError("Report path component is not a real directory.");
  }
  if ((await realpath(path)) !== path) {
    throw new TypeError("Report path component is not canonical.");
  }
}

function injectedFailure(point: ReportFaultPointV1): ExecutionOperationResultV1<string> {
  return failure(
    point === "after-report-rename" ||
      point === "after-report-directory-sync" ||
      point === "during-report-reconciliation"
      ? "execution.reconciliation"
      : "execution.io",
    EXECUTION_AUTHORITY_REPORT_PATH_V1,
    "Execution authority report publication did not complete.",
  );
}

/**
 * Durably publishes one canonical report without replacing different existing evidence.
 *
 * @param repositoryRoot Canonical absolute repository root.
 * @param report Complete report to publish.
 * @returns The fixed repository-relative report path or a stable filesystem issue.
 *
 * @example
 * ```ts
 * const written = await writeExecutionAuthorityReportV1(root, report);
 * ```
 */
export async function writeExecutionAuthorityReportV1(
  repositoryRoot: string,
  report: ExecutionAuthorityReportV1,
): Promise<ExecutionOperationResultV1<string>> {
  let bytes: Uint8Array;
  try {
    bytes = serializeExecutionAuthorityReportForPublicationV1(report);
    if (bytes.byteLength > MAX_REPORT_BYTES) {
      return failure(
        "execution.invalid-schema",
        "/report",
        "Execution authority report exceeds its byte bound.",
      );
    }
  } catch {
    return failure(
      "execution.invalid-schema",
      "/report",
      "Execution authority report is not canonical.",
    );
  }
  const root = resolve(repositoryRoot);
  if (!isAbsolute(repositoryRoot) || root !== repositoryRoot) {
    return failure("execution.io", "/repositoryRoot", "Repository root is not canonical.");
  }
  const readiness = join(root, "readiness");
  const directory = join(readiness, "execution-evidence");
  const target = join(root, EXECUTION_AUTHORITY_REPORT_PATH_V1);
  const temporary = join(directory, `.rd-04-local-v1.${randomUUID()}.tmp`);
  const shadow = join(directory, `.rd-04-local-v1.${randomUUID()}.reconciliation`);
  let pinnedDirectory: SecureSelectionDirectoryIdentityV1 | undefined;
  let temporaryExists = false;
  let shadowExists = false;
  let targetCommitted = false;
  try {
    await mkdir(root, { recursive: true, mode: 0o700 });
    await ensureDirectory(root, false);
    await ensureDirectory(readiness, true);
    await ensureDirectory(directory, true);
    await chmod(directory, 0o700);
    const pinned = pinSecureSelectionDirectoryV1(directory);
    if (!pinned.ok) {
      return failure("execution.io", EXECUTION_AUTHORITY_REPORT_PATH_V1, pinned.issues[0].message);
    }
    pinnedDirectory = pinned.value;
    const existing = secureExistingBytes(root, target, pinnedDirectory);
    if (existing !== undefined && equalBytes(existing, bytes)) {
      return success(EXECUTION_AUTHORITY_REPORT_PATH_V1);
    }
    const pendingFault = getPendingExecutionReportFaultV1();
    if (existing !== undefined && pendingFault === undefined) {
      recordExecutionReportReconciliationV1("prior-report");
      return failure(
        "execution.reconciliation",
        EXECUTION_AUTHORITY_REPORT_PATH_V1,
        "A different immutable execution authority report already exists.",
      );
    }

    const written = writeSecureSelectionFileV1(pinnedDirectory, temporary, bytes);
    if (!written.ok) {
      return failure("execution.io", EXECUTION_AUTHORITY_REPORT_PATH_V1, written.issues[0].message);
    }
    temporaryExists = true;
    if (consumeExecutionReportFaultV1("after-temporary-create")) {
      return injectedFailure("after-temporary-create");
    }
    if (consumeExecutionReportFaultV1("after-temporary-write")) {
      return injectedFailure("after-temporary-write");
    }
    if (consumeExecutionReportFaultV1("after-temporary-file-sync")) {
      return injectedFailure("after-temporary-file-sync");
    }
    if (consumeExecutionReportFaultV1("before-report-rename")) {
      return injectedFailure("before-report-rename");
    }

    if (existing !== undefined) {
      if (!verifySecureSelectionDirectoryV1(pinnedDirectory)) {
        return failure(
          "execution.io",
          EXECUTION_AUTHORITY_REPORT_PATH_V1,
          "Execution report directory changed before reconciliation.",
        );
      }
      renameSync(temporary, shadow);
      temporaryExists = false;
      shadowExists = true;
      if (!verifySecureSelectionDirectoryV1(pinnedDirectory)) {
        return failure(
          "execution.reconciliation",
          EXECUTION_AUTHORITY_REPORT_PATH_V1,
          "Execution report directory changed during reconciliation.",
        );
      }
      if (consumeExecutionReportFaultV1("after-report-rename")) {
        recordExecutionReportReconciliationV1("prior-report");
        return injectedFailure("after-report-rename");
      }
      const synchronized = synchronizeSecureSelectionDirectoryV1(pinnedDirectory, () => false);
      if (!synchronized.ok) {
        return failure(
          "execution.reconciliation",
          EXECUTION_AUTHORITY_REPORT_PATH_V1,
          synchronized.issues[0].message,
        );
      }
      if (consumeExecutionReportFaultV1("after-report-directory-sync")) {
        recordExecutionReportReconciliationV1("prior-report");
        return injectedFailure("after-report-directory-sync");
      }
      if (consumeExecutionReportFaultV1("during-report-reconciliation")) {
        recordExecutionReportReconciliationV1("prior-report");
        return injectedFailure("during-report-reconciliation");
      }
      recordExecutionReportReconciliationV1("prior-report");
      return failure(
        "execution.reconciliation",
        EXECUTION_AUTHORITY_REPORT_PATH_V1,
        "A different immutable execution authority report already exists.",
      );
    }

    const committed = commitSecureSelectionFileNoClobberV1(
      root,
      pinnedDirectory,
      written.value,
      target,
      bytes,
    );
    if (!committed.ok) {
      return failure(
        committed.issues[0].code === "execution.reconciliation"
          ? "execution.reconciliation"
          : "execution.io",
        EXECUTION_AUTHORITY_REPORT_PATH_V1,
        committed.issues[0].message,
      );
    }
    if (committed.value === "committed") {
      targetCommitted = true;
      temporaryExists = false;
    } else {
      const raced = secureExistingBytes(root, target, pinnedDirectory);
      if (raced === undefined || !equalBytes(raced, bytes)) {
        recordExecutionReportReconciliationV1("prior-report");
        return failure(
          "execution.reconciliation",
          EXECUTION_AUTHORITY_REPORT_PATH_V1,
          "A different immutable execution authority report won publication.",
        );
      }
      const synchronized = synchronizeSecureSelectionDirectoryV1(pinnedDirectory, () => false);
      if (!synchronized.ok) {
        recordExecutionReportReconciliationV1("ambiguous");
        return failure(
          "execution.reconciliation",
          EXECUTION_AUTHORITY_REPORT_PATH_V1,
          synchronized.issues[0].message,
        );
      }
      const retained = secureExistingBytes(root, target, pinnedDirectory);
      if (retained === undefined || !equalBytes(retained, bytes)) {
        recordExecutionReportReconciliationV1("ambiguous");
        return failure(
          "execution.reconciliation",
          EXECUTION_AUTHORITY_REPORT_PATH_V1,
          "Concurrent report publication could not be revalidated.",
        );
      }
      recordExecutionReportReconciliationV1("committed");
      return success(EXECUTION_AUTHORITY_REPORT_PATH_V1);
    }
    if (consumeExecutionReportFaultV1("after-report-rename")) {
      recordExecutionReportReconciliationV1("committed");
      return injectedFailure("after-report-rename");
    }
    const synchronized = synchronizeSecureSelectionDirectoryV1(pinnedDirectory, () => false);
    if (!synchronized.ok) {
      recordExecutionReportReconciliationV1("ambiguous");
      return failure(
        "execution.reconciliation",
        EXECUTION_AUTHORITY_REPORT_PATH_V1,
        synchronized.issues[0].message,
      );
    }
    if (consumeExecutionReportFaultV1("after-report-directory-sync")) {
      recordExecutionReportReconciliationV1("committed");
      return injectedFailure("after-report-directory-sync");
    }
    if (consumeExecutionReportFaultV1("during-report-reconciliation")) {
      recordExecutionReportReconciliationV1("committed");
      return injectedFailure("during-report-reconciliation");
    }
    const retained = secureExistingBytes(root, target, pinnedDirectory);
    if (retained === undefined || !equalBytes(retained, bytes)) {
      recordExecutionReportReconciliationV1("ambiguous");
      return failure(
        "execution.reconciliation",
        EXECUTION_AUTHORITY_REPORT_PATH_V1,
        "Committed execution authority report could not be revalidated.",
      );
    }
    return success(EXECUTION_AUTHORITY_REPORT_PATH_V1);
  } catch {
    if (targetCommitted) recordExecutionReportReconciliationV1("ambiguous");
    return failure(
      targetCommitted ? "execution.reconciliation" : "execution.io",
      EXECUTION_AUTHORITY_REPORT_PATH_V1,
      "Execution authority report filesystem transaction failed.",
    );
  } finally {
    if (pinnedDirectory !== undefined) {
      if (temporaryExists) cleanupSecureSelectionFileV1(temporary, pinnedDirectory);
      if (shadowExists) cleanupSecureSelectionFileV1(shadow, pinnedDirectory);
    }
  }
}
