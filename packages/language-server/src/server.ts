import { realpath } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  analyzeProjectOverlay,
  byteOffsetToPosition,
  loadProject,
} from "@blend65/compiler/frontend";
import type {
  ProjectDiagnostic,
  ProjectSnapshot,
  SourceOverlay,
  SourceRecord,
  SourceSpan,
} from "@blend65/compiler/frontend";
import {
  createConnection,
  DiagnosticSeverity,
  TextDocuments,
  TextDocumentSyncKind,
} from "vscode-languageserver/node";
import type { Diagnostic, DiagnosticRelatedInformation, Range } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

/** One coalescing queue for the latest analysis request belonging to a project. */
interface ProjectQueue {
  /** Monotonic request identity; older work cannot publish. */
  generation: number;
  /** Pending trailing-edge callback, when changes are still coalescing. */
  pending: NodeJS.Immediate | null;
  /** Current snapshot-load cancellation owner. */
  controller: AbortController | null;
  /** Open document that caused the latest request. */
  anchorUri: string;
  /** Fresh snapshot already loaded while first discovering a document. */
  prefetched: ProjectSnapshot | null;
}

const connection = createConnection(process.stdin, process.stdout);
const documents = new TextDocuments(TextDocument);
const queues = new Map<string, ProjectQueue>();
const documentProjects = new Map<string, string>();
const discoveryControllers = new Map<string, AbortController>();

/** Accept only local Blend65 source URIs and never reinterpret another URI scheme as a path. */
function documentPath(uri: string): string | null {
  try {
    const parsed = new URL(uri);
    if (parsed.protocol !== "file:" || !parsed.pathname.endsWith(".blend")) return null;
    return fileURLToPath(parsed);
  } catch {
    return null;
  }
}

/** Resolve an existing document to the exact canonical source record in a snapshot. */
async function sourceForPath(
  snapshot: ProjectSnapshot,
  path: string,
  signal?: AbortSignal,
): Promise<SourceRecord | null> {
  signal?.throwIfAborted();
  let canonical: string;
  try {
    canonical = await realpath(path);
    signal?.throwIfAborted();
  } catch {
    signal?.throwIfAborted();
    return null;
  }
  return snapshot.sources.find((source) => source.resolvedPath === canonical) ?? null;
}

/** Render a project-level failure at the triggering document without exposing host paths. */
function unlocatedDiagnostic(diagnostic: ProjectDiagnostic): Diagnostic {
  return {
    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
    severity:
      diagnostic.severity === "error" ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
    code: diagnostic.code,
    message: diagnostic.message,
  };
}

/** Clear every still-open document owned by one current project request. */
function clearProjectDiagnostics(
  projectRoot: string,
  generation: number,
  anchorUri: string,
  diagnostics: readonly ProjectDiagnostic[] = [],
): void {
  const queue = queues.get(projectRoot);
  if (queue === undefined || queue.generation !== generation || queue.controller?.signal.aborted) {
    return;
  }
  for (const [uri, root] of [...documentProjects]) {
    if (root !== projectRoot) continue;
    documentProjects.delete(uri);
    if (documents.get(uri) !== undefined) connection.sendDiagnostics({ uri, diagnostics: [] });
  }
  if (documents.get(anchorUri) !== undefined) {
    connection.sendDiagnostics({
      uri: anchorUri,
      diagnostics: diagnostics.map(unlocatedDiagnostic),
    });
  }
}

/** Convert a trusted compiler byte span against the exact analyzed source text. */
function lspRange(span: SourceSpan, text: string): Range {
  return {
    start: byteOffsetToPosition(text, span.start),
    end: byteOffsetToPosition(text, span.end),
  };
}

/** Preserve every related compiler location using its canonical file URI. */
function relatedInformation(
  diagnostic: ProjectDiagnostic,
  sources: ReadonlyMap<string, SourceRecord>,
  texts: ReadonlyMap<string, string>,
): DiagnosticRelatedInformation[] {
  const related: DiagnosticRelatedInformation[] = [];
  for (const item of diagnostic.related) {
    const source = sources.get(item.span.sourceId);
    const text = texts.get(item.span.sourceId);
    if (source === undefined || text === undefined) continue;
    related.push({
      location: {
        uri: pathToFileURL(source.resolvedPath).href,
        range: lspRange(item.span, text),
      },
      message: item.message,
    });
  }
  return related;
}

/** Convert one source-owned compiler diagnostic without changing its order or meaning. */
function lspDiagnostic(
  diagnostic: ProjectDiagnostic,
  sourceId: string,
  sources: ReadonlyMap<string, SourceRecord>,
  texts: ReadonlyMap<string, string>,
): Diagnostic | null {
  if (diagnostic.primarySpan === null || diagnostic.primarySpan.sourceId !== sourceId) return null;
  const text = texts.get(sourceId);
  if (text === undefined) return null;
  const related = relatedInformation(diagnostic, sources, texts);
  return {
    range: lspRange(diagnostic.primarySpan, text),
    severity:
      diagnostic.severity === "error" ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
    code: diagnostic.code,
    message: diagnostic.message,
    ...(related.length === 0 ? {} : { relatedInformation: related }),
  };
}

/** Publish one completed result only to documents currently open in this project. */
async function publishProject(snapshot: ProjectSnapshot, anchorUri: string, generation: number) {
  const queue = queues.get(snapshot.projectRoot);
  if (queue === undefined || queue.generation !== generation || queue.controller?.signal.aborted) {
    return;
  }
  const sources = new Map(snapshot.sources.map((source) => [source.sourceId, source]));
  const texts = new Map(snapshot.sources.map((source) => [source.sourceId, source.text]));
  const overlays: SourceOverlay[] = [];
  const openSources = new Map<string, SourceRecord>();
  const omittedUris: string[] = [];
  for (const document of documents.all()) {
    queue.controller?.signal.throwIfAborted();
    const path = documentPath(document.uri);
    if (path === null) continue;
    const source = await sourceForPath(snapshot, path, queue.controller?.signal);
    if (source === null) {
      if (documentProjects.get(document.uri) === snapshot.projectRoot) {
        omittedUris.push(document.uri);
      }
      continue;
    }
    openSources.set(document.uri, source);
    texts.set(source.sourceId, document.getText());
    overlays.push(Object.freeze({ sourceId: source.sourceId, text: document.getText() }));
  }
  const result = analyzeProjectOverlay(snapshot, overlays);
  await new Promise<void>((resolve) => setImmediate(resolve));
  if (queue.generation !== generation || queue.controller?.signal.aborted) return;
  for (const uri of omittedUris) {
    if (documentProjects.get(uri) !== snapshot.projectRoot) continue;
    documentProjects.delete(uri);
    connection.sendDiagnostics({ uri, diagnostics: [] });
  }
  for (const [uri, source] of openSources) {
    documentProjects.set(uri, snapshot.projectRoot);
    const diagnostics = result.diagnostics.flatMap((diagnostic) => {
      const converted = lspDiagnostic(diagnostic, source.sourceId, sources, texts);
      return converted === null ? [] : [converted];
    });
    connection.sendDiagnostics({ uri, diagnostics });
  }
  const anchor = openSources.get(anchorUri);
  if (anchor !== undefined) {
    const unowned = result.diagnostics.filter((diagnostic) => diagnostic.primarySpan === null);
    if (unowned.length > 0) {
      connection.sendDiagnostics({
        uri: anchorUri,
        diagnostics: unowned.map(unlocatedDiagnostic),
      });
    }
  }
}

/** Run the latest queued load and analysis, dropping cancellation as ordinary supersession. */
async function runQueued(projectRoot: string, generation: number): Promise<void> {
  const queue = queues.get(projectRoot);
  if (queue === undefined || queue.generation !== generation) return;
  queue.pending = null;
  const controller = new AbortController();
  queue.controller = controller;
  try {
    const prefetched = queue.prefetched;
    queue.prefetched = null;
    const loaded =
      prefetched === null
        ? await loadProject({ cwd: projectRoot, signal: controller.signal })
        : { kind: "success" as const, snapshot: prefetched, observations: [] };
    if (controller.signal.aborted) return;
    if (loaded.kind === "failure") {
      clearProjectDiagnostics(projectRoot, generation, queue.anchorUri, loaded.diagnostics);
      return;
    }
    await publishProject(loaded.snapshot, queue.anchorUri, generation);
  } catch {
    if (!controller.signal.aborted) {
      clearProjectDiagnostics(projectRoot, generation, queue.anchorUri);
      connection.console.error("Blend65 project analysis failed");
    }
  } finally {
    if (queue.controller === controller) queue.controller = null;
  }
}

/** Replace pending work so one project retains only its newest trailing-edge request. */
function enqueueProject(
  projectRoot: string,
  anchorUri: string,
  prefetched: ProjectSnapshot | null,
) {
  const queue = queues.get(projectRoot) ?? {
    generation: 0,
    pending: null,
    controller: null,
    anchorUri,
    prefetched: null,
  };
  queue.generation += 1;
  queue.anchorUri = anchorUri;
  queue.prefetched = prefetched;
  if (queue.pending !== null) clearImmediate(queue.pending);
  queue.controller?.abort();
  const generation = queue.generation;
  queue.pending = setImmediate(() => void runQueued(projectRoot, generation));
  queues.set(projectRoot, queue);
}

/** Discover an unknown document once, then route future changes to its project queue. */
async function discoverAndEnqueue(uri: string, path: string): Promise<void> {
  discoveryControllers.get(uri)?.abort();
  const controller = new AbortController();
  discoveryControllers.set(uri, controller);
  try {
    const loaded = await loadProject({ cwd: dirname(path), signal: controller.signal });
    if (controller.signal.aborted) return;
    if (loaded.kind === "failure") {
      if (documents.get(uri) !== undefined) {
        connection.sendDiagnostics({
          uri,
          diagnostics: loaded.diagnostics.map(unlocatedDiagnostic),
        });
      }
      return;
    }
    const source = await sourceForPath(loaded.snapshot, path, controller.signal);
    if (controller.signal.aborted) return;
    if (source === null) {
      documentProjects.delete(uri);
      if (documents.get(uri) !== undefined) connection.sendDiagnostics({ uri, diagnostics: [] });
      return;
    }
    documentProjects.set(uri, loaded.snapshot.projectRoot);
    enqueueProject(loaded.snapshot.projectRoot, uri, loaded.snapshot);
  } catch {
    if (!controller.signal.aborted) {
      connection.console.error("Blend65 project discovery failed");
    }
  } finally {
    if (discoveryControllers.get(uri) === controller) discoveryControllers.delete(uri);
  }
}

/** Queue an admitted file document without letting malformed input reach discovery. */
function schedule(uri: string): void {
  const path = documentPath(uri);
  if (path === null) return;
  const projectRoot = documentProjects.get(uri);
  if (projectRoot === undefined) void discoverAndEnqueue(uri, path);
  else enqueueProject(projectRoot, uri, null);
}

connection.onInitialize(() => ({
  capabilities: {
    textDocumentSync: {
      openClose: true,
      change: TextDocumentSyncKind.Full,
      save: true,
    },
  },
}));

documents.onDidChangeContent(({ document }) => schedule(document.uri));
documents.onDidSave(({ document }) => schedule(document.uri));
documents.onDidClose(({ document }) => {
  discoveryControllers.get(document.uri)?.abort();
  discoveryControllers.delete(document.uri);
  const projectRoot = documentProjects.get(document.uri);
  documentProjects.delete(document.uri);
  connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
  if (projectRoot !== undefined) enqueueProject(projectRoot, document.uri, null);
});

documents.listen(connection);
connection.listen();
