import { lstat, realpath, stat } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import {
  hostErrorCode,
  projectDiagnostic,
  PROJECT_CODES,
  ProjectFailure,
  throwReadFailure,
} from "./diagnostics.js";
import { resolveInput, throwPathFailure } from "./paths.js";
import type { ResolvedInput } from "./paths.js";
import type { ProjectLoadOptions } from "./types.js";
import { firstUnpairedSurrogate } from "./positions.js";

/** Selected manifest and its logical/canonical containing directories. */
export interface ProjectSelection {
  /** Absolute logical manifest directory. */
  readonly logicalRoot: string;
  /** Canonical containing directory used for containment. */
  readonly root: string;
  /** Resolved regular manifest input. */
  readonly manifest: ResolvedInput;
}

/** Select the nearest manifest, never falling back from a present but invalid/unreadable one. */
export async function discoverProject(options: ProjectLoadOptions): Promise<ProjectSelection> {
  options.signal?.throwIfAborted();
  const cwd = resolve(options.cwd ?? process.cwd());
  let path: string;
  if (options.project !== undefined) {
    if (options.project.includes("\0") || firstUnpairedSurrogate(options.project) !== null)
      throwPathFailure("--project", "invalid native path spelling");
    path = resolve(cwd, options.project);
  } else {
    let directory = cwd;
    for (;;) {
      options.signal?.throwIfAborted();
      path = resolve(directory, "blend65.json");
      try {
        await lstat(path);
        options.signal?.throwIfAborted();
        break;
      } catch (error) {
        options.signal?.throwIfAborted();
        if (hostErrorCode(error) !== "ENOENT") throwReadFailure(error, "--cwd");
      }
      const parent = dirname(directory);
      if (parent === directory)
        throw new ProjectFailure([
          projectDiagnostic(PROJECT_CODES.notFound, "No blend65.json project found"),
        ]);
      directory = parent;
    }
  }
  const logicalRoot = dirname(path);
  let root: string;
  try {
    options.signal?.throwIfAborted();
    root = await realpath(logicalRoot);
    options.signal?.throwIfAborted();
    if (!(await stat(root)).isDirectory()) throwPathFailure("--project", "expected a directory");
    options.signal?.throwIfAborted();
  } catch (error) {
    options.signal?.throwIfAborted();
    if (error instanceof ProjectFailure) throw error;
    throwReadFailure(error, options.project === undefined ? "--cwd" : "--project");
  }
  options.signal?.throwIfAborted();
  const manifest = await resolveInput(path, logicalRoot, root, basename(path));
  options.signal?.throwIfAborted();
  if (!manifest.metadata.isFile()) throwPathFailure(manifest.sourceId, "expected a regular file");
  return { logicalRoot, root, manifest };
}
