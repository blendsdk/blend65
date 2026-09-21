import {
  access,
  chmod,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createC64Startup } from "../layout/startup.js";
import { layoutC64Program } from "../layout/c64-layout.js";
import { machineInstruction } from "../machine/lower-control.js";
import type { StorageClosureCertificate } from "../storage/storage-types.js";
import { selectTargetProfile } from "../target/profile.js";
import { runAcme } from "../tools/acme.js";
import { discoverAcme } from "../tools/discovery.js";
import { serializeAcme } from "./acme-serializer.js";

function selectedProfile() {
  const result = selectTargetProfile("c64-pal-prg-kernal-6581");
  if (result.kind !== "complete") throw new Error("Expected the admitted C64 target profile");
  return result.profile;
}

function storageCertificate(): StorageClosureCertificate {
  return Object.freeze({
    inventoryHash: "inventory",
    graphHash: "graph",
    profileId: "c64-pal-prg-kernal-6581",
    homes: Object.freeze([]),
    interference: Object.freeze([]),
    helperCalls: Object.freeze([]),
    staticBytes: Object.freeze({ ram: 0, zeroPage: 0 }),
    peakBytes: Object.freeze({ ram: 0, zeroPage: 0 }),
    hardwareStackPeak: 10,
    closed: true,
  });
}

function completeLayout() {
  const profile = selectedProfile();
  const startup = createC64Startup({
    initializerLabels: Object.freeze([]),
    mainLabel: "main",
    profile,
  });
  if (startup.kind !== "complete") throw new Error("Expected C64 startup construction");
  const main = Object.freeze({
    id: "main",
    blocks: Object.freeze([
      Object.freeze({
        label: "main.entry",
        instructions: Object.freeze([
          machineInstruction(profile.cpu, "lda", "immediate", {
            kind: "immediate",
            value: 0x2a,
          }),
        ]),
        terminator: Object.freeze({ kind: "return" as const, opcode: "rts" as const }),
      }),
    ]),
  });
  const result = layoutC64Program({
    program: Object.freeze({
      functions: Object.freeze([main]),
      data: Object.freeze([
        Object.freeze({
          id: "constant:message",
          kind: "immutable" as const,
          alignment: 1,
          bytes: Object.freeze([0x42, 0x36, 0x35]),
        }),
      ]),
      startup: startup.startup,
      requiredStorage: Object.freeze([]),
    }),
    certificate: storageCertificate(),
    profile,
  });
  if (result.kind !== "complete") throw new Error("Expected a complete C64 layout fixture");
  return Object.freeze({ layout: result, certificate: storageCertificate(), profile });
}

async function executable(root: string, name: string, body: string): Promise<string> {
  const path = join(root, name);
  await writeFile(path, `#!/usr/bin/env node\n${body}\n`, "utf8");
  await chmod(path, 0o755);
  return path;
}

async function realAcmeWrapper(root: string, logPath: string): Promise<string> {
  return executable(
    root,
    "acme-wrapper.mjs",
    `import { appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const args = process.argv.slice(2);
if (!args.includes("--cpu")) {
  process.stdout.write("ACME, release 0.97\\n");
  process.exit(0);
}
appendFileSync(${JSON.stringify(logPath)}, JSON.stringify(args) + "\\n");
const result = spawnSync("acme", args, { stdio: "inherit" });
process.exit(result.status ?? 1);`,
  );
}

async function fakeAcme(root: string, name: string, action: string): Promise<string> {
  return executable(
    root,
    name,
    `const args = process.argv.slice(2);
if (!args.includes("--cpu")) {
  process.stdout.write("ACME, release 0.97\\n");
  process.exit(0);
}
${action}`,
  );
}

async function discovered(explicitPath?: string) {
  const result = await discoverAcme(explicitPath === undefined ? undefined : { explicitPath });
  if (result.kind !== "complete") throw new Error("Expected ACME discovery to complete");
  return result.tool;
}

function serialized() {
  const input = completeLayout();
  const result = serializeAcme(input);
  if (result.kind !== "complete") throw new Error("Expected ACME serialization to complete");
  return Object.freeze({ input, result });
}

describe("terminal ACME artifacts", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "blend65-acme-spec-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  // Final structured machine input has one deterministic, explicit ACME representation.
  it("should serialize identical final input to byte-identical legal NMOS assembly", () => {
    const first = serialized();
    const second = serializeAcme(first.input);

    expect(second).toEqual(first.result);
    expect(first.result.source).toContain("!cpu 6502");
    expect(first.result.source).toContain("* = $0801");
    expect(first.result.source).toMatch(/!byte\s+/);
    expect(first.result.source).not.toMatch(/(^|\s)!to\b/m);
    expect(first.result.source).not.toMatch(/(^|\s)!macro\b/m);
    expect(first.result.source).not.toContain("constant:message");
    expect(Buffer.from(first.result.source, "utf8").toString("ascii")).toBe(first.result.source);
    expect(first.result.expectedLabels).toEqual(
      second.kind === "complete" && second.expectedLabels,
    );
    expect(first.result.expectedSegments).toEqual(
      second.kind === "complete" && second.expectedSegments,
    );
  });

  // The terminal invocation is a fixed argument vector and its report is temporary evidence.
  it("should invoke real ACME 0.97 with exact arguments and reconcile its outputs", async () => {
    const staging = join(root, "staging");
    const logPath = join(root, "arguments.jsonl");
    await writeFile(logPath, "", "utf8");
    const wrapper = await realAcmeWrapper(root, logPath);
    const tool = await discovered(wrapper);
    const serialization = serialized();
    const result = await runAcme({
      tool,
      stagingDirectory: staging,
      artifactName: "game",
      serialization: serialization.result,
      layout: serialization.input.layout,
    });

    expect(result.kind).toBe("complete");
    expect(JSON.parse((await readFile(logPath, "utf8")).trim())).toEqual([
      "--cpu",
      "6502",
      "--strict-segments",
      "--format",
      "cbm",
      "--outfile",
      join(staging, "game.prg"),
      "--report",
      join(staging, ".acme.report"),
      "--symbollist",
      join(staging, ".labels"),
      join(staging, ".asm"),
    ]);
    expect(await readdir(staging)).toEqual([".asm", ".labels", "game.prg"]);
    await expect(access(join(staging, ".acme.report"))).rejects.toThrow();
    expect((await readFile(join(staging, "game.prg"))).subarray(0, 2)).toEqual(
      Buffer.from([0x01, 0x08]),
    );
  });

  // Discovery and execution errors are terminal and cannot create a current generation.
  it("should classify missing, wrong-version, failed, excessive and cancelled tools", async () => {
    const missing = await discoverAcme({ explicitPath: join(root, "missing-acme") });
    expect(missing).toEqual(expect.objectContaining({ kind: "error", reason: "invalid-path" }));

    const wrong = await executable(
      root,
      "wrong-version.mjs",
      'process.stdout.write("ACME, release 0.96\\n");',
    );
    expect(await discoverAcme({ explicitPath: wrong })).toEqual(
      expect.objectContaining({ kind: "error", reason: "version-mismatch" }),
    );

    const failed = await fakeAcme(
      root,
      "failed.mjs",
      'process.stderr.write("failure\\n"); process.exit(7);',
    );
    const serialization = serialized();
    const failedResult = await runAcme({
      tool: await discovered(failed),
      stagingDirectory: join(root, "failed-staging"),
      artifactName: "game",
      serialization: serialization.result,
      layout: serialization.input.layout,
    });
    expect(failedResult).toEqual(expect.objectContaining({ kind: "error", reason: "process" }));

    const excessive = await fakeAcme(
      root,
      "excessive.mjs",
      'for (let index = 0; index < 8192; index += 1) process.stdout.write("x".repeat(1024));',
    );
    const excessiveResult = await runAcme({
      tool: await discovered(excessive),
      stagingDirectory: join(root, "excessive-staging"),
      artifactName: "game",
      serialization: serialization.result,
      layout: serialization.input.layout,
    });
    expect(excessiveResult).toEqual(
      expect.objectContaining({ kind: "error", reason: "output-limit" }),
    );

    const controller = new AbortController();
    controller.abort();
    const cancelled = await runAcme({
      tool: await discovered(failed),
      stagingDirectory: join(root, "cancelled-staging"),
      artifactName: "game",
      serialization: serialization.result,
      layout: serialization.input.layout,
      signal: controller.signal,
    });
    expect(cancelled).toEqual(expect.objectContaining({ kind: "error", reason: "cancelled" }));
    await expect(access(join(root, "current.json"))).rejects.toThrow();
  });

  // Existing or tool-created filesystem aliases can never enter publication evidence.
  it("should reject stale, symlinked, aliased, directory, changed and unexpected outputs", async () => {
    const serialization = serialized();
    const staleStaging = join(root, "stale");
    await writeFile(staleStaging, "not a directory", "utf8");
    const stale = await runAcme({
      tool: await discovered(),
      stagingDirectory: staleStaging,
      artifactName: "game",
      serialization: serialization.result,
      layout: serialization.input.layout,
    });
    expect(stale).toEqual(expect.objectContaining({ kind: "error", reason: "invalid-staging" }));

    const cases = [
      {
        name: "symlink",
        action:
          'const fs = await import("node:fs"); const out = args[args.indexOf("--outfile") + 1]; fs.symlinkSync("/dev/null", out);',
      },
      {
        name: "directory",
        action:
          'const fs = await import("node:fs"); const out = args[args.indexOf("--outfile") + 1]; fs.mkdirSync(out);',
      },
      {
        name: "alias",
        action:
          'const fs = await import("node:fs"); const out = args[args.indexOf("--outfile") + 1]; const labels = args[args.indexOf("--symbollist") + 1]; fs.writeFileSync(out, "x"); fs.linkSync(out, labels);',
      },
      {
        name: "changed",
        action:
          'const fs = await import("node:fs"); const source = args.at(-1); fs.writeFileSync(source, "changed after validation");',
      },
      {
        name: "unexpected",
        action:
          'const fs = await import("node:fs"); const source = args.at(-1); fs.writeFileSync(new URL("unexpected.bin", `file://${source}`).pathname, "x");',
      },
    ] as const;

    for (const candidate of cases) {
      const tool = await discovered(
        await fakeAcme(root, `malicious-${candidate.name}.mjs`, candidate.action),
      );
      const result = await runAcme({
        tool,
        stagingDirectory: join(root, `malicious-${candidate.name}`),
        artifactName: "game",
        serialization: serialization.result,
        layout: serialization.input.layout,
      });
      expect(result, candidate.name).toEqual(
        expect.objectContaining({ kind: "error", reason: "invalid-output" }),
      );
    }
  });
});
