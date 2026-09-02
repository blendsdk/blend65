import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  discoverExecutionEnvironmentCapabilitiesV1,
  discoverRequiredExecutionToolVersionsV1,
  probeExecutionExternalToolV1,
} from "./execution-tool-discovery.js";

const originalPath = process.env.PATH;
const directories = new Set<string>();

async function executable(name: string, output: string, exitCode = 0): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "blend65-tool-discovery-"));
  directories.add(directory);
  await writeFile(
    join(directory, name),
    `#!/bin/sh\nprintf '%s\\n' '${output}'\nexit ${exitCode}\n`,
    "utf8",
  );
  await chmod(join(directory, name), 0o700);
  return directory;
}

afterEach(async () => {
  if (originalPath === undefined) delete process.env.PATH;
  else process.env.PATH = originalPath;
  await Promise.all([...directories].map((directory) => rm(directory, { recursive: true })));
  directories.clear();
});

describe.sequential("bounded execution tool discovery", () => {
  it("extracts exact allowlisted versions and orders each requested tool once", async () => {
    const directory = await executable("acme", "ACME assembler 0.97");
    await writeFile(join(directory, "x64sc"), "#!/bin/sh\nprintf '%s\\n' 'VICE 3.10.1'\n", "utf8");
    await chmod(join(directory, "x64sc"), 0o700);
    process.env.PATH = directory;

    await expect(probeExecutionExternalToolV1("acme")).resolves.toEqual({
      available: true,
      version: "0.97",
    });
    await expect(probeExecutionExternalToolV1("vice")).resolves.toEqual({
      available: true,
      version: "3.10.1",
    });
    await expect(
      discoverRequiredExecutionToolVersionsV1(["vice", "acme", "vice"]),
    ).resolves.toEqual([
      { tool: "acme", version: "0.97" },
      { tool: "vice", version: "3.10.1" },
    ]);
    await expect(discoverExecutionEnvironmentCapabilitiesV1()).resolves.toEqual({
      acme: { available: true, version: "0.97" },
      vice: { available: true, version: "3.10.1" },
    });
  });

  it("fails closed for unavailable tools and retains a bounded availability fallback", async () => {
    process.env.PATH = await executable("acme", "available without a numeric version");
    await expect(probeExecutionExternalToolV1("acme")).resolves.toEqual({
      available: true,
      version: "available",
    });
    await expect(probeExecutionExternalToolV1("vice")).resolves.toEqual({ available: false });
    await expect(discoverRequiredExecutionToolVersionsV1(["vice"])).resolves.toBeUndefined();
  });
});
