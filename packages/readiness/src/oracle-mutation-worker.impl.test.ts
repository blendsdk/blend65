import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  oracleMutationPathRegistry,
  oracleMutationVectorIdForPath,
} from "./oracle-mutation-model.js";
import {
  runOracleMutationWorkerProbe,
  runOracleMutationWorkerSelection,
} from "./oracle-mutation-worker.js";

describe("oracle mutation worker internals", () => {
  it("rejects invalid deadlines before starting a worker", async () => {
    await expect(runOracleMutationWorkerProbe("timeout", 0)).resolves.toMatchObject({
      ok: false,
      failure: "harness-failure",
    });
  });

  it("rejects a stable-ID request whose vector does not match its production path", async () => {
    const path = oracleMutationPathRegistry().paths[0];
    if (path === undefined) throw new TypeError("expected mutation path");
    const mutant = {
      mutantId: `mutant.${path.pathId}`,
      ...path,
    };
    expect(oracleMutationVectorIdForPath(path)).not.toBe("vector.wrong.v1");

    await expect(
      runOracleMutationWorkerSelection(mutant, "vector.wrong.v1", 5_000),
    ).resolves.toMatchObject({
      ok: false,
      failure: "worker-protocol",
    });
  });

  it("uses separate fixed startup and caller-selected execution timers", async () => {
    const source = await readFile(new URL("./oracle-mutation-worker.ts", import.meta.url), "utf8");
    const start = source.indexOf("function executeBoundedWorker(");
    const end = source.indexOf("function startWorkerProtocol(", start);
    const implementation = source.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(source).toContain("const STARTUP_DEADLINE_MILLISECONDS = 1_000;");
    expect(implementation.match(/\bsetTimeout\(/gu)).toHaveLength(2);
    expect(implementation.indexOf("const startupTimer = setTimeout(")).toBeLessThan(
      implementation.indexOf('worker.once("message"'),
    );
    expect(implementation.indexOf("clearTimeout(startupTimer);")).toBeLessThan(
      implementation.indexOf("executionTimer = setTimeout("),
    );
  });

  it("iterates reversed statements without allocating an index population", async () => {
    const source = await readFile(new URL("./oracle-evaluator.ts", import.meta.url), "utf8");
    const start = source.indexOf("const reverseStatements =");
    const end = source.indexOf("return Object.freeze({", start);
    const implementation = source.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(implementation).not.toContain("Array.from");
    expect(implementation).toContain("for (let offset = 0;");
  });
});
