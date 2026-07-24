import { lstat, open, rename, unlink } from "node:fs/promises";
import { dirname, join, parse, resolve } from "node:path";
import { randomUUID } from "node:crypto";

export interface PublicationHooks {
  readonly afterTemporaryFileSynced?: (target: "declarations" | "markdown") => void | Promise<void>;
  readonly afterTargetRenamed?: (target: "declarations" | "markdown") => void | Promise<void>;
}

async function rejectSymlinkComponents(path: string): Promise<void> {
  const absolute = resolve(path);
  const root = parse(absolute).root;
  const parts = absolute.slice(root.length).split("/").filter(Boolean);
  let current = root;
  for (const part of parts.slice(0, -1)) {
    current = join(current, part);
    const entry = await lstat(current);
    if (entry.isSymbolicLink())
      throw new Error(`Symlink path component is not allowed: ${current}`);
  }
}

/** Replaces one file through an exclusive invocation-owned same-directory temporary. */
export async function replaceFileAtomically(
  path: string,
  bytes: Uint8Array,
  target: "declarations" | "markdown",
  hooks?: PublicationHooks,
): Promise<void> {
  await rejectSymlinkComponents(path);
  const temporary = join(dirname(path), `.${target}.${process.pid}.${randomUUID()}.tmp`);
  let created = false;
  try {
    const handle = await open(temporary, "wx", 0o600);
    created = true;
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await hooks?.afterTemporaryFileSynced?.(target);
    await rename(temporary, path);
    created = false;
    await hooks?.afterTargetRenamed?.(target);
  } finally {
    if (created) await unlink(temporary).catch(() => undefined);
  }
}
