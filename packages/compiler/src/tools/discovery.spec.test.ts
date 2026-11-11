import { chmod, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findVice, probeVice } from "../services/vice.js";
import { discoverAcme } from "./discovery.js";

const roots: string[] = [];

/** Create one isolated tool directory. */
async function root(): Promise<string> {
  const value = await mkdtemp(join(tmpdir(), "blend65-discovery-"));
  roots.push(value);
  return value;
}

/** Write one executable Node script with the selected name. */
async function fake(base: string, name: string, body: string): Promise<string> {
  const bin = join(base, "bin");
  await mkdir(bin, { recursive: true });
  const path = join(bin, name);
  await writeFile(path, `#!/usr/bin/env node\n${body}\n`);
  await chmod(path, 0o755);
  return path;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe.skipIf(process.platform === "win32")("deterministic tool discovery", () => {
  it("accepts the exact ACME version line and records it", async () => {
    const base = await root();
    const path = await fake(
      base,
      "acme",
      "process.stdout.write('This is ACME, release 0.97 (\"Zem\"), 31 Jan 2021\\n');",
    );
    const result = await discoverAcme({ explicitPath: path });
    expect(result).toMatchObject({
      kind: "complete",
      tool: {
        executable: await realpath(path),
        version: "0.97",
        versionLine: 'This is ACME, release 0.97 ("Zem"), 31 Jan 2021',
      },
    });
  });

  it("accepts a CRLF version line on stderr", async () => {
    const base = await root();
    const path = await fake(
      base,
      "acme",
      'process.stderr.write("This is ACME, release 0.97 (Linux x64)\\r\\n");',
    );
    const result = await discoverAcme({ explicitPath: path });
    expect(result).toMatchObject({
      kind: "complete",
      tool: { versionLine: "This is ACME, release 0.97 (Linux x64)" },
    });
  });

  it.each([
    ["a line that does not start with the identity", 'process.stdout.write("release 0.97\\n");'],
    ["an extra version digit", 'process.stdout.write("This is ACME, release 0.970\\n");'],
    ["a different release", 'process.stdout.write("This is ACME, release 0.96\\n");'],
  ])("rejects %s", async (_name, body) => {
    const base = await root();
    const path = await fake(base, "acme", body);
    await expect(discoverAcme({ explicitPath: path })).resolves.toMatchObject({
      kind: "error",
      reason: "version-mismatch",
    });
  });

  it("resolves a relative PATH entry against the operation directory", async () => {
    const base = await root();
    const path = await fake(base, "acme", 'process.stdout.write("This is ACME, release 0.97\\n");');
    const result = await discoverAcme({ path: "bin", cwd: base });
    expect(result).toMatchObject({
      kind: "complete",
      tool: { executable: await realpath(path) },
    });
  });

  it("does not fall back when the configured ACME path is invalid", async () => {
    const base = await root();
    await fake(base, "acme", 'process.stdout.write("This is ACME, release 0.97\\n");');
    await expect(
      discoverAcme({ explicitPath: join(base, "missing", "acme"), path: "bin", cwd: base }),
    ).resolves.toMatchObject({ kind: "error", reason: "invalid-path" });
    await expect(
      discoverAcme({ explicitPath: "bin/acme", path: join(base, "bin") }),
    ).resolves.toMatchObject({ kind: "error", reason: "invalid-path" });
  });

  it("resolves VICE from an explicit path, a relative PATH entry, and no fallback", async () => {
    const base = await root();
    const path = await fake(base, "x64sc", 'process.stdout.write("x64sc (VICE 3.10)\\n");');
    await expect(findVice({ explicitPath: path })).resolves.toBe(await realpath(path));
    await expect(findVice({ path: "bin", cwd: base })).resolves.toBe(await realpath(path));
    await expect(
      findVice({ explicitPath: join(base, "missing", "x64sc"), path: "bin", cwd: base }),
    ).resolves.toBeNull();
    await expect(
      findVice({ explicitPath: "bin/x64sc", path: "bin", cwd: base }),
    ).resolves.toBeNull();
  });

  it("probes only the accepted VICE 3.10 identity", async () => {
    const base = await root();
    const accepted = await fake(base, "x64sc", 'process.stdout.write("x64sc (VICE 3.10)\\n");');
    const revision = await fake(
      await root(),
      "x64sc",
      'process.stdout.write("x64sc (VICE 3.10.0 SVN r123)\\n");',
    );
    const rejected = await fake(
      await root(),
      "x64sc",
      'process.stdout.write("x64sc (VICE 3.9)\\n");',
    );
    await expect(probeVice(accepted)).resolves.toBe(true);
    await expect(probeVice(revision)).resolves.toBe(true);
    await expect(probeVice(rejected)).resolves.toBe(false);
  });
});
