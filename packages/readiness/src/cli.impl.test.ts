import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthorityLoadResult } from "./authority-loader.js";
import { createDiagnostic } from "./diagnostics.js";
import type { InventoryV1 } from "./model.js";

const state = vi.hoisted(() => ({
  result: undefined as AuthorityLoadResult | undefined,
}));

vi.mock("./authority-loader.js", () => ({
  loadValidatedAuthority: async () => state.result,
}));

import { READINESS_PATHS, runReadinessCommand } from "./cli.js";
import { acquireGenerationLock } from "./generation-lock.js";

const HASH = `sha256:${"2".repeat(64)}` as const;
const INVENTORY: InventoryV1 = {
  schemaVersion: 1,
  inventoryVersion: "1.0.0",
  specRevision: HASH,
  identityLedgerHead: HASH,
  fragmentationProfile: {
    profileId: "markdown-ebnf-v1",
    version: 1,
    contentHashAlgorithm: "sha256",
    newlinePolicy: "lf",
  },
  normativeSources: [],
  handlerDeclarations: [],
  evidenceCapabilityDeclarations: [],
  clauseLedger: [],
  conflicts: [],
  rules: [],
  evolutionGate: null,
};
const temporaryRoots: string[] = [];

async function root(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "blend65-cli-"));
  temporaryRoots.push(path);
  return path;
}

afterEach(async () => {
  state.result = undefined;
  await Promise.all(temporaryRoots.splice(0).map((path) => rm(path, { recursive: true })));
});

describe("readiness command internals", () => {
  it("should propagate authority rejection and report absent projections without writing", async () => {
    const path = await root();
    state.result = {
      ok: false,
      diagnostics: [
        createDiagnostic({
          phase: "source",
          code: "source.injected",
          path: "spec/",
          message: "Injected source failure.",
        }),
      ],
    };
    expect((await runReadinessCommand("check", path)).diagnostics[0]?.code).toBe("source.injected");

    state.result = { ok: true, inventory: INVENTORY };
    const missing = await runReadinessCommand("check", path);
    expect(missing.ok).toBe(false);
    expect(missing.diagnostics.map(({ code }) => code)).toEqual([
      "projection.declarations-missing",
      "projection.markdown-missing",
    ]);
  });

  it("should propagate projection rendering diagnostics from validated authority", async () => {
    const path = await root();
    state.result = {
      ok: true,
      inventory: {
        ...INVENTORY,
        rules: [
          {
            ruleId: "rule.unsafe",
            source: {
              path: "../outside.md",
              headingAncestry: [],
              quote: "unsafe",
              contentHash: HASH,
              displayLine: 1,
            },
            requirement: "unsafe",
            category: "semantics",
            polarity: "positive",
            applicability: "mandatory-c64",
            validDomains: [],
            invalidNeighbors: [],
            boundaryFamilies: [],
            generatorIds: [],
            oracleIds: [],
            transformIds: [],
            evidenceObligations: [],
            prerequisiteRuleIds: [],
            relatedRuleIds: [],
          },
        ],
      },
    };
    const result = await runReadinessCommand("check", path);
    expect(result.diagnostics[0]?.code).toBe("projection.unsafe-source-link");
  });

  it("should diagnose live generation contention before authority loading", async () => {
    const path = await root();
    const lockPath = join(path, READINESS_PATHS.lock);
    await mkdir(join(path, "readiness/generated"), { recursive: true });
    const owner = await acquireGenerationLock(lockPath);
    const result = await runReadinessCommand("generate", path);
    expect(result.diagnostics[0]?.code).toBe("generation-lock.contended");
    await owner?.release();
  });

  it("should convert publication failure and unexpected output reads into diagnostics", async () => {
    const path = await root();
    state.result = { ok: true, inventory: INVENTORY };
    const failed = await runReadinessCommand("generate", path, {
      publication: {
        afterTemporaryFileSynced() {
          throw new Error("injected publication failure");
        },
      },
    });
    expect(failed.diagnostics[0]?.code).toBe("publication.failed");

    await mkdir(join(path, READINESS_PATHS.declarations), { recursive: true });
    const readFailure = await runReadinessCommand("check", path);
    expect(readFailure.diagnostics[0]?.code).toBe("publication.input-read");
  });
});
