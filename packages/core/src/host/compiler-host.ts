/**
 * The `CompilerHost` abstraction.
 *
 * Decouples the compiler from the filesystem so that the CLI (a disk-backed
 * implementation — {@link https://npmjs.com/package/@blend65/compiler | `DiskCompilerHost`})
 * and the future language server (a buffer overlay) consume the same facade.
 * The interface exposes exactly these three members, no more, no less.
 */

/**
 * Abstraction over file-system access.
 *
 * The CLI provides a disk implementation (`DiskCompilerHost` in
 * `@blend65/compiler`); the language server provides a buffer overlay.
 * Implementations MUST NOT throw: {@link readFile} returns `undefined` for
 * an unreadable path.
 */
export interface CompilerHost {
  /**
   * List all `.blend` source files in the project.
   *
   * @returns Absolute paths, lexicographically sorted — callers that derive
   *   output names or display paths depend on this determinism. Display-time
   *   relativization to `projectRoot` happens at interning, not here.
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
