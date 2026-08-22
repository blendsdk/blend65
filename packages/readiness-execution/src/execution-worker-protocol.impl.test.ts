import { describe, expect, it } from "vitest";

import type { ExecutionOperationResultV1 } from "@blend65/readiness";

import {
  parseExecutionWorkerResponseV1,
  type ExecutionWorkerRequestV1,
} from "./execution-worker-protocol.js";

const IDENTITY = `sha256:${"1".repeat(64)}`;
const EMPTY_DIAGNOSTICS = {
  revision: "compiler-diagnostic-evidence-v1" as const,
  entries: [],
};
const EMPTY_EMISSION = { il: false, assembly: false, binary: false };

function request(tier: ExecutionWorkerRequestV1["tier"]): ExecutionWorkerRequestV1 {
  const common = {
    revision: "execution-worker-request-v1" as const,
    caseIdentity: IDENTITY,
    caseRoot: "/owned",
    source: {
      revision: "execution-worker-source-v1" as const,
      relativePath: "main.blend",
      bytes: new Uint8Array(),
      digest: `sha256:${"0".repeat(64)}`,
    },
  };
  switch (tier) {
    case "frontend":
      return { ...common, tier, contract: "frontend-pipeline-v1" };
    case "compiler-api":
      return { ...common, tier, contract: "compiler-evidence-facade-v1" };
    case "cli":
      return { ...common, tier, contract: "blendc-cli-v1", argv: [] };
    case "emit":
      return { ...common, tier, contract: "assembly-emitter-v1" };
  }
}

function response(selected: ExecutionWorkerRequestV1): object {
  const common = {
    revision: "execution-worker-response-v1",
    tier: selected.tier,
    contract: selected.contract,
    caseIdentity: selected.caseIdentity,
    diagnostics: EMPTY_DIAGNOSTICS,
    emission: EMPTY_EMISSION,
  };
  switch (selected.tier) {
    case "frontend":
      return { ...common, semanticModelPresent: true, allocationPlanPresent: true };
    case "compiler-api":
      return { ...common, hasErrors: false };
    case "cli":
      return { ...common, exitCode: 0, stdout: new Uint8Array(), stderr: new Uint8Array() };
    case "emit":
      return { ...common, assemblyBytes: Uint8Array.of(1) };
  }
}

function expectFailure(result: ExecutionOperationResultV1<unknown>): void {
  expect(result).toMatchObject({
    ok: false,
    issues: [{ code: "invalid-evidence-input" }],
  });
}

describe("execution worker response parser", () => {
  it("should accept all four exact tier response shapes and isolate byte arrays", () => {
    for (const tier of ["frontend", "compiler-api", "cli", "emit"] as const) {
      const selected = request(tier);
      const input = response(selected);
      const parsed = parseExecutionWorkerResponseV1(selected, input);
      expect(parsed).toMatchObject({ ok: true, value: { tier, caseIdentity: IDENTITY } });
      if (parsed.ok && parsed.value.tier === "emit") {
        const original = Reflect.get(input, "assemblyBytes");
        if (original instanceof Uint8Array) original.fill(9);
        expect(parsed.value.assemblyBytes).toEqual(Uint8Array.of(1));
      }
    }
  });

  it("should reject tier, contract, identity, revision, and extra-key mutants", () => {
    const selected = request("frontend");
    const valid = response(selected);
    for (const mutation of [
      { ...valid, tier: "cli" },
      { ...valid, contract: "blendc-cli-v1" },
      { ...valid, caseIdentity: `sha256:${"2".repeat(64)}` },
      { ...valid, revision: "wrong" },
      { ...valid, extra: true },
    ]) {
      expectFailure(parseExecutionWorkerResponseV1(selected, mutation));
    }
  });

  it("should reject malformed diagnostics, emission, scalars, and byte payloads", () => {
    const frontend = request("frontend");
    expectFailure(
      parseExecutionWorkerResponseV1(frontend, {
        ...response(frontend),
        semanticModelPresent: "yes",
      }),
    );
    expectFailure(
      parseExecutionWorkerResponseV1(frontend, {
        ...response(frontend),
        allocationPlanPresent: null,
      }),
    );
    const compiler = request("compiler-api");
    expectFailure(
      parseExecutionWorkerResponseV1(compiler, { ...response(compiler), hasErrors: 0 }),
    );
    expectFailure(
      parseExecutionWorkerResponseV1(frontend, {
        ...response(frontend),
        emission: { il: false, assembly: false, binary: 0 },
      }),
    );
    expectFailure(
      parseExecutionWorkerResponseV1(frontend, {
        ...response(frontend),
        diagnostics: { revision: "compiler-diagnostic-evidence-v1", entries: [{}] },
      }),
    );
    const cli = request("cli");
    expectFailure(parseExecutionWorkerResponseV1(cli, { ...response(cli), exitCode: 4 }));
    expectFailure(parseExecutionWorkerResponseV1(cli, { ...response(cli), stdout: "text" }));
    const emit = request("emit");
    expectFailure(parseExecutionWorkerResponseV1(emit, { ...response(emit), assemblyBytes: [] }));
    const revokedBytes = Proxy.revocable(new Uint8Array(), {});
    revokedBytes.revoke();
    expectFailure(
      parseExecutionWorkerResponseV1(emit, {
        ...response(emit),
        assemblyBytes: revokedBytes.proxy,
      }),
    );
  });

  it("should validate accepted diagnostic identities, codes, phases, severities, and uniqueness", () => {
    const selected = request("frontend");
    const entry = {
      acceptedEntryId: `sha256:${"3".repeat(64)}`,
      code: "E12345",
      phase: "semantic",
      finalSeverity: "error",
    };
    expect(
      parseExecutionWorkerResponseV1(selected, {
        ...response(selected),
        diagnostics: { revision: "compiler-diagnostic-evidence-v1", entries: [entry] },
      }),
    ).toMatchObject({ ok: true });
    expect(
      parseExecutionWorkerResponseV1(selected, {
        ...response(selected),
        diagnostics: {
          revision: "compiler-diagnostic-evidence-v1",
          entries: [{ ...entry, acceptedEntryId: "accepted-diagnostic-1" }],
        },
      }),
    ).toMatchObject({ ok: true });
    for (const entries of [
      [entry, entry],
      [{ ...entry, acceptedEntryId: "bad" }],
      [{ ...entry, acceptedEntryId: "x".repeat(257) }],
      [{ ...entry, code: "bad" }],
      [{ ...entry, phase: "codegen" }],
      [{ ...entry, finalSeverity: "info" }],
    ]) {
      expectFailure(
        parseExecutionWorkerResponseV1(selected, {
          ...response(selected),
          diagnostics: { revision: "compiler-diagnostic-evidence-v1", entries },
        }),
      );
    }
  });

  it("should reject exotic records, accessors, sparse arrays, and throwing proxies", () => {
    const selected = request("frontend");
    expectFailure(parseExecutionWorkerResponseV1(selected, "not-a-record"));
    expectFailure(parseExecutionWorkerResponseV1(selected, null));
    expectFailure(parseExecutionWorkerResponseV1(selected, []));
    expectFailure(
      parseExecutionWorkerResponseV1(
        selected,
        Object.assign(Object.create({ inherited: true }), response(selected)),
      ),
    );
    const exotic = Object.create(null);
    Object.assign(exotic, response(selected));
    expect(parseExecutionWorkerResponseV1(selected, exotic)).toMatchObject({ ok: true });
    const accessor = { ...response(selected) };
    Object.defineProperty(accessor, "tier", { enumerable: true, get: () => "frontend" });
    expectFailure(parseExecutionWorkerResponseV1(selected, accessor));
    const sparse = new Array(1);
    expectFailure(
      parseExecutionWorkerResponseV1(selected, {
        ...response(selected),
        diagnostics: { revision: "compiler-diagnostic-evidence-v1", entries: sparse },
      }),
    );
    expectFailure(
      parseExecutionWorkerResponseV1(selected, {
        ...response(selected),
        diagnostics: { revision: "compiler-diagnostic-evidence-v1", entries: {} },
      }),
    );
    class DerivedArray extends Array<unknown> {}
    expectFailure(
      parseExecutionWorkerResponseV1(selected, {
        ...response(selected),
        diagnostics: {
          revision: "compiler-diagnostic-evidence-v1",
          entries: new DerivedArray(),
        },
      }),
    );
    const accessorEntries: unknown[] = [{}];
    Object.defineProperty(accessorEntries, "0", {
      enumerable: true,
      configurable: true,
      get: () => ({}),
    });
    expectFailure(
      parseExecutionWorkerResponseV1(selected, {
        ...response(selected),
        diagnostics: {
          revision: "compiler-diagnostic-evidence-v1",
          entries: accessorEntries,
        },
      }),
    );
    const revokedEntries = Proxy.revocable([], {});
    revokedEntries.revoke();
    expectFailure(
      parseExecutionWorkerResponseV1(selected, {
        ...response(selected),
        diagnostics: {
          revision: "compiler-diagnostic-evidence-v1",
          entries: revokedEntries.proxy,
        },
      }),
    );
    expectFailure(
      parseExecutionWorkerResponseV1(selected, {
        ...response(selected),
        diagnostics: { revision: "future", entries: [] },
      }),
    );
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    expectFailure(parseExecutionWorkerResponseV1(selected, revoked.proxy));
  });
});
