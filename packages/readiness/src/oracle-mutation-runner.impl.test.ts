import { beforeEach, describe, expect, it, vi } from "vitest";

const worker = vi.hoisted(() => vi.fn());

vi.mock("./oracle-mutation-worker.js", () => ({
  runOracleMutationWorkerSelection: worker,
}));

import {
  oracleMutationPathRegistry,
  parseOracleMutationCatalog,
  validateOracleMutationCatalog,
} from "./oracle-mutation-model.js";
import { runOracleMutationCatalog } from "./oracle-mutation-runner.js";
import {
  oracleMutationCatalog,
  oracleMutationVectorIds,
} from "./test-fixtures/oracle-mutation-canonical-vectors.js";

beforeEach(() => {
  worker.mockReset();
});

describe("oracle mutation runner fail-fast scheduling", () => {
  it("does not schedule another batch after a worker or harness failure", async () => {
    worker.mockImplementation(async (mutant: { readonly mutantId: string }, vectorId: string) =>
      worker.mock.calls.length === 1
        ? {
            ok: false,
            failure: "harness-failure",
            mutantId: mutant.mutantId,
            vectorId,
            diagnostic: {
              code: "oracle.contract.invalid",
              path: "/mutationWorker",
              message: "injected harness failure",
            },
          }
        : {
            ok: true,
            mutantId: mutant.mutantId,
            vectorId,
            killed: true,
          },
    );
    const parsed = parseOracleMutationCatalog(structuredClone(oracleMutationCatalog));
    if (!parsed.ok) throw new TypeError("expected parsed mutation catalog");
    const validated = validateOracleMutationCatalog(parsed.value, oracleMutationPathRegistry());
    if (!validated.ok) throw new TypeError("expected validated mutation catalog");

    await expect(
      runOracleMutationCatalog({
        catalog: validated.value,
        vectorIds: oracleMutationVectorIds,
        deadlineMilliseconds: 5_000,
      }),
    ).resolves.toMatchObject({
      ok: false,
      failure: "harness-failure",
    });
    expect(worker).toHaveBeenCalledTimes(2);
  });
});
