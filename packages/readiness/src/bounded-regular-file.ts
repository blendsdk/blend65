import { constants as FILE_OPEN_FLAGS } from "node:fs";
import { open } from "node:fs/promises";

/**
 * Reads one regular file through a no-follow handle within an exact byte limit.
 *
 * The handle is validated before reading and checked again afterward so path
 * replacement, growth, truncation, and non-regular files fail closed.
 *
 * @param path Fixed file URL owned by the caller.
 * @param maximumBytes Maximum permitted file size.
 * @returns An isolated byte array containing the complete stable file.
 *
 * @example
 * ```ts
 * const bytes = await readBoundedRegularFileNoFollow(fileUrl, 1_048_576);
 * ```
 */
export async function readBoundedRegularFileNoFollow(
  path: URL,
  maximumBytes: number,
): Promise<Uint8Array> {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 0) {
    throw new TypeError("file byte limit is invalid");
  }
  const handle = await open(path, FILE_OPEN_FLAGS.O_RDONLY | FILE_OPEN_FLAGS.O_NOFOLLOW);
  try {
    const before = await handle.stat();
    if (
      !before.isFile() ||
      !Number.isSafeInteger(before.size) ||
      before.size < 0 ||
      before.size > maximumBytes
    ) {
      throw new TypeError("file is not a bounded regular file");
    }
    const bytes = Buffer.allocUnsafe(before.size + 1);
    let offset = 0;
    while (offset < bytes.byteLength) {
      const read = await handle.read(bytes, offset, bytes.byteLength - offset, offset);
      if (read.bytesRead === 0) break;
      offset += read.bytesRead;
    }
    const after = await handle.stat();
    if (
      offset !== before.size ||
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs
    ) {
      throw new TypeError("file changed while it was being read");
    }
    return bytes.subarray(0, offset);
  } finally {
    await handle.close();
  }
}
