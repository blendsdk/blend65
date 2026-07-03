/**
 * The `CompilerHost` abstraction (RD-15 R14, §4.2; AR-40).
 *
 * Decouples the compiler from the filesystem so that the CLI (a disk-backed
 * implementation — {@link https://npmjs.com/package/@blend65/compiler | `DiskCompilerHost`})
 * and the future LSP (a buffer overlay, RD-14) consume the same facade. The
 * interface is transcribed from RD-15 §4.2 — exactly these three members, no
 * more, no less (R14).
 */

/**
 * Abstraction over file-system access (AR-40).
 *
 * The CLI provides a disk implementation (`DiskCompilerHost` in
 * `@blend65/compiler`); the LSP provides a buffer overlay (RD-14). Implementations
 * MUST NOT throw: {@link readFile} returns `undefined` for an unreadable path.
 */
export interface CompilerHost {
  /**
   * List all `.blend` source files in the project.
   *
   * @returns Absolute paths, lexicographically sorted — the determinism guarantee
   *   that R21's `outName` derivation and RD-13 rely on. Display-time
   *   relativization to `projectRoot` happens at interning (AR-V17), not here.
   */
  listSourceFiles(): string[];

  /**
   * Read a file's content.
   *
   * @param path The path to read (typically an absolute path from
   *   {@link listSourceFiles} or {@link resolvePath}).
   * @returns The file's text, or `undefined` if it does not exist or cannot be
   *   read (the contract never throws).
   */
  readFile(path: string): string | undefined;

  /**
   * Resolve a path to an absolute path.
   *
   * @param path A path, possibly relative to the project root.
   * @returns The absolute form of `path`.
   */
  resolvePath(path: string): string;
}
