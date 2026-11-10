import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import * as vscode from "vscode";
import { LanguageClient, TransportKind } from "vscode-languageclient/node";
import type { CliJsonDiagnostic } from "./cli-protocol.js";
import { buildCommand, openEvidenceCommand, runCommand } from "./commands.js";
import type { CommandHost, HostDocument } from "./commands.js";
import { createCliAdapter } from "./cli-client.js";
import { parseProjectStatus, statusText } from "./status.js";

let activeClient: LanguageClient | null = null;
let outputChannel: vscode.OutputChannel | null = null;
let statusItem: vscode.StatusBarItem | null = null;
let buildDiagnostics: vscode.DiagnosticCollection | null = null;
let watcher: vscode.FileSystemWatcher | null = null;

/** Convert one UTF-8 byte boundary to a VS Code position. */
function positionAt(text: string, byteOffset: number): vscode.Position {
  const prefix = Buffer.from(text, "utf8").subarray(0, byteOffset).toString("utf8");
  const lines = prefix.split(/\r\n|\r|\n/u);
  return new vscode.Position(Math.max(0, lines.length - 1), lines[lines.length - 1]!.length);
}

/** Build the real VS Code host boundary for the pure command logic. */
function createHost(): CommandHost {
  const channel = outputChannel!;
  const status = statusItem!;
  const collection = buildDiagnostics!;
  return {
    get isTrusted() {
      return vscode.workspace.isTrusted;
    },
    activeDocument(): HostDocument | null {
      const document = vscode.window.activeTextEditor?.document;
      if (document === undefined) return null;
      return {
        uri: document.uri.toString(),
        path: document.uri.fsPath,
        languageId: document.languageId,
        isDirty: document.isDirty,
        save: () => Promise.resolve(document.save()),
      };
    },
    async findManifest(documentUri: string): Promise<string | null> {
      let directory: string;
      try {
        directory = dirname(fileURLToPath(documentUri));
      } catch {
        return null;
      }
      for (;;) {
        const candidate = join(directory, "blend65.json");
        if (existsSync(candidate)) return candidate;
        const parent = dirname(directory);
        if (parent === directory) return null;
        directory = parent;
      }
    },
    documentsUnder(root: string): readonly HostDocument[] {
      const prefix = root.endsWith(sep) ? root : root + sep;
      return vscode.workspace.textDocuments
        .filter(
          (document) => document.uri.scheme === "file" && document.uri.fsPath.startsWith(prefix),
        )
        .map((document) => ({
          uri: document.uri.toString(),
          path: document.uri.fsPath,
          languageId: document.languageId,
          isDirty: document.isDirty,
          save: () => Promise.resolve(document.save()),
        }));
    },
    async readManifest(path: string): Promise<{
      readonly sourceRoot: string;
      readonly assetPaths: readonly string[];
    } | null> {
      try {
        const value: unknown = JSON.parse(await readFile(path, "utf8"));
        if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
        const record = value as Record<string, unknown>;
        return {
          sourceRoot: typeof record.sourceRoot === "string" ? record.sourceRoot : "src",
          assetPaths: Array.isArray(record.assetPaths)
            ? record.assetPaths.filter((asset): asset is string => typeof asset === "string")
            : [],
        };
      } catch {
        return null;
      }
    },
    withProgress<T>(title: string, task: (signal: AbortSignal) => Promise<T>): Promise<T> {
      return Promise.resolve(
        vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title,
            cancellable: true,
          },
          (_progress, token) => {
            const controller = new AbortController();
            token.onCancellationRequested(() => controller.abort());
            return task(controller.signal);
          },
        ),
      );
    },
    showError(message: string): void {
      void vscode.window.showErrorMessage(message);
    },
    showInformation(message: string): void {
      void vscode.window.showInformationMessage(message);
    },
    output(line: string): void {
      channel.appendLine(line);
    },
    async publishDiagnostics(
      diagnostics: readonly CliJsonDiagnostic[],
      projectRoot: string,
    ): Promise<void> {
      collection.clear();
      const grouped = new Map<string, vscode.Diagnostic[]>();
      for (const diagnostic of diagnostics) {
        const span = diagnostic.primarySpan;
        if (span === null) continue;
        const document = vscode.workspace.textDocuments.find(
          (candidate) =>
            relative(projectRoot, candidate.uri.fsPath).split(sep).join("/") === span.sourceId,
        );
        if (document === undefined) continue;
        const item = new vscode.Diagnostic(
          new vscode.Range(
            positionAt(document.getText(), span.start),
            positionAt(document.getText(), span.end),
          ),
          diagnostic.message,
          diagnostic.severity === "error"
            ? vscode.DiagnosticSeverity.Error
            : vscode.DiagnosticSeverity.Warning,
        );
        item.code = diagnostic.code;
        item.source = "blend65";
        const list = grouped.get(document.uri.toString()) ?? [];
        list.push(item);
        grouped.set(document.uri.toString(), list);
      }
      for (const [uri, items] of grouped) {
        collection.set(vscode.Uri.parse(uri), items);
      }
    },
    clearDiagnostics(): void {
      collection.clear();
    },
    setStatus(state: "idle" | "building" | "running" | "error", message: string): void {
      status.text = message;
      status.tooltip = `Blend65 status: ${state}`;
      status.show();
    },
    showQuickPick(items: readonly string[]): Promise<string | undefined> {
      return Promise.resolve(vscode.window.showQuickPick([...items]));
    },
    async openText(path: string): Promise<void> {
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(path));
      await vscode.window.showTextDocument(document, { preview: true });
    },
    async reveal(path: string): Promise<void> {
      await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(path));
    },
  };
}

/** Start the matching language server and register the explicit command surface. */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  outputChannel = vscode.window.createOutputChannel("Blend65");
  statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusItem.text = "Blend65: no project";
  statusItem.tooltip = "Blend65 status: no project";
  statusItem.show();
  buildDiagnostics = vscode.languages.createDiagnosticCollection("Blend65 Build");
  context.subscriptions.push(outputChannel, statusItem, buildDiagnostics);

  const require = createRequire(import.meta.url);
  const serverModule = require.resolve("@blend65/language-server");
  const client = new LanguageClient(
    "blend65",
    "Blend65",
    { module: serverModule, transport: TransportKind.stdio },
    { documentSelector: [{ scheme: "file", language: "blend65" }] },
  );
  client.onNotification("blend65/projectStatus", (params: unknown) => {
    const status = parseProjectStatus(params);
    if (status === null) return;
    statusItem!.text = statusText(status);
    statusItem!.tooltip = statusText(status);
    statusItem!.show();
  });
  await client.start();
  activeClient = client;
  context.subscriptions.push(client);

  const host = createHost();
  const cli = createCliAdapter();
  context.subscriptions.push(
    vscode.commands.registerCommand("blend65.build", () => buildCommand(host, cli)),
    vscode.commands.registerCommand("blend65.run", () => runCommand(host, cli)),
    vscode.commands.registerCommand("blend65.openEvidence", () => openEvidenceCommand(host, cli)),
  );

  watcher = vscode.workspace.createFileSystemWatcher("**/*");
  const refresh = (uri: vscode.Uri): void => {
    void client.sendNotification("workspace/didChangeWatchedFiles", {
      changes: [{ uri: uri.toString(), type: vscode.FileChangeType.Changed }],
    });
  };
  watcher.onDidChange(refresh);
  watcher.onDidCreate(refresh);
  watcher.onDidDelete(refresh);
  context.subscriptions.push(watcher);
}

/** Stop the owned language client. */
export async function deactivate(): Promise<void> {
  watcher?.dispose();
  watcher = null;
  if (activeClient !== null) {
    await activeClient.stop();
    activeClient = null;
  }
}
