import { parentPort, workerData } from "node:worker_threads";

interface WorkerRequestProjectionV1 {
  readonly tier: "frontend" | "compiler-api" | "cli" | "emit";
  readonly contract: string;
  readonly caseIdentity: string;
}

interface WorkerInstructionV1 {
  readonly request: WorkerRequestProjectionV1;
  readonly outcome: "pass" | "crash";
}

function successfulResponse(request: WorkerRequestProjectionV1): object {
  const common = {
    revision: "execution-worker-response-v1",
    tier: request.tier,
    contract: request.contract,
    caseIdentity: request.caseIdentity,
    diagnostics: { revision: "compiler-diagnostic-evidence-v1", entries: [] },
    emission: { il: false, assembly: false, binary: false },
  };
  switch (request.tier) {
    case "frontend":
      return { ...common, semanticModelPresent: true, allocationPlanPresent: true };
    case "compiler-api":
      return { ...common, hasErrors: false };
    case "cli":
      return {
        ...common,
        exitCode: 0,
        stdout: new Uint8Array(),
        stderr: new Uint8Array(),
      };
    case "emit":
      return {
        ...common,
        hasErrors: false,
        assemblyBytes: new TextEncoder().encode("!cpu 6510\n"),
      };
  }
}

function reply(instruction: WorkerInstructionV1): void {
  if (instruction.outcome === "crash") {
    parentPort?.postMessage({ kind: "crash", exitCode: 1 });
    return;
  }
  parentPort?.postMessage({ kind: "message", value: successfulResponse(instruction.request) });
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
