import { parentPort, workerData } from "node:worker_threads";

interface WorkerRequestProjectionV1 {
  readonly tier: "frontend" | "compiler-api" | "cli" | "emit";
  readonly contract: string;
  readonly caseIdentity: string;
}

interface WorkerInstructionV1 {
  readonly request: WorkerRequestProjectionV1;
  readonly outcome:
    | { readonly kind: "success" }
    | { readonly kind: "crash" }
    | {
        readonly kind: "diagnostic-entry";
        readonly entry: {
          readonly acceptedEntryId: "fixture-diagnostic-entry-v1";
          readonly code: string;
          readonly phase: "lexer" | "parser" | "semantic" | "sfa";
          readonly finalSeverity: "error";
        };
      };
}

function successfulResponse(
  request: WorkerRequestProjectionV1,
  diagnosticEntry?: Extract<
    WorkerInstructionV1["outcome"],
    { readonly kind: "diagnostic-entry" }
  >["entry"],
): object {
  const hasDiagnostic = diagnosticEntry !== undefined;
  const common = {
    revision: "execution-worker-response-v1",
    tier: request.tier,
    contract: request.contract,
    caseIdentity: request.caseIdentity,
    diagnostics: {
      revision: "compiler-diagnostic-evidence-v1",
      entries: diagnosticEntry === undefined ? [] : [diagnosticEntry],
    },
    emission: { il: false, assembly: false, binary: false },
  };
  switch (request.tier) {
    case "frontend":
      return {
        ...common,
        semanticModelPresent: !hasDiagnostic,
        allocationPlanPresent: !hasDiagnostic,
      };
    case "compiler-api":
      return { ...common, hasErrors: hasDiagnostic };
    case "cli":
      return {
        ...common,
        exitCode: hasDiagnostic ? 1 : 0,
        stdout: new Uint8Array(),
        stderr: new Uint8Array(),
      };
    case "emit":
      return {
        ...common,
        hasErrors: hasDiagnostic,
        assemblyBytes: hasDiagnostic ? new Uint8Array() : new TextEncoder().encode("!cpu 6510\n"),
      };
  }
}

function reply(instruction: WorkerInstructionV1): void {
  if (instruction.outcome.kind === "crash") {
    parentPort?.postMessage({ kind: "crash", exitCode: 1 });
    return;
  }
  parentPort?.postMessage({
    kind: "message",
    value: successfulResponse(
      instruction.request,
      instruction.outcome.kind === "diagnostic-entry" ? instruction.outcome.entry : undefined,
    ),
  });
}

if (
  typeof workerData === "object" &&
  workerData !== null &&
  Reflect.get(workerData, "persistent") === true
) {
  parentPort?.on("message", (instruction: WorkerInstructionV1) => reply(instruction));
} else {
  reply(workerData as WorkerInstructionV1);
}
