import { beforeAll, describe, expect, it } from "vitest";

import * as readiness from "./index.js";
import {
  evaluateOracleMutationAssertion,
  runOracleMutationVectorForConformance,
} from "./oracle-mutation-assertions.js";
import { runOracleMutationWorkerProbe } from "./oracle-mutation-worker.js";
import { createOracleMutationAssertionsSpecFixture } from "./test-fixtures/oracle-mutation-assertions-spec-fixture.js";

type Fixture = Awaited<ReturnType<typeof createOracleMutationAssertionsSpecFixture>>;

let fixture: Fixture;

function assertDataOnly(value: unknown): void {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "bigint" ||
    typeof value === "number"
  ) {
    return;
  }
  if (typeof value === "string") {
    expect(value).not.toMatch(
      /^(?:file:|[A-Za-z]:\\)|(?:^|\/)(?:node_modules|src|dist)\/|\.(?:[cm]?[jt]s)$|^(?:node|deno|bun|npm|npx|yarn)\s/u,
    );
    return;
  }
  expect(typeof value).not.toBe("function");
  if (Array.isArray(value)) {
    for (const member of value) assertDataOnly(member);
    return;
  }
  expect(typeof value).toBe("object");
  for (const [key, member] of Object.entries(value as Readonly<Record<string, unknown>>)) {
    expect(key).not.toMatch(/callback|command|filesystemPath|moduleName/u);
    assertDataOnly(member);
  }
}

beforeAll(async () => {
  fixture = await createOracleMutationAssertionsSpecFixture();
});

describe("independent oracle mutation assertions", () => {
  it("joins exactly one immutable assertion to every canonical vector", () => {
    const ids = fixture.rows.map(({ vectorId }) => vectorId);

    expect(fixture).toMatchObject({ schemaVersion: 1, packetVersion: "1.0.0" });
    expect(fixture.rows).toHaveLength(84);
    expect(new Set(ids).size).toBe(84);
    expect(fixture.selections).toHaveLength(84);
    expect(fixture.rows.every(({ assertion }) => assertion.kind === "exact-observation")).toBe(
      true,
    );
    expect(
      Object.fromEntries(
        [
          "evaluator-operation",
          "diagnostic-mapping",
          "transform-precondition",
          "transform-rewrite",
          "relation-comparator",
        ].map((family) => [family, fixture.rows.filter((row) => row.family === family).length]),
      ),
    ).toEqual({
      "evaluator-operation": 32,
      "diagnostic-mapping": 29,
      "transform-precondition": 5,
      "transform-rewrite": 13,
      "relation-comparator": 5,
    });
  });

  it("passes every independent assertion against its baseline production path", async () => {
    for (const row of fixture.rows) {
      const baseline = await runOracleMutationVectorForConformance(row.vectorId);
      expect(baseline, row.vectorId).toMatchObject({ ok: true });
      if (!baseline.ok) throw new TypeError(`expected baseline observation for ${row.vectorId}`);

      expect(
        evaluateOracleMutationAssertion(row.assertion, baseline.observation),
        row.vectorId,
      ).toEqual({ ok: true, passed: true });
    }
  });

  it("reports a seeded baseline assertion mismatch as harness failure without kill credit", async () => {
    const result = await runOracleMutationWorkerProbe("baseline-mismatch", 5_000);

    expect(result).toMatchObject({
      ok: false,
      failure: "harness-failure",
      mutantId: expect.any(String),
      vectorId: expect.any(String),
      diagnostic: expect.objectContaining({
        code: expect.any(String),
        path: expect.any(String),
        message: expect.any(String),
      }),
    });
    expect(result).not.toHaveProperty("killed");
    expect(result).not.toHaveProperty("survivors");
  });

  it("rejects every selected production-path mutant with the same independent assertion", async () => {
    for (const [index, row] of fixture.rows.entries()) {
      const selection = fixture.selections[index]!;
      const mutant = await runOracleMutationVectorForConformance(row.vectorId, selection);
      expect(mutant, row.vectorId).toMatchObject({ ok: true });
      if (!mutant.ok) throw new TypeError(`expected mutant observation for ${row.vectorId}`);

      expect(
        evaluateOracleMutationAssertion(row.assertion, mutant.observation),
        row.vectorId,
      ).toEqual({ ok: true, passed: false });
    }
  });

  it("contains only data and accepts no callback, module, command, or filesystem path", () => {
    assertDataOnly(fixture.rows);
  });

  it("keeps the vector runner and assertion evaluator out of the public package index", () => {
    expect(readiness).not.toHaveProperty("runOracleMutationVectorForConformance");
    expect(readiness).not.toHaveProperty("evaluateOracleMutationAssertion");
  });
});
