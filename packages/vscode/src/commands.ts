import { dirname, join, resolve, sep } from "node:path";
import type { CliJsonDiagnostic, CliJsonEnvelope } from "./cli-protocol.js";

/** One open editor document visible to command logic. */
export interface HostDocument {
  /** Exact document URI. */
  readonly uri: string;
  /** Canonical host path. */
  readonly path: string;
  /** Language identity. */
  readonly languageId: string;
  /** Whether the document has unsaved changes. */
  readonly isDirty: boolean;
  /** Save the document and report whether it succeeded. */
  save(): Promise<boolean>;
}

/** Narrow editor boundary used by the command logic. */
export interface CommandHost {
  /** VS Code workspace trust state. */
  readonly isTrusted: boolean;
  /** Active editor document, when one exists. */
  activeDocument(): HostDocument | null;
  /** Find the nearest containing manifest for one document. */
  findManifest(documentUri: string): Promise<string | null>;
  /** Open documents under one canonical project root. */
  documentsUnder(root: string): readonly HostDocument[];
  /** Read the project's source root and declared asset paths. */
  readManifest(path: string): Promise<{
    readonly sourceRoot: string;
    readonly assetPaths: readonly string[];
  } | null>;
  /** Run one cancellable command with a VS Code progress surface. */
  withProgress<T>(title: string, task: (signal: AbortSignal) => Promise<T>): Promise<T>;
  /** Report one actionable error. */
  showError(message: string): void;
  /** Report one success summary. */
  showInformation(message: string): void;
  /** Append one bounded output line. */
  output(line: string): void;
  /** Publish structured build/run diagnostics. */
  publishDiagnostics(diagnostics: readonly CliJsonDiagnostic[], projectRoot: string): Promise<void>;
  /** Clear the build/run diagnostic collection. */
  clearDiagnostics(): void;
  /** Update the status bar. */
  setStatus(state: "idle" | "building" | "running" | "error", message: string): void;
  /** Show a bounded quick pick. */
  showQuickPick(items: readonly string[]): Promise<string | undefined>;
  /** Open one text artifact. */
  openText(path: string): Promise<void>;
  /** Reveal one binary artifact in the host file manager. */
  reveal(path: string): Promise<void>;
}

/** Narrow CLI adapter used by the commands. */
export interface CliAdapter {
  /** Run one command and return its validated machine-readable envelope. */
  run(args: readonly string[], signal: AbortSignal): Promise<CliJsonEnvelope>;
}

/** Save every dirty consumed source or declared asset, or abort the command. */
async function saveDirty(host: CommandHost, projectRoot: string): Promise<boolean> {
  const manifest = await host.readManifest(join(projectRoot, "blend65.json"));
  const assetRoots = (manifest?.assetPaths ?? []).map((asset) => resolve(projectRoot, asset));
  for (const document of host.documentsUnder(projectRoot)) {
    if (!document.isDirty) continue;
    const source = document.path.endsWith(".blend");
    const asset = assetRoots.some(
      (root) => document.path === root || document.path.startsWith(root + sep),
    );
    if (!source && !asset) continue;
    let saved = false;
    try {
      saved = await document.save();
    } catch {
      saved = false;
    }
    if (!saved) {
      host.showError(`Blend65: could not save ${document.uri}; the command was not started.`);
      return false;
    }
  }
  return true;
}

/** Summarize one envelope without dumping source or monitor data. */
function summary(command: string, envelope: CliJsonEnvelope): string {
  if (envelope.outcome === "success") {
    const generation = envelope.generation?.generationId;
    return generation === undefined
      ? `Blend65: ${command} succeeded.`
      : `Blend65: ${command} succeeded for generation ${generation}.`;
  }
  if (envelope.outcome === "cancelled") return `Blend65: ${command} was cancelled.`;
  const category = envelope.failure?.category ?? "failure";
  return `Blend65: ${command} failed (${category}).`;
}

/** Run one explicit build or fresh build-and-run command. */
async function execute(
  host: CommandHost,
  cli: CliAdapter,
  command: "build" | "run",
): Promise<void> {
  if (!host.isTrusted) {
    host.showError("Blend65: workspace trust is required to build or run.");
    return;
  }
  const active = host.activeDocument();
  if (active === null) {
    host.showError("Blend65: no active editor.");
    return;
  }
  const manifest = await host.findManifest(active.uri);
  if (manifest === null) {
    host.showError("Blend65: no project manifest was found for the active file.");
    return;
  }
  host.clearDiagnostics();
  if (!(await saveDirty(host, dirname(manifest)))) return;
  host.setStatus(command === "build" ? "building" : "running", `Blend65: ${command}…`);
  try {
    const envelope = await host.withProgress(`Blend65: ${command}`, (signal) =>
      cli.run([command, "--project", manifest, "--json"], signal),
    );
    host.setStatus(envelope.outcome === "success" ? "idle" : "error", summary(command, envelope));
    await host.publishDiagnostics(envelope.diagnostics, dirname(manifest));
    host.output(summary(command, envelope));
    if (envelope.outcome === "success") host.showInformation(summary(command, envelope));
    else host.showError(summary(command, envelope));
  } catch {
    host.setStatus("error", `Blend65: ${command} failed.`);
    host.showError(`Blend65: ${command} failed before a result was available.`);
  }
}

/** Register the explicit Build command behavior. */
export async function buildCommand(host: CommandHost, cli: CliAdapter): Promise<void> {
  await execute(host, cli, "build");
}

/** Register the explicit fresh Run in VICE command behavior. */
export async function runCommand(host: CommandHost, cli: CliAdapter): Promise<void> {
  await execute(host, cli, "run");
}

/** Open one validated current-generation artifact. */
export async function openEvidenceCommand(host: CommandHost, cli: CliAdapter): Promise<void> {
  if (!host.isTrusted) {
    host.showError("Blend65: workspace trust is required to open build evidence.");
    return;
  }
  const active = host.activeDocument();
  if (active === null) {
    host.showError("Blend65: no active editor.");
    return;
  }
  const manifest = await host.findManifest(active.uri);
  if (manifest === null) {
    host.showError("Blend65: no project manifest was found for the active file.");
    return;
  }
  try {
    const envelope = await host.withProgress("Blend65: resolve build evidence", (signal) =>
      cli.run(["evidence", "--project", manifest, "--json"], signal),
    );
    if (envelope.outcome !== "success" || envelope.evidence === undefined) {
      host.showError("Blend65: no valid current build evidence is available.");
      return;
    }
    const evidence = envelope.evidence;
    const labels = evidence.artifacts.map(
      ({ role, path }) => `${role}: ${path} (${evidence.generationId.slice(0, 8)})`,
    );
    const choice = await host.showQuickPick(labels);
    if (choice === undefined) return;
    const index = labels.indexOf(choice);
    const artifact = evidence.artifacts[index];
    if (artifact === undefined) return;
    const base = resolve(evidence.directory);
    const path = resolve(base, artifact.path);
    if (path !== base && !path.startsWith(base + sep)) {
      host.showError("Blend65: the artifact path escaped its immutable generation.");
      return;
    }
    if (!/^[0-9a-f]{64}$/u.test(artifact.sha256)) {
      host.showError("Blend65: the selected artifact lacks a valid hash.");
      return;
    }
    if (artifact.role === "primary") await host.reveal(path);
    else await host.openText(path);
  } catch {
    host.showError("Blend65: build evidence could not be opened.");
  }
}
