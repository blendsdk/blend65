import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  validateFailureConfirmationContextToolVersionsV1 as validateContextTools,
  validateFailureConfirmationToolVersionsV1 as validateTools,
} from "./failure-confirmation-tools.js";

const originalPath = process.env.PATH;
const directories = new Set<string>();

async function toolDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "blend65-confirmation-tools-"));
  directories.add(directory);
  for (const [name, output] of [
    ["acme", "ACME 0.97"],
    ["x64sc", "VICE 3.10"],
  ] as const) {
    await writeFile(join(directory, name), `#!/bin/sh\nprintf '%s\\n' '${output}'\n`, "utf8");
    await chmod(join(directory, name), 0o700);
  }
  return directory;
}

function context(toolVersions: readonly Readonly<{ tool: string; version: string }>[]): object {
  return { report: { toolVersions } };
}

function occurrence(terminalTier: string, prerequisiteTiers: readonly string[] = []): object {
  return { route: { terminalTier, prerequisiteTiers } };
}

function validateFailureConfirmationToolVersionsV1(
  selectedContext: object,
  selectedOccurrence: object,
): Promise<boolean> {
  return validateTools(selectedContext as never, selectedOccurrence as never);
}

function validateFailureConfirmationContextToolVersionsV1(
  selectedContext: object,
): Promise<boolean> {
  return validateContextTools(selectedContext as never);
}

afterEach(async () => {
  if (originalPath === undefined) delete process.env.PATH;
  else process.env.PATH = originalPath;
  await Promise.all([...directories].map((directory) => rm(directory, { recursive: true })));
  directories.clear();
});

describe.sequential("confirmation tool authority", () => {
  it("requires the exact authenticated Node version even without external tools", async () => {
    await expect(
      validateFailureConfirmationToolVersionsV1(
        context([{ tool: "node", version: process.versions.node }]),
        occurrence("frontend"),
      ),
    ).resolves.toBe(true);
    await expect(
      validateFailureConfirmationToolVersionsV1(
        context([{ tool: "node", version: "0.0.0" }]),
        occurrence("frontend"),
      ),
    ).resolves.toBe(false);

    const directShrink = {
      ...context([{ tool: "node", version: process.versions.node }]),
      disposition: "direct-shrink",
      subject: occurrence("frontend"),
      preceding: [occurrence("vice")],
    };
    await expect(validateFailureConfirmationContextToolVersionsV1(directShrink)).resolves.toBe(
      true,
    );

    const sequenceWithoutControl = {
      ...directShrink,
      disposition: "sequence-only",
      preceding: [],
    };
    await expect(
      validateFailureConfirmationContextToolVersionsV1(sequenceWithoutControl),
    ).resolves.toBe(true);
    await expect(
      validateFailureConfirmationContextToolVersionsV1({
        ...sequenceWithoutControl,
        control: occurrence("frontend"),
      } as never),
    ).resolves.toBe(true);
  });

  it("fails closed on missing, unavailable, or drifted external tool versions", async () => {
    process.env.PATH = await toolDirectory();
    const exact = [
      { tool: "node", version: process.versions.node },
      { tool: "acme", version: "0.97" },
      { tool: "vice", version: "3.10" },
    ];
    const route = occurrence("vice", ["frontend", "emit", "acme"]);
    await expect(validateFailureConfirmationToolVersionsV1(context(exact), route)).resolves.toBe(
      true,
    );
    await expect(
      validateFailureConfirmationToolVersionsV1(
        context(
          exact.map((entry) => (entry.tool === "acme" ? { ...entry, version: "9.9" } : entry)),
        ),
        route,
      ),
    ).resolves.toBe(false);
    await expect(
      validateFailureConfirmationToolVersionsV1(
        context(exact.filter((entry) => entry.tool !== "vice")),
        route,
      ),
    ).resolves.toBe(false);

    process.env.PATH = "";
    await expect(validateFailureConfirmationToolVersionsV1(context(exact), route)).resolves.toBe(
      false,
    );
  });
});
