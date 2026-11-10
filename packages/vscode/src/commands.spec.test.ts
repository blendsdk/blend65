import { describe, expect, it } from "vitest";
import type { CliJsonEnvelope } from "./cli-protocol.js";
import { buildCommand, openEvidenceCommand, runCommand } from "./commands.js";
import type { CliAdapter, CommandHost, HostDocument } from "./commands.js";

/** Recorded host and CLI interactions. */
interface Recorded {
  readonly errors: string[];
  readonly information: string[];
  readonly output: string[];
  readonly diagnostics: unknown[];
  readonly status: string[];
  readonly calls: { readonly args: readonly string[] }[];
  readonly opened: string[];
  readonly revealed: string[];
  readonly saved: string[];
}

/** Build one host with a scripted save result and quick-pick choice. */
function host(
  recorded: Recorded,
  options: {
    readonly trusted?: boolean;
    readonly manifest?: string | null;
    readonly save?: boolean;
    readonly dirty?: boolean;
    readonly unrelatedDirty?: boolean;
    readonly assetDirty?: boolean;
    readonly choice?: string;
  } = {},
): CommandHost {
  const document: HostDocument = {
    uri: "file:///project/src/game.blend",
    path: "/project/src/game.blend",
    languageId: "blend65",
    isDirty: options.dirty ?? false,
    save: async () => {
      recorded.saved.push("game");
      return options.save ?? true;
    },
  };
  const unrelated: HostDocument = {
    uri: "file:///project/README.md",
    path: "/project/README.md",
    languageId: "markdown",
    isDirty: options.unrelatedDirty ?? false,
    save: async () => {
      recorded.saved.push("unrelated");
      return true;
    },
  };
  const asset: HostDocument = {
    uri: "file:///project/assets/data.spd",
    path: "/project/assets/data.spd",
    languageId: "binary",
    isDirty: options.assetDirty ?? false,
    save: async () => {
      recorded.saved.push("asset");
      return true;
    },
  };
  return {
    isTrusted: options.trusted ?? true,
    activeDocument: () => document,
    findManifest: async () => options.manifest ?? "/project/blend65.json",
    documentsUnder: () => [document, unrelated, asset],
    readManifest: async () => ({ sourceRoot: "src", assetPaths: ["assets"] }),
    withProgress: async (_title, task) => task(new AbortController().signal),
    showError: (message) => recorded.errors.push(message),
    showInformation: (message) => recorded.information.push(message),
    output: (line) => recorded.output.push(line),
    publishDiagnostics: async (diagnostics) => recorded.diagnostics.push(...diagnostics),
    clearDiagnostics: () => {},
    setStatus: (_state, message) => recorded.status.push(message),
    showQuickPick: async () => options.choice,
    openText: async (path) => recorded.opened.push(path),
    reveal: async (path) => recorded.revealed.push(path),
  };
}

/** Build one CLI adapter with a fixed envelope. */
function cli(recorded: Recorded, envelope: CliJsonEnvelope): CliAdapter {
  return {
    run: async (args) => {
      recorded.calls.push({ args });
      return envelope;
    },
  };
}

/** Empty recorded interaction set. */
function recorded(): Recorded {
  return {
    errors: [],
    information: [],
    output: [],
    diagnostics: [],
    status: [],
    calls: [],
    opened: [],
    revealed: [],
    saved: [],
  };
}

/** Success envelope for one build command. */
const BUILD_SUCCESS: CliJsonEnvelope = {
  kind: "blend65.cli",
  schemaVersion: 1,
  command: "build",
  outcome: "success",
  exitStatus: 0,
  diagnostics: [],
  generation: {
    generationId: "00000000-0000-4000-8000-000000000000",
    directory: "/project/out/generation",
    buildJsonSha256: "a".repeat(64),
    primaryArtifact: "game.prg",
  },
};

describe("VS Code command logic", () => {
  it("should deny build and run before saving in an untrusted workspace", async () => {
    for (const command of [buildCommand, runCommand]) {
      const events = recorded();
      await command(host(events, { trusted: false }), cli(events, BUILD_SUCCESS));
      expect(events.calls).toEqual([]);
      expect(events.saved).toEqual([]);
      expect(events.errors[0]).toContain("trust");
    }
  });

  it("should abort before the CLI when a dirty input cannot be saved", async () => {
    const events = recorded();
    await buildCommand(host(events, { dirty: true, save: false }), cli(events, BUILD_SUCCESS));
    expect(events.saved).toEqual(["game"]);
    expect(events.calls).toEqual([]);
    expect(events.errors[0]).toContain("could not save");
  });

  it("should run a fresh build and publish its result", async () => {
    const events = recorded();
    await buildCommand(
      host(events, { dirty: true, unrelatedDirty: true, assetDirty: true }),
      cli(events, BUILD_SUCCESS),
    );
    expect(events.calls).toEqual([
      { args: ["build", "--project", "/project/blend65.json", "--json"] },
    ]);
    expect(events.saved).toEqual(["game", "asset"]);
    expect(events.information[0]).toContain("generation");
    expect(events.status).toContain(
      "Blend65: build succeeded for generation 00000000-0000-4000-8000-000000000000.",
    );
  });

  it("should report a failed run without claiming success", async () => {
    const events = recorded();
    await runCommand(
      host(events),
      cli(events, {
        kind: "blend65.cli",
        schemaVersion: 1,
        command: "run",
        outcome: "failure",
        exitStatus: 8,
        diagnostics: [],
        failure: { category: "emulator-start", message: "VICE did not start" },
      }),
    );
    expect(events.errors[0]).toContain("emulator-start");
    expect(events.information).toEqual([]);
    expect(events.status.at(-1)).toContain("failed");
  });

  it("should open a selected evidence artifact and reveal the primary artifact", async () => {
    const evidence: CliJsonEnvelope = {
      kind: "blend65.cli",
      schemaVersion: 1,
      command: "evidence",
      outcome: "success",
      exitStatus: 0,
      diagnostics: [],
      evidence: {
        current: true,
        generationId: "00000000-0000-4000-8000-000000000000",
        directory: "/project/out/generation",
        artifacts: [
          { role: "assembly", path: ".asm", sha256: "b".repeat(64) },
          { role: "primary", path: "game.prg", sha256: "c".repeat(64) },
        ],
      },
    };
    const events = recorded();
    await openEvidenceCommand(
      host(events, { choice: `assembly: .asm (00000000)` }),
      cli(events, evidence),
    );
    expect(events.opened).toEqual(["/project/out/generation/.asm"]);

    const primaryEvents = recorded();
    await openEvidenceCommand(
      host(primaryEvents, { choice: `primary: game.prg (00000000)` }),
      cli(primaryEvents, evidence),
    );
    expect(primaryEvents.revealed).toEqual(["/project/out/generation/game.prg"]);
  });

  it("should reject an escaped artifact path and an invalid hash", async () => {
    const envelope = (path: string, sha256: string): CliJsonEnvelope => ({
      kind: "blend65.cli",
      schemaVersion: 1,
      command: "evidence",
      outcome: "success",
      exitStatus: 0,
      diagnostics: [],
      evidence: {
        current: true,
        generationId: "00000000-0000-4000-8000-000000000000",
        directory: "/project/out/generation",
        artifacts: [{ role: "assembly", path, sha256 }],
      },
    });
    const escaped = recorded();
    await openEvidenceCommand(
      host(escaped, { choice: "assembly: ../../etc/passwd (00000000)" }),
      cli(escaped, envelope("../../etc/passwd", "a".repeat(64))),
    );
    expect(escaped.opened).toEqual([]);
    expect(escaped.revealed).toEqual([]);
    expect(escaped.errors[0]).toContain("escaped");

    const unhashed = recorded();
    await openEvidenceCommand(
      host(unhashed, { choice: "assembly: .asm (00000000)" }),
      cli(unhashed, envelope(".asm", "not-a-hash")),
    );
    expect(unhashed.opened).toEqual([]);
    expect(unhashed.revealed).toEqual([]);
    expect(unhashed.errors[0]).toContain("hash");
  });
});
